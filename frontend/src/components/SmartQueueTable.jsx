import React from "react";
import { Link } from "react-router-dom";
import { User, Zap, MessageSquare, Info } from "lucide-react";

/**
 * SmartQueueTable
 * - Desktop-first table view of work items
 * - Inline actions: Reassign, Automate, Chat, Drilldown
 * - Config-driven columns
 */
export default function SmartQueueTable({ items = [] }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-sm text-gray-500">No work items available</p>;
  }

  // Config-driven columns
  const columns = [
    { key: "id", label: "ID" },
    { key: "title", label: "Title" },
    { key: "priority", label: "Priority" },
    { key: "status", label: "Status" },
    { key: "type", label: "Type" },
    { key: "slaBreached", label: "SLA" },
    { key: "smartScore", label: "Smart Score" },
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
                  {col.key === "slaBreached"
                    ? w.slaBreached
                      ? "⚠️"
                      : "✔️"
                    : w[col.key] ?? "—"}
                </td>
              ))}
              <td className="p-2 border-b flex gap-2 text-gray-600">
                {/* Inline actions */}
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
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}