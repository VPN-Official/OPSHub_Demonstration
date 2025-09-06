// src/contexts/ServiceComponentsContext.tsx - ENTERPRISE FRONTEND PATTERNS
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { getAll, getById, putWithAudit, removeWithAudit } from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";
import { ExternalSystemFields } from "../types/externalSystem";

// ---------------------------------
// 1. Frontend State Types
// ---------------------------------

/**
 * Generic async state container for frontend UI state management
 */
export interface AsyncState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  lastFetch: string | null;
  stale: boolean;
  optimisticUpdates: Record<string, T>; // Track optimistic UI updates
}

/**
 * Service Component entity (matches backend API contract)
 */
export interface ServiceComponent extends ExternalSystemFields {
  id: string;
  name: string;
  description: string;
  type: string;   // config-driven
  status: string; // config-driven
  created_at: string;
  updated_at: string;

  // Business relationships (managed by backend)
  business_service_id: string;
  asset_ids: string[];
  vendor_id?: string | null;
  team_id?: string | null;
  dependency_component_ids: string[];

  // Business metrics (calculated by backend)
  sla_target_uptime?: number;
  response_time_ms?: number;
  error_rate?: number;
  risk_score?: number;
  compliance_requirement_ids: string[];
  criticality?: string; // config-driven

  // UI metadata only
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  tenantId?: string;
}

/**
 * Client-side filtering options for immediate UI responsiveness
 */
export interface ServiceComponentFilters {
  type?: string;
  status?: string;
  business_service_id?: string;
  criticality?: string;
  health_status?: ("green" | "yellow" | "orange" | "red" | "gray")[];
  search?: string;
  
  // External system filtering
  source_system?: string;
  sync_status?: 'synced' | 'syncing' | 'error' | 'conflict';
  has_local_changes?: boolean;
}

/**
 * UI-focused operations tracking
 */
interface OperationState {
  loading: boolean;
  error: string | null;
}

// ---------------------------------
// 2. Frontend Context Interface
// ---------------------------------
interface ServiceComponentsContextType {
  // UI State
  state: AsyncState<ServiceComponent>;
  operations: {
    creating: OperationState;
    updating: OperationState;
    deleting: OperationState;
  };

  // Data Operations (API orchestration only)
  refreshServiceComponents: () => Promise<void>;
  addServiceComponent: (sc: ServiceComponent, userId?: string) => Promise<void>;
  updateServiceComponent: (sc: ServiceComponent, userId?: string) => Promise<void>;
  deleteServiceComponent: (id: string, userId?: string) => Promise<void>;
  getServiceComponent: (id: string) => Promise<ServiceComponent | undefined>;

  // Client-side UI helpers (no business logic)
  getFilteredComponents: (filters: ServiceComponentFilters) => ServiceComponent[];
  searchComponents: (query: string) => ServiceComponent[];
  getComponentsByBusinessService: (businessServiceId: string) => ServiceComponent[];
  getComponentsByType: (type: string) => ServiceComponent[];
  getComponentsByStatus: (status: string) => ServiceComponent[];
  getComponentsByHealthStatus: (healthStatus: string) => ServiceComponent[];

  // UI Configuration from backend
  config: {
    types: string[];
    statuses: string[];
    criticality_levels: string[];
  };

  // Cache management
  invalidateCache: () => void;
  getCacheAge: () => number;
}

const ServiceComponentsContext = createContext<ServiceComponentsContextType | undefined>(undefined);

// ---------------------------------
// 3. Configuration Constants
// ---------------------------------
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEBOUNCE_DELAY = 300; // For search
const MAX_OPTIMISTIC_UPDATES = 10;

// ---------------------------------
// 4. Provider Implementation
// ---------------------------------
export const ServiceComponentsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig, validateEnum } = useConfig();

  // Frontend UI State
  const [state, setState] = useState<AsyncState<ServiceComponent>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    stale: false,
    optimisticUpdates: {}
  });

  const [operations, setOperations] = useState({
    creating: { loading: false, error: null },
    updating: { loading: false, error: null },
    deleting: { loading: false, error: null }
  });

  // Extract UI configuration from backend-provided config
  const config = useMemo(() => ({
    types: globalConfig?.business?.service_components?.types || 
           ['application', 'database', 'middleware', 'infrastructure', 'network', 'security', 'monitoring'],
    statuses: globalConfig?.statuses?.service_components || 
              ['operational', 'degraded', 'outage', 'maintenance', 'retired'],
    criticality_levels: globalConfig?.business?.service_components?.criticality_levels || 
                       ['low', 'medium', 'high', 'critical'],
  }), [globalConfig]);

  // ---------------------------------
  // 5. Basic UI Validation (not business logic)
  // ---------------------------------
  const validateForUI = useCallback((sc: ServiceComponent) => {
    // Basic UI field validation only - business validation happens on backend
    if (!sc.name || sc.name.trim().length < 2) {
      throw new Error("Name must be at least 2 characters long");
    }

    if (!sc.description || sc.description.trim().length < 5) {
      throw new Error("Description must be at least 5 characters long");
    }

    if (!sc.business_service_id) {
      throw new Error("Business service is required");
    }

    // Basic enum validation using config
    if (!config.types.includes(sc.type)) {
      throw new Error(`Invalid type. Valid options: ${config.types.join(', ')}`);
    }

    if (!validateEnum && !config.statuses.includes(sc.status)) {
      throw new Error(`Invalid status. Valid options: ${config.statuses.join(', ')}`);
    }
  }, [config, validateEnum]);

  // ---------------------------------
  // 6. UI Metadata Management
  // ---------------------------------
  const ensureUIMetadata = useCallback((sc: ServiceComponent): ServiceComponent => {
    const now = new Date().toISOString();
    return {
      ...sc,
      tenantId,
      tags: sc.tags || [],
      health_status: sc.health_status || "gray",
      sync_status: sc.sync_status || "syncing",
      synced_at: sc.synced_at || now,
      asset_ids: sc.asset_ids || [],
      dependency_component_ids: sc.dependency_component_ids || [],
      compliance_requirement_ids: sc.compliance_requirement_ids || [],
    };
  }, [tenantId]);

  // ---------------------------------
  // 7. API Orchestration Methods
  // ---------------------------------
  const refreshServiceComponents = useCallback(async () => {
    if (!tenantId) return;
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Backend handles all business logic: sorting, prioritization, calculations
      const components = await getAll<ServiceComponent>(tenantId, "service_components");
      
      setState(prev => ({
        ...prev,
        data: components,
        loading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        stale: false,
        optimisticUpdates: {} // Clear optimistic updates on successful fetch
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load service components';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
        stale: true
      }));
    }
  }, [tenantId]);

  const getServiceComponent = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    
    try {
      return await getById<ServiceComponent>(tenantId, "service_components", id);
    } catch (error) {
      console.error(`Failed to get service component ${id}:`, error);
      return undefined;
    }
  }, [tenantId]);

  // ---------------------------------
  // 8. Optimistic UI Operations
  // ---------------------------------
  const addServiceComponent = useCallback(async (sc: ServiceComponent, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    // Basic UI validation only
    validateForUI(sc);

    const optimisticComponent = ensureUIMetadata({
      ...sc,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Optimistic UI update
    setState(prev => ({
      ...prev,
      data: [optimisticComponent, ...prev.data],
      optimisticUpdates: {
        ...prev.optimisticUpdates,
        [optimisticComponent.id]: optimisticComponent
      }
    }));

    setOperations(prev => ({ 
      ...prev, 
      creating: { loading: true, error: null } 
    }));

    try {
      // Backend handles ALL business logic, validation, calculations
      await putWithAudit(
        tenantId,
        "service_components",
        optimisticComponent,
        userId,
        {
          action: "create",
          description: `Created service component: ${sc.name}`,
          tags: ["service_component", "create", sc.type],
          metadata: { type: sc.type, business_service_id: sc.business_service_id },
        }
      );

      await enqueueItem({
        storeName: "service_components",
        entityId: optimisticComponent.id,
        action: "create",
        payload: optimisticComponent,
      });

      setOperations(prev => ({ 
        ...prev, 
        creating: { loading: false, error: null } 
      }));

      // Clear optimistic update on success
      setState(prev => {
        const { [optimisticComponent.id]: _, ...remainingUpdates } = prev.optimisticUpdates;
        return {
          ...prev,
          optimisticUpdates: remainingUpdates
        };
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create service component';
      
      setOperations(prev => ({ 
        ...prev, 
        creating: { loading: false, error: errorMessage } 
      }));

      // Rollback optimistic update
      setState(prev => ({
        ...prev,
        data: prev.data.filter(c => c.id !== optimisticComponent.id),
        optimisticUpdates: {
          ...prev.optimisticUpdates,
          [optimisticComponent.id]: undefined
        }
      }));

      throw error;
    }
  }, [tenantId, validateForUI, ensureUIMetadata, enqueueItem]);

  const updateServiceComponent = useCallback(async (sc: ServiceComponent, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateForUI(sc);

    const updatedComponent = ensureUIMetadata({
      ...sc,
      updated_at: new Date().toISOString(),
    });

    // Optimistic UI update
    setState(prev => ({
      ...prev,
      data: prev.data.map(c => c.id === updatedComponent.id ? updatedComponent : c),
      optimisticUpdates: {
        ...prev.optimisticUpdates,
        [updatedComponent.id]: updatedComponent
      }
    }));

    setOperations(prev => ({ 
      ...prev, 
      updating: { loading: true, error: null } 
    }));

    try {
      // Backend handles ALL business logic
      await putWithAudit(
        tenantId,
        "service_components",
        updatedComponent,
        userId,
        {
          action: "update",
          description: `Updated service component: ${sc.name}`,
          tags: ["service_component", "update", sc.type],
          metadata: { type: sc.type, business_service_id: sc.business_service_id },
        }
      );

      await enqueueItem({
        storeName: "service_components",
        entityId: updatedComponent.id,
        action: "update",
        payload: updatedComponent,
      });

      setOperations(prev => ({ 
        ...prev, 
        updating: { loading: false, error: null } 
      }));

      // Clear optimistic update on success
      setState(prev => {
        const { [updatedComponent.id]: _, ...remainingUpdates } = prev.optimisticUpdates;
        return {
          ...prev,
          optimisticUpdates: remainingUpdates
        };
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update service component';
      
      setOperations(prev => ({ 
        ...prev, 
        updating: { loading: false, error: errorMessage } 
      }));

      // Rollback optimistic update by refreshing data
      await refreshServiceComponents();
      throw error;
    }
  }, [tenantId, validateForUI, ensureUIMetadata, enqueueItem, refreshServiceComponents]);

  const deleteServiceComponent = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    const component = await getServiceComponent(id);
    if (!component) throw new Error(`Service component ${id} not found`);

    // Optimistic UI update
    setState(prev => ({
      ...prev,
      data: prev.data.filter(c => c.id !== id)
    }));

    setOperations(prev => ({ 
      ...prev, 
      deleting: { loading: true, error: null } 
    }));

    try {
      // Backend handles ALL business logic
      await removeWithAudit(
        tenantId,
        "service_components",
        id,
        userId,
        {
          action: "delete",
          description: `Deleted service component: ${component.name}`,
          tags: ["service_component", "delete", component.type],
          metadata: { type: component.type, business_service_id: component.business_service_id },
        }
      );

      await enqueueItem({
        storeName: "service_components",
        entityId: id,
        action: "delete",
        payload: null,
      });

      setOperations(prev => ({ 
        ...prev, 
        deleting: { loading: false, error: null } 
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete service component';
      
      setOperations(prev => ({ 
        ...prev, 
        deleting: { loading: false, error: errorMessage } 
      }));

      // Rollback optimistic update
      await refreshServiceComponents();
      throw error;
    }
  }, [tenantId, getServiceComponent, enqueueItem, refreshServiceComponents]);

  // ---------------------------------
  // 9. Client-Side UI Helpers (No Business Logic)
  // ---------------------------------
  const getFilteredComponents = useCallback((filters: ServiceComponentFilters) => {
    return state.data.filter(component => {
      if (filters.type && component.type !== filters.type) return false;
      if (filters.status && component.status !== filters.status) return false;
      if (filters.business_service_id && component.business_service_id !== filters.business_service_id) return false;
      if (filters.criticality && component.criticality !== filters.criticality) return false;
      if (filters.health_status && filters.health_status.length > 0 && 
          !filters.health_status.includes(component.health_status)) return false;
      if (filters.search && !component.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
      
      return true;
    });
  }, [state.data]);

  const searchComponents = useCallback((query: string) => {
    if (!query.trim()) return state.data;
    
    const lowercaseQuery = query.toLowerCase();
    return state.data.filter(component =>
      component.name.toLowerCase().includes(lowercaseQuery) ||
      component.description.toLowerCase().includes(lowercaseQuery) ||
      component.type.toLowerCase().includes(lowercaseQuery) ||
      component.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    );
  }, [state.data]);

  // Simple client-side filtering for immediate UI responsiveness
  const getComponentsByBusinessService = useCallback((businessServiceId: string) => {
    return state.data.filter(c => c.business_service_id === businessServiceId);
  }, [state.data]);

  const getComponentsByType = useCallback((type: string) => {
    return state.data.filter(c => c.type === type);
  }, [state.data]);

  const getComponentsByStatus = useCallback((status: string) => {
    return state.data.filter(c => c.status === status);
  }, [state.data]);

  const getComponentsByHealthStatus = useCallback((healthStatus: string) => {
    return state.data.filter(c => c.health_status === healthStatus);
  }, [state.data]);

  // ---------------------------------
  // 10. Cache Management
  // ---------------------------------
  const invalidateCache = useCallback(() => {
    setState(prev => ({ ...prev, stale: true, lastFetch: null }));
  }, []);

  const getCacheAge = useCallback(() => {
    if (!state.lastFetch) return Infinity;
    return Date.now() - new Date(state.lastFetch).getTime();
  }, [state.lastFetch]);

  // ---------------------------------
  // 11. Effects
  // ---------------------------------
  
  // Initialize data when tenant or config changes
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshServiceComponents();
    } else {
      setState({
        data: [],
        loading: false,
        error: null,
        lastFetch: null,
        stale: false,
        optimisticUpdates: {}
      });
    }
  }, [tenantId, globalConfig, refreshServiceComponents]);

  // Mark data as stale after TTL
  useEffect(() => {
    if (!state.lastFetch) return;

    const timer = setTimeout(() => {
      setState(prev => ({ ...prev, stale: true }));
    }, CACHE_TTL_MS);

    return () => clearTimeout(timer);
  }, [state.lastFetch]);

  // Cleanup optimistic updates if they exceed limit
  useEffect(() => {
    const optimisticCount = Object.keys(state.optimisticUpdates).length;
    if (optimisticCount > MAX_OPTIMISTIC_UPDATES) {
      setState(prev => {
        const updates = Object.entries(prev.optimisticUpdates)
          .slice(-MAX_OPTIMISTIC_UPDATES)
          .reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
          }, {} as Record<string, ServiceComponent>);
        
        return { ...prev, optimisticUpdates: updates };
      });
    }
  }, [state.optimisticUpdates]);

  // ---------------------------------
  // 12. Context Value
  // ---------------------------------
  const contextValue = useMemo<ServiceComponentsContextType>(() => ({
    state,
    operations,
    refreshServiceComponents,
    addServiceComponent,
    updateServiceComponent,
    deleteServiceComponent,
    getServiceComponent,
    getFilteredComponents,
    searchComponents,
    getComponentsByBusinessService,
    getComponentsByType,
    getComponentsByStatus,
    getComponentsByHealthStatus,
    config,
    invalidateCache,
    getCacheAge,
  }), [
    state,
    operations,
    refreshServiceComponents,
    addServiceComponent,
    updateServiceComponent,
    deleteServiceComponent,
    getServiceComponent,
    getFilteredComponents,
    searchComponents,
    getComponentsByBusinessService,
    getComponentsByType,
    getComponentsByStatus,
    getComponentsByHealthStatus,
    config,
    invalidateCache,
    getCacheAge
  ]);

  return (
    <ServiceComponentsContext.Provider value={contextValue}>
      {children}
    </ServiceComponentsContext.Provider>
  );
};

// ---------------------------------
// 13. Hooks
// ---------------------------------

/**
 * Main hook for service components UI state management
 */
export const useServiceComponents = () => {
  const ctx = useContext(ServiceComponentsContext);
  if (!ctx) throw new Error("useServiceComponents must be used within ServiceComponentsProvider");
  return ctx;
};

/**
 * Hook for specific service component by ID
 */
export const useServiceComponentDetails = (id: string) => {
  const { state } = useServiceComponents();
  
  return useMemo(() => {
    // Check optimistic updates first, then main data
    return state.optimisticUpdates[id] || state.data.find((c) => c.id === id) || null;
  }, [state.data, state.optimisticUpdates, id]);
};

/**
 * Hook for filtered service components with memoization
 */
export const useFilteredServiceComponents = (filters: ServiceComponentFilters) => {
  const { getFilteredComponents } = useServiceComponents();
  
  return useMemo(() => {
    return getFilteredComponents(filters);
  }, [getFilteredComponents, filters]);
};

/**
 * Hook for service components by business service with automatic updates
 */
export const useServiceComponentsByBusinessService = (businessServiceId: string) => {
  const { getComponentsByBusinessService } = useServiceComponents();
  
  return useMemo(() => {
    return getComponentsByBusinessService(businessServiceId);
  }, [getComponentsByBusinessService, businessServiceId]);
};

/**
 * Hook for real-time search with debouncing
 */
export const useServiceComponentSearch = (query: string) => {
  const { searchComponents } = useServiceComponents();
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_DELAY);
    return () => clearTimeout(timer);
  }, [query]);

  return useMemo(() => {
    return searchComponents(debouncedQuery);
  }, [searchComponents, debouncedQuery]);
};

/**
 * Hook for cache status monitoring
 */
export const useServiceComponentsCache = () => {
  const { state, getCacheAge, invalidateCache } = useServiceComponents();
  
  const cacheAge = getCacheAge();
  const isCacheStale = state.stale || cacheAge > CACHE_TTL_MS;
  const hasCachedData = state.data.length > 0 && state.lastFetch !== null;
  
  return {
    cacheAge,
    isCacheStale,
    hasCachedData,
    lastFetch: state.lastFetch,
    invalidateCache
  };
};