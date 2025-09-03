import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedWorkItems = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let workItems: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    workItems = [
      {
        id: `${tenantId}_workItems01`,
        tenantId: tenantId,
        name: "WorkItems Example 1",
        description: "Seeded WorkItems entity for DCN Meta.",
        created_at: now,
        updated_at: now,
        tags: ["meta", "workItems"],
        health_status: "green",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    workItems = [
      {
        id: `${tenantId}_workItems01`,
        tenantId: tenantId,
        name: "WorkItems Example 1",
        description: "Seeded WorkItems entity for AV Google.",
        created_at: now,
        updated_at: now,
        tags: ["google", "workItems"],
        health_status: "yellow",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    workItems = [
      {
        id: `${tenantId}_workItems01`,
        tenantId: tenantId,
        name: "WorkItems Example 1",
        description: "Seeded WorkItems entity for Gates Foundation.",
        created_at: now,
        updated_at: now,
        tags: ["gates", "workItems"],
        health_status: "orange",
      },
    ];
  }

  for (const entity of workItems) {
    await db.put("workItems", entity);

    await db.put("audit_logs", {
      id: `${entity.id}_audit01`,
      tenantId: tenantId,
      entity_type: "workItems",
      entity_id: entity.id,
      action: "create",
      timestamp: now,
      hash: "hash_" + id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${entity.id}_act01`,
      tenantId: tenantId,
      type: "workItems",
      entity_id: entity.id,
      action: "created",
      description: `WorkItems "${entity.name}" seeded`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};
