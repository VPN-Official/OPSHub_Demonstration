import React, { createContext, useContext, useState, useEffect } from "react";
import { getAll, setItem, delItem, clearStore, seedAll } from "../utils/db.js";

const AutomationsContext = createContext();

export function AutomationsProvider({ children }) {
  const [automations, setAutomations] = useState([]);

  async function load() {
    const items = await getAll("automations");
    if (!items.length) {
      await seedAll({ automations: [] });
    }
    setAutomations(items);
  }

  async function addAutomation(auto) {
    await setItem("automations", auto);
    load();
  }

  async function removeAutomation(id) {
    await delItem("automations", id);
    load();
  }

  async function clearAll() {
    await clearStore("automations");
    load();
  }

  useEffect(() => {
    load();
  }, []);

  const roleView = automations; // Simple default, add this line

  return (
    <AutomationsContext.Provider
      value={{ automations, addAutomation, removeAutomation, clearAll, roleView }}
    >
      {children}
    </AutomationsContext.Provider>
  );
}

export function useAutomations() {
  return useContext(AutomationsContext);
}