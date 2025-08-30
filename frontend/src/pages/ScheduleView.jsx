import React, { useState, useEffect } from "react";
import ScheduleFilters from "../components/schedule/ScheduleFilters";
import ScheduleList from "../components/schedule/ScheduleList";
import ScheduleCalendar from "../components/schedule/ScheduleCalendar";

export default function ScheduleView() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeLayers, setActiveLayers] = useState({
    planned: true,
    shifts: true,
    blackouts: true,
  });

  // Handle responsive view switching
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Dummy events (replace later with API)
  const events = [
    {
      id: "1",
      title: "Kernel Patch (Alice)",
      start: "2025-09-01T10:00:00",
      end: "2025-09-01T12:00:00",
      type: "planned",
    },
    {
      id: "2",
      title: "Shift: Bob On-Call",
      start: "2025-09-01T08:00:00",
      end: "2025-09-01T20:00:00",
      type: "shifts",
    },
    {
      id: "3",
      title: "Blackout: Payments Freeze",
      start: "2025-09-02T00:00:00",
      end: "2025-09-02T23:59:00",
      type: "blackouts",
    },
  ];

  // Filter events by activeLayers
  const filteredEvents = events.filter((e) => activeLayers[e.type]);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Schedule</h1>

      <ScheduleFilters activeLayers={activeLayers} setActiveLayers={setActiveLayers} />

      {isMobile ? (
        <ScheduleList events={filteredEvents} />
      ) : (
        <ScheduleCalendar events={filteredEvents} />
      )}
    </div>
  );
}
