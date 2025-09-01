import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { getAll, setItem, delItem, clearStore, isSeeded } from "../utils/db.js";
import { useAuth } from "./AuthContext.jsx";

const RosterContext = createContext();

export function RosterProvider({ children }) {
  const [roster, setRoster] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availabilityMatrix, setAvailabilityMatrix] = useState({});
  const [stats, setStats] = useState({
    total: 0,
    available: 0,
    onLeave: 0,
    onCall: 0
  });
  const { user } = useAuth();

  async function load() {
    try {
      setIsLoading(true);
      const items = await getAll("roster");
      
      if (!items.length) {
        const alreadySeeded = await isSeeded();
        if (!alreadySeeded) {
          console.log("🔍 Roster store empty, but global seeding will handle this");
        }
      }
      
      setRoster(items);
      calculateStats(items);
      buildAvailabilityMatrix(items);
    } catch (error) {
      console.error("Failed to load roster:", error);
      setRoster([]);
      setStats({ total: 0, available: 0, onLeave: 0, onCall: 0 });
    } finally {
      setIsLoading(false);
    }
  }

  function calculateStats(items) {
    const total = items.length;
    let available = 0, onLeave = 0, onCall = 0;

    items.forEach(person => {
      switch (person.status) {
        case "available":
          available++;
          break;
        case "on_leave":
          onLeave++;
          break;
        case "on_call":
          onCall++;
          break;
        default:
          available++; // Default to available
      }
    });

    setStats({ total, available, onLeave, onCall });
  }

  function buildAvailabilityMatrix(items) {
    const matrix = {};
    const now = Date.now();
    const oneWeekFromNow = now + (7 * 24 * 60 * 60 * 1000);

    items.forEach(person => {
      matrix[person.id] = {
        current_status: person.status || "available",
        upcoming_leave: person.leave_schedule?.filter(leave => 
          leave.start_date > now && leave.start_date < oneWeekFromNow
        ) || [],
        shift_pattern: person.shift_pattern || "day_shift",
        expertise: person.expertise || [],
        last_updated: person.last_updated || now
      };
    });

    setAvailabilityMatrix(matrix);
  }

  async function addPerson(person) {
    try {
      const newPerson = {
        ...person,
        id: person.id || `person_${Date.now()}`,
        added_by: user?.id || "system",
        added_at: Date.now(),
        status: person.status || "available",
        role: person.role || "Support Engineer",
        team_id: person.team_id || user?.teamId,
        shift_pattern: person.shift_pattern || "day_shift",
        expertise: person.expertise || [],
        contact_info: person.contact_info || {},
        leave_balance: person.leave_balance || 25, // Default 25 days
        last_modified: Date.now()
      };
      
      await setItem("roster", newPerson);
      await load();
    } catch (error) {
      console.error("Failed to add person to roster:", error);
      throw error;
    }
  }

  async function updatePerson(id, updates) {
    try {
      const existing = roster.find(item => item.id === id);
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
        
        await setItem("roster", updated);
        
        // Optimistic update
        setRoster(prev => prev.map(item => 
          item.id === id ? updated : item
        ));
        
        // Recalculate stats and matrix
        const newRoster = roster.map(item => 
          item.id === id ? updated : item
        );
        calculateStats(newRoster);
        buildAvailabilityMatrix(newRoster);
      }
    } catch (error) {
      console.error("Failed to update person:", error);
      await load();
      throw error;
    }
  }

  async function removePerson(id) {
    try {
      await delItem("roster", id);
      await load();
    } catch (error) {
      console.error("Failed to remove person from roster:", error);
      throw error;
    }
  }

  async function updateAvailability(id, status, reason = "", duration = null) {
    try {
      const updates = {
        status,
        status_reason: reason,
        status_updated_at: Date.now(),
        status_updated_by: user?.id || "system"
      };

      if (duration) {
        updates.status_until = Date.now() + duration;
      }

      await updatePerson(id, updates);
    } catch (error) {
      console.error("Failed to update availability:", error);
      throw error;
    }
  }

  async function scheduleLeave(id, leaveData) {
    try {
      const person = roster.find(item => item.id === id);
      if (person) {
        const leaveEntry = {
          id: `leave_${Date.now()}`,
          start_date: leaveData.start_date,
          end_date: leaveData.end_date,
          type: leaveData.type || "vacation",
          reason: leaveData.reason || "",
          approved: leaveData.approved || false,
          requested_at: Date.now(),
          requested_by: user?.id || "system"
        };

        const updates = {
          leave_schedule: [
            ...(person.leave_schedule || []),
            leaveEntry
          ],
          leave_balance: Math.max(0, (person.leave_balance || 0) - (leaveData.days || 1))
        };

        await updatePerson(id, updates);
        return leaveEntry;
      }
    } catch (error) {
      console.error("Failed to schedule leave:", error);
      throw error;
    }
  }

  async function approveLeave(personId, leaveId, approved = true, reason = "") {
    try {
      const person = roster.find(item => item.id === personId);
      if (person && person.leave_schedule) {
        const updatedLeaveSchedule = person.leave_schedule.map(leave => 
          leave.id === leaveId 
            ? {
                ...leave,
                approved,
                approved_by: user?.id || "system",
                approved_at: Date.now(),
                approval_reason: reason
              }
            : leave
        );

        await updatePerson(personId, {
          leave_schedule: updatedLeaveSchedule
        });
      }
    } catch (error) {
      console.error("Failed to approve leave:", error);
      throw error;
    }
  }

  async function assignShift(id, shiftData) {
    try {
      const person = roster.find(item => item.id === id);
      if (person) {
        const shiftEntry = {
          id: `shift_${Date.now()}`,
          start_time: shiftData.start_time,
          end_time: shiftData.end_time,
          type: shiftData.type || "regular",
          location: shiftData.location || "office",
          assigned_by: user?.id || "system",
          assigned_at: Date.now()
        };

        const updates = {
          current_shift: shiftEntry,
          shift_history: [
            ...(person.shift_history || []),
            shiftEntry
          ]
        };

        await updatePerson(id, updates);
        return shiftEntry;
      }
    } catch (error) {
      console.error("Failed to assign shift:", error);
      throw error;
    }
  }

  async function clearAll() {
    try {
      await clearStore("roster");
      await load();
    } catch (error) {
      console.error("Failed to clear roster:", error);
      throw error;
    }
  }

  // Role-based view filtering
  const roleView = useMemo(() => {
    if (!user || !roster.length) return roster;
    
    switch (user.role) {
      case "Manager":
      case "Dispatcher":
        return roster; // Managers and dispatchers see all team members
        
      case "SRE":
      case "Senior SRE":
      case "Automation Engineer":
        // Technical leads see their team + other technical roles
        return roster.filter(person => 
          person.team_id === user.teamId ||
          ["SRE", "Senior SRE", "Automation Engineer"].includes(person.role) ||
          !person.access_restricted
        );
        
      case "Support Engineer":
        // Support engineers see their team + other support engineers
        return roster.filter(person => 
          person.team_id === user.teamId ||
          person.role === "Support Engineer" ||
          !person.access_restricted
        );
        
      default:
        return roster.filter(person => !person.access_restricted);
    }
  }, [roster, user]);

  // Get roster by team
  const getByTeam = useMemo(() => {
    const teams = {};
    roleView.forEach(person => {
      const teamId = person.team_id || "unassigned";
      if (!teams[teamId]) {
        teams[teamId] = [];
      }
      teams[teamId].push(person);
    });
    return teams;
  }, [roleView]);

  // Get roster by role
  const getByRole = useMemo(() => {
    const roles = {};
    roleView.forEach(person => {
      const role = person.role || "unassigned";
      if (!roles[role]) {
        roles[role] = [];
      }
      roles[role].push(person);
    });
    return roles;
  }, [roleView]);

  // Get available people for current shift
  const availableForShift = useMemo(() => {
    const now = Date.now();
    return roleView.filter(person => {
      // Check if person is available
      if (person.status !== "available") return false;
      
      // Check if person has conflicting leave
      const hasConflictingLeave = person.leave_schedule?.some(leave => 
        leave.approved && 
        leave.start_date <= now && 
        leave.end_date >= now
      );
      
      return !hasConflictingLeave;
    });
  }, [roleView]);

  // Get people on leave
  const onLeave = useMemo(() => {
    const now = Date.now();
    return roleView.filter(person => {
      return person.leave_schedule?.some(leave => 
        leave.approved && 
        leave.start_date <= now && 
        leave.end_date >= now
      );
    });
  }, [roleView]);

  // Get pending leave requests
  const pendingLeaveRequests = useMemo(() => {
    const requests = [];
    roleView.forEach(person => {
      if (person.leave_schedule) {
        person.leave_schedule.forEach(leave => {
          if (!leave.approved && leave.start_date > Date.now()) {
            requests.push({
              ...leave,
              person_id: person.id,
              person_name: person.name,
              person_role: person.role
            });
          }
        });
      }
    });
    return requests.sort((a, b) => a.start_date - b.start_date);
  }, [roleView]);

  // Get expertise coverage
  const expertiseCoverage = useMemo(() => {
    const coverage = {};
    roleView.forEach(person => {
      if (person.expertise && person.status === "available") {
        person.expertise.forEach(skill => {
          if (!coverage[skill]) {
            coverage[skill] = [];
          }
          coverage[skill].push(person);
        });
      }
    });
    return coverage;
  }, [roleView]);

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
          console.error(`Roster load attempt ${i + 1} failed:`, error);
          if (i === retries - 1) {
            console.error("All roster load attempts failed");
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
    roster,
    roleView,
    isLoading,
    stats,
    availabilityMatrix,
    getByTeam,
    getByRole,
    availableForShift,
    onLeave,
    pendingLeaveRequests,
    expertiseCoverage,
    addPerson,
    updatePerson,
    removePerson,
    updateAvailability,
    scheduleLeave,
    approveLeave,
    assignShift,
    clearAll,
    reload: load
  };

  return (
    <RosterContext.Provider value={contextValue}>
      {children}
    </RosterContext.Provider>
  );
}

export function useRoster() {
  const context = useContext(RosterContext);
  if (!context) {
    throw new Error('useRoster must be used within a RosterProvider');
  }
  return context;
}