import React, { createContext, useContext, useState, useEffect } from "react";
import { getAll, setItem, delItem, clearStore, seedAll } from "../utils/db.js";

const BusinessServicesContext = createContext();

export function BusinessServicesProvider({ children }) {
  const [businessServices, setBusinessServices] = useState([]);

  async function load() {
    const items = await getAll("businessServices");
    if (!items.length) {
      await seedAll({ businessServices: [] });
    }
    setBusinessServices(items);
  }

  async function addService(service) {
    await setItem("businessServices", service);
    load();
  }

  async function removeService(id) {
    await delItem("businessServices", id);
    load();
  }

  async function clearAll() {
    await clearStore("businessServices");
    load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <BusinessServicesContext.Provider
      value={{ businessServices, addService, removeService, clearAll }}
    >
      {children}
    </BusinessServicesContext.Provider>
  );
}

export function useBusinessServices() {
  return useContext(BusinessServicesContext);
}