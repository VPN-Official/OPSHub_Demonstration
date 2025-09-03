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

export interface MaintenanceWork {
  id: string;
  title: string;
  description: string;
  status: string;           // config.work.maintenance.statuses
  priority: string;         // config.work.maintenance.priorities
  maintenance_type: string; // config.work.maintenance.types
  created_at: string;
  updated_at: string;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  completed_at?: string | null;

  // Asset & Service Links
  asset_ids: string[];
  service_component_ids: string[];
  business_service_id?: string | null;
  vendor_id?: string | null;
  contract_id?: string | null;
  cost_center_id?: string | null;

  // People & Teams
  requested_by_end_user_id?: string | null;
  requested_by_user_id?: string | null;
  assigned_to_user_id?: string | null;
  assigned_to_team_id?: string | null;
  escalation_team_ids: string[];
  maintenance_manager_user_id?: string | null;

  // Maintenance Details
  checklist: { step: string; status: string; performed_by_user_id?: string; timestamp?: string }[];
  tools_required: string[];
  parts_required: { part_name: string; quantity: number; cost: number }[];
  safety_requirements: string[];
  estimated_duration_minutes?: number;
  actual_duration_minutes?: number | null;

  // Relationships
  related_incident_ids: string[];
  related_change_ids: string[];
  related_problem_ids: string[];
  triggered_by_alert_id?: string | null;

  // Compliance & Audit
  regulatory_requirement_ids: string[];
  audit_log_ids: string[];
  inspection_report?: string | null;

  // Business Impact & Cost
  estimated_cost?: number | null;
  actual_cost?: number | null;
  downtime_minutes?: number | null;
  customer_impact_summary?: string | null;

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

interface MaintenanceContextType {
  maintenanceWorks: MaintenanceWork[];
  addMaintenanceWork: (mw: MaintenanceWork, userId?: string) => Promise<void>;
  updateMaintenanceWork: (mw: MaintenanceWork, userId?: string) => Promise<void>;
  deleteMaintenanceWork: (id: string, userId?: string) => Promise<void>;
  refreshMaintenanceWorks: () => Promise<void>;
  getMaintenanceWork: (id: string) => Promise<MaintenanceWork | undefined>;

  // NEW: expose config enums
  config: {
    statuses: string[];
    priorities: string[];
    types: string[];
    sla_targets: Record<string, number>;
  };
}

const MaintenanceContext = createContext<MaintenanceContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------

export const MaintenanceProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const [maintenanceWorks, setMaintenanceWorks] = useState<MaintenanceWork[]>([]);

  const config = loadConfig(tenantId).work.maintenance;

  const refreshMaintenanceWorks = async () => {
    const all = await getAll<MaintenanceWork>(tenantId, "maintenance");
    setMaintenanceWorks(all);
  };

  const getMaintenanceWork = async (id: string) => {
    return getById<MaintenanceWork>(tenantId, "maintenance", id);
  };

  const addMaintenanceWork = async (mw: MaintenanceWork, userId?: string) => {
    // ✅ Validate against config
    if (!config.statuses.includes(mw.status)) {
      throw new Error(`Invalid status: ${mw.status}`);
    }
    if (!config.priorities.includes(mw.priority)) {
      throw new Error(`Invalid priority: ${mw.priority}`);
    }
    if (!config.types.includes(mw.maintenance_type)) {
      throw new Error(`Invalid type: ${mw.maintenance_type}`);
    }

    await putWithAudit(
      tenantId,
      "maintenance",
      mw,
      userId,
      { action: "create", description: `Maintenance "${mw.title}" created` },
      enqueue
    );
    await refreshMaintenanceWorks();
  };

  const updateMaintenanceWork = async (mw: MaintenanceWork, userId?: string) => {
    await putWithAudit(
      tenantId,
      "maintenance",
      mw,
      userId,
      { action: "update", description: `Maintenance "${mw.title}" updated` },
      enqueue
    );
    await refreshMaintenanceWorks();
  };

  const deleteMaintenanceWork = async (id: string, userId?: string) => {
    await removeWithAudit(
      tenantId,
      "maintenance",
      id,
      userId,
      { description: `Maintenance ${id} deleted` },
      enqueue
    );
    await refreshMaintenanceWorks();
  };

  useEffect(() => {
    refreshMaintenanceWorks();
  }, [tenantId]);

  return (
    <MaintenanceContext.Provider
      value={{
        maintenanceWorks,
        addMaintenanceWork,
        updateMaintenanceWork,
        deleteMaintenanceWork,
        refreshMaintenanceWorks,
        getMaintenanceWork,
        config,
      }}
    >
      {children}
    </MaintenanceContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------

export const useMaintenanceWorks = () => {
  const ctx = useContext(MaintenanceContext);
  if (!ctx) throw new Error("useMaintenanceWorks must be used within MaintenanceProvider");
  return ctx;
};

export const useMaintenanceWorkDetails = (id: string) => {
  const { maintenanceWorks } = useMaintenanceWorks();
  const { endUsers } = useEndUsers();
  const mw = maintenanceWorks.find((m) => m.id === id);
  return mw
    ? {
        ...mw,
        requestor: mw.requested_by_end_user_id
          ? endUsers.find((u) => u.id === mw.requested_by_end_user_id) || null,
      }
    : null;
};