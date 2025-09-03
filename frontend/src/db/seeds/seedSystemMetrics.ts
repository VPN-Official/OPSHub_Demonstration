import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedSystemMetrics = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let systemMetrics: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    systemMetrics = [
      {
        id: `${tenantId}_systemMetrics01`,
        tenantId: tenantId,
        name: "SystemMetrics Example 1",
        description: "Seeded SystemMetrics entity for DCN Meta.",
        created_at: now,
        updated_at: now,
        tags: ["meta", "systemMetrics"],
        health_status: "green",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    systemMetrics = [
      {
        id: `${tenantId}_systemMetrics01`,
        tenantId: tenantId,
        name: "SystemMetrics Example 1",
        description: "Seeded SystemMetrics entity for AV Google.",
        created_at: now,
        updated_at: now,
        tags: ["google", "systemMetrics"],
        health_status: "yellow",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    systemMetrics = [
      {
        id: `${tenantId}_systemMetrics01`,
        tenantId: tenantId,
        name: "SystemMetrics Example 1",
        description: "Seeded SystemMetrics entity for Gates Foundation.",
        created_at: now,
        updated_at: now,
        tags: ["gates", "systemMetrics"],
        health_status: "orange",
      },
    ];
  }

  for (const entity of systemMetrics) {
    await db.put("systemMetrics", entity);

    await db.put("audit_logs", {
      id: `${entity.id}_audit01`,
      tenantId: tenantId,
      entity_type: "systemMetrics",
      entity_id: entity.id,
      action: "create",
      timestamp: now,
      hash: "hash_" + id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${entity.id}_act01`,
      tenantId: tenantId,
      type: "systemMetrics",
      entity_id: entity.id,
      action: "created",
      description: `SystemMetrics "${entity.name}" seeded`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};
