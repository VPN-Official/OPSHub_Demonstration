// src/contexts/CostCentersContext.tsx (STANDARDIZED)
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { getAll, getById, putWithAudit, removeWithAudit } from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------
export interface BudgetAllocation {
  category: string;
  allocated_amount: number;
  spent_amount?: number;
  reserved_amount?: number;
  variance_amount?: number;
  variance_percentage?: number;
}

export interface CostCenterApproval {
  user_id: string;
  role: "approver" | "reviewer" | "viewer";
  spending_limit?: number;
  can_approve_contracts?: boolean;
  can_approve_capex?: boolean;
  can_approve_opex?: boolean;
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  description?: string;
  department?: string;  // config-driven
  region?: string;      // config-driven
  created_at: string;
  updated_at: string;

  // Relationships
  business_service_ids: string[];
  asset_ids: string[];
  contract_ids: string[];
  value_stream_ids: string[];
  vendor_ids: string[];
  owner_user_id?: string | null;
  owner_team_id?: string | null;

  // Financials
  annual_budget: number;
  currency: string;     // config-driven
  spent_ytd?: number;
  forecast_spend?: number;
  variance?: number;
  variance_percentage?: number;
  
  // Budget Planning
  budget_allocations: BudgetAllocation[];
  fiscal_year_start?: string; // "04-01" for April 1st
  budget_cycle?: "annual" | "quarterly" | "monthly";
  
  // Approval Workflows
  approvals: CostCenterApproval[];
  auto_approval_limit?: number;
  requires_dual_approval?: boolean;
  escalation_threshold?: number;

  // Cost Management
  cost_per_transaction?: number;
  cost_per_user?: number;
  utilization_rate?: number; // percentage
  efficiency_score?: number; // 0-100
  
  // Forecasting & Analytics
  burn_rate?: number; // monthly spend rate
  runway_months?: number; // months until budget exhausted
  seasonal_variance?: Record<string, number>; // month -> variance percentage
  cost_trends?: Array<{
    period: string;
    amount: number;
    category: string;
  }>;

  // Compliance & Governance
  risk_score?: number;
  compliance_requirement_ids: string[];
  audit_frequency?: "monthly" | "quarterly" | "annually";
  last_audit_date?: string;
  next_audit_date?: string;
  
  // Reporting & Analytics
  kpi_targets?: Array<{
    name: string;
    target_value: number;
    current_value?: number;
    unit: string;
    period: "monthly" | "quarterly" | "annually";
  }>;

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
  tenantId?: string;
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------
interface CostCentersContextType {
  costCenters: CostCenter[];
  addCostCenter: (cc: CostCenter, userId?: string) => Promise<void>;
  updateCostCenter: (cc: CostCenter, userId?: string) => Promise<void>;
  deleteCostCenter: (id: string, userId?: string) => Promise<void>;
  refreshCostCenters: () => Promise<void>;
  getCostCenter: (id: string) => Promise<CostCenter | undefined>;

  // Cost center-specific operations
  updateBudgetAllocations: (costCenterId: string, allocations: BudgetAllocation[], userId?: string) => Promise<void>;
  addApprover: (costCenterId: string, approver: CostCenterApproval, userId?: string) => Promise<void>;
  removeApprover: (costCenterId: string, userId: string, removedBy?: string) => Promise<void>;
  updateApproverPermissions: (costCenterId: string, userId: string, permissions: Partial<CostCenterApproval>, updatedBy?: string) => Promise<void>;
  recordExpense: (costCenterId: string, expense: { amount: number; category: string; description?: string }, userId?: string) => Promise<void>;
  calculateBurnRate: (costCenterId: string) => Promise<number>;
  forecastBudgetExhaustion: (costCenterId: string) => Promise<{ runway_months: number; exhaustion_date: string | null }>;

  // Filtering and querying
  getCostCentersByDepartment: (department: string) => CostCenter[];
  getCostCentersByRegion: (region: string) => CostCenter[];
  getCostCentersByOwner: (ownerId: string, ownerType: 'user' | 'team') => CostCenter[];
  getOverBudgetCostCenters: (varianceThreshold?: number) => CostCenter[];
  getUnderUtilizedCostCenters: (utilizationThreshold?: number) => CostCenter[];
  getCostCentersNearingBudgetLimit: (warningPercentage?: number) => CostCenter[];
  getCostCentersRequiringAudit: () => CostCenter[];
  searchCostCenters: (query: string) => CostCenter[];

  // Analytics
  getBudgetAnalytics: () => {
    totalBudget: number;
    totalSpent: number;
    totalVariance: number;
    averageUtilization: number;
    overBudgetCount: number;
    underUtilizedCount: number;
    spendByDepartment: Record<string, number>;
    spendByRegion: Record<string, number>;
  };

  getCostEfficiencyStats: () => {
    averageEfficiencyScore: number;
    averageCostPerTransaction: number;
    averageCostPerUser: number;
    topPerformingCostCenters: CostCenter[];
    underperformingCostCenters: CostCenter[];
  };

  getSpendingTrends: (timeframe?: "monthly" | "quarterly" | "yearly") => Array<{
    period: string;
    totalSpend: number;
    budgetVariance: number;
    departmentBreakdown: Record<string, number>;
  }>;

  // Config integration
  config: {
    departments: string[];
    regions: string[];
    currencies: string[];
    budget_categories: string[];
    approval_roles: string[];
  };
}

const CostCentersContext = createContext<CostCentersContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const CostCentersProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig, validateEnum } = useConfig();
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);

  // Extract cost center-specific config from global config
  const config = {
    departments: globalConfig?.business?.cost_centers?.departments || 
                 ['engineering', 'sales', 'marketing', 'operations', 'finance', 'hr', 'legal'],
    regions: globalConfig?.business?.cost_centers?.regions || 
             ['north_america', 'europe', 'asia_pacific', 'latin_america', 'africa', 'middle_east'],
    currencies: globalConfig?.business?.cost_centers?.currencies || 
                ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'],
    budget_categories: ['personnel', 'infrastructure', 'software', 'marketing', 'travel', 'training', 'operations', 'other'],
    approval_roles: ['approver', 'reviewer', 'viewer'],
  };

  const validateCostCenter = useCallback((cc: CostCenter) => {
    if (!globalConfig) {
      throw new Error("Configuration not loaded");
    }

    // Validate department
    if (cc.department && !config.departments.includes(cc.department)) {
      throw new Error(`Invalid department: ${cc.department}. Valid options: ${config.departments.join(', ')}`);
    }

    // Validate region
    if (cc.region && !config.regions.includes(cc.region)) {
      throw new Error(`Invalid region: ${cc.region}. Valid options: ${config.regions.join(', ')}`);
    }

    // Validate currency
    if (!config.currencies.includes(cc.currency)) {
      throw new Error(`Invalid currency: ${cc.currency}. Valid options: ${config.currencies.join(', ')}`);
    }

    // Validate required fields
    if (!cc.code || cc.code.trim().length < 2) {
      throw new Error("Cost center code must be at least 2 characters long");
    }

    if (!cc.name || cc.name.trim().length < 2) {
      throw new Error("Cost center name must be at least 2 characters long");
    }

    if (cc.annual_budget <= 0) {
      throw new Error("Annual budget must be a positive number");
    }

    // Validate budget allocations
    if (cc.budget_allocations) {
      cc.budget_allocations.forEach((allocation, index) => {
        if (!allocation.category || allocation.category.trim().length < 2) {
          throw new Error(`Budget allocation at index ${index} must have a category`);
        }
        if (!config.budget_categories.includes(allocation.category)) {
          throw new Error(`Invalid budget category "${allocation.category}". Valid options: ${config.budget_categories.join(', ')}`);
        }
        if (allocation.allocated_amount <= 0) {
          throw new Error(`Budget allocation at index ${index} must have a positive allocated amount`);
        }
      });

      // Check that total allocations don't exceed annual budget
      const totalAllocated = cc.budget_allocations.reduce((sum, alloc) => sum + alloc.allocated_amount, 0);
      if (totalAllocated > cc.annual_budget * 1.1) { // Allow 10% tolerance
        throw new Error(`Total budget allocations (${totalAllocated}) exceed annual budget (${cc.annual_budget}) by more than 10%`);
      }
    }

    // Validate approvals
    if (cc.approvals) {
      cc.approvals.forEach((approval, index) => {
        if (!approval.user_id) {
          throw new Error(`Approval at index ${index} must have a user_id`);
        }
        if (!config.approval_roles.includes(approval.role)) {
          throw new Error(`Invalid approval role "${approval.role}". Valid options: ${config.approval_roles.join(', ')}`);
        }
        if (approval.spending_limit !== undefined && approval.spending_limit < 0) {
          throw new Error(`Spending limit at index ${index} must be a positive number`);
        }
      });
    }

    // Validate financial values
    if (cc.spent_ytd !== undefined && cc.spent_ytd < 0) {
      throw new Error("Spent YTD must be a positive number");
    }

    if (cc.forecast_spend !== undefined && cc.forecast_spend < 0) {
      throw new Error("Forecast spend must be a positive number");
    }

    if (cc.utilization_rate !== undefined && (cc.utilization_rate < 0 || cc.utilization_rate > 100)) {
      throw new Error("Utilization rate must be between 0 and 100 percent");
    }

    if (cc.efficiency_score !== undefined && (cc.efficiency_score < 0 || cc.efficiency_score > 100)) {
      throw new Error("Efficiency score must be between 0 and 100");
    }
  }, [globalConfig, config]);

  const ensureMetadata = useCallback((cc: CostCenter): CostCenter => {
    const now = new Date().toISOString();
    
    // Calculate variance if spent_ytd is provided
    let variance = cc.variance;
    let variance_percentage = cc.variance_percentage;
    if (cc.spent_ytd !== undefined && variance === undefined) {
      variance = cc.annual_budget - cc.spent_ytd;
      variance_percentage = (variance / cc.annual_budget) * 100;
    }

    return {
      ...cc,
      tenantId,
      tags: cc.tags || [],
      health_status: cc.health_status || "gray",
      sync_status: cc.sync_status || "dirty",
      synced_at: cc.synced_at || now,
      business_service_ids: cc.business_service_ids || [],
      asset_ids: cc.asset_ids || [],
      contract_ids: cc.contract_ids || [],
      value_stream_ids: cc.value_stream_ids || [],
      vendor_ids: cc.vendor_ids || [],
      compliance_requirement_ids: cc.compliance_requirement_ids || [],
      budget_allocations: cc.budget_allocations || [],
      approvals: cc.approvals || [],
      cost_trends: cc.cost_trends || [],
      kpi_targets: cc.kpi_targets || [],
      seasonal_variance: cc.seasonal_variance || {},
      variance,
      variance_percentage,
      budget_cycle: cc.budget_cycle || "annual",
      audit_frequency: cc.audit_frequency || "quarterly",
    };
  }, [tenantId]);

  const refreshCostCenters = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      const all = await getAll<CostCenter>(tenantId, "cost_centers");
      
      // Sort by budget size and variance (concerning ones first)
      all.sort((a, b) => {
        // Red/Orange health status first for attention
        const healthOrder = { red: 5, orange: 4, yellow: 3, green: 2, gray: 1 };
        const aHealth = healthOrder[a.health_status] || 0;
        const bHealth = healthOrder[b.health_status] || 0;
        if (aHealth !== bHealth) return bHealth - aHealth;
        
        // Higher budget first
        const aBudget = a.annual_budget || 0;
        const bBudget = b.annual_budget || 0;
        if (aBudget !== bBudget) return bBudget - aBudget;
        
        // Finally by name
        return a.name.localeCompare(b.name);
      });
      
      setCostCenters(all);
    } catch (error) {
      console.error("Failed to refresh cost centers:", error);
    }
  }, [tenantId]);

  const getCostCenter = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    return getById<CostCenter>(tenantId, "cost_centers", id);
  }, [tenantId]);

  const addCostCenter = useCallback(async (cc: CostCenter, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateCostCenter(cc);

    const now = new Date().toISOString();
    const enriched = ensureMetadata({
      ...cc,
      created_at: now,
      updated_at: now,
    });

    const priority = cc.annual_budget > 1000000 ? 'high' : 'normal'; // High priority for large budgets

    await putWithAudit(
      tenantId,
      "cost_centers",
      enriched,
      userId,
      {
        action: "create",
        description: `Created cost center: ${cc.name}`,
        tags: ["cost_center", "create", cc.department || "unspecified", cc.currency],
        metadata: {
          code: cc.code,
          department: cc.department,
          region: cc.region,
          annual_budget: cc.annual_budget,
          currency: cc.currency,
          allocation_count: cc.budget_allocations.length,
        },
      }
    );

    await enqueueItem({
      storeName: "cost_centers",
      entityId: enriched.id,
      action: "create",
      payload: enriched,
      priority,
    });

    await refreshCostCenters();
  }, [tenantId, validateCostCenter, ensureMetadata, enqueueItem, refreshCostCenters]);

  const updateCostCenter = useCallback(async (cc: CostCenter, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateCostCenter(cc);

    const enriched = ensureMetadata({
      ...cc,
      updated_at: new Date().toISOString(),
    });

    await putWithAudit(
      tenantId,
      "cost_centers",
      enriched,
      userId,
      {
        action: "update",
        description: `Updated cost center: ${cc.name}`,
        tags: ["cost_center", "update", cc.department || "unspecified"],
        metadata: {
          annual_budget: cc.annual_budget,
          spent_ytd: cc.spent_ytd,
          variance: cc.variance,
          utilization_rate: cc.utilization_rate,
        },
      }
    );

    await enqueueItem({
      storeName: "cost_centers",
      entityId: enriched.id,
      action: "update",
      payload: enriched,
    });

    await refreshCostCenters();
  }, [tenantId, validateCostCenter, ensureMetadata, enqueueItem, refreshCostCenters]);

  const deleteCostCenter = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    const costCenter = await getCostCenter(id);
    if (!costCenter) throw new Error(`Cost center ${id} not found`);

    await removeWithAudit(
      tenantId,
      "cost_centers",
      id,
      userId,
      {
        action: "delete",
        description: `Deleted cost center: ${costCenter.name}`,
        tags: ["cost_center", "delete", costCenter.department || "unspecified"],
        metadata: {
          code: costCenter.code,
          annual_budget: costCenter.annual_budget,
          spent_ytd: costCenter.spent_ytd,
        },
      }
    );

    await enqueueItem({
      storeName: "cost_centers",
      entityId: id,
      action: "delete",
      payload: null,
    });

    await refreshCostCenters();
  }, [tenantId, getCostCenter, enqueueItem, refreshCostCenters]);

  // Cost center-specific operations
  const updateBudgetAllocations = useCallback(async (costCenterId: string, allocations: BudgetAllocation[], userId?: string) => {
    const costCenter = await getCostCenter(costCenterId);
    if (!costCenter) throw new Error(`Cost center ${costCenterId} not found`);

    const updated = { ...costCenter, budget_allocations: allocations };
    await updateCostCenter(updated, userId);
  }, [getCostCenter, updateCostCenter]);

  const addApprover = useCallback(async (costCenterId: string, approver: CostCenterApproval, userId?: string) => {
    const costCenter = await getCostCenter(costCenterId);
    if (!costCenter) throw new Error(`Cost center ${costCenterId} not found`);

    // Check if user is already an approver
    const existingIndex = costCenter.approvals.findIndex(a => a.user_id === approver.user_id);
    if (existingIndex >= 0) {
      throw new Error(`User ${approver.user_id} is already an approver`);
    }

    const updatedApprovals = [...costCenter.approvals, approver];
    const updated = { ...costCenter, approvals: updatedApprovals };

    await updateCostCenter(updated, userId);
  }, [getCostCenter, updateCostCenter]);

  const removeApprover = useCallback(async (costCenterId: string, userId: string, removedBy?: string) => {
    const costCenter = await getCostCenter(costCenterId);
    if (!costCenter) throw new Error(`Cost center ${costCenterId} not found`);

    const updatedApprovals = costCenter.approvals.filter(a => a.user_id !== userId);
    const updated = { ...costCenter, approvals: updatedApprovals };

    await updateCostCenter(updated, removedBy);
  }, [getCostCenter, updateCostCenter]);

  const updateApproverPermissions = useCallback(async (costCenterId: string, userId: string, permissions: Partial<CostCenterApproval>, updatedBy?: string) => {
    const costCenter = await getCostCenter(costCenterId);
    if (!costCenter) throw new Error(`Cost center ${costCenterId} not found`);

    const updatedApprovals = costCenter.approvals.map(a => 
      a.user_id === userId ? { ...a, ...permissions } : a
    );
    const updated = { ...costCenter, approvals: updatedApprovals };

    await updateCostCenter(updated, updatedBy);
  }, [getCostCenter, updateCostCenter]);

  const recordExpense = useCallback(async (costCenterId: string, expense: { amount: number; category: string; description?: string }, userId?: string) => {
    const costCenter = await getCostCenter(costCenterId);
    if (!costCenter) throw new Error(`Cost center ${costCenterId} not found`);

    // Update spent_ytd
    const newSpentYTD = (costCenter.spent_ytd || 0) + expense.amount;
    const newVariance = costCenter.annual_budget - newSpentYTD;
    const newVariancePercentage = (newVariance / costCenter.annual_budget) * 100;

    // Update relevant budget allocation
    const updatedAllocations = costCenter.budget_allocations.map(alloc =>
      alloc.category === expense.category
        ? { ...alloc, spent_amount: (alloc.spent_amount || 0) + expense.amount }
        : alloc
    );

    // Add to cost trends
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const updatedTrends = [
      ...costCenter.cost_trends,
      {
        period: currentMonth,
        amount: expense.amount,
        category: expense.category,
      }
    ];

    const updated = {
      ...costCenter,
      spent_ytd: newSpentYTD,
      variance: newVariance,
      variance_percentage: newVariancePercentage,
      budget_allocations: updatedAllocations,
      cost_trends: updatedTrends,
      custom_fields: {
        ...costCenter.custom_fields,
        last_expense: {
          amount: expense.amount,
          category: expense.category,
          description: expense.description,
          recorded_at: new Date().toISOString(),
          recorded_by: userId,
        }
      }
    };

    await updateCostCenter(updated, userId);
  }, [getCostCenter, updateCostCenter]);

  const calculateBurnRate = useCallback(async (costCenterId: string) => {
    const costCenter = await getCostCenter(costCenterId);
    if (!costCenter) throw new Error(`Cost center ${costCenterId} not found`);

    // Simple calculation based on YTD spend and current month
    const currentDate = new Date();
    const monthsElapsed = currentDate.getMonth() + 1; // 1-based
    const monthlyBurn = monthsElapsed > 0 ? (costCenter.spent_ytd || 0) / monthsElapsed : 0;

    return monthlyBurn;
  }, [getCostCenter]);

  const forecastBudgetExhaustion = useCallback(async (costCenterId: string) => {
    const costCenter = await getCostCenter(costCenterId);
    if (!costCenter) throw new Error(`Cost center ${costCenterId} not found`);

    const burnRate = await calculateBurnRate(costCenterId);
    const remainingBudget = costCenter.annual_budget - (costCenter.spent_ytd || 0);

    if (burnRate <= 0) {
      return { runway_months: Infinity, exhaustion_date: null };
    }

    const runwayMonths = remainingBudget / burnRate;
    
    let exhaustionDate: string | null = null;
    if (runwayMonths < 120) { // Only calculate date if within 10 years
      const currentDate = new Date();
      const exhaustionDateObj = new Date(currentDate.setMonth(currentDate.getMonth() + runwayMonths));
      exhaustionDate = exhaustionDateObj.toISOString().split('T')[0];
    }

    return { runway_months: Math.max(0, runwayMonths), exhaustion_date: exhaustionDate };
  }, [getCostCenter, calculateBurnRate]);

  // Filtering functions
  const getCostCentersByDepartment = useCallback((department: string) => {
    return costCenters.filter(cc => cc.department === department);
  }, [costCenters]);

  const getCostCentersByRegion = useCallback((region: string) => {
    return costCenters.filter(cc => cc.region === region);
  }, [costCenters]);

  const getCostCentersByOwner = useCallback((ownerId: string, ownerType: 'user' | 'team') => {
    if (ownerType === 'user') {
      return costCenters.filter(cc => cc.owner_user_id === ownerId);
    } else {
      return costCenters.filter(cc => cc.owner_team_id === ownerId);
    }
  }, [costCenters]);

  const getOverBudgetCostCenters = useCallback((varianceThreshold: number = 0) => {
    return costCenters.filter(cc => 
      (cc.variance !== undefined && cc.variance < varianceThreshold) ||
      (cc.spent_ytd !== undefined && cc.spent_ytd > cc.annual_budget)
    );
  }, [costCenters]);

  const getUnderUtilizedCostCenters = useCallback((utilizationThreshold: number = 70) => {
    return costCenters.filter(cc => 
      cc.utilization_rate !== undefined && cc.utilization_rate < utilizationThreshold
    );
  }, [costCenters]);

  const getCostCentersNearingBudgetLimit = useCallback((warningPercentage: number = 80) => {
    return costCenters.filter(cc => {
      if (!cc.spent_ytd) return false;
      const utilization = (cc.spent_ytd / cc.annual_budget) * 100;
      return utilization >= warningPercentage;
    });
  }, [costCenters]);

  const getCostCentersRequiringAudit = useCallback(() => {
    const now = new Date();
    return costCenters.filter(cc => {
      if (!cc.next_audit_date) return false;
      return new Date(cc.next_audit_date) <= now;
    });
  }, [costCenters]);

  const searchCostCenters = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return costCenters.filter(cc => 
      cc.name.toLowerCase().includes(lowerQuery) ||
      cc.code.toLowerCase().includes(lowerQuery) ||
      cc.description?.toLowerCase().includes(lowerQuery) ||
      cc.department?.toLowerCase().includes(lowerQuery) ||
      cc.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }, [costCenters]);

  // Analytics functions
  const getBudgetAnalytics = useCallback(() => {
    const totalBudget = costCenters.reduce((sum, cc) => sum + cc.annual_budget, 0);
    const totalSpent = costCenters.reduce((sum, cc) => sum + (cc.spent_ytd || 0), 0);
    const totalVariance = totalBudget - totalSpent;
    
    const centersWithUtilization = costCenters.filter(cc => cc.utilization_rate !== undefined);
    const averageUtilization = centersWithUtilization.length > 0
      ? centersWithUtilization.reduce((sum, cc) => sum + (cc.utilization_rate || 0), 0) / centersWithUtilization.length
      : 0;

    const overBudgetCount = getOverBudgetCostCenters().length;
    const underUtilizedCount = getUnderUtilizedCostCenters().length;

    const spendByDepartment = costCenters.reduce((acc, cc) => {
      if (cc.department && cc.spent_ytd) {
        acc[cc.department] = (acc[cc.department] || 0) + cc.spent_ytd;
      }
      return acc;
    }, {} as Record<string, number>);

    const spendByRegion = costCenters.reduce((acc, cc) => {
      if (cc.region && cc.spent_ytd) {
        acc[cc.region] = (acc[cc.region] || 0) + cc.spent_ytd;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      totalBudget,
      totalSpent,
      totalVariance,
      averageUtilization,
      overBudgetCount,
      underUtilizedCount,
      spendByDepartment,
      spendByRegion,
    };
  }, [costCenters, getOverBudgetCostCenters, getUnderUtilizedCostCenters]);

  const getCostEfficiencyStats = useCallback(() => {
    const centersWithEfficiency = costCenters.filter(cc => cc.efficiency_score !== undefined);
    const centersWithCostPerTransaction = costCenters.filter(cc => cc.cost_per_transaction !== undefined);
    const centersWithCostPerUser = costCenters.filter(cc => cc.cost_per_user !== undefined);

    const averageEfficiencyScore = centersWithEfficiency.length > 0
      ? centersWithEfficiency.reduce((sum, cc) => sum + (cc.efficiency_score || 0), 0) / centersWithEfficiency.length
      : 0;

    const averageCostPerTransaction = centersWithCostPerTransaction.length > 0
      ? centersWithCostPerTransaction.reduce((sum, cc) => sum + (cc.cost_per_transaction || 0), 0) / centersWithCostPerTransaction.length
      : 0;

    const averageCostPerUser = centersWithCostPerUser.length > 0
      ? centersWithCostPerUser.reduce((sum, cc) => sum + (cc.cost_per_user || 0), 0) / centersWithCostPerUser.length
      : 0;

    const topPerformingCostCenters = costCenters
      .filter(cc => cc.efficiency_score !== undefined)
      .sort((a, b) => (b.efficiency_score || 0) - (a.efficiency_score || 0))
      .slice(0, 5);

    const underperformingCostCenters = costCenters
      .filter(cc => cc.efficiency_score !== undefined && cc.efficiency_score < 60)
      .sort((a, b) => (a.efficiency_score || 0) - (b.efficiency_score || 0));

    return {
      averageEfficiencyScore,
      averageCostPerTransaction,
      averageCostPerUser,
      topPerformingCostCenters,
      underperformingCostCenters,
    };
  }, [costCenters]);

  const getSpendingTrends = useCallback((timeframe: "monthly" | "quarterly" | "yearly" = "monthly") => {
    // This would typically aggregate from historical data
    // For now, return mock trend data based on current cost centers
    const trends = [];
    const currentDate = new Date();
    
    // Generate last 12 periods of data
    for (let i = 11; i >= 0; i--) {
      const periodDate = new Date(currentDate);
      
      if (timeframe === "monthly") {
        periodDate.setMonth(periodDate.getMonth() - i);
      } else if (timeframe === "quarterly") {
        periodDate.setMonth(periodDate.getMonth() - (i * 3));
      } else {
        periodDate.setFullYear(periodDate.getFullYear() - i);
      }

      const period = timeframe === "yearly" 
        ? periodDate.getFullYear().toString()
        : periodDate.toISOString().slice(0, 7); // YYYY-MM

      // Mock spending data (would come from historical records)
      const totalSpend = costCenters.reduce((sum, cc) => {
        const baseSpend = (cc.spent_ytd || 0) / 12; // Approximate monthly
        const variation = (Math.random() - 0.5) * 0.2; // ±10% variation
        return sum + (baseSpend * (1 + variation));
      }, 0);

      const budgetVariance = costCenters.reduce((sum, cc) => sum + cc.annual_budget, 0) / 12 - totalSpend;

      const departmentBreakdown = costCenters.reduce((acc, cc) => {
        if (cc.department) {
          const deptSpend = (cc.spent_ytd || 0) / 12 * (1 + (Math.random() - 0.5) * 0.2);
          acc[cc.department] = (acc[cc.department] || 0) + deptSpend;
        }
        return acc;
      }, {} as Record<string, number>);

      trends.push({
        period,
        totalSpend,
        budgetVariance,
        departmentBreakdown,
      });
    }

    return trends;
  }, [costCenters]);

  // Initialize when tenant and config are ready
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshCostCenters();
    }
  }, [tenantId, globalConfig, refreshCostCenters]);

  return (
    <CostCentersContext.Provider
      value={{
        costCenters,
        addCostCenter,
        updateCostCenter,
        deleteCostCenter,
        refreshCostCenters,
        getCostCenter,
        updateBudgetAllocations,
        addApprover,
        removeApprover,
        updateApproverPermissions,
        recordExpense,
        calculateBurnRate,
        forecastBudgetExhaustion,
        getCostCentersByDepartment,
        getCostCentersByRegion,
        getCostCentersByOwner,
        getOverBudgetCostCenters,
        getUnderUtilizedCostCenters,
        getCostCentersNearingBudgetLimit,
        getCostCentersRequiringAudit,
        searchCostCenters,
        getBudgetAnalytics,
        getCostEfficiencyStats,
        getSpendingTrends,
        config,
      }}
    >
      {children}
    </CostCentersContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------
export const useCostCenters = () => {
  const ctx = useContext(CostCentersContext);
  if (!ctx) throw new Error("useCostCenters must be used within CostCentersProvider");
  return ctx;
};

export const useCostCenterDetails = (id: string) => {
  const { costCenters } = useCostCenters();
  return costCenters.find((cc) => cc.id === id) || null;
};

// Utility hooks
export const useOverBudgetCostCenters = () => {
  const { getOverBudgetCostCenters } = useCostCenters();
  return getOverBudgetCostCenters();
};

export const useCostCenterBudgetAnalytics = () => {
  const { getBudgetAnalytics } = useCostCenters();
  return getBudgetAnalytics();
};

export const useCostCenterEfficiencyStats = () => {
  const { getCostEfficiencyStats } = useCostCenters();
  return getCostEfficiencyStats();
};

export const useCostCenterBurnRate = (costCenterId: string) => {
  const { calculateBurnRate } = useCostCenters();
  const [burnRate, setBurnRate] = useState<number | null>(null);

  useEffect(() => {
    if (costCenterId) {
      calculateBurnRate(costCenterId)
        .then(setBurnRate)
        .catch(console.error);
    }
  }, [costCenterId, calculateBurnRate]);

  return burnRate;
};

export const useCostCenterForecast = (costCenterId: string) => {
  const { forecastBudgetExhaustion } = useCostCenters();
  const [forecast, setForecast] = useState<{ runway_months: number; exhaustion_date: string | null } | null>(null);

  useEffect(() => {
    if (costCenterId) {
      forecastBudgetExhaustion(costCenterId)
        .then(setForecast)
        .catch(console.error);
    }
  }, [costCenterId, forecastBudgetExhaustion]);

  return forecast;
};