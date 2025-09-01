import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useWorkItems } from "../contexts/WorkItemsContext.jsx";
import { useSync } from "../contexts/SyncContext.jsx";
import { useToast, TOAST_TYPES } from "../contexts/ToastContext.jsx";
import {
  User,
  Zap,
  MessageSquare,
  ArrowLeft,
  FileText,
  Activity,
} from "lucide-react";

// Config-driven tab definitions
const TABS = [
  { key: "actions", label: "Actions", icon: User },
  { key: "ai", label: "AI Insights", icon: Activity },
  { key: "log", label: "Activity Log", icon: FileText },
];

// Config-driven metadata fields
const META_FIELDS = [
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "type", label: "Type" },
  { key: "slaBreached", label: "SLA" },
];

export default function WorkItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { workItems = [] } = useWorkItems();
  const { queueChange } = useSync();
  const { addToast } = useToast();

  const workItem = Array.isArray(workItems)
    ? workItems.find((w) => w?.id === id)
    : null;

  const [activeTab, setActiveTab] = useState("actions");

  // Debug logging
  console.log("WorkItemDetail Debug:", { id, workItem, workItems });

  if (!workItem) {
    return (
      <div className="p-4">
        <button
          className="flex items-center text-blue-600 hover:underline"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={16} /> Back
        </button>
        <p className="mt-4 text-gray-600">Work item not found. ID: {id}</p>
        <div className="mt-2 text-xs text-gray-500">
          Available work items: {workItems.map(w => w?.id).join(', ') || 'none'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Breadcrumb / Back */}
      <button
        className="flex items-center text-blue-600 hover:underline w-fit"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft size={16} /> Back
      </button>

      {/* Metadata Header */}
      <div className="border rounded-lg bg-white shadow p-4 flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{workItem?.title || "Untitled"}</h2>
        <div className="flex flex-wrap gap-3 text-sm text-gray-700">
          {META_FIELDS.map(({ key, label }) => (
            <span key={key}>
              {label}:{" "}
              {key === "slaBreached"
                ? workItem?.slaBreached
                  ? "⚠️ Breached"
                  : "OK"
                : workItem?.[key] || "—"}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1 px-3 py-2 text-sm ${
              activeTab === key
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white shadow rounded-lg p-4">
        {activeTab === "actions" && (
          <ActionsTab
            workItem={workItem}
            queueChange={queueChange}
            addToast={addToast}
          />
        )}
        {activeTab === "ai" && (
          <AiInsightsTab workItem={workItem} />
        )}
        {activeTab === "log" && <ActivityLogTab workItem={workItem} />}
      </div>

      {/* Traceability Links */}
      <div className="mt-2 text-sm text-gray-600 space-y-1">
        {workItem.relatedAutomation && (
          <Link
            to={`/intelligence/automation/${workItem.relatedAutomation}`}
            className="text-blue-600 hover:underline block"
          >
            View related automation
          </Link>
        )}
        {workItem.relatedKnowledge && (
          <Link
            to={`/intelligence/knowledge/${workItem.relatedKnowledge}`}
            className="text-purple-600 hover:underline block"
          >
            View related KB article
          </Link>
        )}
        {workItem.relatedAlert && (
          <Link
            to={`/alerts/${workItem.relatedAlert}`}
            className="text-red-600 hover:underline block"
          >
            View related alert
          </Link>
        )}
      </div>
    </div>
  );
}

/* ---------------- Tab Components ---------------- */

function ActionsTab({ workItem, queueChange, addToast }) {
  const handleAction = (action) => {
    if (!workItem) return;
    queueChange?.(action, workItem);
    addToast?.({ message: `Action '${action}' queued for sync`, type: TOAST_TYPES.INFO });
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        className="flex items-center gap-2 text-blue-600 hover:underline"
        onClick={() => handleAction("reassign")}
      >
        <User size={16} /> Reassign
      </button>
      <button
        className="flex items-center gap-2 text-green-600 hover:underline"
        onClick={() => handleAction("automation")}
      >
        <Zap size={16} /> Run Automation
      </button>
      <button
        className="flex items-center gap-2 text-purple-600 hover:underline"
        onClick={() => handleAction("chat")}
      >
        <MessageSquare size={16} /> Open Chat
      </button>
    </div>
  );
}

function AiInsightsTab({ workItem }) {
  return (
    <div>
      <p className="text-sm text-gray-600">
        AI analysis coming soon for {workItem?.title || "this item"}.
      </p>
      <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
        <h4 className="font-medium text-blue-900 mb-2">Placeholder Insights:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Similar incident pattern detected last week</li>
          <li>• Automation candidate: This issue repeats frequently</li>
          <li>• Related knowledge articles available</li>
        </ul>
      </div>
    </div>
  );
}

function ActivityLogTab({ workItem }) {
  return (
    <div className="text-sm text-gray-700">
      {Array.isArray(workItem?.activityLog) && workItem.activityLog.length > 0 ? (
        <ul className="list-disc pl-4 space-y-1">
          {workItem.activityLog.map((log, idx) => (
            <li key={idx}>{log}</li>
          ))}
        </ul>
      ) : (
        <div>
          <p className="text-gray-500 mb-3">No activity logged yet.</p>
          <div className="p-3 bg-gray-50 rounded border">
            <h4 className="font-medium text-gray-900 mb-2">Expected Activity:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Created: {new Date(workItem?.createdAt).toLocaleString()}</li>
              <li>• Assigned to: {workItem?.assignedTo || 'Unassigned'}</li>
              <li>• Status: {workItem?.status || 'Unknown'}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}