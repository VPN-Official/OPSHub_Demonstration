// src/db/seeds/seedAuditLogs.ts - FULLY CORRECTED
import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedAuditLogs = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  const perTenantLogs: Record<string, any[]> = {
    tenant_dcn_meta: [
      {
        entity_type: "system",
        entity_id: "bootstrap",
        action: "initialize",
        description: "MetaOps AIOps platform bootstrap initialization completed successfully",
        category: "system",
        subcategory: "bootstrap",
        priority: "high",
        severity: "low",
        health_status: "green",
        impact: "none",
        source_system: "bootstrap_service",
        compliance_relevant: true,
        retention_days: 2555, // 7 years for compliance
        metadata: {
          bootstrap_version: "1.0.0",
          initialization_time_ms: 1234,
          modules_loaded: ["core", "monitoring", "automation"],
          configuration_source: "default"
        }
      },
      {
        entity_type: "incident",
        entity_id: `${tenantId}_inc01`,
        action: "update",
        description: "Network incident priority elevated to P1 due to business impact assessment - affecting 500+ users",
        category: "incident_management",
        subcategory: "priority_escalation",
        priority: "critical",
        severity: "high",
        health_status: "red",
        impact: "high",
        source_system: "incident_management",
        compliance_relevant: false,
        retention_days: 365,
        metadata: {
          old_priority: "P2",
          new_priority: "P1",
          escalation_reason: "business_impact",
          affected_services: ["network", "internet"],
          affected_users: 500
        }
      },
      {
        entity_type: "change_request",
        entity_id: `${tenantId}_chg01`,
        action: "approve",
        description: "Router firmware upgrade change request approved by Change Advisory Board after risk assessment",
        category: "change_management",
        subcategory: "cab_approval",
        priority: "high",
        severity: "medium",
        health_status: "green",
        impact: "medium",
        source_system: "change_management",
        compliance_relevant: true,
        retention_days: 1095, // 3 years
        metadata: {
          cab_members: ["manager01", "director01", "architect01"],
          approval_type: "unanimous",
          risk_assessment: "medium",
          rollback_plan: "available",
          implementation_window: "2025-01-20T02:00:00Z"
        }
      },
      {
        entity_type: "user",
        entity_id: `${tenantId}_user_admin01`,
        action: "login",
        description: "Administrator successful login from trusted IP address",
        category: "authentication",
        subcategory: "user_login",
        priority: "low",
        severity: "low",
        health_status: "green",
        impact: "none",
        source_system: "auth_service",
        compliance_relevant: true,
        retention_days: 90,
        metadata: {
          ip_address: "192.168.1.100",
          authentication_method: "mfa",
          session_id: "sess_123456",
          user_agent: "Mozilla/5.0"
        }
      },
      {
        entity_type: "configuration",
        entity_id: `${tenantId}_config_bgp01`,
        action: "modify",
        description: "BGP routing configuration modified to add new peer AS7018",
        category: "configuration_management",
        subcategory: "network_config",
        priority: "medium",
        severity: "medium",
        health_status: "yellow",
        impact: "medium",
        source_system: "network_automation",
        compliance_relevant: true,
        retention_days: 1095,
        metadata: {
          config_type: "bgp",
          device_id: `${tenantId}_asset_router01`,
          old_value: "peer_count:3",
          new_value: "peer_count:4",
          peer_asn: "7018"
        }
      }
    ],
    tenant_av_google: [
      {
        entity_type: "alert",
        entity_id: `${tenantId}_alert01`,
        action: "acknowledge",
        description: "Streaming latency alert acknowledged by SRE team - investigation initiated",
        category: "alert_management",
        subcategory: "acknowledgment",
        priority: "high",
        severity: "medium",
        health_status: "yellow",
        impact: "medium",
        source_system: "monitoring_platform",
        compliance_relevant: false,
        retention_days: 90,
        metadata: {
          acknowledged_by: `${tenantId}_user_sre01`,
          alert_severity: "warning",
          metric_value: 285,
          threshold_value: 200,
          affected_region: "eu-west-1"
        }
      },
      {
        entity_type: "metric",
        entity_id: `${tenantId}_metric01`,
        action: "threshold_breach",
        description: "Edge node CPU utilization exceeded critical threshold of 90%",
        category: "monitoring",
        subcategory: "metric_violation",
        priority: "high",
        severity: "high",
        health_status: "red",
        impact: "high",
        source_system: "prometheus",
        compliance_relevant: false,
        retention_days: 30,
        metadata: {
          metric_name: "cpu_utilization",
          current_value: 95,
          threshold_value: 90,
          duration_seconds: 300,
          node_id: `${tenantId}_asset_gce_vm01`
        }
      },
      {
        entity_type: "automation_rule",
        entity_id: `${tenantId}_rule01`,
        action: "execute",
        description: "Auto-scaling rule triggered for edge compute pool - adding 5 instances",
        category: "automation",
        subcategory: "rule_execution",
        priority: "medium",
        severity: "low",
        health_status: "green",
        impact: "positive",
        source_system: "automation_engine",
        compliance_relevant: false,
        retention_days: 60,
        metadata: {
          rule_name: "edge_auto_scale",
          trigger_condition: "cpu>90",
          action_taken: "scale_out",
          instances_added: 5,
          new_capacity: 15,
          estimated_cost: 250
        }
      },
      {
        entity_type: "deployment",
        entity_id: `${tenantId}_deploy01`,
        action: "complete",
        description: "Kubernetes deployment rollout completed successfully for transcoding service",
        category: "deployment",
        subcategory: "k8s_rollout",
        priority: "medium",
        severity: "low",
        health_status: "green",
        impact: "low",
        source_system: "kubernetes",
        compliance_relevant: true,
        retention_days: 180,
        metadata: {
          deployment_name: "transcoding-v2.1.0",
          namespace: "production",
          replicas_updated: 12,
          strategy: "rolling_update",
          duration_seconds: 240
        }
      },
      {
        entity_type: "cost",
        entity_id: `${tenantId}_cost01`,
        action: "alert",
        description: "Cloud cost anomaly detected - 30% increase in compute spending",
        category: "financial",
        subcategory: "cost_anomaly",
        priority: "medium",
        severity: "medium",
        health_status: "yellow",
        impact: "financial",
        source_system: "cost_management",
        compliance_relevant: true,
        retention_days: 365,
        metadata: {
          cost_center: "media_operations",
          current_spend: 15000,
          expected_spend: 11500,
          variance_percent: 30,
          primary_driver: "compute_instances"
        }
      }
    ],
    tenant_cloud_morningstar: [
      {
        entity_type: "service_request",
        entity_id: `${tenantId}_sr01`,
        action: "create",
        description: "Database performance optimization service request created for critical replication lag issue",
        category: "service_management",
        subcategory: "request_creation",
        priority: "critical",
        severity: "high",
        health_status: "orange",
        impact: "high",
        source_system: "service_desk",
        compliance_relevant: true,
        retention_days: 365,
        metadata: {
          request_type: "performance_optimization",
          requested_by: `${tenantId}_user_dba01`,
          sla_deadline: "2025-01-16T09:00:00Z",
          business_justification: "regulatory_reporting",
          estimated_cost: 0
        }
      },
      {
        entity_type: "problem",
        entity_id: `${tenantId}_prob01`,
        action: "update",
        description: "ETL pipeline problem root cause identified as Spark memory configuration issue",
        category: "problem_management",
        subcategory: "rca_completion",
        priority: "high",
        severity: "medium",
        health_status: "yellow",
        impact: "medium",
        source_system: "problem_management",
        compliance_relevant: false,
        retention_days: 730,
        metadata: {
          root_cause: "insufficient_executor_memory",
          investigation_duration_hours: 8,
          incidents_related: 3,
          permanent_fix: "configuration_update",
          workaround: "manual_retry"
        }
      },
      {
        entity_type: "knowledge_base",
        entity_id: `${tenantId}_kb01`,
        action: "access",
        description: "Database replication troubleshooting guide accessed by DBA team member",
        category: "knowledge_management",
        subcategory: "article_access",
        priority: "low",
        severity: "low",
        health_status: "green",
        impact: "none",
        source_system: "knowledge_base",
        compliance_relevant: false,
        retention_days: 30,
        metadata: {
          article_title: "Database Replication Lag Resolution",
          accessed_by: `${tenantId}_user_dba01`,
          article_version: "3.0",
          helpful_rating: true,
          time_spent_seconds: 240
        }
      },
      {
        entity_type: "compliance",
        entity_id: `${tenantId}_comp01`,
        action: "verify",
        description: "SOX compliance verification completed for financial reporting systems",
        category: "compliance",
        subcategory: "audit_verification",
        priority: "critical",
        severity: "low",
        health_status: "green",
        impact: "compliance",
        source_system: "compliance_manager",
        compliance_relevant: true,
        retention_days: 2555,
        metadata: {
          framework: "SOX",
          control_id: "SOX-404",
          verification_result: "passed",
          auditor: "external_auditor_01",
          next_review: "2025-04-01T00:00:00Z"
        }
      },
      {
        entity_type: "backup",
        entity_id: `${tenantId}_backup01`,
        action: "complete",
        description: "Database backup completed successfully for disaster recovery compliance",
        category: "backup_recovery",
        subcategory: "backup_completion",
        priority: "high",
        severity: "low",
        health_status: "green",
        impact: "positive",
        source_system: "backup_service",
        compliance_relevant: true,
        retention_days: 365,
        metadata: {
          backup_type: "full",
          database_name: "financial_reporting",
          size_gb: 850,
          duration_minutes: 45,
          encryption: "aes-256",
          storage_location: "offsite_dr"
        }
      }
    ],
  };

  const logs = (perTenantLogs[tenantId] || []).map((l) => ({
    id: generateSecureId(),
    tenantId,
    entity_type: l.entity_type,
    entity_id: l.entity_id,
    action: l.action,
    description: l.description,
    timestamp: new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString(), // Random time within last hour
    user_id: l.metadata?.acknowledged_by || l.metadata?.accessed_by || l.metadata?.requested_by || "system",
    category: l.category,
    subcategory: l.subcategory,
    priority: l.priority,
    severity: l.severity,
    health_status: l.health_status,
    impact: l.impact,
    source_system: l.source_system,
    compliance_relevant: l.compliance_relevant,
    retention_days: l.retention_days,
    tags: ["seed", "audit", l.category, l.subcategory, l.action],
    hash: `seed_hash_${l.entity_id}_${Date.now()}_${Math.random()}`, // Simplified for seeding
    metadata: {
      ...l.metadata,
      source: "seed_initialization",
      tenant: tenantId,
      seeded_at: now,
      bootstrap_phase: "initial_audit_load",
      audit_trail_version: "1.0.0"
    }
  }));

  // Insert audit logs with proper error handling
  // Note: We don't create additional audit logs for audit log entries to avoid infinite recursion
  // We also don't create activity timeline entries as this is bootstrap/seed data
  for (const log of logs) {
    try {
      // Generate proper hash for each audit log
      log.hash = await generateHash({
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        action: log.action,
        timestamp: log.timestamp,
        tenantId: log.tenantId
      });

      await db.put("audit_logs", log);
      console.log(`✅ Seeded audit log: ${log.id} - ${log.entity_type}/${log.action} - ${log.description.substring(0, 50)}...`);
    } catch (error) {
      console.error(`❌ Failed to seed audit log ${log.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${logs.length} audit logs for ${tenantId}`);
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