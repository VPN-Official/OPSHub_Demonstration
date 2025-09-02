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

export type SkillCategory =
  | "infrastructure"
  | "application"
  | "database"
  | "cloud"
  | "network"
  | "security"
  | "process"
  | "business"
  | "other";

export interface Skill {
  id: string;
  name: string;                       // "Linux Admin", "AWS Certified Architect"
  description?: string;
  category: SkillCategory;
  created_at: string;
  updated_at: string;

  // Governance
  owner_user_id?: string | null;      // FK → UsersContext (who manages the catalog entry)
  owner_team_id?: string | null;      // FK → TeamsContext

  // Compliance
  requires_certification?: boolean;
  certification_name?: string;        // e.g., "AWS Solutions Architect"
  certification_validity_months?: number;

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------

interface SkillsContextType {
  skills: Skill[];
  addSkill: (skill: Skill) => void;
  updateSkill: (skill: Skill) => void;
  deleteSkill: (id: string) => void;
  refreshSkills: () => Promise<void>;
}

const SkillsContext = createContext<SkillsContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------

export const SkillsProvider = ({ children }: { children: ReactNode }) => {
  const [skills, setSkills] = useState<Skill[]>([]);

  const refreshSkills = async () => {
    // TODO: Load from IndexedDB + sync with Postgres
  };

  const addSkill = (skill: Skill) => {
    setSkills((prev) => [...prev, skill]);
    // TODO: Persist
  };

  const updateSkill = (skill: Skill) => {
    setSkills((prev) => prev.map((s) => (s.id === skill.id ? skill : s)));
    // TODO: Persist update
  };

  const deleteSkill = (id: string) => {
    setSkills((prev) => prev.filter((s) => s.id !== id));
    // TODO: Delete in IndexedDB + API
  };

  useEffect(() => {
    refreshSkills();
  }, []);

  return (
    <SkillsContext.Provider
      value={{ skills, addSkill, updateSkill, deleteSkill, refreshSkills }}
    >
      {children}
    </SkillsContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------

export const useSkills = () => {
  const ctx = useContext(SkillsContext);
  if (!ctx) throw new Error("useSkills must be used within SkillsProvider");
  return ctx;
};

export const useSkillDetails = (id: string) => {
  const { skills } = useSkills();
  return skills.find((s) => s.id === id) || null;
};