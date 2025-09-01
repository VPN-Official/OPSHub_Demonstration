import React from "react";
import { Link } from "react-router-dom";
import { User, Zap, MessageSquare, Info } from "lucide-react";
import SmartScoreExplanation from "./SmartScoreExplanation.jsx";

/**
 * Enhanced SmartQueueTable
 * - Desktop-first table view with AI transparency
 * - Preserves ALL existing functionality
 * - Adds smart score explanations
 * - Maintains existing inline actions
 */
export default function SmartQueueTable({ items = [] }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-sm text-gray-500">No work items available</p>;
  }

  // Config-driven columns (preserved from original)
  const columns = [
    { key: "id", label: "ID" },
    { key: "title", label: "Title" },
    { key: "priority", label: "Priority" },
    { key: "status", label: "Status" },
    { key: "type", label: "Type" },
    { key: "slaBreached", label: "SLA" },
    { key: "smartScore", label: "AI Score" }, // Enhanced with explanation
  ];

  return (
    <table className="min-w-full border border-gray-200 text-sm bg-white shadow rounded-lg">
      <thead className="bg-gray-50 text-gray-700">
        <tr>
          {columns.map((col) => (
            <th key={col.key} className="p-2 text-left border-b">
              {col.label}
            </th>
          ))}
          <th className="p-2 text-left border-b">Actions</th>
        </tr>
      </thead>
      <tbody>
        {items
          .filter(Boolean)
          .map((w) => (
            <tr key={w.id} className="hover:bg-gray-50">
              {columns.map((col) => (
                <td key={col.key} className="p-2 border-b">
                  {col.key === "slaBreached" ? (
                    w.slaBreached ? (
                      <span className="text-red-600 font-medium">⚠️</span>
                    ) : (
                      <span className="text-green-600">✓</span>
                    )
                  ) : col.key === "smartScore" ? (
                    // ENHANCED: Smart score with explanation
                    <SmartScoreExplanation 
                      workItem={w} 
                      config={null} // TODO: Pass actual config when available
                    />
                  ) : col.key === "priority" ? (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      w.priority === "P0" ? "bg-red-100 text-red-800" :
                      w.priority === "P1" ? "bg-orange-100 text-orange-800" :
                      w.priority === "P2" ? "bg-yellow-100 text-yellow-800" :
                      "bg-gray-100 text-gray-800"
                    }`}>
                      {w[col.key] ?? "—"}
                    </span>
                  ) : col.key === "status" ? (
                    <span className={`px-2 py-1 rounded text-xs ${
                      w.status === "open" ? "bg-blue-100 text-blue-800" :
                      w.status === "in-progress" ? "bg-purple-100 text-purple-800" :
                      w.status === "resolved" ? "bg-green-100 text-green-800" :
                      "bg-gray-100 text-gray-800"
                    }`}>
                      {w[col.key] ?? "—"}
                    </span>
                  ) : (
                    w[col.key] ?? "—"
                  )}
                </td>
              ))}
              <td className="p-2 border-b">
                {/* PRESERVED: All existing inline actions */}
                <div className="flex gap-2 text-gray-600">
                  <button
                    className="hover:text-blue-600"
                    title="Reassign"
                    onClick={() => console.log("Reassign", w)}
                  >
                    <User size={16} />
                  </button>
                  <button
                    className="hover:text-green-600"
                    title="Trigger Automation"
                    onClick={() => console.log("Automate", w)}
                  >
                    <Zap size={16} />
                  </button>
                  <button
                    className="hover:text-purple-600"
                    title="Open Chat"
                    onClick={() => console.log("Chat", w)}
                  >
                    <MessageSquare size={16} />
                  </button>
                  <Link
                    to={`/workitem/${w.id}`}
                    className="hover:text-gray-800"
                    title="Drilldown"
                  >
                    <Info size={16} />
                  </Link>
                </div>
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}