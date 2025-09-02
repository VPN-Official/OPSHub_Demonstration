import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAll, getById } from "../db/dbClient";
import { putWithAudit, removeWithAudit } from "../db/dbClient"
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { loadConfig } from "../config/configLoader";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------
export interface AiAgent {
  id: string;
  name: string;
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
  related_alert_ids: string[];
  owner_user_id?: string | null;
  owner_team_id?: string | null;

  // Model Info
  model_type?: string;
  model_version?: string;
  confidence_threshold?: number;
  input_sources: string[];

  // Execution Metrics
  suggestions_made?: number;
  suggestions_accepted?: number;
  suggestions_rejected?: number;
  automations_triggered?: number;
  last_run_at?: string | null;

  // Governance
  requires_human_approval?: boolean;
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
interface AiAgentsContextType {
  aiAgents: AiAgent[];
  addAiAgent: (agent: AiAgent, userId?: string) => Promise<void>;
  updateAiAgent: (agent: AiAgent, userId?: string) => Promise<void>;
  deleteAiAgent: (id: string, userId?: string) => Promise<void>;
  refreshAiAgents: () => Promise<void>;
  getAiAgent: (id: string) => Promise<AiAgent | undefined>;

  // Config-driven enums for UI
  config: {
    types: string[];
    statuses: string[];
  };
}

const AiAgentsContext = createContext<AiAgentsContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const AiAgentsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueue } = useSync();
  const [aiAgents, setAiAgents] = useState<AiAgent[]>([]);

  const config = loadConfig(tenantId).aiAgents;

  const refreshAiAgents = async () => {
    const all = await getAll<AiAgent>(tenantId, "ai_agents");
    setAiAgents(all);
  };

  const getAiAgent = async (id: string) => {
    return getById<AiAgent>(tenantId, "ai_agents", id);
  };

  const addAiAgent = async (agent: AiAgent, userId?: string) => {
    // ✅ Tenant-aware validation
    if (!config.types.includes(agent.type)) {
      throw new Error(`Invalid AI Agent type: ${agent.type}`);
    }
    if (!config.statuses.includes(agent.status)) {
      throw new Error(`Invalid AI Agent status: ${agent.status}`);
    }

    await putWithAudit(
      tenantId,
      "ai_agents",
      agent,
      userId,
      { action: "create", description: `AI Agent "${agent.name}" created` },
      enqueue
    );
    await refreshAiAgents();
  };

  const updateAiAgent = async (agent: AiAgent, userId?: string) => {
    await putWithAudit(
      tenantId,
      "ai_agents",
      agent,
      userId,
      { action: "update", description: `AI Agent "${agent.name}" updated` },
      enqueue
    );
    await refreshAiAgents();
  };

  const deleteAiAgent = async (id: string, userId?: string) => {
    await removeWithAudit(
      tenantId,
      "ai_agents",
      id,
      userId,
      { description: `AI Agent ${id} deleted` },
      enqueue
    );
    await refreshAiAgents();
  };

  useEffect(() => {
    refreshAiAgents();
  }, [tenantId]);

  return (
    <AiAgentsContext.Provider
      value={{
        aiAgents,
        addAiAgent,
        updateAiAgent,
        deleteAiAgent,
        refreshAiAgents,
        getAiAgent,
        config,
      }}
    >
      {children}
    </AiAgentsContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------
export const useAiAgents = () => {
  const ctx = useContext(AiAgentsContext);
  if (!ctx) throw new Error("useAiAgents must be used within AiAgentsProvider");
  return ctx;
};

export const useAiAgentDetails = (id: string) => {
  const { aiAgents } = useAiAgents();
  return aiAgents.find((a) => a.id === id) || null;
};