// src/contexts/RisksContext.tsx
import React, { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  ReactNode, 
  useCallback,
  useMemo 
} from "react";
import { AsyncState, AsyncStateHelpers } from "../types/asyncState";
import { getAll, getById } from "../db/dbClient";
import { putWithAudit, removeWithAudit } from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";
import { ExternalSystemFields } from "../types/externalSystem";

// ---------------------------------
// 1. Types & Interfaces
// ---------------------------------
export type RiskCategory =
  | "security"
  | "compliance"
  | "availability"
  | "performance"
  | "vendor"
  | "financial"
  | "other";

export type RiskStatus =
  | "identified"
  | "assessed"
  | "mitigation_planned"
  | "mitigated"
  | "accepted"
  | "rejected"
  | "closed";

export type RiskSeverity = "low" | "medium" | "high" | "critical";
export type RiskLikelihood = "rare" | "unlikely" | "possible" | "likely" | "almost_certain";
export type RiskImpact = "low" | "medium" | "high" | "critical";

export interface Risk extends ExternalSystemFields {
  id: string;
  title: string;
  description?: string;
  category: RiskCategory;
  status: RiskStatus;
  severity: RiskSeverity;
  likelihood: RiskLikelihood;
  impact: RiskImpact;
  score?: number;
  created_at: string;
  updated_at: string;

  // Relationships
  business_service_ids: string[];
  asset_ids: string[];
  vendor_ids: string[];
  compliance_requirement_ids: string[];
  owner_user_id?: string | null;
  owner_team_id?: string | null;

  // Mitigation
  mitigation_plan?: string;
  mitigation_deadline?: string | null;
  residual_risk?: string;
  accepted_by_user_id?: string | null;
  accepted_at?: string | null;

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  tenantId?: string;
}

// Frontend-specific types for UI state management


export interface RiskFilters {
  category?: RiskCategory;
  status?: RiskStatus;
  severity?: RiskSeverity;
  owner_user_id?: string;
  owner_team_id?: string;
  business_service_ids?: string[];
  search?: string;
  
  // External system filtering
  source_system?: string;
  sync_status?: 'synced' | 'syncing' | 'error' | 'conflict';
  has_local_changes?: boolean;
}

export interface RiskSort {
  field: keyof Risk;
  direction: "asc" | "desc";
}

export interface OptimisticUpdate<T> {
  id: string;
  type: "add" | "update" | "delete";
  data: T;
  timestamp: number;
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------
interface RisksContextType {
  // Core async state
  risks: AsyncState<Risk[]>;
  
  // CRUD operations (API orchestration only)
  addRisk: (risk: Risk, userId?: string) => Promise<void>;
  updateRisk: (risk: Risk, userId?: string) => Promise<void>;
  deleteRisk: (id: string, userId?: string) => Promise<void>;
  refreshRisks: () => Promise<void>;
  getRisk: (id: string) => Promise<Risk | undefined>;

  // UI-focused helpers (client-side only)
  getFilteredRisks: (filters: RiskFilters) => Risk[];
  getSortedRisks: (risks: Risk[], sort: RiskSort) => Risk[];
  searchRisks: (query: string) => Risk[];
  
  // UI convenience getters
  getRisksByStatus: (status: RiskStatus) => Risk[];
  getRisksByCategory: (category: RiskCategory) => Risk[];
  getRisksBySeverity: (severity: RiskSeverity) => Risk[];
  getHighPriorityRisks: () => Risk[];
  getOverdueRisks: () => Risk[];
  
  // Cache and performance
  invalidateCache: () => void;
  isStale: boolean;
  lastUpdated: string | null;
  
  // Configuration from backend
  config: {
    categories: string[];
    statuses: string[];
    severities: string[];
    likelihoods: string[];
    impacts: string[];
  };
}

const RisksContext = createContext<RisksContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider Implementation
// ---------------------------------
export const RisksProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig, validateEnum } = useConfig();

  // Core async state
  const [risks, setRisks] = useState<AsyncState<Risk[]>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    stale: true,
  });

  // Optimistic updates state
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdate<Risk>[]>([]);

  // Configuration (from backend)
  const config = useMemo(() => ({
    categories: globalConfig?.risk_categories || [
      'security', 'compliance', 'availability', 'performance', 'vendor', 'financial', 'other'
    ],
    statuses: globalConfig?.risk_statuses || [
      'identified', 'assessed', 'mitigation_planned', 'mitigated', 'accepted', 'rejected', 'closed'
    ],
    severities: globalConfig?.severities ? Object.keys(globalConfig.severities) : [
      'low', 'medium', 'high', 'critical'
    ],
    likelihoods: globalConfig?.risk_likelihoods || [
      'rare', 'unlikely', 'possible', 'likely', 'almost_certain'
    ],
    impacts: globalConfig?.risk_impacts || [
      'low', 'medium', 'high', 'critical'
    ],
  }), [globalConfig]);

  // Cache TTL (5 minutes)
  const CACHE_TTL_MS = 5 * 60 * 1000;

  // Check if cache is stale
  const isStale = useMemo(() => {
    if (!risks.lastFetch) return true;
    return Date.now() - new Date(risks.lastFetch).getTime() > CACHE_TTL_MS;
  }, [risks.lastFetch]);

  // Helper to update async state
  const updateAsyncState = useCallback((updates: Partial<AsyncState<Risk[]>>) => {
    setRisks(prev => ({ ...prev, ...updates }));
  }, []);

  // Helper to show optimistic update
  const showOptimisticUpdate = useCallback((update: OptimisticUpdate<Risk>) => {
    setOptimisticUpdates(prev => [...prev, update]);
    
    // Apply optimistic update to UI
    setRisks(prev => {
      let updatedData = [...prev.data];
      
      switch (update.type) {
        case "add":
          updatedData.unshift(update.data);
          break;
        case "update":
          updatedData = updatedData.map(risk => 
            risk.id === update.data.id ? update.data : risk
          );
          break;
        case "delete":
          updatedData = updatedData.filter(risk => risk.id !== update.data.id);
          break;
      }
      
      return { ...prev, data: updatedData };
    });
  }, []);

  // Helper to rollback optimistic update
  const rollbackOptimisticUpdate = useCallback((updateId: string) => {
    setOptimisticUpdates(prev => prev.filter(u => u.id !== updateId));
    // Refresh to get accurate state
    refreshRisks();
  }, []);

  // API orchestration - fetch all risks
  const refreshRisks = useCallback(async () => {
    if (!tenantId) return;
    
    updateAsyncState({ loading: true, error: null });
    
    try {
      const all = await getAll<Risk>(tenantId, "risks");
      
      // Sort by business priority (critical severity + high likelihood first)
      const sorted = all.sort((a, b) => {
        const aSeverityWeight = getSeverityWeight(a.severity);
        const bSeverityWeight = getSeverityWeight(b.severity);
        const aLikelihoodWeight = getLikelihoodWeight(a.likelihood);
        const bLikelihoodWeight = getLikelihoodWeight(b.likelihood);
        
        const aScore = aSeverityWeight * aLikelihoodWeight;
        const bScore = bSeverityWeight * bLikelihoodWeight;
        
        if (aScore !== bScore) return bScore - aScore; // Higher scores first
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
      
      updateAsyncState({
        data: sorted,
        loading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        stale: false
      });
      
      // Clear any optimistic updates on successful refresh
      setOptimisticUpdates([]);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load risks';
      updateAsyncState({ 
        loading: false, 
        error: errorMessage,
        stale: true 
      });
    }
  }, [tenantId, updateAsyncState]);

  // API orchestration - get single risk
  const getRisk = useCallback(async (id: string): Promise<Risk | undefined> => {
    if (!tenantId) return undefined;
    
    // Check cache first
    const cached = risks.data.find(r => r.id === id);
    if (cached && !isStale) return cached;
    
    try {
      return await getById<Risk>(tenantId, "risks", id);
    } catch (error) {
      console.error('Failed to get risk:', error);
      return undefined;
    }
  }, [tenantId, risks.data, isStale]);

  // API orchestration - add risk
  const addRisk = useCallback(async (risk: Risk, userId?: string) => {
    if (!globalConfig) {
      throw new Error("Configuration not loaded");
    }

    // Basic UI validation only - backend handles business rules
    if (!risk.title?.trim()) {
      throw new Error("Risk title is required");
    }

    // Validate against config (UI-level validation)
    if (!validateEnum('risk_categories', risk.category)) {
      throw new Error(`Invalid risk category: ${risk.category}`);
    }
    
    if (!validateEnum('risk_statuses', risk.status)) {
      throw new Error(`Invalid risk status: ${risk.status}`);
    }

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticUpdate: OptimisticUpdate<Risk> = {
      id: optimisticId,
      type: "add",
      data: { ...risk, id: optimisticId },
      timestamp: Date.now()
    };

    // Show optimistic update
    showOptimisticUpdate(optimisticUpdate);

    try {
      // Backend handles all business logic, validation, scoring, etc.
      await putWithAudit(
        tenantId,
        "risks",
        risk,
        userId,
        { action: "create", description: `Risk "${risk.title}" created` },
        enqueueItem
      );
      
      // Refresh to get accurate data from backend
      await refreshRisks();
      
    } catch (error) {
      rollbackOptimisticUpdate(optimisticId);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create risk';
      updateAsyncState({ error: errorMessage });
      throw error;
    }
  }, [tenantId, globalConfig, validateEnum, showOptimisticUpdate, rollbackOptimisticUpdate, refreshRisks, updateAsyncState, enqueueItem]);

  // API orchestration - update risk
  const updateRisk = useCallback(async (risk: Risk, userId?: string) => {
    if (!globalConfig) {
      throw new Error("Configuration not loaded");
    }

    // Basic UI validation only
    if (!risk.title?.trim()) {
      throw new Error("Risk title is required");
    }

    if (!validateEnum('risk_categories', risk.category)) {
      throw new Error(`Invalid risk category: ${risk.category}`);
    }
    
    if (!validateEnum('risk_statuses', risk.status)) {
      throw new Error(`Invalid risk status: ${risk.status}`);
    }

    const optimisticId = `optimistic-update-${Date.now()}`;
    const optimisticUpdate: OptimisticUpdate<Risk> = {
      id: optimisticId,
      type: "update",
      data: risk,
      timestamp: Date.now()
    };

    showOptimisticUpdate(optimisticUpdate);

    try {
      // Backend handles validation, business rules, score calculations
      await putWithAudit(
        tenantId,
        "risks",
        risk,
        userId,
        { action: "update", description: `Risk "${risk.title}" updated` },
        enqueueItem
      );
      
      await refreshRisks();
      
    } catch (error) {
      rollbackOptimisticUpdate(optimisticId);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update risk';
      updateAsyncState({ error: errorMessage });
      throw error;
    }
  }, [tenantId, globalConfig, validateEnum, showOptimisticUpdate, rollbackOptimisticUpdate, refreshRisks, updateAsyncState, enqueueItem]);

  // API orchestration - delete risk
  const deleteRisk = useCallback(async (id: string, userId?: string) => {
    const riskToDelete = risks.data.find(r => r.id === id);
    if (!riskToDelete) return;

    const optimisticId = `optimistic-delete-${Date.now()}`;
    const optimisticUpdate: OptimisticUpdate<Risk> = {
      id: optimisticId,
      type: "delete",
      data: riskToDelete,
      timestamp: Date.now()
    };

    showOptimisticUpdate(optimisticUpdate);

    try {
      // Backend handles business rules for deletion
      await removeWithAudit(
        tenantId,
        "risks",
        id,
        userId,
        { description: `Risk ${id} deleted` },
        enqueueItem
      );
      
      await refreshRisks();
      
    } catch (error) {
      rollbackOptimisticUpdate(optimisticId);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete risk';
      updateAsyncState({ error: errorMessage });
      throw error;
    }
  }, [tenantId, risks.data, showOptimisticUpdate, rollbackOptimisticUpdate, refreshRisks, updateAsyncState, enqueueItem]);

  // UI Helper - client-side filtering (for immediate UI responsiveness)
  const getFilteredRisks = useCallback((filters: RiskFilters): Risk[] => {
    return risks.data.filter(risk => {
      if (filters.category && risk.category !== filters.category) return false;
      if (filters.status && risk.status !== filters.status) return false;
      if (filters.severity && risk.severity !== filters.severity) return false;
      if (filters.owner_user_id && risk.owner_user_id !== filters.owner_user_id) return false;
      if (filters.owner_team_id && risk.owner_team_id !== filters.owner_team_id) return false;
      if (filters.business_service_ids?.length && 
          !filters.business_service_ids.some(id => risk.business_service_ids.includes(id))) return false;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (!risk.title.toLowerCase().includes(searchLower) &&
            !risk.description?.toLowerCase().includes(searchLower) &&
            !risk.tags.some(tag => tag.toLowerCase().includes(searchLower))) return false;
      }
      return true;
    });
  }, [risks.data]);

  // UI Helper - client-side sorting
  const getSortedRisks = useCallback((risksToSort: Risk[], sort: RiskSort): Risk[] => {
    return [...risksToSort].sort((a, b) => {
      const aVal = a[sort.field];
      const bVal = b[sort.field];
      
      if (aVal === bVal) return 0;
      
      const comparison = aVal < bVal ? -1 : 1;
      return sort.direction === "asc" ? comparison : -comparison;
    });
  }, []);

  // UI Helper - simple search for immediate UI feedback
  const searchRisks = useCallback((query: string): Risk[] => {
    if (!query.trim()) return risks.data;
    
    const searchLower = query.toLowerCase();
    return risks.data.filter(risk => 
      risk.title.toLowerCase().includes(searchLower) ||
      risk.description?.toLowerCase().includes(searchLower) ||
      risk.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
      risk.category.toLowerCase().includes(searchLower)
    );
  }, [risks.data]);

  // UI Convenience getters (memoized for performance)
  const getRisksByStatus = useCallback((status: RiskStatus) => 
    risks.data.filter(risk => risk.status === status), [risks.data]);

  const getRisksByCategory = useCallback((category: RiskCategory) => 
    risks.data.filter(risk => risk.category === category), [risks.data]);

  const getRisksBySeverity = useCallback((severity: RiskSeverity) => 
    risks.data.filter(risk => risk.severity === severity), [risks.data]);

  const getHighPriorityRisks = useCallback(() => 
    risks.data.filter(risk => 
      (risk.severity === "high" || risk.severity === "critical") &&
      (risk.likelihood === "likely" || risk.likelihood === "almost_certain")
    ), [risks.data]);

  const getOverdueRisks = useCallback(() => {
    const now = new Date();
    return risks.data.filter(risk => 
      risk.mitigation_deadline && 
      new Date(risk.mitigation_deadline) < now &&
      !["mitigated", "accepted", "rejected", "closed"].includes(risk.status)
    );
  }, [risks.data]);

  // Cache management
  const invalidateCache = useCallback(() => {
    updateAsyncState({ stale: true });
  }, [updateAsyncState]);

  // Auto-refresh on tenant change
  useEffect(() => {
    if (tenantId) {
      refreshRisks();
    } else {
      // Reset state when no tenant
      setRisks({
        data: [],
        loading: false,
        error: null,
        lastFetch: null,
        stale: true,
      });
    }
  }, [tenantId, refreshRisks]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setOptimisticUpdates([]);
    };
  }, []);

  // Context value (memoized to prevent unnecessary re-renders)
  const contextValue = useMemo(() => ({
    // Core state
    risks,
    
    // API operations
    addRisk,
    updateRisk,
    deleteRisk,
    refreshRisks,
    getRisk,
    
    // UI helpers
    getFilteredRisks,
    getSortedRisks,
    searchRisks,
    getRisksByStatus,
    getRisksByCategory,
    getRisksBySeverity,
    getHighPriorityRisks,
    getOverdueRisks,
    
    // Cache management
    invalidateCache,
    isStale,
    lastUpdated: risks.lastFetch,
    
    // Configuration
    config,
  }), [
    risks, addRisk, updateRisk, deleteRisk, refreshRisks, getRisk,
    getFilteredRisks, getSortedRisks, searchRisks, getRisksByStatus,
    getRisksByCategory, getRisksBySeverity, getHighPriorityRisks,
    getOverdueRisks, invalidateCache, isStale, config
  ]);

  return (
    <RisksContext.Provider value={contextValue}>
      {children}
    </RisksContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------
export const useRisks = () => {
  const ctx = useContext(RisksContext);
  if (!ctx) throw new Error("useRisks must be used within RisksProvider");
  return ctx;
};

// Selective subscription hook for individual risk details
export const useRiskDetails = (id: string) => {
  const { risks, getRisk } = useRisks();
  const [risk, setRisk] = useState<Risk | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRisk = async () => {
      // Check cache first
      const cached = risks.data.find(r => r.id === id);
      if (cached) {
        setRisk(cached);
        return;
      }

      // Fetch from API if not in cache
      setLoading(true);
      try {
        const fetched = await getRisk(id);
        setRisk(fetched || null);
      } finally {
        setLoading(false);
      }
    };

    fetchRisk();
  }, [id, risks.data, getRisk]);

  return { risk, loading };
};

// Performance hook for status-based filtering
export const useRisksByStatus = (status: RiskStatus) => {
  const { risks, getRisksByStatus } = useRisks();
  
  return useMemo(() => ({
    risks: getRisksByStatus(status),
    count: getRisksByStatus(status).length,
    loading: risks.loading,
    error: risks.error,
  }), [risks, getRisksByStatus, status]);
};

// ---------------------------------
// 5. Helper Functions (UI utilities only)
// ---------------------------------
function getSeverityWeight(severity: RiskSeverity): number {
  const weights = { low: 1, medium: 2, high: 3, critical: 4 };
  return weights[severity] || 1;
}

function getLikelihoodWeight(likelihood: RiskLikelihood): number {
  const weights = { 
    rare: 1, 
    unlikely: 2, 
    possible: 3, 
    likely: 4, 
    almost_certain: 5 
  };
  return weights[likelihood] || 1;
}