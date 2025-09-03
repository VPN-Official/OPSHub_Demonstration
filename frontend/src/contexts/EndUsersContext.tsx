// src/contexts/EndUsersContext.tsx
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
export type EndUserRole =
  | "employee"
  | "contractor"
  | "partner"
  | "customer_contact";

export type Proficiency = "beginner" | "intermediate" | "expert";

export interface EndUserSkill {
  skill_id: string;
  proficiency: Proficiency;
  certified_until?: string | null; // ISO date
}

export interface LinkedAccount {
  system: string; // e.g., "AD", "Okta", "Jira"
  account_id: string;
}

export interface EndUser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  username?: string; // e.g., SSO/AD username
  employee_id?: string | null;
  customer_id?: string | null; // FK → CustomersContext
  department?: string;
  location_id?: string | null; // FK → LocationsContext
  job_title?: string;
  role?: EndUserRole;
  is_vip?: boolean;
  tags: string[];

  // Access & Systems
  preferred_contact_method?: "email" | "phone" | "portal" | "chat";
  last_login_at?: string | null;
  active_directory_dn?: string | null;
  linked_accounts?: LinkedAccount[];

  // Relationships
  manager_user_id?: string | null;
  team_id?: string | null; // FK → TeamsContext
  skills?: EndUserSkill[];

  // Metadata
  created_at: string;
  updated_at: string;
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  tenantId?: string;
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------
interface EndUsersContextType {
  endUsers: EndUser[];
  addEndUser: (endUser: EndUser, userId?: string) => Promise<void>;
  updateEndUser: (endUser: EndUser, userId?: string) => Promise<void>;
  deleteEndUser: (id: string, userId?: string) => Promise<void>;
  refreshEndUsers: () => Promise<void>;
  getEndUser: (id: string) => Promise<EndUser | undefined>;

  // EndUser-specific operations
  updateEndUserSkills: (endUserId: string, skills: EndUserSkill[], userId?: string) => Promise<void>;
  addLinkedAccount: (endUserId: string, account: LinkedAccount, userId?: string) => Promise<void>;
  removeLinkedAccount: (endUserId: string, system: string, userId?: string) => Promise<void>;
  updateLastLogin: (endUserId: string) => Promise<void>;

  // Filtering and querying
  getEndUsersByRole: (role: EndUserRole) => EndUser[];
  getEndUsersByCustomer: (customerId: string) => EndUser[];
  getEndUsersByDepartment: (department: string) => EndUser[];
  getEndUsersByLocation: (locationId: string) => EndUser[];
  getVIPEndUsers: () => EndUser[];
  getEndUsersWithSkill: (skillId: string, minProficiency?: Proficiency) => EndUser[];
  getEndUsersNeedingCertificationRenewal: (daysAhead?: number) => EndUser[];
  getInactiveEndUsers: (daysInactive?: number) => EndUser[];

  // Config integration
  config: {
    roles: string[];
    departments: string[];
    contact_methods: string[];
    proficiency_levels: string[];
  };
}

const EndUsersContext = createContext<EndUsersContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const EndUsersProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();
  const [endUsers, setEndUsers] = useState<EndUser[]>([]);

  const config = {
    roles: globalConfig?.end_users?.roles || ["employee", "contractor", "partner", "customer_contact"],
    departments: globalConfig?.end_users?.departments || ["IT", "Finance", "Operations", "HR"],
    contact_methods: globalConfig?.end_users?.contact_methods || ["email", "phone", "portal", "chat"],
    proficiency_levels: globalConfig?.end_users?.proficiency_levels || ["beginner", "intermediate", "expert"],
  };

  const refreshEndUsers = useCallback(async () => {
    if (!tenantId) return;
    try {
      const all = await getAll<EndUser>(tenantId, "end_users");
      setEndUsers(all);
    } catch (error) {
      console.error("Failed to refresh end users:", error);
    }
  }, [tenantId]);

  const getEndUser = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    return getById<EndUser>(tenantId, "end_users", id);
  }, [tenantId]);

  const addEndUser = useCallback(async (endUser: EndUser, userId?: string) => {
    if (!tenantId) return;

    // ✅ Config validation
    if (endUser.role && !config.roles.includes(endUser.role)) {
      throw new Error(`Invalid end user role: ${endUser.role}`);
    }
    if (endUser.preferred_contact_method && !config.contact_methods.includes(endUser.preferred_contact_method)) {
      throw new Error(`Invalid contact method: ${endUser.preferred_contact_method}`);
    }

    const enrichedEndUser: EndUser = {
      ...endUser,
      created_at: endUser.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      health_status: endUser.health_status || "green",
      sync_status: "dirty",
      tenantId,
    };

    await putWithAudit(
      tenantId,
      "end_users",
      enrichedEndUser,
      userId,
      { action: "create", description: `End User "${endUser.name}" created` },
      enqueueItem
    );
    await refreshEndUsers();
  }, [tenantId, config, enqueueItem, refreshEndUsers]);

  const updateEndUser = useCallback(async (endUser: EndUser, userId?: string) => {
    if (!tenantId) return;

    // ✅ Config validation
    if (endUser.role && !config.roles.includes(endUser.role)) {
      throw new Error(`Invalid end user role: ${endUser.role}`);
    }

    const enrichedEndUser: EndUser = {
      ...endUser,
      updated_at: new Date().toISOString(),
      sync_status: "dirty",
      tenantId,
    };

    await putWithAudit(
      tenantId,
      "end_users",
      enrichedEndUser,
      userId,
      { action: "update", description: `End User "${endUser.name}" updated` },
      enqueueItem
    );
    await refreshEndUsers();
  }, [tenantId, config, enqueueItem, refreshEndUsers]);

  const deleteEndUser = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) return;

    await removeWithAudit(
      tenantId,
      "end_users",
      id,
      userId,
      { action: "delete", description: `End User ${id} deleted` },
      enqueueItem
    );
    await refreshEndUsers();
  }, [tenantId, enqueueItem, refreshEndUsers]);

  // EndUser-specific operations
  const updateEndUserSkills = useCallback(async (endUserId: string, skills: EndUserSkill[], userId?: string) => {
    const endUser = await getEndUser(endUserId);
    if (!endUser) return;

    // Validate skill proficiency levels
    for (const skill of skills) {
      if (!config.proficiency_levels.includes(skill.proficiency)) {
        throw new Error(`Invalid proficiency level: ${skill.proficiency}`);
      }
    }

    const updatedEndUser = { ...endUser, skills, updated_at: new Date().toISOString() };
    await updateEndUser(updatedEndUser, userId);
  }, [getEndUser, updateEndUser, config]);

  const addLinkedAccount = useCallback(async (endUserId: string, account: LinkedAccount, userId?: string) => {
    const endUser = await getEndUser(endUserId);
    if (!endUser) return;

    const existingAccounts = endUser.linked_accounts || [];
    const updatedAccounts = [...existingAccounts, account];
    
    const updatedEndUser = { ...endUser, linked_accounts: updatedAccounts, updated_at: new Date().toISOString() };
    await updateEndUser(updatedEndUser, userId);
  }, [getEndUser, updateEndUser]);

  const removeLinkedAccount = useCallback(async (endUserId: string, system: string, userId?: string) => {
    const endUser = await getEndUser(endUserId);
    if (!endUser) return;

    const existingAccounts = endUser.linked_accounts || [];
    const updatedAccounts = existingAccounts.filter(acc => acc.system !== system);
    
    const updatedEndUser = { ...endUser, linked_accounts: updatedAccounts, updated_at: new Date().toISOString() };
    await updateEndUser(updatedEndUser, userId);
  }, [getEndUser, updateEndUser]);

  const updateLastLogin = useCallback(async (endUserId: string) => {
    const endUser = await getEndUser(endUserId);
    if (!endUser) return;

    const updatedEndUser = { 
      ...endUser, 
      last_login_at: new Date().toISOString(), 
      updated_at: new Date().toISOString() 
    };
    await updateEndUser(updatedEndUser);
  }, [getEndUser, updateEndUser]);

  // Filtering functions
  const getEndUsersByRole = useCallback((role: EndUserRole) => {
    return endUsers.filter(u => u.role === role);
  }, [endUsers]);

  const getEndUsersByCustomer = useCallback((customerId: string) => {
    return endUsers.filter(u => u.customer_id === customerId);
  }, [endUsers]);

  const getEndUsersByDepartment = useCallback((department: string) => {
    return endUsers.filter(u => u.department === department);
  }, [endUsers]);

  const getEndUsersByLocation = useCallback((locationId: string) => {
    return endUsers.filter(u => u.location_id === locationId);
  }, [endUsers]);

  const getVIPEndUsers = useCallback(() => {
    return endUsers.filter(u => u.is_vip === true);
  }, [endUsers]);

  const getEndUsersWithSkill = useCallback((skillId: string, minProficiency?: Proficiency) => {
    return endUsers.filter(u => 
      u.skills?.some(skill => {
        if (skill.skill_id !== skillId) return false;
        if (!minProficiency) return true;
        
        const proficiencyOrder = ["beginner", "intermediate", "expert"];
        const userLevel = proficiencyOrder.indexOf(skill.proficiency);
        const minLevel = proficiencyOrder.indexOf(minProficiency);
        return userLevel >= minLevel;
      })
    );
  }, [endUsers]);

  const getEndUsersNeedingCertificationRenewal = useCallback((daysAhead: number = 30) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);
    
    return endUsers.filter(u => 
      u.skills?.some(skill => 
        skill.certified_until && new Date(skill.certified_until) <= cutoffDate
      )
    );
  }, [endUsers]);

  const getInactiveEndUsers = useCallback((daysInactive: number = 90) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);
    
    return endUsers.filter(u => 
      !u.last_login_at || new Date(u.last_login_at) < cutoffDate
    );
  }, [endUsers]);

  // Initialize
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshEndUsers();
    }
  }, [tenantId, globalConfig, refreshEndUsers]);

  return (
    <EndUsersContext.Provider
      value={{
        endUsers,
        addEndUser,
        updateEndUser,
        deleteEndUser,
        refreshEndUsers,
        getEndUser,
        updateEndUserSkills,
        addLinkedAccount,
        removeLinkedAccount,
        updateLastLogin,
        getEndUsersByRole,
        getEndUsersByCustomer,
        getEndUsersByDepartment,
        getEndUsersByLocation,
        getVIPEndUsers,
        getEndUsersWithSkill,
        getEndUsersNeedingCertificationRenewal,
        getInactiveEndUsers,
        config,
      }}
    >
      {children}
    </EndUsersContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------
export const useEndUsers = () => {
  const ctx = useContext(EndUsersContext);
  if (!ctx) throw new Error("useEndUsers must be used within EndUsersProvider");
  return ctx;
};

export const useEndUserDetails = (id: string) => {
  const { endUsers } = useEndUsers();
  return endUsers.find((u) => u.id === id) || null;
};

// Utility hooks
export const useVIPEndUsers = () => {
  const { getVIPEndUsers } = useEndUsers();
  return getVIPEndUsers();
};

export const useEndUsersByRole = (role: EndUserRole) => {
  const { getEndUsersByRole } = useEndUsers();
  return getEndUsersByRole(role);
};

export const useInactiveEndUsers = (daysInactive?: number) => {
  const { getInactiveEndUsers } = useEndUsers();
  return getInactiveEndUsers(daysInactive);
};