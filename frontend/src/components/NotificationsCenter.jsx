import React, { useState } from "react";
import { useNotifications } from "../contexts/NotificationsContext.jsx";
import { useSync } from "../contexts/SyncContext.jsx";
import { Bell, CheckCircle2, XCircle, Trash2, RefreshCw, AlertTriangle } from "lucide-react";
import SyncFailureNotification from "./SyncFailureNotification.jsx";

/**
 * Enhanced NotificationsCenter
 * - Unified notification feed with sync failures
 * - Filters: All, Unacked, Dismissed, Sync Issues
 * - Badge count includes sync failures
 * - Integrated sync failure management
 */
export default function EnhancedNotificationsCenter() {
  const {
    activeFeed,
    dismissedFeed,
    acknowledgeNotification,
    dismissNotification,
    dismissAllNotifications,
    badgeCount,
  } = useNotifications();

  const { 
    failedOperations, 
    syncQueue, 
    totalPendingCount,
    online 
  } = useSync();

  const [filter, setFilter] = useState("all");

  // Enhanced badge count including sync issues
  const enhancedBadgeCount = badgeCount + totalPendingCount;

  // Apply filter with sync awareness
  const getFilteredItems = () => {
    switch (filter) {
      case "all":
        return activeFeed;
      case "unacked":
        return activeFeed.filter((n) => !n.acknowledged);
      case "dismissed":
        return dismissedFeed;
      case "sync_issues":
        return []; // Sync issues handled separately by SyncFailureNotification
      default:
        return activeFeed;
    }
  };

  const filteredNotifications = getFilteredItems();

  // Check if we should show sync issues filter
  const showSyncFilter = totalPendingCount > 0;

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Enhanced Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Bell size={20} /> Notifications
        </h2>
        <div className="flex items-center gap-2">
          {/* Enhanced badge with sync awareness */}
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            enhancedBadgeCount > 0 
              ? "bg-blue-600 text-white" 
              : "bg-gray-100 text-gray-600"
          }`}>
            {enhancedBadgeCount}
          </span>
          
          {/* Connection status indicator */}
          <div className={`w-2 h-2 rounded-full ${
            online ? "bg-green-500" : "bg-red-500"
          }`} title={online ? "Online" : "Offline"} />
        </div>
      </div>

      {/* Enhanced Filters */}
      <div className="flex gap-3 text-sm border-b pb-2">
        <FilterButton
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label="All"
          count={activeFeed.length}
        />
        <FilterButton
          active={filter === "unacked"}
          onClick={() => setFilter("unacked")}
          label="Unacknowledged"
          count={activeFeed.filter(n => !n.acknowledged).length}
        />
        <FilterButton
          active={filter === "dismissed"}
          onClick={() => setFilter("dismissed")}
          label="Dismissed"
          count={dismissedFeed.length}
        />
        
        {/* Sync Issues Filter - only shown when there are sync issues */}
        {showSyncFilter && (
          <FilterButton
            active={filter === "sync_issues"}
            onClick={() => setFilter("sync_issues")}
            label="Sync Issues"
            count={totalPendingCount}
            variant="warning"
          />
        )}
      </div>

      {/* Sync Status Panel - Always visible when there are sync issues */}
      {showSyncFilter && (
        <SyncFailureNotification />
      )}

      {/* Regular Notifications Feed */}
      {filter !== "sync_issues" && (
        <div className="flex flex-col gap-2">
          {filteredNotifications.length === 0 && (
            <div className="text-sm text-gray-500 p-4 text-center border rounded-lg">
              {filter === "all" && "No notifications"}
              {filter === "unacked" && "No unacknowledged notifications"}
              {filter === "dismissed" && "No dismissed notifications"}
            </div>
          )}

          {filteredNotifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onAcknowledge={acknowledgeNotification}
              onDismiss={dismissNotification}
            />
          ))}
        </div>
      )}

      {/* Enhanced Dismiss All */}
      {filter !== "dismissed" && filter !== "sync_issues" && filteredNotifications.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={dismissAllNotifications}
            className="flex items-center gap-1 px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-sm"
          >
            <Trash2 size={14} /> Dismiss All Notifications
          </button>
        </div>
      )}

      {/* Sync Issues Summary (when not in sync filter) */}
      {totalPendingCount > 0 && filter !== "sync_issues" && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-yellow-600" />
            <div>
              <div className="text-sm font-medium text-yellow-800">
                {totalPendingCount} operations need attention
              </div>
              <div className="text-xs text-yellow-700">
                {failedOperations.length} failed, {syncQueue.length} pending
              </div>
            </div>
            <button
              onClick={() => setFilter("sync_issues")}
              className="ml-auto px-2 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700"
            >
              View Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Enhanced filter button with count and variant support
 */
function FilterButton({ active, onClick, label, count = 0, variant = "default" }) {
  const getVariantClasses = () => {
    if (active) {
      return variant === "warning" 
        ? "text-yellow-600 font-semibold border-b-2 border-yellow-600"
        : "text-blue-600 font-semibold border-b-2 border-blue-600";
    }
    return "text-gray-600 hover:text-gray-800";
  };

  return (
    <button
      onClick={onClick}
      className={`pb-2 flex items-center gap-1 ${getVariantClasses()}`}
    >
      {label}
      {count > 0 && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
          variant === "warning" 
            ? "bg-yellow-100 text-yellow-700"
            : active 
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-600"
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * Enhanced notification item component
 */
function NotificationItem({ notification, onAcknowledge, onDismiss }) {
  const getNotificationIcon = () => {
    switch (notification.type) {
      case "critical_alert":
        return <AlertTriangle size={16} className="text-red-600" />;
      case "compliance_alert":
        return <AlertTriangle size={16} className="text-orange-600" />;
      case "success":
        return <CheckCircle2 size={16} className="text-green-600" />;
      case "maintenance_reminder":
        return <Bell size={16} className="text-blue-600" />;
      case "sync_failure":
        return <RefreshCw size={16} className="text-red-600" />;
      default:
        return <Bell size={16} className="text-gray-600" />;
    }
  };

  const getUrgencyClasses = () => {
    switch (notification.urgency) {
      case "critical":
        return "border-l-4 border-red-500 bg-red-50";
      case "high":
        return "border-l-4 border-orange-500 bg-orange-50";
      case "medium":
        return "border-l-4 border-yellow-500 bg-yellow-50";
      default:
        return notification.dismissed 
          ? "bg-gray-50 text-gray-400 border-l-4 border-gray-300" 
          : "bg-white border-l-4 border-blue-500";
    }
  };

  return (
    <div className={`p-3 border rounded-lg flex justify-between items-start gap-3 ${getUrgencyClasses()}`}>
      <div className="flex items-start gap-2 flex-1 min-w-0">
        {getNotificationIcon()}
        <div className="flex-1 min-w-0">
          <p className="text-sm break-words">{notification.message}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">
              {new Date(notification.timestamp).toLocaleString()}
            </span>
            {notification.urgency && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                notification.urgency === "critical" ? "bg-red-100 text-red-700" :
                notification.urgency === "high" ? "bg-orange-100 text-orange-700" :
                notification.urgency === "medium" ? "bg-yellow-100 text-yellow-700" :
                "bg-gray-100 text-gray-700"
              }`}>
                {notification.urgency.toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex gap-2 flex-shrink-0">
        {!notification.acknowledged && !notification.dismissed && (
          <button
            onClick={() => onAcknowledge(notification.id)}
            className="text-green-600 hover:text-green-800 p-1"
            title="Acknowledge"
          >
            <CheckCircle2 size={16} />
          </button>
        )}
        {!notification.dismissed && (
          <button
            onClick={() => onDismiss(notification.id)}
            className="text-red-600 hover:text-red-800 p-1"
            title="Dismiss"
          >
            <XCircle size={16} />
          </button>
        )}
      </div>
    </div>
  );
}