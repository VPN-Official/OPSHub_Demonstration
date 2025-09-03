import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedAutomationRules = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let rules: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    rules = [
      {
        id: `${tenantId}_auto01`,
        tenantId: tenantId,
        name: "Auto-Restart Router Process",
        type: "script",
        status: "approved",
        script: "restart-router.sh",
        tags: ["router", "automation"],
        created_at: now,
        updated_at: now,
        health_status: "yellow",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    rules = [
      {
        id: `${tenantId}_auto01`,
        tenantId: tenantId,
        name: "Auto-Scale Edge Nodes",
        type: "workflow",
        status: "approved",
        script: "gcloud scale edge",
        tags: ["edge", "scaling"],
        created_at: now,
        updated_at: now,
        health_status: "green",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    rules = [
      {
        id: `${tenantId}_auto01`,
        tenantId: tenantId,
        name: "Reset VPN Tunnel",
        type: "script",
        status: "approved",
        script: "reset-vpn.sh",
        tags: ["vpn", "automation"],
        created_at: now,
        updated_at: now,
        health_status: "orange",
      },
    ];
  }

  for (const rule of rules) {
    await db.put("automation_rules", rule);

    await db.put("audit_logs", {
      id: `${rule.id}_audit01`,
      tenantId: tenantId,
      entity_type: "automation_rule",
      entity_id: rule.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + rule.id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${rule.id}_act01`,
      tenantId: tenantId,
      type: "automation_rule",
      entity_id: rule.id,
      action: "created",
      description: `Automation Rule "${rule.name}" seeded`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};