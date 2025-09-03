import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedRunbooks = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let runbooks: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    runbooks = [
      {
        id: `${tenantId}_rb01`,
        tenantId,
        title: "Router Firmware Upgrade Procedure",
        steps: [
          "Backup current configuration.",
          "Apply firmware package.",
          "Reload device and validate routing tables.",
        ],
        related_change_id: `${tenantId}_chg01`,
        created_at: now,
        tags: ["router", "firmware", "runbook"],
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    runbooks = [
      {
        id: `${tenantId}_rb01`,
        tenantId,
        title: "Scaling Edge Node Pool",
        steps: [
          "Update autoscaler config.",
          "Validate latency improvements.",
          "Confirm rollback policy is active.",
        ],
        related_change_id: `${tenantId}_chg01`,
        created_at: now,
        tags: ["scaling", "edge", "gce"],
      },
      {
        id: `${tenantId}_rb02`,
        tenantId,
        title: "Update GKE Pod Memory Limits",
        steps: [
          "Modify deployment resource specs.",
          "Roll out new configuration.",
          "Monitor for OOM kill reduction.",
        ],
        related_change_id: `${tenantId}_chg02`,
        created_at: now,
        tags: ["gke", "memory", "runbook"],
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    runbooks = [
      {
        id: `${tenantId}_rb01`,
        tenantId,
        title: "Replication Tuning Procedure",
        steps: [
          "Enable parallel replication.",
          "Adjust replica I/O thread pool size.",
          "Validate replication lag reduction.",
        ],
        related_change_id: `${tenantId}_chg01`,
        created_at: now,
        tags: ["database", "replication", "runbook"],
      },
      {
        id: `${tenantId}_rb02`,
        tenantId,
        title: "ETL Retry Policy Implementation",
        steps: [
          "Enable checkpointing in Spark job config.",
          "Set retry attempts = 3.",
          "Validate job completion rates.",
        ],
        related_change_id: `${tenantId}_chg02`,
        created_at: now,
        tags: ["etl", "spark", "runbook"],
      },
    ];
  }

  for (const rb of runbooks) {
    await db.put("runbooks", rb);

    await db.put("audit_logs", {
      id: `${rb.id}_audit01`,
      tenantId,
      entity_type: "runbook",
      entity_id: rb.id,
      action: "create",
      timestamp: now,
      hash: "hash_" + rb.id,
      tags: ["seed"],
    });

    await db.put("activity_timeline", {
      id: `${rb.id}_act01`,
      tenantId,
      type: "runbook",
      entity_id: rb.id,
      action: "published",
      description: `Runbook "${rb.title}" published`,
      timestamp: now,
      related_entity_ids: [{ type: "change_request", id: rb.related_change_id }],
      tags: ["seed"],
    });
  }
};