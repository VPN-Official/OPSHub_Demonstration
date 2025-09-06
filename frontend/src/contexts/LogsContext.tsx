// src/contexts/LogsContext.tsx (ENTERPRISE FRONTEND LAYER)
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { AsyncState, AsyncStateHelpers } from "../types/asyncState";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";

// ---------------------------------
// 1. Frontend UI State Types
// ---------------------------------

/**
 * Core Log entity - matches backend API contract
 */
export interface Log {
  id: string;
  source_system: string;
  message: string;
  level: "debug" | "info" | "warn" | "error";
  captured_at: string;
  created_at: string;
  updated_at: string;

  // Relationships - backend manages business rules
  asset_id?: string | null;
  service_component_id?: string | null;
  business_service_id?: string | null;
  related_incident_ids: string[];
  related_alert_ids: string[];

  // Distributed tracing
  trace_id?: string | null;
  span_id?: string | null;
  parent_span_id?: string | null;

  // Context data - backend provides, frontend displays
  logger_name?: string;
  thread_name?: string;
  process_id?: number;
  hostname?: string;
  environment?: string;
  structured_data?: Record<string, any>;
  raw_message?: string;
  stack_trace?: string;
  log_category?: string;
  error_code?: string;
  user_id?: string;
  session_id?: string;

  // UI Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "synced" | "syncing" | "error" | "conflict";
  tenantId?: string;
}

/**
 * UI-focused async state wrapper for loading states
 */


/**
 * Client-side UI filters (NOT business logic filters)
 */
interface UIFilters {
  searchQuery?: string;
  levels?: string[];
  sourceSystems?: string[];
  showOnlyErrors?: boolean;
  showOnlyWarnings?: boolean;
  timeRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * UI Configuration from backend
 */
interface LogsUIConfig {
  source_systems: string[];
  levels: string[];
  log_categories: string[];
  environments: string[];
  cacheTTL: number;
  pageSize: number;
}

/**
 * Optimistic update tracking
 */
interface OptimisticOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  tempData?: Partial<Log>;
  rollback: () => void;
}

// ---------------------------------
// 2. Frontend Context Interface
// ---------------------------------

interface LogsContextType {
  // Core async state
  state: AsyncState<Log[]>;
  
  // UI Operations (orchestrate backend APIs)
  createLog: (logData: Partial<Log>, userId?: string) => Promise<{ success: boolean; error?: string }>;
  updateLog: (id: string, updates: Partial<Log>, userId?: string) => Promise<{ success: boolean; error?: string }>;
  deleteLog: (id: string, userId?: string) => Promise<{ success: boolean; error?: string }>;
  refresh: (force?: boolean) => Promise<void>;

  // UI-focused queries (client-side performance helpers)
  getFilteredLogs: (filters: UIFilters) => Log[];
  searchLogs: (query: string) => Log[];
  getLogsByLevel: (level: string) => Log[];
  getLogsBySource: (source: string) => Log[];
  getRecentLogs: (hours: number) => Log[];
  
  // Backend business operations (API orchestration only)
  promoteToAlert: (logId: string, userId: string) => Promise<{ success: boolean; alertId?: string; error?: string }>;
  promoteToIncident: (logId: string, userId: string) => Promise<{ success: boolean; incidentId?: string; error?: string }>;
  getLogCorrelation: (traceId: string) => Promise<{ success: boolean; logs?: Log[]; error?: string }>;
  
  // Cache management
  invalidateCache: () => void;
  getCacheInfo: () => { lastFetch: Date | null; isStale: boolean; itemCount: number };
  
  // UI Configuration
  config: LogsUIConfig;
  
  // Optimistic updates
  optimisticOperations: OptimisticOperation[];
  rollbackOptimisticOperation: (operationId: string) => void;
}

const LogsContext = createContext<LogsContextType | undefined>(undefined);

// ---------------------------------
// 3. Constants & Utilities
// ---------------------------------

const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_PAGE_SIZE = 100;
const CLEANUP_THRESHOLD = 1000; // Max logs to keep in memory

/**
 * Basic UI validation only - business validation happens on backend
 */
const validateForUI = (logData: Partial<Log>): string | null => {
  if (!logData.message?.trim()) return "Message is required";
  if (!logData.source_system?.trim()) return "Source system is required";
  if (!logData.level) return "Log level is required";
  return null;
};

/**
 * Simple client-side search for immediate UI responsiveness
 */
const performClientSearch = (logs: Log[], query: string): Log[] => {
  if (!query.trim()) return logs;
  
  const searchTerm = query.toLowerCase();
  return logs.filter(log =>
    log.message.toLowerCase().includes(searchTerm) ||
    log.source_system.toLowerCase().includes(searchTerm) ||
    log.logger_name?.toLowerCase().includes(searchTerm) ||
    log.hostname?.toLowerCase().includes(searchTerm) ||
    log.tags.some(tag => tag.toLowerCase().includes(searchTerm))
  );
};

/**
 * Apply UI filters for immediate feedback (not business filters)
 */
const applyUIFilters = (logs: Log[], filters: UIFilters): Log[] => {
  let filtered = [...logs];
  
  if (filters.searchQuery) {
    filtered = performClientSearch(filtered, filters.searchQuery);
  }
  
  if (filters.levels?.length) {
    filtered = filtered.filter(log => filters.levels.includes(log.level));
  }
  
  if (filters.sourceSystems?.length) {
    filtered = filtered.filter(log => 
      log.source_system && filters.sourceSystems.includes(log.source_system)
    );
  }
  
  if (filters.showOnlyErrors) {
    filtered = filtered.filter(log => log.level === 'error');
  }
  
  if (filters.showOnlyWarnings) {
    filtered = filtered.filter(log => log.level === 'warn');
  }
  
  if (filters.timeRange) {
    const { start, end } = filters.timeRange;
    filtered = filtered.filter(log => {
      const logTime = new Date(log.captured_at);
      return logTime >= start && logTime <= end;
    });
  }
  
  return filtered;
};

// ---------------------------------
// 4. Enterprise Frontend Provider
// ---------------------------------

export const LogsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();
  
  // Core async state
  const [state, setState] = useState<AsyncState<Log[]>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    isStale: false,
  });
  
  // Optimistic updates tracking
  const [optimisticOperations, setOptimisticOperations] = useState<OptimisticOperation[]>([]);
  
  // Cache management
  const cacheRef = useRef<{ timestamp: Date; data: Log[] } | null>(null);
  const cleanupRef = useRef<NodeJS.Timeout>();

  // UI Configuration from backend
  const config = useMemo((): LogsUIConfig => ({
    source_systems: globalConfig?.telemetry?.logs?.source_systems || 
                    ['application', 'infrastructure', 'network', 'security', 'database'],
    levels: globalConfig?.telemetry?.logs?.levels || 
            ['debug', 'info', 'warn', 'error'],
    log_categories: globalConfig?.telemetry?.logs?.categories || 
                    ['system', 'application', 'security', 'audit', 'performance'],
    environments: globalConfig?.telemetry?.logs?.environments || 
                  ['development', 'staging', 'production', 'test'],
    cacheTTL: globalConfig?.ui?.cacheTTL || DEFAULT_CACHE_TTL,
    pageSize: globalConfig?.ui?.pageSize || DEFAULT_PAGE_SIZE,
  }), [globalConfig]);

  // ---------------------------------
  // Cache Management
  // ---------------------------------

  const isCacheStale = useCallback((): boolean => {
    if (!cacheRef.current) return true;
    const now = Date.now();
    const cacheAge = now - cacheRef.current.timestamp.getTime();
    return cacheAge > config.cacheTTL;
  }, [config.cacheTTL]);

  const updateCache = useCallback((data: Log[]) => {
    cacheRef.current = {
      timestamp: new Date(),
      data: [...data],
    };
    
    setState(prev => ({
      ...prev,
      data,
      lastFetch: new Date(),
      isStale: false,
    }));
  }, []);

  const invalidateCache = useCallback(() => {
    cacheRef.current = null;
    setState(prev => ({ ...prev, isStale: true }));
  }, []);

  const getCacheInfo = useCallback(() => ({
    lastFetch: state.lastFetch,
    isStale: state.isStale || isCacheStale(),
    itemCount: state.data.length,
  }), [state.lastFetch, state.isStale, state.data.length, isCacheStale]);

  // ---------------------------------
  // API Integration Layer
  // ---------------------------------

  const callAPI = useCallback(async <T,>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; data?: T; error?: string }> => {
    try {
      const response = await fetch(`/api/tenants/${tenantId}/logs${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Network error' }));
        return { success: false, error: errorData.message || `HTTP ${response.status}` };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }, [tenantId]);

  // ---------------------------------
  // Data Fetching
  // ---------------------------------

  const refresh = useCallback(async (force: boolean = false) => {
    if (!tenantId || (!force && !isCacheStale())) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    const result = await callAPI<Log[]>('');
    
    if (result.success && result.data) {
      // Apply client-side memory optimization
      let logsToStore = result.data;
      if (logsToStore.length > CLEANUP_THRESHOLD) {
        // Keep most recent logs and all errors
        const sortedLogs = [...logsToStore].sort((a, b) => 
          new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
        );
        const recentLogs = sortedLogs.slice(0, CLEANUP_THRESHOLD * 0.7);
        const errorLogs = sortedLogs.filter(log => 
          log.level === 'error' && !recentLogs.some(r => r.id === log.id)
        );
        logsToStore = [...recentLogs, ...errorLogs.slice(0, CLEANUP_THRESHOLD * 0.3)];
      }

      updateCache(logsToStore);
      setState(prev => ({ ...prev, loading: false }));
    } else {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: result.error || 'Failed to fetch logs',
        isStale: true 
      }));
    }
  }, [tenantId, isCacheStale, callAPI, updateCache]);

  // ---------------------------------
  // Optimistic Updates
  // ---------------------------------

  const addOptimisticOperation = useCallback((operation: OptimisticOperation) => {
    setOptimisticOperations(prev => [...prev, operation]);
  }, []);

  const removeOptimisticOperation = useCallback((operationId: string) => {
    setOptimisticOperations(prev => prev.filter(op => op.id !== operationId));
  }, []);

  const rollbackOptimisticOperation = useCallback((operationId: string) => {
    const operation = optimisticOperations.find(op => op.id === operationId);
    if (operation) {
      operation.rollback();
      removeOptimisticOperation(operationId);
    }
  }, [optimisticOperations, removeOptimisticOperation]);

  // ---------------------------------
  // CRUD Operations (API Orchestration Only)
  // ---------------------------------

  const createLog = useCallback(async (
    logData: Partial<Log>, 
    userId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    // Basic UI validation only
    const validationError = validateForUI(logData);
    if (validationError) {
      return { success: false, error: validationError };
    }

    const operationId = crypto.randomUUID();
    const tempLog: Log = {
      id: crypto.randomUUID(),
      source_system: logData.source_system || 'internal',
      message: logData.message || '',
      level: logData.level || 'info',
      captured_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: logData.tags || [],
      related_incident_ids: [],
      related_alert_ids: [],
      health_status: 'gray',
      tenantId,
      ...logData,
    } as Log;

    // Optimistic UI update
    setState(prev => ({
      ...prev,
      data: [tempLog, ...prev.data],
    }));

    addOptimisticOperation({
      id: operationId,
      type: 'create',
      tempData: tempLog,
      rollback: () => {
        setState(prev => ({
          ...prev,
          data: prev.data.filter(log => log.id !== tempLog.id),
        }));
      },
    });

    // Backend API call (handles ALL business logic)
    const result = await callAPI<Log>('', {
      method: 'POST',
      body: JSON.stringify({ ...logData, userId }),
    });

    if (result.success && result.data) {
      // Replace optimistic update with real data
      setState(prev => ({
        ...prev,
        data: prev.data.map(log => 
          log.id === tempLog.id ? result.data! : log
        ),
      }));
      
      // Queue for offline sync
      await enqueueItem({
        storeName: "logs",
        entityId: result.data.id,
        action: "create",
        payload: result.data,
      });

      removeOptimisticOperation(operationId);
      invalidateCache(); // Force refresh on next load
      return { success: true };
    } else {
      // Rollback optimistic update
      rollbackOptimisticOperation(operationId);
      return { success: false, error: result.error };
    }
  }, [tenantId, callAPI, addOptimisticOperation, removeOptimisticOperation, rollbackOptimisticOperation, enqueueItem, invalidateCache]);

  const updateLog = useCallback(async (
    id: string, 
    updates: Partial<Log>, 
    userId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const originalLog = state.data.find(log => log.id === id);
    if (!originalLog) {
      return { success: false, error: 'Log not found' };
    }

    const operationId = crypto.randomUUID();
    const updatedLog = { ...originalLog, ...updates, updated_at: new Date().toISOString() };

    // Optimistic UI update
    setState(prev => ({
      ...prev,
      data: prev.data.map(log => log.id === id ? updatedLog : log),
    }));

    addOptimisticOperation({
      id: operationId,
      type: 'update',
      rollback: () => {
        setState(prev => ({
          ...prev,
          data: prev.data.map(log => log.id === id ? originalLog : log),
        }));
      },
    });

    // Backend API call
    const result = await callAPI<Log>(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...updates, userId }),
    });

    if (result.success && result.data) {
      setState(prev => ({
        ...prev,
        data: prev.data.map(log => log.id === id ? result.data! : log),
      }));

      await enqueueItem({
        storeName: "logs",
        entityId: id,
        action: "update",
        payload: result.data,
      });

      removeOptimisticOperation(operationId);
      return { success: true };
    } else {
      rollbackOptimisticOperation(operationId);
      return { success: false, error: result.error };
    }
  }, [state.data, callAPI, addOptimisticOperation, removeOptimisticOperation, rollbackOptimisticOperation, enqueueItem]);

  const deleteLog = useCallback(async (
    id: string, 
    userId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const originalLog = state.data.find(log => log.id === id);
    if (!originalLog) {
      return { success: false, error: 'Log not found' };
    }

    const operationId = crypto.randomUUID();

    // Optimistic UI update
    setState(prev => ({
      ...prev,
      data: prev.data.filter(log => log.id !== id),
    }));

    addOptimisticOperation({
      id: operationId,
      type: 'delete',
      rollback: () => {
        setState(prev => ({
          ...prev,
          data: [...prev.data, originalLog].sort((a, b) => 
            new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
          ),
        }));
      },
    });

    // Backend API call
    const result = await callAPI(`/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ userId }),
    });

    if (result.success) {
      await enqueueItem({
        storeName: "logs",
        entityId: id,
        action: "delete",
        payload: null,
      });

      removeOptimisticOperation(operationId);
      return { success: true };
    } else {
      rollbackOptimisticOperation(operationId);
      return { success: false, error: result.error };
    }
  }, [state.data, callAPI, addOptimisticOperation, removeOptimisticOperation, rollbackOptimisticOperation, enqueueItem]);

  // ---------------------------------
  // Business Operations (Backend API Only)
  // ---------------------------------

  const promoteToAlert = useCallback(async (
    logId: string, 
    userId: string
  ): Promise<{ success: boolean; alertId?: string; error?: string }> => {
    const result = await callAPI<{ alertId: string }>(`/${logId}/promote-to-alert`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });

    if (result.success) {
      // Refresh to get updated relationships from backend
      await refresh(true);
      return { success: true, alertId: result.data?.alertId };
    }

    return { success: false, error: result.error };
  }, [callAPI, refresh]);

  const promoteToIncident = useCallback(async (
    logId: string, 
    userId: string
  ): Promise<{ success: boolean; incidentId?: string; error?: string }> => {
    const result = await callAPI<{ incidentId: string }>(`/${logId}/promote-to-incident`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });

    if (result.success) {
      await refresh(true);
      return { success: true, incidentId: result.data?.incidentId };
    }

    return { success: false, error: result.error };
  }, [callAPI, refresh]);

  const getLogCorrelation = useCallback(async (
    traceId: string
  ): Promise<{ success: boolean; logs?: Log[]; error?: string }> => {
    const result = await callAPI<Log[]>(`/correlate/${encodeURIComponent(traceId)}`);
    return {
      success: result.success,
      logs: result.data,
      error: result.error,
    };
  }, [callAPI]);

  // ---------------------------------
  // Client-Side UI Helpers (Performance Only)
  // ---------------------------------

  const getFilteredLogs = useCallback((filters: UIFilters): Log[] => {
    return applyUIFilters(state.data, filters);
  }, [state.data]);

  const searchLogs = useCallback((query: string): Log[] => {
    return performClientSearch(state.data, query);
  }, [state.data]);

  const getLogsByLevel = useCallback((level: string): Log[] => {
    return state.data.filter(log => log.level === level);
  }, [state.data]);

  const getLogsBySource = useCallback((source: string): Log[] => {
    return state.data.filter(log => log.source_system === source);
  }, [state.data]);

  const getRecentLogs = useCallback((hours: number): Log[] => {
    const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    return state.data.filter(log => new Date(log.captured_at) >= cutoffTime);
  }, [state.data]);

  // ---------------------------------
  // Lifecycle & Cleanup
  // ---------------------------------

  useEffect(() => {
    if (tenantId && globalConfig) {
      refresh();
    }

    // Cleanup on unmount
    return () => {
      if (cleanupRef.current) {
        clearTimeout(cleanupRef.current);
      }
    };
  }, [tenantId, globalConfig, refresh]);

  // Periodic cache staleness check
  useEffect(() => {
    const checkCacheInterval = setInterval(() => {
      if (cacheRef.current && isCacheStale()) {
        setState(prev => ({ ...prev, isStale: true }));
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkCacheInterval);
  }, [isCacheStale]);

  // Memory cleanup for large datasets
  useEffect(() => {
    if (state.data.length > CLEANUP_THRESHOLD) {
      cleanupRef.current = setTimeout(() => {
        setState(prev => {
          const sortedLogs = [...prev.data].sort((a, b) => 
            new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
          );
          const recentLogs = sortedLogs.slice(0, CLEANUP_THRESHOLD * 0.8);
          return { ...prev, data: recentLogs };
        });
      }, 5000);
    }

    return () => {
      if (cleanupRef.current) {
        clearTimeout(cleanupRef.current);
      }
    };
  }, [state.data.length]);

  // ---------------------------------
  // Context Value
  // ---------------------------------

  const contextValue = useMemo((): LogsContextType => ({
    state,
    createLog,
    updateLog,
    deleteLog,
    refresh,
    getFilteredLogs,
    searchLogs,
    getLogsByLevel,
    getLogsBySource,
    getRecentLogs,
    promoteToAlert,
    promoteToIncident,
    getLogCorrelation,
    invalidateCache,
    getCacheInfo,
    config,
    optimisticOperations,
    rollbackOptimisticOperation,
  }), [
    state,
    createLog,
    updateLog,
    deleteLog,
    refresh,
    getFilteredLogs,
    searchLogs,
    getLogsByLevel,
    getLogsBySource,
    getRecentLogs,
    promoteToAlert,
    promoteToIncident,
    getLogCorrelation,
    invalidateCache,
    getCacheInfo,
    config,
    optimisticOperations,
    rollbackOptimisticOperation,
  ]);

  return (
    <LogsContext.Provider value={contextValue}>
      {children}
    </LogsContext.Provider>
  );
};

// ---------------------------------
// 5. Optimized Hooks
// ---------------------------------

/**
 * Main logs hook with full context access
 */
export const useLogs = () => {
  const context = useContext(LogsContext);
  if (!context) {
    throw new Error("useLogs must be used within LogsProvider");
  }
  return context;
};

/**
 * Performance-optimized hook for specific log by ID
 */
export const useLog = (id: string) => {
  const { state } = useLogs();
  return useMemo(() => {
    return state.data.find(log => log.id === id) || null;
  }, [state.data, id]);
};

/**
 * Selective subscription for error logs only
 */
export const useErrorLogs = () => {
  const { state } = useLogs();
  return useMemo(() => {
    return state.data.filter(log => log.level === 'error');
  }, [state.data]);
};

/**
 * Selective subscription for recent logs with memoization
 */
export const useRecentLogs = (hours: number = 24) => {
  const { getRecentLogs } = useLogs();
  return useMemo(() => {
    return getRecentLogs(hours);
  }, [getRecentLogs, hours]);
};

/**
 * Search hook with debounced performance optimization
 */
export const useLogSearch = (query: string, debounceMs: number = 300) => {
  const { searchLogs } = useLogs();
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);
    
    return () => clearTimeout(timer);
  }, [query, debounceMs]);
  
  return useMemo(() => {
    return searchLogs(debouncedQuery);
  }, [searchLogs, debouncedQuery]);
};

/**
 * Filtering hook with memoized performance
 */
export const useFilteredLogs = (filters: UIFilters) => {
  const { getFilteredLogs } = useLogs();
  return useMemo(() => {
    return getFilteredLogs(filters);
  }, [getFilteredLogs, filters]);
};

/**
 * Cache status hook for UI indicators
 */
export const useLogsCacheStatus = () => {
  const { state, getCacheInfo } = useLogs();
  return useMemo(() => ({
    ...getCacheInfo(),
    loading: state.loading,
    error: state.error,
  }), [getCacheInfo, state.loading, state.error]);
};

/**
 * Optimistic operations hook for UI feedback
 */
export const useOptimisticLogs = () => {
  const { optimisticOperations, rollbackOptimisticOperation } = useLogs();
  return {
    operations: optimisticOperations,
    rollback: rollbackOptimisticOperation,
    hasOperations: optimisticOperations.length > 0,
  };
};