import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { getAll, setItem, delItem, clearStore, isSeeded } from "../utils/db.js";
import { useAuth } from "./AuthContext.jsx";

const CostsContext = createContext();

export function CostsProvider({ children }) {
  const [costs, setCosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [budgets, setBudgets] = useState({});
  const [trends, setTrends] = useState({});
  const [stats, setStats] = useState({
    totalCost: 0,
    monthlyBudget: 0,
    budgetUtilization: 0,
    projectedOverrun: 0
  });
  const { user } = useAuth();

  async function load() {
    try {
      setIsLoading(true);
      const items = await getAll("costs");
      
      if (!items.length) {
        const alreadySeeded = await isSeeded();
        if (!alreadySeeded) {
          console.log("🔍 Costs store empty, but global seeding will handle this");
        }
      }
      
      setCosts(items);
      calculateStats(items);
      calculateTrends(items);
    } catch (error) {
      console.error("Failed to load costs:", error);
      setCosts([]);
      setStats({ totalCost: 0, monthlyBudget: 0, budgetUtilization: 0, projectedOverrun: 0 });
    } finally {
      setIsLoading(false);
    }
  }

  function calculateStats(items) {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    // Filter current month costs
    const currentMonthCosts = items.filter(cost => {
      const costDate = new Date(cost.date || cost.timestamp || Date.now());
      return costDate.getMonth() === currentMonth && costDate.getFullYear() === currentYear;
    });

    const totalCost = currentMonthCosts.reduce((sum, cost) => sum + (cost.amount || 0), 0);
    
    // Calculate budget utilization (assuming monthly budget from budgets)
    const monthlyBudget = budgets.monthly || 50000; // Default budget
    const budgetUtilization = monthlyBudget > 0 ? Math.round((totalCost / monthlyBudget) * 100) : 0;
    
    // Simple projection based on current usage
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const currentDay = new Date().getDate();
    const projectedMonthlySpend = (totalCost / currentDay) * daysInMonth;
    const projectedOverrun = Math.max(0, projectedMonthlySpend - monthlyBudget);

    setStats({
      totalCost: Math.round(totalCost),
      monthlyBudget,
      budgetUtilization,
      projectedOverrun: Math.round(projectedOverrun)
    });
  }

  function calculateTrends(items) {
    // Calculate month-over-month trends
    const monthlySpend = {};
    
    items.forEach(cost => {
      const costDate = new Date(cost.date || cost.timestamp || Date.now());
      const monthKey = `${costDate.getFullYear()}-${costDate.getMonth()}`;
      
      if (!monthlySpend[monthKey]) {
        monthlySpend[monthKey] = 0;
      }
      monthlySpend[monthKey] += cost.amount || 0;
    });

    // Calculate trends for last 3 months
    const months = Object.keys(monthlySpend).sort().slice(-3);
    const trendData = {};
    
    if (months.length >= 2) {
      const current = monthlySpend[months[months.length - 1]] || 0;
      const previous = monthlySpend[months[months.length - 2]] || 0;
      
      trendData.monthOverMonth = previous > 0 ? 
        Math.round(((current - previous) / previous) * 100) : 0;
      trendData.direction = current > previous ? "up" : "down";
    }

    setTrends(trendData);
  }

  async function addCostEntry(cost) {
    try {
      const newCost = {
        ...cost,
        id: cost.id || `cost_${Date.now()}`,
        created_by: user?.id || "system",
        created_at: Date.now(),
        date: cost.date || Date.now(),
        category: cost.category || "operational",
        type: cost.type || "expense",
        approved: cost.approved || false,
        last_modified: Date.now()
      };
      
      await setItem("costs", newCost);
      await load();
    } catch (error) {
      console.error("Failed to add cost entry:", error);
      throw error;
    }
  }

  async function updateCostEntry(id, updates) {
    try {
      const existing = costs.find(item => item.id === id);
      if (existing) {
        const updated = {
          ...existing,
          ...updates,
          last_modified: Date.now(),
          modified_by: user?.id || "system"
        };
        
        // Track approval changes
        if (updates.approved !== existing.approved) {
          updated.approval_history = [
            ...(existing.approval_history || []),
            {
              approved: updates.approved,
              approved_by: user?.id || "system",
              approved_at: Date.now(),
              reason: updates.approval_reason || ""
            }
          ];
        }
        
        await setItem("costs", updated);
        
        // Optimistic update
        setCosts(prev => prev.map(item => 
          item.id === id ? updated : item
        ));
        
        // Recalculate stats
        const newCosts = costs.map(item => 
          item.id === id ? updated : item
        );
        calculateStats(newCosts);
        calculateTrends(newCosts);
      }
    } catch (error) {
      console.error("Failed to update cost entry:", error);
      await load();
      throw error;
    }
  }

  async function removeCostEntry(id) {
    try {
      await delItem("costs", id);
      await load();
    } catch (error) {
      console.error("Failed to remove cost entry:", error);
      throw error;
    }
  }

  async function approveCostEntry(id, approved = true, reason = "") {
    try {
      await updateCostEntry(id, {
        approved,
        approved_by: user?.id || "system",
        approved_at: Date.now(),
        approval_reason: reason
      });
    } catch (error) {
      console.error("Failed to approve cost entry:", error);
      throw error;
    }
  }

  async function setBudget(budgetData) {
    try {
      const newBudgets = {
        ...budgets,
        ...budgetData,
        updated_by: user?.id || "system",
        updated_at: Date.now()
      };
      
      setBudgets(newBudgets);
      
      // Store budget in a special budget record
      await setItem("costs", {
        id: `budget_${Date.now()}`,
        type: "budget",
        category: "budget",
        ...budgetData,
        created_by: user?.id || "system",
        created_at: Date.now()
      });
      
      // Recalculate stats with new budget
      calculateStats(costs);
    } catch (error) {
      console.error("Failed to set budget:", error);
      throw error;
    }
  }

  async function clearAll() {
    try {
      await clearStore("costs");
      await load();
    } catch (error) {
      console.error("Failed to clear costs:", error);
      throw error;
    }
  }

  // Role-based view filtering
  const roleView = useMemo(() => {
    if (!user || !costs.length) return costs;
    
    switch (user.role) {
      case "Manager":
        return costs; // Managers see all cost data
        
      case "SRE":
      case "Senior SRE":
      case "Automation Engineer":
        // Technical roles see costs they're responsible for or infrastructure costs
        return costs.filter(cost => 
          cost.category === "infrastructure" ||
          cost.category === "tooling" ||
          cost.responsible_person === user.id ||
          cost.team_id === user.teamId ||
          !cost.access_restricted
        );
        
      case "Support Engineer":
      case "Dispatcher":
        // Support roles see operational costs and their team costs
        return costs.filter(cost => 
          cost.category === "operational" ||
          cost.category === "training" ||
          cost.team_id === user.teamId ||
          !cost.access_restricted
        );
        
      default:
        return costs.filter(cost => !cost.access_restricted);
    }
  }, [costs, user]);

  // Get costs by category
  const getByCategory = useMemo(() => {
    const categorized = {};
    roleView.forEach(cost => {
      const category = cost.category || "operational";
      if (!categorized[category]) {
        categorized[category] = [];
      }
      categorized[category].push(cost);
    });
    return categorized;
  }, [roleView]);

  // Get costs by time period
  const getByTimePeriod = useMemo(() => {
    const periods = {};
    
    roleView.forEach(cost => {
      const costDate = new Date(cost.date || cost.timestamp || Date.now());
      const monthKey = `${costDate.getFullYear()}-${costDate.getMonth() + 1}`;
      
      if (!periods[monthKey]) {
        periods[monthKey] = [];
      }
      periods[monthKey].push(cost);
    });
    
    return periods;
  }, [roleView]);

  // Get pending approvals
  const pendingApprovals = useMemo(() => {
    return roleView.filter(cost => 
      cost.type !== "budget" && 
      cost.approved === false && 
      cost.amount > 0
    );
  }, [roleView]);

  // Get high-cost items
  const highCostItems = useMemo(() => {
    const threshold = 1000; // $1000 threshold
    return roleView
      .filter(cost => cost.amount >= threshold && cost.type !== "budget")
      .sort((a, b) => (b.amount || 0) - (a.amount || 0));
  }, [roleView]);

  // Get cost summary by business service
  const costByBusinessService = useMemo(() => {
    const serviceCosts = {};
    
    roleView.forEach(cost => {
      if (cost.business_service_id) {
        const serviceId = cost.business_service_id;
        if (!serviceCosts[serviceId]) {
          serviceCosts[serviceId] = {
            total: 0,
            items: []
          };
        }
        serviceCosts[serviceId].total += cost.amount || 0;
        serviceCosts[serviceId].items.push(cost);
      }
    });
    
    return serviceCosts;
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
          console.error(`Costs load attempt ${i + 1} failed:`, error);
          if (i === retries - 1) {
            console.error("All costs load attempts failed");
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
    costs,
    roleView,
    isLoading,
    stats,
    trends,
    budgets,
    getByCategory,
    getByTimePeriod,
    pendingApprovals,
    highCostItems,
    costByBusinessService,
    addCostEntry,
    updateCostEntry,
    removeCostEntry,
    approveCostEntry,
    setBudget,
    clearAll,
    reload: load
  };

  return (
    <CostsContext.Provider value={contextValue}>
      {children}
    </CostsContext.Provider>
  );
}

export function useCosts() {
  const context = useContext(CostsContext);
  if (!context) {
    throw new Error('useCosts must be used within a CostsProvider');
  }
  return context;
}