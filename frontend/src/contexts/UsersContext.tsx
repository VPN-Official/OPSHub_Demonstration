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

  // Metadata
  created_at: string;
  updated_at: string;
  tags: string[];
  custom_fields?: Record<string, any>;
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------

interface UsersContextType {
  users: User[];
  addUser: (user: User) => void;
  updateUser: (user: User) => void;
  deleteUser: (id: string) => void;
  refreshUsers: () => Promise<void>;
}

const UsersContext = createContext<UsersContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------

export const UsersProvider = ({ children }: { children: ReactNode }) => {
  const [users, setUsers] = useState<User[]>([]);

  const refreshUsers = async () => {
    // TODO: Load from IndexedDB + sync with Postgres
  };

  const addUser = (user: User) => {
    setUsers((prev) => [...prev, user]);
    // TODO: Persist to IndexedDB + API
  };

  const updateUser = (user: User) => {
    setUsers((prev) => prev.map((u) => (u.id === user.id ? user : u)));
    // TODO: Persist update
  };

  const deleteUser = (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    // TODO: Delete in IndexedDB + API
  };

  useEffect(() => {
    refreshUsers();
  }, []);

  return (
    <UsersContext.Provider
      value={{ users, addUser, updateUser, deleteUser, refreshUsers }}
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