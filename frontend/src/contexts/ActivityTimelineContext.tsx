// src/contexts/ActivityTimelineContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { 
  getAll,
  getById,
  putWithAudit,
} from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";

// ---------------------------------
// 1. Type Definitions
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

  // Actor information (who performed the action)
  user_id?: string | null;
  team_id?: string | null;
  ai_agent_id?: string | null;
  automation_rule_id?: string | null;
  source_system?: string; // "web_ui", "api", "mobile", "automation"

  // Context and relationships
  entity_type: ActivityType;
  entity_name?: string;
  parent_entity_type?: ActivityType;
  parent_entity_id?: string;

  // Change tracking
  field_changes?: Array<{
    field: string;
    old_value?: any;
    new_value?: any;
  }>;

  // Business context
  business_service_id?: string;
  customer_id?: string;
  cost_center_id?: string;
  priority?: "low" | "normal" | "high" | "critical";

  // Session and device info
  session_id?: string;
  ip_address?: string;
  user_agent?: string;
  device_type?: "desktop" | "mobile" | "tablet" | "api";

  // Performance metrics
  execution_time_ms?: number;
  success: boolean;
  error_message?: string;

  // Metadata
  tags: string[];
  metadata?: Record<string, any>;
  correlation_id?: string; // For grouping related activities
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------
interface ActivityTimelineContextType {
  activities: ActivityEvent[];
  addActivity: (activity: Omit<ActivityEvent, "id" | "timestamp" | "tenantId">) => Promise<void>;
  refreshActivities: () => Promise<void>;
  
  // Filtering and querying
  getActivitiesByEntity: (entityId: string, entityType: ActivityType) => ActivityEvent[];
  getActivitiesByUser: (userId: string) => ActivityEvent[];
  getActivitiesByAction: (action: ActivityAction) => ActivityEvent[];
  getActivitiesByDateRange: (startDate: string, endDate: string) => ActivityEvent[];
  getActivitiesByBusinessService: (serviceId: string) => ActivityEvent[];
  getActivitiesByCustomer: (customerId: string) => ActivityEvent[];
  getRecentActivities: (limit?: number) => ActivityEvent[];
  getFailedActivities: () => ActivityEvent[];
  getActivitiesByCorrelation: (correlationId: string) => ActivityEvent[];
  
  // Search and analysis
  searchActivities: (query: string) => ActivityEvent[];
  getActivityStats: (timeframe: "day" | "week" | "month") => {
    totalActivities: number;
    uniqueUsers: number;
    topActions: Array<{ action: string; count: number }>;
    successRate: number;
    avgExecutionTime: number;
  };
  
  // Cleanup operations
  cleanupOldActivities: (olderThanDays: number) => Promise<number>;
}

const ActivityTimelineContext = createContext<ActivityTimelineContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const ActivityTimelineProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const [activities, setActivities] = useState<ActivityEvent[]>([]);

  const refreshActivities = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      const all = await getAll<ActivityEvent>(tenantId, "activity_timeline");
      
      // Sort by timestamp (newest first)
      all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setActivities(all);
    } catch (error) {
      console.error("Failed to refresh activities:", error);
    }
  }, [tenantId]);

  const addActivity = useCallback(async (
    activityData: Omit<ActivityEvent, "id" | "timestamp" | "tenantId">
  ) => {
    if (!tenantId) return;

    const now = new Date().toISOString();
    const activity: ActivityEvent = {
      id: crypto.randomUUID(),
      timestamp: now,
      tenantId,
      tags: [],
      success: true,
      ...activityData,
    };

    try {
      // Store in database with audit trail
      await putWithAudit(
        tenantId,
        "activity_timeline",
        activity,
        activity.user_id || undefined,
        {
          action: "create",
          description: `Activity logged: ${activity.action} on ${activity.entity_type}`,
          tags: ["activity", "timeline", activity.action, activity.entity_type],
          metadata: {
            entity_id: activity.recordId,
            entity_type: activity.entity_type,
            actor_type: activity.user_id ? "user" : 
                       activity.ai_agent_id ? "ai_agent" : 
                       activity.automation_rule_id ? "automation" : "system",
            source_system: activity.source_system,
            success: activity.success,
          },
        }
      );

      // Add to local state
      setActivities(prev => [activity, ...prev]);

      // Enqueue for sync
      await enqueueItem({
        storeName: "activity_timeline",
        entityId: activity.id,
        action: "create",
        payload: activity,
        priority: activity.priority === 'critical' ? 'high' : 'low',
      });

    } catch (error) {
      console.error("Failed to add activity:", error);
    }
  }, [tenantId, enqueueItem]);

  // Filtering functions
  const getActivitiesByEntity = useCallback((entityId: string, entityType: ActivityType) => {
    return activities.filter(a => a.recordId === entityId && a.entity_type === entityType);
  }, [activities]);

  const getActivitiesByUser = useCallback((userId: string) => {
    return activities.filter(a => a.user_id === userId);
  }, [activities]);

  const getActivitiesByAction = useCallback((action: ActivityAction) => {
    return activities.filter(a => a.action === action);
  }, [activities]);

  const getActivitiesByDateRange = useCallback((startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return activities.filter(a => {
      const activityDate = new Date(a.timestamp);
      return activityDate >= start && activityDate <= end;
    });
  }, [activities]);

  const getActivitiesByBusinessService = useCallback((serviceId: string) => {
    return activities.filter(a => a.business_service_id === serviceId);
  }, [activities]);

  const getActivitiesByCustomer = useCallback((customerId: string) => {
    return activities.filter(a => a.customer_id === customerId);
  }, [activities]);

  const getRecentActivities = useCallback((limit: number = 50) => {
    return activities.slice(0, limit);
  }, [activities]);

  const getFailedActivities = useCallback(() => {
    return activities.filter(a => !a.success);
  }, [activities]);

  const getActivitiesByCorrelation = useCallback((correlationId: string) => {
    return activities.filter(a => a.correlation_id === correlationId);
  }, [activities]);

  const searchActivities = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return activities.filter(a => 
      a.message.toLowerCase().includes(lowerQuery) ||
      a.entity_type.toLowerCase().includes(lowerQuery) ||
      a.action.toLowerCase().includes(lowerQuery) ||
      a.storeName.toLowerCase().includes(lowerQuery) ||
      a.recordId.toLowerCase().includes(lowerQuery) ||
      a.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      (a.entity_name && a.entity_name.toLowerCase().includes(lowerQuery)) ||
      (a.error_message && a.error_message.toLowerCase().includes(lowerQuery))
    );
  }, [activities]);

  const getActivityStats = useCallback((timeframe: "day" | "week" | "month") => {
    const now = new Date();
    let startDate: Date;
    
    switch (timeframe) {
      case "day":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }
    
    const filteredActivities = activities.filter(a => new Date(a.timestamp) >= startDate);
    const uniqueUsers = new Set(filteredActivities.map(a => a.user_id).filter(Boolean)).size;
    
    // Count actions
    const actionCounts = filteredActivities.reduce((acc, activity) => {
      acc[activity.action] = (acc[activity.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topActions = Object.entries(actionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([action, count]) => ({ action, count }));
    
    const successfulActivities = filteredActivities.filter(a => a.success);
    const successRate = filteredActivities.length > 0 ? 
      (successfulActivities.length / filteredActivities.length) * 100 : 0;
    
    const activitiesWithTime = filteredActivities.filter(a => a.execution_time_ms !== undefined);
    const avgExecutionTime = activitiesWithTime.length > 0 ?
      activitiesWithTime.reduce((sum, a) => sum + (a.execution_time_ms || 0), 0) / activitiesWithTime.length : 0;
    
    return {
      totalActivities: filteredActivities.length,
      uniqueUsers,
      topActions,
      successRate,
      avgExecutionTime,
    };
  }, [activities]);

  const cleanupOldActivities = useCallback(async (olderThanDays: number): Promise<number> => {
    if (!tenantId) return 0;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const oldActivities = activities.filter(a => new Date(a.timestamp) < cutoffDate);
    
    if (oldActivities.length === 0) return 0;
    
    try {
      // Note: In a real implementation, you'd use a batch delete operation
      // For now, we'll just remove from local state and let sync handle it
      const remainingActivities = activities.filter(a => new Date(a.timestamp) >= cutoffDate);
      setActivities(remainingActivities);
      
      console.log(`Cleaned up ${oldActivities.length} old activity records`);
      return oldActivities.length;
    } catch (error) {
      console.error("Failed to cleanup old activities:", error);
      return 0;
    }
  }, [tenantId, activities]);

  // Initialize
  useEffect(() => {
    if (tenantId) {
      refreshActivities();
    } else {
      setActivities([]);
    }
  }, [tenantId, refreshActivities]);

  return (
    <ActivityTimelineContext.Provider
      value={{
        activities,
        addActivity,
        refreshActivities,
        getActivitiesByEntity,
        getActivitiesByUser,
        getActivitiesByAction,
        getActivitiesByDateRange,
        getActivitiesByBusinessService,
        getActivitiesByCustomer,
        getRecentActivities,
        getFailedActivities,
        getActivitiesByCorrelation,
        searchActivities,
        getActivityStats,
        cleanupOldActivities,
      }}
    >
      {children}
    </ActivityTimelineContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------
export const useActivityTimeline = () => {
  const ctx = useContext(ActivityTimelineContext);
  if (!ctx) throw new Error("useActivityTimeline must be used within ActivityTimelineProvider");
  return ctx;
};

export const useEntityActivities = (entityId: string, entityType: ActivityType) => {
  const { getActivitiesByEntity } = useActivityTimeline();
  return getActivitiesByEntity(entityId, entityType);
};

export const useUserActivities = (userId: string) => {
  const { getActivitiesByUser } = useActivityTimeline();
  return getActivitiesByUser(userId);
};

export const useRecentActivity = (limit: number = 10) => {
  const { getRecentActivities } = useActivityTimeline();
  return getRecentActivities(limit);
};

export const useActivityStats = (timeframe: "day" | "week" | "month" = "week") => {
  const { getActivityStats } = useActivityTimeline();
  return getActivityStats(timeframe);
};

// Activity creation helper hook
export const useCreateActivity = () => {
  const { addActivity } = useActivityTimeline();
  
  return {
    logUserAction: (params: {
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
      return addActivity({
        storeName: params.entityType,
        recordId: params.entityId,
        entity_type: params.entityType,
        entity_name: params.entityName,
        action: params.action,
        message: params.message || `${params.action} ${params.entityType} ${params.entityId}`,
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
      });
    },
    
    logSystemAction: (params: {
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
      return addActivity({
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
      });
    },
  };
};