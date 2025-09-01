import React, { useState } from "react";
import { Link } from "react-router-dom";
import { User, Zap, MessageSquare, Info, MoreHorizontal, Clock, CheckCircle2 } from "lucide-react";
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
  
  const [actionDropdowns, setActionDropdowns] = useState({});
  const [processingActions, setProcessingActions] = useState({});

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

  const handleReassign = async (workItem, targetUser = null) => {
    setProcessingActions(prev => ({ ...prev, [workItem.id]: true }));
    
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
    } finally {
      setProcessingActions(prev => ({ ...prev, [workItem.id]: false }));
      setActionDropdowns(prev => ({ ...prev, [workItem.id]: false }));
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

    setProcessingActions(prev => ({ ...prev, [workItem.id]: true }));

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
        automationType: workItem.automation_type || "generic",
        triggeredBy: user?.username
      });

      addToast({ 
        message: `Automation triggered for ${workItem.id}`, 
        type: TOAST_TYPES.SUCCESS 
      });

    } catch (error) {
      addToast({ 
        message: `Failed to trigger automation for ${workItem.id}`, 
        type: TOAST_TYPES.ERROR 
      });
    } finally {
      setProcessingActions(prev => ({ ...prev, [workItem.id]: false }));
      setActionDropdowns(prev => ({ ...prev, [workItem.id]: false }));
    }
  };

  const handleChat = async (workItem) => {
    try {
      await queueChange("initiate_chat", {
        workItemId: workItem.id,
        initiatedBy: user?.username,
        chatType: "support",
        timestamp: Date.now()
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
      setActionDropdowns(prev => ({ ...prev, [workItem.id]: false }));
    }
  };

  const handleStatusUpdate = async (workItem, newStatus) => {
    setProcessingActions(prev => ({ ...prev, [workItem.id]: true }));
    
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
      setProcessingActions(prev => ({ ...prev, [workItem.id]: false }));
      setActionDropdowns(prev => ({ ...prev, [workItem.id]: false }));
    }
  };

  const toggleActionDropdown = (workItemId) => {
    setActionDropdowns(prev => ({
      ...prev,
      [workItemId]: !prev[workItemId]
    }));
  };

  const closeAllDropdowns = () => {
    setActionDropdowns({});
  };

  const handleSort = (columnKey) => {
    if (onSort) {
      const direction = sortConfig?.field === columnKey && sortConfig?.direction === "asc" ? "desc" : "asc";
      onSort({ field: columnKey, direction });
    }
  };

  // Click outside handler to close dropdowns
  React.useEffect(() => {
    const handleClickOutside = () => closeAllDropdowns();
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-sm text-gray-500">No work items available</p>;
  }

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

  return (
    <div className="overflow-x-auto bg-white shadow rounded-lg">
      {selectionMode && (
        <div className="p-3 bg-purple-50 border-b border-purple-200">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedItems.length === items.length && items.length > 0}
                onChange={toggleAllSelection}
                className="rounded"
              />
              <span className="font-medium text-purple-900">
                {selectedItems.length === items.length && items.length > 0 ? "Deselect All" : "Select All"}
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
        <thead className="bg-gray-50 text-gray-700 border-b">
          <tr>
            {selectionMode && (
              <th key="select-column" className="p-3 text-left w-12">
                <span className="text-xs font-medium text-purple-700">Select</span>
              </th>
            )}
            
            {displayColumns.map((col) => (
              <th 
                key={`header-${col.key}`}
                className={`p-3 text-left ${onSort ? "cursor-pointer hover:bg-gray-100" : ""}`}
                onClick={() => handleSort(col.key)}
              >
                <div className="flex items-center gap-2">
                  {col.label}
                  {onSort && sortConfig?.field === col.key && (
                    <span className="text-xs">
                      {sortConfig.direction === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </div>
              </th>
            ))}
            <th key="actions-column" className="p-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {items
            .filter(Boolean)
            .map((workItem) => (
              <TableRow
                key={`row-${workItem.id}`}
                workItem={workItem}
                displayColumns={displayColumns}
                selectionMode={selectionMode}
                selectedItems={selectedItems}
                toggleItemSelection={toggleItemSelection}
                processingActions={processingActions}
                actionDropdowns={actionDropdowns}
                toggleActionDropdown={toggleActionDropdown}
                handleReassign={handleReassign}
                handleAutomation={handleAutomation}
                handleChat={handleChat}
                handleStatusUpdate={handleStatusUpdate}
              />
            ))}
        </tbody>
      </table>

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

// Separate TableRow component to improve key management
function TableRow({ 
  workItem, 
  displayColumns, 
  selectionMode, 
  selectedItems, 
  toggleItemSelection,
  processingActions,
  actionDropdowns,
  toggleActionDropdown,
  handleReassign,
  handleAutomation,
  handleChat,
  handleStatusUpdate
}) {
  return (
    <tr 
      className={`hover:bg-gray-50 transition-colors ${
        selectionMode && selectedItems.includes(workItem.id) 
          ? "bg-purple-50" 
          : ""
      }`}
    >
      {selectionMode && (
        <td key={`select-${workItem.id}`} className="p-3">
          <div className="flex flex-col items-center gap-1">
            <input
              type="checkbox"
              checked={selectedItems.includes(workItem.id)}
              onChange={() => toggleItemSelection(workItem.id)}
              className="rounded"
            />
            {selectedItems.includes(workItem.id) && (
              <span className="text-xs text-purple-600 font-medium">✓</span>
            )}
          </div>
        </td>
      )}
      
      {displayColumns.map((col) => (
        <td key={`cell-${workItem.id}-${col.key}`} className="p-3">
          <CellContent 
            workItem={workItem} 
            columnKey={col.key} 
            isProcessing={processingActions[workItem.id]}
            selectionMode={selectionMode}
            isSelected={selectedItems.includes(workItem.id)}
          />
        </td>
      ))}
      
      <td key={`actions-${workItem.id}`} className="p-3">
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
              {selectedItems.includes(workItem.id) && (
                <span className="text-xs text-purple-600 font-medium">
                  Selected
                </span>
              )}
            </div>
          ) : (
            <>
              <button
                onClick={() => toggleActionDropdown(workItem.id)}
                disabled={processingActions[workItem.id]}
                className="flex items-center gap-1 px-2 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded disabled:opacity-50"
              >
                <MoreHorizontal size={16} />
              </button>

              {actionDropdowns[workItem.id] && (
                <ActionDropdown
                  workItem={workItem}
                  onReassign={handleReassign}
                  onAutomation={handleAutomation}
                  onChat={handleChat}
                  onStatusUpdate={handleStatusUpdate}
                  isProcessing={processingActions[workItem.id]}
                />
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// Enhanced cell content renderer with selection awareness
function CellContent({ workItem, columnKey, isProcessing, selectionMode = false, isSelected = false }) {
  const value = workItem[columnKey];

  switch (columnKey) {
    case "slaBreached":
      return value ? (
        <span className="text-red-600 font-medium">Breached</span>
      ) : (
        <span className="text-green-600">On Track</span>
      );

    case "smartScore":
      return <SmartScoreExplanation workItem={workItem} />;

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
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          value === "open" ? "bg-blue-100 text-blue-800" :
          value === "in-progress" ? "bg-purple-100 text-purple-800" :
          value === "resolved" ? "bg-green-100 text-green-800" :
          "bg-gray-100 text-gray-800"
        } ${isProcessing ? "opacity-50" : ""}`}>
          {isProcessing ? "Updating..." : (value || "—")}
        </span>
      );

    case "type":
      return (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
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

// Fixed ActionDropdown with stable keys
function ActionDropdown({ 
  workItem, 
  onReassign, 
  onAutomation, 
  onChat, 
  onStatusUpdate,
  isProcessing 
}) {
  // Create stable dropdown items with unique identifiers
  const baseActions = [
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

  // Add status-specific actions with stable IDs
  const statusActions = [];
  if (workItem.status === "open") {
    statusActions.push({
      id: `${workItem.id}-start-work`,
      label: "Start Work",
      icon: Clock,
      action: () => onStatusUpdate(workItem, "in-progress"),
      disabled: false
    });
  }

  if (workItem.status === "in-progress") {
    statusActions.push({
      id: `${workItem.id}-mark-resolved`,
      label: "Mark Resolved",
      icon: CheckCircle2,
      action: () => onStatusUpdate(workItem, "resolved"),
      disabled: false
    });
  }

  const allActions = [...baseActions, ...statusActions];

  return (
    <div className="absolute right-0 top-8 z-50 w-48 bg-white border rounded-lg shadow-lg py-1">
      <div className="px-3 py-2 border-b">
        <div className="text-xs font-medium text-gray-900">{workItem.id}</div>
        <div className="text-xs text-gray-500 truncate">{workItem.title}</div>
      </div>
      
      {allActions.map((item) => {
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

      <div className="border-t mt-1 pt-1">
        <Link
          key={`${workItem.id}-view-details`}
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