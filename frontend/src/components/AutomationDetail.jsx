import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAutomations } from "../contexts/AutomationsContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast, TOAST_TYPES } from "../contexts/ToastContext.jsx";
import { ArrowLeft, Play, FileCode } from "lucide-react"; // ✅ Lucide icons

/**
 * AutomationDetail
 * - Shows automation info
 * - Inline action: Run automation
 * - Role-aware: automation engineers can run/edit
 * - Traceability: linked work item
 */
export default function AutomationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { automations } = useAutomations();
  const { role } = useAuth();
  const { addToast } = useToast();

  const automation = automations.find((a) => a.id === id);

  if (!automation) {
    return <div className="p-4 text-gray-500">Automation not found.</div>;
  }

  const handleRun = () => {
    addToast({ message: `Automation ${automation.name} executed`, type: TOAST_TYPES.SUCCESS });
    // 🔧 TODO: real execution logic
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
          <FileCode size={20} /> {automation.name}
        </h2>
      </div>

      {/* Metadata */}
      <div className="p-3 border rounded-lg bg-gray-50 text-sm flex flex-col gap-1">
        <span><strong>ID:</strong> {automation.id}</span>
        <span><strong>Status:</strong> {automation.status}</span>
        {automation.relatedWorkItemId && (
          <span className="text-blue-600 cursor-pointer hover:underline">
            🔗 Related WorkItem: {automation.relatedWorkItemId}
          </span>
        )}
      </div>

      {/* Script */}
      <div className="p-3 border rounded-lg bg-white">
        <h3 className="font-semibold mb-2">Script</h3>
        <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
          {automation.script || "No script available"}
        </pre>
      </div>

      {/* Actions (role-based) */}
      {role === "automationEngineer" && (
        <div className="flex gap-2">
          <button
            onClick={handleRun}
            className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded"
          >
            <Play size={16} /> Run
          </button>
          <button
            className="flex items-center gap-1 px-3 py-1 bg-gray-200 rounded"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}