import React, { useEffect, useState } from "react";
import { useWorkItems } from "../contexts/WorkItemsContext.jsx";
import { useCosts } from "../contexts/CostsContext.jsx";
import { useAutomations } from "../contexts/AutomationsContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { Activity, AlertTriangle, TrendingDown, Clock } from "lucide-react"; 
import { Link } from "react-router-dom";
import { useInsightsConfig, calculateKPIs } from "../utils/configLoader.js";

export default function Pulse({ role }) {
  const { workItems = [] } = useWorkItems();
  const { costs = [] } = useCosts();
  const { automations = [] } = useAutomations();
  const { user } = useAuth();
  const { config: insightsConfig, loading: configLoading } = useInsightsConfig();

  const [kpis, setKpis] = useState({
    p0p1: 0,
    slaBreaches: 0,
    mttr: 0,
    openRequests: 0,
  });
  const [streamed, setStreamed] = useState([]);

  // Calculate KPIs using config-driven logic
  useEffect(() => {
    if (!insightsConfig || configLoading) return;
    
    console.log("Calculating KPIs with config:", insightsConfig);
    const calculatedKPIs = calculateKPIs(workItems, user, role, insightsConfig);
    setKpis(calculatedKPIs);
  }, [role, workItems, user, insightsConfig, configLoading]);

  // Generate insights based on config rules
  useEffect(() => {
    if (!insightsConfig?.rules) return;

    const insights = [];
    
    // Evaluate each rule from config
    insightsConfig.rules.forEach(rule => {
      let triggered = false;
      
      switch (rule.id) {
        case "high_incident_volume":
          if (kpis.p0p1 > rule.condition.value) {
            triggered = true;
          }
          break;
        case "low_automation":
          if (automations.length < rule.condition.value) {
            triggered = true;
          }
          break;
        case "limited_kb":
          // Would need knowledge context here
          break;
      }
      
      if (triggered) {
        insights.push({
          id: rule.id,
          text: rule.message,
          type: "alert"
        });
      }
    });

    // Add some dynamic insights
    if (kpis.slaBreaches > 0) {
      insights.push({
        id: "sla_breach",
        text: `${kpis.slaBreaches} SLA breaches need immediate attention`,
        type: "health"
      });
    }

    if (automations.length > 0) {
      insights.push({
        id: "auto_opportunity", 
        text: `${automations.length} automations could save ~200 hrs/week`,
        type: "automation"
      });
    }

    setStreamed(insights);
  }, [kpis, automations, insightsConfig]);

  if (configLoading) {
    return (
      <div className="p-4">
        <div className="text-center py-8">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-6">
      <h2 className="text-xl font-semibold">Pulse Dashboard</h2>

      {/* Debug info */}
      <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
        WorkItems: {workItems.length} | User: {user?.username} | Role: {role} | Config Rules: {insightsConfig?.rules?.length || 0}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link to="/queue" className="p-4 border rounded-lg bg-white shadow hover:shadow-md flex flex-col gap-1">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle size={18} /> P0/P1 Active
          </div>
          <span className="text-2xl font-bold">{kpis.p0p1}</span>
        </Link>

        <Link to="/queue" className="p-4 border rounded-lg bg-white shadow hover:shadow-md flex flex-col gap-1">
          <div className="flex items-center gap-2 text-yellow-600">
            <Clock size={18} /> SLA Breaches
          </div>
          <span className="text-2xl font-bold">{kpis.slaBreaches}</span>
        </Link>

        <div className="p-4 border rounded-lg bg-white shadow flex flex-col gap-1">
          <div className="flex items-center gap-2 text-blue-600">
            <TrendingDown size={18} /> MTTR (hrs)
          </div>
          <span className="text-2xl font-bold">
            {kpis.mttr ? kpis.mttr.toFixed(1) : "—"}
          </span>
        </div>

        <Link to="/queue" className="p-4 border rounded-lg bg-white shadow hover:shadow-md flex flex-col gap-1">
          <div className="flex items-center gap-2 text-green-600">
            <Activity size={18} /> Open Requests
          </div>
          <span className="text-2xl font-bold">{kpis.openRequests}</span>
        </Link>
      </div>

      {/* Config-Driven Insights */}
      <div className="p-3 border rounded-lg bg-white shadow flex flex-col gap-2">
        <h3 className="font-semibold mb-1">AI Insights</h3>
        {streamed.length === 0 && (
          <p className="text-sm text-gray-500">No insights triggered...</p>
        )}
        {streamed.map((insight) => (
          <div key={insight.id} className="text-sm border-b last:border-none pb-1 text-gray-700">
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
              insight.type === "alert" ? "bg-red-500" :
              insight.type === "health" ? "bg-yellow-500" :
              insight.type === "automation" ? "bg-green-500" : "bg-gray-500"
            }`}></span>
            {insight.type === "health" && (
              <Link to="/queue" className="text-blue-600 hover:underline">
                {insight.text}
              </Link>
            )}
            {insight.type === "automation" && (
              <Link to="/intelligence" className="text-purple-600 hover:underline">
                {insight.text}
              </Link>
            )}
            {insight.type === "alert" && (
              <span className="text-red-600">{insight.text}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}