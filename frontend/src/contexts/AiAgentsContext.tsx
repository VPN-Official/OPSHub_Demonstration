// src/contexts/AiAgentsContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";
import { ExternalSystemFields } from "../types/externalSystem";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------

/**
 * Core AI Agent entity for UI display
 */
export interface AIAgent extends ExternalSystemFields {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  created_at: string;
  updated_at: string;

  // Relationships for UI navigation
  related_incident_ids: string[];
  related_problem_ids: string[];
  related_change_ids: string[];
  related_maintenance_ids: string[];
  related_alert_ids: string[];
  owner_user_id?: string | null;
  owner_team_id?: string | null;

  // Model Configuration (display only)
  model_type?: string;
  model_version?: string;
  confidence_threshold: number;
  input_sources: string[];
  model_config?: Record<string, any>;

  // Metrics (calculated by backend)
  suggestions_made: number;
  suggestions_accepted: number;
  suggestions_rejected: number;
  automations_triggered: number;
  last_run_at?: string | null;
  average_response_time_ms?: number;
  success_rate?: number;

  // Governance flags
  requires_human_approval: boolean;
  compliance_requirement_ids: string[];
  audit_trail_enabled: boolean;
  data_retention_days?: number;

  // AI settings (backend managed)
  training_data_sources?: string[];
  retraining_frequency?: string;
  performance_threshold?: number;
  fallback_behavior?: string;

  // UI Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  // synced_at, sync_status removed - inherited from ExternalSystemFields
  tenantId?: string;
}

/**
 * Async state wrapper for UI operations
 */
export interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  lastFetch: string | null;
  stale: boolean;
}

/**
 * UI-focused filter interface for client-side filtering
 */
export interface AIAgentUIFilters {
  type?: string;
  status?: string;
  search?: string;
  ownedByMe?: boolean;
  requiresApproval?: boolean;
  healthStatus?: string[];
  // External system filtering
  sourceSystems?: string[];
  syncStatus?: ('synced' | 'syncing' | 'error' | 'conflict')[];
  hasConflicts?: boolean;
  hasLocalChanges?: boolean;
  dataCompleteness?: { min: number; max: number };
}

/**
 * Optimistic UI operation state
 */
interface OptimisticOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'execute';
  payload?: any;
  timestamp: string;
}

/**
 * Agent execution result from backend
 */
export interface AgentExecutionResult {
  agentId: string;
  timestamp: string;
  result: {
    confidence: number;
    prediction: any;
    explanation: string;
  };
  executionTimeMs: number;
  success: boolean;
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------
interface AiAgentsContextType {
  // Core async state
  agents: AsyncState<AIAgent[]>;
  
  // CRUD operations (API orchestration only)
  createAgent: (agent: Omit<AIAgent, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateAgent: (id: string, updates: Partial<AIAgent>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  
  // Data fetching
  refreshAgents: (force?: boolean) => Promise<void>;
  getAgentById: (id: string) => AIAgent | null;
  
  // Agent execution (API orchestration)
  executeAgent: (agentId: string, inputData: any) => Promise<AsyncState<AgentExecutionResult>>;
  
  // UI-focused filtering and search (client-side only)
  getFilteredAgents: (filters: AIAgentUIFilters) => AIAgent[];
  searchAgents: (query: string) => AIAgent[];
  
  // Simple client-side categorization for UI
  getAgentsByType: (type: string) => AIAgent[];
  getAgentsByStatus: (status: string) => AIAgent[];
  getAgentsByHealth: (health: string) => AIAgent[];
  
  // UI state helpers
  optimisticOperations: OptimisticOperation[];
  clearError: () => void;
  isStale: boolean;
  
  // Configuration for UI dropdowns (from backend)
  config: {
    types: string[];
    statuses: string[];
    modelTypes: string[];
    inputSources: string[];
    healthStatuses: string[];
  };
}

const AiAgentsContext = createContext<AiAgentsContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider Implementation
// ---------------------------------
export const AiAgentsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();

  // Core async state
  const [agents, setAgents] = useState<AsyncState<AIAgent[]>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    stale: true,
  });

  // UI operation state
  const [optimisticOperations, setOptimisticOperations] = useState<OptimisticOperation[]>([]);

  // Cache TTL (5 minutes for UI responsiveness)
  const CACHE_TTL = 5 * 60 * 1000;

  // Extract UI configuration from backend config
  const config = useMemo(() => ({
    types: globalConfig?.ai_agents?.map(a => a.type).filter((t, i, arr) => arr.indexOf(t) === i) || [],
    statuses: globalConfig?.statuses?.ai_agents || [],
    modelTypes: ['classification', 'regression', 'clustering', 'neural_network', 'decision_tree', 'random_forest'],
    inputSources: ['incidents', 'metrics', 'logs', 'events', 'traces', 'alerts'],
    healthStatuses: ['green', 'yellow', 'orange', 'red', 'gray'],
  }), [globalConfig]);

  /**
   * Check if data is stale based on TTL
   */
  const isStale = useMemo(() => {
    if (!agents.lastFetch) return true;
    return Date.now() - new Date(agents.lastFetch).getTime() > CACHE_TTL;
  }, [agents.lastFetch]);

  /**
   * Add optimistic operation for immediate UI feedback
   */
  const addOptimisticOperation = useCallback((operation: Omit<OptimisticOperation, 'timestamp'>) => {
    const fullOperation = {
      ...operation,
      timestamp: new Date().toISOString(),
    };
    setOptimisticOperations(prev => [...prev, fullOperation]);
    
    // Auto-remove after 30 seconds
    setTimeout(() => {
      setOptimisticOperations(prev => prev.filter(op => op.id !== fullOperation.id));
    }, 30000);
  }, []);

  /**
   * Remove optimistic operation (on success/failure)
   */
  const removeOptimisticOperation = useCallback((operationId: string) => {
    setOptimisticOperations(prev => prev.filter(op => op.id !== operationId));
  }, []);

  /**
   * Apply optimistic updates to UI state
   */
  const applyOptimisticUpdates = useCallback((baseAgents: AIAgent[]): AIAgent[] => {
    let result = [...baseAgents];
    
    optimisticOperations.forEach(op => {
      switch (op.type) {
        case 'create':
          if (op.payload && !result.find(a => a.id === op.payload.id)) {
            result.unshift({ ...op.payload, sync_status: 'syncing' });
          }
          break;
        case 'update':
          if (op.payload) {
            const index = result.findIndex(a => a.id === op.id);
            if (index >= 0) {
              result[index] = { ...result[index], ...op.payload, sync_status: 'syncing' };
            }
          }
          break;
        case 'delete':
          result = result.filter(a => a.id !== op.id);
          break;
      }
    });
    
    return result;
  }, [optimisticOperations]);

  /**
   * Fetch agents from backend API
   */
  const refreshAgents = useCallback(async (force = false) => {
    if (!tenantId) return;
    if (!force && !isStale && agents.data.length > 0) return;

    setAgents(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Backend API call - handles all business logic, sorting, filtering
      const response = await fetch(`/api/tenants/${tenantId}/ai-agents`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch agents: ${response.status}`);
      }

      const data: AIAgent[] = await response.json();
      
      setAgents({
        data,
        loading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        stale: false,
      });
    } catch (error) {
      setAgents(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch agents',
      }));
    }
  }, [tenantId, isStale, agents.data.length]);

  /**
   * Create new agent via backend API
   */
  const createAgent = useCallback(async (agentData: Omit<AIAgent, 'id' | 'created_at' | 'updated_at'>) => {
    if (!tenantId) throw new Error("No tenant selected");

    const tempId = `temp-${Date.now()}`;
    const optimisticAgent: AIAgent = {
      ...agentData,
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // UI defaults only
      suggestions_made: 0,
      suggestions_accepted: 0,
      suggestions_rejected: 0,
      automations_triggered: 0,
      requires_human_approval: true,
      audit_trail_enabled: true,
      health_status: 'gray',
      tags: agentData.tags || [],
      related_incident_ids: agentData.related_incident_ids || [],
      related_problem_ids: agentData.related_problem_ids || [],
      related_change_ids: agentData.related_change_ids || [],
      related_maintenance_ids: agentData.related_maintenance_ids || [],
      related_alert_ids: agentData.related_alert_ids || [],
      compliance_requirement_ids: agentData.compliance_requirement_ids || [],
    };

    // Optimistic UI update
    addOptimisticOperation({
      id: tempId,
      type: 'create',
      payload: optimisticAgent,
    });

    try {
      // Backend handles ALL validation and business logic
      const response = await fetch(`/api/tenants/${tenantId}/ai-agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create agent');
      }

      const createdAgent: AIAgent = await response.json();
      
      // Queue for sync if offline
      await enqueueItem({
        storeName: "ai_agents",
        entityId: createdAgent.id,
        action: "create",
        payload: createdAgent,
        priority: 'normal',
      });

      // Remove optimistic operation and refresh
      removeOptimisticOperation(tempId);
      await refreshAgents(true);
      
    } catch (error) {
      // Rollback optimistic update
      removeOptimisticOperation(tempId);
      
      // Update error state
      setAgents(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to create agent',
      }));
      
      throw error;
    }
  }, [tenantId, addOptimisticOperation, removeOptimisticOperation, enqueueItem, refreshAgents]);

  /**
   * Update agent via backend API
   */
  const updateAgent = useCallback(async (id: string, updates: Partial<AIAgent>) => {
    if (!tenantId) throw new Error("No tenant selected");

    // Optimistic UI update
    addOptimisticOperation({
      id,
      type: 'update',
      payload: { ...updates, updated_at: new Date().toISOString() },
    });

    try {
      // Backend handles ALL validation and business logic
      const response = await fetch(`/api/tenants/${tenantId}/ai-agents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update agent');
      }

      const updatedAgent: AIAgent = await response.json();

      // Queue for sync if offline
      await enqueueItem({
        storeName: "ai_agents",
        entityId: id,
        action: "update",
        payload: updatedAgent,
        priority: 'normal',
      });

      // Remove optimistic operation and refresh
      removeOptimisticOperation(id);
      await refreshAgents(true);
      
    } catch (error) {
      // Rollback optimistic update
      removeOptimisticOperation(id);
      
      setAgents(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to update agent',
      }));
      
      throw error;
    }
  }, [tenantId, addOptimisticOperation, removeOptimisticOperation, enqueueItem, refreshAgents]);

  /**
   * Delete agent via backend API
   */
  const deleteAgent = useCallback(async (id: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    // Optimistic UI update
    addOptimisticOperation({
      id,
      type: 'delete',
    });

    try {
      // Backend handles ALL business logic and cascading deletions
      const response = await fetch(`/api/tenants/${tenantId}/ai-agents/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete agent');
      }

      // Queue for sync if offline
      await enqueueItem({
        storeName: "ai_agents",
        entityId: id,
        action: "delete",
        payload: null,
      });

      // Remove optimistic operation and refresh
      removeOptimisticOperation(id);
      await refreshAgents(true);
      
    } catch (error) {
      // Rollback optimistic update
      removeOptimisticOperation(id);
      
      setAgents(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to delete agent',
      }));
      
      throw error;
    }
  }, [tenantId, addOptimisticOperation, removeOptimisticOperation, enqueueItem, refreshAgents]);

  /**
   * Execute agent via backend API
   */
  const executeAgent = useCallback(async (agentId: string, inputData: any): Promise<AsyncState<AgentExecutionResult>> => {
    if (!tenantId) throw new Error("No tenant selected");

    const executionState: AsyncState<AgentExecutionResult> = {
      data: null as any,
      loading: true,
      error: null,
      lastFetch: null,
      stale: false,
    };

    // Optimistic UI feedback
    addOptimisticOperation({
      id: `exec-${agentId}-${Date.now()}`,
      type: 'execute',
      payload: { agentId, status: 'running' },
    });

    try {
      // Backend handles ALL execution logic, business rules, calculations
      const response = await fetch(`/api/tenants/${tenantId}/ai-agents/${agentId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputData }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Agent execution failed');
      }

      const result: AgentExecutionResult = await response.json();
      
      // Refresh agents to get updated metrics (calculated by backend)
      await refreshAgents(true);

      return {
        data: result,
        loading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        stale: false,
      };
      
    } catch (error) {
      return {
        data: null as any,
        loading: false,
        error: error instanceof Error ? error.message : 'Execution failed',
        lastFetch: new Date().toISOString(),
        stale: false,
      };
    }
  }, [tenantId, addOptimisticOperation, refreshAgents]);

  /**
   * Get agent by ID (client-side lookup for UI responsiveness)
   */
  const getAgentById = useCallback((id: string): AIAgent | null => {
    const agentsWithOptimistic = applyOptimisticUpdates(agents.data);
    return agentsWithOptimistic.find(agent => agent.id === id) || null;
  }, [agents.data, applyOptimisticUpdates]);

  /**
   * Client-side filtering for immediate UI responsiveness
   * Note: Complex business filtering should be done via backend API
   */
  const getFilteredAgents = useCallback((filters: AIAgentUIFilters): AIAgent[] => {
    const agentsWithOptimistic = applyOptimisticUpdates(agents.data);
    
    return agentsWithOptimistic.filter(agent => {
      // Simple UI filters only - no business logic
      if (filters.type && agent.type !== filters.type) return false;
      if (filters.status && agent.status !== filters.status) return false;
      if (filters.requiresApproval !== undefined && agent.requires_human_approval !== filters.requiresApproval) return false;
      if (filters.healthStatus && !filters.healthStatus.includes(agent.health_status)) return false;
      if (filters.search) {
        const query = filters.search.toLowerCase();
        if (!agent.name.toLowerCase().includes(query) && 
            !agent.description?.toLowerCase().includes(query)) return false;
      }
      
      return true;
    });
  }, [agents.data, applyOptimisticUpdates]);

  /**
   * Simple client-side search for UI responsiveness
   */
  const searchAgents = useCallback((query: string): AIAgent[] => {
    if (!query.trim()) return applyOptimisticUpdates(agents.data);
    
    const searchTerm = query.toLowerCase();
    const agentsWithOptimistic = applyOptimisticUpdates(agents.data);
    
    return agentsWithOptimistic.filter(agent =>
      agent.name.toLowerCase().includes(searchTerm) ||
      agent.description?.toLowerCase().includes(searchTerm) ||
      agent.type.toLowerCase().includes(searchTerm) ||
      agent.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );
  }, [agents.data, applyOptimisticUpdates]);

  /**
   * Simple client-side categorization for UI dropdowns/filters
   */
  const getAgentsByType = useCallback((type: string): AIAgent[] => {
    const agentsWithOptimistic = applyOptimisticUpdates(agents.data);
    return agentsWithOptimistic.filter(agent => agent.type === type);
  }, [agents.data, applyOptimisticUpdates]);

  const getAgentsByStatus = useCallback((status: string): AIAgent[] => {
    const agentsWithOptimistic = applyOptimisticUpdates(agents.data);
    return agentsWithOptimistic.filter(agent => agent.status === status);
  }, [agents.data, applyOptimisticUpdates]);

  const getAgentsByHealth = useCallback((health: string): AIAgent[] => {
    const agentsWithOptimistic = applyOptimisticUpdates(agents.data);
    return agentsWithOptimistic.filter(agent => agent.health_status === health);
  }, [agents.data, applyOptimisticUpdates]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setAgents(prev => ({ ...prev, error: null }));
  }, []);

  // Apply optimistic updates to agents for display
  const agentsWithOptimistic = useMemo(() => ({
    ...agents,
    data: applyOptimisticUpdates(agents.data),
  }), [agents, applyOptimisticUpdates]);

  // Initialize and setup auto-refresh
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshAgents();
      
      // Auto-refresh every 5 minutes if data is stale
      const interval = setInterval(() => {
        if (isStale) {
          refreshAgents();
        }
      }, 60000); // Check every minute
      
      return () => clearInterval(interval);
    }
  }, [tenantId, globalConfig, refreshAgents, isStale]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setOptimisticOperations([]);
    };
  }, []);

  return (
    <AiAgentsContext.Provider
      value={{
        agents: agentsWithOptimistic,
        createAgent,
        updateAgent,
        deleteAgent,
        refreshAgents,
        getAgentById,
        executeAgent,
        getFilteredAgents,
        searchAgents,
        getAgentsByType,
        getAgentsByStatus,
        getAgentsByHealth,
        optimisticOperations,
        clearError,
        isStale,
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

/**
 * Main hook for AI agents context
 */
export const useAiAgents = () => {
  const ctx = useContext(AiAgentsContext);
  if (!ctx) throw new Error("useAiAgents must be used within AiAgentsProvider");
  return ctx;
};

/**
 * Hook for getting a specific agent with reactive updates
 */
export const useAiAgent = (id: string) => {
  const { getAgentById } = useAiAgents();
  return useMemo(() => getAgentById(id), [id, getAgentById]);
};

/**
 * Hook for filtered agents with memoization
 */
export const useFilteredAIAgents = (filters: AIAgentUIFilters) => {
  const { getFilteredAgents } = useAiAgents();
  return useMemo(() => getFilteredAgents(filters), [filters, getFilteredAgents]);
};

/**
 * Hook for agent search with debouncing
 */
export const useAiAgentSearch = (query: string, debounceMs = 300) => {
  const { searchAgents } = useAiAgents();
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => clearTimeout(timer);
  }, [query, debounceMs]);
  
  return useMemo(() => searchAgents(debouncedQuery), [debouncedQuery, searchAgents]);
};

/**
 * Selective subscription hooks for performance
 */
export const useAgentsByType = (type: string) => {
  const { getAgentsByType } = useAiAgents();
  return useMemo(() => getAgentsByType(type), [type, getAgentsByType]);
};

export const useAgentsByStatus = (status: string) => {
  const { getAgentsByStatus } = useAiAgents();
  return useMemo(() => getAgentsByStatus(status), [status, getAgentsByStatus]);
};

export const useActiveAgents = () => {
  const { getAgentsByStatus } = useAiAgents();
  return useMemo(() => getAgentsByStatus('active'), [getAgentsByStatus]);
};

/**
 * Hook for agents requiring approval
 */
export const useAgentsRequiringApproval = () => {
  const { getFilteredAgents } = useAiAgents();
  return useMemo(() => getFilteredAgents({ requiresApproval: true }), [getFilteredAgents]);
};