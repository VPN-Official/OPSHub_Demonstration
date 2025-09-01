import React, { createContext, useContext, useState, useEffect } from "react";
import { getAll, setItem, delItem, clearStore, seedAll } from "../utils/db.js";

const ScheduleContext = createContext();

// CRITICAL FIX: Add EVENT_TYPES that ScheduleView expects
export const EVENT_TYPES = {
  SHIFT: "shift",
  MAINTENANCE: "maintenance", 
  LEAVE: "leave",
  ROSTER: "roster"
};

export function ScheduleProvider({ children }) {
  const [schedule, setSchedule] = useState([]);

  async function load() {
    const items = await getAll("schedule");
    if (!items.length) {
      await seedAll({ schedule: [] });
    }
    setSchedule(items);
  }

  async function addEvent(event) {
    const newEvent = {
      id: Date.now().toString(),
      ...event
    };
    await setItem("schedule", newEvent);
    load();
  }

  async function removeEvent(id) {
    await delItem("schedule", id);
    load();
  }

  async function clearAll() {
    await clearStore("schedule");
    load();
  }

  // CRITICAL FIX: Add getFilteredEvents that ScheduleView expects
  function getFilteredEvents(filters = {}) {
    return schedule.map(event => ({
      id: event.id,
      title: event.title,
      start: event.start || event.date, // Handle both formats
      end: event.end,
      backgroundColor: getEventColor(event.type),
      borderColor: getEventColor(event.type),
      extendedProps: {
        type: event.type,
        user: event.user,
        team: event.team,
        link: event.link
      }
    }));
  }

  // Helper function for event colors
  function getEventColor(type) {
    switch (type) {
      case EVENT_TYPES.SHIFT:
        return "#3b82f6"; // blue
      case EVENT_TYPES.MAINTENANCE:
        return "#f59e0b"; // amber
      case EVENT_TYPES.LEAVE:
        return "#10b981"; // emerald
      case EVENT_TYPES.ROSTER:
        return "#8b5cf6"; // violet
      default:
        return "#6b7280"; // gray
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <ScheduleContext.Provider
      value={{ 
        schedule, 
        addEvent, 
        removeEvent, 
        clearAll,
        getFilteredEvents, // CRITICAL FIX: Add missing method
        EVENT_TYPES        // CRITICAL FIX: Add missing constant
      }}
    >
      {children}
    </ScheduleContext.Provider>
  );
}

export function useSchedule() {
  return useContext(ScheduleContext);
}