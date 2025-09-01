import React, { useEffect, useState, useMemo } from "react";
import { useWorkItems } from "../contexts/WorkItemsContext.jsx";
import { useCosts } from "../contexts/CostsContext.jsx";
import { useAutomations } from "../contexts/AutomationsContext.jsx";
import { useNotifications } from "../contexts/NotificationsContext.jsx";
import { useSync } from "../contexts/SyncContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { Link, useNavigate } from "react-router-dom";
import { 
  Activity, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp, 
  Clock, 
  DollarSign, 
  Zap, 
  Users, 
  Target,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  BarChart3,
  PieChart
} from "lucide-react";
import { getRoleConfig, calculateRoleBasedKPIs } from "../utils/RoleBasedDefaults.js";

export default function EnhancedPulseDashboard() {
  const { workItems = [] } = useWorkItems();
  const { costs = [] } = useCosts();
  const { automations = [] } = useAutomations();
  const { activeFeed } = useNotifications();
  const { online, totalPendingCount } = useSync();
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const [kpis, setKpis] = useState({});
  const [insights, setInsights] = useState([]);
  const [trends, setTrends] = useState({});
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get role-based configuration
  const roleConfig = useMemo(() => getRoleConfig(role), [role]);

  // Enhanced KPI calculations with business intelligence
  useEffect(() => {
    if (!roleConfig || !user) return;

    const calculateEnhancedKPIs = () => {
      const baseKPIs = calculateRoleBasedKPIs(role, user, workItems, [], costs);
      
      // Add enhanced business intelligence KPIs
      const enhancedKPIs = {
        ...baseKPIs,
        
        // Operational Health
        system_health: calculateSystemHealth(),
        incident_rate: calculateIncidentRate(),
        resolution_efficiency: calculateResolutionEfficiency(),
        
        // Customer Impact  
        customer_satisfaction: calculateCustomerSatisfaction(),
        sla_compliance: calculateSLACompliance(),
        revenue_at_risk: calculateRevenueAtRisk(),
        
        // Team Performance
        team_utilization: calculateTeamUtilization(),
        automation_coverage: calculateAutomationCoverage(),
        knowledge_effectiveness: calculateKnowledgeEffectiveness(),
        
        // Financial Metrics
        operational_costs: calculateOperationalCosts(),
        cost_per_incident: calculateCostPerIncident(),
        savings_from_automation: calculateAutomationSavings()
      };

      setKpis(enhancedKPIs);
      generateInsights(enhancedKPIs);
      calculateTrends(enhancedKPIs);
    };

    calculateEnhancedKPIs();
  }, [role, workItems, user, automations, costs, roleConfig]);

  // KPI calculation functions
  const calculateSystemHealth = () => {
    const criticalIncidents = workItems.filter(item => 
      item.type === "incident" && (item.priority === "P0" || item.priority === "P1")
    ).length;
    
    if (criticalIncidents === 0) return 100;
    if (criticalIncidents <= 2) return 95;
    if (criticalIncidents <= 5) return 80;
    return 65;
  };

  const calculateIncidentRate = () => {
    const last24h = Date.now() - (24 * 60 * 60 * 1000);
    const recentIncidents = workItems.filter(item => 
      item.type === "incident" && item.createdAt > last24h
    ).length;
    return recentIncidents;
  };

  const calculateResolutionEfficiency = () => {
    const resolvedItems = workItems.filter(item => 
      item.status === "resolved" && item.resolvedAt && item.createdAt
    );
    
    if (resolvedItems.length === 0) return 0;
    
    const avgResolutionTime = resolvedItems.reduce((sum, item) => 
      sum + (item.resolvedAt - item.createdAt), 0) / resolvedItems.length;
    
    const hours = avgResolutionTime / (1000 * 60 * 60);
    
    // Convert to efficiency score (lower hours = higher efficiency)
    if (hours <= 2) return 95;
    if (hours <= 6) return 85;
    if (hours <= 24) return 70;
    return 50;
  };

  const calculateCustomerSatisfaction = () => {
    // Simulate based on SLA compliance and response times
    const slaCompliance = calculateSLACompliance();
    const baseScore = 4.2; // out of 5
    
    if (slaCompliance > 95) return 4.8;
    if (slaCompliance > 90) return 4.5;
    if (slaCompliance > 80) return 4.2;
    return 3.8;
  };

  const calculateSLACompliance = () => {
    const totalItems = workItems.length;
    if (totalItems === 0) return 100;
    
    const breachedItems = workItems.filter(item => item.slaBreached).length;
    return Math.round(((totalItems - breachedItems) / totalItems) * 100);
  };

  const calculateRevenueAtRisk = () => {
    return workItems
      .filter(item => item.revenue_impact_per_hour && item.status !== "resolved")
      .reduce((sum, item) => sum + (item.revenue_impact_per_hour || 0), 0);
  };

  const calculateTeamUtilization = () => {
    const teamItems = workItems.filter(item => 
      item.teamId === user?.teamId || item.assigned_to_team_id === user?.teamId
    );
    
    const inProgressItems = teamItems.filter(item => item.status === "in-progress").length;
    const totalCapacity = 20; // Assume team capacity of 20 concurrent items
    
    return Math.round((inProgressItems / totalCapacity) * 100);
  };

  const calculateAutomationCoverage = () => {
    const totalWorkItems = workItems.length;
    if (totalWorkItems === 0) return 0;
    
    const automatedItems = workItems.filter(item => item.automation_available).length;
    return Math.round((automatedItems / totalWorkItems) * 100);
  };

  const calculateKnowledgeEffectiveness = () => {
    // Simulate based on knowledge article usage and success rates
    const baseEffectiveness = 78; // Placeholder
    const knowledgeGaps = workItems.filter(item => item.relatedKnowledge === null).length;
    
    if (knowledgeGaps === 0) return 95;
    if (knowledgeGaps <= 3) return 85;
    if (knowledgeGaps <= 8) return 75;
    return 60;
  };

  const calculateOperationalCosts = () => {
    const monthlyTotal = costs.reduce((sum, cost) => sum + cost.amount, 0);
    return Math.round(monthlyTotal / 1000); // Return in thousands
  };

  const calculateCostPerIncident = () => {
    const totalCosts = costs.reduce((sum, cost) => sum + cost.amount, 0);
    const incidents = workItems.filter(item => item.type === "incident").length;
    
    if (incidents === 0) return 0;
    return Math.round(totalCosts / incidents);
  };

  const calculateAutomationSavings = () => {
    const automatedItems = workItems.filter(item => item.automationTriggered);
    const avgSavingsPerAutomation = 240; // $240 saved per automated resolution
    
    return automatedItems.length * avgSavingsPerAutomation;
  };

  // Generate actionable insights
  const generateInsights = (kpis) => {
    const newInsights = [];

    // System Health Insights
    if (kpis.system_health < 90) {
      newInsights.push({
        type: "alert",
        category: "System Health",
        message: `System health at ${kpis.system_health}% - ${workItems.filter(i => i.priority === "P0" || i.priority === "P1").length} critical issues need attention`,
        action: "View Critical Issues",
        link: "/smartqueue?filter=high_priority",
        impact: "high"
      });
    }

    // SLA Compliance
    if (kpis.sla_compliance < 95) {
      const breachedCount = workItems.filter(item => item.slaBreached).length;
      newInsights.push({
        type: "warning", 
        category: "SLA Compliance",
        message: `SLA compliance at ${kpis.sla_compliance}% - ${breachedCount} items breached`,
        action: "Review SLA Risks",
        link: "/smartqueue?filter=sla_risk",
        impact: "high"
      });
    }

    // Automation Opportunities
    if (kpis.automation_coverage < 60) {
      const candidates = workItems.filter(item => !item.automation_available && item.repeat_count > 3).length;
      newInsights.push({
        type: "opportunity",
        category: "Automation",
        message: `Only ${kpis.automation_coverage}% automation coverage - ${candidates} new candidates identified`,
        action: "View Candidates",
        link: "/smartqueue?filter=automation_candidates",
        impact: "medium"
      });
    }

    // Revenue at Risk
    if (kpis.revenue_at_risk > 50000) {
      newInsights.push({
        type: "alert",
        category: "Revenue Impact", 
        message: `$${(kpis.revenue_at_risk / 1000).toFixed(0)}K revenue at risk from open high-impact incidents`,
        action: "Review Revenue Impact",
        link: "/smartqueue?filter=high_cost",
        impact: "critical"
      });
    }

    // Team Utilization
    if (kpis.team_utilization > 90) {
      newInsights.push({
        type: "warning",
        category: "Team Utilization",
        message: `Team utilization at ${kpis.team_utilization}% - risk of burnout and quality issues`,
        action: "View Team Workload",
        link: "/schedule",
        impact: "medium"
      });
    }

    // Cost Efficiency
    if (kpis.cost_per_incident > 3000) {
      newInsights.push({
        type: "opportunity",
        category: "Cost Efficiency",
        message: `Cost per incident at $${kpis.cost_per_incident} - above industry benchmark of $2,500`,
        action: "Analyze Costs",
        link: "/reports/costs",
        impact: "medium"
      });
    }

    setInsights(newInsights);
  };

  // Calculate trends
  const calculateTrends = (currentKPIs) => {
    // Simulate trend calculations (in production, would compare with historical data)
    const trends = {
      system_health: { value: currentKPIs.system_health, trend: Math.random() > 0.5 ? "up" : "down", change: Math.floor(Math.random() * 10) },
      incident_rate: { value: currentKPIs.incident_rate, trend: Math.random() > 0.3 ? "down" : "up", change: Math.floor(Math.random() * 3) },
      sla_compliance: { value: currentKPIs.sla_compliance, trend: currentKPIs.sla_compliance > 95 ? "up" : "down", change: Math.floor(Math.random() * 5) },
      automation_coverage: { value: currentKPIs.automation_coverage, trend: "up", change: Math.floor(Math.random() * 8) }
    };
    
    setTrends(trends);
  };

  // Manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setLastRefresh(Date.now());
    
    // Simulate refresh delay
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1500);
  };

  // Auto-refresh based on role preferences  
  useEffect(() => {
    if (!roleConfig?.pulse.refreshInterval) return;

    const interval = setInterval(() => {
      setLastRefresh(Date.now());
    }, roleConfig.pulse.refreshInterval);

    return () => clearInterval(interval);
  }, [roleConfig]);

  if (!roleConfig) {
    return (
      <div className="p-4">
        <div className="text-center py-8">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-6">
      {/* Enhanced Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Pulse Dashboard</h2>
          <div className="text-sm text-gray-600 mt-1">
            {role} • {user?.username} • 
            <span className={`ml-1 ${online ? "text-green-600" : "text-red-600"}`}>
              {online ? "Online" : "Offline"}
            </span>
            {totalPendingCount > 0 && (
              <span className="ml-2 text-yellow-600">
                • {totalPendingCount} pending sync
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500">
            Last updated: {new Date(lastRefresh).toLocaleTimeString()}
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm disabled:opacity-50"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* System Status Alert */}
      {(kpis.system_health < 90 || !online || totalPendingCount > 5) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-600" />
            <span className="font-medium text-red-800">System Alert</span>
          </div>
          <div className="mt-2 text-sm text-red-700 space-y-1">
            {kpis.system_health < 90 && (
              <div>• System health degraded ({kpis.system_health}%)</div>
            )}
            {!online && <div>• Offline - operations queued for sync</div>}
            {totalPendingCount > 5 && (
              <div>• {totalPendingCount} operations pending sync</div>
            )}
          </div>
        </div>
      )}

      {/* Role-Based KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {roleConfig.pulse.kpis.map(kpiName => (
          <EnhancedKPICard 
            key={kpiName}
            name={kpiName}
            value={kpis[kpiName]}
            trend={trends[kpiName]}
            role={role}
            onClick={(link) => link && navigate(link)}
          />
        ))}
      </div>

      {/* Insights Section */}
      <div className="bg-white border rounded-lg shadow">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-semibold flex items-center gap-2">
            <Target size={16} />
            AI Insights & Recommendations
          </h3>
        </div>
        
        <div className="p-4">
          {insights.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 size={48} className="mx-auto text-green-500 mb-3" />
              <p className="text-green-700 font-medium">All systems operating optimally</p>
              <p className="text-sm text-gray-600 mt-1">No immediate actions required</p>
            </div>
          ) : (
            <div className="space-y-3">
              {insights.map((insight, idx) => (
                <InsightCard key={idx} insight={insight} role={role} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {roleConfig.pulse.charts.map(chartName => (
          <ChartCard
            key={chartName}
            name={chartName}
            role={role}
            data={getChartData(chartName, workItems, kpis, trends)}
            kpis={kpis}
          />
        ))}
      </div>

      {/* Role-Specific Quick Actions */}
      <QuickActionsPanel role={role} user={user} kpis={kpis} insights={insights} />

      {/* Operational Summary */}
      <div className="bg-white border rounded-lg shadow p-4">
        <h3 className="font-semibold mb-3">Operational Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{workItems.length}</div>
            <div className="text-gray-600">Total Work Items</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{automations.length}</div>
            <div className="text-gray-600">Active Automations</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{activeFeed.length}</div>
            <div className="text-gray-600">Active Alerts</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{insights.length}</div>
            <div className="text-gray-600">AI Recommendations</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Enhanced KPI Card with trends and navigation
function EnhancedKPICard({ name, value, trend, role, onClick }) {
  const getKPIConfig = (kpiName) => {
    const configs = {
      // Operational Health
      system_health: { 
        icon: Activity, 
        color: value > 95 ? "text-green-600" : value > 80 ? "text-yellow-600" : "text-red-600", 
        label: "System Health",
        suffix: "%",
        link: "/smartqueue?filter=high_priority"
      },
      incident_rate: {
        icon: AlertTriangle,
        color: value <= 2 ? "text-green-600" : value <= 5 ? "text-yellow-600" : "text-red-600",
        label: "Daily Incidents", 
        link: "/smartqueue?filter=incidents"
      },
      sla_compliance: {
        icon: Clock,
        color: value > 95 ? "text-green-600" : value > 85 ? "text-yellow-600" : "text-red-600",
        label: "SLA Compliance",
        suffix: "%",
        link: "/smartqueue?filter=sla_risk"
      },
      
      // Team & User Metrics
      my_active_items: { 
        icon: Activity, 
        color: "text-blue-600", 
        label: "My Active Items",
        link: "/smartqueue?filter=assigned_to_me"
      },
      team_utilization: { 
        icon: Users, 
        color: value > 90 ? "text-red-600" : value > 70 ? "text-yellow-600" : "text-green-600", 
        label: "Team Utilization",
        suffix: "%",
        link: "/schedule"
      },
      
      // Financial Metrics
      operational_costs: { 
        icon: DollarSign, 
        color: "text-purple-600", 
        label: "Monthly Costs",
        prefix: "$",
        suffix: "K"
      },
      revenue_at_risk: {
        icon: TrendingDown,
        color: value > 100000 ? "text-red-600" : value > 50000 ? "text-yellow-600" : "text-green-600",
        label: "Revenue at Risk",
        prefix: "$",
        suffix: "K",
        format: (v) => Math.round(v / 1000)
      },
      
      // Automation Metrics
      automation_coverage: { 
        icon: Zap, 
        color: value > 80 ? "text-green-600" : value > 60 ? "text-yellow-600" : "text-red-600", 
        label: "Automation Coverage",
        suffix: "%",
        link: "/intelligence?tab=automations"
      }
    };

    return configs[name] || {
      icon: Activity,
      color: "text-gray-600",
      label: name.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
    };
  };

  const config = getKPIConfig(name);
  const IconComponent = config.icon;
  
  const formatValue = (val) => {
    if (config.format) return config.format(val);
    if (typeof val === "number" && config.suffix) return `${Math.round(val)}${config.suffix}`;
    if (typeof val === "number" && config.prefix) return `${config.prefix}${Math.round(val)}${config.suffix || ""}`;
    return val || "—";
  };

  const displayValue = formatValue(value);

  const content = (
    <div className="p-4 border rounded-lg bg-white shadow hover:shadow-md transition-all cursor-pointer">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <IconComponent size={18} className={config.color} />
          <span className="text-sm text-gray-600 font-medium">{config.label}</span>
        </div>
        {trend && (
          <TrendIndicator trend={trend} />
        )}
      </div>
      
      <div className={`text-2xl font-bold ${config.color}`}>
        {displayValue}
      </div>
      
      {trend && (
        <div className="text-xs text-gray-500 mt-1">
          {trend.change > 0 && (trend.trend === "up" ? "+" : "-")}{trend.change} vs last period
        </div>
      )}
      
      {config.link && (
        <div className="flex items-center gap-1 text-xs text-blue-600 mt-2">
          <span>View details</span>
          <ExternalLink size={10} />
        </div>
      )}
    </div>
  );

  return config.link ? (
    <div onClick={() => onClick(config.link)}>
      {content}
    </div>
  ) : content;
}

// Trend indicator component
function TrendIndicator({ trend }) {
  if (!trend) return null;
  
  const isPositive = (trend.trend === "up" && trend.change > 0) || (trend.trend === "down" && trend.change > 0);
  
  return (
    <div className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
      isPositive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
    }`}>
      {trend.trend === "up" ? (
        <TrendingUp size={10} />
      ) : (
        <TrendingDown size={10} />
      )}
      {trend.change}%
    </div>
  );
}

// Enhanced insight card
function InsightCard({ insight, role }) {
  const getInsightIcon = (type) => {
    switch (type) {
      case "alert": return <AlertTriangle className="text-red-600" />;
      case "warning": return <AlertTriangle className="text-yellow-600" />;
      case "opportunity": return <Target className="text-green-600" />;
      default: return <Activity className="text-blue-600" />;
    }
  };

  const getInsightBg = (impact) => {
    switch (impact) {
      case "critical": return "bg-red-50 border-red-200";
      case "high": return "bg-orange-50 border-orange-200"; 
      case "medium": return "bg-yellow-50 border-yellow-200";
      default: return "bg-blue-50 border-blue-200";
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${getInsightBg(insight.impact)}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          {getInsightIcon(insight.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-700">{insight.category}</span>
            {insight.impact && (
              <span className={`text-xs px-2 py-1 rounded font-medium ${
                insight.impact === "critical" ? "bg-red-100 text-red-700" :
                insight.impact === "high" ? "bg-orange-100 text-orange-700" :
                insight.impact === "medium" ? "bg-yellow-100 text-yellow-700" :
                "bg-blue-100 text-blue-700"
              }`}>
                {insight.impact.toUpperCase()}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-900 mb-2">{insight.message}</p>
          {insight.action && insight.link && (
            <Link
              to={insight.link}
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
            >
              {insight.action}
              <ExternalLink size={12} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// Enhanced chart card 
function ChartCard({ name, role, data, kpis }) {
  const getChartTitle = (chartName) => {
    const titles = {
      my_workload_trend: "My Workload Trend",
      team_workload: "Team Distribution", 
      cost_analysis: "Cost Breakdown",
      automation_performance: "Automation Success Rate",
      resolution_times: "Resolution Time Trends",
      service_health: "Service Health Overview",
      sla_performance: "SLA Performance"
    };
    return titles[chartName] || chartName.replace(/_/g, " ");
  };

  const getChartVisualization = (chartName, data) => {
    // Simple bar chart visualization for demonstration
    switch (chartName) {
      case "cost_analysis":
        return (
          <div className="space-y-2">
            {data.categories?.map((category, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-20 text-xs text-gray-600">{category.name}</div>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${(category.value / data.max) * 100}%` }}
                  />
                </div>
                <div className="w-16 text-xs font-medium">${category.value.toLocaleString()}</div>
              </div>
            )) || <div>No cost data available</div>}
          </div>
        );
        
      default:
        return (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              {data.labels?.slice(0, 5).map((label, idx) => (
                <div key={idx} className="text-center">
                  <div className="text-gray-600">{label}</div>
                  <div className="font-medium">{data.values?.[idx] || 0}</div>
                </div>
              )) || <div>No data available</div>}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="bg-white border rounded-lg shadow">
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <h4 className="font-medium flex items-center gap-2">
            <BarChart3 size={16} />
            {getChartTitle(name)}
          </h4>
          <Link to="/reports" className="text-xs text-blue-600 hover:text-blue-800">
            View Report
          </Link>
        </div>
      </div>
      <div className="p-4">
        {getChartVisualization(name, data)}
      </div>
    </div>
  );
}

// Quick actions panel
function QuickActionsPanel({ role, user, kpis, insights }) {
  const getQuickActions = () => {
    const actions = [];
    
    // Role-based actions
    switch (role) {
      case "Support Engineer":
        actions.push(
          { label: "My Queue", link: "/smartqueue?filter=assigned_to_me", icon: Activity },
          { label: "Create Incident", link: "/workitem/new?type=incident", icon: AlertTriangle }
        );
        break;
      case "Manager":
        actions.push(
          { label: "Team Performance", link: "/reports/team", icon: Users },
          { label: "Budget Review", link: "/reports/budget", icon: DollarSign }
        );
        break;
      case "Senior Site Reliability Engineer":
        actions.push(
          { label: "System Health", link: "/smartqueue?filter=high_priority", icon: Activity },
          { label: "Create Automation", link: "/intelligence?tab=automations&action=create", icon: Zap }
        );
        break;
    }
    
    // Dynamic actions based on insights
    if (insights.some(i => i.type === "alert")) {
      actions.push({
        label: "Review Critical Issues",
        link: "/smartqueue?filter=critical",
        icon: AlertTriangle,
        variant: "critical"
      });
    }
    
    if (kpis.automation_coverage < 60) {
      actions.push({
        label: "Automation Opportunities",
        link: "/smartqueue?filter=automation_candidates", 
        icon: Zap,
        variant: "opportunity"
      });
    }

    return actions;
  };

  const actions = getQuickActions();
  
  if (actions.length === 0) return null;

  return (
    <div className="bg-white border rounded-lg shadow">
      <div className="p-4 border-b bg-gray-50">
        <h3 className="font-semibold">Quick Actions</h3>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {actions.map((action, idx) => {
            const IconComponent = action.icon;
            return (
              <Link
                key={idx}
                to={action.link}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  action.variant === "critical" ? "border-red-200 bg-red-50 hover:bg-red-100" :
                  action.variant === "opportunity" ? "border-green-200 bg-green-50 hover:bg-green-100" :
                  "border-gray-200 bg-gray-50 hover:bg-gray-100"
                }`}
              >
                <IconComponent size={16} className={
                  action.variant === "critical" ? "text-red-600" :
                  action.variant === "opportunity" ? "text-green-600" :
                  "text-blue-600"
                } />
                <span className="text-sm font-medium">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Get chart data helper
function getChartData(chartName, workItems, kpis, trends) {
  switch (chartName) {
    case "cost_analysis":
      return {
        categories: [
          { name: "Labor", value: 45000 },
          { name: "Parts", value: 23000 },
          { name: "Vendor", value: 15000 },
          { name: "Other", value: 8000 }
        ],
        max: 45000
      };
      
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
      
    default:
      return { labels: [], values: [] };
  }
}