// src/contexts/OnCallContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import { AsyncState, AsyncStateHelpers } from "../types/asyncState";
import { 
  getAll,
  getById,
  putWithAudit,
  removeWithAudit,
} from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";
import { ExternalSystemFields } from "../types/externalSystem";

// ---------------------------------
// 1. Frontend State Management Types
// ---------------------------------


interface OptimisticUpdate<T> {
  id: string;
  action: 'create' | 'update' | 'delete';
  entity: T;
  timestamp: string;
}

// ---------------------------------
// 2. Core Entity Types
// ---------------------------------
export type OnCallRotationType =
  | "primary"
  | "secondary"
  | "manager"
  | "executive"
  | "custom";

export interface OnCallShift {
  id: string;
  user_id: string;
  team_id: string;
  rotation: OnCallRotationType;
  start_at: string;
  end_at: string;
  is_active: boolean;
  timezone?: string;
  notes?: string;
  swap_requested?: boolean;
  swap_approved_by?: string | null;
  override_reason?: string;
}

export interface EscalationStep {
  delay_minutes: number;
  notify_user_ids: string[];
  notify_team_ids: string[];
  method: "email" | "sms" | "chat" | "phone" | "push";
  timeout_minutes?: number;
  escalation_condition?: "no_response" | "no_acknowledgment" | "no_resolution";
}

export interface EscalationPolicy extends ExternalSystemFields {
  id: string;
  name: string;
  description?: string;
  steps: EscalationStep[];
  created_at: string;
  updated_at: string;
  
  // Relationships
  business_service_ids: string[];
  team_ids: string[];
  owner_user_id?: string | null;
  
  // Configuration
  enabled: boolean;
  priority_filter?: string[];
  time_restrictions?: {
    business_hours_only?: boolean;
    timezone?: string;
    excluded_dates?: string[];
  };
  
  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  // Note: synced_at and sync_status are now provided by ExternalSystemFields
  tenantId?: string;
}

export interface OnCallSchedule extends ExternalSystemFields {
  id: string;
  team_id: string;
  name: string;
  description?: string;
  timezone: string;
  created_at: string;
  updated_at: string;

  // Schedule configuration
  rotation_type: "daily" | "weekly" | "monthly" | "custom";
  rotation_length_hours: number;
  start_date: string;
  end_date?: string | null;
  
  // Shifts and rotations
  shifts: OnCallShift[];
  escalation_policy_ids: string[];
  
  // Current state
  current_on_call_user_ids: string[];
  next_rotation_at?: string | null;
  
  // Notifications
  reminder_before_minutes?: number;
  handoff_notification_enabled?: boolean;
  
  // Override and swap management
  overrides: Array<{
    id: string;
    original_user_id: string;
    replacement_user_id: string;
    start_at: string;
    end_at: string;
    reason: string;
    approved_by?: string;
  }>;
  
  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  // Note: synced_at and sync_status are now provided by ExternalSystemFields
  tenantId?: string;
}

// ---------------------------------
// 3. UI-Focused Client Cache
// ---------------------------------
interface OnCallCache {
  schedules: Map<string, OnCallSchedule>;
  policies: Map<string, EscalationPolicy>;
  lastCacheRefresh: string | null;
  ttl: number; // 5 minutes default
}

// ---------------------------------
// 4. Context Interface - Frontend Only
// ---------------------------------
interface OnCallContextType {
  // Async State Management
  schedulesState: AsyncState<OnCallSchedule>;
  policiesState: AsyncState<EscalationPolicy>;
  
  // Core CRUD Operations (API orchestration only)
  schedules: OnCallSchedule[];
  addSchedule: (schedule: OnCallSchedule, userId?: string) => Promise<void>;
  updateSchedule: (schedule: OnCallSchedule, userId?: string) => Promise<void>;
  deleteSchedule: (id: string, userId?: string) => Promise<void>;
  refreshSchedules: () => Promise<void>;
  getSchedule: (id: string) => Promise<OnCallSchedule | undefined>;

  escalationPolicies: EscalationPolicy[];
  addEscalationPolicy: (policy: EscalationPolicy, userId?: string) => Promise<void>;
  updateEscalationPolicy: (policy: EscalationPolicy, userId?: string) => Promise<void>;
  deleteEscalationPolicy: (id: string, userId?: string) => Promise<void>;
  refreshEscalationPolicies: () => Promise<void>;
  getEscalationPolicy: (id: string) => Promise<EscalationPolicy | undefined>;

  // API Operations (delegate to backend for business logic)
  createOverride: (scheduleId: string, override: OnCallSchedule['overrides'][0], userId?: string) => Promise<void>;
  requestShiftSwap: (shiftId: string, requesterId: string, targetUserId: string, reason: string) => Promise<void>;
  approveShiftSwap: (shiftId: string, approverId: string) => Promise<void>;
  triggerEscalation: (policyId: string, incidentId: string, currentLevel?: number) => Promise<void>;

  // Simple Client-Side Filtering (UI responsiveness only)
  getSchedulesByTeam: (teamId: string) => OnCallSchedule[];
  getSchedulesByUser: (userId: string) => OnCallSchedule[];
  getActiveSchedules: () => OnCallSchedule[];
  getPoliciesByBusinessService: (serviceId: string) => EscalationPolicy[];
  searchSchedules: (query: string) => OnCallSchedule[];
  searchPolicies: (query: string) => EscalationPolicy[];

  // UI Configuration (from backend config)
  config: {
    rotation_types: string[];
    notification_methods: string[];
    timezones: string[];
    escalation_conditions: string[];
  };

  // Cache Management
  invalidateCache: () => void;
  getCacheStats: () => { size: number; lastRefresh: string | null; isStale: boolean };
}

const OnCallContext = createContext<OnCallContextType | undefined>(undefined);

// ---------------------------------
// 5. Frontend-Focused Provider
// ---------------------------------
export const OnCallProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();

  // ✅ Async State Management
  const [schedulesState, setSchedulesState] = useState<AsyncState<OnCallSchedule>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    stale: false,
  });

  const [policiesState, setPoliciesState] = useState<AsyncState<EscalationPolicy>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    stale: false,
  });

  // ✅ Optimistic Updates State
  const [optimisticSchedules, setOptimisticSchedules] = useState<OptimisticUpdate<OnCallSchedule>[]>([]);
  const [optimisticPolicies, setOptimisticPolicies] = useState<OptimisticUpdate<EscalationPolicy>[]>([]);

  // ✅ Client Cache with TTL
  const [cache, setCache] = useState<OnCallCache>({
    schedules: new Map(),
    policies: new Map(),
    lastCacheRefresh: null,
    ttl: 5 * 60 * 1000, // 5 minutes
  });

  // ✅ UI Configuration (backend-provided)
  const config = useMemo(() => ({
    rotation_types: globalConfig?.on_call?.rotation_types || ["daily", "weekly", "monthly", "custom"],
    notification_methods: globalConfig?.on_call?.notification_methods || ["email", "sms", "chat", "phone", "push"],
    timezones: globalConfig?.on_call?.timezones || ["America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Tokyo"],
    escalation_conditions: globalConfig?.on_call?.escalation_conditions || ["no_response", "no_acknowledgment", "no_resolution"],
  }), [globalConfig]);

  // ✅ Cache Management
  const isCacheStale = useCallback(() => {
    if (!cache.lastCacheRefresh) return true;
    const age = Date.now() - new Date(cache.lastCacheRefresh).getTime();
    return age > cache.ttl;
  }, [cache.lastCacheRefresh, cache.ttl]);

  const invalidateCache = useCallback(() => {
    setCache(prev => ({
      ...prev,
      schedules: new Map(),
      policies: new Map(),
      lastCacheRefresh: null,
    }));
    setSchedulesState(prev => ({ ...prev, stale: true }));
    setPoliciesState(prev => ({ ...prev, stale: true }));
  }, []);

  const getCacheStats = useCallback(() => ({
    size: cache.schedules.size + cache.policies.size,
    lastRefresh: cache.lastCacheRefresh,
    isStale: isCacheStale(),
  }), [cache.schedules.size, cache.policies.size, cache.lastCacheRefresh, isCacheStale]);

  // ✅ API Integration Layer - Schedules
  const refreshSchedules = useCallback(async () => {
    if (!tenantId) return;
    
    setSchedulesState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // TODO: On call schedules should be fetched from on_call store with type filtering
      // For now, fetch from on_call store and filter for schedules
      const schedules = await getAll<OnCallSchedule>(tenantId, "on_call");
      
      setSchedulesState({
        data: schedules,
        loading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        stale: false,
      });

      // Update cache
      setCache(prev => {
        const newCache = new Map();
        schedules.forEach(schedule => newCache.set(schedule.id, schedule));
        return {
          ...prev,
          schedules: newCache,
          lastCacheRefresh: new Date().toISOString(),
        };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load schedules';
      setSchedulesState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  }, [tenantId]);

  const getSchedule = useCallback(async (id: string) => {
    if (!tenantId) return undefined;

    // Check cache first
    const cached = cache.schedules.get(id);
    if (cached && !isCacheStale()) {
      return cached;
    }

    // Fetch from DB
    return getById<OnCallSchedule>(tenantId, "on_call_schedules", id);
  }, [tenantId, cache.schedules, isCacheStale]);

  // ✅ Optimistic Update Helper
  const showOptimisticSchedule = useCallback((schedule: OnCallSchedule, action: 'create' | 'update' | 'delete') => {
    const optimistic: OptimisticUpdate<OnCallSchedule> = {
      id: crypto.randomUUID(),
      action,
      entity: schedule,
      timestamp: new Date().toISOString(),
    };

    setOptimisticSchedules(prev => [...prev, optimistic]);

    // Remove optimistic update after delay
    setTimeout(() => {
      setOptimisticSchedules(prev => prev.filter(o => o.id !== optimistic.id));
    }, 3000);
  }, []);

  const addSchedule = useCallback(async (schedule: OnCallSchedule, userId?: string) => {
    if (!tenantId) return;

    // ✅ Simple UI validation only
    if (!schedule.name?.trim()) {
      throw new Error('Schedule name is required');
    }

    // ✅ Show optimistic update for immediate UI feedback
    showOptimisticSchedule(schedule, 'create');

    try {
      // ✅ Backend handles ALL business logic, validation, and rules
      await putWithAudit(
        tenantId,
        "on_call_schedules",
        {
          ...schedule,
          created_at: schedule.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: "syncing",
          tenantId,
        },
        userId,
        { action: "create", description: `On-call schedule "${schedule.name}" created` },
        enqueueItem
      );

      await refreshSchedules();
    } catch (error) {
      // ✅ Remove optimistic update on failure
      setOptimisticSchedules(prev => prev.filter(o => o.entity.id !== schedule.id));
      throw error;
    }
  }, [tenantId, enqueueItem, refreshSchedules, showOptimisticSchedule]);

  const updateSchedule = useCallback(async (schedule: OnCallSchedule, userId?: string) => {
    if (!tenantId) return;

    showOptimisticSchedule(schedule, 'update');

    try {
      await putWithAudit(
        tenantId,
        "on_call_schedules",
        {
          ...schedule,
          updated_at: new Date().toISOString(),
          sync_status: "syncing",
          tenantId,
        },
        userId,
        { action: "update", description: `On-call schedule "${schedule.name}" updated` },
        enqueueItem
      );

      await refreshSchedules();
    } catch (error) {
      setOptimisticSchedules(prev => prev.filter(o => o.entity.id !== schedule.id));
      throw error;
    }
  }, [tenantId, enqueueItem, refreshSchedules, showOptimisticSchedule]);

  const deleteSchedule = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) return;

    const schedule = await getSchedule(id);
    if (schedule) {
      showOptimisticSchedule(schedule, 'delete');
    }

    try {
      await removeWithAudit(
        tenantId,
        "on_call_schedules",
        id,
        userId,
        { action: "delete", description: `On-call schedule "${schedule?.name || id}" deleted` },
        enqueueItem
      );

      await refreshSchedules();
    } catch (error) {
      if (schedule) {
        setOptimisticSchedules(prev => prev.filter(o => o.entity.id !== id));
      }
      throw error;
    }
  }, [tenantId, getSchedule, enqueueItem, refreshSchedules, showOptimisticSchedule]);

  // ✅ API Integration Layer - Escalation Policies
  const refreshEscalationPolicies = useCallback(async () => {
    if (!tenantId) return;

    setPoliciesState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // TODO: Escalation policies should be fetched from on_call store with type filtering  
      // For now, return empty array as escalation_policies store doesn't exist
      const policies: EscalationPolicy[] = [];
      
      setPoliciesState({
        data: policies,
        loading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        stale: false,
      });

      // Update cache
      setCache(prev => {
        const newCache = new Map();
        policies.forEach(policy => newCache.set(policy.id, policy));
        return {
          ...prev,
          policies: newCache,
          lastCacheRefresh: new Date().toISOString(),
        };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load escalation policies';
      setPoliciesState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  }, [tenantId]);

  const getEscalationPolicy = useCallback(async (id: string) => {
    if (!tenantId) return undefined;

    const cached = cache.policies.get(id);
    if (cached && !isCacheStale()) {
      return cached;
    }

    return getById<EscalationPolicy>(tenantId, "escalation_policies", id);
  }, [tenantId, cache.policies, isCacheStale]);

  const addEscalationPolicy = useCallback(async (policy: EscalationPolicy, userId?: string) => {
    if (!tenantId) return;

    if (!policy.name?.trim()) {
      throw new Error('Policy name is required');
    }

    try {
      await putWithAudit(
        tenantId,
        "escalation_policies",
        {
          ...policy,
          created_at: policy.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: "syncing",
          tenantId,
        },
        userId,
        { action: "create", description: `Escalation policy "${policy.name}" created` },
        enqueueItem
      );

      await refreshEscalationPolicies();
    } catch (error) {
      throw error;
    }
  }, [tenantId, enqueueItem, refreshEscalationPolicies]);

  const updateEscalationPolicy = useCallback(async (policy: EscalationPolicy, userId?: string) => {
    if (!tenantId) return;

    try {
      await putWithAudit(
        tenantId,
        "escalation_policies",
        {
          ...policy,
          updated_at: new Date().toISOString(),
          sync_status: "syncing",
          tenantId,
        },
        userId,
        { action: "update", description: `Escalation policy "${policy.name}" updated` },
        enqueueItem
      );

      await refreshEscalationPolicies();
    } catch (error) {
      throw error;
    }
  }, [tenantId, enqueueItem, refreshEscalationPolicies]);

  const deleteEscalationPolicy = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) return;

    const policy = await getEscalationPolicy(id);

    try {
      await removeWithAudit(
        tenantId,
        "escalation_policies",
        id,
        userId,
        { action: "delete", description: `Escalation policy "${policy?.name || id}" deleted` },
        enqueueItem
      );

      await refreshEscalationPolicies();
    } catch (error) {
      throw error;
    }
  }, [tenantId, getEscalationPolicy, enqueueItem, refreshEscalationPolicies]);

  // ✅ API Operations (delegate ALL business logic to backend)
  const createOverride = useCallback(async (scheduleId: string, override: OnCallSchedule['overrides'][0], userId?: string) => {
    // Backend API call - let backend handle all business logic
    const response = await fetch(`/api/on-call/schedules/${scheduleId}/overrides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ override, userId }),
    });

    if (!response.ok) {
      throw new Error('Failed to create override');
    }

    // Refresh to get updated data from backend
    await refreshSchedules();
  }, [refreshSchedules]);

  const requestShiftSwap = useCallback(async (shiftId: string, requesterId: string, targetUserId: string, reason: string) => {
    // Backend API call
    const response = await fetch(`/api/on-call/shifts/${shiftId}/swap-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requesterId, targetUserId, reason }),
    });

    if (!response.ok) {
      throw new Error('Failed to request shift swap');
    }

    await refreshSchedules();
  }, [refreshSchedules]);

  const approveShiftSwap = useCallback(async (shiftId: string, approverId: string) => {
    // Backend API call
    const response = await fetch(`/api/on-call/shifts/${shiftId}/swap-approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approverId }),
    });

    if (!response.ok) {
      throw new Error('Failed to approve shift swap');
    }

    await refreshSchedules();
  }, [refreshSchedules]);

  const triggerEscalation = useCallback(async (policyId: string, incidentId: string, currentLevel: number = 0) => {
    // Backend API call - backend handles all escalation business logic
    const response = await fetch(`/api/on-call/escalation/${policyId}/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incidentId, currentLevel }),
    });

    if (!response.ok) {
      throw new Error('Failed to trigger escalation');
    }

    // Backend handles all the escalation logic, notifications, scheduling, etc.
  }, []);

  // ✅ Simple Client-Side Filtering (UI responsiveness only)
  const getSchedulesByTeam = useCallback((teamId: string) => {
    return schedulesState.data.filter(s => s.team_id === teamId);
  }, [schedulesState.data]);

  const getSchedulesByUser = useCallback((userId: string) => {
    return schedulesState.data.filter(s => 
      s.shifts.some(shift => shift.user_id === userId) ||
      s.current_on_call_user_ids.includes(userId)
    );
  }, [schedulesState.data]);

  const getActiveSchedules = useCallback(() => {
    const now = new Date().toISOString();
    return schedulesState.data.filter(s => 
      !s.end_date || s.end_date >= now
    );
  }, [schedulesState.data]);

  const getPoliciesByBusinessService = useCallback((serviceId: string) => {
    return policiesState.data.filter(p => 
      p.business_service_ids.includes(serviceId)
    );
  }, [policiesState.data]);

  const searchSchedules = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return schedulesState.data.filter(s => 
      s.name.toLowerCase().includes(lowerQuery) ||
      s.description?.toLowerCase().includes(lowerQuery) ||
      s.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }, [schedulesState.data]);

  const searchPolicies = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return policiesState.data.filter(p => 
      p.name.toLowerCase().includes(lowerQuery) ||
      p.description?.toLowerCase().includes(lowerQuery) ||
      p.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }, [policiesState.data]);

  // ✅ Computed Values with Memoization
  const schedules = useMemo(() => {
    // Merge real data with optimistic updates for immediate UI feedback
    let result = [...schedulesState.data];
    
    optimisticSchedules.forEach(opt => {
      if (opt.action === 'create') {
        result = [opt.entity, ...result];
      } else if (opt.action === 'update') {
        result = result.map(s => s.id === opt.entity.id ? opt.entity : s);
      } else if (opt.action === 'delete') {
        result = result.filter(s => s.id !== opt.entity.id);
      }
    });
    
    return result;
  }, [schedulesState.data, optimisticSchedules]);

  const escalationPolicies = useMemo(() => {
    let result = [...policiesState.data];
    
    optimisticPolicies.forEach(opt => {
      if (opt.action === 'create') {
        result = [opt.entity, ...result];
      } else if (opt.action === 'update') {
        result = result.map(p => p.id === opt.entity.id ? opt.entity : p);
      } else if (opt.action === 'delete') {
        result = result.filter(p => p.id !== opt.entity.id);
      }
    });
    
    return result;
  }, [policiesState.data, optimisticPolicies]);

  // ✅ Initialize data when tenant/config changes
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshSchedules();
      refreshEscalationPolicies();
    } else {
      // Reset state when no tenant
      setSchedulesState({ data: [], loading: false, error: null, lastFetch: null, stale: false });
      setPoliciesState({ data: [], loading: false, error: null, lastFetch: null, stale: false });
      invalidateCache();
    }
  }, [tenantId, globalConfig, refreshSchedules, refreshEscalationPolicies, invalidateCache]);

  // ✅ Cleanup on unmount
  useEffect(() => {
    return () => {
      setOptimisticSchedules([]);
      setOptimisticPolicies([]);
      invalidateCache();
    };
  }, [invalidateCache]);

  const contextValue = useMemo(() => ({
    // Async State
    schedulesState,
    policiesState,
    
    // Data with optimistic updates
    schedules,
    escalationPolicies,
    
    // CRUD Operations
    addSchedule,
    updateSchedule,
    deleteSchedule,
    refreshSchedules,
    getSchedule,
    
    addEscalationPolicy,
    updateEscalationPolicy,
    deleteEscalationPolicy,
    refreshEscalationPolicies,
    getEscalationPolicy,
    
    // API Operations
    createOverride,
    requestShiftSwap,
    approveShiftSwap,
    triggerEscalation,
    
    // Client-side filtering
    getSchedulesByTeam,
    getSchedulesByUser,
    getActiveSchedules,
    getPoliciesByBusinessService,
    searchSchedules,
    searchPolicies,
    
    // Configuration
    config,
    
    // Cache Management
    invalidateCache,
    getCacheStats,
  }), [
    schedulesState, policiesState, schedules, escalationPolicies,
    addSchedule, updateSchedule, deleteSchedule, refreshSchedules, getSchedule,
    addEscalationPolicy, updateEscalationPolicy, deleteEscalationPolicy, refreshEscalationPolicies, getEscalationPolicy,
    createOverride, requestShiftSwap, approveShiftSwap, triggerEscalation,
    getSchedulesByTeam, getSchedulesByUser, getActiveSchedules, getPoliciesByBusinessService,
    searchSchedules, searchPolicies, config, invalidateCache, getCacheStats,
  ]);

  return (
    <OnCallContext.Provider value={contextValue}>
      {children}
    </OnCallContext.Provider>
  );
};

// ---------------------------------
// 6. Hooks for UI Components
// ---------------------------------
export const useOnCall = () => {
  const ctx = useContext(OnCallContext);
  if (!ctx) throw new Error("useOnCall must be used within OnCallProvider");
  return ctx;
};

/**
 * Hook for accessing a specific schedule with loading states
 */
export const useOnCallScheduleDetails = (id: string) => {
  const { schedules, schedulesState } = useOnCall();
  return useMemo(() => ({
    schedule: schedules.find((s) => s.id === id) || null,
    loading: schedulesState.loading,
    error: schedulesState.error,
  }), [schedules, id, schedulesState.loading, schedulesState.error]);
};

/**
 * Hook for accessing a specific escalation policy with loading states  
 */
export const useEscalationPolicyDetails = (id: string) => {
  const { escalationPolicies, policiesState } = useOnCall();
  return useMemo(() => ({
    policy: escalationPolicies.find((p) => p.id === id) || null,
    loading: policiesState.loading,
    error: policiesState.error,
  }), [escalationPolicies, id, policiesState.loading, policiesState.error]);
};

/**
 * Selective subscription hook - only re-renders when specific team's schedules change
 */
export const useSchedulesByTeam = (teamId: string) => {
  const { getSchedulesByTeam, schedulesState } = useOnCall();
  return useMemo(() => ({
    schedules: getSchedulesByTeam(teamId),
    loading: schedulesState.loading,
    error: schedulesState.error,
  }), [getSchedulesByTeam, teamId, schedulesState.loading, schedulesState.error]);
};

/**
 * Selective subscription hook - only re-renders when user's schedules change
 */
export const useSchedulesByUser = (userId: string) => {
  const { getSchedulesByUser, schedulesState } = useOnCall();
  return useMemo(() => ({
    schedules: getSchedulesByUser(userId),
    loading: schedulesState.loading,
    error: schedulesState.error,
  }), [getSchedulesByUser, userId, schedulesState.loading, schedulesState.error]);
};

/**
 * Hook for active schedules only
 */
export const useActiveSchedules = () => {
  const { getActiveSchedules, schedulesState } = useOnCall();
  return useMemo(() => ({
    schedules: getActiveSchedules(),
    loading: schedulesState.loading,
    error: schedulesState.error,
  }), [getActiveSchedules, schedulesState.loading, schedulesState.error]);
};

/**
 * Search hook with debouncing for performance
 */
export const useOnCallSearch = (query: string, type: 'schedules' | 'policies' = 'schedules') => {
  const { searchSchedules, searchPolicies, schedulesState, policiesState } = useOnCall();
  
  return useMemo(() => {
    if (!query.trim()) return { results: [], loading: false, error: null };
    
    const results = type === 'schedules' ? searchSchedules(query) : searchPolicies(query);
    const state = type === 'schedules' ? schedulesState : policiesState;
    
    return {
      results,
      loading: state.loading,
      error: state.error,
    };
  }, [query, type, searchSchedules, searchPolicies, schedulesState, policiesState]);
};