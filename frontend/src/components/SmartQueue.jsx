import React, { useEffect, useState, useMemo } from "react";
import { useWorkItems } from "../contexts/WorkItemsContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import SmartQueueTable from "./SmartQueueTable.jsx";
import SmartQueueCard from "./SmartQueueCard.jsx";
import BulkOperationsWorkflow from "./BulkOperationsWorkflow.jsx";
import { Filter, Shuffle, Info, RefreshCw, Settings, Users } from "lucide-react";
import { getRoleConfig, getRoleBasedWorkItemFilter } from "../utils/RoleBasedDefaults.js";

export default function CompleteSmartQueueWithBulk() {
  const { workItems = [] } = useWorkItems();
  const { user, role } = useAuth();

  const [filtered, setFiltered] = useState([]);
  const [view, setView] = useState("table");
  const [activeFilter, setActiveFilter] = useState(null);
  const [sortConfig, setSortConfig] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Bulk Operations State
  const [showBulkOps, setShowBulkOps] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);

  // Get role-based configuration
  const roleConfig = useMemo(() => getRoleConfig(role), [role]);

  // Initialize role-based defaults
  useEffect(() => {
    if (!roleConfig) return;

    const config = roleConfig.smartQueue;
    setActiveFilter(config.defaultFilter);
    setSortConfig(config.defaultSort);
    setAutoRefresh(config.autoRefresh);
  }, [roleConfig, user]);

  // Apply role-based filtering and sorting
  useEffect(() => {
    if (!workItems.length || !roleConfig || !user) return;

    let relevantItems = [...workItems].filter(Boolean);

    // Apply role-based filter
    if (activeFilter) {
      switch (activeFilter) {
        case "assigned_to_me":
          relevantItems = relevantItems.filter(item => 
            item.assignedTo === user.id || 
            item.assigned_to_user_id === user.id
          );
          break;

        case "my_team":
          relevantItems = relevantItems.filter(item => 
            item.teamId === user.teamId ||
            item.assigned_to_team_id === user.teamId
          );
          break;

        case "high_priority":
          relevantItems = relevantItems.filter(item => 
            item.priority === "P0" || item.priority === "P1"
          );
          break;

        case "critical_incidents":
          relevantItems = relevantItems.filter(item => 
            item.type === "incident" && 
            (item.priority === "P0" || item.priority === "P1")
          );
          break;

        case "automation_candidates":
          relevantItems = relevantItems.filter(item => 
            item.automation_available === true ||
            (item.repeat_count && item.repeat_count > 3) ||
            item.type === "enhancement"
          );
          break;

        case "sla_risk":
          relevantItems = relevantItems.filter(item => 
            item.slaBreached === true ||
            item.customer_tier === "platinum"
          );
          break;

        case "unassigned":
          relevantItems = relevantItems.filter(item => 
            !item.assignedTo && !item.assigned_to_user_id
          );
          break;

        case "failed_automations":
          relevantItems = relevantItems.filter(item => 
            item.automation_failed === true
          );
          break;

        case "manual_repeats":
          relevantItems = relevantItems.filter(item => 
            item.repeat_count > 5
          );
          break;

        case "my_expertise":
          if (user.skills) {
            relevantItems = relevantItems.filter(item => {
              if (!item.required_skills || !item.required_skills.length) return true;
              return item.required_skills.some(reqSkill => 
                user.skills.some(userSkill => 
                  userSkill.skill === reqSkill.skill || userSkill.skill === reqSkill
                )
              );
            });
          }
          break;

        case "high_cost":
          relevantItems = relevantItems.filter(item => 
            item.estimated_cost > 10000 || 
            item.revenue_impact_per_hour > 20000
          );
          break;

        default:
          // "all" or unknown filters show everything
          break;
      }
    }

    // Apply sorting
    if (sortConfig) {
      relevantItems.sort((a, b) => {
        const aValue = a[sortConfig.field] ?? 0;
        const bValue = b[sortConfig.field] ?? 0;
        
        if (sortConfig.direction === "desc") {
          return bValue - aValue;
        }
        return aValue - bValue;
      });
    }

    // Apply max items limit
    const maxItems = roleConfig.smartQueue.maxItems;
    if (maxItems && relevantItems.length > maxItems) {
      relevantItems = relevantItems.slice(0, maxItems);
    }

    setFiltered(relevantItems);
  }, [workItems, activeFilter, sortConfig, roleConfig, user]);

  // Auto-refresh based on role preferences
  useEffect(() => {
    if (!autoRefresh || !roleConfig?.smartQueue.autoRefresh) return;

    const interval = setInterval(() => {
      setLastRefresh(Date.now());
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, roleConfig]);

  // Responsive view detection
  useEffect(() => {
    const handleResize = () => {
      setView(window.innerWidth < 768 ? "card" : "table");
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Get available filters for current role
  const getAvailableFilters = () => {
    if (!roleConfig) return [];
    
    return roleConfig.smartQueue.showFilters.map(filterKey => ({
      key: filterKey,
      label: getFilterLabel(filterKey),
      count: getFilterCount(filterKey)
    }));
  };

  const getFilterLabel = (filterKey) => {
    const labels = {
      all: "All Items",
      assigned_to_me: "Assigned to Me",
      my_team: "My Team",
      high_priority: "High Priority",
      critical_incidents: "Critical Incidents", 
      automation_candidates: "Automation Candidates",
      sla_risk: "SLA Risk",
      unassigned: "Unassigned",
      failed_automations: "Failed Automations",
      manual_repeats: "Manual Repeats",
      my_expertise: "My Expertise",
      high_cost: "High Cost Impact"
    };
    return labels[filterKey] || filterKey;
  };

  const getFilterCount = (filterKey) => {
    switch (filterKey) {
      case "assigned_to_me":
        return workItems.filter(item => 
          item.assignedTo === user?.id || item.assigned_to_user_id === user?.id
        ).length;
      case "high_priority":
        return workItems.filter(item => 
          item.priority === "P0" || item.priority === "P1"
        ).length;
      case "sla_risk":
        return workItems.filter(item => item.slaBreached === true).length;
      default:
        return null;
    }
  };

  const handleRefresh = () => {
    setLastRefresh(Date.now());
  };

  // Bulk Operations Handlers
  const handleBulkOpsToggle = () => {
    setShowBulkOps(!showBulkOps);
    if (showBulkOps) {
      setSelectedItems([]);
    }
  };

  const handleSelectionChange = (newSelection) => {
    setSelectedItems(newSelection);
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Enhanced Header with Role Context and Bulk Operations */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shuffle size={18} /> SmartQueue
          </h2>
          <div className="text-xs text-gray-600 mt-1">
            {role} view • {filtered.length} items • 
            {roleConfig?.smartQueue.defaultFilter !== "all" && (
              <span className="ml-1 text-blue-600">
                Filtered by {getFilterLabel(activeFilter)}
              </span>
            )}
            {selectedItems.length > 0 && (
              <span className="ml-2 text-purple-600 font-medium">
                • {selectedItems.length} selected
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Auto-refresh indicator */}
          {autoRefresh && (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <RefreshCw size={12} />
              Auto-refresh
            </div>
          )}

          {/* Bulk Operations Toggle */}
          <button
            onClick={handleBulkOpsToggle}
            className={`flex items-center gap-1 px-3 py-1 rounded text-sm transition-colors ${
              showBulkOps 
                ? "bg-purple-600 text-white" 
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Users size={14} />
            Bulk Ops
          </button>

          {/* Manual refresh */}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
            title="Refresh data"
          >
            <RefreshCw size={12} />
            Refresh
          </button>

          {/* Settings (placeholder) */}
          <button
            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
            title="Queue settings"
          >
            <Settings size={12} />
          </button>
        </div>
      </div>

      {/* Role-Based Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Filter size={16} className="text-gray-600 flex-shrink-0" />
        <div className="flex gap-2 min-w-0">
          {getAvailableFilters().map(filter => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={`flex items-center gap-1 px-3 py-1 rounded text-sm whitespace-nowrap transition-colors ${
                activeFilter === filter.key
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {filter.label}
              {filter.count !== null && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeFilter === filter.key
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}>
                  {filter.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Role-Specific Helper Text */}
      <RoleBasedHelpText role={role} activeFilter={activeFilter} />

      {/* Bulk Operations Panel */}
      {showBulkOps && (
        <div className="bg-white border rounded-lg shadow">
          <div className="p-3 border-b bg-purple-50">
            <h3 className="font-semibold text-sm text-purple-900">Bulk Operations</h3>
            <p className="text-xs text-purple-700 mt-1">
              Select multiple items and apply actions in batch
            </p>
          </div>
          <BulkOperationsWorkflow
            items={filtered}
            onSelectionChange={handleSelectionChange}
          />
        </div>
      )}

      {/* Queue Content */}
      <div className="min-h-0 flex-1">
        {view === "table" ? (
          <SmartQueueTable 
            items={filtered} 
            columns={roleConfig?.smartQueue.showColumns}
            sortConfig={sortConfig}
            onSort={setSortConfig}
            selectionMode={showBulkOps}
            selectedItems={selectedItems}
            onSelectionChange={setSelectedItems}
          />
        ) : (
          <SmartQueueCard 
            items={filtered}
            selectionMode={showBulkOps}
            selectedItems={selectedItems}
            onSelectionChange={setSelectedItems}
          />
        )}
      </div>

      {/* Enhanced Queue Statistics */}
      <div className="flex justify-between items-center text-xs text-gray-600 pt-2 border-t">
        <div>
          Showing {filtered.length} of {workItems.length} items
          {roleConfig?.smartQueue.maxItems && filtered.length >= roleConfig.smartQueue.maxItems && (
            <span className="ml-2 text-orange-600">
              • Limited to {roleConfig.smartQueue.maxItems} items
            </span>
          )}
          {selectedItems.length > 0 && (
            <span className="ml-2 text-purple-600 font-medium">
              • {selectedItems.length} selected for bulk operations
            </span>
          )}
        </div>
        <div>
          Last updated: {new Date(lastRefresh).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

/**
 * Role-specific helper text and tips
 */
function RoleBasedHelpText({ role, activeFilter }) {
  const getHelpText = () => {
    switch (role) {
      case "Support Engineer":
        if (activeFilter === "assigned_to_me") {
          return "Focus on your assigned work items. Use Smart Score to prioritize effectively. Enable Bulk Ops for end-of-shift handovers.";
        }
        return "Items are pre-filtered for your role. Click Smart Scores to understand AI prioritization.";

      case "Senior Site Reliability Engineer":
        if (activeFilter === "high_priority") {
          return "Critical incidents requiring SRE expertise. Consider automation opportunities. Use Bulk Ops for systematic automation deployment.";
        }
        return "System reliability focus with automation recommendations highlighted. Bulk operations available for workflow automation.";

      case "Dispatcher":
        if (activeFilter === "my_team") {
          return "Team workload overview. Balance assignments and watch SLA compliance. Use Bulk Ops for efficient reassignment and escalation.";
        }
        return "Assignment and escalation view. Monitor team utilization and SLA risks. Bulk operations help with systematic workload management.";

      case "Manager":
        return "Strategic overview with cost and performance impact. Monitor team efficiency and customer satisfaction. Bulk operations enable policy enforcement and systematic workflows.";

      case "Automation Engineer":
        if (activeFilter === "automation_candidates") {
          return "Items with high automation potential. Look for patterns and repetitive tasks. Bulk operations help deploy automation at scale.";
        }
        return "Focus on automation opportunities and performance optimization. Use bulk workflows for systematic automation rollout.";

      default:
        return null;
    }
  };

  const helpText = getHelpText();
  
  if (!helpText) return null;

  return (
    <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-blue-800">{helpText}</p>
    </div>
  );
}