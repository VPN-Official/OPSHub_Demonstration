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
import { useEndUsers } from "./EndUsersContext";
import { loadConfig } from "../config/configLoader";

// ---------------------------------
// 1. Type Definitions
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

export interface Incident {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  impact: string;
  urgency: string;
  reported_by: string; // userId
  assigned_to?: string;
  created_at: string;
  updated_at: string;

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";

  recommendations?: LinkedRecommendation[];
}

export interface IncidentDetails extends Incident {
  reporter?: any; // resolved from EndUsersContext
}

interface IncidentsContextType {
  incidents: Incident[];
  refresh: () => Promise<void>;
  addIncident: (incident: Incident) => Promise<void>;
  updateIncident: (incident: Incident) => Promise<void>;
  deleteIncident: (id: string) => Promise<void>;
  getIncidentById: (id: string) => Promise<Incident | undefined>;
}

const IncidentsContext = createContext<IncidentsContextType | undefined>(
  undefined
);

// ---------------------------------
// 2. Provider
// ---------------------------------
export const IncidentsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueue } = useSync();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [config, setConfig] = useState<any>(null);

  // Load tenant config whenever tenantId changes
  useEffect(() => {
    if (tenantId) {
      loadConfig(tenantId).then(setConfig);
      refresh();
    }
  }, [tenantId]);

  // Refresh incidents from DB
  const refresh = async () => {
    if (!tenantId) return;
    const data = await getAll<Incident>("incidents", tenantId);
    setIncidents(data);
  };

  // Validation against tenant config
  const validateIncident = (incident: Incident) => {
    if (!config) return;

    if (!config.statuses.includes(incident.status)) {
      throw new Error(`Invalid status: ${incident.status}`);
    }
    if (!config.priorities.includes(incident.priority)) {
      throw new Error(`Invalid priority: ${incident.priority}`);
    }
    if (!config.impacts.includes(incident.impact)) {
      throw new Error(`Invalid impact: ${incident.impact}`);
    }
    if (!config.urgencies.includes(incident.urgency)) {
      throw new Error(`Invalid urgency: ${incident.urgency}`);
    }
  };

  // Enforce metadata consistency
  const ensureMetadata = (incident: Incident): Incident => {
    return {
      ...incident,
      tags: incident.tags ?? [],
      health_status: incident.health_status ?? "gray",
      sync_status: incident.sync_status ?? "dirty",
      synced_at: incident.synced_at ?? new Date().toISOString(),
    };
  };

  // Add
  const addIncident = async (incident: Incident) => {
    validateIncident(incident);
    const enriched = ensureMetadata({
      ...incident,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await putWithAudit("incidents", enriched, tenantId, {
      action: "create",
      description: `Created incident ${incident.title}`,
    });
    enqueue("incidents", enriched);
    await refresh();
  };

  // Update
  const updateIncident = async (incident: Incident) => {
    validateIncident(incident);
    const enriched = ensureMetadata({
      ...incident,
      updated_at: new Date().toISOString(),
    });
    await putWithAudit("incidents", enriched, tenantId, {
      action: "update",
      description: `Updated incident ${incident.id}`,
    });
    enqueue("incidents", enriched);
    await refresh();
  };

  // Delete
  const deleteIncident = async (id: string) => {
    await removeWithAudit("incidents", id, tenantId, {
      action: "delete",
      description: `Deleted incident ${id}`,
    });
    enqueue("incidents", { id, deleted: true });
    await refresh();
  };

  // Get by ID
  const getIncidentById = async (id: string) => {
    return dbGetById<Incident>("incidents", id, tenantId);
  };

  return (
    <IncidentsContext.Provider
      value={{ incidents, refresh, addIncident, updateIncident, deleteIncident, getIncidentById }}
    >
      {children}
    </IncidentsContext.Provider>
  );
};

// ---------------------------------
// 3. Hooks
// ---------------------------------
export const useIncidents = (): IncidentsContextType => {
  const ctx = useContext(IncidentsContext);
  if (!ctx) {
    throw new Error("useIncidents must be used within an IncidentsProvider");
  }
  return ctx;
};

// Hook to get enriched incident details with relationships
export const useIncidentDetails = (id: string): IncidentDetails | undefined => {
  const { incidents } = useIncidents();
  const { endUsers } = useEndUsers();

  const incident = incidents.find((i) => i.id === id);
  if (!incident) return undefined;

  const reporter = endUsers.find((u) => u.id === incident.reported_by);

  return {
    ...incident,
    reporter,
  };
};