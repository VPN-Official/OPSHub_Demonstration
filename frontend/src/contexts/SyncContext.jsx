import React, { createContext, useContext, useState, useEffect } from "react";
import { getAll, setItem, delItem, clearStore, seedAll } from "../utils/db.js";

const SyncContext = createContext();

export function SyncProvider({ children }) {
  const [syncQueue, setSyncQueue] = useState([]);
  const [online, setOnline] = useState(navigator.onLine); // CRITICAL FIX: Add online state

  // Load queue from IndexedDB
  async function load() {
    const items = await getAll("syncQueue");
    if (!items.length) {
      await seedAll({ syncQueue: [] });
    }
    setSyncQueue(items);
  }

  // Add item to sync queue
  async function enqueue(item) {
    const queueItem = {
      id: Date.now(),
      ...item,
      timestamp: Date.now()
    };
    await setItem("syncQueue", queueItem);
    load();
  }

  // CRITICAL FIX: Add queueChange method that WorkItemDetail expects
  async function queueChange(action, workItem) {
    const changeItem = {
      id: Date.now(),
      action,
      workItem,
      timestamp: Date.now()
    };
    await setItem("syncQueue", changeItem);
    load();
  }

  // Remove item from sync queue
  async function dequeue(id) {
    await delItem("syncQueue", id);
    load();
  }

  // Clear queue
  async function clearAll() {
    await clearStore("syncQueue");
    load();
  }

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Load queue on mount
  useEffect(() => {
    load();
  }, []);

  // Attempt to sync when online
  useEffect(() => {
    async function handleOnline() {
      if (syncQueue.length > 0) {
        try {
          console.log("Syncing items:", syncQueue);
          
          // TODO: Replace with actual sync logic
          // For now, just clear queue after "sync"
          setTimeout(async () => {
            await clearStore("syncQueue");
            setSyncQueue([]);
            console.log("Sync completed (placeholder)");
          }, 1000);
        } catch (err) {
          console.error("Sync failed:", err);
        }
      }
    }

    if (online) {
      handleOnline();
    }
  }, [online, syncQueue.length]);

  return (
    <SyncContext.Provider value={{ 
      syncQueue, 
      enqueue, 
      dequeue, 
      clearAll,
      queueChange, // CRITICAL FIX: Add missing method
      online       // CRITICAL FIX: Add missing property
    }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  return useContext(SyncContext);
}