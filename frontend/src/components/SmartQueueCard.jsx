import React from "react";
import { Link } from "react-router-dom";
import { User, Zap, MessageSquare, Info } from "lucide-react";

/**
 * SmartQueueCard
 * - Mobile-first card view of work items
 * - Inline actions: Reassign, Automate, Chat, Drilldown
 * - Collapsible per card
 */
export default function SmartQueueCard({ items = [] }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-sm text-gray-500">No work items available</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {items.filter(Boolean).map((w) => (
        <div
          key={w.id}
          className="border rounded-lg shadow-sm bg-white p-3 flex flex-col gap-2"
        >
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">
              {w.id}: {w.title}
            </span>
            <span
              className={`text-xs font-semibold px-2 py-1 rounded ${
                w.priority === "P0"
                  ? "bg-red-100 text-red-700"
                  : w.priority === "P1"
                  ? "bg-orange-100 text-orange-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {w.priority}
            </span>
          </div>

          <div className="flex flex-wrap text-xs gap-2 text-gray-600">
            <span>Status: {w.status || "—"}</span>
            <span>Type: {w.type || "—"}</span>
            <span>SLA: {w.slaBreached ? "⚠️ Breached" : "OK"}</span>
            <span>Score: {w.smartScore ?? "—"}</span>
          </div>

          {/* Inline actions */}
          <div className="flex gap-3 text-gray-600 mt-2">
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
        </div>
      ))}
    </div>
  );
}