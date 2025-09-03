import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from "react";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";

// ---------------------------------
// 1. Core Type Definitions
// ---------------------------------

/**
 * Work item types supported by the system
 */
export type WorkItemType =
  | "incident"
  | "service_request"
  | "change"
  | "problem"
  | "maintenance";

/**
 * Base WorkItem entity structure - matches backend API response
 */
export interface WorkItem {
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
  
  // Backend-calculated AI fields (never calculated in frontend)
  smart_score?: number;
  sla_breach_risk?: 'low' | 'medium' | 'high' | 'critical';
  ai_recommendations?: Array<{
    type: 'priority' | 'assignment' | 'resolution';
    confidence: number;
    suggestion: string;
  }>;
  
  // Additional backend-provided metadata
  custom_fields?: Record<string, any>;
}

/**
 * Frontend-specific async state wrapper for UI state management
 */
export interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  lastFetch: number | null;
  stale: boolean;
}

/**
 * Basic UI filters for client-side responsiveness
 */
export interface WorkItemUIFilters {
  type?: WorkItemType;
  status?: string;
  priority?: string;
  assigned_to_user_id?: string;
  assigned_to_team_id?: string;
  business_service_id?: string;
  searchQuery?: string;
  sla_breach_risk?: string;
  tags?: string[];
}

/**
 * UI state for bulk operations and selections
 */
export interface WorkItemUIState {
  selectedItems: Set<string>;
  bulkOperationInProgress: boolean;
  lastAction: {
    type: 'create' | 'update' | 'delete' | 'bulk_assign' | 'bulk_status_change';
    timestamp: number;
    success: boolean;
    error?: string;
  } | null;
}

/**
 * API operation tracking for optimistic updates
 */
interface ApiOperation<T> {
  optimisticId?: string;
  promise: Promise<T>;
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------

interface WorkItemsContextType {
  // Async state exposure
  workItemsState: AsyncState<WorkItem[]>;
  uiState: WorkItemUIState;
  
  // Core CRUD operations (API orchestration only)
  createWorkItem: (type: WorkItemType, data: Record<string, any>) => Promise<WorkItem>;
  updateWorkItem: (id: string, updates: Partial<WorkItem>) => Promise<WorkItem>;
  deleteWorkItem: (id: string) => Promise<void>;
  
  // Bulk operations
  bulkAssign: (itemIds: string[], assigneeId: string, assigneeType: 'user' | 'team') => Promise<void>;
  bulkStatusUpdate: (itemIds: string[], newStatus: string) => Promise<void>;
  
  // Data management
  refreshWorkItems: () => Promise<void>;
  invalidateCache: () => void;
  
  // UI helpers for performance
  getFilteredWorkItems: (filters: WorkItemUIFilters) => WorkItem[];
  searchWorkItems: (query: string) => WorkItem[];
  
  // Selective subscription helpers
  getWorkItemsByType: (type: WorkItemType) => WorkItem[];
  getWorkItemsByStatus: (status: string) => WorkItem[];
  getWorkItemsByAssignee: (assigneeId: string, assigneeType: 'user' | 'team') => WorkItem[];
  getHighPriorityItems: () => WorkItem[];
  
  // Selection management (UI only)
  selectItem: (id: string) => void;
  deselectItem: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  toggleItemSelection: (id: string) => void;
  
  // Cache management
  getCacheInfo: () => {
    itemCount: number;
    lastFetch: number | null;
    isStale: boolean;
    selectedCount: number;
  };
}

const WorkItemsContext = createContext<WorkItemsContextType | undefined>(undefined);

// ---------------------------------
// 3. Configuration & Constants
// ---------------------------------

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const OPTIMISTIC_TIMEOUT = 30 * 1000; // 30 seconds
const STALE_THRESHOLD = 2 * 60 * 1000; // Consider stale after 2 minutes

// ---------------------------------
// 4. Provider Implementation
// ---------------------------------

/**
 * Enterprise WorkItems Provider
 * Handles UI state management and API orchestration for WorkItems
 * All business logic is deferred to backend APIs
 */
export const WorkItemsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config } = useConfig();

  // Core async state
  const [workItemsState, setWorkItemsState] = useState<AsyncState<WorkItem[]>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    stale: false,
  });

  // UI state
  const [uiState, setUiState] = useState<WorkItemUIState>({
    selectedItems: new Set(),
    bulkOperationInProgress: false,
    lastAction: null,
  });

  // Optimistic updates tracking
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, WorkItem>>(new Map());
  const pendingOperations = useRef<Set<string>>(new Set());

  /**
   * Update async state helper
   */
  const updateState = useCallback((updates: Partial<AsyncState<WorkItem[]>>) => {
    setWorkItemsState(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Update UI state helper
   */
  const updateUIState = useCallback((updates: Partial<WorkItemUIState>) => {
    setUiState(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Record action for UI feedback
   */
  const recordAction = useCallback((
    type: WorkItemUIState['lastAction']['type'],
    success: boolean,
    error?: string
  ) => {
    updateUIState({
      lastAction: {
        type,
        timestamp: Date.now(),
        success,
        error,
      },
    });
  }, [updateUIState]);

  /**
   * Check if cache is stale based on TTL
   */
  const isCacheStale = useCallback(() => {
    return !workItemsState.lastFetch || 
           (Date.now() - workItemsState.lastFetch) > CACHE_TTL;
  }, [workItemsState.lastFetch]);

  /**
   * API call wrapper with error handling
   */
  const apiCall = useCallback(async <T>(
    operation: () => Promise<T>,
    errorContext: string
  ): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : `${errorContext} failed`;
      updateState({ error: errorMessage });
      throw error;
    }
  }, [updateState]);

  /**
   * Refresh work items from backend
   * Backend handles all filtering, sorting, and business logic
   */
  const refreshWorkItems = useCallback(async () => {
    if (!tenantId || workItemsState.loading) return;

    updateState({ loading: true, error: null });

    try {
      // Backend API call - handles all business logic, aggregation, and AI scoring
      const response = await fetch(`/api/tenants/${tenantId}/work-items`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch work items: ${response.statusText}`);
      }

      const data: WorkItem[] = await response.json();

      updateState({
        data,
        loading: false,
        lastFetch: Date.now(),
        stale: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh work items';
      updateState({
        loading: false,
        error: errorMessage,
      });
    }
  }, [tenantId, workItemsState.loading, updateState]);

  /**
   * Create work item with optimistic UI update
   * Backend handles validation, business rules, and AI scoring
   */
  const createWorkItem = useCallback(async (
    type: WorkItemType,
    itemData: Record<string, any>
  ): Promise<WorkItem> => {
    if (!tenantId) throw new Error("No tenant selected");

    const optimisticId = `temp-${Date.now()}`;
    const optimisticItem: WorkItem = {
      id: optimisticId,
      type,
      title: itemData.title || 'New Item',
      status: 'new',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...itemData,
    };

    // Optimistic UI update
    setOptimisticUpdates(prev => new Map(prev.set(optimisticId, optimisticItem)));
    pendingOperations.current.add(optimisticId);

    try {
      // Backend handles ALL business logic, validation, and AI processing
      const response = await apiCall(async () => {
        const res = await fetch(`/api/tenants/${tenantId}/work-items/${type}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(itemData),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${res.status}: ${res.statusText}`);
        }

        return res.json();
      }, `Create ${type}`);

      // Replace optimistic update with real data
      setOptimisticUpdates(prev => {
        const updated = new Map(prev);
        updated.delete(optimisticId);
        return updated;
      });

      // Update main state
      updateState({
        data: [...workItemsState.data, response],
        stale: true,
      });

      recordAction('create', true);
      return response;
    } catch (error) {
      // Rollback optimistic update
      setOptimisticUpdates(prev => {
        const updated = new Map(prev);
        updated.delete(optimisticId);
        return updated;
      });
      recordAction('create', false, error instanceof Error ? error.message : 'Creation failed');
      throw error;
    } finally {
      pendingOperations.current.delete(optimisticId);
    }
  }, [tenantId, workItemsState.data, updateState, apiCall, recordAction]);

  /**
   * Update work item with optimistic UI update
   * Backend handles validation, business rules, and AI re-scoring
   */
  const updateWorkItem = useCallback(async (
    id: string,
    updates: Partial<WorkItem>
  ): Promise<WorkItem> => {
    if (!tenantId) throw new Error("No tenant selected");

    const existingItem = workItemsState.data.find(item => item.id === id);
    if (!existingItem) {
      throw new Error(`Work item with ID ${id} not found`);
    }

    const optimisticItem = { 
      ...existingItem, 
      ...updates, 
      updated_at: new Date().toISOString() 
    };
    
    setOptimisticUpdates(prev => new Map(prev.set(id, optimisticItem)));
    pendingOperations.current.add(id);

    try {
      // Backend handles ALL business logic, validation, and AI re-processing
      const response = await apiCall(async () => {
        const res = await fetch(`/api/tenants/${tenantId}/work-items/${existingItem.type}/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${res.status}: ${res.statusText}`);
        }

        return res.json();
      }, `Update work item`);

      // Replace optimistic update with real data
      setOptimisticUpdates(prev => {
        const updated = new Map(prev);
        updated.delete(id);
        return updated;
      });

      // Update main state
      updateState({
        data: workItemsState.data.map(item => item.id === id ? response : item),
        stale: true,
      });

      recordAction('update', true);
      return response;
    } catch (error) {
      // Rollback optimistic update
      setOptimisticUpdates(prev => {
        const updated = new Map(prev);
        updated.delete(id);
        return updated;
      });
      recordAction('update', false, error instanceof Error ? error.message : 'Update failed');
      throw error;
    } finally {
      pendingOperations.current.delete(id);
    }
  }, [tenantId, workItemsState.data, updateState, apiCall, recordAction]);

  /**
   * Delete work item with optimistic UI update
   * Backend handles deletion business rules
   */
  const deleteWorkItem = useCallback(async (id: string): Promise<void> => {
    if (!tenantId) throw new Error("No tenant selected");

    const itemToDelete = workItemsState.data.find(item => item.id === id);
    if (!itemToDelete) return;

    // Optimistic removal
    updateState({
      data: workItemsState.data.filter(item => item.id !== id),
    });

    try {
      // Backend handles ALL deletion business logic
      await apiCall(async () => {
        const res = await fetch(`/api/tenants/${tenantId}/work-items/${itemToDelete.type}/${id}`, {
          method: 'DELETE',
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${res.status}: ${res.statusText}`);
        }
      }, 'Delete work item');

      updateState({ stale: true });
      recordAction('delete', true);
    } catch (error) {
      // Rollback optimistic deletion
      updateState({
        data: [...workItemsState.data, itemToDelete],
      });
      recordAction('delete', false, error instanceof Error ? error.message : 'Deletion failed');
      throw error;
    }
  }, [tenantId, workItemsState.data, updateState, apiCall, recordAction]);

  /**
   * Bulk assign items to user or team
   * Backend handles all assignment business rules
   */
  const bulkAssign = useCallback(async (
    itemIds: string[],
    assigneeId: string,
    assigneeType: 'user' | 'team'
  ): Promise<void> => {
    if (!tenantId) throw new Error("No tenant selected");

    updateUIState({ bulkOperationInProgress: true });

    // Optimistic updates for all items
    itemIds.forEach(id => {
      const existingItem = workItemsState.data.find(item => item.id === id);
      if (existingItem) {
        const assignmentField = assigneeType === 'user' ? 'assigned_to_user_id' : 'assigned_to_team_id';
        const optimisticItem = { 
          ...existingItem, 
          [assignmentField]: assigneeId,
          updated_at: new Date().toISOString() 
        };
        setOptimisticUpdates(prev => new Map(prev.set(id, optimisticItem)));
      }
    });

    try {
      // Backend handles ALL assignment business logic and validation
      await apiCall(async () => {
        const res = await fetch(`/api/tenants/${tenantId}/work-items/bulk-assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_ids: itemIds,
            assignee_id: assigneeId,
            assignee_type: assigneeType,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${res.status}: ${res.statusText}`);
        }
      }, 'Bulk assignment');

      // Clear optimistic updates
      itemIds.forEach(id => {
        setOptimisticUpdates(prev => {
          const updated = new Map(prev);
          updated.delete(id);
          return updated;
        });
      });

      updateState({ stale: true });
      recordAction('bulk_assign', true);
    } catch (error) {
      // Rollback optimistic updates
      itemIds.forEach(id => {
        setOptimisticUpdates(prev => {
          const updated = new Map(prev);
          updated.delete(id);
          return updated;
        });
      });
      recordAction('bulk_assign', false, error instanceof Error ? error.message : 'Bulk assignment failed');
      throw error;
    } finally {
      updateUIState({ bulkOperationInProgress: false });
    }
  }, [tenantId, workItemsState.data, updateState, updateUIState, apiCall, recordAction]);

  /**
   * Bulk update status for multiple items
   * Backend handles all status change business rules
   */
  const bulkStatusUpdate = useCallback(async (
    itemIds: string[],
    newStatus: string
  ): Promise<void> => {
    if (!tenantId) throw new Error("No tenant selected");

    updateUIState({ bulkOperationInProgress: true });

    // Optimistic updates
    itemIds.forEach(id => {
      const existingItem = workItemsState.data.find(item => item.id === id);
      if (existingItem) {
        const optimisticItem = { 
          ...existingItem, 
          status: newStatus,
          updated_at: new Date().toISOString() 
        };
        setOptimisticUpdates(prev => new Map(prev.set(id, optimisticItem)));
      }
    });

    try {
      // Backend handles ALL status change business logic
      await apiCall(async () => {
        const res = await fetch(`/api/tenants/${tenantId}/work-items/bulk-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_ids: itemIds,
            status: newStatus,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${res.status}: ${res.statusText}`);
        }
      }, 'Bulk status update');

      // Clear optimistic updates
      itemIds.forEach(id => {
        setOptimisticUpdates(prev => {
          const updated = new Map(prev);
          updated.delete(id);
          return updated;
        });
      });

      updateState({ stale: true });
      recordAction('bulk_status_change', true);
    } catch (error) {
      // Rollback optimistic updates
      itemIds.forEach(id => {
        setOptimisticUpdates(prev => {
          const updated = new Map(prev);
          updated.delete(id);
          return updated;
        });
      });
      recordAction('bulk_status_change', false, error instanceof Error ? error.message : 'Bulk status update failed');
      throw error;
    } finally {
      updateUIState({ bulkOperationInProgress: false });
    }
  }, [tenantId, workItemsState.data, updateState, updateUIState, apiCall, recordAction]);

  /**
   * Invalidate cache - forces fresh fetch on next access
   */
  const invalidateCache = useCallback(() => {
    updateState({ 
      stale: true, 
      lastFetch: null,
      error: null 
    });
  }, [updateState]);

  /**
   * Get current work items with optimistic updates applied
   */
  const getCurrentWorkItems = useCallback((): WorkItem[] => {
    const baseItems = workItemsState.data;
    const result = [...baseItems];

    // Apply optimistic updates
    optimisticUpdates.forEach((optimisticItem, id) => {
      const existingIndex = result.findIndex(item => item.id === id);
      if (existingIndex >= 0) {
        result[existingIndex] = optimisticItem;
      } else if (id.startsWith('temp-')) {
        result.push(optimisticItem);
      }
    });

    return result;
  }, [workItemsState.data, optimisticUpdates]);

  /**
   * Basic client-side filtering for UI responsiveness
   * Complex business filtering should use backend APIs
   */
  const getFilteredWorkItems = useCallback((filters: WorkItemUIFilters): WorkItem[] => {
    const items = getCurrentWorkItems();

    return items.filter(item => {
      if (filters.type && item.type !== filters.type) return false;
      if (filters.status && item.status !== filters.status) return false;
      if (filters.priority && item.priority !== filters.priority) return false;
      if (filters.assigned_to_user_id && item.assigned_to_user_id !== filters.assigned_to_user_id) return false;
      if (filters.assigned_to_team_id && item.assigned_to_team_id !== filters.assigned_to_team_id) return false;
      if (filters.business_service_id && item.business_service_id !== filters.business_service_id) return false;
      if (filters.sla_breach_risk && item.sla_breach_risk !== filters.sla_breach_risk) return false;
      
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesId = item.id.toLowerCase().includes(query);
        if (!matchesTitle && !matchesId) return false;
      }
      
      return true;
    });
  }, [getCurrentWorkItems]);

  /**
   * Simple client-side search for immediate UI feedback
   */
  const searchWorkItems = useCallback((query: string): WorkItem[] => {
    return getFilteredWorkItems({ searchQuery: query });
  }, [getFilteredWorkItems]);

  /**
   * Selective subscription helper for type-specific items
   */
  const getWorkItemsByType = useCallback((type: WorkItemType): WorkItem[] => {
    return getFilteredWorkItems({ type });
  }, [getFilteredWorkItems]);

  /**
   * Selective subscription helper for status-specific items
   */
  const getWorkItemsByStatus = useCallback((status: string): WorkItem[] => {
    return getFilteredWorkItems({ status });
  }, [getFilteredWorkItems]);

  /**
   * Selective subscription helper for assignee-specific items
   */
  const getWorkItemsByAssignee = useCallback((
    assigneeId: string,
    assigneeType: 'user' | 'team'
  ): WorkItem[] => {
    const filterKey = assigneeType === 'user' ? 'assigned_to_user_id' : 'assigned_to_team_id';
    return getFilteredWorkItems({ [filterKey]: assigneeId });
  }, [getFilteredWorkItems]);

  /**
   * Get high priority items (UI convenience method)
   */
  const getHighPriorityItems = useCallback((): WorkItem[] => {
    const items = getCurrentWorkItems();
    return items.filter(item => 
      item.priority === 'critical' || 
      item.priority === 'high' ||
      item.sla_breach_risk === 'high' ||
      item.sla_breach_risk === 'critical'
    );
  }, [getCurrentWorkItems]);

  // ---------------------------------
  // Selection Management (UI Only)
  // ---------------------------------

  const selectItem = useCallback((id: string) => {
    updateUIState({
      selectedItems: new Set(uiState.selectedItems).add(id),
    });
  }, [uiState.selectedItems, updateUIState]);

  const deselectItem = useCallback((id: string) => {
    const newSelection = new Set(uiState.selectedItems);
    newSelection.delete(id);
    updateUIState({ selectedItems: newSelection });
  }, [uiState.selectedItems, updateUIState]);

  const selectAll = useCallback(() => {
    const allIds = getCurrentWorkItems().map(item => item.id);
    updateUIState({ selectedItems: new Set(allIds) });
  }, [getCurrentWorkItems, updateUIState]);

  const clearSelection = useCallback(() => {
    updateUIState({ selectedItems: new Set() });
  }, [updateUIState]);

  const toggleItemSelection = useCallback((id: string) => {
    if (uiState.selectedItems.has(id)) {
      deselectItem(id);
    } else {
      selectItem(id);
    }
  }, [uiState.selectedItems, selectItem, deselectItem]);

  /**
   * Get cache info for debugging/monitoring
   */
  const getCacheInfo = useCallback(() => {
    return {
      itemCount: workItemsState.data.length,
      lastFetch: workItemsState.lastFetch,
      isStale: workItemsState.stale,
      selectedCount: uiState.selectedItems.size,
    };
  }, [workItemsState, uiState.selectedItems.size]);

  /**
   * Auto-refresh when cache becomes stale
   */
  useEffect(() => {
    if (tenantId && isCacheStale() && !workItemsState.loading) {
      refreshWorkItems();
    }
  }, [tenantId, isCacheStale, workItemsState.loading, refreshWorkItems]);

  /**
   * Update stale flag when cache expires
   */
  useEffect(() => {
    const interval = setInterval(() => {
      if (workItemsState.lastFetch && isCacheStale() && !workItemsState.stale) {
        updateState({ stale: true });
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [workItemsState.lastFetch, workItemsState.stale, isCacheStale, updateState]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      pendingOperations.current.clear();
      setOptimisticUpdates(new Map());
      updateUIState({
        selectedItems: new Set(),
        bulkOperationInProgress: false,
        lastAction: null,
      });
    };
  }, [updateUIState]);

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo((): WorkItemsContextType => ({
    workItemsState,
    uiState,
    createWorkItem,
    updateWorkItem,
    deleteWorkItem,
    bulkAssign,
    bulkStatusUpdate,
    refreshWorkItems,
    invalidateCache,
    getFilteredWorkItems,
    searchWorkItems,
    getWorkItemsByType,
    getWorkItemsByStatus,
    getWorkItemsByAssignee,
    getHighPriorityItems,
    selectItem,
    deselectItem,
    selectAll,
    clearSelection,
    toggleItemSelection,
    getCacheInfo,
  }), [
    workItemsState,
    uiState,
    createWorkItem,
    updateWorkItem,
    deleteWorkItem,
    bulkAssign,
    bulkStatusUpdate,
    refreshWorkItems,
    invalidateCache,
    getFilteredWorkItems,
    searchWorkItems,
    getWorkItemsByType,
    getWorkItemsByStatus,
    getWorkItemsByAssignee,
    getHighPriorityItems,
    selectItem,
    deselectItem,
    selectAll,
    clearSelection,
    toggleItemSelection,
    getCacheInfo,
  ]);

  return (
    <WorkItemsContext.Provider value={contextValue}>
      {children}
    </WorkItemsContext.Provider>
  );
};

// ---------------------------------
// 5. Hooks
// ---------------------------------

/**
 * Main hook for accessing work items context
 * Throws error if used outside provider
 */
export const useWorkItems = (): WorkItemsContextType => {
  const context = useContext(WorkItemsContext);
  if (!context) {
    throw new Error('useWorkItems must be used within WorkItemsProvider');
  }
  return context;
};

/**
 * Selective subscription hook for type-specific work items
 * Optimized to prevent unnecessary re-renders
 */
export const useWorkItemsByType = (type: WorkItemType) => {
  const { getWorkItemsByType, workItemsState } = useWorkItems();
  
  return useMemo(() => ({
    items: getWorkItemsByType(type),
    loading: workItemsState.loading,
    error: workItemsState.error,
    stale: workItemsState.stale,
  }), [getWorkItemsByType, type, workItemsState.loading, workItemsState.error, workItemsState.stale]);
};

/**
 * Hook for work items assigned to specific user/team
 */
export const useWorkItemsByAssignee = (
  assigneeId: string,
  assigneeType: 'user' | 'team'
) => {
  const { getWorkItemsByAssignee, workItemsState } = useWorkItems();
  
  return useMemo(() => ({
    items: getWorkItemsByAssignee(assigneeId, assigneeType),
    loading: workItemsState.loading,
    error: workItemsState.error,
    stale: workItemsState.stale,
  }), [getWorkItemsByAssignee, assigneeId, assigneeType, workItemsState.loading, workItemsState.error, workItemsState.stale]);
};

/**
 * Hook for work items search with debouncing capability
 */
export const useWorkItemsSearch = (query: string, debounceMs: number = 300) => {
  const { searchWorkItems, workItemsState } = useWorkItems();
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  return useMemo(() => ({
    results: searchWorkItems(debouncedQuery),
    loading: workItemsState.loading,
    error: workItemsState.error,
    query: debouncedQuery,
  }), [searchWorkItems, debouncedQuery, workItemsState.loading, workItemsState.error]);
};

/**
 * Hook for filtered work items with memoization
 */
export const useFilteredWorkItems = (filters: WorkItemUIFilters) => {
  const { getFilteredWorkItems, workItemsState } = useWorkItems();
  
  return useMemo(() => ({
    items: getFilteredWorkItems(filters),
    loading: workItemsState.loading,
    error: workItemsState.error,
    stale: workItemsState.stale,
  }), [getFilteredWorkItems, filters, workItemsState.loading, workItemsState.error, workItemsState.stale]);
};

/**
 * Hook for high priority items
 */
export const useHighPriorityWorkItems = () => {
  const { getHighPriorityItems, workItemsState } = useWorkItems();
  
  return useMemo(() => ({
    items: getHighPriorityItems(),
    loading: workItemsState.loading,
    error: workItemsState.error,
    stale: workItemsState.stale,
  }), [getHighPriorityItems, workItemsState.loading, workItemsState.error, workItemsState.stale]);
};

/**
 * Hook for selection management
 */
export const useWorkItemSelection = () => {
  const {
    uiState,
    selectItem,
    deselectItem,
    selectAll,
    clearSelection,
    toggleItemSelection,
  } = useWorkItems();

  return useMemo(() => ({
    selectedItems: uiState.selectedItems,
    selectedCount: uiState.selectedItems.size,
    hasSelection: uiState.selectedItems.size > 0,
    isSelected: (id: string) => uiState.selectedItems.has(id),
    selectItem,
    deselectItem,
    selectAll,
    clearSelection,
    toggleItemSelection,
  }), [
    uiState.selectedItems,
    selectItem,
    deselectItem,
    selectAll,
    clearSelection,
    toggleItemSelection,
  ]);
};

/**
 * Hook for bulk operations
 */
export const useBulkWorkItemOperations = () => {
  const { bulkAssign, bulkStatusUpdate, uiState } = useWorkItems();
  const { selectedItems } = useWorkItemSelection();

  return useMemo(() => ({
    bulkAssign: (assigneeId: string, assigneeType: 'user' | 'team') =>
      bulkAssign(Array.from(selectedItems), assigneeId, assigneeType),
    bulkStatusUpdate: (newStatus: string) =>
      bulkStatusUpdate(Array.from(selectedItems), newStatus),
    isInProgress: uiState.bulkOperationInProgress,
    lastAction: uiState.lastAction,
    canPerformBulkOperation: selectedItems.size > 0 && !uiState.bulkOperationInProgress,
  }), [bulkAssign, bulkStatusUpdate, uiState, selectedItems]);
};