import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedEndUsers = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let endUsers: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    endUsers = [
      {
        id: `${tenantId}_endUsers01`,
        tenant_id: tenantId,
        name: "EndUsers Example 1",
        description: "Seeded EndUsers entity for DCN Meta.",
        created_at: now,
        updated_at: now,
        tags: ["meta", "endUsers"],
        health_status: "green",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    endUsers = [
      {
        id: `${tenantId}_endUsers01`,
        tenant_id: tenantId,
        name: "EndUsers Example 1",
        description: "Seeded EndUsers entity for AV Google.",
        created_at: now,
        updated_at: now,
        tags: ["google", "endUsers"],
        health_status: "yellow",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    endUsers = [
      {
        id: `${tenantId}_endUsers01`,
        tenant_id: tenantId,
        name: "EndUsers Example 1",
        description: "Seeded EndUsers entity for Gates Foundation.",
        created_at: now,
        updated_at: now,
        tags: ["gates", "endUsers"],
        health_status: "orange",
      },
    ];
  }

  for (const entity of endUsers) {
    await db.put("endUsers", entity);

    await db.put("audit_logs", {
      id: `${entity.id}_audit01`,
      tenant_id: tenantId,
      entity_type: "endUsers",
      entity_id: entity.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + entity.id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${entity.id}_act01`,
      tenant_id: tenantId,
      type: "endUsers",
      entity_id: entity.id,
      action: "created",
      description: `EndUsers "${entity.name}" seeded`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};
