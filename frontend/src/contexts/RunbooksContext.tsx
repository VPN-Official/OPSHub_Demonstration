// src/contexts/RunbooksContext.tsx
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
import { loadConfig } from "../config/configLoader";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------
export interface RunbookStep {
  id: string;
  order: number;
  description: string;
  expected_result?: string;
  automation_rule_id?: string | null;
}

export interface Runbook {
  id: string;
  title: string;
  description?: string;
  type: string;   // config-driven
  status: string; // config-driven
  created_at: string;
  updated_at: string;

  // Relationships
  related_incident_ids: string[];
  related_problem_ids: string[];
  related_change_ids: string[];
  related_maintenance_ids: string[];
  compliance_requirement_ids: string[];
  owner_user_id?: string | null;
  owner_team_id?: string | null;

  // Steps
  steps: RunbookStep[];

  // Execution metadata - PROVIDED BY BACKEND
  last_executed_at?: string | null;
  last_executed_by_user_id?: string | null;
  average_execution_time_minutes?: number;
  success_rate?: number;

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
  tenantId?: string;
}

export interface RunbookDetails extends Runbook {
  owner?: any;
  team?: any;
  related_incidents?: any[];
  related_problems?: any[];
  related_changes?: any[];
  related_maintenances?: any[];
}

/**
 * Enhanced AsyncState interface for robust UI state management
 */
export interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  lastFetch: string | null;
  isStale: boolean;
  optimisticUpdates: Map<string, T>;
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------
interface RunbooksContextType {
  // Core async state
  state: AsyncState<Runbook[]>;
  
  // Core CRUD operations - thin API wrappers only
  addRunbook: (rb: Omit<Runbook, 'id' | 'created_at' | 'updated_at'>, userId?: string) => Promise<void>;
  updateRunbook: (rb: Runbook, userId?: string) => Promise<void>;
  deleteRunbook: (id: string, userId?: string) => Promise<void>;
  refreshRunbooks: () => Promise<void>;
  getRunbook: (id: string) => Promise<Runbook | undefined>;

  // Simple client-side filtering for immediate UI responsiveness
  getRunbooksByType: (type: string) => Runbook[];
  getRunbooksByStatus: (status: string) => Runbook[];
  getRunbooksByOwner: (ownerId: string) => Runbook[];
  searchRunbooks: (query: string) => Runbook[];
  getRecentRunbooks: (limit?: number) => Runbook[];

  // Cache management for UI performance
  invalidateCache: () => void;
  isDataStale: () => boolean;
  
  // Config integration from backend
  config: {
    types: string[];
    statuses: string[];
    isLoaded: boolean;
  };
}

const RunbooksContext = createContext<RunbooksContextType | undefined>(undefined);

// Constants for cache management
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

// ---------------------------------
// 3. Provider
// ---------------------------------
export const RunbooksProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();

  // Enhanced state management
  const [state, setState] = useState<AsyncState<Runbook[]>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    isStale: true,
    optimisticUpdates: new Map(),
  });

  const [config, setConfig] = useState<{
    types: string[];
    statuses: string[];
    isLoaded: boolean;
  }>({
    types: [],
    statuses: [],
    isLoaded: false,
  });

  // Load configuration when tenant changes
  useEffect(() => {
    if (tenantId) {
      loadConfig(tenantId)
        .then((tenantConfig) => {
          setConfig({
            types: tenantConfig.runbooks?.types || [],
            statuses: tenantConfig.runbooks?.statuses || [],
            isLoaded: true,
          });
        })
        .catch((error) => {
          console.error('Failed to load runbooks config:', error);
          setState(prev => ({ ...prev, error: 'Failed to load configuration' }));
        });
    } else {
      setConfig({ types: [], statuses: [], isLoaded: false });
    }
  }, [tenantId]);

  // Auto-refresh when tenant changes
  useEffect(() => {
    if (tenantId && config.isLoaded) {
      refreshRunbooks();
    }
  }, [tenantId, config.isLoaded]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setState(prev => ({ 
        ...prev, 
        optimisticUpdates: new Map() 
      }));
    };
  }, []);

  /**
   * Metadata enrichment helper (UI-only metadata)
   */
  const ensureMetadata = useCallback((runbook: Runbook): Runbook => {
    const now = new Date().toISOString();
    return {
      ...runbook,
      tenantId,
      tags: runbook.tags || [],
      health_status: runbook.health_status || "gray",
      sync_status: runbook.sync_status || "dirty",
      synced_at: runbook.synced_at || now,
      related_incident_ids: runbook.related_incident_ids || [],
      related_problem_ids: runbook.related_problem_ids || [],
      related_change_ids: runbook.related_change_ids || [],
      related_maintenance_ids: runbook.related_maintenance_ids || [],
      compliance_requirement_ids: runbook.compliance_requirement_ids || [],
      steps: runbook.steps || [],
    };
  }, [tenantId]);

  /**
   * Basic UI validation only - complex business rules handled by backend
   */
  const validateForUI = useCallback((runbook: Partial<Runbook>): void => {
    if (!runbook.title?.trim()) {
      throw new Error("Title is required");
    }
    if (runbook.title.trim().length < 3) {
      throw new Error("Title must be at least 3 characters");
    }
    if (runbook.type && !config.types.includes(runbook.type)) {
      throw new Error(`Invalid runbook type: ${runbook.type}`);
    }
    if (runbook.status && !config.statuses.includes(runbook.status)) {
      throw new Error(`Invalid runbook status: ${runbook.status}`);
    }
  }, [config.types, config.statuses]);

  /**
   * Core data fetching
   */
  const refreshRunbooks = useCallback(async (): Promise<void> => {
    if (!tenantId) {
      setState(prev => ({ ...prev, error: "No tenant selected" }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const runbooks = await getAll<Runbook>(tenantId, "runbooks");
      const now = new Date().toISOString();

      setState(prev => ({
        ...prev,
        data: runbooks,
        loading: false,
        lastFetch: now,
        isStale: false,
        optimisticUpdates: new Map(), // Clear optimistic updates on successful fetch
      }));

      console.log(`Loaded ${runbooks.length} runbooks for tenant ${tenantId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load runbooks';
      console.error('Runbooks loading error:', errorMessage);
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  }, [tenantId]);

  /**
   * Get single runbook
   */
  const getRunbook = useCallback(async (id: string): Promise<Runbook | undefined> => {
    if (!tenantId || !id) return undefined;
    
    // Check optimistic updates first
    const optimisticUpdate = state.optimisticUpdates.get(id);
    if (optimisticUpdate) {
      return optimisticUpdate;
    }

    // Check local cache
    const cached = state.data.find(rb => rb.id === id);
    if (cached && !isDataStale()) {
      return cached;
    }

    // Fetch from database
    try {
      return await getById<Runbook>(tenantId, "runbooks", id);
    } catch (error) {
      console.error(`Failed to get runbook ${id}:`, error);
      return undefined;
    }
  }, [tenantId, state.data, state.optimisticUpdates]);

  /**
   * Add runbook with optimistic UI updates
   */
  const addRunbook = useCallback(async (
    runbookData: Omit<Runbook, 'id' | 'created_at' | 'updated_at'>, 
    userId?: string
  ): Promise<void> => {
    if (!tenantId) throw new Error("No tenant selected");

    // UI validation only
    validateForUI(runbookData);

    const now = new Date().toISOString();
    const tempId = crypto.randomUUID();
    const optimisticRunbook = ensureMetadata({
      ...runbookData,
      id: tempId,
      created_at: now,
      updated_at: now,
    } as Runbook);

    // Optimistic update
    setState(prev => ({
      ...prev,
      data: [...prev.data, optimisticRunbook],
      optimisticUpdates: new Map(prev.optimisticUpdates).set(tempId, optimisticRunbook),
    }));

    try {
      // Backend handles ALL business validation and logic
      await putWithAudit(
        tenantId,
        "runbooks",
        optimisticRunbook,
        userId,
        { 
          action: "create", 
          description: `Runbook "${runbookData.title}" created`,
          tags: ['runbook', 'create', runbookData.type],
        }
      );

      // Enqueue for sync
      await enqueueItem({
        storeName: "runbooks",
        entityId: optimisticRunbook.id,
        action: "create",
        payload: optimisticRunbook,
        priority: "normal",
      });

      console.log(`Successfully created runbook: ${runbookData.title}`);
      
      // Refresh to get server-generated data
      await refreshRunbooks();
    } catch (error) {
      // Rollback optimistic update on failure
      setState(prev => {
        const newUpdates = new Map(prev.optimisticUpdates);
        newUpdates.delete(tempId);
        return {
          ...prev,
          data: prev.data.filter(rb => rb.id !== tempId),
          optimisticUpdates: newUpdates,
          error: error instanceof Error ? error.message : 'Failed to create runbook',
        };
      });
      throw error;
    }
  }, [tenantId, validateForUI, ensureMetadata, enqueueItem, refreshRunbooks]);

  /**
   * Update runbook with optimistic UI updates
   */
  const updateRunbook = useCallback(async (runbook: Runbook, userId?: string): Promise<void> => {
    if (!tenantId) throw new Error("No tenant selected");

    validateForUI(runbook);

    const enriched = ensureMetadata({
      ...runbook,
      updated_at: new Date().toISOString(),
    });

    // Optimistic update
    setState(prev => ({
      ...prev,
      data: prev.data.map(rb => rb.id === runbook.id ? enriched : rb),
      optimisticUpdates: new Map(prev.optimisticUpdates).set(runbook.id, enriched),
    }));

    try {
      await putWithAudit(
        tenantId,
        "runbooks",
        enriched,
        userId,
        { 
          action: "update", 
          description: `Runbook "${runbook.title}" updated`,
          tags: ['runbook', 'update', runbook.status],
        }
      );

      await enqueueItem({
        storeName: "runbooks",
        entityId: enriched.id,
        action: "update",
        payload: enriched,
        priority: "normal",
      });

      console.log(`Successfully updated runbook: ${runbook.title}`);
      
      // Clear optimistic update on success
      setState(prev => {
        const newUpdates = new Map(prev.optimisticUpdates);
        newUpdates.delete(runbook.id);
        return { ...prev, optimisticUpdates: newUpdates };
      });
    } catch (error) {
      // Rollback optimistic update and refresh from server
      setState(prev => {
        const newUpdates = new Map(prev.optimisticUpdates);
        newUpdates.delete(runbook.id);
        return { ...prev, optimisticUpdates: newUpdates };
      });
      await refreshRunbooks();
      throw error;
    }
  }, [tenantId, validateForUI, ensureMetadata, enqueueItem, refreshRunbooks]);

  /**
   * Delete runbook with optimistic UI updates
   */
  const deleteRunbook = useCallback(async (id: string, userId?: string): Promise<void> => {
    if (!tenantId) throw new Error("No tenant selected");

    const runbookToDelete = state.data.find(rb => rb.id === id);
    if (!runbookToDelete) {
      throw new Error("Runbook not found");
    }

    // Optimistic update
    setState(prev => ({
      ...prev,
      data: prev.data.filter(rb => rb.id !== id),
    }));

    try {
      await removeWithAudit(
        tenantId,
        "runbooks",
        id,
        userId,
        { 
          description: `Runbook "${runbookToDelete.title}" deleted`,
          tags: ['runbook', 'delete'],
        }
      );

      await enqueueItem({
        storeName: "runbooks",
        entityId: id,
        action: "delete",
        payload: null,
        priority: "normal",
      });

      console.log(`Successfully deleted runbook: ${runbookToDelete.title}`);
    } catch (error) {
      // Rollback on failure
      setState(prev => ({
        ...prev,
        data: [...prev.data, runbookToDelete].sort((a, b) => a.title.localeCompare(b.title)),
        error: error instanceof Error ? error.message : 'Failed to delete runbook',
      }));
      throw error;
    }
  }, [tenantId, state.data, enqueueItem]);

  // ---------------------------------
  // Simple Client-Side Filtering for UI Responsiveness
  // ---------------------------------
  
  const getRunbooksByType = useCallback((type: string): Runbook[] => {
    return state.data.filter(runbook => runbook.type === type);
  }, [state.data]);

  const getRunbooksByStatus = useCallback((status: string): Runbook[] => {
    return state.data.filter(runbook => runbook.status === status);
  }, [state.data]);

  const getRunbooksByOwner = useCallback((ownerId: string): Runbook[] => {
    return state.data.filter(runbook => 
      runbook.owner_user_id === ownerId || runbook.owner_team_id === ownerId
    );
  }, [state.data]);

  const searchRunbooks = useCallback((query: string): Runbook[] => {
    if (!query.trim()) return state.data;
    
    const lowerQuery = query.toLowerCase();
    return state.data.filter(runbook =>
      runbook.title.toLowerCase().includes(lowerQuery) ||
      runbook.description?.toLowerCase().includes(lowerQuery) ||
      runbook.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }, [state.data]);

  const getRecentRunbooks = useCallback((limit = 10): Runbook[] => {
    return [...state.data]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, limit);
  }, [state.data]);

  // ---------------------------------
  // Cache Management
  // ---------------------------------
  
  const invalidateCache = useCallback((): void => {
    setState(prev => ({ ...prev, isStale: true, lastFetch: null }));
  }, []);

  const isDataStale = useCallback((): boolean => {
    if (!state.lastFetch) return true;
    const now = new Date().getTime();
    const lastFetchTime = new Date(state.lastFetch).getTime();
    return (now - lastFetchTime) > STALE_THRESHOLD_MS;
  }, [state.lastFetch]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo((): RunbooksContextType => ({
    state,
    addRunbook,
    updateRunbook,
    deleteRunbook,
    refreshRunbooks,
    getRunbook,
    getRunbooksByType,
    getRunbooksByStatus,
    getRunbooksByOwner,
    searchRunbooks,
    getRecentRunbooks,
    invalidateCache,
    isDataStale,
    config,
  }), [
    state,
    addRunbook,
    updateRunbook,
    deleteRunbook,
    refreshRunbooks,
    getRunbook,
    getRunbooksByType,
    getRunbooksByStatus,
    getRunbooksByOwner,
    searchRunbooks,
    getRecentRunbooks,
    invalidateCache,
    isDataStale,
    config,
  ]);

  return (
    <RunbooksContext.Provider value={contextValue}>
      {children}
    </RunbooksContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------

/**
 * Primary hook for runbooks context
 */
export const useRunbooks = () => {
  const ctx = useContext(RunbooksContext);
  if (!ctx) throw new Error("useRunbooks must be used within RunbooksProvider");
  return ctx;
};

/**
 * Selective subscription hook for specific runbook
 */
export const useRunbookDetails = (id: string) => {
  const { state, getRunbook } = useRunbooks();
  const [runbook, setRunbook] = useState<Runbook | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setRunbook(null);
      setLoading(false);
      return;
    }

    const fetchRunbook = async () => {
      setLoading(true);
      try {
        const result = await getRunbook(id);
        setRunbook(result || null);
      } catch (error) {
        console.error(`Failed to fetch runbook ${id}:`, error);
        setRunbook(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRunbook();
  }, [id, getRunbook, state.lastFetch]); // Re-fetch when data refreshes

  return { runbook, loading };
};

/**
 * Hook for runbooks filtered by status with memoization
 */
export const useRunbooksByStatus = (status: string) => {
  const { getRunbooksByStatus } = useRunbooks();
  return useMemo(() => getRunbooksByStatus(status), [getRunbooksByStatus, status]);
};

/**
 * Hook for runbooks filtered by type with memoization
 */
export const useRunbooksByType = (type: string) => {
  const { getRunbooksByType } = useRunbooks();
  return useMemo(() => getRunbooksByType(type), [getRunbooksByType, type]);
};

/**
 * Hook for async state management
 */
export const useRunbooksState = () => {
  const { state, refreshRunbooks, invalidateCache, isDataStale } = useRunbooks();
  return { state, refreshRunbooks, invalidateCache, isDataStale };
};