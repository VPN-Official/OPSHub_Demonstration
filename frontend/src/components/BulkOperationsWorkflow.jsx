import React, { useState, useEffect } from "react";
import { useWorkItems } from "../contexts/WorkItemsContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useSync } from "../contexts/SyncContext.jsx";
import { useToast, TOAST_TYPES } from "../contexts/ToastContext.jsx";
import {
  CheckCircle2,
  XCircle,
  Users,
  Zap,
  Clock,
  AlertTriangle,
  Filter,
  MoreHorizontal,
  ChevronDown,
  RefreshCw,
  Download,
  Upload,
  Settings,
  Play,
  Square,
  Trash2
} from "lucide-react";

export default function BulkOperationsWorkflow({ items = [], onSelectionChange }) {
  const { updateWorkItem } = useWorkItems();
  const { user } = useAuth();
  const { queueChange } = useSync();
  const { addToast } = useToast();

  const [selectedItems, setSelectedItems] = useState(new Set());
  const [bulkAction, setBulkAction] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [filterCriteria, setFilterCriteria] = useState({
    priority: "",
    status: "",
    type: "",
    assignee: "",
    slaRisk: false
  });
  const [workflowTemplates, setWorkflowTemplates] = useState([
    {
      id: "escalation_workflow",
      name: "Escalation Workflow",
      description: "Escalate high-priority items to management",
      steps: [
        { action: "update_priority", value: "P1" },
        { action: "assign_to", value: "manager" },
        { action: "add_note", value: "Escalated due to SLA risk" }
      ],
      conditions: { slaBreached: true, priority: ["P2", "P3"] }
    },
    {
      id: "automation_workflow", 
      name: "Automation Deployment",
      description: "Deploy automation for repetitive tasks",
      steps: [
        { action: "check_automation_available" },
        { action: "trigger_automation" },
        { action: "update_status", value: "in-progress" },
        { action: "add_watcher", value: "automation_team" }
      ],
      conditions: { automation_available: true, repeat_count: { gte: 3 } }
    },
    {
      id: "maintenance_workflow",
      name: "Scheduled Maintenance",
      description: "Schedule maintenance window for changes",
      steps: [
        { action: "update_status", value: "scheduled" },
        { action: "schedule_maintenance" },
        { action: "notify_stakeholders" },
        { action: "add_approval_requirement" }
      ],
      conditions: { type: "change", impact: ["high", "critical"] }
    }
  ]);

  // Handle selection changes
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(Array.from(selectedItems));
    }
  }, [selectedItems, onSelectionChange]);

  // Smart selection based on criteria
  const selectByCriteria = () => {
    const filtered = items.filter(item => {
      if (!item) return false;
      
      // Apply filters
      if (filterCriteria.priority && item.priority !== filterCriteria.priority) return false;
      if (filterCriteria.status && item.status !== filterCriteria.status) return false;
      if (filterCriteria.type && item.type !== filterCriteria.type) return false;
      if (filterCriteria.assignee && item.assignedTo !== filterCriteria.assignee) return false;
      if (filterCriteria.slaRisk && !item.slaBreached) return false;
      
      return true;
    });

    const newSelection = new Set(filtered.map(item => item.id));
    setSelectedItems(newSelection);
    
    addToast({ 
      message: `Selected ${filtered.length} items matching criteria`, 
      type: TOAST_TYPES.INFO 
    });
  };

  // Toggle individual item selection
  const toggleSelection = (itemId) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  // Select/deselect all
  const toggleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(item => item.id)));
    }
  };

  // Execute bulk action
  const executeBulkAction = async (action, params = {}) => {
    if (selectedItems.size === 0) {
      addToast({ 
        message: "No items selected", 
        type: TOAST_TYPES.WARNING 
      });
      return;
    }

    setIsProcessing(true);
    const selectedItemsArray = Array.from(selectedItems);
    const affectedItems = items.filter(item => selectedItems.has(item.id));

    try {
      switch (action) {
        case "bulk_reassign":
          await executeBulkReassign(affectedItems, params);
          break;
        case "bulk_status_update":
          await executeBulkStatusUpdate(affectedItems, params);
          break;
        case "bulk_priority_update":
          await executeBulkPriorityUpdate(affectedItems, params);
          break;
        case "bulk_automation":
          await executeBulkAutomation(affectedItems);
          break;
        case "bulk_schedule":
          await executeBulkSchedule(affectedItems, params);
          break;
        case "apply_workflow":
          await applyWorkflow(affectedItems, params.workflowId);
          break;
        default:
          throw new Error(`Unknown bulk action: ${action}`);
      }

      addToast({ 
        message: `Bulk operation completed for ${selectedItemsArray.length} items`, 
        type: TOAST_TYPES.SUCCESS 
      });
      
      setSelectedItems(new Set()); // Clear selection
      
    } catch (error) {
      addToast({ 
        message: `Bulk operation failed: ${error.message}`, 
        type: TOAST_TYPES.ERROR 
      });
    } finally {
      setIsProcessing(false);
      setBulkAction(null);
    }
  };

  // Bulk operation implementations
  const executeBulkReassign = async (items, params) => {
    const updates = {
      assignedTo: params.targetUser || "dispatcher-queue",
      assigned_to_user_id: params.targetUser || null,
      lastModified: Date.now(),
      lastModifiedBy: user?.id,
      bulkOperation: true
    };

    const promises = items.map(async (item) => {
      await updateWorkItem(item.id, updates);
      return queueChange("bulk_reassign", {
        ...item,
        ...updates,
        bulkOperationId: Date.now(),
        reassignedBy: user?.username,
        apiEndpoint: `/api/workitems/${item.id}/reassign`,
        method: "PUT"
      });
    });

    await Promise.all(promises);
  };

  const executeBulkStatusUpdate = async (items, params) => {
    const updates = {
      status: params.newStatus,
      statusUpdatedAt: Date.now(),
      statusUpdatedBy: user?.id,
      bulkOperation: true
    };

    if (params.newStatus === "resolved") {
      updates.resolvedAt = Date.now();
      updates.resolvedBy = user?.id;
    }

    const promises = items.map(async (item) => {
      await updateWorkItem(item.id, { ...updates, previousStatus: item.status });
      return queueChange("bulk_status_update", {
        ...item,
        ...updates,
        bulkOperationId: Date.now(),
        updatedBy: user?.username,
        apiEndpoint: `/api/workitems/${item.id}/status`,
        method: "PUT"
      });
    });

    await Promise.all(promises);
  };

  const executeBulkPriorityUpdate = async (items, params) => {
    const updates = {
      priority: params.newPriority,
      priorityUpdatedAt: Date.now(),
      priorityUpdatedBy: user?.id,
      bulkOperation: true
    };

    const promises = items.map(async (item) => {
      await updateWorkItem(item.id, { ...updates, previousPriority: item.priority });
      return queueChange("bulk_priority_update", {
        ...item,
        ...updates,
        bulkOperationId: Date.now(),
        updatedBy: user?.username,
        apiEndpoint: `/api/workitems/${item.id}/priority`,
        method: "PUT"
      });
    });

    await Promise.all(promises);
  };

  const executeBulkAutomation = async (items) => {
    const automationItems = items.filter(item => item.automation_available);
    
    if (automationItems.length === 0) {
      throw new Error("No selected items have automation available");
    }

    const promises = automationItems.map(async (item) => {
      const updates = {
        status: "in-progress",
        automationTriggered: true,
        automationTriggeredAt: Date.now(),
        automationTriggeredBy: user?.id,
        bulkOperation: true
      };

      await updateWorkItem(item.id, updates);
      return queueChange("bulk_automation", {
        ...item,
        ...updates,
        bulkOperationId: Date.now(),
        automationId: item.relatedAutomation || `AUTO-${item.type}`,
        triggeredBy: user?.username,
        apiEndpoint: `/api/automations/bulk-execute`,
        method: "POST"
      });
    });

    await Promise.all(promises);
    
    if (automationItems.length < items.length) {
      addToast({ 
        message: `Automation triggered for ${automationItems.length} of ${items.length} items`, 
        type: TOAST_TYPES.WARNING 
      });
    }
  };

  const executeBulkSchedule = async (items, params) => {
    const scheduleItems = items.filter(item => 
      item.type === "change" || item.type === "maintenance"
    );

    if (scheduleItems.length === 0) {
      throw new Error("No selected items can be scheduled");
    }

    const promises = scheduleItems.map(async (item) => {
      const updates = {
        status: "scheduled",
        scheduledDate: params.scheduledDate,
        maintenanceWindow: params.maintenanceWindow,
        scheduledBy: user?.id,
        bulkOperation: true
      };

      await updateWorkItem(item.id, updates);
      return queueChange("bulk_schedule", {
        ...item,
        ...updates,
        bulkOperationId: Date.now(),
        scheduledBy: user?.username,
        apiEndpoint: `/api/schedule/bulk-create`,
        method: "POST"
      });
    });

    await Promise.all(promises);
  };

  // Apply workflow template
  const applyWorkflow = async (items, workflowId) => {
    const workflow = workflowTemplates.find(w => w.id === workflowId);
    if (!workflow) {
      throw new Error("Workflow template not found");
    }

    // Filter items that match workflow conditions
    const applicableItems = items.filter(item => 
      matchesWorkflowConditions(item, workflow.conditions)
    );

    if (applicableItems.length === 0) {
      throw new Error("No selected items match workflow conditions");
    }

    // Execute workflow steps for each item
    const promises = applicableItems.map(async (item) => {
      const workflowExecution = {
        workflowId: workflow.id,
        workflowName: workflow.name,
        executedSteps: [],
        startedAt: Date.now(),
        executedBy: user?.id
      };

      // Execute each step
      for (const step of workflow.steps) {
        try {
          await executeWorkflowStep(item, step);
          workflowExecution.executedSteps.push({
            step,
            status: "completed",
            completedAt: Date.now()
          });
        } catch (error) {
          workflowExecution.executedSteps.push({
            step,
            status: "failed",
            error: error.message,
            failedAt: Date.now()
          });
          break; // Stop on first failure
        }
      }

      workflowExecution.completedAt = Date.now();
      workflowExecution.status = workflowExecution.executedSteps.every(s => s.status === "completed") 
        ? "completed" : "failed";

      // Update item with workflow execution info
      await updateWorkItem(item.id, {
        workflowExecution,
        lastModified: Date.now(),
        bulkOperation: true
      });

      return queueChange("apply_workflow", {
        ...item,
        workflowExecution,
        bulkOperationId: Date.now(),
        executedBy: user?.username,
        apiEndpoint: `/api/workflows/${workflowId}/execute`,
        method: "POST"
      });
    });

    await Promise.all(promises);

    if (applicableItems.length < items.length) {
      addToast({ 
        message: `Workflow applied to ${applicableItems.length} of ${items.length} items`, 
        type: TOAST_TYPES.WARNING 
      });
    }
  };

  // Helper functions
  const matchesWorkflowConditions = (item, conditions) => {
    for (const [key, condition] of Object.entries(conditions)) {
      const itemValue = item[key];
      
      if (Array.isArray(condition)) {
        if (!condition.includes(itemValue)) return false;
      } else if (typeof condition === "object" && condition.gte) {
        if (itemValue < condition.gte) return false;
      } else if (condition !== itemValue) {
        return false;
      }
    }
    return true;
  };

  const executeWorkflowStep = async (item, step) => {
    switch (step.action) {
      case "update_priority":
        await updateWorkItem(item.id, { 
          priority: step.value,
          priorityUpdatedBy: user?.id,
          priorityUpdatedAt: Date.now()
        });
        break;
      case "update_status":
        await updateWorkItem(item.id, { 
          status: step.value,
          statusUpdatedBy: user?.id,
          statusUpdatedAt: Date.now()
        });
        break;
      case "assign_to":
        const assigneeId = step.value === "manager" ? "manager-queue" : step.value;
        await updateWorkItem(item.id, { 
          assignedTo: assigneeId,
          assignedAt: Date.now(),
          assignedBy: user?.id
        });
        break;
      case "trigger_automation":
        if (item.automation_available) {
          await updateWorkItem(item.id, { 
            automationTriggered: true,
            automationTriggeredAt: Date.now(),
            automationTriggeredBy: user?.id
          });
        }
        break;
      case "add_note":
        await updateWorkItem(item.id, {
          notes: [...(item.notes || []), {
            note: step.value,
            addedBy: user?.id,
            addedAt: Date.now()
          }]
        });
        break;
      default:
        console.log(`Workflow step not implemented: ${step.action}`);
    }
  };

  const getSelectedItemsSummary = () => {
    const selected = items.filter(item => selectedItems.has(item.id));
    return {
      total: selected.length,
      priorities: {
        P0: selected.filter(i => i.priority === "P0").length,
        P1: selected.filter(i => i.priority === "P1").length,
        P2: selected.filter(i => i.priority === "P2").length
      },
      statuses: {
        open: selected.filter(i => i.status === "open").length,
        "in-progress": selected.filter(i => i.status === "in-progress").length,
        resolved: selected.filter(i => i.status === "resolved").length
      },
      automationAvailable: selected.filter(i => i.automation_available).length,
      slaBreached: selected.filter(i => i.slaBreached).length
    };
  };

  const summary = getSelectedItemsSummary();

  return (
    <div className="space-y-4">
      {/* Selection Controls */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedItems.size === items.length && items.length > 0}
              onChange={toggleSelectAll}
              className="rounded"
            />
            <span className="text-sm font-medium">
              {selectedItems.size} of {items.length} selected
            </span>
          </div>

          <button
            onClick={() => setShowBulkPanel(!showBulkPanel)}
            disabled={selectedItems.size === 0}
            className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            <Settings size={14} />
            Smart Select
          </button>
        </div>

        <div className="flex items-center gap-2">
          {selectedItems.size > 0 && (
            <>
              <BulkActionDropdown
                selectedCount={selectedItems.size}
                onAction={executeBulkAction}
                isProcessing={isProcessing}
                workflowTemplates={workflowTemplates}
                summary={summary}
              />
              <button
                onClick={() => setSelectedItems(new Set())}
                className="flex items-center gap-1 px-2 py-1 text-gray-600 hover:text-red-600 text-sm"
              >
                <XCircle size={14} />
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* Smart Selection Panel */}
      {showBulkPanel && (
        <div className="p-4 bg-white border rounded-lg shadow">
          <h3 className="font-semibold mb-3">Smart Selection Criteria</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={filterCriteria.priority}
                onChange={(e) => setFilterCriteria(prev => ({ ...prev, priority: e.target.value }))}
                className="w-full text-sm border rounded px-2 py-1"
              >
                <option value="">Any</option>
                <option value="P0">P0 - Critical</option>
                <option value="P1">P1 - High</option>
                <option value="P2">P2 - Medium</option>
                <option value="P3">P3 - Low</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filterCriteria.status}
                onChange={(e) => setFilterCriteria(prev => ({ ...prev, status: e.target.value }))}
                className="w-full text-sm border rounded px-2 py-1"
              >
                <option value="">Any</option>
                <option value="open">Open</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
              <select
                value={filterCriteria.type}
                onChange={(e) => setFilterCriteria(prev => ({ ...prev, type: e.target.value }))}
                className="w-full text-sm border rounded px-2 py-1"
              >
                <option value="">Any</option>
                <option value="incident">Incident</option>
                <option value="request">Request</option>
                <option value="change">Change</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Options</label>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={filterCriteria.slaRisk}
                  onChange={(e) => setFilterCriteria(prev => ({ ...prev, slaRisk: e.target.checked }))}
                />
                SLA Risk Only
              </label>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={selectByCriteria}
              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              <Filter size={14} />
              Apply Selection
            </button>

            <div className="text-xs text-gray-600">
              {items.filter(item => {
                if (filterCriteria.priority && item.priority !== filterCriteria.priority) return false;
                if (filterCriteria.status && item.status !== filterCriteria.status) return false;
                if (filterCriteria.type && item.type !== filterCriteria.type) return false;
                if (filterCriteria.slaRisk && !item.slaBreached) return false;
                return true;
              }).length} items match criteria
            </div>
          </div>
        </div>
      )}

      {/* Selection Summary */}
      {selectedItems.size > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">Selection Summary</span>
            {isProcessing && (
              <div className="flex items-center gap-2 text-blue-700">
                <RefreshCw size={14} className="animate-spin" />
                <span className="text-sm">Processing...</span>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-blue-700 font-medium">Priorities:</span>
              <div className="space-y-1">
                {summary.priorities.P0 > 0 && <div>P0: {summary.priorities.P0}</div>}
                {summary.priorities.P1 > 0 && <div>P1: {summary.priorities.P1}</div>}
                {summary.priorities.P2 > 0 && <div>P2: {summary.priorities.P2}</div>}
              </div>
            </div>
            
            <div>
              <span className="text-blue-700 font-medium">Statuses:</span>
              <div className="space-y-1">
                {summary.statuses.open > 0 && <div>Open: {summary.statuses.open}</div>}
                {summary.statuses["in-progress"] > 0 && <div>In Progress: {summary.statuses["in-progress"]}</div>}
                {summary.statuses.resolved > 0 && <div>Resolved: {summary.statuses.resolved}</div>}
              </div>
            </div>
            
            <div>
              <span className="text-blue-700 font-medium">Automation:</span>
              <div>{summary.automationAvailable} items available</div>
            </div>
            
            <div>
              <span className="text-blue-700 font-medium">SLA Risk:</span>
              <div>{summary.slaBreached} breached</div>
            </div>
          </div>
        </div>
      )}

      {/* Item List with Selection */}
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${
              selectedItems.has(item.id) ? "bg-blue-50 border-blue-200" : "bg-white"
            }`}
          >
            <input
              type="checkbox"
              checked={selectedItems.has(item.id)}
              onChange={() => toggleSelection(item.id)}
              className="rounded"
            />
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{item.id}</span>
                <span className={`text-xs px-2 py-1 rounded ${
                  item.priority === "P0" ? "bg-red-100 text-red-700" :
                  item.priority === "P1" ? "bg-orange-100 text-orange-700" :
                  "bg-yellow-100 text-yellow-700"
                }`}>
                  {item.priority}
                </span>
                {item.slaBreached && (
                  <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">
                    SLA Risk
                  </span>
                )}
                {item.automation_available && (
                  <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">
                    Auto Available
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-600 truncate">{item.title}</div>
            </div>
            
            <div className="text-xs text-gray-500">
              {item.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Bulk Action Dropdown Component
function BulkActionDropdown({ selectedCount, onAction, isProcessing, workflowTemplates, summary }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showWorkflows, setShowWorkflows] = useState(false);

  const bulkActions = [
    {
      id: "bulk_reassign",
      label: "Reassign All",
      icon: Users,
      description: `Reassign ${selectedCount} items`,
      requiresParams: true,
      params: { targetUser: "dispatcher-queue" }
    },
    {
      id: "bulk_status_update", 
      label: "Update Status",
      icon: RefreshCw,
      description: `Update status for ${selectedCount} items`,
      requiresParams: true,
      params: { newStatus: "in-progress" }
    },
    {
      id: "bulk_priority_update",
      label: "Update Priority",
      icon: AlertTriangle,
      description: `Update priority for ${selectedCount} items`,
      requiresParams: true,
      params: { newPriority: "P2" }
    },
    {
      id: "bulk_automation",
      label: "Trigger Automation",
      icon: Zap,
      description: `Automate ${summary.automationAvailable} available items`,
      disabled: summary.automationAvailable === 0
    },
    {
      id: "bulk_schedule",
      label: "Schedule Maintenance",
      icon: Clock,
      description: "Schedule maintenance window",
      requiresParams: true,
      params: { 
        scheduledDate: new Date(Date.now() + 24*60*60*1000).toISOString().slice(0, 16),
        maintenanceWindow: 2 
      }
    }
  ];

  const handleAction = async (action, params = {}) => {
    setShowDropdown(false);
    await onAction(action.id, params || action.params);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={isProcessing}
        className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
      >
        <Play size={14} />
        Bulk Actions
        <ChevronDown size={14} />
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-8 z-50 w-64 bg-white border rounded-lg shadow-lg py-1">
          <div className="px-3 py-2 border-b">
            <div className="text-xs font-medium text-gray-900">{selectedCount} items selected</div>
          </div>

          {bulkActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action)}
              disabled={action.disabled}
              className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <action.icon size={14} className="mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium">{action.label}</div>
                <div className="text-xs text-gray-500">{action.description}</div>
              </div>
            </button>
          ))}

          <div className="border-t mt-1 pt-1">
            <button
              onClick={() => setShowWorkflows(!showWorkflows)}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-100"
            >
              <span className="text-sm font-medium">Apply Workflow</span>
              <ChevronDown size={14} className={showWorkflows ? "rotate-180" : ""} />
            </button>

            {showWorkflows && (
              <div className="bg-gray-50">
                {workflowTemplates.map((workflow) => (
                  <button
                    key={workflow.id}
                    onClick={() => handleAction({ id: "apply_workflow" }, { workflowId: workflow.id })}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    <div className="text-sm font-medium">{workflow.name}</div>
                    <div className="text-xs text-gray-500">{workflow.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}