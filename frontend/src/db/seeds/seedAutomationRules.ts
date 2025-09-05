import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedAutomationRules = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let rules: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    rules = [
      {
        id: `${tenantId}_rule01`,
        tenantId,
        name: "Auto-create Incident on CPU Alert",
        description: "Automatically create incidents for critical CPU alerts to ensure rapid response",
        condition: "alert.severity == 'critical' && alert.tags.includes('cpu')",
        action: "create_incident",
        category: "incident_management",
        subcategory: "auto_escalation",
        priority: "high",
        severity: "critical",
        health_status: "green",
        status: "active",
        trigger_count: 0,
        last_triggered: null,
        created_by: "System Administrator",
        created_at: now,
        updated_at: now,
        tags: ["router", "automation", "incident", "cpu", "critical"],
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    rules = [
      {
        id: `${tenantId}_rule01`,
        tenantId,
        name: "Scale Edge Pool on Latency Breach",
        description: "Automatically scale edge computing resources when latency thresholds are exceeded",
        condition: "metric.name == 'Streaming Latency EU Edge' && metric.value > 250",
        action: "scale_out",
        category: "auto_scaling",
        subcategory: "edge_compute",
        priority: "high",
        severity: "medium",
        health_status: "green",
        status: "active",
        trigger_count: 0,
        last_triggered: null,
        created_by: "Cloud Operations Team",
        created_at: now,
        updated_at: now,
        tags: ["streaming", "scaling", "latency", "edge", "gce"],
      },
      {
        id: `${tenantId}_rule02`,
        tenantId,
        name: "Restart OOMKilled Pods",
        description: "Automatically restart pods that have been terminated due to out-of-memory conditions",
        condition: "alert.tags.includes('oom')",
        action: "restart_pod",
        category: "resource_management",
        subcategory: "memory",
        priority: "medium",
        severity: "medium",
        health_status: "yellow",
        status: "active",
        trigger_count: 0,
        last_triggered: null,
        created_by: "Kubernetes Team",
        created_at: now,
        updated_at: now,
        tags: ["gke", "oom", "kubernetes", "restart", "memory"],
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    rules = [
      {
        id: `${tenantId}_rule01`,
        tenantId,
        name: "Alert DBA on Replication Lag",
        description: "Notify database administrators when replication lag exceeds acceptable thresholds",
        condition: "metric.name == 'DB Replication Lag' && metric.value > 30",
        action: "notify_team_dba",
        category: "notification",
        subcategory: "database",
        priority: "critical",
        severity: "high",
        health_status: "red",
        status: "active",
        trigger_count: 0,
        last_triggered: null,
        created_by: "Database Team Lead",
        created_at: now,
        updated_at: now,
        tags: ["database", "replication", "notification", "dba", "lag"],
      },
      {
        id: `${tenantId}_rule02`,
        tenantId,
        name: "Retry ETL Job on Failure",
        description: "Automatically retry failed ETL jobs to improve data pipeline reliability",
        condition: "event.tags.includes('etl') && event.severity == 'major'",
        action: "rerun_etl_job",
        category: "data_pipeline",
        subcategory: "retry_logic",
        priority: "high",
        severity: "medium",
        health_status: "orange",
        status: "active",
        trigger_count: 0,
        last_triggered: null,
        created_by: "Data Engineering Team",
        created_at: now,
        updated_at: now,
        tags: ["etl", "spark", "retry", "data", "pipeline"],
      },
    ];
  }

  // Insert automation rules with proper error handling
  for (const rule of rules) {
    try {
      await db.put("automation_rules", rule);

      // Create COMPLETE audit log entry
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "automation_rule",
        entity_id: rule.id,
        action: "create",
        description: `Automation rule created: "${rule.name}" (${rule.category}/${rule.subcategory}) - Action: ${rule.action}`,
        timestamp: now,
        user_id: "system",
        tags: ["seed", "automation_rule", "create", rule.category],
        hash: await generateHash({
          entity_type: "automation_rule",
          entity_id: rule.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          category: rule.category,
          subcategory: rule.subcategory,
          priority: rule.priority,
          severity: rule.severity,
          status: rule.status,
          action_type: rule.action,
          condition: rule.condition,
          created_by: rule.created_by,
          health_status: rule.health_status,
          trigger_count: rule.trigger_count
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `Automation rule "${rule.name}" created by ${rule.created_by} - Action: ${rule.action}`,
        storeName: "automation_rules",
        recordId: rule.id,
        action: "create",
        userId: "system",
        metadata: {
          rule_id: rule.id,
          category: rule.category,
          subcategory: rule.subcategory,
          priority: rule.priority,
          action_type: rule.action,
          condition: rule.condition,
          created_by: rule.created_by,
          automation_details: {
            trigger_condition: rule.condition,
            action_to_perform: rule.action,
            current_status: rule.status
          }
        }
      });

      console.log(`✅ Seeded automation rule: ${rule.id} - ${rule.name}`);
    } catch (error) {
      console.error(`❌ Failed to seed automation rule ${rule.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${rules.length} automation rules for ${tenantId}`);
};

// Helper function to generate audit hash
async function generateHash(data: any): Promise<string> {
  try {
    const { generateImmutableHash } = await import("../../utils/auditUtils");
    return await generateImmutableHash(data);
  } catch {
    // Fallback for seeding if utils not available
    return `seed_hash_${data.entity_id}_${Date.now()}`;
  }
}