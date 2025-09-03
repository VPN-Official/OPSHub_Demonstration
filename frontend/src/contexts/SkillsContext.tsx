// src/contexts/SkillsContext.tsx
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
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
  tenantId?: string;
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------
interface SkillsContextType {
  skills: Skill[];
  addSkill: (skill: Skill, userId?: string) => Promise<void>;
  updateSkill: (skill: Skill, userId?: string) => Promise<void>;
  deleteSkill: (id: string, userId?: string) => Promise<void>;
  refreshSkills: () => Promise<void>;
  getSkill: (id: string) => Promise<Skill | undefined>;

  // Skill-specific operations
  updateSkillCertification: (skillId: string, certificationData: Partial<Skill>, userId?: string) => Promise<void>;
  getSkillUsageStats: (skillId: string) => Promise<{
    totalUsers: number;
    beginnerCount: number;
    intermediateCount: number;
    expertCount: number;
    certifiedCount: number;
  }>;

  // Filtering and querying
  getSkillsByCategory: (category: SkillCategory) => Skill[];
  getSkillsByOwner: (ownerId: string, ownerType: 'user' | 'team') => Skill[];
  getCertificationRequiredSkills: () => Skill[];
  getSkillsExpiringCertifications: (daysAhead?: number) => Skill[];
  searchSkills: (query: string) => Skill[];

  // Config integration
  config: {
    categories: string[];
    certification_providers: string[];
    proficiency_levels: string[];
  };
}

const SkillsContext = createContext<SkillsContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const SkillsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();
  const [skills, setSkills] = useState<Skill[]>([]);

  const config = {
    categories: globalConfig?.skills?.categories || [
      "infrastructure", "application", "database", "cloud", 
      "network", "security", "process", "business", "other"
    ],
    certification_providers: globalConfig?.skills?.certification_providers || [
      "AWS", "Microsoft", "Google", "Cisco", "RedHat", "VMware", "CompTIA"
    ],
    proficiency_levels: globalConfig?.skills?.proficiency_levels || [
      "beginner", "intermediate", "expert"
    ],
  };

  const refreshSkills = useCallback(async () => {
    if (!tenantId) return;
    try {
      const all = await getAll<Skill>(tenantId, "skills");
      setSkills(all);
    } catch (error) {
      console.error("Failed to refresh skills:", error);
    }
  }, [tenantId]);

  const getSkill = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    return getById<Skill>(tenantId, "skills", id);
  }, [tenantId]);

  const addSkill = useCallback(async (skill: Skill, userId?: string) => {
    if (!tenantId) return;

    // ✅ Config validation
    if (!config.categories.includes(skill.category)) {
      throw new Error(`Invalid skill category: ${skill.category}`);
    }

    const enrichedSkill: Skill = {
      ...skill,
      created_at: skill.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      health_status: skill.health_status || "green",
      sync_status: "dirty",
      tenantId,
    };

    await putWithAudit(
      tenantId,
      "skills",
      enrichedSkill,
      userId,
      { action: "create", description: `Skill "${skill.name}" created in category "${skill.category}"` },
      enqueueItem
    );
    await refreshSkills();
  }, [tenantId, config, enqueueItem, refreshSkills]);

  const updateSkill = useCallback(async (skill: Skill, userId?: string) => {
    if (!tenantId) return;

    // ✅ Config validation
    if (!config.categories.includes(skill.category)) {
      throw new Error(`Invalid skill category: ${skill.category}`);
    }

    const enrichedSkill: Skill = {
      ...skill,
      updated_at: new Date().toISOString(),
      sync_status: "dirty",
      tenantId,
    };

    await putWithAudit(
      tenantId,
      "skills",
      enrichedSkill,
      userId,
      { action: "update", description: `Skill "${skill.name}" updated` },
      enqueueItem
    );
    await refreshSkills();
  }, [tenantId, config, enqueueItem, refreshSkills]);

  const deleteSkill = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) return;

    const skill = await getSkill(id);
    const skillName = skill?.name || id;

    await removeWithAudit(
      tenantId,
      "skills",
      id,
      userId,
      { action: "delete", description: `Skill "${skillName}" deleted` },
      enqueueItem
    );
    await refreshSkills();
  }, [tenantId, getSkill, enqueueItem, refreshSkills]);

  // Skill-specific operations
  const updateSkillCertification = useCallback(async (skillId: string, certificationData: Partial<Skill>, userId?: string) => {
    const skill = await getSkill(skillId);
    if (!skill) return;

    const updatedSkill = { 
      ...skill, 
      ...certificationData,
      updated_at: new Date().toISOString() 
    };
    await updateSkill(updatedSkill, userId);
  }, [getSkill, updateSkill]);

  const getSkillUsageStats = useCallback(async (skillId: string) => {
    // This would typically require a join with end_users/users table
    // For now, return mock data - in real implementation, this would query the database
    const mockStats = {
      totalUsers: 0,
      beginnerCount: 0,
      intermediateCount: 0,
      expertCount: 0,
      certifiedCount: 0,
    };

    // TODO: Implement actual database query to get usage statistics
    return mockStats;
  }, []);

  // Filtering functions
  const getSkillsByCategory = useCallback((category: SkillCategory) => {
    return skills.filter(s => s.category === category);
  }, [skills]);

  const getSkillsByOwner = useCallback((ownerId: string, ownerType: 'user' | 'team') => {
    if (ownerType === 'user') {
      return skills.filter(s => s.owner_user_id === ownerId);
    } else {
      return skills.filter(s => s.owner_team_id === ownerId);
    }
  }, [skills]);

  const getCertificationRequiredSkills = useCallback(() => {
    return skills.filter(s => s.requires_certification === true);
  }, [skills]);

  const getSkillsExpiringCertifications = useCallback((daysAhead: number = 30) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);
    
    return skills.filter(s => {
      if (!s.requires_certification || !s.certification_validity_months) return false;
      // This is a simplified check - in reality, you'd need to check against actual user certifications
      return true; // Placeholder logic
    });
  }, [skills]);

  const searchSkills = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return skills.filter(s => 
      s.name.toLowerCase().includes(lowerQuery) ||
      s.description?.toLowerCase().includes(lowerQuery) ||
      s.category.toLowerCase().includes(lowerQuery) ||
      s.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }, [skills]);

  // Initialize
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshSkills();
    }
  }, [tenantId, globalConfig, refreshSkills]);

  return (
    <SkillsContext.Provider
      value={{
        skills,
        addSkill,
        updateSkill,
        deleteSkill,
        refreshSkills,
        getSkill,
        updateSkillCertification,
        getSkillUsageStats,
        getSkillsByCategory,
        getSkillsByOwner,
        getCertificationRequiredSkills,
        getSkillsExpiringCertifications,
        searchSkills,
        config,
      }}
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

// Utility hooks
export const useSkillsByCategory = (category: SkillCategory) => {
  const { getSkillsByCategory } = useSkills();
  return getSkillsByCategory(category);
};

export const useCertificationRequiredSkills = () => {
  const { getCertificationRequiredSkills } = useSkills();
  return getCertificationRequiredSkills();
};

export const useSkillSearch = (query: string) => {
  const { searchSkills } = useSkills();
  return searchSkills(query);
};