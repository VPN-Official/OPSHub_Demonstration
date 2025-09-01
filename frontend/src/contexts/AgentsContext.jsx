import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { getAll, setItem, delItem, clearStore, isSeeded } from "../utils/db.js";
import { useAuth } from "./AuthContext.jsx";

const AgentsContext = createContext();

export function AgentsProvider({ children }) {
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    training: 0,
    interactions: 0
  });
  const { user } = useAuth();

  async function load() {
    try {
      setIsLoading(true);
      const items = await getAll("agents");
      
      if (!items.length) {
        const alreadySeeded = await isSeeded();
        if (!alreadySeeded) {
          console.log("🔍 Agents store empty, but global seeding will handle this");
        }
      }
      
      setAgents(items);
      calculateStats(items);
    } catch (error) {
      console.error("Failed to load agents:", error);
      setAgents([]);
      setStats({ total: 0, active: 0, training: 0, interactions: 0 });
    } finally {
      setIsLoading(false);
    }
  }

  function calculateStats(items) {
    const total = items.length;
    const active = items.filter(item => item.status === "active").length;
    const training = items.filter(item => item.status === "training").length;
    const interactions = items.reduce((sum, item) => sum + (item.interaction_count || 0), 0);

    setStats({
      total,
      active,
      training,
      interactions
    });
  }

  async function addAgent(agent) {
    try {
      const newAgent = {
        ...agent,
        id: agent.id || `agent_${Date.now()}`,
        created_by: user?.id || "system",
        created_at: Date.now(),
        status: agent.status || "draft",
        interaction_count: 0,
        success_rate: 0,
        last_trained: agent.last_trained || Date.now(),
        version: "1.0.0",
        last_modified: Date.now()
      };
      
      await setItem("agents", newAgent);
      await load();
    } catch (error) {
      console.error("Failed to add agent:", error);
      throw error;
    }
  }

  async function updateAgent(id, updates) {
    try {
      const existing = agents.find(item => item.id === id);
      if (existing) {
        const updated = {
          ...existing,
          ...updates,
          last_modified: Date.now(),
          modified_by: user?.id || "system"
        };
        
        // Handle version bumping for significant changes
        if (updates.model_config || updates.training_data || updates.capabilities) {
          const currentVersion = existing.version || "1.0.0";
          const versionParts = currentVersion.split('.').map(Number);
          versionParts[1]++; // Bump minor version
          updated.version = versionParts.join('.');
        }
        
        await setItem("agents", updated);
        
        // Optimistic update
        setAgents(prev => prev.map(item => 
          item.id === id ? updated : item
        ));
        
        // Recalculate stats
        const newAgents = agents.map(item => 
          item.id === id ? updated : item
        );
        calculateStats(newAgents);
      }
    } catch (error) {
      console.error("Failed to update agent:", error);
      await load();
      throw error;
    }
  }

  async function removeAgent(id) {
    try {
      await delItem("agents", id);
      await load();
    } catch (error) {
      console.error("Failed to remove agent:", error);
      throw error;
    }
  }

  async function interactWithAgent(id, input, context = {}) {
    try {
      const agent = agents.find(item => item.id === id);
      if (!agent) {
        throw new Error(`Agent ${id} not found`);
      }

      if (agent.status !== "active") {
        throw new Error(`Agent ${id} is not active (status: ${agent.status})`);
      }

      // Simulate agent interaction and update stats
      const interactionResult = {
        agent_id: id,
        input,
        context,
        timestamp: Date.now(),
        user_id: user?.id || "anonymous",
        response: `Simulated response from ${agent.name}`, // In real implementation, call agent API
        success: true
      };

      // Update interaction statistics
      const updates = {
        interaction_count: (agent.interaction_count || 0) + 1,
        last_interaction: Date.now(),
        last_interaction_by: user?.id || "system"
      };

      await updateAgent(id, updates);

      return interactionResult;
    } catch (error) {
      console.error("Failed to interact with agent:", error);
      throw error;
    }
  }

  async function trainAgent(id, trainingData = {}) {
    try {
      const agent = agents.find(item => item.id === id);
      if (!agent) {
        throw new Error(`Agent ${id} not found`);
      }

      const updates = {
        status: "training",
        training_started_at: Date.now(),
        training_data: trainingData,
        last_trained_by: user?.id || "system"
      };

      await updateAgent(id, updates);

      // Simulate training completion after a delay
      setTimeout(async () => {
        try {
          await updateAgent(id, {
            status: "active",
            training_completed_at: Date.now(),
            last_trained: Date.now()
          });
        } catch (error) {
          console.error("Failed to complete training:", error);
        }
      }, 5000); // 5 second simulation

      return {
        success: true,
        agent_id: id,
        training_started: Date.now()
      };
    } catch (error) {
      console.error("Failed to train agent:", error);
      throw error;
    }
  }

  async function toggleAgentStatus(id) {
    try {
      const agent = agents.find(item => item.id === id);
      if (agent) {
        const newStatus = agent.status === "active" ? "inactive" : "active";
        await updateAgent(id, { 
          status: newStatus,
          status_changed_at: Date.now(),
          status_changed_by: user?.id || "system"
        });
      }
    } catch (error) {
      console.error("Failed to toggle agent status:", error);
      throw error;
    }
  }

  async function clearAll() {
    try {
      await clearStore("agents");
      await load();
    } catch (error) {
      console.error("Failed to clear agents:", error);
      throw error;
    }
  }

  // Role-based view filtering with enhanced permissions
  const roleView = useMemo(() => {
    if (!user || !agents.length) return agents;
    
    switch (user.role) {
      case "Automation Engineer":
      case "Manager":
        return agents; // See all agents
        
      case "SRE":
      case "Senior SRE":
        // See agents they can interact with or manage
        return agents.filter(agent => 
          agent.public !== false || 
          agent.created_by === user.id ||
          agent.team_access?.includes(user.teamId) ||
          agent.capabilities?.includes("system_management")
        );
        
      case "Support Engineer":
      case "Dispatcher":
        // Only see public agents they can interact with
        return agents.filter(agent => 
          agent.status === "active" && 
          agent.public !== false &&
          (agent.interaction_permission === "all" || 
           agent.interaction_permission?.includes(user.role))
        );
        
      default:
        return agents.filter(agent => agent.public === true);
    }
  }, [agents, user]);

  // Get agents by type/category
  const getByType = useMemo(() => {
    const categorized = {};
    roleView.forEach(agent => {
      const type = agent.type || "general";
      if (!categorized[type]) {
        categorized[type] = [];
      }
      categorized[type].push(agent);
    });
    return categorized;
  }, [roleView]);

  // Get active agents
  const activeAgents = useMemo(() => {
    return roleView.filter(agent => agent.status === "active");
  }, [roleView]);

  // Get agents in training
  const trainingAgents = useMemo(() => {
    return roleView.filter(agent => agent.status === "training");
  }, [roleView]);

  // Get recently interacted agents
  const recentlyUsed = useMemo(() => {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    return roleView
      .filter(agent => agent.last_interaction && agent.last_interaction > oneHourAgo)
      .sort((a, b) => (b.last_interaction || 0) - (a.last_interaction || 0));
  }, [roleView]);

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
          console.error(`Agents load attempt ${i + 1} failed:`, error);
          if (i === retries - 1) {
            console.error("All agents load attempts failed");
          } else {
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
    agents,
    roleView,
    isLoading,
    stats,
    getByType,
    activeAgents,
    trainingAgents,
    recentlyUsed,
    addAgent,
    updateAgent,
    removeAgent,
    interactWithAgent,
    trainAgent,
    toggleAgentStatus,
    clearAll,
    reload: load
  };

  return (
    <AgentsContext.Provider value={contextValue}>
      {children}
    </AgentsContext.Provider>
  );
}

export function useAgents() {
  const context = useContext(AgentsContext);
  if (!context) {
    throw new Error('useAgents must be used within an AgentsProvider');
  }
  return context;
}