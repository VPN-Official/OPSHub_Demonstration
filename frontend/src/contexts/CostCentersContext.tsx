// src/contexts/CostCentersContext.tsx (ENTERPRISE FRONTEND REFACTOR)
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { getAll, getById, putWithAudit, removeWithAudit } from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";
import { ExternalSystemFields } from "../types/externalSystem";

// ---------------------------------
// 1. Frontend State Management Types
// ---------------------------------

/**
 * Async state wrapper for handling loading, error, and data states
 * Used throughout the application for consistent state management
 */
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetch: string | null;
  stale: boolean;
}

/**
 * API call status for optimistic updates
 */
export interface ApiCallStatus {
  loading: boolean;
  error: string | null;
  optimisticData?: any;
}

/**
 * Client-side filtering options for UI responsiveness
 * Complex business filtering is handled by backend APIs
 */
export interface CostCenterFilters {
  searchQuery?: string;
  department?: string;
  region?: string;
  status?: string;
  showOverBudget?: boolean;
  showUnderUtilized?: boolean;
  ownerType?: 'user' | 'team';
  ownerId?: string;
  // External system filters
  sourceSystems?: string[];
  syncStatus?: ('synced' | 'syncing' | 'error' | 'conflict')[];
  hasConflicts?: boolean;
  hasLocalChanges?: boolean;
  dataCompleteness?: { min: number; max: number };
}

/**
 * UI-specific sort options
 */
export interface CostCenterSort {
  field: 'name' | 'code' | 'annual_budget' | 'spent_ytd' | 'variance' | 'created_at' | 'updated_at';
  direction: 'asc' | 'desc';
}

// ---------------------------------
// 2. Core Entity Types (Simplified for Frontend)
// ---------------------------------

/**
 * Simplified budget allocation for UI display
 * Complex business logic handled by backend
 */
export interface BudgetAllocation {
  category: string;
  allocated_amount: number;
  spent_amount?: number;
  variance_amount?: number;
  variance_percentage?: number;
}

/**
 * Simplified cost center approval for UI
 */
export interface CostCenterApproval {
  user_id: string;
  role: string;
  spending_limit?: number;
  permissions?: string[];
}

/**
 * Cost Center entity optimized for frontend state management
 * Removes complex business logic calculations - those come from backend
 */
export interface CostCenter extends ExternalSystemFields {
  id: string;
  code: string;
  name: string;
  description?: string;
  department?: string;
  region?: string;
  created_at: string;
  updated_at: string;

  // Relationships (IDs only - populated by backend joins)
  business_service_ids: string[];
  asset_ids: string[];
  contract_ids: string[];
  value_stream_ids: string[];
  vendor_ids: string[];
  owner_user_id?: string | null;
  owner_team_id?: string | null;

  // Financial data (calculated by backend)
  annual_budget: number;
  currency: string;
  spent_ytd?: number;
  forecast_spend?: number;
  variance?: number;
  variance_percentage?: number;
  
  // Backend-calculated metrics
  burn_rate?: number;
  runway_months?: number;
  utilization_rate?: number;
  efficiency_score?: number;
  
  // Configuration from backend
  budget_allocations: BudgetAllocation[];
  approvals: CostCenterApproval[];
  
  // Compliance & Governance (backend managed)
  risk_score?: number;
  compliance_requirement_ids: string[];
  audit_frequency?: string;
  last_audit_date?: string;
  next_audit_date?: string;
  
  // UI Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  tenantId?: string;
  // Note: synced_at and sync_status are now provided by ExternalSystemFields
}

// ---------------------------------
// 3. Frontend Context Interface
// ---------------------------------
interface CostCentersContextType {
  // Async state management
  costCenters: AsyncState<CostCenter[]>;
  apiCalls: {
    creating: ApiCallStatus;
    updating: ApiCallStatus;
    deleting: ApiCallStatus;
    bulkOperations: ApiCallStatus;
  };

  // CRUD operations (thin API wrappers)
  createCostCenter: (costCenter: Omit<CostCenter, 'id' | 'created_at' | 'updated_at' | 'tenantId'>, userId?: string) => Promise<void>;
  updateCostCenter: (costCenter: CostCenter, userId?: string) => Promise<void>;
  deleteCostCenter: (id: string, userId?: string) => Promise<void>;
  refreshCostCenters: () => Promise<void>;
  getCostCenter: (id: string) => Promise<CostCenter | undefined>;

  // API orchestration methods (business logic in backend)
  recordExpense: (costCenterId: string, expenseData: any, userId?: string) => Promise<void>;
  updateBudgetAllocations: (costCenterId: string, allocations: BudgetAllocation[], userId?: string) => Promise<void>;
  manageCostCenterApprovals: (costCenterId: string, approvalChanges: any, userId?: string) => Promise<void>;
  requestBudgetAnalysis: (costCenterId: string) => Promise<void>;
  runBudgetForecast: (costCenterId: string, params: any) => Promise<void>;

  // Client-side helpers for UI responsiveness
  getFilteredCostCenters: (filters: CostCenterFilters) => CostCenter[];
  getSortedCostCenters: (sort: CostCenterSort) => CostCenter[];
  searchCostCenters: (query: string) => CostCenter[];
  
  // Simple client-side aggregations for immediate UI feedback
  getBasicStats: () => {
    total: number;
    overBudgetCount: number;
    avgBudget: number;
    totalBudget: number;
    totalSpent: number;
  };

  // UI configuration from backend
  config: {
    departments: string[];
    regions: string[];
    currencies: string[];
    budget_categories: string[];
    approval_roles: string[];
    risk_thresholds: Record<string, number>;
  };

  // Cache management
  invalidateCache: () => void;
  getLastRefresh: () => string | null;
  isStale: () => boolean;
}

const CostCentersContext = createContext<CostCentersContextType | undefined>(undefined);

// ---------------------------------
// 4. Frontend Provider Implementation
// ---------------------------------
export const CostCentersProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();

  // Async state management
  const [costCentersState, setCostCentersState] = useState<AsyncState<CostCenter[]>>({
    data: null,
    loading: false,
    error: null,
    lastFetch: null,
    stale: false
  });

  // API call states for optimistic UI
  const [apiCalls, setApiCalls] = useState({
    creating: { loading: false, error: null },
    updating: { loading: false, error: null },
    deleting: { loading: false, error: null },
    bulkOperations: { loading: false, error: null }
  });

  // Extract cost center-specific config from global config
  const config = useMemo(() => ({
    departments: globalConfig?.business?.cost_centers?.departments || 
                 ['engineering', 'sales', 'marketing', 'operations', 'finance', 'hr', 'legal'],
    regions: globalConfig?.business?.cost_centers?.regions || 
             ['north_america', 'europe', 'asia_pacific', 'latin_america'],
    currencies: globalConfig?.business?.cost_centers?.currencies || 
                ['USD', 'EUR', 'GBP', 'JPY', 'CAD'],
    budget_categories: globalConfig?.business?.cost_centers?.budget_categories ||
                      ['personnel', 'infrastructure', 'software', 'marketing', 'travel', 'training'],
    approval_roles: globalConfig?.business?.cost_centers?.approval_roles ||
                   ['approver', 'reviewer', 'viewer'],
    risk_thresholds: globalConfig?.business?.cost_centers?.risk_thresholds || 
                    { low: 30, medium: 60, high: 80, critical: 95 }
  }), [globalConfig]);

  // Cache management
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  
  const isStale = useCallback(() => {
    if (!costCentersState.lastFetch) return true;
    return Date.now() - new Date(costCentersState.lastFetch).getTime() > CACHE_TTL_MS;
  }, [costCentersState.lastFetch]);

  const getLastRefresh = useCallback(() => {
    return costCentersState.lastFetch;
  }, [costCentersState.lastFetch]);

  const invalidateCache = useCallback(() => {
    setCostCentersState(prev => ({ ...prev, stale: true }));
  }, []);

  // Set API call status helper
  const setApiCallStatus = useCallback((operation: keyof typeof apiCalls, status: Partial<ApiCallStatus>) => {
    setApiCalls(prev => ({
      ...prev,
      [operation]: { ...prev[operation], ...status }
    }));
  }, []);

  // Basic client-side validation (UI only)
  const validateCostCenterUI = useCallback((costCenter: Partial<CostCenter>) => {
    const errors: string[] = [];
    
    if (!costCenter.name?.trim()) {
      errors.push("Cost center name is required");
    }
    
    if (!costCenter.code?.trim()) {
      errors.push("Cost center code is required");
    }
    
    if (!costCenter.annual_budget || costCenter.annual_budget <= 0) {
      errors.push("Annual budget must be greater than 0");
    }
    
    if (costCenter.currency && !config.currencies.includes(costCenter.currency)) {
      errors.push(`Invalid currency. Valid options: ${config.currencies.join(', ')}`);
    }
    
    return errors;
  }, [config]);

  // ---------------------------------
  // 5. Data Fetching & State Management
  // ---------------------------------
  
  const refreshCostCenters = useCallback(async () => {
    if (!tenantId) return;
    
    setCostCentersState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const costCenters = await getAll<CostCenter>(tenantId, "cost_centers");
      
      // Simple UI-focused sorting (not business logic)
      costCenters.sort((a, b) => {
        // Priority: health status, then budget size
        const healthOrder = { red: 5, orange: 4, yellow: 3, green: 2, gray: 1 };
        const aHealth = healthOrder[a.health_status] || 0;
        const bHealth = healthOrder[b.health_status] || 0;
        if (aHealth !== bHealth) return bHealth - aHealth;
        return (b.annual_budget || 0) - (a.annual_budget || 0);
      });
      
      setCostCentersState({
        data: costCenters,
        loading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        stale: false
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load cost centers';
      setCostCentersState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
      console.error("Failed to refresh cost centers:", error);
    }
  }, [tenantId]);

  const getCostCenter = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    
    // Check cache first for performance
    const cached = costCentersState.data?.find(cc => cc.id === id);
    if (cached && !isStale()) {
      return cached;
    }
    
    // Fallback to database
    return getById<CostCenter>(tenantId, "cost_centers", id);
  }, [tenantId, costCentersState.data, isStale]);

  // ---------------------------------
  // 6. CRUD Operations (API Orchestration)
  // ---------------------------------
  
  const createCostCenter = useCallback(async (
    costCenterData: Omit<CostCenter, 'id' | 'created_at' | 'updated_at' | 'tenantId'>, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    // UI validation only
    const validationErrors = validateCostCenterUI(costCenterData);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join('; '));
    }
    
    setApiCallStatus('creating', { loading: true, error: null });
    
    const now = new Date().toISOString();
    const newCostCenter: CostCenter = {
      id: crypto.randomUUID(),
      ...costCenterData,
      created_at: now,
      updated_at: now,
      tenantId,
      tags: costCenterData.tags || [],
      health_status: costCenterData.health_status || "gray",
      sync_status: "syncing",
      synced_at: now,
      business_service_ids: costCenterData.business_service_ids || [],
      asset_ids: costCenterData.asset_ids || [],
      contract_ids: costCenterData.contract_ids || [],
      value_stream_ids: costCenterData.value_stream_ids || [],
      vendor_ids: costCenterData.vendor_ids || [],
      compliance_requirement_ids: costCenterData.compliance_requirement_ids || [],
      budget_allocations: costCenterData.budget_allocations || [],
      approvals: costCenterData.approvals || [],
    };
    
    try {
      // Optimistic update
      setCostCentersState(prev => ({
        ...prev,
        data: prev.data ? [newCostCenter, ...prev.data] : [newCostCenter]
      }));
      
      setApiCallStatus('creating', { 
        loading: true, 
        optimisticData: newCostCenter 
      });
      
      // Save to local DB
      await putWithAudit(
        tenantId,
        "cost_centers",
        newCostCenter,
        userId,
        {
          action: "create",
          description: `Created cost center: ${newCostCenter.name}`,
          tags: ["cost_center", "create", newCostCenter.department || "unspecified"],
          metadata: {
            code: newCostCenter.code,
            annual_budget: newCostCenter.annual_budget,
            currency: newCostCenter.currency,
          },
        }
      );
      
      // Enqueue for sync to backend (where business logic will be applied)
      await enqueueItem({
        storeName: "cost_centers",
        entityId: newCostCenter.id,
        action: "create",
        payload: newCostCenter,
        priority: newCostCenter.annual_budget > 1000000 ? 'high' : 'normal',
      });
      
      setApiCallStatus('creating', { loading: false, error: null });
    } catch (error) {
      // Rollback optimistic update
      setCostCentersState(prev => ({
        ...prev,
        data: prev.data?.filter(cc => cc.id !== newCostCenter.id) || null
      }));
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to create cost center';
      setApiCallStatus('creating', { loading: false, error: errorMessage });
      throw error;
    }
  }, [tenantId, validateCostCenterUI, enqueueItem]);

  const updateCostCenter = useCallback(async (costCenter: CostCenter, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    const validationErrors = validateCostCenterUI(costCenter);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join('; '));
    }
    
    setApiCallStatus('updating', { loading: true, error: null });
    
    const updatedCostCenter = {
      ...costCenter,
      updated_at: new Date().toISOString(),
      sync_status: "syncing" as const,
    };
    
    // Store original for rollback
    const original = costCentersState.data?.find(cc => cc.id === costCenter.id);
    
    try {
      // Optimistic update
      setCostCentersState(prev => ({
        ...prev,
        data: prev.data?.map(cc => 
          cc.id === costCenter.id ? updatedCostCenter : cc
        ) || null
      }));
      
      setApiCallStatus('updating', { 
        loading: true, 
        optimisticData: updatedCostCenter 
      });
      
      await putWithAudit(
        tenantId,
        "cost_centers",
        updatedCostCenter,
        userId,
        {
          action: "update",
          description: `Updated cost center: ${costCenter.name}`,
          tags: ["cost_center", "update"],
          metadata: {
            annual_budget: costCenter.annual_budget,
            spent_ytd: costCenter.spent_ytd,
          },
        }
      );
      
      await enqueueItem({
        storeName: "cost_centers",
        entityId: costCenter.id,
        action: "update",
        payload: updatedCostCenter,
      });
      
      setApiCallStatus('updating', { loading: false, error: null });
    } catch (error) {
      // Rollback optimistic update
      if (original) {
        setCostCentersState(prev => ({
          ...prev,
          data: prev.data?.map(cc => 
            cc.id === costCenter.id ? original : cc
          ) || null
        }));
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to update cost center';
      setApiCallStatus('updating', { loading: false, error: errorMessage });
      throw error;
    }
  }, [tenantId, validateCostCenterUI, enqueueItem, costCentersState.data]);

  const deleteCostCenter = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    const costCenter = costCentersState.data?.find(cc => cc.id === id);
    if (!costCenter) throw new Error(`Cost center ${id} not found`);
    
    setApiCallStatus('deleting', { loading: true, error: null });
    
    try {
      // Optimistic update
      setCostCentersState(prev => ({
        ...prev,
        data: prev.data?.filter(cc => cc.id !== id) || null
      }));
      
      await removeWithAudit(
        tenantId,
        "cost_centers",
        id,
        userId,
        {
          action: "delete",
          description: `Deleted cost center: ${costCenter.name}`,
          tags: ["cost_center", "delete"],
          metadata: {
            code: costCenter.code,
            annual_budget: costCenter.annual_budget,
          },
        }
      );
      
      await enqueueItem({
        storeName: "cost_centers",
        entityId: id,
        action: "delete",
        payload: null,
      });
      
      setApiCallStatus('deleting', { loading: false, error: null });
    } catch (error) {
      // Rollback optimistic update
      setCostCentersState(prev => ({
        ...prev,
        data: prev.data ? [...prev.data, costCenter] : [costCenter]
      }));
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete cost center';
      setApiCallStatus('deleting', { loading: false, error: errorMessage });
      throw error;
    }
  }, [tenantId, costCentersState.data, enqueueItem]);

  // ---------------------------------
  // 7. Business Operations (API Orchestration - Business Logic in Backend)
  // ---------------------------------
  
  const recordExpense = useCallback(async (
    costCenterId: string, 
    expenseData: {
      amount: number;
      category: string;
      description?: string;
      date?: string;
      vendor_id?: string;
      receipt_url?: string;
    }, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    // Frontend only validates basic structure
    if (!expenseData.amount || expenseData.amount <= 0) {
      throw new Error("Expense amount must be greater than 0");
    }
    
    if (!expenseData.category?.trim()) {
      throw new Error("Expense category is required");
    }
    
    try {
      // Call backend API endpoint for business logic
      const response = await fetch(`/api/cost-centers/${costCenterId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...expenseData,
          recorded_by: userId,
          tenantId: tenantId,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to record expense: ${response.statusText}`);
      }
      
      // Backend returns updated cost center with recalculated metrics
      const updatedCostCenter = await response.json();
      
      // Update local state
      setCostCentersState(prev => ({
        ...prev,
        data: prev.data?.map(cc => 
          cc.id === costCenterId ? { ...cc, ...updatedCostCenter } : cc
        ) || null,
        stale: false // Fresh data from backend
      }));
      
    } catch (error) {
      console.error('Failed to record expense:', error);
      throw error;
    }
  }, [tenantId]);

  const updateBudgetAllocations = useCallback(async (
    costCenterId: string, 
    allocations: BudgetAllocation[], 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    try {
      // Call backend API - business validation and calculations done there
      const response = await fetch(`/api/cost-centers/${costCenterId}/budget-allocations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocations,
          updated_by: userId,
          tenantId: tenantId,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update budget allocations: ${response.statusText}`);
      }
      
      const updatedCostCenter = await response.json();
      
      setCostCentersState(prev => ({
        ...prev,
        data: prev.data?.map(cc => 
          cc.id === costCenterId ? { ...cc, ...updatedCostCenter } : cc
        ) || null
      }));
      
    } catch (error) {
      console.error('Failed to update budget allocations:', error);
      throw error;
    }
  }, [tenantId]);

  const manageCostCenterApprovals = useCallback(async (
    costCenterId: string, 
    approvalChanges: {
      add?: CostCenterApproval[];
      remove?: string[];
      update?: { user_id: string; changes: Partial<CostCenterApproval> }[];
    }, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    try {
      const response = await fetch(`/api/cost-centers/${costCenterId}/approvals`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: approvalChanges,
          updated_by: userId,
          tenantId: tenantId,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to manage approvals: ${response.statusText}`);
      }
      
      const updatedCostCenter = await response.json();
      
      setCostCentersState(prev => ({
        ...prev,
        data: prev.data?.map(cc => 
          cc.id === costCenterId ? { ...cc, ...updatedCostCenter } : cc
        ) || null
      }));
      
    } catch (error) {
      console.error('Failed to manage cost center approvals:', error);
      throw error;
    }
  }, [tenantId]);

  const requestBudgetAnalysis = useCallback(async (costCenterId: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    try {
      // Trigger backend analysis
      await fetch(`/api/cost-centers/${costCenterId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      
      // Analysis results will be returned via separate API or notification
    } catch (error) {
      console.error('Failed to request budget analysis:', error);
      throw error;
    }
  }, [tenantId]);

  const runBudgetForecast = useCallback(async (
    costCenterId: string, 
    params: {
      months_ahead?: number;
      scenario?: 'conservative' | 'optimistic' | 'pessimistic';
      include_seasonality?: boolean;
    }
  ) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    try {
      const response = await fetch(`/api/cost-centers/${costCenterId}/forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          tenantId: tenantId,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to run forecast: ${response.statusText}`);
      }
      
      const forecastData = await response.json();
      
      // Update local state with forecast results
      setCostCentersState(prev => ({
        ...prev,
        data: prev.data?.map(cc => 
          cc.id === costCenterId 
            ? { ...cc, forecast_data: forecastData, forecast_updated_at: new Date().toISOString() }
            : cc
        ) || null
      }));
      
    } catch (error) {
      console.error('Failed to run budget forecast:', error);
      throw error;
    }
  }, [tenantId]);

  // ---------------------------------
  // 8. Client-Side Helpers for UI Responsiveness
  // ---------------------------------
  
  const getFilteredCostCenters = useCallback((filters: CostCenterFilters): CostCenter[] => {
    if (!costCentersState.data) return [];
    
    return costCentersState.data.filter(cc => {
      // Text search
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const searchText = `${cc.name} ${cc.code} ${cc.description || ''} ${cc.tags.join(' ')}`.toLowerCase();
        if (!searchText.includes(query)) return false;
      }
      
      // Department filter
      if (filters.department && cc.department !== filters.department) return false;
      
      // Region filter
      if (filters.region && cc.region !== filters.region) return false;
      
      // Over budget filter
      if (filters.showOverBudget && (!cc.variance || cc.variance >= 0)) return false;
      
      // Under utilized filter (simple client check)
      if (filters.showUnderUtilized && (!cc.utilization_rate || cc.utilization_rate >= 70)) return false;
      
      // Owner filter
      if (filters.ownerId && filters.ownerType) {
        const ownerField = filters.ownerType === 'user' ? 'owner_user_id' : 'owner_team_id';
        if (cc[ownerField] !== filters.ownerId) return false;
      }
      
      return true;
    });
  }, [costCentersState.data]);

  const getSortedCostCenters = useCallback((sort: CostCenterSort): CostCenter[] => {
    if (!costCentersState.data) return [];
    
    const sorted = [...costCentersState.data].sort((a, b) => {
      let aVal: any = a[sort.field];
      let bVal: any = b[sort.field];
      
      // Handle undefined/null values
      if (aVal == null) aVal = sort.direction === 'asc' ? -Infinity : Infinity;
      if (bVal == null) bVal = sort.direction === 'asc' ? -Infinity : Infinity;
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sort.direction === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      return 0;
    });
    
    return sorted;
  }, [costCentersState.data]);

  const searchCostCenters = useCallback((query: string): CostCenter[] => {
    return getFilteredCostCenters({ searchQuery: query });
  }, [getFilteredCostCenters]);

  // Simple client-side stats for immediate UI feedback
  const getBasicStats = useCallback(() => {
    if (!costCentersState.data) {
      return { total: 0, overBudgetCount: 0, avgBudget: 0, totalBudget: 0, totalSpent: 0 };
    }
    
    const data = costCentersState.data;
    const total = data.length;
    const overBudgetCount = data.filter(cc => cc.variance !== undefined && cc.variance < 0).length;
    const totalBudget = data.reduce((sum, cc) => sum + cc.annual_budget, 0);
    const totalSpent = data.reduce((sum, cc) => sum + (cc.spent_ytd || 0), 0);
    const avgBudget = total > 0 ? totalBudget / total : 0;
    
    return { total, overBudgetCount, avgBudget, totalBudget, totalSpent };
  }, [costCentersState.data]);

  // Initialize when tenant changes
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshCostCenters();
    } else {
      setCostCentersState({
        data: null,
        loading: false,
        error: null,
        lastFetch: null,
        stale: false
      });
    }
  }, [tenantId, globalConfig, refreshCostCenters]);

  // Auto-refresh stale data
  useEffect(() => {
    if (costCentersState.stale && !costCentersState.loading) {
      refreshCostCenters();
    }
  }, [costCentersState.stale, costCentersState.loading, refreshCostCenters]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear any pending optimistic updates
      setApiCalls({
        creating: { loading: false, error: null },
        updating: { loading: false, error: null },
        deleting: { loading: false, error: null },
        bulkOperations: { loading: false, error: null }
      });
    };
  }, []);

  const contextValue: CostCentersContextType = {
    costCenters: costCentersState,
    apiCalls,
    createCostCenter,
    updateCostCenter,
    deleteCostCenter,
    refreshCostCenters,
    getCostCenter,
    recordExpense,
    updateBudgetAllocations,
    manageCostCenterApprovals,
    requestBudgetAnalysis,
    runBudgetForecast,
    getFilteredCostCenters,
    getSortedCostCenters,
    searchCostCenters,
    getBasicStats,
    config,
    invalidateCache,
    getLastRefresh,
    isStale,
  };

  return (
    <CostCentersContext.Provider value={contextValue}>
      {children}
    </CostCentersContext.Provider>
  );
};

// ---------------------------------
// 9. Hooks
// ---------------------------------

export const useCostCenters = () => {
  const ctx = useContext(CostCentersContext);
  if (!ctx) throw new Error("useCostCenters must be used within CostCentersProvider");
  return ctx;
};

export const useCostCenterDetails = (id: string) => {
  const { costCenters } = useCostCenters();
  return useMemo(() => {
    return costCenters.data?.find((cc) => cc.id === id) || null;
  }, [costCenters.data, id]);
};

// Selective subscription hooks for performance
export const useCostCentersByStatus = (healthStatus: string) => {
  const { costCenters } = useCostCenters();
  return useMemo(() => {
    return costCenters.data?.filter(cc => cc.health_status === healthStatus) || [];
  }, [costCenters.data, healthStatus]);
};

export const useCostCenterStats = () => {
  const { getBasicStats } = useCostCenters();
  return useMemo(() => getBasicStats(), [getBasicStats]);
};

export const useCostCenterFilters = (initialFilters: CostCenterFilters = {}) => {
  const { getFilteredCostCenters } = useCostCenters();
  const [filters, setFilters] = useState<CostCenterFilters>(initialFilters);
  
  const filteredCostCenters = useMemo(() => {
    return getFilteredCostCenters(filters);
  }, [getFilteredCostCenters, filters]);
  
  return { filters, setFilters, filteredCostCenters };
};

export const useCostCenterSort = (initialSort: CostCenterSort = { field: 'name', direction: 'asc' }) => {
  const { getSortedCostCenters } = useCostCenters();
  const [sort, setSort] = useState<CostCenterSort>(initialSort);
  
  const sortedCostCenters = useMemo(() => {
    return getSortedCostCenters(sort);
  }, [getSortedCostCenters, sort]);
  
  return { sort, setSort, sortedCostCenters };
};