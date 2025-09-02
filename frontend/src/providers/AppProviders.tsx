// src/providers/AppProviders.tsx
import React, { ReactNode } from 'react';
import { TenantProvider } from './TenantProvider';
import { ConfigProvider } from './ConfigProvider';
import { SyncProvider } from './SyncProvider';
import { NotificationProvider } from './NotificationProvider';
import { AuditLogsProvider } from './AuditLogsProvider';
import { ActivityTimelineProvider } from './ActivityTimelineProvider';
import { ThemeProvider } from './ThemeProvider';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Main provider composition following the canonical order:
 * 1. ThemeProvider (outermost - affects all UI)
 * 2. TenantProvider (core tenant context)
 * 3. ConfigProvider (depends on tenant)
 * 4. SyncProvider (depends on tenant)
 * 5. NotificationProvider (depends on tenant + sync)
 * 6. AuditLogsProvider (depends on tenant)
 * 7. ActivityTimelineProvider (innermost - depends on all audit/activity)
 */
export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <ThemeProvider>
      <TenantProvider>
        <ConfigProvider>
          <SyncProvider>
            <NotificationProvider>
              <AuditLogsProvider>
                <ActivityTimelineProvider>
                  {children}
                </ActivityTimelineProvider>
              </AuditLogsProvider>
            </NotificationProvider>
          </SyncProvider>
        </ConfigProvider>
      </TenantProvider>
    </ThemeProvider>
  );
};

// src/providers/AuditLogsProvider.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { getAll } from "../db/dbClient";
import { useTenant } from "./TenantProvider";

interface AuditLogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  description: string;
  timestamp: string;
  user_id: string | null;
  tags: string[];
  hash: string;
  tenantId: string;
  metadata?: Record<string, any>;
}

interface AuditLogsContextType {
  auditLogs: AuditLogEntry[];
  isLoading: boolean;
  error: string | null;
  
  // Filtering methods
  getLogsByEntity: (entityType: string, entityId?: string) => AuditLogEntry[];
  getLogsByUser: (userId: string) => AuditLogEntry[];
  getLogsByAction: (action: string) => AuditLogEntry[];
  getLogsByDateRange: (startDate: string, endDate: string) => AuditLogEntry[];
  getLogsByTags: (tags: string[]) => AuditLogEntry[];
  
  // Operations
  refreshAuditLogs: () => Promise<void>;
  searchLogs: (query: string) => AuditLogEntry[];
}

const AuditLogsContext = createContext<AuditLogsContextType | undefined>(undefined);

export const AuditLogsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load audit logs when tenant changes
  useEffect(() => {
    if (tenantId) {
      refreshAuditLogs();
    } else {
      setAuditLogs([]);
      setError(null);
    }
  }, [tenantId]);

  const refreshAuditLogs = useCallback(async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const logs = await getAll<AuditLogEntry>(tenantId, 'audit_logs');
      
      // Sort by timestamp (newest first)
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setAuditLogs(logs);
      console.log(`Loaded ${logs.length} audit log entries for tenant ${tenantId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load audit logs';
      console.error('Audit logs loading error:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  // Filtering methods
  const getLogsByEntity = useCallback((entityType: string, entityId?: string) => {
    return auditLogs.filter(log => 
      log.entity_type === entityType && 
      (!entityId || log.entity_id === entityId)
    );
  }, [auditLogs]);

  const getLogsByUser = useCallback((userId: string) => {
    return auditLogs.filter(log => log.user_id === userId);
  }, [auditLogs]);

  const getLogsByAction = useCallback((action: string) => {
    return auditLogs.filter(log => log.action === action);
  }, [auditLogs]);

  const getLogsByDateRange = useCallback((startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return auditLogs.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= start && logDate <= end;
    });
  }, [auditLogs]);

  const getLogsByTags = useCallback((tags: string[]) => {
    return auditLogs.filter(log => 
      tags.some(tag => log.tags.includes(tag))
    );
  }, [auditLogs]);

  const searchLogs = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return auditLogs.filter(log => 
      log.description.toLowerCase().includes(lowerQuery) ||
      log.action.toLowerCase().includes(lowerQuery) ||
      log.entity_type.toLowerCase().includes(lowerQuery) ||
      log.entity_id.toLowerCase().includes(lowerQuery) ||
      log.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }, [auditLogs]);

  return (
    <AuditLogsContext.Provider
      value={{
        auditLogs,
        isLoading,
        error,
        getLogsByEntity,
        getLogsByUser,
        getLogsByAction,
        getLogsByDateRange,
        getLogsByTags,
        refreshAuditLogs,
        searchLogs,
      }}
    >
      {children}
    </AuditLogsContext.Provider>
  );
};

export const useAuditLogs = () => {
  const ctx = useContext(AuditLogsContext);
  if (!ctx) {
    throw new Error("useAuditLogs must be used within AuditLogsProvider");
  }
  return ctx;
};

// src/providers/ActivityTimelineProvider.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { getAll } from "../db/dbClient";
import { useTenant } from "./TenantProvider";

interface ActivityEvent {
  id: string;
  timestamp: string;
  tenantId: string;
  message: string;
  storeName: string;
  recordId: string;
  action: "create" | "update" | "delete";
  userId?: string;
  metadata?: Record<string, any>;
}

interface ActivityTimelineContextType {
  activities: ActivityEvent[];
  isLoading: boolean;
  error: string | null;
  
  // Filtering methods
  getActivitiesByEntity: (storeName: string, recordId?: string) => ActivityEvent[];
  getActivitiesByUser: (userId: string) => ActivityEvent[];
  getActivitiesByAction: (action: string) => ActivityEvent[];
  getActivitiesByDateRange: (startDate: string, endDate: string) => ActivityEvent[];
  getRecentActivities: (limit?: number) => ActivityEvent[];
  
  // Operations
  refreshActivities: () => Promise<void>;
  searchActivities: (query: string) => ActivityEvent[];
}

const ActivityTimelineContext = createContext<ActivityTimelineContextType | undefined>(undefined);

export const ActivityTimelineProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load activities when tenant changes
  useEffect(() => {
    if (tenantId) {
      refreshActivities();
    } else {
      setActivities([]);
      setError(null);
    }
  }, [tenantId]);

  const refreshActivities = useCallback(async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const activityList = await getAll<ActivityEvent>(tenantId, 'activity_timeline');
      
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

  // Filtering methods
  const getActivitiesByEntity = useCallback((storeName: string, recordId?: string) => {
    return activities.filter(activity => 
      activity.storeName === storeName && 
      (!recordId || activity.recordId === recordId)
    );
  }, [activities]);

  const getActivitiesByUser = useCallback((userId: string) => {
    return activities.filter(activity => activity.userId === userId);
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

  const getRecentActivities = useCallback((limit: number = 50) => {
    return activities.slice(0, limit);
  }, [activities]);

  const searchActivities = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return activities.filter(activity => 
      activity.message.toLowerCase().includes(lowerQuery) ||
      activity.storeName.toLowerCase().includes(lowerQuery) ||
      activity.recordId.toLowerCase().includes(lowerQuery) ||
      activity.action.toLowerCase().includes(lowerQuery)
    );
  }, [activities]);

  return (
    <ActivityTimelineContext.Provider
      value={{
        activities,
        isLoading,
        error,
        getActivitiesByEntity,
        getActivitiesByUser,
        getActivitiesByAction,
        getActivitiesByDateRange,
        getRecentActivities,
        refreshActivities,
        searchActivities,
      }}
    >
      {children}
    </ActivityTimelineContext.Provider>
  );
};

export const useActivityTimeline = () => {
  const ctx = useContext(ActivityTimelineContext);
  if (!ctx) {
    throw new Error("useActivityTimeline must be used within ActivityTimelineProvider");
  }
  return ctx;
};

// Utility hooks
export const useEntityAuditLogs = (entityType: string, entityId?: string) => {
  const { getLogsByEntity } = useAuditLogs();
  return getLogsByEntity(entityType, entityId);
};

export const useEntityActivities = (storeName: string, recordId?: string) => {
  const { getActivitiesByEntity } = useActivityTimeline();
  return getActivitiesByEntity(storeName, recordId);
};

export const useRecentActivity = (limit: number = 10) => {
  const { getRecentActivities } = useActivityTimeline();
  return getRecentActivities(limit);
};