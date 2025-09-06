// src/contexts/UsersContext.tsx
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
import { AsyncState, AsyncStateHelpers } from "../types/asyncState";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";
import { ExternalSystemFields } from "../types/externalSystem";

// ---------------------------------
// 1. Frontend-Only Type Definitions
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
  skill_id: string;
  proficiency: "beginner" | "intermediate" | "expert";
  certified_until?: string | null;
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

export interface User extends ExternalSystemFields {
  id: string;
  username: string;
  email: string;
  phone?: string;
  full_name: string;
  role: UserRole;
  title?: string;
  department?: string;
  location?: string;
  team_ids: string[];
  manager_user_id?: string | null;
  skillset: UserSkill[];
  cost_center_id?: string | null;
  active_directory_dn?: string | null;
  sso_provider?: string;
  is_active: boolean;
  last_login_at?: string | null;
  login_count?: number;
  preferences?: UserPreferences;
  current_incident_count?: number;
  max_concurrent_incidents?: number;
  avg_resolution_time_minutes?: number;
  escalation_count?: number;
  workload_score?: number;
  on_call_schedule_ids: string[];
  current_on_call_status?: "available" | "on_call" | "busy" | "offline";
  availability_timezone?: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  tenantId?: string;
  // Note: synced_at and sync_status are now provided by ExternalSystemFields
}

// ---------------------------------
// 2. Frontend State Management Types
// ---------------------------------


export interface UsersState extends AsyncState<User[]> {
  searchResults: User[];
  selectedUsers: Set<string>;
  filters: UserFilters;
  cache: Map<string, { user: User; timestamp: number }>;
}

export interface UserFilters {
  role?: UserRole;
  department?: string;
  location?: string;
  teamId?: string;
  isActive?: boolean;
  onCallStatus?: string;
  searchQuery?: string;
  // External system filters
  sourceSystems?: string[];
  syncStatus?: ('synced' | 'syncing' | 'error' | 'conflict')[];
  hasConflicts?: boolean;
  hasLocalChanges?: boolean;
  dataCompleteness?: { min: number; max: number };
}

export interface OptimisticUpdate {
  id: string;
  type: 'create' | 'update' | 'delete';
  data: Partial<User>;
  timestamp: number;
}

// ---------------------------------
// 3. API Response Types
// ---------------------------------
export interface APIResponse<T> {
  data: T;
  meta?: {
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface APIError {
  message: string;
  field?: string;
  code: string;
  validationErrors?: Array<{ field: string; message: string }>;
}

// ---------------------------------
// 4. Context Interface
// ---------------------------------
interface UsersContextType {
  // State
  state: UsersState;
  
  // Core CRUD Operations (API orchestration only)
  createUser: (userData: Partial<User>, options?: { optimistic?: boolean }) => Promise<User>;
  updateUser: (id: string, userData: Partial<User>, options?: { optimistic?: boolean }) => Promise<User>;
  deleteUser: (id: string, options?: { optimistic?: boolean }) => Promise<void>;
  
  // Data Fetching & Cache Management
  fetchUsers: (options?: { force?: boolean; filters?: UserFilters }) => Promise<void>;
  fetchUser: (id: string, options?: { force?: boolean }) => Promise<User>;
  invalidateCache: (id?: string) => void;
  
  // UI State Management
  setFilters: (filters: Partial<UserFilters>) => void;
  clearFilters: () => void;
  setSelectedUsers: (userIds: string[]) => void;
  toggleUserSelection: (userId: string) => void;
  clearSelection: () => void;
  
  // Client-Side Helpers (UI only)
  getFilteredUsers: () => User[];
  searchUsers: (query: string) => User[];
  getUserById: (id: string) => User | null;
  
  // Quick Actions (API calls with UI feedback)
  bulkUpdateUsers: (userIds: string[], updates: Partial<User>) => Promise<void>;
  bulkAssignToTeam: (userIds: string[], teamId: string) => Promise<void>;
  toggleUserActive: (userId: string) => Promise<void>;
  
  // Config
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
// 5. Constants & Configuration
// ---------------------------------
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const STALE_TIME = 2 * 60 * 1000; // 2 minutes
const MAX_CACHE_SIZE = 1000;

// ---------------------------------
// 6. Provider Implementation
// ---------------------------------
export const UsersProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();
  
  // State Management
  const [state, setState] = useState<UsersState>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    stale: false,
    searchResults: [],
    selectedUsers: new Set(),
    filters: {},
    cache: new Map(),
  });
  
  // Refs for cleanup and optimization
  const abortControllerRef = useRef<AbortController | null>(null);
  const optimisticUpdatesRef = useRef<Map<string, OptimisticUpdate>>(new Map());
  
  // Configuration from backend
  const config = useMemo(() => ({
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
  }), [globalConfig]);

  // ---------------------------------
  // 7. API Service Layer
  // ---------------------------------
  const apiService = useMemo(() => ({
    async fetchUsers(filters?: UserFilters): Promise<APIResponse<User[]>> {
      const params = new URLSearchParams();
      if (filters?.role) params.append('role', filters.role);
      if (filters?.department) params.append('department', filters.department);
      if (filters?.location) params.append('location', filters.location);
      if (filters?.teamId) params.append('team_id', filters.teamId);
      if (filters?.isActive !== undefined) params.append('is_active', String(filters.isActive));
      if (filters?.onCallStatus) params.append('on_call_status', filters.onCallStatus);
      if (filters?.searchQuery) params.append('q', filters.searchQuery);

      const response = await fetch(`/api/tenants/${tenantId}/users?${params}`, {
        signal: abortControllerRef.current?.signal,
      });
      
      if (!response.ok) {
        const error: APIError = await response.json();
        throw new Error(error.message || 'Failed to fetch users');
      }
      
      return response.json();
    },

    async fetchUser(id: string): Promise<User> {
      const response = await fetch(`/api/tenants/${tenantId}/users/${id}`, {
        signal: abortControllerRef.current?.signal,
      });
      
      if (!response.ok) {
        const error: APIError = await response.json();
        throw new Error(error.message || 'Failed to fetch user');
      }
      
      return response.json();
    },

    async createUser(userData: Partial<User>): Promise<User> {
      const response = await fetch(`/api/tenants/${tenantId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      
      if (!response.ok) {
        const error: APIError = await response.json();
        throw new Error(error.message || 'Failed to create user');
      }
      
      return response.json();
    },

    async updateUser(id: string, userData: Partial<User>): Promise<User> {
      const response = await fetch(`/api/tenants/${tenantId}/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      
      if (!response.ok) {
        const error: APIError = await response.json();
        throw new Error(error.message || 'Failed to update user');
      }
      
      return response.json();
    },

    async deleteUser(id: string): Promise<void> {
      const response = await fetch(`/api/tenants/${tenantId}/users/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error: APIError = await response.json();
        throw new Error(error.message || 'Failed to delete user');
      }
    },

    async bulkUpdate(userIds: string[], updates: Partial<User>): Promise<User[]> {
      const response = await fetch(`/api/tenants/${tenantId}/users/bulk`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: userIds, updates }),
      });
      
      if (!response.ok) {
        const error: APIError = await response.json();
        throw new Error(error.message || 'Failed to bulk update users');
      }
      
      return response.json();
    },
  }), [tenantId]);

  // ---------------------------------
  // 8. State Update Helpers
  // ---------------------------------
  const updateState = useCallback((updates: Partial<UsersState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const setError = useCallback((error: string | null) => {
    updateState({ error, loading: false });
  }, [updateState]);

  const setLoading = useCallback((loading: boolean) => {
    updateState({ loading, error: loading ? null : state.error });
  }, [updateState, state.error]);

  // Cache Management
  const updateCache = useCallback((user: User) => {
    setState(prev => {
      const newCache = new Map(prev.cache);
      
      // Implement LRU eviction if cache gets too large
      if (newCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = newCache.keys().next().value;
        newCache.delete(oldestKey);
      }
      
      newCache.set(user.id, { user, timestamp: Date.now() });
      return { ...prev, cache: newCache };
    });
  }, []);

  const getCachedUser = useCallback((id: string): User | null => {
    const cached = state.cache.get(id);
    if (!cached) return null;
    
    const isStale = Date.now() - cached.timestamp > CACHE_TTL;
    return isStale ? null : cached.user;
  }, [state.cache]);

  const invalidateCache = useCallback((id?: string) => {
    setState(prev => {
      if (id) {
        const newCache = new Map(prev.cache);
        newCache.delete(id);
        return { ...prev, cache: newCache };
      }
      return { ...prev, cache: new Map() };
    });
  }, []);

  // ---------------------------------
  // 9. Optimistic Updates
  // ---------------------------------
  const applyOptimisticUpdate = useCallback((update: OptimisticUpdate) => {
    optimisticUpdatesRef.current.set(update.id, update);
    
    setState(prev => {
      if (!prev.data) return prev;
      
      let newData = [...prev.data];
      
      switch (update.type) {
        case 'create':
          newData.push(update.data as User);
          break;
        case 'update':
          const updateIndex = newData.findIndex(u => u.id === update.id);
          if (updateIndex >= 0) {
            newData[updateIndex] = { ...newData[updateIndex], ...update.data };
          }
          break;
        case 'delete':
          newData = newData.filter(u => u.id !== update.id);
          break;
      }
      
      return { ...prev, data: newData };
    });
  }, []);

  const rollbackOptimisticUpdate = useCallback((id: string) => {
    const update = optimisticUpdatesRef.current.get(id);
    if (!update) return;
    
    optimisticUpdatesRef.current.delete(id);
    // Re-fetch to get clean state
    fetchUsers({ force: true });
  }, []);

  const commitOptimisticUpdate = useCallback((id: string) => {
    optimisticUpdatesRef.current.delete(id);
  }, []);

  // ---------------------------------
  // 10. Core CRUD Operations
  // ---------------------------------
  const createUser = useCallback(async (
    userData: Partial<User>, 
    options: { optimistic?: boolean } = {}
  ): Promise<User> => {
    const tempId = `temp-${Date.now()}`;
    
    try {
      if (options.optimistic) {
        applyOptimisticUpdate({
          id: tempId,
          type: 'create',
          data: { ...userData, id: tempId } as User,
          timestamp: Date.now(),
        });
      }
      
      setLoading(true);
      const newUser = await apiService.createUser(userData);
      
      commitOptimisticUpdate(tempId);
      updateCache(newUser);
      
      // Update local state with real user data
      setState(prev => ({
        ...prev,
        data: prev.data ? [...prev.data.filter(u => u.id !== tempId), newUser] : [newUser],
        loading: false,
      }));
      
      // Sync for offline support
      enqueueItem?.({
        type: 'user',
        action: 'create',
        data: newUser,
        timestamp: Date.now(),
      });
      
      return newUser;
    } catch (error) {
      if (options.optimistic) {
        rollbackOptimisticUpdate(tempId);
      }
      setError(error instanceof Error ? error.message : 'Failed to create user');
      throw error;
    }
  }, [apiService, applyOptimisticUpdate, commitOptimisticUpdate, rollbackOptimisticUpdate, updateCache, setLoading, setError, enqueueItem]);

  const updateUser = useCallback(async (
    id: string,
    userData: Partial<User>,
    options: { optimistic?: boolean } = {}
  ): Promise<User> => {
    try {
      if (options.optimistic) {
        applyOptimisticUpdate({
          id,
          type: 'update',
          data: userData,
          timestamp: Date.now(),
        });
      }
      
      setLoading(true);
      const updatedUser = await apiService.updateUser(id, userData);
      
      commitOptimisticUpdate(id);
      updateCache(updatedUser);
      
      setState(prev => ({
        ...prev,
        data: prev.data ? prev.data.map(u => u.id === id ? updatedUser : u) : [updatedUser],
        loading: false,
      }));
      
      enqueueItem?.({
        type: 'user',
        action: 'update',
        data: updatedUser,
        timestamp: Date.now(),
      });
      
      return updatedUser;
    } catch (error) {
      if (options.optimistic) {
        rollbackOptimisticUpdate(id);
      }
      setError(error instanceof Error ? error.message : 'Failed to update user');
      throw error;
    }
  }, [apiService, applyOptimisticUpdate, commitOptimisticUpdate, rollbackOptimisticUpdate, updateCache, setLoading, setError, enqueueItem]);

  const deleteUser = useCallback(async (
    id: string,
    options: { optimistic?: boolean } = {}
  ): Promise<void> => {
    const existingUser = state.data?.find(u => u.id === id);
    
    try {
      if (options.optimistic && existingUser) {
        applyOptimisticUpdate({
          id,
          type: 'delete',
          data: existingUser,
          timestamp: Date.now(),
        });
      }
      
      setLoading(true);
      await apiService.deleteUser(id);
      
      commitOptimisticUpdate(id);
      invalidateCache(id);
      
      setState(prev => ({
        ...prev,
        data: prev.data ? prev.data.filter(u => u.id !== id) : [],
        selectedUsers: new Set([...prev.selectedUsers].filter(uid => uid !== id)),
        loading: false,
      }));
      
      enqueueItem?.({
        type: 'user',
        action: 'delete',
        data: { id },
        timestamp: Date.now(),
      });
    } catch (error) {
      if (options.optimistic) {
        rollbackOptimisticUpdate(id);
      }
      setError(error instanceof Error ? error.message : 'Failed to delete user');
      throw error;
    }
  }, [state.data, apiService, applyOptimisticUpdate, commitOptimisticUpdate, rollbackOptimisticUpdate, invalidateCache, setLoading, setError, enqueueItem]);

  // ---------------------------------
  // 11. Data Fetching
  // ---------------------------------
  const fetchUsers = useCallback(async (
    options: { force?: boolean; filters?: UserFilters } = {}
  ) => {
    // Cancel any ongoing requests
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    
    const now = Date.now();
    const isStale = !state.lastFetch || now - state.lastFetch > STALE_TIME;
    
    if (!options.force && !isStale && state.data) {
      return;
    }
    
    try {
      setLoading(true);
      const response = await apiService.fetchUsers(options.filters || state.filters);
      
      updateState({
        data: response.data,
        loading: false,
        error: null,
        lastFetch: now,
        stale: false,
      });
      
      // Update cache for individual users
      response.data.forEach(updateCache);
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Request was cancelled, don't update error state
      }
      setError(error instanceof Error ? error.message : 'Failed to fetch users');
    }
  }, [state.lastFetch, state.data, state.filters, apiService, setLoading, updateState, updateCache, setError]);

  const fetchUser = useCallback(async (
    id: string,
    options: { force?: boolean } = {}
  ): Promise<User> => {
    // Check cache first
    if (!options.force) {
      const cached = getCachedUser(id);
      if (cached) return cached;
    }
    
    try {
      const user = await apiService.fetchUser(id);
      updateCache(user);
      
      // Update in main data array if present
      setState(prev => ({
        ...prev,
        data: prev.data ? prev.data.map(u => u.id === id ? user : u) : prev.data,
      }));
      
      return user;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch user');
      throw error;
    }
  }, [getCachedUser, apiService, updateCache, setError]);

  // ---------------------------------
  // 12. UI State Management
  // ---------------------------------
  const setFilters = useCallback((newFilters: Partial<UserFilters>) => {
    setState(prev => {
      const filters = { ...prev.filters, ...newFilters };
      return {
        ...prev,
        filters,
        stale: true, // Mark data as stale when filters change
      };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setState(prev => ({
      ...prev,
      filters: {},
      stale: true,
    }));
  }, []);

  const setSelectedUsers = useCallback((userIds: string[]) => {
    updateState({ selectedUsers: new Set(userIds) });
  }, [updateState]);

  const toggleUserSelection = useCallback((userId: string) => {
    setState(prev => {
      const newSelection = new Set(prev.selectedUsers);
      if (newSelection.has(userId)) {
        newSelection.delete(userId);
      } else {
        newSelection.add(userId);
      }
      return { ...prev, selectedUsers: newSelection };
    });
  }, []);

  const clearSelection = useCallback(() => {
    updateState({ selectedUsers: new Set() });
  }, [updateState]);

  // ---------------------------------
  // 13. Client-Side Helpers (UI Performance Only)
  // ---------------------------------
  const getFilteredUsers = useCallback((): User[] => {
    if (!state.data) return [];
    
    let filtered = state.data;
    const { filters } = state;
    
    // Apply basic UI filters for immediate responsiveness
    if (filters.role) {
      filtered = filtered.filter(u => u.role === filters.role);
    }
    if (filters.department) {
      filtered = filtered.filter(u => u.department === filters.department);
    }
    if (filters.location) {
      filtered = filtered.filter(u => u.location === filters.location);
    }
    if (filters.teamId) {
      filtered = filtered.filter(u => u.team_ids.includes(filters.teamId));
    }
    if (filters.isActive !== undefined) {
      filtered = filtered.filter(u => u.is_active === filters.isActive);
    }
    if (filters.onCallStatus) {
      filtered = filtered.filter(u => u.current_on_call_status === filters.onCallStatus);
    }
    
    return filtered;
  }, [state.data, state.filters]);

  const searchUsers = useCallback((query: string): User[] => {
    if (!state.data || !query.trim()) return state.data || [];
    
    const lowerQuery = query.toLowerCase();
    return state.data.filter(user => 
      user.full_name.toLowerCase().includes(lowerQuery) ||
      user.username.toLowerCase().includes(lowerQuery) ||
      user.email.toLowerCase().includes(lowerQuery) ||
      user.title?.toLowerCase().includes(lowerQuery) ||
      user.department?.toLowerCase().includes(lowerQuery)
    );
  }, [state.data]);

  const getUserById = useCallback((id: string): User | null => {
    // Check cache first for performance
    const cached = getCachedUser(id);
    if (cached) return cached;
    
    // Fallback to main data
    return state.data?.find(u => u.id === id) || null;
  }, [state.data, getCachedUser]);

  // ---------------------------------
  // 14. Bulk Operations
  // ---------------------------------
  const bulkUpdateUsers = useCallback(async (
    userIds: string[],
    updates: Partial<User>
  ) => {
    try {
      setLoading(true);
      const updatedUsers = await apiService.bulkUpdate(userIds, updates);
      
      setState(prev => {
        if (!prev.data) return prev;
        
        const updatedData = prev.data.map(user => {
          const updatedUser = updatedUsers.find(u => u.id === user.id);
          return updatedUser || user;
        });
        
        return {
          ...prev,
          data: updatedData,
          loading: false,
        };
      });
      
      // Update cache
      updatedUsers.forEach(updateCache);
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to bulk update users');
      throw error;
    }
  }, [apiService, setLoading, setError, updateCache]);

  const bulkAssignToTeam = useCallback(async (
    userIds: string[],
    teamId: string
  ) => {
    await bulkUpdateUsers(userIds, { team_ids: [teamId] });
  }, [bulkUpdateUsers]);

  const toggleUserActive = useCallback(async (userId: string) => {
    const user = getUserById(userId);
    if (!user) return;
    
    await updateUser(userId, { is_active: !user.is_active }, { optimistic: true });
  }, [getUserById, updateUser]);

  // ---------------------------------
  // 15. Effects & Cleanup
  // ---------------------------------
  useEffect(() => {
    if (tenantId && globalConfig) {
      fetchUsers();
    }
    
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [tenantId, globalConfig]);

  // Auto-refetch when filters change
  useEffect(() => {
    if (state.stale && state.filters) {
      const timeoutId = setTimeout(() => {
        fetchUsers({ filters: state.filters });
      }, 300); // Debounce
      
      return () => clearTimeout(timeoutId);
    }
  }, [state.stale, state.filters, fetchUsers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      optimisticUpdatesRef.current.clear();
    };
  }, []);

  // ---------------------------------
  // 16. Context Value
  // ---------------------------------
  const contextValue = useMemo(() => ({
    state,
    createUser,
    updateUser,
    deleteUser,
    fetchUsers,
    fetchUser,
    invalidateCache,
    setFilters,
    clearFilters,
    setSelectedUsers,
    toggleUserSelection,
    clearSelection,
    getFilteredUsers,
    searchUsers,
    getUserById,
    bulkUpdateUsers,
    bulkAssignToTeam,
    toggleUserActive,
    config,
  }), [
    state,
    createUser,
    updateUser,
    deleteUser,
    fetchUsers,
    fetchUser,
    invalidateCache,
    setFilters,
    clearFilters,
    setSelectedUsers,
    toggleUserSelection,
    clearSelection,
    getFilteredUsers,
    searchUsers,
    getUserById,
    bulkUpdateUsers,
    bulkAssignToTeam,
    toggleUserActive,
    config,
  ]);

  return (
    <UsersContext.Provider value={contextValue}>
      {children}
    </UsersContext.Provider>
  );
};

// ---------------------------------
// 17. Hooks
// ---------------------------------
export const useUsers = () => {
  const context = useContext(UsersContext);
  if (!context) {
    throw new Error("useUsers must be used within UsersProvider");
  }
  return context;
};

/**
 * Hook for selective subscription to user data by status
 * Prevents unnecessary re-renders when irrelevant users change
 */
export const useUsersByStatus = (status: 'active' | 'inactive' | 'on-call' | 'available') => {
  const { state } = useUsers();
  
  return useMemo(() => {
    if (!state.data) return [];
    
    switch (status) {
      case 'active':
        return state.data.filter(u => u.is_active);
      case 'inactive':
        return state.data.filter(u => !u.is_active);
      case 'on-call':
        return state.data.filter(u => u.current_on_call_status === 'on_call');
      case 'available':
        return state.data.filter(u => 
          u.is_active && 
          ['available', 'on_call'].includes(u.current_on_call_status || '')
        );
      default:
        return state.data;
    }
  }, [state.data, status]);
};

/**
 * Hook for user details with caching
 */
export const useUser = (id: string) => {
  const { getUserById, fetchUser } = useUsers();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!id) return;
    
    // Check cache/local state first
    const cachedUser = getUserById(id);
    if (cachedUser) {
      setUser(cachedUser);
      return;
    }
    
    // Fetch if not found locally
    setLoading(true);
    setError(null);
    
    fetchUser(id)
      .then(setUser)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, getUserById, fetchUser]);
  
  return { user, loading, error };
};

/**
 * Hook for filtered users with memoization
 */
export const useFilteredUsers = (filters?: UserFilters) => {
  const { state, setFilters } = useUsers();
  
  useEffect(() => {
    if (filters) {
      setFilters(filters);
    }
  }, [filters, setFilters]);
  
  return useMemo(() => {
    if (!state.data) return [];
    
    let filtered = state.data;
    const activeFilters = filters || state.filters;
    
    if (activeFilters.role) {
      filtered = filtered.filter(u => u.role === activeFilters.role);
    }
    if (activeFilters.department) {
      filtered = filtered.filter(u => u.department === activeFilters.department);
    }
    if (activeFilters.isActive !== undefined) {
      filtered = filtered.filter(u => u.is_active === activeFilters.isActive);
    }
    
    return filtered;
  }, [state.data, filters, state.filters]);
};