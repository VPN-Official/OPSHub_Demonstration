import React, { useState } from "react";
import { Settings } from "lucide-react";
import { explainSmartScore } from "../utils/scoring";

export default function SmartQueueRow({ workitem }) {
  const [showWhy, setShowWhy] = useState(false);
  const reasons = explainSmartScore(workitem, "u1");

  return (
    <>
      <tr className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
        <td className="px-3 py-2 font-semibold">#{workitem.id}</td>
        <td className="px-3 py-2">{workitem.title}</td>
        <td className="px-3 py-2">
          <span
            className={`px-2 py-1 text-xs rounded text-white ${
              workitem.priority === "priority_1" ? "bg-red-600" : "bg-orange-500"
            }`}
          >
            {workitem.priority === "priority_1" ? "P1" : "P2"}
          </span>
        </td>
        <td
          className={`px-3 py-2 font-medium ${
            workitem.sla_remaining < 0
              ? "text-red-600"
              : workitem.sla_remaining < 15
              ? "text-yellow-600"
              : ""
          }`}
        >
          {workitem.sla_remaining < 0
            ? "Breached"
            : `${workitem.sla_remaining}m left`}
        </td>
        <td className="px-3 py-2">${workitem.impact.toLocaleString()}/hr</td>
        <td className="px-3 py-2">{workitem.owner}</td>
        <td className="px-3 py-2">
          {workitem.automationEligible && <Settings className="w-4 h-4" />}
        </td>
        <td className="px-3 py-2">
          <button
            onClick={() => setShowWhy(!showWhy)}
            className="text-ai-purple text-xs hover:underline"
          >
            Why?
          </button>
        </td>
      </tr>

      {showWhy && (
        <tr>
          <td colSpan="8" className="text-xs px-4 py-2 bg-gray-50 dark:bg-gray-800">
            <ul className="list-disc pl-4">
              {reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
