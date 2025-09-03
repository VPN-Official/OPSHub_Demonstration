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
import { useEndUsers } from "./EndUsersContext";
import { loadConfig } from "../config/configLoader";

// ---------------------------------
// 1. Core State Management Types
// ---------------------------------

/**
 * Generic async state container for UI state management
 * Used across all data operations to provide consistent loading/error states
 */
interface AsyncState<T> {
  data: T;
  isLoading: boolean;
  error: string | null;
  lastFetch: string | null;
  isStale: boolean;
}

/**
 * Cache entry with TTL for client-side performance optimization
 */
interface CacheEntry<T> {
  data: T;
  timestamp: string;
  ttl: number;
}

/**
 * UI filtering state for immediate client-side responsiveness
 */
interface UIFilters {
  status?: string[];
  priority?: string[];
  urgency?: string[];
  assignedToMe?: boolean;
  requestType?: string[];
  search?: string;
}

/**
 * Optimistic update state for immediate UI feedback
 */
interface OptimisticUpdate {
  id: string;
  type: 'create' | 'update' | 'delete';
  timestamp: string;
  originalData?: ServiceRequest;
  pendingData?: Partial<ServiceRequest>;
}

// ---------------------------------
// 2. Business Entity Types (Backend-Driven)
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

export interface ServiceRequest {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  urgency: string;
  created_at: string;
  updated_at: string;
  fulfilled_at?: string | null;
  closed_at?: string | null;

  // Business & Service Links
  business_service_id?: string | null;
  service_component_ids: string[];
  asset_ids: string[];
  customer_id?: string | null;
  contract_id?: string | null;
  cost_center_id?: string | null;

  // People & Teams
  requested_by_end_user_id: string;
  requested_by_user_id?: string | null;
  approved_by_user_ids: string[];
  assigned_to_user_id?: string | null;
  assigned_to_team_id?: string | null;
  escalation_team_ids: string[];

  // Classification
  request_type: string;
  category: string;
  subcategory: string;
  product_family: string;

  // Fulfillment & Workflow
  fulfillment_type: string;
  approval_required: boolean;
  approval_workflow: {
    step: string;
    approver_id: string;
    status: string;
    timestamp: string;
  }[];
  tasks: {
    id: string;
    title: string;
    status: string;
    assigned_to_user_id?: string | null;
    due_at?: string | null;
  }[];
  sla_target_minutes?: number;
  resolution_due_at?: string | null;
  breached?: boolean;

  // Relationships
  related_incident_ids: string[];
  related_problem_ids: string[];
  related_change_ids: string[];

  // MELT Links
  related_log_ids: string[];
  related_metric_ids: string[];
  related_event_ids: string[];
  related_trace_ids: string[];

  // Business Impact (calculated by backend)
  business_impact?: string;
  estimated_cost?: number | null;
  actual_cost?: number | null;
  billable_hours?: number | null;
  parts_cost?: number | null;
  customer_impact_summary?: string;

  // Risk & Compliance
  risk_score?: number;
  compliance_requirement_ids: string[];

  // AI-Generated Content (from backend)
  linked_recommendations: LinkedRecommendation[];

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
  tenantId?: string;
}

export interface ServiceRequestDetails extends ServiceRequest {
  requestor?: any;
  assignee?: any;
  business_service?: any;
  customer?: any;
}

// ---------------------------------
// 3. Configuration Types (Backend-Provided)
// ---------------------------------

interface ServiceRequestConfig {
  statuses: string[];
  priorities: string[];
  urgency_levels: string[];
  request_types: string[];
  fulfillment_types: string[];
  sla_targets: Record<string, number>;
  validation_rules?: Record<string, any>;
}

// ---------------------------------
// 4. Context Interface (UI-Focused)
// ---------------------------------

interface ServiceRequestsContextType {
  // Core async state
  serviceRequestsState: AsyncState<ServiceRequest[]>;
  
  // Individual entity state
  getServiceRequestState: (id: string) => AsyncState<ServiceRequest | null>;
  
  // Backend API orchestration (no business logic)
  createServiceRequest: (request: Omit<ServiceRequest, 'id' | 'created_at' | 'updated_at'>, userId?: string) => Promise<void>;
  updateServiceRequest: (id: string, updates: Partial<ServiceRequest>, userId?: string) => Promise<void>;
  deleteServiceRequest: (id: string, userId?: string) => Promise<void>;
  refreshServiceRequests: () => Promise<void>;
  refreshServiceRequest: (id: string) => Promise<void>;
  
  // UI-specific helpers (no business rules)
  getFilteredRequests: (filters: UIFilters) => ServiceRequest[];
  searchRequests: (query: string) => ServiceRequest[];
  getRequestsByStatus: (status: string) => ServiceRequest[];
  getMyRequests: (userId: string) => ServiceRequest[];
  
  // UI state management
  filters: UIFilters;
  setFilters: (filters: Partial<UIFilters>) => void;
  clearFilters: () => void;
  
  // Configuration (from backend)
  config: ServiceRequestConfig;
  
  // Cache management
  invalidateCache: () => void;
  
  // Optimistic updates state
  optimisticUpdates: OptimisticUpdate[];
}

const ServiceRequestsContext = createContext<ServiceRequestsContextType | undefined>(
  undefined
);

// ---------------------------------
// 5. Constants & Configuration
// ---------------------------------

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const STALE_TIME_MS = 30 * 1000; // 30 seconds

const DEFAULT_FILTERS: UIFilters = {};

const createAsyncState = <T,>(initialData: T): AsyncState<T> => ({
  data: initialData,
  isLoading: false,
  error: null,
  lastFetch: null,
  isStale: false,
});

// ---------------------------------
// 6. Provider Implementation
// ---------------------------------

export const ServiceRequestsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { endUsers } = useEndUsers();

  // Core state
  const [serviceRequestsState, setServiceRequestsState] = useState<AsyncState<ServiceRequest[]>>(
    createAsyncState([])
  );
  
  // Individual entity cache
  const [entityCache, setEntityCache] = useState<Map<string, CacheEntry<AsyncState<ServiceRequest | null>>>>(
    new Map()
  );
  
  // UI state
  const [filters, setFiltersState] = useState<UIFilters>(DEFAULT_FILTERS);
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdate[]>([]);
  
  // Configuration (loaded from backend)
  const [config, setConfig] = useState<ServiceRequestConfig>({
    statuses: [],
    priorities: [],
    urgency_levels: [],
    request_types: [],
    fulfillment_types: [],
    sla_targets: {},
  });

  // ---------------------------------
  // 7. Initialization & Config Loading
  // ---------------------------------
  
  useEffect(() => {
    if (tenantId) {
      loadBackendConfig();
      refreshServiceRequests();
    } else {
      resetState();
    }
  }, [tenantId]);

  const loadBackendConfig = useCallback(async () => {
    try {
      const loadedConfig = await loadConfig(tenantId);
      setConfig(loadedConfig.work.service_request);
    } catch (error) {
      console.error('Failed to load service request configuration:', error);
      setServiceRequestsState(prev => ({
        ...prev,
        error: 'Failed to load configuration'
      }));
    }
  }, [tenantId]);

  const resetState = useCallback(() => {
    setServiceRequestsState(createAsyncState([]));
    setEntityCache(new Map());
    setFiltersState(DEFAULT_FILTERS);
    setOptimisticUpdates([]);
  }, []);

  // ---------------------------------
  // 8. Core Data Management (API Orchestration)
  // ---------------------------------

  const refreshServiceRequests = useCallback(async () => {
    if (!tenantId) return;

    setServiceRequestsState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Backend API call - all business logic handled server-side
      const requests = await getAll<ServiceRequest>(tenantId, "service_requests");
      
      const now = new Date().toISOString();
      setServiceRequestsState({
        data: requests,
        isLoading: false,
        error: null,
        lastFetch: now,
        isStale: false,
      });

      // Clear optimistic updates that have been resolved
      setOptimisticUpdates(prev => 
        prev.filter(update => 
          !requests.some(req => req.id === update.id)
        )
      );

      console.log(`✅ Loaded ${requests.length} service requests for tenant ${tenantId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load service requests';
      console.error('Service requests loading error:', errorMessage);
      
      setServiceRequestsState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, [tenantId]);

  const refreshServiceRequest = useCallback(async (id: string) => {
    if (!tenantId) return;

    const now = Date.now();
    setEntityCache(prev => {
      const newCache = new Map(prev);
      const existing = newCache.get(id);
      newCache.set(id, {
        data: {
          ...existing?.data || createAsyncState(null),
          isLoading: true,
          error: null,
        },
        timestamp: new Date().toISOString(),
        ttl: CACHE_TTL_MS,
      });
      return newCache;
    });

    try {
      const request = await getById<ServiceRequest>(tenantId, "service_requests", id);
      
      setEntityCache(prev => {
        const newCache = new Map(prev);
        newCache.set(id, {
          data: {
            data: request || null,
            isLoading: false,
            error: null,
            lastFetch: new Date().toISOString(),
            isStale: false,
          },
          timestamp: new Date().toISOString(),
          ttl: CACHE_TTL_MS,
        });
        return newCache;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load service request';
      
      setEntityCache(prev => {
        const newCache = new Map(prev);
        const existing = newCache.get(id);
        newCache.set(id, {
          data: {
            ...existing?.data || createAsyncState(null),
            isLoading: false,
            error: errorMessage,
          },
          timestamp: new Date().toISOString(),
          ttl: CACHE_TTL_MS,
        });
        return newCache;
      });
    }
  }, [tenantId]);

  // ---------------------------------
  // 9. CRUD Operations (API Orchestration Only)
  // ---------------------------------

  const createServiceRequest = useCallback(async (
    requestData: Omit<ServiceRequest, 'id' | 'created_at' | 'updated_at'>,
    userId?: string
  ) => {
    if (!tenantId) return;

    // Generate temporary ID for optimistic update
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticRequest: ServiceRequest = {
      ...requestData,
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Apply optimistic update to UI
    setOptimisticUpdates(prev => [...prev, {
      id: tempId,
      type: 'create',
      timestamp: new Date().toISOString(),
      pendingData: optimisticRequest,
    }]);

    setServiceRequestsState(prev => ({
      ...prev,
      data: [optimisticRequest, ...prev.data],
    }));

    try {
      // Backend handles ALL validation and business logic
      await putWithAudit(
        tenantId,
        "service_requests",
        optimisticRequest,
        userId,
        { action: "create", description: `Service Request "${requestData.title}" created` },
        enqueueItem
      );

      // Refresh data to get the real entity from backend
      await refreshServiceRequests();
    } catch (error) {
      // Rollback optimistic update on failure
      setOptimisticUpdates(prev => prev.filter(u => u.id !== tempId));
      setServiceRequestsState(prev => ({
        ...prev,
        data: prev.data.filter(req => req.id !== tempId),
        error: error instanceof Error ? error.message : 'Failed to create service request',
      }));
      
      throw error;
    }
  }, [tenantId, enqueueItem, refreshServiceRequests]);

  const updateServiceRequest = useCallback(async (
    id: string,
    updates: Partial<ServiceRequest>,
    userId?: string
  ) => {
    if (!tenantId) return;

    const existingRequest = serviceRequestsState.data.find(req => req.id === id);
    if (!existingRequest) {
      throw new Error('Service request not found');
    }

    const optimisticRequest = { ...existingRequest, ...updates, updated_at: new Date().toISOString() };

    // Apply optimistic update
    setOptimisticUpdates(prev => [...prev, {
      id,
      type: 'update',
      timestamp: new Date().toISOString(),
      originalData: existingRequest,
      pendingData: optimisticRequest,
    }]);

    setServiceRequestsState(prev => ({
      ...prev,
      data: prev.data.map(req => req.id === id ? optimisticRequest : req),
    }));

    try {
      // Backend handles ALL business logic and validation
      await putWithAudit(
        tenantId,
        "service_requests",
        optimisticRequest,
        userId,
        { action: "update", description: `Service Request "${optimisticRequest.title}" updated` },
        enqueueItem
      );

      await refreshServiceRequests();
    } catch (error) {
      // Rollback optimistic update
      setOptimisticUpdates(prev => prev.filter(u => u.id !== id || u.type !== 'update'));
      setServiceRequestsState(prev => ({
        ...prev,
        data: prev.data.map(req => req.id === id ? existingRequest : req),
        error: error instanceof Error ? error.message : 'Failed to update service request',
      }));
      
      throw error;
    }
  }, [tenantId, enqueueItem, refreshServiceRequests, serviceRequestsState.data]);

  const deleteServiceRequest = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) return;

    const existingRequest = serviceRequestsState.data.find(req => req.id === id);
    if (!existingRequest) return;

    // Apply optimistic update
    setOptimisticUpdates(prev => [...prev, {
      id,
      type: 'delete',
      timestamp: new Date().toISOString(),
      originalData: existingRequest,
    }]);

    setServiceRequestsState(prev => ({
      ...prev,
      data: prev.data.filter(req => req.id !== id),
    }));

    try {
      // Backend handles deletion logic
      await removeWithAudit(
        tenantId,
        "service_requests",
        id,
        userId,
        { description: `Service Request ${id} deleted` },
        enqueueItem
      );

      // Remove from individual cache
      setEntityCache(prev => {
        const newCache = new Map(prev);
        newCache.delete(id);
        return newCache;
      });
    } catch (error) {
      // Rollback optimistic update
      setOptimisticUpdates(prev => prev.filter(u => u.id !== id || u.type !== 'delete'));
      setServiceRequestsState(prev => ({
        ...prev,
        data: [...prev.data, existingRequest],
        error: error instanceof Error ? error.message : 'Failed to delete service request',
      }));
      
      throw error;
    }
  }, [tenantId, enqueueItem, serviceRequestsState.data]);

  // ---------------------------------
  // 10. UI Helper Functions (Client-Side Only)
  // ---------------------------------

  const getFilteredRequests = useCallback((filters: UIFilters): ServiceRequest[] => {
    return serviceRequestsState.data.filter(request => {
      // Simple client-side filtering for immediate UI responsiveness
      if (filters.status?.length && !filters.status.includes(request.status)) return false;
      if (filters.priority?.length && !filters.priority.includes(request.priority)) return false;
      if (filters.urgency?.length && !filters.urgency.includes(request.urgency)) return false;
      if (filters.requestType?.length && !filters.requestType.includes(request.request_type)) return false;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = 
          request.title.toLowerCase().includes(searchLower) ||
          request.description.toLowerCase().includes(searchLower) ||
          request.id.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }
      return true;
    });
  }, [serviceRequestsState.data]);

  const searchRequests = useCallback((query: string): ServiceRequest[] => {
    if (!query.trim()) return serviceRequestsState.data;
    
    const searchLower = query.toLowerCase();
    return serviceRequestsState.data.filter(request =>
      request.title.toLowerCase().includes(searchLower) ||
      request.description.toLowerCase().includes(searchLower) ||
      request.id.toLowerCase().includes(searchLower) ||
      request.tags.some(tag => tag.toLowerCase().includes(searchLower))
    );
  }, [serviceRequestsState.data]);

  const getRequestsByStatus = useCallback((status: string): ServiceRequest[] => {
    return serviceRequestsState.data.filter(request => request.status === status);
  }, [serviceRequestsState.data]);

  const getMyRequests = useCallback((userId: string): ServiceRequest[] => {
    return serviceRequestsState.data.filter(request => 
      request.assigned_to_user_id === userId || 
      request.requested_by_user_id === userId
    );
  }, [serviceRequestsState.data]);

  const getServiceRequestState = useCallback((id: string): AsyncState<ServiceRequest | null> => {
    const cached = entityCache.get(id);
    if (cached && Date.now() - new Date(cached.timestamp).getTime() < cached.ttl) {
      return cached.data;
    }
    
    // Return from main list if available
    const fromList = serviceRequestsState.data.find(req => req.id === id);
    if (fromList) {
      return {
        data: fromList,
        isLoading: false,
        error: null,
        lastFetch: serviceRequestsState.lastFetch,
        isStale: serviceRequestsState.isStale,
      };
    }
    
    // Trigger fetch if not in cache
    refreshServiceRequest(id);
    
    return createAsyncState(null);
  }, [entityCache, serviceRequestsState, refreshServiceRequest]);

  // ---------------------------------
  // 11. UI State Management
  // ---------------------------------

  const setFilters = useCallback((newFilters: Partial<UIFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  const invalidateCache = useCallback(() => {
    setEntityCache(new Map());
    setServiceRequestsState(prev => ({ ...prev, isStale: true }));
  }, []);

  // ---------------------------------
  // 12. Computed Values & Memoization
  // ---------------------------------

  const filteredRequests = useMemo(() => getFilteredRequests(filters), [getFilteredRequests, filters]);

  // ---------------------------------
  // 13. Context Value
  // ---------------------------------

  const contextValue: ServiceRequestsContextType = useMemo(() => ({
    serviceRequestsState,
    getServiceRequestState,
    createServiceRequest,
    updateServiceRequest,
    deleteServiceRequest,
    refreshServiceRequests,
    refreshServiceRequest,
    getFilteredRequests,
    searchRequests,
    getRequestsByStatus,
    getMyRequests,
    filters,
    setFilters,
    clearFilters,
    config,
    invalidateCache,
    optimisticUpdates,
  }), [
    serviceRequestsState,
    getServiceRequestState,
    createServiceRequest,
    updateServiceRequest,
    deleteServiceRequest,
    refreshServiceRequests,
    refreshServiceRequest,
    getFilteredRequests,
    searchRequests,
    getRequestsByStatus,
    getMyRequests,
    filters,
    setFilters,
    clearFilters,
    config,
    invalidateCache,
    optimisticUpdates,
  ]);

  return (
    <ServiceRequestsContext.Provider value={contextValue}>
      {children}
    </ServiceRequestsContext.Provider>
  );
};

// ---------------------------------
// 14. Hooks
// ---------------------------------

/**
 * Primary hook for accessing service requests context
 * Provides full access to service requests state and operations
 */
export const useServiceRequests = () => {
  const ctx = useContext(ServiceRequestsContext);
  if (!ctx) {
    throw new Error("useServiceRequests must be used within ServiceRequestsProvider");
  }
  return ctx;
};

/**
 * Hook for accessing service request details with related entities
 * Handles data composition and relationship mapping for UI
 */
export const useServiceRequestDetails = (id: string) => {
  const { getServiceRequestState } = useServiceRequests();
  const { endUsers } = useEndUsers();
  
  const requestState = getServiceRequestState(id);
  
  return useMemo(() => {
    if (!requestState.data) {
      return {
        ...requestState,
        data: null,
      };
    }

    const requestWithDetails: ServiceRequestDetails = {
      ...requestState.data,
      requestor: endUsers.find(u => u.id === requestState.data!.requested_by_end_user_id) || null,
      // Additional relationship data would be loaded from respective contexts
    };

    return {
      ...requestState,
      data: requestWithDetails,
    };
  }, [requestState, endUsers]);
};

/**
 * Specialized hook for filtered service requests
 * Optimized for list views with filtering requirements
 */
export const useFilteredServiceRequests = (customFilters?: Partial<UIFilters>) => {
  const { serviceRequestsState, filters, getFilteredRequests } = useServiceRequests();
  
  const effectiveFilters = useMemo(() => ({
    ...filters,
    ...customFilters,
  }), [filters, customFilters]);
  
  const filteredData = useMemo(() => 
    getFilteredRequests(effectiveFilters), 
    [getFilteredRequests, effectiveFilters]
  );
  
  return {
    ...serviceRequestsState,
    data: filteredData,
    filters: effectiveFilters,
  };
};

/**
 * Specialized hook for my service requests
 * Pre-filtered for current user's requests
 */
export const useMyServiceRequests = (userId: string) => {
  const { serviceRequestsState, getMyRequests } = useServiceRequests();
  
  const myRequests = useMemo(() => getMyRequests(userId), [getMyRequests, userId]);
  
  return {
    ...serviceRequestsState,
    data: myRequests,
  };
};