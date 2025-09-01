// utils/configLoader.js
import { useState, useEffect } from 'react';

// Central config loader hook using fetch
export function useConfig(configFile) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadConfig() {
      try {
        setLoading(true);
        // Fetch from public folder instead of dynamic import
        const response = await fetch(`/config/${configFile}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setConfig(data);
        setError(null);
      } catch (err) {
        console.error(`Failed to load config: ${configFile}`, err);
        setError(err);
        // Provide fallback config
        setConfig(getFallbackConfig(configFile));
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, [configFile]);

  return { config, loading, error };
}

// Fallback configs in case files can't be loaded
function getFallbackConfig(configFile) {
  switch (configFile) {
    case 'insights.json':
      return {
        rules: [
          {
            id: "high_incident_volume",
            condition: { metric: "openIncidents", operator: ">", value: 2 },
            message: "High incident volume detected today."
          },
          {
            id: "low_automation", 
            condition: { metric: "automationCount", operator: "<", value: 3 },
            message: "Automation coverage is low — consider building more."
          }
        ]
      };
    case 'smartqueue_config.json':
      return {
        filters: ["all", "me", "team", "group"],
        sorting: [
          { field: "priority", direction: "desc" },
          { field: "slaMinutes", direction: "asc" }
        ],
        whyRules: [
          { condition: "priority === 'P1'", message: "Critical business impact" },
          { condition: "slaMinutes < 30", message: "SLA breach imminent" },
          { condition: "assignedTo === 'me'", message: "Assigned directly to you" }
        ]
      };
    default:
      return {};
  }
}

// Specific config hooks for different areas
export function useInsightsConfig() {
  return useConfig('insights.json');
}

export function useSmartQueueConfig() {
  return useConfig('smartqueue_config.json');
}

export function useIntelligenceMetrics() {
  return useConfig('intelligence_metrics.json');
}

export function useTrendsConfig() {
  return useConfig('trends.json');
}

// KPI Calculator using config rules
export function calculateKPIs(workItems, user, role, insightsConfig) {
  if (!insightsConfig?.rules || !Array.isArray(workItems)) {
    return { p0p1: 0, slaBreaches: 0, mttr: 0, openRequests: 0 };
  }

  const myItems = workItems.filter((w) => w && w.assignedTo === user?.id);
  const teamItems = workItems.filter((w) => w && w.teamId === user?.teamId);
  
  const relevant = 
    role === "Manager" ? teamItems : 
    role === "Support Engineer" ? myItems : 
    workItems;

  let calc = { p0p1: 0, slaBreaches: 0, mttr: 0, openRequests: 0 };

  // Use config rules instead of hardcoded logic
  const highIncidentRule = insightsConfig.rules.find(r => r.id === "high_incident_volume");
  if (highIncidentRule) {
    calc.p0p1 = relevant.filter((w) => w && (w.priority === "P0" || w.priority === "P1")).length;
  }

  calc.slaBreaches = relevant.filter((w) => w && w.slaBreached).length;
  calc.openRequests = relevant.filter((w) => w && w.type === "request" && w.status !== "closed").length;

  const resolved = relevant.filter((w) => w && w.status === "resolved" && w.closedAt && w.createdAt);
  if (resolved.length) {
    calc.mttr = resolved.reduce((sum, w) => sum + (w.closedAt - w.createdAt), 0) / resolved.length / 3600000;
  }

  return calc;
}

// Smart Score calculator using config
export function calculateSmartScore(workItem, config) {
  if (!config?.whyRules || !workItem) return 50;

  let score = 0;
  
  config.whyRules.forEach(rule => {
    if (rule.condition.includes("priority === 'P1'") && workItem.priority === "P1") {
      score += 40;
    }
    if (rule.condition.includes("priority === 'P0'") && workItem.priority === "P0") {
      score += 50;
    }
    if (rule.condition.includes("slaMinutes < 30") && workItem.slaBreached) {
      score += 30;
    }
  });

  return Math.min(score, 100);
}