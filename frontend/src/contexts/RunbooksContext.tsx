import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAll, getById } from "../db/dbClient";
import { putWithAudit, removeWithAudit } from "../db/dbClient"
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { loadConfig } from "../config/configLoader";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------
export interface RunbookStep {
  id: string;
  order: number;
  description: string;
  expected_result?: string;
  automation_rule_id?: string | null;
}

export interface Runbook {
  id: string;
  title: string;
  description?: string;
  type: string;   // config-driven
  status: string; // config-driven
  created_at: string;
  updated_at: string;

  // Relationships
  related_incident_ids: string[];
  related_problem_ids: string[];
  related_change_ids: string[];
  related_maintenance_ids: string[];
  compliance_requirement_ids: string[];
  owner_user_id?: string | null;
  owner_team_id?: string | null;

  // Steps
  steps: RunbookStep[];

  // Execution metadata
  last_executed_at?: string | null;
  last_executed_by_user_id?: string | null;
  average_execution_time_minutes?: number;
  success_rate?: number;

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
interface RunbooksContextType {
  runbooks: Runbook[];
  addRunbook: (rb: Runbook, userId?: string) => Promise<void>;
  updateRunbook: (rb: Runbook, userId?: string) => Promise<void>;
  deleteRunbook: (id: string, userId?: string) => Promise<void>;
  refreshRunbooks: () => Promise<void>;
  getRunbook: (id: string) => Promise<Runbook | undefined>;

  // Config-driven dropdowns
  config: {
    types: string[];
    statuses: string[];
  };
}

const RunbooksContext = createContext<RunbooksContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const RunbooksProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueue } = useSync();
  const [runbooks, setRunbooks] = useState<Runbook[]>([]);

  const config = loadConfig(tenantId).runbooks;

  const refreshRunbooks = async () => {
    const all = await getAll<Runbook>(tenantId, "runbooks");
    setRunbooks(all);
  };

  const getRunbook = async (id: string) => {
    return getById<Runbook>(tenantId, "runbooks", id);
  };

  const addRunbook = async (rb: Runbook, userId?: string) => {
    // ✅ Validate against tenant config
    if (!config.types.includes(rb.type)) {
      throw new Error(`Invalid runbook type: ${rb.type}`);
    }
    if (!config.statuses.includes(rb.status)) {
      throw new Error(`Invalid runbook status: ${rb.status}`);
    }

    await putWithAudit(
      tenantId,
      "runbooks",
      rb,
      userId,
      { action: "create", description: `Runbook "${rb.title}" created` },
      enqueue
    );
    await refreshRunbooks();
  };

  const updateRunbook = async (rb: Runbook, userId?: string) => {
    await putWithAudit(
      tenantId,
      "runbooks",
      rb,
      userId,
      { action: "update", description: `Runbook "${rb.title}" updated` },
      enqueue
    );
    await refreshRunbooks();
  };

  const deleteRunbook = async (id: string, userId?: string) => {
    await removeWithAudit(
      tenantId,
      "runbooks",
      id,
      userId,
      { description: `Runbook ${id} deleted` },
      enqueue
    );
    await refreshRunbooks();
  };

  useEffect(() => {
    refreshRunbooks();
  }, [tenantId]);

  return (
    <RunbooksContext.Provider
      value={{ runbooks, addRunbook, updateRunbook, deleteRunbook, refreshRunbooks, getRunbook, config }}
    >
      {children}
    </RunbooksContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------
export const useRunbooks = () => {
  const ctx = useContext(RunbooksContext);
  if (!ctx) throw new Error("useRunbooks must be used within RunbooksProvider");
  return ctx;
};

export const useRunbookDetails = (id: string) => {
  const { runbooks } = useRunbooks();
  return runbooks.find((r) => r.id === id) || null;
};