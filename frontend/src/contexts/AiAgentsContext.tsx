// src/contexts/AiAgentsContext.tsx
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
export interface AiAgent {
  id: string;
  name: string;
  description?: string;
  type: string;   // config-driven from ai_agents section
  status: string; // config-driven from ai_agents section
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

  // Model Configuration
  model_type?: string;
  model_version?: string;
  confidence_threshold: number;
  input_sources: string[];
  model_config?: Record<string, any>;

  // Execution Metrics
  suggestions_made: number;
  suggestions_accepted: number;
  suggestions_rejected: number;
  automations_triggered: number;
  last_run_at?: string | null;
  average_response_time_ms?: number;
  success_rate?: number;

  // Governance & Compliance
  requires_human_approval: boolean;
  compliance_requirement_ids: string[];
  audit_trail_enabled: boolean;
  data_retention_days?: number;

  // AI-specific settings
  training_data_sources?: string[];
  retraining_frequency?: string;
  performance_threshold?: number;
  fallback_behavior?: string;

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
  tenantId?: string;
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

  // AI-specific operations
  executeAgent: (agentId: string, inputData: any, userId?: string) => Promise<any>;
  updateAgentMetrics: (agentId: string, metrics: Partial<AiAgent>) => Promise<void>;
  getAgentPerformance: (agentId: string) => {
    successRate: number;
    avgResponseTime: number;
    totalExecutions: number;
  };

  // Filtering
  getAgentsByType: (type: string) => AiAgent[];
  getAgentsByStatus: (status: string) => AiAgent[];
  getActiveAgents: () => AiAgent[];
  getAgentsRequiringApproval: () => AiAgent[];

  // Config integration
  config: {
    types: string[];
    statuses: string[];
    modelTypes: string[];
    inputSources: string[];
  };
}

const AiAgentsContext = createContext<AiAgentsContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const AiAgentsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig, validateEnum } = useConfig();
  const [aiAgents, setAiAgents] = useState<AiAgent[]>([]);

  // Extract AI agent-specific config
  const config = {
    types: globalConfig?.ai_agents?.map(a => a.type).filter((t, i, arr) => arr.indexOf(t) === i) || [],
    statuses: globalConfig?.statuses?.ai_agents || [],
    modelTypes: ['classification', 'regression', 'clustering', 'neural_network', 'decision_tree', 'random_forest'] as string[],
    inputSources: ['incidents', 'metrics', 'logs', 'events', 'traces', 'alerts'] as string[],
  };

  const refreshAiAgents = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      const all = await getAll<AiAgent>(tenantId, "ai_agents");
      
      // Sort by performance metrics and last run
      all.sort((a, b) => {
        // Active agents first
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (b.status === 'active' && a.status !== 'active') return 1;
        
        // Then by success rate
        const aSuccessRate = a.success_rate || 0;
        const bSuccessRate = b.success_rate || 0;
        if (aSuccessRate !== bSuccessRate) return bSuccessRate - aSuccessRate;
        
        // Finally by last run (most recent first)
        if (!a.last_run_at && !b.last_run_at) return 0;
        if (!a.last_run_at) return 1;
        if (!b.last_run_at) return -1;
        return new Date(b.last_run_at).getTime() - new Date(a.last_run_at).getTime();
      });
      
      setAiAgents(all);
    } catch (error) {
      console.error("Failed to refresh AI agents:", error);
    }
  }, [tenantId]);

  const getAiAgent = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    return getById<AiAgent>(tenantId, "ai_agents", id);
  }, [tenantId]);

  const validateAiAgent = useCallback((agent: AiAgent) => {
    if (!globalConfig) {
      throw new Error("Configuration not loaded");
    }

    // Validate type against config
    if (!config.types.includes(agent.type)) {
      throw new Error(`Invalid AI agent type: ${agent.type}. Valid options: ${config.types.join(', ')}`);
    }

    // Validate status
    if (!validateEnum('statuses', agent.status)) {
      throw new Error(`Invalid status: ${agent.status}. Valid options: ${config.statuses.join(', ')}`);
    }

    // Validate required fields
    if (!agent.name || agent.name.trim().length < 3) {
      throw new Error("Name must be at least 3 characters long");
    }

    if (agent.confidence_threshold < 0 || agent.confidence_threshold > 1) {
      throw new Error("Confidence threshold must be between 0 and 1");
    }

    if (!agent.input_sources || agent.input_sources.length === 0) {
      throw new Error("At least one input source must be specified");
    }

    // Validate input sources
    agent.input_sources.forEach(source => {
      if (!config.inputSources.includes(source)) {
        throw new Error(`Invalid input source: ${source}. Valid options: ${config.inputSources.join(', ')}`);
      }
    });

    // Validate model type if specified
    if (agent.model_type && !config.modelTypes.includes(agent.model_type)) {
      throw new Error(`Invalid model type: ${agent.model_type}. Valid options: ${config.modelTypes.join(', ')}`);
    }
  }, [globalConfig, validateEnum, config]);

  const ensureMetadata = useCallback((agent: AiAgent): AiAgent => {
    const now = new Date().toISOString();
    return {
      ...agent,
      tenantId,
      tags: agent.tags || [],
      health_status: agent.health_status || "gray",
      sync_status: agent.sync_status || "dirty",
      synced_at: agent.synced_at || now,
      related_incident_ids: agent.related_incident_ids || [],
      related_problem_ids: agent.related_problem_ids || [],
      related_change_ids: agent.related_change_ids || [],
      related_maintenance_ids: agent.related_maintenance_ids || [],
      related_alert_ids: agent.related_alert_ids || [],
      compliance_requirement_ids: agent.compliance_requirement_ids || [],
      suggestions_made: agent.suggestions_made || 0,
      suggestions_accepted: agent.suggestions_accepted || 0,
      suggestions_rejected: agent.suggestions_rejected || 0,
      automations_triggered: agent.automations_triggered || 0,
      requires_human_approval: agent.requires_human_approval ?? true,
      audit_trail_enabled: agent.audit_trail_enabled ?? true,
      confidence_threshold: agent.confidence_threshold || 0.8,
      input_sources: agent.input_sources || ['incidents'],
    };
  }, [tenantId]);

  const addAiAgent = useCallback(async (agent: AiAgent, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateAiAgent(agent);

    const now = new Date().toISOString();
    const enriched = ensureMetadata({
      ...agent,
      created_at: now,
      updated_at: now,
    });

    await putWithAudit(
      tenantId,
      "ai_agents",
      enriched,
      userId,
      {
        action: "create",
        description: `Created AI agent: ${agent.name}`,
        tags: ["ai_agent", "create", agent.type],
        metadata: {
          agent_type: agent.type,
          confidence_threshold: agent.confidence_threshold,
          input_sources: agent.input_sources,
        },
      }
    );

    await enqueueItem({
      storeName: "ai_agents",
      entityId: enriched.id,
      action: "create",
      payload: enriched,
      priority: 'normal',
    });

    await refreshAiAgents();
  }, [tenantId, validateAiAgent, ensureMetadata, enqueueItem, refreshAiAgents]);

  const updateAiAgent = useCallback(async (agent: AiAgent, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateAiAgent(agent);

    const enriched = ensureMetadata({
      ...agent,
      updated_at: new Date().toISOString(),
    });

    await putWithAudit(
      tenantId,
      "ai_agents",
      enriched,
      userId,
      {
        action: "update",
        description: `Updated AI agent: ${agent.name}`,
        tags: ["ai_agent", "update", agent.status],
        metadata: {
          agent_type: agent.type,
          status_change: agent.status,
        },
      }
    );

    await enqueueItem({
      storeName: "ai_agents",
      entityId: enriched.id,
      action: "update",
      payload: enriched,
      priority: 'normal',
    });

    await refreshAiAgents();
  }, [tenantId, validateAiAgent, ensureMetadata, enqueueItem, refreshAiAgents]);

  const deleteAiAgent = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    const agent = await getAiAgent(id);
    
    await removeWithAudit(
      tenantId,
      "ai_agents",
      id,
      userId,
      {
        action: "delete",
        description: `Deleted AI agent: ${agent?.name || id}`,
        tags: ["ai_agent", "delete"],
        metadata: {
          agent_type: agent?.type,
          suggestions_made: agent?.suggestions_made,
        },
      }
    );

    await enqueueItem({
      storeName: "ai_agents",
      entityId: id,
      action: "delete",
      payload: null,
    });

    await refreshAiAgents();
  }, [tenantId, getAiAgent, enqueueItem, refreshAiAgents]);

  // AI-specific operations
  const executeAgent = useCallback(async (agentId: string, inputData: any, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    const agent = await getAiAgent(agentId);
    if (!agent) throw new Error(`AI agent ${agentId} not found`);

    if (agent.status !== 'active') {
      throw new Error(`AI agent ${agent.name} is not active`);
    }

    const executionStart = Date.now();
    
    try {
      // Simulate AI execution (replace with actual AI service call)
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));
      
      // Mock response based on agent type
      const mockResponse = {
        agentId,
        timestamp: new Date().toISOString(),
        inputData,
        result: {
          confidence: Math.random() * (1 - agent.confidence_threshold) + agent.confidence_threshold,
          prediction: agent.type === 'incident_classifier' ? 'P2' : 'success',
          explanation: `AI agent ${agent.name} processed the input successfully`,
        },
        executionTimeMs: Date.now() - executionStart,
      };

      // Update agent metrics
      await updateAgentMetrics(agentId, {
        suggestions_made: agent.suggestions_made + 1,
        last_run_at: new Date().toISOString(),
        average_response_time_ms: agent.average_response_time_ms 
          ? (agent.average_response_time_ms + mockResponse.executionTimeMs) / 2
          : mockResponse.executionTimeMs,
      });

      // Log the execution
      await putWithAudit(
        tenantId,
        "ai_agents",
        { ...agent, last_run_at: new Date().toISOString() },
        userId,
        {
          action: "execute",
          description: `AI agent ${agent.name} executed successfully`,
          tags: ["ai_agent", "execute", "success"],
          metadata: {
            execution_time_ms: mockResponse.executionTimeMs,
            confidence: mockResponse.result.confidence,
            input_size: JSON.stringify(inputData).length,
          },
        }
      );

      return mockResponse;
    } catch (error) {
      // Log the failure
      await putWithAudit(
        tenantId,
        "ai_agents",
        agent,
        userId,
        {
          action: "execute",
          description: `AI agent ${agent.name} execution failed: ${error}`,
          tags: ["ai_agent", "execute", "failure"],
          metadata: {
            error_message: error instanceof Error ? error.message : 'Unknown error',
            execution_time_ms: Date.now() - executionStart,
          },
        }
      );
      
      throw error;
    }
  }, [tenantId, getAiAgent]);

  const updateAgentMetrics = useCallback(async (agentId: string, metrics: Partial<AiAgent>) => {
    const agent = await getAiAgent(agentId);
    if (!agent) return;

    const updated = { ...agent, ...metrics, updated_at: new Date().toISOString() };
    
    // Calculate success rate if we have enough data
    if (updated.suggestions_made > 0) {
      updated.success_rate = updated.suggestions_accepted / updated.suggestions_made;
    }

    await updateAiAgent(updated);
  }, [getAiAgent, updateAiAgent]);

  const getAgentPerformance = useCallback((agentId: string) => {
    const agent = aiAgents.find(a => a.id === agentId);
    if (!agent) {
      return { successRate: 0, avgResponseTime: 0, totalExecutions: 0 };
    }

    return {
      successRate: agent.success_rate || 0,
      avgResponseTime: agent.average_response_time_ms || 0,
      totalExecutions: agent.suggestions_made,
    };
  }, [aiAgents]);

  // Filtering functions
  const getAgentsByType = useCallback((type: string) => {
    return aiAgents.filter(a => a.type === type);
  }, [aiAgents]);

  const getAgentsByStatus = useCallback((status: string) => {
    return aiAgents.filter(a => a.status === status);
  }, [aiAgents]);

  const getActiveAgents = useCallback(() => {
    return aiAgents.filter(a => a.status === 'active');
  }, [aiAgents]);

  const getAgentsRequiringApproval = useCallback(() => {
    return aiAgents.filter(a => a.requires_human_approval === true);
  }, [aiAgents]);

  // Initialize
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshAiAgents();
    }
  }, [tenantId, globalConfig, refreshAiAgents]);

  return (
    <AiAgentsContext.Provider
      value={{
        aiAgents,
        addAiAgent,
        updateAiAgent,
        deleteAiAgent,
        refreshAiAgents,
        getAiAgent,
        executeAgent,
        updateAgentMetrics,
        getAgentPerformance,
        getAgentsByType,
        getAgentsByStatus,
        getActiveAgents,
        getAgentsRequiringApproval,
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

// Utility hooks
export const useActiveAiAgents = () => {
  const { getActiveAgents } = useAiAgents();
  return getActiveAgents();
};

export const useAiAgentsByType = (type: string) => {
  const { getAgentsByType } = useAiAgents();
  return getAgentsByType(type);
};

export const useAiAgentPerformance = (agentId: string) => {
  const { getAgentPerformance } = useAiAgents();
  return getAgentPerformance(agentId);
};