// src/contexts/AlertsContext.tsx
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
// 2. Context Interface
// ---------------------------------
interface AlertsContextType {
  alerts: Alert[];
  addAlert: (alert: Alert, userId?: string) => Promise<void>;
  updateAlert: (alert: Alert, userId?: string) => Promise<void>;
  deleteAlert: (id: string, userId?: string) => Promise<void>;
  refreshAlerts: () => Promise<void>;
  getAlert: (id: string) => Promise<Alert | undefined>;

  // Alert-specific operations
  acknowledgeAlert: (alertId: string, userId: string) => Promise<void>;
  resolveAlert: (alertId: string, userId: string, resolution?: string) => Promise<void>;
  escalateAlert: (alertId: string, userId: string, reason?: string) => Promise<void>;
  suppressAlert: (alertId: string, userId: string, durationMinutes: number, reason: string) => Promise<void>;
  correlateAlerts: (alertIds: string[], correlationRule: string) => Promise<string>;
  promoteToIncident: (alertId: string, userId: string) => Promise<string>;

  // Filtering and querying
  getAlertsByStatus: (status: AlertStatus) => Alert[];
  getAlertsBySeverity: (severity: AlertSeverity) => Alert[];
  getAlertsByBusinessService: (serviceId: string) => Alert[];
  getAlertsBySourceSystem: (sourceSystem: string) => Alert[];
  getOpenAlerts: () => Alert[];
  getCriticalAlerts: () => Alert[];
  getCorrelatedAlerts: () => Alert[];
  getSuppressedAlerts: () => Alert[];
  getEscalatedAlerts: () => Alert[];

  // Config integration
  config: {
    statuses: string[];
    severities: string[];
    sourceSystems: string[];
    notificationChannels: string[];
  };
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const AlertsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig, validateEnum } = useConfig();
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Extract alert-specific config
  const config = {
    statuses: globalConfig?.statuses?.alerts || [],
    severities: Object.keys(globalConfig?.severities || {}),
    sourceSystems: ['monitoring', 'logging', 'apm', 'security', 'custom'],
    notificationChannels: ['email', 'sms', 'slack', 'webhook', 'pagerduty'],
  };

  const refreshAlerts = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      const all = await getAll<Alert>(tenantId, "alerts");
      
      // Sort by severity and created_at (critical first, then newest)
      const severityOrder = { 'critical': 5, 'major': 4, 'minor': 3, 'warning': 2, 'info': 1 };
      all.sort((a, b) => {
        const aSeverity = severityOrder[a.severity] || 0;
        const bSeverity = severityOrder[b.severity] || 0;
        if (aSeverity !== bSeverity) return bSeverity - aSeverity;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      
      setAlerts(all);
    } catch (error) {
      console.error("Failed to refresh alerts:", error);
    }
  }, [tenantId]);

  const getAlert = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    return getById<Alert>(tenantId, "alerts", id);
  }, [tenantId]);

  const validateAlert = useCallback((alert: Alert) => {
    if (!globalConfig) {
      throw new Error("Configuration not loaded");
    }

    // Validate status
    if (!validateEnum('statuses', alert.status)) {
      throw new Error(`Invalid status: ${alert.status}. Valid options: ${config.statuses.join(', ')}`);
    }

    // Validate severity
    if (!config.severities.includes(alert.severity)) {
      throw new Error(`Invalid severity: ${alert.severity}. Valid options: ${config.severities.join(', ')}`);
    }

    // Validate source system
    if (!config.sourceSystems.includes(alert.source_system)) {
      throw new Error(`Invalid source system: ${alert.source_system}. Valid options: ${config.sourceSystems.join(', ')}`);
    }

    // Validate required fields
    if (!alert.title || alert.title.trim().length < 3) {
      throw new Error("Title must be at least 3 characters long");
    }

    if (!alert.description || alert.description.trim().length < 10) {
      throw new Error("Description must be at least 10 characters long");
    }

    // Validate notification channels
    if (alert.notification_channels) {
      alert.notification_channels.forEach(channel => {
        if (!config.notificationChannels.includes(channel)) {
          throw new Error(`Invalid notification channel: ${channel}. Valid options: ${config.notificationChannels.join(', ')}`);
        }
      });
    }

    // Validate threshold configuration
    if (alert.threshold_value !== undefined && alert.threshold_operator === undefined) {
      throw new Error("Threshold operator is required when threshold value is specified");
    }
  }, [globalConfig, validateEnum, config]);

  const ensureMetadata = useCallback((alert: Alert): Alert => {
    const now = new Date().toISOString();
    return {
      ...alert,
      tenantId,
      tags: alert.tags || [],
      health_status: alert.health_status || "gray",
      sync_status: alert.sync_status || "dirty",
      synced_at: alert.synced_at || now,
      recommendations: alert.recommendations || [],
      escalation_team_ids: alert.escalation_team_ids || [],
      child_alert_ids: alert.child_alert_ids || [],
      notification_channels: alert.notification_channels || ['email'],
      escalation_level: alert.escalation_level || 1,
    };
  }, [tenantId]);

  const addAlert = useCallback(async (alert: Alert, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateAlert(alert);

    const now = new Date().toISOString();
    const enriched = ensureMetadata({
      ...alert,
      created_at: now,
      updated_at: now,
    });

    const priority = alert.severity === 'critical' ? 'critical' : 
                    alert.severity === 'major' ? 'high' : 'normal';

    await putWithAudit(
      tenantId,
      "alerts",
      enriched,
      userId,
      {
        action: "create",
        description: `Created alert: ${alert.title}`,
        tags: ["alert", "create", alert.severity, alert.source_system],
        priority,
        metadata: {
          severity: alert.severity,
          source_system: alert.source_system,
          threshold_value: alert.threshold_value,
          current_value: alert.current_value,
        },
      }
    );

    await enqueueItem({
      storeName: "alerts",
      entityId: enriched.id,
      action: "create",
      payload: enriched,
      priority,
    });

    await refreshAlerts();
  }, [tenantId, validateAlert, ensureMetadata, enqueueItem, refreshAlerts]);

  const updateAlert = useCallback(async (alert: Alert, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateAlert(alert);

    const enriched = ensureMetadata({
      ...alert,
      updated_at: new Date().toISOString(),
    });

    const priority = alert.severity === 'critical' ? 'critical' : 
                    alert.severity === 'major' ? 'high' : 'normal';

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

    await refreshAlerts();
  }, [tenantId, validateAlert, ensureMetadata, enqueueItem, refreshAlerts]);

  const deleteAlert = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    const alert = await getAlert(id);
    
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

    await refreshAlerts();
  }, [tenantId, getAlert, enqueueItem, refreshAlerts]);

  // Alert-specific operations
  const acknowledgeAlert = useCallback(async (alertId: string, userId: string) => {
    const alert = await getAlert(alertId);
    if (!alert) throw new Error(`Alert ${alertId} not found`);

    const updated = {
      ...alert,
      status: 'acknowledged' as AlertStatus,
      acknowledged_at: new Date().toISOString(),
      acknowledged_by_user_id: userId,
    };

    await updateAlert(updated, userId);
  }, [getAlert, updateAlert]);

  const resolveAlert = useCallback(async (alertId: string, userId: string, resolution?: string) => {
    const alert = await getAlert(alertId);
    if (!alert) throw new Error(`Alert ${alertId} not found`);

    const updated = {
      ...alert,
      status: 'resolved' as AlertStatus,
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: userId,
    };

    if (resolution) {
      updated.custom_fields = { ...updated.custom_fields, resolution_notes: resolution };
    }

    await updateAlert(updated, userId);
  }, [getAlert, updateAlert]);

  const escalateAlert = useCallback(async (alertId: string, userId: string, reason?: string) => {
    const alert = await getAlert(alertId);
    if (!alert) throw new Error(`Alert ${alertId} not found`);

    const updated = {
      ...alert,
      escalation_level: (alert.escalation_level || 1) + 1,
      escalated_at: new Date().toISOString(),
    };

    if (reason) {
      updated.custom_fields = { ...updated.custom_fields, escalation_reason: reason };
    }

    await updateAlert(updated, userId);
  }, [getAlert, updateAlert]);

  const suppressAlert = useCallback(async (
    alertId: string, 
    userId: string, 
    durationMinutes: number, 
    reason: string
  ) => {
    const alert = await getAlert(alertId);
    if (!alert) throw new Error(`Alert ${alertId} not found`);

    const suppressUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

    const updated = {
      ...alert,
      suppressed_until: suppressUntil,
      suppressed_by_user_id: userId,
      suppression_reason: reason,
    };

    await updateAlert(updated, userId);
  }, [getAlert, updateAlert]);

  const correlateAlerts = useCallback(async (alertIds: string[], correlationRule: string) => {
    if (alertIds.length < 2) {
      throw new Error("At least 2 alerts are required for correlation");
    }

    const correlationId = crypto.randomUUID();
    const correlationTimestamp = new Date().toISOString();

    // Update all alerts with correlation information
    for (const alertId of alertIds) {
      const alert = await getAlert(alertId);
      if (alert) {
        const updated = {
          ...alert,
          correlation: {
            correlation_id: correlationId,
            correlation_rule: correlationRule,
            related_alert_ids: alertIds.filter(id => id !== alertId),
            correlation_timestamp: correlationTimestamp,
            correlation_confidence: 0.85, // Mock confidence score
          },
        };
        
        await updateAlert(updated);
      }
    }

    return correlationId;
  }, [getAlert, updateAlert]);

  const promoteToIncident = useCallback(async (alertId: string, userId: string) => {
    const alert = await getAlert(alertId);
    if (!alert) throw new Error(`Alert ${alertId} not found`);

    // This would typically create an incident and link it
    const incidentId = crypto.randomUUID();
    
    const updated = {
      ...alert,
      incident_id: incidentId,
      status: 'resolved' as AlertStatus,
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: userId,
    };

    updated.custom_fields = { 
      ...updated.custom_fields, 
      promoted_to_incident: incidentId,
      promotion_reason: "Alert promoted to incident for further investigation"
    };

    await updateAlert(updated, userId);
    
    return incidentId;
  }, [getAlert, updateAlert]);

  // Filtering functions
  const getAlertsByStatus = useCallback((status: AlertStatus) => {
    return alerts.filter(a => a.status === status);
  }, [alerts]);

  const getAlertsBySeverity = useCallback((severity: AlertSeverity) => {
    return alerts.filter(a => a.severity === severity);
  }, [alerts]);

  const getAlertsByBusinessService = useCallback((serviceId: string) => {
    return alerts.filter(a => a.business_service_id === serviceId);
  }, [alerts]);

  const getAlertsBySourceSystem = useCallback((sourceSystem: string) => {
    return alerts.filter(a => a.source_system === sourceSystem);
  }, [alerts]);

  const getOpenAlerts = useCallback(() => {
    return alerts.filter(a => !['resolved', 'closed'].includes(a.status));
  }, [alerts]);

  const getCriticalAlerts = useCallback(() => {
    return alerts.filter(a => a.severity === 'critical');
  }, [alerts]);

  const getCorrelatedAlerts = useCallback(() => {
    return alerts.filter(a => a.correlation !== undefined);
  }, [alerts]);

  const getSuppressedAlerts = useCallback(() => {
    const now = new Date();
    return alerts.filter(a => 
      a.suppressed_until && new Date(a.suppressed_until) > now
    );
  }, [alerts]);

  const getEscalatedAlerts = useCallback(() => {
    return alerts.filter(a => (a.escalation_level || 1) > 1);
  }, [alerts]);

  // Initialize
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshAlerts();
    }
  }, [tenantId, globalConfig, refreshAlerts]);

  return (
    <AlertsContext.Provider
      value={{
        alerts,
        addAlert,
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
        getAlertsByStatus,
        getAlertsBySeverity,
        getAlertsByBusinessService,
        getAlertsBySourceSystem,
        getOpenAlerts,
        getCriticalAlerts,
        getCorrelatedAlerts,
        getSuppressedAlerts,
        getEscalatedAlerts,
        config,
      }}
    >
      {children}
    </AlertsContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------
export const useAlerts = (): AlertsContextType => {
  const ctx = useContext(AlertsContext);
  if (!ctx) {
    throw new Error("useAlerts must be used within AlertsProvider");
  }
  return ctx;
};

export const useAlertDetails = (id: string): AlertDetails | undefined => {
  const { alerts } = useAlerts();
  const alert = alerts.find((a) => a.id === id);
  return alert as AlertDetails;
};

// Utility hooks
export const useCriticalAlerts = () => {
  const { getCriticalAlerts } = useAlerts();
  return getCriticalAlerts();
};

export const useOpenAlerts = () => {
  const { getOpenAlerts } = useAlerts();
  return getOpenAlerts();
};

export const useAlertsByStatus = (status: AlertStatus) => {
  const { getAlertsByStatus } = useAlerts();
  return getAlertsByStatus(status);
};

export const useCorrelatedAlerts = () => {
  const { getCorrelatedAlerts } = useAlerts();
  return getCorrelatedAlerts();
};