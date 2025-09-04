// src/db/syncQueue.ts - FIXED with consolidated interfaces
import { getDB } from "./dbClient";
import { AIOpsDB } from "./seedIndexedDB";

// ✅ CRITICAL FIX: Import and re-export types from syncTypes.ts to avoid duplication
export type { 
  SyncAction,
  SyncStatus,
  SyncMetadata,
  SyncItem,
  SyncPriority,
  SyncStats,
  BatchSyncResult,
  SyncResult,
  ConflictDetails
} from "../sync/syncTypes";

import type { 
  SyncAction,
  SyncStatus, 
  SyncMetadata,
  SyncItem,
  SyncPriority,
  SyncStats,
  BatchSyncResult,
  SyncResult
} from "../sync/syncTypes";

const STORE = "sync_queue";
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BATCH_SIZE = 10;
const RETRY_DELAY_MS = {
  low: 5 * 60 * 1000,      // 5 minutes
  normal: 2 * 60 * 1000,   // 2 minutes
  high: 30 * 1000,         // 30 seconds
  critical: 5 * 1000,      // 5 seconds
};

// ---------------------------------
// Queue Operations
// ---------------------------------
export const enqueue = async <T>(
  tenantId: string,
  item: {
    id: string;
    storeName: string;
    entityId: string;
    action: SyncAction;
    payload: T | null;
    timestamp: string;
    tenantId?: string;
    status?: SyncStatus;
    priority?: SyncPriority; // ✅ Use proper type
    userId?: string;
    correlationId?: string;
  }
): Promise<void> => {
  if (!tenantId) {
    throw new Error("tenantId is required for sync queue operations");
  }

  try {
    const db = await getDB(tenantId);
    const now = new Date().toISOString();
    
    const syncItem: SyncItem<T> = {
      ...item,
      tenantId, // Ensure tenantId is set
      status: item.status || "pending",
      enqueuedAt: now,
      metadata: {
        attemptCount: 0,
        maxAttempts: DEFAULT_MAX_ATTEMPTS,
        priority: item.priority || 'normal',
        userId: item.userId,
        correlationId: item.correlationId,
      },
    };
    
    await db.put(STORE, syncItem);
    console.log(`Enqueued sync item: ${item.action} ${item.storeName}/${item.entityId}`);
  } catch (error) {
    console.error("Failed to enqueue sync item:", error);
    throw new Error(`Sync enqueue failed: ${error}`);
  }
};

export const getNextBatch = async <T>(
  tenantId: string,
  options: {
    limit?: number;
    priority?: SyncPriority; // ✅ Use proper type
    status?: SyncStatus[];
  } = {}
): Promise<SyncItem<T>[]> => {
  if (!tenantId) {
    throw new Error("tenantId is required");
  }

  const { 
    limit = DEFAULT_BATCH_SIZE, 
    priority,
    status = ["pending"]
  } = options;

  try {
    const db = await getDB(tenantId);
    const all = await db.getAll(STORE);
    const now = new Date();
    
    return all
      .filter((item: SyncItem<T>) => {
        // Filter by status
        if (!status.includes(item.status)) return false;
        
        // Filter by priority if specified
        if (priority && item.metadata.priority !== priority) return false;
        
        // Check retry delay for failed items
        if (item.status === 'failed' && item.metadata.retryAfter) {
          const retryTime = new Date(item.metadata.retryAfter);
          if (now < retryTime) return false;
        }
        
        // Skip if max attempts reached
        if (item.metadata.attemptCount >= (item.metadata.maxAttempts || DEFAULT_MAX_ATTEMPTS)) {
          return false;
        }
        
        return true;
      })
      .sort((a: SyncItem<T>, b: SyncItem<T>) => {
        // Sort by priority first (critical > high > normal > low)
        const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
        const aPriority = priorityOrder[a.metadata.priority || 'normal'];
        const bPriority = priorityOrder[b.metadata.priority || 'normal'];
        if (aPriority !== bPriority) return bPriority - aPriority;
        
        // Then by enqueuedAt (FIFO within same priority)
        return a.enqueuedAt.localeCompare(b.enqueuedAt);
      })
      .slice(0, limit);
  } catch (error) {
    console.error("Failed to get next batch:", error);
    throw error;
  }
};

// ✅ CRITICAL FIX: Enhanced getQueueStats to match SyncStats interface
export const getQueueStats = async (tenantId: string): Promise<SyncStats> => {
  if (!tenantId) {
    throw new Error("tenantId is required");
  }

  try {
    const db = await getDB(tenantId);
    const all = await db.getAll(STORE);
    
    const stats: SyncStats = {
      total: all.length,
      pending: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
      conflict: 0,
      cancelled: 0,
      byStore: {} as Record<string, number>,
      byPriority: {           // ✅ Add missing byPriority field
        low: 0,
        normal: 0,
        high: 0,
        critical: 0,
      },
      oldestPending: null as string | null,
      averageAttempts: 0,
      successRate: 0,          // ✅ Add missing successRate field
      lastProcessedAt: undefined, // ✅ Add missing lastProcessedAt field
    };

    let totalAttempts = 0;
    let oldestPendingTime: string | null = null;

    all.forEach((item: SyncItem) => {
      // Count by status
      stats[item.status]++;
      
      // Count by store
      stats.byStore[item.storeName] = (stats.byStore[item.storeName] || 0) + 1;
      
      // ✅ Count by priority
      const priority = item.metadata.priority || 'normal';
      stats.byPriority[priority]++;
      
      // Track oldest pending
      if (item.status === 'pending') {
        if (!oldestPendingTime || item.enqueuedAt < oldestPendingTime) {
          oldestPendingTime = item.enqueuedAt;
        }
      }
      
      totalAttempts += item.metadata.attemptCount;
    });

    stats.oldestPending = oldestPendingTime;
    stats.averageAttempts = all.length > 0 ? totalAttempts / all.length : 0;
    
    // ✅ Calculate success rate
    const totalProcessed = stats.completed + stats.failed + stats.conflict + stats.cancelled;
    stats.successRate = totalProcessed > 0 ? (stats.completed / totalProcessed) * 100 : 0;

    return stats;
  } catch (error) {
    console.error("Failed to get queue stats:", error);
    throw error;
  }
};

export const markInProgress = async (tenantId: string, id: string): Promise<void> => {
  if (!tenantId || !id) {
    throw new Error("tenantId and id are required");
  }

  try {
    const db = await getDB(tenantId);
    const item = await db.get(STORE, id);
    if (!item) {
      throw new Error(`Sync item ${id} not found`);
    }

    item.status = "in_progress";
    item.metadata.attemptCount += 1;
    item.metadata.lastAttemptAt = new Date().toISOString();
    
    await db.put(STORE, item);
  } catch (error) {
    console.error(`Failed to mark item ${id} as in progress:`, error);
    throw error;
  }
};

export const markCompleted = async (
  tenantId: string, 
  id: string,
  serverResponse?: any
): Promise<void> => {
  if (!tenantId || !id) {
    throw new Error("tenantId and id are required");
  }

  try {
    const db = await getDB(tenantId);
    const item = await db.get(STORE, id);
    if (!item) {
      throw new Error(`Sync item ${id} not found`);
    }

    item.status = "completed";
    if (serverResponse) {
      item.metadata.serverResponse = serverResponse;
    }
    
    await db.put(STORE, item);
    console.log(`Sync completed: ${item.action} ${item.storeName}/${item.entityId}`);
  } catch (error) {
    console.error(`Failed to mark item ${id} as completed:`, error);
    throw error;
  }
};

export const markFailed = async (
  tenantId: string,
  id: string,
  error: string,
  shouldRetry: boolean = true
): Promise<void> => {
  if (!tenantId || !id) {
    throw new Error("tenantId and id are required");
  }

  try {
    const db = await getDB(tenantId);
    const item = await db.get(STORE, id);
    if (!item) {
      throw new Error(`Sync item ${id} not found`);
    }

    item.status = "failed";
    item.metadata.errorMessage = error;

    if (shouldRetry && item.metadata.attemptCount < (item.metadata.maxAttempts || DEFAULT_MAX_ATTEMPTS)) {
      // Calculate retry delay based on priority
      const priority = item.metadata.priority || 'normal';
      const retryDelay = RETRY_DELAY_MS[priority];
      item.metadata.retryAfter = new Date(Date.now() + retryDelay).toISOString();
    }
    
    await db.put(STORE, item);
    console.error(`Sync failed: ${item.action} ${item.storeName}/${item.entityId} - ${error}`);
  } catch (dbError) {
    console.error(`Failed to mark item ${id} as failed:`, dbError);
    throw dbError;
  }
};

export const markConflict = async (
  tenantId: string,
  id: string,
  conflictDetails: {
    conflictType?: string;
    serverVersion?: any;
    clientVersion?: any;
    resolution?: 'manual' | 'server_wins' | 'client_wins' | 'merge';
    [key: string]: any;
  }
): Promise<void> => {
  if (!tenantId || !id) {
    throw new Error("tenantId and id are required");
  }

  try {
    const db = await getDB(tenantId);
    const item = await db.get(STORE, id);
    if (!item) {
      throw new Error(`Sync item ${id} not found`);
    }

    item.status = "conflict";
    item.metadata.conflictDetails = conflictDetails;
    
    await db.put(STORE, item);
    console.warn(`Sync conflict detected: ${item.action} ${item.storeName}/${item.entityId}`);
  } catch (error) {
    console.error(`Failed to mark item ${id} as conflict:`, error);
    throw error;
  }
};

export const clearQueue = async (
  tenantId: string,
  options: {
    status?: SyncStatus[];
    olderThan?: string; // ISO timestamp
    storeName?: string;
  } = {}
): Promise<number> => {
  if (!tenantId) {
    throw new Error("tenantId is required");
  }

  try {
    const db = await getDB(tenantId);
    const all = await db.getAll(STORE);
    
    const itemsToDelete = all.filter((item: SyncItem) => {
      if (options.status && !options.status.includes(item.status)) return false;
      if (options.olderThan && item.enqueuedAt >= options.olderThan) return false;
      if (options.storeName && item.storeName !== options.storeName) return false;
      return true;
    });

    // Delete matching items
    const tx = db.transaction(STORE, 'readwrite');
    for (const item of itemsToDelete) {
      await tx.store.delete(item.id);
    }
    await tx.done;

    console.log(`Cleared ${itemsToDelete.length} sync queue items`);
    return itemsToDelete.length;
  } catch (error) {
    console.error("Failed to clear queue:", error);
    throw error;
  }
};

export const retryFailedItems = async (
  tenantId: string,
  options: {
    maxRetries?: number;
    storeName?: string;
    entityId?: string;
  } = {}
): Promise<number> => {
  if (!tenantId) {
    throw new Error("tenantId is required");
  }

  try {
    const db = await getDB(tenantId);
    const all = await db.getAll(STORE);
    
    const itemsToRetry = all.filter((item: SyncItem) => {
      if (item.status !== 'failed') return false;
      if (options.storeName && item.storeName !== options.storeName) return false;
      if (options.entityId && item.entityId !== options.entityId) return false;
      
      // Check if item has retries left
      const maxRetries = options.maxRetries || item.metadata.maxAttempts || DEFAULT_MAX_ATTEMPTS;
      return item.metadata.attemptCount < maxRetries;
    });

    // Reset items to pending
    const tx = db.transaction(STORE, 'readwrite');
    for (const item of itemsToRetry) {
      item.status = "pending";
      item.metadata.errorMessage = undefined;
      item.metadata.retryAfter = undefined;
      await tx.store.put(item);
    }
    await tx.done;

    console.log(`Retrying ${itemsToRetry.length} failed sync items`);
    return itemsToRetry.length;
  } catch (error) {
    console.error("Failed to retry failed items:", error);
    throw error;
  }
};