// src/db/syncQueue.ts
import { getDB } from "./dbClient";
import { AIOpsDB } from "./seedIndexedDB";

// Import the enhanced types
export type SyncAction = "create" | "update" | "delete" | "bulk_create" | "bulk_update" | "bulk_delete";

export type SyncStatus =
  | "pending"       // waiting in queue
  | "in_progress"   // actively syncing
  | "completed"     // synced successfully (renamed from success for consistency)
  | "failed"        // permanently failed (after retries)
  | "conflict"      // conflict detected
  | "cancelled";    // cancelled by user/system

export interface SyncMetadata {
  attemptCount: number;          // number of retries
  maxAttempts?: number;          // max retry attempts (default: 3)
  lastAttemptAt?: string;        // ISO timestamp
  errorMessage?: string;         // last error encountered
  conflictDetails?: any;         // extra info if conflict
  priority?: 'low' | 'normal' | 'high' | 'critical';  // sync priority
  retryAfter?: string;           // ISO timestamp for next retry
  userId?: string;               // user who initiated the change
  correlationId?: string;        // for tracking related operations
}

export interface SyncItem<T = any> {
  id: string;                    // unique id for queue item
  tenantId: string;              // tenant scope
  storeName: string;             // store name (matches AIOpsDB keys)
  entityId: string;              // actual business entity id
  action: SyncAction;            // what operation to perform
  payload: T | null;             // full object (for create/update) or null (for delete)
  status: SyncStatus;            // current sync state
  enqueuedAt: string;            // ISO timestamp when enqueued
  metadata: SyncMetadata;        // retry + error details
  timestamp: string;             // ISO timestamp of the original operation
}

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
    priority?: 'low' | 'normal' | 'high' | 'critical';
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
    priority?: 'low' | 'normal' | 'high' | 'critical';
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
    console.log(`Marked sync item as completed: ${item.action} ${item.storeName}/${item.entityId}`);
  } catch (error) {
    console.error(`Failed to mark item ${id} as completed:`, error);
    throw error;
  }
};

export const markFailed = async (
  tenantId: string,
  id: string,
  error: string,
  isRetryable = true
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

    const maxAttempts = item.metadata.maxAttempts || DEFAULT_MAX_ATTEMPTS;
    const shouldRetry = isRetryable && item.metadata.attemptCount < maxAttempts;

    item.status = shouldRetry ? "pending" : "failed";
    item.metadata.errorMessage = error;
    
    if (shouldRetry) {
      // Calculate next retry time based on priority and attempt count
      const baseDelay = RETRY_DELAY_MS[item.metadata.priority || 'normal'];
      const backoffMultiplier = Math.pow(2, item.metadata.attemptCount - 1); // Exponential backoff
      const retryDelay = Math.min(baseDelay * backoffMultiplier, 30 * 60 * 1000); // Max 30 minutes
      
      item.metadata.retryAfter = new Date(Date.now() + retryDelay).toISOString();
    }
    
    await db.put(STORE, item);
    
    if (shouldRetry) {
      console.log(`Sync item marked for retry (attempt ${item.metadata.attemptCount}/${maxAttempts}): ${item.action} ${item.storeName}/${item.entityId}`);
    } else {
      console.error(`Sync item permanently failed: ${item.action} ${item.storeName}/${item.entityId} - ${error}`);
    }
  } catch (dbError) {
    console.error(`Failed to mark item ${id} as failed:`, dbError);
    throw dbError;
  }
};

export const markConflict = async (
  tenantId: string,
  id: string,
  conflictDetails: {
    serverVersion?: any;
    clientVersion?: any;
    conflictType?: string;
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

export const markCancelled = async (
  tenantId: string,
  id: string,
  reason?: string
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

    item.status = "cancelled";
    if (reason) {
      item.metadata.cancellationReason = reason;
    }
    
    await db.put(STORE, item);
    console.log(`Sync item cancelled: ${item.action} ${item.storeName}/${item.entityId} - ${reason || 'No reason provided'}`);
  } catch (error) {
    console.error(`Failed to mark item ${id} as cancelled:`, error);
    throw error;
  }
};

// ---------------------------------
// Queue Management
// ---------------------------------
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

export const getAllQueueItems = async (
  tenantId: string,
  options: {
    status?: SyncStatus[];
    storeName?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<SyncItem[]> => {
  if (!tenantId) {
    throw new Error("tenantId is required");
  }

  try {
    const db = await getDB(tenantId);
    const all = await db.getAll(STORE);
    
    let filtered = all.filter((item: SyncItem) => {
      if (options.status && !options.status.includes(item.status)) return false;
      if (options.storeName && item.storeName !== options.storeName) return false;
      return true;
    });

    // Sort by enqueuedAt (newest first)
    filtered.sort((a, b) => b.enqueuedAt.localeCompare(a.enqueuedAt));

    // Apply pagination
    if (options.offset) {
      filtered = filtered.slice(options.offset);
    }
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  } catch (error) {
    console.error("Failed to get all queue items:", error);
    throw error;
  }
};

// ---------------------------------
// Queue Statistics
// ---------------------------------
export const getQueueStats = async (tenantId: string) => {
  if (!tenantId) {
    throw new Error("tenantId is required");
  }

  try {
    const db = await getDB(tenantId);
    const all = await db.getAll(STORE);
    
    const stats = {
      total: all.length,
      pending: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
      conflict: 0,
      cancelled: 0,
      byStore: {} as Record<string, number>,
      oldestPending: null as string | null,
      averageAttempts: 0,
    };

    let totalAttempts = 0;
    let oldestPendingTime = null;

    all.forEach((item: SyncItem) => {
      stats[item.status]++;
      
      // Count by store
      stats.byStore[item.storeName] = (stats.byStore[item.storeName] || 0) + 1;
      
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

    return stats;
  } catch (error) {
    console.error("Failed to get queue stats:", error);
    throw error;
  }
};

// ---------------------------------
// Retry Management
// ---------------------------------
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
    
    const failedItems = all.filter((item: SyncItem) => {
      if (item.status !== 'failed') return false;
      if (options.storeName && item.storeName !== options.storeName) return false;
      if (options.entityId && item.entityId !== options.entityId) return false;
      
      const maxRetries = options.maxRetries || item.metadata.maxAttempts || DEFAULT_MAX_ATTEMPTS;
      return item.metadata.attemptCount < maxRetries;
    });

    // Reset failed items to pending
    for (const item of failedItems) {
      item.status = 'pending';
      item.metadata.retryAfter = undefined;
      await db.put(STORE, item);
    }

    console.log(`Reset ${failedItems.length} failed items for retry`);
    return failedItems.length;
  } catch (error) {
    console.error("Failed to retry failed items:", error);
    throw error;
  }
};

// Legacy compatibility (renamed from markSuccess)
export const markSuccess = markCompleted;