import React, { createContext, useContext, useState, useEffect } from "react";
import { getAll, setItem, delItem, clearStore, isSeeded } from "../utils/db.js";

const WorkItemsContext = createContext();

export function WorkItemsProvider({ children }) {
  const [workItems, setWorkItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  async function load() {
    try {
      setIsLoading(true);
      const items = await getAll("workItems");
      
      // Only attempt seeding if database is not already seeded
      // and no items exist (prevents duplicate seeding)
      if (!items.length) {
        const alreadySeeded = await isSeeded();
        if (!alreadySeeded) {
          console.log("🔍 WorkItems store empty, but global seeding will handle this");
          // Don't seed here - let the main seeding process handle it
        }
      }
      
      setWorkItems(items);
    } catch (error) {
      console.error("Failed to load work items:", error);
      setWorkItems([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function addWorkItem(item) {
    try {
      await setItem("workItems", item);
      await load(); // Reload to get updated list
    } catch (error) {
      console.error("Failed to add work item:", error);
    }
  }

  async function removeWorkItem(id) {
    try {
      await delItem("workItems", id);
      await load(); // Reload to get updated list
    } catch (error) {
      console.error("Failed to remove work item:", error);
    }
  }

  // Enhanced updateWorkItem with optimistic updates
  async function updateWorkItem(id, updates) {
    try {
      const existing = workItems.find(w => w.id === id);
      if (existing) {
        const updated = { ...existing, ...updates };
        await setItem("workItems", updated);
        
        // Optimistic update for better UX
        setWorkItems(prev => prev.map(item => 
          item.id === id ? updated : item
        ));
      } else {
        console.warn(`Work item ${id} not found for update`);
      }
    } catch (error) {
      console.error("Failed to update work item:", error);
      // Reload on error to sync state
      await load();
    }
  }

  async function clearAll() {
    try {
      await clearStore("workItems");
      await load(); // Reload to get updated list
    } catch (error) {
      console.error("Failed to clear work items:", error);
    }
  }

  // Enhanced loading with retry logic
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
          console.error(`Load attempt ${i + 1} failed:`, error);
          if (i === retries - 1) {
            console.error("All load attempts failed");
          } else {
            // Wait before retry
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

  const contextValue = {
    workItems,
    isLoading,
    addWorkItem,
    removeWorkItem,
    updateWorkItem,
    clearAll,
    reload: load // Expose reload function for manual refresh
  };

  return (
    <WorkItemsContext.Provider value={contextValue}>
      {children}
    </WorkItemsContext.Provider>
  );
}

export function useWorkItems() {
  const context = useContext(WorkItemsContext);
  if (!context) {
    throw new Error('useWorkItems must be used within a WorkItemsProvider');
  }
  return context;
}