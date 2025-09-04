// src/providers/NotificationProvider.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { getAll, putWithAudit, removeWithAudit } from "../db/dbClient";
import { useTenant } from "./TenantProvider";
import { useConfig } from "./ConfigProvider";
import { useSync } from "./SyncProvider";

export type NotificationType =
  | "alert"
  | "sla_breach"
  | "sla_warning"
  | "sync_failure"
  | "sync_conflict"
  | "ai_nudge"
  | "automation_success"
  | "automation_failure"
  | "compliance_issue"
  | "system"
  | "info"
  | "warning"
  | "error"
  | "success";

export interface Notification {
  id: string;
  tenantId: string;
  type: NotificationType;
  title: string;
  message: string;
  created_at: string;
  expires_at?: string;
  status: "active" | "dismissed" | "read";
  priority: "low" | "normal" | "high" | "critical";
  source?: {
    entityType: string;
    entityId: string;
    action?: string;
  };
  actions?: Array<{
    id: string;
    label: string;
    action: string;
    style?: "primary" | "secondary" | "danger";
  }>;
  metadata?: Record<string, any>;
  user_id?: string;
  read_at?: string;
  dismissed_at?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  activeCount: number;
  isLoading: boolean;
  error: string | null;
  
  // Core operations
  addNotification: (notification: Omit<Notification, "id" | "tenantId" | "created_at" | "status">) => Promise<Notification>;
  markAsRead: (id: string) => Promise<void>;
  markAsUnread: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
  dismissAll: () => Promise<void>;
  removeNotification: (id: string) => Promise<void>;
  
  // Batch operations
  markMultipleAsRead: (ids: string[]) => Promise<void>;
  dismissMultiple: (ids: string[]) => Promise<void>;
  
  // Filtering and querying
  getNotificationsByType: (type: NotificationType) => Notification[];
  getNotificationsBySource: (entityType: string, entityId?: string) => Notification[];
  getNotificationsByPriority: (priority: string) => Notification[];
  
  // Refresh and cleanup
  refreshNotifications: () => Promise<void>;
  cleanupExpired: () => Promise<number>;
  
  // Action handling
  executeAction: (notificationId: string, actionId: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Default TTL in hours for different notification types
const DEFAULT_TTL_HOURS: Record<NotificationType, number> = {
  alert: 72,           // 3 days
  sla_breach: 168,     // 7 days
  sla_warning: 48,     // 2 days
  sync_failure: 24,    // 1 day
  sync_conflict: 72,   // 3 days
  ai_nudge: 48,        // 2 days
  automation_success: 24, // 1 day
  automation_failure: 72, // 3 days
  compliance_issue: 168,  // 7 days
  system: 48,          // 2 days
  info: 24,            // 1 day
  warning: 48,         // 2 days
  error: 72,           // 3 days
  success: 24,         // 1 day
};

// ---------------------------------
// Provider
// ---------------------------------
export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId, isInitialized, isLoading: tenantLoading, error: tenantError } = useTenant();
  const { config, isLoading: configLoading, error: configError } = useConfig();
  const { error: syncError } = useSync();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Propagate parent errors
  useEffect(() => {
    if (tenantError) {
      setError(`Tenant error: ${tenantError}`);
      setNotifications([]);
    } else if (configError) {
      setError(`Config error: ${configError}`);
      setNotifications([]);
    } else if (syncError) {
      setError(`Sync error: ${syncError}`);
    }
  }, [tenantError, configError, syncError]);

  // Load notifications when tenant is fully ready and no errors
  useEffect(() => {
    if (tenantId && isInitialized && !tenantLoading && !tenantError && !configError && !syncError) {
      refreshNotifications();
      // Set up periodic cleanup
      const cleanupInterval = setInterval(() => {
        cleanupExpired();
      }, 60000); // Every minute
      
      return () => clearInterval(cleanupInterval);
    } else if (!tenantId) {
      setNotifications([]);
      if (!tenantError && !configError && !syncError) {
        setError(null);
      }
    }
  }, [tenantId, isInitialized, tenantLoading, tenantError, configError, syncError]);

  const refreshNotifications = useCallback(async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const allNotifications = await getAll<Notification>(tenantId, 'notifications');
      
      // Filter out expired notifications
      const now = new Date();
      const activeNotifications = allNotifications.filter(notification => {
        if (!notification.expires_at) return true;
        return new Date(notification.expires_at) > now;
      });
      
      // Sort by created_at (newest first)
      activeNotifications.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setNotifications(activeNotifications);
      console.log(`Loaded ${activeNotifications.length} notifications for tenant ${tenantId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load notifications';
      console.error('Notification loading error:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  const addNotification = useCallback(async (
    notificationData: Omit<Notification, "id" | "tenantId" | "created_at" | "status">
  ): Promise<Notification> => {
    if (!tenantId) {
      throw new Error("No tenant selected");
    }

    const now = new Date();
    const ttlHours = DEFAULT_TTL_HOURS[notificationData.type] || 24;
    const expiresAt = notificationData.expires_at || 
      new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();

    const notification: Notification = {
      id: crypto.randomUUID(),
      tenantId,
      created_at: now.toISOString(),
      expires_at: expiresAt,
      status: "active",
      priority: notificationData.priority || "normal",
      ...notificationData,
    };

    try {
      await putWithAudit(
        tenantId,
        'notifications',
        notification,
        notificationData.user_id,
        {
          action: 'create',
          description: `Created notification: ${notification.title}`,
          tags: ['notification', notification.type],
          metadata: { type: notification.type, priority: notification.priority },
        }
      );

      setNotifications(prev => [notification, ...prev]);
      
      console.log(`Added notification: ${notification.type} - ${notification.title}`);
      return notification;
    } catch (err) {
      console.error('Failed to add notification:', err);
      throw err;
    }
  }, [tenantId]);

  const markAsRead = useCallback(async (id: string) => {
    if (!tenantId) return;
    
    const notification = notifications.find(n => n.id === id);
    if (!notification || notification.status === 'read') return;

    const updated = {
      ...notification,
      status: 'read' as const,
      read_at: new Date().toISOString(),
    };

    try {
      await putWithAudit(
        tenantId,
        'notifications',
        updated,
        undefined,
        {
          action: 'update',
          description: `Marked notification as read`,
          tags: ['notification', 'read'],
        }
      );

      setNotifications(prev => 
        prev.map(n => n.id === id ? updated : n)
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, [tenantId, notifications]);

  const markAsUnread = useCallback(async (id: string) => {
    if (!tenantId) return;
    
    const notification = notifications.find(n => n.id === id);
    if (!notification || notification.status === 'active') return;

    const updated = {
      ...notification,
      status: 'active' as const,
      read_at: undefined,
    };

    try {
      await putWithAudit(
        tenantId,
        'notifications',
        updated,
        undefined,
        {
          action: 'update',
          description: `Marked notification as unread`,
          tags: ['notification', 'unread'],
        }
      );

      setNotifications(prev => 
        prev.map(n => n.id === id ? updated : n)
      );
    } catch (err) {
      console.error('Failed to mark notification as unread:', err);
    }
  }, [tenantId, notifications]);

  const markAllAsRead = useCallback(async () => {
    if (!tenantId) return;
    
    const unreadNotifications = notifications.filter(n => n.status === 'active');
    if (unreadNotifications.length === 0) return;

    const now = new Date().toISOString();
    
    try {
      for (const notification of unreadNotifications) {
        const updated = {
          ...notification,
          status: 'read' as const,
          read_at: now,
        };

        await putWithAudit(
          tenantId,
          'notifications',
          updated,
          undefined,
          {
            action: 'update',
            description: `Bulk mark as read`,
            tags: ['notification', 'bulk_read'],
            correlationId: `bulk_read_${now}`,
          }
        );
      }

      setNotifications(prev => 
        prev.map(n => n.status === 'active' ? { ...n, status: 'read' as const, read_at: now } : n)
      );

      console.log(`Marked ${unreadNotifications.length} notifications as read`);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }, [tenantId, notifications]);

  const dismissNotification = useCallback(async (id: string) => {
    if (!tenantId) return;
    
    const notification = notifications.find(n => n.id === id);
    if (!notification) return;

    const updated = {
      ...notification,
      status: 'dismissed' as const,
      dismissed_at: new Date().toISOString(),
    };

    try {
      await putWithAudit(
        tenantId,
        'notifications',
        updated,
        undefined,
        {
          action: 'update',
          description: `Dismissed notification`,
          tags: ['notification', 'dismissed'],
        }
      );

      setNotifications(prev => 
        prev.map(n => n.id === id ? updated : n)
      );
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
    }
  }, [tenantId, notifications]);

  const dismissAll = useCallback(async () => {
    if (!tenantId) return;
    
    const activeNotifications = notifications.filter(n => n.status === 'active' || n.status === 'read');
    if (activeNotifications.length === 0) return;

    const now = new Date().toISOString();
    
    try {
      for (const notification of activeNotifications) {
        const updated = {
          ...notification,
          status: 'dismissed' as const,
          dismissed_at: now,
        };

        await putWithAudit(
          tenantId,
          'notifications',
          updated,
          undefined,
          {
            action: 'update',
            description: `Bulk dismiss`,
            tags: ['notification', 'bulk_dismiss'],
            correlationId: `bulk_dismiss_${now}`,
          }
        );
      }

      setNotifications(prev => 
        prev.map(n => 
          (n.status === 'active' || n.status === 'read') 
            ? { ...n, status: 'dismissed' as const, dismissed_at: now } 
            : n
        )
      );

      console.log(`Dismissed ${activeNotifications.length} notifications`);
    } catch (err) {
      console.error('Failed to dismiss all notifications:', err);
    }
  }, [tenantId, notifications]);

  const removeNotification = useCallback(async (id: string) => {
    if (!tenantId) return;
    
    try {
      await removeWithAudit(
        tenantId,
        'notifications',
        id,
        undefined,
        {
          action: 'delete',
          description: `Permanently removed notification`,
          tags: ['notification', 'delete'],
        }
      );

      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('Failed to remove notification:', err);
    }
  }, [tenantId]);

  const cleanupExpired = useCallback(async (): Promise<number> => {
    if (!tenantId) return 0;
    
    const now = new Date();
    const expiredNotifications = notifications.filter(n => 
      n.expires_at && new Date(n.expires_at) <= now
    );

    if (expiredNotifications.length === 0) return 0;

    try {
      for (const notification of expiredNotifications) {
        await removeWithAudit(
          tenantId,
          'notifications',
          notification.id,
          undefined,
          {
            action: 'delete',
            description: `Cleaned up expired notification`,
            tags: ['notification', 'cleanup', 'expired'],
          }
        );
      }

      setNotifications(prev => 
        prev.filter(n => !n.expires_at || new Date(n.expires_at) > now)
      );

      console.log(`Cleaned up ${expiredNotifications.length} expired notifications`);
      return expiredNotifications.length;
    } catch (err) {
      console.error('Failed to cleanup expired notifications:', err);
      return 0;
    }
  }, [tenantId, notifications]);

  // Filtering methods
  const getNotificationsByType = useCallback((type: NotificationType) => {
    return notifications.filter(n => n.type === type);
  }, [notifications]);

  const getNotificationsBySource = useCallback((entityType: string, entityId?: string) => {
    return notifications.filter(n => 
      n.source?.entityType === entityType && 
      (!entityId || n.source?.entityId === entityId)
    );
  }, [notifications]);

  const getNotificationsByPriority = useCallback((priority: string) => {
    return notifications.filter(n => n.priority === priority);
  }, [notifications]);

  // Batch operations
  const markMultipleAsRead = useCallback(async (ids: string[]) => {
    for (const id of ids) {
      await markAsRead(id);
    }
  }, [markAsRead]);

  const dismissMultiple = useCallback(async (ids: string[]) => {
    for (const id of ids) {
      await dismissNotification(id);
    }
  }, [dismissNotification]);

  // Action execution
  const executeAction = useCallback(async (notificationId: string, actionId: string) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification) {
      throw new Error(`Notification ${notificationId} not found`);
    }

    const action = notification.actions?.find(a => a.id === actionId);
    if (!action) {
      throw new Error(`Action ${actionId} not found in notification ${notificationId}`);
    }

    try {
      // TODO: Implement action execution logic based on action.action
      console.log(`Executing action ${actionId} for notification ${notificationId}:`, action);
      
      // For now, just log the action
      // In a real implementation, this would dispatch the action to appropriate handlers
      switch (action.action) {
        case 'acknowledge':
          await markAsRead(notificationId);
          break;
        case 'dismiss':
          await dismissNotification(notificationId);
          break;
        case 'escalate':
          // TODO: Implement escalation logic
          break;
        case 'resolve':
          // TODO: Implement resolution logic
          break;
        default:
          console.warn(`Unknown action type: ${action.action}`);
      }

      // Log the action execution
      if (tenantId) {
        // Create an audit entry for action execution
        const timestamp = new Date().toISOString();
        // This would typically go through your audit system
        console.log(`Action executed: ${action.label} on notification ${notification.title}`);
      }
    } catch (err) {
      console.error(`Failed to execute action ${actionId}:`, err);
      throw err;
    }
  }, [notifications, tenantId, markAsRead, dismissNotification]);

  // Computed values
  const unreadCount = notifications.filter(n => n.status === 'active').length;
  const activeCount = notifications.filter(n => n.status !== 'dismissed').length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        activeCount,
        isLoading,
        error,
        addNotification,
        markAsRead,
        markAsUnread,
        markAllAsRead,
        dismissNotification,
        dismissAll,
        removeNotification,
        markMultipleAsRead,
        dismissMultiple,
        getNotificationsByType,
        getNotificationsBySource,
        getNotificationsByPriority,
        refreshNotifications,
        cleanupExpired,
        executeAction,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

// ---------------------------------
// Hook
// ---------------------------------
export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return ctx;
};

// Alias for compatibility with other providers
export const useNotification = useNotifications;

// Utility hooks
export const useNotificationsByType = (type: NotificationType) => {
  const { getNotificationsByType } = useNotifications();
  return getNotificationsByType(type);
};

export const useNotificationsByPriority = (priority: 'low' | 'normal' | 'high' | 'critical') => {
  const { getNotificationsByPriority } = useNotifications();
  return getNotificationsByPriority(priority);
};

export const useUnreadNotifications = () => {
  const { notifications, unreadCount } = useNotifications();
  return {
    unreadNotifications: notifications.filter(n => n.status === 'active'),
    unreadCount,
  };
};

export const useCriticalNotifications = () => {
  const { notifications } = useNotifications();
  return notifications.filter(n => n.priority === 'critical' && n.status !== 'dismissed');
};

// Notification creation helpers
export const useCreateNotification = () => {
  const { addNotification } = useNotifications();
  
  return {
    createAlert: (title: string, message: string, entityType?: string, entityId?: string) =>
      addNotification({
        type: 'alert',
        title,
        message,
        priority: 'high',
        source: entityType && entityId ? { entityType, entityId } : undefined,
      }),
    
    createSLABreach: (title: string, message: string, entityType: string, entityId: string) =>
      addNotification({
        type: 'sla_breach',
        title,
        message,
        priority: 'critical',
        source: { entityType, entityId, action: 'sla_breach' },
        actions: [
          { id: 'acknowledge', label: 'Acknowledge', action: 'acknowledge', style: 'primary' },
          { id: 'escalate', label: 'Escalate', action: 'escalate', style: 'danger' },
        ],
      }),
    
    createSyncError: (title: string, message: string, details?: any) =>
      addNotification({
        type: 'sync_failure',
        title,
        message,
        priority: 'normal',
        metadata: details,
        actions: [
          { id: 'retry', label: 'Retry', action: 'retry', style: 'primary' },
          { id: 'dismiss', label: 'Dismiss', action: 'dismiss', style: 'secondary' },
        ],
      }),
    
    createSystemNotification: (title: string, message: string, priority: 'low' | 'normal' | 'high' | 'critical' = 'normal') =>
      addNotification({
        type: 'system',
        title,
        message,
        priority,
      }),
    
    createSuccessNotification: (title: string, message: string) =>
      addNotification({
        type: 'success',
        title,
        message,
        priority: 'low',
      }),
  };
};