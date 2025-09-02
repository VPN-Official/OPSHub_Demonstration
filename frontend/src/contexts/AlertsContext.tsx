import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  getAll,
  getById as dbGetById,
  putWithAudit,
  removeWithAudit,
} from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { loadConfig } from "../config/configLoader";
import { useEvents } from "./EventsContext";
import { useIncidents } from "./IncidentsContext";
import { useServiceComponents } from "./ServiceComponentsContext";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------
export type AlertStatus =
  | "open"
  | "acknowledged"
  | "suppressed"
  | "auto_resolved"
  | "promoted"
  | "closed";

export type AlertSeverity = "info" | "warning" | "critical";

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

export interface Alert {
  id: string;
  title: string;
  description: string;
  status: AlertStatus;
  severity: AlertSeverity;
  created_at: string;
  updated_at: string;

  event_id?: string | null;
  incident_id?: string | null;
  service_component_id?: string | null;

  recommendations?: LinkedRecommendation[];

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
}

export interface AlertDetails extends Alert {
  event?: any;
  incident?: any;
  service_component?: any;
}

interface AlertsContextType {
  alerts: Alert[];
  refresh: () => Promise<void>;
  addAlert: (alert: Alert) => Promise<void>;
  updateAlert: (alert: Alert) => Promise<void>;
  deleteAlert: (id: string) => Promise<void>;
  getAlertById: (id: string) => Promise<Alert | undefined>;
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

// ---------------------------------
// 2. Provider
// ---------------------------------
export const AlertsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueue } = useSync();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    if (tenantId) {
      loadConfig(tenantId).then(setConfig);
      refresh();
    }
  }, [tenantId]);

  const refresh = async () => {
    if (!tenantId) return;
    const data = await getAll<Alert>("alerts", tenantId);
    setAlerts(data);
  };

  const validateAlert = (alert: Alert) => {
    if (!config) return;

    if (!config.alerts?.statuses.includes(alert.status)) {
      throw new Error(`Invalid status: ${alert.status}`);
    }
    if (!config.alerts?.severities.includes(alert.severity)) {
      throw new Error(`Invalid severity: ${alert.severity}`);
    }
  };

  const ensureMetadata = (alert: Alert): Alert => {
    return {
      ...alert,
      tags: alert.tags ?? [],
      health_status: alert.health_status ?? "gray",
      sync_status: alert.sync_status ?? "dirty",
      synced_at: alert.synced_at ?? new Date().toISOString(),
    };
  };

  const addAlert = async (alert: Alert) => {
    validateAlert(alert);
    const enriched = ensureMetadata({
      ...alert,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await putWithAudit("alerts", enriched, tenantId, {
      action: "create",
      description: `Created alert ${alert.title}`,
    });
    enqueue("alerts", enriched);
    await refresh();
  };

  const updateAlert = async (alert: Alert) => {
    validateAlert(alert);
    const enriched = ensureMetadata({
      ...alert,
      updated_at: new Date().toISOString(),
    });
    await putWithAudit("alerts", enriched, tenantId, {
      action: "update",
      description: `Updated alert ${alert.id}`,
    });
    enqueue("alerts", enriched);
    await refresh();
  };

  const deleteAlert = async (id: string) => {
    await removeWithAudit("alerts", id, tenantId, {
      action: "delete",
      description: `Deleted alert ${id}`,
    });
    enqueue("alerts", { id, deleted: true });
    await refresh();
  };

  const getAlertById = async (id: string) => {
    return dbGetById<Alert>("alerts", id, tenantId);
  };

  return (
    <AlertsContext.Provider
      value={{ alerts, refresh, addAlert, updateAlert, deleteAlert, getAlertById }}
    >
      {children}
    </AlertsContext.Provider>
  );
};

// ---------------------------------
// 3. Hooks
// ---------------------------------
export const useAlerts = (): AlertsContextType => {
  const ctx = useContext(AlertsContext);
  if (!ctx) {
    throw new Error("useAlerts must be used within an AlertsProvider");
  }
  return ctx;
};

export const useAlertDetails = (id: string): AlertDetails | undefined => {
  const { alerts } = useAlerts();
  const { events } = useEvents();
  const { incidents } = useIncidents();
  const { serviceComponents } = useServiceComponents();

  const alert = alerts.find((a) => a.id === id);
  if (!alert) return undefined;

  const event = alert.event_id
    ? events.find((e) => e.id === alert.event_id)
    : undefined;

  const incident = alert.incident_id
    ? incidents.find((i) => i.id === alert.incident_id)
    : undefined;

  const service_component = alert.service_component_id
    ? serviceComponents.find((c) => c.id === alert.service_component_id)
    : undefined;

  return {
    ...alert,
    event,
    incident,
    service_component,
  };
};