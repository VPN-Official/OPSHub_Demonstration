import React, { createContext, useContext, useState, useEffect } from "react";
import { getAll, setItem, delItem, clearStore, seedAll } from "../utils/db.js";
import { useToast, TOAST_TYPES } from "./ToastContext.jsx";

const SyncContext = createContext();

export function SyncProvider({ children }) {
  const [syncQueue, setSyncQueue] = useState([]);
  const [failedOperations, setFailedOperations] = useState([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState("idle"); // idle, syncing, failed, success
  const [lastSyncAttempt, setLastSyncAttempt] = useState(null);
  const [syncStats, setSyncStats] = useState({
    totalAttempts: 0,
    successCount: 0,
    failureCount: 0,
    lastSuccessful: null
  });

  const { addToast } = useToast();

  // Load queue and failed operations from IndexedDB
  async function load() {
    try {
      const queueItems = await getAll("syncQueue");
      const failedItems = await getAll("failedSync");
      
      if (!queueItems.length && !failedItems.length) {
        await seedAll({ syncQueue: [], failedSync: [] });
      }
      
      setSyncQueue(queueItems);
      setFailedOperations(failedItems);
      
      // Load sync stats from localStorage
      const savedStats = localStorage.getItem("syncStats");
      if (savedStats) {
        setSyncStats(JSON.parse(savedStats));
      }
    } catch (error) {
      console.error("Failed to load sync data:", error);
    }
  }

  // Add item to sync queue
  async function enqueue(item) {
    const queueItem = {
      id: Date.now(),
      ...item,
      timestamp: Date.now(),
      attempts: 0,
      status: "pending"
    };
    
    try {
      await setItem("syncQueue", queueItem);
      setSyncQueue(prev => [...prev, queueItem]);
      
      addToast({ 
        message: `${item.action || "Action"} queued for sync`, 
        type: TOAST_TYPES.INFO 
      });
      
      // Try immediate sync if online
      if (online) {
        attemptSync();
      }
    } catch (error) {
      console.error("Failed to enqueue item:", error);
      addToast({ 
        message: "Failed to queue action - please try again", 
        type: TOAST_TYPES.ERROR 
      });
    }
  }

  // Add work item change to queue (preserves existing API)
  async function queueChange(action, workItem) {
    await enqueue({
      type: "workitem_change",
      action,
      workItem,
      description: `${action} on ${workItem?.title || workItem?.id}`
    });
  }

  // Remove item from sync queue
  async function dequeue(id) {
    try {
      await delItem("syncQueue", id);
      setSyncQueue(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error("Failed to dequeue item:", error);
    }
  }

  // Move item to failed operations
  async function markAsFailed(queueItem, error) {
    const failedItem = {
      ...queueItem,
      id: `failed-${queueItem.id}`,
      originalId: queueItem.id,
      failedAt: Date.now(),
      error: error.message || "Unknown error",
      status: "failed"
    };

    try {
      // Add to failed operations store
      await setItem("failedSync", failedItem);
      setFailedOperations(prev => [...prev, failedItem]);
      
      // Remove from sync queue
      await dequeue(queueItem.id);
      
      // Show toast notification for sync failure instead of adding to notifications
      addToast({
        message: `Sync failed: ${queueItem.description || queueItem.action}. Check sync status for retry options.`,
        type: TOAST_TYPES.ERROR
      });

      // Update stats
      updateSyncStats(false);
      
    } catch (err) {
      console.error("Failed to mark item as failed:", err);
    }
  }

  // Retry failed operation
  async function retryFailedOperation(failedId) {
    const failedItem = failedOperations.find(item => item.id === failedId);
    if (!failedItem) return;

    try {
      // Move back to sync queue
      const retryItem = {
        ...failedItem,
        id: Date.now(), // New ID for queue
        timestamp: Date.now(),
        attempts: (failedItem.attempts || 0) + 1,
        status: "pending"
      };

      await enqueue(retryItem);
      
      // Remove from failed operations
      await delItem("failedSync", failedId);
      setFailedOperations(prev => prev.filter(item => item.id !== failedId));
      
      addToast({ 
        message: "Operation queued for retry", 
        type: TOAST_TYPES.INFO 
      });

    } catch (error) {
      console.error("Failed to retry operation:", error);
      addToast({ 
        message: "Failed to retry operation", 
        type: TOAST_TYPES.ERROR 
      });
    }
  }

  // Clear all failed operations
  async function clearFailedOperations() {
    try {
      await clearStore("failedSync");
      setFailedOperations([]);
      addToast({ 
        message: "Failed operations cleared", 
        type: TOAST_TYPES.SUCCESS 
      });
    } catch (error) {
      console.error("Failed to clear failed operations:", error);
    }
  }

  // Update sync statistics
  function updateSyncStats(success) {
    setSyncStats(prev => {
      const newStats = {
        totalAttempts: prev.totalAttempts + 1,
        successCount: success ? prev.successCount + 1 : prev.successCount,
        failureCount: success ? prev.failureCount : prev.failureCount + 1,
        lastSuccessful: success ? Date.now() : prev.lastSuccessful
      };
      
      // Persist to localStorage
      localStorage.setItem("syncStats", JSON.stringify(newStats));
      return newStats;
    });
  }

  // Main sync attempt function
  async function attemptSync() {
    if (syncQueue.length === 0 || syncStatus === "syncing") return;

    setSyncStatus("syncing");
    setLastSyncAttempt(Date.now());
    
    const MAX_RETRY_ATTEMPTS = 3;
    let successCount = 0;
    let failureCount = 0;

    addToast({ 
      message: `Syncing ${syncQueue.length} operations...`, 
      type: TOAST_TYPES.INFO 
    });

    // Process each item in the queue
    for (const item of syncQueue) {
      try {
        // Simulate sync operation (replace with actual API calls)
        await simulateSync(item);
        
        // Success - remove from queue
        await dequeue(item.id);
        successCount++;
        
      } catch (error) {
        console.error(`Sync failed for item ${item.id}:`, error);
        
        // Check if we should retry or mark as failed
        const attempts = (item.attempts || 0) + 1;
        if (attempts >= MAX_RETRY_ATTEMPTS) {
          await markAsFailed(item, error);
          failureCount++;
        } else {
          // Update attempt count and retry later
          const updatedItem = { ...item, attempts };
          await setItem("syncQueue", updatedItem);
          setSyncQueue(prev => 
            prev.map(qi => qi.id === item.id ? updatedItem : qi)
          );
        }
      }
    }

    // Update status and show results
    if (failureCount === 0 && successCount > 0) {
      setSyncStatus("success");
      updateSyncStats(true);
      addToast({ 
        message: `Successfully synced ${successCount} operations`, 
        type: TOAST_TYPES.SUCCESS 
      });
    } else if (failureCount > 0) {
      setSyncStatus("failed");
      updateSyncStats(false);
      addToast({ 
        message: `Sync completed: ${successCount} success, ${failureCount} failed`, 
        type: TOAST_TYPES.WARNING 
      });
    } else {
      setSyncStatus("idle");
    }

    // Reset status after delay
    setTimeout(() => setSyncStatus("idle"), 3000);
  }

  // Simulate sync operation (replace with actual API calls)
  async function simulateSync(item) {
    // Simulate network request
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    
    // Simulate occasional failures for demonstration
    if (Math.random() < 0.1) { // 10% failure rate
      throw new Error(`Network error: ${item.type} sync failed`);
    }
    
    console.log("Synced item:", item);
  }

  // Clear all queues
  async function clearAll() {
    try {
      await clearStore("syncQueue");
      await clearStore("failedSync");
      setSyncQueue([]);
      setFailedOperations([]);
    } catch (error) {
      console.error("Failed to clear sync data:", error);
    }
  }

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      addToast({ 
        message: "Connection restored - syncing pending operations", 
        type: TOAST_TYPES.SUCCESS 
      });
    };
    
    const handleOffline = () => {
      setOnline(false);
      addToast({ 
        message: "Connection lost - operations will be queued", 
        type: TOAST_TYPES.WARNING 
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [addToast]);

  // Load data on mount
  useEffect(() => {
    load();
  }, []);

  // Auto-sync when online
  useEffect(() => {
    if (online && syncQueue.length > 0 && syncStatus === "idle") {
      // Delay sync to avoid rapid retries
      const timer = setTimeout(attemptSync, 2000);
      return () => clearTimeout(timer);
    }
  }, [online, syncQueue.length, syncStatus]);

  // Periodic sync attempt every 5 minutes if online
  useEffect(() => {
    if (!online) return;

    const interval = setInterval(() => {
      if (syncQueue.length > 0 && syncStatus === "idle") {
        attemptSync();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [online, syncStatus]);

  const contextValue = {
    // Queue operations
    syncQueue,
    enqueue,
    dequeue,
    queueChange, // Preserves existing API
    clearAll,
    
    // Failed operations management
    failedOperations,
    retryFailedOperation,
    clearFailedOperations,
    
    // Status and statistics
    online,
    syncStatus,
    lastSyncAttempt,
    syncStats,
    
    // Manual sync control
    attemptSync,
    
    // Computed values
    hasPendingOperations: syncQueue.length > 0,
    hasFailedOperations: failedOperations.length > 0,
    totalPendingCount: syncQueue.length + failedOperations.length
  };

  return (
    <SyncContext.Provider value={contextValue}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  return useContext(SyncContext);
}