import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAll, getById } from "../db/dbClient";
import { putWithAudit, removeWithAudit } from "../db/dbClient"
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { loadConfig } from "../config/configLoader";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------
export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  type: string;   // config-driven
  status: string; // config-driven
  created_at: string;
  updated_at: string;

  // Relationships
  related_runbook_ids: string[];
  related_incident_ids: string[];
  related_problem_ids: string[];
  related_change_ids: string[];
  related_maintenance_ids: string[];
  owner_user_id?: string | null;
  owner_team_id?: string | null;

  // Execution
  script?: string;
  script_url?: string;
  parameters?: Record<string, any>;
  last_executed_at?: string | null;
  last_executed_by_user_id?: string | null;
  average_execution_time_seconds?: number;
  success_rate?: number;

  // Risk & Compliance
  requires_approval?: boolean;
  compliance_requirement_ids: string[];

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
interface AutomationRulesContextType {
  automationRules: AutomationRule[];
  addAutomationRule: (rule: AutomationRule, userId?: string) => Promise<void>;
  updateAutomationRule: (rule: AutomationRule, userId?: string) => Promise<void>;
  deleteAutomationRule: (id: string, userId?: string) => Promise<void>;
  refreshAutomationRules: () => Promise<void>;
  getAutomationRule: (id: string) => Promise<AutomationRule | undefined>;

  // Config-driven enums for dropdowns
  config: {
    types: string[];
    statuses: string[];
  };
}

const AutomationRulesContext = createContext<AutomationRulesContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const AutomationRulesProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueue } = useSync();
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);

  const config = loadConfig(tenantId).automationRules;

  const refreshAutomationRules = async () => {
    const all = await getAll<AutomationRule>(tenantId, "automation_rules");
    setAutomationRules(all);
  };

  const getAutomationRule = async (id: string) => {
    return getById<AutomationRule>(tenantId, "automation_rules", id);
  };

  const addAutomationRule = async (rule: AutomationRule, userId?: string) => {
    // ✅ Tenant-aware validation
    if (!config.types.includes(rule.type)) {
      throw new Error(`Invalid automation type: ${rule.type}`);
    }
    if (!config.statuses.includes(rule.status)) {
      throw new Error(`Invalid automation status: ${rule.status}`);
    }

    await putWithAudit(
      tenantId,
      "automation_rules",
      rule,
      userId,
      { action: "create", description: `Automation Rule "${rule.name}" created` },
      enqueue
    );
    await refreshAutomationRules();
  };

  const updateAutomationRule = async (rule: AutomationRule, userId?: string) => {
    await putWithAudit(
      tenantId,
      "automation_rules",
      rule,
      userId,
      { action: "update", description: `Automation Rule "${rule.name}" updated` },
      enqueue
    );
    await refreshAutomationRules();
  };

  const deleteAutomationRule = async (id: string, userId?: string) => {
    await removeWithAudit(
      tenantId,
      "automation_rules",
      id,
      userId,
      { description: `Automation Rule ${id} deleted` },
      enqueue
    );
    await refreshAutomationRules();
  };

  useEffect(() => {
    refreshAutomationRules();
  }, [tenantId]);

  return (
    <AutomationRulesContext.Provider
      value={{
        automationRules,
        addAutomationRule,
        updateAutomationRule,
        deleteAutomationRule,
        refreshAutomationRules,
        getAutomationRule,
        config,
      }}
    >
      {children}
    </AutomationRulesContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------
export const useAutomationRules = () => {
  const ctx = useContext(AutomationRulesContext);
  if (!ctx) throw new Error("useAutomationRules must be used within AutomationRulesProvider");
  return ctx;
};

export const useAutomationRuleDetails = (id: string) => {
  const { automationRules } = useAutomationRules();
  return automationRules.find((r) => r.id === id) || null;
};