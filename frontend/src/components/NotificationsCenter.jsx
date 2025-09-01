import React, { useState, useEffect } from "react";
import { useNotifications } from "../contexts/NotificationsContext.jsx";
import { useWorkItems } from "../contexts/WorkItemsContext.jsx";
import { useSync } from "../contexts/SyncContext.jsx";
import { useToast, TOAST_TYPES } from "../contexts/ToastContext.jsx";
import { Link, useNavigate } from "react-router-dom";
import { 
  Bell, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  RefreshCw, 
  AlertTriangle,
  ExternalLink,
  Clock,
  Zap,
  FileText,
  User,
  TrendingUp,
  Filter
} from "lucide-react";
import SyncFailureNotification from "./SyncFailureNotification.jsx";

export default function EnhancedNotificationsCenter() {
  const {
    activeFeed,
    dismissedFeed,
    acknowledgeNotification,
    dismissNotification,
    dismissAllNotifications,
    badgeCount,
    addNotification
  } = useNotifications();

  const { workItems } = useWorkItems();
  const { 
    failedOperations, 
    syncQueue, 
    totalPendingCount,
    online 
  } = useSync();
  
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [filter, setFilter] = useState("all");
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Enhanced badge count including sync issues
  const enhancedBadgeCount = badgeCount + totalPendingCount;

  // Generate contextual notifications based on work items and system state
  useEffect(() => {
    const generateContextualNotifications = () => {
      if (!workItems.length) return;

      // Check for SLA breaches
      const slaBreaches = workItems.filter(item => item.slaBreached && !item.notified_sla);
      slaBreaches.forEach(item => {
        addNotification(
          `SLA BREACH: ${item.id} - ${item.title}`,
          "critical_alert",
          172800000, // 48h TTL
          {
            relatedEntityId: item.id,
            relatedEntityType: "workitem",
            urgency: "critical",
            actionRequired: true,
            deepLink: `/workitem/${item.id}`,
            actions: [
              { label: "View Item", action: "navigate", target: `/workitem/${item.id}` },
              { label: "Escalate", action: "escalate", target: item.id }
            ]
          }
        );
      });

      // Check for automation opportunities  
      const automationCandidates = workItems.filter(item => 
        !item.automation_available && 
        item.repeat_count > 3 && 
        !item.notified_automation
      );
      
      if (automationCandidates.length >= 3) {
        addNotification(
          `${automationCandidates.length} work items could benefit from automation`,
          "automation_opportunity", 
          172800000,
          {
            relatedEntityType: "intelligence",
            urgency: "medium",
            deepLink: "/intelligence?tab=automations",
            actions: [
              { label: "View Candidates", action: "navigate", target: "/smartqueue?filter=automation_candidates" },
              { label: "Create Automation", action: "navigate", target: "/intelligence?tab=automations&action=create" }
            ]
          }
        );
      }

      // Check for high-value customer issues
      const platinumIssues = workItems.filter(item => 
        item.customer_tier === "platinum" && 
        item.status === "open" &&
        !item.notified_platinum
      );
      
      platinumIssues.forEach(item => {
        addNotification(
          `Platinum customer issue: ${item.customer_name} - ${item.title}`,
          "customer_alert",
          172800000,
          {
            relatedEntityId: item.id,
            relatedEntityType: "workitem", 
            urgency: "high",
            deepLink: `/workitem/${item.id}`,
            customerTier: "platinum"
          }
        );
      });
    };

    // Run contextual notification generation every 5 minutes
    const interval = setInterval(generateContextualNotifications, 5 * 60 * 1000);
    generateContextualNotifications(); // Run immediately

    return () => clearInterval(interval);
  }, [workItems, addNotification]);

  // Enhanced filtering with deep link support
  const getFilteredItems = () => {
    let notifications = [];

    switch (filter) {
      case "all":
        notifications = activeFeed;
        break;
      case "unacked":
        notifications = activeFeed.filter((n) => !n.acknowledged);
        break;
      case "critical":
        notifications = activeFeed.filter((n) => n.urgency === "critical");
        break;
      case "actionable":
        notifications = activeFeed.filter((n) => n.extendedProps?.actionRequired);
        break;
      case "dismissed":
        notifications = dismissedFeed;
        break;
      case "sync_issues":
        return []; // Handled by SyncFailureNotification
      default:
        notifications = activeFeed;
    }

    return notifications.sort((a, b) => {
      // Sort by urgency, then by timestamp
      const urgencyOrder = { critical: 3, high: 2, medium: 1, info: 0 };
      const aUrgency = urgencyOrder[a.urgency] || 0;
      const bUrgency = urgencyOrder[b.urgency] || 0;
      
      if (aUrgency !== bUrgency) return bUrgency - aUrgency;
      return b.timestamp - a.timestamp;
    });
  };

  const filteredNotifications = getFilteredItems();
  const showSyncFilter = totalPendingCount > 0;

  // Handle notification actions
  const handleNotificationAction = async (notification, action) => {
    try {
      switch (action.action) {
        case "navigate":
          navigate(action.target);
          await acknowledgeNotification(notification.id);
          break;
          
        case "escalate":
          // Implement escalation logic
          addToast({ 
            message: `Escalating ${action.target}...`, 
            type: TOAST_TYPES.INFO 
          });
          await acknowledgeNotification(notification.id);
          break;
          
        case "acknowledge":
          await acknowledgeNotification(notification.id);
          break;
          
        default:
          console.log("Unknown action:", action);
      }
    } catch (error) {
      addToast({ 
        message: `Action failed: ${error.message}`, 
        type: TOAST_TYPES.ERROR 
      });
    }
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Enhanced Header with Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Bell size={20} /> 
            Notifications
          </h2>
          <div className="text-sm text-gray-600 mt-1">
            {enhancedBadgeCount} requiring attention • {activeFeed.length} total active
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
            online ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}>
            <div className={`w-2 h-2 rounded-full ${online ? "bg-green-500" : "bg-red-500"}`} />
            {online ? "Online" : "Offline"}
          </div>

          {/* Enhanced badge */}
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            enhancedBadgeCount > 0 
              ? "bg-red-100 text-red-800" 
              : "bg-gray-100 text-gray-600"
          }`}>
            {enhancedBadgeCount}
          </span>

          <button
            onClick={() => setShowCreateForm(true)}
            className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
          >
            Create Alert
          </button>
        </div>
      </div>

      {/* Enhanced Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Filter size={16} className="text-gray-600 flex-shrink-0" />
        <div className="flex gap-2 min-w-0">
          {[
            { key: "all", label: "All", count: activeFeed.length },
            { key: "unacked", label: "Unacknowledged", count: activeFeed.filter(n => !n.acknowledged).length },
            { key: "critical", label: "Critical", count: activeFeed.filter(n => n.urgency === "critical").length, variant: "critical" },
            { key: "actionable", label: "Actionable", count: activeFeed.filter(n => n.extendedProps?.actionRequired).length },
            { key: "dismissed", label: "Dismissed", count: dismissedFeed.length }
          ].map(filterOption => (
            <FilterButton
              key={filterOption.key}
              active={filter === filterOption.key}
              onClick={() => setFilter(filterOption.key)}
              label={filterOption.label}
              count={filterOption.count}
              variant={filterOption.variant}
            />
          ))}
          
          {/* Sync Issues Filter */}
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
      </div>

      {/* Sync Status Panel */}
      {showSyncFilter && filter !== "sync_issues" && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">
                {totalPendingCount} operations need attention
              </span>
            </div>
            <button
              onClick={() => setFilter("sync_issues")}
              className="text-sm bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700"
            >
              View Details
            </button>
          </div>
        </div>
      )}

      {/* Sync Issues Detail */}
      {filter === "sync_issues" && (
        <SyncFailureNotification />
      )}

      {/* Enhanced Notifications Feed */}
      {filter !== "sync_issues" && (
        <div className="flex flex-col gap-3">
          {filteredNotifications.length === 0 ? (
            <EmptyState filter={filter} />
          ) : (
            <>
              {filteredNotifications.map((notification) => (
                <EnhancedNotificationItem
                  key={notification.id}
                  notification={notification}
                  onAcknowledge={acknowledgeNotification}
                  onDismiss={dismissNotification}
                  onAction={handleNotificationAction}
                />
              ))}
              
              {/* Bulk Actions */}
              {filteredNotifications.length > 0 && filter !== "dismissed" && (
                <div className="flex justify-between items-center pt-3 border-t">
                  <span className="text-sm text-gray-500">
                    {filteredNotifications.length} notifications
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        filteredNotifications.forEach(n => !n.acknowledged && acknowledgeNotification(n.id));
                        addToast({ message: "All notifications acknowledged", type: TOAST_TYPES.SUCCESS });
                      }}
                      className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200"
                    >
                      Acknowledge All
                    </button>
                    <button
                      onClick={() => {
                        dismissAllNotifications();
                        addToast({ message: "All notifications dismissed", type: TOAST_TYPES.SUCCESS });
                      }}
                      className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200"
                    >
                      Dismiss All
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Create Notification Form */}
      {showCreateForm && (
        <CreateNotificationModal
          onClose={() => setShowCreateForm(false)}
          onCreate={(notificationData) => {
            addNotification(
              notificationData.message,
              notificationData.type,
              notificationData.ttl
            );
            setShowCreateForm(false);
            addToast({ message: "Custom notification created", type: TOAST_TYPES.SUCCESS });
          }}
        />
      )}
    </div>
  );
}

// Enhanced filter button component
function FilterButton({ active, onClick, label, count = 0, variant = "default" }) {
  const getVariantClasses = () => {
    if (active) {
      switch (variant) {
        case "critical": return "bg-red-600 text-white";
        case "warning": return "bg-yellow-600 text-white";
        default: return "bg-blue-600 text-white";
      }
    }
    
    switch (variant) {
      case "critical": return "text-red-600 hover:bg-red-50";
      case "warning": return "text-yellow-600 hover:bg-yellow-50";
      default: return "text-gray-600 hover:bg-gray-100";
    }
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-1 rounded text-sm font-medium transition-colors whitespace-nowrap ${getVariantClasses()}`}
    >
      {label}
      {count > 0 && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
          active ? "bg-white bg-opacity-20" : "bg-gray-200 text-gray-600"
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

// Enhanced notification item with deep linking and actions
function EnhancedNotificationItem({ notification, onAcknowledge, onDismiss, onAction }) {
  const [showActions, setShowActions] = useState(false);

  const getNotificationIcon = () => {
    const iconProps = { size: 16 };
    
    switch (notification.type) {
      case "critical_alert":
        return <AlertTriangle {...iconProps} className="text-red-600" />;
      case "customer_alert":
        return <User {...iconProps} className="text-purple-600" />;
      case "automation_opportunity":
        return <Zap {...iconProps} className="text-green-600" />;
      case "compliance_alert":
        return <FileText {...iconProps} className="text-orange-600" />;
      case "success":
        return <CheckCircle2 {...iconProps} className="text-green-600" />;
      case "maintenance_reminder":
        return <Clock {...iconProps} className="text-blue-600" />;
      case "performance_alert":
        return <TrendingUp {...iconProps} className="text-yellow-600" />;
      default:
        return <Bell {...iconProps} className="text-gray-600" />;
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

  const hasActions = notification.extendedProps?.actions?.length > 0;

  return (
    <div className={`border rounded-lg shadow-sm ${getUrgencyClasses()}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            {getNotificationIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 break-words">
              {notification.message}
            </p>
            
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-gray-500">
                {new Date(notification.timestamp).toLocaleString()}
              </span>
              
              {notification.urgency && (
                <span className={`text-xs px-2 py-1 rounded font-medium ${
                  notification.urgency === "critical" ? "bg-red-100 text-red-700" :
                  notification.urgency === "high" ? "bg-orange-100 text-orange-700" :
                  notification.urgency === "medium" ? "bg-yellow-100 text-yellow-700" :
                  "bg-gray-100 text-gray-700"
                }`}>
                  {notification.urgency.toUpperCase()}
                </span>
              )}

              {notification.extendedProps?.relatedEntityType && (
                <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
                  {notification.extendedProps.relatedEntityType}
                </span>
              )}
            </div>

            {/* Deep Link */}
            {notification.extendedProps?.deepLink && (
              <Link
                to={notification.extendedProps.deepLink}
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mt-2"
                onClick={() => onAcknowledge(notification.id)}
              >
                <ExternalLink size={12} />
                View Details
              </Link>
            )}

            {/* Quick Actions */}
            {hasActions && (
              <div className="mt-3">
                <button
                  onClick={() => setShowActions(!showActions)}
                  className="text-xs text-gray-600 hover:text-gray-800"
                >
                  Actions {showActions ? "▾" : "▸"}
                </button>
                
                {showActions && (
                  <div className="flex gap-2 mt-2">
                    {notification.extendedProps.actions.map((action, index) => (
                      <button
                        key={index}
                        onClick={() => onAction(notification, action)}
                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
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
      </div>
    </div>
  );
}

// Empty state component
function EmptyState({ filter }) {
  const getEmptyMessage = () => {
    switch (filter) {
      case "critical":
        return "No critical notifications - system operating normally";
      case "unacked": 
        return "All notifications have been acknowledged";
      case "actionable":
        return "No notifications require immediate action";
      case "dismissed":
        return "No dismissed notifications";
      default:
        return "No notifications to display";
    }
  };

  return (
    <div className="text-center py-8">
      <Bell size={48} className="mx-auto text-gray-300 mb-3" />
      <p className="text-gray-500">{getEmptyMessage()}</p>
    </div>
  );
}

// Create notification modal
function CreateNotificationModal({ onClose, onCreate }) {
  const [formData, setFormData] = useState({
    message: "",
    type: "info",
    urgency: "medium",
    ttl: 172800000 // 48 hours
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">Create Custom Notification</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm h-20"
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="info">Info</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="critical_alert">Critical</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Urgency
              </label>
              <select
                value={formData.urgency}
                onChange={(e) => setFormData(prev => ({ ...prev, urgency: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="info">Info</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          
          <div className="flex gap-2 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}