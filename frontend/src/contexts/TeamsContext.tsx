// src/contexts/TeamsContext.tsx
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
export type TeamType =
  | "operations"
  | "sre"
  | "development"
  | "support"
  | "security"
  | "field_service"
  | "business"
  | "other";

export interface TeamMetrics {
  mttr_minutes?: number;
  mtta_minutes?: number;
  workload_score?: number;      // measure of load vs capacity
  incidents_assigned: number;
  incidents_resolved: number;
  success_rate: number;
  avg_resolution_time: number;
}

export interface Team {
  id: string;
  name: string;                 // "Payments Ops", "Cloud SRE Team"
  description?: string;
  type: TeamType;
  created_at: string;
  updated_at: string;

  // Relationships
  user_ids: string[];           // FK → UsersContext
  manager_user_id?: string | null; // FK → UsersContext
  business_service_ids: string[];  // FK → BusinessServicesContext
  cost_center_id?: string | null;  // FK → CostCentersContext

  // OnCall / Escalation
  escalation_policies?: string[];  // FK → OnCallContext (future)
  oncall_schedule_id?: string | null; // FK → OnCallContext

  // Performance Metrics
  metrics: TeamMetrics;

  // Capacity and workload
  max_concurrent_incidents?: number;
  current_workload?: number;
  capacity_utilization?: number;

  // Skills and capabilities
  team_skills: Array<{
    skill_id: string;
    team_proficiency: "basic" | "intermediate" | "advanced" | "expert";
    certified_members: number;
    total_members: number;
  }>;

  // Location and timezone
  primary_timezone?: string;
  office_location?: string;
  remote_friendly?: boolean;

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
  tenantId?: string;
}

export interface TeamDetails extends Team {
  manager?: any;
  users?: any[];
  business_services?: any[];
  cost_center?: any;
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------
interface TeamsContextType {
  teams: Team[];
  addTeam: (team: Team, userId?: string) => Promise<void>;
  updateTeam: (team: Team, userId?: string) => Promise<void>;
  deleteTeam: (id: string, userId?: string) => Promise<void>;
  refreshTeams: () => Promise<void>;
  getTeam: (id: string) => Promise<Team | undefined>;

  // Team-specific operations
  addUserToTeam: (teamId: string, userId: string, addedBy?: string) => Promise<void>;
  removeUserFromTeam: (teamId: string, userId: string, removedBy?: string) => Promise<void>;
  updateTeamMetrics: (teamId: string, metrics: Partial<TeamMetrics>, userId?: string) => Promise<void>;
  assignIncidentToTeam: (teamId: string, incidentId: string, assignedBy?: string) => Promise<void>;
  updateTeamSkills: (teamId: string, skills: Team['team_skills'], userId?: string) => Promise<void>;

  // Filtering and querying
  getTeamsByType: (type: TeamType) => Team[];
  getTeamsByBusinessService: (serviceId: string) => Team[];
  getTeamsByManager: (managerId: string) => Team[];
  getAvailableTeams: () => Team[];
  getOverloadedTeams: (threshold?: number) => Team[];
  getTeamsWithSkill: (skillId: string, minProficiency?: string) => Team[];
  getTeamsByLocation: (location: string) => Team[];
  getTeamsInTimezone: (timezone: string) => Team[];

  // Performance and analytics
  getTeamPerformanceStats: (teamId: string) => {
    mttr: number;
    mtta: number;
    incidentsThisMonth: number;
    resolvedThisMonth: number;
    successRate: number;
    workloadTrend: 'increasing' | 'stable' | 'decreasing';
  };

  // Config integration
  config: {
    types: string[];
    skill_proficiency_levels: string[];
    timezones: string[];
    locations: string[];
  };
}

const TeamsContext = createContext<TeamsContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const TeamsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();
  const [teams, setTeams] = useState<Team[]>([]);

  const config = {
    types: globalConfig?.teams?.types || [
      "operations", "sre", "development", "support", "security", "field_service", "business", "other"
    ],
    skill_proficiency_levels: globalConfig?.teams?.skill_proficiency_levels || [
      "basic", "intermediate", "advanced", "expert"
    ],
    timezones: globalConfig?.teams?.timezones || [
      "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Tokyo"
    ],
    locations: globalConfig?.teams?.locations || [
      "Remote", "New York", "San Francisco", "London", "Tokyo"
    ],
  };

  const refreshTeams = useCallback(async () => {
    if (!tenantId) return;
    try {
      const all = await getAll<Team>(tenantId, "teams");
      setTeams(all);
    } catch (error) {
      console.error("Failed to refresh teams:", error);
    }
  }, [tenantId]);

  const getTeam = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    return getById<Team>(tenantId, "teams", id);
  }, [tenantId]);

  const addTeam = useCallback(async (team: Team, userId?: string) => {
    if (!tenantId) return;

    // ✅ Config validation
    if (!config.types.includes(team.type)) {
      throw new Error(`Invalid team type: ${team.type}`);
    }

    const enrichedTeam: Team = {
      ...team,
      created_at: team.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      health_status: team.health_status || "green",
      sync_status: "dirty",
      metrics: team.metrics || {
        incidents_assigned: 0,
        incidents_resolved: 0,
        success_rate: 0,
        avg_resolution_time: 0,
      },
      tenantId,
    };

    await putWithAudit(
      tenantId,
      "teams",
      enrichedTeam,
      userId,
      { action: "create", description: `Team "${team.name}" created with type "${team.type}"` },
      enqueueItem
    );
    await refreshTeams();
  }, [tenantId, config, enqueueItem, refreshTeams]);

  const updateTeam = useCallback(async (team: Team, userId?: string) => {
    if (!tenantId) return;

    // ✅ Config validation
    if (!config.types.includes(team.type)) {
      throw new Error(`Invalid team type: ${team.type}`);
    }

    const enrichedTeam: Team = {
      ...team,
      updated_at: new Date().toISOString(),
      sync_status: "dirty",
      tenantId,
    };

    await putWithAudit(
      tenantId,
      "teams",
      enrichedTeam,
      userId,
      { action: "update", description: `Team "${team.name}" updated` },
      enqueueItem
    );
    await refreshTeams();
  }, [tenantId, config, enqueueItem, refreshTeams]);

  const deleteTeam = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) return;

    const team = await getTeam(id);
    const teamName = team?.name || id;

    await removeWithAudit(
      tenantId,
      "teams",
      id,
      userId,
      { action: "delete", description: `Team "${teamName}" deleted` },
      enqueueItem
    );
    await refreshTeams();
  }, [tenantId, getTeam, enqueueItem, refreshTeams]);

  // Team-specific operations
  const addUserToTeam = useCallback(async (teamId: string, userId: string, addedBy?: string) => {
    const team = await getTeam(teamId);
    if (!team) return;

    const updatedUserIds = [...new Set([...team.user_ids, userId])];
    const updatedTeam = { 
      ...team, 
      user_ids: updatedUserIds, 
      updated_at: new Date().toISOString() 
    };
    
    await updateTeam(updatedTeam, addedBy);
  }, [getTeam, updateTeam]);

  const removeUserFromTeam = useCallback(async (teamId: string, userId: string, removedBy?: string) => {
    const team = await getTeam(teamId);
    if (!team) return;

    const updatedUserIds = team.user_ids.filter(id => id !== userId);
    const updatedTeam = { 
      ...team, 
      user_ids: updatedUserIds, 
      updated_at: new Date().toISOString() 
    };
    
    await updateTeam(updatedTeam, removedBy);
  }, [getTeam, updateTeam]);

  const updateTeamMetrics = useCallback(async (teamId: string, metrics: Partial<TeamMetrics>, userId?: string) => {
    const team = await getTeam(teamId);
    if (!team) return;

    const updatedMetrics = { ...team.metrics, ...metrics };
    const updatedTeam = { 
      ...team, 
      metrics: updatedMetrics, 
      updated_at: new Date().toISOString() 
    };
    
    await updateTeam(updatedTeam, userId);
  }, [getTeam, updateTeam]);

  const assignIncidentToTeam = useCallback(async (teamId: string, incidentId: string, assignedBy?: string) => {
    const team = await getTeam(teamId);
    if (!team) return;

    // Update team metrics
    const updatedMetrics = { 
      ...team.metrics, 
      incidents_assigned: team.metrics.incidents_assigned + 1 
    };
    
    const updatedTeam = { 
      ...team, 
      metrics: updatedMetrics, 
      updated_at: new Date().toISOString() 
    };
    
    await updateTeam(updatedTeam, assignedBy);
  }, [getTeam, updateTeam]);

  const updateTeamSkills = useCallback(async (teamId: string, skills: Team['team_skills'], userId?: string) => {
    const team = await getTeam(teamId);
    if (!team) return;

    // Validate skill proficiency levels
    for (const skill of skills) {
      if (!config.skill_proficiency_levels.includes(skill.team_proficiency)) {
        throw new Error(`Invalid skill proficiency level: ${skill.team_proficiency}`);
      }
    }

    const updatedTeam = { 
      ...team, 
      team_skills: skills, 
      updated_at: new Date().toISOString() 
    };
    
    await updateTeam(updatedTeam, userId);
  }, [getTeam, updateTeam, config]);

  // Filtering functions
  const getTeamsByType = useCallback((type: TeamType) => {
    return teams.filter(t => t.type === type);
  }, [teams]);

  const getTeamsByBusinessService = useCallback((serviceId: string) => {
    return teams.filter(t => t.business_service_ids.includes(serviceId));
  }, [teams]);

  const getTeamsByManager = useCallback((managerId: string) => {
    return teams.filter(t => t.manager_user_id === managerId);
  }, [teams]);

  const getAvailableTeams = useCallback(() => {
    return teams.filter(t => 
      !t.max_concurrent_incidents || 
      (t.current_workload || 0) < t.max_concurrent_incidents
    );
  }, [teams]);

  const getOverloadedTeams = useCallback((threshold: number = 80) => {
    return teams.filter(t => 
      (t.capacity_utilization || 0) > threshold
    );
  }, [teams]);

  const getTeamsWithSkill = useCallback((skillId: string, minProficiency?: string) => {
    return teams.filter(t => 
      t.team_skills.some(skill => {
        if (skill.skill_id !== skillId) return false;
        if (!minProficiency) return true;
        
        const proficiencyOrder = ["basic", "intermediate", "advanced", "expert"];
        const teamLevel = proficiencyOrder.indexOf(skill.team_proficiency);
        const minLevel = proficiencyOrder.indexOf(minProficiency);
        return teamLevel >= minLevel;
      })
    );
  }, [teams]);

  const getTeamsByLocation = useCallback((location: string) => {
    return teams.filter(t => t.office_location === location);
  }, [teams]);

  const getTeamsInTimezone = useCallback((timezone: string) => {
    return teams.filter(t => t.primary_timezone === timezone);
  }, [teams]);

  const getTeamPerformanceStats = useCallback((teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) {
      return {
        mttr: 0,
        mtta: 0,
        incidentsThisMonth: 0,
        resolvedThisMonth: 0,
        successRate: 0,
        workloadTrend: 'stable' as const,
      };
    }

    return {
      mttr: team.metrics.mttr_minutes || 0,
      mtta: team.metrics.mtta_minutes || 0,
      incidentsThisMonth: team.metrics.incidents_assigned,
      resolvedThisMonth: team.metrics.incidents_resolved,
      successRate: team.metrics.success_rate,
      workloadTrend: (team.capacity_utilization || 0) > 80 ? 'increasing' as const : 'stable' as const,
    };
  }, [teams]);

  // Initialize
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshTeams();
    }
  }, [tenantId, globalConfig, refreshTeams]);

  return (
    <TeamsContext.Provider
      value={{
        teams,
        addTeam,
        updateTeam,
        deleteTeam,
        refreshTeams,
        getTeam,
        addUserToTeam,
        removeUserFromTeam,
        updateTeamMetrics,
        assignIncidentToTeam,
        updateTeamSkills,
        getTeamsByType,
        getTeamsByBusinessService,
        getTeamsByManager,
        getAvailableTeams,
        getOverloadedTeams,
        getTeamsWithSkill,
        getTeamsByLocation,
        getTeamsInTimezone,
        getTeamPerformanceStats,
        config,
      }}
    >
      {children}
    </TeamsContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------
export const useTeams = () => {
  const ctx = useContext(TeamsContext);
  if (!ctx) throw new Error("useTeams must be used within TeamsProvider");
  return ctx;
};

export const useTeamDetails = (id: string) => {
  const { teams } = useTeams();
  return teams.find((t) => t.id === id) || null;
};

// Utility hooks
export const useTeamsByType = (type: TeamType) => {
  const { getTeamsByType } = useTeams();
  return getTeamsByType(type);
};

export const useAvailableTeams = () => {
  const { getAvailableTeams } = useTeams();
  return getAvailableTeams();
};

export const useOverloadedTeams = (threshold?: number) => {
  const { getOverloadedTeams } = useTeams();
  return getOverloadedTeams(threshold);
};

export const useTeamPerformance = (teamId: string) => {
  const { getTeamPerformanceStats } = useTeams();
  return getTeamPerformanceStats(teamId);
};