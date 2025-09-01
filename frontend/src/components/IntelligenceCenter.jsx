import React, { useState } from "react";
import { useAutomations } from "../contexts/AutomationsContext.jsx";
import { useKnowledge } from "../contexts/KnowledgeContext.jsx";
import { useAgents } from "../contexts/AgentsContext.jsx";
import { useNudges } from "../contexts/NudgesContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { Play, FileText, Bot, Lightbulb } from "lucide-react"; // ✅ Lucide icons
import { useToast, TOAST_TYPES } from "../contexts/ToastContext.jsx";

/**
 * IntelligenceCenter
 * - Hub for Automations, Agents, Knowledge, Nudges
 * - Role-aware views
 * - Inline actions (Run, Edit, Test, Ack)
 */
export default function IntelligenceCenter() {
  const { role } = useAuth();
  const { automations, roleView: automationView = [] } = useAutomations(); // ✅ Safe default
  const { articles, roleView: knowledgeView = [] } = useKnowledge(); // ✅ Safe default
  const { agents, roleView: agentView = [] } = useAgents(); // ✅ Safe default
  const { nudges, roleView: nudgeView = [] } = useNudges(); // ✅ Safe default
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState("automations");

  // ✅ Inline actions
  const runAutomation = (id) => {
    addToast({ message: `Automation ${id} executed`, type: TOAST_TYPES.SUCCESS });
    // 🔧 TODO: actual execution logic
  };

  const editKnowledge = (id) => {
    addToast({ message: `Knowledge ${id} opened for edit`, type: TOAST_TYPES.INFO });
    // 🔧 TODO: open KnowledgeDetail
  };

  const testAgent = (id) => {
    addToast({ message: `Agent ${id} test started`, type: TOAST_TYPES.INFO });
    // 🔧 TODO: agent testing flow
  };

  const ackNudge = (id) => {
    addToast({ message: `Nudge ${id} acknowledged`, type: TOAST_TYPES.INFO });
    // 🔧 TODO: persist ack
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Header */}
      <h2 className="text-xl font-semibold">Intelligence Center</h2>

      {/* Tabs */}
      <div className="border-b flex gap-6 text-sm">
        <button
          onClick={() => setActiveTab("automations")}
          className={`pb-2 flex items-center gap-1 ${
            activeTab === "automations" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600"
          }`}
        >
          <Play size={14} /> Automations
        </button>
        <button
          onClick={() => setActiveTab("knowledge")}
          className={`pb-2 flex items-center gap-1 ${
            activeTab === "knowledge" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600"
          }`}
        >
          <FileText size={14} /> Knowledge
        </button>
        <button
          onClick={() => setActiveTab("agents")}
          className={`pb-2 flex items-center gap-1 ${
            activeTab === "agents" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600"
          }`}
        >
          <Bot size={14} /> Agents
        </button>
        <button
          onClick={() => setActiveTab("nudges")}
          className={`pb-2 flex items-center gap-1 ${
            activeTab === "nudges" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600"
          }`}
        >
          <Lightbulb size={14} /> Nudges
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-3 border rounded-lg bg-white">
        {activeTab === "automations" && (
          <div>
            <h3 className="font-semibold mb-2">Automations</h3>
            {Array.isArray(automationView) && automationView.length ? (
              <ul className="flex flex-col gap-2">
                {automationView.map((a) => (
                  <li
                    key={a.id}
                    className="p-2 border rounded flex justify-between items-center"
                  >
                    <span>{a.name}</span>
                    <button
                      onClick={() => runAutomation(a.id)}
                      className="px-2 py-1 bg-blue-600 text-white rounded text-sm"
                    >
                      Run
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No automations available.</p>
            )}
          </div>
        )}

        {activeTab === "knowledge" && (
          <div>
            <h3 className="font-semibold mb-2">Knowledge</h3>
            {Array.isArray(knowledgeView) && knowledgeView.length ? (
              <ul className="flex flex-col gap-2">
                {knowledgeView.map((k) => (
                  <li
                    key={k.id}
                    className="p-2 border rounded flex justify-between items-center"
                  >
                    <span>{k.title}</span>
                    <button
                      onClick={() => editKnowledge(k.id)}
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                    >
                      Edit
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No knowledge articles found.</p>
            )}
          </div>
        )}

        {activeTab === "agents" && (
          <div>
            <h3 className="font-semibold mb-2">Agents</h3>
            {Array.isArray(agentView) && agentView.length ? (
              <ul className="flex flex-col gap-2">
                {agentView.map((ag) => (
                  <li
                    key={ag.id}
                    className="p-2 border rounded flex justify-between items-center"
                  >
                    <span>{ag.name}</span>
                    <button
                      onClick={() => testAgent(ag.id)}
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                    >
                      Test
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No agents available.</p>
            )}
          </div>
        )}

        {activeTab === "nudges" && (
          <div>
            <h3 className="font-semibold mb-2">Nudges</h3>
            {Array.isArray(nudgeView) && nudgeView.length ? (
              <ul className="flex flex-col gap-2">
                {nudgeView.map((n) => (
                  <li
                    key={n.id}
                    className="p-2 border rounded flex justify-between items-center"
                  >
                    <span>{n.title}</span>
                    <button
                      onClick={() => ackNudge(n.id)}
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                    >
                      Acknowledge
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No nudges available.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}