// src/contexts/SystemMetricsContext.tsx
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
// 1. Frontend AsyncState Pattern
// ---------------------------------


// ---------------------------------
// 2. Simplified Frontend Types (UI-focused)
// ---------------------------------
export type MetricType = 
  | "gauge" 
  | "counter" 
  | "histogram" 
  | "summary" 
  | "timer";

export type MetricCategory = 
  | "performance" 
  | "availability" 
  | "resource" 
  | "business" 
  | "security" 
  | "compliance" 
  | "custom";

export interface MetricThreshold {
  id: string;
  name: string;
  operator: "gt" | "lt" | "eq" | "gte" | "lte" | "between";
  warning_value?: number;
  critical_value?: number;
  target_value?: number;
  enabled: boolean;
  alert_on_breach: boolean;
  notification_channels?: string[];
}

export interface MetricDataPoint {
  timestamp: string;
  value: number;
  labels?: Record<string, string>;
  source?: string;
}

export interface SystemMetric extends ExternalSystemFields {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  type: MetricType;
  category: MetricCategory;
  unit: string;
  created_at: string;
  updated_at: string;

  // Source configuration (backend provides)
  collection_method: "push" | "pull" | "batch" | "streaming";
  collection_interval_seconds?: number;
  retention_days: number;

  // Relationships
  asset_id?: string | null;
  service_component_id?: string | null;
  business_service_id?: string | null;
  customer_id?: string | null;

  // Current state (calculated by backend)
  current_value?: number;
  last_updated_at?: string | null;
  last_collection_at?: string | null;
  collection_status: "healthy" | "degraded" | "failing" | "stopped";

  // Backend-calculated metrics
  trend: "up" | "down" | "stable" | "unknown";
  baseline_value?: number;
  data_quality_score?: number;
  anomaly_detected?: boolean;
  anomaly_score?: number;

  // Configuration
  thresholds: MetricThreshold[];
  alert_enabled: boolean;
  last_alert_at?: string | null;
  alert_count_24h: number;

  // Data points (for UI display)
  data_points: MetricDataPoint[];
  data_points_count: number;
  oldest_data_point?: string | null;
  newest_data_point?: string | null;

  // Business context (from backend)
  business_impact: "none" | "low" | "medium" | "high" | "critical";
  sla_relevant: boolean;
  kpi_relevant: boolean;
  cost_per_unit?: number;
  revenue_impact?: number;

  // Governance
  owner_user_id?: string | null;
  owner_team_id?: string | null;
  dashboard_visible: boolean;
  report_included: boolean;

  // Metadata
  labels: Record<string, string>;
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  
  // External system fields are inherited from ExternalSystemFields:
  // source_system, external_id, external_url, sync_status, synced_at, etc.
  tenantId?: string;
}

export interface MetricDetails extends SystemMetric {
  asset?: any;
  service_component?: any;
  business_service?: any;
  customer?: any;
  owner?: any;
  recent_alerts?: any[];
}

// ---------------------------------
// 3. UI-Focused Operations Interface
// ---------------------------------
interface SystemMetricsOperations {
  // Basic CRUD (UI orchestration only)
  addMetric: (metric: Omit<SystemMetric, 'id' | 'created_at' | 'updated_at'>, userId?: string) => Promise<void>;
  updateMetric: (metricId: string, updates: Partial<SystemMetric>, userId?: string) => Promise<void>;
  deleteMetric: (id: string, userId?: string) => Promise<void>;

  // Data management (UI actions triggering backend)
  recordDataPoint: (metricId: string, value: number, labels?: Record<string, string>, userId?: string) => Promise<void>;
  addThreshold: (metricId: string, threshold: Omit<MetricThreshold, 'id'>, userId?: string) => Promise<void>;
  removeThreshold: (metricId: string, thresholdId: string, userId?: string) => Promise<void>;
  
  // Trigger backend operations
  refreshMetricData: (metricId: string) => Promise<void>;
  exportMetricData: (metricId: string, startDate: string, endDate: string, format: "json" | "csv") => Promise<Blob>;
  triggerBaslineCalculation: (metricId: string, days?: number) => Promise<void>;
  triggerAnomalyDetection: (metricId: string) => Promise<void>;
}

// ---------------------------------
// 4. Frontend Context Interface
// ---------------------------------
interface SystemMetricsContextType {
  // AsyncState for metrics collection
  metrics: AsyncState<SystemMetric[]>;
  
  // Individual metric state (for detail views)
  getMetricState: (id: string) => AsyncState<MetricDetails | null>;
  
  // Operations
  operations: SystemMetricsOperations;
  
  // UI Helpers (client-side only)
  uiHelpers: {
    // Simple client-side filtering for immediate UI responsiveness
    filterByCategory: (category: MetricCategory) => SystemMetric[];
    filterByType: (type: MetricType) => SystemMetric[];
    filterByStatus: (status: string) => SystemMetric[];
    filterByHealthStatus: (health: SystemMetric['health_status']) => SystemMetric[];
    
    // External system filtering
    filterBySourceSystems: (sourceSystems: string[]) => SystemMetric[];
    filterBySyncStatus: (syncStatus: ('synced' | 'syncing' | 'error' | 'conflict')[]) => SystemMetric[];
    filterByDataCompleteness: (range: { min: number; max: number }) => SystemMetric[];
    getConflictedMetrics: () => SystemMetric[];
    getMetricsWithLocalChanges: () => SystemMetric[];
    
    // Basic text search for UI
    searchMetrics: (query: string) => SystemMetric[];
    
    // Simple UI grouping
    groupByCategory: () => Record<MetricCategory, SystemMetric[]>;
    groupBySource: () => Record<string, SystemMetric[]>;
    
    // UI-specific selectors
    getAlertingMetrics: () => SystemMetric[];
    getFailingMetrics: () => SystemMetric[];
    getSLAMetrics: () => SystemMetric[];
    getKPIMetrics: () => SystemMetric[];
    getDashboardMetrics: () => SystemMetric[];
    
    // Recently updated for UI indicators
    getRecentlyUpdated: (minutes?: number) => SystemMetric[];
  };
  
  // Configuration from backend
  config: {
    types: MetricType[];
    categories: MetricCategory[];
    units: string[];
    collection_methods: string[];
    chart_types: string[];
  };
  
  // Cache control
  cache: {
    invalidateAll: () => void;
    invalidateMetric: (id: string) => void;
    getLastRefresh: () => string | null;
    isStale: (maxAgeMinutes?: number) => boolean;
  };
}

const SystemMetricsContext = createContext<SystemMetricsContextType | undefined>(undefined);

// ---------------------------------
// 5. Cache Management
// ---------------------------------
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DETAIL_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

interface CacheEntry<T> {
  data: T;
  fetchedAt: string;
  isStale: boolean;
}

// ---------------------------------
// 6. Provider Implementation
// ---------------------------------
export const SystemMetricsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();
  
  // Main metrics state
  const [metricsState, setMetricsState] = useState<AsyncState<SystemMetric[]>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    isStale: false,
  });
  
  // Detail cache for individual metrics
  const [detailCache, setDetailCache] = useState<Map<string, CacheEntry<MetricDetails | null>>>(new Map());
  
  // Optimistic updates state
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, Partial<SystemMetric>>>(new Map());

  // Config derived from backend
  const config = useMemo(() => ({
    types: globalConfig?.metrics?.types || ["gauge", "counter", "histogram", "summary", "timer"] as MetricType[],
    categories: globalConfig?.metrics?.categories || [
      "performance", "availability", "resource", "business", "security", "compliance", "custom"
    ] as MetricCategory[],
    units: globalConfig?.metrics?.units || [
      "bytes", "seconds", "milliseconds", "percent", "count", "requests", "errors", "users", "dollars"
    ],
    collection_methods: globalConfig?.metrics?.collection_methods || ["push", "pull", "batch", "streaming"],
    chart_types: globalConfig?.metrics?.chart_types || ["line", "bar", "gauge", "pie", "scatter"],
  }), [globalConfig]);

  // ---------------------------------
  // Cache Utilities
  // ---------------------------------
  const isDataStale = useCallback((lastFetch: string | null, ttlMs: number = CACHE_TTL_MS) => {
    if (!lastFetch) return true;
    return Date.now() - new Date(lastFetch).getTime() > ttlMs;
  }, []);

  const invalidateCache = useCallback(() => {
    setMetricsState(prev => ({ ...prev, isStale: true }));
    setDetailCache(new Map());
    setOptimisticUpdates(new Map());
  }, []);

  const invalidateMetricCache = useCallback((id: string) => {
    setDetailCache(prev => {
      const newCache = new Map(prev);
      newCache.delete(id);
      return newCache;
    });
    
    setOptimisticUpdates(prev => {
      const newUpdates = new Map(prev);
      newUpdates.delete(id);
      return newUpdates;
    });
  }, []);

  // ---------------------------------
  // Data Fetching
  // ---------------------------------
  const refreshMetrics = useCallback(async (force: boolean = false) => {
    if (!tenantId) return;
    
    if (!force && !isDataStale(metricsState.lastFetch)) {
      return; // Use cached data
    }
    
    setMetricsState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const fetchedMetrics = await getAll<SystemMetric>(tenantId, "system_metrics");
      
      setMetricsState({
        data: fetchedMetrics,
        loading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        isStale: false,
      });
      
      console.log(`✅ Loaded ${fetchedMetrics.length} system metrics for tenant ${tenantId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load metrics';
      setMetricsState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
        isStale: true,
      }));
      console.error('Failed to refresh system metrics:', error);
    }
  }, [tenantId, metricsState.lastFetch, isDataStale]);

  // Get individual metric with caching
  const getMetricState = useCallback((id: string): AsyncState<MetricDetails | null> => {
    const cached = detailCache.get(id);
    
    if (cached && !isDataStale(cached.fetchedAt, DETAIL_CACHE_TTL_MS)) {
      return {
        data: cached.data,
        loading: false,
        error: null,
        lastFetch: cached.fetchedAt,
        isStale: cached.isStale,
      };
    }
    
    // Async load (will update cache)
    loadMetricDetails(id);
    
    return {
      data: cached?.data || null,
      loading: true,
      error: null,
      lastFetch: cached?.fetchedAt || null,
      isStale: true,
    };
  }, [detailCache, isDataStale]);

  const loadMetricDetails = useCallback(async (id: string) => {
    if (!tenantId) return;
    
    try {
      const metric = await getById<MetricDetails>(tenantId, "system_metrics", id);
      
      setDetailCache(prev => new Map(prev).set(id, {
        data: metric || null,
        fetchedAt: new Date().toISOString(),
        isStale: false,
      }));
    } catch (error) {
      setDetailCache(prev => new Map(prev).set(id, {
        data: null,
        fetchedAt: new Date().toISOString(),
        isStale: true,
      }));
      console.error(`Failed to load metric details for ${id}:`, error);
    }
  }, [tenantId]);

  // ---------------------------------
  // Operations (Thin API wrappers)
  // ---------------------------------
  const addMetric = useCallback(async (
    metricData: Omit<SystemMetric, 'id' | 'created_at' | 'updated_at'>, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");

    const tempId = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Basic UI validation only
    if (!metricData.name || !metricData.display_name) {
      throw new Error("Name and display name are required");
    }

    // Optimistic update for immediate UI feedback
    const optimisticMetric: SystemMetric = {
      id: tempId,
      created_at: now,
      updated_at: now,
      collection_status: "healthy",
      alert_count_24h: 0,
      data_points: [],
      data_points_count: 0,
      trend: "unknown",
      labels: {},
      thresholds: [],
      health_status: "gray",
      sync_status: "syncing",
      tenantId,
      ...metricData,
    };

    // Show optimistic update
    setMetricsState(prev => ({
      ...prev,
      data: [optimisticMetric, ...prev.data],
    }));

    try {
      // Backend handles ALL validation and business logic
      await putWithAudit(
        tenantId,
        "system_metrics",
        optimisticMetric,
        userId,
        { action: "create", description: `System metric "${metricData.display_name}" created` },
        enqueueItem
      );
      
      // Refresh to get the real data from backend
      await refreshMetrics(true);
      
    } catch (error) {
      // Rollback optimistic update
      setMetricsState(prev => ({
        ...prev,
        data: prev.data.filter(m => m.id !== tempId),
        error: error instanceof Error ? error.message : 'Failed to create metric',
      }));
      throw error;
    }
  }, [tenantId, enqueueItem, refreshMetrics]);

  const updateMetric = useCallback(async (
    metricId: string, 
    updates: Partial<SystemMetric>, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");

    // Find current metric for optimistic update
    const currentMetric = metricsState.data.find(m => m.id === metricId);
    if (!currentMetric) throw new Error("Metric not found");

    // Optimistic update
    const optimisticUpdates = new Map([[metricId, updates]]);
    setOptimisticUpdates(prev => new Map([...prev, [metricId, { ...prev.get(metricId), ...updates }]]));

    try {
      const updatedMetric = {
        ...currentMetric,
        ...updates,
        updated_at: new Date().toISOString(),
        sync_status: "syncing" as const,
      };

      // Backend handles ALL business logic
      await putWithAudit(
        tenantId,
        "system_metrics",
        updatedMetric,
        userId,
        { action: "update", description: `System metric "${currentMetric.display_name}" updated` },
        enqueueItem
      );

      // Clear optimistic update and refresh
      setOptimisticUpdates(prev => {
        const newMap = new Map(prev);
        newMap.delete(metricId);
        return newMap;
      });
      
      await refreshMetrics(true);
      invalidateMetricCache(metricId);
      
    } catch (error) {
      // Rollback optimistic update
      setOptimisticUpdates(prev => {
        const newMap = new Map(prev);
        newMap.delete(metricId);
        return newMap;
      });
      
      setMetricsState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to update metric',
      }));
      throw error;
    }
  }, [tenantId, metricsState.data, enqueueItem, refreshMetrics, invalidateMetricCache]);

  const deleteMetric = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    const metric = metricsState.data.find(m => m.id === id);
    if (!metric) throw new Error("Metric not found");

    // Optimistic removal
    setMetricsState(prev => ({
      ...prev,
      data: prev.data.filter(m => m.id !== id),
    }));

    try {
      // Backend handles ALL deletion business logic
      await removeWithAudit(
        tenantId,
        "system_metrics",
        id,
        userId,
        { action: "delete", description: `System metric "${metric.display_name}" deleted` },
        enqueueItem
      );

      invalidateMetricCache(id);
      
    } catch (error) {
      // Rollback optimistic deletion
      setMetricsState(prev => ({
        ...prev,
        data: [metric, ...prev.data],
        error: error instanceof Error ? error.message : 'Failed to delete metric',
      }));
      throw error;
    }
  }, [tenantId, metricsState.data, enqueueItem, invalidateMetricCache]);

  // ---------------------------------
  // Simplified Operations
  // ---------------------------------
  const recordDataPoint = useCallback(async (
    metricId: string, 
    value: number, 
    labels?: Record<string, string>, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");

    try {
      // Backend API handles data point recording and all related business logic
      const response = await fetch(`/api/metrics/${metricId}/datapoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, labels, userId, tenantId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to record data point: ${response.statusText}`);
      }

      // Refresh metric to get updated data
      invalidateMetricCache(metricId);
      await refreshMetrics(true);
      
    } catch (error) {
      setMetricsState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to record data point',
      }));
      throw error;
    }
  }, [tenantId, invalidateMetricCache, refreshMetrics]);

  const addThreshold = useCallback(async (
    metricId: string, 
    threshold: Omit<MetricThreshold, 'id'>, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");

    try {
      // Backend API handles threshold creation and validation
      const response = await fetch(`/api/metrics/${metricId}/thresholds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...threshold, userId, tenantId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to add threshold: ${response.statusText}`);
      }

      // Refresh data
      invalidateMetricCache(metricId);
      await refreshMetrics(true);
      
    } catch (error) {
      setMetricsState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to add threshold',
      }));
      throw error;
    }
  }, [tenantId, invalidateMetricCache, refreshMetrics]);

  const removeThreshold = useCallback(async (
    metricId: string, 
    thresholdId: string, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");

    try {
      // Backend API handles threshold removal
      const response = await fetch(`/api/metrics/${metricId}/thresholds/${thresholdId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tenantId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to remove threshold: ${response.statusText}`);
      }

      // Refresh data
      invalidateMetricCache(metricId);
      await refreshMetrics(true);
      
    } catch (error) {
      setMetricsState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to remove threshold',
      }));
      throw error;
    }
  }, [tenantId, invalidateMetricCache, refreshMetrics]);

  const refreshMetricData = useCallback(async (metricId: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    try {
      // Trigger backend data refresh
      const response = await fetch(`/api/metrics/${metricId}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to refresh metric data: ${response.statusText}`);
      }

      // Refresh local cache
      invalidateMetricCache(metricId);
      await refreshMetrics(true);
      
    } catch (error) {
      setMetricsState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to refresh metric data',
      }));
      throw error;
    }
  }, [tenantId, invalidateMetricCache, refreshMetrics]);

  const exportMetricData = useCallback(async (
    metricId: string, 
    startDate: string, 
    endDate: string, 
    format: "json" | "csv"
  ): Promise<Blob> => {
    if (!tenantId) throw new Error("No tenant selected");

    try {
      // Backend handles all export logic
      const response = await fetch(`/api/metrics/${metricId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, format, tenantId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to export metric data: ${response.statusText}`);
      }

      return await response.blob();
      
    } catch (error) {
      setMetricsState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to export metric data',
      }));
      throw error;
    }
  }, [tenantId]);

  const triggerBaslineCalculation = useCallback(async (metricId: string, days: number = 30) => {
    if (!tenantId) throw new Error("No tenant selected");

    try {
      // Backend handles baseline calculation business logic
      const response = await fetch(`/api/metrics/${metricId}/calculate-baseline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days, tenantId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to calculate baseline: ${response.statusText}`);
      }

      // Refresh data to show updated baseline
      invalidateMetricCache(metricId);
      await refreshMetrics(true);
      
    } catch (error) {
      setMetricsState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to calculate baseline',
      }));
      throw error;
    }
  }, [tenantId, invalidateMetricCache, refreshMetrics]);

  const triggerAnomalyDetection = useCallback(async (metricId: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    try {
      // Backend handles anomaly detection algorithms
      const response = await fetch(`/api/metrics/${metricId}/detect-anomalies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to detect anomalies: ${response.statusText}`);
      }

      // Refresh data to show anomaly results
      invalidateMetricCache(metricId);
      await refreshMetrics(true);
      
    } catch (error) {
      setMetricsState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to detect anomalies',
      }));
      throw error;
    }
  }, [tenantId, invalidateMetricCache, refreshMetrics]);

  // ---------------------------------
  // UI Helpers (Client-side only, simple filtering)
  // ---------------------------------
  const getCurrentMetrics = useCallback(() => {
    // Apply optimistic updates for immediate UI feedback
    return metricsState.data.map(metric => {
      const optimisticUpdate = optimisticUpdates.get(metric.id);
      return optimisticUpdate ? { ...metric, ...optimisticUpdate } : metric;
    });
  }, [metricsState.data, optimisticUpdates]);

  const uiHelpers = useMemo(() => ({
    filterByCategory: (category: MetricCategory) => 
      getCurrentMetrics().filter(m => m.category === category),
    
    filterByType: (type: MetricType) => 
      getCurrentMetrics().filter(m => m.type === type),
    
    filterByStatus: (status: string) => 
      getCurrentMetrics().filter(m => m.collection_status === status),
    
    filterByHealthStatus: (health: SystemMetric['health_status']) => 
      getCurrentMetrics().filter(m => m.health_status === health),
    
    searchMetrics: (query: string) => {
      const lowerQuery = query.toLowerCase();
      return getCurrentMetrics().filter(m => 
        m.name.toLowerCase().includes(lowerQuery) ||
        m.display_name.toLowerCase().includes(lowerQuery) ||
        m.description?.toLowerCase().includes(lowerQuery) ||
        m.source_system.toLowerCase().includes(lowerQuery) ||
        m.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
        Object.values(m.labels).some(label => label.toLowerCase().includes(lowerQuery))
      );
    },
    
    groupByCategory: () => {
      const metrics = getCurrentMetrics();
      return metrics.reduce((groups, metric) => {
        const category = metric.category;
        if (!groups[category]) groups[category] = [];
        groups[category].push(metric);
        return groups;
      }, {} as Record<MetricCategory, SystemMetric[]>);
    },
    
    groupBySource: () => {
      const metrics = getCurrentMetrics();
      return metrics.reduce((groups, metric) => {
        const source = metric.source_system;
        if (!groups[source]) groups[source] = [];
        groups[source].push(metric);
        return groups;
      }, {} as Record<string, SystemMetric[]>);
    },
    
    getAlertingMetrics: () => getCurrentMetrics().filter(m => m.alert_enabled),
    getFailingMetrics: () => getCurrentMetrics().filter(m => m.collection_status === "failing"),
    getSLAMetrics: () => getCurrentMetrics().filter(m => m.sla_relevant),
    getKPIMetrics: () => getCurrentMetrics().filter(m => m.kpi_relevant),
    getDashboardMetrics: () => getCurrentMetrics().filter(m => m.dashboard_visible),
    
    getRecentlyUpdated: (minutes: number = 60) => {
      const cutoff = new Date(Date.now() - minutes * 60 * 1000);
      return getCurrentMetrics().filter(m => 
        m.last_updated_at && new Date(m.last_updated_at) > cutoff
      );
    },
  }), [getCurrentMetrics]);

  const cache = useMemo(() => ({
    invalidateAll: invalidateCache,
    invalidateMetric: invalidateMetricCache,
    getLastRefresh: () => metricsState.lastFetch,
    isStale: (maxAgeMinutes: number = 5) => isDataStale(metricsState.lastFetch, maxAgeMinutes * 60 * 1000),
  }), [invalidateCache, invalidateMetricCache, metricsState.lastFetch, isDataStale]);

  const operations: SystemMetricsOperations = useMemo(() => ({
    addMetric,
    updateMetric,
    deleteMetric,
    recordDataPoint,
    addThreshold,
    removeThreshold,
    refreshMetricData,
    exportMetricData,
    triggerBaslineCalculation,
    triggerAnomalyDetection,
  }), [
    addMetric, updateMetric, deleteMetric, recordDataPoint,
    addThreshold, removeThreshold, refreshMetricData,
    exportMetricData, triggerBaslineCalculation, triggerAnomalyDetection
  ]);

  // ---------------------------------
  // Initialize and Effects
  // ---------------------------------
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshMetrics(false); // Use cache if available
    } else {
      // Reset state when tenant changes
      setMetricsState({
        data: [],
        loading: false,
        error: null,
        lastFetch: null,
        isStale: false,
      });
      setDetailCache(new Map());
      setOptimisticUpdates(new Map());
    }
  }, [tenantId, globalConfig, refreshMetrics]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      invalidateCache();
    };
  }, [invalidateCache]);

  return (
    <SystemMetricsContext.Provider
      value={{
        metrics: metricsState,
        getMetricState,
        operations,
        uiHelpers,
        config,
        cache,
      }}
    >
      {children}
    </SystemMetricsContext.Provider>
  );
};

// ---------------------------------
// 7. Frontend-Focused Hooks
// ---------------------------------
export const useSystemMetrics = () => {
  const ctx = useContext(SystemMetricsContext);
  if (!ctx) throw new Error("useSystemMetrics must be used within SystemMetricsProvider");
  return ctx;
};

export const useSystemMetricDetails = (id: string) => {
  const { getMetricState } = useSystemMetrics();
  return getMetricState(id);
};

// Specialized hooks for common UI patterns
export const useMetricsByCategory = (category: MetricCategory) => {
  const { uiHelpers } = useSystemMetrics();
  return useMemo(() => uiHelpers.filterByCategory(category), [uiHelpers, category]);
};

export const useAlertingMetrics = () => {
  const { uiHelpers } = useSystemMetrics();
  return useMemo(() => uiHelpers.getAlertingMetrics(), [uiHelpers]);
};

export const useFailingMetrics = () => {
  const { uiHelpers } = useSystemMetrics();
  return useMemo(() => uiHelpers.getFailingMetrics(), [uiHelpers]);
};

export const useMetricSearch = (query: string) => {
  const { uiHelpers } = useSystemMetrics();
  return useMemo(() => 
    query.trim() ? uiHelpers.searchMetrics(query) : [], 
    [uiHelpers, query]
  );
};

export const useMetricsGroupedByCategory = () => {
  const { uiHelpers } = useSystemMetrics();
  return useMemo(() => uiHelpers.groupByCategory(), [uiHelpers]);
};