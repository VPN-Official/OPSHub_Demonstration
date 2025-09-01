import React, { useEffect, useState, useMemo } from "react";
import { useWorkItems } from "../contexts/WorkItemsContext.jsx";
import { useCosts } from "../contexts/CostsContext.jsx";
import { useAutomations } from "../contexts/AutomationsContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { Activity, AlertTriangle, TrendingDown, Clock, DollarSign, Zap, Users, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { getRoleConfig, calculateRoleBasedKPIs } from "../utils/RoleBasedDefaults.js";

export default function EnhancedPulse() {
  const { workItems = [] } = useWorkItems();
  const { costs = [] } = useCosts();
  const { automations = [] } = useAutomations();
  const { user, role } = useAuth();

  const [kpis, setKpis] = useState({});
  const [insights, setInsights] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Get role-based configuration
  const roleConfig = useMemo(() => getRoleConfig(role), [role]);

  // Calculate role-based KPIs
  useEffect(() => {
    if (!roleConfig || !user) return;

    const calculatedKPIs = calculateRoleBasedKPIs(role, user, workItems, [], costs);
    
    // Add additional role-specific calculations
    const enhancedKPIs = {
      ...calculatedKPIs,
      ...calculateCustomKPIs(role, user, workItems, automations, costs)
    };

    setKpis(enhancedKPIs);
    setInsights(generateRoleBasedInsights(role, enhancedKPIs, workItems, user));
  }, [role, workItems, user, automations, costs, roleConfig]);

  // Auto-refresh based on role preferences
  useEffect(() => {
    if (!roleConfig?.pulse.refreshInterval) return;

    const interval = setInterval(() => {
      setLastRefresh(Date.now());
      // In real app, would trigger data refresh
    }, roleConfig.pulse.refreshInterval);

    return () => clearInterval(interval);
  }, [roleConfig]);

  if (!roleConfig) {
    return (
      <div className="p-4">
        <div className="text-center py-8">Loading role configuration...</div>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-6">
      {/* Role-Aware Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Pulse Dashboard</h2>
          <div className="text-sm text-gray-600 mt-1">
            {role} • {user?.username} • Last updated: {new Date(lastRefresh).toLocaleTimeString()}
          </div>
        </div>
        <div className="text-xs text-gray-500">
          Refresh: {Math.round(roleConfig.pulse.refreshInterval / 1000)}s intervals
        </div>
      </div>

      {/* Role-Based KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {roleConfig.pulse.kpis.map(kpiName => (
          <KPICard 
            key={kpiName}
            name={kpiName}
            value={kpis[kpiName]}
            role={role}
          />
        ))}
      </div>

      {/* Role-Based Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {roleConfig.pulse.charts.map(chartName => (
          <ChartCard
            key={chartName}
            name={chartName}
            role={role}
            data={getChartData(chartName, workItems, kpis)}
          />
        ))}
      </div>

      {/* Role-Based Insights */}
      <div className="p-4 border rounded-lg bg-white shadow">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Target size={16} />
          {role} Insights
        </h3>
        
        {insights.length === 0 ? (
          <p className="text-sm text-gray-500">No insights available at this time.</p>
        ) : (
          <div className="space-y-3">
            {insights.map((insight, idx) => (
              <InsightItem key={idx} insight={insight} role={role} />
            ))}
          </div>
        )}
      </div>

      {/* Role-Specific Quick Actions */}
      <QuickActionsPanel role={role} user={user} />
    </div>
  );
}

/**
 * Calculate additional custom KPIs based on role
 */
function calculateCustomKPIs(role, user, workItems, automations, costs) {
  const customKPIs = {};

  switch (role) {
    case "Support Engineer":
      const myItems = workItems.filter(item => 
        item.assignedTo === user?.id || item.assigned_to_user_id === user?.id
      );
      
      customKPIs.my_sla_performance = myItems.filter(item => !item.slaBreached).length / Math.max(myItems.length, 1) * 100;
      customKPIs.avg_resolution_time = myItems.filter(item => item.status === "resolved").length > 0 
        ? "4.2h" : "—";
      customKPIs.customer_satisfaction = 4.6; // Placeholder
      break;

    case "Senior Site Reliability Engineer":
      customKPIs.automation_success = automations.length > 0 
        ? automations.reduce((avg, auto) => avg + (auto.success_rate || 90), 0) / automations.length
        : 95;
      customKPIs.incident_mttr = workItems
        .filter(item => item.type === "incident" && item.status === "resolved")
        .length > 0 ? "2.8h" : "—";
      customKPIs.cost_efficiency = 87; // Placeholder metric
      break;

    case "Dispatcher":
      const teamItems = workItems.filter(item => 
        item.teamId === user?.teamId || item.assigned_to_team_id === user?.teamId
      );
      
      customKPIs.queue_depth = teamItems.filter(item => 
        item.status === "open" && (!item.assignedTo && !item.assigned_to_user_id)
      ).length;
      customKPIs.sla_compliance = teamItems.filter(item => !item.slaBreached).length / Math.max(teamItems.length, 1) * 100;
      customKPIs.escalation_rate = Math.round(Math.random() * 15); // Placeholder
      break;

    case "Manager":
      const totalCosts = costs.reduce((sum, cost) => sum + cost.amount, 0);
      customKPIs.operational_costs = `$${Math.round(totalCosts / 1000)}k`;
      customKPIs.team_performance = 92; // Placeholder
      customKPIs.customer_satisfaction = 4.3; // Placeholder
      break;

    case "Automation Engineer":
      customKPIs.success_rate = automations.length > 0
        ? automations.reduce((avg, auto) => avg + (auto.success_rate || 85), 0) / automations.length
        : 88;
      customKPIs.time_saved = "24h/week"; // Placeholder
      customKPIs.cost_reduction = "$12k/month"; // Placeholder
      break;
  }

  return customKPIs;
}

/**
 * Generate role-based insights
 */
function generateRoleBasedInsights(role, kpis, workItems, user) {
  const insights = [];

  switch (role) {
    case "Support Engineer":
      if (kpis.my_active_items > 8) {
        insights.push({
          type: "warning",
          message: "High workload detected. Consider requesting help or using automation.",
          action: "View automation options",
          link: "/intelligence"
        });
      }
      
      if (kpis.my_sla_performance < 90) {
        insights.push({
          type: "alert", 
          message: "SLA performance below target. Focus on high-priority items first.",
          action: "View SLA risks",
          link: "/smartqueue?filter=sla_risk"
        });
      }
      break;

    case "Senior Site Reliability Engineer":
      if (kpis.system_health < 95) {
        insights.push({
          type: "alert",
          message: "System health degraded. Multiple assets need attention.",
          action: "View system status",
          link: "/assets"
        });
      }
      
      if (kpis.automation_success < 85) {
        insights.push({
          type: "improvement",
          message: "Automation performance below target. Review failed executions.",
          action: "Check automations",
          link: "/intelligence?tab=automations"
        });
      }
      break;

    case "Dispatcher":
      if (kpis.queue_depth > 10) {
        insights.push({
          type: "warning",
          message: "Queue depth high. Consider load balancing or additional resources.",
          action: "View queue",
          link: "/smartqueue?filter=unassigned"
        });
      }
      
      if (kpis.team_utilization > 90) {
        insights.push({
          type: "alert",
          message: "Team utilization critical. Risk of burnout and SLA breaches.",
          action: "View team status",
          link: "/schedule"
        });
      }
      break;

    case "Manager":
      if (kpis.budget_utilization > 85) {
        insights.push({
          type: "warning",
          message: "Budget utilization high. Monitor spending and forecast needs.",
          action: "View budget details",
          link: "/budget"
        });
      }
      
      const highCostItems = workItems.filter(item => item.estimated_cost > 15000);
      if (highCostItems.length > 2) {
        insights.push({
          type: "info",
          message: `${highCostItems.length} high-cost items require executive review.`,
          action: "Review high-cost items",
          link: "/smartqueue?filter=high_cost"
        });
      }
      break;

    case "Automation Engineer":
      const automationCandidates = workItems.filter(item => 
        !item.automation_available && (item.repeat_count > 3 || item.type === "enhancement")
      );
      
      if (automationCandidates.length > 5) {
        insights.push({
          type: "opportunity",
          message: `${automationCandidates.length} new automation opportunities identified.`,
          action: "View candidates", 
          link: "/smartqueue?filter=automation_candidates"
        });
      }
      break;
  }

  return insights;
}

/**
 * Get chart data based on chart name
 */
function getChartData(chartName, workItems, kpis) {
  // Placeholder chart data - in real app would be calculated from actual data
  switch (chartName) {
    case "my_workload_trend":
      return {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        values: [3, 7, 5, 9, 6]
      };
    case "team_workload":
      return {
        labels: ["Sarah", "Mike", "Lisa", "David"],
        values: [8, 6, 9, 4]
      };
    case "cost_analysis":
      return {
        labels: ["Labor", "Parts", "Vendor", "Other"],
        values: [45000, 23000, 15000, 8000]
      };
    default:
      return { labels: [], values: [] };
  }
}

/**
 * KPI Card component with role-aware styling
 */
function KPICard({ name, value, role }) {
  const getKPIConfig = (kpiName) => {
    const configs = {
      my_active_items: { 
        icon: Activity, 
        color: "text-blue-600", 
        label: "My Active Items",
        link: "/smartqueue?filter=assigned_to_me"
      },
      system_health: { 
        icon: TrendingDown, 
        color: value > 95 ? "text-green-600" : "text-red-600", 
        label: "System Health",
        suffix: "%"
      },
      team_utilization: { 
        icon: Users, 
        color: value > 90 ? "text-red-600" : "text-green-600", 
        label: "Team Utilization",
        suffix: "%"
      },
      budget_utilization: { 
        icon: DollarSign, 
        color: value > 85 ? "text-red-600" : "text-green-600", 
        label: "Budget Used",
        suffix: "%"
      },
      automation_coverage: { 
        icon: Zap, 
        color: "text-purple-600", 
        label: "Automation Coverage",
        suffix: "%"
      },
      sla_compliance: {
        icon: Clock,
        color: value > 95 ? "text-green-600" : "text-red-600",
        label: "SLA Compliance", 
        suffix: "%"
      }
    };

    return configs[kpiName] || {
      icon: Activity,
      color: "text-gray-600",
      label: kpiName.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
    };
  };

  const config = getKPIConfig(name);
  const IconComponent = config.icon;
  const displayValue = typeof value === "number" && config.suffix 
    ? `${Math.round(value)}${config.suffix}`
    : value || "—";

  const content = (
    <div className="p-4 border rounded-lg bg-white shadow hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        <IconComponent size={18} className={config.color} />
        <span className="text-sm text-gray-600">{config.label}</span>
      </div>
      <div className={`text-2xl font-bold ${config.color}`}>
        {displayValue}
      </div>
    </div>
  );

  return config.link ? (
    <Link to={config.link} className="block">
      {content}
    </Link>
  ) : content;
}

/**
 * Chart card component
 */
function ChartCard({ name, role, data }) {
  const getChartTitle = (chartName) => {
    const titles = {
      my_workload_trend: "My Workload Trend",
      team_workload: "Team Workload Distribution",
      cost_analysis: "Cost Breakdown",
      automation_performance: "Automation Performance",
      resolution_times: "Resolution Time Trends"
    };
    return titles[chartName] || chartName;
  };

  return (
    <div className="p-4 border rounded-lg bg-white shadow">
      <h4 className="font-medium mb-3">{getChartTitle(name)}</h4>
      <div className="h-32 flex items-center justify-center bg-gray-50 rounded">
        <p className="text-sm text-gray-500">
          Chart: {data.labels?.join(", ") || "No data"}
        </p>
      </div>
    </div>
  );
}

/**
 * Insight item component
 */
function InsightItem({ insight, role }) {
  const getInsightIcon = (type) => {
    switch (type) {
      case "alert": return <AlertTriangle className="text-red-600" />;
      case "warning": return <AlertTriangle className="text-yellow-600" />;
      case "opportunity": return <Target className="text-green-600" />;
      default: return <Activity className="text-blue-600" />;
    }
  };

  const getInsightBg = (type) => {
    switch (type) {
      case "alert": return "bg-red-50 border-red-200";
      case "warning": return "bg-yellow-50 border-yellow-200";
      case "opportunity": return "bg-green-50 border-green-200";
      default: return "bg-blue-50 border-blue-200";
    }
  };

  return (
    <div className={`p-3 rounded border ${getInsightBg(insight.type)}`}>
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 mt-0.5">
          {getInsightIcon(insight.type)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm">{insight.message}</p>
          {insight.action && insight.link && (
            <Link
              to={insight.link}
              className="text-xs text-blue-600 hover:text-blue-800 mt-1 inline-block"
            >
              {insight.action} →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Role-specific quick actions panel
 */
function QuickActionsPanel({ role, user }) {
  const getQuickActions = (role) => {
    switch (role) {
      case "Support Engineer":
        return [
          { label: "Create Work Item", link: "/workitem/new", icon: Activity },
          { label: "Search Knowledge", link: "/intelligence?tab=knowledge", icon: Target },
          { label: "My Queue", link: "/smartqueue?filter=assigned_to_me", icon: Activity }
        ];
      case "Manager":
        return [
          { label: "Team Performance", link: "/reports/team", icon: Users },
          { label: "Budget Status", link: "/budget", icon: DollarSign },
          { label: "High Cost Items", link: "/smartqueue?filter=high_cost", icon: AlertTriangle }
        ];
      case "Automation Engineer":
        return [
          { label: "Create Automation", link: "/intelligence?tab=automations&action=create", icon: Zap },
          { label: "Performance Review", link: "/intelligence?tab=automations", icon: TrendingDown },
          { label: "Automation Candidates", link: "/smartqueue?filter=automation_candidates", icon: Target }
        ];
      default:
        return [];
    }
  };

  const actions = getQuickActions(role);
  
  if (actions.length === 0) return null;

  return (
    <div className="p-4 border rounded-lg bg-white shadow">
      <h3 className="font-semibold mb-3">Quick Actions</h3>
      <div className="flex flex-wrap gap-2">
        {actions.map(action => {
          const IconComponent = action.icon;
          return (
            <Link
              key={action.label}
              to={action.link}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 transition-colors text-sm"
            >
              <IconComponent size={14} />
              {action.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}