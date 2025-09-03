// src/contexts/ComplianceContext.tsx (FRONTEND UI STATE MANAGER)
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";
import { complianceApi } from "../api/complianceApi";

// ---------------------------------
// 1. UI-Focused Type Definitions
// ---------------------------------

/**
 * UI async state wrapper for data fetching operations
 */
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetch: string | null;
  stale: boolean;
}

/**
 * UI filter state for client-side display filtering
 */
export interface ComplianceUIFilters {
  framework?: string;
  type?: string;
  status?: string;
  complianceLevel?: string;
  search?: string;
  showOnlyNonCompliant?: boolean;
  showOnlyCritical?: boolean;
  ownerId?: string;
  ownerType?: 'user' | 'team';
}

/**
 * UI configuration from backend
 */
export interface ComplianceUIConfig {
  types: string[];
  statuses: string[];
  frameworks: string[];
  maturityLevels: string[];
  assessmentFrequencies: string[];
  complianceLevels: string[];
  defaultFilters: ComplianceUIFilters;
  cacheSettings: {
    ttlMinutes: number;
    maxItems: number;
  };
}

/**
 * Optimistic update state for UI responsiveness
 */
interface OptimisticUpdate {
  id: string;
  type: 'create' | 'update' | 'delete';
  timestamp: string;
  payload: any;
  rollback?: () => void;
}

/**
 * Simplified compliance requirement for UI display
 * Business logic handled by backend APIs
 */
export interface ComplianceRequirement {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  framework: string;
  complianceLevel: 'non_compliant' | 'partially_compliant' | 'substantially_compliant' | 'fully_compliant';
  complianceScore?: number;
  mandatory: boolean;
  
  // UI metadata
  healthStatus: 'green' | 'yellow' | 'orange' | 'red' | 'gray';
  lastUpdated: string;
  criticalGapsCount: number;
  evidenceCount: number;
  controlsCount: number;
  nextAssessmentDue?: string;
  
  // Basic relationships for UI navigation
  businessServiceIds: string[];
  ownerUserId?: string;
  ownerTeamId?: string;
  
  // UI-specific fields
  displayPriority: number;
  recentlyUpdated: boolean;
  hasUnresolvedGaps: boolean;
}

// ---------------------------------
// 2. Frontend Context Interface
// ---------------------------------
interface ComplianceContextType {
  // Async state management
  requirements: AsyncState<ComplianceRequirement[]>;
  selectedRequirement: AsyncState<ComplianceRequirement>;
  
  // UI state
  filters: ComplianceUIFilters;
  setFilters: (filters: Partial<ComplianceUIFilters>) => void;
  resetFilters: () => void;
  
  // API orchestration (business logic handled by backend)
  loadRequirements: (options?: { force?: boolean; filters?: ComplianceUIFilters }) => Promise<void>;
  loadRequirement: (id: string, options?: { force?: boolean }) => Promise<void>;
  createRequirement: (data: Partial<ComplianceRequirement>) => Promise<void>;
  updateRequirement: (id: string, data: Partial<ComplianceRequirement>) => Promise<void>;
  deleteRequirement: (id: string) => Promise<void>;
  
  // UI-specific operations (defer business logic to backend)
  updateComplianceScore: (id: string, score: number) => Promise<void>;
  scheduleAssessment: (id: string, date: string) => Promise<void>;
  
  // Client-side UI helpers (simple, non-business logic)
  getFilteredRequirements: () => ComplianceRequirement[];
  searchRequirements: (query: string) => ComplianceRequirement[];
  getRequirementsByStatus: (status: string) => ComplianceRequirement[];
  getCriticalRequirements: () => ComplianceRequirement[];
  
  // Cache management
  invalidateCache: (options?: { requirementId?: string; all?: boolean }) => void;
  refreshCache: () => Promise<void>;
  
  // Optimistic updates
  optimisticUpdates: OptimisticUpdate[];
  rollbackOptimisticUpdate: (id: string) => void;
  
  // UI configuration
  config: ComplianceUIConfig;
  
  // Performance helpers
  isStale: boolean;
  lastSyncAt: string | null;
}

const ComplianceContext = createContext<ComplianceContextType | undefined>(undefined);

// ---------------------------------
// 3. UI-Focused Provider
// ---------------------------------
export const ComplianceProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem, stats } = useSync();
  const { config: globalConfig } = useConfig();

  // UI State Management
  const [requirements, setRequirements] = useState<AsyncState<ComplianceRequirement[]>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    stale: true,
  });

  const [selectedRequirement, setSelectedRequirement] = useState<AsyncState<ComplianceRequirement>>({
    data: null,
    loading: false,
    error: null,
    lastFetch: null,
    stale: true,
  });

  const [filters, setFiltersState] = useState<ComplianceUIFilters>({});
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdate[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  // UI Configuration from backend
  const config = useMemo<ComplianceUIConfig>(() => ({
    types: globalConfig?.compliance?.types || 
           ['regulatory', 'industry_standard', 'internal_policy', 'contractual', 'certification'],
    statuses: globalConfig?.compliance?.statuses || 
              ['draft', 'active', 'under_review', 'deprecated', 'exception_granted'],
    frameworks: globalConfig?.compliance?.frameworks || 
                ['SOX', 'PCI-DSS', 'HIPAA', 'GDPR', 'ISO27001', 'NIST', 'SOC2', 'FedRAMP'],
    maturityLevels: ['basic', 'managed', 'defined', 'quantitatively_managed', 'optimizing'],
    assessmentFrequencies: ['monthly', 'quarterly', 'semi_annually', 'annually', 'on_demand'],
    complianceLevels: ['non_compliant', 'partially_compliant', 'substantially_compliant', 'fully_compliant'],
    defaultFilters: globalConfig?.compliance?.defaultFilters || {},
    cacheSettings: {
      ttlMinutes: globalConfig?.compliance?.cacheTtlMinutes || 15,
      maxItems: globalConfig?.compliance?.maxCachedItems || 1000,
    },
  }), [globalConfig]);

  // Cache staleness check
  const isStale = useMemo(() => {
    if (!requirements.lastFetch) return true;
    const lastFetchTime = new Date(requirements.lastFetch).getTime();
    const now = Date.now();
    const ttlMs = config.cacheSettings.ttlMinutes * 60 * 1000;
    return now - lastFetchTime > ttlMs;
  }, [requirements.lastFetch, config.cacheSettings.ttlMinutes]);

  // ---------------------------------
  // UI State Management Helpers
  // ---------------------------------
  const updateRequirementsState = useCallback((updater: (prev: AsyncState<ComplianceRequirement[]>) => AsyncState<ComplianceRequirement[]>) => {
    setRequirements(updater);
  }, []);

  const updateSelectedRequirementState = useCallback((updater: (prev: AsyncState<ComplianceRequirement>) => AsyncState<ComplianceRequirement>) => {
    setSelectedRequirement(updater);
  }, []);

  const addOptimisticUpdate = useCallback((update: OptimisticUpdate) => {
    setOptimisticUpdates(prev => [...prev, update]);
    // Auto-cleanup after 30 seconds
    setTimeout(() => {
      setOptimisticUpdates(prev => prev.filter(u => u.id !== update.id));
    }, 30000);
  }, []);

  const rollbackOptimisticUpdate = useCallback((updateId: string) => {
    const update = optimisticUpdates.find(u => u.id === updateId);
    if (update?.rollback) {
      update.rollback();
    }
    setOptimisticUpdates(prev => prev.filter(u => u.id !== updateId));
  }, [optimisticUpdates]);

  // ---------------------------------
  // API Orchestration (Backend handles business logic)
  // ---------------------------------
  const loadRequirements = useCallback(async (options?: { force?: boolean; filters?: ComplianceUIFilters }) => {
    if (!tenantId) return;
    
    // Skip if already loading or data is fresh (unless forced)
    if (requirements.loading || (!options?.force && !isStale && requirements.data?.length)) {
      return;
    }

    updateRequirementsState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Backend API handles all business logic, filtering, sorting, etc.
      const data = await complianceApi.getRequirements(tenantId, options?.filters);
      
      updateRequirementsState(prev => ({
        ...prev,
        data,
        loading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        stale: false,
      }));
      
      setLastSyncAt(new Date().toISOString());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load compliance requirements';
      updateRequirementsState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
        stale: true,
      }));
    }
  }, [tenantId, requirements.loading, isStale, requirements.data?.length, updateRequirementsState]);

  const loadRequirement = useCallback(async (id: string, options?: { force?: boolean }) => {
    if (!tenantId) return;
    
    // Check if already have fresh data for this requirement
    if (!options?.force && selectedRequirement.data?.id === id && !selectedRequirement.stale) {
      return;
    }

    updateSelectedRequirementState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const data = await complianceApi.getRequirement(tenantId, id);
      
      updateSelectedRequirementState(prev => ({
        ...prev,
        data,
        loading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        stale: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : `Failed to load requirement ${id}`;
      updateSelectedRequirementState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
        stale: true,
      }));
    }
  }, [tenantId, selectedRequirement.data?.id, selectedRequirement.stale, updateSelectedRequirementState]);

  const createRequirement = useCallback(async (data: Partial<ComplianceRequirement>) => {
    if (!tenantId) throw new Error("No tenant selected");

    const optimisticId = crypto.randomUUID();
    const tempRequirement: ComplianceRequirement = {
      id: optimisticId,
      name: data.name || 'New Requirement',
      type: data.type || config.types[0],
      status: data.status || config.statuses[0],
      framework: data.framework || config.frameworks[0],
      complianceLevel: data.complianceLevel || 'non_compliant',
      mandatory: data.mandatory || false,
      healthStatus: 'gray',
      lastUpdated: new Date().toISOString(),
      criticalGapsCount: 0,
      evidenceCount: 0,
      controlsCount: 0,
      businessServiceIds: [],
      displayPriority: 0,
      recentlyUpdated: true,
      hasUnresolvedGaps: false,
      ...data,
    };

    // Optimistic UI update
    const rollback = () => {
      updateRequirementsState(prev => ({
        ...prev,
        data: prev.data?.filter(r => r.id !== optimisticId) || [],
      }));
    };

    updateRequirementsState(prev => ({
      ...prev,
      data: [tempRequirement, ...(prev.data || [])],
    }));

    addOptimisticUpdate({
      id: optimisticId,
      type: 'create',
      timestamp: new Date().toISOString(),
      payload: data,
      rollback,
    });

    try {
      // Backend handles all validation and business logic
      const createdRequirement = await complianceApi.createRequirement(tenantId, data);
      
      // Replace optimistic update with real data
      updateRequirementsState(prev => ({
        ...prev,
        data: prev.data?.map(r => r.id === optimisticId ? createdRequirement : r) || [],
      }));

      // Queue for sync
      await enqueueItem({
        storeName: "compliance",
        entityId: createdRequirement.id,
        action: "create",
        payload: createdRequirement,
        priority: 'normal',
      });

      // Remove optimistic update
      setOptimisticUpdates(prev => prev.filter(u => u.id !== optimisticId));
      
    } catch (error) {
      rollback();
      throw error;
    }
  }, [tenantId, config, updateRequirementsState, addOptimisticUpdate, enqueueItem]);

  const updateRequirement = useCallback(async (id: string, data: Partial<ComplianceRequirement>) => {
    if (!tenantId) throw new Error("No tenant selected");

    const currentData = requirements.data?.find(r => r.id === id);
    if (!currentData) throw new Error(`Requirement ${id} not found in cache`);

    // Optimistic UI update
    const updatedRequirement = { ...currentData, ...data, lastUpdated: new Date().toISOString() };
    const rollback = () => {
      updateRequirementsState(prev => ({
        ...prev,
        data: prev.data?.map(r => r.id === id ? currentData : r) || [],
      }));
    };

    updateRequirementsState(prev => ({
      ...prev,
      data: prev.data?.map(r => r.id === id ? updatedRequirement : r) || [],
    }));

    const optimisticId = crypto.randomUUID();
    addOptimisticUpdate({
      id: optimisticId,
      type: 'update',
      timestamp: new Date().toISOString(),
      payload: data,
      rollback,
    });

    try {
      // Backend handles all validation and business logic
      const updated = await complianceApi.updateRequirement(tenantId, id, data);
      
      // Update with backend response
      updateRequirementsState(prev => ({
        ...prev,
        data: prev.data?.map(r => r.id === id ? updated : r) || [],
      }));

      // Queue for sync
      await enqueueItem({
        storeName: "compliance",
        entityId: id,
        action: "update",
        payload: updated,
      });

      // Remove optimistic update
      setOptimisticUpdates(prev => prev.filter(u => u.id !== optimisticId));
      
    } catch (error) {
      rollback();
      throw error;
    }
  }, [tenantId, requirements.data, updateRequirementsState, addOptimisticUpdate, enqueueItem]);

  const deleteRequirement = useCallback(async (id: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    const currentData = requirements.data?.find(r => r.id === id);
    if (!currentData) throw new Error(`Requirement ${id} not found`);

    // Optimistic UI update
    const rollback = () => {
      updateRequirementsState(prev => ({
        ...prev,
        data: [currentData, ...(prev.data || [])],
      }));
    };

    updateRequirementsState(prev => ({
      ...prev,
      data: prev.data?.filter(r => r.id !== id) || [],
    }));

    const optimisticId = crypto.randomUUID();
    addOptimisticUpdate({
      id: optimisticId,
      type: 'delete',
      timestamp: new Date().toISOString(),
      payload: { id },
      rollback,
    });

    try {
      // Backend handles all business logic and cascade deletes
      await complianceApi.deleteRequirement(tenantId, id);

      // Queue for sync
      await enqueueItem({
        storeName: "compliance",
        entityId: id,
        action: "delete",
        payload: null,
      });

      // Remove optimistic update
      setOptimisticUpdates(prev => prev.filter(u => u.id !== optimisticId));
      
    } catch (error) {
      rollback();
      throw error;
    }
  }, [tenantId, requirements.data, updateRequirementsState, addOptimisticUpdate, enqueueItem]);

  // ---------------------------------
  // Simple UI Operations (Defer complex logic to backend)
  // ---------------------------------
  const updateComplianceScore = useCallback(async (id: string, score: number) => {
    // Backend determines compliance level based on score
    await updateRequirement(id, { complianceScore: score });
  }, [updateRequirement]);

  const scheduleAssessment = useCallback(async (id: string, date: string) => {
    // Backend handles assessment scheduling logic
    await complianceApi.scheduleAssessment(tenantId!, id, date);
    
    // Refresh data to get updated assessment info
    await loadRequirement(id, { force: true });
  }, [tenantId, loadRequirement]);

  // ---------------------------------
  // Client-Side UI Helpers (Simple, no business logic)
  // ---------------------------------
  const getFilteredRequirements = useCallback(() => {
    if (!requirements.data) return [];

    return requirements.data.filter(req => {
      if (filters.framework && req.framework !== filters.framework) return false;
      if (filters.type && req.type !== filters.type) return false;
      if (filters.status && req.status !== filters.status) return false;
      if (filters.complianceLevel && req.complianceLevel !== filters.complianceLevel) return false;
      if (filters.showOnlyNonCompliant && req.complianceLevel === 'fully_compliant') return false;
      if (filters.showOnlyCritical && req.healthStatus !== 'red') return false;
      if (filters.ownerId && filters.ownerType === 'user' && req.ownerUserId !== filters.ownerId) return false;
      if (filters.ownerId && filters.ownerType === 'team' && req.ownerTeamId !== filters.ownerId) return false;
      return true;
    });
  }, [requirements.data, filters]);

  const searchRequirements = useCallback((query: string) => {
    if (!requirements.data) return [];
    
    const lowerQuery = query.toLowerCase();
    return requirements.data.filter(req => 
      req.name.toLowerCase().includes(lowerQuery) ||
      req.description?.toLowerCase().includes(lowerQuery) ||
      req.framework.toLowerCase().includes(lowerQuery) ||
      req.type.toLowerCase().includes(lowerQuery)
    );
  }, [requirements.data]);

  const getRequirementsByStatus = useCallback((status: string) => {
    return requirements.data?.filter(req => req.status === status) || [];
  }, [requirements.data]);

  const getCriticalRequirements = useCallback(() => {
    return requirements.data?.filter(req => 
      req.healthStatus === 'red' || 
      req.complianceLevel === 'non_compliant' ||
      req.criticalGapsCount > 0
    ) || [];
  }, [requirements.data]);

  // ---------------------------------
  // Cache Management
  // ---------------------------------
  const invalidateCache = useCallback((options?: { requirementId?: string; all?: boolean }) => {
    if (options?.all) {
      updateRequirementsState(prev => ({ ...prev, stale: true }));
      updateSelectedRequirementState(prev => ({ ...prev, stale: true }));
    } else if (options?.requirementId) {
      if (selectedRequirement.data?.id === options.requirementId) {
        updateSelectedRequirementState(prev => ({ ...prev, stale: true }));
      }
      updateRequirementsState(prev => ({ ...prev, stale: true }));
    }
  }, [updateRequirementsState, updateSelectedRequirementState, selectedRequirement.data?.id]);

  const refreshCache = useCallback(async () => {
    await loadRequirements({ force: true });
    if (selectedRequirement.data?.id) {
      await loadRequirement(selectedRequirement.data.id, { force: true });
    }
  }, [loadRequirements, loadRequirement, selectedRequirement.data?.id]);

  // ---------------------------------
  // Filter Management
  // ---------------------------------
  const setFilters = useCallback((newFilters: Partial<ComplianceUIFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(config.defaultFilters);
  }, [config.defaultFilters]);

  // ---------------------------------
  // Effects
  // ---------------------------------
  
  // Auto-load on tenant change
  useEffect(() => {
    if (tenantId && globalConfig) {
      loadRequirements();
    }
  }, [tenantId, globalConfig, loadRequirements]);

  // Auto-refresh when coming back online
  useEffect(() => {
    if (stats?.isProcessing === false && stats?.pending === 0 && isStale) {
      refreshCache();
    }
  }, [stats?.isProcessing, stats?.pending, isStale, refreshCache]);

  // Cleanup optimization
  useEffect(() => {
    return () => {
      // Clear any pending optimistic updates on unmount
      setOptimisticUpdates([]);
    };
  }, []);

  // ---------------------------------
  // Context Value
  // ---------------------------------
  const contextValue = useMemo<ComplianceContextType>(() => ({
    // State
    requirements,
    selectedRequirement,
    
    // UI state
    filters,
    setFilters,
    resetFilters,
    
    // API operations
    loadRequirements,
    loadRequirement,
    createRequirement,
    updateRequirement,
    deleteRequirement,
    
    // Specific operations
    updateComplianceScore,
    scheduleAssessment,
    
    // Client helpers
    getFilteredRequirements,
    searchRequirements,
    getRequirementsByStatus,
    getCriticalRequirements,
    
    // Cache management
    invalidateCache,
    refreshCache,
    
    // Optimistic updates
    optimisticUpdates,
    rollbackOptimisticUpdate,
    
    // Configuration
    config,
    
    // Performance
    isStale,
    lastSyncAt,
  }), [
    requirements,
    selectedRequirement,
    filters,
    setFilters,
    resetFilters,
    loadRequirements,
    loadRequirement,
    createRequirement,
    updateRequirement,
    deleteRequirement,
    updateComplianceScore,
    scheduleAssessment,
    getFilteredRequirements,
    searchRequirements,
    getRequirementsByStatus,
    getCriticalRequirements,
    invalidateCache,
    refreshCache,
    optimisticUpdates,
    rollbackOptimisticUpdate,
    config,
    isStale,
    lastSyncAt,
  ]);

  return (
    <ComplianceContext.Provider value={contextValue}>
      {children}
    </ComplianceContext.Provider>
  );
};

// ---------------------------------
// 4. Custom Hooks for Selective Subscriptions
// ---------------------------------

/**
 * Base hook for compliance context
 */
export const useCompliance = () => {
  const ctx = useContext(ComplianceContext);
  if (!ctx) throw new Error("useCompliance must be used within ComplianceProvider");
  return ctx;
};

/**
 * Hook for specific requirement details with automatic loading
 */
export const useComplianceRequirement = (id: string | undefined) => {
  const { selectedRequirement, loadRequirement } = useCompliance();
  
  useEffect(() => {
    if (id && selectedRequirement.data?.id !== id) {
      loadRequirement(id);
    }
  }, [id, selectedRequirement.data?.id, loadRequirement]);

  return {
    requirement: selectedRequirement.data?.id === id ? selectedRequirement.data : null,
    loading: selectedRequirement.loading,
    error: selectedRequirement.error,
    refresh: () => id ? loadRequirement(id, { force: true }) : Promise.resolve(),
  };
};

/**
 * Hook for filtered requirements with memoization
 */
export const useFilteredRequirements = () => {
  const { getFilteredRequirements, requirements, filters } = useCompliance();
  
  return useMemo(() => ({
    requirements: getFilteredRequirements(),
    loading: requirements.loading,
    error: requirements.error,
    isEmpty: getFilteredRequirements().length === 0,
    count: getFilteredRequirements().length,
  }), [getFilteredRequirements, requirements.loading, requirements.error]);
};

/**
 * Hook for critical requirements
 */
export const useCriticalRequirements = () => {
  const { getCriticalRequirements, requirements } = useCompliance();
  
  return useMemo(() => ({
    requirements: getCriticalRequirements(),
    count: getCriticalRequirements().length,
    loading: requirements.loading,
  }), [getCriticalRequirements, requirements.loading]);
};

/**
 * Hook for requirements by framework
 */
export const useRequirementsByFramework = (framework: string) => {
  const { requirements } = useCompliance();
  
  return useMemo(() => {
    const frameworkRequirements = requirements.data?.filter(req => req.framework === framework) || [];
    return {
      requirements: frameworkRequirements,
      count: frameworkRequirements.length,
      loading: requirements.loading,
    };
  }, [requirements.data, requirements.loading, framework]);
};

/**
 * Hook for search with debouncing
 */
export const useComplianceSearch = (query: string, debounceMs = 300) => {
  const { searchRequirements, requirements } = useCompliance();
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  return useMemo(() => ({
    results: debouncedQuery ? searchRequirements(debouncedQuery) : [],
    loading: requirements.loading,
    hasQuery: debouncedQuery.length > 0,
  }), [searchRequirements, debouncedQuery, requirements.loading]);
};