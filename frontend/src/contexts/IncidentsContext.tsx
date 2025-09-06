// src/contexts/IncidentsContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
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
// 1. Frontend State Management Types
// ---------------------------------

/**
 * Generic async state wrapper for UI operations
 * Provides loading, error, and staleness information to consumers
 */
export interface AsyncState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  lastFetch: string | null;
  stale: boolean;
}

/**
 * UI-specific filters for client-side responsiveness
 * Business filtering should be handled by backend APIs
 */
export interface IncidentUIFilters {
  status?: string;
  priority?: string;
  assignedToMe?: boolean;
  businessService?: string;
  searchQuery?: string;
  // External system filtering
  sourceSystems?: string[];
  syncStatus?: ('synced' | 'syncing' | 'error' | 'conflict')[];
  hasConflicts?: boolean;
  hasLocalChanges?: boolean;
  dataCompleteness?: { min: number; max: number };
}

/**
 * Optimistic update tracking for better UX
 */
interface OptimisticUpdate {
  id: string;
  type: 'create' | 'update' | 'delete';
  timestamp: string;
  rollbackData?: Incident;
}

// ---------------------------------
// 2. Domain Types (From Backend)
// ---------------------------------

export interface LinkedRecommendation {
  reference_id: string;
  type: "runbook" | "knowledge" | "automation" | "ai_agent";
  confidence: number;
  recommendation: string;
  status: "suggested" | "accepted" | "rejected" | "executed";
  suggested_at: string;
  acted_at?: string | null;
  acted_by_user_id?: string | null;
}

export interface Incident extends ExternalSystemFields {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  impact: string;
  urgency: string;
  reported_by: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  closed_at?: string | null;

  // Enhanced relationships
  business_service_id?: string | null;
  service_component_ids: string[];
  asset_ids: string[];
  customer_id?: string | null;
  contract_id?: string | null;
  cost_center_id?: string | null;
  
  // Team assignments
  assigned_to_user_id?: string | null;
  assigned_to_team_id?: string | null;
  escalation_team_ids: string[];

  // MELT correlations
  related_log_ids: string[];
  related_metric_ids: string[];
  related_event_ids: string[];
  related_trace_ids: string[];
  alert_id?: string | null;

  // Work item relationships
  related_problem_ids: string[];
  related_change_ids: string[];
  parent_incident_id?: string | null;
  child_incident_ids: string[];

  // Business impact (calculated by backend)
  business_impact?: string;
  customer_impact?: string;
  financial_impact?: number;
  affected_user_count?: number;

  // SLA tracking (calculated by backend)
  sla_target_minutes?: number;
  resolution_due_at?: string | null;
  breached?: boolean;
  breach_reason?: string;

  // AI/Automation (provided by backend)
  recommendations: LinkedRecommendation[];
  auto_assigned?: boolean;
  ai_suggested_priority?: string;
  ai_suggested_category?: string;

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "synced" | "syncing" | "error" | "conflict";
  tenantId?: string;
}

export interface IncidentDetails extends Incident {
  reporter?: any;
  assignee?: any;
  business_service?: any;
  customer?: any;
  related_problems?: any[];
  related_changes?: any[];
}

// ---------------------------------
// 3. API Client Abstraction
// ---------------------------------

interface IncidentAPIClient {
  getAll: (tenantId: string, filters?: Record<string, any>) => Promise<Incident[]>;
  getById: (tenantId: string, id: string) => Promise<Incident | undefined>;
  create: (tenantId: string, incident: Partial<Incident>) => Promise<Incident>;
  update: (tenantId: string, id: string, incident: Partial<Incident>) => Promise<Incident>;
  delete: (tenantId: string, id: string) => Promise<void>;
  getMetrics: (tenantId: string, filters?: Record<string, any>) => Promise<any>;
  validate: (tenantId: string, incident: Partial<Incident>) => Promise<{ valid: boolean; errors?: string[] }>;
}

// Thin API client wrapper - delegates ALL business logic to backend
const createIncidentAPIClient = (): IncidentAPIClient => ({
  async getAll(tenantId: string, filters = {}) {
    // Backend handles complex filtering, sorting, and business rules
    const response = await fetch(`/api/incidents?${new URLSearchParams(filters)}`);
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    return response.json();
  },

  async getById(tenantId: string, id: string) {
    return getById<Incident>(tenantId, "incidents", id);
  },

  async create(tenantId: string, incident: Partial<Incident>) {
    // Backend handles all validation, business rules, SLA calculations, etc.
    const response = await fetch('/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...incident, tenantId })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create incident');
    }
    return response.json();
  },

  async update(tenantId: string, id: string, incident: Partial<Incident>) {
    // Backend handles business validation and state transitions
    const response = await fetch(`/api/incidents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...incident, tenantId })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update incident');
    }
    return response.json();
  },

  async delete(tenantId: string, id: string) {
    // Backend handles cascade deletion and business rules
    const response = await fetch(`/api/incidents/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete incident');
    }
  },

  async getMetrics(tenantId: string, filters = {}) {
    // Backend calculates all business metrics
    const response = await fetch(`/api/incidents/metrics?${new URLSearchParams(filters)}`);
    if (!response.ok) throw new Error('Failed to load metrics');
    return response.json();
  },

  async validate(tenantId: string, incident: Partial<Incident>) {
    // Backend performs comprehensive business validation
    const response = await fetch('/api/incidents/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...incident, tenantId })
    });
    if (!response.ok) throw new Error('Validation failed');
    return response.json();
  },
});

// ---------------------------------
// 4. Cache Management for UI Performance
// ---------------------------------

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000; // Prevent memory leaks

interface CacheEntry<T> {
  data: T;
  timestamp: string;
  accessCount: number;
  lastAccessed: string;
}

class UICache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  
  set(key: string, data: T): void {
    // LRU eviction when cache is full
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = Array.from(this.cache.entries())
        .sort(([,a], [,b]) => new Date(a.lastAccessed).getTime() - new Date(b.lastAccessed).getTime())[0][0];
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: new Date().toISOString(),
      accessCount: 0,
      lastAccessed: new Date().toISOString(),
    });
  }
  
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check if stale
    if (Date.now() - new Date(entry.timestamp).getTime() > CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    
    // Update access tracking
    entry.accessCount++;
    entry.lastAccessed = new Date().toISOString();
    
    return entry.data;
  }
  
  invalidate(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
  
  isStale(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return true;
    return Date.now() - new Date(entry.timestamp).getTime() > CACHE_TTL;
  }
}

// ---------------------------------
// 5. Context Interface
// ---------------------------------
interface IncidentsContextType {
  // Async state for UI
  incidents: AsyncState<Incident>;
  
  // CRUD operations with optimistic updates
  addIncident: (incident: Partial<Incident>, userId?: string) => Promise<void>;
  updateIncident: (id: string, incident: Partial<Incident>, userId?: string) => Promise<void>;
  deleteIncident: (id: string, userId?: string) => Promise<void>;
  
  // Data fetching
  refreshIncidents: () => Promise<void>;
  getIncident: (id: string) => Promise<Incident | undefined>;
  
  // Client-side UI helpers (not business logic)
  filterIncidents: (filters: IncidentUIFilters) => Incident[];
  searchIncidents: (query: string) => Incident[];
  sortIncidents: (sortBy: keyof Incident, order: 'asc' | 'desc') => Incident[];
  
  // Optimistic update state
  optimisticUpdates: OptimisticUpdate[];
  rollbackOptimisticUpdate: (updateId: string) => void;
  
  // Cache management
  invalidateCache: (key?: string) => void;
  getCacheStats: () => { size: number; hitRate: number };
  
  // Backend config integration (read-only from backend)
  config: {
    statuses: string[];
    priorities: string[];
    impacts: string[];
    urgencies: string[];
  };
}

const IncidentsContext = createContext<IncidentsContextType | undefined>(undefined);

// ---------------------------------
// 6. Provider Implementation
// ---------------------------------
export const IncidentsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();
  
  // UI State Management
  const [incidents, setIncidents] = useState<AsyncState<Incident>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    stale: true,
  });
  
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdate[]>([]);
  
  // Memoized instances
  const apiClient = useMemo(() => createIncidentAPIClient(), []);
  const cache = useMemo(() => new UICache<Incident[]>(), []);
  
  // Extract UI config from backend config
  const config = useMemo(() => ({
    statuses: globalConfig?.statuses?.incidents || [],
    priorities: Object.keys(globalConfig?.priorities || {}),
    impacts: Object.keys(globalConfig?.severities || {}),
    urgencies: Object.keys(globalConfig?.severities || {}),
  }), [globalConfig]);

  // ---------------------------------
  // Cache & Performance Management
  // ---------------------------------
  
  const getCacheKey = useCallback((filters?: Record<string, any>) => 
    `incidents_${tenantId}_${JSON.stringify(filters || {})}`, [tenantId]);
  
  const invalidateCache = useCallback((key?: string) => {
    if (key) {
      cache.invalidate(key);
    } else {
      cache.invalidate();
    }
  }, [cache]);
  
  const getCacheStats = useCallback(() => {
    const entries = Array.from((cache as any).cache.values());
    const totalAccesses = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
    const hits = entries.filter(entry => entry.accessCount > 0).length;
    return {
      size: entries.length,
      hitRate: totalAccesses > 0 ? hits / totalAccesses : 0,
    };
  }, [cache]);

  // ---------------------------------
  // Data Fetching with Cache
  // ---------------------------------
  
  const refreshIncidents = useCallback(async (filters?: Record<string, any>) => {
    if (!tenantId) return;
    
    const cacheKey = getCacheKey(filters);
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && !cache.isStale(cacheKey)) {
      setIncidents(prev => ({
        ...prev,
        data: cached,
        stale: false,
      }));
      return;
    }
    
    setIncidents(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Backend handles sorting, filtering, and business logic
      const data = await apiClient.getAll(tenantId, filters);
      
      // Cache for UI performance
      cache.set(cacheKey, data);
      
      setIncidents({
        data,
        loading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        stale: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setIncidents(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
        stale: true,
      }));
    }
  }, [tenantId, apiClient, cache, getCacheKey]);

  const getIncident = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    
    // Check current data first for UI responsiveness
    const existing = incidents.data.find(i => i.id === id);
    if (existing && !incidents.stale) return existing;
    
    try {
      return await apiClient.getById(tenantId, id);
    } catch (error) {
      console.warn(`Failed to fetch incident ${id}:`, error);
      return existing; // Fallback to cached data
    }
  }, [tenantId, apiClient, incidents]);

  // ---------------------------------
  // Optimistic Updates for Better UX
  // ---------------------------------
  
  const addOptimisticUpdate = useCallback((update: OptimisticUpdate) => {
    setOptimisticUpdates(prev => [...prev, update]);
  }, []);
  
  const removeOptimisticUpdate = useCallback((updateId: string) => {
    setOptimisticUpdates(prev => prev.filter(u => u.id !== updateId));
  }, []);
  
  const rollbackOptimisticUpdate = useCallback((updateId: string) => {
    const update = optimisticUpdates.find(u => u.id === updateId);
    if (!update) return;
    
    setIncidents(prev => {
      let newData = [...prev.data];
      
      switch (update.type) {
        case 'create':
          newData = newData.filter(i => i.id !== update.id);
          break;
        case 'update':
          if (update.rollbackData) {
            const index = newData.findIndex(i => i.id === update.id);
            if (index >= 0) newData[index] = update.rollbackData;
          }
          break;
        case 'delete':
          if (update.rollbackData) {
            newData.push(update.rollbackData);
          }
          break;
      }
      
      return { ...prev, data: newData };
    });
    
    removeOptimisticUpdate(updateId);
  }, [optimisticUpdates, removeOptimisticUpdate]);

  // ---------------------------------
  // CRUD Operations with Optimistic Updates
  // ---------------------------------
  
  const addIncident = useCallback(async (incident: Partial<Incident>, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    const optimisticId = `temp-${Date.now()}`;
    const optimisticIncident: Incident = {
      id: optimisticId,
      title: incident.title || '',
      description: incident.description || '',
      status: incident.status || config.statuses[0] || 'new',
      priority: incident.priority || config.priorities[0] || 'P3',
      impact: incident.impact || config.impacts[0] || 'low',
      urgency: incident.urgency || config.urgencies[0] || 'low',
      reported_by: incident.reported_by || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      service_component_ids: [],
      asset_ids: [],
      escalation_team_ids: [],
      related_log_ids: [],
      related_metric_ids: [],
      related_event_ids: [],
      related_trace_ids: [],
      related_problem_ids: [],
      related_change_ids: [],
      child_incident_ids: [],
      recommendations: [],
      tags: [],
      health_status: "gray",
      tenantId,
      ...incident,
    };
    
    // Optimistic UI update
    setIncidents(prev => ({
      ...prev,
      data: [optimisticIncident, ...prev.data],
    }));
    
    const update: OptimisticUpdate = {
      id: optimisticId,
      type: 'create',
      timestamp: new Date().toISOString(),
    };
    addOptimisticUpdate(update);
    
    try {
      // Backend handles ALL business logic
      const created = await apiClient.create(tenantId, incident);
      
      // Replace optimistic with real data
      setIncidents(prev => ({
        ...prev,
        data: prev.data.map(i => i.id === optimisticId ? created : i),
      }));
      
      removeOptimisticUpdate(optimisticId);
      invalidateCache();
      
      // Sync for offline support
      await enqueueItem({
        storeName: "incidents",
        entityId: created.id,
        action: "create",
        payload: created,
        priority: created.priority === 'P1' ? 'critical' : 'normal',
      });
      
    } catch (error) {
      // Rollback on failure
      rollbackOptimisticUpdate(optimisticId);
      throw error;
    }
  }, [tenantId, config, addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate, apiClient, invalidateCache, enqueueItem]);

  const updateIncident = useCallback(async (id: string, incident: Partial<Incident>, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    const existing = incidents.data.find(i => i.id === id);
    if (!existing) throw new Error("Incident not found");
    
    const optimisticIncident = { ...existing, ...incident, updated_at: new Date().toISOString() };
    
    // Optimistic UI update
    setIncidents(prev => ({
      ...prev,
      data: prev.data.map(i => i.id === id ? optimisticIncident : i),
    }));
    
    const update: OptimisticUpdate = {
      id,
      type: 'update',
      timestamp: new Date().toISOString(),
      rollbackData: existing,
    };
    addOptimisticUpdate(update);
    
    try {
      // Backend handles business logic and state transitions
      const updated = await apiClient.update(tenantId, id, incident);
      
      setIncidents(prev => ({
        ...prev,
        data: prev.data.map(i => i.id === id ? updated : i),
      }));
      
      removeOptimisticUpdate(id);
      invalidateCache();
      
      await enqueueItem({
        storeName: "incidents",
        entityId: id,
        action: "update",
        payload: updated,
        priority: updated.priority === 'P1' ? 'critical' : 'normal',
      });
      
    } catch (error) {
      rollbackOptimisticUpdate(id);
      throw error;
    }
  }, [tenantId, incidents.data, addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate, apiClient, invalidateCache, enqueueItem]);

  const deleteIncident = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    const existing = incidents.data.find(i => i.id === id);
    if (!existing) throw new Error("Incident not found");
    
    // Optimistic UI update
    setIncidents(prev => ({
      ...prev,
      data: prev.data.filter(i => i.id !== id),
    }));
    
    const update: OptimisticUpdate = {
      id,
      type: 'delete',
      timestamp: new Date().toISOString(),
      rollbackData: existing,
    };
    addOptimisticUpdate(update);
    
    try {
      await apiClient.delete(tenantId, id);
      
      removeOptimisticUpdate(id);
      invalidateCache();
      
      await enqueueItem({
        storeName: "incidents",
        entityId: id,
        action: "delete",
        payload: null,
      });
      
    } catch (error) {
      rollbackOptimisticUpdate(id);
      throw error;
    }
  }, [tenantId, incidents.data, addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate, apiClient, invalidateCache, enqueueItem]);

  // ---------------------------------
  // Client-Side UI Helpers (No Business Logic)
  // ---------------------------------
  
  const filterIncidents = useCallback((filters: IncidentUIFilters): Incident[] => {
    let filtered = [...incidents.data];
    
    if (filters.status) {
      filtered = filtered.filter(i => i.status === filters.status);
    }
    
    if (filters.priority) {
      filtered = filtered.filter(i => i.priority === filters.priority);
    }
    
    if (filters.businessService) {
      filtered = filtered.filter(i => i.business_service_id === filters.businessService);
    }
    
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(i =>
        i.title.toLowerCase().includes(query) ||
        i.description.toLowerCase().includes(query) ||
        i.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [incidents.data]);
  
  const searchIncidents = useCallback((query: string): Incident[] => {
    return filterIncidents({ searchQuery: query });
  }, [filterIncidents]);
  
  const sortIncidents = useCallback((sortBy: keyof Incident, order: 'asc' | 'desc' = 'desc'): Incident[] => {
    return [...incidents.data].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      
      if (aVal === bVal) return 0;
      const result = aVal > bVal ? 1 : -1;
      return order === 'asc' ? result : -result;
    });
  }, [incidents.data]);

  // ---------------------------------
  // Initialization & Cleanup
  // ---------------------------------
  
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshIncidents();
    }
  }, [tenantId, globalConfig, refreshIncidents]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      invalidateCache();
      setOptimisticUpdates([]);
    };
  }, [invalidateCache]);

  return (
    <IncidentsContext.Provider
      value={{
        incidents,
        addIncident,
        updateIncident,
        deleteIncident,
        refreshIncidents,
        getIncident,
        filterIncidents,
        searchIncidents,
        sortIncidents,
        optimisticUpdates,
        rollbackOptimisticUpdate,
        invalidateCache,
        getCacheStats,
        config,
      }}
    >
      {children}
    </IncidentsContext.Provider>
  );
};

// ---------------------------------
// 7. Hooks for Selective Subscriptions
// ---------------------------------

export const useIncidents = (): IncidentsContextType => {
  const ctx = useContext(IncidentsContext);
  if (!ctx) {
    throw new Error("useIncidents must be used within IncidentsProvider");
  }
  return ctx;
};

/**
 * Performance-optimized hook for incident details with caching
 */
export const useIncidentDetails = (id: string): {
  incident: IncidentDetails | undefined;
  loading: boolean;
  error: string | null;
} => {
  const { getIncident, incidents } = useIncidents();
  const [state, setState] = useState<{
    incident: IncidentDetails | undefined;
    loading: boolean;
    error: string | null;
  }>({
    incident: undefined,
    loading: false,
    error: null,
  });
  
  useEffect(() => {
    let cancelled = false;
    
    const fetchIncident = async () => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      try {
        const incident = await getIncident(id);
        if (!cancelled) {
          setState({
            incident: incident as IncidentDetails,
            loading: false,
            error: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            incident: undefined,
            loading: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    };
    
    fetchIncident();
    
    return () => { cancelled = true; };
  }, [id, getIncident]);
  
  return state;
};

/**
 * Memoized hooks for specific incident queries
 */
export const useIncidentsByStatus = (status: string) => {
  const { filterIncidents } = useIncidents();
  return useMemo(() => filterIncidents({ status }), [filterIncidents, status]);
};

export const useCriticalIncidents = () => {
  const { filterIncidents } = useIncidents();
  return useMemo(() => filterIncidents({ priority: 'P1' }), [filterIncidents]);
};

export const useOpenIncidents = () => {
  const { incidents } = useIncidents();
  return useMemo(() => 
    incidents.data.filter(i => !['resolved', 'closed', 'cancelled'].includes(i.status)),
    [incidents.data]
  );
};

export const useBreachedIncidents = () => {
  const { incidents } = useIncidents();
  return useMemo(() => 
    incidents.data.filter(i => i.breached === true),
    [incidents.data]
  );
};

/**
 * Hook for search with debouncing for better performance
 */
export const useIncidentSearch = (query: string, debounceMs = 300) => {
  const { searchIncidents } = useIncidents();
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => clearTimeout(timer);
  }, [query, debounceMs]);
  
  return useMemo(() => 
    debouncedQuery ? searchIncidents(debouncedQuery) : [],
    [searchIncidents, debouncedQuery]
  );
};