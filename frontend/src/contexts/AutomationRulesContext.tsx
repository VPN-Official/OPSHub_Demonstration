// src/contexts/AutomationRulesContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import { AsyncState, AsyncStateHelpers } from "../types/asyncState";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";
import { ExternalSystemFields } from "../types/externalSystem";

// ---------------------------------
// 1. Type Definitions (UI-Focused)
// ---------------------------------
export type AutomationTrigger = 
  | "entity_created"
  | "entity_updated" 
  | "entity_deleted"
  | "status_changed"
  | "field_changed"
  | "threshold_exceeded"
  | "time_elapsed"
  | "schedule"
  | "webhook"
  | "manual"
  | "ai_prediction"
  | "pattern_detected";

export type ActionType = 
  | "assign"
  | "escalate"
  | "notify"
  | "create_entity"
  | "update_entity"
  | "execute_script"
  | "call_api"
  | "send_email"
  | "create_ticket"
  | "run_workflow"
  | "trigger_ai_agent"
  | "update_metrics"
  | "create_alert"
  | "custom";

export interface TriggerCondition {
  field: string;
  operator: string;
  value: any;
  case_sensitive?: boolean;
}

export interface AutomationAction {
  id: string;
  type: ActionType;
  name: string;
  description?: string;
  parameters: Record<string, any>;
  retry_attempts?: number;
  timeout_seconds?: number;
  on_failure?: "continue" | "stop" | "rollback";
  condition?: TriggerCondition[];
}

export interface ExecutionLog {
  execution_id: string;
  started_at: string;
  completed_at?: string;
  status: "running" | "completed" | "failed" | "cancelled";
  trigger_data: any;
  action_results: Array<{
    action_id: string;
    action_name: string;
    status: "success" | "failed" | "skipped";
    result?: any;
    error?: string;
    execution_time_ms: number;
  }>;
  total_execution_time_ms?: number;
  error_message?: string;
}

export interface AutomationRule extends ExternalSystemFields {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  created_at: string;
  updated_at: string;
  trigger_type: AutomationTrigger;
  trigger_conditions: TriggerCondition[];
  entity_types: string[];
  schedule_cron?: string;
  schedule_timezone?: string;
  schedule_enabled?: boolean;
  actions: AutomationAction[];
  execution_order: "sequential" | "parallel";
  related_runbook_ids: string[];
  related_incident_ids: string[];
  related_problem_ids: string[];
  related_change_ids: string[];
  related_maintenance_ids: string[];
  owner_user_id?: string | null;
  owner_team_id?: string | null;
  enabled: boolean;
  max_executions_per_hour?: number;
  max_concurrent_executions?: number;
  cooldown_minutes?: number;
  last_executed_at?: string | null;
  last_executed_by_user_id?: string | null;
  execution_count: number;
  success_count: number;
  failure_count: number;
  average_execution_time_ms?: number;
  last_execution_duration_ms?: number;
  business_service_ids: string[];
  customer_ids: string[];
  cost_savings_estimate?: number;
  time_savings_estimate_minutes?: number;
  risk_level: "low" | "medium" | "high" | "critical";
  requires_approval: boolean;
  approval_workflow?: Array<{
    step: number;
    approver_user_id: string;
    approved_at?: string;
    rejected_at?: string;
    comments?: string;
  }>;
  compliance_requirement_ids: string[];
  recent_executions: ExecutionLog[];
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  // synced_at and sync_status inherited from ExternalSystemFields
  tenantId?: string;
}

/**
 * Frontend-focused async state wrapper for managing UI concerns
 */


/**
 * UI-focused filter options for immediate client-side filtering
 */
export interface UIFilters {
  search?: string;
  type?: string;
  status?: string;
  enabled?: boolean;
  risk_level?: string;
  trigger_type?: AutomationTrigger;
  owner_user_id?: string;
  tags?: string[];
  // External system filtering
  sourceSystems?: string[];
  syncStatus?: ('synced' | 'syncing' | 'error' | 'conflict')[];
  hasConflicts?: boolean;
  hasLocalChanges?: boolean;
  dataCompleteness?: { min: number; max: number };
}

/**
 * Performance metrics from backend
 */
export interface AutomationMetrics {
  totalRules: number;
  enabledRules: number;
  totalExecutions: number;
  successRate: number;
  totalCostSavings: number;
  totalTimeSavings: number;
  topPerformingRules: Array<{ ruleId: string; name: string; successRate: number }>;
}

/**
 * Rule performance data from backend
 */
export interface RulePerformance {
  successRate: number;
  averageExecutionTime: number;
  totalExecutions: number;
  recentFailures: ExecutionLog[];
  costSavings: number;
  timeSavings: number;
}

// ---------------------------------
// 2. Context Interface (Frontend-Only)
// ---------------------------------
interface AutomationRulesContextType {
  // Core async state management
  rules: AsyncState<AutomationRule[]>;
  metrics: AsyncState<AutomationMetrics>;
  
  // CRUD operations (API orchestration only)
  createRule: (rule: Omit<AutomationRule, 'id' | 'created_at' | 'updated_at'>, userId?: string) => Promise<void>;
  updateRule: (id: string, updates: Partial<AutomationRule>, userId?: string) => Promise<void>;
  deleteRule: (id: string, userId?: string) => Promise<void>;
  
  // Rule operations (API calls with optimistic UI)
  executeRule: (ruleId: string, triggerData: any, userId?: string) => Promise<void>;
  enableRule: (ruleId: string, userId: string) => Promise<void>;
  disableRule: (ruleId: string, userId: string, reason?: string) => Promise<void>;
  testRule: (ruleId: string, testData: any, userId: string) => Promise<{ valid: boolean; results: any[] }>;
  
  // Approval workflow (API orchestration)
  requestApproval: (ruleId: string, userId: string, comments?: string) => Promise<void>;
  approveRule: (ruleId: string, userId: string, comments?: string) => Promise<void>;
  rejectRule: (ruleId: string, userId: string, reason: string) => Promise<void>;

  // Frontend state management
  refresh: () => Promise<void>;
  invalidateCache: () => void;
  clearError: () => void;
  
  // UI-focused filtering (client-side only for immediate responsiveness)
  filteredRules: AutomationRule[];
  setUIFilters: (filters: UIFilters) => void;
  uiFilters: UIFilters;
  
  // Config from backend
  config: {
    types: string[];
    statuses: string[];
    triggerTypes: AutomationTrigger[];
    actionTypes: ActionType[];
    riskLevels: string[];
  };
}

const AutomationRulesContext = createContext<AutomationRulesContextType | undefined>(undefined);

// ---------------------------------
// 3. API Service Layer (Thin wrappers)
// ---------------------------------
class AutomationRulesAPI {
  private static baseUrl = '/api/automation-rules';
  
  static async getAll(tenantId: string): Promise<AutomationRule[]> {
    const response = await fetch(`${this.baseUrl}?tenant=${tenantId}`);
    if (!response.ok) throw new Error(`Failed to fetch rules: ${response.statusText}`);
    return response.json();
  }
  
  static async getById(tenantId: string, id: string): Promise<AutomationRule> {
    const response = await fetch(`${this.baseUrl}/${id}?tenant=${tenantId}`);
    if (!response.ok) throw new Error(`Failed to fetch rule ${id}: ${response.statusText}`);
    return response.json();
  }
  
  static async create(tenantId: string, rule: Omit<AutomationRule, 'id' | 'created_at' | 'updated_at'>, userId?: string): Promise<AutomationRule> {
    const response = await fetch(`${this.baseUrl}?tenant=${tenantId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...rule, created_by: userId }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to create rule: ${response.statusText}`);
    }
    return response.json();
  }
  
  static async update(tenantId: string, id: string, updates: Partial<AutomationRule>, userId?: string): Promise<AutomationRule> {
    const response = await fetch(`${this.baseUrl}/${id}?tenant=${tenantId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updates, updated_by: userId }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to update rule: ${response.statusText}`);
    }
    return response.json();
  }
  
  static async delete(tenantId: string, id: string, userId?: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}?tenant=${tenantId}&deleted_by=${userId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(`Failed to delete rule: ${response.statusText}`);
  }
  
  static async execute(tenantId: string, ruleId: string, triggerData: any, userId?: string): Promise<ExecutionLog> {
    const response = await fetch(`${this.baseUrl}/${ruleId}/execute?tenant=${tenantId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger_data: triggerData, executed_by: userId }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to execute rule: ${response.statusText}`);
    }
    return response.json();
  }
  
  static async test(tenantId: string, ruleId: string, testData: any, userId: string): Promise<{ valid: boolean; results: any[] }> {
    const response = await fetch(`${this.baseUrl}/${ruleId}/test?tenant=${tenantId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test_data: testData, tested_by: userId }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to test rule: ${response.statusText}`);
    }
    return response.json();
  }
  
  static async getMetrics(tenantId: string): Promise<AutomationMetrics> {
    const response = await fetch(`${this.baseUrl}/metrics?tenant=${tenantId}`);
    if (!response.ok) throw new Error(`Failed to fetch metrics: ${response.statusText}`);
    return response.json();
  }
  
  static async getRulePerformance(tenantId: string, ruleId: string): Promise<RulePerformance> {
    const response = await fetch(`${this.baseUrl}/${ruleId}/performance?tenant=${tenantId}`);
    if (!response.ok) throw new Error(`Failed to fetch rule performance: ${response.statusText}`);
    return response.json();
  }
}

// ---------------------------------
// 4. Provider (Frontend State Management)
// ---------------------------------
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const AutomationRulesProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();
  
  // Core async state
  const [rules, setRules] = useState<AsyncState<AutomationRule[]>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    stale: true,
  });
  
  const [metrics, setMetrics] = useState<AsyncState<AutomationMetrics>>({
    data: {
      totalRules: 0,
      enabledRules: 0,
      totalExecutions: 0,
      successRate: 0,
      totalCostSavings: 0,
      totalTimeSavings: 0,
      topPerformingRules: [],
    },
    loading: false,
    error: null,
    lastFetch: null,
    stale: true,
  });
  
  // UI filters for client-side filtering
  const [uiFilters, setUIFilters] = useState<UIFilters>({});
  
  // Config from backend
  const config = useMemo(() => ({
    types: globalConfig?.automation?.map(a => a.id).filter((t, i, arr) => arr.indexOf(t) === i) || [],
    statuses: globalConfig?.statuses?.automation_rules || [],
    triggerTypes: [
      "entity_created", "entity_updated", "entity_deleted", "status_changed", 
      "field_changed", "threshold_exceeded", "time_elapsed", "schedule", 
      "webhook", "manual", "ai_prediction", "pattern_detected"
    ] as AutomationTrigger[],
    actionTypes: [
      "assign", "escalate", "notify", "create_entity", "update_entity", 
      "execute_script", "call_api", "send_email", "create_ticket", 
      "run_workflow", "trigger_ai_agent", "update_metrics", "create_alert", "custom"
    ] as ActionType[],
    riskLevels: ["low", "medium", "high", "critical"],
  }), [globalConfig]);
  
  /**
   * Check if cached data is stale
   */
  const isDataStale = useCallback((lastFetch: Date | null): boolean => {
    if (!lastFetch) return true;
    return Date.now() - lastFetch.getTime() > CACHE_TTL;
  }, []);
  
  /**
   * Refresh rules from backend
   */
  const refresh = useCallback(async () => {
    if (!tenantId) return;
    
    setRules(prev => ({ ...prev, loading: true, error: null }));
    setMetrics(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const [rulesData, metricsData] = await Promise.all([
        AutomationRulesAPI.getAll(tenantId),
        AutomationRulesAPI.getMetrics(tenantId),
      ]);
      
      const now = new Date();
      
      setRules({
        data: rulesData,
        loading: false,
        error: null,
        lastFetch: now,
        stale: false,
      });
      
      setMetrics({
        data: metricsData,
        loading: false,
        error: null,
        lastFetch: now,
        stale: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh data';
      
      setRules(prev => ({ ...prev, loading: false, error: errorMessage }));
      setMetrics(prev => ({ ...prev, loading: false, error: errorMessage }));
    }
  }, [tenantId]);
  
  /**
   * Invalidate cache and mark data as stale
   */
  const invalidateCache = useCallback(() => {
    setRules(prev => ({ ...prev, stale: true }));
    setMetrics(prev => ({ ...prev, stale: true }));
  }, []);
  
  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setRules(prev => ({ ...prev, error: null }));
    setMetrics(prev => ({ ...prev, error: null }));
  }, []);
  
  /**
   * Create rule with optimistic UI update
   */
  const createRule = useCallback(async (
    rule: Omit<AutomationRule, 'id' | 'created_at' | 'updated_at'>, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    // Optimistic update
    const optimisticRule: AutomationRule = {
      ...rule,
      id: `temp-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      execution_count: 0,
      success_count: 0,
      failure_count: 0,
      recent_executions: [],
      enabled: rule.enabled ?? true,
      requires_approval: rule.requires_approval ?? false,
      risk_level: rule.risk_level || "low",
      execution_order: rule.execution_order || "sequential",
      health_status: "gray",
      tags: rule.tags || [],
      related_runbook_ids: rule.related_runbook_ids || [],
      related_incident_ids: rule.related_incident_ids || [],
      related_problem_ids: rule.related_problem_ids || [],
      related_change_ids: rule.related_change_ids || [],
      related_maintenance_ids: rule.related_maintenance_ids || [],
      business_service_ids: rule.business_service_ids || [],
      customer_ids: rule.customer_ids || [],
      compliance_requirement_ids: rule.compliance_requirement_ids || [],
    };
    
    setRules(prev => ({
      ...prev,
      data: [optimisticRule, ...prev.data],
    }));
    
    try {
      const createdRule = await AutomationRulesAPI.create(tenantId, rule, userId);
      
      // Replace optimistic update with real data
      setRules(prev => ({
        ...prev,
        data: prev.data.map(r => r.id === optimisticRule.id ? createdRule : r),
      }));
      
      // Queue for sync if offline
      await enqueueItem({
        storeName: "automation_rules",
        entityId: createdRule.id,
        action: "create",
        payload: createdRule,
        priority: rule.risk_level === 'critical' ? 'high' : 'normal',
      });
      
      // Refresh metrics
      invalidateCache();
    } catch (error) {
      // Rollback optimistic update
      setRules(prev => ({
        ...prev,
        data: prev.data.filter(r => r.id !== optimisticRule.id),
        error: error instanceof Error ? error.message : 'Failed to create rule',
      }));
      throw error;
    }
  }, [tenantId, enqueueItem, invalidateCache]);
  
  /**
   * Update rule with optimistic UI update
   */
  const updateRule = useCallback(async (
    id: string, 
    updates: Partial<AutomationRule>, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    // Optimistic update
    const originalRule = rules.data.find(r => r.id === id);
    if (!originalRule) throw new Error(`Rule ${id} not found`);
    
    const optimisticRule = {
      ...originalRule,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    
    setRules(prev => ({
      ...prev,
      data: prev.data.map(r => r.id === id ? optimisticRule : r),
    }));
    
    try {
      const updatedRule = await AutomationRulesAPI.update(tenantId, id, updates, userId);
      
      // Replace optimistic update with real data
      setRules(prev => ({
        ...prev,
        data: prev.data.map(r => r.id === id ? updatedRule : r),
      }));
      
      // Queue for sync if offline
      await enqueueItem({
        storeName: "automation_rules",
        entityId: id,
        action: "update",
        payload: updatedRule,
        priority: updatedRule.risk_level === 'critical' ? 'high' : 'normal',
      });
      
      // Refresh metrics if enabled/disabled changed
      if ('enabled' in updates) {
        invalidateCache();
      }
    } catch (error) {
      // Rollback optimistic update
      setRules(prev => ({
        ...prev,
        data: prev.data.map(r => r.id === id ? originalRule : r),
        error: error instanceof Error ? error.message : 'Failed to update rule',
      }));
      throw error;
    }
  }, [tenantId, rules.data, enqueueItem, invalidateCache]);
  
  /**
   * Delete rule with optimistic UI update
   */
  const deleteRule = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    // Optimistic update
    const originalRule = rules.data.find(r => r.id === id);
    setRules(prev => ({
      ...prev,
      data: prev.data.filter(r => r.id !== id),
    }));
    
    try {
      await AutomationRulesAPI.delete(tenantId, id, userId);
      
      // Queue for sync if offline
      await enqueueItem({
        storeName: "automation_rules",
        entityId: id,
        action: "delete",
        payload: null,
      });
      
      // Refresh metrics
      invalidateCache();
    } catch (error) {
      // Rollback optimistic update
      if (originalRule) {
        setRules(prev => ({
          ...prev,
          data: [originalRule, ...prev.data],
          error: error instanceof Error ? error.message : 'Failed to delete rule',
        }));
      }
      throw error;
    }
  }, [tenantId, rules.data, enqueueItem, invalidateCache]);
  
  /**
   * Execute rule (API call only)
   */
  const executeRule = useCallback(async (
    ruleId: string, 
    triggerData: any, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    try {
      await AutomationRulesAPI.execute(tenantId, ruleId, triggerData, userId);
      
      // Refresh to get updated execution metrics
      invalidateCache();
    } catch (error) {
      setRules(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to execute rule',
      }));
      throw error;
    }
  }, [tenantId, invalidateCache]);
  
  /**
   * Enable rule
   */
  const enableRule = useCallback(async (ruleId: string, userId: string) => {
    await updateRule(ruleId, { enabled: true }, userId);
  }, [updateRule]);
  
  /**
   * Disable rule
   */
  const disableRule = useCallback(async (ruleId: string, userId: string, reason?: string) => {
    const updates: Partial<AutomationRule> = { 
      enabled: false,
      custom_fields: reason ? {
        disabled_reason: reason,
        disabled_by: userId,
        disabled_at: new Date().toISOString(),
      } : undefined,
    };
    await updateRule(ruleId, updates, userId);
  }, [updateRule]);
  
  /**
   * Test rule (API call only)
   */
  const testRule = useCallback(async (
    ruleId: string, 
    testData: any, 
    userId: string
  ): Promise<{ valid: boolean; results: any[] }> => {
    if (!tenantId) throw new Error("No tenant selected");
    
    try {
      return await AutomationRulesAPI.test(tenantId, ruleId, testData, userId);
    } catch (error) {
      setRules(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to test rule',
      }));
      throw error;
    }
  }, [tenantId]);
  
  // Placeholder approval workflow functions (API calls only)
  const requestApproval = useCallback(async (ruleId: string, userId: string, comments?: string) => {
    // TODO: Implement approval workflow API call
    console.log('Request approval:', { ruleId, userId, comments });
  }, []);
  
  const approveRule = useCallback(async (ruleId: string, userId: string, comments?: string) => {
    // TODO: Implement approval API call
    console.log('Approve rule:', { ruleId, userId, comments });
  }, []);
  
  const rejectRule = useCallback(async (ruleId: string, userId: string, reason: string) => {
    // TODO: Implement rejection API call
    console.log('Reject rule:', { ruleId, userId, reason });
  }, []);
  
  /**
   * Client-side filtering for immediate UI responsiveness
   */
  const filteredRules = useMemo(() => {
    let filtered = rules.data;
    
    // Basic text search
    if (uiFilters.search) {
      const searchLower = uiFilters.search.toLowerCase();
      filtered = filtered.filter(rule => 
        rule.name.toLowerCase().includes(searchLower) ||
        rule.description?.toLowerCase().includes(searchLower) ||
        rule.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }
    
    // Filter by type
    if (uiFilters.type) {
      filtered = filtered.filter(rule => rule.type === uiFilters.type);
    }
    
    // Filter by status
    if (uiFilters.status) {
      filtered = filtered.filter(rule => rule.status === uiFilters.status);
    }
    
    // Filter by enabled state
    if (uiFilters.enabled !== undefined) {
      filtered = filtered.filter(rule => rule.enabled === uiFilters.enabled);
    }
    
    // Filter by risk level
    if (uiFilters.risk_level) {
      filtered = filtered.filter(rule => rule.risk_level === uiFilters.risk_level);
    }
    
    // Filter by trigger type
    if (uiFilters.trigger_type) {
      filtered = filtered.filter(rule => rule.trigger_type === uiFilters.trigger_type);
    }
    
    // Filter by owner
    if (uiFilters.owner_user_id) {
      filtered = filtered.filter(rule => rule.owner_user_id === uiFilters.owner_user_id);
    }
    
    // Filter by tags
    if (uiFilters.tags && uiFilters.tags.length > 0) {
      filtered = filtered.filter(rule => 
        uiFilters.tags!.some(tag => rule.tags.includes(tag))
      );
    }
    
    return filtered;
  }, [rules.data, uiFilters]);
  
  /**
   * Auto-refresh data when it becomes stale
   */
  useEffect(() => {
    if (!tenantId || !globalConfig) return;
    
    const shouldRefresh = isDataStale(rules.lastFetch) || isDataStale(metrics.lastFetch);
    if (shouldRefresh && !rules.loading && !metrics.loading) {
      refresh();
    }
  }, [tenantId, globalConfig, isDataStale, rules.lastFetch, rules.loading, metrics.lastFetch, metrics.loading, refresh]);
  
  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Clear large datasets to prevent memory leaks
      setRules(prev => ({ ...prev, data: [] }));
      setMetrics(prev => ({ ...prev, data: {
        totalRules: 0,
        enabledRules: 0,
        totalExecutions: 0,
        successRate: 0,
        totalCostSavings: 0,
        totalTimeSavings: 0,
        topPerformingRules: [],
      }}));
    };
  }, []);

  return (
    <AutomationRulesContext.Provider
      value={{
        rules,
        metrics,
        createRule,
        updateRule,
        deleteRule,
        executeRule,
        enableRule,
        disableRule,
        testRule,
        requestApproval,
        approveRule,
        rejectRule,
        refresh,
        invalidateCache,
        clearError,
        filteredRules,
        setUIFilters,
        uiFilters,
        config,
      }}
    >
      {children}
    </AutomationRulesContext.Provider>
  );
};

// ---------------------------------
// 5. Hooks (Performance Optimized)
// ---------------------------------

/**
 * Main hook for automation rules context
 */
export const useAutomationRules = () => {
  const ctx = useContext(AutomationRulesContext);
  if (!ctx) throw new Error("useAutomationRules must be used within AutomationRulesProvider");
  return ctx;
};

/**
 * Get single rule by ID (memoized)
 */
export const useAutomationRule = (id: string) => {
  const { rules } = useAutomationRules();
  
  return useMemo(() => 
    rules.data.find(rule => rule.id === id) || null,
    [rules.data, id]
  );
};

/**
 * Get rules by specific status (memoized)
 */
export const useAutomationRulesByStatus = (status: string) => {
  const { rules } = useAutomationRules();
  
  return useMemo(() => 
    rules.data.filter(rule => rule.status === status),
    [rules.data, status]
  );
};

/**
 * Get enabled rules only (memoized)
 */
export const useEnabledAutomationRules = () => {
  const { rules } = useAutomationRules();
  
  return useMemo(() => 
    rules.data.filter(rule => rule.enabled),
    [rules.data]
  );
};

/**
 * Get rules by trigger type (memoized)
 */
export const useAutomationRulesByTrigger = (triggerType: AutomationTrigger) => {
  const { rules } = useAutomationRules();
  
  return useMemo(() => 
    rules.data.filter(rule => rule.trigger_type === triggerType),
    [rules.data, triggerType]
  );
};

/**
 * Get rules needing approval (memoized)
 */
export const useRulesNeedingApproval = () => {
  const { rules } = useAutomationRules();
  
  return useMemo(() => 
    rules.data.filter(rule => 
      rule.requires_approval && 
      (!rule.approval_workflow || rule.approval_workflow.some(step => !step.approved_at))
    ),
    [rules.data]
  );
};

/**
 * Get automation metrics
 */
export const useAutomationMetrics = () => {
  const { metrics } = useAutomationRules();
  return metrics;
};

/**
 * Hook for rule performance data (fetches from backend)
 */
export const useRulePerformance = (ruleId: string) => {
  const { tenantId } = useTenant();
  const [performance, setPerformance] = useState<AsyncState<RulePerformance>>({
    data: {
      successRate: 0,
      averageExecutionTime: 0,
      totalExecutions: 0,
      recentFailures: [],
      costSavings: 0,
      timeSavings: 0,
    },
    loading: false,
    error: null,
    lastFetch: null,
    stale: true,
  });
  
  const fetchPerformance = useCallback(async () => {
    if (!tenantId || !ruleId) return;
    
    setPerformance(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await AutomationRulesAPI.getRulePerformance(tenantId, ruleId);
      setPerformance({
        data,
        loading: false,
        error: null,
        lastFetch: new Date(),
        stale: false,
      });
    } catch (error) {
      setPerformance(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch performance data',
      }));
    }
  }, [tenantId, ruleId]);
  
  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);
  
  return { performance, refreshPerformance: fetchPerformance };
};