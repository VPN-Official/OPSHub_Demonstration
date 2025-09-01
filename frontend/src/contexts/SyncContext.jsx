import React, { createContext, useContext, useState, useEffect } from "react";
import { getAll, setItem, clearStore, isSeeded } from "../utils/db.js";
import { useAuth } from "./AuthContext.jsx";

const SyncContext = createContext();

// Sync operation types
export const SYNC_OPERATIONS = {
  CREATE: "create",
  UPDATE: "update", 
  DELETE: "delete",
  BULK_UPDATE: "bulk_update",
  TRIGGER_AUTOMATION: "trigger_automation",
  REASSIGN: "reassign",
  STATUS_UPDATE: "status_update",
  IMPLEMENT_NUDGE: "implement_nudge"
};

// Sync statuses
export const SYNC_STATUS = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  FAILED: "failed",
  RETRYING: "retrying"
};

export function SyncProvider({ children }) {
  const [online, setOnline] = useState(navigator.onLine);
  const [syncQueue, setSyncQueue] = useState([]);
  const [failedOperations, setFailedOperations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const { user } = useAuth();

  // Load sync queue and failed operations
  async function load() {
    try {
      setIsLoading(true);
      
      const [queueItems, failedItems] = await Promise.all([
        getAll("syncQueue"),
        getAll("failedSync")
      ]);
      
      if (!queueItems.length && !failedItems.length) {
        const alreadySeeded = await isSeeded();
        if (!alreadySeeded) {
          console.log("🔍 Sync stores empty, but global seeding will handle this");
        }
      }
      
      setSyncQueue(queueItems || []);
      setFailedOperations(failedItems || []);
      
    } catch (error) {
      console.error("Failed to load sync data:", error);
      setSyncQueue([]);
      setFailedOperations([]);
    } finally {
      setIsLoading(false);
    }
  }

  // Queue a change for synchronization
  async function queueChange(operation, data, options = {}) {
    try {
      const changeRecord = {
        id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        operation,
        data,
        timestamp: Date.now(),
        user_id: user?.id || "system",
        status: SYNC_STATUS.PENDING,
        attempts: 0,
        max_attempts: options.maxAttempts || 3,
        priority: options.priority || "normal", // low, normal, high, critical
        created_at: Date.now(),
        metadata: {
          user_agent: navigator.userAgent,
          connection_type: navigator.connection?.effectiveType || "unknown",
          ...options.metadata
        }
      };

      await setItem("syncQueue", changeRecord);
      setSyncQueue(prev => [...prev, changeRecord]);

      // If online, attempt immediate sync
      if (online && !syncInProgress) {
        processQueue();
      }

      return changeRecord.id;
    } catch (error) {
      console.error("Failed to queue change:", error);
      throw error;
    }
  }

  // Process the sync queue
  async function processQueue() {
    if (syncInProgress || !online) return;

    try {
      setSyncInProgress(true);
      const pendingItems = syncQueue.filter(item => 
        item.status === SYNC_STATUS.PENDING || 
        item.status === SYNC_STATUS.FAILED
      );

      if (pendingItems.length === 0) {
        setLastSyncTime(Date.now());
        return;
      }

      console.log(`🔄 Processing ${pendingItems.length} sync operations`);

      // Sort by priority and timestamp
      const sortedItems = pendingItems.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
        const priorityDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
        if (priorityDiff !== 0) return priorityDiff;
        return a.timestamp - b.timestamp;
      });

      const results = {
        completed: 0,
        failed: 0,
        errors: []
      };

      for (const item of sortedItems) {
        try {
          await updateSyncItem(item.id, { 
            status: SYNC_STATUS.IN_PROGRESS,
            started_at: Date.now()
          });

          // Simulate API call (in real implementation, this would be actual API calls)
          const success = await simulateApiCall(item);
          
          if (success) {
            await completeSyncItem(item.id);
            results.completed++;
          } else {
            await failSyncItem(item.id, "API call failed");
            results.failed++;
          }
          
        } catch (error) {
          console.error(`Sync operation ${item.id} failed:`, error);
          await failSyncItem(item.id, error.message);
          results.failed++;
          results.errors.push({ id: item.id, error: error.message });
        }
      }

      console.log(`✅ Sync completed: ${results.completed} success, ${results.failed} failed`);
      setLastSyncTime(Date.now());

      // Schedule retry for failed items
      if (results.failed > 0) {
        scheduleRetry();
      }

    } catch (error) {
      console.error("Queue processing failed:", error);
    } finally {
      setSyncInProgress(false);
    }
  }

  // Simulate API call (replace with real API implementation)
  async function simulateApiCall(item) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    
    // Simulate success rate (95% success)
    const success = Math.random() > 0.05;
    
    // Log the operation for debugging
    console.log(`🔄 Sync ${item.operation}:`, {
      id: item.id,
      operation: item.operation,
      success,
      data: item.data
    });
    
    return success;
  }

  // Update sync item status
  async function updateSyncItem(id, updates) {
    try {
      const existing = syncQueue.find(item => item.id === id);
      if (existing) {
        const updated = {
          ...existing,
          ...updates,
          last_modified: Date.now()
        };
        
        await setItem("syncQueue", updated);
        setSyncQueue(prev => prev.map(item => 
          item.id === id ? updated : item
        ));
      }
    } catch (error) {
      console.error("Failed to update sync item:", error);
    }
  }

  // Mark sync item as completed
  async function completeSyncItem(id) {
    try {
      await updateSyncItem(id, {
        status: SYNC_STATUS.COMPLETED,
        completed_at: Date.now()
      });
    } catch (error) {
      console.error("Failed to complete sync item:", error);
    }
  }

  // Mark sync item as failed
  async function failSyncItem(id, error) {
    try {
      const existing = syncQueue.find(item => item.id === id);
      if (existing) {
        const attempts = (existing.attempts || 0) + 1;
        const maxAttempts = existing.max_attempts || 3;
        
        if (attempts >= maxAttempts) {
          // Move to failed operations
          const failedItem = {
            ...existing,
            status: SYNC_STATUS.FAILED,
            attempts,
            failed_at: Date.now(),
            error_message: error,
            final_failure: true
          };
          
          await setItem("failedSync", failedItem);
          setFailedOperations(prev => [...prev, failedItem]);
          
          // Remove from sync queue
          await clearSyncItem(id);
        } else {
          // Update with retry status
          await updateSyncItem(id, {
            status: SYNC_STATUS.FAILED,
            attempts,
            error_message: error,
            failed_at: Date.now(),
            next_retry: Date.now() + (Math.pow(2, attempts) * 60000) // Exponential backoff
          });
        }
      }
    } catch (error) {
      console.error("Failed to handle sync failure:", error);
    }
  }

  // Remove sync item from queue
  async function clearSyncItem(id) {
    try {
      const db = (await import("../utils/db.js")).db;
      await db.syncQueue.delete(id);
      setSyncQueue(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error("Failed to clear sync item:", error);
    }
  }

  // Schedule retry for failed items
  function scheduleRetry() {
    setTimeout(() => {
      if (online) {
        const now = Date.now();
        const retryableItems = syncQueue.filter(item => 
          item.status === SYNC_STATUS.FAILED && 
          item.next_retry && 
          now >= item.next_retry
        );

        if (retryableItems.length > 0) {
          console.log(`🔄 Retrying ${retryableItems.length} failed operations`);
          processQueue();
        }
      }
    }, 60000); // Check every minute
  }

  // Retry failed operation
  async function retryFailedOperation(id) {
    try {
      const failedItem = failedOperations.find(item => item.id === id);
      if (failedItem) {
        // Reset and move back to sync queue
        const retryItem = {
          ...failedItem,
          status: SYNC_STATUS.PENDING,
          attempts: 0,
          error_message: null,
          failed_at: null,
          final_failure: false,
          retry_requested_at: Date.now(),
          retry_requested_by: user?.id || "system"
        };

        await setItem("syncQueue", retryItem);
        setSyncQueue(prev => [...prev, retryItem]);

        // Remove from failed operations
        const db = (await import("../utils/db.js")).db;
        await db.failedSync.delete(id);
        setFailedOperations(prev => prev.filter(item => item.id !== id));

        // Process immediately if online
        if (online) {
          processQueue();
        }
      }
    } catch (error) {
      console.error("Failed to retry operation:", error);
      throw error;
    }
  }

  // Clear all failed operations
  async function clearFailedOperations() {
    try {
      await clearStore("failedSync");
      setFailedOperations([]);
    } catch (error) {
      console.error("Failed to clear failed operations:", error);
      throw error;
    }
  }

  // Force sync all pending operations
  async function forceSyncAll() {
    if (online) {
      await processQueue();
    }
  }

  // Get sync statistics
  const syncStats = {
    pending: syncQueue.filter(item => item.status === SYNC_STATUS.PENDING).length,
    inProgress: syncQueue.filter(item => item.status === SYNC_STATUS.IN_PROGRESS).length,
    completed: syncQueue.filter(item => item.status === SYNC_STATUS.COMPLETED).length,
    failed: syncQueue.filter(item => item.status === SYNC_STATUS.FAILED).length,
    totalPending: syncQueue.filter(item => 
      item.status === SYNC_STATUS.PENDING || 
      item.status === SYNC_STATUS.FAILED
    ).length,
    permanentlyFailed: failedOperations.length
  };

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      console.log("🌐 Connection restored");
      // Process queue when coming back online
      setTimeout(() => processQueue(), 1000);
    };

    const handleOffline = () => {
      setOnline(false);
      console.log("📱 Connection lost - operations will be queued");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load initial data
  useEffect(() => {
    let isMounted = true;
    
    const loadWithRetry = async (retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          if (isMounted) {
            await load();
            break;
          }
        } catch (error) {
          console.error(`Sync load attempt ${i + 1} failed:`, error);
          if (i === retries - 1) {
            console.error("All sync load attempts failed");
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    };

    loadWithRetry();

    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-process queue periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (online && !syncInProgress && syncStats.totalPending > 0) {
        processQueue();
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [online, syncInProgress, syncStats.totalPending]);

  const contextValue = {
    online,
    syncQueue,
    failedOperations,
    isLoading,
    lastSyncTime,
    syncInProgress,
    syncStats,
    totalPendingCount: syncStats.totalPending,
    SYNC_OPERATIONS,
    SYNC_STATUS,
    queueChange,
    processQueue,
    retryFailedOperation,
    clearFailedOperations,
    forceSyncAll,
    reload: load
  };

  return (
    <SyncContext.Provider value={contextValue}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}