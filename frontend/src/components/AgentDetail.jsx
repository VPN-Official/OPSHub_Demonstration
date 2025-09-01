import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAgents } from "../contexts/AgentsContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast, TOAST_TYPES } from "../contexts/ToastContext.jsx";
import { ArrowLeft, Bot, Play, Database } from "lucide-react"; // ✅ Lucide icons

/**
 * AgentDetail
 * - Shows agent info
 * - Inline actions: Test (and future Train)
 * - Role-aware: agent designers have controls
 * - Traceability: linked automation
 */
export default function AgentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { agents } = useAgents();
  const { role } = useAuth();
  const { addToast } = useToast();

  const agent = agents.find((a) => a.id === id);

  if (!agent) {
    return <div className="p-4 text-gray-500">Agent not found.</div>;
  }

  const handleTest = () => {
    addToast({ message: `Agent ${agent.name} test started`, type: TOAST_TYPES.INFO });
    // 🔧 TODO: real testing logic
  };

  const handleTrain = () => {
    addToast({ message: `Agent ${agent.name} training initiated`, type: TOAST_TYPES.SUCCESS });
    // 🔧 TODO: real training logic
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-gray-600 hover:text-blue-600"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Bot size={20} /> {agent.name}
        </h2>
      </div>

      {/* Metadata */}
      <div className="p-3 border rounded-lg bg-gray-50 text-sm flex flex-col gap-1">
        <span><strong>ID:</strong> {agent.id}</span>
        {agent.linkedAutomationId && (
          <span className="text-blue-600 cursor-pointer hover:underline">
            🔗 Linked Automation: {agent.linkedAutomationId}
          </span>
        )}
        {agent.trainingNeeded && <span className="text-red-600">⚠ Training Required</span>}
      </div>

      {/* Training Data */}
      <div className="p-3 border rounded-lg bg-white">
        <h3 className="font-semibold mb-2 flex items-center gap-1">
          <Database size={16} /> Training Data
        </h3>
        <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
          {JSON.stringify(agent.trainingData, null, 2) || "No training data available."}
        </pre>
      </div>

      {/* Actions (role-based) */}
      {role === "agentDesigner" && (
        <div className="flex gap-2">
          <button
            onClick={handleTest}
            className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded"
          >
            <Play size={16} /> Test
          </button>
          <button
            onClick={handleTrain}
            className="flex items-center gap-1 px-3 py-1 bg-gray-200 rounded"
          >
            Train
          </button>
        </div>
      )}
    </div>
  );
}