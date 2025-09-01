import React, { createContext, useContext, useState, useEffect } from "react";
import { getAll, setItem, delItem, clearStore, seedAll } from "../utils/db.js";

const NudgesContext = createContext();

export function NudgesProvider({ children }) {
  const [nudges, setNudges] = useState([]);

  async function load() {
    const items = await getAll("nudges");
    if (!items.length) {
      await seedAll({ nudges: [] });
    }
    setNudges(items);
  }

  async function addNudge(nudge) {
    await setItem("nudges", nudge);
    load();
  }

  async function removeNudge(id) {
    await delItem("nudges", id);
    load();
  }

  async function acknowledgeNudge(id) {
    const updated = nudges.map((n) =>
      n.id === id ? { ...n, acknowledged: true } : n
    );
    // Update all nudges in DB
    await clearStore("nudges");
    for (const nudge of updated) {
      await setItem("nudges", nudge);
    }
    load();
  }

  async function clearAll() {
    await clearStore("nudges");
    load();
  }

  // Role-based view filtering (referenced in IntelligenceCenter)
  const roleView = nudges;

  useEffect(() => {
    load();
  }, []);

  return (
    <NudgesContext.Provider 
      value={{ 
        nudges, 
        addNudge, 
        removeNudge, 
        acknowledgeNudge, 
        clearAll, 
        roleView 
      }}
    >
      {children}
    </NudgesContext.Provider>
  );
}

export function useNudges() {
  return useContext(NudgesContext);
}