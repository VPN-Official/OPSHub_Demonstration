// src/contexts/AutomationRulesContext.tsx
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
  operator: "equals" | "not_equals" | "contains" | "not_contains" | "greater_than" | "less_than" | "in" | "not_in" | "regex" | "exists" | "not_exists";
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
  condition?: TriggerCondition[]; // Execute action only if conditions met
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

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  type: string;   // config-driven
  status: string; // config-driven  
  created_at: string;
  updated_at: string;

  // Trigger configuration
  trigger_type: AutomationTrigger;
  trigger_conditions: TriggerCondition[];
  entity_types: string[]; // Which entity types this rule applies to
  
  // Schedule configuration (for scheduled triggers)
  schedule_cron?: string;
  schedule_timezone?: string;
  schedule_enabled?: boolean;
  
  // Actions to execute
  actions: AutomationAction[];
  execution_order: "sequential" | "parallel";
  
  // Relationships
  related_runbook_ids: string[];
  related_incident_ids: string[];
  related_problem_ids: string[];
  related_change_ids: string[];
  related_maintenance_ids: string[];
  owner_user_id?: string | null;
  owner_team_id?: string | null;

  // Execution control
  enabled: boolean;
  max_executions_per_hour?: number;
  max_concurrent_executions?: number;
  cooldown_minutes?: number;
  last_executed_at?: string | null;
  last_executed_by_user_id?: string | null;
  
  // Performance metrics
  execution_count: number;
  success_count: number;
  failure_count: number;
  average_execution_time_ms?: number;
  last_execution_duration_ms?: number;
  
  // Business impact tracking
  business_service_ids: string[];
  customer_ids: string[];
  cost_savings_estimate?: number;
  time_savings_estimate_minutes?: number;

  // Risk and compliance
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
  
  // Execution history
  recent_executions: ExecutionLog[];
  
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
interface AutomationRulesContextType {
  automationRules: AutomationRule[];
  addAutomationRule: (rule: AutomationRule, userId?: string) => Promise<void>;
  updateAutomationRule: (rule: AutomationRule, userId?: string) => Promise<void>;
  deleteAutomationRule: (id: string, userId?: string) => Promise<void>;
  refreshAutomationRules: () => Promise<void>;
  getAutomationRule: (id: string) => Promise<AutomationRule | undefined>;

  // Rule execution and management
  executeRule: (ruleId: string, triggerData: any, userId?: string) => Promise<ExecutionLog>;
  enableRule: (ruleId: string, userId: string) => Promise<void>;
  disableRule: (ruleId: string, userId: string, reason?: string) => Promise<void>;
  testRule: (ruleId: string, testData: any, userId: string) => Promise<{ valid: boolean; results: any[] }>;
  
  // Approval workflow
  requestApproval: (ruleId: string, userId: string, comments?: string) => Promise<void>;
  approveRule: (ruleId: string, userId: string, comments?: string) => Promise<void>;
  rejectRule: (ruleId: string, userId: string, reason: string) => Promise<void>;

  // Filtering and querying
  getRulesByType: (type: string) => AutomationRule[];
  getRulesByStatus: (status: string) => AutomationRule[];
  getRulesByTrigger: (triggerType: AutomationTrigger) => AutomationRule[];
  getEnabledRules: () => AutomationRule[];
  getRulesNeedingApproval: () => AutomationRule[];
  getRulesByBusinessService: (serviceId: string) => AutomationRule[];
  getFailingRules: () => AutomationRule[];
  getHighPerformingRules: () => AutomationRule[];

  // Analytics and reporting
  getRulePerformance: (ruleId: string) => {
    successRate: number;
    averageExecutionTime: number;
    totalExecutions: number;
    recentFailures: ExecutionLog[];
    costSavings: number;
    timeSavings: number;
  };
  
  getAutomationStats: () => {
    totalRules: number;
    enabledRules: number;
    totalExecutions: number;
    successRate: number;
    totalCostSavings: number;
    totalTimeSavings: number;
    topPerformingRules: Array<{ ruleId: string; name: string; successRate: number }>;
  };

  // Config integration
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
// 3. Provider
// ---------------------------------
export const AutomationRulesProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig, validateEnum } = useConfig();
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);

  // Extract automation-specific config
  const config = {
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
  };

  const refreshAutomationRules = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      const all = await getAll<AutomationRule>(tenantId, "automation_rules");
      
      // Sort by performance and status (enabled first, then by success rate)
      all.sort((a, b) => {
        // Enabled rules first
        if (a.enabled && !b.enabled) return -1;
        if (!a.enabled && b.enabled) return 1;
        
        // Then by success rate
        const aSuccessRate = a.execution_count > 0 ? a.success_count / a.execution_count : 0;
        const bSuccessRate = b.execution_count > 0 ? b.success_count / b.execution_count : 0;
        if (aSuccessRate !== bSuccessRate) return bSuccessRate - aSuccessRate;
        
        // Finally by name
        return a.name.localeCompare(b.name);
      });
      
      setAutomationRules(all);
    } catch (error) {
      console.error("Failed to refresh automation rules:", error);
    }
  }, [tenantId]);

  const getAutomationRule = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    return getById<AutomationRule>(tenantId, "automation_rules", id);
  }, [tenantId]);

  const validateAutomationRule = useCallback((rule: AutomationRule) => {
    if (!globalConfig) {
      throw new Error("Configuration not loaded");
    }

    // Validate type
    if (!config.types.includes(rule.type)) {
      throw new Error(`Invalid automation type: ${rule.type}. Valid options: ${config.types.join(', ')}`);
    }

    // Validate status
    if (!validateEnum('statuses', rule.status)) {
      throw new Error(`Invalid status: ${rule.status}. Valid options: ${config.statuses.join(', ')}`);
    }

    // Validate trigger type
    if (!config.triggerTypes.includes(rule.trigger_type)) {
      throw new Error(`Invalid trigger type: ${rule.trigger_type}. Valid options: ${config.triggerTypes.join(', ')}`);
    }

    // Validate actions
    if (!rule.actions || rule.actions.length === 0) {
      throw new Error("At least one action must be defined");
    }

    rule.actions.forEach((action, index) => {
      if (!config.actionTypes.includes(action.type)) {
        throw new Error(`Invalid action type at index ${index}: ${action.type}. Valid options: ${config.actionTypes.join(', ')}`);
      }
      
      if (!action.name || action.name.trim().length < 2) {
        throw new Error(`Action at index ${index} must have a name of at least 2 characters`);
      }
    });

    // Validate required fields
    if (!rule.name || rule.name.trim().length < 3) {
      throw new Error("Name must be at least 3 characters long");
    }

    if (!rule.entity_types || rule.entity_types.length === 0) {
      throw new Error("At least one entity type must be specified");
    }

    // Validate schedule if it's a scheduled trigger
    if (rule.trigger_type === "schedule") {
      if (!rule.schedule_cron) {
        throw new Error("Cron schedule is required for scheduled triggers");
      }
      // Basic cron validation (simplified)
      if (rule.schedule_cron.split(' ').length !== 5) {
        throw new Error("Invalid cron format. Expected 5 fields: minute hour day month weekday");
      }
    }

    // Validate risk level
    if (!config.riskLevels.includes(rule.risk_level)) {
      throw new Error(`Invalid risk level: ${rule.risk_level}. Valid options: ${config.riskLevels.join(', ')}`);
    }
  }, [globalConfig, validateEnum, config]);

  const ensureMetadata = useCallback((rule: AutomationRule): AutomationRule => {
    const now = new Date().toISOString();
    return {
      ...rule,
      tenantId,
      tags: rule.tags || [],
      health_status: rule.health_status || "gray",
      sync_status: rule.sync_status || "dirty",
      synced_at: rule.synced_at || now,
      related_runbook_ids: rule.related_runbook_ids || [],
      related_incident_ids: rule.related_incident_ids || [],
      related_problem_ids: rule.related_problem_ids || [],
      related_change_ids: rule.related_change_ids || [],
      related_maintenance_ids: rule.related_maintenance_ids || [],
      business_service_ids: rule.business_service_ids || [],
      customer_ids: rule.customer_ids || [],
      compliance_requirement_ids: rule.compliance_requirement_ids || [],
      execution_count: rule.execution_count || 0,
      success_count: rule.success_count || 0,
      failure_count: rule.failure_count || 0,
      recent_executions: rule.recent_executions || [],
      enabled: rule.enabled ?? true,
      requires_approval: rule.requires_approval ?? false,
      risk_level: rule.risk_level || "low",
      execution_order: rule.execution_order || "sequential",
    };
  }, [tenantId]);

  const addAutomationRule = useCallback(async (rule: AutomationRule, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateAutomationRule(rule);

    const now = new Date().toISOString();
    const enriched = ensureMetadata({
      ...rule,
      created_at: now,
      updated_at: now,
    });

    await putWithAudit(
      tenantId,
      "automation_rules",
      enriched,
      userId,
      {
        action: "create",
        description: `Created automation rule: ${rule.name}`,
        tags: ["automation", "create", rule.type, rule.trigger_type],
        priority: rule.risk_level === 'critical' ? 'high' : 'normal',
        metadata: {
          rule_type: rule.type,
          trigger_type: rule.trigger_type,
          action_count: rule.actions.length,
          risk_level: rule.risk_level,
          requires_approval: rule.requires_approval,
        },
      }
    );

    await enqueueItem({
      storeName: "automation_rules",
      entityId: enriched.id,
      action: "create",
      payload: enriched,
      priority: rule.risk_level === 'critical' ? 'high' : 'normal',
    });

    await refreshAutomationRules();
  }, [tenantId, validateAutomationRule, ensureMetadata, enqueueItem, refreshAutomationRules]);

  const updateAutomationRule = useCallback(async (rule: AutomationRule, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateAutomationRule(rule);

    const enriched = ensureMetadata({
      ...rule,
      updated_at: new Date().toISOString(),
    });

    await putWithAudit(
      tenantId,
      "automation_rules",
      enriched,
      userId,
      {
        action: "update",
        description: `Updated automation rule: ${rule.name}`,
        tags: ["automation", "update", rule.status],
        priority: rule.risk_level === 'critical' ? 'high' : 'normal',
        metadata: {
          enabled: rule.enabled,
          status_change: rule.status,
        },
      }
    );

    await enqueueItem({
      storeName: "automation_rules",
      entityId: enriched.id,
      action: "update",
      payload: enriched,
      priority: rule.risk_level === 'critical' ? 'high' : 'normal',
    });

    await refreshAutomationRules();
  }, [tenantId, validateAutomationRule, ensureMetadata, enqueueItem, refreshAutomationRules]);

  const deleteAutomationRule = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    const rule = await getAutomationRule(id);
    
    await removeWithAudit(
      tenantId,
      "automation_rules",
      id,
      userId,
      {
        action: "delete",
        description: `Deleted automation rule: ${rule?.name || id}`,
        tags: ["automation", "delete"],
        metadata: {
          rule_type: rule?.type,
          execution_count: rule?.execution_count,
        },
      }
    );

    await enqueueItem({
      storeName: "automation_rules",
      entityId: id,
      action: "delete",
      payload: null,
    });

    await refreshAutomationRules();
  }, [tenantId, getAutomationRule, enqueueItem, refreshAutomationRules]);

  // Rule execution and management
  const executeRule = useCallback(async (
    ruleId: string, 
    triggerData: any, 
    userId?: string
  ): Promise<ExecutionLog> => {
    const rule = await getAutomationRule(ruleId);
    if (!rule) throw new Error(`Automation rule ${ruleId} not found`);

    if (!rule.enabled) {
      throw new Error(`Automation rule ${rule.name} is disabled`);
    }

    const executionId = crypto.randomUUID();
    const startTime = Date.now();
    
    const executionLog: ExecutionLog = {
      execution_id: executionId,
      started_at: new Date().toISOString(),
      status: "running",
      trigger_data: triggerData,
      action_results: [],
    };

    try {
      // Execute actions based on execution order
      if (rule.execution_order === "sequential") {
        for (const action of rule.actions) {
          const actionStartTime = Date.now();
          try {
            // Check action conditions if they exist
            if (action.condition && !evaluateConditions(action.condition, triggerData)) {
              executionLog.action_results.push({
                action_id: action.id,
                action_name: action.name,
                status: "skipped",
                execution_time_ms: Date.now() - actionStartTime,
              });
              continue;
            }

            // Simulate action execution
            const result = await executeAction(action, triggerData);
            
            executionLog.action_results.push({
              action_id: action.id,
              action_name: action.name,
              status: "success",
              result,
              execution_time_ms: Date.now() - actionStartTime,
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            executionLog.action_results.push({
              action_id: action.id,
              action_name: action.name,
              status: "failed",
              error: errorMessage,
              execution_time_ms: Date.now() - actionStartTime,
            });

            if (action.on_failure === "stop") {
              break;
            }
          }
        }
      } else {
        // Parallel execution
        const actionPromises = rule.actions.map(async (action) => {
          const actionStartTime = Date.now();
          try {
            if (action.condition && !evaluateConditions(action.condition, triggerData)) {
              return {
                action_id: action.id,
                action_name: action.name,
                status: "skipped" as const,
                execution_time_ms: Date.now() - actionStartTime,
              };
            }

            const result = await executeAction(action, triggerData);
            return {
              action_id: action.id,
              action_name: action.name,
              status: "success" as const,
              result,
              execution_time_ms: Date.now() - actionStartTime,
            };
          } catch (error) {
            return {
              action_id: action.id,
              action_name: action.name,
              status: "failed" as const,
              error: error instanceof Error ? error.message : 'Unknown error',
              execution_time_ms: Date.now() - actionStartTime,
            };
          }
        });

        executionLog.action_results = await Promise.all(actionPromises);
      }

      const totalTime = Date.now() - startTime;
      const hasFailures = executionLog.action_results.some(r => r.status === "failed");
      
      executionLog.status = hasFailures ? "failed" : "completed";
      executionLog.completed_at = new Date().toISOString();
      executionLog.total_execution_time_ms = totalTime;

      // Update rule metrics
      const updatedRule = {
        ...rule,
        execution_count: rule.execution_count + 1,
        success_count: hasFailures ? rule.success_count : rule.success_count + 1,
        failure_count: hasFailures ? rule.failure_count + 1 : rule.failure_count,
        last_executed_at: new Date().toISOString(),
        last_executed_by_user_id: userId || null,
        last_execution_duration_ms: totalTime,
        average_execution_time_ms: rule.average_execution_time_ms 
          ? (rule.average_execution_time_ms + totalTime) / 2 
          : totalTime,
        recent_executions: [executionLog, ...rule.recent_executions.slice(0, 9)], // Keep last 10
      };

      await updateAutomationRule(updatedRule, userId);

      return executionLog;
    } catch (error) {
      executionLog.status = "failed";
      executionLog.completed_at = new Date().toISOString();
      executionLog.error_message = error instanceof Error ? error.message : 'Unknown error';
      executionLog.total_execution_time_ms = Date.now() - startTime;
      
      throw error;
    }
  }, [getAutomationRule, updateAutomationRule]);

  const enableRule = useCallback(async (ruleId: string, userId: string) => {
    const rule = await getAutomationRule(ruleId);
    if (!rule) throw new Error(`Automation rule ${ruleId} not found`);

    const updated = { ...rule, enabled: true };
    await updateAutomationRule(updated, userId);
  }, [getAutomationRule, updateAutomationRule]);

  const disableRule = useCallback(async (ruleId: string, userId: string, reason?: string) => {
    const rule = await getAutomationRule(ruleId);
    if (!rule) throw new Error(`Automation rule ${ruleId} not found`);

    const updated = { 
      ...rule, 
      enabled: false,
      custom_fields: {
        ...rule.custom_fields,
        disabled_reason: reason,
        disabled_by: userId,
        disabled_at: new Date().toISOString(),
      }
    };
    await updateAutomationRule(updated, userId);
  }, [getAutomationRule, updateAutomationRule]);

  const testRule = useCallback(async (
    ruleId: string, 
    testData: any, 
    userId: string
  ): Promise<{ valid: boolean; results: any[] }> => {
    const rule = await getAutomationRule(ruleId);
    if (!rule) throw new Error(`Automation rule ${ruleId} not found`);

    try {
      // Validate trigger conditions
      const conditionsMet = evaluateConditions(rule.trigger_conditions, testData);
      
      if (!conditionsMet) {
        return { valid: false, results: ["Trigger conditions not met with test data"] };
      }

      // Test each action (dry run)
      const results = [];
      for (const action of rule.actions) {
        try {
          const actionResult = await testAction(action, testData);
          results.push({
            action_id: action.id,
            action_name: action.name,
            status: "success",
            result: actionResult,
          });
        } catch (error) {
          results.push({
            action_id: action.id,
            action_name: action.name,
            status: "failed",
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return { valid: true, results };
    } catch (error) {
      return { 
        valid: false, 
        results: [`Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      };
    }
  }, [getAutomationRule]);

  // Filtering functions
  const getRulesByType = useCallback((type: string) => {
    return automationRules.filter(r => r.type === type);
  }, [automationRules]);

  const getRulesByStatus = useCallback((status: string) => {
    return automationRules.filter(r => r.status === status);
  }, [automationRules]);

  const getRulesByTrigger = useCallback((triggerType: AutomationTrigger) => {
    return automationRules.filter(r => r.trigger_type === triggerType);
  }, [automationRules]);

  const getEnabledRules = useCallback(() => {
    return automationRules.filter(r => r.enabled);
  }, [automationRules]);

  const getRulesNeedingApproval = useCallback(() => {
    return automationRules.filter(r => 
      r.requires_approval && 
      (!r.approval_workflow || r.approval_workflow.some(step => !step.approved_at))
    );
  }, [automationRules]);

  const getRulesByBusinessService = useCallback((serviceId: string) => {
    return automationRules.filter(r => r.business_service_ids.includes(serviceId));
  }, [automationRules]);

  const getFailingRules = useCallback(() => {
    return automationRules.filter(r => {
      const failureRate = r.execution_count > 0 ? r.failure_count / r.execution_count : 0;
      return failureRate > 0.2; // More than 20% failure rate
    });
  }, [automationRules]);

  const getHighPerformingRules = useCallback(() => {
    return automationRules.filter(r => {
      const successRate = r.execution_count > 0 ? r.success_count / r.execution_count : 0;
      return r.execution_count >= 10 && successRate >= 0.95; // 95%+ success rate with at least 10 executions
    });
  }, [automationRules]);

  // Analytics
  const getRulePerformance = useCallback((ruleId: string) => {
    const rule = automationRules.find(r => r.id === ruleId);
    if (!rule) {
      return {
        successRate: 0,
        averageExecutionTime: 0,
        totalExecutions: 0,
        recentFailures: [],
        costSavings: 0,
        timeSavings: 0,
      };
    }

    const successRate = rule.execution_count > 0 ? rule.success_count / rule.execution_count : 0;
    const recentFailures = rule.recent_executions.filter(e => e.status === "failed");

    return {
      successRate,
      averageExecutionTime: rule.average_execution_time_ms || 0,
      totalExecutions: rule.execution_count,
      recentFailures,
      costSavings: rule.cost_savings_estimate || 0,
      timeSavings: rule.time_savings_estimate_minutes || 0,
    };
  }, [automationRules]);

  const getAutomationStats = useCallback(() => {
    const totalRules = automationRules.length;
    const enabledRules = automationRules.filter(r => r.enabled).length;
    const totalExecutions = automationRules.reduce((sum, r) => sum + r.execution_count, 0);
    const totalSuccesses = automationRules.reduce((sum, r) => sum + r.success_count, 0);
    const successRate = totalExecutions > 0 ? totalSuccesses / totalExecutions : 0;
    const totalCostSavings = automationRules.reduce((sum, r) => sum + (r.cost_savings_estimate || 0), 0);
    const totalTimeSavings = automationRules.reduce((sum, r) => sum + (r.time_savings_estimate_minutes || 0), 0);

    const topPerformingRules = automationRules
      .filter(r => r.execution_count >= 5)
      .map(r => ({
        ruleId: r.id,
        name: r.name,
        successRate: r.execution_count > 0 ? r.success_count / r.execution_count : 0,
      }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);

    return {
      totalRules,
      enabledRules,
      totalExecutions,
      successRate,
      totalCostSavings,
      totalTimeSavings,
      topPerformingRules,
    };
  }, [automationRules]);

  // Initialize
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshAutomationRules();
    }
  }, [tenantId, globalConfig, refreshAutomationRules]);

  return (
    <AutomationRulesContext.Provider
      value={{
        automationRules,
        addAutomationRule,
        updateAutomationRule,
        deleteAutomationRule,
        refreshAutomationRules,
        getAutomationRule,
        executeRule,
        enableRule,
        disableRule,
        testRule,
        requestApproval: async () => {}, // Placeholder
        approveRule: async () => {}, // Placeholder  
        rejectRule: async () => {}, // Placeholder
        getRulesByType,
        getRulesByStatus,
        getRulesByTrigger,
        getEnabledRules,
        getRulesNeedingApproval,
        getRulesByBusinessService,
        getFailingRules,
        getHighPerformingRules,
        getRulePerformance,
        getAutomationStats,
        config,
      }}
    >
      {children}
    </AutomationRulesContext.Provider>
  );
};

// ---------------------------------
// 4. Helper Functions
// ---------------------------------
const evaluateConditions = (conditions: TriggerCondition[], data: any): boolean => {
  return conditions.every(condition => {
    const fieldValue = getNestedValue(data, condition.field);
    
    switch (condition.operator) {
      case "equals":
        return fieldValue === condition.value;
      case "not_equals":
        return fieldValue !== condition.value;
      case "contains":
        return String(fieldValue).includes(String(condition.value));
      case "not_contains":
        return !String(fieldValue).includes(String(condition.value));
      case "greater_than":
        return Number(fieldValue) > Number(condition.value);
      case "less_than":
        return Number(fieldValue) < Number(condition.value);
      case "in":
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      case "not_in":
        return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
      case "exists":
        return fieldValue !== undefined && fieldValue !== null;
      case "not_exists":
        return fieldValue === undefined || fieldValue === null;
      case "regex":
        return new RegExp(condition.value, condition.case_sensitive ? 'g' : 'gi').test(String(fieldValue));
      default:
        return false;
    }
  });
};

const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((current, key) => current?.[key], obj);
};

const executeAction = async (action: AutomationAction, data: any): Promise<any> => {
  // Simulate action execution based on type
  await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 200));
  
  switch (action.type) {
    case "assign":
      return { assigned_to: action.parameters.user_id, assigned_at: new Date().toISOString() };
    case "notify":
      return { notification_sent: true, recipients: action.parameters.recipients };
    case "create_entity":
      return { created_id: crypto.randomUUID(), entity_type: action.parameters.entity_type };
    case "execute_script":
      return { exit_code: 0, output: "Script executed successfully" };
    default:
      return { status: "completed", action_type: action.type };
  }
};

const testAction = async (action: AutomationAction, data: any): Promise<any> => {
  // Dry run simulation
  return { test_result: "success", would_execute: action.type, with_data: data };
};

// ---------------------------------
// 5. Hooks
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

// Utility hooks
export const useEnabledAutomationRules = () => {
  const { getEnabledRules } = useAutomationRules();
  return getEnabledRules();
};

export const useAutomationRulesByTrigger = (triggerType: AutomationTrigger) => {
  const { getRulesByTrigger } = useAutomationRules();
  return getRulesByTrigger(triggerType);
};

export const useAutomationStats = () => {
  const { getAutomationStats } = useAutomationRules();
  return getAutomationStats();
};

export const useRulePerformance = (ruleId: string) => {
  const { getRulePerformance } = useAutomationRules();
  return getRulePerformance(ruleId);
};