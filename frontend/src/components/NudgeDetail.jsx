import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useNudges } from "../contexts/NudgesContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast, TOAST_TYPES } from "../contexts/ToastContext.jsx";
import { ArrowLeft, Lightbulb, CheckCircle2 } from "lucide-react"; // ✅ Lucide icons

/**
 * NudgeDetail
 * - Shows nudge info
 * - Inline action: Acknowledge
 * - Role-aware (automation engineers see unacknowledged first, but detail is universal)
 * - Traceability: related entity
 */
export default function NudgeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { nudges } = useNudges();
  const { role } = useAuth();
  const { addToast } = useToast();

  const nudge = nudges.find((n) => n.id === id);

  if (!nudge) {
    return <div className="p-4 text-gray-500">Nudge not found.</div>;
  }

  const handleAck = () => {
    // 🔧 TODO: persist nudge acknowledged = true in context/DB
    addToast({ message: `Nudge ${nudge.title} acknowledged`, type: TOAST_TYPES.SUCCESS });
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
          <Lightbulb size={20} /> {nudge.title}
        </h2>
      </div>

      {/* Metadata */}
      <div className="p-3 border rounded-lg bg-gray-50 text-sm flex flex-col gap-1">
        <span><strong>ID:</strong> {nudge.id}</span>
        <span><strong>Status:</strong> {nudge.acknowledged ? "Acknowledged" : "Pending"}</span>
        {nudge.relatedEntityId && (
          <span className="text-blue-600 cursor-pointer hover:underline">
            🔗 Related Entity: {nudge.relatedEntityId}
          </span>
        )}
      </div>

      {/* Message */}
      <div className="p-3 border rounded-lg bg-white">
        <h3 className="font-semibold mb-2">Message</h3>
        <p className="text-sm text-gray-700">{nudge.message}</p>
      </div>

      {/* Action (role-aware emphasis) */}
      {!nudge.acknowledged && (
        <div>
          <button
            onClick={handleAck}
            className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-sm"
          >
            <CheckCircle2 size={16} /> Acknowledge
          </button>
        </div>
      )}

      {role === "automationEngineer" && nudge.acknowledged && (
        <p className="text-xs text-gray-500 italic">
          You’ve acknowledged this nudge. It will disappear from your active list soon.
        </p>
      )}
    </div>
  );
}