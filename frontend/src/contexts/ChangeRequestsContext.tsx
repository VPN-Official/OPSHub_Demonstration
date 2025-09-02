import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAll, getById } from "../db/dbClient";
import { putWithAudit, removeWithAudit } from "../db/dbClient"
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useEndUsers } from "./EndUsersContext";

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

export interface ChangeRequest {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  risk: string;
  created_at: string;
  updated_at: string;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  implemented_at?: string | null;
  closed_at?: string | null;

  business_service_id?: string | null;
  service_component_ids: string[];
  asset_ids: string[];
  customer_id?: string | null;
  contract_id?: string | null;
  cost_center_id?: string | null;

  requested_by_end_user_id?: string | null;
  requested_by_user_id?: string | null;
  approver_user_ids: string[];
  implementer_user_ids: string[];
  assigned_team_id?: string | null;
  escalation_team_ids: string[];
  change_manager_user_id?: string | null;

  change_type: string;
  category: string;
  subcategory: string;
  product_family: string;

  risk_score?: number;
  rollback_plan?: { steps: string[]; estimated_minutes: number };
  test_plan?: { steps: string[]; estimated_minutes: number };
  pre_checks: { id: string; description: string; assigned_to_user_id?: string; status: string }[];
  post_checks: { id: string; description: string; assigned_to_user_id?: string; status: string }[];

  approval_required: boolean;
  approval_workflow: { step: string; approver_id: string; status: string; timestamp: string }[];
  change_window?: { start: string; end: string };
  conflict_with_change_ids: string[];

  related_incident_ids: string[];
  related_problem_ids: string[];
  related_service_request_ids: string[];
  related_change_ids: string[];

  related_log_ids: string[];
  related_metric_ids: string[];
  related_event_ids: string[];
  related_trace_ids: string[];

  business_impact?: string;
  estimated_downtime_minutes?: number;
  actual_downtime_minutes?: number | null;
  expected_business_loss?: number | null;
  actual_business_loss?: number | null;

  linked_recommendations: LinkedRecommendation[];

  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
}

interface ChangeRequestsContextType {
  changeRequests: ChangeRequest[];
  addChangeRequest: (cr: ChangeRequest, userId?: string) => Promise<void>;
  updateChangeRequest: (cr: ChangeRequest, userId?: string) => Promise<void>;
  deleteChangeRequest: (id: string, userId?: string) => Promise<void>;
  refreshChangeRequests: () => Promise<void>;
  getChangeRequest: (id: string) => Promise<ChangeRequest | undefined>;
}

const ChangeRequestsContext = createContext<ChangeRequestsContextType | undefined>(undefined);

export const ChangeRequestsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueue } = useSync();
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);

  const refreshChangeRequests = async () => {
    const all = await getAll<ChangeRequest>(tenantId, "change_requests");
    setChangeRequests(all);
  };

  const getChangeRequest = async (id: string) => {
    return getById<ChangeRequest>(tenantId, "change_requests", id);
  };

  const addChangeRequest = async (cr: ChangeRequest, userId?: string) => {
    await putWithAudit(
      tenantId,
      "change_requests",
      cr,
      userId,
      { action: "create", description: `Change Request "${cr.title}" created` },
      enqueue
    );
    await refreshChangeRequests();
  };

  const updateChangeRequest = async (cr: ChangeRequest, userId?: string) => {
    await putWithAudit(
      tenantId,
      "change_requests",
      cr,
      userId,
      { action: "update", description: `Change Request "${cr.title}" updated` },
      enqueue
    );
    await refreshChangeRequests();
  };

  const deleteChangeRequest = async (id: string, userId?: string) => {
    await removeWithAudit(
      tenantId,
      "change_requests",
      id,
      userId,
      { description: `Change Request ${id} deleted` },
      enqueue
    );
    await refreshChangeRequests();
  };

  useEffect(() => { refreshChangeRequests(); }, [tenantId]);

  return (
    <ChangeRequestsContext.Provider
      value={{ changeRequests, addChangeRequest, updateChangeRequest, deleteChangeRequest, refreshChangeRequests, getChangeRequest }}
    >
      {children}
    </ChangeRequestsContext.Provider>
  );
};

export const useChangeRequests = () => {
  const ctx = useContext(ChangeRequestsContext);
  if (!ctx) throw new Error("useChangeRequests must be used within ChangeRequestsProvider");
  return ctx;
};

export const useChangeRequestDetails = (id: string) => {
  const { changeRequests } = useChangeRequests();
  const { endUsers } = useEndUsers();
  const cr = changeRequests.find((c) => c.id === id);
  return cr ? { ...cr, requestor: cr.requested_by_end_user_id ? endUsers.find((u) => u.id === cr.requested_by_end_user_id) || null : null } : null;
};