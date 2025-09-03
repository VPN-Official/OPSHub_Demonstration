// src/contexts/ActivityTimelineContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";

// ---------------------------------
// 1. Frontend-Only Type Definitions
// ---------------------------------
export type ActivityType =
  | "incident"
  | "service_request"
  | "problem"
  | "change"
  | "maintenance"
  | "alert"
  | "asset"
  | "service"
  | "knowledge"
  | "runbook"
  | "automation"
  | "ai_agent"
  | "compliance"
  | "risk"
  | "user"
  | "team"
  | "contract"
  | "vendor"
  | "customer"
  | "other";

export type ActivityAction =
  | "create"
  | "update"
  | "delete"
  | "view"
  | "assign"
  | "escalate"
  | "resolve"
  | "close"
  | "approve"
  | "reject"
  | "comment"
  | "attach"
  | "link"
  | "execute"
  | "schedule"
  | "cancel"
  | "custom";

export interface ActivityEvent {
  id: string;
  timestamp: string;
  tenantId: string;
  message: string;
  storeName: string;
  recordId: string;
  action: ActivityAction;
  entity_type: ActivityType;
  entity_name?: string;
  parent_entity_type?: ActivityType;
  parent_entity_id?: string;
  user_id?: string | null;
  team_id?: string | null;
  ai_agent_id?: string | null;
  automation_rule_id?: string | null;
  source_system?: string;
  field_changes?: Array<{
    field: string;
    old_value?: any;
    new_value?: any;
  }>;
  business_service_id?: string;
  customer_id?: string;
  cost_center_id?: string;
  priority?: "low" | "normal" | "high" | "critical";
  session_id?: string;
  ip_address?: string;
  user_agent?: string;
  device_type?: "desktop" | "mobile" | "tablet" | "api";
  execution_time_ms?: number;
  success: boolean;
  error_message?: string;
  tags: string[];
  metadata?: Record<string, any>;
  correlation_id?: string;
}

/**
 * Frontend async state wrapper for better UX
 */
interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  lastFetch: number | null;
  stale: boolean;
}

/**
 * UI-focused filter interface for client-side responsiveness
 */
interface ActivityFilters {
  entityId?: string;
  entityType?: ActivityType;
  userId?: string;
  action?: ActivityAction;
  businessServiceId?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
  success?: boolean;
  correlationId?: string;
  searchQuery?: string;
}

/**
 * Request interface for creating activities
 */
interface CreateActivityRequest {
  storeName: string;
  recordId: string;
  entity_type: ActivityType;
  entity_name?: string;
  action: ActivityAction;
  message?: string;
  user_id?: string;
  team_id?: string;
  ai_agent_id?: string;
  automation_rule_id?: string;
  source_system?: string;
  field_changes?: Array<{ field: string; old_value?: any; new_value?: any }>;
  business_service_id?: string;
  customer_id?: string;
  cost_center_id?: string;
  priority?: "low" | "normal" | "high" | "critical";
  session_id?: string;
  ip_address?: string;
  user_agent?: string;
  device_type?: "desktop" | "mobile" | "tablet" | "api";
  execution_time_ms?: number;
  success?: boolean;
  error_message?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  correlation_id?: string;
}

// ---------------------------------
// 2. API Client Layer (Thin Wrappers)
// ---------------------------------
class ActivityTimelineAPI {
  private baseUrl = '/api/activity-timeline';

  async getActivities(tenantId: string, filters?: ActivityFilters): Promise<ActivityEvent[]> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }
    
    const url = `${this.baseUrl}/${tenantId}${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch activities: ${response.statusText}`);
    }
    
    return response.json();
  }

  async createActivity(tenantId: string, activity: CreateActivityRequest): Promise<ActivityEvent> {
    const response = await fetch(`${this.baseUrl}/${tenantId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(activity),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create activity: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getActivityStats(tenantId: string, timeframe: "day" | "week" | "month") {
    const response = await fetch(`${this.baseUrl}/${tenantId}/stats?timeframe=${timeframe}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch activity stats: ${response.statusText}`);
    }
    
    return response.json();
  }

  async cleanupOldActivities(tenantId: string, olderThanDays: number): Promise<{ deletedCount: number }> {
    const response = await fetch(`${this.baseUrl}/${tenantId}/cleanup`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ olderThanDays }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to cleanup activities: ${response.statusText}`);
    }
    
    return response.json();
  }
}

// ---------------------------------
// 3. Frontend Context Interface
// ---------------------------------
interface ActivityTimelineContextType {
  // Core state
  activities: AsyncState<ActivityEvent[]>;
  
  // Data operations
  addActivity: (activity: CreateActivityRequest) => Promise<void>;
  refreshActivities: (filters?: ActivityFilters) => Promise<void>;
  
  // UI-focused client-side helpers (for immediate responsiveness)
  getFilteredActivities: (filters: ActivityFilters) => ActivityEvent[];
  searchActivities: (query: string, activities?: ActivityEvent[]) => ActivityEvent[];
  
  // Cache and performance
  invalidateCache: () => void;
  isStale: boolean;
  
  // Optimistic updates
  addOptimisticActivity: (activity: CreateActivityRequest) => string; // returns temp ID
  removeOptimisticActivity: (tempId: string) => void;
  
  // Backend operations (delegated)
  getStats: (timeframe: "day" | "week" | "month") => Promise<any>;
  cleanupOld: (olderThanDays: number) => Promise<number>;
}

const ActivityTimelineContext = createContext<ActivityTimelineContextType | undefined>(undefined);

// ---------------------------------
// 4. Provider Implementation
// ---------------------------------
export const ActivityTimelineProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  
  // Core state with AsyncState pattern
  const [activities, setActivities] = useState<AsyncState<ActivityEvent[]>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    stale: false,
  });
  
  // Optimistic updates state
  const [optimisticActivities, setOptimisticActivities] = useState<Map<string, CreateActivityRequest>>(new Map());
  
  // Cache configuration (frontend performance only)
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const api = useMemo(() => new ActivityTimelineAPI(), []);
  
  /**
   * Check if data is stale based on TTL
   */
  const isStale = useMemo(() => {
    if (!activities.lastFetch) return true;
    return Date.now() - activities.lastFetch > CACHE_TTL;
  }, [activities.lastFetch]);
  
  /**
   * Refresh activities from backend
   */
  const refreshActivities = useCallback(async (filters?: ActivityFilters) => {
    if (!tenantId) return;
    
    setActivities(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await api.getActivities(tenantId, filters);
      
      setActivities({
        data,
        loading: false,
        error: null,
        lastFetch: Date.now(),
        stale: false,
      });
    } catch (error) {
      setActivities(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch activities',
        stale: true,
      }));
    }
  }, [tenantId, api]);
  
  /**
   * Add optimistic activity for immediate UI feedback
   */
  const addOptimisticActivity = useCallback((activity: CreateActivityRequest): string => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setOptimisticActivities(prev => new Map(prev).set(tempId, activity));
    return tempId;
  }, []);
  
  /**
   * Remove optimistic activity
   */
  const removeOptimisticActivity = useCallback((tempId: string) => {
    setOptimisticActivities(prev => {
      const newMap = new Map(prev);
      newMap.delete(tempId);
      return newMap;
    });
  }, []);
  
  /**
   * Add activity with optimistic updates
   */
  const addActivity = useCallback(async (activity: CreateActivityRequest) => {
    if (!tenantId) return;
    
    // Optimistic update for immediate UI feedback
    const tempId = addOptimisticActivity(activity);
    
    try {
      // Backend handles all business logic, validation, and persistence
      const newActivity = await api.createActivity(tenantId, activity);
      
      // Remove optimistic update
      removeOptimisticActivity(tempId);
      
      // Add real activity to state
      setActivities(prev => ({
        ...prev,
        data: [newActivity, ...prev.data],
      }));
      
      // Enqueue for sync
      await enqueueItem({
        storeName: "activity_timeline",
        entityId: newActivity.id,
        action: "create",
        payload: newActivity,
        priority: activity.priority === 'critical' ? 'high' : 'low',
      });
      
    } catch (error) {
      // Remove optimistic update on failure
      removeOptimisticActivity(tempId);
      
      // Set error state
      setActivities(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to create activity',
      }));
      
      throw error; // Re-throw for caller to handle
    }
  }, [tenantId, api, enqueueItem, addOptimisticActivity, removeOptimisticActivity]);
  
  /**
   * Simple client-side filtering for UI responsiveness
   * Note: Complex business filtering should be done on backend
   */
  const getFilteredActivities = useCallback((filters: ActivityFilters): ActivityEvent[] => {
    let filtered = activities.data;
    
    // Basic UI filters for immediate responsiveness
    if (filters.entityId) {
      filtered = filtered.filter(a => a.recordId === filters.entityId);
    }
    
    if (filters.entityType) {
      filtered = filtered.filter(a => a.entity_type === filters.entityType);
    }
    
    if (filters.userId) {
      filtered = filtered.filter(a => a.user_id === filters.userId);
    }
    
    if (filters.action) {
      filtered = filtered.filter(a => a.action === filters.action);
    }
    
    if (filters.businessServiceId) {
      filtered = filtered.filter(a => a.business_service_id === filters.businessServiceId);
    }
    
    if (filters.customerId) {
      filtered = filtered.filter(a => a.customer_id === filters.customerId);
    }
    
    if (filters.success !== undefined) {
      filtered = filtered.filter(a => a.success === filters.success);
    }
    
    if (filters.correlationId) {
      filtered = filtered.filter(a => a.correlation_id === filters.correlationId);
    }
    
    // Simple date range filtering
    if (filters.startDate || filters.endDate) {
      filtered = filtered.filter(a => {
        const activityDate = new Date(a.timestamp);
        if (filters.startDate && activityDate < new Date(filters.startDate)) return false;
        if (filters.endDate && activityDate > new Date(filters.endDate)) return false;
        return true;
      });
    }
    
    return filtered;
  }, [activities.data]);
  
  /**
   * Simple client-side search for immediate UI feedback
   * Note: Advanced search should be handled by backend
   */
  const searchActivities = useCallback((query: string, activitiesToSearch?: ActivityEvent[]): ActivityEvent[] => {
    const searchTarget = activitiesToSearch || activities.data;
    
    if (!query.trim()) return searchTarget;
    
    const lowerQuery = query.toLowerCase();
    return searchTarget.filter(a => 
      a.message.toLowerCase().includes(lowerQuery) ||
      a.entity_type.toLowerCase().includes(lowerQuery) ||
      a.action.toLowerCase().includes(lowerQuery) ||
      a.recordId.toLowerCase().includes(lowerQuery) ||
      a.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      (a.entity_name && a.entity_name.toLowerCase().includes(lowerQuery)) ||
      (a.error_message && a.error_message.toLowerCase().includes(lowerQuery))
    );
  }, [activities.data]);
  
  /**
   * Get stats from backend (all business logic handled there)
   */
  const getStats = useCallback(async (timeframe: "day" | "week" | "month") => {
    if (!tenantId) throw new Error('No tenant ID');
    return api.getActivityStats(tenantId, timeframe);
  }, [tenantId, api]);
  
  /**
   * Cleanup old activities (backend handles the logic)
   */
  const cleanupOld = useCallback(async (olderThanDays: number): Promise<number> => {
    if (!tenantId) throw new Error('No tenant ID');
    
    const result = await api.cleanupOldActivities(tenantId, olderThanDays);
    
    // Refresh local cache after cleanup
    await refreshActivities();
    
    return result.deletedCount;
  }, [tenantId, api, refreshActivities]);
  
  /**
   * Invalidate cache and mark data as stale
   */
  const invalidateCache = useCallback(() => {
    setActivities(prev => ({
      ...prev,
      stale: true,
      lastFetch: null,
    }));
  }, []);
  
  /**
   * Combine real activities with optimistic ones for UI display
   */
  const combinedActivities = useMemo(() => {
    const optimisticArray = Array.from(optimisticActivities.entries()).map(([tempId, activity]) => ({
      id: tempId,
      timestamp: new Date().toISOString(),
      tenantId: tenantId || '',
      message: activity.message || `${activity.action} ${activity.entity_type} ${activity.recordId}`,
      tags: activity.tags || [],
      success: activity.success ?? true,
      ...activity,
    } as ActivityEvent));
    
    // Merge and sort (optimistic first for immediate feedback)
    return [...optimisticArray, ...activities.data].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [activities.data, optimisticActivities, tenantId]);
  
  // Update activities state with combined data
  const activitiesWithOptimistic = useMemo(() => ({
    ...activities,
    data: combinedActivities,
  }), [activities, combinedActivities]);
  
  // Initialize on tenant change
  useEffect(() => {
    if (tenantId) {
      refreshActivities();
    } else {
      setActivities({
        data: [],
        loading: false,
        error: null,
        lastFetch: null,
        stale: false,
      });
    }
  }, [tenantId, refreshActivities]);
  
  // Auto-refresh stale data
  useEffect(() => {
    if (isStale && !activities.loading && tenantId) {
      refreshActivities();
    }
  }, [isStale, activities.loading, tenantId, refreshActivities]);
  
  return (
    <ActivityTimelineContext.Provider
      value={{
        activities: activitiesWithOptimistic,
        addActivity,
        refreshActivities,
        getFilteredActivities,
        searchActivities,
        invalidateCache,
        isStale,
        addOptimisticActivity,
        removeOptimisticActivity,
        getStats,
        cleanupOld,
      }}
    >
      {children}
    </ActivityTimelineContext.Provider>
  );
};

// ---------------------------------
// 5. Hooks for UI Components
// ---------------------------------
export const useActivityTimeline = () => {
  const ctx = useContext(ActivityTimelineContext);
  if (!ctx) throw new Error("useActivityTimeline must be used within ActivityTimelineProvider");
  return ctx;
};

/**
 * Hook for entity-specific activities with local filtering
 */
export const useEntityActivities = (entityId: string, entityType: ActivityType) => {
  const { getFilteredActivities, activities } = useActivityTimeline();
  
  return useMemo(() => 
    getFilteredActivities({ entityId, entityType }),
    [getFilteredActivities, entityId, entityType, activities.data, activities.lastFetch]
  );
};

/**
 * Hook for user-specific activities with local filtering
 */
export const useUserActivities = (userId: string) => {
  const { getFilteredActivities, activities } = useActivityTimeline();
  
  return useMemo(() => 
    getFilteredActivities({ userId }),
    [getFilteredActivities, userId, activities.data, activities.lastFetch]
  );
};

/**
 * Hook for recent activities with limit (UI-only slicing)
 */
export const useRecentActivities = (limit: number = 10) => {
  const { activities } = useActivityTimeline();
  
  return useMemo(() => 
    activities.data.slice(0, limit),
    [activities.data, limit, activities.lastFetch]
  );
};

/**
 * Hook for activity stats (delegates to backend)
 */
export const useActivityStats = (timeframe: "day" | "week" | "month" = "week") => {
  const { getStats } = useActivityTimeline();
  const [stats, setStats] = useState<AsyncState<any>>({
    data: null,
    loading: false,
    error: null,
    lastFetch: null,
    stale: true,
  });
  
  const fetchStats = useCallback(async () => {
    setStats(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await getStats(timeframe);
      setStats({
        data,
        loading: false,
        error: null,
        lastFetch: Date.now(),
        stale: false,
      });
    } catch (error) {
      setStats(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch stats',
        stale: true,
      }));
    }
  }, [getStats, timeframe]);
  
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);
  
  return { ...stats, refresh: fetchStats };
};

/**
 * Activity creation helper hook with optimistic updates
 */
export const useCreateActivity = () => {
  const { addActivity } = useActivityTimeline();
  
  return {
    /**
     * Log user action with immediate UI feedback
     */
    logUserAction: useCallback(async (params: {
      action: ActivityAction;
      entityType: ActivityType;
      entityId: string;
      entityName?: string;
      userId: string;
      message?: string;
      fieldChanges?: Array<{ field: string; old_value?: any; new_value?: any }>;
      businessServiceId?: string;
      customerId?: string;
      sourceSystem?: string;
      sessionId?: string;
      ipAddress?: string;
      executionTime?: number;
      correlationId?: string;
    }) => {
      const activity: CreateActivityRequest = {
        storeName: params.entityType,
        recordId: params.entityId,
        entity_type: params.entityType,
        entity_name: params.entityName,
        action: params.action,
        message: params.message,
        user_id: params.userId,
        business_service_id: params.businessServiceId,
        customer_id: params.customerId,
        source_system: params.sourceSystem || "web_ui",
        session_id: params.sessionId,
        ip_address: params.ipAddress,
        execution_time_ms: params.executionTime,
        field_changes: params.fieldChanges,
        correlation_id: params.correlationId,
        success: true,
        tags: [params.action, params.entityType],
      };
      
      return addActivity(activity);
    }, [addActivity]),
    
    /**
     * Log system action with immediate UI feedback
     */
    logSystemAction: useCallback(async (params: {
      action: ActivityAction;
      entityType: ActivityType;
      entityId: string;
      message: string;
      automationRuleId?: string;
      aiAgentId?: string;
      success?: boolean;
      errorMessage?: string;
      executionTime?: number;
      correlationId?: string;
    }) => {
      const activity: CreateActivityRequest = {
        storeName: params.entityType,
        recordId: params.entityId,
        entity_type: params.entityType,
        action: params.action,
        message: params.message,
        automation_rule_id: params.automationRuleId,
        ai_agent_id: params.aiAgentId,
        source_system: "automation",
        execution_time_ms: params.executionTime,
        success: params.success ?? true,
        error_message: params.errorMessage,
        correlation_id: params.correlationId,
        tags: [params.action, params.entityType, "automated"],
      };
      
      return addActivity(activity);
    }, [addActivity]),
  };
};