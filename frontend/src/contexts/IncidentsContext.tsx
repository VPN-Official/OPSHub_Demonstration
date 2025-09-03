// src/contexts/IncidentsContext.tsx
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

  // Business impact
  business_impact?: string;
  customer_impact?: string;
  financial_impact?: number;
  affected_user_count?: number;

  // SLA tracking
  sla_target_minutes?: number;
  resolution_due_at?: string | null;
  breached?: boolean;
  breach_reason?: string;

  // Automation & AI
  recommendations: LinkedRecommendation[];
  auto_assigned?: boolean;
  ai_suggested_priority?: string;
  ai_suggested_category?: string;

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
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
// 2. Context Interface
// ---------------------------------
interface IncidentsContextType {
  incidents: Incident[];
  addIncident: (incident: Incident, userId?: string) => Promise<void>;
  updateIncident: (incident: Incident, userId?: string) => Promise<void>;
  deleteIncident: (id: string, userId?: string) => Promise<void>;
  refreshIncidents: () => Promise<void>;
  getIncident: (id: string) => Promise<Incident | undefined>;

  // Filtering and querying
  getIncidentsByStatus: (status: string) => Incident[];
  getIncidentsByPriority: (priority: string) => Incident[];
  getIncidentsByBusinessService: (serviceId: string) => Incident[];
  getOpenIncidents: () => Incident[];
  getBreachedIncidents: () => Incident[];

  // Config integration
  config: {
    statuses: string[];
    priorities: string[];
    impacts: string[];
    urgencies: string[];
  };
}

const IncidentsContext = createContext<IncidentsContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const IncidentsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig, validateEnum } = useConfig();
  const [incidents, setIncidents] = useState<Incident[]>([]);

  // Extract incident-specific config
  const config = {
    statuses: globalConfig?.statuses?.incidents || [],
    priorities: Object.keys(globalConfig?.priorities || {}),
    impacts: Object.keys(globalConfig?.severities || {}),
    urgencies: Object.keys(globalConfig?.severities || {}),
  };

  const refreshIncidents = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      const all = await getAll<Incident>(tenantId, "incidents");
      
      // Sort by created_at (newest first) and priority
      const priorityOrder = { 'P1': 4, 'P2': 3, 'P3': 2, 'P4': 1 };
      all.sort((a, b) => {
        const aPriority = priorityOrder[a.priority] || 0;
        const bPriority = priorityOrder[b.priority] || 0;
        if (aPriority !== bPriority) return bPriority - aPriority;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      
      setIncidents(all);
    } catch (error) {
      console.error("Failed to refresh incidents:", error);
    }
  }, [tenantId]);

  const getIncident = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    return getById<Incident>(tenantId, "incidents", id);
  }, [tenantId]);

  const validateIncident = useCallback((incident: Incident) => {
    if (!globalConfig) {
      throw new Error("Configuration not loaded");
    }

    if (!validateEnum('statuses', incident.status)) {
      throw new Error(`Invalid status: ${incident.status}. Valid options: ${config.statuses.join(', ')}`);
    }

    const priorities = Object.keys(globalConfig.priorities);
    if (!priorities.includes(incident.priority)) {
      throw new Error(`Invalid priority: ${incident.priority}. Valid options: ${priorities.join(', ')}`);
    }

    const impacts = Object.keys(globalConfig.severities);
    if (!impacts.includes(incident.impact)) {
      throw new Error(`Invalid impact: ${incident.impact}. Valid options: ${impacts.join(', ')}`);
    }

    if (!impacts.includes(incident.urgency)) {
      throw new Error(`Invalid urgency: ${incident.urgency}. Valid options: ${impacts.join(', ')}`);
    }

    // Validate required fields
    if (!incident.title || incident.title.trim().length < 5) {
      throw new Error("Title must be at least 5 characters long");
    }

    if (!incident.description || incident.description.trim().length < 10) {
      throw new Error("Description must be at least 10 characters long");
    }
  }, [globalConfig, validateEnum, config]);

  const ensureMetadata = useCallback((incident: Incident): Incident => {
    const now = new Date().toISOString();
    return {
      ...incident,
      tenantId,
      tags: incident.tags || [],
      health_status: incident.health_status || "gray",
      sync_status: incident.sync_status || "dirty",
      synced_at: incident.synced_at || now,
      recommendations: incident.recommendations || [],
      service_component_ids: incident.service_component_ids || [],
      asset_ids: incident.asset_ids || [],
      escalation_team_ids: incident.escalation_team_ids || [],
      related_log_ids: incident.related_log_ids || [],
      related_metric_ids: incident.related_metric_ids || [],
      related_event_ids: incident.related_event_ids || [],
      related_trace_ids: incident.related_trace_ids || [],
      related_problem_ids: incident.related_problem_ids || [],
      related_change_ids: incident.related_change_ids || [],
      child_incident_ids: incident.child_incident_ids || [],
    };
  }, [tenantId]);

  const addIncident = useCallback(async (incident: Incident, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateIncident(incident);

    const now = new Date().toISOString();
    const enriched = ensureMetadata({
      ...incident,
      created_at: now,
      updated_at: now,
    });

    // Calculate SLA target if priority is configured
    if (globalConfig?.slas?.incidents?.[incident.priority]) {
      enriched.sla_target_minutes = globalConfig.slas.incidents[incident.priority].target_minutes;
      enriched.resolution_due_at = new Date(
        Date.now() + enriched.sla_target_minutes * 60 * 1000
      ).toISOString();
    }

    await putWithAudit(
      tenantId,
      "incidents",
      enriched,
      userId,
      {
        action: "create",
        description: `Created incident: ${incident.title}`,
        tags: ["incident", "create", incident.priority],
        priority: incident.priority === 'P1' ? 'critical' : 'normal',
      }
    );

    // Enqueue for sync
    await enqueueItem({
      storeName: "incidents",
      entityId: enriched.id,
      action: "create",
      payload: enriched,
      priority: incident.priority === 'P1' ? 'critical' : 'normal',
    });

    await refreshIncidents();
  }, [tenantId, validateIncident, ensureMetadata, globalConfig, enqueueItem, refreshIncidents]);

  const updateIncident = useCallback(async (incident: Incident, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateIncident(incident);

    const enriched = ensureMetadata({
      ...incident,
      updated_at: new Date().toISOString(),
    });

    // Check for status change to resolved/closed
    const previousIncident = await getIncident(incident.id);
    if (previousIncident) {
      if (incident.status === 'resolved' && previousIncident.status !== 'resolved') {
        enriched.resolved_at = new Date().toISOString();
      }
      if (incident.status === 'closed' && previousIncident.status !== 'closed') {
        enriched.closed_at = new Date().toISOString();
      }
    }

    await putWithAudit(
      tenantId,
      "incidents",
      enriched,
      userId,
      {
        action: "update",
        description: `Updated incident: ${incident.title}`,
        tags: ["incident", "update", incident.status],
        priority: incident.priority === 'P1' ? 'critical' : 'normal',
      }
    );

    await enqueueItem({
      storeName: "incidents",
      entityId: enriched.id,
      action: "update",
      payload: enriched,
      priority: incident.priority === 'P1' ? 'critical' : 'normal',
    });

    await refreshIncidents();
  }, [tenantId, validateIncident, ensureMetadata, getIncident, enqueueItem, refreshIncidents]);

  const deleteIncident = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    await removeWithAudit(
      tenantId,
      "incidents",
      id,
      userId,
      {
        action: "delete",
        description: `Deleted incident: ${id}`,
        tags: ["incident", "delete"],
      }
    );

    await enqueueItem({
      storeName: "incidents",
      entityId: id,
      action: "delete",
      payload: null,
    });

    await refreshIncidents();
  }, [tenantId, enqueueItem, refreshIncidents]);

  // Filtering functions
  const getIncidentsByStatus = useCallback((status: string) => {
    return incidents.filter(i => i.status === status);
  }, [incidents]);

  const getIncidentsByPriority = useCallback((priority: string) => {
    return incidents.filter(i => i.priority === priority);
  }, [incidents]);

  const getIncidentsByBusinessService = useCallback((serviceId: string) => {
    return incidents.filter(i => i.business_service_id === serviceId);
  }, [incidents]);

  const getOpenIncidents = useCallback(() => {
    return incidents.filter(i => !['resolved', 'closed', 'cancelled'].includes(i.status));
  }, [incidents]);

  const getBreachedIncidents = useCallback(() => {
    return incidents.filter(i => i.breached === true);
  }, [incidents]);

  // Initialize
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshIncidents();
    }
  }, [tenantId, globalConfig, refreshIncidents]);

  return (
    <IncidentsContext.Provider
      value={{
        incidents,
        addIncident,
        updateIncident,
        deleteIncident,
        refreshIncidents,
        getIncident,
        getIncidentsByStatus,
        getIncidentsByPriority,
        getIncidentsByBusinessService,
        getOpenIncidents,
        getBreachedIncidents,
        config,
      }}
    >
      {children}
    </IncidentsContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------
export const useIncidents = (): IncidentsContextType => {
  const ctx = useContext(IncidentsContext);
  if (!ctx) {
    throw new Error("useIncidents must be used within IncidentsProvider");
  }
  return ctx;
};

export const useIncidentDetails = (id: string): IncidentDetails | undefined => {
  const { incidents } = useIncidents();
  // Note: In a full implementation, you'd enrich with related data from other contexts
  const incident = incidents.find((i) => i.id === id);
  return incident as IncidentDetails;
};

// Utility hooks
export const useIncidentsByPriority = (priority: string) => {
  const { getIncidentsByPriority } = useIncidents();
  return getIncidentsByPriority(priority);
};

export const useCriticalIncidents = () => {
  const { getIncidentsByPriority } = useIncidents();
  return getIncidentsByPriority('P1');
};

export const useOpenIncidents = () => {
  const { getOpenIncidents } = useIncidents();
  return getOpenIncidents();
};

export const useBreachedIncidents = () => {
  const { getBreachedIncidents } = useIncidents();
  return getBreachedIncidents();
};