import React, { createContext, useContext, useState, useEffect } from "react";
import { getAll, setItem, delItem, clearStore, seedAll } from "../utils/db.js";

const CostsContext = createContext();

export function CostsProvider({ children }) {
  const [costs, setCosts] = useState([]);

  async function load() {
    const items = await getAll("costs");
    if (!items.length) {
      await seedAll({ costs: [] });
    }
    setCosts(items);
  }

  async function addCost(cost) {
    await setItem("costs", cost);
    load();
  }

  async function removeCost(id) {
    await delItem("costs", id);
    load();
  }

  async function clearAll() {
    await clearStore("costs");
    load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <CostsContext.Provider value={{ costs, addCost, removeCost, clearAll }}>
      {children}
    </CostsContext.Provider>
  );
}

export function useCosts() {
  return useContext(CostsContext);
}