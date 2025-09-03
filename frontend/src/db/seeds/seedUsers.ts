import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedUsers = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let users: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    users = [
      {
        id: `${tenantId}_users01`,
        tenant_id: tenantId,
        name: "Users Example 1",
        description: "Seeded Users entity for DCN Meta.",
        created_at: now,
        updated_at: now,
        tags: ["meta", "users"],
        health_status: "green",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    users = [
      {
        id: `${tenantId}_users01`,
        tenant_id: tenantId,
        name: "Users Example 1",
        description: "Seeded Users entity for AV Google.",
        created_at: now,
        updated_at: now,
        tags: ["google", "users"],
        health_status: "yellow",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    users = [
      {
        id: `${tenantId}_users01`,
        tenant_id: tenantId,
        name: "Users Example 1",
        description: "Seeded Users entity for Gates Foundation.",
        created_at: now,
        updated_at: now,
        tags: ["gates", "users"],
        health_status: "orange",
      },
    ];
  }

  for (const entity of users) {
    await db.put("users", entity);

    await db.put("audit_logs", {
      id: `${entity.id}_audit01`,
      tenant_id: tenantId,
      entity_type: "users",
      entity_id: entity.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + entity.id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${entity.id}_act01`,
      tenant_id: tenantId,
      type: "users",
      entity_id: entity.id,
      action: "created",
      description: `Users "${entity.name}" seeded`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};
