import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedStakeholderComms = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let stakeholderComms: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    stakeholderComms = [
      {
        id: `${tenantId}_stakeholderComms01`,
        tenantId: tenantId,
        name: "StakeholderComms Example 1",
        description: "Seeded StakeholderComms entity for DCN Meta.",
        created_at: now,
        updated_at: now,
        tags: ["meta", "stakeholderComms"],
        health_status: "green",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    stakeholderComms = [
      {
        id: `${tenantId}_stakeholderComms01`,
        tenantId: tenantId,
        name: "StakeholderComms Example 1",
        description: "Seeded StakeholderComms entity for AV Google.",
        created_at: now,
        updated_at: now,
        tags: ["google", "stakeholderComms"],
        health_status: "yellow",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    stakeholderComms = [
      {
        id: `${tenantId}_stakeholderComms01`,
        tenantId: tenantId,
        name: "StakeholderComms Example 1",
        description: "Seeded StakeholderComms entity for Gates Foundation.",
        created_at: now,
        updated_at: now,
        tags: ["gates", "stakeholderComms"],
        health_status: "orange",
      },
    ];
  }

  for (const entity of stakeholderComms) {
    await db.put("stakeholderComms", entity);

    await db.put("audit_logs", {
      id: `${entity.id}_audit01`,
      tenantId: tenantId,
      entity_type: "stakeholderComms",
      entity_id: entity.id,
      action: "create",
      timestamp: now,
      hash: "hash_" + id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${entity.id}_act01`,
      tenantId: tenantId,
      type: "stakeholderComms",
      entity_id: entity.id,
      action: "created",
      description: `StakeholderComms "${entity.name}" seeded`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};
