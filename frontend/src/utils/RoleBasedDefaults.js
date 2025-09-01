/**
 * RoleBasedDefaults Service
 * - Centralized role configuration for consistent defaults
 * - Supports all AiOps platform personas
 * - Configurable filters, views, and navigation patterns
 * - Extensible for new roles and preferences
 */

// Role definitions matching your AiOps platform personas
export const ROLES = {
  SUPPORT_ENGINEER: "Support Engineer",
  SENIOR_SRE: "Senior Site Reliability Engineer", 
  DISPATCHER: "Dispatcher",
  MANAGER: "Manager",
  AUTOMATION_ENGINEER: "Automation Engineer",
  AGENT_DESIGNER: "Agent Designer",
  SME: "SME",
  NOC_ENGINEER: "NOC Engineer"
};

// Default landing pages for each role
export const ROLE_LANDING_PAGES = {
  [ROLES.SUPPORT_ENGINEER]: "/smartqueue",
  [ROLES.SENIOR_SRE]: "/pulse", 
  [ROLES.DISPATCHER]: "/smartqueue",
  [ROLES.MANAGER]: "/pulse",
  [ROLES.AUTOMATION_ENGINEER]: "/intelligence",
  [ROLES.AGENT_DESIGNER]: "/intelligence",
  [ROLES.SME]: "/intelligence",
  [ROLES.NOC_ENGINEER]: "/smartqueue"
};

// SmartQueue filters for each role
export const ROLE_SMARTQUEUE_FILTERS = {
  [ROLES.SUPPORT_ENGINEER]: {
    defaultFilter: "assigned_to_me",
    showFilters: ["assigned_to_me", "my_team", "unassigned"],
    defaultSort: { field: "smartScore", direction: "desc" },
    showColumns: ["id", "title", "priority", "smartScore", "slaBreached", "customer_tier"],
    maxItems: 50,
    autoRefresh: true
  },
  [ROLES.SENIOR_SRE]: {
    defaultFilter: "high_priority",
    showFilters: ["high_priority", "my_expertise", "automation_candidates", "all"],
    defaultSort: { field: "smartScore", direction: "desc" },
    showColumns: ["id", "title", "priority", "smartScore", "asset_criticality", "automation_available"],
    maxItems: 100,
    autoRefresh: true
  },
  [ROLES.DISPATCHER]: {
    defaultFilter: "my_team",
    showFilters: ["my_team", "unassigned", "sla_risk", "all"],
    defaultSort: { field: "priority", direction: "desc" },
    showColumns: ["id", "title", "priority", "assignedTo", "slaBreached", "customer_tier"],
    maxItems: 100,
    autoRefresh: true
  },
  [ROLES.MANAGER]: {
    defaultFilter: "all",
    showFilters: ["all", "sla_risk", "high_cost", "my_teams"],
    defaultSort: { field: "business_impact", direction: "desc" },
    showColumns: ["id", "title", "priority", "assignedTo", "estimated_cost", "customer_tier"],
    maxItems: 200,
    autoRefresh: false
  },
  [ROLES.AUTOMATION_ENGINEER]: {
    defaultFilter: "automation_candidates",
    showFilters: ["automation_candidates", "failed_automations", "manual_repeats", "all"],
    defaultSort: { field: "automation_opportunity", direction: "desc" },
    showColumns: ["id", "title", "type", "repeat_count", "automation_available", "estimated_savings"],
    maxItems: 100,
    autoRefresh: true
  },
  [ROLES.NOC_ENGINEER]: {
    defaultFilter: "critical_incidents",
    showFilters: ["critical_incidents", "my_shift", "escalations", "all"],
    defaultSort: { field: "priority", direction: "desc" },
    showColumns: ["id", "title", "priority", "status", "duration", "affected_services"],
    maxItems: 75,
    autoRefresh: true
  }
};

// Pulse dashboard configuration for each role
export const ROLE_PULSE_CONFIG = {
  [ROLES.SUPPORT_ENGINEER]: {
    kpis: ["my_active_items", "my_sla_performance", "avg_resolution_time", "customer_satisfaction"],
    charts: ["my_workload_trend", "resolution_times"],
    insights: ["skills_utilization", "automation_opportunities"],
    refreshInterval: 30000 // 30 seconds
  },
  [ROLES.SENIOR_SRE]: {
    kpis: ["system_health", "automation_success", "incident_mttr", "cost_efficiency"],
    charts: ["service_reliability", "automation_performance", "cost_trends"],
    insights: ["reliability_risks", "optimization_opportunities", "capacity_planning"],
    refreshInterval: 60000 // 1 minute
  },
  [ROLES.DISPATCHER]: {
    kpis: ["team_utilization", "queue_depth", "sla_compliance", "escalation_rate"],
    charts: ["team_workload", "queue_trends", "sla_performance"],
    insights: ["staffing_gaps", "workload_balance", "priority_distribution"],
    refreshInterval: 15000 // 15 seconds
  },
  [ROLES.MANAGER]: {
    kpis: ["budget_utilization", "team_performance", "customer_satisfaction", "operational_costs"],
    charts: ["cost_analysis", "team_metrics", "customer_health", "trend_analysis"],
    insights: ["budget_optimization", "resource_planning", "customer_risks", "performance_trends"],
    refreshInterval: 120000 // 2 minutes
  },
  [ROLES.AUTOMATION_ENGINEER]: {
    kpis: ["automation_coverage", "success_rate", "time_saved", "cost_reduction"],
    charts: ["automation_performance", "savings_trends", "failure_analysis"],
    insights: ["automation_opportunities", "optimization_recommendations", "roi_analysis"],
    refreshInterval: 60000 // 1 minute
  }
};

// Intelligence Center tabs and focus for each role
export const ROLE_INTELLIGENCE_CONFIG = {
  [ROLES.AUTOMATION_ENGINEER]: {
    defaultTab: "automations",
    visibleTabs: ["automations", "agents", "nudges", "knowledge"],
    automationView: "performance_focused",
    showMetrics: ["success_rate", "execution_time", "cost_savings", "failure_patterns"],
    actions: ["create_automation", "optimize_existing", "schedule_maintenance"]
  },
  [ROLES.AGENT_DESIGNER]: {
    defaultTab: "agents", 
    visibleTabs: ["agents", "automations", "knowledge", "nudges"],
    agentView: "training_focused",
    showMetrics: ["accuracy", "confidence", "training_status", "performance_trends"],
    actions: ["train_agent", "test_agent", "deploy_agent", "analyze_performance"]
  },
  [ROLES.SME]: {
    defaultTab: "knowledge",
    visibleTabs: ["knowledge", "nudges", "agents"],
    knowledgeView: "authoring_focused", 
    showMetrics: ["usage_stats", "effectiveness", "gaps_identified", "update_frequency"],
    actions: ["create_article", "update_content", "review_gaps", "validate_accuracy"]
  },
  [ROLES.SENIOR_SRE]: {
    defaultTab: "automations",
    visibleTabs: ["automations", "nudges", "knowledge", "agents"],
    automationView: "reliability_focused",
    showMetrics: ["reliability_impact", "incident_reduction", "mttr_improvement"],
    actions: ["review_automations", "create_runbooks", "optimize_workflows"]
  }
};

// Notification preferences for each role
export const ROLE_NOTIFICATION_PREFERENCES = {
  [ROLES.SUPPORT_ENGINEER]: {
    priorities: ["assigned_items", "sla_warnings", "customer_escalations"],
    channels: ["in_app", "email"],
    urgencyThreshold: "medium",
    batchNotifications: false
  },
  [ROLES.SENIOR_SRE]: {
    priorities: ["system_alerts", "automation_failures", "reliability_risks"],
    channels: ["in_app", "email", "sms"],
    urgencyThreshold: "high", 
    batchNotifications: true
  },
  [ROLES.DISPATCHER]: {
    priorities: ["queue_overload", "sla_breaches", "team_alerts"],
    channels: ["in_app", "email"],
    urgencyThreshold: "medium",
    batchNotifications: false
  },
  [ROLES.MANAGER]: {
    priorities: ["budget_alerts", "performance_issues", "customer_risks"],
    channels: ["in_app", "email"],
    urgencyThreshold: "high",
    batchNotifications: true
  },
  [ROLES.AUTOMATION_ENGINEER]: {
    priorities: ["automation_failures", "optimization_opportunities", "deployment_status"],
    channels: ["in_app", "email"],
    urgencyThreshold: "medium",
    batchNotifications: true
  }
};

// Navigation preferences and shortcuts for each role
export const ROLE_NAVIGATION_PREFERENCES = {
  [ROLES.SUPPORT_ENGINEER]: {
    quickActions: ["create_workitem", "search_knowledge", "contact_customer"],
    frequentPages: ["/smartqueue", "/workitem", "/knowledge"],
    shortcuts: [
      { key: "q", action: "goto_queue", label: "Go to Queue" },
      { key: "k", action: "search_knowledge", label: "Search Knowledge" }
    ]
  },
  [ROLES.SENIOR_SRE]: {
    quickActions: ["run_automation", "create_incident", "check_system_health"],
    frequentPages: ["/pulse", "/intelligence", "/automation"],
    shortcuts: [
      { key: "p", action: "goto_pulse", label: "Go to Pulse" },
      { key: "a", action: "run_automation", label: "Run Automation" }
    ]
  },
  [ROLES.DISPATCHER]: {
    quickActions: ["assign_workitem", "escalate_issue", "check_team_status"],
    frequentPages: ["/smartqueue", "/schedule", "/team"],
    shortcuts: [
      { key: "q", action: "goto_queue", label: "Go to Queue" }, 
      { key: "s", action: "goto_schedule", label: "Go to Schedule" }
    ]
  },
  [ROLES.MANAGER]: {
    quickActions: ["view_reports", "check_budgets", "review_performance"],
    frequentPages: ["/pulse", "/reports", "/budget"],
    shortcuts: [
      { key: "r", action: "goto_reports", label: "Go to Reports" },
      { key: "b", action: "goto_budget", label: "Go to Budget" }
    ]
  }
};

/**
 * Get comprehensive role configuration
 */
export function getRoleConfig(role) {
  const normalizedRole = role || ROLES.SUPPORT_ENGINEER;
  
  return {
    role: normalizedRole,
    landingPage: ROLE_LANDING_PAGES[normalizedRole] || "/pulse",
    smartQueue: ROLE_SMARTQUEUE_FILTERS[normalizedRole] || ROLE_SMARTQUEUE_FILTERS[ROLES.SUPPORT_ENGINEER],
    pulse: ROLE_PULSE_CONFIG[normalizedRole] || ROLE_PULSE_CONFIG[ROLES.SUPPORT_ENGINEER], 
    intelligence: ROLE_INTELLIGENCE_CONFIG[normalizedRole] || ROLE_INTELLIGENCE_CONFIG[ROLES.AUTOMATION_ENGINEER],
    notifications: ROLE_NOTIFICATION_PREFERENCES[normalizedRole] || ROLE_NOTIFICATION_PREFERENCES[ROLES.SUPPORT_ENGINEER],
    navigation: ROLE_NAVIGATION_PREFERENCES[normalizedRole] || ROLE_NAVIGATION_PREFERENCES[ROLES.SUPPORT_ENGINEER]
  };
}

/**
 * Get role-based work item filters
 */
export function getRoleBasedWorkItemFilter(role, user, workItems) {
  const config = getRoleConfig(role);
  const defaultFilter = config.smartQueue.defaultFilter;
  
  switch (defaultFilter) {
    case "assigned_to_me":
      return workItems.filter(item => 
        item.assignedTo === user?.id || 
        item.assigned_to_user_id === user?.id
      );
      
    case "my_team": 
      return workItems.filter(item => 
        item.teamId === user?.teamId ||
        item.assigned_to_team_id === user?.teamId
      );
      
    case "high_priority":
      return workItems.filter(item => 
        item.priority === "P0" || item.priority === "P1"
      );
      
    case "critical_incidents":
      return workItems.filter(item => 
        item.type === "incident" && 
        (item.priority === "P0" || item.priority === "P1")
      );
      
    case "automation_candidates":
      return workItems.filter(item => 
        item.automation_available || 
        item.repeat_count > 3
      );
      
    case "sla_risk":
      return workItems.filter(item => 
        item.slaBreached || 
        item.sla_risk === "high"
      );
      
    case "unassigned":
      return workItems.filter(item => 
        !item.assignedTo && !item.assigned_to_user_id
      );
      
    default:
      return workItems;
  }
}

/**
 * Get role-based KPI calculations
 */
export function calculateRoleBasedKPIs(role, user, workItems, assets, costs) {
  const config = getRoleConfig(role);
  const kpis = {};
  
  config.pulse.kpis.forEach(kpiName => {
    switch (kpiName) {
      case "my_active_items":
        kpis[kpiName] = workItems.filter(item => 
          (item.assignedTo === user?.id || item.assigned_to_user_id === user?.id) &&
          item.status !== "closed" && item.status !== "resolved"
        ).length;
        break;
        
      case "system_health":
        kpis[kpiName] = Math.round(
          assets?.filter(asset => asset.status === "operational").length / 
          (assets?.length || 1) * 100
        );
        break;
        
      case "team_utilization":
        const teamItems = workItems.filter(item => 
          item.teamId === user?.teamId || item.assigned_to_team_id === user?.teamId
        );
        kpis[kpiName] = Math.min(teamItems.length * 10, 100); // Simple calculation
        break;
        
      case "budget_utilization":
        const totalCosts = costs?.reduce((sum, cost) => sum + cost.amount, 0) || 0;
        kpis[kpiName] = Math.round((totalCosts / 500000) * 100); // Assuming 500k budget
        break;
        
      case "automation_coverage":
        const automatedItems = workItems.filter(item => item.automation_available);
        kpis[kpiName] = Math.round((automatedItems.length / workItems.length) * 100);
        break;
        
      default:
        kpis[kpiName] = Math.floor(Math.random() * 100); // Placeholder
    }
  });
  
  return kpis;
}

/**
 * Check if user has permission for specific action
 */
export function hasRolePermission(role, action) {
  const permissions = {
    [ROLES.SUPPORT_ENGINEER]: ["view_workitems", "update_workitems", "run_automations"],
    [ROLES.SENIOR_SRE]: ["view_all", "create_automations", "manage_incidents", "system_admin"],
    [ROLES.DISPATCHER]: ["view_team", "assign_workitems", "escalate_issues"],
    [ROLES.MANAGER]: ["view_all", "view_reports", "budget_access", "team_management"],
    [ROLES.AUTOMATION_ENGINEER]: ["create_automations", "manage_automations", "view_metrics"],
    [ROLES.AGENT_DESIGNER]: ["manage_agents", "train_agents", "view_performance"],
    [ROLES.SME]: ["manage_knowledge", "create_content", "review_accuracy"]
  };
  
  return permissions[role]?.includes(action) || false;
}

export default {
  ROLES,
  getRoleConfig,
  getRoleBasedWorkItemFilter,
  calculateRoleBasedKPIs,
  hasRolePermission
};