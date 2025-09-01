import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { getAll, setItem, delItem, clearStore, isSeeded } from "../utils/db.js";
import { useAuth } from "./AuthContext.jsx";

const ScheduleContext = createContext();

// Event types for scheduling
export const EVENT_TYPES = {
  SHIFT: "shift",
  MAINTENANCE: "maintenance", 
  LEAVE: "leave",
  MEETING: "meeting",
  TRAINING: "training",
  ON_CALL: "on_call",
  CHANGE_WINDOW: "change_window",
  INCIDENT: "incident"
};

export function ScheduleProvider({ children }) {
  const [schedule, setSchedule] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [conflicts, setConflicts] = useState([]);
  const [stats, setStats] = useState({
    totalEvents: 0,
    upcomingEvents: 0,
    conflicts: 0,
    coverageGaps: 0
  });
  const { user } = useAuth();

  async function load() {
    try {
      setIsLoading(true);
      const items = await getAll("schedule");
      
      if (!items.length) {
        const alreadySeeded = await isSeeded();
        if (!alreadySeeded) {
          console.log("🔍 Schedule store empty, but global seeding will handle this");
        }
      }
      
      setSchedule(items);
      calculateStats(items);
      detectConflicts(items);
    } catch (error) {
      console.error("Failed to load schedule:", error);
      setSchedule([]);
      setStats({ totalEvents: 0, upcomingEvents: 0, conflicts: 0, coverageGaps: 0 });
    } finally {
      setIsLoading(false);
    }
  }

  function calculateStats(items) {
    const now = Date.now();
    const oneDayFromNow = now + (24 * 60 * 60 * 1000);
    
    const totalEvents = items.length;
    const upcomingEvents = items.filter(event => {
      const eventStart = new Date(event.start || event.date).getTime();
      return eventStart > now && eventStart < oneDayFromNow;
    }).length;

    const conflictCount = conflicts.length;
    const coverageGaps = calculateCoverageGaps(items);

    setStats({
      totalEvents,
      upcomingEvents,
      conflicts: conflictCount,
      coverageGaps
    });
  }

  function detectConflicts(items) {
    const conflictsList = [];
    const peopleSchedules = {};

    // Group events by person
    items.forEach(event => {
      if (event.assigned_to || event.person_id) {
        const personId = event.assigned_to || event.person_id;
        if (!peopleSchedules[personId]) {
          peopleSchedules[personId] = [];
        }
        peopleSchedules[personId].push(event);
      }
    });

    // Check for overlapping events for each person
    Object.entries(peopleSchedules).forEach(([personId, events]) => {
      for (let i = 0; i < events.length; i++) {
        for (let j = i + 1; j < events.length; j++) {
          const event1 = events[i];
          const event2 = events[j];
          
          const start1 = new Date(event1.start || event1.date).getTime();
          const end1 = new Date(event1.end || event1.date + 3600000).getTime(); // Default 1 hour
          const start2 = new Date(event2.start || event2.date).getTime();
          const end2 = new Date(event2.end || event2.date + 3600000).getTime();

          // Check for overlap
          if ((start1 < end2 && end1 > start2)) {
            conflictsList.push({
              id: `conflict_${event1.id}_${event2.id}`,
              person_id: personId,
              event1,
              event2,
              detected_at: Date.now()
            });
          }
        }
      }
    });

    setConflicts(conflictsList);
  }

  function calculateCoverageGaps(items) {
    // Simple coverage gap calculation
    // In a real implementation, this would be more sophisticated
    const shiftEvents = items.filter(event => event.type === EVENT_TYPES.SHIFT);
    const now = Date.now();
    const tomorrow = now + (24 * 60 * 60 * 1000);
    
    const todayShifts = shiftEvents.filter(event => {
      const eventStart = new Date(event.start || event.date).getTime();
      return eventStart >= now && eventStart < tomorrow;
    });

    // If we have fewer than 2 shifts for the next 24 hours, consider it a gap
    return todayShifts.length < 2 ? 1 : 0;
  }

  async function addEvent(event) {
    try {
      const newEvent = {
        ...event,
        id: event.id || `event_${Date.now()}`,
        created_by: user?.id || "system",
        created_at: Date.now(),
        type: event.type || EVENT_TYPES.MEETING,
        status: event.status || "scheduled",
        start: event.start || event.date,
        end: event.end || (event.date ? event.date + 3600000 : Date.now() + 3600000),
        assigned_to: event.assigned_to || user?.id,
        last_modified: Date.now()
      };
      
      await setItem("schedule", newEvent);
      await load();
    } catch (error) {
      console.error("Failed to add event:", error);
      throw error;
    }
  }

  async function updateEvent(id, updates) {
    try {
      const existing = schedule.find(item => item.id === id);
      if (existing) {
        const updated = {
          ...existing,
          ...updates,
          last_modified: Date.now(),
          modified_by: user?.id || "system"
        };
        
        // Track status changes
        if (updates.status && updates.status !== existing.status) {
          updated.status_history = [
            ...(existing.status_history || []),
            {
              from: existing.status,
              to: updates.status,
              changed_at: Date.now(),
              changed_by: user?.id || "system",
              reason: updates.status_reason || ""
            }
          ];
        }
        
        await setItem("schedule", updated);
        
        // Optimistic update
        setSchedule(prev => prev.map(item => 
          item.id === id ? updated : item
        ));
        
        // Recalculate stats and conflicts
        const newSchedule = schedule.map(item => 
          item.id === id ? updated : item
        );
        calculateStats(newSchedule);
        detectConflicts(newSchedule);
      }
    } catch (error) {
      console.error("Failed to update event:", error);
      await load();
      throw error;
    }
  }

  async function removeEvent(id) {
    try {
      await delItem("schedule", id);
      await load();
    } catch (error) {
      console.error("Failed to remove event:", error);
      throw error;
    }
  }

  async function rescheduleEvent(id, newStart, newEnd) {
    try {
      const updates = {
        start: newStart,
        end: newEnd,
        rescheduled_at: Date.now(),
        rescheduled_by: user?.id || "system"
      };

      await updateEvent(id, updates);
    } catch (error) {
      console.error("Failed to reschedule event:", error);
      throw error;
    }
  }

  async function assignEvent(id, personId, reason = "") {
    try {
      const updates = {
        assigned_to: personId,
        assigned_at: Date.now(),
        assigned_by: user?.id || "system",
        assignment_reason: reason
      };

      await updateEvent(id, updates);
    } catch (error) {
      console.error("Failed to assign event:", error);
      throw error;
    }
  }

  async function markEventComplete(id, completionNotes = "") {
    try {
      const updates = {
        status: "completed",
        completed_at: Date.now(),
        completed_by: user?.id || "system",
        completion_notes: completionNotes
      };

      await updateEvent(id, updates);
    } catch (error) {
      console.error("Failed to mark event complete:", error);
      throw error;
    }
  }

  async function createRecurringEvents(eventTemplate, recurrencePattern) {
    try {
      const events = [];
      const { frequency, count, interval = 1 } = recurrencePattern;
      const baseDate = new Date(eventTemplate.start || eventTemplate.date);
      
      for (let i = 0; i < count; i++) {
        const eventDate = new Date(baseDate);
        
        switch (frequency) {
          case "daily":
            eventDate.setDate(baseDate.getDate() + (i * interval));
            break;
          case "weekly":
            eventDate.setDate(baseDate.getDate() + (i * interval * 7));
            break;
          case "monthly":
            eventDate.setMonth(baseDate.getMonth() + (i * interval));
            break;
          case "yearly":
            eventDate.setFullYear(baseDate.getFullYear() + (i * interval));
            break;
        }

        const eventEnd = new Date(eventDate.getTime() + 
          (new Date(eventTemplate.end || eventTemplate.date + 3600000).getTime() - 
           new Date(eventTemplate.start || eventTemplate.date).getTime()));

        const recurringEvent = {
          ...eventTemplate,
          id: `${eventTemplate.id || 'recurring'}_${i}`,
          start: eventDate.getTime(),
          end: eventEnd.getTime(),
          recurrence_id: eventTemplate.id || `recurring_${Date.now()}`,
          recurrence_index: i,
          created_by: user?.id || "system",
          created_at: Date.now()
        };

        events.push(recurringEvent);
        await setItem("schedule", recurringEvent);
      }

      await load();
      return events;
    } catch (error) {
      console.error("Failed to create recurring events:", error);
      throw error;
    }
  }

  async function clearAll() {
    try {
      await clearStore("schedule");
      await load();
    } catch (error) {
      console.error("Failed to clear schedule:", error);
      throw error;
    }
  }

  // Get filtered events based on various criteria
  function getFilteredEvents(filters = {}) {
    let filteredEvents = roleView;

    if (filters.type) {
      filteredEvents = filteredEvents.filter(event => event.type === filters.type);
    }

    if (filters.assigned_to) {
      filteredEvents = filteredEvents.filter(event => 
        event.assigned_to === filters.assigned_to || 
        event.person_id === filters.assigned_to
      );
    }

    if (filters.start_date && filters.end_date) {
      filteredEvents = filteredEvents.filter(event => {
        const eventStart = new Date(event.start || event.date).getTime();
        return eventStart >= filters.start_date && eventStart <= filters.end_date;
      });
    }

    if (filters.status) {
      filteredEvents = filteredEvents.filter(event => event.status === filters.status);
    }

    return filteredEvents;
  }

  // Role-based view filtering
  const roleView = useMemo(() => {
    if (!user || !schedule.length) return schedule;
    
    switch (user.role) {
      case "Manager":
      case "Dispatcher":
        return schedule; // Managers and dispatchers see all events
        
      case "SRE":
      case "Senior SRE":
      case "Automation Engineer":
        // Technical roles see their events + maintenance windows + incidents
        return schedule.filter(event => 
          event.assigned_to === user.id ||
          event.person_id === user.id ||
          event.team_id === user.teamId ||
          event.type === EVENT_TYPES.MAINTENANCE ||
          event.type === EVENT_TYPES.INCIDENT ||
          event.type === EVENT_TYPES.CHANGE_WINDOW ||
          !event.access_restricted
        );
        
      case "Support Engineer":
        // Support engineers see their shifts + team events + training
        return schedule.filter(event => 
          event.assigned_to === user.id ||
          event.person_id === user.id ||
          event.team_id === user.teamId ||
          event.type === EVENT_TYPES.SHIFT ||
          event.type === EVENT_TYPES.TRAINING ||
          !event.access_restricted
        );
        
      default:
        return schedule.filter(event => !event.access_restricted);
    }
  }, [schedule, user]);

  // Get events by type
  const getByType = useMemo(() => {
    const types = {};
    roleView.forEach(event => {
      const type = event.type || "unspecified";
      if (!types[type]) {
        types[type] = [];
      }
      types[type].push(event);
    });
    return types;
  }, [roleView]);

  // Get upcoming events
  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    const oneWeekFromNow = now + (7 * 24 * 60 * 60 * 1000);
    
    return roleView
      .filter(event => {
        const eventStart = new Date(event.start || event.date).getTime();
        return eventStart > now && eventStart < oneWeekFromNow;
      })
      .sort((a, b) => {
        const startA = new Date(a.start || a.date).getTime();
        const startB = new Date(b.start || b.date).getTime();
        return startA - startB;
      });
  }, [roleView]);

  // Get today's events
  const todayEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    return roleView.filter(event => {
      const eventStart = new Date(event.start || event.date);
      return eventStart >= today && eventStart < tomorrow;
    });
  }, [roleView]);

  // Get my events
  const myEvents = useMemo(() => {
    if (!user) return [];
    return roleView.filter(event => 
      event.assigned_to === user.id || 
      event.person_id === user.id
    );
  }, [roleView, user]);

  // Enhanced loading with retry logic
  useEffect(() => {
    let isMounted = true;
    
    const loadWithRetry = async (retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          if (isMounted) {
            await load();
            break;
          }
        } catch (error) {
          console.error(`Schedule load attempt ${i + 1} failed:`, error);
          if (i === retries - 1) {
            console.error("All schedule load attempts failed");
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    };

    loadWithRetry();

    return () => {
      isMounted = false;
    };
  }, []);

  const contextValue = {
    schedule,
    roleView,
    isLoading,
    stats,
    conflicts,
    getByType,
    upcomingEvents,
    todayEvents,
    myEvents,
    EVENT_TYPES,
    addEvent,
    updateEvent,
    removeEvent,
    rescheduleEvent,
    assignEvent,
    markEventComplete,
    createRecurringEvents,
    getFilteredEvents,
    clearAll,
    reload: load
  };

  return (
    <ScheduleContext.Provider value={contextValue}>
      {children}
    </ScheduleContext.Provider>
  );
}

export function useSchedule() {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error('useSchedule must be used within a ScheduleProvider');
  }
  return context;
}