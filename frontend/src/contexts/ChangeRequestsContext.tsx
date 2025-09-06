// src/contexts/ChangeRequestsContext.tsx (REFACTORED - FRONTEND-ONLY)
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
import { AsyncState, AsyncStateHelpers } from "../types/asyncState";
import { 
  getAll, 
  getById, 
  putWithAudit, 
  removeWithAudit 
} from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";
import { ExternalSystemFields } from "../types/externalSystem";

// ---------------------------------
// 1. Frontend State Types
// ---------------------------------


/**
 * UI-optimized change request interface (display-focused)
 */
export interface ChangeRequest extends ExternalSystemFields {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  risk: string;
  created_at: string;
  updated_at: string;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  implemented_at?: string | null;
  closed_at?: string | null;

  // Relationships (IDs only for frontend)
  business_service_id?: string | null;
  service_component_ids: string[];
  asset_ids: string[];
  customer_id?: string | null;
  contract_id?: string | null;
  cost_center_id?: string | null;

  requested_by_end_user_id?: string | null;
  requested_by_user_id?: string | null;
  approver_user_ids: string[];
  implementer_user_ids: string[];
  assigned_team_id?: string | null;
  escalation_team_ids: string[];
  change_manager_user_id?: string | null;

  // Change properties
  change_type: string;
  category: string;
  subcategory: string;
  product_family: string;
  risk_score?: number;
  rollback_plan?: { steps: string[]; estimated_minutes: number };
  test_plan?: { steps: string[]; estimated_minutes: number };
  pre_checks: Array<{ id: string; description: string; assigned_to_user_id?: string; status: string }>;
  post_checks: Array<{ id: string; description: string; assigned_to_user_id?: string; status: string }>;

  // Approval workflow
  approval_required: boolean;
  approval_workflow: Array<{ step: string; approver_id: string; status: string; timestamp: string }>;
  change_window?: { start: string; end: string };
  conflict_with_change_ids: string[];

  // Related items
  related_incident_ids: string[];
  related_problem_ids: string[];
  related_service_request_ids: string[];
  related_change_ids: string[];
  related_log_ids: string[];
  related_metric_ids: string[];
  related_event_ids: string[];
  related_trace_ids: string[];

  // Business impact (backend-calculated values)
  business_impact?: string;
  estimated_downtime_minutes?: number;
  actual_downtime_minutes?: number | null;
  expected_business_loss?: number | null;
  actual_business_loss?: number | null;

  // AI recommendations (from backend)
  linked_recommendations: LinkedRecommendation[];

  // UI metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  tenantId?: string;
}

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

/**
 * UI-specific filters for client-side responsiveness
 */
export interface UIFilters {
  status?: string;
  priority?: string;
  risk?: string;
  change_type?: string;
  category?: string;
  business_service_id?: string;
  assigned_team_id?: string;
  assigned_to_me?: boolean;
  pending_approval?: boolean;
  scheduled_only?: boolean;
  search_query?: string;
  
  // External system filtering
  source_system?: string;
  sync_status?: 'synced' | 'syncing' | 'error' | 'conflict';
  has_local_changes?: boolean;
}

/**
 * Optimistic update tracking
 */
interface OptimisticUpdate {
  id: string;
  type: 'create' | 'update' | 'delete';
  originalData?: ChangeRequest;
  tempData?: ChangeRequest;
  timestamp: string;
}

// ---------------------------------
// 2. Context Interface (UI-Focused)
// ---------------------------------
interface ChangeRequestsContextType {
  // Core async state
  changeRequests: AsyncState<ChangeRequest[]>;
  
  // UI configuration from backend
  config: {
    statuses: string[];
    priorities: string[];
    risks: string[];
    change_types: string[];
    categories: string[];
    subcategories: string[];
    product_families: string[];
  };

  // API orchestration methods (no business logic)
  createChangeRequest: (cr: Omit<ChangeRequest, 'id' | 'created_at' | 'updated_at'>, userId?: string) => Promise<void>;
  updateChangeRequest: (id: string, updates: Partial<ChangeRequest>, userId?: string) => Promise<void>;
  deleteChangeRequest: (id: string, userId?: string) => Promise<void>;
  refreshChangeRequests: () => Promise<void>;
  getChangeRequest: (id: string) => ChangeRequest | null;

  // Change operation API calls (backend handles business logic)
  approveChange: (changeId: string, approverId: string, comments?: string) => Promise<void>;
  rejectChange: (changeId: string, approverId: string, reason: string) => Promise<void>;
  scheduleChange: (changeId: string, startTime: string, endTime: string, userId?: string) => Promise<void>;
  implementChange: (changeId: string, userId: string) => Promise<void>;
  rollbackChange: (changeId: string, userId: string, reason: string) => Promise<void>;

  // Client-side helpers for immediate UI responsiveness (no business logic)
  getFilteredChanges: (filters: UIFilters) => ChangeRequest[];
  searchChanges: (query: string) => ChangeRequest[];
  getChangesByStatus: (status: string) => ChangeRequest[];
  getChangesByPriority: (priority: string) => ChangeRequest[];
  getChangesByRisk: (risk: string) => ChangeRequest[];
  getPendingApprovals: (userId: string) => ChangeRequest[];
  getScheduledChanges: () => ChangeRequest[];

  // UI state management
  optimisticUpdates: OptimisticUpdate[];
  clearOptimisticUpdates: () => void;
  invalidateCache: () => void;
}

const ChangeRequestsContext = createContext<ChangeRequestsContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider (Frontend UI State Manager)
// ---------------------------------
export const ChangeRequestsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig, isLoading: configLoading } = useConfig();

  // Core async state
  const [changeRequests, setChangeRequests] = useState<AsyncState<ChangeRequest[]>>(
    AsyncStateHelpers.createLoading([])
  );

  // Optimistic updates tracking
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdate[]>([]);

  // Cache management
  const cacheTimeoutRef = useRef<NodeJS.Timeout>();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Extract change request configuration from backend config
   */
  const config = useMemo(() => ({
    statuses: globalConfig?.statuses?.change_requests || [],
    priorities: Object.keys(globalConfig?.priorities || {}),
    risks: Object.keys(globalConfig?.severities || {}),
    change_types: globalConfig?.work?.change_requests?.types || ['standard', 'emergency', 'normal'],
    categories: globalConfig?.work?.change_requests?.categories || ['infrastructure', 'application', 'data'],
    subcategories: globalConfig?.work?.change_requests?.subcategories || ['server', 'network', 'security'],
    product_families: globalConfig?.work?.change_requests?.product_families || ['core', 'auxiliary'],
  }), [globalConfig]);

  /**
   * Basic UI metadata enrichment (not business logic)
   */
  const ensureUIMetadata = useCallback((cr: Partial<ChangeRequest>): Partial<ChangeRequest> => {
    const now = new Date().toISOString();
    return {
      ...cr,
      tenantId,
      tags: cr.tags || [],
      health_status: cr.health_status || "gray",
      sync_status: cr.sync_status || "syncing",
      synced_at: cr.synced_at || now,
      service_component_ids: cr.service_component_ids || [],
      asset_ids: cr.asset_ids || [],
      approver_user_ids: cr.approver_user_ids || [],
      implementer_user_ids: cr.implementer_user_ids || [],
      escalation_team_ids: cr.escalation_team_ids || [],
      pre_checks: cr.pre_checks || [],
      post_checks: cr.post_checks || [],
      approval_workflow: cr.approval_workflow || [],
      conflict_with_change_ids: cr.conflict_with_change_ids || [],
      related_incident_ids: cr.related_incident_ids || [],
      related_problem_ids: cr.related_problem_ids || [],
      related_service_request_ids: cr.related_service_request_ids || [],
      related_change_ids: cr.related_change_ids || [],
      related_log_ids: cr.related_log_ids || [],
      related_metric_ids: cr.related_metric_ids || [],
      related_event_ids: cr.related_event_ids || [],
      related_trace_ids: cr.related_trace_ids || [],
      linked_recommendations: cr.linked_recommendations || [],
      approval_required: cr.approval_required ?? true,
    };
  }, [tenantId]);

  /**
   * Show optimistic update immediately for UX
   */
  const showOptimisticUpdate = useCallback((type: OptimisticUpdate['type'], id: string, tempData?: ChangeRequest, originalData?: ChangeRequest) => {
    const update: OptimisticUpdate = {
      id,
      type,
      tempData,
      originalData,
      timestamp: new Date().toISOString(),
    };

    setOptimisticUpdates(prev => [...prev, update]);

    // Apply optimistic update to UI immediately
    if (type === 'create' && tempData) {
      setChangeRequests(prev => ({
        ...prev,
        data: [tempData, ...prev.data],
      }));
    } else if (type === 'update' && tempData) {
      setChangeRequests(prev => ({
        ...prev,
        data: prev.data.map(cr => cr.id === id ? tempData : cr),
      }));
    } else if (type === 'delete') {
      setChangeRequests(prev => ({
        ...prev,
        data: prev.data.filter(cr => cr.id !== id),
      }));
    }
  }, []);

  /**
   * Rollback optimistic update on API failure
   */
  const rollbackOptimisticUpdate = useCallback((id: string) => {
    const update = optimisticUpdates.find(u => u.id === id);
    if (!update) return;

    if (update.type === 'create') {
      // Remove the optimistically added item
      setChangeRequests(prev => ({
        ...prev,
        data: prev.data.filter(cr => cr.id !== id),
      }));
    } else if (update.type === 'update' && update.originalData) {
      // Restore original data
      setChangeRequests(prev => ({
        ...prev,
        data: prev.data.map(cr => cr.id === id ? update.originalData! : cr),
      }));
    } else if (update.type === 'delete' && update.originalData) {
      // Restore deleted item
      setChangeRequests(prev => ({
        ...prev,
        data: [update.originalData!, ...prev.data],
      }));
    }

    // Remove the optimistic update
    setOptimisticUpdates(prev => prev.filter(u => u.id !== id));
  }, [optimisticUpdates]);

  /**
   * Clear successful optimistic update
   */
  const clearOptimisticUpdate = useCallback((id: string) => {
    setOptimisticUpdates(prev => prev.filter(u => u.id !== id));
  }, []);

  /**
   * Refresh data from backend API
   */
  const refreshChangeRequests = useCallback(async () => {
    if (!tenantId) return;

    setChangeRequests(prev => AsyncStateHelpers.createLoading(prev.data));

    try {
      const all = await getAll<ChangeRequest>(tenantId, "change_requests");
      
      // Simple client-side sort for UI (not business logic)
      const priorityOrder: Record<string, number> = { 'P1': 4, 'P2': 3, 'P3': 2, 'P4': 1 };
      all.sort((a, b) => {
        const aPriority = priorityOrder[a.priority] || 0;
        const bPriority = priorityOrder[b.priority] || 0;
        if (aPriority !== bPriority) return bPriority - aPriority;
        
        if (a.scheduled_start && b.scheduled_start) {
          return new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime();
        }
        
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      
      setChangeRequests(AsyncStateHelpers.createSuccess(all));

      // Set cache expiry
      if (cacheTimeoutRef.current) {
        clearTimeout(cacheTimeoutRef.current);
      }
      cacheTimeoutRef.current = setTimeout(() => {
        setChangeRequests(prev => AsyncStateHelpers.markStale(prev));
      }, CACHE_TTL);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh change requests';
      setChangeRequests(prev => AsyncStateHelpers.createError(prev.data, errorMessage));
    }
  }, [tenantId]);

  /**
   * Get single change request from cache
   */
  const getChangeRequest = useCallback((id: string): ChangeRequest | null => {
    return changeRequests.data.find(cr => cr.id === id) || null;
  }, [changeRequests.data]);

  /**
   * Create change request - API orchestration only
   */
  const createChangeRequest = useCallback(async (
    cr: Omit<ChangeRequest, 'id' | 'created_at' | 'updated_at'>, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");

    const now = new Date().toISOString();
    const tempId = `temp_${Date.now()}`;
    const enriched = ensureUIMetadata({
      ...cr,
      id: tempId,
      created_at: now,
      updated_at: now,
    }) as ChangeRequest;

    // Show optimistic update
    showOptimisticUpdate('create', tempId, enriched);

    try {
      // Backend API call - all validation and business logic handled by backend
      await putWithAudit(
        tenantId,
        "change_requests",
        enriched,
        userId,
        {
          action: "create",
          description: `Created change request: ${cr.title}`,
          tags: ["change_request", "create", cr.priority, cr.change_type],
          priority: cr.priority === 'P1' ? 'critical' : cr.change_type === 'emergency' ? 'high' : 'normal',
          metadata: {
            change_type: cr.change_type,
            category: cr.category,
            risk: cr.risk,
            approval_required: cr.approval_required,
          },
        }
      );

      // Queue for sync
      await enqueueItem({
        storeName: "change_requests",
        entityId: enriched.id,
        action: "create",
        payload: enriched,
        priority: cr.priority === 'P1' ? 'critical' : 'normal',
      });

      // Clear optimistic update and refresh
      clearOptimisticUpdate(tempId);
      await refreshChangeRequests();

    } catch (error) {
      rollbackOptimisticUpdate(tempId);
      throw error;
    }
  }, [tenantId, ensureUIMetadata, showOptimisticUpdate, enqueueItem, clearOptimisticUpdate, refreshChangeRequests, rollbackOptimisticUpdate]);

  /**
   * Update change request - API orchestration only
   */
  const updateChangeRequest = useCallback(async (
    id: string,
    updates: Partial<ChangeRequest>,
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");

    const existing = getChangeRequest(id);
    if (!existing) throw new Error(`Change request ${id} not found`);

    const updated = ensureUIMetadata({
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    }) as ChangeRequest;

    // Show optimistic update
    showOptimisticUpdate('update', id, updated, existing);

    try {
      // Backend API call - all validation and business logic handled by backend
      await putWithAudit(
        tenantId,
        "change_requests",
        updated,
        userId,
        {
          action: "update",
          description: `Updated change request: ${updated.title}`,
          tags: ["change_request", "update", updated.status],
        }
      );

      // Queue for sync
      await enqueueItem({
        storeName: "change_requests",
        entityId: id,
        action: "update",
        payload: updated,
      });

      // Clear optimistic update and refresh
      clearOptimisticUpdate(id);
      await refreshChangeRequests();

    } catch (error) {
      rollbackOptimisticUpdate(id);
      throw error;
    }
  }, [tenantId, getChangeRequest, ensureUIMetadata, showOptimisticUpdate, enqueueItem, clearOptimisticUpdate, refreshChangeRequests, rollbackOptimisticUpdate]);

  /**
   * Delete change request - API orchestration only
   */
  const deleteChangeRequest = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    const existing = getChangeRequest(id);
    if (!existing) throw new Error(`Change request ${id} not found`);

    // Show optimistic update
    showOptimisticUpdate('delete', id, undefined, existing);

    try {
      // Backend API call
      await removeWithAudit(
        tenantId,
        "change_requests",
        id,
        userId,
        {
          action: "delete",
          description: `Deleted change request: ${existing.title}`,
          tags: ["change_request", "delete"],
        }
      );

      // Queue for sync
      await enqueueItem({
        storeName: "change_requests",
        entityId: id,
        action: "delete",
        payload: null,
      });

      // Clear optimistic update and refresh
      clearOptimisticUpdate(id);
      await refreshChangeRequests();

    } catch (error) {
      rollbackOptimisticUpdate(id);
      throw error;
    }
  }, [tenantId, getChangeRequest, showOptimisticUpdate, enqueueItem, clearOptimisticUpdate, refreshChangeRequests, rollbackOptimisticUpdate]);

  // Change operation API calls (no business logic - backend handles everything)
  const approveChange = useCallback(async (changeId: string, approverId: string, comments?: string) => {
    try {
      // Call backend API - all business logic handled there
      const response = await fetch(`/api/change-requests/${changeId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approverId, comments }),
      });

      if (!response.ok) {
        throw new Error(`Approval failed: ${response.statusText}`);
      }

      await refreshChangeRequests();
    } catch (error) {
      throw error;
    }
  }, [refreshChangeRequests]);

  const rejectChange = useCallback(async (changeId: string, approverId: string, reason: string) => {
    try {
      const response = await fetch(`/api/change-requests/${changeId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approverId, reason }),
      });

      if (!response.ok) {
        throw new Error(`Rejection failed: ${response.statusText}`);
      }

      await refreshChangeRequests();
    } catch (error) {
      throw error;
    }
  }, [refreshChangeRequests]);

  const scheduleChange = useCallback(async (changeId: string, startTime: string, endTime: string, userId?: string) => {
    try {
      const response = await fetch(`/api/change-requests/${changeId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime, endTime, userId }),
      });

      if (!response.ok) {
        throw new Error(`Scheduling failed: ${response.statusText}`);
      }

      await refreshChangeRequests();
    } catch (error) {
      throw error;
    }
  }, [refreshChangeRequests]);

  const implementChange = useCallback(async (changeId: string, userId: string) => {
    try {
      const response = await fetch(`/api/change-requests/${changeId}/implement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error(`Implementation failed: ${response.statusText}`);
      }

      await refreshChangeRequests();
    } catch (error) {
      throw error;
    }
  }, [refreshChangeRequests]);

  const rollbackChange = useCallback(async (changeId: string, userId: string, reason: string) => {
    try {
      const response = await fetch(`/api/change-requests/${changeId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reason }),
      });

      if (!response.ok) {
        throw new Error(`Rollback failed: ${response.statusText}`);
      }

      await refreshChangeRequests();
    } catch (error) {
      throw error;
    }
  }, [refreshChangeRequests]);

  // Client-side helpers for immediate UI responsiveness (simple filtering only)
  const getFilteredChanges = useCallback((filters: UIFilters): ChangeRequest[] => {
    return changeRequests.data.filter(cr => {
      if (filters.status && cr.status !== filters.status) return false;
      if (filters.priority && cr.priority !== filters.priority) return false;
      if (filters.risk && cr.risk !== filters.risk) return false;
      if (filters.change_type && cr.change_type !== filters.change_type) return false;
      if (filters.category && cr.category !== filters.category) return false;
      if (filters.business_service_id && cr.business_service_id !== filters.business_service_id) return false;
      if (filters.assigned_team_id && cr.assigned_team_id !== filters.assigned_team_id) return false;
      if (filters.pending_approval && !cr.approval_workflow.some(step => step.status === 'pending')) return false;
      if (filters.scheduled_only && !cr.scheduled_start) return false;
      if (filters.search_query) {
        const query = filters.search_query.toLowerCase();
        if (!cr.title.toLowerCase().includes(query) && 
            !cr.description.toLowerCase().includes(query) &&
            !cr.change_type.toLowerCase().includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [changeRequests.data]);

  const searchChanges = useCallback((query: string): ChangeRequest[] => {
    const lowerQuery = query.toLowerCase();
    return changeRequests.data.filter(cr => 
      cr.title.toLowerCase().includes(lowerQuery) ||
      cr.description.toLowerCase().includes(lowerQuery) ||
      cr.change_type.toLowerCase().includes(lowerQuery) ||
      cr.category.toLowerCase().includes(lowerQuery) ||
      cr.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }, [changeRequests.data]);

  const getChangesByStatus = useCallback((status: string) => {
    return changeRequests.data.filter(cr => cr.status === status);
  }, [changeRequests.data]);

  const getChangesByPriority = useCallback((priority: string) => {
    return changeRequests.data.filter(cr => cr.priority === priority);
  }, [changeRequests.data]);

  const getChangesByRisk = useCallback((risk: string) => {
    return changeRequests.data.filter(cr => cr.risk === risk);
  }, [changeRequests.data]);

  const getPendingApprovals = useCallback((userId: string) => {
    return changeRequests.data.filter(cr => 
      cr.approval_workflow.some(step => 
        step.approver_id === userId && step.status === 'pending'
      )
    );
  }, [changeRequests.data]);

  const getScheduledChanges = useCallback(() => {
    const now = new Date();
    return changeRequests.data.filter(cr => 
      cr.scheduled_start && 
      new Date(cr.scheduled_start) > now &&
      cr.status === 'scheduled'
    );
  }, [changeRequests.data]);

  // UI state management helpers
  const clearOptimisticUpdates = useCallback(() => {
    setOptimisticUpdates([]);
  }, []);

  const invalidateCache = useCallback(() => {
    setChangeRequests(prev => AsyncStateHelpers.markStale(prev));
    if (cacheTimeoutRef.current) {
      clearTimeout(cacheTimeoutRef.current);
    }
  }, []);

  // Initialize and cleanup
  useEffect(() => {
    if (tenantId && globalConfig && !configLoading) {
      refreshChangeRequests();
    }
    
    return () => {
      if (cacheTimeoutRef.current) {
        clearTimeout(cacheTimeoutRef.current);
      }
    };
  }, [tenantId, globalConfig, configLoading, refreshChangeRequests]);

  // Auto-refresh when data becomes stale
  useEffect(() => {
    if (changeRequests.stale && !changeRequests.loading) {
      refreshChangeRequests();
    }
  }, [changeRequests.stale, changeRequests.loading, refreshChangeRequests]);

  const contextValue = useMemo(() => ({
    changeRequests,
    config,
    createChangeRequest,
    updateChangeRequest,
    deleteChangeRequest,
    refreshChangeRequests,
    getChangeRequest,
    approveChange,
    rejectChange,
    scheduleChange,
    implementChange,
    rollbackChange,
    getFilteredChanges,
    searchChanges,
    getChangesByStatus,
    getChangesByPriority,
    getChangesByRisk,
    getPendingApprovals,
    getScheduledChanges,
    optimisticUpdates,
    clearOptimisticUpdates,
    invalidateCache,
  }), [
    changeRequests,
    config,
    createChangeRequest,
    updateChangeRequest,
    deleteChangeRequest,
    refreshChangeRequests,
    getChangeRequest,
    approveChange,
    rejectChange,
    scheduleChange,
    implementChange,
    rollbackChange,
    getFilteredChanges,
    searchChanges,
    getChangesByStatus,
    getChangesByPriority,
    getChangesByRisk,
    getPendingApprovals,
    getScheduledChanges,
    optimisticUpdates,
    clearOptimisticUpdates,
    invalidateCache,
  ]);

  return (
    <ChangeRequestsContext.Provider value={contextValue}>
      {children}
    </ChangeRequestsContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks (UI-Optimized)
// ---------------------------------

/**
 * Main hook for change requests UI state
 */
export const useChangeRequests = () => {
  const ctx = useContext(ChangeRequestsContext);
  if (!ctx) throw new Error("useChangeRequests must be used within ChangeRequestsProvider");
  return ctx;
};

/**
 * Hook for single change request (memoized)
 */
export const useChangeRequest = (id: string) => {
  const { getChangeRequest, changeRequests } = useChangeRequests();
  
  return useMemo(() => {
    return getChangeRequest(id);
  }, [id, getChangeRequest, changeRequests.lastFetch]);
};

/**
 * Hook for filtered change requests (memoized)
 */
export const useFilteredChangeRequests = (filters: UIFilters) => {
  const { getFilteredChanges, changeRequests } = useChangeRequests();
  
  return useMemo(() => {
    return getFilteredChanges(filters);
  }, [filters, getFilteredChanges, changeRequests.lastFetch]);
};

/**
 * Hook for pending approvals (selective subscription)
 */
export const usePendingApprovals = (userId: string) => {
  const { getPendingApprovals, changeRequests } = useChangeRequests();
  
  return useMemo(() => {
    return getPendingApprovals(userId);
  }, [userId, getPendingApprovals, changeRequests.lastFetch]);
};

/**
 * Hook for scheduled changes (selective subscription)
 */
export const useScheduledChanges = () => {
  const { getScheduledChanges, changeRequests } = useChangeRequests();
  
  return useMemo(() => {
    return getScheduledChanges();
  }, [getScheduledChanges, changeRequests.lastFetch]);
};

/**
 * Hook for change request search (debounced)
 */
export const useChangeRequestSearch = (query: string, debounceMs: number = 300) => {
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const { searchChanges, changeRequests } = useChangeRequests();
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);
    
    return () => clearTimeout(handler);
  }, [query, debounceMs]);
  
  return useMemo(() => {
    return debouncedQuery ? searchChanges(debouncedQuery) : [];
  }, [debouncedQuery, searchChanges, changeRequests.lastFetch]);
};