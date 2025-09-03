import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { getAll, getById } from "../db/dbClient";
import { putWithAudit, removeWithAudit } from "../db/dbClient"
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

export interface ServiceRequest {
  id: string;
  title: string;
  description: string;
  status: string;   // from config.work.service_request.statuses
  priority: string; // from config.work.service_request.priorities
  urgency: string;  // from config.work.service_request.urgency_levels
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
  request_type: string;   // config-driven
  category: string;
  subcategory: string;
  product_family: string;

  // Fulfillment & Workflow
  fulfillment_type: string; // config-driven
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

  // Business Impact
  business_impact?: string;
  estimated_cost?: number | null;
  actual_cost?: number | null;
  billable_hours?: number | null;
  parts_cost?: number | null;
  customer_impact_summary?: string;

  // Risk & Compliance
  risk_score?: number;
  compliance_requirement_ids: string[];

  // Automation & Knowledge
  linked_recommendations: LinkedRecommendation[];

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------

interface ServiceRequestsContextType {
  serviceRequests: ServiceRequest[];
  addServiceRequest: (sr: ServiceRequest, userId?: string) => Promise<void>;
  updateServiceRequest: (sr: ServiceRequest, userId?: string) => Promise<void>;
  deleteServiceRequest: (id: string, userId?: string) => Promise<void>;
  refreshServiceRequests: () => Promise<void>;
  getServiceRequest: (id: string) => Promise<ServiceRequest | undefined>;

  // NEW: expose config enums
  config: {
    statuses: string[];
    priorities: string[];
    urgency_levels: string[];
    request_types: string[];
    fulfillment_types: string[];
    sla_targets: Record<string, number>;
  };
}

const ServiceRequestsContext = createContext<ServiceRequestsContextType | undefined>(
  undefined
);

// ---------------------------------
// 3. Provider
// ---------------------------------

export const ServiceRequestsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);

  const config = loadConfig(tenantId).work.service_request;

  const refreshServiceRequests = async () => {
    const all = await getAll<ServiceRequest>(tenantId, "service_requests");
    setServiceRequests(all);
  };

  const getServiceRequest = async (id: string) => {
    return getById<ServiceRequest>(tenantId, "service_requests", id);
  };

  const addServiceRequest = async (sr: ServiceRequest, userId?: string) => {
    // ✅ Validate against config
    if (!config.statuses.includes(sr.status)) {
      throw new Error(`Invalid status: ${sr.status}`);
    }
    if (!config.priorities.includes(sr.priority)) {
      throw new Error(`Invalid priority: ${sr.priority}`);
    }

    await putWithAudit(
      tenantId,
      "service_requests",
      sr,
      userId,
      { action: "create", description: `Service Request "${sr.title}" created` },
      enqueue
    );
    await refreshServiceRequests();
  };

  const updateServiceRequest = async (sr: ServiceRequest, userId?: string) => {
    await putWithAudit(
      tenantId,
      "service_requests",
      sr,
      userId,
      { action: "update", description: `Service Request "${sr.title}" updated` },
      enqueue
    );
    await refreshServiceRequests();
  };

  const deleteServiceRequest = async (id: string, userId?: string) => {
    await removeWithAudit(
      tenantId,
      "service_requests",
      id,
      userId,
      { description: `Service Request ${id} deleted` },
      enqueue
    );
    await refreshServiceRequests();
  };

  useEffect(() => {
    refreshServiceRequests();
  }, [tenantId]);

  return (
    <ServiceRequestsContext.Provider
      value={{
        serviceRequests,
        addServiceRequest,
        updateServiceRequest,
        deleteServiceRequest,
        refreshServiceRequests,
        getServiceRequest,
        config,
      }}
    >
      {children}
    </ServiceRequestsContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------

export const useServiceRequests = () => {
  const ctx = useContext(ServiceRequestsContext);
  if (!ctx) throw new Error("useServiceRequests must be used within ServiceRequestsProvider");
  return ctx;
};

export const useServiceRequestDetails = (id: string) => {
  const { serviceRequests } = useServiceRequests();
  const { endUsers } = useEndUsers();
  const sr = serviceRequests.find((r) => r.id === id);
  return sr
    ? { ...sr, requestor: endUsers.find((u) => u.id === sr.requested_by_end_user_id) || null }
    : null;
};