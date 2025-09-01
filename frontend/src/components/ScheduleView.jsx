import React, { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useSchedule } from "../contexts/ScheduleContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { Calendar, Plus, Wrench, Plane } from "lucide-react"; // ✅ Lucide icons

/**
 * ScheduleView
 * - Unified calendar for shifts, maintenance, leave
 * - Role-aware defaults
 * - Editable (add maintenance, request leave)
 * - Offline-first (ScheduleContext persists via IndexedDB)
 */
export default function ScheduleView({ role }) {
  const { getFilteredEvents, addEvent, EVENT_TYPES } = useSchedule();
  const { user } = useAuth();
  const [events, setEvents] = useState(getFilteredEvents());
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState(EVENT_TYPES.MAINTENANCE);

  const handleDateClick = (arg) => {
    // Open event form with pre-selected date
    setShowForm(true);
  };

  const handleAddEvent = (e) => {
    e.preventDefault();
    const title = e.target.title.value;
    const start = e.target.start.value;
    const end = e.target.end.value;

    addEvent({ type: formType, title, start, end, relatedWorkItemId: null });
    setEvents(getFilteredEvents());
    setShowForm(false);
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Calendar size={20} /> Schedule
        </h2>
        <div className="flex gap-2">
          {/* Maintenance */}
          <button
            onClick={() => {
              setFormType(EVENT_TYPES.MAINTENANCE);
              setShowForm(true);
            }}
            className="flex items-center gap-1 px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-sm"
          >
            <Wrench size={14} /> Add Maintenance
          </button>
          {/* Leave */}
          <button
            onClick={() => {
              setFormType(EVENT_TYPES.LEAVE);
              setShowForm(true);
            }}
            className="flex items-center gap-1 px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-sm"
          >
            <Plane size={14} /> Request Leave
          </button>
        </div>
      </div>

      {/* Calendar */}
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={events}
        dateClick={handleDateClick}
        height="auto"
      />

      {/* Event Form */}
      {showForm && (
        <div className="p-4 border rounded-lg bg-white shadow-md">
          <h3 className="font-semibold mb-2">
            {formType === EVENT_TYPES.MAINTENANCE ? "Add Maintenance" : "Request Leave"}
          </h3>
          <form onSubmit={handleAddEvent} className="flex flex-col gap-2">
            <input
              type="text"
              name="title"
              placeholder="Title"
              className="border p-2 rounded text-sm"
              required
            />
            <input
              type="datetime-local"
              name="start"
              className="border p-2 rounded text-sm"
              required
            />
            <input
              type="datetime-local"
              name="end"
              className="border p-2 rounded text-sm"
              required
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-1 bg-gray-200 rounded text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}