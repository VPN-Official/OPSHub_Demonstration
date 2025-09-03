// src/contexts/MaintenanceContext.tsx (ENTERPRISE REFACTORED)
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import { getAll, getById } from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";

// ---------------------------------
// 1. Frontend-Only Type Definitions
// ---------------------------------

/**
 * AsyncState wrapper for robust UI state management
 */
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetch: string | null;
  stale: boolean;
}

/**
 * Core MaintenanceWork entity (backend-driven structure)
 * Frontend context manages only UI state, not business logic
 */
export interface MaintenanceWork {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  maintenance_type: string;
  created_at: string;
  updated_at: string;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  actual_start?: string | null;
  completed_at?: string | null;

  // Relations (IDs only - let backend resolve)
  asset_ids: string[];
  service_component_ids: string[];
  business_service_id?: string | null;
  assigned_to_user_id?: string | null;
  assigned_to_team_id?: string | null;

  // Minimal UI-relevant data structures
  checklist: Array<{
    id: string;
    step: string;
    status: string;
    required: boolean;
  }>;
  parts_required: Array<{
    part_name: string;
    quantity: number;
    cost: number;
    in_stock: boolean;
  }>;
  
  // Backend-calculated fields (frontend displays only)
  estimated_duration_minutes?: number;
  actual_duration_minutes?: number | null;
  estimated_cost?: number | null;
  actual_cost?: number | null;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  
  // UI metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  sync_status?: "clean" | "dirty" | "conflict";
  synced_at?: string;
  tenantId?: string;
}

/**
 * UI-specific filter state
 */
export interface MaintenanceFilters {
  search?: string;
  status?: string[];
  priority?: string[];
  type?: string[];
  assignedToMe?: boolean;
  teamScope?: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
}

/**
 * Optimistic update state
 */
interface OptimisticUpdate {
  id: string;
  action: "create" | "update" | "delete";
  original?: MaintenanceWork;
  optimistic: MaintenanceWork | null;
  timestamp: string;
}

// ---------------------------------
// 2. Frontend Context Interface
// ---------------------------------
interface MaintenanceContextType {
  // Core async state
  maintenanceWorks: AsyncState<MaintenanceWork[]>;
  
  // CRUD operations (thin API wrappers)
  createMaintenance: (maintenance: Partial<MaintenanceWork>, userId?: string) => Promise<MaintenanceWork>;
  updateMaintenance: (id: string, updates: Partial<MaintenanceWork>, userId?: string) => Promise<MaintenanceWork>;
  deleteMaintenance: (id: string, userId?: string) => Promise<void>;
  
  // Data fetching & cache management
  refreshMaintenanceWorks: () => Promise<void>;
  getMaintenance: (id: string) => Promise<MaintenanceWork | null>;
  invalidateCache: () => void;
  
  // UI-focused operations (optimistic updates)
  approveMaintenanceOptimistic: (id: string, userId: string) => Promise<void>;
  startMaintenanceOptimistic: (id: string, userId: string) => Promise<void>;
  completeMaintenanceOptimistic: (id: string, userId: string, notes?: string) => Promise<void>;
  
  // Client-side filtering & search for UI responsiveness
  filteredMaintenanceWorks: MaintenanceWork[];
  filters: MaintenanceFilters;
  setFilters: (filters: Partial<MaintenanceFilters>) => void;
  clearFilters: () => void;
  
  // Simple client-side queries for immediate UI response
  getMaintenanceByStatus: (status: string) => MaintenanceWork[];
  getScheduledMaintenance: () => MaintenanceWork[];
  getMyMaintenance: (userId: string) => MaintenanceWork[];
  searchMaintenance: (query: string) => MaintenanceWork[];
  
  // UI configuration from backend
  config: {
    statuses: string[];
    priorities: string[];
    types: string[];
    fields: Record<string, any>;
  };
  
  // Cache & performance info
  cacheInfo: {
    lastFetch: string | null;
    itemCount: number;
    staleness: boolean;
  };
}

const MaintenanceContext = createContext<MaintenanceContextType | undefined>(undefined);

// ---------------------------------
// 3. Frontend-Focused Provider
// ---------------------------------
export const MaintenanceProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();

  // Core async state management
  const [maintenanceWorks, setMaintenanceWorks] = useState<AsyncState<MaintenanceWork[]>>({
    data: null,
    loading: false,
    error: null,
    lastFetch: null,
    stale: false,
  });

  // UI filtering state
  const [filters, setFiltersState] = useState<MaintenanceFilters>({});
  
  // Optimistic updates tracking
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdate[]>([]);
  
  // Cache configuration (30 seconds staleness threshold)
  const CACHE_TTL_MS = 30 * 1000;
  
  // Extract maintenance-specific config from backend
  const config = useMemo(() => {
    if (!globalConfig) {
      return {
        statuses: ['planned', 'scheduled', 'in_progress', 'completed', 'cancelled'],
        priorities: ['P1', 'P2', 'P3', 'P4'],
        types: ['preventive', 'corrective', 'predictive', 'emergency'],
        fields: {},
      };
    }
    
    return {
      statuses: globalConfig.statuses?.maintenance || 
                ['planned', 'scheduled', 'in_progress', 'completed', 'cancelled'],
      priorities: Object.keys(globalConfig.priorities || {}),
      types: globalConfig.work?.maintenance?.types || 
             ['preventive', 'corrective', 'predictive', 'emergency'],
      fields: globalConfig.work?.maintenance?.fields || {},
    };
  }, [globalConfig]);

  // Cache staleness check
  const isCacheStale = useCallback(() => {
    if (!maintenanceWorks.lastFetch) return true;
    return Date.now() - new Date(maintenanceWorks.lastFetch).getTime() > CACHE_TTL_MS;
  }, [maintenanceWorks.lastFetch]);

  // Error state manager
  const setError = useCallback((error: string | null) => {
    setMaintenanceWorks(prev => ({ ...prev, error, loading: false }));
  }, []);

  // Loading state manager  
  const setLoading = useCallback((loading: boolean) => {
    setMaintenanceWorks(prev => ({ ...prev, loading }));
  }, []);

  // ---------------------------------
  // Core Data Operations (API Wrappers)
  // ---------------------------------

  const refreshMaintenanceWorks = useCallback(async () => {
    if (!tenantId) return;

    setMaintenanceWorks(prev => ({ 
      ...prev, 
      loading: true, 
      error: null,
      stale: false 
    }));

    try {
      const data = await getAll<MaintenanceWork>(tenantId, "maintenance");
      
      // Apply simple client-side sorting for UI performance
      const sorted = data.sort((a, b) => {
        // Priority order for immediate UI feedback
        const priorityOrder = { 'P1': 4, 'P2': 3, 'P3': 2, 'P4': 1 };
        const aPriority = priorityOrder[a.priority] || 0;
        const bPriority = priorityOrder[b.priority] || 0;
        
        if (aPriority !== bPriority) return bPriority - aPriority;
        
        // Then by scheduled time for UI convenience
        if (a.scheduled_start && b.scheduled_start) {
          return new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime();
        }
        
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setMaintenanceWorks({
        data: sorted,
        loading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        stale: false,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load maintenance works';
      setError(errorMessage);
    }
  }, [tenantId, setError]);

  const getMaintenance = useCallback(async (id: string): Promise<MaintenanceWork | null> => {
    if (!tenantId) return null;
    
    try {
      const maintenance = await getById<MaintenanceWork>(tenantId, "maintenance", id);
      return maintenance || null;
    } catch (err) {
      console.error(`Failed to get maintenance ${id}:`, err);
      return null;
    }
  }, [tenantId]);

  const invalidateCache = useCallback(() => {
    setMaintenanceWorks(prev => ({ ...prev, stale: true }));
  }, []);

  // ---------------------------------
  // Optimistic Update Helpers
  // ---------------------------------

  const addOptimisticUpdate = useCallback((update: OptimisticUpdate) => {
    setOptimisticUpdates(prev => [...prev, update]);
  }, []);

  const removeOptimisticUpdate = useCallback((id: string) => {
    setOptimisticUpdates(prev => prev.filter(u => u.id !== id));
  }, []);

  const rollbackOptimisticUpdate = useCallback((updateId: string) => {
    const update = optimisticUpdates.find(u => u.id === updateId);
    if (!update || !maintenanceWorks.data) return;

    // Restore original state
    if (update.action === "create") {
      setMaintenanceWorks(prev => ({
        ...prev,
        data: prev.data?.filter(m => m.id !== update.optimistic?.id) || null,
      }));
    } else if (update.action === "update" && update.original) {
      setMaintenanceWorks(prev => ({
        ...prev,
        data: prev.data?.map(m => m.id === update.id ? update.original! : m) || null,
      }));
    } else if (update.action === "delete" && update.original) {
      setMaintenanceWorks(prev => ({
        ...prev,
        data: prev.data ? [...prev.data, update.original!] : [update.original!],
      }));
    }

    removeOptimisticUpdate(updateId);
  }, [optimisticUpdates, maintenanceWorks.data, removeOptimisticUpdate]);

  // ---------------------------------
  // CRUD Operations (Thin API Wrappers)
  // ---------------------------------

  const createMaintenance = useCallback(async (
    maintenanceData: Partial<MaintenanceWork>, 
    userId?: string
  ): Promise<MaintenanceWork> => {
    if (!tenantId) throw new Error("No tenant selected");

    // Create optimistic record for immediate UI feedback
    const optimisticId = `temp_${Date.now()}`;
    const optimisticMaintenance: MaintenanceWork = {
      id: optimisticId,
      title: maintenanceData.title || 'New Maintenance',
      description: maintenanceData.description || '',
      status: maintenanceData.status || 'planned',
      priority: maintenanceData.priority || 'P3',
      maintenance_type: maintenanceData.maintenance_type || 'preventive',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      asset_ids: maintenanceData.asset_ids || [],
      service_component_ids: maintenanceData.service_component_ids || [],
      checklist: maintenanceData.checklist || [],
      parts_required: maintenanceData.parts_required || [],
      tags: maintenanceData.tags || [],
      health_status: 'gray',
      sync_status: 'dirty',
      tenantId,
      ...maintenanceData,
    };

    // Apply optimistic update to UI
    setMaintenanceWorks(prev => ({
      ...prev,
      data: prev.data ? [optimisticMaintenance, ...prev.data] : [optimisticMaintenance],
    }));

    const updateId = `create_${optimisticId}`;
    addOptimisticUpdate({
      id: updateId,
      action: "create",
      optimistic: optimisticMaintenance,
      timestamp: new Date().toISOString(),
    });

    try {
      // Call backend API - it handles all business logic
      const response = await fetch(`/api/${tenantId}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...maintenanceData, userId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create maintenance');
      }

      const createdMaintenance = await response.json();
      
      // Replace optimistic update with real data
      setMaintenanceWorks(prev => ({
        ...prev,
        data: prev.data?.map(m => 
          m.id === optimisticId ? createdMaintenance : m
        ) || null,
      }));

      // Enqueue for sync
      await enqueueItem({
        storeName: "maintenance",
        entityId: createdMaintenance.id,
        action: "create",
        payload: createdMaintenance,
      });

      removeOptimisticUpdate(updateId);
      return createdMaintenance;

    } catch (error) {
      // Rollback optimistic update on failure
      rollbackOptimisticUpdate(updateId);
      throw error;
    }
  }, [tenantId, addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate, enqueueItem]);

  const updateMaintenance = useCallback(async (
    id: string,
    updates: Partial<MaintenanceWork>,
    userId?: string
  ): Promise<MaintenanceWork> => {
    if (!tenantId) throw new Error("No tenant selected");
    if (!maintenanceWorks.data) throw new Error("Maintenance data not loaded");

    const original = maintenanceWorks.data.find(m => m.id === id);
    if (!original) throw new Error(`Maintenance ${id} not found`);

    // Apply optimistic update
    const optimisticMaintenance = {
      ...original,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    setMaintenanceWorks(prev => ({
      ...prev,
      data: prev.data?.map(m => m.id === id ? optimisticMaintenance : m) || null,
    }));

    const updateId = `update_${id}_${Date.now()}`;
    addOptimisticUpdate({
      id: updateId,
      action: "update",
      original,
      optimistic: optimisticMaintenance,
      timestamp: new Date().toISOString(),
    });

    try {
      // Call backend API
      const response = await fetch(`/api/${tenantId}/maintenance/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, userId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update maintenance');
      }

      const updatedMaintenance = await response.json();
      
      // Update with server response
      setMaintenanceWorks(prev => ({
        ...prev,
        data: prev.data?.map(m => m.id === id ? updatedMaintenance : m) || null,
      }));

      await enqueueItem({
        storeName: "maintenance",
        entityId: id,
        action: "update",
        payload: updatedMaintenance,
      });

      removeOptimisticUpdate(updateId);
      return updatedMaintenance;

    } catch (error) {
      rollbackOptimisticUpdate(updateId);
      throw error;
    }
  }, [tenantId, maintenanceWorks.data, addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate, enqueueItem]);

  const deleteMaintenance = useCallback(async (id: string, userId?: string): Promise<void> => {
    if (!tenantId) throw new Error("No tenant selected");
    if (!maintenanceWorks.data) throw new Error("Maintenance data not loaded");

    const original = maintenanceWorks.data.find(m => m.id === id);
    if (!original) throw new Error(`Maintenance ${id} not found`);

    // Apply optimistic deletion
    setMaintenanceWorks(prev => ({
      ...prev,
      data: prev.data?.filter(m => m.id !== id) || null,
    }));

    const updateId = `delete_${id}_${Date.now()}`;
    addOptimisticUpdate({
      id: updateId,
      action: "delete",
      original,
      optimistic: null,
      timestamp: new Date().toISOString(),
    });

    try {
      const response = await fetch(`/api/${tenantId}/maintenance/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete maintenance');
      }

      await enqueueItem({
        storeName: "maintenance",
        entityId: id,
        action: "delete",
        payload: null,
      });

      removeOptimisticUpdate(updateId);

    } catch (error) {
      rollbackOptimisticUpdate(updateId);
      throw error;
    }
  }, [tenantId, maintenanceWorks.data, addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate, enqueueItem]);

  // ---------------------------------
  // Business Operations (Optimistic UI)
  // ---------------------------------

  const approveMaintenanceOptimistic = useCallback(async (id: string, userId: string) => {
    await updateMaintenance(id, { 
      status: 'approved',
      custom_fields: { approved_by: userId, approved_at: new Date().toISOString() }
    }, userId);
  }, [updateMaintenance]);

  const startMaintenanceOptimistic = useCallback(async (id: string, userId: string) => {
    await updateMaintenance(id, {
      status: 'in_progress',
      actual_start: new Date().toISOString(),
      custom_fields: { started_by: userId }
    }, userId);
  }, [updateMaintenance]);

  const completeMaintenanceOptimistic = useCallback(async (id: string, userId: string, notes?: string) => {
    const completedAt = new Date().toISOString();
    await updateMaintenance(id, {
      status: 'completed',
      completed_at: completedAt,
      custom_fields: { 
        completed_by: userId,
        completion_notes: notes,
      }
    }, userId);
  }, [updateMaintenance]);

  // ---------------------------------
  // Client-Side Filtering & Search
  // ---------------------------------

  const setFilters = useCallback((newFilters: Partial<MaintenanceFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState({});
  }, []);

  // Memoized filtered results for performance
  const filteredMaintenanceWorks = useMemo(() => {
    if (!maintenanceWorks.data) return [];
    
    return maintenanceWorks.data.filter(maintenance => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = 
          maintenance.title.toLowerCase().includes(searchLower) ||
          maintenance.description.toLowerCase().includes(searchLower) ||
          maintenance.maintenance_type.toLowerCase().includes(searchLower) ||
          maintenance.tags.some(tag => tag.toLowerCase().includes(searchLower));
        
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.status?.length) {
        if (!filters.status.includes(maintenance.status)) return false;
      }

      // Priority filter
      if (filters.priority?.length) {
        if (!filters.priority.includes(maintenance.priority)) return false;
      }

      // Type filter
      if (filters.type?.length) {
        if (!filters.type.includes(maintenance.maintenance_type)) return false;
      }

      // Date range filter
      if (filters.dateRange) {
        const maintenanceDate = new Date(maintenance.scheduled_start || maintenance.created_at);
        const startDate = new Date(filters.dateRange.start);
        const endDate = new Date(filters.dateRange.end);
        
        if (maintenanceDate < startDate || maintenanceDate > endDate) return false;
      }

      return true;
    });
  }, [maintenanceWorks.data, filters]);

  // ---------------------------------
  // Simple Client Queries for UI
  // ---------------------------------

  const getMaintenanceByStatus = useCallback((status: string) => {
    return maintenanceWorks.data?.filter(m => m.status === status) || [];
  }, [maintenanceWorks.data]);

  const getScheduledMaintenance = useCallback(() => {
    const now = new Date();
    return maintenanceWorks.data?.filter(m => 
      m.scheduled_start && 
      new Date(m.scheduled_start) > now &&
      m.status === 'scheduled'
    ) || [];
  }, [maintenanceWorks.data]);

  const getMyMaintenance = useCallback((userId: string) => {
    return maintenanceWorks.data?.filter(m => m.assigned_to_user_id === userId) || [];
  }, [maintenanceWorks.data]);

  const searchMaintenance = useCallback((query: string) => {
    if (!query.trim()) return maintenanceWorks.data || [];
    
    const lowerQuery = query.toLowerCase();
    return maintenanceWorks.data?.filter(m => 
      m.title.toLowerCase().includes(lowerQuery) ||
      m.description.toLowerCase().includes(lowerQuery) ||
      m.maintenance_type.toLowerCase().includes(lowerQuery) ||
      m.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    ) || [];
  }, [maintenanceWorks.data]);

  // ---------------------------------
  // Cache Info for Performance Monitoring
  // ---------------------------------
  const cacheInfo = useMemo(() => ({
    lastFetch: maintenanceWorks.lastFetch,
    itemCount: maintenanceWorks.data?.length || 0,
    staleness: isCacheStale(),
  }), [maintenanceWorks.lastFetch, maintenanceWorks.data, isCacheStale]);

  // ---------------------------------
  // Effects & Initialization
  // ---------------------------------

  // Auto-refresh when tenant changes
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshMaintenanceWorks();
    } else {
      // Clear data when no tenant
      setMaintenanceWorks({
        data: null,
        loading: false,
        error: null,
        lastFetch: null,
        stale: false,
      });
    }
  }, [tenantId, globalConfig, refreshMaintenanceWorks]);

  // Auto-refresh on stale cache
  useEffect(() => {
    if (maintenanceWorks.stale && tenantId) {
      refreshMaintenanceWorks();
    }
  }, [maintenanceWorks.stale, tenantId, refreshMaintenanceWorks]);

  // Cleanup optimistic updates on unmount
  useEffect(() => {
    return () => {
      setOptimisticUpdates([]);
    };
  }, []);

  // ---------------------------------
  // Context Provider
  // ---------------------------------
  const contextValue = useMemo(() => ({
    maintenanceWorks,
    createMaintenance,
    updateMaintenance,
    deleteMaintenance,
    refreshMaintenanceWorks,
    getMaintenance,
    invalidateCache,
    approveMaintenanceOptimistic,
    startMaintenanceOptimistic,
    completeMaintenanceOptimistic,
    filteredMaintenanceWorks,
    filters,
    setFilters,
    clearFilters,
    getMaintenanceByStatus,
    getScheduledMaintenance,
    getMyMaintenance,
    searchMaintenance,
    config,
    cacheInfo,
  }), [
    maintenanceWorks,
    createMaintenance,
    updateMaintenance, 
    deleteMaintenance,
    refreshMaintenanceWorks,
    getMaintenance,
    invalidateCache,
    approveMaintenanceOptimistic,
    startMaintenanceOptimistic,
    completeMaintenanceOptimistic,
    filteredMaintenanceWorks,
    filters,
    setFilters,
    clearFilters,
    getMaintenanceByStatus,
    getScheduledMaintenance,
    getMyMaintenance,
    searchMaintenance,
    config,
    cacheInfo,
  ]);

  return (
    <MaintenanceContext.Provider value={contextValue}>
      {children}
    </MaintenanceContext.Provider>
  );
};

// ---------------------------------
// 4. Frontend-Focused Hooks
// ---------------------------------

/**
 * Main maintenance context hook
 */
export const useMaintenanceWorks = () => {
  const ctx = useContext(MaintenanceContext);
  if (!ctx) throw new Error("useMaintenanceWorks must be used within MaintenanceProvider");
  return ctx;
};

/**
 * Individual maintenance work hook with error boundary
 */
export const useMaintenanceWork = (id: string) => {
  const { maintenanceWorks, getMaintenance } = useMaintenanceWorks();
  const [maintenance, setMaintenance] = useState<MaintenanceWork | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // First try cache
    const cached = maintenanceWorks.data?.find(m => m.id === id);
    if (cached) {
      setMaintenance(cached);
      return;
    }

    // Fetch individual if not in cache
    setLoading(true);
    setError(null);
    
    getMaintenance(id)
      .then(setMaintenance)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load maintenance'))
      .finally(() => setLoading(false));
  }, [id, maintenanceWorks.data, getMaintenance]);

  return { maintenance, loading, error };
};

/**
 * Selective subscription for performance
 */
export const useMaintenanceByStatus = (status: string) => {
  const { getMaintenanceByStatus, maintenanceWorks } = useMaintenanceWorks();
  return useMemo(() => getMaintenanceByStatus(status), [getMaintenanceByStatus, status, maintenanceWorks.data]);
};

/**
 * My assignments hook
 */
export const useMyMaintenance = (userId: string) => {
  const { getMyMaintenance, maintenanceWorks } = useMaintenanceWorks();
  return useMemo(() => getMyMaintenance(userId), [getMyMaintenance, userId, maintenanceWorks.data]);
};

/**
 * Performance monitoring hook
 */
export const useMaintenancePerformance = () => {
  const { cacheInfo, maintenanceWorks } = useMaintenanceWorks();
  
  return {
    ...cacheInfo,
    hasError: !!maintenanceWorks.error,
    isLoading: maintenanceWorks.loading,
    errorMessage: maintenanceWorks.error,
  };
};