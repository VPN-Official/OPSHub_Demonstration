// src/contexts/ProblemsContext.tsx - Enterprise Frontend Context
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import {
  getAll,
  getById as dbGetById,
  putWithAudit,
  removeWithAudit,
} from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";
import { useEndUsers } from "./EndUsersContext";
import { useIncidents } from "./IncidentsContext";
import { useBusinessServices } from "./BusinessServicesContext";

// ---------------------------------
// 1. Frontend State Types
// ---------------------------------

/**
 * Generic async state wrapper for UI state management
 */
export interface AsyncState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  lastFetch: string | null;
  isStale: boolean;
}

/**
 * UI-specific filter state for client-side operations only
 */
export interface ProblemUIFilters {
  searchQuery: string;
  statusFilter: string[];
  priorityFilter: string[];
  assignedToMe: boolean;
  businessServiceId?: string;
  tags: string[];
  healthStatus: ("green" | "yellow" | "orange" | "red" | "gray")[];
}

/**
 * Optimistic update tracking for UI responsiveness
 */
interface OptimisticUpdate {
  id: string;
  type: "create" | "update" | "delete";
  timestamp: string;
  data?: Problem;
  rollback?: () => void;
}

// ---------------------------------
// 2. Core Domain Types (unchanged)
// ---------------------------------

export interface LinkedRecommendation {
  reference_id: string;
  type: "runbook" | "knowledge" | "automation" | "ai_agent";
  confidence: number;
  recommendation: string;
  status: "suggested" | "accepted" | "rejected" | "executed";
  suggested_at: string;
  acted_at?: string | null;
  acted_by_user_id?: string | null;
}

export interface Problem {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  impact: string;
  urgency: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  closed_at?: string | null;
  business_service_id?: string | null;
  incident_ids?: string[];
  reported_by?: string;
  recommendations?: LinkedRecommendation[];
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
}

export interface ProblemDetails extends Problem {
  reporter?: any;
  business_service?: any;
  incidents?: any[];
}

// ---------------------------------
// 3. Frontend Context Interface
// ---------------------------------

interface ProblemsContextType {
  // Async state management
  state: AsyncState<Problem>;
  
  // API orchestration (thin wrappers)
  createProblem: (problem: Omit<Problem, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateProblem: (problem: Problem) => Promise<void>;
  deleteProblem: (id: string) => Promise<void>;
  refreshProblems: () => Promise<void>;
  
  // Client-side UI helpers (no business logic)
  getFilteredProblems: (filters: Partial<ProblemUIFilters>) => Problem[];
  searchProblems: (query: string) => Problem[];
  getProblemsByStatus: (statuses: string[]) => Problem[];
  getProblemsByPriority: (priorities: string[]) => Problem[];
  getMyProblems: (userId: string) => Problem[];
  
  // UI state management
  filters: ProblemUIFilters;
  updateFilters: (filters: Partial<ProblemUIFilters>) => void;
  clearFilters: () => void;
  
  // Cache management
  invalidateCache: () => void;
  isDataStale: boolean;
  
  // Config from backend
  config: {
    statuses: string[];
    priorities: string[];
    impacts: string[];
    urgencies: string[];
  } | null;
}

const ProblemsContext = createContext<ProblemsContextType | undefined>(undefined);

// ---------------------------------
// 4. Frontend Provider Implementation
// ---------------------------------

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_FILTERS: ProblemUIFilters = {
  searchQuery: "",
  statusFilter: [],
  priorityFilter: [],
  assignedToMe: false,
  tags: [],
  healthStatus: [],
};

export const ProblemsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config } = useConfig();
  
  // Core async state
  const [state, setState] = useState<AsyncState<Problem>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    isStale: true,
  });
  
  // UI filters state
  const [filters, setFilters] = useState<ProblemUIFilters>(DEFAULT_FILTERS);
  
  // Optimistic updates tracking
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdate[]>([]);

  // ---------------------------------
  // Cache & Staleness Management
  // ---------------------------------

  const isDataStale = useMemo(() => {
    if (!state.lastFetch) return true;
    return Date.now() - new Date(state.lastFetch).getTime() > CACHE_TTL_MS;
  }, [state.lastFetch]);

  const updateState = useCallback((updates: Partial<AsyncState<Problem>>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const markAsStale = useCallback(() => {
    updateState({ isStale: true });
  }, [updateState]);

  const invalidateCache = useCallback(() => {
    markAsStale();
  }, [markAsStale]);

  // ---------------------------------
  // API Orchestration (No Business Logic)
  // ---------------------------------

  const refreshProblems = useCallback(async () => {
    if (!tenantId) return;

    updateState({ loading: true, error: null });

    try {
      const data = await getAll<Problem>("problems", tenantId);
      updateState({
        data,
        loading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        isStale: false,
      });
    } catch (error) {
      updateState({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to fetch problems",
      });
    }
  }, [tenantId, updateState]);

  const createProblem = useCallback(async (
    problemData: Omit<Problem, 'id' | 'created_at' | 'updated_at'>
  ) => {
    if (!tenantId) throw new Error("No tenant context");

    // Create optimistic UI update
    const tempId = `temp-${Date.now()}`;
    const optimisticProblem: Problem = {
      ...problemData,
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "dirty",
      synced_at: new Date().toISOString(),
    };

    // Show optimistic update immediately
    setState(prev => ({
      ...prev,
      data: [optimisticProblem, ...prev.data],
    }));

    const rollback = () => {
      setState(prev => ({
        ...prev,
        data: prev.data.filter(p => p.id !== tempId),
      }));
    };

    setOptimisticUpdates(prev => [...prev, {
      id: tempId,
      type: "create",
      timestamp: new Date().toISOString(),
      data: optimisticProblem,
      rollback,
    }]);

    try {
      // Backend handles ALL business logic, validation, etc.
      await putWithAudit("problems", optimisticProblem, tenantId, {
        action: "create",
        description: `Created problem ${problemData.title}`,
      });
      
      enqueueItem("problems", optimisticProblem);
      
      // Remove optimistic update and refresh to get real data
      setOptimisticUpdates(prev => prev.filter(u => u.id !== tempId));
      await refreshProblems();
      
    } catch (error) {
      // Rollback optimistic update on failure
      rollback();
      setOptimisticUpdates(prev => prev.filter(u => u.id !== tempId));
      
      updateState({ 
        error: error instanceof Error ? error.message : "Failed to create problem" 
      });
      throw error;
    }
  }, [tenantId, enqueueItem, refreshProblems, updateState]);

  const updateProblem = useCallback(async (problem: Problem) => {
    if (!tenantId) throw new Error("No tenant context");

    // Store original for rollback
    const originalProblem = state.data.find(p => p.id === problem.id);
    if (!originalProblem) throw new Error("Problem not found for update");

    // Optimistic update
    setState(prev => ({
      ...prev,
      data: prev.data.map(p => 
        p.id === problem.id 
          ? { ...problem, updated_at: new Date().toISOString(), sync_status: "dirty" }
          : p
      ),
    }));

    const rollback = () => {
      setState(prev => ({
        ...prev,
        data: prev.data.map(p => p.id === problem.id ? originalProblem : p),
      }));
    };

    setOptimisticUpdates(prev => [...prev, {
      id: problem.id,
      type: "update",
      timestamp: new Date().toISOString(),
      rollback,
    }]);

    try {
      // Backend handles ALL business logic
      await putWithAudit("problems", problem, tenantId, {
        action: "update",
        description: `Updated problem ${problem.id}`,
      });
      
      enqueueItem("problems", problem);
      
      // Remove optimistic update
      setOptimisticUpdates(prev => prev.filter(u => u.id !== problem.id));
      
    } catch (error) {
      rollback();
      setOptimisticUpdates(prev => prev.filter(u => u.id !== problem.id));
      
      updateState({ 
        error: error instanceof Error ? error.message : "Failed to update problem" 
      });
      throw error;
    }
  }, [tenantId, state.data, enqueueItem, updateState]);

  const deleteProblem = useCallback(async (id: string) => {
    if (!tenantId) throw new Error("No tenant context");

    const originalProblem = state.data.find(p => p.id === id);
    if (!originalProblem) return;

    // Optimistic removal
    setState(prev => ({
      ...prev,
      data: prev.data.filter(p => p.id !== id),
    }));

    const rollback = () => {
      setState(prev => ({
        ...prev,
        data: [...prev.data, originalProblem],
      }));
    };

    setOptimisticUpdates(prev => [...prev, {
      id,
      type: "delete",
      timestamp: new Date().toISOString(),
      rollback,
    }]);

    try {
      // Backend handles business rules for deletion
      await removeWithAudit("problems", id, tenantId, {
        action: "delete",
        description: `Deleted problem ${id}`,
      });
      
      enqueueItem("problems", { id, deleted: true });
      
      // Remove optimistic update
      setOptimisticUpdates(prev => prev.filter(u => u.id !== id));
      
    } catch (error) {
      rollback();
      setOptimisticUpdates(prev => prev.filter(u => u.id !== id));
      
      updateState({ 
        error: error instanceof Error ? error.message : "Failed to delete problem" 
      });
      throw error;
    }
  }, [tenantId, state.data, enqueueItem, updateState]);

  // ---------------------------------
  // Client-Side UI Helpers (No Business Logic)
  // ---------------------------------

  const getFilteredProblems = useCallback((uiFilters: Partial<ProblemUIFilters> = {}) => {
    const activeFilters = { ...filters, ...uiFilters };
    
    return state.data.filter(problem => {
      // Simple client-side text search for UI responsiveness
      if (activeFilters.searchQuery) {
        const query = activeFilters.searchQuery.toLowerCase();
        const matchesSearch = 
          problem.title.toLowerCase().includes(query) ||
          problem.description.toLowerCase().includes(query) ||
          problem.tags.some(tag => tag.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      // Simple UI filtering (not business logic)
      if (activeFilters.statusFilter.length > 0) {
        if (!activeFilters.statusFilter.includes(problem.status)) return false;
      }

      if (activeFilters.priorityFilter.length > 0) {
        if (!activeFilters.priorityFilter.includes(problem.priority)) return false;
      }

      if (activeFilters.healthStatus.length > 0) {
        if (!activeFilters.healthStatus.includes(problem.health_status)) return false;
      }

      if (activeFilters.businessServiceId) {
        if (problem.business_service_id !== activeFilters.businessServiceId) return false;
      }

      if (activeFilters.tags.length > 0) {
        const hasMatchingTag = activeFilters.tags.some(tag => 
          problem.tags.includes(tag)
        );
        if (!hasMatchingTag) return false;
      }

      return true;
    });
  }, [state.data, filters]);

  const searchProblems = useCallback((query: string) => {
    return getFilteredProblems({ searchQuery: query });
  }, [getFilteredProblems]);

  const getProblemsByStatus = useCallback((statuses: string[]) => {
    return getFilteredProblems({ statusFilter: statuses });
  }, [getFilteredProblems]);

  const getProblemsByPriority = useCallback((priorities: string[]) => {
    return getFilteredProblems({ priorityFilter: priorities });
  }, [getFilteredProblems]);

  const getMyProblems = useCallback((userId: string) => {
    return state.data.filter(problem => problem.reported_by === userId);
  }, [state.data]);

  // ---------------------------------
  // UI State Management
  // ---------------------------------

  const updateFilters = useCallback((newFilters: Partial<ProblemUIFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  // ---------------------------------
  // Lifecycle & Effects
  // ---------------------------------

  useEffect(() => {
    if (tenantId && state.isStale) {
      refreshProblems();
    }
  }, [tenantId, state.isStale, refreshProblems]);

  // Cleanup optimistic updates older than 30 seconds
  useEffect(() => {
    const cleanup = setInterval(() => {
      const thirtySecondsAgo = Date.now() - 30000;
      setOptimisticUpdates(prev => 
        prev.filter(update => 
          new Date(update.timestamp).getTime() > thirtySecondsAgo
        )
      );
    }, 10000);

    return () => clearInterval(cleanup);
  }, []);

  // Memory cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear large datasets to prevent memory leaks
      setState({
        data: [],
        loading: false,
        error: null,
        lastFetch: null,
        isStale: true,
      });
      setOptimisticUpdates([]);
    };
  }, []);

  // ---------------------------------
  // Memoized Context Value
  // ---------------------------------

  const contextValue = useMemo(() => ({
    state,
    createProblem,
    updateProblem,
    deleteProblem,
    refreshProblems,
    getFilteredProblems,
    searchProblems,
    getProblemsByStatus,
    getProblemsByPriority,
    getMyProblems,
    filters,
    updateFilters,
    clearFilters,
    invalidateCache,
    isDataStale,
    config: config ? {
      statuses: config.statuses?.problems || [],
      priorities: Object.keys(config.priorities || {}),
      impacts: config.impacts || [],
      urgencies: config.urgencies || [],
    } : null,
  }), [
    state,
    createProblem,
    updateProblem,
    deleteProblem,
    refreshProblems,
    getFilteredProblems,
    searchProblems,
    getProblemsByStatus,
    getProblemsByPriority,
    getMyProblems,
    filters,
    updateFilters,
    clearFilters,
    invalidateCache,
    isDataStale,
    config,
  ]);

  return (
    <ProblemsContext.Provider value={contextValue}>
      {children}
    </ProblemsContext.Provider>
  );
};

// ---------------------------------
// 5. Hooks
// ---------------------------------

/**
 * Main hook for problems context
 */
export const useProblems = (): ProblemsContextType => {
  const ctx = useContext(ProblemsContext);
  if (!ctx) {
    throw new Error("useProblems must be used within a ProblemsProvider");
  }
  return ctx;
};

/**
 * Selective subscription hook for better performance
 */
export const useProblemsByStatus = (statuses: string[]): Problem[] => {
  const { getProblemsByStatus } = useProblems();
  return useMemo(() => getProblemsByStatus(statuses), [getProblemsByStatus, statuses]);
};

/**
 * Hook for problem details with related data composition
 */
export const useProblemDetails = (id: string): ProblemDetails | undefined => {
  const { state } = useProblems();
  const { endUsers } = useEndUsers();
  const { incidents } = useIncidents();
  const { businessServices } = useBusinessServices();

  return useMemo(() => {
    const problem = state.data.find((p) => p.id === id);
    if (!problem) return undefined;

    // Compose UI-related data only
    const reporter = problem.reported_by
      ? endUsers.find((u) => u.id === problem.reported_by)
      : undefined;

    const relatedIncidents = problem.incident_ids
      ? incidents.filter((i) => problem.incident_ids?.includes(i.id))
      : [];

    const business_service = problem.business_service_id
      ? businessServices.find((b) => b.id === problem.business_service_id)
      : undefined;

    return {
      ...problem,
      reporter,
      incidents: relatedIncidents,
      business_service,
    };
  }, [id, state.data, endUsers, incidents, businessServices]);
};

/**
 * Hook for filtered problems with memoization
 */
export const useFilteredProblems = (filters?: Partial<ProblemUIFilters>): Problem[] => {
  const { getFilteredProblems } = useProblems();
  return useMemo(() => getFilteredProblems(filters), [getFilteredProblems, filters]);
};