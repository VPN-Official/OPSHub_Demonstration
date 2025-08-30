import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

// Tab components
import InfoTab from "../components/workitem/InfoTab";
import LogsTab from "../components/workitem/LogsTab";
import TimelineTab from "../components/workitem/TimelineTab";
import AutomationsTab from "../components/workitem/AutomationsTab";
import KnowledgeTab from "../components/workitem/KnowledgeTab";
import CommsTab from "../components/workitem/CommsTab";

// New components
import RelatedWorkItems from "../components/workitem/RelatedWorkItems";
import EscalationPath from "../components/workitem/EscalationPath";
import BusinessServiceHealth from "../components/workitem/BusinessServiceHealth";
import CollaborationPane from "../components/workitem/CollaborationPane";

export default function WorkItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("info");

  // Dummy data (replace with API later)
  const workitem = {
    id,
    title: "Cooling failure in DCN1",
    priority: "priority_1",
    sla_remaining: 12,
    impact: 500000,
    owner: "Alice",
    status: "open",
    service: "Auth Service",
    businessService: "User Identity & Access",
    team: "L2 DCN Ops",
    escalatedTo: "SME - Charlie",
  };

  const tabs = [
    { id: "info", label: "Info" },
    { id: "logs", label: "Logs" },
    { id: "timeline", label: "Timeline" },
    { id: "automations", label: "Automations" },
    { id: "knowledge", label: "Knowledge" },
    { id: "comms", label: "Comms" },
  ];

  return (
    <div className="pb-28">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="text-blue-600 underline text-sm mb-2"
      >
        ← Back to Smart Queue
      </button>

      {/* Summary Card */}
      <div className="p-4 bg-white dark:bg-gray-900 rounded shadow mb-4">
        <h1 className="text-lg font-bold mb-2">
          #{workitem.id} — {workitem.title}
        </h1>
        <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
          <p>Priority: {workitem.priority}</p>
          <p>
            SLA:{" "}
            {workitem.sla_remaining < 0 ? (
              <span className="text-red-600">Breached</span>
            ) : (
              `${workitem.sla_remaining} min`
            )}
          </p>
          <p>Impact: ${workitem.impact.toLocaleString()}</p>
          <p>Owner: {workitem.owner || "Unassigned"}</p>
          <p>Status: {workitem.status}</p>
          <p>Service: {workitem.service}</p>
          <p>Business Service: {workitem.businessService}</p>
        </div>
      </div>

      {/* Extra context cards */}
      <div className="grid gap-4 mb-4 md:grid-cols-2">
        <EscalationPath workitem={workitem} />
        <BusinessServiceHealth businessService={workitem.businessService} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1 rounded ${
              activeTab === t.id
                ? "bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "info" && <InfoTab workitem={workitem} />}
      {activeTab === "logs" && <LogsTab workitemId={workitem.id} />}
      {activeTab === "timeline" && <TimelineTab workitemId={workitem.id} />}
      {activeTab === "automations" && <AutomationsTab workitemId={workitem.id} />}
      {activeTab === "knowledge" && <KnowledgeTab workitemId={workitem.id} />}
      {activeTab === "comms" && <CommsTab workitemId={workitem.id} />}

      {/* Related WorkItems */}
      <RelatedWorkItems service={workitem.service} />

      {/* Collaboration Pane */}
      <CollaborationPane workitemId={workitem.id} />

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t p-3 flex justify-around">
        <button className="px-3 py-2 bg-blue-600 text-white rounded">
          {workitem.owner ? "Unassign" : "Assign to Me"}
        </button>
        <button className="px-3 py-2 bg-green-600 text-white rounded">
          Run Automation
        </button>
        <button className="px-3 py-2 bg-purple-600 text-white rounded">
          Chat
        </button>
      </div>
    </div>
  );
}
