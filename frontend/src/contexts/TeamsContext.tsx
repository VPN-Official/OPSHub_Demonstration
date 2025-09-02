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

export type TeamType =
  | "operations"
  | "sre"
  | "development"
  | "support"
  | "security"
  | "field_service"
  | "business"
  | "other";

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
  mttr_minutes?: number;
  mtta_minutes?: number;
  workload_score?: number;      // measure of load vs capacity

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------

interface TeamsContextType {
  teams: Team[];
  addTeam: (team: Team) => void;
  updateTeam: (team: Team) => void;
  deleteTeam: (id: string) => void;
  refreshTeams: () => Promise<void>;
}

const TeamsContext = createContext<TeamsContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------

export const TeamsProvider = ({ children }: { children: ReactNode }) => {
  const [teams, setTeams] = useState<Team[]>([]);

  const refreshTeams = async () => {
    // TODO: Load from IndexedDB + sync with Postgres
  };

  const addTeam = (team: Team) => {
    setTeams((prev) => [...prev, team]);
    // TODO: Persist
  };

  const updateTeam = (team: Team) => {
    setTeams((prev) => prev.map((t) => (t.id === team.id ? team : t)));
    // TODO: Persist update
  };

  const deleteTeam = (id: string) => {
    setTeams((prev) => prev.filter((t) => t.id !== id));
    // TODO: Delete in IndexedDB + API
  };

  useEffect(() => {
    refreshTeams();
  }, []);

  return (
    <TeamsContext.Provider
      value={{ teams, addTeam, updateTeam, deleteTeam, refreshTeams }}
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