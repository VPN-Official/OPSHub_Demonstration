// src/providers/SyncProvider.tsx - FIXED with proper type imports
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
  // ✅ CRITICAL FIX: Import types from the consolidated location
  type SyncItem,
  type SyncStats,
  type SyncPriority,
} from "../db/syncQueue";

// ✅ Import additional types from syncTypes.ts
import type { 
  BatchSyncResult,
  SyncResult 
} from "../sync/syncTypes";

import { markSynced } from "../db/dbClient";
import { generateSecureId } from "../utils/auditUtils";
import { useTenant } from "./TenantProvider";
import { useConfig } from "./ConfigProvider";

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

export const SyncProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId, isInitialized, isLoading: tenantLoading, error: tenantError } = useTenant();
  const { config, isLoading: configLoading, error: configError } = useConfig();
  
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const autoSyncInterval = useRef<NodeJS.Timeout | null>(null);
  const abortController = useRef<AbortController | null>(null);
  
  // ✅ Propagate parent errors
  useEffect(() => {
    if (tenantError) {
      setError(`Tenant error: ${tenantError}`);
      setStats(null);
    } else if (configError) {
      setError(`Config error: ${configError}`);
      setStats(null);
    }
  }, [tenantError, configError]);

  // ✅ Define refreshStats first as it's used by enqueueItem
  const refreshStats = useCallback(async () => {
    if (!tenantId || !isInitialized || tenantLoading || tenantError || configError) return;
    
    try {
      const stats = await getQueueStats(tenantId);
      setStats(stats);
    } catch (err) {
      console.error('Failed to refresh sync stats:', err);
    }
  }, [tenantId, isInitialized, tenantLoading, tenantError, configError]);

  // ✅ CRITICAL FIX: Enhanced enqueueItem implementation
  const enqueueItem = useCallback(async <T,>(item: {
    storeName: string;
    entityId: string;
    action: 'create' | 'update' | 'delete';
    payload: T | null;
    priority?: SyncPriority;
    correlationId?: string;
  }) => {
    if (!tenantId) {
      throw new Error("No tenant selected for sync queue operation");
    }
    
    if (!isInitialized || tenantLoading || tenantError || configError) {
      throw new Error("System not fully initialized or has errors");
    }

    try {
      const timestamp = new Date().toISOString();
      const queueItemId = await generateSecureId();
      
      await enqueue(tenantId, {
        id: queueItemId,              
        storeName: item.storeName,
        entityId: item.entityId,
        action: item.action,
        payload: item.payload,
        timestamp,                    
        tenantId,                     
        status: 'pending',            
        priority: item.priority || 'normal',
        userId: undefined,            
        correlationId: item.correlationId,
      });

      console.log(`Enqueued sync item: ${item.action} ${item.storeName}/${item.entityId}`);
      await refreshStats();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to enqueue sync item';
      setError(errorMessage);
      console.error('SyncProvider enqueue error:', errorMessage);
      throw new Error(`Sync enqueue failed: ${errorMessage}`);
    }
  }, [tenantId, isInitialized, tenantLoading, tenantError, configError, refreshStats]);

  const processQueue = useCallback(async (options: ProcessQueueOptions = {}): Promise<BatchSyncResult> => {
    if (!tenantId || !isInitialized) {
      throw new Error("No tenant available for sync processing");
    }

    if (isProcessing) {
      throw new Error("Sync already in progress");
    }

    setIsProcessing(true);
    setError(null);

    try {
      const startTime = Date.now();
      const batch = await getNextBatch(tenantId, {
        limit: options.batchSize || 10,
        priority: options.priority,
        status: ['pending']
      });

      if (batch.length === 0) {
        return { 
          batchId: await generateSecureId(),
          tenantId,
          processedAt: new Date().toISOString(),
          totalItems: 0,
          successful: 0,
          failed: 0,
          conflicts: 0,
          cancelled: 0,
          results: [],
          duration: Date.now() - startTime
        };
      }

      const results: SyncResult[] = [];
      let successful = 0;
      let failed = 0;
      let conflicts = 0;

      for (const item of batch) {
        const itemStartTime = Date.now();
        try {
          await markInProgress(tenantId, item.id);
          
          // ✅ Simulate sync operation (replace with actual server sync)
          const syncResponse = await simulateServerSync(item);
          
          if (syncResponse.success) {
            await markCompleted(tenantId, item.id, syncResponse.serverResponse);
            await markSynced(tenantId, item.storeName as keyof AIOpsDB, item.entityId);
            
            results.push({ 
              success: true,
              syncItemId: item.id,
              action: item.action,
              storeName: item.storeName,
              entityId: item.entityId,
              serverResponse: syncResponse.serverResponse,
              duration: Date.now() - itemStartTime
            });
            successful++;
          } else if (syncResponse.conflict) {
            await markConflict(tenantId, item.id, syncResponse.conflictDetails || {});
            
            results.push({ 
              success: false,
              syncItemId: item.id,
              action: item.action,
              storeName: item.storeName,
              entityId: item.entityId,
              conflictDetails: syncResponse.conflictDetails,
              duration: Date.now() - itemStartTime
            });
            conflicts++;
          } else {
            await markFailed(tenantId, item.id, syncResponse.error || 'Unknown error');
            
            results.push({ 
              success: false,
              syncItemId: item.id,
              action: item.action,
              storeName: item.storeName,
              entityId: item.entityId,
              error: syncResponse.error,
              duration: Date.now() - itemStartTime
            });
            failed++;
          }
        } catch (err) {
          await markFailed(tenantId, item.id, err instanceof Error ? err.message : 'Processing error');
          
          results.push({ 
            success: false,
            syncItemId: item.id,
            action: item.action,
            storeName: item.storeName,
            entityId: item.entityId,
            error: err instanceof Error ? err.message : 'Processing error',
            duration: Date.now() - itemStartTime
          });
          failed++;
        }
      }

      setLastSyncAt(new Date().toISOString());
      await refreshStats();

      return {
        batchId: await generateSecureId(),
        tenantId,
        processedAt: new Date().toISOString(),
        totalItems: batch.length,
        successful,
        failed,
        conflicts,
        cancelled: 0,
        results,
        duration: Date.now() - startTime
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sync processing failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [tenantId, isInitialized, isProcessing, refreshStats]);

  const clearSyncQueue = useCallback(async (options: ClearQueueOptions = {}): Promise<number> => {
    if (!tenantId || !isInitialized) {
      throw new Error("No tenant available for queue operations");
    }

    try {
      const cleared = await clearQueue(tenantId, options);
      await refreshStats();
      return cleared;
    } catch (err) {
      console.error('Failed to clear sync queue:', err);
      throw err;
    }
  }, [tenantId, isInitialized, refreshStats]);

  const retryFailed = useCallback(async (options: RetryOptions = {}): Promise<number> => {
    if (!tenantId || !isInitialized) {
      throw new Error("No tenant available for retry operations");
    }

    try {
      const retried = await retryFailedItems(tenantId, options);
      await refreshStats();
      return retried;
    } catch (err) {
      console.error('Failed to retry failed items:', err);
      throw err;
    }
  }, [tenantId, isInitialized, refreshStats]);

  const startAutoSync = useCallback(() => {
    if (autoSyncInterval.current) return;
    
    autoSyncInterval.current = setInterval(async () => {
      if (tenantId && isInitialized && !isProcessing) {
        try {
          await processQueue({ batchSize: 5 });
        } catch (err) {
          console.error('Auto-sync error:', err);
        }
      }
    }, 30000);
  }, [tenantId, isInitialized, isProcessing, processQueue]);

  const stopAutoSync = useCallback(() => {
    if (autoSyncInterval.current) {
      clearInterval(autoSyncInterval.current);
      autoSyncInterval.current = null;
    }
  }, []);

  const forceSync = useCallback(async (): Promise<BatchSyncResult> => {
    return await processQueue({ batchSize: 20 });
  }, [processQueue]);

  // Initialize stats when tenant is ready
  useEffect(() => {
    if (tenantId && isInitialized && !tenantLoading) {
      refreshStats();
    } else {
      setStats(null);
      setError(null);
    }
  }, [tenantId, isInitialized, tenantLoading, refreshStats]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAutoSync();
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, [stopAutoSync]);

  const contextValue: SyncContextType = {
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
  };

  return (
    <SyncContext.Provider value={contextValue}>
      {children}
    </SyncContext.Provider>
  );
};

// ✅ Simulate server sync (replace with actual server integration)
const simulateServerSync = async (item: SyncItem): Promise<{
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

export const useSync = () => {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error("useSync must be used within SyncProvider");
  }
  return ctx;
};