import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedRunbooks = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let runbooks: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    runbooks = [
      {
        id: `${tenantId}_rb01`,
        tenant_id: tenantId,
        title: "Router Firmware Upgrade",
        type: "semi_automated",
        status: "approved",
        steps: [
          { id: "step1", order: 1, description: "Backup config" },
          { id: "step2", order: 2, description: "Apply firmware patch" },
          { id: "step3", order: 3, description: "Reboot router" },
        ],
        tags: ["router", "upgrade"],
        created_at: now,
        updated_at: now,
        health_status: "yellow",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    runbooks = [
      {
        id: `${tenantId}_rb01`,
        tenant_id: tenantId,
        title: "GKE Pod Restart Procedure",
        type: "manual",
        status: "approved",
        steps: [
          { id: "step1", order: 1, description: "Identify failing pod" },
          { id: "step2", order: 2, description: "Restart via kubectl" },
        ],
        tags: ["gke", "pod"],
        created_at: now,
        updated_at: now,
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    runbooks = [
      {
        id: `${tenantId}_rb01`,
        tenant_id: tenantId,
        title: "Exchange Mail Queue Clear",
        type: "manual",
        status: "approved",
        steps: [
          { id: "step1", order: 1, description: "Check backlog count" },
          { id: "step2", order: 2, description: "Clear stuck messages" },
        ],
        tags: ["exchange", "queue"],
        created_at: now,
        updated_at: now,
        health_status: "red",
      },
    ];
  }

  for (const rb of runbooks) {
    await db.put("runbooks", rb);

    await db.put("audit_logs", {
      id: `${rb.id}_audit01`,
      tenant_id: tenantId,
      entity_type: "runbook",
      entity_id: rb.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + rb.id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${rb.id}_act01`,
      tenant_id: tenantId,
      type: "runbook",
      entity_id: rb.id,
      action: "created",
      description: `Runbook "${rb.title}" seeded`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};