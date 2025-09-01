import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { getAll, setItem, delItem, clearStore, seedAll } from "../utils/db.js";
import { useAuth } from "./AuthContext.jsx";

const AgentsContext = createContext();

export function AgentsProvider({ children }) {
  const [agents, setAgents] = useState([]);
  const { user } = useAuth();

  async function load() {
    const items = await getAll("agents");
    if (!items.length) {
      const seedData = await fetch('/config/seedData.json').then(r => r.json());
      await seedAll(seedData);
      return;
    }
    setAgents(items);
  }

  async function addAgent(agent) {
    await setItem("agents", agent);
    load();
  }

  async function removeAgent(id) {
    await delItem("agents", id);
    load();
  }

  async function clearAll() {
    await clearStore("agents");
    load();
  }

  // Role-based view filtering
  const roleView = useMemo(() => {
    if (!user) return agents;
    
    switch (user.role) {
      case "agentDesigner":
        return agents; // See all agents
      case "Manager":
        return agents.filter(agent => agent.teamId === user.teamId || !agent.teamId);
      case "Support Engineer":
        return agents.filter(agent => agent.public !== false); // Only public agents
      default:
        return agents;
    }
  }, [agents, user]);

  useEffect(() => {
    load();
  }, []);

  return (
    <AgentsContext.Provider value={{ 
      agents, 
      addAgent, 
      removeAgent, 
      clearAll, 
      roleView 
    }}>
      {children}
    </AgentsContext.Provider>
  );
}

export function useAgents() {
  return useContext(AgentsContext);
}