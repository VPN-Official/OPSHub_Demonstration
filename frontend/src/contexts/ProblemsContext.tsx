// src/contexts/ProblemsContext.tsx - Enterprise Frontend Context (Enhanced)
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
  getById as dbGetById,
  putWithAudit,
  removeWithAudit,
} from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";
import { useEndUsers } from "./EndUsersContext";
import { useIncidents } from "./IncidentsContext";
import { useBusinessServices } from "./BusinessServicesContext";
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
export interface ProblemUIFilters {
  status?: string;
  priority?: string;
  impact?: string;
  assignedToMe?: boolean;
  businessService?: string;
  searchQuery?: string;
  tags?: string[];
  healthStatus?: string;
  reportedBy?: string;
  dateRange?: { start: string; end: string };
  // External system filters
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
  rollbackData?: Problem;
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

export interface Problem extends ExternalSystemFields {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  impact: string;
  urgency: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  closed_at?: string | null;

  // Relationships
  business_service_id?: string | null;
  incident_ids?: string[];
  related_change_ids?: string[];
  related_problem_ids?: string[]; // Parent/child problems
  parent_problem_id?: string | null;
  child_problem_ids?: string[];

  // Assignments
  reported_by?: string; // userId
  assigned_to_user_id?: string | null;
  assigned_to_team_id?: string | null;
  escalation_team_ids?: string[];

  // Business impact (calculated by backend)
  business_impact?: string;
  customer_impact?: string;
  financial_impact?: number;
  affected_user_count?: number;

  // Root cause analysis
  root_cause?: string;
  root_cause_analysis?: string;
  contributing_factors?: string[];
  resolution_summary?: string;

  // Knowledge management
  knowledge_article_ids?: string[];
  runbook_ids?: string[];

  // AI/Automation (provided by backend)
  recommendations?: LinkedRecommendation[];
  auto_assigned?: boolean;
  ai_suggested_priority?: string;
  ai_suggested_category?: string;
  similarity_score?: number; // For duplicate detection

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "synced" | "syncing" | "error" | "conflict";
  tenantId?: string;
}

export interface ProblemDetails extends Problem {
  reporter?: any;
  assignee?: any;
  business_service?: any;
  incidents?: any[];
  related_changes?: any[];
  related_problems?: any[];
  child_problems?: any[];
  parent_problem?: any;
  knowledge_articles?: any[];
}

// ---------------------------------
// 3. API Client Abstraction
// ---------------------------------

interface ProblemAPIClient {
  getAll: (tenantId: string, filters?: Record<string, any>) => Promise<Problem[]>;
  getById: (tenantId: string, id: string) => Promise<Problem | undefined>;
  create: (tenantId: string, problem: Partial<Problem>) => Promise<Problem>;
  update: (tenantId: string, id: string, problem: Partial<Problem>) => Promise<Problem>;
  delete: (tenantId: string, id: string) => Promise<void>;
  getMetrics: (tenantId: string, filters?: Record<string, any>) => Promise<any>;
  validate: (tenantId: string, problem: Partial<Problem>) => Promise<{ valid: boolean; errors?: string[] }>;
  findSimilar: (tenantId: string, problem: Partial<Problem>) => Promise<Problem[]>;
  getRootCauseAnalysis: (tenantId: string, problemId: string) => Promise<any>;
}

// Thin API client wrapper - delegates ALL business logic to backend
const createProblemAPIClient = (): ProblemAPIClient => ({
  async getAll(tenantId: string, filters = {}) {
    // Backend handles complex filtering, sorting, and business rules
    const response = await fetch(`/api/problems?${new URLSearchParams(filters)}`);
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    return response.json();
  },

  async getById(tenantId: string, id: string) {
    return dbGetById<Problem>("problems", id, tenantId);
  },

  async create(tenantId: string, problem: Partial<Problem>) {
    // Backend handles all validation, business rules, similarity detection, etc.
    const response = await fetch('/api/problems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...problem, tenantId })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create problem');
    }
    return response.json();
  },

  async update(tenantId: string, id: string, problem: Partial<Problem>) {
    // Backend handles business validation and state transitions
    const response = await fetch(`/api/problems/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...problem, tenantId })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update problem');
    }
    return response.json();
  },

  async delete(tenantId: string, id: string) {
    // Backend handles cascade deletion and business rules
    const response = await fetch(`/api/problems/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete problem');
    }
  },

  async getMetrics(tenantId: string, filters = {}) {
    // Backend calculates all business metrics
    const response = await fetch(`/api/problems/metrics?${new URLSearchParams(filters)}`);
    if (!response.ok) throw new Error('Failed to load metrics');
    return response.json();
  },

  async validate(tenantId: string, problem: Partial<Problem>) {
    // Backend performs comprehensive business validation
    const response = await fetch('/api/problems/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...problem, tenantId })
    });
    if (!response.ok) throw new Error('Validation failed');
    return response.json();
  },

  async findSimilar(tenantId: string, problem: Partial<Problem>) {
    // Backend performs similarity analysis and duplicate detection
    const response = await fetch('/api/problems/similar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...problem, tenantId })
    });
    if (!response.ok) throw new Error('Similarity search failed');
    return response.json();
  },

  async getRootCauseAnalysis(tenantId: string, problemId: string) {
    // Backend performs root cause analysis
    const response = await fetch(`/api/problems/${problemId}/root-cause-analysis`);
    if (!response.ok) throw new Error('Root cause analysis failed');
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
interface ProblemsContextType {
  // Async state for UI
  problems: AsyncState<Problem>;
  
  // CRUD operations with optimistic updates
  addProblem: (problem: Partial<Problem>, userId?: string) => Promise<void>;
  updateProblem: (id: string, problem: Partial<Problem>, userId?: string) => Promise<void>;
  deleteProblem: (id: string, userId?: string) => Promise<void>;
  
  // Data fetching
  refreshProblems: () => Promise<void>;
  getProblem: (id: string) => Promise<Problem | undefined>;
  
  // Client-side UI helpers (not business logic)
  filterProblems: (filters: ProblemUIFilters) => Problem[];
  searchProblems: (query: string) => Problem[];
  sortProblems: (sortBy: keyof Problem, order: 'asc' | 'desc') => Problem[];
  
  // Problem-specific operations
  findSimilarProblems: (problem: Partial<Problem>) => Promise<Problem[]>;
  getRootCauseAnalysis: (problemId: string) => Promise<any>;
  linkIncidentToProblem: (problemId: string, incidentId: string) => Promise<void>;
  unlinkIncidentFromProblem: (problemId: string, incidentId: string) => Promise<void>;
  
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

const ProblemsContext = createContext<ProblemsContextType | undefined>(undefined);

// ---------------------------------
// 6. Provider Implementation
// ---------------------------------
export const ProblemsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();
  
  // UI State Management
  const [problems, setProblems] = useState<AsyncState<Problem>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    stale: true,
  });
  
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdate[]>([]);
  
  // Memoized instances
  const apiClient = useMemo(() => createProblemAPIClient(), []);
  const cache = useMemo(() => new UICache<Problem[]>(), []);
  
  // Extract UI config from backend config
  const config = useMemo(() => ({
    statuses: globalConfig?.statuses?.problems || [],
    priorities: Object.keys(globalConfig?.priorities || {}),
    impacts: Object.keys(globalConfig?.severities || {}),
    urgencies: Object.keys(globalConfig?.severities || {}),
  }), [globalConfig]);

  // ---------------------------------
  // Cache & Performance Management
  // ---------------------------------
  
  const getCacheKey = useCallback((filters?: Record<string, any>) => 
    `problems_${tenantId}_${JSON.stringify(filters || {})}`, [tenantId]);
  
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
  
  const refreshProblems = useCallback(async (filters?: Record<string, any>) => {
    if (!tenantId) return;
    
    const cacheKey = getCacheKey(filters);
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && !cache.isStale(cacheKey)) {
      setProblems(prev => ({
        ...prev,
        data: cached,
        stale: false,
      }));
      return;
    }
    
    setProblems(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Backend handles sorting, filtering, and business logic
      const data = await apiClient.getAll(tenantId, filters);
      
      // Cache for UI performance
      cache.set(cacheKey, data);
      
      setProblems({
        data,
        loading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        stale: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setProblems(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
        stale: true,
      }));
    }
  }, [tenantId, apiClient, cache, getCacheKey]);

  const getProblem = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    
    // Check current data first for UI responsiveness
    const existing = problems.data.find(p => p.id === id);
    if (existing && !problems.stale) return existing;
    
    try {
      return await apiClient.getById(tenantId, id);
    } catch (error) {
      console.warn(`Failed to fetch problem ${id}:`, error);
      return existing; // Fallback to cached data
    }
  }, [tenantId, apiClient, problems]);

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
    
    setProblems(prev => {
      let newData = [...prev.data];
      
      switch (update.type) {
        case 'create':
          newData = newData.filter(p => p.id !== update.id);
          break;
        case 'update':
          if (update.rollbackData) {
            const index = newData.findIndex(p => p.id === update.id);
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
  
  const addProblem = useCallback(async (problem: Partial<Problem>, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    const optimisticId = `temp-${Date.now()}`;
    const optimisticProblem: Problem = {
      id: optimisticId,
      title: problem.title || '',
      description: problem.description || '',
      status: problem.status || config.statuses[0] || 'new',
      priority: problem.priority || config.priorities[0] || 'P3',
      impact: problem.impact || config.impacts[0] || 'low',
      urgency: problem.urgency || config.urgencies[0] || 'low',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [],
      health_status: "gray",
      tenantId,
      ...problem,
    };
    
    // Optimistic UI update
    setProblems(prev => ({
      ...prev,
      data: [optimisticProblem, ...prev.data],
    }));
    
    const update: OptimisticUpdate = {
      id: optimisticId,
      type: 'create',
      timestamp: new Date().toISOString(),
    };
    addOptimisticUpdate(update);
    
    try {
      // Backend handles ALL business logic
      const created = await apiClient.create(tenantId, problem);
      
      // Replace optimistic with real data
      setProblems(prev => ({
        ...prev,
        data: prev.data.map(p => p.id === optimisticId ? created : p),
      }));
      
      removeOptimisticUpdate(optimisticId);
      invalidateCache();
      
      // Sync for offline support
      await enqueueItem({
        storeName: "problems",
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

  const updateProblem = useCallback(async (id: string, problem: Partial<Problem>, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    const existing = problems.data.find(p => p.id === id);
    if (!existing) throw new Error("Problem not found");
    
    const optimisticProblem = { ...existing, ...problem, updated_at: new Date().toISOString() };
    
    // Optimistic UI update
    setProblems(prev => ({
      ...prev,
      data: prev.data.map(p => p.id === id ? optimisticProblem : p),
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
      const updated = await apiClient.update(tenantId, id, problem);
      
      setProblems(prev => ({
        ...prev,
        data: prev.data.map(p => p.id === id ? updated : p),
      }));
      
      removeOptimisticUpdate(id);
      invalidateCache();
      
      await enqueueItem({
        storeName: "problems",
        entityId: id,
        action: "update",
        payload: updated,
        priority: updated.priority === 'P1' ? 'critical' : 'normal',
      });
      
    } catch (error) {
      rollbackOptimisticUpdate(id);
      throw error;
    }
  }, [tenantId, problems.data, addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate, apiClient, invalidateCache, enqueueItem]);

  const deleteProblem = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    const existing = problems.data.find(p => p.id === id);
    if (!existing) throw new Error("Problem not found");
    
    // Optimistic UI update
    setProblems(prev => ({
      ...prev,
      data: prev.data.filter(p => p.id !== id),
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
        storeName: "problems",
        entityId: id,
        action: "delete",
        payload: null,
      });
      
    } catch (error) {
      rollbackOptimisticUpdate(id);
      throw error;
    }
  }, [tenantId, problems.data, addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate, apiClient, invalidateCache, enqueueItem]);

  // ---------------------------------
  // Problem-Specific Operations
  // ---------------------------------
  
  const findSimilarProblems = useCallback(async (problem: Partial<Problem>) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    try {
      return await apiClient.findSimilar(tenantId, problem);
    } catch (error) {
      console.warn('Failed to find similar problems:', error);
      return [];
    }
  }, [tenantId, apiClient]);
  
  const getRootCauseAnalysis = useCallback(async (problemId: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    try {
      return await apiClient.getRootCauseAnalysis(tenantId, problemId);
    } catch (error) {
      console.warn('Failed to get root cause analysis:', error);
      throw error;
    }
  }, [tenantId, apiClient]);
  
  const linkIncidentToProblem = useCallback(async (problemId: string, incidentId: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    const existing = problems.data.find(p => p.id === problemId);
    if (!existing) throw new Error("Problem not found");
    
    const updatedIncidentIds = [...(existing.incident_ids || []), incidentId];
    await updateProblem(problemId, { incident_ids: updatedIncidentIds });
  }, [tenantId, problems.data, updateProblem]);
  
  const unlinkIncidentFromProblem = useCallback(async (problemId: string, incidentId: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    const existing = problems.data.find(p => p.id === problemId);
    if (!existing) throw new Error("Problem not found");
    
    const updatedIncidentIds = (existing.incident_ids || []).filter(id => id !== incidentId);
    await updateProblem(problemId, { incident_ids: updatedIncidentIds });
  }, [tenantId, problems.data, updateProblem]);

  // ---------------------------------
  // Client-Side UI Helpers (No Business Logic)
  // ---------------------------------
  
  const filterProblems = useCallback((filters: ProblemUIFilters): Problem[] => {
    let filtered = [...problems.data];
    
    if (filters.status) {
      filtered = filtered.filter(p => p.status === filters.status);
    }
    
    if (filters.priority) {
      filtered = filtered.filter(p => p.priority === filters.priority);
    }
    
    if (filters.impact) {
      filtered = filtered.filter(p => p.impact === filters.impact);
    }
    
    if (filters.businessService) {
      filtered = filtered.filter(p => p.business_service_id === filters.businessService);
    }
    
    if (filters.healthStatus) {
      filtered = filtered.filter(p => p.health_status === filters.healthStatus);
    }
    
    if (filters.reportedBy) {
      filtered = filtered.filter(p => p.reported_by === filters.reportedBy);
    }
    
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(p => 
        filters.tags?.some(tag => p.tags?.includes(tag)) || false
      );
    }
    
    if (filters.dateRange) {
      const start = new Date(filters.dateRange.start);
      const end = new Date(filters.dateRange.end);
      filtered = filtered.filter(p => {
        const created = new Date(p.created_at);
        return created >= start && created <= end;
      });
    }
    
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.root_cause?.toLowerCase().includes(query) ||
        p.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [problems.data]);
  
  const searchProblems = useCallback((query: string): Problem[] => {
    return filterProblems({ searchQuery: query });
  }, [filterProblems]);
  
  const sortProblems = useCallback((sortBy: keyof Problem, order: 'asc' | 'desc' = 'desc'): Problem[] => {
    return [...problems.data].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      
      if (aVal === bVal) return 0;
      const result = aVal > bVal ? 1 : -1;
      return order === 'asc' ? result : -result;
    });
  }, [problems.data]);

  // ---------------------------------
  // Initialization & Cleanup
  // ---------------------------------
  
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshProblems();
    }
  }, [tenantId, globalConfig, refreshProblems]);
  
  // Cleanup optimistic updates older than 30 seconds
  useEffect(() => {
    const cleanup = setInterval(() => {
      const thirtySecondsAgo = Date.now() - 30000;
      setOptimisticUpdates(prev => 
        prev.filter(update => 
          new Date(update.timestamp).getTime() > thirtySecondsAgo
        )
      );
    }, 10000);

    return () => clearInterval(cleanup);
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      invalidateCache();
      setOptimisticUpdates([]);
    };
  }, [invalidateCache]);

  return (
    <ProblemsContext.Provider
      value={{
        problems,
        addProblem,
        updateProblem,
        deleteProblem,
        refreshProblems,
        getProblem,
        filterProblems,
        searchProblems,
        sortProblems,
        findSimilarProblems,
        getRootCauseAnalysis,
        linkIncidentToProblem,
        unlinkIncidentFromProblem,
        optimisticUpdates,
        rollbackOptimisticUpdate,
        invalidateCache,
        getCacheStats,
        config,
      }}
    >
      {children}
    </ProblemsContext.Provider>
  );
};

// ---------------------------------
// 7. Hooks for Selective Subscriptions
// ---------------------------------

export const useProblems = (): ProblemsContextType => {
  const ctx = useContext(ProblemsContext);
  if (!ctx) {
    throw new Error("useProblems must be used within a ProblemsProvider");
  }
  return ctx;
};

/**
 * Performance-optimized hook for problem details with caching
 */
export const useProblemDetails = (id: string): {
  problem: ProblemDetails | undefined;
  loading: boolean;
  error: string | null;
} => {
  const { getProblem, problems } = useProblems();
  const { endUsers } = useEndUsers();
  const { incidents } = useIncidents();
  const { businessServices } = useBusinessServices();
  
  const [state, setState] = useState<{
    problem: ProblemDetails | undefined;
    loading: boolean;
    error: string | null;
  }>({
    problem: undefined,
    loading: false,
    error: null,
  });
  
  useEffect(() => {
    let cancelled = false;
    
    const fetchProblemDetails = async () => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      try {
        const problem = await getProblem(id);
        if (!cancelled && problem) {
          // Compose UI-related data
          const reporter = problem.reported_by
            ? endUsers.find((u) => u.id === problem.reported_by)
            : undefined;

          const assignee = problem.assigned_to_user_id
            ? endUsers.find((u) => u.id === problem.assigned_to_user_id)
            : undefined;

          const relatedIncidents = problem.incident_ids
            ? incidents.filter((i) => problem.incident_ids?.includes(i.id))
            : [];

          const business_service = problem.business_service_id
            ? businessServices.find((b) => b.id === problem.business_service_id)
            : undefined;

          const relatedProblems = problem.related_problem_ids
            ? problems.data.filter((p) => problem.related_problem_ids?.includes(p.id))
            : [];

          const childProblems = problem.child_problem_ids
            ? problems.data.filter((p) => problem.child_problem_ids?.includes(p.id))
            : [];

          const parentProblem = problem.parent_problem_id
            ? problems.data.find((p) => p.id === problem.parent_problem_id)
            : undefined;

          const problemDetails: ProblemDetails = {
            ...problem,
            reporter,
            assignee,
            business_service,
            incidents: relatedIncidents,
            related_problems: relatedProblems,
            child_problems: childProblems,
            parent_problem: parentProblem,
          };
          
          setState({
            problem: problemDetails,
            loading: false,
            error: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            problem: undefined,
            loading: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    };
    
    fetchProblemDetails();
    
    return () => { cancelled = true; };
  }, [id, getProblem, endUsers, incidents, businessServices, problems.data]);
  
  return state;
};

/**
 * Memoized hooks for specific problem queries
 */
export const useProblemsByStatus = (status: string) => {
  const { filterProblems } = useProblems();
  return useMemo(() => filterProblems({ status }), [filterProblems, status]);
};

export const useCriticalProblems = () => {
  const { filterProblems } = useProblems();
  return useMemo(() => filterProblems({ priority: 'P1' }), [filterProblems]);
};

export const useOpenProblems = () => {
  const { problems } = useProblems();
  return useMemo(() => 
    problems.data.filter(p => !['resolved', 'closed', 'cancelled'].includes(p.status)),
    [problems.data]
  );
};

export const useMyProblems = (userId: string) => {
  const { filterProblems } = useProblems();
  return useMemo(() => 
    filterProblems({ reportedBy: userId }).concat(
      filterProblems({ assignedToMe: true })
    ),
    [filterProblems, userId]
  );
};

/**
 * Hook for search with debouncing for better performance
 */
export const useProblemSearch = (query: string, debounceMs = 300) => {
  const { searchProblems } = useProblems();
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => clearTimeout(timer);
  }, [query, debounceMs]);
  
  return useMemo(() => 
    debouncedQuery ? searchProblems(debouncedQuery) : [],
    [searchProblems, debouncedQuery]
  );
};

/**
 * Hook for problem metrics and analytics (UI display only)
 */
export const useProblemStats = () => {
  const { problems } = useProblems();
  
  return useMemo(() => {
    const data = problems.data;
    const total = data.length;
    const open = data.filter(p => !['resolved', 'closed'].includes(p.status)).length;
    const critical = data.filter(p => p.priority === 'P1').length;
    const withRootCause = data.filter(p => p.root_cause).length;
    
    return {
      total,
      open,
      critical,
      resolved: total - open,
      rootCauseIdentified: withRootCause,
      averageAge: data.length > 0 ? 
        data.reduce((sum, p) => sum + (Date.now() - new Date(p.created_at).getTime()), 0) / data.length / (24 * 60 * 60 * 1000)
        : 0,
    };
  }, [problems.data]);
};