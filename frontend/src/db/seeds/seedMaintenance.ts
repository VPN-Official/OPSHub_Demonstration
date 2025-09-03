import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedMaintenance = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let maintenances: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    maintenances = [
      {
        id: `${tenantId}_maintenance01`,
        tenant_id: tenantId,
        name: "Maintenance Example 1",
        description: "Seeded Maintenance entity for DCN Meta.",
        created_at: now,
        updated_at: now,
        tags: ["meta", "maintenance"],
        health_status: "green",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    maintenances = [
      {
        id: `${tenantId}_maintenance01`,
        tenant_id: tenantId,
        name: "Maintenance Example 1",
        description: "Seeded Maintenance entity for AV Google.",
        created_at: now,
        updated_at: now,
        tags: ["google", "maintenance"],
        health_status: "yellow",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    maintenances = [
      {
        id: `${tenantId}_maintenance01`,
        tenant_id: tenantId,
        name: "Maintenance Example 1",
        description: "Seeded Maintenance entity for Gates Foundation.",
        created_at: now,
        updated_at: now,
        tags: ["gates", "maintenance"],
        health_status: "orange",
      },
    ];
  }

  for (const entity of maintenances) {
    await db.put("maintenances", entity);

    await db.put("audit_logs", {
      id: `${entity.id}_audit01`,
      tenant_id: tenantId,
      entity_type: "maintenance",
      entity_id: entity.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + entity.id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${entity.id}_act01`,
      tenant_id: tenantId,
      type: "maintenance",
      entity_id: entity.id,
      action: "created",
      description: `Maintenance "${entity.name}" seeded`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};
