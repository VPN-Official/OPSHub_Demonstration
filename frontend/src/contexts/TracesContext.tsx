import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { getAll, getById } from "../db/dbClient";
import { putWithAudit, removeWithAudit } from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { loadConfig } from "../config/configLoader";

// ---------------------------------
// 1. AsyncState Interface for UI State Management
// ---------------------------------

interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  lastFetch: string | null;
  stale: boolean;
}

interface AsyncOperation {
  loading: boolean;
  error: string | null;
}

// ---------------------------------
// 2. Type Definitions
// ---------------------------------

export interface Trace {
  id: string;
  source_system: string;   // from config.telemetry.traces.source_systems
  trace_id: string;
  span_id: string;
  parent_span_id?: string | null;
  operation: string;       // from config.telemetry.traces.allowed_operations
  duration_ms: number;
  captured_at: string;

  asset_id?: string | null;
  service_component_id?: string | null;
  business_service_id?: string | null;

  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
}

interface TracesContextType {
  // AsyncState for main data
  traces: AsyncState<Trace[]>;
  
  // Individual operation states
  operations: {
    create: AsyncOperation;
    update: AsyncOperation;
    delete: AsyncOperation;
  };

  // Cache control
  cache: {
    ttl: number;
    lastInvalidation: string | null;
    size: number;
  };

  // Core CRUD operations (thin API wrappers)
  addTrace: (trace: Trace, userId?: string) => Promise<void>;
  updateTrace: (trace: Trace, userId?: string) => Promise<void>;
  deleteTrace: (id: string, userId?: string) => Promise<void>;
  refreshTraces: () => Promise<void>;
  getTrace: (id: string) => Promise<Trace | undefined>;

  // Cache management
  invalidateCache: () => void;
  checkCacheStale: () => boolean;

  // Simple client-side filters for UI responsiveness
  getTracesBySource: (sourceSystem: string) => Trace[];
  getTracesByOperation: (operation: string) => Trace[];
  getTracesByHealthStatus: (status: Trace["health_status"]) => Trace[];
  searchTraces: (query: string) => Trace[];

  // Config-driven enums (from backend)
  config: {
    source_systems: string[];
    allowed_operations: string[];
    sampling_rules: Record<string, any>;
  };
}

const TracesContext = createContext<TracesContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider Implementation
// ---------------------------------

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000; // Maximum traces to keep in memory

export const TracesProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();

  // AsyncState for main traces data
  const [traces, setTraces] = useState<AsyncState<Trace[]>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    stale: true
  });

  // Individual operation states
  const [operations, setOperations] = useState({
    create: { loading: false, error: null },
    update: { loading: false, error: null },
    delete: { loading: false, error: null }
  });

  // Cache management
  const [cache, setCache] = useState({
    ttl: CACHE_TTL_MS,
    lastInvalidation: null,
    size: 0
  });

  // Optimistic update state
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, Trace>>(new Map());

  // Config from backend (tenant-specific)
  const config = useMemo(() => {
    try {
      return loadConfig(tenantId).telemetry.traces;
    } catch (error) {
      console.warn("Failed to load traces config, using defaults", error);
      return {
        source_systems: [],
        allowed_operations: [],
        sampling_rules: {}
      };
    }
  }, [tenantId]);

  // Helper to set operation loading state
  const setOperationState = useCallback((
    operation: 'create' | 'update' | 'delete',
    state: Partial<AsyncOperation>
  ) => {
    setOperations(prev => ({
      ...prev,
      [operation]: { ...prev[operation], ...state }
    }));
  }, []);

  // Cache staleness check
  const checkCacheStale = useCallback(() => {
    if (!traces.lastFetch) return true;
    const now = Date.now();
    const lastFetch = new Date(traces.lastFetch).getTime();
    return now - lastFetch > cache.ttl;
  }, [traces.lastFetch, cache.ttl]);

  // Cache invalidation
  const invalidateCache = useCallback(() => {
    setCache(prev => ({
      ...prev,
      lastInvalidation: new Date().toISOString()
    }));
    setTraces(prev => ({ ...prev, stale: true }));
  }, []);

  // Get merged traces (local + optimistic updates)
  const getMergedTraces = useCallback(() => {
    const baseTraces = traces.data;
    const merged = [...baseTraces];
    
    // Apply optimistic updates
    optimisticUpdates.forEach((optimisticTrace, id) => {
      const index = merged.findIndex(trace => trace.id === id);
      if (index >= 0) {
        merged[index] = optimisticTrace;
      } else {
        merged.push(optimisticTrace);
      }
    });

    return merged;
  }, [traces.data, optimisticUpdates]);

  // Main data refresh
  const refreshTraces = useCallback(async () => {
    if (!tenantId) return;

    setTraces(prev => ({ ...prev, loading: true, error: null }));

    try {
      const allTraces = await getAll<Trace>(tenantId, "traces");
      
      // Memory management: limit cache size
      const limitedTraces = allTraces.slice(0, MAX_CACHE_SIZE);
      
      setTraces({
        data: limitedTraces,
        loading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        stale: false
      });

      setCache(prev => ({
        ...prev,
        size: limitedTraces.length
      }));

      // Clear any optimistic updates on successful refresh
      setOptimisticUpdates(new Map());

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load traces';
      setTraces(prev => ({ 
        ...prev, 
        loading: false, 
        error: errorMessage 
      }));
    }
  }, [tenantId]);

  // Get single trace
  const getTrace = useCallback(async (id: string): Promise<Trace | undefined> => {
    try {
      return await getById<Trace>(tenantId, "traces", id);
    } catch (error) {
      console.warn(`Failed to get trace ${id}:`, error);
      return undefined;
    }
  }, [tenantId]);

  // Add trace with optimistic UI
  const addTrace = useCallback(async (trace: Trace, userId?: string) => {
    setOperationState('create', { loading: true, error: null });

    // Basic UI validation only (backend handles business rules)
    if (!trace.trace_id || !trace.source_system || !trace.operation) {
      const error = 'Required fields missing: trace_id, source_system, operation';
      setOperationState('create', { loading: false, error });
      return;
    }

    // Optimistic update
    setOptimisticUpdates(prev => new Map(prev).set(trace.id, {
      ...trace,
      sync_status: 'dirty' as const
    }));

    try {
      // Backend handles ALL validation and business logic
      await putWithAudit(
        tenantId,
        "traces",
        trace,
        userId,
        { action: "create", description: `Trace ${trace.trace_id} created` },
        enqueueItem
      );

      setOperationState('create', { loading: false, error: null });
      
      // Refresh data in background
      refreshTraces();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create trace';
      setOperationState('create', { loading: false, error: errorMessage });
      
      // Rollback optimistic update
      setOptimisticUpdates(prev => {
        const updated = new Map(prev);
        updated.delete(trace.id);
        return updated;
      });
    }
  }, [tenantId, enqueueItem, refreshTraces, setOperationState]);

  // Update trace with optimistic UI
  const updateTrace = useCallback(async (trace: Trace, userId?: string) => {
    setOperationState('update', { loading: true, error: null });

    // Optimistic update
    setOptimisticUpdates(prev => new Map(prev).set(trace.id, {
      ...trace,
      sync_status: 'dirty' as const
    }));

    try {
      // Backend handles ALL validation and business logic
      await putWithAudit(
        tenantId,
        "traces",
        trace,
        userId,
        { action: "update", description: `Trace ${trace.trace_id} updated` },
        enqueueItem
      );

      setOperationState('update', { loading: false, error: null });
      refreshTraces();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update trace';
      setOperationState('update', { loading: false, error: errorMessage });
      
      // Rollback optimistic update
      setOptimisticUpdates(prev => {
        const updated = new Map(prev);
        updated.delete(trace.id);
        return updated;
      });
    }
  }, [tenantId, enqueueItem, refreshTraces, setOperationState]);

  // Delete trace with optimistic UI
  const deleteTrace = useCallback(async (id: string, userId?: string) => {
    setOperationState('delete', { loading: true, error: null });

    // Store original for rollback
    const originalTrace = traces.data.find(t => t.id === id);
    
    // Optimistic removal
    setTraces(prev => ({
      ...prev,
      data: prev.data.filter(t => t.id !== id)
    }));

    try {
      // Backend handles ALL deletion business rules
      await removeWithAudit(
        tenantId,
        "traces",
        id,
        userId,
        { description: `Trace ${id} deleted` },
        enqueueItem
      );

      setOperationState('delete', { loading: false, error: null });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete trace';
      setOperationState('delete', { loading: false, error: errorMessage });
      
      // Rollback optimistic removal
      if (originalTrace) {
        setTraces(prev => ({
          ...prev,
          data: [...prev.data, originalTrace]
        }));
      }
    }
  }, [tenantId, enqueueItem, traces.data, setOperationState]);

  // Simple client-side filters for immediate UI responsiveness
  const getTracesBySource = useCallback((sourceSystem: string) => {
    const mergedTraces = getMergedTraces();
    return mergedTraces.filter(trace => trace.source_system === sourceSystem);
  }, [getMergedTraces]);

  const getTracesByOperation = useCallback((operation: string) => {
    const mergedTraces = getMergedTraces();
    return mergedTraces.filter(trace => trace.operation === operation);
  }, [getMergedTraces]);

  const getTracesByHealthStatus = useCallback((status: Trace["health_status"]) => {
    const mergedTraces = getMergedTraces();
    return mergedTraces.filter(trace => trace.health_status === status);
  }, [getMergedTraces]);

  const searchTraces = useCallback((query: string) => {
    if (!query.trim()) return getMergedTraces();
    
    const mergedTraces = getMergedTraces();
    const lowerQuery = query.toLowerCase();
    
    return mergedTraces.filter(trace =>
      trace.trace_id.toLowerCase().includes(lowerQuery) ||
      trace.operation.toLowerCase().includes(lowerQuery) ||
      trace.source_system.toLowerCase().includes(lowerQuery) ||
      trace.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }, [getMergedTraces]);

  // Auto-refresh when tenant changes
  useEffect(() => {
    if (tenantId) {
      refreshTraces();
    } else {
      // Clear state when no tenant
      setTraces({
        data: [],
        loading: false,
        error: null,
        lastFetch: null,
        stale: true
      });
      setOptimisticUpdates(new Map());
    }
  }, [tenantId, refreshTraces]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setOptimisticUpdates(new Map());
    };
  }, []);

  // Provide merged traces data to consumers
  const mergedTraces = useMemo(() => ({
    ...traces,
    data: getMergedTraces()
  }), [traces, getMergedTraces]);

  const contextValue = useMemo(() => ({
    traces: mergedTraces,
    operations,
    cache,
    addTrace,
    updateTrace,
    deleteTrace,
    refreshTraces,
    getTrace,
    invalidateCache,
    checkCacheStale,
    getTracesBySource,
    getTracesByOperation,
    getTracesByHealthStatus,
    searchTraces,
    config,
  }), [
    mergedTraces,
    operations,
    cache,
    addTrace,
    updateTrace,
    deleteTrace,
    refreshTraces,
    getTrace,
    invalidateCache,
    checkCacheStale,
    getTracesBySource,
    getTracesByOperation,
    getTracesByHealthStatus,
    searchTraces,
    config
  ]);

  return (
    <TracesContext.Provider value={contextValue}>
      {children}
    </TracesContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------

/**
 * Main hook for traces data and operations
 */
export const useTraces = () => {
  const ctx = useContext(TracesContext);
  if (!ctx) throw new Error("useTraces must be used within TracesProvider");
  return ctx;
};

/**
 * Hook for a specific trace by ID with loading state
 */
export const useTraceDetails = (id: string) => {
  const { traces, getTrace } = useTraces();
  const [traceDetail, setTraceDetail] = useState<{
    data: Trace | null;
    loading: boolean;
    error: string | null;
  }>({
    data: null,
    loading: false,
    error: null
  });

  useEffect(() => {
    if (!id) return;

    // First try to find in cached data
    const cached = traces.data.find(t => t.id === id);
    if (cached) {
      setTraceDetail({ data: cached, loading: false, error: null });
      return;
    }

    // If not in cache, fetch from backend
    setTraceDetail(prev => ({ ...prev, loading: true, error: null }));
    
    getTrace(id)
      .then(trace => {
        setTraceDetail({
          data: trace || null,
          loading: false,
          error: trace ? null : 'Trace not found'
        });
      })
      .catch(error => {
        setTraceDetail({
          data: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load trace'
        });
      });
  }, [id, traces.data, getTrace]);

  return traceDetail;
};

/**
 * Selective subscription hook for traces by health status
 */
export const useTracesByHealthStatus = (status: Trace["health_status"]) => {
  const { getTracesByHealthStatus, traces } = useTraces();
  
  return useMemo(() => ({
    data: getTracesByHealthStatus(status),
    loading: traces.loading,
    error: traces.error,
    count: getTracesByHealthStatus(status).length
  }), [getTracesByHealthStatus, status, traces.loading, traces.error]);
};

/**
 * Hook for filtered traces with search
 */
export const useTracesSearch = (query: string = '') => {
  const { searchTraces, traces } = useTraces();
  
  return useMemo(() => ({
    data: searchTraces(query),
    loading: traces.loading,
    error: traces.error,
    count: searchTraces(query).length
  }), [searchTraces, query, traces.loading, traces.error]);
};