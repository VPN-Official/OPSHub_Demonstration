import React, { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  ReactNode, 
  useCallback, 
  useMemo 
} from "react";
import { 
  getAll, 
  getById, 
  putWithAudit, 
  removeWithAudit 
} from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";

// ---------------------------------
// 1. Frontend State Types (Following Reference Pattern)
// ---------------------------------

/**
 * AsyncState interface for UI state management
 */
export interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  lastFetch: string | null;
  stale: boolean;
}

/**
 * UI-focused operation state tracking
 */
interface OperationState {
  loading: boolean;
  error: string | null;
}

/**
 * Optimistic update tracking for UI responsiveness
 */
interface OptimisticUpdate {
  id: string;
  type: 'create' | 'update' | 'delete';
  originalData?: Trace;
  tempData?: Trace;
  timestamp: string;
}

/**
 * Client-side filtering options for immediate UI responsiveness
 */
interface TraceUIFilters {
  source_system?: string;
  operation?: string;
  health_status?: ("green" | "yellow" | "orange" | "red" | "gray")[];
  search?: string;
  asset_id?: string;
  service_component_id?: string;
  business_service_id?: string;
  date_range?: {
    start: string;
    end: string;
  };
}

// ---------------------------------
// 2. Domain Types
// ---------------------------------

export interface Trace {
  id: string;
  source_system: string;
  trace_id: string;
  span_id: string;
  parent_span_id?: string | null;
  operation: string;
  duration_ms: number;
  captured_at: string;

  // Relationships (backend manages these)
  asset_id?: string | null;
  service_component_id?: string | null;
  business_service_id?: string | null;

  // UI metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
  tenantId?: string;
}

// ---------------------------------
// 3. Frontend Context Interface
// ---------------------------------
interface TracesContextType {
  // Core async state
  traces: AsyncState<Trace[]>;
  
  // Operation states
  operations: {
    creating: OperationState;
    updating: OperationState;
    deleting: OperationState;
  };

  // API orchestration methods (no business logic)
  createTrace: (trace: Omit<Trace, 'id' | 'synced_at' | 'sync_status'>, userId?: string) => Promise<void>;
  updateTrace: (id: string, updates: Partial<Trace>, userId?: string) => Promise<void>;
  deleteTrace: (id: string, userId?: string) => Promise<void>;
  refreshTraces: (options?: { force?: boolean }) => Promise<void>;
  getTrace: (id: string) => Trace | null;

  // Client-side UI helpers (no business logic)
  getFilteredTraces: (filters: TraceUIFilters) => Trace[];
  searchTraces: (query: string) => Trace[];
  
  // Simple client-side queries for immediate UI response
  getTracesBySource: (sourceSystem: string) => Trace[];
  getTracesByOperation: (operation: string) => Trace[];
  getTracesByHealthStatus: (status: Trace["health_status"]) => Trace[];
  getTracesByAsset: (assetId: string) => Trace[];
  getTracesByServiceComponent: (componentId: string) => Trace[];
  
  // UI configuration from backend
  config: {
    source_systems: string[];
    allowed_operations: string[];
    health_statuses: string[];
    sampling_rules: Record<string, any>;
  };

  // Cache & performance info
  cacheInfo: {
    lastFetch: string | null;
    itemCount: number;
    staleness: boolean;
  };

  // Optimistic updates state
  optimisticUpdates: OptimisticUpdate[];

  // Cache management
  invalidateCache: () => void;
}

const TracesContext = createContext<TracesContextType | undefined>(undefined);

// ---------------------------------
// 4. Configuration Constants
// ---------------------------------
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_OPTIMISTIC_UPDATES = 10;
const MAX_CACHE_SIZE = 1000;

// ---------------------------------
// 5. Provider Implementation
// ---------------------------------
export const TracesProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();

  // Core async state
  const [traces, setTraces] = useState<AsyncState<Trace[]>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    stale: true,
  });

  // Operation states
  const [operations, setOperations] = useState({
    creating: { loading: false, error: null },
    updating: { loading: false, error: null },
    deleting: { loading: false, error: null },
  });

  // Optimistic updates tracking
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdate[]>([]);

  // UI Configuration from backend
  const config = useMemo(() => ({
    source_systems: globalConfig?.telemetry?.traces?.source_systems || 
                   ['application', 'database', 'cache', 'queue', 'api', 'service'],
    allowed_operations: globalConfig?.telemetry?.traces?.allowed_operations || 
                       ['http.request', 'db.query', 'cache.get', 'queue.send', 'rpc.call'],
    health_statuses: ['green', 'yellow', 'orange', 'red', 'gray'] as const,
    sampling_rules: globalConfig?.telemetry?.traces?.sampling_rules || {},
  }), [globalConfig]);

  // Cache info for UI display
  const cacheInfo = useMemo(() => ({
    lastFetch: traces.lastFetch,
    itemCount: traces.data.length,
    staleness: traces.stale,
  }), [traces]);

  // Helper to set operation state
  const setOperationState = useCallback((
    operation: 'creating' | 'updating' | 'deleting',
    state: Partial<OperationState>
  ) => {
    setOperations(prev => ({
      ...prev,
      [operation]: { ...prev[operation], ...state }
    }));
  }, []);

  // Helper to add optimistic update
  const addOptimisticUpdate = useCallback((update: OptimisticUpdate) => {
    setOptimisticUpdates(prev => {
      const filtered = prev.filter(u => u.id !== update.id);
      const newUpdates = [update, ...filtered].slice(0, MAX_OPTIMISTIC_UPDATES);
      return newUpdates;
    });
  }, []);

  // Helper to remove optimistic update
  const removeOptimisticUpdate = useCallback((id: string) => {
    setOptimisticUpdates(prev => prev.filter(u => u.id !== id));
  }, []);

  // Get merged traces (base data + optimistic updates)
  const getMergedTraces = useCallback((): Trace[] => {
    let merged = [...traces.data];
    
    // Apply optimistic updates
    optimisticUpdates.forEach(update => {
      const index = merged.findIndex(t => t.id === update.id);
      
      switch (update.type) {
        case 'create':
          if (update.tempData && index === -1) {
            merged.push(update.tempData);
          }
          break;
        case 'update':
          if (update.tempData && index >= 0) {
            merged[index] = update.tempData;
          }
          break;
        case 'delete':
          if (index >= 0) {
            merged.splice(index, 1);
          }
          break;
      }
    });

    return merged;
  }, [traces.data, optimisticUpdates]);

  // Basic UI validation only (not business rules)
  const validateForUI = useCallback((trace: Partial<Trace>) => {
    const errors: string[] = [];
    
    if (!trace.trace_id || trace.trace_id.trim().length === 0) {
      errors.push("Trace ID is required");
    }
    
    if (!trace.source_system || trace.source_system.trim().length === 0) {
      errors.push("Source system is required");
    }
    
    if (!trace.operation || trace.operation.trim().length === 0) {
      errors.push("Operation is required");
    }
    
    if (trace.duration_ms !== undefined && trace.duration_ms < 0) {
      errors.push("Duration must be non-negative");
    }
    
    return errors;
  }, []);

  // Refresh traces data
  const refreshTraces = useCallback(async (options?: { force?: boolean }) => {
    if (!tenantId) return;

    // Check if refresh needed
    if (!options?.force && traces.lastFetch && !traces.stale) {
      const now = Date.now();
      const lastFetch = new Date(traces.lastFetch).getTime();
      if (now - lastFetch < CACHE_TTL_MS) {
        return; // Still fresh
      }
    }

    setTraces(prev => ({ ...prev, loading: true, error: null }));

    try {
      const allTraces = await getAll<Trace>(tenantId, "traces");
      
      // Apply size limit for memory management
      const limitedTraces = allTraces.slice(0, MAX_CACHE_SIZE);

      setTraces({
        data: limitedTraces,
        loading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        stale: false,
      });

      // Clear optimistic updates on successful refresh
      setOptimisticUpdates([]);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load traces';
      setTraces(prev => ({ 
        ...prev, 
        loading: false, 
        error: errorMessage 
      }));
    }
  }, [tenantId, traces.lastFetch, traces.stale]);

  // Get single trace from cache or fetch
  const getTrace = useCallback((id: string): Trace | null => {
    // First check merged data (includes optimistic updates)
    const merged = getMergedTraces();
    return merged.find(t => t.id === id) || null;
  }, [getMergedTraces]);

  // Create trace with optimistic UI update
  const createTrace = useCallback(async (
    trace: Omit<Trace, 'id' | 'synced_at' | 'sync_status'>, 
    userId?: string
  ) => {
    setOperationState('creating', { loading: true, error: null });

    // Basic UI validation only
    const errors = validateForUI(trace);
    if (errors.length > 0) {
      setOperationState('creating', { loading: false, error: errors.join(', ') });
      return;
    }

    // Generate temporary ID for optimistic update
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tempTrace: Trace = {
      id: tempId,
      ...trace,
      sync_status: 'dirty' as const,
      synced_at: undefined,
      tenantId,
    };

    // Add optimistic update
    addOptimisticUpdate({
      id: tempId,
      type: 'create',
      tempData: tempTrace,
      timestamp: new Date().toISOString(),
    });

    try {
      // Backend handles ALL business logic and validation
      await putWithAudit(
        tenantId,
        "traces",
        tempTrace,
        userId,
        { action: "create", description: `Trace ${trace.trace_id} created` },
        enqueueItem
      );

      setOperationState('creating', { loading: false, error: null });
      
      // Refresh data to get server-side version
      setTimeout(() => refreshTraces({ force: true }), 100);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create trace';
      setOperationState('creating', { loading: false, error: errorMessage });
      
      // Remove failed optimistic update
      removeOptimisticUpdate(tempId);
    }
  }, [tenantId, enqueueItem, validateForUI, addOptimisticUpdate, removeOptimisticUpdate, refreshTraces, setOperationState]);

  // Update trace with optimistic UI update
  const updateTrace = useCallback(async (
    id: string, 
    updates: Partial<Trace>, 
    userId?: string
  ) => {
    setOperationState('updating', { loading: true, error: null });

    const existingTrace = getTrace(id);
    if (!existingTrace) {
      setOperationState('updating', { loading: false, error: 'Trace not found' });
      return;
    }

    const updatedTrace: Trace = {
      ...existingTrace,
      ...updates,
      id, // Ensure ID doesn't change
      sync_status: 'dirty' as const,
      synced_at: undefined,
    };

    // Add optimistic update
    addOptimisticUpdate({
      id,
      type: 'update',
      originalData: existingTrace,
      tempData: updatedTrace,
      timestamp: new Date().toISOString(),
    });

    try {
      // Backend handles ALL business logic and validation
      await putWithAudit(
        tenantId,
        "traces",
        updatedTrace,
        userId,
        { action: "update", description: `Trace ${existingTrace.trace_id} updated` },
        enqueueItem
      );

      setOperationState('updating', { loading: false, error: null });
      
      // Refresh data in background
      setTimeout(() => refreshTraces({ force: true }), 100);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update trace';
      setOperationState('updating', { loading: false, error: errorMessage });
      
      // Remove failed optimistic update
      removeOptimisticUpdate(id);
    }
  }, [tenantId, enqueueItem, getTrace, addOptimisticUpdate, removeOptimisticUpdate, refreshTraces, setOperationState]);

  // Delete trace with optimistic UI update
  const deleteTrace = useCallback(async (id: string, userId?: string) => {
    setOperationState('deleting', { loading: true, error: null });

    const existingTrace = getTrace(id);
    if (!existingTrace) {
      setOperationState('deleting', { loading: false, error: 'Trace not found' });
      return;
    }

    // Add optimistic update for deletion
    addOptimisticUpdate({
      id,
      type: 'delete',
      originalData: existingTrace,
      timestamp: new Date().toISOString(),
    });

    try {
      // Backend handles ALL deletion business rules
      await removeWithAudit(
        tenantId,
        "traces",
        id,
        userId,
        { description: `Trace ${existingTrace.trace_id} deleted` },
        enqueueItem
      );

      setOperationState('deleting', { loading: false, error: null });
      
      // Refresh data to confirm deletion
      setTimeout(() => refreshTraces({ force: true }), 100);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete trace';
      setOperationState('deleting', { loading: false, error: errorMessage });
      
      // Remove failed optimistic update
      removeOptimisticUpdate(id);
    }
  }, [tenantId, enqueueItem, getTrace, addOptimisticUpdate, removeOptimisticUpdate, refreshTraces, setOperationState]);

  // Client-side filtering for immediate UI responsiveness
  const getFilteredTraces = useCallback((filters: TraceUIFilters): Trace[] => {
    const merged = getMergedTraces();
    
    return merged.filter(trace => {
      // Source system filter
      if (filters.source_system && trace.source_system !== filters.source_system) {
        return false;
      }
      
      // Operation filter
      if (filters.operation && trace.operation !== filters.operation) {
        return false;
      }
      
      // Health status filter
      if (filters.health_status && filters.health_status.length > 0) {
        if (!filters.health_status.includes(trace.health_status)) {
          return false;
        }
      }
      
      // Asset filter
      if (filters.asset_id && trace.asset_id !== filters.asset_id) {
        return false;
      }
      
      // Service component filter
      if (filters.service_component_id && trace.service_component_id !== filters.service_component_id) {
        return false;
      }
      
      // Business service filter
      if (filters.business_service_id && trace.business_service_id !== filters.business_service_id) {
        return false;
      }
      
      // Search query filter
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const searchableText = [
          trace.trace_id,
          trace.operation,
          trace.source_system,
          ...trace.tags,
        ].join(' ').toLowerCase();
        
        if (!searchableText.includes(query)) {
          return false;
        }
      }
      
      // Date range filter
      if (filters.date_range) {
        const traceDate = new Date(trace.captured_at);
        const startDate = new Date(filters.date_range.start);
        const endDate = new Date(filters.date_range.end);
        
        if (traceDate < startDate || traceDate > endDate) {
          return false;
        }
      }
      
      return true;
    });
  }, [getMergedTraces]);

  // Simple search for immediate UI feedback
  const searchTraces = useCallback((query: string): Trace[] => {
    if (!query.trim()) return getMergedTraces();
    
    const lowerQuery = query.toLowerCase();
    const merged = getMergedTraces();
    
    return merged.filter(trace =>
      trace.trace_id.toLowerCase().includes(lowerQuery) ||
      trace.operation.toLowerCase().includes(lowerQuery) ||
      trace.source_system.toLowerCase().includes(lowerQuery) ||
      trace.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }, [getMergedTraces]);

  // Simple client-side queries for immediate UI response
  const getTracesBySource = useCallback((sourceSystem: string): Trace[] => {
    return getMergedTraces().filter(trace => trace.source_system === sourceSystem);
  }, [getMergedTraces]);

  const getTracesByOperation = useCallback((operation: string): Trace[] => {
    return getMergedTraces().filter(trace => trace.operation === operation);
  }, [getMergedTraces]);

  const getTracesByHealthStatus = useCallback((status: Trace["health_status"]): Trace[] => {
    return getMergedTraces().filter(trace => trace.health_status === status);
  }, [getMergedTraces]);

  const getTracesByAsset = useCallback((assetId: string): Trace[] => {
    return getMergedTraces().filter(trace => trace.asset_id === assetId);
  }, [getMergedTraces]);

  const getTracesByServiceComponent = useCallback((componentId: string): Trace[] => {
    return getMergedTraces().filter(trace => trace.service_component_id === componentId);
  }, [getMergedTraces]);

  // Cache management
  const invalidateCache = useCallback(() => {
    setTraces(prev => ({ ...prev, stale: true }));
  }, []);

  // Auto-refresh when tenant changes
  useEffect(() => {
    if (tenantId) {
      refreshTraces({ force: true });
    } else {
      // Clear state when no tenant
      setTraces({
        data: [],
        loading: false,
        error: null,
        lastFetch: null,
        stale: true,
      });
      setOptimisticUpdates([]);
      setOperations({
        creating: { loading: false, error: null },
        updating: { loading: false, error: null },
        deleting: { loading: false, error: null },
      });
    }
  }, [tenantId, refreshTraces]);

  // Auto-refresh on stale data
  useEffect(() => {
    if (traces.stale && traces.lastFetch) {
      const now = Date.now();
      const lastFetch = new Date(traces.lastFetch).getTime();
      
      if (now - lastFetch > CACHE_TTL_MS) {
        refreshTraces({ force: true });
      }
    }
  }, [traces.stale, traces.lastFetch, refreshTraces]);

  // Create merged traces with optimistic updates
  const mergedTraces = useMemo(() => ({
    ...traces,
    data: getMergedTraces(),
  }), [traces, getMergedTraces]);

  // Memoized context value
  const contextValue = useMemo(() => ({
    traces: mergedTraces,
    operations,
    createTrace,
    updateTrace,
    deleteTrace,
    refreshTraces,
    getTrace,
    getFilteredTraces,
    searchTraces,
    getTracesBySource,
    getTracesByOperation,
    getTracesByHealthStatus,
    getTracesByAsset,
    getTracesByServiceComponent,
    config,
    cacheInfo,
    optimisticUpdates,
    invalidateCache,
  }), [
    mergedTraces,
    operations,
    createTrace,
    updateTrace,
    deleteTrace,
    refreshTraces,
    getTrace,
    getFilteredTraces,
    searchTraces,
    getTracesBySource,
    getTracesByOperation,
    getTracesByHealthStatus,
    getTracesByAsset,
    getTracesByServiceComponent,
    config,
    cacheInfo,
    optimisticUpdates,
    invalidateCache,
  ]);

  return (
    <TracesContext.Provider value={contextValue}>
      {children}
    </TracesContext.Provider>
  );
};

// ---------------------------------
// 6. Hooks
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
 * Hook for a specific trace by ID with async state
 */
export const useTraceDetails = (id: string) => {
  const { getTrace } = useTraces();
  const [state, setState] = useState<AsyncState<Trace>>({
    data: null,
    loading: false,
    error: null,
    lastFetch: null,
    stale: true,
  });

  useEffect(() => {
    if (!id) {
      setState({
        data: null,
        loading: false,
        error: null,
        lastFetch: null,
        stale: true,
      });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const trace = getTrace(id);
      setState({
        data: trace,
        loading: false,
        error: trace ? null : 'Trace not found',
        lastFetch: new Date().toISOString(),
        stale: false,
      });
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load trace',
        lastFetch: null,
        stale: true,
      });
    }
  }, [id, getTrace]);

  return state;
};

/**
 * Hook for filtered traces with UI state
 */
export const useFilteredTraces = (filters: TraceUIFilters) => {
  const { getFilteredTraces, traces } = useTraces();
  
  return useMemo(() => {
    const filtered = getFilteredTraces(filters);
    return {
      data: filtered,
      loading: traces.loading,
      error: traces.error,
      count: filtered.length,
      stale: traces.stale,
    };
  }, [getFilteredTraces, filters, traces]);
};

/**
 * Hook for trace search with debounced query
 */
export const useTracesSearch = (query: string = '') => {
  const { searchTraces, traces } = useTraces();
  
  return useMemo(() => {
    const results = searchTraces(query);
    return {
      data: results,
      loading: traces.loading,
      error: traces.error,
      count: results.length,
      stale: traces.stale,
    };
  }, [searchTraces, query, traces]);
};