import React, { useState } from "react";
import { Link } from "react-router-dom";
import { User, Zap, MessageSquare, Info, Clock, CheckCircle2 } from "lucide-react";
import SmartScoreExplanation from "./SmartScoreExplanation.jsx";
import { useWorkItems } from "../contexts/WorkItemsContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useSync } from "../contexts/SyncContext.jsx";
import { useToast, TOAST_TYPES } from "../contexts/ToastContext.jsx";

export default function SmartQueueCardWithSelection({ 
  items = [],
  // ← ADD SELECTION PROPS
  selectionMode = false,
  selectedItems = [],
  onSelectionChange
}) {
  const { updateWorkItem } = useWorkItems();
  const { user } = useAuth();
  const { queueChange } = useSync();
  const { addToast } = useToast();

  // ← ADD SELECTION HANDLERS
  const toggleItemSelection = (itemId) => {
    if (!selectionMode || !onSelectionChange) return;
    
    const newSelection = selectedItems.includes(itemId)
      ? selectedItems.filter(id => id !== itemId)
      : [...selectedItems, itemId];
    
    onSelectionChange(newSelection);
  };

  const toggleAllSelection = () => {
    if (!selectionMode || !onSelectionChange) return;
    
    if (selectedItems.length === items.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(items.map(item => item.id));
    }
  };

  // Action handlers (same as before but updated)
  const handleReassign = async (workItem, targetUser = null) => {
    try {
      const updates = {
        assignedTo: targetUser || "dispatcher-queue",
        assigned_to_user_id: targetUser || null,
        status: targetUser ? workItem.status : "open",
        lastModified: Date.now(),
        lastModifiedBy: user?.id
      };

      await updateWorkItem(workItem.id, updates);
      
      await queueChange("reassign", {
        ...workItem,
        ...updates,
        reassignedTo: targetUser || "dispatcher-queue",
        reassignedBy: user?.username,
        reassignedAt: Date.now()
      });

      addToast({ 
        message: `${workItem.id} reassigned to ${targetUser || "dispatcher queue"}`, 
        type: TOAST_TYPES.SUCCESS 
      });

    } catch (error) {
      addToast({ 
        message: `Failed to reassign ${workItem.id}`, 
        type: TOAST_TYPES.ERROR 
      });
    }
  };

  const handleAutomation = async (workItem) => {
    if (!workItem.automation_available) {
      addToast({ 
        message: "No automation available for this work item", 
        type: TOAST_TYPES.WARNING 
      });
      return;
    }

    try {
      const updates = {
        status: "in-progress",
        automationTriggered: true,
        automationTriggeredAt: Date.now(),
        automationTriggeredBy: user?.id,
        lastModified: Date.now()
      };

      await updateWorkItem(workItem.id, updates);
      
      await queueChange("trigger_automation", {
        ...workItem,
        ...updates,
        automationId: workItem.relatedAutomation || `AUTO-${workItem.type}`,
        triggeredBy: user?.username
      });

      addToast({ 
        message: `Automation started for ${workItem.id}`, 
        type: TOAST_TYPES.SUCCESS 
      });

    } catch (error) {
      addToast({ 
        message: `Failed to trigger automation for ${workItem.id}`, 
        type: TOAST_TYPES.ERROR 
      });
    }
  };

  const handleChat = async (workItem) => {
    try {
      const updates = {
        chatInitiated: true,
        chatInitiatedAt: Date.now(),
        chatInitiatedBy: user?.id,
        lastModified: Date.now()
      };

      await updateWorkItem(workItem.id, updates);
      
      await queueChange("initiate_chat", {
        ...workItem,
        ...updates,
        chatParticipants: [user?.username, workItem.customer_name || "Customer"],
        chatType: "customer_communication"
      });

      addToast({ 
        message: `Chat initiated for ${workItem.id}`, 
        type: TOAST_TYPES.INFO 
      });

    } catch (error) {
      addToast({ 
        message: `Failed to initiate chat for ${workItem.id}`, 
        type: TOAST_TYPES.ERROR 
      });
    }
  };

  const handleQuickStatusUpdate = async (workItem, newStatus) => {
    try {
      const updates = {
        status: newStatus,
        statusUpdatedAt: Date.now(),
        statusUpdatedBy: user?.id,
        lastModified: Date.now()
      };

      if (newStatus === "resolved") {
        updates.resolvedAt = Date.now();
        updates.resolvedBy = user?.id;
      }

      await updateWorkItem(workItem.id, updates);
      
      await queueChange("update_status", {
        ...workItem,
        ...updates,
        previousStatus: workItem.status,
        updatedBy: user?.username
      });

      addToast({ 
        message: `${workItem.id} status updated to ${newStatus}`, 
        type: TOAST_TYPES.SUCCESS 
      });

    } catch (error) {
      addToast({ 
        message: `Failed to update status for ${workItem.id}`, 
        type: TOAST_TYPES.ERROR 
      });
    }
  };

  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-sm text-gray-500">No work items available</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ← ADD BULK SELECTION HEADER (only in selection mode) */}
      {selectionMode && (
        <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selectedItems.length === items.length && items.length > 0}
              onChange={toggleAllSelection}
              className="rounded"
            />
            <span className="font-medium">
              {selectedItems.length === items.length ? "Deselect All" : "Select All"}
              ({selectedItems.length}/{items.length})
            </span>
          </label>
          
          {selectedItems.length > 0 && (
            <span className="text-xs text-purple-700 font-medium">
              {selectedItems.length} selected for bulk operations
            </span>
          )}
        </div>
      )}

      {/* Work Item Cards */}
      {items.filter(Boolean).map((w) => (
        <WorkItemCard 
          key={w.id}
          workItem={w}
          onReassign={handleReassign}
          onAutomation={handleAutomation}
          onChat={handleChat}
          onStatusUpdate={handleQuickStatusUpdate}
          // ← ADD SELECTION PROPS
          selectionMode={selectionMode}
          isSelected={selectedItems.includes(w.id)}
          onToggleSelection={() => toggleItemSelection(w.id)}
        />
      ))}
    </div>
  );
}

// Enhanced WorkItemCard with selection support
function WorkItemCard({ 
  workItem, 
  onReassign, 
  onAutomation, 
  onChat, 
  onStatusUpdate,
  // ← ADD SELECTION PROPS
  selectionMode = false,
  isSelected = false,
  onToggleSelection
}) {
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  const handleActionWithProgress = async (actionFn, ...args) => {
    setIsActionInProgress(true);
    try {
      await actionFn(...args);
    } finally {
      setIsActionInProgress(false);
      setShowQuickActions(false);
    }
  };

  return (
    <div className={`border rounded-lg shadow-sm p-3 flex flex-col gap-3 transition-colors ${
      selectionMode 
        ? isSelected 
          ? "bg-purple-50 border-purple-200" 
          : "bg-white hover:bg-purple-25"
        : "bg-white"
    }`}>
      {/* ← ENHANCED HEADER WITH SELECTION CHECKBOX */}
      <div className="flex justify-between items-start gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {/* Selection checkbox (only in selection mode) */}
          {selectionMode && (
            <div className="mt-1">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={onToggleSelection}
                className="rounded"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {workItem.id}: {workItem.title}
            </div>
            {/* Show selection indicator text */}
            {selectionMode && isSelected && (
              <div className="text-xs text-purple-600 font-medium mt-1">
                ✓ Selected for bulk operations
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          <SmartScoreExplanation 
            workItem={workItem} 
            config={null}
            compactMode={true}
          />
          
          <span className={`text-xs font-semibold px-2 py-1 rounded ${
            workItem.priority === "P0"
              ? "bg-red-100 text-red-700"
              : workItem.priority === "P1"
              ? "bg-orange-100 text-orange-700"
              : workItem.priority === "P2" 
              ? "bg-yellow-100 text-yellow-700"
              : "bg-gray-100 text-gray-700"
          }`}>
            {workItem.priority}
          </span>
        </div>
      </div>

      {/* Enhanced Metadata */}
      <div className="flex flex-wrap text-xs gap-2 text-gray-600">
        <StatusBadge status={workItem.status} />
        <TypeBadge type={workItem.type} />
        <SLABadge slaBreached={workItem.slaBreached} />
        {workItem.customer_tier && <TierBadge tier={workItem.customer_tier} />}
        {workItem.automation_available && (
          <span className="px-2 py-1 rounded bg-green-50 text-green-700 flex items-center gap-1">
            <Zap size={10} />
            Auto Available
          </span>
        )}
        {/* Selection mode indicator */}
        {selectionMode && (
          <span className="px-2 py-1 rounded bg-purple-50 text-purple-700 flex items-center gap-1">
            Bulk Mode
          </span>
        )}
      </div>

      {/* Actions Section - Modified for Selection Mode */}
      <div className="flex justify-between items-center pt-2 border-t">
        {/* Left side - Quick actions or selection info */}
        {selectionMode ? (
          <div className="text-xs text-gray-600">
            {isSelected ? (
              <span className="text-purple-600 font-medium">
                Ready for bulk operation
              </span>
            ) : (
              <span>
                Click checkbox to select
              </span>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowQuickActions(!showQuickActions)}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            disabled={isActionInProgress}
          >
            Actions {showQuickActions ? "▾" : "▸"}
          </button>
        )}
        
        <Link
          to={`/workitem/${workItem.id}`}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
          title="View Details"
        >
          <Info size={14} />
          Details
        </Link>
      </div>

      {/* Expanded Actions - Hidden in selection mode */}
      {showQuickActions && !selectionMode && (
        <div className="border-t pt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {/* Reassign Actions */}
            <button
              onClick={() => handleActionWithProgress(onReassign, workItem)}
              disabled={isActionInProgress}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 disabled:opacity-50"
            >
              <User size={12} />
              To Queue
            </button>

            <button
              onClick={() => handleActionWithProgress(onReassign, workItem, "current-user")}
              disabled={isActionInProgress}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100 disabled:opacity-50"
            >
              <User size={12} />
              To Me
            </button>

            {/* Automation Action */}
            <button
              onClick={() => handleActionWithProgress(onAutomation, workItem)}
              disabled={isActionInProgress || !workItem.automation_available}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded hover:bg-purple-100 disabled:opacity-50"
            >
              <Zap size={12} />
              Automate
            </button>

            {/* Chat Action */}
            <button
              onClick={() => handleActionWithProgress(onChat, workItem)}
              disabled={isActionInProgress}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100 disabled:opacity-50"
            >
              <MessageSquare size={12} />
              Chat
            </button>
          </div>

          {/* Status Updates */}
          {workItem.status === "open" && (
            <div className="flex gap-2">
              <button
                onClick={() => handleActionWithProgress(onStatusUpdate, workItem, "in-progress")}
                disabled={isActionInProgress}
                className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <Clock size={12} />
                Start Work
              </button>
            </div>
          )}

          {workItem.status === "in-progress" && (
            <div className="flex gap-2">
              <button
                onClick={() => handleActionWithProgress(onStatusUpdate, workItem, "resolved")}
                disabled={isActionInProgress}
                className="flex items-center gap-1 text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
              >
                <CheckCircle2 size={12} />
                Mark Resolved
              </button>
            </div>
          )}
        </div>
      )}

      {/* Action Progress Indicator */}
      {isActionInProgress && (
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <div className="w-3 h-3 border border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
          Processing...
        </div>
      )}

      {/* Selection Mode Overlay */}
      {selectionMode && (
        <div 
          className="absolute inset-0 cursor-pointer"
          onClick={onToggleSelection}
          style={{ zIndex: -1 }}
        />
      )}
    </div>
  );
}

// Helper badge components (same as before)
function StatusBadge({ status }) {
  const colors = {
    "open": "bg-blue-50 text-blue-700",
    "in-progress": "bg-purple-50 text-purple-700",
    "resolved": "bg-green-50 text-green-700",
    "closed": "bg-gray-50 text-gray-700"
  };
  
  return (
    <span className={`px-2 py-1 rounded ${colors[status] || "bg-gray-50 text-gray-700"}`}>
      {status || "—"}
    </span>
  );
}

function TypeBadge({ type }) {
  return (
    <span className="px-2 py-1 rounded bg-gray-50 text-gray-700">
      {type || "—"}
    </span>
  );
}

function SLABadge({ slaBreached }) {
  return (
    <span className={`px-2 py-1 rounded ${
      slaBreached 
        ? "bg-red-50 text-red-700" 
        : "bg-green-50 text-green-700"
    }`}>
      SLA: {slaBreached ? "Breached" : "OK"}
    </span>
  );
}

function TierBadge({ tier }) {
  const colors = {
    "platinum": "border-purple-200 text-purple-600",
    "gold": "border-yellow-200 text-yellow-600",
    "standard": "border-gray-200 text-gray-600"
  };
  
  return (
    <span className={`px-2 py-1 rounded border ${colors[tier] || colors.standard}`}>
      {tier?.toUpperCase()}
    </span>
  );
}