// src/contexts/EndUsersContext.tsx
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
import { ExternalSystemFields } from "../types/externalSystem";

// ---------------------------------
// 1. Frontend-Only Type Definitions
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
  certified_until?: string | null;
}

export interface LinkedAccount {
  system: string;
  account_id: string;
}

export interface EndUser extends ExternalSystemFields {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  username?: string;
  employee_id?: string | null;
  customer_id?: string | null;
  department?: string;
  location_id?: string | null;
  job_title?: string;
  role?: EndUserRole;
  is_vip?: boolean;
  tags: string[];
  preferred_contact_method?: "email" | "phone" | "portal" | "chat";
  last_login_at?: string | null;
  active_directory_dn?: string | null;
  linked_accounts?: LinkedAccount[];
  manager_user_id?: string | null;
  team_id?: string | null;
  skills?: EndUserSkill[];
  created_at: string;
  updated_at: string;
  // Note: synced_at and sync_status are now provided by ExternalSystemFields
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  tenantId?: string;
}

// ---------------------------------
// 2. UI State Management Types
// ---------------------------------
export interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  lastFetch: string | null;
  isStale: boolean;
}

export interface OptimisticOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entityId: string;
  timestamp: string;
  originalData?: EndUser;
}

export interface UIFilters {
  role?: EndUserRole;
  department?: string;
  location_id?: string;
  customer_id?: string;
  is_vip?: boolean;
  search?: string;
  tags?: string[];
  // External system filters
  sourceSystems?: string[];
  syncStatus?: ('synced' | 'syncing' | 'error' | 'conflict')[];
  hasConflicts?: boolean;
  hasLocalChanges?: boolean;
  dataCompleteness?: { min: number; max: number };
}

// ---------------------------------
// 3. Frontend Configuration
// ---------------------------------
interface EndUserUIConfig {
  roles: string[];
  departments: string[];
  contact_methods: string[];
  proficiency_levels: string[];
  cache_ttl_minutes: number;
  max_cache_items: number;
}

// ---------------------------------
// 4. Context Interface (Frontend-Only)
// ---------------------------------
interface EndUsersContextType {
  // UI State
  state: AsyncState<EndUser[]>;
  optimisticOps: OptimisticOperation[];
  
  // API Operations (thin wrappers)
  createEndUser: (endUser: Omit<EndUser, 'id' | 'created_at' | 'updated_at'>, userId?: string) => Promise<void>;
  updateEndUser: (endUser: EndUser, userId?: string) => Promise<void>;
  deleteEndUser: (id: string, userId?: string) => Promise<void>;
  refreshEndUsers: () => Promise<void>;
  
  // Client-Side Helpers (UI Performance Only)
  getFilteredEndUsers: (filters: UIFilters) => EndUser[];
  searchEndUsers: (query: string) => EndUser[];
  getEndUsersByStatus: (status: EndUser['health_status']) => EndUser[];
  
  // Cache Management
  invalidateCache: () => void;
  isDataStale: () => boolean;
  
  // UI Configuration
  config: EndUserUIConfig;
}

// ---------------------------------
// 5. Cache Configuration
// ---------------------------------
const CACHE_CONFIG = {
  TTL_MINUTES: 5,
  MAX_ITEMS: 1000,
  STALE_THRESHOLD_MINUTES: 2,
} as const;

// ---------------------------------
// 6. Context Creation
// ---------------------------------
const EndUsersContext = createContext<EndUsersContextType | undefined>(undefined);

// ---------------------------------
// 7. Provider Implementation
// ---------------------------------
export const EndUsersProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();
  
  // UI State Management
  const [state, setState] = useState<AsyncState<EndUser[]>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    isStale: true,
  });
  
  const [optimisticOps, setOptimisticOps] = useState<OptimisticOperation[]>([]);
  
  // Cache cleanup timer
  const cacheCleanupTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // UI Configuration from backend config
  const config: EndUserUIConfig = useMemo(() => ({
    roles: globalConfig?.end_users?.roles || ["employee", "contractor", "partner", "customer_contact"],
    departments: globalConfig?.end_users?.departments || ["IT", "Finance", "Operations", "HR"],
    contact_methods: globalConfig?.end_users?.contact_methods || ["email", "phone", "portal", "chat"],
    proficiency_levels: globalConfig?.end_users?.proficiency_levels || ["beginner", "intermediate", "expert"],
    cache_ttl_minutes: globalConfig?.end_users?.cache_ttl_minutes || CACHE_CONFIG.TTL_MINUTES,
    max_cache_items: globalConfig?.end_users?.max_cache_items || CACHE_CONFIG.MAX_ITEMS,
  }), [globalConfig]);

  // ---------------------------------
  // 8. Cache Management
  // ---------------------------------
  const isDataStale = useCallback(() => {
    if (!state.lastFetch) return true;
    const staleTime = Date.now() - (config.cache_ttl_minutes * 60 * 1000);
    return new Date(state.lastFetch).getTime() < staleTime;
  }, [state.lastFetch, config.cache_ttl_minutes]);

  const invalidateCache = useCallback(() => {
    setState(prev => ({ ...prev, isStale: true, lastFetch: null }));
  }, []);

  // ---------------------------------
  // 9. API Operations (Thin Wrappers)
  // ---------------------------------
  const refreshEndUsers = useCallback(async () => {
    if (!tenantId) return;
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const endUsers = await getAll<EndUser>(tenantId, "end_users");
      
      setState(prev => ({
        ...prev,
        data: endUsers,
        loading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        isStale: false,
      }));
      
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load end users',
      }));
    }
  }, [tenantId]);

  const createEndUser = useCallback(async (
    endUserData: Omit<EndUser, 'id' | 'created_at' | 'updated_at'>, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error('Tenant ID required');
    
    // Basic UI validation only
    if (!endUserData.name?.trim()) {
      throw new Error('Name is required');
    }
    if (endUserData.email && !/\S+@\S+\.\S+/.test(endUserData.email)) {
      throw new Error('Invalid email format');
    }
    
    const tempId = `temp_${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    const newEndUser: EndUser = {
      ...endUserData,
      id: tempId,
      created_at: timestamp,
      updated_at: timestamp,
      health_status: endUserData.health_status || "green",
      sync_status: "syncing",
      tenantId,
    };
    
    // Optimistic Update
    const optimisticOp: OptimisticOperation = {
      id: tempId,
      type: 'create',
      entityId: tempId,
      timestamp,
    };
    
    setOptimisticOps(prev => [...prev, optimisticOp]);
    setState(prev => ({
      ...prev,
      data: [...prev.data, newEndUser],
    }));
    
    try {
      // Backend handles all business logic and validation
      await putWithAudit(
        tenantId,
        "end_users",
        newEndUser,
        userId,
        { action: "create", description: `End User "${endUserData.name}" created` },
        enqueueItem
      );
      
      // Remove optimistic operation on success
      setOptimisticOps(prev => prev.filter(op => op.id !== tempId));
      
      // Refresh to get server-generated ID and any server-side transformations
      await refreshEndUsers();
      
    } catch (error) {
      // Rollback optimistic update
      setOptimisticOps(prev => prev.filter(op => op.id !== tempId));
      setState(prev => ({
        ...prev,
        data: prev.data.filter(user => user.id !== tempId),
        error: error instanceof Error ? error.message : 'Failed to create end user',
      }));
      throw error;
    }
  }, [tenantId, enqueueItem, refreshEndUsers]);

  const updateEndUser = useCallback(async (endUser: EndUser, userId?: string) => {
    if (!tenantId) throw new Error('Tenant ID required');
    
    // Basic UI validation only
    if (!endUser.name?.trim()) {
      throw new Error('Name is required');
    }
    if (endUser.email && !/\S+@\S+\.\S+/.test(endUser.email)) {
      throw new Error('Invalid email format');
    }
    
    const originalUser = state.data.find(u => u.id === endUser.id);
    if (!originalUser) {
      throw new Error('End user not found');
    }
    
    const timestamp = new Date().toISOString();
    const updatedUser = {
      ...endUser,
      updated_at: timestamp,
      sync_status: "syncing" as const,
    };
    
    // Optimistic Update
    const optimisticOp: OptimisticOperation = {
      id: `update_${Date.now()}`,
      type: 'update',
      entityId: endUser.id,
      timestamp,
      originalData: originalUser,
    };
    
    setOptimisticOps(prev => [...prev, optimisticOp]);
    setState(prev => ({
      ...prev,
      data: prev.data.map(user => user.id === endUser.id ? updatedUser : user),
    }));
    
    try {
      // Backend handles all business logic and validation
      await putWithAudit(
        tenantId,
        "end_users",
        updatedUser,
        userId,
        { action: "update", description: `End User "${endUser.name}" updated` },
        enqueueItem
      );
      
      // Remove optimistic operation on success
      setOptimisticOps(prev => prev.filter(op => op.id !== optimisticOp.id));
      
    } catch (error) {
      // Rollback optimistic update
      setOptimisticOps(prev => prev.filter(op => op.id !== optimisticOp.id));
      if (originalUser) {
        setState(prev => ({
          ...prev,
          data: prev.data.map(user => user.id === endUser.id ? originalUser : user),
          error: error instanceof Error ? error.message : 'Failed to update end user',
        }));
      }
      throw error;
    }
  }, [tenantId, state.data, enqueueItem]);

  const deleteEndUser = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error('Tenant ID required');
    
    const originalUser = state.data.find(u => u.id === id);
    if (!originalUser) {
      throw new Error('End user not found');
    }
    
    const timestamp = new Date().toISOString();
    
    // Optimistic Update
    const optimisticOp: OptimisticOperation = {
      id: `delete_${Date.now()}`,
      type: 'delete',
      entityId: id,
      timestamp,
      originalData: originalUser,
    };
    
    setOptimisticOps(prev => [...prev, optimisticOp]);
    setState(prev => ({
      ...prev,
      data: prev.data.filter(user => user.id !== id),
    }));
    
    try {
      // Backend handles all business logic and validation
      await removeWithAudit(
        tenantId,
        "end_users",
        id,
        userId,
        { action: "delete", description: `End User ${originalUser.name} deleted` },
        enqueueItem
      );
      
      // Remove optimistic operation on success
      setOptimisticOps(prev => prev.filter(op => op.id !== optimisticOp.id));
      
    } catch (error) {
      // Rollback optimistic update
      setOptimisticOps(prev => prev.filter(op => op.id !== optimisticOp.id));
      setState(prev => ({
        ...prev,
        data: [...prev.data, originalUser],
        error: error instanceof Error ? error.message : 'Failed to delete end user',
      }));
      throw error;
    }
  }, [tenantId, state.data, enqueueItem]);

  // ---------------------------------
  // 10. Client-Side Helpers (UI Performance Only)
  // ---------------------------------
  const getFilteredEndUsers = useCallback((filters: UIFilters) => {
    let filtered = state.data;
    
    if (filters.role) {
      filtered = filtered.filter(user => user.role === filters.role);
    }
    
    if (filters.department) {
      filtered = filtered.filter(user => user.department === filters.department);
    }
    
    if (filters.location_id) {
      filtered = filtered.filter(user => user.location_id === filters.location_id);
    }
    
    if (filters.customer_id) {
      filtered = filtered.filter(user => user.customer_id === filters.customer_id);
    }
    
    if (filters.is_vip !== undefined) {
      filtered = filtered.filter(user => user.is_vip === filters.is_vip);
    }
    
    if (filters.search) {
      const query = filters.search.toLowerCase();
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.username?.toLowerCase().includes(query) ||
        user.job_title?.toLowerCase().includes(query)
      );
    }
    
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(user =>
        filters.tags?.some(tag => user.tags?.includes(tag)) || false
      );
    }
    
    return filtered;
  }, [state.data]);

  const searchEndUsers = useCallback((query: string) => {
    if (!query.trim()) return state.data;
    
    const searchTerm = query.toLowerCase();
    return state.data.filter(user =>
      user.name.toLowerCase().includes(searchTerm) ||
      user.email?.toLowerCase().includes(searchTerm) ||
      user.username?.toLowerCase().includes(searchTerm) ||
      user.employee_id?.toLowerCase().includes(searchTerm) ||
      user.department?.toLowerCase().includes(searchTerm) ||
      user.job_title?.toLowerCase().includes(searchTerm)
    );
  }, [state.data]);

  const getEndUsersByStatus = useCallback((status: EndUser['health_status']) => {
    return state.data.filter(user => user.health_status === status);
  }, [state.data]);

  // ---------------------------------
  // 11. Lifecycle Management
  // ---------------------------------
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshEndUsers();
    } else {
      setState({
        data: [],
        loading: false,
        error: null,
        lastFetch: null,
        isStale: true,
      });
      setOptimisticOps([]);
    }
  }, [tenantId, globalConfig, refreshEndUsers]);

  // Cache cleanup
  useEffect(() => {
    if (cacheCleanupTimerRef.current) {
      clearInterval(cacheCleanupTimerRef.current);
    }
    
    cacheCleanupTimerRef.current = setInterval(() => {
      if (isDataStale()) {
        setState(prev => ({ ...prev, isStale: true }));
      }
      
      // Clean up old optimistic operations
      setOptimisticOps(prev => 
        prev.filter(op => {
          const opAge = Date.now() - new Date(op.timestamp).getTime();
          return opAge < 30000; // Keep for 30 seconds max
        })
      );
    }, 60000); // Check every minute
    
    return () => {
      if (cacheCleanupTimerRef.current) {
        clearInterval(cacheCleanupTimerRef.current);
      }
    };
  }, [isDataStale]);

  // Memory cleanup on unmount
  useEffect(() => {
    return () => {
      setState({
        data: [],
        loading: false,
        error: null,
        lastFetch: null,
        isStale: true,
      });
      setOptimisticOps([]);
    };
  }, []);

  // ---------------------------------
  // 12. Context Value
  // ---------------------------------
  const contextValue = useMemo(() => ({
    state,
    optimisticOps,
    createEndUser,
    updateEndUser,
    deleteEndUser,
    refreshEndUsers,
    getFilteredEndUsers,
    searchEndUsers,
    getEndUsersByStatus,
    invalidateCache,
    isDataStale,
    config,
  }), [
    state,
    optimisticOps,
    createEndUser,
    updateEndUser,
    deleteEndUser,
    refreshEndUsers,
    getFilteredEndUsers,
    searchEndUsers,
    getEndUsersByStatus,
    invalidateCache,
    isDataStale,
    config,
  ]);

  return (
    <EndUsersContext.Provider value={contextValue}>
      {children}
    </EndUsersContext.Provider>
  );
};

// ---------------------------------
// 13. Hooks
// ---------------------------------

/**
 * Main hook for accessing end users state and operations
 * @returns EndUsersContextType
 */
export const useEndUsers = () => {
  const ctx = useContext(EndUsersContext);
  if (!ctx) throw new Error("useEndUsers must be used within EndUsersProvider");
  return ctx;
};

/**
 * Hook for accessing a specific end user by ID
 * @param id - End user ID
 * @returns EndUser or null
 */
export const useEndUserDetails = (id: string) => {
  const { state } = useEndUsers();
  return useMemo(() => 
    state.data.find((u) => u.id === id) || null,
    [state.data, id]
  );
};

/**
 * Hook for filtered end users with memoization
 * @param filters - UI filters
 * @returns Filtered end users array
 */
export const useFilteredEndUsers = (filters: UIFilters) => {
  const { getFilteredEndUsers } = useEndUsers();
  return useMemo(() => getFilteredEndUsers(filters), [getFilteredEndUsers, filters]);
};

/**
 * Hook for VIP end users
 * @returns VIP end users array
 */
export const useVIPEndUsers = () => {
  const { getFilteredEndUsers } = useEndUsers();
  return useMemo(() => getFilteredEndUsers({ is_vip: true }), [getFilteredEndUsers]);
};

/**
 * Hook for end users by role
 * @param role - End user role
 * @returns End users with specified role
 */
export const useEndUsersByRole = (role: EndUserRole) => {
  const { getFilteredEndUsers } = useEndUsers();
  return useMemo(() => getFilteredEndUsers({ role }), [getFilteredEndUsers, role]);
};

/**
 * Hook for end users by health status
 * @param status - Health status
 * @returns End users with specified health status  
 */
export const useEndUsersByStatus = (status: EndUser['health_status']) => {
  const { getEndUsersByStatus } = useEndUsers();
  return useMemo(() => getEndUsersByStatus(status), [getEndUsersByStatus, status]);
};