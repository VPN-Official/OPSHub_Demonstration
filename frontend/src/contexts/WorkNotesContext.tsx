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
import { AsyncState, AsyncStateHelpers } from "../types/asyncState";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";
import { ExternalSystemFields } from "../types/externalSystem";

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
  
  // External system filtering
  source_system?: string;
  sync_status?: 'synced' | 'syncing' | 'error' | 'conflict';
  has_local_changes?: boolean;
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
  abortController?: AbortController;
}

/**
 * Retry configuration for API calls
 */
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
};

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
const REQUEST_DEDUP_WINDOW = 500; // Deduplicate requests within 500ms

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

  // Optimistic updates tracking with enhanced memory management
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, WorkItem>>(new Map());
  const pendingOperations = useRef<Map<string, AbortController>>(new Map());
  const requestDedup = useRef<Map<string, number>>(new Map());
  const currentWorkItemsCache = useRef<{ items: WorkItem[], timestamp: number } | null>(null);

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
   * Clean up stale optimistic updates
   */
  const cleanupStaleOptimisticUpdates = useCallback(() => {
    const now = Date.now();
    setOptimisticUpdates(prev => {
      const updated = new Map(prev);
      let hasChanges = false;
      
      prev.forEach((item, id) => {
        // Remove optimistic updates older than timeout
        const itemAge = now - new Date(item.updated_at).getTime();
        if (itemAge > OPTIMISTIC_TIMEOUT) {
          updated.delete(id);
          hasChanges = true;
        }
      });
      
      return hasChanges ? updated : prev;
    });
  }, []);

  /**
   * Record action for UI feedback
   */
  const recordAction = useCallback((
    type: 'create' | 'update' | 'delete' | 'bulk_assign' | 'bulk_status_change',
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
   * Sleep helper for retry logic
   */
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  /**
   * Calculate exponential backoff delay
   */
  const calculateBackoffDelay = (attempt: number, config: RetryConfig): number => {
    const delay = Math.min(
      config.baseDelay * Math.pow(2, attempt - 1),
      config.maxDelay
    );
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  };

  /**
   * API call wrapper with error handling and retry logic
   */
  const apiCall = useCallback(async <T,>(
    operation: (signal: AbortSignal) => Promise<T>,
    errorContext: string,
    retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
  ): Promise<T> => {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      const abortController = new AbortController();
      
      try {
        const result = await operation(abortController.signal);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(`${errorContext} failed`);
        
        // Don't retry on abort or client errors (4xx)
        if (lastError.name === 'AbortError' || 
            (lastError.message.includes('HTTP 4') && !lastError.message.includes('HTTP 429'))) {
          break;
        }
        
        // Retry on network errors, 5xx errors, and rate limits (429)
        if (attempt < retryConfig.maxAttempts) {
          const delay = calculateBackoffDelay(attempt, retryConfig);
          console.log(`Retrying ${errorContext} after ${delay}ms (attempt ${attempt}/${retryConfig.maxAttempts})`);
          await sleep(delay);
        }
      }
    }
    
    const errorMessage = lastError?.message || `${errorContext} failed after ${retryConfig.maxAttempts} attempts`;
    updateState({ error: errorMessage });
    throw lastError || new Error(errorMessage);
  }, [updateState]);

  /**
   * Refresh work items from backend with deduplication and cancellation
   */
  const refreshWorkItems = useCallback(async () => {
    if (!tenantId || workItemsState.loading) return;

    // Request deduplication
    const dedupKey = `refresh-${tenantId}`;
    const lastRequest = requestDedup.current.get(dedupKey);
    if (lastRequest && Date.now() - lastRequest < REQUEST_DEDUP_WINDOW) {
      return;
    }
    requestDedup.current.set(dedupKey, Date.now());

    updateState({ loading: true, error: null });
    
    const abortController = new AbortController();
    const operationId = `refresh-${Date.now()}`;
    pendingOperations.current.set(operationId, abortController);

    try {
      const data = await apiCall(async (signal) => {
        const response = await fetch(`/api/tenants/${tenantId}/work-items`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
      }, 'Fetch work items');

      updateState({
        data,
        loading: false,
        lastFetch: Date.now(),
        stale: false,
      });
      
      // Clear cache when data is refreshed
      currentWorkItemsCache.current = null;
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        updateState({
          loading: false,
          error: error.message,
        });
      }
    } finally {
      pendingOperations.current.delete(operationId);
    }
  }, [tenantId, workItemsState.loading, updateState, apiCall]);

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
    const abortController = new AbortController();
    pendingOperations.current.set(optimisticId, abortController);

    try {
      // Backend handles ALL business logic, validation, and AI processing
      const response = await apiCall(async (signal) => {
        const res = await fetch(`/api/tenants/${tenantId}/work-items/${type}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(itemData),
          signal,
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
      currentWorkItemsCache.current = null; // Invalidate cache
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
    const abortController = new AbortController();
    pendingOperations.current.set(id, abortController);

    try {
      // Backend handles ALL business logic, validation, and AI re-processing
      const response = await apiCall(async (signal) => {
        const res = await fetch(`/api/tenants/${tenantId}/work-items/${existingItem.type}/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
          signal,
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
      currentWorkItemsCache.current = null; // Invalidate cache
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

    const abortController = new AbortController();
    const operationId = `delete-${id}`;
    pendingOperations.current.set(operationId, abortController);

    try {
      // Backend handles ALL deletion business logic
      await apiCall(async (signal) => {
        const res = await fetch(`/api/tenants/${tenantId}/work-items/${itemToDelete.type}/${id}`, {
          method: 'DELETE',
          signal,
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
    } finally {
      pendingOperations.current.delete(operationId);
      currentWorkItemsCache.current = null; // Invalidate cache
    }
  }, [tenantId, workItemsState.data, updateState, apiCall, recordAction]);

  /**
   * Bulk assign items to user or team with better error recovery
   */
  const bulkAssign = useCallback(async (
    itemIds: string[],
    assigneeId: string,
    assigneeType: 'user' | 'team'
  ): Promise<void> => {
    if (!tenantId) throw new Error("No tenant selected");

    updateUIState({ bulkOperationInProgress: true });

    // Store original states for rollback
    const originalStates = new Map<string, WorkItem>();
    
    // Optimistic updates for all items
    itemIds.forEach(id => {
      const existingItem = workItemsState.data.find(item => item.id === id);
      if (existingItem) {
        originalStates.set(id, existingItem);
        const assignmentField = assigneeType === 'user' ? 'assigned_to_user_id' : 'assigned_to_team_id';
        const optimisticItem = { 
          ...existingItem, 
          [assignmentField]: assigneeId,
          updated_at: new Date().toISOString() 
        };
        setOptimisticUpdates(prev => new Map(prev.set(id, optimisticItem)));
      }
    });

    const abortController = new AbortController();
    const operationId = `bulk-assign-${Date.now()}`;
    pendingOperations.current.set(operationId, abortController);

    try {
      // Backend handles ALL assignment business logic and validation
      await apiCall(async (signal) => {
        const res = await fetch(`/api/tenants/${tenantId}/work-items/bulk-assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_ids: itemIds,
            assignee_id: assigneeId,
            assignee_type: assigneeType,
          }),
          signal,
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
      // Rollback optimistic updates with original states
      setOptimisticUpdates(prev => {
        const updated = new Map(prev);
        originalStates.forEach((originalItem, id) => {
          updated.delete(id);
        });
        return updated;
      });
      recordAction('bulk_assign', false, error instanceof Error ? error.message : 'Bulk assignment failed');
      throw error;
    } finally {
      updateUIState({ bulkOperationInProgress: false });
      pendingOperations.current.delete(operationId);
      currentWorkItemsCache.current = null; // Invalidate cache
    }
  }, [tenantId, workItemsState.data, updateState, updateUIState, apiCall, recordAction]);

  /**
   * Bulk update status for multiple items with better error recovery
   */
  const bulkStatusUpdate = useCallback(async (
    itemIds: string[],
    newStatus: string
  ): Promise<void> => {
    if (!tenantId) throw new Error("No tenant selected");

    updateUIState({ bulkOperationInProgress: true });

    // Store original states for rollback
    const originalStates = new Map<string, WorkItem>();
    
    // Optimistic updates
    itemIds.forEach(id => {
      const existingItem = workItemsState.data.find(item => item.id === id);
      if (existingItem) {
        originalStates.set(id, existingItem);
        const optimisticItem = { 
          ...existingItem, 
          status: newStatus,
          updated_at: new Date().toISOString() 
        };
        setOptimisticUpdates(prev => new Map(prev.set(id, optimisticItem)));
      }
    });

    const abortController = new AbortController();
    const operationId = `bulk-status-${Date.now()}`;
    pendingOperations.current.set(operationId, abortController);

    try {
      // Backend handles ALL status change business logic
      await apiCall(async (signal) => {
        const res = await fetch(`/api/tenants/${tenantId}/work-items/bulk-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_ids: itemIds,
            status: newStatus,
          }),
          signal,
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
      // Rollback optimistic updates with original states  
      setOptimisticUpdates(prev => {
        const updated = new Map(prev);
        originalStates.forEach((originalItem, id) => {
          updated.delete(id);
        });
        return updated;
      });
      recordAction('bulk_status_change', false, error instanceof Error ? error.message : 'Bulk status update failed');
      throw error;
    } finally {
      updateUIState({ bulkOperationInProgress: false });
      pendingOperations.current.delete(operationId);
      currentWorkItemsCache.current = null; // Invalidate cache
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
    currentWorkItemsCache.current = null;
  }, [updateState]);

  /**
   * Get current work items with optimistic updates applied (with caching)
   */
  const getCurrentWorkItems = useCallback((): WorkItem[] => {
    // Check cache first (valid for 100ms to batch multiple calls in same render)
    if (currentWorkItemsCache.current && 
        Date.now() - currentWorkItemsCache.current.timestamp < 100) {
      return currentWorkItemsCache.current.items;
    }
    
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

    // Cache the result
    currentWorkItemsCache.current = {
      items: result,
      timestamp: Date.now()
    };

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
   * Clean up stale optimistic updates periodically
   */
  useEffect(() => {
    const interval = setInterval(() => {
      cleanupStaleOptimisticUpdates();
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [cleanupStaleOptimisticUpdates]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Cancel all pending operations
      pendingOperations.current.forEach((controller) => {
        controller.abort();
      });
      pendingOperations.current.clear();
      requestDedup.current.clear();
      currentWorkItemsCache.current = null;
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
 * IMPORTANT: Memoize the filters object in the consuming component to prevent infinite re-renders
 */
export const useFilteredWorkItems = (filters: WorkItemUIFilters) => {
  const { getFilteredWorkItems, workItemsState } = useWorkItems();
  
  // Stabilize the filters object to prevent unnecessary re-renders
  const stableFilters = useMemo(() => filters, [
    filters.type,
    filters.status,
    filters.priority,
    filters.assigned_to_user_id,
    filters.assigned_to_team_id,
    filters.business_service_id,
    filters.searchQuery,
    filters.sla_breach_risk,
    filters.tags?.join(','), // Convert array to stable string
  ]);
  
  return useMemo(() => ({
    items: getFilteredWorkItems(stableFilters),
    loading: workItemsState.loading,
    error: workItemsState.error,
    stale: workItemsState.stale,
  }), [getFilteredWorkItems, stableFilters, workItemsState.loading, workItemsState.error, workItemsState.stale]);
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