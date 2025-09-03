import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedActivityTimeline = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let activityTimelines: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    activityTimelines = [
      {
        id: `${tenantId}_activityTimeline01`,
        tenantId: tenantId,
        name: "ActivityTimeline Example 1",
        description: "Seeded ActivityTimeline entity for DCN Meta.",
        created_at: now,
        updated_at: now,
        tags: ["meta", "activityTimeline"],
        health_status: "green",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    activityTimelines = [
      {
        id: `${tenantId}_activityTimeline01`,
        tenantId: tenantId,
        name: "ActivityTimeline Example 1",
        description: "Seeded ActivityTimeline entity for AV Google.",
        created_at: now,
        updated_at: now,
        tags: ["google", "activityTimeline"],
        health_status: "yellow",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    activityTimelines = [
      {
        id: `${tenantId}_activityTimeline01`,
        tenantId: tenantId,
        name: "ActivityTimeline Example 1",
        description: "Seeded ActivityTimeline entity for Gates Foundation.",
        created_at: now,
        updated_at: now,
        tags: ["gates", "activityTimeline"],
        health_status: "orange",
      },
    ];
  }

  for (const entity of activityTimelines) {
    await db.put("activityTimelines", entity);

    await db.put("audit_logs", {
      id: `${entity.id}_audit01`,
      tenantId: tenantId,
      entity_type: "activityTimeline",
      entity_id: entity.id,
      action: "create",
      timestamp: now,
      hash: "hash_" + id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${entity.id}_act01`,
      tenantId: tenantId,
      type: "activityTimeline",
      entity_id: entity.id,
      action: "created",
      description: `ActivityTimeline "${entity.name}" seeded`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};
