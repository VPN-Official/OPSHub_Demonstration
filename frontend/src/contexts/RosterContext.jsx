import React, { createContext, useContext, useState, useEffect } from "react";
import { getAll, setItem, delItem, clearStore, seedAll } from "../utils/db.js";

const RosterContext = createContext();

export function RosterProvider({ children }) {
  const [roster, setRoster] = useState([]);

  async function load() {
    const items = await getAll("roster");
    if (!items.length) {
      await seedAll({ roster: [] });
    }
    setRoster(items);
  }

  async function addMember(member) {
    await setItem("roster", member);
    load();
  }

  async function removeMember(id) {
    await delItem("roster", id);
    load();
  }

  async function clearAll() {
    await clearStore("roster");
    load();
  }

  async function updateShift(updatedShift) {
  await setItem("roster", updatedShift);
  load();
}

async function deleteShift(id) {
  await delItem("roster", id);
  load();
}

  useEffect(() => {
    load();
  }, []);

  return (
    <RosterContext.Provider value={{ roster, addMember, removeMember, clearAll }}>
      {children}
    </RosterContext.Provider>
  );
}

export function useRoster() {
  return useContext(RosterContext);
}