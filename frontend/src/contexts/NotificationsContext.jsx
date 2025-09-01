import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { getAll, setItem, delItem, clearStore, isSeeded } from "../utils/db.js";
import { useAuth } from "./AuthContext.jsx";

const NotificationsContext = createContext();

// Notification types and priorities
export const NOTIFICATION_TYPES = {
  ALERT: "alert",
  SYSTEM: "system",
  WORKFLOW: "workflow", 
  SYNC_FAILURE: "sync_failure",
  SLA_BREACH: "sla_breach",
  AUTOMATION: "automation",
  SECURITY: "security",
  MAINTENANCE: "maintenance"
};

export const NOTIFICATION_PRIORITIES = {
  LOW: "low",
  MEDIUM: "medium", 
  HIGH: "high",
  CRITICAL: "critical"
};

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [preferences, setPreferences] = useState({});
  const [stats, setStats] = useState({
    total: 0,
    unread: 0,
    critical: 0,
    acknowledged: 0
  });
  const { user } = useAuth();

  async function load() {
    try {
      setIsLoading(true);
      const items = await getAll("notifications");
      
      if (!items.length) {
        const alreadySeeded = await isSeeded();
        if (!alreadySeeded) {
          console.log("🔍 Notifications store empty, but global seeding will handle this");
        }
      }
      
      // Filter out expired notifications (older than 7 days by default)
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const activeNotifications = items.filter(notification => 
        (notification.timestamp || notification.created_at || 0) > sevenDaysAgo
      );
      
      setNotifications(activeNotifications);
      calculateStats(activeNotifications);
      
      // Clean up expired notifications from storage
      if (activeNotifications.length !== items.length) {
        const expiredIds = items
          .filter(item => !activeNotifications.includes(item))
          .map(item => item.id);
        
        for (const id of expiredIds) {
          await delItem("notifications", id);
        }
      }
      
    } catch (error) {
      console.error("Failed to load notifications:", error);
      setNotifications([]);
      setStats({ total: 0, unread: 0, critical: 0, acknowledged: 0 });
    } finally {
      setIsLoading(false);
    }
  }

  function calculateStats(items) {
    const total = items.length;
    const unread = items.filter(item => !item.read).length;
    const critical = items.filter(item => 
      item.priority === NOTIFICATION_PRIORITIES.CRITICAL || 
      item.urgency === "critical"
    ).length;
    const acknowledged = items.filter(item => item.acknowledged).length;

    setStats({ total, unread, critical, acknowledged });
  }

  async function addNotification(notification) {
    try {
      const newNotification = {
        ...notification,
        id: notification.id || `notif_${Date.now()}`,
        timestamp: notification.timestamp || Date.now(),
        created_at: notification.created_at || Date.now(),
        type: notification.type || NOTIFICATION_TYPES.SYSTEM,
        priority: notification.priority || NOTIFICATION_PRIORITIES.MEDIUM,
        read: notification.read || false,
        acknowledged: notification.acknowledged || false,
        dismissed: notification.dismissed || false,
        target_user_id: notification.target_user_id || user?.id,
        source: notification.source || "system"
      };
      
      await setItem("notifications", newNotification);
      
      // Optimistic update
      setNotifications(prev => [newNotification, ...prev]);
      calculateStats([newNotification, ...notifications]);
      
    } catch (error) {
      console.error("Failed to add notification:", error);
      throw error;
    }
  }

  async function updateNotification(id, updates) {
    try {
      const existing = notifications.find(item => item.id === id);
      if (existing) {
        const updated = {
          ...existing,
          ...updates,
          last_modified: Date.now()
        };
        
        await setItem("notifications", updated);
        
        // Optimistic update
        setNotifications(prev => prev.map(item => 
          item.id === id ? updated : item
        ));
        
        // Recalculate stats
        const newNotifications = notifications.map(item => 
          item.id === id ? updated : item
        );
        calculateStats(newNotifications);
      }
    } catch (error) {
      console.error("Failed to update notification:", error);
      await load();
      throw error;
    }
  }

  async function removeNotification(id) {
    try {
      await delItem("notifications", id);
      
      // Optimistic update
      setNotifications(prev => prev.filter(item => item.id !== id));
      calculateStats(notifications.filter(item => item.id !== id));
      
    } catch (error) {
      console.error("Failed to remove notification:", error);
      throw error;
    }
  }

  async function markAsRead(id) {
    try {
      await updateNotification(id, { 
        read: true, 
        read_at: Date.now(),
        read_by: user?.id 
      });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      throw error;
    }
  }

  async function markAllAsRead() {
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      const updatePromises = unreadNotifications.map(notification => 
        updateNotification(notification.id, { 
          read: true, 
          read_at: Date.now(),
          read_by: user?.id 
        })
      );
      
      await Promise.all(updatePromises);
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
      throw error;
    }
  }

  async function acknowledgeNotification(id) {
    try {
      await updateNotification(id, { 
        acknowledged: true, 
        acknowledged_at: Date.now(),
        acknowledged_by: user?.id 
      });
    } catch (error) {
      console.error("Failed to acknowledge notification:", error);
      throw error;
    }
  }

  async function dismissNotification(id) {
    try {
      await updateNotification(id, { 
        dismissed: true, 
        dismissed_at: Date.now(),
        dismissed_by: user?.id 
      });
    } catch (error) {
      console.error("Failed to dismiss notification:", error);
      throw error;
    }
  }

  async function snoozeNotification(id, snoozeUntil) {
    try {
      await updateNotification(id, { 
        snoozed: true,
        snoozed_until: snoozeUntil,
        snoozed_at: Date.now(),
        snoozed_by: user?.id 
      });
    } catch (error) {
      console.error("Failed to snooze notification:", error);
      throw error;
    }
  }

  async function createSystemNotification(type, message, priority = NOTIFICATION_PRIORITIES.MEDIUM, metadata = {}) {
    try {
      const notification = {
        type,
        title: metadata.title || type.charAt(0).toUpperCase() + type.slice(1),
        message,
        priority,
        source: "system",
        category: metadata.category || "system",
        extendedProps: metadata
      };
      
      await addNotification(notification);
    } catch (error) {
      console.error("Failed to create system notification:", error);
      throw error;
    }
  }

  async function createAlertNotification(alertData) {
    try {
      const notification = {
        type: NOTIFICATION_TYPES.ALERT,
        title: alertData.title || "System Alert",
        message: alertData.message,
        priority: alertData.severity === "critical" ? 
          NOTIFICATION_PRIORITIES.CRITICAL : NOTIFICATION_PRIORITIES.HIGH,
        source: "monitoring",
        category: "alert",
        extendedProps: {
          alert_id: alertData.id,
          service: alertData.service,
          severity: alertData.severity,
          actions: alertData.actions || [],
          actionRequired: true
        }
      };
      
      await addNotification(notification);
    } catch (error) {
      console.error("Failed to create alert notification:", error);
      throw error;
    }
  }

  async function clearAll() {
    try {
      await clearStore("notifications");
      await load();
    } catch (error) {
      console.error("Failed to clear notifications:", error);
      throw error;
    }
  }

  // Role-based view filtering
  const roleView = useMemo(() => {
    if (!user || !notifications.length) return notifications;
    
    // Filter based on target user and role permissions
    return notifications.filter(notification => {
      // Show notifications targeted to this user
      if (notification.target_user_id === user.id) return true;
      
      // Show notifications for user's role
      if (notification.target_roles?.includes(user.role)) return true;
      
      // Show notifications for user's team
      if (notification.target_teams?.includes(user.teamId)) return true;
      
      // Show global notifications
      if (!notification.target_user_id && !notification.target_roles && !notification.target_teams) {
        return true;
      }
      
      return false;
    });
  }, [notifications, user]);

  // Active feed (non-dismissed, non-snoozed)
  const activeFeed = useMemo(() => {
    const now = Date.now();
    return roleView.filter(notification => 
      !notification.dismissed && 
      (!notification.snoozed || (notification.snoozed_until && now > notification.snoozed_until))
    );
  }, [roleView]);

  // Dismissed notifications
  const dismissedFeed = useMemo(() => {
    return roleView.filter(notification => notification.dismissed);
  }, [roleView]);

  // Get notifications by type
  const getByType = useMemo(() => {
    const types = {};
    activeFeed.forEach(notification => {
      const type = notification.type || "system";
      if (!types[type]) {
        types[type] = [];
      }
      types[type].push(notification);
    });
    return types;
  }, [activeFeed]);

  // Get notifications by priority
  const getByPriority = useMemo(() => {
    const priorities = {};
    activeFeed.forEach(notification => {
      const priority = notification.priority || NOTIFICATION_PRIORITIES.MEDIUM;
      if (!priorities[priority]) {
        priorities[priority] = [];
      }
      priorities[priority].push(notification);
    });
    return priorities;
  }, [activeFeed]);

  // Critical notifications
  const criticalNotifications = useMemo(() => {
    return activeFeed.filter(notification => 
      notification.priority === NOTIFICATION_PRIORITIES.CRITICAL ||
      notification.urgency === "critical"
    );
  }, [activeFeed]);

  // Unread notifications
  const unreadNotifications = useMemo(() => {
    return activeFeed.filter(notification => !notification.read);
  }, [activeFeed]);

  // Actionable notifications
  const actionableNotifications = useMemo(() => {
    return activeFeed.filter(notification => 
      notification.extendedProps?.actionRequired || 
      notification.extendedProps?.actions?.length > 0
    );
  }, [activeFeed]);

  // Enhanced loading with retry logic
  useEffect(() => {
    let isMounted = true;
    
    const loadWithRetry = async (retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          if (isMounted) {
            await load();
            break;
          }
        } catch (error) {
          console.error(`Notifications load attempt ${i + 1} failed:`, error);
          if (i === retries - 1) {
            console.error("All notifications load attempts failed");
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    };

    loadWithRetry();

    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-unsnooze notifications when their snooze time expires
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const snoozedNotifications = notifications.filter(notification => 
        notification.snoozed && 
        notification.snoozed_until && 
        now > notification.snoozed_until
      );

      snoozedNotifications.forEach(notification => {
        updateNotification(notification.id, {
          snoozed: false,
          snoozed_until: null,
          unsnoozed_at: now
        });
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [notifications]);

  // Auto-cleanup old notifications
  useEffect(() => {
    const cleanup = setInterval(async () => {
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const expiredNotifications = notifications.filter(notification => 
        (notification.timestamp || notification.created_at || 0) < sevenDaysAgo
      );

      for (const notification of expiredNotifications) {
        await removeNotification(notification.id);
      }
    }, 60 * 60 * 1000); // Check every hour

    return () => clearInterval(cleanup);
  }, [notifications]);

  const contextValue = {
    notifications,
    roleView,
    activeFeed,
    dismissedFeed,
    isLoading,
    stats,
    preferences,
    getByType,
    getByPriority,
    criticalNotifications,
    unreadNotifications,
    actionableNotifications,
    NOTIFICATION_TYPES,
    NOTIFICATION_PRIORITIES,
    addNotification,
    updateNotification,
    removeNotification,
    markAsRead,
    markAllAsRead,
    acknowledgeNotification,
    dismissNotification,
    snoozeNotification,
    createSystemNotification,
    createAlertNotification,
    clearAll,
    reload: load
  };

  return (
    <NotificationsContext.Provider value={contextValue}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}