
import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useRoster } from "../contexts/RosterContext.jsx";
import { Card, CardContent } from "./ui/Card.jsx";
import {
  ArrowLeft,
  UserCheck,
  Clock,
  Trash2,
  Lightbulb,
  AlertTriangle,
} from "lucide-react";

export default function RosterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { roster, updateShift, deleteShift } = useRoster();
  const shift = roster.find((r) => r.id === id);

  const [activeTab, setActiveTab] = useState("info");

  if (!shift) {
    return <div className="p-4">Shift not found.</div>;
  }

  // ---- Actions ----
  const handleReassign = () => {
    alert(`Reassigning shift for ${shift.person}...`);
  };

  const handleExtend = () => {
    const newEnd = new Date(new Date(shift.end).getTime() + 3600000); // +1hr
    const updated = { ...shift, end: newEnd.toISOString() };
    updateShift(updated);
    alert(`Shift extended for ${shift.person}`);
  };

  const handleDelete = () => {
    deleteShift(shift.id);
    navigate("/schedule");
  };

  // ---- Insights ----
  const insights = [];
  const overlap = roster.some(
    (r) =>
      r.id !== shift.id &&
      new Date(shift.start) < new Date(r.end) &&
      new Date(shift.end) > new Date(r.start)
  );
  if (overlap) {
    insights.push({
      id: "overlap",
      type: "warning",
      message: "⚠️ Overlapping shift detected with another team member.",
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-blue-600 hover:underline"
        >
          <ArrowLeft size={18} /> Back
        </button>
        <h2 className="text-xl font-bold">{shift.person}</h2>
      </div>
      <div className="text-sm text-[var(--muted)]">
        Team: {shift.team} • {new Date(shift.start).toLocaleString()} →{" "}
        {new Date(shift.end).toLocaleString()}
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-4 mt-4">
        <button
          onClick={() => setActiveTab("info")}
          className={`px-3 py-2 ${
            activeTab === "info"
              ? "border-b-2 border-blue-600 font-semibold"
              : "text-[var(--muted)]"
          }`}
        >
          Info & Actions
        </button>
        <button
          onClick={() => setActiveTab("timeline")}
          className={`px-3 py-2 ${
            activeTab === "timeline"
              ? "border-b-2 border-blue-600 font-semibold"
              : "text-[var(--muted)]"
          }`}
        >
          Upcoming Shifts
        </button>
        <button
          onClick={() => setActiveTab("insights")}
          className={`px-3 py-2 ${
            activeTab === "insights"
              ? "border-b-2 border-blue-600 font-semibold"
              : "text-[var(--muted)]"
          }`}
        >
          AI Insights
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "info" && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <button
              onClick={handleReassign}
              className="px-3 py-2 bg-green-600 text-white rounded flex items-center gap-2"
            >
              <UserCheck size={16} /> Reassign Shift
            </button>
            <button
              onClick={handleExtend}
              className="px-3 py-2 bg-yellow-600 text-white rounded flex items-center gap-2"
            >
              <Clock size={16} /> Extend Shift (+1h)
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-2 bg-red-600 text-white rounded flex items-center gap-2"
            >
              <Trash2 size={16} /> Delete Shift
            </button>
          </CardContent>
        </Card>
      )}

      {activeTab === "timeline" && (
        <Card>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {roster
                .filter((r) => r.person === shift.person)
                .map((r) => (
                  <li key={r.id} className="border-b pb-1">
                    {new Date(r.start).toLocaleString()} →{" "}
                    {new Date(r.end).toLocaleString()}
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {activeTab === "insights" && (
        <Card>
          <CardContent>
            {insights.length === 0 ? (
              <p className="text-sm text-gray-500">No insights available.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {insights.map((i) => (
                  <li
                    key={i.id}
                    className="border-b pb-1 flex items-center gap-2"
                  >
                    {i.type === "warning" && (
                      <AlertTriangle className="text-red-500" size={16} />
                    )}
                    {i.type === "nudge" && (
                      <Lightbulb className="text-orange-500" size={16} />
                    )}
                    {i.message}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}