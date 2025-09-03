import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedAutomationRules = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let rules: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    rules = [
      {
        id: `${tenantId}_rule01`,
        tenantId,
        name: "Auto-create Incident on CPU Alert",
        condition: "alert.severity == 'critical' && alert.tags.includes('cpu')",
        action: "create_incident",
        created_at: now,
        tags: ["router", "automation"],
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    rules = [
      {
        id: `${tenantId}_rule01`,
        tenantId,
        name: "Scale Edge Pool on Latency Breach",
        condition: "metric.name == 'Streaming Latency EU Edge' && metric.value > 250",
        action: "scale_out",
        created_at: now,
        tags: ["streaming", "scaling"],
      },
      {
        id: `${tenantId}_rule02`,
        tenantId,
        name: "Restart OOMKilled Pods",
        condition: "alert.tags.includes('oom')",
        action: "restart_pod",
        created_at: now,
        tags: ["gke", "oom"],
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    rules = [
      {
        id: `${tenantId}_rule01`,
        tenantId,
        name: "Alert DBA on Replication Lag",
        condition: "metric.name == 'DB Replication Lag' && metric.value > 30",
        action: "notify_team_dba",
        created_at: now,
        tags: ["database", "replication"],
      },
      {
        id: `${tenantId}_rule02`,
        tenantId,
        name: "Retry ETL Job on Failure",
        condition: "event.tags.includes('etl') && event.severity == 'major'",
        action: "rerun_etl_job",
        created_at: now,
        tags: ["etl", "spark"],
      },
    ];
  }

  for (const rule of rules) {
    await db.put("automation_rules", rule);

    await db.put("audit_logs", {
      id: `${rule.id}_audit01`,
      tenantId,
      entity_type: "automation_rule",
      entity_id: rule.id,
      action: "create",
      timestamp: now,
      hash: "hash_" + rule.id,
      tags: ["seed"],
    });

    await db.put("activity_timeline", {
      id: `${rule.id}_act01`,
      tenantId,
      type: "automation_rule",
      entity_id: rule.id,
      action: "published",
      description: `Automation rule "${rule.name}" published`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};