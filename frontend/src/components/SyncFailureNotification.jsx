import React, { useState } from "react";
import { useSync } from "../contexts/SyncContext.jsx";
import { useToast, TOAST_TYPES } from "../contexts/ToastContext.jsx";
import { 
  RefreshCw, 
  AlertTriangle, 
  Clock, 
  Trash2, 
  CheckCircle2, 
  WifiOff,
  Wifi,
  Activity
} from "lucide-react";

/**
 * SyncFailureNotification
 * - Shows sync failures in NotificationsCenter
 * - Provides retry and clear functionality
 * - Displays sync statistics and status
 * - User-friendly error explanations
 */
export function SyncFailureNotification() {
  const { 
    failedOperations,
    syncQueue,
    retryFailedOperation,
    clearFailedOperations,
    attemptSync,
    online,
    syncStatus,
    syncStats,
    totalPendingCount
  } = useSync();
  
  const { addToast } = useToast();
  const [showDetails, setShowDetails] = useState(false);

  if (failedOperations.length === 0 && syncQueue.length === 0) {
    return null; // No sync issues to display
  }

  const handleRetryAll = async () => {
    for (const failed of failedOperations) {
      await retryFailedOperation(failed.id);
    }
    addToast({ 
      message: `Retrying ${failedOperations.length} failed operations`, 
      type: TOAST_TYPES.INFO 
    });
  };

  const handleRetryIndividual = async (failedId) => {
    await retryFailedOperation(failedId);
  };

  const getStatusIcon = () => {
    if (!online) return <WifiOff size={16} className="text-red-600" />;
    if (syncStatus === "syncing") return <RefreshCw size={16} className="text-blue-600 animate-spin" />;
    if (failedOperations.length > 0) return <AlertTriangle size={16} className="text-red-600" />;
    if (syncQueue.length > 0) return <Clock size={16} className="text-yellow-600" />;
    return <CheckCircle2 size={16} className="text-green-600" />;
  };

  const getStatusMessage = () => {
    if (!online) return "Offline - operations will sync when connection is restored";
    if (syncStatus === "syncing") return "Syncing operations...";
    if (failedOperations.length > 0) return `${failedOperations.length} operations failed to sync`;
    if (syncQueue.length > 0) return `${syncQueue.length} operations pending sync`;
    return "All operations synced successfully";
  };

  return (
    <div className="border rounded-lg bg-white shadow-sm">
      {/* Status Header */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <div>
              <div className="font-medium text-sm">Sync Status</div>
              <div className="text-xs text-gray-600">{getStatusMessage()}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {online && totalPendingCount > 0 && (
              <button
                onClick={attemptSync}
                disabled={syncStatus === "syncing"}
                className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw size={12} className={syncStatus === "syncing" ? "animate-spin" : ""} />
                Sync Now
              </button>
            )}
            
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              {showDetails ? "Hide Details" : "Show Details"}
            </button>
          </div>
        </div>
      </div>

      {/* Detailed Status */}
      {showDetails && (
        <div className="p-3 border-b bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <div className="font-medium text-gray-700">Total Attempts</div>
              <div className="text-gray-900">{syncStats.totalAttempts}</div>
            </div>
            <div>
              <div className="font-medium text-gray-700">Success Rate</div>
              <div className="text-green-600">
                {syncStats.totalAttempts > 0 
                  ? `${Math.round((syncStats.successCount / syncStats.totalAttempts) * 100)}%`
                  : "—"
                }
              </div>
            </div>
            <div>
              <div className="font-medium text-gray-700">Last Success</div>
              <div className="text-gray-900">
                {syncStats.lastSuccessful 
                  ? new Date(syncStats.lastSuccessful).toLocaleString()
                  : "Never"
                }
              </div>
            </div>
            <div>
              <div className="font-medium text-gray-700">Connection</div>
              <div className={online ? "text-green-600" : "text-red-600"}>
                {online ? "Online" : "Offline"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending Operations */}
      {syncQueue.length > 0 && (
        <div className="p-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-yellow-600" />
              <span className="font-medium text-sm">Pending Operations ({syncQueue.length})</span>
            </div>
          </div>
          
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {syncQueue.slice(0, 5).map(item => (
              <div key={item.id} className="text-xs text-gray-600 flex items-center gap-2">
                <Activity size={10} />
                <span>{item.description || item.action || "Unknown operation"}</span>
                <span className="text-gray-400">
                  (queued {Math.round((Date.now() - item.timestamp) / 60000)}m ago)
                </span>
              </div>
            ))}
            {syncQueue.length > 5 && (
              <div className="text-xs text-gray-500">
                ...and {syncQueue.length - 5} more operations
              </div>
            )}
          </div>
        </div>
      )}

      {/* Failed Operations */}
      {failedOperations.length > 0 && (
        <div className="p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-600" />
              <span className="font-medium text-sm text-red-800">
                Failed Operations ({failedOperations.length})
              </span>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleRetryAll}
                className="flex items-center gap-1 px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
              >
                <RefreshCw size={10} />
                Retry All
              </button>
              <button
                onClick={clearFailedOperations}
                className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
              >
                <Trash2 size={10} />
                Clear
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-40 overflow-y-auto">
            {failedOperations.map(failed => (
              <FailedOperationItem
                key={failed.id}
                failed={failed}
                onRetry={handleRetryIndividual}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Individual failed operation item
 */
function FailedOperationItem({ failed, onRetry }) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry(failed.id);
    } finally {
      setIsRetrying(false);
    }
  };

  const getUserFriendlyError = (error) => {
    if (error.includes("Network error") || error.includes("fetch")) {
      return "Network connection issue";
    }
    if (error.includes("timeout")) {
      return "Request timed out";
    }
    if (error.includes("401") || error.includes("403")) {
      return "Authentication required";
    }
    if (error.includes("500")) {
      return "Server error";
    }
    return "Sync failed";
  };

  return (
    <div className="p-2 border rounded bg-red-50 border-red-200">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-red-800 truncate">
            {failed.description || failed.action || "Unknown operation"}
          </div>
          <div className="text-xs text-red-600 mt-1">
            {getUserFriendlyError(failed.error)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Failed {Math.round((Date.now() - failed.failedAt) / 60000)} minutes ago
            {failed.attempts > 1 && ` • ${failed.attempts} attempts`}
          </div>
        </div>
        
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="flex items-center gap-1 px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50 flex-shrink-0"
        >
          <RefreshCw size={10} className={isRetrying ? "animate-spin" : ""} />
          Retry
        </button>
      </div>
    </div>
  );
}

export default SyncFailureNotification;