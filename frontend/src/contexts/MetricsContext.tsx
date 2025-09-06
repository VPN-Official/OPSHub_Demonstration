import React, { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  ReactNode, 
  useCallback,
  useMemo,
  useRef
} from "react";
import { getAll, getById, putWithAudit, removeWithAudit } from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";

// ========================================
// TYPES & INTERFACES
// ========================================

export interface Metric {
  id: string;
  source_system: string;
  name: string;
  value: number;
  unit?: string;
  captured_at: string;
  asset_id?: string | null;
  service_component_id?: string | null;
  business_service_id?: string | null;
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "synced" | "syncing" | "error" | "conflict";
}

/**
 * Async state wrapper for UI operations
 */
interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  lastFetch: number | null;
  stale: boolean;
}

/**
 * UI-focused filter interface for client-side operations
 */
interface UIFilters {
  healthStatus?: Metric['health_status'][];
  sourceSystems?: string[];
  hasAsset?: boolean;
  searchQuery?: string;
  tags?: string[];
}

/**
 * Optimistic update tracking
 */
interface OptimisticUpdate {
  id: string;
  type: 'create' | 'update' | 'delete';
  timestamp: number;
  rollbackData?: Metric;
}

interface MetricsContextType {
  // Core async state
  state: AsyncState<Metric[]>;
  
  // CRUD operations (UI orchestration only)
  addMetric: (metric: Metric, userId?: string) => Promise<void>;
  updateMetric: (metric: Metric, userId?: string) => Promise<void>;
  deleteMetric: (id: string, userId?: string) => Promise<void>;
  
  // Data fetching
  refreshMetrics: (force?: boolean) => Promise<void>;
  getMetric: (id: string) => Promise<Metric | undefined>;
  
  // UI helpers (client-side only)
  getFilteredMetrics: (filters: UIFilters) => Metric[];
  searchMetrics: (query: string) => Metric[];
  getMetricsByStatus: (status: Metric['health_status']) => Metric[];
  getMetricsBySource: (source: string) => Metric[];
  
  // Cache management
  invalidateCache: () => void;
  
  // Optimistic updates state
  optimisticUpdates: OptimisticUpdate[];
}

// ========================================
// CONTEXT SETUP
// ========================================

const MetricsContext = createContext<MetricsContextType | undefined>(undefined);

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_OPTIMISTIC_UPDATES = 10;

// ========================================
// PROVIDER IMPLEMENTATION
// ========================================

export const MetricsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Core async state
  const [state, setState] = useState<AsyncState<Metric[]>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    stale: false
  });
  
  // Optimistic updates tracking
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdate[]>([]);

  // ========================================
  // CACHE MANAGEMENT
  // ========================================

  const isCacheStale = useCallback(() => {
    if (!state.lastFetch) return true;
    return Date.now() - state.lastFetch > CACHE_TTL;
  }, [state.lastFetch]);

  const invalidateCache = useCallback(() => {
    setState(prev => ({ ...prev, stale: true, lastFetch: null }));
  }, []);

  // ========================================
  // ERROR HANDLING
  // ========================================

  const handleError = useCallback((error: unknown, operation: string) => {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.warn(`Metrics ${operation} failed:`, errorMessage);
    
    setState(prev => ({
      ...prev,
      error: `${operation}: ${errorMessage}`,
      loading: false
    }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // ========================================
  // OPTIMISTIC UPDATES
  // ========================================

  const addOptimisticUpdate = useCallback((update: OptimisticUpdate) => {
    setOptimisticUpdates(prev => {
      const newUpdates = [update, ...prev].slice(0, MAX_OPTIMISTIC_UPDATES);
      return newUpdates;
    });
  }, []);

  const removeOptimisticUpdate = useCallback((id: string) => {
    setOptimisticUpdates(prev => prev.filter(update => update.id !== id));
  }, []);

  const applyOptimisticUpdate = useCallback((metric: Metric, type: 'create' | 'update') => {
    setState(prev => {
      let newData: Metric[];
      
      if (type === 'create') {
        newData = [...prev.data, metric];
      } else {
        newData = prev.data.map(m => m.id === metric.id ? metric : m);
      }
      
      return { ...prev, data: newData };
    });
    
    addOptimisticUpdate({
      id: metric.id,
      type,
      timestamp: Date.now(),
      rollbackData: type === 'update' ? state.data.find(m => m.id === metric.id) : undefined
    });
  }, [state.data, addOptimisticUpdate]);

  const applyOptimisticDelete = useCallback((id: string) => {
    const existingMetric = state.data.find(m => m.id === id);
    
    setState(prev => ({
      ...prev,
      data: prev.data.filter(m => m.id !== id)
    }));
    
    addOptimisticUpdate({
      id,
      type: 'delete',
      timestamp: Date.now(),
      rollbackData: existingMetric
    });
  }, [state.data, addOptimisticUpdate]);

  const rollbackOptimisticUpdate = useCallback((id: string) => {
    const update = optimisticUpdates.find(u => u.id === id);
    if (!update) return;

    setState(prev => {
      let newData = [...prev.data];
      
      switch (update.type) {
        case 'create':
          newData = newData.filter(m => m.id !== id);
          break;
        case 'update':
          if (update.rollbackData) {
            newData = newData.map(m => m.id === id ? update.rollbackData! : m);
          }
          break;
        case 'delete':
          if (update.rollbackData) {
            newData = [...newData, update.rollbackData];
          }
          break;
      }
      
      return { ...prev, data: newData };
    });
    
    removeOptimisticUpdate(id);
  }, [optimisticUpdates, removeOptimisticUpdate]);

  // ========================================
  // API OPERATIONS (Orchestration Only)
  // ========================================

  /**
   * Refresh metrics from backend
   * Backend handles: business rules, validation, complex filtering
   * Frontend handles: caching, loading states, error UI state
   */
  const refreshMetrics = useCallback(async (force = false) => {
    if (!force && !isCacheStale() && state.data.length > 0) {
      return; // Use cached data
    }

    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setState(prev => ({ ...prev, loading: true, error: null }));
    clearError();

    try {
      // Backend API handles all business logic, filtering, sorting
      const metrics = await getAll<Metric>(tenantId, "metrics");
      
      setState(prev => ({
        ...prev,
        data: metrics,
        loading: false,
        lastFetch: Date.now(),
        stale: false
      }));
      
      // Clear successful optimistic updates
      setOptimisticUpdates([]);
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Ignore aborted requests
      }
      handleError(error, 'fetch');
    }
  }, [tenantId, isCacheStale, state.data.length, handleError, clearError]);

  /**
   * Get single metric by ID
   * Backend handles: access control, business rules
   * Frontend handles: caching strategy, error states
   */
  const getMetric = useCallback(async (id: string): Promise<Metric | undefined> => {
    try {
      // Check cache first for UI responsiveness
      const cached = state.data.find(m => m.id === id);
      if (cached && !isCacheStale()) {
        return cached;
      }
      
      // Backend API handles business logic
      return await getById<Metric>(tenantId, "metrics", id);
    } catch (error) {
      handleError(error, 'get metric');
      return undefined;
    }
  }, [tenantId, state.data, isCacheStale, handleError]);

  /**
   * Add new metric (UI orchestration only)
   * Backend handles: validation, business rules, persistence, calculations
   * Frontend handles: optimistic UI updates, loading states, rollback on failure
   */
  const addMetric = useCallback(async (metric: Metric, userId?: string) => {
    // Optimistic UI update for immediate feedback
    applyOptimisticUpdate(metric, 'create');
    
    try {
      // Backend handles ALL business logic, validation, calculations
      await putWithAudit(
        tenantId,
        "metrics",
        metric,
        userId,
        { action: "create", description: `Metric "${metric.name}" created` },
        enqueueItem
      );
      
      removeOptimisticUpdate(metric.id);
      // Refresh to get backend-calculated fields
      await refreshMetrics(true);
      
    } catch (error) {
      rollbackOptimisticUpdate(metric.id);
      handleError(error, 'create metric');
      throw error; // Re-throw for UI error handling
    }
  }, [tenantId, enqueueItem, applyOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate, refreshMetrics, handleError]);

  /**
   * Update existing metric (UI orchestration only)
   * Backend handles: validation, business rules, persistence, calculations
   * Frontend handles: optimistic UI updates, loading states, rollback on failure
   */
  const updateMetric = useCallback(async (metric: Metric, userId?: string) => {
    // Optimistic UI update for immediate feedback
    applyOptimisticUpdate(metric, 'update');
    
    try {
      // Backend handles ALL business logic, validation, calculations
      await putWithAudit(
        tenantId,
        "metrics",
        metric,
        userId,
        { action: "update", description: `Metric "${metric.name}" updated` },
        enqueueItem
      );
      
      removeOptimisticUpdate(metric.id);
      // Refresh to get backend-calculated fields
      await refreshMetrics(true);
      
    } catch (error) {
      rollbackOptimisticUpdate(metric.id);
      handleError(error, 'update metric');
      throw error; // Re-throw for UI error handling
    }
  }, [tenantId, enqueueItem, applyOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate, refreshMetrics, handleError]);

  /**
   * Delete metric (UI orchestration only)
   * Backend handles: business rules, cascade deletes, validation
   * Frontend handles: optimistic UI updates, loading states, rollback on failure
   */
  const deleteMetric = useCallback(async (id: string, userId?: string) => {
    // Optimistic UI update for immediate feedback
    applyOptimisticDelete(id);
    
    try {
      // Backend handles ALL business logic, validation, cascade operations
      await removeWithAudit(
        tenantId,
        "metrics",
        id,
        userId,
        { description: `Metric ${id} deleted` },
        enqueueItem
      );
      
      removeOptimisticUpdate(id);
      
    } catch (error) {
      rollbackOptimisticUpdate(id);
      handleError(error, 'delete metric');
      throw error; // Re-throw for UI error handling
    }
  }, [tenantId, enqueueItem, applyOptimisticDelete, removeOptimisticUpdate, rollbackOptimisticUpdate, handleError]);

  // ========================================
  // CLIENT-SIDE UI HELPERS (Performance Only)
  // ========================================

  /**
   * Simple client-side filtering for immediate UI responsiveness
   * NOTE: Complex business filtering should use backend APIs
   */
  const getFilteredMetrics = useCallback((filters: UIFilters): Metric[] => {
    let filtered = [...state.data];

    if (filters.healthStatus?.length) {
      filtered = filtered.filter(m => filters.healthStatus.includes(m.health_status));
    }

    if (filters.sourceSystems?.length) {
      filtered = filtered.filter(m => 
        m.source_system && filters.sourceSystems.includes(m.source_system)
      );
    }

    if (filters.hasAsset !== undefined) {
      filtered = filtered.filter(m => 
        filters.hasAsset ? !!m.asset_id : !m.asset_id
      );
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.name.toLowerCase().includes(query) ||
        m.source_system.toLowerCase().includes(query)
      );
    }

    if (filters.tags?.length) {
      filtered = filtered.filter(m =>
        filters.tags?.some(tag => m.tags?.includes(tag)) || false
      );
    }

    return filtered;
  }, [state.data]);

  /**
   * Simple client-side search for UI responsiveness
   * NOTE: Complex search should use backend search APIs
   */
  const searchMetrics = useCallback((query: string): Metric[] => {
    if (!query.trim()) return state.data;
    
    const searchQuery = query.toLowerCase().trim();
    return state.data.filter(metric =>
      metric.name.toLowerCase().includes(searchQuery) ||
      metric.source_system.toLowerCase().includes(searchQuery) ||
      metric.tags.some(tag => tag.toLowerCase().includes(searchQuery))
    );
  }, [state.data]);

  /**
   * Quick client-side filtering by status for UI performance
   */
  const getMetricsByStatus = useCallback((status: Metric['health_status']): Metric[] => {
    return state.data.filter(metric => metric.health_status === status);
  }, [state.data]);

  /**
   * Quick client-side filtering by source for UI performance
   */
  const getMetricsBySource = useCallback((source: string): Metric[] => {
    return state.data.filter(metric => metric.source_system === source);
  }, [state.data]);

  // ========================================
  // LIFECYCLE & CLEANUP
  // ========================================

  useEffect(() => {
    refreshMetrics();
    
    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [tenantId, refreshMetrics]);

  // Auto-refresh stale data
  useEffect(() => {
    if (state.stale) {
      refreshMetrics(true);
    }
  }, [state.stale, refreshMetrics]);

  // ========================================
  // MEMOIZED CONTEXT VALUE
  // ========================================

  const contextValue = useMemo<MetricsContextType>(() => ({
    state,
    addMetric,
    updateMetric,
    deleteMetric,
    refreshMetrics,
    getMetric,
    getFilteredMetrics,
    searchMetrics,
    getMetricsByStatus,
    getMetricsBySource,
    invalidateCache,
    optimisticUpdates
  }), [
    state,
    addMetric,
    updateMetric,
    deleteMetric,
    refreshMetrics,
    getMetric,
    getFilteredMetrics,
    searchMetrics,
    getMetricsByStatus,
    getMetricsBySource,
    invalidateCache,
    optimisticUpdates
  ]);

  return (
    <MetricsContext.Provider value={contextValue}>
      {children}
    </MetricsContext.Provider>
  );
};

// ========================================
// HOOKS
// ========================================

/**
 * Main metrics hook
 */
export const useMetrics = () => {
  const ctx = useContext(MetricsContext);
  if (!ctx) {
    throw new Error("useMetrics must be used within MetricsProvider");
  }
  return ctx;
};

/**
 * Selective subscription hook for single metric details
 * Prevents unnecessary re-renders when other metrics change
 */
export const useMetricDetails = (id: string) => {
  const { state } = useMetrics();
  
  return useMemo(() => {
    return state.data.find(m => m.id === id) || null;
  }, [state.data, id]);
};

/**
 * Hook for metrics by status with memoization
 */
export const useMetricsByStatus = (status: Metric['health_status']) => {
  const { getMetricsByStatus } = useMetrics();
  
  return useMemo(() => {
    return getMetricsByStatus(status);
  }, [getMetricsByStatus, status]);
};

/**
 * Hook for async state management
 */
export const useMetricsState = () => {
  const { state } = useMetrics();
  return state;
};