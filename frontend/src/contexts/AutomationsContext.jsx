import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { getAll, setItem, delItem, clearStore, isSeeded } from "../utils/db.js";
import { useAuth } from "./AuthContext.jsx";

const AutomationsContext = createContext();

export function AutomationsProvider({ children }) {
  const [automations, setAutomations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    recent_runs: 0,
    success_rate: 0
  });
  const { user } = useAuth();

  async function load() {
    try {
      setIsLoading(true);
      const items = await getAll("automations");
      
      if (!items.length) {
        const alreadySeeded = await isSeeded();
        if (!alreadySeeded) {
          console.log("🔍 Automations store empty, but global seeding will handle this");
        }
      }
      
      setAutomations(items);
      calculateStats(items);
    } catch (error) {
      console.error("Failed to load automations:", error);
      setAutomations([]);
      setStats({ total: 0, active: 0, recent_runs: 0, success_rate: 0 });
    } finally {
      setIsLoading(false);
    }
  }

  function calculateStats(items) {
    const total = items.length;
    const active = items.filter(item => item.status === "active").length;
    const recentRuns = items.reduce((sum, item) => sum + (item.recent_runs || 0), 0);
    const successfulRuns = items.reduce((sum, item) => sum + (item.successful_runs || 0), 0);
    const totalRuns = items.reduce((sum, item) => sum + (item.total_runs || 0), 0);
    const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0;

    setStats({
      total,
      active,
      recent_runs: recentRuns,
      success_rate: successRate
    });
  }

  async function addAutomation(automation) {
    try {
      const newAutomation = {
        ...automation,
        id: automation.id || `auto_${Date.now()}`,
        created_by: user?.id || "system",
        created_at: Date.now(),
        status: automation.status || "draft",
        total_runs: 0,
        successful_runs: 0,
        recent_runs: 0,
        last_modified: Date.now()
      };
      
      await setItem("automations", newAutomation);
      await load(); // Reload to get updated stats
    } catch (error) {
      console.error("Failed to add automation:", error);
      throw error;
    }
  }

  async function updateAutomation(id, updates) {
    try {
      const existing = automations.find(item => item.id === id);
      if (existing) {
        const updated = {
          ...existing,
          ...updates,
          last_modified: Date.now(),
          modified_by: user?.id || "system"
        };
        
        await setItem("automations", updated);
        
        // Optimistic update
        setAutomations(prev => prev.map(item => 
          item.id === id ? updated : item
        ));
        
        // Recalculate stats
        const newAutomations = automations.map(item => 
          item.id === id ? updated : item
        );
        calculateStats(newAutomations);
      }
    } catch (error) {
      console.error("Failed to update automation:", error);
      await load(); // Reload on error
      throw error;
    }
  }

  async function removeAutomation(id) {
    try {
      await delItem("automations", id);
      await load(); // Reload to get updated stats
    } catch (error) {
      console.error("Failed to remove automation:", error);
      throw error;
    }
  }

  async function executeAutomation(id, context = {}) {
    try {
      const automation = automations.find(item => item.id === id);
      if (!automation) {
        throw new Error(`Automation ${id} not found`);
      }

      // Update run statistics
      const updates = {
        total_runs: (automation.total_runs || 0) + 1,
        recent_runs: (automation.recent_runs || 0) + 1,
        last_run_at: Date.now(),
        last_run_by: user?.id || "system",
        last_run_context: context
      };

      await updateAutomation(id, updates);

      return {
        success: true,
        automation_id: id,
        executed_at: Date.now(),
        context
      };
    } catch (error) {
      console.error("Failed to execute automation:", error);
      throw error;
    }
  }

  async function toggleAutomationStatus(id) {
    try {
      const automation = automations.find(item => item.id === id);
      if (automation) {
        const newStatus = automation.status === "active" ? "inactive" : "active";
        await updateAutomation(id, { 
          status: newStatus,
          status_changed_at: Date.now(),
          status_changed_by: user?.id || "system"
        });
      }
    } catch (error) {
      console.error("Failed to toggle automation status:", error);
      throw error;
    }
  }

  async function clearAll() {
    try {
      await clearStore("automations");
      await load();
    } catch (error) {
      console.error("Failed to clear automations:", error);
      throw error;
    }
  }

  // Role-based view filtering with enhanced permissions
  const roleView = useMemo(() => {
    if (!user || !automations.length) return automations;
    
    switch (user.role) {
      case "Automation Engineer":
      case "Manager":
        return automations; // See all automations
        
      case "SRE":
      case "Senior SRE":
        // See automations they can execute or manage
        return automations.filter(automation => 
          automation.public !== false || 
          automation.created_by === user.id ||
          automation.team_access?.includes(user.teamId)
        );
        
      case "Support Engineer":
      case "Dispatcher":
        // Only see public automations they can execute
        return automations.filter(automation => 
          automation.status === "active" && 
          automation.public !== false &&
          (automation.execution_permission === "all" || 
           automation.execution_permission?.includes(user.role))
        );
        
      default:
        return automations.filter(automation => automation.public === true);
    }
  }, [automations, user]);

  // Get automations by category
  const getByCategory = useMemo(() => {
    const categorized = {};
    roleView.forEach(automation => {
      const category = automation.category || "uncategorized";
      if (!categorized[category]) {
        categorized[category] = [];
      }
      categorized[category].push(automation);
    });
    return categorized;
  }, [roleView]);

  // Get recently executed automations
  const recentlyExecuted = useMemo(() => {
    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
    return roleView
      .filter(automation => automation.last_run_at && automation.last_run_at > twoHoursAgo)
      .sort((a, b) => (b.last_run_at || 0) - (a.last_run_at || 0));
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
          console.error(`Automations load attempt ${i + 1} failed:`, error);
          if (i === retries - 1) {
            console.error("All automations load attempts failed");
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
    automations,
    roleView,
    isLoading,
    stats,
    getByCategory,
    recentlyExecuted,
    addAutomation,
    updateAutomation,
    removeAutomation,
    executeAutomation,
    toggleAutomationStatus,
    clearAll,
    reload: load
  };

  return (
    <AutomationsContext.Provider value={contextValue}>
      {children}
    </AutomationsContext.Provider>
  );
}

export function useAutomations() {
  const context = useContext(AutomationsContext);
  if (!context) {
    throw new Error('useAutomations must be used within an AutomationsProvider');
  }
  return context;
}