// src/contexts/TeamsContext.tsx
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
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";
import { teamsApi } from "../api/teamsApi";

// ---------------------------------
// 1. Frontend State Types
// ---------------------------------
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetch: Date | null;
  stale: boolean;
}

export interface OptimisticOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  data: any;
  timestamp: Date;
}

export interface UIFilters {
  type?: string[];
  search?: string;
  manager?: string;
  businessService?: string;
  location?: string;
  timezone?: string;
  healthStatus?: string[];
  hasSkill?: string;
  availableOnly?: boolean;
  overloadedOnly?: boolean;
}

export interface CacheConfig {
  ttl: number; // milliseconds
  maxSize: number;
  enableOptimistic: boolean;
}

// ---------------------------------
// 2. Re-export Backend Types (no duplication)
// ---------------------------------
export type {
  Team,
  TeamType,
  TeamMetrics,
  TeamDetails
} from "../types/team"; // Move to shared types

// ---------------------------------
// 3. Context Interface - UI Focused
// ---------------------------------
interface TeamsContextType {
  // Core async state
  teams: AsyncState<Team[]>;
  selectedTeam: AsyncState<TeamDetails>;
  
  // UI State Management
  filters: UIFilters;
  setFilters: (filters: Partial<UIFilters>) => void;
  clearFilters: () => void;
  
  // API Operations (thin wrappers)
  actions: {
    fetchTeams: (force?: boolean) => Promise<void>;
    fetchTeam: (id: string, force?: boolean) => Promise<void>;
    createTeam: (team: Partial<Team>) => Promise<void>;
    updateTeam: (id: string, updates: Partial<Team>) => Promise<void>;
    deleteTeam: (id: string) => Promise<void>;
    
    // Team operations (delegated to backend)
    addUserToTeam: (teamId: string, userId: string) => Promise<void>;
    removeUserFromTeam: (teamId: string, userId: string) => Promise<void>;
    updateTeamSkills: (teamId: string, skills: any[]) => Promise<void>;
  };
  
  // Client-side helpers (UI performance only)
  computed: {
    filteredTeams: Team[];
    searchResults: Team[];
    teamsByType: Map<string, Team[]>;
    teamOptions: Array<{ value: string; label: string }>;
  };
  
  // Cache management
  cache: {
    invalidate: (teamId?: string) => void;
    refresh: () => Promise<void>;
    isStale: boolean;
    lastUpdate: Date | null;
  };
  
  // Optimistic UI state
  optimistic: {
    pending: OptimisticOperation[];
    rollback: (operationId: string) => void;
    clearAll: () => void;
  };
  
  // Configuration from backend
  config: {
    types: string[];
    skillLevels: string[];
    timezones: string[];
    locations: string[];
  };
}

const TeamsContext = createContext<TeamsContextType | undefined>(undefined);

// ---------------------------------
// 4. Provider Implementation
// ---------------------------------
export const TeamsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();
  const mountedRef = useRef(true);

  // Cache configuration
  const cacheConfig: CacheConfig = useMemo(() => ({
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 1000,
    enableOptimistic: true,
  }), []);

  // ---------------------------------
  // Core State
  // ---------------------------------
  const [teams, setTeams] = useState<AsyncState<Team[]>>({
    data: null,
    loading: false,
    error: null,
    lastFetch: null,
    stale: true,
  });

  const [selectedTeam, setSelectedTeam] = useState<AsyncState<TeamDetails>>({
    data: null,
    loading: false,
    error: null,
    lastFetch: null,
    stale: true,
  });

  const [filters, setFiltersState] = useState<UIFilters>({});
  const [optimisticOps, setOptimisticOps] = useState<OptimisticOperation[]>([]);

  // ---------------------------------
  // Configuration (from backend)
  // ---------------------------------
  const config = useMemo(() => ({
    types: globalConfig?.teams?.types || [],
    skillLevels: globalConfig?.teams?.skillLevels || [],
    timezones: globalConfig?.teams?.timezones || [],
    locations: globalConfig?.teams?.locations || [],
  }), [globalConfig]);

  // ---------------------------------
  // Optimistic Updates Helper
  // ---------------------------------
  const addOptimisticOp = useCallback((op: Omit<OptimisticOperation, 'timestamp'>) => {
    if (!cacheConfig.enableOptimistic) return;
    
    const operation: OptimisticOperation = {
      ...op,
      timestamp: new Date(),
    };
    
    setOptimisticOps(prev => [...prev, operation]);
    
    // Auto-cleanup after 30 seconds
    setTimeout(() => {
      setOptimisticOps(prev => prev.filter(o => o.id !== operation.id));
    }, 30000);
  }, [cacheConfig.enableOptimistic]);

  const removeOptimisticOp = useCallback((operationId: string) => {
    setOptimisticOps(prev => prev.filter(op => op.id !== operationId));
  }, []);

  // ---------------------------------
  // API Operations (thin wrappers)
  // ---------------------------------
  const fetchTeams = useCallback(async (force = false) => {
    if (!tenantId || (!force && !teams.stale && teams.data)) return;
    
    setTeams(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await teamsApi.getAll(tenantId);
      
      if (mountedRef.current) {
        setTeams({
          data,
          loading: false,
          error: null,
          lastFetch: new Date(),
          stale: false,
        });
      }
    } catch (error) {
      if (mountedRef.current) {
        setTeams(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch teams',
        }));
      }
    }
  }, [tenantId, teams.stale, teams.data]);

  const fetchTeam = useCallback(async (id: string, force = false) => {
    if (!tenantId) return;
    
    // Check if we need to fetch
    if (!force && selectedTeam.data?.id === id && !selectedTeam.stale) return;
    
    setSelectedTeam(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await teamsApi.getById(tenantId, id);
      
      if (mountedRef.current) {
        setSelectedTeam({
          data,
          loading: false,
          error: null,
          lastFetch: new Date(),
          stale: false,
        });
      }
    } catch (error) {
      if (mountedRef.current) {
        setSelectedTeam(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch team',
        }));
      }
    }
  }, [tenantId, selectedTeam.data?.id, selectedTeam.stale]);

  const createTeam = useCallback(async (team: Partial<Team>) => {
    if (!tenantId) return;
    
    const operationId = `create-${Date.now()}`;
    const optimisticTeam = { ...team, id: operationId } as Team;
    
    // Optimistic update
    addOptimisticOp({
      id: operationId,
      type: 'create',
      data: optimisticTeam,
    });
    
    try {
      // Backend handles all validation and business logic
      const createdTeam = await teamsApi.create(tenantId, team, enqueueItem);
      
      // Remove optimistic and refresh
      removeOptimisticOp(operationId);
      await fetchTeams(true);
      
    } catch (error) {
      removeOptimisticOp(operationId);
      setTeams(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to create team',
      }));
      throw error;
    }
  }, [tenantId, addOptimisticOp, removeOptimisticOp, fetchTeams, enqueueItem]);

  const updateTeam = useCallback(async (id: string, updates: Partial<Team>) => {
    if (!tenantId) return;
    
    const operationId = `update-${id}-${Date.now()}`;
    
    // Optimistic update
    addOptimisticOp({
      id: operationId,
      type: 'update',
      data: { id, ...updates },
    });
    
    try {
      // Backend handles all validation and business logic
      await teamsApi.update(tenantId, id, updates, enqueueItem);
      
      removeOptimisticOp(operationId);
      await fetchTeams(true);
      
      // Refresh selected team if it's the one being updated
      if (selectedTeam.data?.id === id) {
        await fetchTeam(id, true);
      }
      
    } catch (error) {
      removeOptimisticOp(operationId);
      setTeams(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to update team',
      }));
      throw error;
    }
  }, [tenantId, addOptimisticOp, removeOptimisticOp, fetchTeams, fetchTeam, selectedTeam.data?.id, enqueueItem]);

  const deleteTeam = useCallback(async (id: string) => {
    if (!tenantId) return;
    
    const operationId = `delete-${id}-${Date.now()}`;
    
    // Optimistic update
    addOptimisticOp({
      id: operationId,
      type: 'delete',
      data: { id },
    });
    
    try {
      // Backend handles all business logic
      await teamsApi.delete(tenantId, id, enqueueItem);
      
      removeOptimisticOp(operationId);
      await fetchTeams(true);
      
      // Clear selected team if it was deleted
      if (selectedTeam.data?.id === id) {
        setSelectedTeam({
          data: null,
          loading: false,
          error: null,
          lastFetch: null,
          stale: true,
        });
      }
      
    } catch (error) {
      removeOptimisticOp(operationId);
      setTeams(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to delete team',
      }));
      throw error;
    }
  }, [tenantId, addOptimisticOp, removeOptimisticOp, fetchTeams, fetchTeam, selectedTeam.data?.id, enqueueItem]);

  // Team operations (all business logic handled by backend)
  const addUserToTeam = useCallback(async (teamId: string, userId: string) => {
    if (!tenantId) return;
    
    try {
      // Backend handles all business logic, validation, and relationship management
      await teamsApi.addUser(tenantId, teamId, userId, enqueueItem);
      await fetchTeams(true);
      
      if (selectedTeam.data?.id === teamId) {
        await fetchTeam(teamId, true);
      }
    } catch (error) {
      setTeams(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to add user to team',
      }));
      throw error;
    }
  }, [tenantId, fetchTeams, fetchTeam, selectedTeam.data?.id, enqueueItem]);

  const removeUserFromTeam = useCallback(async (teamId: string, userId: string) => {
    if (!tenantId) return;
    
    try {
      // Backend handles all business logic
      await teamsApi.removeUser(tenantId, teamId, userId, enqueueItem);
      await fetchTeams(true);
      
      if (selectedTeam.data?.id === teamId) {
        await fetchTeam(teamId, true);
      }
    } catch (error) {
      setTeams(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to remove user from team',
      }));
      throw error;
    }
  }, [tenantId, fetchTeams, fetchTeam, selectedTeam.data?.id, enqueueItem]);

  const updateTeamSkills = useCallback(async (teamId: string, skills: any[]) => {
    if (!tenantId) return;
    
    try {
      // Backend handles validation of skill proficiency levels and business rules
      await teamsApi.updateSkills(tenantId, teamId, skills, enqueueItem);
      await fetchTeams(true);
      
      if (selectedTeam.data?.id === teamId) {
        await fetchTeam(teamId, true);
      }
    } catch (error) {
      setTeams(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to update team skills',
      }));
      throw error;
    }
  }, [tenantId, fetchTeams, fetchTeam, selectedTeam.data?.id, enqueueItem]);

  // ---------------------------------
  // UI Filters
  // ---------------------------------
  const setFilters = useCallback((newFilters: Partial<UIFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState({});
  }, []);

  // ---------------------------------
  // Client-side computed values (UI performance only)
  // ---------------------------------
  const computed = useMemo(() => {
    const teamsData = teams.data || [];
    
    // Apply optimistic operations for immediate UI feedback
    let processedTeams = [...teamsData];
    
    if (cacheConfig.enableOptimistic) {
      optimisticOps.forEach(op => {
        switch (op.type) {
          case 'create':
            processedTeams.push(op.data);
            break;
          case 'update':
            const updateIndex = processedTeams.findIndex(t => t.id === op.data.id);
            if (updateIndex !== -1) {
              processedTeams[updateIndex] = { ...processedTeams[updateIndex], ...op.data };
            }
            break;
          case 'delete':
            processedTeams = processedTeams.filter(t => t.id !== op.data.id);
            break;
        }
      });
    }

    // Simple client-side filtering for immediate UI responsiveness
    const filteredTeams = processedTeams.filter(team => {
      if (filters.type?.length && !filters.type.includes(team.type)) return false;
      if (filters.healthStatus?.length && !filters.healthStatus.includes(team.health_status)) return false;
      if (filters.manager && team.manager_user_id !== filters.manager) return false;
      if (filters.businessService && !team.business_service_ids.includes(filters.businessService)) return false;
      if (filters.location && team.office_location !== filters.location) return false;
      if (filters.timezone && team.primary_timezone !== filters.timezone) return false;
      if (filters.availableOnly && team.max_concurrent_incidents && 
          (team.current_workload || 0) >= team.max_concurrent_incidents) return false;
      if (filters.overloadedOnly && (team.capacity_utilization || 0) <= 80) return false;
      if (filters.hasSkill && !team.team_skills.some(skill => skill.skill_id === filters.hasSkill)) return false;
      
      return true;
    });

    // Simple search for UI responsiveness (not business search)
    const searchResults = filters.search 
      ? filteredTeams.filter(team => 
          team.name.toLowerCase().includes(filters.search!.toLowerCase()) ||
          team.description?.toLowerCase().includes(filters.search!.toLowerCase())
        )
      : filteredTeams;

    // Group by type for UI organization
    const teamsByType = new Map<string, Team[]>();
    filteredTeams.forEach(team => {
      const existing = teamsByType.get(team.type) || [];
      teamsByType.set(team.type, [...existing, team]);
    });

    // Simple options for UI dropdowns
    const teamOptions = processedTeams.map(team => ({
      value: team.id,
      label: team.name,
    }));

    return {
      filteredTeams: searchResults,
      searchResults,
      teamsByType,
      teamOptions,
    };
  }, [teams.data, filters, optimisticOps, cacheConfig.enableOptimistic]);

  // ---------------------------------
  // Cache Management
  // ---------------------------------
  const cache = useMemo(() => ({
    invalidate: (teamId?: string) => {
      if (teamId) {
        if (selectedTeam.data?.id === teamId) {
          setSelectedTeam(prev => ({ ...prev, stale: true }));
        }
      } else {
        setTeams(prev => ({ ...prev, stale: true }));
        setSelectedTeam(prev => ({ ...prev, stale: true }));
      }
    },
    refresh: async () => {
      await fetchTeams(true);
    },
    isStale: teams.stale || (teams.lastFetch && 
      (Date.now() - teams.lastFetch.getTime()) > cacheConfig.ttl),
    lastUpdate: teams.lastFetch,
  }), [teams.stale, teams.lastFetch, selectedTeam.data?.id, fetchTeams, cacheConfig.ttl]);

  // ---------------------------------
  // Optimistic UI Management
  // ---------------------------------
  const optimistic = useMemo(() => ({
    pending: optimisticOps,
    rollback: (operationId: string) => {
      removeOptimisticOp(operationId);
    },
    clearAll: () => {
      setOptimisticOps([]);
    },
  }), [optimisticOps, removeOptimisticOp]);

  // ---------------------------------
  // Effects
  // ---------------------------------
  
  // Initial load
  useEffect(() => {
    if (tenantId && config.types.length > 0) {
      fetchTeams();
    }
  }, [tenantId, config.types.length, fetchTeams]);

  // Cache invalidation on TTL
  useEffect(() => {
    if (!teams.lastFetch || !cacheConfig.ttl) return;
    
    const timeToStale = cacheConfig.ttl - (Date.now() - teams.lastFetch.getTime());
    
    if (timeToStale <= 0) {
      setTeams(prev => ({ ...prev, stale: true }));
      return;
    }
    
    const timeout = setTimeout(() => {
      setTeams(prev => ({ ...prev, stale: true }));
    }, timeToStale);
    
    return () => clearTimeout(timeout);
  }, [teams.lastFetch, cacheConfig.ttl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------------------------------
  // Context Value
  // ---------------------------------
  const contextValue: TeamsContextType = useMemo(() => ({
    teams,
    selectedTeam,
    filters,
    setFilters,
    clearFilters,
    actions: {
      fetchTeams,
      fetchTeam,
      createTeam,
      updateTeam,
      deleteTeam,
      addUserToTeam,
      removeUserFromTeam,
      updateTeamSkills,
    },
    computed,
    cache,
    optimistic,
    config,
  }), [
    teams,
    selectedTeam,
    filters,
    setFilters,
    clearFilters,
    fetchTeams,
    fetchTeam,
    createTeam,
    updateTeam,
    deleteTeam,
    addUserToTeam,
    removeUserFromTeam,
    updateTeamSkills,
    computed,
    cache,
    optimistic,
    config,
  ]);

  return (
    <TeamsContext.Provider value={contextValue}>
      {children}
    </TeamsContext.Provider>
  );
};

// ---------------------------------
// 5. Hooks - Performance Optimized
// ---------------------------------
export const useTeams = () => {
  const ctx = useContext(TeamsContext);
  if (!ctx) throw new Error("useTeams must be used within TeamsProvider");
  return ctx;
};

// Selective subscription hooks for performance
export const useTeamsData = () => {
  const { teams } = useTeams();
  return teams;
};

export const useTeamsActions = () => {
  const { actions } = useTeams();
  return actions;
};

export const useTeamFilters = () => {
  const { filters, setFilters, clearFilters } = useTeams();
  return { filters, setFilters, clearFilters };
};

export const useFilteredTeams = () => {
  const { computed } = useTeams();
  return computed.filteredTeams;
};

export const useTeamsByType = () => {
  const { computed } = useTeams();
  return computed.teamsByType;
};

export const useTeamOptions = () => {
  const { computed } = useTeams();
  return computed.teamOptions;
};

export const useSelectedTeam = () => {
  const { selectedTeam, actions } = useTeams();
  return {
    team: selectedTeam,
    fetchTeam: actions.fetchTeam,
  };
};

export const useTeamCache = () => {
  const { cache } = useTeams();
  return cache;
};

export const useOptimisticTeams = () => {
  const { optimistic } = useTeams();
  return optimistic;
};

// Utility hook for team details with automatic loading
export const useTeamDetails = (id: string | null) => {
  const { selectedTeam, actions } = useTeams();
  
  useEffect(() => {
    if (id && (!selectedTeam.data || selectedTeam.data.id !== id || selectedTeam.stale)) {
      actions.fetchTeam(id);
    }
  }, [id, selectedTeam.data, selectedTeam.stale, actions]);
  
  return selectedTeam.data?.id === id ? selectedTeam : {
    data: null,
    loading: false,
    error: null,
    lastFetch: null,
    stale: true,
  };
};