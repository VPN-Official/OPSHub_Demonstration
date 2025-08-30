import React, { useState } from "react";
import { explainSmartScore } from "../utils/scoring";

export default function SmartQueueCard({ workitem, onClick }) {
  const [showWhy, setShowWhy] = useState(false);

  const handleAssign = () => {
    console.log(`Assign/unassign ${workitem.title}`);
  };

  const handleAutomation = () => {
    console.log(`Run automation for ${workitem.title}`);
  };

  const handleChat = () => {
    console.log(`Open chat for ${workitem.title}`);
  };

  return (
    <div
      className="p-4 bg-white dark:bg-gray-900 rounded shadow hover:shadow-md cursor-pointer"
      onClick={onClick}
    >
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">{workitem.title}</h2>
        <span className="text-xs text-gray-500">#{workitem.id}</span>
      </div>
      <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
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
        <p>Automation: {workitem.automationEligible ? "Yes" : "No"}</p>
        <p>Smart Score: {workitem.smartscore}</p>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleAssign();
          }}
          className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          {workitem.owner ? "Unassign" : "Assign to Me"}
        </button>
        {workitem.automationEligible && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAutomation();
            }}
            className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700"
          >
            Run Automation
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleChat();
          }}
          className="px-2 py-1 text-xs rounded bg-purple-600 text-white hover:bg-purple-700"
        >
          Chat
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowWhy(!showWhy);
          }}
          className="px-2 py-1 text-xs underline text-gray-600 dark:text-gray-300"
        >
          {showWhy ? "Hide Why" : "Why?"}
        </button>
      </div>

      {showWhy && (
        <ul className="mt-2 text-xs list-disc pl-4 text-gray-600 dark:text-gray-300">
          {workitem.reasons?.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
