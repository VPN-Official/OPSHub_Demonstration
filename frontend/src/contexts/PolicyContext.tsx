// src/contexts/PolicyContext.tsx
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

export interface Policy {
  id: string;
  name: string;                        // "Password Rotation Policy"
  description?: string;
  type: PolicyType;
  status: PolicyStatus;
  version: string;                     // "1.0", "2.1", etc.
  created_at: string;
  updated_at: string;
  effective_date: string;
  review_date: string;
  expiry_date?: string | null;

  // Ownership and governance
  policy_owner_user_id: string;        // FK → UsersContext (required)
  policy_owner_team_id?: string | null; // FK → TeamsContext
  approver_user_ids: string[];         // FK → UsersContext (who can approve)
  reviewer_user_ids: string[];         // FK → UsersContext (who reviews)

  // Scope and applicability
  business_service_ids: string[];      // FK → BusinessServicesContext
  asset_ids: string[];                 // FK → AssetsContext
  vendor_ids: string[];                // FK → VendorsContext
  contract_ids: string[];              // FK → ContractsContext
  compliance_requirement_ids: string[];// FK → ComplianceContext
  applies_to_user_roles: string[];     // Which user roles this applies to
  geographic_scope?: string[];         // Countries/regions where this applies

  // Policy content and controls
  policy_statement: string;            // The actual policy text
  controls: PolicyControl[];           // Implementing controls
  procedures: Array<{
    id: string;
    name: string;
    description: string;
    runbook_id?: string | null;
    automation_rule_id?: string | null;
  }>;

  // Enforcement and monitoring
  enforcement_mode: EnforcementMode;
  exception_process?: string;          // How to request exceptions
  monitoring_enabled: boolean;
  automated_enforcement: boolean;
  violation_threshold?: number;        // How many violations before escalation

  // Related entities
  related_runbook_ids: string[];       // FK → RunbooksContext
  related_automation_rule_ids: string[]; // FK → AutomationRulesContext
  related_policy_ids: string[];        // Related/dependent policies
  superseded_policy_ids: string[];     // Policies this one replaces

  // Metrics and compliance
  compliance_score?: number;           // 0–100%
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
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
  tenantId?: string;
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------
interface PolicyContextType {
  policies: Policy[];
  addPolicy: (policy: Policy, userId?: string) => Promise<void>;
  updatePolicy: (policy: Policy, userId?: string) => Promise<void>;
  deletePolicy: (id: string, userId?: string) => Promise<void>;
  refreshPolicies: () => Promise<void>;
  getPolicy: (id: string) => Promise<Policy | undefined>;

  // Policy-specific operations
  submitForReview: (policyId: string, submitterId: string) => Promise<void>;
  approvePolicy: (policyId: string, approverId: string, comments?: string) => Promise<void>;
  rejectPolicy: (policyId: string, reviewerId: string, reason: string) => Promise<void>;
  publishPolicy: (policyId: string, publisherId: string) => Promise<void>;
  retirePolicy: (policyId: string, retiredBy: string, reason: string) => Promise<void>;
  createNewVersion: (policyId: string, changes: Partial<Policy>, userId: string) => Promise<string>;
  acknowledgePolicy: (policyId: string, userId: string) => Promise<void>;
  reportViolation: (policyId: string, violation: Omit<PolicyViolation, 'id'>, reportedBy: string) => Promise<void>;
  resolveViolation: (policyId: string, violationId: string, resolvedBy: string, resolution: string) => Promise<void>;

  // Filtering and querying
  getPoliciesByType: (type: PolicyType) => Policy[];
  getPoliciesByStatus: (status: PolicyStatus) => Policy[];
  getPoliciesByOwner: (ownerId: string) => Policy[];
  getPoliciesByBusinessService: (serviceId: string) => Policy[];
  getPoliciesRequiringReview: () => Policy[];
  getPoliciesNearExpiry: (daysAhead?: number) => Policy[];
  getPolicyViolations: (severity?: PolicyViolation['severity']) => PolicyViolation[];
  searchPolicies: (query: string) => Policy[];

  // Analytics and reporting
  getPolicyComplianceStats: () => {
    totalPolicies: number;
    activesPolicies: number;
    averageComplianceScore: number;
    totalViolations: number;
    criticalViolations: number;
    policiesNeedingReview: number;
  };

  // Config integration
  config: {
    types: string[];
    statuses: string[];
    enforcement_modes: string[];
    review_frequencies: string[];
    violation_severities: string[];
    control_types: string[];
  };
}

const PolicyContext = createContext<PolicyContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const PolicyProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();
  const [policies, setPolicies] = useState<Policy[]>([]);

  const config = {
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
  };

  const refreshPolicies = useCallback(async () => {
    if (!tenantId) return;
    try {
      const all = await getAll<Policy>(tenantId, "policies");
      setPolicies(all);
    } catch (error) {
      console.error("Failed to refresh policies:", error);
    }
  }, [tenantId]);

  const getPolicy = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    return getById<Policy>(tenantId, "policies", id);
  }, [tenantId]);

  const addPolicy = useCallback(async (policy: Policy, userId?: string) => {
    if (!tenantId) return;

    // ✅ Config validation
    if (!config.types.includes(policy.type)) {
      throw new Error(`Invalid policy type: ${policy.type}`);
    }
    if (!config.statuses.includes(policy.status)) {
      throw new Error(`Invalid policy status: ${policy.status}`);
    }
    if (!config.enforcement_modes.includes(policy.enforcement_mode)) {
      throw new Error(`Invalid enforcement mode: ${policy.enforcement_mode}`);
    }
    if (!config.review_frequencies.includes(policy.review_frequency)) {
      throw new Error(`Invalid review frequency: ${policy.review_frequency}`);
    }

    const enrichedPolicy: Policy = {
      ...policy,
      created_at: policy.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: policy.version || "1.0",
      violations_count: policy.violations?.length || 0,
      health_status: policy.health_status || "green",
      sync_status: "dirty",
      change_history: policy.change_history || [],
      acknowledged_by_user_ids: policy.acknowledged_by_user_ids || [],
      tenantId,
    };

    await putWithAudit(
      tenantId,
      "policies",
      enrichedPolicy,
      userId,
      { action: "create", description: `Policy "${policy.name}" created` },
      enqueueItem
    );
    await refreshPolicies();
  }, [tenantId, config, enqueueItem, refreshPolicies]);

  const updatePolicy = useCallback(async (policy: Policy, userId?: string) => {
    if (!tenantId) return;

    // ✅ Config validation
    if (!config.types.includes(policy.type)) {
      throw new Error(`Invalid policy type: ${policy.type}`);
    }
    if (!config.statuses.includes(policy.status)) {
      throw new Error(`Invalid policy status: ${policy.status}`);
    }

    const enrichedPolicy: Policy = {
      ...policy,
      updated_at: new Date().toISOString(),
      violations_count: policy.violations?.length || 0,
      sync_status: "dirty",
      tenantId,
    };

    await putWithAudit(
      tenantId,
      "policies",
      enrichedPolicy,
      userId,
      { action: "update", description: `Policy "${policy.name}" updated` },
      enqueueItem
    );
    await refreshPolicies();
  }, [tenantId, config, enqueueItem, refreshPolicies]);

  const deletePolicy = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) return;

    const policy = await getPolicy(id);
    const policyName = policy?.name || id;

    await removeWithAudit(
      tenantId,
      "policies",
      id,
      userId,
      { action: "delete", description: `Policy "${policyName}" deleted` },
      enqueueItem
    );
    await refreshPolicies();
  }, [tenantId, getPolicy, enqueueItem, refreshPolicies]);

  // Policy lifecycle operations
  const submitForReview = useCallback(async (policyId: string, submitterId: string) => {
    const policy = await getPolicy(policyId);
    if (!policy) return;

    const updatedPolicy = { 
      ...policy, 
      status: "review" as PolicyStatus,
      updated_at: new Date().toISOString(),
      change_history: [
        ...policy.change_history,
        {
          version: policy.version,
          changed_at: new Date().toISOString(),
          changed_by: submitterId,
          change_reason: "Submitted for review",
          changes_summary: "Policy status changed to review"
        }
      ]
    };
    
    await updatePolicy(updatedPolicy, submitterId);
  }, [getPolicy, updatePolicy]);

  const approvePolicy = useCallback(async (policyId: string, approverId: string, comments?: string) => {
    const policy = await getPolicy(policyId);
    if (!policy) return;

    const updatedPolicy = { 
      ...policy, 
      status: "approved" as PolicyStatus,
      updated_at: new Date().toISOString(),
      change_history: [
        ...policy.change_history,
        {
          version: policy.version,
          changed_at: new Date().toISOString(),
          changed_by: approverId,
          change_reason: "Policy approved",
          changes_summary: comments || "Policy approved for publication"
        }
      ]
    };
    
    await updatePolicy(updatedPolicy, approverId);
  }, [getPolicy, updatePolicy]);

  const rejectPolicy = useCallback(async (policyId: string, reviewerId: string, reason: string) => {
    const policy = await getPolicy(policyId);
    if (!policy) return;

    const updatedPolicy = { 
      ...policy, 
      status: "draft" as PolicyStatus,
      updated_at: new Date().toISOString(),
      change_history: [
        ...policy.change_history,
        {
          version: policy.version,
          changed_at: new Date().toISOString(),
          changed_by: reviewerId,
          change_reason: "Policy rejected",
          changes_summary: reason
        }
      ]
    };
    
    await updatePolicy(updatedPolicy, reviewerId);
  }, [getPolicy, updatePolicy]);

  const publishPolicy = useCallback(async (policyId: string, publisherId: string) => {
    const policy = await getPolicy(policyId);
    if (!policy) return;

    const updatedPolicy = { 
      ...policy, 
      status: "published" as PolicyStatus,
      effective_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      change_history: [
        ...policy.change_history,
        {
          version: policy.version,
          changed_at: new Date().toISOString(),
          changed_by: publisherId,
          change_reason: "Policy published",
          changes_summary: "Policy is now in effect"
        }
      ]
    };
    
    await updatePolicy(updatedPolicy, publisherId);
  }, [getPolicy, updatePolicy]);

  const retirePolicy = useCallback(async (policyId: string, retiredBy: string, reason: string) => {
    const policy = await getPolicy(policyId);
    if (!policy) return;

    const updatedPolicy = { 
      ...policy, 
      status: "retired" as PolicyStatus,
      expiry_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      change_history: [
        ...policy.change_history,
        {
          version: policy.version,
          changed_at: new Date().toISOString(),
          changed_by: retiredBy,
          change_reason: "Policy retired",
          changes_summary: reason
        }
      ]
    };
    
    await updatePolicy(updatedPolicy, retiredBy);
  }, [getPolicy, updatePolicy]);

  const createNewVersion = useCallback(async (policyId: string, changes: Partial<Policy>, userId: string): Promise<string> => {
    const originalPolicy = await getPolicy(policyId);
    if (!originalPolicy) throw new Error("Original policy not found");

    // Create new version
    const [major, minor] = originalPolicy.version.split('.').map(Number);
    const newVersion = `${major}.${minor + 1}`;
    
    const newPolicy: Policy = {
      ...originalPolicy,
      ...changes,
      id: `${originalPolicy.id}_v${newVersion}`,
      version: newVersion,
      status: "draft",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      change_history: [
        ...originalPolicy.change_history,
        {
          version: newVersion,
          changed_at: new Date().toISOString(),
          changed_by: userId,
          change_reason: "New version created",
          changes_summary: "New policy version created from previous version"
        }
      ]
    };

    await addPolicy(newPolicy, userId);
    return newPolicy.id;
  }, [getPolicy, addPolicy]);

  const acknowledgePolicy = useCallback(async (policyId: string, userId: string) => {
    const policy = await getPolicy(policyId);
    if (!policy) return;

    const updatedAcknowledgments = [...new Set([...policy.acknowledged_by_user_ids, userId])];
    const updatedPolicy = { 
      ...policy, 
      acknowledged_by_user_ids: updatedAcknowledgments,
      updated_at: new Date().toISOString() 
    };
    
    await updatePolicy(updatedPolicy, userId);
  }, [getPolicy, updatePolicy]);

  const reportViolation = useCallback(async (policyId: string, violation: Omit<PolicyViolation, 'id'>, reportedBy: string) => {
    const policy = await getPolicy(policyId);
    if (!policy) return;

    const newViolation: PolicyViolation = {
      ...violation,
      id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      detected_at: new Date().toISOString(),
    };

    const updatedViolations = [...policy.violations, newViolation];
    const updatedPolicy = { 
      ...policy, 
      violations: updatedViolations,
      violations_count: updatedViolations.length,
      updated_at: new Date().toISOString() 
    };
    
    await updatePolicy(updatedPolicy, reportedBy);
  }, [getPolicy, updatePolicy]);

  const resolveViolation = useCallback(async (policyId: string, violationId: string, resolvedBy: string, resolution: string) => {
    const policy = await getPolicy(policyId);
    if (!policy) return;

    const updatedViolations = policy.violations.map(v => 
      v.id === violationId 
        ? { ...v, resolved_at: new Date().toISOString(), resolved_by: resolvedBy, description: `${v.description} - Resolution: ${resolution}` }
        : v
    );

    const updatedPolicy = { 
      ...policy, 
      violations: updatedViolations,
      updated_at: new Date().toISOString() 
    };
    
    await updatePolicy(updatedPolicy, resolvedBy);
  }, [getPolicy, updatePolicy]);

  // Filtering functions
  const getPoliciesByType = useCallback((type: PolicyType) => {
    return policies.filter(p => p.type === type);
  }, [policies]);

  const getPoliciesByStatus = useCallback((status: PolicyStatus) => {
    return policies.filter(p => p.status === status);
  }, [policies]);

  const getPoliciesByOwner = useCallback((ownerId: string) => {
    return policies.filter(p => p.policy_owner_user_id === ownerId);
  }, [policies]);

  const getPoliciesByBusinessService = useCallback((serviceId: string) => {
    return policies.filter(p => p.business_service_ids.includes(serviceId));
  }, [policies]);

  const getPoliciesRequiringReview = useCallback(() => {
    const now = new Date().toISOString();
    return policies.filter(p => p.next_review_due <= now);
  }, [policies]);

  const getPoliciesNearExpiry = useCallback((daysAhead: number = 30) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);
    const cutoffISO = cutoffDate.toISOString();
    
    return policies.filter(p => 
      p.expiry_date && p.expiry_date <= cutoffISO
    );
  }, [policies]);

  const getPolicyViolations = useCallback((severity?: PolicyViolation['severity']) => {
    const allViolations = policies.flatMap(p => p.violations);
    return severity 
      ? allViolations.filter(v => v.severity === severity)
      : allViolations;
  }, [policies]);

  const searchPolicies = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return policies.filter(p => 
      p.name.toLowerCase().includes(lowerQuery) ||
      p.description?.toLowerCase().includes(lowerQuery) ||
      p.policy_statement.toLowerCase().includes(lowerQuery) ||
      p.type.toLowerCase().includes(lowerQuery) ||
      p.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }, [policies]);

  const getPolicyComplianceStats = useCallback(() => {
    const totalPolicies = policies.length;
    const activePolicies = policies.filter(p => p.status === 'published').length;
    const totalViolations = policies.reduce((sum, p) => sum + p.violations_count, 0);
    const criticalViolations = policies.reduce((sum, p) => 
      sum + p.violations.filter(v => v.severity === 'critical').length, 0);
    const averageComplianceScore = policies.length > 0 
      ? policies.reduce((sum, p) => sum + (p.compliance_score || 0), 0) / policies.length 
      : 0;
    const policiesNeedingReview = getPoliciesRequiringReview().length;

    return {
      totalPolicies,
      activesPolicies: activePolicies,
      averageComplianceScore,
      totalViolations,
      criticalViolations,
      policiesNeedingReview,
    };
  }, [policies, getPoliciesRequiringReview]);

  // Initialize
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshPolicies();
    }
  }, [tenantId, globalConfig, refreshPolicies]);

  return (
    <PolicyContext.Provider
      value={{
        policies,
        addPolicy,
        updatePolicy,
        deletePolicy,
        refreshPolicies,
        getPolicy,
        submitForReview,
        approvePolicy,
        rejectPolicy,
        publishPolicy,
        retirePolicy,
        createNewVersion,
        acknowledgePolicy,
        reportViolation,
        resolveViolation,
        getPoliciesByType,
        getPoliciesByStatus,
        getPoliciesByOwner,
        getPoliciesByBusinessService,
        getPoliciesRequiringReview,
        getPoliciesNearExpiry,
        getPolicyViolations,
        searchPolicies,
        getPolicyComplianceStats,
        config,
      }}
    >
      {children}
    </PolicyContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------
export const usePolicies = () => {
  const ctx = useContext(PolicyContext);
  if (!ctx) throw new Error("usePolicies must be used within PolicyProvider");
  return ctx;
};

export const usePolicyDetails = (id: string) => {
  const { policies } = usePolicies();
  return policies.find((p) => p.id === id) || null;
};

// Utility hooks
export const usePoliciesByType = (type: PolicyType) => {
  const { getPoliciesByType } = usePolicies();
  return getPoliciesByType(type);
};

export const usePoliciesRequiringReview = () => {
  const { getPoliciesRequiringReview } = usePolicies();
  return getPoliciesRequiringReview();
};

export const usePolicyViolations = (severity?: PolicyViolation['severity']) => {
  const { getPolicyViolations } = usePolicies();
  return getPolicyViolations(severity);
};

export const usePolicyComplianceStats = () => {
  const { getPolicyComplianceStats } = usePolicies();
  return getPolicyComplianceStats();
};