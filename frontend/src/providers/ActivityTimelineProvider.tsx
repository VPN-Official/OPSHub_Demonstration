// src/providers/ActivityTimelineProvider.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { getAll, putWithAudit } from "../db/dbClient";
import { useTenant } from "./TenantProvider";
import { useConfig } from "./ConfigProvider";
import { useSync } from "./SyncProvider";
import { useNotification } from "./NotificationProvider";
import { useAuditLogs } from "./AuditLogsProvider";

// ---------------------------------
// 1. Types
// ---------------------------------
export interface ActivityEvent {
  id: string;
  timestamp: string;
  tenantId: string;
  message: string;
  storeName: string;
  recordId: string;
  action: "create" | "update" | "delete";
  userId?: string;
  metadata?: Record<string, any>;

  // Enhanced fields for better tracking
  entity_type?: string;
  entity_id?: string;
  user_id?: string | null;
  team_id?: string | null;
  ai_agent_id?: string | null;
  automation_rule_id?: string | null;
  source_system?: string;
  priority?: "low" | "normal" | "high" | "critical";
  success?: boolean;
  error_message?: string;
  duration_ms?: number;
  tags: string[];
  related_entity_ids?: Array<{
    type: string;
    id: string;
  }>;
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
}

interface ActivityTimelineContextType {
  activities: ActivityEvent[];
  isLoading: boolean;
  error: string | null;
  
  // Core operations
  addActivity: (activity: Omit<ActivityEvent, "id" | "timestamp" | "tenantId">) => Promise<void>;
  refreshActivities: () => Promise<void>;
  
  // Filtering methods
  getActivitiesByEntity: (storeName: string, recordId?: string) => ActivityEvent[];
  getActivitiesByUser: (userId: string) => ActivityEvent[];
  getActivitiesByAction: (action: string) => ActivityEvent[];
  getActivitiesByDateRange: (startDate: string, endDate: string) => ActivityEvent[];
  getActivitiesByTags: (tags: string[]) => ActivityEvent[];
  getRecentActivities: (limit?: number) => ActivityEvent[];
  searchActivities: (query: string) => ActivityEvent[];
  
  // Analytics
  getActivityStats: (timeframe?: "hour" | "day" | "week" | "month") => {
    totalActivities: number;
    createActions: number;
    updateActions: number;
    deleteActions: number;
    successfulActions: number;
    failedActions: number;
    userActions: number;
    automatedActions: number;
    averageDuration: number;
  };
  
  getTopActiveUsers: (limit?: number) => Array<{
    userId: string;
    activityCount: number;
    successRate: number;
  }>;
  
  getActivityTrends: () => {
    increasing: boolean;
    changePercentage: number;
  };
}

const ActivityTimelineContext = createContext<ActivityTimelineContextType | undefined>(undefined);

// ---------------------------------
// 2. Provider
// ---------------------------------
export const ActivityTimelineProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId, isInitialized, isLoading: tenantLoading, error: tenantError } = useTenant();
  const { config, isLoading: configLoading, error: configError } = useConfig();
  const { enqueueItem, error: syncError } = useSync();
  const { error: notificationError } = useNotification();
  const { error: auditError } = useAuditLogs();
  
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Propagate parent errors
  useEffect(() => {
    if (tenantError) {
      setError(`Tenant error: ${tenantError}`);
      setActivities([]);
    } else if (configError) {
      setError(`Config error: ${configError}`);
      setActivities([]);
    } else if (syncError) {
      setError(`Sync error: ${syncError}`);
    } else if (notificationError) {
      setError(`Notification error: ${notificationError}`);
    } else if (auditError) {
      setError(`Audit error: ${auditError}`);
    }
  }, [tenantError, configError, syncError, notificationError, auditError]);

  // Load activities when all dependencies are ready
  useEffect(() => {
    if (tenantId && isInitialized && !tenantLoading && config && !tenantError && !configError && !syncError && !notificationError && !auditError) {
      refreshActivities();
    } else if (!tenantId) {
      setActivities([]);
      if (!tenantError && !configError && !syncError && !notificationError && !auditError) {
        setError(null);
      }
    }
  }, [tenantId, isInitialized, tenantLoading, config, tenantError, configError, syncError, notificationError, auditError]);

  const refreshActivities = useCallback(async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const activityList = await getAll<ActivityEvent>(tenantId, "activity_timeline");
      
      // Sort by timestamp (newest first)
      activityList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setActivities(activityList);
      console.log(`Loaded ${activityList.length} activity events for tenant ${tenantId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load activities';
      console.error('Activities loading error:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  const addActivity = useCallback(async (
    activityData: Omit<ActivityEvent, "id" | "timestamp" | "tenantId">
  ) => {
    if (!tenantId) {
      console.warn("Cannot add activity: no tenant selected");
      return;
    }

    const now = new Date().toISOString();
    const activity: ActivityEvent = {
      id: crypto.randomUUID(),
      timestamp: now,
      tenantId,
      tags: [],
      success: true,
      health_status: "green",
      sync_status: "dirty",
      synced_at: now,
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
          description: `Activity logged: ${activity.action} on ${activity.entity_type || activity.storeName}`,
          tags: ["activity", "timeline", activity.action, activity.entity_type || activity.storeName],
          metadata: {
            entity_id: activity.recordId,
            entity_type: activity.entity_type || activity.storeName,
            actor_type: activity.user_id ? "user" : 
                       activity.ai_agent_id ? "ai_agent" : 
                       activity.automation_rule_id ? "automation" : "system",
            source_system: activity.source_system,
            success: activity.success,
            duration_ms: activity.duration_ms,
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
        priority: activity.priority === 'critical' ? 'critical' : 'normal',
      });

      console.log(`Activity logged: ${activity.message}`);
    } catch (err) {
      console.error("Failed to add activity:", err);
      throw new Error(`Failed to log activity: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [tenantId, enqueueItem]);

  // Filtering methods
  const getActivitiesByEntity = useCallback((storeName: string, recordId?: string) => {
    return activities.filter(activity => 
      activity.storeName === storeName && 
      (!recordId || activity.recordId === recordId)
    );
  }, [activities]);

  const getActivitiesByUser = useCallback((userId: string) => {
    return activities.filter(activity => activity.user_id === userId);
  }, [activities]);

  const getActivitiesByAction = useCallback((action: string) => {
    return activities.filter(activity => activity.action === action);
  }, [activities]);

  const getActivitiesByDateRange = useCallback((startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return activities.filter(activity => {
      const activityDate = new Date(activity.timestamp);
      return activityDate >= start && activityDate <= end;
    });
  }, [activities]);

  const getActivitiesByTags = useCallback((tags: string[]) => {
    return activities.filter(activity => 
      tags.some(tag => activity.tags.includes(tag))
    );
  }, [activities]);

  const getRecentActivities = useCallback((limit: number = 50) => {
    return activities.slice(0, limit);
  }, [activities]);

  const searchActivities = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return activities.filter(activity => 
      activity.message.toLowerCase().includes(lowerQuery) ||
      activity.storeName.toLowerCase().includes(lowerQuery) ||
      activity.recordId.toLowerCase().includes(lowerQuery) ||
      activity.action.toLowerCase().includes(lowerQuery) ||
      activity.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      (activity.user_id && activity.user_id.toLowerCase().includes(lowerQuery)) ||
      (activity.source_system && activity.source_system.toLowerCase().includes(lowerQuery))
    );
  }, [activities]);

  // Analytics
  const getActivityStats = useCallback((timeframe: "hour" | "day" | "week" | "month" = "day") => {
    const now = new Date();
    let timeframeStart: Date;

    switch (timeframe) {
      case "hour":
        timeframeStart = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case "day":
        timeframeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "week":
        timeframeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        timeframeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const timeframeActivities = activities.filter(activity => 
      new Date(activity.timestamp) >= timeframeStart
    );

    const totalActivities = timeframeActivities.length;
    const createActions = timeframeActivities.filter(a => a.action === "create").length;
    const updateActions = timeframeActivities.filter(a => a.action === "update").length;
    const deleteActions = timeframeActivities.filter(a => a.action === "delete").length;
    const successfulActions = timeframeActivities.filter(a => a.success !== false).length;
    const failedActions = timeframeActivities.filter(a => a.success === false).length;
    const userActions = timeframeActivities.filter(a => a.user_id).length;
    const automatedActions = timeframeActivities.filter(a => a.ai_agent_id || a.automation_rule_id).length;
    
    const durationsWithValues = timeframeActivities
      .filter(a => typeof a.duration_ms === 'number')
      .map(a => a.duration_ms as number);
    const averageDuration = durationsWithValues.length > 0 
      ? durationsWithValues.reduce((sum, duration) => sum + duration, 0) / durationsWithValues.length
      : 0;

    return {
      totalActivities,
      createActions,
      updateActions,
      deleteActions,
      successfulActions,
      failedActions,
      userActions,
      automatedActions,
      averageDuration,
    };
  }, [activities]);

  const getTopActiveUsers = useCallback((limit: number = 10) => {
    const userActivityMap = new Map<string, { count: number; successful: number }>();

    activities.forEach(activity => {
      if (activity.user_id) {
        const current = userActivityMap.get(activity.user_id) || { count: 0, successful: 0 };
        current.count++;
        if (activity.success !== false) {
          current.successful++;
        }
        userActivityMap.set(activity.user_id, current);
      }
    });

    return Array.from(userActivityMap.entries())
      .map(([userId, stats]) => ({
        userId,
        activityCount: stats.count,
        successRate: stats.count > 0 ? (stats.successful / stats.count) * 100 : 0,
      }))
      .sort((a, b) => b.activityCount - a.activityCount)
      .slice(0, limit);
  }, [activities]);

  const getActivityTrends = useCallback(() => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    const recentActivities = activities.filter(a => new Date(a.timestamp) >= oneDayAgo).length;
    const previousActivities = activities.filter(a => {
      const timestamp = new Date(a.timestamp);
      return timestamp >= twoDaysAgo && timestamp < oneDayAgo;
    }).length;

    if (previousActivities === 0) {
      return { increasing: recentActivities > 0, changePercentage: recentActivities > 0 ? 100 : 0 };
    }

    const changePercentage = ((recentActivities - previousActivities) / previousActivities) * 100;
    return {
      increasing: changePercentage > 0,
      changePercentage: Math.abs(changePercentage),
    };
  }, [activities]);

  return (
    <ActivityTimelineContext.Provider
      value={{
        activities,
        isLoading,
        error,
        addActivity,
        refreshActivities,
        getActivitiesByEntity,
        getActivitiesByUser,
        getActivitiesByAction,
        getActivitiesByDateRange,
        getActivitiesByTags,
        getRecentActivities,
        searchActivities,
        getActivityStats,
        getTopActiveUsers,
        getActivityTrends,
      }}
    >
      {children}
    </ActivityTimelineContext.Provider>
  );
};

// ---------------------------------
// 3. Hooks
// ---------------------------------
export const useActivityTimeline = () => {
  const ctx = useContext(ActivityTimelineContext);
  if (!ctx) {
    throw new Error("useActivityTimeline must be used within ActivityTimelineProvider");
  }
  return ctx;
};

// Utility hooks
export const useEntityActivities = (storeName: string, recordId?: string) => {
  const { getActivitiesByEntity } = useActivityTimeline();
  return getActivitiesByEntity(storeName, recordId);
};

export const useRecentActivity = (limit: number = 10) => {
  const { getRecentActivities } = useActivityTimeline();
  return getRecentActivities(limit);
};

export const useActivityStats = (timeframe?: "hour" | "day" | "week" | "month") => {
  const { getActivityStats } = useActivityTimeline();
  return getActivityStats(timeframe);
};

export const useUserActivityStats = (userId: string) => {
  const { getActivitiesByUser } = useActivityTimeline();
  const userActivities = getActivitiesByUser(userId);
  
  return {
    totalActivities: userActivities.length,
    recentActivities: userActivities.filter(a => 
      new Date(a.timestamp) >= new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length,
    successRate: userActivities.length > 0 
      ? (userActivities.filter(a => a.success !== false).length / userActivities.length) * 100 
      : 0,
  };
};

export const useActivitySearch = (query: string) => {
  const { searchActivities } = useActivityTimeline();
  return searchActivities(query);
};