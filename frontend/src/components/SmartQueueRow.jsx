import React, { useState } from "react";
import { explainSmartScore } from "../utils/scoring";

export default function SmartQueueRow({ workitem, onClick }) {
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
    <>
      <tr
        className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
        onClick={onClick}
      >
        <td className="px-3 py-2">{workitem.id}</td>
        <td className="px-3 py-2">{workitem.title}</td>
        <td className="px-3 py-2">{workitem.priority}</td>
        <td className="px-3 py-2">
          {workitem.sla_remaining < 0 ? (
            <span className="text-red-600">Breached</span>
          ) : (
            `${workitem.sla_remaining} min`
          )}
        </td>
        <td className="px-3 py-2">${workitem.impact.toLocaleString()}</td>
        <td className="px-3 py-2">{workitem.owner || "Unassigned"}</td>
        <td className="px-3 py-2">
          {workitem.automationEligible ? "Yes" : "No"}
        </td>
        <td className="px-3 py-2">{workitem.smartscore}</td>
        <td className="px-3 py-2 flex gap-2">
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
        </td>
      </tr>

      {showWhy && (
        <tr>
          <td colSpan="9" className="px-3 py-2 bg-gray-50 dark:bg-gray-800">
            <ul className="list-disc pl-5 text-xs text-gray-700 dark:text-gray-300">
              {workitem.reasons?.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
