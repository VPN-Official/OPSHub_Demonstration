// src/contexts/OnCallContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { 
  getAll,
  getById,
  putWithAudit,
  removeWithAudit,
} from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------
export type OnCallRotationType =
  | "primary"
  | "secondary"
  | "manager"
  | "executive"
  | "custom";

export interface OnCallShift {
  id: string;
  user_id: string;             // FK → UsersContext
  team_id: string;             // FK → TeamsContext
  rotation: OnCallRotationType;
  start_at: string;            // ISO datetime
  end_at: string;              // ISO datetime
  is_active: boolean;
  timezone?: string;
  notes?: string;
  swap_requested?: boolean;
  swap_approved_by?: string | null;
  override_reason?: string;
}

export interface EscalationStep {
  delay_minutes: number;       // after how long to escalate
  notify_user_ids: string[];   // FK → UsersContext
  notify_team_ids: string[];   // FK → TeamsContext
  method: "email" | "sms" | "chat" | "phone" | "push";
  timeout_minutes?: number;
  escalation_condition?: "no_response" | "no_acknowledgment" | "no_resolution";
}

export interface EscalationPolicy {
  id: string;
  name: string;                // "Standard Incident Escalation"
  description?: string;
  steps: EscalationStep[];
  created_at: string;
  updated_at: string;
  
  // Relationships
  business_service_ids: string[];
  team_ids: string[];
  owner_user_id?: string | null;
  
  // Configuration
  enabled: boolean;
  priority_filter?: string[];  // Only escalate for these priorities
  time_restrictions?: {
    business_hours_only?: boolean;
    timezone?: string;
    excluded_dates?: string[];
  };
  
  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
  tenantId?: string;
}

export interface OnCallSchedule {
  id: string;
  team_id: string;             // FK → TeamsContext
  name: string;                // "Ops Team Weekday Rotation"
  description?: string;
  timezone: string;            // e.g., "America/New_York"
  created_at: string;
  updated_at: string;

  // Schedule configuration
  rotation_type: "daily" | "weekly" | "monthly" | "custom";
  rotation_length_hours: number;
  start_date: string;
  end_date?: string | null;
  
  // Shifts and rotations
  shifts: OnCallShift[];
  escalation_policy_ids: string[]; // FK → EscalationPolicy
  
  // Current state
  current_on_call_user_ids: string[];
  next_rotation_at?: string | null;
  
  // Notifications
  reminder_before_minutes?: number;
  handoff_notification_enabled?: boolean;
  
  // Override and swap management
  overrides: Array<{
    id: string;
    original_user_id: string;
    replacement_user_id: string;
    start_at: string;
    end_at: string;
    reason: string;
    approved_by?: string;
  }>;
  
  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
  tenantId?: string;
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------
interface OnCallContextType {
  // Schedules
  schedules: OnCallSchedule[];
  addSchedule: (schedule: OnCallSchedule, userId?: string) => Promise<void>;
  updateSchedule: (schedule: OnCallSchedule, userId?: string) => Promise<void>;
  deleteSchedule: (id: string, userId?: string) => Promise<void>;
  refreshSchedules: () => Promise<void>;
  getSchedule: (id: string) => Promise<OnCallSchedule | undefined>;

  // Escalation Policies
  escalationPolicies: EscalationPolicy[];
  addEscalationPolicy: (policy: EscalationPolicy, userId?: string) => Promise<void>;
  updateEscalationPolicy: (policy: EscalationPolicy, userId?: string) => Promise<void>;
  deleteEscalationPolicy: (id: string, userId?: string) => Promise<void>;
  refreshEscalationPolicies: () => Promise<void>;
  getEscalationPolicy: (id: string) => Promise<EscalationPolicy | undefined>;

  // On-call operations
  getCurrentOnCallUsers: (teamId?: string) => { userId: string; teamId: string; rotation: OnCallRotationType }[];
  getUpcomingRotations: (daysAhead?: number) => OnCallShift[];
  createOverride: (scheduleId: string, override: OnCallSchedule['overrides'][0], userId?: string) => Promise<void>;
  requestShiftSwap: (shiftId: string, requesterId: string, targetUserId: string, reason: string) => Promise<void>;
  approveShiftSwap: (shiftId: string, approverId: string) => Promise<void>;
  triggerEscalation: (policyId: string, incidentId: string, currentLevel?: number) => Promise<void>;

  // Filtering and querying
  getSchedulesByTeam: (teamId: string) => OnCallSchedule[];
  getSchedulesByUser: (userId: string) => OnCallSchedule[];
  getActiveSchedules: () => OnCallSchedule[];
  getPoliciesByBusinessService: (serviceId: string) => EscalationPolicy[];
  getOverdueRotations: () => OnCallShift[];

  // Config integration
  config: {
    rotation_types: string[];
    notification_methods: string[];
    timezones: string[];
    escalation_conditions: string[];
  };
}

const OnCallContext = createContext<OnCallContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const OnCallProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();
  const [schedules, setSchedules] = useState<OnCallSchedule[]>([]);
  const [escalationPolicies, setEscalationPolicies] = useState<EscalationPolicy[]>([]);

  const config = {
    rotation_types: globalConfig?.on_call?.rotation_types || ["daily", "weekly", "monthly", "custom"],
    notification_methods: globalConfig?.on_call?.notification_methods || ["email", "sms", "chat", "phone", "push"],
    timezones: globalConfig?.on_call?.timezones || ["America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Tokyo"],
    escalation_conditions: globalConfig?.on_call?.escalation_conditions || ["no_response", "no_acknowledgment", "no_resolution"],
  };

  // Schedule operations
  const refreshSchedules = useCallback(async () => {
    if (!tenantId) return;
    try {
      const all = await getAll<OnCallSchedule>(tenantId, "on_call_schedules");
      setSchedules(all);
    } catch (error) {
      console.error("Failed to refresh on-call schedules:", error);
    }
  }, [tenantId]);

  const getSchedule = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    return getById<OnCallSchedule>(tenantId, "on_call_schedules", id);
  }, [tenantId]);

  const addSchedule = useCallback(async (schedule: OnCallSchedule, userId?: string) => {
    if (!tenantId) return;

    // ✅ Config validation
    if (!config.rotation_types.includes(schedule.rotation_type)) {
      throw new Error(`Invalid rotation type: ${schedule.rotation_type}`);
    }
    if (!config.timezones.includes(schedule.timezone)) {
      throw new Error(`Invalid timezone: ${schedule.timezone}`);
    }

    const enrichedSchedule: OnCallSchedule = {
      ...schedule,
      created_at: schedule.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      health_status: schedule.health_status || "green",
      sync_status: "dirty",
      tenantId,
    };

    await putWithAudit(
      tenantId,
      "on_call_schedules",
      enrichedSchedule,
      userId,
      { action: "create", description: `On-call schedule "${schedule.name}" created` },
      enqueueItem
    );
    await refreshSchedules();
  }, [tenantId, config, enqueueItem, refreshSchedules]);

  const updateSchedule = useCallback(async (schedule: OnCallSchedule, userId?: string) => {
    if (!tenantId) return;

    const enrichedSchedule: OnCallSchedule = {
      ...schedule,
      updated_at: new Date().toISOString(),
      sync_status: "dirty",
      tenantId,
    };

    await putWithAudit(
      tenantId,
      "on_call_schedules",
      enrichedSchedule,
      userId,
      { action: "update", description: `On-call schedule "${schedule.name}" updated` },
      enqueueItem
    );
    await refreshSchedules();
  }, [tenantId, enqueueItem, refreshSchedules]);

  const deleteSchedule = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) return;

    const schedule = await getSchedule(id);
    const scheduleName = schedule?.name || id;

    await removeWithAudit(
      tenantId,
      "on_call_schedules",
      id,
      userId,
      { action: "delete", description: `On-call schedule "${scheduleName}" deleted` },
      enqueueItem
    );
    await refreshSchedules();
  }, [tenantId, getSchedule, enqueueItem, refreshSchedules]);

  // Escalation policy operations
  const refreshEscalationPolicies = useCallback(async () => {
    if (!tenantId) return;
    try {
      const all = await getAll<EscalationPolicy>(tenantId, "escalation_policies");
      setEscalationPolicies(all);
    } catch (error) {
      console.error("Failed to refresh escalation policies:", error);
    }
  }, [tenantId]);

  const getEscalationPolicy = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    return getById<EscalationPolicy>(tenantId, "escalation_policies", id);
  }, [tenantId]);

  const addEscalationPolicy = useCallback(async (policy: EscalationPolicy, userId?: string) => {
    if (!tenantId) return;

    // ✅ Validate escalation steps
    for (const step of policy.steps) {
      if (!config.notification_methods.includes(step.method)) {
        throw new Error(`Invalid notification method: ${step.method}`);
      }
    }

    const enrichedPolicy: EscalationPolicy = {
      ...policy,
      created_at: policy.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      health_status: policy.health_status || "green",
      sync_status: "dirty",
      tenantId,
    };

    await putWithAudit(
      tenantId,
      "escalation_policies",
      enrichedPolicy,
      userId,
      { action: "create", description: `Escalation policy "${policy.name}" created` },
      enqueueItem
    );
    await refreshEscalationPolicies();
  }, [tenantId, config, enqueueItem, refreshEscalationPolicies]);

  const updateEscalationPolicy = useCallback(async (policy: EscalationPolicy, userId?: string) => {
    if (!tenantId) return;

    const enrichedPolicy: EscalationPolicy = {
      ...policy,
      updated_at: new Date().toISOString(),
      sync_status: "dirty",
      tenantId,
    };

    await putWithAudit(
      tenantId,
      "escalation_policies",
      enrichedPolicy,
      userId,
      { action: "update", description: `Escalation policy "${policy.name}" updated` },
      enqueueItem
    );
    await refreshEscalationPolicies();
  }, [tenantId, enqueueItem, refreshEscalationPolicies]);

  const deleteEscalationPolicy = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) return;

    const policy = await getEscalationPolicy(id);
    const policyName = policy?.name || id;

    await removeWithAudit(
      tenantId,
      "escalation_policies",
      id,
      userId,
      { action: "delete", description: `Escalation policy "${policyName}" deleted` },
      enqueueItem
    );
    await refreshEscalationPolicies();
  }, [tenantId, getEscalationPolicy, enqueueItem, refreshEscalationPolicies]);

  // On-call business logic
  const getCurrentOnCallUsers = useCallback((teamId?: string) => {
    const now = new Date().toISOString();
    const activeUsers: { userId: string; teamId: string; rotation: OnCallRotationType }[] = [];

    const relevantSchedules = teamId 
      ? schedules.filter(s => s.team_id === teamId)
      : schedules;

    for (const schedule of relevantSchedules) {
      for (const shift of schedule.shifts) {
        if (shift.is_active && shift.start_at <= now && shift.end_at >= now) {
          activeUsers.push({
            userId: shift.user_id,
            teamId: schedule.team_id,
            rotation: shift.rotation,
          });
        }
      }
    }

    return activeUsers;
  }, [schedules]);

  const getUpcomingRotations = useCallback((daysAhead: number = 7) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);
    const cutoffISO = cutoffDate.toISOString();

    const upcomingShifts: OnCallShift[] = [];
    
    for (const schedule of schedules) {
      for (const shift of schedule.shifts) {
        if (shift.start_at <= cutoffISO && shift.start_at > new Date().toISOString()) {
          upcomingShifts.push(shift);
        }
      }
    }

    return upcomingShifts.sort((a, b) => a.start_at.localeCompare(b.start_at));
  }, [schedules]);

  const createOverride = useCallback(async (scheduleId: string, override: OnCallSchedule['overrides'][0], userId?: string) => {
    const schedule = await getSchedule(scheduleId);
    if (!schedule) return;

    const updatedOverrides = [...schedule.overrides, override];
    const updatedSchedule = { 
      ...schedule, 
      overrides: updatedOverrides, 
      updated_at: new Date().toISOString() 
    };
    
    await updateSchedule(updatedSchedule, userId);
  }, [getSchedule, updateSchedule]);

  const requestShiftSwap = useCallback(async (shiftId: string, requesterId: string, targetUserId: string, reason: string) => {
    // Find the schedule and shift
    for (const schedule of schedules) {
      const shift = schedule.shifts.find(s => s.id === shiftId);
      if (shift) {
        const updatedShift = { ...shift, swap_requested: true, notes: `Swap requested by ${requesterId}: ${reason}` };
        const updatedShifts = schedule.shifts.map(s => s.id === shiftId ? updatedShift : s);
        const updatedSchedule = { ...schedule, shifts: updatedShifts, updated_at: new Date().toISOString() };
        
        await updateSchedule(updatedSchedule, requesterId);
        break;
      }
    }
  }, [schedules, updateSchedule]);

  const approveShiftSwap = useCallback(async (shiftId: string, approverId: string) => {
    // Find and approve the swap
    for (const schedule of schedules) {
      const shift = schedule.shifts.find(s => s.id === shiftId);
      if (shift && shift.swap_requested) {
        const updatedShift = { ...shift, swap_requested: false, swap_approved_by: approverId };
        const updatedShifts = schedule.shifts.map(s => s.id === shiftId ? updatedShift : s);
        const updatedSchedule = { ...schedule, shifts: updatedShifts, updated_at: new Date().toISOString() };
        
        await updateSchedule(updatedSchedule, approverId);
        break;
      }
    }
  }, [schedules, updateSchedule]);

  const triggerEscalation = useCallback(async (policyId: string, incidentId: string, currentLevel: number = 0) => {
    const policy = await getEscalationPolicy(policyId);
    if (!policy || !policy.enabled) return;

    const step = policy.steps[currentLevel];
    if (!step) return; // No more escalation steps

    // Log escalation action
    console.log(`Escalating incident ${incidentId} using policy ${policy.name}, level ${currentLevel}`);
    
    // In a real implementation, this would:
    // 1. Send notifications to specified users/teams
    // 2. Schedule the next escalation step
    // 3. Update the incident with escalation details
    // 4. Create audit trail
  }, [getEscalationPolicy]);

  // Filtering functions
  const getSchedulesByTeam = useCallback((teamId: string) => {
    return schedules.filter(s => s.team_id === teamId);
  }, [schedules]);

  const getSchedulesByUser = useCallback((userId: string) => {
    return schedules.filter(s => 
      s.shifts.some(shift => shift.user_id === userId) ||
      s.current_on_call_user_ids.includes(userId)
    );
  }, [schedules]);

  const getActiveSchedules = useCallback(() => {
    const now = new Date().toISOString();
    return schedules.filter(s => 
      !s.end_date || s.end_date >= now
    );
  }, [schedules]);

  const getPoliciesByBusinessService = useCallback((serviceId: string) => {
    return escalationPolicies.filter(p => 
      p.business_service_ids.includes(serviceId)
    );
  }, [escalationPolicies]);

  const getOverdueRotations = useCallback(() => {
    const now = new Date().toISOString();
    const overdueShifts: OnCallShift[] = [];
    
    for (const schedule of schedules) {
      for (const shift of schedule.shifts) {
        if (shift.end_at < now && shift.is_active) {
          overdueShifts.push(shift);
        }
      }
    }
    
    return overdueShifts;
  }, [schedules]);

  // Initialize
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshSchedules();
      refreshEscalationPolicies();
    }
  }, [tenantId, globalConfig, refreshSchedules, refreshEscalationPolicies]);

  return (
    <OnCallContext.Provider
      value={{
        schedules,
        addSchedule,
        updateSchedule,
        deleteSchedule,
        refreshSchedules,
        getSchedule,
        escalationPolicies,
        addEscalationPolicy,
        updateEscalationPolicy,
        deleteEscalationPolicy,
        refreshEscalationPolicies,
        getEscalationPolicy,
        getCurrentOnCallUsers,
        getUpcomingRotations,
        createOverride,
        requestShiftSwap,
        approveShiftSwap,
        triggerEscalation,
        getSchedulesByTeam,
        getSchedulesByUser,
        getActiveSchedules,
        getPoliciesByBusinessService,
        getOverdueRotations,
        config,
      }}
    >
      {children}
    </OnCallContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------
export const useOnCall = () => {
  const ctx = useContext(OnCallContext);
  if (!ctx) throw new Error("useOnCall must be used within OnCallProvider");
  return ctx;
};

export const useOnCallScheduleDetails = (id: string) => {
  const { schedules } = useOnCall();
  return schedules.find((s) => s.id === id) || null;
};

export const useEscalationPolicyDetails = (id: string) => {
  const { escalationPolicies } = useOnCall();
  return escalationPolicies.find((p) => p.id === id) || null;
};

// Utility hooks
export const useCurrentOnCallUsers = (teamId?: string) => {
  const { getCurrentOnCallUsers } = useOnCall();
  return getCurrentOnCallUsers(teamId);
};

export const useUpcomingRotations = (daysAhead?: number) => {
  const { getUpcomingRotations } = useOnCall();
  return getUpcomingRotations(daysAhead);
};

export const useActiveSchedules = () => {
  const { getActiveSchedules } = useOnCall();
  return getActiveSchedules();
};