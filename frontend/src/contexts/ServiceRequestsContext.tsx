// src/contexts/ServiceRequestsContext.tsx
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
export interface ServiceRequestUIFilters {
  status?: string;
  priority?: string;
  urgency?: string;
  requestType?: string;
  assignedToMe?: boolean;
  businessService?: string;
  searchQuery?: string;
  healthStatus?: string;
  tags?: string[];
  
  // External system filtering
  source_system?: string;
  sync_status?: 'synced' | 'syncing' | 'error' | 'conflict';
  has_local_changes?: boolean;
}

/**
 * Optimistic update tracking for better UX
 */
interface OptimisticUpdate {
  id: string;
  type: 'create' | 'update' | 'delete';
  timestamp: string;
  rollbackData?: ServiceRequest;
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

export interface ServiceRequest extends ExternalSystemFields {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  urgency: string;
  created_at: string;
  updated_at: string;
  fulfilled_at?: string | null;
  closed_at?: string | null;

  // Business & Service Links
  business_service_id?: string | null;
  service_component_ids: string[];
  asset_ids: string[];
  customer_id?: string | null;
  contract_id?: string | null;
  cost_center_id?: string | null;

  // People & Teams
  requested_by_end_user_id: string;
  requested_by_user_id?: string | null;
  approved_by_user_ids: string[];
  assigned_to_user_id?: string | null;
  assigned_to_team_id?: string | null;
  escalation_team_ids: string[];

  // Classification
  request_type: string;
  category: string;
  subcategory: string;
  product_family: string;

  // Fulfillment & Workflow
  fulfillment_type: string;
  approval_required: boolean;
  approval_workflow: {
    step: string;
    approver_id: string;
    status: string;
    timestamp: string;
  }[];
  tasks: {
    id: string;
    title: string;
    status: string;
    assigned_to_user_id?: string | null;
    due_at?: string | null;
  }[];
  sla_target_minutes?: number;
  resolution_due_at?: string | null;
  breached?: boolean;

  // Relationships
  related_incident_ids: string[];
  related_problem_ids: string[];
  related_change_ids: string[];

  // MELT Links
  related_log_ids: string[];
  related_metric_ids: string[];
  related_event_ids: string[];
  related_trace_ids: string[];

  // Business Impact (calculated by backend)
  business_impact?: string;
  customer_impact?: string;
  financial_impact?: number;
  estimated_cost?: number | null;
  actual_cost?: number | null;
  billable_hours?: number | null;
  parts_cost?: number | null;
  customer_impact_summary?: string;
  affected_user_count?: number;

  // Risk & Compliance
  risk_score?: number;
  compliance_requirement_ids: string[];

  // SLA tracking (calculated by backend)
  fulfillment_due_at?: string | null;
  sla_breached?: boolean;
  breach_reason?: string;

  // AI/Automation (provided by backend)
  linked_recommendations: LinkedRecommendation[];
  auto_assigned?: boolean;
  ai_suggested_priority?: string;
  ai_suggested_category?: string;

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  tenantId?: string;
}

export interface ServiceRequestDetails extends ServiceRequest {
  requestor?: any;
  assignee?: any;
  business_service?: any;
  customer?: any;
  related_incidents?: any[];
  related_problems?: any[];
  related_changes?: any[];
}

// ---------------------------------
// 3. API Client Abstraction
// ---------------------------------

interface ServiceRequestAPIClient {
  getAll: (tenantId: string, filters?: Record<string, any>) => Promise<ServiceRequest[]>;
  getById: (tenantId: string, id: string) => Promise<ServiceRequest | undefined>;
  create: (tenantId: string, request: Partial<ServiceRequest>) => Promise<ServiceRequest>;
  update: (tenantId: string, id: string, request: Partial<ServiceRequest>) => Promise<ServiceRequest>;
  delete: (tenantId: string, id: string) => Promise<void>;
  getMetrics: (tenantId: string, filters?: Record<string, any>) => Promise<any>;
  validate: (tenantId: string, request: Partial<ServiceRequest>) => Promise<{ valid: boolean; errors?: string[] }>;
  approve: (tenantId: string, id: string, approvalData: any) => Promise<ServiceRequest>;
  reject: (tenantId: string, id: string, rejectionData: any) => Promise<ServiceRequest>;
  escalate: (tenantId: string, id: string, escalationData: any) => Promise<ServiceRequest>;
  fulfill: (tenantId: string, id: string, fulfillmentData: any) => Promise<ServiceRequest>;
}

// Thin API client wrapper - delegates ALL business logic to backend
const createServiceRequestAPIClient = (): ServiceRequestAPIClient => ({
  async getAll(tenantId: string, filters = {}) {
    // Backend handles complex filtering, sorting, and business rules
    const response = await fetch(`/api/service-requests?${new URLSearchParams(filters)}`);
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    return response.json();
  },

  async getById(tenantId: string, id: string) {
    return getById<ServiceRequest>(tenantId, "service_requests", id);
  },

  async create(tenantId: string, request: Partial<ServiceRequest>) {
    // Backend handles all validation, business rules, SLA calculations, etc.
    const response = await fetch('/api/service-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, tenantId })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create service request');
    }
    return response.json();
  },

  async update(tenantId: string, id: string, request: Partial<ServiceRequest>) {
    // Backend handles business validation and state transitions
    const response = await fetch(`/api/service-requests/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, tenantId })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update service request');
    }
    return response.json();
  },

  async delete(tenantId: string, id: string) {
    // Backend handles cascade deletion and business rules
    const response = await fetch(`/api/service-requests/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete service request');
    }
  },

  async getMetrics(tenantId: string, filters = {}) {
    // Backend calculates all business metrics
    const response = await fetch(`/api/service-requests/metrics?${new URLSearchParams(filters)}`);
    if (!response.ok) throw new Error('Failed to load metrics');
    return response.json();
  },

  async validate(tenantId: string, request: Partial<ServiceRequest>) {
    // Backend performs comprehensive business validation
    const response = await fetch('/api/service-requests/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, tenantId })
    });
    if (!response.ok) throw new Error('Validation failed');
    return response.json();
  },

  async approve(tenantId: string, id: string, approvalData: any) {
    const response = await fetch(`/api/service-requests/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...approvalData, tenantId })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to approve request');
    }
    return response.json();
  },

  async reject(tenantId: string, id: string, rejectionData: any) {
    const response = await fetch(`/api/service-requests/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...rejectionData, tenantId })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to reject request');
    }
    return response.json();
  },

  async escalate(tenantId: string, id: string, escalationData: any) {
    const response = await fetch(`/api/service-requests/${id}/escalate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...escalationData, tenantId })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to escalate request');
    }
    return response.json();
  },

  async fulfill(tenantId: string, id: string, fulfillmentData: any) {
    const response = await fetch(`/api/service-requests/${id}/fulfill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fulfillmentData, tenantId })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fulfill request');
    }
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
interface ServiceRequestsContextType {
  // Async state for UI
  serviceRequests: AsyncState<ServiceRequest>;
  
  // CRUD operations with optimistic updates
  addServiceRequest: (request: Partial<ServiceRequest>, userId?: string) => Promise<void>;
  updateServiceRequest: (id: string, request: Partial<ServiceRequest>, userId?: string) => Promise<void>;
  deleteServiceRequest: (id: string, userId?: string) => Promise<void>;
  
  // Service request specific operations
  approveRequest: (id: string, approvalData: any, userId?: string) => Promise<void>;
  rejectRequest: (id: string, rejectionData: any, userId?: string) => Promise<void>;
  escalateRequest: (id: string, escalationData: any, userId?: string) => Promise<void>;
  fulfillRequest: (id: string, fulfillmentData: any, userId?: string) => Promise<void>;
  
  // Data fetching
  refreshServiceRequests: () => Promise<void>;
  getServiceRequest: (id: string) => Promise<ServiceRequest | undefined>;
  
  // Client-side UI helpers (not business logic)
  filterServiceRequests: (filters: ServiceRequestUIFilters) => ServiceRequest[];
  searchServiceRequests: (query: string) => ServiceRequest[];
  sortServiceRequests: (sortBy: keyof ServiceRequest, order: 'asc' | 'desc') => ServiceRequest[];
  
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
    urgency_levels: string[];
    request_types: string[];
    fulfillment_types: string[];
    sla_targets: Record<string, number>;
  };
}

const ServiceRequestsContext = createContext<ServiceRequestsContextType | undefined>(undefined);

// ---------------------------------
// 6. Provider Implementation
// ---------------------------------
export const ServiceRequestsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();
  
  // UI State Management
  const [serviceRequests, setServiceRequests] = useState<AsyncState<ServiceRequest>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    stale: true,
  });
  
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdate[]>([]);
  
  // Memoized instances
  const apiClient = useMemo(() => createServiceRequestAPIClient(), []);
  const cache = useMemo(() => new UICache<ServiceRequest[]>(), []);
  
  // Extract UI config from backend config
  const config = useMemo(() => ({
    statuses: globalConfig?.work?.service_request?.statuses || [],
    priorities: globalConfig?.work?.service_request?.priorities || [],
    urgency_levels: globalConfig?.work?.service_request?.urgency_levels || [],
    request_types: globalConfig?.work?.service_request?.request_types || [],
    fulfillment_types: globalConfig?.work?.service_request?.fulfillment_types || [],
    sla_targets: globalConfig?.work?.service_request?.sla_targets || {},
  }), [globalConfig]);

  // ---------------------------------
  // Cache & Performance Management
  // ---------------------------------
  
  const getCacheKey = useCallback((filters?: Record<string, any>) => 
    `service_requests_${tenantId}_${JSON.stringify(filters || {})}`, [tenantId]);
  
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
  
  const refreshServiceRequests = useCallback(async (filters?: Record<string, any>) => {
    if (!tenantId) return;
    
    const cacheKey = getCacheKey(filters);
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && !cache.isStale(cacheKey)) {
      setServiceRequests(prev => ({
        ...prev,
        data: cached,
        stale: false,
      }));
      return;
    }
    
    setServiceRequests(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Backend handles sorting, filtering, and business logic
      const data = await apiClient.getAll(tenantId, filters);
      
      // Cache for UI performance
      cache.set(cacheKey, data);
      
      setServiceRequests({
        data,
        loading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        stale: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setServiceRequests(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
        stale: true,
      }));
    }
  }, [tenantId, apiClient, cache, getCacheKey]);

  const getServiceRequest = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    
    // Check current data first for UI responsiveness
    const existing = serviceRequests.data.find(sr => sr.id === id);
    if (existing && !serviceRequests.stale) return existing;
    
    try {
      return await apiClient.getById(tenantId, id);
    } catch (error) {
      console.warn(`Failed to fetch service request ${id}:`, error);
      return existing; // Fallback to cached data
    }
  }, [tenantId, apiClient, serviceRequests]);

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
    
    setServiceRequests(prev => {
      let newData = [...prev.data];
      
      switch (update.type) {
        case 'create':
          newData = newData.filter(sr => sr.id !== update.id);
          break;
        case 'update':
          if (update.rollbackData) {
            const index = newData.findIndex(sr => sr.id === update.id);
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
  
  const addServiceRequest = useCallback(async (request: Partial<ServiceRequest>, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    const optimisticId = `temp-${Date.now()}`;
    const optimisticRequest: ServiceRequest = {
      id: optimisticId,
      title: request.title || '',
      description: request.description || '',
      status: request.status || config.statuses[0] || 'draft',
      priority: request.priority || config.priorities[0] || 'medium',
      urgency: request.urgency || config.urgency_levels[0] || 'medium',
      request_type: request.request_type || config.request_types[0] || 'general',
      category: request.category || '',
      subcategory: request.subcategory || '',
      product_family: request.product_family || '',
      fulfillment_type: request.fulfillment_type || config.fulfillment_types[0] || 'manual',
      approval_required: request.approval_required || false,
      approval_workflow: [],
      tasks: [],
      requested_by_end_user_id: request.requested_by_end_user_id || '',
      approved_by_user_ids: [],
      escalation_team_ids: [],
      service_component_ids: [],
      asset_ids: [],
      related_incident_ids: [],
      related_problem_ids: [],
      related_change_ids: [],
      related_log_ids: [],
      related_metric_ids: [],
      related_event_ids: [],
      related_trace_ids: [],
      compliance_requirement_ids: [],
      linked_recommendations: [],
      tags: [],
      health_status: "gray",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tenantId,
      ...request,
    };
    
    // Optimistic UI update
    setServiceRequests(prev => ({
      ...prev,
      data: [optimisticRequest, ...prev.data],
    }));
    
    const update: OptimisticUpdate = {
      id: optimisticId,
      type: 'create',
      timestamp: new Date().toISOString(),
    };
    addOptimisticUpdate(update);
    
    try {
      // Backend handles ALL business logic
      const created = await apiClient.create(tenantId, request);
      
      // Replace optimistic with real data
      setServiceRequests(prev => ({
        ...prev,
        data: prev.data.map(sr => sr.id === optimisticId ? created : sr),
      }));
      
      removeOptimisticUpdate(optimisticId);
      invalidateCache();
      
      // Sync for offline support
      await enqueueItem({
        storeName: "service_requests",
        entityId: created.id,
        action: "create",
        payload: created,
        priority: created.priority === 'urgent' ? 'critical' : 'normal',
      });
      
    } catch (error) {
      // Rollback on failure
      rollbackOptimisticUpdate(optimisticId);
      throw error;
    }
  }, [tenantId, config, addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate, apiClient, invalidateCache, enqueueItem]);

  const updateServiceRequest = useCallback(async (id: string, request: Partial<ServiceRequest>, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    const existing = serviceRequests.data.find(sr => sr.id === id);
    if (!existing) throw new Error("Service request not found");
    
    const optimisticRequest = { ...existing, ...request, updated_at: new Date().toISOString() };
    
    // Optimistic UI update
    setServiceRequests(prev => ({
      ...prev,
      data: prev.data.map(sr => sr.id === id ? optimisticRequest : sr),
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
      const updated = await apiClient.update(tenantId, id, request);
      
      setServiceRequests(prev => ({
        ...prev,
        data: prev.data.map(sr => sr.id === id ? updated : sr),
      }));
      
      removeOptimisticUpdate(id);
      invalidateCache();
      
      await enqueueItem({
        storeName: "service_requests",
        entityId: id,
        action: "update",
        payload: updated,
        priority: updated.priority === 'urgent' ? 'critical' : 'normal',
      });
      
    } catch (error) {
      rollbackOptimisticUpdate(id);
      throw error;
    }
  }, [tenantId, serviceRequests.data, addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate, apiClient, invalidateCache, enqueueItem]);

  const deleteServiceRequest = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    const existing = serviceRequests.data.find(sr => sr.id === id);
    if (!existing) throw new Error("Service request not found");
    
    // Optimistic UI update
    setServiceRequests(prev => ({
      ...prev,
      data: prev.data.filter(sr => sr.id !== id),
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
        storeName: "service_requests",
        entityId: id,
        action: "delete",
        payload: null,
      });
      
    } catch (error) {
      rollbackOptimisticUpdate(id);
      throw error;
    }
  }, [tenantId, serviceRequests.data, addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate, apiClient, invalidateCache, enqueueItem]);

  // ---------------------------------
  // Service Request Specific Operations
  // ---------------------------------

  const approveRequest = useCallback(async (id: string, approvalData: any, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    try {
      const updated = await apiClient.approve(tenantId, id, approvalData);
      
      setServiceRequests(prev => ({
        ...prev,
        data: prev.data.map(sr => sr.id === id ? updated : sr),
      }));
      
      invalidateCache();
      
      await enqueueItem({
        storeName: "service_requests",
        entityId: id,
        action: "update",
        payload: updated,
      });
      
    } catch (error) {
      throw error;
    }
  }, [tenantId, apiClient, invalidateCache, enqueueItem]);

  const rejectRequest = useCallback(async (id: string, rejectionData: any, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    try {
      const updated = await apiClient.reject(tenantId, id, rejectionData);
      
      setServiceRequests(prev => ({
        ...prev,
        data: prev.data.map(sr => sr.id === id ? updated : sr),
      }));
      
      invalidateCache();
      
      await enqueueItem({
        storeName: "service_requests",
        entityId: id,
        action: "update",
        payload: updated,
      });
      
    } catch (error) {
      throw error;
    }
  }, [tenantId, apiClient, invalidateCache, enqueueItem]);

  const escalateRequest = useCallback(async (id: string, escalationData: any, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    try {
      const updated = await apiClient.escalate(tenantId, id, escalationData);
      
      setServiceRequests(prev => ({
        ...prev,
        data: prev.data.map(sr => sr.id === id ? updated : sr),
      }));
      
      invalidateCache();
      
      await enqueueItem({
        storeName: "service_requests",
        entityId: id,
        action: "update",
        payload: updated,
        priority: 'critical', // Escalations are high priority
      });
      
    } catch (error) {
      throw error;
    }
  }, [tenantId, apiClient, invalidateCache, enqueueItem]);

  const fulfillRequest = useCallback(async (id: string, fulfillmentData: any, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    try {
      const updated = await apiClient.fulfill(tenantId, id, fulfillmentData);
      
      setServiceRequests(prev => ({
        ...prev,
        data: prev.data.map(sr => sr.id === id ? updated : sr),
      }));
      
      invalidateCache();
      
      await enqueueItem({
        storeName: "service_requests",
        entityId: id,
        action: "update",
        payload: updated,
      });
      
    } catch (error) {
      throw error;
    }
  }, [tenantId, apiClient, invalidateCache, enqueueItem]);

  // ---------------------------------
  // Client-Side UI Helpers (No Business Logic)
  // ---------------------------------
  
  const filterServiceRequests = useCallback((filters: ServiceRequestUIFilters): ServiceRequest[] => {
    let filtered = [...serviceRequests.data];
    
    if (filters.status) {
      filtered = filtered.filter(sr => sr.status === filters.status);
    }
    
    if (filters.priority) {
      filtered = filtered.filter(sr => sr.priority === filters.priority);
    }
    
    if (filters.urgency) {
      filtered = filtered.filter(sr => sr.urgency === filters.urgency);
    }
    
    if (filters.requestType) {
      filtered = filtered.filter(sr => sr.request_type === filters.requestType);
    }
    
    if (filters.businessService) {
      filtered = filtered.filter(sr => sr.business_service_id === filters.businessService);
    }
    
    if (filters.healthStatus) {
      filtered = filtered.filter(sr => sr.health_status === filters.healthStatus);
    }
    
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(sr => 
        filters.tags?.some(tag => sr.tags?.includes(tag)) || false
      );
    }
    
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(sr =>
        sr.title.toLowerCase().includes(query) ||
        sr.description.toLowerCase().includes(query) ||
        sr.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [serviceRequests.data]);
  
  const searchServiceRequests = useCallback((query: string): ServiceRequest[] => {
    return filterServiceRequests({ searchQuery: query });
  }, [filterServiceRequests]);
  
  const sortServiceRequests = useCallback((sortBy: keyof ServiceRequest, order: 'asc' | 'desc' = 'desc'): ServiceRequest[] => {
    return [...serviceRequests.data].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      
      if (aVal === bVal) return 0;
      const result = aVal > bVal ? 1 : -1;
      return order === 'asc' ? result : -result;
    });
  }, [serviceRequests.data]);

  // ---------------------------------
  // Initialization & Cleanup
  // ---------------------------------
  
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshServiceRequests();
    }
  }, [tenantId, globalConfig, refreshServiceRequests]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      invalidateCache();
      setOptimisticUpdates([]);
    };
  }, [invalidateCache]);

  return (
    <ServiceRequestsContext.Provider
      value={{
        serviceRequests,
        addServiceRequest,
        updateServiceRequest,
        deleteServiceRequest,
        approveRequest,
        rejectRequest,
        escalateRequest,
        fulfillRequest,
        refreshServiceRequests,
        getServiceRequest,
        filterServiceRequests,
        searchServiceRequests,
        sortServiceRequests,
        optimisticUpdates,
        rollbackOptimisticUpdate,
        invalidateCache,
        getCacheStats,
        config,
      }}
    >
      {children}
    </ServiceRequestsContext.Provider>
  );
};

// ---------------------------------
// 7. Hooks for Selective Subscriptions
// ---------------------------------

export const useServiceRequests = (): ServiceRequestsContextType => {
  const ctx = useContext(ServiceRequestsContext);
  if (!ctx) {
    throw new Error("useServiceRequests must be used within ServiceRequestsProvider");
  }
  return ctx;
};

/**
 * Performance-optimized hook for service request details with caching
 */
export const useServiceRequestDetails = (id: string): {
  serviceRequest: ServiceRequestDetails | undefined;
  loading: boolean;
  error: string | null;
} => {
  const { getServiceRequest, serviceRequests } = useServiceRequests();
  const [state, setState] = useState<{
    serviceRequest: ServiceRequestDetails | undefined;
    loading: boolean;
    error: string | null;
  }>({
    serviceRequest: undefined,
    loading: false,
    error: null,
  });
  
  useEffect(() => {
    let cancelled = false;
    
    const fetchServiceRequest = async () => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      try {
        const serviceRequest = await getServiceRequest(id);
        if (!cancelled) {
          setState({
            serviceRequest: serviceRequest as ServiceRequestDetails,
            loading: false,
            error: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            serviceRequest: undefined,
            loading: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    };
    
    fetchServiceRequest();
    
    return () => { cancelled = true; };
  }, [id, getServiceRequest]);
  
  return state;
};

/**
 * Memoized hooks for specific service request queries
 */
export const useServiceRequestsByStatus = (status: string) => {
  const { filterServiceRequests } = useServiceRequests();
  return useMemo(() => filterServiceRequests({ status }), [filterServiceRequests, status]);
};

export const useUrgentServiceRequests = () => {
  const { filterServiceRequests } = useServiceRequests();
  return useMemo(() => filterServiceRequests({ priority: 'urgent' }), [filterServiceRequests]);
};

export const useOpenServiceRequests = () => {
  const { serviceRequests } = useServiceRequests();
  return useMemo(() => 
    serviceRequests.data.filter(sr => !['fulfilled', 'closed', 'cancelled'].includes(sr.status)),
    [serviceRequests.data]
  );
};

export const useBreachedServiceRequests = () => {
  const { serviceRequests } = useServiceRequests();
  return useMemo(() => 
    serviceRequests.data.filter(sr => sr.breached === true || sr.sla_breached === true),
    [serviceRequests.data]
  );
};

export const usePendingApprovalRequests = () => {
  const { serviceRequests } = useServiceRequests();
  return useMemo(() => 
    serviceRequests.data.filter(sr => sr.approval_required && sr.status === 'pending_approval'),
    [serviceRequests.data]
  );
};

export const useMyServiceRequests = (userId: string) => {
  const { serviceRequests } = useServiceRequests();
  return useMemo(() => 
    serviceRequests.data.filter(sr => 
      sr.assigned_to_user_id === userId || 
      sr.requested_by_user_id === userId
    ),
    [serviceRequests.data, userId]
  );
};

/**
 * Hook for search with debouncing for better performance
 */
export const useServiceRequestSearch = (query: string, debounceMs = 300) => {
  const { searchServiceRequests } = useServiceRequests();
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => clearTimeout(timer);
  }, [query, debounceMs]);
  
  return useMemo(() => 
    debouncedQuery ? searchServiceRequests(debouncedQuery) : [],
    [searchServiceRequests, debouncedQuery]
  );
};