// src/contexts/UsersContext.tsx
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
export type UserRole =
  | "operator"
  | "sre"
  | "developer"
  | "manager"
  | "director"
  | "cio"
  | "contractor"
  | "other";

export interface UserSkill {
  skill_id: string;               // FK → SkillsContext
  proficiency: "beginner" | "intermediate" | "expert";
  certified_until?: string | null; // ISO datetime for certification expiry
  certification_provider?: string;
  certification_id?: string;
}

export interface UserPreferences {
  theme?: "light" | "dark" | "auto";
  timezone?: string;
  language?: string;
  notifications?: {
    email: boolean;
    sms: boolean;
    push: boolean;
    in_app: boolean;
  };
  dashboard_layout?: Record<string, any>;
}

export interface User {
  id: string;
  username: string;
  email: string;
  phone?: string;
  full_name: string;
  role: UserRole;
  title?: string;                 // "Incident Manager", "SRE Lead"
  department?: string;
  location?: string;              // "NYC Office", "Azure Region East"

  // Relationships
  team_ids: string[];             // FK → TeamsContext
  manager_user_id?: string | null; // FK → UsersContext (self-referencing)
  skillset: UserSkill[];
  cost_center_id?: string | null;  // FK → CostCentersContext

  // Access & Auth
  active_directory_dn?: string | null;
  sso_provider?: string;          // "Okta", "AzureAD"
  is_active: boolean;
  last_login_at?: string | null;
  login_count?: number;

  // User preferences and personalization
  preferences?: UserPreferences;

  // Performance and workload
  current_incident_count?: number;
  max_concurrent_incidents?: number;
  avg_resolution_time_minutes?: number;
  escalation_count?: number;
  workload_score?: number;

  // On-call and availability
  on_call_schedule_ids: string[];
  current_on_call_status?: "available" | "on_call" | "busy" | "offline";
  availability_timezone?: string;

  // Metadata
  created_at: string;
  updated_at: string;
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
  tenantId?: string;
}

export interface UserDetails extends User {
  manager?: User;
  teams?: any[];
  direct_reports?: User[];
  cost_center?: any;
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------
interface UsersContextType {
  users: User[];
  addUser: (user: User, userId?: string) => Promise<void>;
  updateUser: (user: User, userId?: string) => Promise<void>;
  deleteUser: (id: string, userId?: string) => Promise<void>;
  refreshUsers: () => Promise<void>;
  getUser: (id: string) => Promise<User | undefined>;

  // User-specific operations
  updateUserSkills: (userId: string, skills: UserSkill[], updatedBy?: string) => Promise<void>;
  updateUserPreferences: (userId: string, preferences: UserPreferences, updatedBy?: string) => Promise<void>;
  assignUserToTeam: (userId: string, teamId: string, assignedBy?: string) => Promise<void>;
  removeUserFromTeam: (userId: string, teamId: string, removedBy?: string) => Promise<void>;
  updateUserWorkload: (userId: string, workloadData: Partial<User>, updatedBy?: string) => Promise<void>;
  setUserOnCallStatus: (userId: string, status: User['current_on_call_status'], updatedBy?: string) => Promise<void>;
  recordUserLogin: (userId: string) => Promise<void>;
  deactivateUser: (userId: string, deactivatedBy: string, reason?: string) => Promise<void>;
  reactivateUser: (userId: string, reactivatedBy: string) => Promise<void>;

  // Filtering and querying
  getUsersByRole: (role: UserRole) => User[];
  getUsersByTeam: (teamId: string) => User[];
  getUsersByManager: (managerId: string) => User[];
  getUsersByDepartment: (department: string) => User[];
  getUsersByLocation: (location: string) => User[];
  getActiveUsers: () => User[];
  getAvailableUsers: () => User[];
  getOnCallUsers: () => User[];
  getOverloadedUsers: (threshold?: number) => User[];
  getUsersWithSkill: (skillId: string, minProficiency?: string) => User[];
  getUsersWithExpiringCertifications: (daysAhead?: number) => User[];
  searchUsers: (query: string) => User[];

  // Performance and analytics
  getUserPerformanceStats: (userId: string) => {
    avgResolutionTime: number;
    totalIncidents: number;
    resolvedIncidents: number;
    successRate: number;
    escalationRate: number;
    workloadTrend: 'increasing' | 'stable' | 'decreasing';
  };

  // Config integration
  config: {
    roles: string[];
    departments: string[];
    locations: string[];
    proficiency_levels: string[];
    on_call_statuses: string[];
  };
}

const UsersContext = createContext<UsersContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const UsersProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();
  const [users, setUsers] = useState<User[]>([]);

  const config = {
    roles: globalConfig?.users?.roles || [
      "operator", "sre", "developer", "manager", "director", "cio", "contractor", "other"
    ],
    departments: globalConfig?.users?.departments || [
      "IT", "Engineering", "Operations", "Support", "Security", "Business"
    ],
    locations: globalConfig?.users?.locations || [
      "Remote", "New York", "San Francisco", "London", "Tokyo"
    ],
    proficiency_levels: globalConfig?.users?.proficiency_levels || [
      "beginner", "intermediate", "expert"
    ],
    on_call_statuses: globalConfig?.users?.on_call_statuses || [
      "available", "on_call", "busy", "offline"
    ],
  };

  const refreshUsers = useCallback(async () => {
    if (!tenantId) return;
    try {
      const all = await getAll<User>(tenantId, "users");
      setUsers(all);
    } catch (error) {
      console.error("Failed to refresh users:", error);
    }
  }, [tenantId]);

  const getUser = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    return getById<User>(tenantId, "users", id);
  }, [tenantId]);

  const addUser = useCallback(async (user: User, userId?: string) => {
    if (!tenantId) return;

    // ✅ Config validation
    if (!config.roles.includes(user.role)) {
      throw new Error(`Invalid user role: ${user.role}`);
    }
    if (user.department && !config.departments.includes(user.department)) {
      throw new Error(`Invalid department: ${user.department}`);
    }

    const enrichedUser: User = {
      ...user,
      created_at: user.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      health_status: user.health_status || "green",
      sync_status: "dirty",
      is_active: user.is_active !== undefined ? user.is_active : true,
      login_count: user.login_count || 0,
      current_incident_count: user.current_incident_count || 0,
      on_call_schedule_ids: user.on_call_schedule_ids || [],
      tenantId,
    };

    await putWithAudit(
      tenantId,
      "users",
      enrichedUser,
      userId,
      { action: "create", description: `User "${user.full_name}" created with role "${user.role}"` },
      enqueueItem
    );
    await refreshUsers();
  }, [tenantId, config, enqueueItem, refreshUsers]);

  const updateUser = useCallback(async (user: User, userId?: string) => {
    if (!tenantId) return;

    // ✅ Config validation
    if (!config.roles.includes(user.role)) {
      throw new Error(`Invalid user role: ${user.role}`);
    }

    const enrichedUser: User = {
      ...user,
      updated_at: new Date().toISOString(),
      sync_status: "dirty",
      tenantId,
    };

    await putWithAudit(
      tenantId,
      "users",
      enrichedUser,
      userId,
      { action: "update", description: `User "${user.full_name}" updated` },
      enqueueItem
    );
    await refreshUsers();
  }, [tenantId, config, enqueueItem, refreshUsers]);

  const deleteUser = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) return;

    const user = await getUser(id);
    const userName = user?.full_name || id;

    await removeWithAudit(
      tenantId,
      "users",
      id,
      userId,
      { action: "delete", description: `User "${userName}" deleted` },
      enqueueItem
    );
    await refreshUsers();
  }, [tenantId, getUser, enqueueItem, refreshUsers]);

  // User-specific operations
  const updateUserSkills = useCallback(async (userId: string, skills: UserSkill[], updatedBy?: string) => {
    const user = await getUser(userId);
    if (!user) return;

    // Validate skill proficiency levels
    for (const skill of skills) {
      if (!config.proficiency_levels.includes(skill.proficiency)) {
        throw new Error(`Invalid proficiency level: ${skill.proficiency}`);
      }
    }

    const updatedUser = { ...user, skillset: skills, updated_at: new Date().toISOString() };
    await updateUser(updatedUser, updatedBy);
  }, [getUser, updateUser, config]);

  const updateUserPreferences = useCallback(async (userId: string, preferences: UserPreferences, updatedBy?: string) => {
    const user = await getUser(userId);
    if (!user) return;

    const updatedUser = { 
      ...user, 
      preferences: { ...user.preferences, ...preferences }, 
      updated_at: new Date().toISOString() 
    };
    await updateUser(updatedUser, updatedBy);
  }, [getUser, updateUser]);

  const assignUserToTeam = useCallback(async (userId: string, teamId: string, assignedBy?: string) => {
    const user = await getUser(userId);
    if (!user) return;

    const updatedTeamIds = [...new Set([...user.team_ids, teamId])];
    const updatedUser = { 
      ...user, 
      team_ids: updatedTeamIds, 
      updated_at: new Date().toISOString() 
    };
    await updateUser(updatedUser, assignedBy);
  }, [getUser, updateUser]);

  const removeUserFromTeam = useCallback(async (userId: string, teamId: string, removedBy?: string) => {
    const user = await getUser(userId);
    if (!user) return;

    const updatedTeamIds = user.team_ids.filter(id => id !== teamId);
    const updatedUser = { 
      ...user, 
      team_ids: updatedTeamIds, 
      updated_at: new Date().toISOString() 
    };
    await updateUser(updatedUser, removedBy);
  }, [getUser, updateUser]);

  const updateUserWorkload = useCallback(async (userId: string, workloadData: Partial<User>, updatedBy?: string) => {
    const user = await getUser(userId);
    if (!user) return;

    const updatedUser = { 
      ...user, 
      ...workloadData, 
      updated_at: new Date().toISOString() 
    };
    await updateUser(updatedUser, updatedBy);
  }, [getUser, updateUser]);

  const setUserOnCallStatus = useCallback(async (userId: string, status: User['current_on_call_status'], updatedBy?: string) => {
    const user = await getUser(userId);
    if (!user) return;

    if (status && !config.on_call_statuses.includes(status)) {
      throw new Error(`Invalid on-call status: ${status}`);
    }

    const updatedUser = { 
      ...user, 
      current_on_call_status: status, 
      updated_at: new Date().toISOString() 
    };
    await updateUser(updatedUser, updatedBy);
  }, [getUser, updateUser, config]);

  const recordUserLogin = useCallback(async (userId: string) => {
    const user = await getUser(userId);
    if (!user) return;

    const updatedUser = { 
      ...user, 
      last_login_at: new Date().toISOString(),
      login_count: (user.login_count || 0) + 1,
      updated_at: new Date().toISOString() 
    };
    await updateUser(updatedUser);
  }, [getUser, updateUser]);

  const deactivateUser = useCallback(async (userId: string, deactivatedBy: string, reason?: string) => {
    const user = await getUser(userId);
    if (!user) return;

    const updatedUser = { 
      ...user, 
      is_active: false, 
      updated_at: new Date().toISOString() 
    };
    
    await putWithAudit(
      tenantId,
      "users",
      updatedUser,
      deactivatedBy,
      { action: "deactivate", description: `User "${user.full_name}" deactivated${reason ? `: ${reason}` : ''}` },
      enqueueItem
    );
    await refreshUsers();
  }, [tenantId, getUser, enqueueItem, refreshUsers]);

  const reactivateUser = useCallback(async (userId: string, reactivatedBy: string) => {
    const user = await getUser(userId);
    if (!user) return;

    const updatedUser = { 
      ...user, 
      is_active: true, 
      updated_at: new Date().toISOString() 
    };
    
    await putWithAudit(
      tenantId,
      "users",
      updatedUser,
      reactivatedBy,
      { action: "reactivate", description: `User "${user.full_name}" reactivated` },
      enqueueItem
    );
    await refreshUsers();
  }, [tenantId, getUser, enqueueItem, refreshUsers]);

  // Filtering functions
  const getUsersByRole = useCallback((role: UserRole) => {
    return users.filter(u => u.role === role);
  }, [users]);

  const getUsersByTeam = useCallback((teamId: string) => {
    return users.filter(u => u.team_ids.includes(teamId));
  }, [users]);

  const getUsersByManager = useCallback((managerId: string) => {
    return users.filter(u => u.manager_user_id === managerId);
  }, [users]);

  const getUsersByDepartment = useCallback((department: string) => {
    return users.filter(u => u.department === department);
  }, [users]);

  const getUsersByLocation = useCallback((location: string) => {
    return users.filter(u => u.location === location);
  }, [users]);

  const getActiveUsers = useCallback(() => {
    return users.filter(u => u.is_active === true);
  }, [users]);

  const getAvailableUsers = useCallback(() => {
    return users.filter(u => 
      u.is_active === true && 
      u.current_on_call_status !== 'busy' && 
      u.current_on_call_status !== 'offline'
    );
  }, [users]);

  const getOnCallUsers = useCallback(() => {
    return users.filter(u => u.current_on_call_status === 'on_call');
  }, [users]);

  const getOverloadedUsers = useCallback((threshold: number = 80) => {
    return users.filter(u => 
      (u.workload_score || 0) > threshold ||
      (u.max_concurrent_incidents && 
       u.current_incident_count && 
       u.current_incident_count >= u.max_concurrent_incidents)
    );
  }, [users]);

  const getUsersWithSkill = useCallback((skillId: string, minProficiency?: string) => {
    return users.filter(u => 
      u.skillset.some(skill => {
        if (skill.skill_id !== skillId) return false;
        if (!minProficiency) return true;
        
        const proficiencyOrder = ["beginner", "intermediate", "expert"];
        const userLevel = proficiencyOrder.indexOf(skill.proficiency);
        const minLevel = proficiencyOrder.indexOf(minProficiency);
        return userLevel >= minLevel;
      })
    );
  }, [users]);

  const getUsersWithExpiringCertifications = useCallback((daysAhead: number = 30) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);
    
    return users.filter(u => 
      u.skillset.some(skill => 
        skill.certified_until && new Date(skill.certified_until) <= cutoffDate
      )
    );
  }, [users]);

  const searchUsers = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return users.filter(u => 
      u.full_name.toLowerCase().includes(lowerQuery) ||
      u.username.toLowerCase().includes(lowerQuery) ||
      u.email.toLowerCase().includes(lowerQuery) ||
      u.title?.toLowerCase().includes(lowerQuery) ||
      u.department?.toLowerCase().includes(lowerQuery) ||
      u.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }, [users]);

  const getUserPerformanceStats = useCallback((userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) {
      return {
        avgResolutionTime: 0,
        totalIncidents: 0,
        resolvedIncidents: 0,
        successRate: 0,
        escalationRate: 0,
        workloadTrend: 'stable' as const,
      };
    }

    // Mock performance data - in real implementation, this would query incident/performance tables
    return {
      avgResolutionTime: user.avg_resolution_time_minutes || 0,
      totalIncidents: user.current_incident_count || 0,
      resolvedIncidents: Math.floor((user.current_incident_count || 0) * 0.8), // Mock 80% resolution rate
      successRate: 0.8, // Mock success rate
      escalationRate: (user.escalation_count || 0) / Math.max(1, user.current_incident_count || 1),
      workloadTrend: (user.workload_score || 0) > 70 ? 'increasing' as const : 'stable' as const,
    };
  }, [users]);

  // Initialize
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshUsers();
    }
  }, [tenantId, globalConfig, refreshUsers]);

  return (
    <UsersContext.Provider
      value={{
        users,
        addUser,
        updateUser,
        deleteUser,
        refreshUsers,
        getUser,
        updateUserSkills,
        updateUserPreferences,
        assignUserToTeam,
        removeUserFromTeam,
        updateUserWorkload,
        setUserOnCallStatus,
        recordUserLogin,
        deactivateUser,
        reactivateUser,
        getUsersByRole,
        getUsersByTeam,
        getUsersByManager,
        getUsersByDepartment,
        getUsersByLocation,
        getActiveUsers,
        getAvailableUsers,
        getOnCallUsers,
        getOverloadedUsers,
        getUsersWithSkill,
        getUsersWithExpiringCertifications,
        searchUsers,
        getUserPerformanceStats,
        config,
      }}
    >
      {children}
    </UsersContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------
export const useUsers = () => {
  const ctx = useContext(UsersContext);
  if (!ctx) throw new Error("useUsers must be used within UsersProvider");
  return ctx;
};

export const useUserDetails = (id: string) => {
  const { users } = useUsers();
  return users.find((u) => u.id === id) || null;
};

// Utility hooks
export const useUsersByRole = (role: UserRole) => {
  const { getUsersByRole } = useUsers();
  return getUsersByRole(role);
};

export const useActiveUsers = () => {
  const { getActiveUsers } = useUsers();
  return getActiveUsers();
};

export const useAvailableUsers = () => {
  const { getAvailableUsers } = useUsers();
  return getAvailableUsers();
};

export const useOnCallUsers = () => {
  const { getOnCallUsers } = useUsers();
  return getOnCallUsers();
};

export const useOverloadedUsers = (threshold?: number) => {
  const { getOverloadedUsers } = useUsers();
  return getOverloadedUsers(threshold);
};

export const useUserPerformance = (userId: string) => {
  const { getUserPerformanceStats } = useUsers();
  return getUserPerformanceStats(userId);
};

export const useUserSearch = (query: string) => {
  const { searchUsers } = useUsers();
  return searchUsers(query);
};