import React from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

export default function ScheduleCalendar({ events }) {
  const eventColors = {
    planned: "blue",
    shifts: "green",
    blackouts: "red",
  };

  const mappedEvents = events.map((e) => ({
    ...e,
    backgroundColor: eventColors[e.type] || "gray",
    borderColor: eventColors[e.type] || "gray",
  }));

  return (
    <div className="bg-white dark:bg-gray-900 p-3 rounded shadow">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        events={mappedEvents}
        height="80vh"
      />
    </div>
  );
}
