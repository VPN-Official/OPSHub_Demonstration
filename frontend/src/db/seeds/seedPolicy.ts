import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedPolicy = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let policies: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    policies = [
      {
        id: `${tenantId}_pol01`,
        tenantId,
        name: "Critical Change Approval",
        title: "Network Infrastructure Change Management Policy",
        description: "All firmware upgrades must be approved by Network Engineering Manager.",
        policy_number: "POL-NET-001",
        version: "1.2",
        scope: "change_requests",
        priority: "critical",
        category: "change_management",
        subcategory: "infrastructure",
        health_status: "green",
        status: "active",
        enforcement_level: "mandatory",
        policy_type: "operational",
        owner_team_id: `${tenantId}_team_noc`,
        approver_role: "Network Engineering Manager",
        compliance_framework: "ITIL",
        risk_level: "high",
        business_justification: "Prevent network outages from unauthorized changes",
        effective_date: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        review_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        expiry_date: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString(),
        violation_consequences: "Change rejection and incident review",
        exceptions_allowed: false,
        monitoring_required: true,
        created_at: now,
        last_updated: now,
        tags: ["network", "change", "approval", "critical"],
        custom_fields: {
          approval_threshold: "any_firmware_change",
          notification_required: true,
          rollback_plan_required: true,
          testing_environment_required: true
        }
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    policies = [
      {
        id: `${tenantId}_pol01`,
        tenantId,
        name: "Latency SLA Enforcement",
        title: "Streaming Service Latency Performance Policy",
        description: "Streaming latency must not exceed 250ms in any region.",
        policy_number: "POL-PERF-001",
        version: "2.1",
        scope: "metrics",
        priority: "high",
        category: "performance",
        subcategory: "latency",
        health_status: "yellow",
        status: "active",
        enforcement_level: "automated",
        policy_type: "performance",
        owner_team_id: `${tenantId}_team_sre`,
        approver_role: "SRE Lead",
        compliance_framework: "SLA",
        risk_level: "medium",
        business_justification: "Maintain customer satisfaction and meet SLA commitments",
        effective_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        review_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        expiry_date: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString(),
        violation_consequences: "Automatic scaling and alert escalation",
        exceptions_allowed: true,
        monitoring_required: true,
        created_at: now,
        last_updated: now,
        tags: ["sla", "latency", "streaming", "performance"],
        custom_fields: {
          threshold_value: 250,
          measurement_unit: "milliseconds",
          monitoring_frequency: "1min",
          regions_covered: ["us", "eu", "asia"]
        }
      },
      {
        id: `${tenantId}_pol02`,
        tenantId,
        name: "Kubernetes Resource Quotas",
        title: "Container Resource Management Policy",
        description: "All transcoding pods must define CPU and memory limits.",
        policy_number: "POL-K8S-002",
        version: "1.0",
        scope: "service_components",
        priority: "medium",
        category: "resource_management",
        subcategory: "containers",
        health_status: "green",
        status: "active",
        enforcement_level: "automated",
        policy_type: "operational",
        owner_team_id: `${tenantId}_team_mediaops`,
        approver_role: "Platform Engineering Lead",
        compliance_framework: "Cloud Native",
        risk_level: "medium",
        business_justification: "Prevent resource exhaustion and ensure fair resource allocation",
        effective_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        review_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        expiry_date: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString(),
        violation_consequences: "Pod deployment rejection",
        exceptions_allowed: false,
        monitoring_required: true,
        created_at: now,
        last_updated: now,
        tags: ["gke", "quota", "policy", "resources"],
        custom_fields: {
          cpu_limit_required: true,
          memory_limit_required: true,
          admission_controller: "ResourceQuota",
          namespace_scope: "transcoding"
        }
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    policies = [
      {
        id: `${tenantId}_pol01`,
        tenantId,
        name: "SOX Reporting Compliance",
        title: "Sarbanes-Oxley Financial Reporting Controls Policy",
        description: "Financial reporting services must meet SOX control requirements.",
        policy_number: "POL-SOX-001",
        version: "3.2",
        scope: "business_services",
        priority: "critical",
        category: "compliance",
        subcategory: "financial_reporting",
        health_status: "red",
        status: "active",
        enforcement_level: "mandatory",
        policy_type: "regulatory",
        owner_team_id: `${tenantId}_team_compliance`,
        approver_role: "Chief Financial Officer",
        compliance_framework: "SOX",
        risk_level: "high",
        business_justification: "Meet regulatory requirements and avoid penalties",
        effective_date: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        review_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        expiry_date: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString(),
        violation_consequences: "Regulatory penalties and audit findings",
        exceptions_allowed: false,
        monitoring_required: true,
        created_at: now,
        last_updated: now,
        tags: ["sox", "reporting", "policy", "critical"],
        custom_fields: {
          regulatory_authority: "SEC",
          audit_frequency: "quarterly",
          control_testing_required: true,
          documentation_required: "comprehensive"
        }
      },
      {
        id: `${tenantId}_pol02`,
        tenantId,
        name: "Data Retention",
        title: "Financial Data Retention and Archival Policy",
        description: "ETL pipelines must retain source data for 7 years for audit purposes.",
        policy_number: "POL-DATA-003",
        version: "2.0",
        scope: "etl",
        priority: "high",
        category: "data_governance",
        subcategory: "retention",
        health_status: "orange",
        status: "active",
        enforcement_level: "automated",
        policy_type: "data_management",
        owner_team_id: `${tenantId}_team_dataops`,
        approver_role: "Data Governance Officer",
        compliance_framework: "Financial Regulations",
        risk_level: "medium",
        business_justification: "Support audit requirements and regulatory compliance",
        effective_date: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString(),
        review_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        expiry_date: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
        violation_consequences: "Data recovery costs and compliance violations",
        exceptions_allowed: true,
        monitoring_required: true,
        created_at: now,
        last_updated: now,
        tags: ["etl", "data", "retention", "compliance"],
        custom_fields: {
          retention_period_years: 7,
          storage_tier: "cold_storage",
          encryption_required: true,
          backup_verification: "monthly"
        }
      },
    ];
  }

  // Insert policies with proper error handling
  for (const pol of policies) {
    try {
      await db.put("policy", pol);

      // Create COMPLETE audit log entry
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "policy",
        entity_id: pol.id,
        action: "create",
        description: `Policy created: ${pol.title} (${pol.policy_number}) - ${pol.enforcement_level} enforcement for ${pol.scope}`,
        timestamp: now,
        user_id: "system", // Required field
        tags: ["seed", "policy", "create", pol.category],
        hash: await generateHash({
          entity_type: "policy",
          entity_id: pol.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          policy_number: pol.policy_number,
          title: pol.title,
          version: pol.version,
          scope: pol.scope,
          priority: pol.priority,
          category: pol.category,
          enforcement_level: pol.enforcement_level,
          policy_type: pol.policy_type,
          compliance_framework: pol.compliance_framework,
          risk_level: pol.risk_level,
          owner_team_id: pol.owner_team_id,
          effective_date: pol.effective_date,
          review_date: pol.review_date,
          monitoring_required: pol.monitoring_required,
          exceptions_allowed: pol.exceptions_allowed
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `Policy "${pol.title}" (${pol.policy_number}) activated with ${pol.enforcement_level} enforcement for ${pol.scope}`,
        storeName: "policy", // Required field for dbClient compatibility
        recordId: pol.id, // Required field for dbClient compatibility
        action: "create",
        userId: "system",
        metadata: {
          policy_id: pol.id,
          policy_number: pol.policy_number,
          title: pol.title,
          enforcement_level: pol.enforcement_level,
          policy_type: pol.policy_type,
          scope: pol.scope,
          compliance_framework: pol.compliance_framework,
          risk_level: pol.risk_level,
          business_justification: pol.business_justification,
          related_entities: [
            { type: "team", id: pol.owner_team_id }
          ].filter(entity => entity.id) // Remove null/undefined entries
        }
      });

      console.log(`✅ Seeded policy: ${pol.id} - ${pol.title}`);
    } catch (error) {
      console.error(`❌ Failed to seed policy ${pol.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${policies.length} policies for ${tenantId}`);
};

// Helper function to generate audit hash (simplified for seeding)
async function generateHash(data: any): Promise<string> {
  try {
    const { generateImmutableHash } = await import("../../utils/auditUtils");
    return await generateImmutableHash(data);
  } catch {
    // Fallback for seeding if utils not available
    return `seed_hash_${data.entity_id}_${Date.now()}`;
  }
}