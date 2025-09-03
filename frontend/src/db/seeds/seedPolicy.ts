import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedPolicy = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let policys: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    policys = [
      {
        id: `${tenantId}_policy01`,
        tenantId: tenantId,
        name: "Policy Example 1",
        description: "Seeded Policy entity for DCN Meta.",
        created_at: now,
        updated_at: now,
        tags: ["meta", "policy"],
        health_status: "green",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    policys = [
      {
        id: `${tenantId}_policy01`,
        tenantId: tenantId,
        name: "Policy Example 1",
        description: "Seeded Policy entity for AV Google.",
        created_at: now,
        updated_at: now,
        tags: ["google", "policy"],
        health_status: "yellow",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    policys = [
      {
        id: `${tenantId}_policy01`,
        tenantId: tenantId,
        name: "Policy Example 1",
        description: "Seeded Policy entity for Gates Foundation.",
        created_at: now,
        updated_at: now,
        tags: ["gates", "policy"],
        health_status: "orange",
      },
    ];
  }

  for (const entity of policys) {
    await db.put("policys", entity);

    await db.put("audit_logs", {
      id: `${entity.id}_audit01`,
      tenantId: tenantId,
      entity_type: "policy",
      entity_id: entity.id,
      action: "create",
      timestamp: now,
      hash: "hash_" + id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${entity.id}_act01`,
      tenantId: tenantId,
      type: "policy",
      entity_id: entity.id,
      action: "created",
      description: `Policy "${entity.name}" seeded`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};
