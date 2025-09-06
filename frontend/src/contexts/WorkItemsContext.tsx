// src/contexts/WorkItemsContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import { getAll, getById, putWithAudit, removeWithAudit } from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";
import { ExternalSystemFields } from "../types/externalSystem";
import { 
  useIncidents, 
  useServiceRequests, 
  useChangeRequests, 
  useProblems, 
  useMaintenanceWorks 
} from "../contexts";

// ---------------------------------
// 1. Frontend State Types
// ---------------------------------

export type WorkItemType =
  | "incident"
  | "service_request"
  | "change"
  | "problem"
  | "maintenance";

export interface WorkItem extends ExternalSystemFields {
  id: string;
  type: WorkItemType;
  title: string;
  status: string;
  priority?: string;
  created_at: string;
  updated_at: string;
  assigned_to_user_id?: string | null;
  assigned_to_team_id?: string | null;
  business_service_id?: string | null;
  // UI-specific fields
  smart_score?: number; // Provided by backend API
  sla_breach_risk?: 'low' | 'medium' | 'high' | 'critical'; // Backend calculated
  ai_recommendations?: Array<{
    type: 'priority' | 'assignment' | 'resolution';
    confidence: number;
    suggestion: string;
  }>; // Backend provided
  // External system fields for ITSM integration inherited from ExternalSystemFields
}

export interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  lastFetch: string | null;
  isStale: boolean;
}

export interface WorkItemFilters {
  type?: WorkItemType;
  status?: string;
  priority?: string;
  assigned_to_user_id?: string;
  assigned_to_team_id?: string;
  business_service_id?: string;
  search?: string;
  sla_breach_risk?: string;
  // External system filtering
  sourceSystems?: string[];
  syncStatus?: ('synced' | 'syncing' | 'error' | 'conflict')[];
  hasConflicts?: boolean;
  hasLocalChanges?: boolean;
  dataCompleteness?: { min: number; max: number };
}

export interface WorkItemUIState {
  selectedItems: Set<string>;
  bulkOperationInProgress: boolean;
  optimisticUpdates: Map<string, Partial<WorkItem>>;
  lastAction: {
    type: 'create' | 'update' | 'delete' | 'bulk_assign' | 'bulk_status_change';
    timestamp: string;
    success: boolean;
    error?: string;
  } | null;
}

// ---------------------------------
// 2. Context Interface (UI-Focused)
// ---------------------------------

interface WorkItemsContextType {
  // Async state for work items
  workItems: AsyncState<WorkItem[]>;
  
  // UI state management
  uiState: WorkItemUIState;
  filters: WorkItemFilters;
  
  // Data operations (thin API wrappers)
  refreshWorkItems: () => Promise<void>;
  invalidateCache: () => void;
  
  // CRUD operations (optimistic UI + API calls)
  createWorkItem: (type: WorkItemType, data: Record<string, any>) => Promise<void>;
  updateWorkItem: (id: string, type: WorkItemType, updates: Record<string, any>) => Promise<void>;
  deleteWorkItem: (id: string, type: WorkItemType) => Promise<void>;
  
  // Bulk operations
  bulkAssign: (itemIds: string[], assigneeId: string, assigneeType: 'user' | 'team') => Promise<void>;
  bulkStatusUpdate: (itemIds: string[], newStatus: string) => Promise<void>;
  
  // Client-side filtering and search (for immediate UI responsiveness)
  setFilters: (newFilters: Partial<WorkItemFilters>) => void;
  clearFilters: () => void;
  getFilteredItems: () => WorkItem[];
  
  // Simple client-side utilities
  getItemsByType: (type: WorkItemType) => WorkItem[];
  getItemsByStatus: (status: string) => WorkItem[];
  getItemsByAssignee: (assigneeId: string, assigneeType: 'user' | 'team') => WorkItem[];
  getHighPriorityItems: () => WorkItem[];
  searchItems: (query: string) => WorkItem[];
  
  // Selection management (UI only)
  selectItem: (id: string) => void;
  deselectItem: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  
  // Cache management
  getCacheInfo: () => {
    itemCount: number;
    lastFetch: string | null;
    isStale: boolean;
    cacheSize: number;
  };
}

// ---------------------------------
// 3. Context Implementation
// ---------------------------------

const WorkItemsContext = createContext<WorkItemsContextType | undefined>(undefined);

// Cache TTL configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const STALE_THRESHOLD_MS = 2 * 60 * 1000; // Consider stale after 2 minutes

export const WorkItemsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config } = useConfig();
  
  // Get individual context data
  const { incidents } = useIncidents();
  const { serviceRequests } = useServiceRequests();
  const { changeRequests } = useChangeRequests();
  const { problems } = useProblems();
  const { maintenanceWorks } = useMaintenanceWorks();

  // Async state
  const [workItems, setWorkItems] = useState<AsyncState<WorkItem[]>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    isStale: false,
  });

  // UI state
  const [uiState, setUiState] = useState<WorkItemUIState>({
    selectedItems: new Set(),
    bulkOperationInProgress: false,
    optimisticUpdates: new Map(),
    lastAction: null,
  });

  const [filters, setFiltersState] = useState<WorkItemFilters>({});

  // ---------------------------------
  // Data Aggregation (Client-Side Only)
  // ---------------------------------

  const aggregateWorkItems = useCallback((): WorkItem[] => {
    const incidentItems: WorkItem[] = incidents.map((i) => ({
      id: i.id,
      type: "incident" as const,
      title: i.title,
      status: i.status,
      priority: i.priority,
      created_at: i.created_at,
      updated_at: i.updated_at,
      assigned_to_user_id: i.assigned_to_user_id,
      assigned_to_team_id: i.assigned_to_team_id,
      business_service_id: i.business_service_id,
      // Backend-provided AI fields
      smart_score: i.smart_score,
      sla_breach_risk: i.sla_breach_risk,
      ai_recommendations: i.ai_recommendations,
    }));

    const serviceRequestItems: WorkItem[] = serviceRequests.map((sr) => ({
      id: sr.id,
      type: "service_request" as const,
      title: sr.title,
      status: sr.status,
      priority: sr.priority,
      created_at: sr.created_at,
      updated_at: sr.updated_at,
      assigned_to_user_id: sr.assigned_to_user_id,
      assigned_to_team_id: sr.assigned_to_team_id,
      business_service_id: sr.business_service_id,
      smart_score: sr.smart_score,
      sla_breach_risk: sr.sla_breach_risk,
      ai_recommendations: sr.ai_recommendations,
    }));

    const changeRequestItems: WorkItem[] = changeRequests.map((cr) => ({
      id: cr.id,
      type: "change" as const,
      title: cr.title,
      status: cr.status,
      priority: cr.priority,
      created_at: cr.created_at,
      updated_at: cr.updated_at,
      assigned_to_user_id: cr.implementer_user_ids?.[0] || null,
      assigned_to_team_id: cr.assigned_team_id || null,
      business_service_id: cr.business_service_id,
      smart_score: cr.smart_score,
      sla_breach_risk: cr.sla_breach_risk,
      ai_recommendations: cr.ai_recommendations,
    }));

    const problemItems: WorkItem[] = problems.map((p) => ({
      id: p.id,
      type: "problem" as const,
      title: p.title,
      status: p.status,
      priority: p.priority,
      created_at: p.created_at,
      updated_at: p.updated_at,
      assigned_to_user_id: p.assigned_to_user_id,
      assigned_to_team_id: p.assigned_to_team_id,
      business_service_id: p.business_service_id,
      smart_score: p.smart_score,
      sla_breach_risk: p.sla_breach_risk,
      ai_recommendations: p.ai_recommendations,
    }));

    const maintenanceItems: WorkItem[] = maintenanceWorks.map((m) => ({
      id: m.id,
      type: "maintenance" as const,
      title: m.title,
      status: m.status,
      priority: m.priority,
      created_at: m.created_at,
      updated_at: m.updated_at,
      assigned_to_user_id: m.assigned_to_user_id,
      assigned_to_team_id: m.assigned_to_team_id,
      business_service_id: m.business_service_id,
      smart_score: m.smart_score,
      sla_breach_risk: m.sla_breach_risk,
      ai_recommendations: m.ai_recommendations,
    }));

    return [
      ...incidentItems,
      ...serviceRequestItems,
      ...changeRequestItems,
      ...problemItems,
      ...maintenanceItems,
    ];
  }, [incidents, serviceRequests, changeRequests, problems, maintenanceWorks]);

  // ---------------------------------
  // Cache Management & Staleness
  // ---------------------------------

  useEffect(() => {
    const items = aggregateWorkItems();
    const now = new Date().toISOString();
    const isStale = workItems.lastFetch 
      ? Date.now() - new Date(workItems.lastFetch).getTime() > STALE_THRESHOLD_MS
      : true;

    setWorkItems(prev => ({
      ...prev,
      data: items,
      lastFetch: now,
      isStale,
    }));
  }, [incidents, serviceRequests, changeRequests, problems, maintenanceWorks]);

  // Auto-refresh stale data
  useEffect(() => {
    if (!tenantId || !workItems.isStale) return;
    
    const refreshTimer = setTimeout(() => {
      refreshWorkItems();
    }, 30000); // Refresh stale data after 30 seconds

    return () => clearTimeout(refreshTimer);
  }, [workItems.isStale, tenantId]);

  // ---------------------------------
  // API Operations (Thin Wrappers)
  // ---------------------------------

  const refreshWorkItems = useCallback(async () => {
    if (!tenantId) return;

    setWorkItems(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Trigger refresh of all individual contexts
      // This is a UI coordination operation, not business logic
      const refreshPromises = [
        // Note: These would be calls to refresh methods from individual contexts
        // The business logic stays in those contexts and their backend APIs
      ];

      await Promise.all(refreshPromises);
      
      const now = new Date().toISOString();
      setWorkItems(prev => ({
        ...prev,
        loading: false,
        lastFetch: now,
        isStale: false,
      }));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh work items';
      setWorkItems(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  }, [tenantId]);

  const invalidateCache = useCallback(() => {
    setWorkItems(prev => ({ ...prev, isStale: true }));
  }, []);

  // ---------------------------------
  // CRUD Operations with Optimistic Updates
  // ---------------------------------

  const showOptimisticUpdate = useCallback((id: string, updates: Partial<WorkItem>) => {
    setUiState(prev => ({
      ...prev,
      optimisticUpdates: new Map(prev.optimisticUpdates).set(id, updates),
    }));
  }, []);

  const clearOptimisticUpdate = useCallback((id: string) => {
    setUiState(prev => {
      const newUpdates = new Map(prev.optimisticUpdates);
      newUpdates.delete(id);
      return { ...prev, optimisticUpdates: newUpdates };
    });
  }, []);

  const recordAction = useCallback((
    type: WorkItemUIState['lastAction']['type'], 
    success: boolean, 
    error?: string
  ) => {
    setUiState(prev => ({
      ...prev,
      lastAction: {
        type,
        timestamp: new Date().toISOString(),
        success,
        error,
      },
    }));
  }, []);

  const createWorkItem = useCallback(async (
    type: WorkItemType, 
    data: Record<string, any>
  ) => {
    if (!tenantId) throw new Error("No tenant selected");

    const tempId = `temp_${Date.now()}`;
    
    // Optimistic UI update
    showOptimisticUpdate(tempId, {
      id: tempId,
      type,
      title: data.title || 'New Item',
      status: 'new',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...data,
    });

    try {
      // Make API call - backend handles ALL business logic
      const response = await fetch(`/api/work-items/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Failed to create ${type}: ${response.statusText}`);
      }

      const createdItem = await response.json();
      
      // Clear optimistic update
      clearOptimisticUpdate(tempId);
      recordAction('create', true);
      
      // Refresh to get the real data
      await refreshWorkItems();

    } catch (err) {
      clearOptimisticUpdate(tempId);
      const errorMessage = err instanceof Error ? err.message : 'Creation failed';
      recordAction('create', false, errorMessage);
      throw err;
    }
  }, [tenantId, showOptimisticUpdate, clearOptimisticUpdate, recordAction, refreshWorkItems]);

  const updateWorkItem = useCallback(async (
    id: string,
    type: WorkItemType,
    updates: Record<string, any>
  ) => {
    if (!tenantId) throw new Error("No tenant selected");

    // Optimistic UI update
    showOptimisticUpdate(id, { ...updates, updated_at: new Date().toISOString() });

    try {
      // Make API call - backend handles validation and business rules
      const response = await fetch(`/api/work-items/${type}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update ${type}: ${response.statusText}`);
      }

      const updatedItem = await response.json();
      
      clearOptimisticUpdate(id);
      recordAction('update', true);
      
      // Refresh to get updated data including any backend calculations
      await refreshWorkItems();

    } catch (err) {
      clearOptimisticUpdate(id);
      const errorMessage = err instanceof Error ? err.message : 'Update failed';
      recordAction('update', false, errorMessage);
      throw err;
    }
  }, [tenantId, showOptimisticUpdate, clearOptimisticUpdate, recordAction, refreshWorkItems]);

  const deleteWorkItem = useCallback(async (id: string, type: WorkItemType) => {
    if (!tenantId) throw new Error("No tenant selected");

    // Optimistic UI removal
    showOptimisticUpdate(id, { deleted: true } as any);

    try {
      const response = await fetch(`/api/work-items/${type}/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete ${type}: ${response.statusText}`);
      }

      clearOptimisticUpdate(id);
      recordAction('delete', true);
      await refreshWorkItems();

    } catch (err) {
      clearOptimisticUpdate(id);
      const errorMessage = err instanceof Error ? err.message : 'Deletion failed';
      recordAction('delete', false, errorMessage);
      throw err;
    }
  }, [tenantId, showOptimisticUpdate, clearOptimisticUpdate, recordAction, refreshWorkItems]);

  // ---------------------------------
  // Bulk Operations
  // ---------------------------------

  const bulkAssign = useCallback(async (
    itemIds: string[],
    assigneeId: string,
    assigneeType: 'user' | 'team'
  ) => {
    if (!tenantId) throw new Error("No tenant selected");

    setUiState(prev => ({ ...prev, bulkOperationInProgress: true }));

    // Optimistic updates for all items
    itemIds.forEach(id => {
      const assignmentField = assigneeType === 'user' ? 'assigned_to_user_id' : 'assigned_to_team_id';
      showOptimisticUpdate(id, { [assignmentField]: assigneeId });
    });

    try {
      const response = await fetch('/api/work-items/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_ids: itemIds,
          assignee_id: assigneeId,
          assignee_type: assigneeType,
        }),
      });

      if (!response.ok) {
        throw new Error(`Bulk assignment failed: ${response.statusText}`);
      }

      // Clear optimistic updates
      itemIds.forEach(id => clearOptimisticUpdate(id));
      recordAction('bulk_assign', true);
      await refreshWorkItems();

    } catch (err) {
      // Rollback optimistic updates
      itemIds.forEach(id => clearOptimisticUpdate(id));
      const errorMessage = err instanceof Error ? err.message : 'Bulk assignment failed';
      recordAction('bulk_assign', false, errorMessage);
      throw err;
    } finally {
      setUiState(prev => ({ ...prev, bulkOperationInProgress: false }));
    }
  }, [tenantId, showOptimisticUpdate, clearOptimisticUpdate, recordAction, refreshWorkItems]);

  const bulkStatusUpdate = useCallback(async (itemIds: string[], newStatus: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    setUiState(prev => ({ ...prev, bulkOperationInProgress: true }));

    // Optimistic updates
    itemIds.forEach(id => {
      showOptimisticUpdate(id, { status: newStatus, updated_at: new Date().toISOString() });
    });

    try {
      const response = await fetch('/api/work-items/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_ids: itemIds,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        throw new Error(`Bulk status update failed: ${response.statusText}`);
      }

      itemIds.forEach(id => clearOptimisticUpdate(id));
      recordAction('bulk_status_change', true);
      await refreshWorkItems();

    } catch (err) {
      itemIds.forEach(id => clearOptimisticUpdate(id));
      const errorMessage = err instanceof Error ? err.message : 'Bulk status update failed';
      recordAction('bulk_status_change', false, errorMessage);
      throw err;
    } finally {
      setUiState(prev => ({ ...prev, bulkOperationInProgress: false }));
    }
  }, [tenantId, showOptimisticUpdate, clearOptimisticUpdate, recordAction, refreshWorkItems]);

  // ---------------------------------
  // Client-Side Filtering & Search (UI Only)
  // ---------------------------------

  const setFilters = useCallback((newFilters: Partial<WorkItemFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState({});
  }, []);

  const getFilteredItems = useCallback((): WorkItem[] => {
    let items = workItems.data;

    // Apply optimistic updates
    items = items.map(item => {
      const optimisticUpdate = uiState.optimisticUpdates.get(item.id);
      return optimisticUpdate ? { ...item, ...optimisticUpdate } : item;
    });

    // Apply filters
    if (filters.type) {
      items = items.filter(item => item.type === filters.type);
    }
    
    if (filters.status) {
      items = items.filter(item => item.status === filters.status);
    }
    
    if (filters.priority) {
      items = items.filter(item => item.priority === filters.priority);
    }
    
    if (filters.assigned_to_user_id) {
      items = items.filter(item => item.assigned_to_user_id === filters.assigned_to_user_id);
    }
    
    if (filters.assigned_to_team_id) {
      items = items.filter(item => item.assigned_to_team_id === filters.assigned_to_team_id);
    }
    
    if (filters.business_service_id) {
      items = items.filter(item => item.business_service_id === filters.business_service_id);
    }

    if (filters.sla_breach_risk) {
      items = items.filter(item => item.sla_breach_risk === filters.sla_breach_risk);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      items = items.filter(item =>
        item.title.toLowerCase().includes(searchLower) ||
        item.id.toLowerCase().includes(searchLower)
      );
    }

    return items;
  }, [workItems.data, uiState.optimisticUpdates, filters]);

  // ---------------------------------
  // Simple Client-Side Utilities
  // ---------------------------------

  const getItemsByType = useCallback((type: WorkItemType): WorkItem[] => {
    return getFilteredItems().filter(item => item.type === type);
  }, [getFilteredItems]);

  const getItemsByStatus = useCallback((status: string): WorkItem[] => {
    return getFilteredItems().filter(item => item.status === status);
  }, [getFilteredItems]);

  const getItemsByAssignee = useCallback((
    assigneeId: string,
    assigneeType: 'user' | 'team'
  ): WorkItem[] => {
    const field = assigneeType === 'user' ? 'assigned_to_user_id' : 'assigned_to_team_id';
    return getFilteredItems().filter(item => item[field] === assigneeId);
  }, [getFilteredItems]);

  const getHighPriorityItems = useCallback((): WorkItem[] => {
    return getFilteredItems().filter(item => 
      item.priority === 'critical' || 
      item.priority === 'high' ||
      item.sla_breach_risk === 'high' ||
      item.sla_breach_risk === 'critical'
    );
  }, [getFilteredItems]);

  const searchItems = useCallback((query: string): WorkItem[] => {
    const lowerQuery = query.toLowerCase();
    return workItems.data.filter(item =>
      item.title.toLowerCase().includes(lowerQuery) ||
      item.id.toLowerCase().includes(lowerQuery) ||
      item.type.toLowerCase().includes(lowerQuery)
    );
  }, [workItems.data]);

  // ---------------------------------
  // Selection Management (UI Only)
  // ---------------------------------

  const selectItem = useCallback((id: string) => {
    setUiState(prev => ({
      ...prev,
      selectedItems: new Set(prev.selectedItems).add(id),
    }));
  }, []);

  const deselectItem = useCallback((id: string) => {
    setUiState(prev => {
      const newSelection = new Set(prev.selectedItems);
      newSelection.delete(id);
      return { ...prev, selectedItems: newSelection };
    });
  }, []);

  const selectAll = useCallback(() => {
    const allIds = getFilteredItems().map(item => item.id);
    setUiState(prev => ({
      ...prev,
      selectedItems: new Set(allIds),
    }));
  }, [getFilteredItems]);

  const clearSelection = useCallback(() => {
    setUiState(prev => ({
      ...prev,
      selectedItems: new Set(),
    }));
  }, []);

  // ---------------------------------
  // Cache Info
  // ---------------------------------

  const getCacheInfo = useCallback(() => {
    return {
      itemCount: workItems.data.length,
      lastFetch: workItems.lastFetch,
      isStale: workItems.isStale,
      cacheSize: JSON.stringify(workItems.data).length, // Rough estimate
    };
  }, [workItems]);

  // ---------------------------------
  // Cleanup on unmount
  // ---------------------------------

  useEffect(() => {
    return () => {
      // Clear large datasets from memory
      setWorkItems(prev => ({ ...prev, data: [] }));
      setUiState(prev => ({
        ...prev,
        optimisticUpdates: new Map(),
        selectedItems: new Set(),
      }));
    };
  }, []);

  const contextValue: WorkItemsContextType = useMemo(() => ({
    workItems,
    uiState,
    filters,
    refreshWorkItems,
    invalidateCache,
    createWorkItem,
    updateWorkItem,
    deleteWorkItem,
    bulkAssign,
    bulkStatusUpdate,
    setFilters,
    clearFilters,
    getFilteredItems,
    getItemsByType,
    getItemsByStatus,
    getItemsByAssignee,
    getHighPriorityItems,
    searchItems,
    selectItem,
    deselectItem,
    selectAll,
    clearSelection,
    getCacheInfo,
  }), [
    workItems,
    uiState,
    filters,
    refreshWorkItems,
    invalidateCache,
    createWorkItem,
    updateWorkItem,
    deleteWorkItem,
    bulkAssign,
    bulkStatusUpdate,
    setFilters,
    clearFilters,
    getFilteredItems,
    getItemsByType,
    getItemsByStatus,
    getItemsByAssignee,
    getHighPriorityItems,
    searchItems,
    selectItem,
    deselectItem,
    selectAll,
    clearSelection,
    getCacheInfo,
  ]);

  return (
    <WorkItemsContext.Provider value={contextValue}>
      {children}
    </WorkItemsContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------

export const useWorkItems = () => {
  const ctx = useContext(WorkItemsContext);
  if (!ctx) {
    throw new Error("useWorkItems must be used within WorkItemsProvider");
  }
  return ctx;
};

// Specialized hooks for specific use cases
export const useWorkItemsData = () => {
  const { workItems } = useWorkItems();
  return workItems;
};

export const useWorkItemDetails = (id: string, type: WorkItemType) => {
  const { workItems } = useWorkItems();
  
  return useMemo(() => {
    const item = workItems.data.find(item => item.id === id && item.type === type);
    
    // For detailed views, make API call to get full details
    // This would be implemented as a separate API call
    return {
      item,
      loading: workItems.loading,
      error: workItems.error,
      // TODO: Add full details fetch logic here
    };
  }, [id, type, workItems]);
};

export const useWorkItemsFiltered = (
  customFilters?: Partial<WorkItemFilters>
): WorkItem[] => {
  const { getFilteredItems, filters } = useWorkItems();
  
  return useMemo(() => {
    if (!customFilters) return getFilteredItems();
    
    // Apply custom filters on top of current filters
    let items = getFilteredItems();
    
    if (customFilters.type) {
      items = items.filter(item => item.type === customFilters.type);
    }
    
    if (customFilters.search) {
      const searchLower = customFilters.search.toLowerCase();
      items = items.filter(item =>
        item.title.toLowerCase().includes(searchLower)
      );
    }
    
    return items;
  }, [getFilteredItems, customFilters, filters]);
};

export const useWorkItemsByAssignee = (userId?: string) => {
  const { getItemsByAssignee } = useWorkItems();
  
  return useMemo(() => {
    if (!userId) return [];
    return getItemsByAssignee(userId, 'user');
  }, [getItemsByAssignee, userId]);
};

export const useWorkItemSelection = () => {
  const {
    uiState,
    selectItem,
    deselectItem,
    selectAll,
    clearSelection,
  } = useWorkItems();

  return {
    selectedItems: uiState.selectedItems,
    selectedCount: uiState.selectedItems.size,
    selectItem,
    deselectItem,
    selectAll,
    clearSelection,
    hasSelection: uiState.selectedItems.size > 0,
  };
};