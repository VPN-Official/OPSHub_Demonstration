// src/contexts/PolicyContext.tsx - REFACTORED FOR FRONTEND-ONLY PATTERNS
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
import { 
  getAll,
  getById,
  putWithAudit,
  removeWithAudit,
} from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";
import { ExternalSystemFields } from "../types/externalSystem";

// ---------------------------------
// 1. Frontend State Management Types
// ---------------------------------

/**
 * Generic async state interface for managing API operations
 */


/**
 * Cache configuration for UI performance optimization
 */
interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of cached items
}

// ---------------------------------
// 2. Core Policy Types (UI-focused)
// ---------------------------------

export type PolicyType =
  | "security"
  | "compliance"
  | "governance"
  | "operations"
  | "financial"
  | "data"
  | "privacy"
  | "access_control"
  | "incident_response"
  | "change_management"
  | "other";

export type PolicyStatus = 
  | "draft" 
  | "review" 
  | "approved" 
  | "published" 
  | "retired" 
  | "suspended";

export type EnforcementMode = 
  | "monitor" 
  | "enforce" 
  | "exception_based" 
  | "advisory";

export interface PolicyViolation {
  id: string;
  detected_at: string;
  severity: "low" | "medium" | "high" | "critical";
  violation_type: string;
  description: string;
  entity_type?: string;
  entity_id?: string;
  remediation_required: boolean;
  resolved_at?: string | null;
  resolved_by?: string | null;
}

export interface PolicyControl {
  id: string;
  name: string;
  description: string;
  control_type: "preventive" | "detective" | "corrective" | "directive";
  automation_rule_id?: string | null;
  testing_frequency?: "weekly" | "monthly" | "quarterly" | "annually";
  last_tested_at?: string | null;
  test_results?: "pass" | "fail" | "needs_review";
}

export interface Policy extends ExternalSystemFields {
  id: string;
  name: string;
  description?: string;
  type: PolicyType;
  status: PolicyStatus;
  version: string;
  created_at: string;
  updated_at: string;
  effective_date: string;
  review_date: string;
  expiry_date?: string | null;

  // Ownership and governance
  policy_owner_user_id: string;
  policy_owner_team_id?: string | null;
  approver_user_ids: string[];
  reviewer_user_ids: string[];

  // Scope and applicability
  business_service_ids: string[];
  asset_ids: string[];
  vendor_ids: string[];
  contract_ids: string[];
  compliance_requirement_ids: string[];
  applies_to_user_roles: string[];
  geographic_scope?: string[];

  // Policy content and controls
  policy_statement: string;
  controls: PolicyControl[];
  procedures: Array<{
    id: string;
    name: string;
    description: string;
    runbook_id?: string | null;
    automation_rule_id?: string | null;
  }>;

  // Enforcement and monitoring
  enforcement_mode: EnforcementMode;
  exception_process?: string;
  monitoring_enabled: boolean;
  automated_enforcement: boolean;
  violation_threshold?: number;

  // Related entities
  related_runbook_ids: string[];
  related_automation_rule_ids: string[];
  related_policy_ids: string[];
  superseded_policy_ids: string[];

  // Metrics (provided by backend)
  compliance_score?: number;
  violations: PolicyViolation[];
  violations_count: number;
  last_reviewed_at?: string | null;
  last_reviewed_by?: string | null;
  next_review_due: string;
  review_frequency: "monthly" | "quarterly" | "semi_annual" | "annual";

  // Training and awareness
  training_required: boolean;
  training_content?: string;
  training_completion_required: boolean;
  acknowledgment_required: boolean;
  acknowledged_by_user_ids: string[];

  // Audit and history
  change_history: Array<{
    version: string;
    changed_at: string;
    changed_by: string;
    change_reason: string;
    changes_summary: string;
  }>;

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  // synced_at and sync_status inherited from ExternalSystemFields
  tenantId?: string;
}

export interface PolicyUIFilters {
  type?: PolicyType;
  status?: PolicyStatus;
  enforcement_mode?: EnforcementMode;
  policy_owner_user_id?: string;
  tags?: string[];
  needs_review?: boolean;
  has_violations?: boolean;
  // External system filtering
  sourceSystems?: string[];
  syncStatus?: ('synced' | 'syncing' | 'error' | 'conflict')[];
  hasConflicts?: boolean;
  hasLocalChanges?: boolean;
  dataCompleteness?: { min: number; max: number };
}

// ---------------------------------
// 3. UI-Focused Operations Interface
// ---------------------------------

/**
 * Policy operations with optimistic UI and error handling
 */
interface PolicyOperations {
  // Basic CRUD with optimistic updates
  create: (policy: Omit<Policy, 'id' | 'created_at' | 'updated_at'>, userId?: string) => Promise<void>;
  update: (policyId: string, updates: Partial<Policy>, userId?: string) => Promise<void>;
  delete: (policyId: string, userId?: string) => Promise<void>;
  
  // Lifecycle operations (backend handles all business logic)
  submitForReview: (policyId: string, userId: string) => Promise<void>;
  approvePolicy: (policyId: string, approverId: string, comments?: string) => Promise<void>;
  rejectPolicy: (policyId: string, reviewerId: string, reason: string) => Promise<void>;
  publishPolicy: (policyId: string, publisherId: string) => Promise<void>;
  retirePolicy: (policyId: string, retiredBy: string, reason: string) => Promise<void>;
  createNewVersion: (policyId: string, changes: Partial<Policy>, userId: string) => Promise<string>;
  
  // User interactions
  acknowledgePolicy: (policyId: string, userId: string) => Promise<void>;
  reportViolation: (policyId: string, violation: Omit<PolicyViolation, 'id'>, reportedBy: string) => Promise<void>;
  resolveViolation: (policyId: string, violationId: string, resolvedBy: string, resolution: string) => Promise<void>;
}

/**
 * Client-side filtering and search for immediate UI responsiveness
 */
interface PolicyUIHelpers {
  // Simple client-side filters (not business logic)
  filterByType: (policies: Policy[], type: PolicyType) => Policy[];
  filterByStatus: (policies: Policy[], status: PolicyStatus) => Policy[];
  filterByTags: (policies: Policy[], tags: string[]) => Policy[];
  
  // Basic search for UI responsiveness
  searchPolicies: (policies: Policy[], query: string) => Policy[];
  
  // UI-specific grouping
  groupByStatus: (policies: Policy[]) => Record<PolicyStatus, Policy[]>;
  groupByType: (policies: Policy[]) => Record<PolicyType, Policy[]>;
}

// ---------------------------------
// 4. Frontend Context Interface
// ---------------------------------

interface PolicyContextType {
  // Async state management
  policiesState: AsyncState<Policy[]>;
  operationState: AsyncState<any>;
  
  // Data access
  policies: Policy[];
  getPolicyById: (id: string) => Policy | undefined;
  
  // API operations with optimistic updates
  operations: PolicyOperations;
  
  // UI helpers for immediate responsiveness
  helpers: PolicyUIHelpers;
  
  // Cache and performance
  refreshPolicies: () => Promise<void>;
  invalidateCache: () => void;
  
  // Config from backend
  config: {
    types: string[];
    statuses: string[];
    enforcement_modes: string[];
    review_frequencies: string[];
    violation_severities: string[];
    control_types: string[];
  };
  
  // Analytics (display backend-calculated data only)
  analytics: {
    totalPolicies: number;
    activePolicies: number;
    averageComplianceScore: number;
    totalViolations: number;
    criticalViolations: number;
    policiesNeedingReview: number;
  };
}

const PolicyContext = createContext<PolicyContextType | undefined>(undefined);

// ---------------------------------
// 5. Frontend Provider Implementation
// ---------------------------------

const CACHE_CONFIG: CacheConfig = {
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 1000, // Max 1000 policies in cache
};

export const PolicyProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();

  // ---------------------------------
  // State Management
  // ---------------------------------
  
  const [policiesState, setPoliciesState] = useState<AsyncState<Policy[]>>({
    data: null,
    loading: false,
    error: null,
    lastFetch: null,
    stale: true,
  });

  const [operationState, setOperationState] = useState<AsyncState<any>>({
    data: null,
    loading: false,
    error: null,
    lastFetch: null,
    stale: false,
  });

  // Optimistic updates cache
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, Partial<Policy>>>(new Map());

  // ---------------------------------
  // Configuration
  // ---------------------------------
  
  const config = useMemo(() => ({
    types: globalConfig?.policies?.types || [
      "security", "compliance", "governance", "operations", "financial", "data", "privacy", 
      "access_control", "incident_response", "change_management", "other"
    ],
    statuses: globalConfig?.policies?.statuses || [
      "draft", "review", "approved", "published", "retired", "suspended"
    ],
    enforcement_modes: globalConfig?.policies?.enforcement_modes || [
      "monitor", "enforce", "exception_based", "advisory"
    ],
    review_frequencies: globalConfig?.policies?.review_frequencies || [
      "monthly", "quarterly", "semi_annual", "annual"
    ],
    violation_severities: globalConfig?.policies?.violation_severities || [
      "low", "medium", "high", "critical"
    ],
    control_types: globalConfig?.policies?.control_types || [
      "preventive", "detective", "corrective", "directive"
    ],
  }), [globalConfig]);

  // ---------------------------------
  // Data Access with Optimistic Updates
  // ---------------------------------
  
  const policies = useMemo(() => {
    const basePolicies = policiesState.data || [];
    
    // Apply optimistic updates
    return basePolicies.map(policy => {
      const optimisticUpdate = optimisticUpdates.get(policy.id);
      return optimisticUpdate ? { ...policy, ...optimisticUpdate } : policy;
    });
  }, [policiesState.data, optimisticUpdates]);

  const getPolicyById = useCallback((id: string): Policy | undefined => {
    return policies.find(p => p.id === id);
  }, [policies]);

  // ---------------------------------
  // Cache Management
  // ---------------------------------
  
  const isCacheStale = useCallback(() => {
    if (!policiesState.lastFetch) return true;
    const age = Date.now() - new Date(policiesState.lastFetch).getTime();
    return age > CACHE_CONFIG.ttl;
  }, [policiesState.lastFetch]);

  const invalidateCache = useCallback(() => {
    setPoliciesState(prev => ({ ...prev, stale: true }));
  }, []);

  // ---------------------------------
  // API Operations with Error Handling
  // ---------------------------------
  
  const refreshPolicies = useCallback(async () => {
    if (!tenantId) return;

    setPoliciesState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const fetchedPolicies = await getAll<Policy>(tenantId, "policies");
      
      setPoliciesState({
        data: fetchedPolicies,
        loading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        stale: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch policies';
      setPoliciesState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
        stale: true,
      }));
    }
  }, [tenantId]);

  // ---------------------------------
  // Operations with Optimistic Updates
  // ---------------------------------
  
  const operations: PolicyOperations = useMemo(() => ({
    create: async (policyData, userId) => {
      if (!tenantId) throw new Error("No tenant selected");

      // Basic UI validation only
      if (!policyData.name?.trim()) {
        throw new Error("Policy name is required");
      }

      setOperationState(prev => ({ ...prev, loading: true, error: null }));

      const newPolicy: Policy = {
        ...policyData,
        id: `temp_${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        violations: [],
        violations_count: 0,
        health_status: "green",
        sync_status: "syncing",
        acknowledged_by_user_ids: [],
        change_history: [],
        tenantId,
      };

      try {
        // Optimistic update
        setPoliciesState(prev => ({
          ...prev,
          data: prev.data ? [...prev.data, newPolicy] : [newPolicy],
        }));

        // Backend call (handles ALL validation and business logic)
        await putWithAudit(
          tenantId,
          "policies",
          newPolicy,
          userId,
          { action: "create", description: `Policy "${policyData.name}" created` },
          enqueueItem
        );

        await refreshPolicies();
        setOperationState(prev => ({ ...prev, loading: false }));
      } catch (error) {
        // Rollback optimistic update
        setPoliciesState(prev => ({
          ...prev,
          data: prev.data?.filter(p => p.id !== newPolicy.id) || [],
        }));

        const errorMessage = error instanceof Error ? error.message : 'Failed to create policy';
        setOperationState(prev => ({ ...prev, loading: false, error: errorMessage }));
        throw error;
      }
    },

    update: async (policyId, updates, userId) => {
      if (!tenantId) throw new Error("No tenant selected");

      const existingPolicy = getPolicyById(policyId);
      if (!existingPolicy) throw new Error("Policy not found");

      setOperationState(prev => ({ ...prev, loading: true, error: null }));

      try {
        // Optimistic update
        setOptimisticUpdates(prev => new Map(prev.set(policyId, {
          ...updates,
          updated_at: new Date().toISOString(),
        })));

        const updatedPolicy = { ...existingPolicy, ...updates, updated_at: new Date().toISOString() };

        // Backend call
        await putWithAudit(
          tenantId,
          "policies",
          updatedPolicy,
          userId,
          { action: "update", description: `Policy "${existingPolicy.name}" updated` },
          enqueueItem
        );

        // Clear optimistic update and refresh
        setOptimisticUpdates(prev => {
          const newMap = new Map(prev);
          newMap.delete(policyId);
          return newMap;
        });

        await refreshPolicies();
        setOperationState(prev => ({ ...prev, loading: false }));
      } catch (error) {
        // Rollback optimistic update
        setOptimisticUpdates(prev => {
          const newMap = new Map(prev);
          newMap.delete(policyId);
          return newMap;
        });

        const errorMessage = error instanceof Error ? error.message : 'Failed to update policy';
        setOperationState(prev => ({ ...prev, loading: false, error: errorMessage }));
        throw error;
      }
    },

    delete: async (policyId, userId) => {
      if (!tenantId) throw new Error("No tenant selected");

      const existingPolicy = getPolicyById(policyId);
      if (!existingPolicy) throw new Error("Policy not found");

      setOperationState(prev => ({ ...prev, loading: true, error: null }));

      try {
        // Optimistic update
        setPoliciesState(prev => ({
          ...prev,
          data: prev.data?.filter(p => p.id !== policyId) || [],
        }));

        // Backend call
        await removeWithAudit(
          tenantId,
          "policies",
          policyId,
          userId,
          { action: "delete", description: `Policy "${existingPolicy.name}" deleted` },
          enqueueItem
        );

        await refreshPolicies();
        setOperationState(prev => ({ ...prev, loading: false }));
      } catch (error) {
        // Rollback optimistic update
        await refreshPolicies();

        const errorMessage = error instanceof Error ? error.message : 'Failed to delete policy';
        setOperationState(prev => ({ ...prev, loading: false, error: errorMessage }));
        throw error;
      }
    },

    // All lifecycle operations delegate to backend API
    submitForReview: async (policyId, userId) => {
      return operations.update(policyId, { status: "review" }, userId);
    },

    approvePolicy: async (policyId, approverId, comments) => {
      return operations.update(policyId, { status: "approved" }, approverId);
    },

    rejectPolicy: async (policyId, reviewerId, reason) => {
      return operations.update(policyId, { status: "draft" }, reviewerId);
    },

    publishPolicy: async (policyId, publisherId) => {
      return operations.update(policyId, { 
        status: "published",
        effective_date: new Date().toISOString()
      }, publisherId);
    },

    retirePolicy: async (policyId, retiredBy, reason) => {
      return operations.update(policyId, { 
        status: "retired",
        expiry_date: new Date().toISOString()
      }, retiredBy);
    },

    createNewVersion: async (policyId, changes, userId) => {
      const originalPolicy = getPolicyById(policyId);
      if (!originalPolicy) throw new Error("Original policy not found");

      const [major, minor] = originalPolicy.version.split('.').map(Number);
      const newVersion = `${major}.${minor + 1}`;
      
      const newPolicyData = {
        ...originalPolicy,
        ...changes,
        version: newVersion,
        status: "draft" as PolicyStatus,
      };

      await operations.create(newPolicyData, userId);
      return `${originalPolicy.id}_v${newVersion}`;
    },

    acknowledgePolicy: async (policyId, userId) => {
      const policy = getPolicyById(policyId);
      if (!policy) throw new Error("Policy not found");

      const updatedAcknowledgments = [...new Set([...policy.acknowledged_by_user_ids, userId])];
      return operations.update(policyId, { acknowledged_by_user_ids: updatedAcknowledgments }, userId);
    },

    reportViolation: async (policyId, violation, reportedBy) => {
      // Backend API call - no client-side business logic
      // This would typically be a separate API endpoint
      return operations.update(policyId, {}, reportedBy);
    },

    resolveViolation: async (policyId, violationId, resolvedBy, resolution) => {
      // Backend API call - no client-side business logic
      return operations.update(policyId, {}, resolvedBy);
    },
  }), [tenantId, getPolicyById, enqueueItem, refreshPolicies]);

  // ---------------------------------
  // UI Helpers (Client-side only)
  // ---------------------------------
  
  const helpers: PolicyUIHelpers = useMemo(() => ({
    filterByType: (policies, type) => policies.filter(p => p.type === type),
    filterByStatus: (policies, status) => policies.filter(p => p.status === status),
    filterByTags: (policies, tags) => policies.filter(p => 
      tags.some(tag => p.tags.includes(tag))
    ),
    
    searchPolicies: (policies, query) => {
      const lowerQuery = query.toLowerCase();
      return policies.filter(p => 
        p.name.toLowerCase().includes(lowerQuery) ||
        p.description?.toLowerCase().includes(lowerQuery) ||
        p.policy_statement.toLowerCase().includes(lowerQuery) ||
        p.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    },
    
    groupByStatus: (policies) => {
      return policies.reduce((acc, policy) => {
        const status = policy.status;
        if (!acc[status]) acc[status] = [];
        acc[status].push(policy);
        return acc;
      }, {} as Record<PolicyStatus, Policy[]>);
    },
    
    groupByType: (policies) => {
      return policies.reduce((acc, policy) => {
        const type = policy.type;
        if (!acc[type]) acc[type] = [];
        acc[type].push(policy);
        return acc;
      }, {} as Record<PolicyType, Policy[]>);
    },
  }), []);

  // ---------------------------------
  // Analytics (Display Backend Data)
  // ---------------------------------
  
  const analytics = useMemo(() => {
    const totalPolicies = policies.length;
    const activePolicies = policies.filter(p => p.status === 'published').length;
    const totalViolations = policies.reduce((sum, p) => sum + p.violations_count, 0);
    const criticalViolations = policies.reduce((sum, p) => 
      sum + p.violations.filter(v => v.severity === 'critical').length, 0);
    const averageComplianceScore = policies.length > 0 
      ? policies.reduce((sum, p) => sum + (p.compliance_score || 0), 0) / policies.length 
      : 0;
    const policiesNeedingReview = policies.filter(p => 
      p.next_review_due <= new Date().toISOString()
    ).length;

    return {
      totalPolicies,
      activePolicies,
      averageComplianceScore,
      totalViolations,
      criticalViolations,
      policiesNeedingReview,
    };
  }, [policies]);

  // ---------------------------------
  // Auto-refresh Logic
  // ---------------------------------
  
  useEffect(() => {
    if (tenantId && globalConfig && (policies.length === 0 || isCacheStale())) {
      refreshPolicies();
    }
  }, [tenantId, globalConfig, refreshPolicies, isCacheStale]);

  // Cleanup optimistic updates on unmount
  useEffect(() => {
    return () => {
      setOptimisticUpdates(new Map());
    };
  }, []);

  // ---------------------------------
  // Context Value
  // ---------------------------------
  
  const contextValue: PolicyContextType = useMemo(() => ({
    policiesState,
    operationState,
    policies,
    getPolicyById,
    operations,
    helpers,
    refreshPolicies,
    invalidateCache,
    config,
    analytics,
  }), [
    policiesState,
    operationState,
    policies,
    getPolicyById,
    operations,
    helpers,
    refreshPolicies,
    invalidateCache,
    config,
    analytics,
  ]);

  return (
    <PolicyContext.Provider value={contextValue}>
      {children}
    </PolicyContext.Provider>
  );
};

// ---------------------------------
// 6. Hooks
// ---------------------------------

/**
 * Main hook for accessing policy context
 */
export const usePolicies = () => {
  const ctx = useContext(PolicyContext);
  if (!ctx) throw new Error("usePolicies must be used within PolicyProvider");
  return ctx;
};

/**
 * Hook for accessing a specific policy with loading state
 */
export const usePolicyDetails = (id: string) => {
  const { getPolicyById, policiesState } = usePolicies();
  
  return useMemo(() => ({
    policy: getPolicyById(id),
    loading: policiesState.loading,
    error: policiesState.error,
  }), [getPolicyById, id, policiesState.loading, policiesState.error]);
};

/**
 * Hook for filtered policies with client-side responsiveness
 */
export const usePoliciesByStatus = (status: PolicyStatus) => {
  const { policies, helpers, policiesState } = usePolicies();
  
  return useMemo(() => ({
    policies: helpers.filterByStatus(policies, status),
    loading: policiesState.loading,
    error: policiesState.error,
  }), [policies, helpers, status, policiesState.loading, policiesState.error]);
};

/**
 * Hook for policy search with immediate UI feedback
 */
export const usePolicySearch = (query: string) => {
  const { policies, helpers, policiesState } = usePolicies();
  
  return useMemo(() => ({
    results: query.trim() ? helpers.searchPolicies(policies, query.trim()) : policies,
    loading: policiesState.loading,
    error: policiesState.error,
  }), [policies, helpers, query, policiesState.loading, policiesState.error]);
};

/**
 * Hook for policy analytics
 */
export const usePolicyAnalytics = () => {
  const { analytics, policiesState } = usePolicies();
  
  return useMemo(() => ({
    ...analytics,
    loading: policiesState.loading,
    error: policiesState.error,
  }), [analytics, policiesState.loading, policiesState.error]);
};