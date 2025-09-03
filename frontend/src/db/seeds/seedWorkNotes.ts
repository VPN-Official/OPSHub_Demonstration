import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedWorkNotes = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let workNotes: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    workNotes = [
      {
        id: `${tenantId}_workNotes01`,
        tenantId: tenantId,
        name: "WorkNotes Example 1",
        description: "Seeded WorkNotes entity for DCN Meta.",
        created_at: now,
        updated_at: now,
        tags: ["meta", "workNotes"],
        health_status: "green",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    workNotes = [
      {
        id: `${tenantId}_workNotes01`,
        tenantId: tenantId,
        name: "WorkNotes Example 1",
        description: "Seeded WorkNotes entity for AV Google.",
        created_at: now,
        updated_at: now,
        tags: ["google", "workNotes"],
        health_status: "yellow",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    workNotes = [
      {
        id: `${tenantId}_workNotes01`,
        tenantId: tenantId,
        name: "WorkNotes Example 1",
        description: "Seeded WorkNotes entity for Gates Foundation.",
        created_at: now,
        updated_at: now,
        tags: ["gates", "workNotes"],
        health_status: "orange",
      },
    ];
  }

  for (const entity of workNotes) {
    await db.put("workNotes", entity);

    await db.put("audit_logs", {
      id: `${entity.id}_audit01`,
      tenantId: tenantId,
      entity_type: "workNotes",
      entity_id: entity.id,
      action: "create",
      timestamp: now,
      hash: "hash_" + id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${entity.id}_act01`,
      tenantId: tenantId,
      type: "workNotes",
      entity_id: entity.id,
      action: "created",
      description: `WorkNotes "${entity.name}" seeded`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};
