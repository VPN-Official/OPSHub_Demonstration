// src/contexts/AlertsContext.tsx
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

// ---------------------------------
// 1. Frontend State Management Types
// ---------------------------------

/**
 * Generic async state wrapper for UI operations
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
 */
export interface AlertUIFilters {
  status?: string[];
  severity?: string[];
  sourceSystem?: string[];
  businessService?: string[];
  assignedToMe?: boolean;
  teamId?: string;
  tags?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  searchQuery?: string;
}

/**
 * Optimistic update tracking for better UX
 */
interface OptimisticUpdate {
  id: string;
  type: 'create' | 'update' | 'delete' | 'acknowledge' | 'resolve' | 'escalate' | 'suppress' | 'correlate' | 'promote';
  timestamp: string;
  rollbackData?: Alert;
}

// ---------------------------------
// 2. Domain Types (From Backend)
// ---------------------------------

export type AlertStatus = "new" | "acknowledged" | "in_progress" | "resolved" | "closed";
export type AlertSeverity = "info" | "warning" | "minor" | "major" | "critical";

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

export interface AlertCorrelation {
  correlation_id: string;
  correlation_rule?: string;
  related_alert_ids: string[];
  correlation_timestamp: string;
  correlation_confidence: number;
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  status: AlertStatus;
  severity: AlertSeverity;
  source_system: string;
  created_at: string;
  updated_at: string;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;

  // Relationships
  event_id?: string | null;
  incident_id?: string | null;
  service_component_id?: string | null;
  business_service_id?: string | null;
  asset_id?: string | null;
  customer_id?: string | null;

  // Assignment and ownership
  assigned_to_user_id?: string | null;
  assigned_to_team_id?: string | null;
  escalation_team_ids: string[];
  acknowledged_by_user_id?: string | null;
  resolved_by_user_id?: string | null;

  // Alert correlation and grouping
  correlation?: AlertCorrelation;
  parent_alert_id?: string | null;
  child_alert_ids: string[];
  duplicate_of_alert_id?: string | null;

  // Metrics and thresholds (calculated by backend)
  threshold_value?: number;
  current_value?: number;
  threshold_operator?: "gt" | "lt" | "eq" | "gte" | "lte";
  evaluation_window_minutes?: number;
  
  // Notification and escalation
  notification_channels: string[];
  escalation_level: number;
  escalated_at?: string | null;
  suppressed_until?: string | null;
  suppressed_by_user_id?: string | null;
  suppression_reason?: string;

  // AI and automation (provided by backend)
  recommendations: LinkedRecommendation[];
  auto_resolved?: boolean;
  ai_analysis?: {
    predicted_severity?: AlertSeverity;
    predicted_resolution_time?: number;
    similar_alerts?: string[];
    confidence: number;
  };

  // Business impact (calculated by backend)
  business_impact?: string;
  financial_impact?: number;
  affected_user_count?: number;
  customer_impact_level?: "none" | "low" | "medium" | "high" | "critical";

  // UI metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
  tenantId?: string;
}

export interface AlertDetails extends Alert {
  event?: any;
  incident?: any;
  service_component?: any;
  business_service?: any;
  asset?: any;
  customer?: any;
  related_alerts?: Alert[];
}

// ---------------------------------
// 3. API Client Abstraction
// ---------------------------------

interface AlertAPIClient {
  getAll: (tenantId: string, filters?: Record<string, any>) => Promise<Alert[]>;
  getById: (tenantId: string, id: string) => Promise<Alert | undefined>;
  create: (tenantId: string, alert: Partial<Alert>) => Promise<Alert>;
  update: (tenantId: string, id: string, alert: Partial<Alert>) => Promise<Alert>;
  delete: (tenantId: string, id: string) => Promise<void>;
  acknowledge: (tenantId: string, id: string, userId: string) => Promise<Alert>;
  resolve: (tenantId: string, id: string, userId: string, resolution?: string) => Promise<Alert>;
  escalate: (tenantId: string, id: string, userId: string, reason?: string) => Promise<Alert>;
  suppress: (tenantId: string, id: string, userId: string, durationMinutes: number, reason: string) => Promise<Alert>;
  correlate: (tenantId: string, alertIds: string[], correlationRule: string) => Promise<string>;
  promoteToIncident: (tenantId: string, id: string, userId: string) => Promise<string>;
}

// Thin API client wrapper - delegates ALL business logic to backend
const createAlertAPIClient = (): AlertAPIClient => ({
  async getAll(tenantId: string, filters = {}) {
    // Backend handles complex filtering, sorting, and business rules
    const response = await fetch(`/api/alerts?${new URLSearchParams(filters)}`);
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    return response.json();
  },

  async getById(tenantId: string, id: string) {
    return getById<Alert>(tenantId, "alerts", id);
  },

  async create(tenantId: string, alert: Partial<Alert>) {
    // Backend handles all validation, business rules, correlation, etc.
    const response = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...alert, tenantId })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create alert');
    }
    return response.json();
  },

  async update(tenantId: string, id: string, alert: Partial<Alert>) {
    // Backend handles business validation and state transitions
    const response = await fetch(`/api/alerts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...alert, tenantId })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update alert');
    }
    return response.json();
  },

  async delete(tenantId: string, id: string) {
    // Backend handles cascade deletion and business rules
    const response = await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete alert');
    }
  },

  async acknowledge(tenantId: string, id: string, userId: string) {
    // Backend handles acknowledgment business logic
    const response = await fetch(`/api/alerts/${id}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, tenantId })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to acknowledge alert');
    }
    return response.json();
  },

  async resolve(tenantId: string, id: string, userId: string, resolution?: string) {
    // Backend handles resolution business logic and automation
    const response = await fetch(`/api/alerts/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, tenantId, resolution })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to resolve alert');
    }
    return response.json();
  },

  async escalate(tenantId: string, id: string, userId: string, reason?: string) {
    // Backend handles escalation rules and notifications
    const response = await fetch(`/api/alerts/${id}/escalate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, tenantId, reason })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to escalate alert');
    }
    return response.json();
  },

  async suppress(tenantId: string, id: string, userId: string, durationMinutes: number, reason: string) {
    // Backend handles suppression business logic
    const response = await fetch(`/api/alerts/${id}/suppress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, tenantId, durationMinutes, reason })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to suppress alert');
    }
    return response.json();
  },

  async correlate(tenantId: string, alertIds: string[], correlationRule: string) {
    // Backend handles correlation algorithms and grouping logic
    const response = await fetch('/api/alerts/correlate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertIds, correlationRule, tenantId })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to correlate alerts');
    }
    const result = await response.json();
    return result.correlationId;
  },

  async promoteToIncident(tenantId: string, id: string, userId: string) {
    // Backend handles incident creation and business rules
    const response = await fetch(`/api/alerts/${id}/promote-to-incident`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, tenantId })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to promote alert to incident');
    }
    const result = await response.json();
    return result.incidentId;
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
interface AlertsContextType {
  // Async state for UI
  alerts: AsyncState<Alert>;
  
  // CRUD operations with optimistic updates
  addAlert: (alert: Partial<Alert>, userId?: string) => Promise<void>;
  updateAlert: (id: string, alert: Partial<Alert>, userId?: string) => Promise<void>;
  deleteAlert: (id: string, userId?: string) => Promise<void>;
  
  // Alert-specific operations with optimistic updates
  acknowledgeAlert: (id: string, userId: string) => Promise<void>;
  resolveAlert: (id: string, userId: string, resolution?: string) => Promise<void>;
  escalateAlert: (id: string, userId: string, reason?: string) => Promise<void>;
  suppressAlert: (id: string, userId: string, durationMinutes: number, reason: string) => Promise<void>;
  correlateAlerts: (alertIds: string[], correlationRule: string) => Promise<string>;
  promoteToIncident: (id: string, userId: string) => Promise<string>;
  
  // Data fetching
  refreshAlerts: () => Promise<void>;
  getAlert: (id: string) => Promise<Alert | undefined>;
  
  // Client-side UI helpers (not business logic)
  filterAlerts: (filters: AlertUIFilters) => Alert[];
  searchAlerts: (query: string) => Alert[];
  sortAlerts: (sortBy: keyof Alert, order: 'asc' | 'desc') => Alert[];
  
  // Optimistic update state
  optimisticUpdates: OptimisticUpdate[];
  rollbackOptimisticUpdate: (updateId: string) => void;
  
  // Cache management
  invalidateCache: (key?: string) => void;
  getCacheStats: () => { size: number; hitRate: number };
  
  // Backend config integration (read-only from backend)
  config: {
    statuses: string[];
    severities: string[];
    sourceSystems: string[];
    notificationChannels: string[];
  };
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

// ---------------------------------
// 6. Provider Implementation
// ---------------------------------
export const AlertsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();
  
  // UI State Management
  const [alerts, setAlerts] = useState<AsyncState<Alert>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    stale: true,
  });
  
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdate[]>([]);
  
  // Memoized instances
  const apiClient = useMemo(() => createAlertAPIClient(), []);
  const cache = useMemo(() => new UICache<Alert[]>(), []);
  
  // Extract UI config from backend config
  const config = useMemo(() => ({
    statuses: globalConfig?.statuses?.alerts || ["new", "acknowledged", "in_progress", "resolved", "closed"],
    severities: Object.keys(globalConfig?.severities || {}),
    sourceSystems: ['monitoring', 'logging', 'apm', 'security', 'custom'],
    notificationChannels: ['email', 'sms', 'slack', 'webhook', 'pagerduty'],
  }), [globalConfig]);

  // ---------------------------------
  // Cache & Performance Management
  // ---------------------------------
  
  const getCacheKey = useCallback((filters?: Record<string, any>) => 
    `alerts_${tenantId}_${JSON.stringify(filters || {})}`, [tenantId]);
  
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
  
  const refreshAlerts = useCallback(async (filters?: Record<string, any>) => {
    if (!tenantId) return;
    
    const cacheKey = getCacheKey(filters);
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && !cache.isStale(cacheKey)) {
      setAlerts(prev => ({
        ...prev,
        data: cached,
        stale: false,
      }));
      return;
    }
    
    setAlerts(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Backend handles sorting, filtering, and business logic
      const data = await apiClient.getAll(tenantId, filters);
      
      // Cache for UI performance
      cache.set(cacheKey, data);
      
      setAlerts({
        data,
        loading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        stale: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setAlerts(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
        stale: true,
      }));
    }
  }, [tenantId, apiClient, cache, getCacheKey]);

  const getAlert = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    
    // Check current data first for UI responsiveness
    const existing = alerts.data.find(a => a.id === id);
    if (existing && !alerts.stale) return existing;
    
    try {
      return await apiClient.getById(tenantId, id);
    } catch (error) {
      console.warn(`Failed to fetch alert ${id}:`, error);
      return existing; // Fallback to cached data
    }
  }, [tenantId, apiClient, alerts]);

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
    
    setAlerts(prev => {
      let newData = [...prev.data];
      
      switch (update.type) {
        case 'create':
          newData = newData.filter(a => a.id !== update.id);
          break;
        case 'update':
        case 'acknowledge':
        case 'resolve':
        case 'escalate':
        case 'suppress':
          if (update.rollbackData) {
            const index = newData.findIndex(a => a.id === update.id);
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
  // Helper for UI Metadata
  // ---------------------------------
  
  const ensureUIMetadata = useCallback((alert: Partial<Alert>): Alert => {
    const now = new Date().toISOString();
    return {
      id: alert.id || crypto.randomUUID(),
      title: alert.title || '',
      description: alert.description || '',
      status: alert.status || config.statuses[0] || 'new',
      severity: alert.severity || config.severities[0] || 'info',
      source_system: alert.source_system || 'monitoring',
      created_at: alert.created_at || now,
      updated_at: alert.updated_at || now,
      escalation_team_ids: [],
      child_alert_ids: [],
      notification_channels: ['email'],
      escalation_level: 1,
      recommendations: [],
      tags: [],
      health_status: "gray",
      tenantId,
      ...alert,
    } as Alert;
  }, [tenantId, config]);

  // ---------------------------------
  // CRUD Operations with Optimistic Updates
  // ---------------------------------
  
  const addAlert = useCallback(async (alert: Partial<Alert>, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    const optimisticId = `temp-${Date.now()}`;
    const optimisticAlert = ensureUIMetadata({
      ...alert,
      id: optimisticId,
    });
    
    // Optimistic UI update
    setAlerts(prev => ({
      ...prev,
      data: [optimisticAlert, ...prev.data],
    }));
    
    const update: OptimisticUpdate = {
      id: optimisticId,
      type: 'create',
      timestamp: new Date().toISOString(),
    };
    addOptimisticUpdate(update);
    
    try {
      // Backend handles ALL business logic
      const created = await apiClient.create(tenantId, alert);
      
      // Replace optimistic with real data
      setAlerts(prev => ({
        ...prev,
        data: prev.data.map(a => a.id === optimisticId ? created : a),
      }));
      
      removeOptimisticUpdate(optimisticId);
      invalidateCache();
      
      // Sync for offline support
      await enqueueItem({
        storeName: "alerts",
        entityId: created.id,
        action: "create",
        payload: created,
        priority: created.severity === 'critical' ? 'critical' : 'normal',
      });
      
    } catch (error) {
      // Rollback on failure
      rollbackOptimisticUpdate(optimisticId);
      throw error;
    }
  }, [tenantId, ensureUIMetadata, addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate, apiClient, invalidateCache, enqueueItem]);

  const updateAlert = useCallback(async (id: string, alert: Partial<Alert>, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    const existing = alerts.data.find(a => a.id === id);
    if (!existing) throw new Error("Alert not found");
    
    const optimisticAlert = { ...existing, ...alert, updated_at: new Date().toISOString() };
    
    // Optimistic UI update
    setAlerts(prev => ({
      ...prev,
      data: prev.data.map(a => a.id === id ? optimisticAlert : a),
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
      const updated = await apiClient.update(tenantId, id, alert);
      
      setAlerts(prev => ({
        ...prev,
        data: prev.data.map(a => a.id === id ? updated : a),
      }));
      
      removeOptimisticUpdate(id);
      invalidateCache();
      
      await enqueueItem({
        storeName: "alerts",
        entityId: id,
        action: "update",
        payload: updated,
        priority: updated.severity === 'critical' ? 'critical' : 'normal',
      });
      
    } catch (error) {
      rollbackOptimisticUpdate(id);
      throw error;
    }
  }, [tenantId, alerts.data, addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate, apiClient, invalidateCache, enqueueItem]);

  const deleteAlert = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    const existing = alerts.data.find(a => a.id === id);
    if (!existing) throw new Error("Alert not found");
    
    // Optimistic UI update
    setAlerts(prev => ({
      ...prev,
      data: prev.data.filter(a => a.id !== id),
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
        storeName: "alerts",
        entityId: id,
        action: "delete",
        payload: null,
      });
      
    } catch (error) {
      rollbackOptimisticUpdate(id);
      throw error;
    }
  }, [tenantId, alerts.data, addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate, apiClient, invalidateCache, enqueueItem]);

  // ---------------------------------
  // Alert Operations with Optimistic Updates
  // ---------------------------------
  
  const acknowledgeAlert = useCallback(async (id: string, userId: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    const existing = alerts.data.find(a => a.id === id);
    if (!existing) throw new Error("Alert not found");
    
    const optimisticAlert = {
      ...existing,
      status: 'acknowledged' as AlertStatus,
      acknowledged_at: new Date().toISOString(),
      acknowledged_by_user_id: userId,
      updated_at: new Date().toISOString(),
    };
    
    // Optimistic UI update
    setAlerts(prev => ({
      ...prev,
      data: prev.data.map(a => a.id === id ? optimisticAlert : a),
    }));
    
    const update: OptimisticUpdate = {
      id,
      type: 'acknowledge',
      timestamp: new Date().toISOString(),
      rollbackData: existing,
    };
    addOptimisticUpdate(update);
    
    try {
      const acknowledged = await apiClient.acknowledge(tenantId, id, userId);
      
      setAlerts(prev => ({
        ...prev,
        data: prev.data.map(a => a.id === id ? acknowledged : a),
      }));
      
      removeOptimisticUpdate(id);
      invalidateCache();
      
    } catch (error) {
      rollbackOptimisticUpdate(id);
      throw error;
    }
  }, [tenantId, alerts.data, addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate, apiClient, invalidateCache]);

  const resolveAlert = useCallback(async (id: string, userId: string, resolution?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    const existing = alerts.data.find(a => a.id === id);
    if (!existing) throw new Error("Alert not found");
    
    const optimisticAlert = {
      ...existing,
      status: 'resolved' as AlertStatus,
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: userId,
      updated_at: new Date().toISOString(),
    };
    
    // Optimistic UI update
    setAlerts(prev => ({
      ...prev,
      data: prev.data.map(a => a.id === id ? optimisticAlert : a),
    }));
    
    const update: OptimisticUpdate = {
      id,
      type: 'resolve',
      timestamp: new Date().toISOString(),
      rollbackData: existing,
    };
    addOptimisticUpdate(update);
    
    try {
      const resolved = await apiClient.resolve(tenantId, id, userId, resolution);
      
      setAlerts(prev => ({
        ...prev,
        data: prev.data.map(a => a.id === id ? resolved : a),
      }));
      
      removeOptimisticUpdate(id);
      invalidateCache();
      
    } catch (error) {
      rollbackOptimisticUpdate(id);
      throw error;
    }
  }, [tenantId, alerts.data, addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate, apiClient, invalidateCache]);

  const escalateAlert = useCallback(async (id: string, userId: string, reason?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    const existing = alerts.data.find(a => a.id === id);
    if (!existing) throw new Error("Alert not found");
    
    const optimisticAlert = {
      ...existing,
      escalation_level: existing.escalation_level + 1,
      escalated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    // Optimistic UI update
    setAlerts(prev => ({
      ...prev,
      data: prev.data.map(a => a.id === id ? optimisticAlert : a),
    }));
    
    const update: OptimisticUpdate = {
      id,
      type: 'escalate',
      timestamp: new Date().toISOString(),
      rollbackData: existing,
    };
    addOptimisticUpdate(update);
    
    try {
      const escalated = await apiClient.escalate(tenantId, id, userId, reason);
      
      setAlerts(prev => ({
        ...prev,
        data: prev.data.map(a => a.id === id ? escalated : a),
      }));
      
      removeOptimisticUpdate(id);
      invalidateCache();
      
    } catch (error) {
      rollbackOptimisticUpdate(id);
      throw error;
    }
  }, [tenantId, alerts.data, addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate, apiClient, invalidateCache]);

  const suppressAlert = useCallback(async (id: string, userId: string, durationMinutes: number, reason: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    const existing = alerts.data.find(a => a.id === id);
    if (!existing) throw new Error("Alert not found");
    
    const suppressedUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    const optimisticAlert = {
      ...existing,
      suppressed_until: suppressedUntil,
      suppressed_by_user_id: userId,
      suppression_reason: reason,
      updated_at: new Date().toISOString(),
    };
    
    // Optimistic UI update
    setAlerts(prev => ({
      ...prev,
      data: prev.data.map(a => a.id === id ? optimisticAlert : a),
    }));
    
    const update: OptimisticUpdate = {
      id,
      type: 'suppress',
      timestamp: new Date().toISOString(),
      rollbackData: existing,
    };
    addOptimisticUpdate(update);
    
    try {
      const suppressed = await apiClient.suppress(tenantId, id, userId, durationMinutes, reason);
      
      setAlerts(prev => ({
        ...prev,
        data: prev.data.map(a => a.id === id ? suppressed : a),
      }));
      
      removeOptimisticUpdate(id);
      invalidateCache();
      
    } catch (error) {
      rollbackOptimisticUpdate(id);
      throw error;
    }
  }, [tenantId, alerts.data, addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate, apiClient, invalidateCache]);

  const correlateAlerts = useCallback(async (alertIds: string[], correlationRule: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    try {
      const correlationId = await apiClient.correlate(tenantId, alertIds, correlationRule);
      
      // Refresh to get updated correlation data from backend
      await refreshAlerts();
      
      return correlationId;
    } catch (error) {
      throw error;
    }
  }, [tenantId, apiClient, refreshAlerts]);

  const promoteToIncident = useCallback(async (id: string, userId: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    try {
      const incidentId = await apiClient.promoteToIncident(tenantId, id, userId);
      
      // Refresh to get updated data from backend
      await refreshAlerts();
      
      return incidentId;
    } catch (error) {
      throw error;
    }
  }, [tenantId, apiClient, refreshAlerts]);

  // ---------------------------------
  // Client-Side UI Helpers (No Business Logic)
  // ---------------------------------
  
  const filterAlerts = useCallback((filters: AlertUIFilters): Alert[] => {
    let filtered = [...alerts.data];
    
    if (filters.status?.length) {
      filtered = filtered.filter(a => filters.status!.includes(a.status));
    }
    
    if (filters.severity?.length) {
      filtered = filtered.filter(a => filters.severity!.includes(a.severity));
    }
    
    if (filters.sourceSystem?.length) {
      filtered = filtered.filter(a => filters.sourceSystem!.includes(a.source_system));
    }
    
    if (filters.businessService?.length) {
      filtered = filtered.filter(a => a.business_service_id && filters.businessService!.includes(a.business_service_id));
    }
    
    if (filters.teamId) {
      filtered = filtered.filter(a => a.assigned_to_team_id === filters.teamId);
    }
    
    if (filters.tags?.length) {
      filtered = filtered.filter(a => filters.tags!.some(tag => a.tags.includes(tag)));
    }
    
    if (filters.dateRange) {
      const startDate = new Date(filters.dateRange.start);
      const endDate = new Date(filters.dateRange.end);
      filtered = filtered.filter(a => {
        const alertDate = new Date(a.created_at);
        return alertDate >= startDate && alertDate <= endDate;
      });
    }
    
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        a.title.toLowerCase().includes(query) ||
        a.description.toLowerCase().includes(query) ||
        a.source_system.toLowerCase().includes(query) ||
        a.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [alerts.data]);
  
  const searchAlerts = useCallback((query: string): Alert[] => {
    return filterAlerts({ searchQuery: query });
  }, [filterAlerts]);
  
  const sortAlerts = useCallback((sortBy: keyof Alert, order: 'asc' | 'desc' = 'desc'): Alert[] => {
    return [...alerts.data].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      
      if (aVal === bVal) return 0;
      const result = aVal > bVal ? 1 : -1;
      return order === 'asc' ? result : -result;
    });
  }, [alerts.data]);

  // ---------------------------------
  // Initialization & Cleanup
  // ---------------------------------
  
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshAlerts();
    }
  }, [tenantId, globalConfig, refreshAlerts]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      invalidateCache();
      setOptimisticUpdates([]);
    };
  }, [invalidateCache]);

  return (
    <AlertsContext.Provider
      value={{
        alerts,
        addAlert,
        updateAlert,
        deleteAlert,
        acknowledgeAlert,
        resolveAlert,
        escalateAlert,
        suppressAlert,
        correlateAlerts,
        promoteToIncident,
        refreshAlerts,
        getAlert,
        filterAlerts,
        searchAlerts,
        sortAlerts,
        optimisticUpdates,
        rollbackOptimisticUpdate,
        invalidateCache,
        getCacheStats,
        config,
      }}
    >
      {children}
    </AlertsContext.Provider>
  );
};

// ---------------------------------
// 7. Hooks for Selective Subscriptions
// ---------------------------------

export const useAlerts = (): AlertsContextType => {
  const ctx = useContext(AlertsContext);
  if (!ctx) {
    throw new Error("useAlerts must be used within AlertsProvider");
  }
  return ctx;
};

/**
 * Performance-optimized hook for alert details with caching
 */
export const useAlertDetails = (id: string): {
  alert: AlertDetails | undefined;
  loading: boolean;
  error: string | null;
} => {
  const { getAlert, alerts } = useAlerts();
  const [state, setState] = useState<{
    alert: AlertDetails | undefined;
    loading: boolean;
    error: string | null;
  }>({
    alert: undefined,
    loading: false,
    error: null,
  });
  
  useEffect(() => {
    let cancelled = false;
    
    const fetchAlert = async () => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      try {
        const alert = await getAlert(id);
        if (!cancelled) {
          setState({
            alert: alert as AlertDetails,
            loading: false,
            error: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            alert: undefined,
            loading: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    };
    
    fetchAlert();
    
    return () => { cancelled = true; };
  }, [id, getAlert]);
  
  return state;
};

/**
 * Memoized hooks for specific alert queries
 */
export const useAlertsByStatus = (status: AlertStatus) => {
  const { filterAlerts } = useAlerts();
  return useMemo(() => filterAlerts({ status: [status] }), [filterAlerts, status]);
};

export const useCriticalAlerts = () => {
  const { filterAlerts } = useAlerts();
  return useMemo(() => filterAlerts({ severity: ['critical'] }), [filterAlerts]);
};

export const useOpenAlerts = () => {
  const { alerts } = useAlerts();
  return useMemo(() => 
    alerts.data.filter(a => !['resolved', 'closed'].includes(a.status)),
    [alerts.data]
  );
};

export const useMyAlerts = (userId: string) => {
  const { filterAlerts } = useAlerts();
  return useMemo(() => 
    filterAlerts({}).filter(a => a.assigned_to_user_id === userId),
    [filterAlerts, userId]
  );
};

export const useRecentAlerts = (hours: number = 24) => {
  const { alerts } = useAlerts();
  return useMemo(() => {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return alerts.data
      .filter(a => new Date(a.created_at) > cutoff)
      .slice(0, 20);
  }, [alerts.data, hours]);
};

export const useAlertsBySourceSystem = (sourceSystem: string) => {
  const { filterAlerts } = useAlerts();
  return useMemo(() => filterAlerts({ sourceSystem: [sourceSystem] }), [filterAlerts, sourceSystem]);
};

/**
 * Hook for search with debouncing for better performance
 */
export const useAlertSearch = (query: string, debounceMs = 300) => {
  const { searchAlerts } = useAlerts();
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => clearTimeout(timer);
  }, [query, debounceMs]);
  
  return useMemo(() => 
    debouncedQuery ? searchAlerts(debouncedQuery) : [],
    [searchAlerts, debouncedQuery]
  );
};