import React, { useState } from "react";
import { Settings } from "lucide-react";
import { explainSmartScore } from "../utils/scoring";

export default function SmartQueueCard({ workitem }) {
  const [showWhy, setShowWhy] = useState(false);
  const reasons = explainSmartScore(workitem, "u1");

  return (
    <div className="bg-white dark:bg-gray-900 shadow rounded p-4 mb-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">{workitem.title}</h3>
        <span
          className={`px-2 py-1 text-xs rounded text-white ${
            workitem.priority === "priority_1" ? "bg-red-600" : "bg-orange-500"
          }`}
        >
          {workitem.priority === "priority_1" ? "P1" : "P2"}
        </span>
      </div>

      <p
        className={`text-sm font-medium ${
          workitem.sla_remaining < 0
            ? "text-red-600"
            : workitem.sla_remaining < 15
            ? "text-yellow-600"
            : "text-gray-700 dark:text-gray-300"
        }`}
      >
        SLA:{" "}
        {workitem.sla_remaining < 0
          ? "Breached"
          : `${workitem.sla_remaining}m left`}
      </p>

      <p className="text-sm text-gray-700 dark:text-gray-300">
        Impact: ${workitem.impact.toLocaleString()}/hr
      </p>
      <p className="text-sm text-gray-500">Owner: {workitem.owner}</p>

      <div className="flex justify-between items-center mt-2">
        {workitem.automationEligible && (
          <span className="text-xs flex items-center space-x-1 text-gray-600 dark:text-gray-400">
            <Settings className="w-4 h-4" />
            <span>Automation</span>
          </span>
        )}
        <button
          onClick={() => setShowWhy(!showWhy)}
          className="text-ai-purple text-xs hover:underline"
        >
          {showWhy ? "Hide Why" : "Why?"}
        </button>
      </div>

      {showWhy && (
        <ul className="mt-2 text-xs list-disc pl-4 text-gray-600 dark:text-gray-300">
          {reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
