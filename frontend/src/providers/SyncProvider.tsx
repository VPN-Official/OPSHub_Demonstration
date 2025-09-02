// src/providers/SyncProvider.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import { 
  enqueue, 
  getNextBatch, 
  markInProgress, 
  markCompleted, 
  markFailed, 
  markConflict,
  getQueueStats,
  clearQueue,
  retryFailedItems,
  SyncItem,
  SyncStats,
  SyncPriority,
  BatchSyncResult,
  SyncResult 
} from "../db/syncQueue";
import { markSynced } from "../db/dbClient";
import { useTenant } from "./TenantProvider";

interface SyncContextType {
  // State
  stats: SyncStats | null;
  isProcessing: boolean;
  lastSyncAt: string | null;
  error: string | null;
  
  // Core operations
  enqueueItem: <T>(item: {
    storeName: string;
    entityId: string;
    action: 'create' | 'update' | 'delete';
    payload: T | null;
    priority?: SyncPriority;
    correlationId?: string;
  }) => Promise<void>;
  
  // Queue management
  processQueue: (options?: ProcessQueueOptions) => Promise<BatchSyncResult>;
  clearSyncQueue: (options?: ClearQueueOptions) => Promise<number>;
  retryFailed: (options?: RetryOptions) => Promise<number>;
  refreshStats: () => Promise<void>;
  
  // Control
  startAutoSync: () => void;
  stopAutoSync: () => void;
  forceSync: () => Promise<BatchSyncResult>;
}

interface ProcessQueueOptions {
  batchSize?: number;
  priority?: SyncPriority;
  maxRetries?: number;
  timeoutMs?: number;
}

interface ClearQueueOptions {
  status?: ('pending' | 'completed' | 'failed' | 'conflict' | 'cancelled')[];
  olderThan?: string;
  storeName?: string;
}

interface RetryOptions {
  maxRetries?: number;
  storeName?: string;
  entityId?: string;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

// Default configuration
const DEFAULT_CONFIG = {
  batchSize: 10,
  autoSyncInterval: 30000, // 30 seconds
  maxRetries: 3,
  timeout: 10000, // 10 seconds per item
};

// ---------------------------------
// Provider
// ---------------------------------
export const SyncProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  
  // State
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Auto-sync control
  const autoSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);

  // Initialize stats when tenant changes
  useEffect(() => {
    if (tenantId) {
      refreshStats();
    } else {
      setStats(null);
      setLastSyncAt(null);
      setError(null);
    }
  }, [tenantId]);

  // Auto-sync effect
  useEffect(() => {
    if (autoSyncEnabled && tenantId) {
      startAutoSyncInternal();
    } else {
      stopAutoSyncInternal();
    }
    
    return () => stopAutoSyncInternal();
  }, [autoSyncEnabled, tenantId]);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      console.log("🌍 Network reconnected - triggering sync");
      if (tenantId && !isProcessing) {
        processQueue().catch(console.error);
      }
    };
    
    const handleOffline = () => {
      console.log("🔌 Network disconnected - stopping auto-sync");
      stopAutoSyncInternal();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [tenantId, isProcessing]);

  const startAutoSyncInternal = useCallback(() => {
    if (autoSyncIntervalRef.current) {
      clearInterval(autoSyncIntervalRef.current);
    }
    
    autoSyncIntervalRef.current = setInterval(() => {
      if (tenantId && !isProcessing && navigator.onLine) {
        processQueue().catch(console.error);
      }
    }, DEFAULT_CONFIG.autoSyncInterval);
  }, [tenantId, isProcessing]);

  const stopAutoSyncInternal = useCallback(() => {
    if (autoSyncIntervalRef.current) {
      clearInterval(autoSyncIntervalRef.current);
      autoSyncIntervalRef.current = null;
    }
  }, []);

  // Enqueue item for sync
  const enqueueItem = useCallback(async <T,>(item: {
    storeName: string;
    entityId: string;
    action: 'create' | 'update' | 'delete';
    payload: T | null;
    priority?: SyncPriority;
    correlationId?: string;
  }) => {
    if (!tenantId) {
      throw new Error("No tenant selected for sync operation");
    }

    try {
      await enqueue(tenantId, {
        id: crypto.randomUUID(),
        storeName: item.storeName,
        entityId: item.entityId,
        action: item.action,
        payload: item.payload,
        timestamp: new Date().toISOString(),
        priority: item.priority || 'normal',
        correlationId: item.correlationId,
      });
      
      // Refresh stats after enqueuing
      await refreshStats();
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to enqueue sync item';
      console.error('Sync enqueue error:', errorMessage);
      setError(errorMessage);
      throw err;
    }
  }, [tenantId]);

  // Process sync queue
  const processQueue = useCallback(async (options: ProcessQueueOptions = {}): Promise<BatchSyncResult> => {
    if (!tenantId) {
      throw new Error("No tenant selected for sync processing");
    }
    
    if (isProcessing) {
      throw new Error("Sync already in progress");
    }

    const batchId = crypto.randomUUID();
    const startTime = Date.now();
    
    setIsProcessing(true);
    setError(null);
    
    try {
      console.log(`🔄 Starting sync batch: ${batchId}`);
      
      // Get next batch of items to sync
      const batch = await getNextBatch<any>(tenantId, {
        limit: options.batchSize || DEFAULT_CONFIG.batchSize,
        priority: options.priority,
      });

      if (batch.length === 0) {
        console.log("📭 No items to sync");
        return {
          batchId,
          tenantId,
          processedAt: new Date().toISOString(),
          totalItems: 0,
          successful: 0,
          failed: 0,
          conflicts: 0,
          cancelled: 0,
          results: [],
          duration: Date.now() - startTime,
        };
      }

      console.log(`📦 Processing ${batch.length} sync items`);
      
      const results: SyncResult[] = [];
      let successful = 0;
      let failed = 0;
      let conflicts = 0;

      // Process each item in the batch
      for (const item of batch) {
        const itemStartTime = Date.now();
        
        try {
          // Mark as in progress
          await markInProgress(tenantId, item.id);
          
          // Simulate API call (replace with actual sync logic)
          const syncResult = await syncItemToServer(item, options.timeoutMs || DEFAULT_CONFIG.timeout);
          
          if (syncResult.success) {
            // Mark as completed
            await markCompleted(tenantId, item.id, syncResult.serverResponse);
            
            // Update entity sync status
            await markSynced(tenantId, item.storeName as any, item.entityId);
            
            successful++;
          } else if (syncResult.conflict) {
            // Handle conflict
            await markConflict(tenantId, item.id, syncResult.conflictDetails);
            conflicts++;
          } else {
            // Handle failure
            await markFailed(tenantId, item.id, syncResult.error || 'Unknown error');
            failed++;
          }
          
          results.push({
            success: syncResult.success,
            syncItemId: item.id,
            action: item.action,
            storeName: item.storeName,
            entityId: item.entityId,
            serverResponse: syncResult.serverResponse,
            error: syncResult.error,
            conflictDetails: syncResult.conflictDetails,
            duration: Date.now() - itemStartTime,
          });
          
        } catch (itemError) {
          const errorMessage = itemError instanceof Error ? itemError.message : 'Unknown item error';
          console.error(`Failed to sync item ${item.id}:`, errorMessage);
          
          await markFailed(tenantId, item.id, errorMessage);
          failed++;
          
          results.push({
            success: false,
            syncItemId: item.id,
            action: item.action,
            storeName: item.storeName,
            entityId: item.entityId,
            error: errorMessage,
            duration: Date.now() - itemStartTime,
          });
        }
      }

      const batchResult: BatchSyncResult = {
        batchId,
        tenantId,
        processedAt: new Date().toISOString(),
        totalItems: batch.length,
        successful,
        failed,
        conflicts,
        cancelled: 0,
        results,
        duration: Date.now() - startTime,
      };

      console.log(`✅ Sync batch completed: ${successful}/${batch.length} successful`);
      setLastSyncAt(new Date().toISOString());
      
      // Refresh stats
      await refreshStats();
      
      return batchResult;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sync processing failed';
      console.error('Sync batch error:', errorMessage);
      setError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [tenantId, isProcessing]);

  // Clear sync queue
  const clearSyncQueue = useCallback(async (options: ClearQueueOptions = {}): Promise<number> => {
    if (!tenantId) {
      throw new Error("No tenant selected");
    }
    
    try {
      const clearedCount = await clearQueue(tenantId, options);
      await refreshStats();
      console.log(`🗑️ Cleared ${clearedCount} sync queue items`);
      return clearedCount;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear sync queue';
      setError(errorMessage);
      throw err;
    }
  }, [tenantId]);

  // Retry failed items
  const retryFailed = useCallback(async (options: RetryOptions = {}): Promise<number> => {
    if (!tenantId) {
      throw new Error("No tenant selected");
    }
    
    try {
      const retriedCount = await retryFailedItems(tenantId, options);
      await refreshStats();
      console.log(`🔄 Queued ${retriedCount} failed items for retry`);
      return retriedCount;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to retry items';
      setError(errorMessage);
      throw err;
    }
  }, [tenantId]);

  // Refresh queue statistics
  const refreshStats = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      const queueStats = await getQueueStats(tenantId);
      setStats(queueStats);
    } catch (err) {
      console.error('Failed to refresh sync stats:', err);
    }
  }, [tenantId]);

  // Control functions
  const startAutoSync = useCallback(() => {
    setAutoSyncEnabled(true);
  }, []);

  const stopAutoSync = useCallback(() => {
    setAutoSyncEnabled(false);
  }, []);

  const forceSync = useCallback(async (): Promise<BatchSyncResult> => {
    return processQueue();
  }, [processQueue]);

  return (
    <SyncContext.Provider
      value={{
        stats,
        isProcessing,
        lastSyncAt,
        error,
        enqueueItem,
        processQueue,
        clearSyncQueue,
        retryFailed,
        refreshStats,
        startAutoSync,
        stopAutoSync,
        forceSync,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

// ---------------------------------
// Mock server sync function (replace with real implementation)
// ---------------------------------
const syncItemToServer = async (
  item: SyncItem,
  timeoutMs: number
): Promise<{
  success: boolean;
  conflict?: boolean;
  serverResponse?: any;
  error?: string;
  conflictDetails?: any;
}> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  
  // Simulate different outcomes
  const rand = Math.random();
  
  if (rand < 0.05) { // 5% conflict rate
    return {
      success: false,
      conflict: true,
      conflictDetails: {
        conflictType: 'version',
        serverVersion: { ...item.payload, version: 2 },
        clientVersion: item.payload,
        resolution: 'manual',
      }
    };
  } else if (rand < 0.1) { // 5% failure rate
    return {
      success: false,
      error: 'Server validation failed'
    };
  } else { // 90% success rate
    return {
      success: true,
      serverResponse: { 
        ...item.payload, 
        id: item.entityId,
        synced_at: new Date().toISOString(),
        version: (item.payload?.version || 0) + 1
      }
    };
  }
};

// ---------------------------------
// Hook
// ---------------------------------
export const useSync = () => {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error("useSync must be used within SyncProvider");
  }
  return ctx;
};

// Utility hooks
export const useSyncStats = () => {
  const { stats, refreshStats } = useSync();
  return { stats, refreshStats };
};

export const useEnqueueSync = () => {
  const { enqueueItem } = useSync();
  return enqueueItem;
};