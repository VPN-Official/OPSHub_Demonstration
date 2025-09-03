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
// 1. Type Definitions
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

  // Metrics and thresholds
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

  // AI and automation
  recommendations: LinkedRecommendation[];
  auto_resolved?: boolean;
  ai_analysis?: {
    predicted_severity?: AlertSeverity;
    predicted_resolution_time?: number;
    similar_alerts?: string[];
    confidence: number;
  };

  // Business impact
  business_impact?: string;
  financial_impact?: number;
  affected_user_count?: number;
  customer_impact_level?: "none" | "low" | "medium" | "high" | "critical";

  // Metadata
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
// 2. Async State Management
// ---------------------------------
export interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  lastFetch: string | null;
  stale: boolean;
}

interface CacheConfig {
  ttlMinutes: number;
  maxSize: number;
}

interface OptimisticUpdate<T> {
  id: string;
  operation: 'create' | 'update' | 'delete';
  payload: T;
  timestamp: string;
}

// ---------------------------------
// 3. UI Filters (Client-Side Only)
// ---------------------------------
export interface AlertUIFilters {
  status?: AlertStatus[];
  severity?: AlertSeverity[];
  sourceSystem?: string[];
  businessService?: string[];
  assignedToMe?: boolean;
  teamId?: string;
  tags?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  textSearch?: string;
}

// ---------------------------------
// 4. Context Interface
// ---------------------------------
interface AlertsContextType {
  // Async State
  alerts: AsyncState<Alert[]>;
  
  // Core CRUD Operations (API Orchestration Only)
  createAlert: (alert: Omit<Alert, 'id' | 'created_at' | 'updated_at'>, userId?: string) => Promise<void>;
  updateAlert: (alert: Alert, userId?: string) => Promise<void>;
  deleteAlert: (id: string, userId?: string) => Promise<void>;
  refreshAlerts: () => Promise<void>;
  getAlert: (id: string) => Promise<Alert | undefined>;

  // Alert Operations (API Calls Only)
  acknowledgeAlert: (alertId: string, userId: string) => Promise<void>;
  resolveAlert: (alertId: string, userId: string, resolution?: string) => Promise<void>;
  escalateAlert: (alertId: string, userId: string, reason?: string) => Promise<void>;
  suppressAlert: (alertId: string, userId: string, durationMinutes: number, reason: string) => Promise<void>;
  correlateAlerts: (alertIds: string[], correlationRule: string) => Promise<string>;
  promoteToIncident: (alertId: string, userId: string) => Promise<string>;

  // UI Helpers (Client-Side Only)
  getFilteredAlerts: (filters: AlertUIFilters) => Alert[];
  searchAlerts: (query: string) => Alert[];
  getSortedAlerts: (sortBy: keyof Alert, direction: 'asc' | 'desc') => Alert[];
  
  // Quick Access Getters (No Business Logic)
  openAlerts: Alert[];
  criticalAlerts: Alert[];
  myAlerts: Alert[];
  recentAlerts: Alert[];

  // Config from Backend
  config: {
    statuses: string[];
    severities: string[];
    sourceSystems: string[];
    notificationChannels: string[];
  };

  // Cache Management
  clearCache: () => void;
  invalidateCache: () => void;
  getCacheStats: () => { size: number; lastCleared: string | null; hitRate: number };
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

// ---------------------------------
// 5. Provider Implementation
// ---------------------------------
export const AlertsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig, validateEnum } = useConfig();

  // Core async state
  const [alertsState, setAlertsState] = useState<AsyncState<Alert[]>>({
    data: [],
    isLoading: false,
    error: null,
    lastFetch: null,
    stale: true,
  });

  // Optimistic updates tracking
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdate<Alert>[]>([]);
  
  // Cache management
  const [cacheStats, setCacheStats] = useState({
    size: 0,
    lastCleared: null as string | null,
    hitRate: 0,
    requests: 0,
    hits: 0,
  });

  // Cache configuration
  const cacheConfig: CacheConfig = {
    ttlMinutes: 5, // 5 minutes for alert data
    maxSize: 1000, // Maximum alerts to cache
  };

  // Extract alert-specific config from backend
  const config = useMemo(() => ({
    statuses: globalConfig?.statuses?.alerts || [],
    severities: Object.keys(globalConfig?.severities || {}),
    sourceSystems: ['monitoring', 'logging', 'apm', 'security', 'custom'],
    notificationChannels: ['email', 'sms', 'slack', 'webhook', 'pagerduty'],
  }), [globalConfig]);

  // Basic UI validation only (not business rules)
  const validateAlertUI = useCallback((alert: Partial<Alert>) => {
    const errors: string[] = [];

    if (!alert.title || alert.title.trim().length < 3) {
      errors.push("Title must be at least 3 characters long");
    }

    if (!alert.description || alert.description.trim().length < 10) {
      errors.push("Description must be at least 10 characters long");
    }

    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
  }, []);

  // UI metadata helper (not business logic)
  const ensureUIMetadata = useCallback((alert: Partial<Alert>): Alert => {
    const now = new Date().toISOString();
    return {
      id: alert.id || crypto.randomUUID(),
      tags: [],
      escalation_team_ids: [],
      child_alert_ids: [],
      notification_channels: ['email'],
      escalation_level: 1,
      recommendations: [],
      health_status: "gray",
      sync_status: "dirty",
      ...alert,
      tenantId,
      created_at: alert.created_at || now,
      updated_at: now,
      synced_at: alert.synced_at || now,
    } as Alert;
  }, [tenantId]);

  // Check if data is stale
  const isDataStale = useCallback(() => {
    if (!alertsState.lastFetch) return true;
    const staleThreshold = cacheConfig.ttlMinutes * 60 * 1000;
    return Date.now() - new Date(alertsState.lastFetch).getTime() > staleThreshold;
  }, [alertsState.lastFetch, cacheConfig.ttlMinutes]);

  // Apply optimistic updates to display data
  const getDisplayData = useCallback(() => {
    let data = alertsState.data || [];
    
    // Apply optimistic updates for immediate UI feedback
    optimisticUpdates.forEach(update => {
      switch (update.operation) {
        case 'create':
          data = [update.payload, ...data];
          break;
        case 'update':
          data = data.map(item => item.id === update.payload.id ? update.payload : item);
          break;
        case 'delete':
          data = data.filter(item => item.id !== update.id);
          break;
      }
    });

    return data;
  }, [alertsState.data, optimisticUpdates]);

  // Clear optimistic updates after successful API calls
  const clearOptimisticUpdate = useCallback((id: string) => {
    setOptimisticUpdates(prev => prev.filter(update => update.id !== id));
  }, []);

  // Add optimistic update for immediate UI feedback
  const addOptimisticUpdate = useCallback((update: OptimisticUpdate<Alert>) => {
    setOptimisticUpdates(prev => [...prev.filter(u => u.id !== update.id), update]);
    
    // Auto-clear optimistic update after timeout
    setTimeout(() => clearOptimisticUpdate(update.id), 10000);
  }, [clearOptimisticUpdate]);

  // Rollback optimistic update on failure
  const rollbackOptimisticUpdate = useCallback((id: string) => {
    setOptimisticUpdates(prev => prev.filter(update => update.id !== id));
  }, []);

  // Core data fetching
  const refreshAlerts = useCallback(async () => {
    if (!tenantId) return;

    setAlertsState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const alerts = await getAll<Alert>(tenantId, "alerts");
      
      // Simple client-side sorting for UI (not business logic)
      const severityOrder = { 'critical': 5, 'major': 4, 'minor': 3, 'warning': 2, 'info': 1 };
      alerts.sort((a, b) => {
        const aSeverity = severityOrder[a.severity] || 0;
        const bSeverity = severityOrder[b.severity] || 0;
        if (aSeverity !== bSeverity) return bSeverity - aSeverity;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setAlertsState({
        data: alerts,
        isLoading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        stale: false,
      });

      // Update cache stats
      setCacheStats(prev => ({
        ...prev,
        size: alerts.length,
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch alerts';
      setAlertsState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        stale: true,
      }));
    }
  }, [tenantId]);

  const getAlert = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    
    // Update cache stats
    setCacheStats(prev => {
      const requests = prev.requests + 1;
      const existingAlert = alertsState.data?.find(a => a.id === id);
      const hits = existingAlert ? prev.hits + 1 : prev.hits;
      return {
        ...prev,
        requests,
        hits,
        hitRate: requests > 0 ? (hits / requests) * 100 : 0,
      };
    });

    return getById<Alert>(tenantId, "alerts", id);
  }, [tenantId, alertsState.data]);

  // CRUD Operations - Pure API orchestration
  const createAlert = useCallback(async (
    alertData: Omit<Alert, 'id' | 'created_at' | 'updated_at'>, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");

    // Only basic UI validation
    validateAlertUI(alertData);

    const alert = ensureUIMetadata(alertData);
    const updateId = crypto.randomUUID();

    // Optimistic update for immediate UI feedback
    addOptimisticUpdate({
      id: updateId,
      operation: 'create',
      payload: alert,
      timestamp: new Date().toISOString(),
    });

    try {
      const priority = alert.severity === 'critical' ? 'critical' : 
                      alert.severity === 'major' ? 'high' : 'normal';

      // API call - backend handles all business logic
      await putWithAudit(
        tenantId,
        "alerts",
        alert,
        userId,
        {
          action: "create",
          description: `Created alert: ${alert.title}`,
          tags: ["alert", "create", alert.severity, alert.source_system],
          priority,
          metadata: {
            severity: alert.severity,
            source_system: alert.source_system,
          },
        }
      );

      await enqueueItem({
        storeName: "alerts",
        entityId: alert.id,
        action: "create",
        payload: alert,
        priority,
      });

      clearOptimisticUpdate(updateId);
      await refreshAlerts();
    } catch (error) {
      rollbackOptimisticUpdate(updateId);
      throw error;
    }
  }, [tenantId, validateAlertUI, ensureUIMetadata, addOptimisticUpdate, enqueueItem, clearOptimisticUpdate, refreshAlerts, rollbackOptimisticUpdate]);

  const updateAlert = useCallback(async (alert: Alert, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateAlertUI(alert);

    const enriched = ensureUIMetadata({
      ...alert,
      updated_at: new Date().toISOString(),
    });

    const updateId = crypto.randomUUID();

    // Optimistic update
    addOptimisticUpdate({
      id: updateId,
      operation: 'update',
      payload: enriched,
      timestamp: new Date().toISOString(),
    });

    try {
      const priority = alert.severity === 'critical' ? 'critical' : 
                      alert.severity === 'major' ? 'high' : 'normal';

      // API call - backend handles validation and business logic
      await putWithAudit(
        tenantId,
        "alerts",
        enriched,
        userId,
        {
          action: "update",
          description: `Updated alert: ${alert.title}`,
          tags: ["alert", "update", alert.status, alert.severity],
          priority,
        }
      );

      await enqueueItem({
        storeName: "alerts",
        entityId: enriched.id,
        action: "update",
        payload: enriched,
        priority,
      });

      clearOptimisticUpdate(updateId);
      await refreshAlerts();
    } catch (error) {
      rollbackOptimisticUpdate(updateId);
      throw error;
    }
  }, [tenantId, validateAlertUI, ensureUIMetadata, addOptimisticUpdate, enqueueItem, clearOptimisticUpdate, refreshAlerts, rollbackOptimisticUpdate]);

  const deleteAlert = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    const alert = await getAlert(id);
    const updateId = crypto.randomUUID();
    
    // Optimistic update
    addOptimisticUpdate({
      id: updateId,
      operation: 'delete',
      payload: alert!,
      timestamp: new Date().toISOString(),
    });

    try {
      await removeWithAudit(
        tenantId,
        "alerts",
        id,
        userId,
        {
          action: "delete",
          description: `Deleted alert: ${alert?.title || id}`,
          tags: ["alert", "delete"],
        }
      );

      await enqueueItem({
        storeName: "alerts",
        entityId: id,
        action: "delete",
        payload: null,
      });

      clearOptimisticUpdate(updateId);
      await refreshAlerts();
    } catch (error) {
      rollbackOptimisticUpdate(updateId);
      throw error;
    }
  }, [tenantId, getAlert, addOptimisticUpdate, enqueueItem, clearOptimisticUpdate, refreshAlerts, rollbackOptimisticUpdate]);

  // Alert Operations - Simple API calls
  const acknowledgeAlert = useCallback(async (alertId: string, userId: string) => {
    // Backend API call handles all business logic
    const response = await fetch(`/api/alerts/${alertId}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, tenantId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to acknowledge alert: ${response.statusText}`);
    }

    await refreshAlerts();
  }, [tenantId, refreshAlerts]);

  const resolveAlert = useCallback(async (alertId: string, userId: string, resolution?: string) => {
    const response = await fetch(`/api/alerts/${alertId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, tenantId, resolution }),
    });

    if (!response.ok) {
      throw new Error(`Failed to resolve alert: ${response.statusText}`);
    }

    await refreshAlerts();
  }, [tenantId, refreshAlerts]);

  const escalateAlert = useCallback(async (alertId: string, userId: string, reason?: string) => {
    const response = await fetch(`/api/alerts/${alertId}/escalate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, tenantId, reason }),
    });

    if (!response.ok) {
      throw new Error(`Failed to escalate alert: ${response.statusText}`);
    }

    await refreshAlerts();
  }, [tenantId, refreshAlerts]);

  const suppressAlert = useCallback(async (
    alertId: string, 
    userId: string, 
    durationMinutes: number, 
    reason: string
  ) => {
    const response = await fetch(`/api/alerts/${alertId}/suppress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, tenantId, durationMinutes, reason }),
    });

    if (!response.ok) {
      throw new Error(`Failed to suppress alert: ${response.statusText}`);
    }

    await refreshAlerts();
  }, [tenantId, refreshAlerts]);

  const correlateAlerts = useCallback(async (alertIds: string[], correlationRule: string) => {
    const response = await fetch('/api/alerts/correlate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertIds, correlationRule, tenantId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to correlate alerts: ${response.statusText}`);
    }

    const result = await response.json();
    await refreshAlerts();
    return result.correlationId;
  }, [tenantId, refreshAlerts]);

  const promoteToIncident = useCallback(async (alertId: string, userId: string) => {
    const response = await fetch(`/api/alerts/${alertId}/promote-to-incident`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, tenantId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to promote alert to incident: ${response.statusText}`);
    }

    const result = await response.json();
    await refreshAlerts();
    return result.incidentId;
  }, [tenantId, refreshAlerts]);

  // UI Helpers - Simple client-side filtering for responsiveness
  const getFilteredAlerts = useCallback((filters: AlertUIFilters): Alert[] => {
    const alerts = getDisplayData();
    
    return alerts.filter(alert => {
      // Status filter
      if (filters.status?.length && !filters.status.includes(alert.status)) {
        return false;
      }

      // Severity filter
      if (filters.severity?.length && !filters.severity.includes(alert.severity)) {
        return false;
      }

      // Source system filter
      if (filters.sourceSystem?.length && !filters.sourceSystem.includes(alert.source_system)) {
        return false;
      }

      // Business service filter
      if (filters.businessService?.length && alert.business_service_id && 
          !filters.businessService.includes(alert.business_service_id)) {
        return false;
      }

      // Assigned to me filter (requires current user context)
      if (filters.assignedToMe && (!alert.assigned_to_user_id)) {
        // Would need current user context for proper filtering
        return false;
      }

      // Team filter
      if (filters.teamId && alert.assigned_to_team_id !== filters.teamId) {
        return false;
      }

      // Tags filter
      if (filters.tags?.length) {
        const hasAllTags = filters.tags.every(tag => alert.tags.includes(tag));
        if (!hasAllTags) return false;
      }

      // Date range filter
      if (filters.dateRange) {
        const alertDate = new Date(alert.created_at);
        const startDate = new Date(filters.dateRange.start);
        const endDate = new Date(filters.dateRange.end);
        if (alertDate < startDate || alertDate > endDate) {
          return false;
        }
      }

      // Text search filter
      if (filters.textSearch) {
        const query = filters.textSearch.toLowerCase();
        const searchableText = [
          alert.title,
          alert.description,
          alert.source_system,
          ...alert.tags,
        ].join(' ').toLowerCase();
        
        if (!searchableText.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [getDisplayData]);

  const searchAlerts = useCallback((query: string): Alert[] => {
    return getFilteredAlerts({ textSearch: query });
  }, [getFilteredAlerts]);

  const getSortedAlerts = useCallback((
    sortBy: keyof Alert, 
    direction: 'asc' | 'desc' = 'desc'
  ): Alert[] => {
    const alerts = [...getDisplayData()];
    
    return alerts.sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      
      if (aValue === bValue) return 0;
      
      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime();
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }
      
      return direction === 'asc' ? comparison : -comparison;
    });
  }, [getDisplayData]);

  // Quick access getters - simple client-side filtering
  const openAlerts = useMemo(() => {
    return getDisplayData().filter(alert => !['resolved', 'closed'].includes(alert.status));
  }, [getDisplayData]);

  const criticalAlerts = useMemo(() => {
    return getDisplayData().filter(alert => alert.severity === 'critical');
  }, [getDisplayData]);

  const myAlerts = useMemo(() => {
    // Would need current user context for proper filtering
    return getDisplayData().filter(alert => alert.assigned_to_user_id);
  }, [getDisplayData]);

  const recentAlerts = useMemo(() => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return getDisplayData()
      .filter(alert => new Date(alert.created_at) > oneDayAgo)
      .slice(0, 20);
  }, [getDisplayData]);

  // Cache management
  const clearCache = useCallback(() => {
    setAlertsState({
      data: [],
      isLoading: false,
      error: null,
      lastFetch: null,
      stale: true,
    });
    setOptimisticUpdates([]);
    setCacheStats(prev => ({
      ...prev,
      size: 0,
      lastCleared: new Date().toISOString(),
    }));
  }, []);

  const invalidateCache = useCallback(() => {
    setAlertsState(prev => ({
      ...prev,
      stale: true,
    }));
  }, []);

  const getCacheStats = useCallback(() => cacheStats, [cacheStats]);

  // Auto-refresh when data is stale
  useEffect(() => {
    if (tenantId && globalConfig && (alertsState.stale || !alertsState.data)) {
      refreshAlerts();
    }
  }, [tenantId, globalConfig, alertsState.stale, refreshAlerts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearCache();
    };
  }, [clearCache]);

  return (
    <AlertsContext.Provider
      value={{
        alerts: {
          ...alertsState,
          data: getDisplayData(),
          stale: alertsState.stale || isDataStale(),
        },
        createAlert,
        updateAlert,
        deleteAlert,
        refreshAlerts,
        getAlert,
        acknowledgeAlert,
        resolveAlert,
        escalateAlert,
        suppressAlert,
        correlateAlerts,
        promoteToIncident,
        getFilteredAlerts,
        searchAlerts,
        getSortedAlerts,
        openAlerts,
        criticalAlerts,
        myAlerts,
        recentAlerts,
        config,
        clearCache,
        invalidateCache,
        getCacheStats,
      }}
    >
      {children}
    </AlertsContext.Provider>
  );
};

// ---------------------------------
// 6. Hooks
// ---------------------------------
export const useAlerts = (): AlertsContextType => {
  const ctx = useContext(AlertsContext);
  if (!ctx) {
    throw new Error("useAlerts must be used within AlertsProvider");
  }
  return ctx;
};

/**
 * Hook for individual alert details with caching
 */
export const useAlertDetails = (id: string): AlertDetails | undefined => {
  const { alerts, getAlert } = useAlerts();
  const [alertDetails, setAlertDetails] = useState<AlertDetails | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // First check cached data
    const cachedAlert = alerts.data?.find((a) => a.id === id);
    if (cachedAlert) {
      setAlertDetails(cachedAlert as AlertDetails);
      return;
    }

    // If not in cache, fetch from API
    if (id && !isLoading) {
      setIsLoading(true);
      getAlert(id)
        .then(alert => {
          setAlertDetails(alert as AlertDetails);
        })
        .catch(error => {
          console.error(`Failed to fetch alert details for ${id}:`, error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [id, alerts.data, getAlert, isLoading]);

  return alertDetails;
};

/**
 * Selective subscription hooks for performance
 */
export const useCriticalAlerts = () => {
  const { criticalAlerts } = useAlerts();
  return criticalAlerts;
};

export const useOpenAlerts = () => {
  const { openAlerts } = useAlerts();
  return openAlerts;
};

export const useAlertsByStatus = (status: AlertStatus) => {
  const { getFilteredAlerts } = useAlerts();
  
  return useMemo(() => {
    return getFilteredAlerts({ status: [status] });
  }, [getFilteredAlerts, status]);
};

export const useMyAlerts = () => {
  const { myAlerts } = useAlerts();
  return myAlerts;
};

export const useRecentAlerts = () => {
  const { recentAlerts } = useAlerts();
  return recentAlerts;
};

/**
 * Hook for filtered alerts with memoization
 */
export const useFilteredAlerts = (filters: AlertUIFilters) => {
  const { getFilteredAlerts } = useAlerts();
  
  return useMemo(() => {
    return getFilteredAlerts(filters);
  }, [getFilteredAlerts, filters]);
};

/**
 * Hook for alert search with debouncing
 */
export const useAlertSearch = (query: string, debounceMs: number = 300) => {
  const { searchAlerts } = useAlerts();
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);
    
    return () => clearTimeout(timer);
  }, [query, debounceMs]);
  
  return useMemo(() => {
    return debouncedQuery ? searchAlerts(debouncedQuery) : [];
  }, [searchAlerts, debouncedQuery]);
};