import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  User, 
  Zap, 
  MessageSquare, 
  Info, 
  MoreHorizontal, 
  Clock, 
  CheckCircle2 
} from "lucide-react";
import SmartScoreExplanation from "./SmartScoreExplanation.jsx";
import { useWorkItems } from "../contexts/WorkItemsContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useSync } from "../contexts/SyncContext.jsx";
import { useToast, TOAST_TYPES } from "../contexts/ToastContext.jsx";

export default function CompleteSmartQueueTable({ 
  items = [], 
  columns, 
  sortConfig, 
  onSort,
  selectionMode = false,
  selectedItems = [],
  onSelectionChange
}) {
  const { updateWorkItem } = useWorkItems();
  const { user } = useAuth();
  const { queueChange } = useSync();
  const { addToast } = useToast();
  
  const [openDropdowns, setOpenDropdowns] = useState(new Set());
  const [loadingActions, setLoadingActions] = useState(new Set());

  // Default columns configuration
  const defaultColumns = [
    { key: "id", label: "ID" },
    { key: "title", label: "Title" },
    { key: "priority", label: "Priority" },
    { key: "status", label: "Status" },
    { key: "type", label: "Type" },
    { key: "slaBreached", label: "SLA" },
    { key: "smartScore", label: "AI Score" },
  ];

  const displayColumns = columns || defaultColumns;

  // Selection handlers
  const handleToggleItem = (itemId) => {
    if (!selectionMode || !onSelectionChange) return;
    
    const newSelection = selectedItems.includes(itemId)
      ? selectedItems.filter(id => id !== itemId)
      : [...selectedItems, itemId];
    
    onSelectionChange(newSelection);
  };

  const handleToggleAll = () => {
    if (!selectionMode || !onSelectionChange) return;
    
    const allSelected = selectedItems.length === items.length && items.length > 0;
    onSelectionChange(allSelected ? [] : items.map(item => item.id));
  };

  // Dropdown management
  const toggleDropdown = (itemId) => {
    setOpenDropdowns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.clear(); // Close all others
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const closeAllDropdowns = () => {
    setOpenDropdowns(new Set());
  };

  // Action handlers
  const handleReassign = async (workItem, targetUser = null) => {
    setLoadingActions(prev => new Set([...prev, workItem.id]));
    
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
        message: `${workItem.id} reassigned successfully`, 
        type: TOAST_TYPES.SUCCESS 
      });

    } catch (error) {
      addToast({ 
        message: `Failed to reassign ${workItem.id}`, 
        type: TOAST_TYPES.ERROR 
      });
    } finally {
      setLoadingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(workItem.id);
        return newSet;
      });
      closeAllDropdowns();
    }
  };

  const handleAutomation = async (workItem) => {
    if (!workItem.automation_available) {
      addToast({ 
        message: "No automation available for this item", 
        type: TOAST_TYPES.WARNING 
      });
      return;
    }

    setLoadingActions(prev => new Set([...prev, workItem.id]));

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
    } finally {
      setLoadingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(workItem.id);
        return newSet;
      });
      closeAllDropdowns();
    }
  };

  const handleChat = async (workItem) => {
    setLoadingActions(prev => new Set([...prev, workItem.id]));
    
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
    } finally {
      setLoadingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(workItem.id);
        return newSet;
      });
      closeAllDropdowns();
    }
  };

  const handleStatusUpdate = async (workItem, newStatus) => {
    setLoadingActions(prev => new Set([...prev, workItem.id]));
    
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
    } finally {
      setLoadingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(workItem.id);
        return newSet;
      });
      closeAllDropdowns();
    }
  };

  const handleSort = (columnKey) => {
    if (!onSort) return;
    
    const direction = sortConfig?.field === columnKey && sortConfig?.direction === "asc" 
      ? "desc" 
      : "asc";
    onSort({ field: columnKey, direction });
  };

  // Click outside handler to close dropdowns
  useEffect(() => {
    const handleClickOutside = () => closeAllDropdowns();
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Early return for empty state
  if (!Array.isArray(items) || items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow">
        <p>No work items available</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white shadow rounded-lg">
      {/* Selection Header */}
      {selectionMode && (
        <div className="p-3 bg-purple-50 border-b border-purple-200">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selectedItems.length === items.length && items.length > 0}
                onChange={handleToggleAll}
                className="rounded"
              />
              <span className="font-medium text-purple-900">
                {selectedItems.length === items.length && items.length > 0 
                  ? "Deselect All" 
                  : "Select All"
                }
                ({selectedItems.length}/{items.length})
              </span>
            </label>
            
            {selectedItems.length > 0 && (
              <div className="text-xs text-purple-700 font-medium">
                {selectedItems.length} selected for bulk operations
              </div>
            )}
          </div>
        </div>
      )}

      <table className="min-w-full text-sm">
        {/* Table Header */}
        <thead className="bg-gray-50 text-gray-700 border-b">
          <tr>
            {/* Selection Column Header */}
            {selectionMode && (
              <th className="p-3 text-left w-12">
                <span className="text-xs font-medium text-purple-700">Select</span>
              </th>
            )}
            
            {/* Data Column Headers */}
            {displayColumns.map((column) => (
              <th 
                key={column.key}
                className={`p-3 text-left ${
                  onSort ? "cursor-pointer hover:bg-gray-100" : ""
                }`}
                onClick={() => handleSort(column.key)}
              >
                <div className="flex items-center gap-2">
                  {column.label}
                  {onSort && sortConfig?.field === column.key && (
                    <span className="text-xs">
                      {sortConfig.direction === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </div>
              </th>
            ))}
            
            {/* Actions Column Header */}
            <th className="p-3 text-left">Actions</th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody className="divide-y divide-gray-200">
          {items
            .filter(Boolean)
            .map((workItem) => (
              <TableRow
                key={workItem.id}
                workItem={workItem}
                columns={displayColumns}
                selectionMode={selectionMode}
                isSelected={selectedItems.includes(workItem.id)}
                isLoading={loadingActions.has(workItem.id)}
                isDropdownOpen={openDropdowns.has(workItem.id)}
                onToggleSelection={() => handleToggleItem(workItem.id)}
                onToggleDropdown={() => toggleDropdown(workItem.id)}
                onReassign={handleReassign}
                onAutomation={handleAutomation}
                onChat={handleChat}
                onStatusUpdate={handleStatusUpdate}
              />
            ))}
        </tbody>
      </table>

      {/* Selection Summary Footer */}
      {selectionMode && selectedItems.length > 0 && (
        <div className="p-3 bg-purple-50 border-t border-purple-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-purple-900 font-medium">
              {selectedItems.length} items selected for bulk operations
            </span>
            <button
              onClick={() => onSelectionChange([])}
              className="text-purple-600 hover:text-purple-800 text-xs"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Table Row Component
function TableRow({ 
  workItem, 
  columns, 
  selectionMode, 
  isSelected, 
  isLoading,
  isDropdownOpen,
  onToggleSelection, 
  onToggleDropdown,
  onReassign,
  onAutomation,
  onChat,
  onStatusUpdate
}) {
  return (
    <tr 
      className={`hover:bg-gray-50 transition-colors ${
        selectionMode && isSelected ? "bg-purple-50" : ""
      }`}
    >
      {/* Selection Cell */}
      {selectionMode && (
        <td className="p-3">
          <div className="flex flex-col items-center gap-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelection}
              className="rounded"
            />
            {isSelected && (
              <span className="text-xs text-purple-600 font-medium">✓</span>
            )}
          </div>
        </td>
      )}
      
      {/* Data Cells */}
      {columns.map((column) => (
        <td key={column.key} className="p-3">
          <CellContent 
            workItem={workItem} 
            columnKey={column.key} 
            isProcessing={isLoading}
            selectionMode={selectionMode}
            isSelected={isSelected}
          />
        </td>
      ))}
      
      {/* Actions Cell */}
      <td className="p-3">
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          {selectionMode ? (
            <div className="flex items-center gap-2">
              <Link
                to={`/workitem/${workItem.id}`}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 rounded hover:bg-blue-100"
              >
                <Info size={12} />
                Details
              </Link>
              {isSelected && (
                <span className="text-xs text-purple-600 font-medium">
                  Selected
                </span>
              )}
            </div>
          ) : (
            <>
              <button
                onClick={onToggleDropdown}
                disabled={isLoading}
                className="flex items-center gap-1 px-2 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded disabled:opacity-50"
              >
                <MoreHorizontal size={16} />
              </button>

              {isDropdownOpen && (
                <ActionDropdown
                  workItem={workItem}
                  onReassign={onReassign}
                  onAutomation={onAutomation}
                  onChat={onChat}
                  onStatusUpdate={onStatusUpdate}
                  isProcessing={isLoading}
                />
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// Cell Content Renderer
function CellContent({ workItem, columnKey, isProcessing, selectionMode = false, isSelected = false }) {
  const value = workItem[columnKey];

  switch (columnKey) {
    case "slaBreached":
      return value ? (
        <span className="text-red-600 font-medium flex items-center gap-1">
          <Clock size={12} />
          Breached
        </span>
      ) : (
        <span className="text-green-600 flex items-center gap-1">
          <CheckCircle2 size={12} />
          OK
        </span>
      );

    case "smartScore":
      return (
        <SmartScoreExplanation 
          workItem={workItem} 
          config={null}
        />
      );

    case "priority":
      return (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          value === "P0" ? "bg-red-100 text-red-800" :
          value === "P1" ? "bg-orange-100 text-orange-800" :
          value === "P2" ? "bg-yellow-100 text-yellow-800" :
          "bg-gray-100 text-gray-800"
        }`}>
          {value || "—"}
        </span>
      );

    case "status":
      return (
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-xs ${
            value === "open" ? "bg-blue-100 text-blue-800" :
            value === "in-progress" ? "bg-purple-100 text-purple-800" :
            value === "resolved" ? "bg-green-100 text-green-800" :
            "bg-gray-100 text-gray-800"
          }`}>
            {value || "—"}
          </span>
          {isProcessing && (
            <div className="w-3 h-3 border border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
          )}
          {selectionMode && isSelected && (
            <span className="text-xs text-purple-600">•</span>
          )}
        </div>
      );

    case "title":
      return (
        <div className="flex items-center gap-2">
          <Link 
            to={`/workitem/${workItem.id}`}
            className={`hover:text-blue-600 hover:underline ${
              selectionMode && isSelected ? "text-purple-700 font-medium" : ""
            }`}
          >
            {value || "—"}
          </Link>
          {selectionMode && isSelected && (
            <span className="text-xs bg-purple-100 text-purple-700 px-1 rounded">
              SELECTED
            </span>
          )}
        </div>
      );

    case "type":
      return (
        <span className={`px-2 py-1 rounded text-xs ${
          selectionMode && isSelected 
            ? "bg-purple-100 text-purple-800" 
            : "bg-gray-100 text-gray-800"
        }`}>
          {value || "—"}
        </span>
      );

    default:
      return (
        <span className={selectionMode && isSelected ? "text-purple-700 font-medium" : ""}>
          {value || "—"}
        </span>
      );
  }
}

// Action Dropdown Component
function ActionDropdown({ 
  workItem, 
  onReassign, 
  onAutomation, 
  onChat, 
  onStatusUpdate,
  isProcessing 
}) {
  // Create action items with unique keys
  const actionItems = [
    {
      id: `${workItem.id}-reassign-queue`,
      label: "Reassign to Queue",
      icon: User,
      action: () => onReassign(workItem),
      disabled: false
    },
    {
      id: `${workItem.id}-assign-me`,
      label: "Assign to Me",
      icon: User,
      action: () => onReassign(workItem, "current-user"),
      disabled: false
    },
    {
      id: `${workItem.id}-automation`,
      label: "Trigger Automation",
      icon: Zap,
      action: () => onAutomation(workItem),
      disabled: !workItem.automation_available
    },
    {
      id: `${workItem.id}-chat`,
      label: "Initiate Chat",
      icon: MessageSquare,
      action: () => onChat(workItem),
      disabled: false
    }
  ];

  // Add status-specific actions
  if (workItem.status === "open") {
    actionItems.push({
      id: `${workItem.id}-start-work`,
      label: "Start Work",
      icon: Clock,
      action: () => onStatusUpdate(workItem, "in-progress"),
      disabled: false
    });
  }

  if (workItem.status === "in-progress") {
    actionItems.push({
      id: `${workItem.id}-mark-resolved`,
      label: "Mark Resolved",
      icon: CheckCircle2,
      action: () => onStatusUpdate(workItem, "resolved"),
      disabled: false
    });
  }

  return (
    <div className="absolute right-0 top-8 z-50 w-48 bg-white border rounded-lg shadow-lg py-1">
      {/* Header */}
      <div className="px-3 py-2 border-b">
        <div className="text-xs font-medium text-gray-900">{workItem.id}</div>
        <div className="text-xs text-gray-500 truncate">{workItem.title}</div>
      </div>
      
      {/* Action Items */}
      {actionItems.map((item) => {
        const IconComponent = item.icon;
        return (
          <button
            key={item.id}
            onClick={item.action}
            disabled={item.disabled || isProcessing}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <IconComponent size={14} />
            {item.label}
          </button>
        );
      })}

      {/* Detail Link */}
      <div className="border-t mt-1 pt-1">
        <Link
          to={`/workitem/${workItem.id}`}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100"
        >
          <Info size={14} />
          View Details
        </Link>
      </div>
    </div>
  );
}