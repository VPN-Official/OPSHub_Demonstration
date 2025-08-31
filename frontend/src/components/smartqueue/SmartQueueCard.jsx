import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useWorkItems } from "../context/WorkItemsContext";

export default function WorkItemDetail() {
  const { id } = useParams();
  const { getWorkItem, updateWorkItem } = useWorkItems();
  const workItem = getWorkItem(id);

  const [activeTab, setActiveTab] = useState("timeline");
  const [slaCountdown, setSlaCountdown] = useState("");

  useEffect(() => {
    if (!workItem) return;
    const interval = setInterval(() => {
      const due = new Date(workItem.sla_due).getTime();
      const now = Date.now();
      const diff = due - now;
      if (diff > 0) {
        const h = Math.floor(diff / 1000 / 3600);
        const m = Math.floor((diff / 1000 % 3600) / 60);
        setSlaCountdown(`${h}h ${m}m left`);
      } else {
        setSlaCountdown("SLA breached!");
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [workItem]);

  if (!workItem) return <p className="p-4">WorkItem not found</p>;

  // Handlers
  const handleAck = () =>
    updateWorkItem(id, { status: "in_progress" }, "ack", "Engineer");

  const handleAssign = () =>
    updateWorkItem(
      id,
      {
        assigned_to: { id: 999, name: "Me (Engineer)" },
        status: workItem.status === "open" ? "in_progress" : workItem.status,
      },
      "assign",
      "Engineer"
    );

  const handleEscalate = () =>
    updateWorkItem(id, {}, "escalate", "Engineer");

  const handleAutomate = () =>
    updateWorkItem(id, {}, "automation_triggered", "Engineer");

  const handleChat = () =>
    updateWorkItem(id, {}, "chat_opened", "Engineer");

  const handleClose = () =>
    updateWorkItem(id, { status: "closed" }, "close", "Engineer");

  const sevColors = {
    critical: "bg-red-600",
    warning: "bg-orange-500",
    info: "bg-blue-500",
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-2">
        <h1 className="text-xl font-bold">
          #{workItem.id} – {workItem.title}
        </h1>
        <div className="flex gap-2 mt-2 md:mt-0">
          <span
            className={`px-2 py-1 text-xs text-white rounded ${
              sevColors[workItem.severity]
            }`}
          >
            {workItem.severity.toUpperCase()}
          </span>
          <span className="px-2 py-1 text-xs bg-gray-600 text-white rounded">
            {workItem.status.toUpperCase()}
          </span>
          <span className="px-2 py-1 text-xs bg-blue-600 text-white rounded">
            {slaCountdown}
          </span>
        </div>
      </div>

      {/* Action bar */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 py-2 mb-4 flex gap-2 flex-wrap shadow-sm">
        <button
          onClick={handleAck}
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded"
          disabled={workItem.status !== "open"}
        >
          Ack
        </button>
        <button
          onClick={handleAssign}
          className="px-3 py-1 bg-green-600 text-white text-sm rounded"
        >
          Assign to me
        </button>
        <button
          onClick={handleEscalate}
          className="px-3 py-1 bg-purple-600 text-white text-sm rounded"
        >
          Escalate
        </button>
        <button
          onClick={handleAutomate}
          className="px-3 py-1 bg-orange-600 text-white text-sm rounded"
        >
          Trigger Automation
        </button>
        <button
          onClick={handleChat}
          className="px-3 py-1 bg-gray-600 text-white text-sm rounded"
        >
          Chat
        </button>
        <button
          onClick={handleClose}
          className="px-3 py-1 bg-red-600 text-white text-sm rounded"
          disabled={workItem.status === "closed"}
        >
          Close
        </button>
      </div>

      {/* Meta Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm">
        <div className="space-y-1">
          <p>
            Assigned To:{" "}
            <span className="font-semibold">
              {workItem.assigned_to?.name || "Unassigned"}
            </span>
          </p>
          <p>
            Group:{" "}
            <span className="font-semibold">
              {workItem.assigned_group?.name || "-"}
            </span>
          </p>
          <p>
            Created By:{" "}
            <span className="font-semibold">{workItem.created_by}</span>
          </p>
          <p>
            Created At:{" "}
            <span className="font-semibold">
              {new Date(workItem.created_at).toLocaleString()}
            </span>
          </p>
        </div>
        <div className="space-y-1">
          <p>
            Business Service:{" "}
            <span className="font-semibold">
              {workItem.business_service.name}
            </span>
          </p>
          <p>
            Cost Center:{" "}
            <span className="font-semibold">{workItem.cost_center.name}</span>
          </p>
          <p>
            Impact: <span className="font-semibold">{workItem.impact}</span>
          </p>
          <p>
            Location: <span className="font-semibold">{workItem.location}</span>
          </p>
        </div>
      </div>

      {/* Why */}
      <div className="p-3 mb-4 bg-yellow-50 dark:bg-yellow-900 border-l-4 border-yellow-600 rounded">
        <h3 className="font-semibold mb-1">Why?</h3>
        <p className="text-sm mb-2">{workItem.reason}</p>
        <ul className="list-disc ml-5 text-sm">
          {workItem.knowledge_links.map((k) => (
            <li key={k.id}>
              <a
                href={k.url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline"
              >
                {k.title}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b mb-4">
        {["timeline", "linked", "comments"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-sm ${
              activeTab === tab
                ? "border-b-2 border-blue-600 font-semibold"
                : "text-gray-500"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {activeTab === "timeline" && (
        <div className="space-y-2">
          {workItem.activity.map((a, i) => (
            <div key={i} className="text-sm border-b pb-1">
              <span className="font-mono text-xs text-gray-500">{a.ts}</span>{" "}
              <span className="font-semibold">{a.actor}</span> → {a.action}
            </div>
          ))}
        </div>
      )}

      {/* Linked */}
      {activeTab === "linked" && (
        <div className="space-y-3 text-sm">
          <div>
            <h3 className="font-semibold">Originating Notifications</h3>
            <ul className="list-disc ml-5">
              {workItem.originating_notifications.map((n) => (
                <li key={n.id}>
                  {n.msg} ({n.severity})
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold">Related WorkItems</h3>
            <ul className="list-disc ml-5">
              {workItem.related_workitems.map((w) => (
                <li key={w.id}>
                  #{w.id} – {w.title} [{w.status}]
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Comments */}
      {activeTab === "comments" && (
        <div>
          <textarea
            className="w-full border rounded p-2 text-sm"
            rows="3"
            placeholder="Add a comment..."
          ></textarea>
          <button className="mt-2 px-3 py-1 bg-blue-600 text-white text-sm rounded">
            Post Comment
          </button>
        </div>
      )}
    </div>
  );
}
