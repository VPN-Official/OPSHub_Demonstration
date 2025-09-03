import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedTeams = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let teams: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    teams = [
      {
        id: `${tenantId}_teams01`,
        tenantId: tenantId,
        name: "Teams Example 1",
        description: "Seeded Teams entity for DCN Meta.",
        created_at: now,
        updated_at: now,
        tags: ["meta", "teams"],
        health_status: "green",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    teams = [
      {
        id: `${tenantId}_teams01`,
        tenantId: tenantId,
        name: "Teams Example 1",
        description: "Seeded Teams entity for AV Google.",
        created_at: now,
        updated_at: now,
        tags: ["google", "teams"],
        health_status: "yellow",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    teams = [
      {
        id: `${tenantId}_teams01`,
        tenantId: tenantId,
        name: "Teams Example 1",
        description: "Seeded Teams entity for Gates Foundation.",
        created_at: now,
        updated_at: now,
        tags: ["gates", "teams"],
        health_status: "orange",
      },
    ];
  }

  for (const entity of teams) {
    await db.put("teams", entity);

    await db.put("audit_logs", {
      id: `${entity.id}_audit01`,
      tenantId: tenantId,
      entity_type: "teams",
      entity_id: entity.id,
      action: "create",
      timestamp: now,
      hash: "hash_" + id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${entity.id}_act01`,
      tenantId: tenantId,
      type: "teams",
      entity_id: entity.id,
      action: "created",
      description: `Teams "${entity.name}" seeded`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};
