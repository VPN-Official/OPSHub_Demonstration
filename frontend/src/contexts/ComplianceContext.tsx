// src/contexts/ComplianceContext.tsx (STANDARDIZED)
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { getAll, getById, putWithAudit, removeWithAudit } from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------
export interface ComplianceControl {
  id: string;
  name: string;
  description: string;
  control_family: string;
  implementation_status: "not_started" | "in_progress" | "implemented" | "verified" | "exception";
  effectiveness: "not_assessed" | "ineffective" | "partially_effective" | "effective";
  test_frequency: "continuous" | "monthly" | "quarterly" | "semi_annually" | "annually";
  last_tested_date?: string;
  next_test_date?: string;
  test_results?: Array<{
    date: string;
    result: "pass" | "fail" | "partial";
    findings?: string;
    remediation_required?: boolean;
  }>;
}

export interface ComplianceEvidence {
  id: string;
  type: "document" | "screenshot" | "log_export" | "attestation" | "other";
  title: string;
  description?: string;
  file_url?: string;
  collected_date: string;
  collected_by: string;
  retention_period_months?: number;
  classification?: "public" | "internal" | "confidential" | "restricted";
}

export interface ComplianceGap {
  id: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  impact_assessment: string;
  remediation_plan: string;
  target_resolution_date?: string;
  assigned_to_user_id?: string;
  status: "open" | "in_progress" | "resolved" | "accepted_risk" | "false_positive";
}

export interface ComplianceRequirement {
  id: string;
  name: string;
  description?: string;
  type: string;   // config-driven
  status: string; // config-driven
  created_at: string;
  updated_at: string;

  // Framework & Regulation
  framework: string; // config-driven: SOX, PCI-DSS, HIPAA, GDPR, ISO27001, etc.
  regulation_reference?: string;
  requirement_section?: string;
  mandatory: boolean;
  applicability_scope?: string;

  // Relationships
  business_service_ids: string[];
  asset_ids: string[];
  vendor_ids: string[];
  contract_ids: string[];
  risk_ids: string[];
  owner_user_id?: string | null;
  owner_team_id?: string | null;

  // Implementation & Controls
  controls: ComplianceControl[];
  implementation_approach?: string;
  implementation_date?: string;
  implementation_cost?: number;
  implementation_effort_hours?: number;

  // Assessment & Monitoring
  last_assessed_date?: string | null;
  next_assessment_date?: string | null;
  assessment_frequency: "monthly" | "quarterly" | "semi_annually" | "annually" | "on_demand";
  assessed_by_user_id?: string | null;
  assessment_method?: "automated" | "manual" | "hybrid";

  // Compliance Status
  compliance_score?: number; // 0-100
  compliance_level: "non_compliant" | "partially_compliant" | "substantially_compliant" | "fully_compliant";
  maturity_level?: "basic" | "managed" | "defined" | "quantitatively_managed" | "optimizing";

  // Evidence & Documentation
  evidence: ComplianceEvidence[];
  policy_document_url?: string;
  procedure_document_url?: string;
  training_materials_url?: string;

  // Gap Analysis & Remediation
  identified_gaps: ComplianceGap[];
  remediation_priority?: "low" | "medium" | "high" | "critical";
  remediation_budget?: number;
  remediation_timeline_weeks?: number;

  // Audit & Verification
  external_audit_required?: boolean;
  last_external_audit_date?: string;
  next_external_audit_date?: string;
  audit_findings?: Array<{
    finding_id: string;
    severity: "low" | "medium" | "high" | "critical";
    description: string;
    remediation_status: "open" | "in_progress" | "resolved";
    target_date?: string;
  }>;

  // Reporting & Communication
  stakeholder_notification_required?: boolean;
  notification_recipients: string[]; // user_ids
  reporting_frequency?: "monthly" | "quarterly" | "annually";
  last_report_date?: string;

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
interface ComplianceContextType {
  requirements: ComplianceRequirement[];
  addRequirement: (req: ComplianceRequirement, userId?: string) => Promise<void>;
  updateRequirement: (req: ComplianceRequirement, userId?: string) => Promise<void>;
  deleteRequirement: (id: string, userId?: string) => Promise<void>;
  refreshRequirements: () => Promise<void>;
  getRequirement: (id: string) => Promise<ComplianceRequirement | undefined>;

  // Compliance-specific operations
  updateComplianceScore: (requirementId: string, score: number, assessedBy?: string) => Promise<void>;
  addEvidence: (requirementId: string, evidence: ComplianceEvidence, userId?: string) => Promise<void>;
  removeEvidence: (requirementId: string, evidenceId: string, userId?: string) => Promise<void>;
  addComplianceGap: (requirementId: string, gap: ComplianceGap, userId?: string) => Promise<void>;
  updateComplianceGap: (requirementId: string, gapId: string, updates: Partial<ComplianceGap>, userId?: string) => Promise<void>;
  resolveComplianceGap: (requirementId: string, gapId: string, resolution: string, userId?: string) => Promise<void>;
  scheduleAssessment: (requirementId: string, assessmentDate: string, userId?: string) => Promise<void>;
  recordAuditFinding: (requirementId: string, finding: ComplianceRequirement['audit_findings'][0], userId?: string) => Promise<void>;
  generateComplianceReport: (framework?: string, dateFrom?: string, dateTo?: string) => Promise<{
    summary: {
      totalRequirements: number;
      compliantCount: number;
      nonCompliantCount: number;
      complianceRate: number;
      averageScore: number;
    };
    byFramework: Record<string, number>;
    criticalGaps: ComplianceGap[];
    upcomingAssessments: Array<{ requirement: ComplianceRequirement; daysUntilDue: number }>;
  }>;

  // Filtering and querying
  getRequirementsByFramework: (framework: string) => ComplianceRequirement[];
  getRequirementsByType: (type: string) => ComplianceRequirement[];
  getRequirementsByStatus: (status: string) => ComplianceRequirement[];
  getNonCompliantRequirements: () => ComplianceRequirement[];
  getRequirementsWithCriticalGaps: () => ComplianceRequirement[];
  getRequirementsDueForAssessment: (daysAhead?: number) => ComplianceRequirement[];
  getRequirementsWithMissingEvidence: () => ComplianceRequirement[];
  getRequirementsByOwner: (ownerId: string, ownerType: 'user' | 'team') => ComplianceRequirement[];
  searchRequirements: (query: string) => ComplianceRequirement[];

  // Analytics
  getComplianceOverview: () => {
    totalRequirements: number;
    compliantRequirements: number;
    nonCompliantRequirements: number;
    overallComplianceRate: number;
    averageComplianceScore: number;
    requirementsNeedingAttention: number;
    upcomingAssessments: number;
    overdueFinding: number;
  };

  getComplianceByFramework: () => Record<string, {
    total: number;
    compliant: number;
    nonCompliant: number;
    complianceRate: number;
    averageScore: number;
  }>;

  getComplianceTrends: (months?: number) => Array<{
    month: string;
    complianceRate: number;
    newRequirements: number;
    resolvedGaps: number;
    newGaps: number;
  }>;

  // Config integration
  config: {
    types: string[];
    statuses: string[];
    frameworks: string[];
    maturity_levels: string[];
    assessment_frequencies: string[];
    compliance_levels: string[];
  };
}

const ComplianceContext = createContext<ComplianceContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const ComplianceProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig, validateEnum } = useConfig();
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([]);

  // Extract compliance-specific config from global config
  const config = {
    types: globalConfig?.compliance?.types || 
           ['regulatory', 'industry_standard', 'internal_policy', 'contractual', 'certification'],
    statuses: globalConfig?.compliance?.statuses || 
              ['draft', 'active', 'under_review', 'deprecated', 'exception_granted'],
    frameworks: globalConfig?.compliance?.frameworks || 
                ['SOX', 'PCI-DSS', 'HIPAA', 'GDPR', 'ISO27001', 'NIST', 'SOC2', 'FedRAMP'],
    maturity_levels: ['basic', 'managed', 'defined', 'quantitatively_managed', 'optimizing'],
    assessment_frequencies: ['monthly', 'quarterly', 'semi_annually', 'annually', 'on_demand'],
    compliance_levels: ['non_compliant', 'partially_compliant', 'substantially_compliant', 'fully_compliant'],
  };

  const validateRequirement = useCallback((req: ComplianceRequirement) => {
    if (!globalConfig) {
      throw new Error("Configuration not loaded");
    }

    // Validate type
    if (!config.types.includes(req.type)) {
      throw new Error(`Invalid compliance type: ${req.type}. Valid options: ${config.types.join(', ')}`);
    }

    // Validate status
    if (!validateEnum('statuses', req.status)) {
      throw new Error(`Invalid status: ${req.status}. Valid options: ${config.statuses.join(', ')}`);
    }

    // Validate framework
    if (!config.frameworks.includes(req.framework)) {
      throw new Error(`Invalid framework: ${req.framework}. Valid options: ${config.frameworks.join(', ')}`);
    }

    // Validate compliance level
    if (!config.compliance_levels.includes(req.compliance_level)) {
      throw new Error(`Invalid compliance level: ${req.compliance_level}. Valid options: ${config.compliance_levels.join(', ')}`);
    }

    // Validate assessment frequency
    if (!config.assessment_frequencies.includes(req.assessment_frequency)) {
      throw new Error(`Invalid assessment frequency: ${req.assessment_frequency}. Valid options: ${config.assessment_frequencies.join(', ')}`);
    }

    // Validate maturity level if provided
    if (req.maturity_level && !config.maturity_levels.includes(req.maturity_level)) {
      throw new Error(`Invalid maturity level: ${req.maturity_level}. Valid options: ${config.maturity_levels.join(', ')}`);
    }

    // Validate required fields
    if (!req.name || req.name.trim().length < 3) {
      throw new Error("Requirement name must be at least 3 characters long");
    }

    if (!req.framework) {
      throw new Error("Framework is required");
    }

    // Validate compliance score range
    if (req.compliance_score !== undefined && (req.compliance_score < 0 || req.compliance_score > 100)) {
      throw new Error("Compliance score must be between 0 and 100");
    }

    // Validate controls
    if (req.controls) {
      req.controls.forEach((control, index) => {
        if (!control.name || control.name.trim().length < 3) {
          throw new Error(`Control at index ${index} must have a name of at least 3 characters`);
        }
        const validStatuses = ["not_started", "in_progress", "implemented", "verified", "exception"];
        if (!validStatuses.includes(control.implementation_status)) {
          throw new Error(`Control at index ${index} has invalid implementation status`);
        }
        const validEffectiveness = ["not_assessed", "ineffective", "partially_effective", "effective"];
        if (!validEffectiveness.includes(control.effectiveness)) {
          throw new Error(`Control at index ${index} has invalid effectiveness rating`);
        }
      });
    }

    // Validate evidence
    if (req.evidence) {
      req.evidence.forEach((evidence, index) => {
        if (!evidence.title || evidence.title.trim().length < 3) {
          throw new Error(`Evidence at index ${index} must have a title of at least 3 characters`);
        }
        const validTypes = ["document", "screenshot", "log_export", "attestation", "other"];
        if (!validTypes.includes(evidence.type)) {
          throw new Error(`Evidence at index ${index} has invalid type`);
        }
      });
    }

    // Validate gaps
    if (req.identified_gaps) {
      req.identified_gaps.forEach((gap, index) => {
        if (!gap.title || gap.title.trim().length < 3) {
          throw new Error(`Gap at index ${index} must have a title of at least 3 characters`);
        }
        const validSeverities = ["low", "medium", "high", "critical"];
        if (!validSeverities.includes(gap.severity)) {
          throw new Error(`Gap at index ${index} has invalid severity`);
        }
        const validStatuses = ["open", "in_progress", "resolved", "accepted_risk", "false_positive"];
        if (!validStatuses.includes(gap.status)) {
          throw new Error(`Gap at index ${index} has invalid status`);
        }
      });
    }
  }, [globalConfig, validateEnum, config]);

  const ensureMetadata = useCallback((req: ComplianceRequirement): ComplianceRequirement => {
    const now = new Date().toISOString();
    return {
      ...req,
      tenantId,
      tags: req.tags || [],
      health_status: req.health_status || "gray",
      sync_status: req.sync_status || "dirty",
      synced_at: req.synced_at || now,
      business_service_ids: req.business_service_ids || [],
      asset_ids: req.asset_ids || [],
      vendor_ids: req.vendor_ids || [],
      contract_ids: req.contract_ids || [],
      risk_ids: req.risk_ids || [],
      controls: req.controls || [],
      evidence: req.evidence || [],
      identified_gaps: req.identified_gaps || [],
      notification_recipients: req.notification_recipients || [],
      audit_findings: req.audit_findings || [],
    };
  }, [tenantId]);

  const refreshRequirements = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      const all = await getAll<ComplianceRequirement>(tenantId, "compliance");
      
      // Sort by criticality and compliance status
      all.sort((a, b) => {
        // Non-compliant requirements first
        const complianceOrder = { 
          non_compliant: 4, 
          partially_compliant: 3, 
          substantially_compliant: 2, 
          fully_compliant: 1 
        };
        const aCompliance = complianceOrder[a.compliance_level] || 0;
        const bCompliance = complianceOrder[b.compliance_level] || 0;
        if (aCompliance !== bCompliance) return bCompliance - aCompliance;
        
        // Critical gaps first
        const aCriticalGaps = a.identified_gaps.filter(g => g.severity === 'critical').length;
        const bCriticalGaps = b.identified_gaps.filter(g => g.severity === 'critical').length;
        if (aCriticalGaps !== bCriticalGaps) return bCriticalGaps - aCriticalGaps;
        
        // Health status priority
        const healthOrder = { red: 5, orange: 4, yellow: 3, green: 2, gray: 1 };
        const aHealth = healthOrder[a.health_status] || 0;
        const bHealth = healthOrder[b.health_status] || 0;
        if (aHealth !== bHealth) return bHealth - aHealth;
        
        // Finally by name
        return a.name.localeCompare(b.name);
      });
      
      setRequirements(all);
    } catch (error) {
      console.error("Failed to refresh compliance requirements:", error);
    }
  }, [tenantId]);

  const getRequirement = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    return getById<ComplianceRequirement>(tenantId, "compliance", id);
  }, [tenantId]);

  const addRequirement = useCallback(async (req: ComplianceRequirement, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateRequirement(req);

    const now = new Date().toISOString();
    const enriched = ensureMetadata({
      ...req,
      created_at: now,
      updated_at: now,
    });

    const priority = req.compliance_level === 'non_compliant' ? 'critical' : 
                    req.identified_gaps.some(g => g.severity === 'critical') ? 'high' : 'normal';

    await putWithAudit(
      tenantId,
      "compliance",
      enriched,
      userId,
      {
        action: "create",
        description: `Created compliance requirement: ${req.name}`,
        tags: ["compliance", "create", req.framework, req.type],
        metadata: {
          framework: req.framework,
          type: req.type,
          compliance_level: req.compliance_level,
          mandatory: req.mandatory,
          control_count: req.controls.length,
          gap_count: req.identified_gaps.length,
        },
      }
    );

    await enqueueItem({
      storeName: "compliance",
      entityId: enriched.id,
      action: "create",
      payload: enriched,
      priority,
    });

    await refreshRequirements();
  }, [tenantId, validateRequirement, ensureMetadata, enqueueItem, refreshRequirements]);

  const updateRequirement = useCallback(async (req: ComplianceRequirement, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateRequirement(req);

    const enriched = ensureMetadata({
      ...req,
      updated_at: new Date().toISOString(),
    });

    await putWithAudit(
      tenantId,
      "compliance",
      enriched,
      userId,
      {
        action: "update",
        description: `Updated compliance requirement: ${req.name}`,
        tags: ["compliance", "update", req.framework],
        metadata: {
          compliance_level: req.compliance_level,
          compliance_score: req.compliance_score,
          gap_count: req.identified_gaps.length,
        },
      }
    );

    await enqueueItem({
      storeName: "compliance",
      entityId: enriched.id,
      action: "update",
      payload: enriched,
    });

    await refreshRequirements();
  }, [tenantId, validateRequirement, ensureMetadata, enqueueItem, refreshRequirements]);

  const deleteRequirement = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    const requirement = await getRequirement(id);
    if (!requirement) throw new Error(`Compliance requirement ${id} not found`);

    await removeWithAudit(
      tenantId,
      "compliance",
      id,
      userId,
      {
        action: "delete",
        description: `Deleted compliance requirement: ${requirement.name}`,
        tags: ["compliance", "delete", requirement.framework],
        metadata: {
          framework: requirement.framework,
          type: requirement.type,
          compliance_level: requirement.compliance_level,
        },
      }
    );

    await enqueueItem({
      storeName: "compliance",
      entityId: id,
      action: "delete",
      payload: null,
    });

    await refreshRequirements();
  }, [tenantId, getRequirement, enqueueItem, refreshRequirements]);

  // Compliance-specific operations
  const updateComplianceScore = useCallback(async (requirementId: string, score: number, assessedBy?: string) => {
    const requirement = await getRequirement(requirementId);
    if (!requirement) throw new Error(`Compliance requirement ${requirementId} not found`);

    // Determine compliance level based on score
    let complianceLevel: ComplianceRequirement['compliance_level'];
    if (score >= 95) complianceLevel = 'fully_compliant';
    else if (score >= 80) complianceLevel = 'substantially_compliant';
    else if (score >= 60) complianceLevel = 'partially_compliant';
    else complianceLevel = 'non_compliant';

    const updated = {
      ...requirement,
      compliance_score: score,
      compliance_level: complianceLevel,
      last_assessed_date: new Date().toISOString(),
      assessed_by_user_id: assessedBy,
    };

    await updateRequirement(updated, assessedBy);
  }, [getRequirement, updateRequirement]);

  const addEvidence = useCallback(async (requirementId: string, evidence: ComplianceEvidence, userId?: string) => {
    const requirement = await getRequirement(requirementId);
    if (!requirement) throw new Error(`Compliance requirement ${requirementId} not found`);

    const newEvidence = { ...evidence, id: evidence.id || crypto.randomUUID() };
    const updatedEvidence = [...requirement.evidence, newEvidence];
    const updated = { ...requirement, evidence: updatedEvidence };

    await updateRequirement(updated, userId);
  }, [getRequirement, updateRequirement]);

  const removeEvidence = useCallback(async (requirementId: string, evidenceId: string, userId?: string) => {
    const requirement = await getRequirement(requirementId);
    if (!requirement) throw new Error(`Compliance requirement ${requirementId} not found`);

    const updatedEvidence = requirement.evidence.filter(e => e.id !== evidenceId);
    const updated = { ...requirement, evidence: updatedEvidence };

    await updateRequirement(updated, userId);
  }, [getRequirement, updateRequirement]);

  const addComplianceGap = useCallback(async (requirementId: string, gap: ComplianceGap, userId?: string) => {
    const requirement = await getRequirement(requirementId);
    if (!requirement) throw new Error(`Compliance requirement ${requirementId} not found`);

    const newGap = { ...gap, id: gap.id || crypto.randomUUID() };
    const updatedGaps = [...requirement.identified_gaps, newGap];
    const updated = { ...requirement, identified_gaps: updatedGaps };

    await updateRequirement(updated, userId);
  }, [getRequirement, updateRequirement]);

  const updateComplianceGap = useCallback(async (requirementId: string, gapId: string, updates: Partial<ComplianceGap>, userId?: string) => {
    const requirement = await getRequirement(requirementId);
    if (!requirement) throw new Error(`Compliance requirement ${requirementId} not found`);

    const updatedGaps = requirement.identified_gaps.map(gap =>
      gap.id === gapId ? { ...gap, ...updates } : gap
    );
    const updated = { ...requirement, identified_gaps: updatedGaps };

    await updateRequirement(updated, userId);
  }, [getRequirement, updateRequirement]);

  const resolveComplianceGap = useCallback(async (requirementId: string, gapId: string, resolution: string, userId?: string) => {
    await updateComplianceGap(requirementId, gapId, {
      status: 'resolved',
      custom_fields: { resolution, resolved_at: new Date().toISOString(), resolved_by: userId }
    }, userId);
  }, [updateComplianceGap]);

  const scheduleAssessment = useCallback(async (requirementId: string, assessmentDate: string, userId?: string) => {
    const requirement = await getRequirement(requirementId);
    if (!requirement) throw new Error(`Compliance requirement ${requirementId} not found`);

    const updated = {
      ...requirement,
      next_assessment_date: assessmentDate,
    };

    await updateRequirement(updated, userId);
  }, [getRequirement, updateRequirement]);

  const recordAuditFinding = useCallback(async (requirementId: string, finding: ComplianceRequirement['audit_findings'][0], userId?: string) => {
    const requirement = await getRequirement(requirementId);
    if (!requirement) throw new Error(`Compliance requirement ${requirementId} not found`);

    const updatedFindings = [...requirement.audit_findings, finding];
    const updated = { ...requirement, audit_findings: updatedFindings };

    await updateRequirement(updated, userId);
  }, [getRequirement, updateRequirement]);

  const generateComplianceReport = useCallback(async (framework?: string, dateFrom?: string, dateTo?: string) => {
    let filteredRequirements = requirements;

    if (framework) {
      filteredRequirements = filteredRequirements.filter(req => req.framework === framework);
    }

    if (dateFrom || dateTo) {
      filteredRequirements = filteredRequirements.filter(req => {
        const createdDate = new Date(req.created_at);
        if (dateFrom && createdDate < new Date(dateFrom)) return false;
        if (dateTo && createdDate > new Date(dateTo)) return false;
        return true;
      });
    }

    const totalRequirements = filteredRequirements.length;
    const compliantCount = filteredRequirements.filter(req => 
      req.compliance_level === 'fully_compliant' || req.compliance_level === 'substantially_compliant'
    ).length;
    const nonCompliantCount = totalRequirements - compliantCount;
    const complianceRate = totalRequirements > 0 ? (compliantCount / totalRequirements) * 100 : 0;

    const requirementsWithScores = filteredRequirements.filter(req => req.compliance_score !== undefined);
    const averageScore = requirementsWithScores.length > 0
      ? requirementsWithScores.reduce((sum, req) => sum + (req.compliance_score || 0), 0) / requirementsWithScores.length
      : 0;

    const byFramework = filteredRequirements.reduce((acc, req) => {
      acc[req.framework] = (acc[req.framework] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const criticalGaps = filteredRequirements
      .flatMap(req => req.identified_gaps)
      .filter(gap => gap.severity === 'critical' && gap.status !== 'resolved');

    const now = new Date();
    const upcomingAssessments = filteredRequirements
      .filter(req => req.next_assessment_date)
      .map(req => ({
        requirement: req,
        daysUntilDue: Math.ceil((new Date(req.next_assessment_date!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      }))
      .filter(item => item.daysUntilDue <= 30)
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    return {
      summary: {
        totalRequirements,
        compliantCount,
        nonCompliantCount,
        complianceRate,
        averageScore,
      },
      byFramework,
      criticalGaps,
      upcomingAssessments,
    };
  }, [requirements]);

  // Filtering functions
  const getRequirementsByFramework = useCallback((framework: string) => {
    return requirements.filter(req => req.framework === framework);
  }, [requirements]);

  const getRequirementsByType = useCallback((type: string) => {
    return requirements.filter(req => req.type === type);
  }, [requirements]);

  const getRequirementsByStatus = useCallback((status: string) => {
    return requirements.filter(req => req.status === status);
  }, [requirements]);

  const getNonCompliantRequirements = useCallback(() => {
    return requirements.filter(req => 
      req.compliance_level === 'non_compliant' || req.compliance_level === 'partially_compliant'
    );
  }, [requirements]);

  const getRequirementsWithCriticalGaps = useCallback(() => {
    return requirements.filter(req => 
      req.identified_gaps.some(gap => gap.severity === 'critical' && gap.status !== 'resolved')
    );
  }, [requirements]);

  const getRequirementsDueForAssessment = useCallback((daysAhead: number = 30) => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + (daysAhead * 24 * 60 * 60 * 1000));

    return requirements.filter(req => {
      if (!req.next_assessment_date) return false;
      const assessmentDate = new Date(req.next_assessment_date);
      return assessmentDate >= now && assessmentDate <= futureDate;
    });
  }, [requirements]);

  const getRequirementsWithMissingEvidence = useCallback(() => {
    return requirements.filter(req => 
      req.evidence.length === 0 || 
      req.controls.some(control => 
        control.implementation_status === 'implemented' && 
        !req.evidence.some(evidence => evidence.title.toLowerCase().includes(control.name.toLowerCase()))
      )
    );
  }, [requirements]);

  const getRequirementsByOwner = useCallback((ownerId: string, ownerType: 'user' | 'team') => {
    if (ownerType === 'user') {
      return requirements.filter(req => req.owner_user_id === ownerId);
    } else {
      return requirements.filter(req => req.owner_team_id === ownerId);
    }
  }, [requirements]);

  const searchRequirements = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return requirements.filter(req => 
      req.name.toLowerCase().includes(lowerQuery) ||
      req.description?.toLowerCase().includes(lowerQuery) ||
      req.framework.toLowerCase().includes(lowerQuery) ||
      req.type.toLowerCase().includes(lowerQuery) ||
      req.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      req.controls.some(control => control.name.toLowerCase().includes(lowerQuery))
    );
  }, [requirements]);

  // Analytics functions
  const getComplianceOverview = useCallback(() => {
    const totalRequirements = requirements.length;
    const compliantRequirements = requirements.filter(req => 
      req.compliance_level === 'fully_compliant' || req.compliance_level === 'substantially_compliant'
    ).length;
    const nonCompliantRequirements = totalRequirements - compliantRequirements;
    const overallComplianceRate = totalRequirements > 0 ? (compliantRequirements / totalRequirements) * 100 : 0;

    const requirementsWithScores = requirements.filter(req => req.compliance_score !== undefined);
    const averageComplianceScore = requirementsWithScores.length > 0
      ? requirementsWithScores.reduce((sum, req) => sum + (req.compliance_score || 0), 0) / requirementsWithScores.length
      : 0;

    const requirementsNeedingAttention = requirements.filter(req => 
      req.compliance_level === 'non_compliant' || 
      req.identified_gaps.some(gap => gap.severity === 'critical')
    ).length;

    const upcomingAssessments = getRequirementsDueForAssessment().length;
    
    const overdueFinding = requirements.filter(req => 
      req.audit_findings.some(finding => 
        finding.remediation_status !== 'resolved' && 
        finding.target_date && 
        new Date(finding.target_date) < new Date()
      )
    ).length;

    return {
      totalRequirements,
      compliantRequirements,
      nonCompliantRequirements,
      overallComplianceRate,
      averageComplianceScore,
      requirementsNeedingAttention,
      upcomingAssessments,
      overdueFinding,
    };
  }, [requirements, getRequirementsDueForAssessment]);

  const getComplianceByFramework = useCallback(() => {
    const frameworkStats = {} as Record<string, {
      total: number;
      compliant: number;
      nonCompliant: number;
      complianceRate: number;
      averageScore: number;
    }>;

    config.frameworks.forEach(framework => {
      const frameworkRequirements = getRequirementsByFramework(framework);
      const total = frameworkRequirements.length;
      
      if (total > 0) {
        const compliant = frameworkRequirements.filter(req => 
          req.compliance_level === 'fully_compliant' || req.compliance_level === 'substantially_compliant'
        ).length;
        const nonCompliant = total - compliant;
        const complianceRate = (compliant / total) * 100;
        
        const withScores = frameworkRequirements.filter(req => req.compliance_score !== undefined);
        const averageScore = withScores.length > 0
          ? withScores.reduce((sum, req) => sum + (req.compliance_score || 0), 0) / withScores.length
          : 0;

        frameworkStats[framework] = {
          total,
          compliant,
          nonCompliant,
          complianceRate,
          averageScore,
        };
      }
    });

    return frameworkStats;
  }, [requirements, getRequirementsByFramework, config.frameworks]);

  const getComplianceTrends = useCallback((months: number = 12) => {
    // This would typically come from historical data
    // For now, generate mock trend data
    const trends = [];
    const currentDate = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const monthDate = new Date(currentDate);
      monthDate.setMonth(monthDate.getMonth() - i);
      const month = monthDate.toISOString().slice(0, 7); // YYYY-MM

      // Mock data based on current state with some variation
      const baseComplianceRate = getComplianceOverview().overallComplianceRate;
      const variation = (Math.random() - 0.5) * 10; // ±5%
      const complianceRate = Math.min(100, Math.max(0, baseComplianceRate + variation));

      const newRequirements = Math.floor(Math.random() * 5); // 0-4 new requirements
      const resolvedGaps = Math.floor(Math.random() * 8); // 0-7 resolved gaps
      const newGaps = Math.floor(Math.random() * 6); // 0-5 new gaps

      trends.push({
        month,
        complianceRate,
        newRequirements,
        resolvedGaps,
        newGaps,
      });
    }

    return trends;
  }, [getComplianceOverview]);

  // Initialize when tenant and config are ready
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshRequirements();
    }
  }, [tenantId, globalConfig, refreshRequirements]);

  return (
    <ComplianceContext.Provider
      value={{
        requirements,
        addRequirement,
        updateRequirement,
        deleteRequirement,
        refreshRequirements,
        getRequirement,
        updateComplianceScore,
        addEvidence,
        removeEvidence,
        addComplianceGap,
        updateComplianceGap,
        resolveComplianceGap,
        scheduleAssessment,
        recordAuditFinding,
        generateComplianceReport,
        getRequirementsByFramework,
        getRequirementsByType,
        getRequirementsByStatus,
        getNonCompliantRequirements,
        getRequirementsWithCriticalGaps,
        getRequirementsDueForAssessment,
        getRequirementsWithMissingEvidence,
        getRequirementsByOwner,
        searchRequirements,
        getComplianceOverview,
        getComplianceByFramework,
        getComplianceTrends,
        config,
      }}
    >
      {children}
    </ComplianceContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------
export const useCompliance = () => {
  const ctx = useContext(ComplianceContext);
  if (!ctx) throw new Error("useCompliance must be used within ComplianceProvider");
  return ctx;
};

export const useComplianceRequirementDetails = (id: string) => {
  const { requirements } = useCompliance();
  return requirements.find((req) => req.id === id) || null;
};

// Utility hooks
export const useNonCompliantRequirements = () => {
  const { getNonCompliantRequirements } = useCompliance();
  return getNonCompliantRequirements();
};

export const useComplianceOverview = () => {
  const { getComplianceOverview } = useCompliance();
  return getComplianceOverview();
};

export const useComplianceByFramework = () => {
  const { getComplianceByFramework } = useCompliance();
  return getComplianceByFramework();
};

export const useComplianceReport = (framework?: string, dateFrom?: string, dateTo?: string) => {
  const { generateComplianceReport } = useCompliance();
  const [report, setReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const generateReport = async () => {
      setIsLoading(true);
      try {
        const reportData = await generateComplianceReport(framework, dateFrom, dateTo);
        setReport(reportData);
      } catch (error) {
        console.error('Failed to generate compliance report:', error);
      } finally {
        setIsLoading(false);
      }
    };

    generateReport();
  }, [framework, dateFrom, dateTo, generateComplianceReport]);

  return { report, isLoading };
};