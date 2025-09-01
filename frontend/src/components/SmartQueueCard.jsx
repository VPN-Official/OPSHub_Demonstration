import React from "react";
import { Link } from "react-router-dom";
import { User, Zap, MessageSquare, Info } from "lucide-react";
import SmartScoreExplanation from "./SmartScoreExplanation.jsx";

/**
 * Enhanced SmartQueueCard
 * - Mobile-first card view with AI transparency
 * - Preserves ALL existing functionality
 * - Adds compact smart score explanations
 * - Maintains existing inline actions
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
          className="border rounded-lg shadow-sm bg-white p-3 flex flex-col gap-3"
        >
          {/* Header with ID, Title, and AI Score */}
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {w.id}: {w.title}
              </div>
            </div>
            
            {/* ENHANCED: Smart Score with compact explanation */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <SmartScoreExplanation 
                workItem={w} 
                config={null} // TODO: Pass actual config when available
                compactMode={true}
              />
              
              {/* Priority badge */}
              <span className={`text-xs font-semibold px-2 py-1 rounded ${
                w.priority === "P0"
                  ? "bg-red-100 text-red-700"
                  : w.priority === "P1"
                  ? "bg-orange-100 text-orange-700"
                  : w.priority === "P2" 
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-gray-100 text-gray-700"
              }`}>
                {w.priority}
              </span>
            </div>
          </div>

          {/* Metadata row */}
          <div className="flex flex-wrap text-xs gap-2 text-gray-600">
            <span className={`px-2 py-1 rounded ${
              w.status === "open" ? "bg-blue-50 text-blue-700" :
              w.status === "in-progress" ? "bg-purple-50 text-purple-700" :
              w.status === "resolved" ? "bg-green-50 text-green-700" :
              "bg-gray-50 text-gray-700"
            }`}>
              {w.status || "—"}
            </span>
            
            <span className="px-2 py-1 rounded bg-gray-50 text-gray-700">
              {w.type || "—"}
            </span>
            
            <span className={`px-2 py-1 rounded ${
              w.slaBreached 
                ? "bg-red-50 text-red-700" 
                : "bg-green-50 text-green-700"
            }`}>
              SLA: {w.slaBreached ? "Breached" : "OK"}
            </span>
          </div>

          {/* Additional context for mobile */}
          {(w.customer_tier || w.asset_criticality || w.required_skills) && (
            <div className="flex flex-wrap text-xs gap-2 text-gray-500">
              {w.customer_tier && (
                <span className={`px-2 py-1 rounded border ${
                  w.customer_tier === "platinum" ? "border-purple-200 text-purple-600" :
                  w.customer_tier === "gold" ? "border-yellow-200 text-yellow-600" :
                  "border-gray-200 text-gray-600"
                }`}>
                  {w.customer_tier.toUpperCase()}
                </span>
              )}
              
              {w.asset_criticality && (
                <span className="px-2 py-1 rounded border border-gray-200 text-gray-600">
                  Asset: {w.asset_criticality}
                </span>
              )}
              
              {w.required_skills?.length > 0 && (
                <span className="px-2 py-1 rounded border border-blue-200 text-blue-600">
                  Skills: {w.required_skills.length}
                </span>
              )}
            </div>
          )}

          {/* PRESERVED: All existing inline actions */}
          <div className="flex justify-between items-center pt-2 border-t">
            <div className="flex gap-3 text-gray-600">
              <button
                className="flex items-center gap-1 text-xs hover:text-blue-600 transition-colors"
                title="Reassign"
                onClick={() => console.log("Reassign", w)}
              >
                <User size={14} />
                <span className="hidden sm:inline">Reassign</span>
              </button>
              <button
                className="flex items-center gap-1 text-xs hover:text-green-600 transition-colors"
                title="Trigger Automation"
                onClick={() => console.log("Automate", w)}
              >
                <Zap size={14} />
                <span className="hidden sm:inline">Automate</span>
              </button>
              <button
                className="flex items-center gap-1 text-xs hover:text-purple-600 transition-colors"
                title="Open Chat"
                onClick={() => console.log("Chat", w)}
              >
                <MessageSquare size={14} />
                <span className="hidden sm:inline">Chat</span>
              </button>
            </div>
            
            <Link
              to={`/workitem/${w.id}`}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
              title="View Details"
            >
              <Info size={14} />
              <span>Details</span>
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}