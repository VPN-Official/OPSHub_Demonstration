// src/contexts/SystemMetricsContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
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
// 1. Type Definitions
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

export type AggregationType = 
  | "sum" 
  | "average" 
  | "min" 
  | "max" 
  | "count" 
  | "percentile";

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

export interface SystemMetric {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  type: MetricType;
  category: MetricCategory;
  unit: string;
  created_at: string;
  updated_at: string;

  // Data source and collection
  source_system: string;
  collection_method: "push" | "pull" | "batch" | "streaming";
  collection_interval_seconds?: number;
  retention_days: number;

  // Relationships
  asset_id?: string | null;
  service_component_id?: string | null;
  business_service_id?: string | null;
  customer_id?: string | null;

  // Current state
  current_value?: number;
  last_updated_at?: string | null;
  last_collection_at?: string | null;
  collection_status: "healthy" | "degraded" | "failing" | "stopped";

  // Aggregation and processing
  aggregation_type: AggregationType;
  aggregation_window_minutes?: number;
  baseline_value?: number;
  trend: "up" | "down" | "stable" | "unknown";
  variance_threshold?: number;

  // Alerting and thresholds
  thresholds: MetricThreshold[];
  alert_enabled: boolean;
  last_alert_at?: string | null;
  alert_count_24h: number;

  // Data points (recent data)
  data_points: MetricDataPoint[];
  data_points_count: number;
  oldest_data_point?: string | null;
  newest_data_point?: string | null;

  // Quality and reliability
  data_quality_score?: number; // 0-100%
  missing_data_points?: number;
  anomaly_detected?: boolean;
  anomaly_score?: number;
  seasonality_detected?: boolean;

  // Business context
  business_impact: "none" | "low" | "medium" | "high" | "critical";
  sla_relevant: boolean;
  kpi_relevant: boolean;
  cost_per_unit?: number;
  revenue_impact?: number;

  // Governance
  owner_user_id?: string | null;
  owner_team_id?: string | null;
  data_classification?: "public" | "internal" | "confidential" | "restricted";
  compliance_requirement_ids: string[];

  // Visualization and reporting
  chart_type?: "line" | "bar" | "gauge" | "pie" | "scatter";
  display_precision?: number;
  dashboard_visible: boolean;
  report_included: boolean;

  // Metadata
  labels: Record<string, string>;
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
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
// 2. Context Interface
// ---------------------------------
interface SystemMetricsContextType {
  metrics: SystemMetric[];
  addMetric: (metric: SystemMetric, userId?: string) => Promise<void>;
  updateMetric: (metric: SystemMetric, userId?: string) => Promise<void>;
  deleteMetric: (id: string, userId?: string) => Promise<void>;
  refreshMetrics: () => Promise<void>;
  getMetric: (id: string) => Promise<SystemMetric | undefined>;

  // Metric-specific operations
  recordDataPoint: (metricId: string, dataPoint: Omit<MetricDataPoint, 'timestamp'>, userId?: string) => Promise<void>;
  addThreshold: (metricId: string, threshold: MetricThreshold, userId?: string) => Promise<void>;
  updateThreshold: (metricId: string, thresholdId: string, threshold: Partial<MetricThreshold>, userId?: string) => Promise<void>;
  removeThreshold: (metricId: string, thresholdId: string, userId?: string) => Promise<void>;
  evaluateThresholds: (metricId: string) => Promise<{ breached: boolean; alerts: string[] }>;
  calculateBaseline: (metricId: string, days?: number) => Promise<number>;
  detectAnomalies: (metricId: string) => Promise<{ anomalies: MetricDataPoint[]; score: number }>;
  aggregateMetric: (metricId: string, windowMinutes: number, aggregationType: AggregationType) => Promise<MetricDataPoint[]>;

  // Data management
  cleanupOldData: (metricId: string) => Promise<number>;
  exportMetricData: (metricId: string, startDate: string, endDate: string, format: "json" | "csv") => Promise<Blob>;
  importMetricData: (metricId: string, data: MetricDataPoint[], userId?: string) => Promise<number>;

  // Filtering and querying
  getMetricsByCategory: (category: MetricCategory) => SystemMetric[];
  getMetricsByType: (type: MetricType) => SystemMetric[];
  getMetricsBySource: (source: string) => SystemMetric[];
  getMetricsByAsset: (assetId: string) => SystemMetric[];
  getMetricsByServiceComponent: (componentId: string) => SystemMetric[];
  getMetricsByBusinessService: (serviceId: string) => SystemMetric[];
  getAlertingMetrics: () => SystemMetric[];
  getFailingMetrics: () => SystemMetric[];
  getSLAMetrics: () => SystemMetric[];
  getKPIMetrics: () => SystemMetric[];
  getMetricsWithAnomalies: () => SystemMetric[];
  searchMetrics: (query: string) => SystemMetric[];

  // Analytics and insights
  getMetricStats: (timeframe?: "hour" | "day" | "week" | "month") => {
    totalMetrics: number;
    collectingMetrics: number;
    failingMetrics: number;
    alertingMetrics: number;
    averageDataQuality: number;
    anomaliesDetected: number;
    dataPointsCollected: number;
  };
  
  getTopMetrics: (criterion: "alerts" | "variance" | "business_impact", limit?: number) => SystemMetric[];
  getMetricTrends: () => {
    improving: SystemMetric[];
    degrading: SystemMetric[];
    stable: SystemMetric[];
  };

  // Config integration
  config: {
    types: string[];
    categories: string[];
    units: string[];
    collection_methods: string[];
    aggregation_types: string[];
    chart_types: string[];
  };
}

const SystemMetricsContext = createContext<SystemMetricsContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const SystemMetricsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();
  const [metrics, setMetrics] = useState<SystemMetric[]>([]);

  const config = {
    types: globalConfig?.metrics?.types || ["gauge", "counter", "histogram", "summary", "timer"],
    categories: globalConfig?.metrics?.categories || [
      "performance", "availability", "resource", "business", "security", "compliance", "custom"
    ],
    units: globalConfig?.metrics?.units || [
      "bytes", "seconds", "milliseconds", "percent", "count", "requests", "errors", "users", "dollars"
    ],
    collection_methods: globalConfig?.metrics?.collection_methods || ["push", "pull", "batch", "streaming"],
    aggregation_types: globalConfig?.metrics?.aggregation_types || ["sum", "average", "min", "max", "count", "percentile"],
    chart_types: globalConfig?.metrics?.chart_types || ["line", "bar", "gauge", "pie", "scatter"],
  };

  const refreshMetrics = useCallback(async () => {
    if (!tenantId) return;
    try {
      const all = await getAll<SystemMetric>(tenantId, "system_metrics");
      setMetrics(all);
    } catch (error) {
      console.error("Failed to refresh system metrics:", error);
    }
  }, [tenantId]);

  const getMetric = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    return getById<SystemMetric>(tenantId, "system_metrics", id);
  }, [tenantId]);

  const addMetric = useCallback(async (metric: SystemMetric, userId?: string) => {
    if (!tenantId) return;

    // ✅ Config validation
    if (!config.types.includes(metric.type)) {
      throw new Error(`Invalid metric type: ${metric.type}`);
    }
    if (!config.categories.includes(metric.category)) {
      throw new Error(`Invalid metric category: ${metric.category}`);
    }
    if (!config.collection_methods.includes(metric.collection_method)) {
      throw new Error(`Invalid collection method: ${metric.collection_method}`);
    }
    if (!config.aggregation_types.includes(metric.aggregation_type)) {
      throw new Error(`Invalid aggregation type: ${metric.aggregation_type}`);
    }

    const enrichedMetric: SystemMetric = {
      ...metric,
      created_at: metric.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      collection_status: metric.collection_status || "healthy",
      alert_count_24h: 0,
      data_points: metric.data_points || [],
      data_points_count: metric.data_points?.length || 0,
      trend: metric.trend || "unknown",
      labels: metric.labels || {},
      compliance_requirement_ids: metric.compliance_requirement_ids || [],
      health_status: metric.health_status || "green",
      sync_status: "dirty",
      tenantId,
    };

    await putWithAudit(
      tenantId,
      "system_metrics",
      enrichedMetric,
      userId,
      { action: "create", description: `System metric "${metric.display_name}" created` },
      enqueueItem
    );
    await refreshMetrics();
  }, [tenantId, config, enqueueItem, refreshMetrics]);

  const updateMetric = useCallback(async (metric: SystemMetric, userId?: string) => {
    if (!tenantId) return;

    const enrichedMetric: SystemMetric = {
      ...metric,
      updated_at: new Date().toISOString(),
      data_points_count: metric.data_points?.length || 0,
      sync_status: "dirty",
      tenantId,
    };

    await putWithAudit(
      tenantId,
      "system_metrics",
      enrichedMetric,
      userId,
      { action: "update", description: `System metric "${metric.display_name}" updated` },
      enqueueItem
    );
    await refreshMetrics();
  }, [tenantId, enqueueItem, refreshMetrics]);

  const deleteMetric = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) return;

    const metric = await getMetric(id);
    const metricName = metric?.display_name || id;

    await removeWithAudit(
      tenantId,
      "system_metrics",
      id,
      userId,
      { action: "delete", description: `System metric "${metricName}" deleted` },
      enqueueItem
    );
    await refreshMetrics();
  }, [tenantId, getMetric, enqueueItem, refreshMetrics]);

  // Metric-specific operations
  const recordDataPoint = useCallback(async (metricId: string, dataPoint: Omit<MetricDataPoint, 'timestamp'>, userId?: string) => {
    const metric = await getMetric(metricId);
    if (!metric) return;

    const newDataPoint: MetricDataPoint = {
      ...dataPoint,
      timestamp: new Date().toISOString(),
    };

    // Add new data point and maintain retention policy
    const updatedDataPoints = [...metric.data_points, newDataPoint]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 1000); // Keep last 1000 points

    const updatedMetric = {
      ...metric,
      current_value: dataPoint.value,
      last_updated_at: newDataPoint.timestamp,
      last_collection_at: newDataPoint.timestamp,
      data_points: updatedDataPoints,
      data_points_count: updatedDataPoints.length,
      oldest_data_point: updatedDataPoints[updatedDataPoints.length - 1]?.timestamp,
      newest_data_point: updatedDataPoints[0]?.timestamp,
      updated_at: new Date().toISOString(),
    };

    await updateMetric(updatedMetric, userId);
  }, [getMetric, updateMetric]);

  const addThreshold = useCallback(async (metricId: string, threshold: MetricThreshold, userId?: string) => {
    const metric = await getMetric(metricId);
    if (!metric) return;

    const updatedThresholds = [...metric.thresholds, threshold];
    const updatedMetric = {
      ...metric,
      thresholds: updatedThresholds,
      updated_at: new Date().toISOString(),
    };

    await updateMetric(updatedMetric, userId);
  }, [getMetric, updateMetric]);

  const updateThreshold = useCallback(async (metricId: string, thresholdId: string, thresholdUpdate: Partial<MetricThreshold>, userId?: string) => {
    const metric = await getMetric(metricId);
    if (!metric) return;

    const updatedThresholds = metric.thresholds.map(t =>
      t.id === thresholdId ? { ...t, ...thresholdUpdate } : t
    );

    const updatedMetric = {
      ...metric,
      thresholds: updatedThresholds,
      updated_at: new Date().toISOString(),
    };

    await updateMetric(updatedMetric, userId);
  }, [getMetric, updateMetric]);

  const removeThreshold = useCallback(async (metricId: string, thresholdId: string, userId?: string) => {
    const metric = await getMetric(metricId);
    if (!metric) return;

    const updatedThresholds = metric.thresholds.filter(t => t.id !== thresholdId);
    const updatedMetric = {
      ...metric,
      thresholds: updatedThresholds,
      updated_at: new Date().toISOString(),
    };

    await updateMetric(updatedMetric, userId);
  }, [getMetric, updateMetric]);

  const evaluateThresholds = useCallback(async (metricId: string) => {
    const metric = await getMetric(metricId);
    if (!metric || !metric.current_value) {
      return { breached: false, alerts: [] };
    }

    const breachedThresholds = metric.thresholds.filter(threshold => {
      if (!threshold.enabled) return false;
      
      const value = metric.current_value!;
      switch (threshold.operator) {
        case "gt": return value > (threshold.critical_value || threshold.warning_value || 0);
        case "lt": return value < (threshold.critical_value || threshold.warning_value || 0);
        case "gte": return value >= (threshold.critical_value || threshold.warning_value || 0);
        case "lte": return value <= (threshold.critical_value || threshold.warning_value || 0);
        case "eq": return value === (threshold.critical_value || threshold.warning_value || 0);
        default: return false;
      }
    });

    return {
      breached: breachedThresholds.length > 0,
      alerts: breachedThresholds.map(t => `Threshold '${t.name}' breached: ${metric.current_value} ${threshold.operator} ${t.critical_value || t.warning_value}`),
    };
  }, [getMetric]);

  const calculateBaseline = useCallback(async (metricId: string, days: number = 30) => {
    const metric = await getMetric(metricId);
    if (!metric || metric.data_points.length === 0) return 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const relevantPoints = metric.data_points.filter(point => 
      new Date(point.timestamp) >= cutoffDate
    );

    if (relevantPoints.length === 0) return metric.current_value || 0;

    const sum = relevantPoints.reduce((total, point) => total + point.value, 0);
    return sum / relevantPoints.length;
  }, [getMetric]);

  const detectAnomalies = useCallback(async (metricId: string) => {
    const metric = await getMetric(metricId);
    if (!metric || metric.data_points.length < 10) {
      return { anomalies: [], score: 0 };
    }

    const baseline = await calculateBaseline(metricId);
    const variance = metric.variance_threshold || 0.2; // 20% variance threshold
    
    const anomalies = metric.data_points.filter(point => {
      const deviation = Math.abs(point.value - baseline) / baseline;
      return deviation > variance;
    });

    const anomalyScore = anomalies.length / metric.data_points.length;

    return { anomalies, score: anomalyScore };
  }, [getMetric, calculateBaseline]);

  const aggregateMetric = useCallback(async (metricId: string, windowMinutes: number, aggregationType: AggregationType) => {
    const metric = await getMetric(metricId);
    if (!metric || metric.data_points.length === 0) return [];

    const windowMs = windowMinutes * 60 * 1000;
    const now = Date.now();
    
    // Group data points by time windows
    const windows = new Map<number, MetricDataPoint[]>();
    
    for (const point of metric.data_points) {
      const pointTime = new Date(point.timestamp).getTime();
      const windowStart = Math.floor((now - pointTime) / windowMs) * windowMs;
      
      if (!windows.has(windowStart)) {
        windows.set(windowStart, []);
      }
      windows.get(windowStart)!.push(point);
    }

    // Aggregate each window
    const aggregated: MetricDataPoint[] = [];
    
    for (const [windowStart, points] of windows.entries()) {
      let aggregatedValue: number;
      
      switch (aggregationType) {
        case "sum":
          aggregatedValue = points.reduce((sum, p) => sum + p.value, 0);
          break;
        case "average":
          aggregatedValue = points.reduce((sum, p) => sum + p.value, 0) / points.length;
          break;
        case "min":
          aggregatedValue = Math.min(...points.map(p => p.value));
          break;
        case "max":
          aggregatedValue = Math.max(...points.map(p => p.value));
          break;
        case "count":
          aggregatedValue = points.length;
          break;
        case "percentile":
          // Simple 95th percentile calculation
          const sorted = points.map(p => p.value).sort((a, b) => a - b);
          const index = Math.floor(0.95 * sorted.length);
          aggregatedValue = sorted[index] || 0;
          break;
        default:
          aggregatedValue = points[0]?.value || 0;
      }

      aggregated.push({
        timestamp: new Date(now - windowStart).toISOString(),
        value: aggregatedValue,
        source: `aggregated_${aggregationType}`,
      });
    }

    return aggregated.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [getMetric]);

  const cleanupOldData = useCallback(async (metricId: string) => {
    const metric = await getMetric(metricId);
    if (!metric) return 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - metric.retention_days);
    
    const initialCount = metric.data_points.length;
    const filteredDataPoints = metric.data_points.filter(point =>
      new Date(point.timestamp) >= cutoffDate
    );

    if (filteredDataPoints.length !== initialCount) {
      const updatedMetric = {
        ...metric,
        data_points: filteredDataPoints,
        data_points_count: filteredDataPoints.length,
        oldest_data_point: filteredDataPoints[filteredDataPoints.length - 1]?.timestamp,
        updated_at: new Date().toISOString(),
      };

      await updateMetric(updatedMetric);
    }

    return initialCount - filteredDataPoints.length;
  }, [getMetric, updateMetric]);

  const exportMetricData = useCallback(async (metricId: string, startDate: string, endDate: string, format: "json" | "csv") => {
    const metric = await getMetric(metricId);
    if (!metric) throw new Error("Metric not found");

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const filteredData = metric.data_points.filter(point => {
      const pointDate = new Date(point.timestamp);
      return pointDate >= start && pointDate <= end;
    });

    let content: string;
    let mimeType: string;

    if (format === "json") {
      content = JSON.stringify({
        metric: {
          id: metric.id,
          name: metric.display_name,
          unit: metric.unit,
        },
        data_points: filteredData,
        exported_at: new Date().toISOString(),
      }, null, 2);
      mimeType = "application/json";
    } else {
      // CSV format
      const headers = ["timestamp", "value", "labels", "source"];
      const csvRows = filteredData.map(point => [
        point.timestamp,
        point.value.toString(),
        JSON.stringify(point.labels || {}),
        point.source || "",
      ]);
      
      content = [headers, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(","))
        .join("\n");
      mimeType = "text/csv";
    }

    return new Blob([content], { type: mimeType });
  }, [getMetric]);

  const importMetricData = useCallback(async (metricId: string, data: MetricDataPoint[], userId?: string) => {
    const metric = await getMetric(metricId);
    if (!metric) return 0;

    // Merge with existing data and sort
    const allDataPoints = [...metric.data_points, ...data]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 2000); // Keep reasonable limit

    const updatedMetric = {
      ...metric,
      data_points: allDataPoints,
      data_points_count: allDataPoints.length,
      oldest_data_point: allDataPoints[allDataPoints.length - 1]?.timestamp,
      newest_data_point: allDataPoints[0]?.timestamp,
      current_value: allDataPoints[0]?.value || metric.current_value,
      updated_at: new Date().toISOString(),
    };

    await updateMetric(updatedMetric, userId);
    return data.length;
  }, [getMetric, updateMetric]);

  // Filtering functions
  const getMetricsByCategory = useCallback((category: MetricCategory) => {
    return metrics.filter(m => m.category === category);
  }, [metrics]);

  const getMetricsByType = useCallback((type: MetricType) => {
    return metrics.filter(m => m.type === type);
  }, [metrics]);

  const getMetricsBySource = useCallback((source: string) => {
    return metrics.filter(m => m.source_system === source);
  }, [metrics]);

  const getMetricsByAsset = useCallback((assetId: string) => {
    return metrics.filter(m => m.asset_id === assetId);
  }, [metrics]);

  const getMetricsByServiceComponent = useCallback((componentId: string) => {
    return metrics.filter(m => m.service_component_id === componentId);
  }, [metrics]);

  const getMetricsByBusinessService = useCallback((serviceId: string) => {
    return metrics.filter(m => m.business_service_id === serviceId);
  }, [metrics]);

  const getAlertingMetrics = useCallback(() => {
    return metrics.filter(m => m.alert_enabled === true);
  }, [metrics]);

  const getFailingMetrics = useCallback(() => {
    return metrics.filter(m => m.collection_status === "failing");
  }, [metrics]);

  const getSLAMetrics = useCallback(() => {
    return metrics.filter(m => m.sla_relevant === true);
  }, [metrics]);

  const getKPIMetrics = useCallback(() => {
    return metrics.filter(m => m.kpi_relevant === true);
  }, [metrics]);

  const getMetricsWithAnomalies = useCallback(() => {
    return metrics.filter(m => m.anomaly_detected === true);
  }, [metrics]);

  const searchMetrics = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return metrics.filter(m => 
      m.name.toLowerCase().includes(lowerQuery) ||
      m.display_name.toLowerCase().includes(lowerQuery) ||
      m.description?.toLowerCase().includes(lowerQuery) ||
      m.source_system.toLowerCase().includes(lowerQuery) ||
      m.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      Object.values(m.labels).some(label => label.toLowerCase().includes(lowerQuery))
    );
  }, [metrics]);

  const getMetricStats = useCallback((timeframe: "hour" | "day" | "week" | "month" = "day") => {
    const totalMetrics = metrics.length;
    const collectingMetrics = metrics.filter(m => m.collection_status === "healthy").length;
    const failingMetrics = metrics.filter(m => m.collection_status === "failing").length;
    const alertingMetrics = metrics.filter(m => m.alert_enabled).length;
    const averageDataQuality = metrics.length > 0 
      ? metrics.reduce((sum, m) => sum + (m.data_quality_score || 0), 0) / metrics.length 
      : 0;
    const anomaliesDetected = metrics.filter(m => m.anomaly_detected).length;
    const dataPointsCollected = metrics.reduce((sum, m) => sum + m.data_points_count, 0);

    return {
      totalMetrics,
      collectingMetrics,
      failingMetrics,
      alertingMetrics,
      averageDataQuality,
      anomaliesDetected,
      dataPointsCollected,
    };
  }, [metrics]);

  const getTopMetrics = useCallback((criterion: "alerts" | "variance" | "business_impact", limit: number = 10) => {
    let sortedMetrics: SystemMetric[];

    switch (criterion) {
      case "alerts":
        sortedMetrics = [...metrics].sort((a, b) => b.alert_count_24h - a.alert_count_24h);
        break;
      case "variance":
        sortedMetrics = [...metrics].sort((a, b) => (b.anomaly_score || 0) - (a.anomaly_score || 0));
        break;
      case "business_impact":
        const impactOrder = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };
        sortedMetrics = [...metrics].sort((a, b) => 
          impactOrder[b.business_impact] - impactOrder[a.business_impact]
        );
        break;
      default:
        sortedMetrics = metrics;
    }

    return sortedMetrics.slice(0, limit);
  }, [metrics]);

  const getMetricTrends = useCallback(() => {
    const improving = metrics.filter(m => m.trend === "down" && m.business_impact !== "none");
    const degrading = metrics.filter(m => m.trend === "up" && m.business_impact !== "none");
    const stable = metrics.filter(m => m.trend === "stable");

    return { improving, degrading, stable };
  }, [metrics]);

  // Initialize
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshMetrics();
    }
  }, [tenantId, globalConfig, refreshMetrics]);

  return (
    <SystemMetricsContext.Provider
      value={{
        metrics,
        addMetric,
        updateMetric,
        deleteMetric,
        refreshMetrics,
        getMetric,
        recordDataPoint,
        addThreshold,
        updateThreshold,
        removeThreshold,
        evaluateThresholds,
        calculateBaseline,
        detectAnomalies,
        aggregateMetric,
        cleanupOldData,
        exportMetricData,
        importMetricData,
        getMetricsByCategory,
        getMetricsByType,
        getMetricsBySource,
        getMetricsByAsset,
        getMetricsByServiceComponent,
        getMetricsByBusinessService,
        getAlertingMetrics,
        getFailingMetrics,
        getSLAMetrics,
        getKPIMetrics,
        getMetricsWithAnomalies,
        searchMetrics,
        getMetricStats,
        getTopMetrics,
        getMetricTrends,
        config,
      }}
    >
      {children}
    </SystemMetricsContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------
export const useSystemMetrics = () => {
  const ctx = useContext(SystemMetricsContext);
  if (!ctx) throw new Error("useSystemMetrics must be used within SystemMetricsProvider");
  return ctx;
};

export const useSystemMetricDetails = (id: string) => {
  const { metrics } = useSystemMetrics();
  return metrics.find((m) => m.id === id) || null;
};

// Utility hooks
export const useMetricsByCategory = (category: MetricCategory) => {
  const { getMetricsByCategory } = useSystemMetrics();
  return getMetricsByCategory(category);
};

export const useAlertingMetrics = () => {
  const { getAlertingMetrics } = useSystemMetrics();
  return getAlertingMetrics();
};

export const useFailingMetrics = () => {
  const { getFailingMetrics } = useSystemMetrics();
  return getFailingMetrics();
};

export const useMetricStats = (timeframe?: "hour" | "day" | "week" | "month") => {
  const { getMetricStats } = useSystemMetrics();
  return getMetricStats(timeframe);
};

export const useTopMetrics = (criterion: "alerts" | "variance" | "business_impact", limit?: number) => {
  const { getTopMetrics } = useSystemMetrics();
  return getTopMetrics(criterion, limit);
};