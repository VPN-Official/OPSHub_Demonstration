// src/contexts/SkillsContext.tsx - Enterprise Frontend Architecture
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
  useRef,
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
// 1. Frontend State Management Types
// ---------------------------------

/**
 * Async state wrapper for all data operations
 * Provides loading, error, and staleness information for UI consumers
 */
export interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  lastFetch: string | null;
  stale: boolean;
}

/**
 * UI-focused cache configuration
 * Manages client-side data staleness and refresh behavior
 */
interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxEntries: number;
  enableOptimistic: boolean;
}

/**
 * Client-side filtering options for immediate UI responsiveness
 * Backend handles complex business filtering
 */
export interface UIFilters {
  category?: SkillCategory;
  searchQuery?: string;
  ownerId?: string;
  ownerType?: 'user' | 'team';
  requiresCertification?: boolean;
  tags?: string[];
}

/**
 * UI-focused sort options
 * Complex business sorting handled by backend
 */
export interface UISortOptions {
  field: 'name' | 'created_at' | 'updated_at' | 'category';
  direction: 'asc' | 'desc';
}

// ---------------------------------
// 2. Domain Types (from backend)
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
  name: string;
  description?: string;
  category: SkillCategory;
  created_at: string;
  updated_at: string;

  // Governance
  owner_user_id?: string | null;
  owner_team_id?: string | null;

  // Compliance (backend calculates expiration logic)
  requires_certification?: boolean;
  certification_name?: string;
  certification_validity_months?: number;

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
  tenantId?: string;

  // Backend-calculated metrics (never calculated in frontend)
  usage_stats?: {
    totalUsers: number;
    beginnerCount: number;
    intermediateCount: number;
    expertCount: number;
    certifiedCount: number;
  };
}

// ---------------------------------
// 3. Frontend Context Interface
// ---------------------------------

interface SkillsContextType {
  // Async state management
  skills: AsyncState<Skill[]>;
  
  // CRUD operations (thin API wrappers)
  addSkill: (skill: Omit<Skill, 'id' | 'created_at' | 'updated_at' | 'tenantId'>, userId?: string) => Promise<void>;
  updateSkill: (skill: Skill, userId?: string) => Promise<void>;
  deleteSkill: (id: string, userId?: string) => Promise<void>;
  refreshSkills: () => Promise<void>;
  
  // Single skill operations
  getSkill: (id: string) => Promise<AsyncState<Skill | null>>;
  
  // Client-side UI helpers (not business logic)
  searchSkills: (skills: Skill[], query: string) => Skill[];
  filterSkills: (skills: Skill[], filters: UIFilters) => Skill[];
  sortSkills: (skills: Skill[], sort: UISortOptions) => Skill[];
  
  // Configuration from backend
  config: {
    categories: string[];
    certification_providers: string[];
    proficiency_levels: string[];
  };
  
  // Cache management
  invalidateCache: () => void;
  isStale: () => boolean;
  
  // UI state helpers
  hasUnacknowledgedChanges: () => boolean;
  getPendingOperations: () => number;
}

// ---------------------------------
// 4. Context Creation
// ---------------------------------

const SkillsContext = createContext<SkillsContextType | undefined>(undefined);

// ---------------------------------
// 5. Frontend Configuration
// ---------------------------------

const CACHE_CONFIG: CacheConfig = {
  ttl: 5 * 60 * 1000, // 5 minutes
  maxEntries: 1000,
  enableOptimistic: true,
};

/**
 * Creates empty async state
 */
const createEmptyAsyncState = <T,>(initialData: T): AsyncState<T> => ({
  data: initialData,
  loading: false,
  error: null,
  lastFetch: null,
  stale: false,
});

/**
 * Creates loading async state
 */
const createLoadingState = <T,>(currentData: T): AsyncState<T> => ({
  data: currentData,
  loading: true,
  error: null,
  lastFetch: null,
  stale: false,
});

/**
 * Creates success async state
 */
const createSuccessState = <T,>(data: T, previousLastFetch?: string | null): AsyncState<T> => ({
  data,
  loading: false,
  error: null,
  lastFetch: new Date().toISOString(),
  stale: false,
});

/**
 * Creates error async state
 */
const createErrorState = <T,>(currentData: T, error: string): AsyncState<T> => ({
  data: currentData,
  loading: false,
  error,
  lastFetch: null,
  stale: true,
});

// ---------------------------------
// 6. Provider Implementation
// ---------------------------------

export const SkillsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();
  
  // State management
  const [skills, setSkills] = useState<AsyncState<Skill[]>>(
    createEmptyAsyncState([])
  );
  const [skillCache] = useState(new Map<string, { skill: Skill; timestamp: number }>());
  const pendingOperationsRef = useRef(0);
  const cleanupTimeoutRef = useRef<NodeJS.Timeout>();

  // Configuration from backend
  const config = useMemo(() => ({
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
  }), [globalConfig]);

  // ---------------------------------
  // Cache Management
  // ---------------------------------

  const isDataStale = useCallback(() => {
    if (!skills.lastFetch) return true;
    const age = Date.now() - new Date(skills.lastFetch).getTime();
    return age > CACHE_CONFIG.ttl;
  }, [skills.lastFetch]);

  const invalidateCache = useCallback(() => {
    setSkills(current => ({
      ...current,
      stale: true,
    }));
    skillCache.clear();
  }, [skillCache]);

  const cleanupExpiredCache = useCallback(() => {
    const now = Date.now();
    const expiredKeys = Array.from(skillCache.entries())
      .filter(([_, value]) => now - value.timestamp > CACHE_CONFIG.ttl)
      .map(([key]) => key);
    
    expiredKeys.forEach(key => skillCache.delete(key));
    
    if (expiredKeys.length > 0) {
      console.log(`🧹 Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }, [skillCache]);

  // ---------------------------------
  // API Operations (thin wrappers)
  // ---------------------------------

  const refreshSkills = useCallback(async () => {
    if (!tenantId) return;
    
    setSkills(current => createLoadingState(current.data));
    
    try {
      // Backend handles all business logic, filtering, sorting
      const apiSkills = await getAll<Skill>(tenantId, "skills");
      setSkills(createSuccessState(apiSkills));
      
      console.log(`✅ Refreshed ${apiSkills.length} skills from backend`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh skills';
      setSkills(current => createErrorState(current.data, errorMessage));
      console.error("❌ Skills refresh failed:", errorMessage);
    }
  }, [tenantId]);

  const getSkill = useCallback(async (id: string): Promise<AsyncState<Skill | null>> => {
    if (!tenantId) {
      return createEmptyAsyncState(null);
    }

    // Check cache first
    const cached = skillCache.get(id);
    if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.ttl) {
      return createSuccessState(cached.skill);
    }

    try {
      const skill = await getById<Skill>(tenantId, "skills", id);
      
      if (skill) {
        // Cache the result
        skillCache.set(id, { skill, timestamp: Date.now() });
        return createSuccessState(skill);
      } else {
        return createSuccessState(null);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get skill';
      return createErrorState(null, errorMessage);
    }
  }, [tenantId, skillCache]);

  const addSkill = useCallback(async (
    skillData: Omit<Skill, 'id' | 'created_at' | 'updated_at' | 'tenantId'>, 
    userId?: string
  ) => {
    if (!tenantId) return;

    // Basic UI validation only (backend does business validation)
    if (!skillData.name?.trim()) {
      throw new Error("Skill name is required");
    }

    if (!config.categories.includes(skillData.category)) {
      throw new Error(`Invalid skill category: ${skillData.category}`);
    }

    pendingOperationsRef.current++;
    
    const skillToAdd: Skill = {
      ...skillData,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      health_status: "green",
      sync_status: "dirty",
      tenantId,
    };

    // Optimistic UI update
    if (CACHE_CONFIG.enableOptimistic) {
      setSkills(current => createSuccessState([...current.data, skillToAdd], current.lastFetch));
    }

    try {
      // Backend handles all business logic and validation
      await putWithAudit(
        tenantId,
        "skills",
        skillToAdd,
        userId,
        { action: "create", description: `Skill "${skillData.name}" created` },
        enqueueItem
      );
      
      // Refresh from backend to get any server-calculated fields
      await refreshSkills();
      
      console.log(`✅ Skill "${skillData.name}" added successfully`);
    } catch (error) {
      // Rollback optimistic update on failure
      if (CACHE_CONFIG.enableOptimistic) {
        setSkills(current => createSuccessState(
          current.data.filter(s => s.id !== skillToAdd.id),
          current.lastFetch
        ));
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to add skill';
      setSkills(current => ({ ...current, error: errorMessage }));
      throw error;
    } finally {
      pendingOperationsRef.current--;
    }
  }, [tenantId, config, enqueueItem, refreshSkills]);

  const updateSkill = useCallback(async (skill: Skill, userId?: string) => {
    if (!tenantId) return;

    // Basic UI validation only
    if (!skill.name?.trim()) {
      throw new Error("Skill name is required");
    }

    if (!config.categories.includes(skill.category)) {
      throw new Error(`Invalid skill category: ${skill.category}`);
    }

    pendingOperationsRef.current++;
    
    const updatedSkill = {
      ...skill,
      updated_at: new Date().toISOString(),
      sync_status: "dirty" as const,
      tenantId,
    };

    // Optimistic UI update
    if (CACHE_CONFIG.enableOptimistic) {
      setSkills(current => createSuccessState(
        current.data.map(s => s.id === skill.id ? updatedSkill : s),
        current.lastFetch
      ));
    }

    try {
      // Backend handles all business logic
      await putWithAudit(
        tenantId,
        "skills",
        updatedSkill,
        userId,
        { action: "update", description: `Skill "${skill.name}" updated` },
        enqueueItem
      );
      
      // Update cache
      skillCache.set(skill.id, { skill: updatedSkill, timestamp: Date.now() });
      
      await refreshSkills();
      
      console.log(`✅ Skill "${skill.name}" updated successfully`);
    } catch (error) {
      // Rollback optimistic update on failure
      if (CACHE_CONFIG.enableOptimistic) {
        const original = skills.data.find(s => s.id === skill.id);
        if (original) {
          setSkills(current => createSuccessState(
            current.data.map(s => s.id === skill.id ? original : s),
            current.lastFetch
          ));
        }
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to update skill';
      setSkills(current => ({ ...current, error: errorMessage }));
      throw error;
    } finally {
      pendingOperationsRef.current--;
    }
  }, [tenantId, config, skills.data, enqueueItem, refreshSkills, skillCache]);

  const deleteSkill = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) return;

    const skillToDelete = skills.data.find(s => s.id === id);
    if (!skillToDelete) {
      throw new Error("Skill not found");
    }

    pendingOperationsRef.current++;

    // Optimistic UI update
    if (CACHE_CONFIG.enableOptimistic) {
      setSkills(current => createSuccessState(
        current.data.filter(s => s.id !== id),
        current.lastFetch
      ));
    }

    try {
      // Backend handles all business logic and cascade deletion
      await removeWithAudit(
        tenantId,
        "skills",
        id,
        userId,
        { action: "delete", description: `Skill "${skillToDelete.name}" deleted` },
        enqueueItem
      );
      
      // Remove from cache
      skillCache.delete(id);
      
      await refreshSkills();
      
      console.log(`✅ Skill "${skillToDelete.name}" deleted successfully`);
    } catch (error) {
      // Rollback optimistic update on failure
      if (CACHE_CONFIG.enableOptimistic) {
        setSkills(current => createSuccessState(
          [...current.data, skillToDelete],
          current.lastFetch
        ));
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete skill';
      setSkills(current => ({ ...current, error: errorMessage }));
      throw error;
    } finally {
      pendingOperationsRef.current--;
    }
  }, [tenantId, skills.data, enqueueItem, refreshSkills, skillCache]);

  // ---------------------------------
  // Client-side UI Helpers (not business logic)
  // ---------------------------------

  const searchSkills = useCallback((skillList: Skill[], query: string): Skill[] => {
    if (!query.trim()) return skillList;
    
    const lowerQuery = query.toLowerCase();
    return skillList.filter(skill => 
      skill.name.toLowerCase().includes(lowerQuery) ||
      skill.description?.toLowerCase().includes(lowerQuery) ||
      skill.category.toLowerCase().includes(lowerQuery) ||
      skill.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      skill.certification_name?.toLowerCase().includes(lowerQuery)
    );
  }, []);

  const filterSkills = useCallback((skillList: Skill[], filters: UIFilters): Skill[] => {
    let result = skillList;

    if (filters.category) {
      result = result.filter(skill => skill.category === filters.category);
    }

    if (filters.ownerId && filters.ownerType) {
      if (filters.ownerType === 'user') {
        result = result.filter(skill => skill.owner_user_id === filters.ownerId);
      } else {
        result = result.filter(skill => skill.owner_team_id === filters.ownerId);
      }
    }

    if (filters.requiresCertification !== undefined) {
      result = result.filter(skill => skill.requires_certification === filters.requiresCertification);
    }

    if (filters.tags && filters.tags.length > 0) {
      result = result.filter(skill => 
        filters.tags!.some(tag => skill.tags.includes(tag))
      );
    }

    if (filters.searchQuery) {
      result = searchSkills(result, filters.searchQuery);
    }

    return result;
  }, [searchSkills]);

  const sortSkills = useCallback((skillList: Skill[], sort: UISortOptions): Skill[] => {
    const sorted = [...skillList];
    
    sorted.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sort.field) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'category':
          aValue = a.category;
          bValue = b.category;
          break;
        case 'created_at':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'updated_at':
          aValue = new Date(a.updated_at).getTime();
          bValue = new Date(b.updated_at).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, []);

  // ---------------------------------
  // UI State Helpers
  // ---------------------------------

  const hasUnacknowledgedChanges = useCallback(() => {
    return skills.data.some(skill => skill.sync_status === 'dirty' || skill.sync_status === 'conflict');
  }, [skills.data]);

  const getPendingOperations = useCallback(() => {
    return pendingOperationsRef.current;
  }, []);

  // ---------------------------------
  // Effects
  // ---------------------------------

  // Initialize and refresh on tenant change
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshSkills();
    } else {
      setSkills(createEmptyAsyncState([]));
      skillCache.clear();
    }
  }, [tenantId, globalConfig, refreshSkills, skillCache]);

  // Set up periodic cache cleanup
  useEffect(() => {
    cleanupTimeoutRef.current = setInterval(cleanupExpiredCache, 60000); // Every minute
    
    return () => {
      if (cleanupTimeoutRef.current) {
        clearInterval(cleanupTimeoutRef.current);
      }
    };
  }, [cleanupExpiredCache]);

  // Memory cleanup on unmount
  useEffect(() => {
    return () => {
      skillCache.clear();
      if (cleanupTimeoutRef.current) {
        clearInterval(cleanupTimeoutRef.current);
      }
    };
  }, [skillCache]);

  // Auto-refresh when data becomes stale
  useEffect(() => {
    if (skills.stale && !skills.loading && tenantId) {
      console.log("🔄 Data is stale, auto-refreshing...");
      refreshSkills();
    }
  }, [skills.stale, skills.loading, tenantId, refreshSkills]);

  // ---------------------------------
  // Context Value
  // ---------------------------------

  const contextValue = useMemo(() => ({
    skills,
    addSkill,
    updateSkill,
    deleteSkill,
    refreshSkills,
    getSkill,
    searchSkills,
    filterSkills,
    sortSkills,
    config,
    invalidateCache,
    isStale: isDataStale,
    hasUnacknowledgedChanges,
    getPendingOperations,
  }), [
    skills,
    addSkill,
    updateSkill,
    deleteSkill,
    refreshSkills,
    getSkill,
    searchSkills,
    filterSkills,
    sortSkills,
    config,
    invalidateCache,
    isDataStale,
    hasUnacknowledgedChanges,
    getPendingOperations,
  ]);

  return (
    <SkillsContext.Provider value={contextValue}>
      {children}
    </SkillsContext.Provider>
  );
};

// ---------------------------------
// 7. Hooks
// ---------------------------------

/**
 * Main hook to access skills context
 * @throws Error if used outside SkillsProvider
 */
export const useSkills = () => {
  const context = useContext(SkillsContext);
  if (!context) {
    throw new Error("useSkills must be used within SkillsProvider");
  }
  return context;
};

/**
 * Hook for single skill details with caching
 * Returns null when skill is not found or loading
 */
export const useSkillDetails = (id: string) => {
  const { skills, getSkill } = useSkills();
  const [skillState, setSkillState] = useState<AsyncState<Skill | null>>(createEmptyAsyncState(null));

  useEffect(() => {
    if (!id) {
      setSkillState(createEmptyAsyncState(null));
      return;
    }

    // First try to find in current skills list
    const existingSkill = skills.data.find(s => s.id === id);
    if (existingSkill && !skills.loading) {
      setSkillState(createSuccessState(existingSkill));
      return;
    }

    // If not found, fetch individually
    getSkill(id).then(setSkillState);
  }, [id, skills.data, skills.loading, getSkill]);

  return skillState;
};

/**
 * Hook for filtered and sorted skills with memoization
 */
export const useFilteredSkills = (filters?: UIFilters, sort?: UISortOptions) => {
  const { skills, filterSkills, sortSkills } = useSkills();

  return useMemo(() => {
    let result = skills.data;
    
    if (filters) {
      result = filterSkills(result, filters);
    }
    
    if (sort) {
      result = sortSkills(result, sort);
    }
    
    return result;
  }, [skills.data, filters, sort, filterSkills, sortSkills]);
};

/**
 * Hook for skills by category with memoization
 */
export const useSkillsByCategory = (category: SkillCategory) => {
  const filters = useMemo(() => ({ category }), [category]);
  return useFilteredSkills(filters);
};

/**
 * Hook for certification-required skills
 */
export const useCertificationRequiredSkills = () => {
  const filters = useMemo(() => ({ requiresCertification: true }), []);
  return useFilteredSkills(filters);
};

/**
 * Hook for skill search with debouncing
 */
export const useSkillSearch = (query: string, debounceMs = 300) => {
  const { skills, searchSkills } = useSkills();
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timeout);
  }, [query, debounceMs]);

  return useMemo(() => {
    return debouncedQuery ? searchSkills(skills.data, debouncedQuery) : skills.data;
  }, [skills.data, debouncedQuery, searchSkills]);
};