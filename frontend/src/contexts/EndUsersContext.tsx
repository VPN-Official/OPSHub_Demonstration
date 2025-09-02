import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

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
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------

interface EndUsersContextType {
  endUsers: EndUser[];
  addEndUser: (endUser: EndUser) => void;
  updateEndUser: (endUser: EndUser) => void;
  deleteEndUser: (id: string) => void;
  refreshEndUsers: () => Promise<void>;
}

const EndUsersContext = createContext<EndUsersContextType | undefined>(
  undefined
);

// ---------------------------------
// 3. Provider
// ---------------------------------

export const EndUsersProvider = ({ children }: { children: ReactNode }) => {
  const [endUsers, setEndUsers] = useState<EndUser[]>([]);

  // Placeholder for sync with Postgres API + IndexedDB
  const refreshEndUsers = async () => {
    // 1. Load from IndexedDB cache
    // 2. Sync with backend API
    // 3. Merge + setEndUsers
  };

  const addEndUser = (endUser: EndUser) => {
    setEndUsers((prev) => [...prev, endUser]);
    // TODO: Persist to IndexedDB + API
  };

  const updateEndUser = (endUser: EndUser) => {
    setEndUsers((prev) =>
      prev.map((u) => (u.id === endUser.id ? endUser : u))
    );
    // TODO: Persist update
  };

  const deleteEndUser = (id: string) => {
    setEndUsers((prev) => prev.filter((u) => u.id !== id));
    // TODO: Delete in IndexedDB + API
  };

  useEffect(() => {
    refreshEndUsers();
  }, []);

  return (
    <EndUsersContext.Provider
      value={{ endUsers, addEndUser, updateEndUser, deleteEndUser, refreshEndUsers }}
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