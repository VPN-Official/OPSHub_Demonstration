import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { getAll, setItem, delItem, clearStore, isSeeded } from "../utils/db.js";
import { useAuth } from "./AuthContext.jsx";

const NudgesContext = createContext();

export function NudgesProvider({ children }) {
  const [nudges, setNudges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    implemented: 0,
    potential_savings: 0
  });
  const { user } = useAuth();

  async function load() {
    try {
      setIsLoading(true);
      const items = await getAll("nudges");
      
      if (!items.length) {
        const alreadySeeded = await isSeeded();
        if (!alreadySeeded) {
          console.log("🔍 Nudges store empty, but global seeding will handle this");
        }
      }
      
      setNudges(items);
      calculateStats(items);
    } catch (error) {
      console.error("Failed to load nudges:", error);
      setNudges([]);
      setStats({ total: 0, active: 0, implemented: 0, potential_savings: 0 });
    } finally {
      setIsLoading(false);
    }
  }

  function calculateStats(items) {
    const total = items.length;
    const active = items.filter(item => item.status === "active").length;
    const implemented = items.filter(item => item.status === "implemented").length;
    const potentialSavings = items
      .filter(item => item.status === "active")
      .reduce((sum, item) => sum + (item.potential_savings || 0), 0);

    setStats({
      total,
      active,
      implemented,
      potential_savings: potentialSavings
    });
  }

  async function addNudge(nudge) {
    try {
      const newNudge = {
        ...nudge,
        id: nudge.id || `nudge_${Date.now()}`,
        created_by: user?.id || "system",
        created_at: Date.now(),
        status: nudge.status || "active",
        priority: nudge.priority || "medium",
        view_count: 0,
        acknowledgment_count: 0,
        implementation_count: 0,
        last_modified: Date.now()
      };
      
      await setItem("nudges", newNudge);
      await load();
    } catch (error) {
      console.error("Failed to add nudge:", error);
      throw error;
    }
  }

  async function updateNudge(id, updates) {
    try {
      const existing = nudges.find(item => item.id === id);
      if (existing) {
        const updated = {
          ...existing,
          ...updates,
          last_modified: Date.now(),
          modified_by: user?.id || "system"
        };
        
        await setItem("nudges", updated);
        
        // Optimistic update
        setNudges(prev => prev.map(item => 
          item.id === id ? updated : item
        ));
        
        // Recalculate stats
        const newNudges = nudges.map(item => 
          item.id === id ? updated : item
        );
        calculateStats(newNudges);
      }
    } catch (error) {
      console.error("Failed to update nudge:", error);
      await load();
      throw error;
    }
  }

  async function removeNudge(id) {
    try {
      await delItem("nudges", id);
      await load();
    } catch (error) {
      console.error("Failed to remove nudge:", error);
      throw error;
    }
  }

  async function acknowledgeNudge(id) {
    try {
      const nudge = nudges.find(item => item.id === id);
      if (nudge) {
        const updates = {
          acknowledgment_count: (nudge.acknowledgment_count || 0) + 1,
          last_acknowledged: Date.now(),
          last_acknowledged_by: user?.id || "system",
          acknowledged_by_users: [
            ...(nudge.acknowledged_by_users || []),
            user?.id
          ].filter((id, index, array) => array.indexOf(id) === index) // Remove duplicates
        };
        
        await updateNudge(id, updates);
      }
    } catch (error) {
      console.error("Failed to acknowledge nudge:", error);
      throw error;
    }
  }

  async function implementNudge(id, implementationDetails = {}) {
    try {
      const nudge = nudges.find(item => item.id === id);
      if (nudge) {
        const updates = {
          status: "implemented",
          implementation_count: (nudge.implementation_count || 0) + 1,
          implemented_at: Date.now(),
          implemented_by: user?.id || "system",
          implementation_details: implementationDetails,
          actual_savings: implementationDetails.actual_savings || 0
        };
        
        await updateNudge(id, updates);
        
        return {
          success: true,
          nudge_id: id,
          implemented_at: Date.now(),
          implementation_details: implementationDetails
        };
      }
    } catch (error) {
      console.error("Failed to implement nudge:", error);
      throw error;
    }
  }

  async function dismissNudge(id, reason = "") {
    try {
      const nudge = nudges.find(item => item.id === id);
      if (nudge) {
        const updates = {
          status: "dismissed",
          dismissed_at: Date.now(),
          dismissed_by: user?.id || "system",
          dismissal_reason: reason
        };
        
        await updateNudge(id, updates);
      }
    } catch (error) {
      console.error("Failed to dismiss nudge:", error);
      throw error;
    }
  }

  async function snoozeNudge(id, snoozeUntil) {
    try {
      const nudge = nudges.find(item => item.id === id);
      if (nudge) {
        const updates = {
          status: "snoozed",
          snoozed_until: snoozeUntil,
          snoozed_at: Date.now(),
          snoozed_by: user?.id || "system"
        };
        
        await updateNudge(id, updates);
      }
    } catch (error) {
      console.error("Failed to snooze nudge:", error);
      throw error;
    }
  }

  async function clearAll() {
    try {
      await clearStore("nudges");
      await load();
    } catch (error) {
      console.error("Failed to clear nudges:", error);
      throw error;
    }
  }

  // Role-based view filtering
  const roleView = useMemo(() => {
    if (!user || !nudges.length) return nudges;
    
    const now = Date.now();
    
    // Filter out snoozed nudges that haven't expired
    let filteredNudges = nudges.filter(nudge => {
      if (nudge.status === "snoozed" && nudge.snoozed_until) {
        return now > nudge.snoozed_until;
      }
      return true;
    });

    switch (user.role) {
      case "Manager":
        // Managers see all nudges including team-specific ones
        return filteredNudges;
        
      case "Automation Engineer":
      case "SRE":
      case "Senior SRE":
        // Technical roles see automation and efficiency nudges
        return filteredNudges.filter(nudge => 
          nudge.status !== "dismissed" &&
          (nudge.category === "automation" ||
           nudge.category === "efficiency" ||
           nudge.category === "cost_optimization" ||
           nudge.target_roles?.includes(user.role) ||
           !nudge.target_roles)
        );
        
      case "Support Engineer":
      case "Dispatcher":
        // Support roles see process and training nudges
        return filteredNudges.filter(nudge => 
          nudge.status !== "dismissed" &&
          (nudge.category === "process_improvement" ||
           nudge.category === "training" ||
           nudge.category === "knowledge_management" ||
           nudge.target_roles?.includes(user.role) ||
           !nudge.target_roles)
        );
        
      default:
        return filteredNudges.filter(nudge => 
          nudge.status === "active" && 
          (!nudge.target_roles || nudge.target_roles.includes(user.role))
        );
    }
  }, [nudges, user]);

  // Get nudges by category
  const getByCategory = useMemo(() => {
    const categorized = {};
    roleView.forEach(nudge => {
      const category = nudge.category || "general";
      if (!categorized[category]) {
        categorized[category] = [];
      }
      categorized[category].push(nudge);
    });
    return categorized;
  }, [roleView]);

  // Get nudges by priority
  const getByPriority = useMemo(() => {
    const priorities = {};
    roleView.forEach(nudge => {
      const priority = nudge.priority || "medium";
      if (!priorities[priority]) {
        priorities[priority] = [];
      }
      priorities[priority].push(nudge);
    });
    return priorities;
  }, [roleView]);

  // Get active nudges only
  const activeNudges = useMemo(() => {
    return roleView.filter(nudge => nudge.status === "active");
  }, [roleView]);

  // Get high-impact nudges
  const highImpactNudges = useMemo(() => {
    return roleView
      .filter(nudge => 
        nudge.status === "active" && 
        (nudge.priority === "high" || (nudge.potential_savings || 0) > 1000)
      )
      .sort((a, b) => (b.potential_savings || 0) - (a.potential_savings || 0));
  }, [roleView]);

  // Get recently implemented nudges
  const recentlyImplemented = useMemo(() => {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    return roleView
      .filter(nudge => 
        nudge.status === "implemented" && 
        nudge.implemented_at && 
        nudge.implemented_at > oneWeekAgo
      )
      .sort((a, b) => (b.implemented_at || 0) - (a.implemented_at || 0));
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
          console.error(`Nudges load attempt ${i + 1} failed:`, error);
          if (i === retries - 1) {
            console.error("All nudges load attempts failed");
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

  // Auto-unsnooze nudges when their snooze time expires
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const snoozedNudges = nudges.filter(nudge => 
        nudge.status === "snoozed" && 
        nudge.snoozed_until && 
        now > nudge.snoozed_until
      );

      snoozedNudges.forEach(nudge => {
        updateNudge(nudge.id, {
          status: "active",
          snoozed_until: null,
          unsnoozed_at: now
        });
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [nudges]);

  const contextValue = {
    nudges,
    roleView,
    isLoading,
    stats,
    getByCategory,
    getByPriority,
    activeNudges,
    highImpactNudges,
    recentlyImplemented,
    addNudge,
    updateNudge,
    removeNudge,
    acknowledgeNudge,
    implementNudge,
    dismissNudge,
    snoozeNudge,
    clearAll,
    reload: load
  };

  return (
    <NudgesContext.Provider value={contextValue}>
      {children}
    </NudgesContext.Provider>
  );
}

export function useNudges() {
  const context = useContext(NudgesContext);
  if (!context) {
    throw new Error('useNudges must be used within a NudgesProvider');
  }
  return context;
}