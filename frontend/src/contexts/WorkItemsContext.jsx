import React, { createContext, useContext, useState, useEffect } from "react";
import { getAll, setItem, delItem, clearStore, seedAll } from "../utils/db.js";

const WorkItemsContext = createContext();

export function WorkItemsProvider({ children }) {
  const [workItems, setWorkItems] = useState([]);

  async function load() {
    const items = await getAll("workItems");
    if (!items.length) {
      await seedAll({ workItems: [] });
    }
    setWorkItems(items);
  }

  async function addWorkItem(item) {
    await setItem("workItems", item);
    load();
  }

  async function removeWorkItem(id) {
    await delItem("workItems", id);
    load();
  }

  // CRITICAL FIX: Add updateWorkItem method that WorkItemDetail expects
  async function updateWorkItem(id, updates) {
    const existing = workItems.find(w => w.id === id);
    if (existing) {
      const updated = { ...existing, ...updates };
      await setItem("workItems", updated);
      load();
    }
  }

  async function clearAll() {
    await clearStore("workItems");
    load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <WorkItemsContext.Provider
      value={{ 
        workItems, 
        addWorkItem, 
        removeWorkItem, 
        updateWorkItem, // Add missing method
        clearAll 
      }}
    >
      {children}
    </WorkItemsContext.Provider>
  );
}

export function useWorkItems() {
  return useContext(WorkItemsContext);
}