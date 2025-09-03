import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedOnCall = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let onCalls: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    onCalls = [
      {
        id: `${tenantId}_onCall01`,
        tenantId: tenantId,
        name: "OnCall Example 1",
        description: "Seeded OnCall entity for DCN Meta.",
        created_at: now,
        updated_at: now,
        tags: ["meta", "onCall"],
        health_status: "green",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    onCalls = [
      {
        id: `${tenantId}_onCall01`,
        tenantId: tenantId,
        name: "OnCall Example 1",
        description: "Seeded OnCall entity for AV Google.",
        created_at: now,
        updated_at: now,
        tags: ["google", "onCall"],
        health_status: "yellow",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    onCalls = [
      {
        id: `${tenantId}_onCall01`,
        tenantId: tenantId,
        name: "OnCall Example 1",
        description: "Seeded OnCall entity for Gates Foundation.",
        created_at: now,
        updated_at: now,
        tags: ["gates", "onCall"],
        health_status: "orange",
      },
    ];
  }

  for (const entity of onCalls) {
    await db.put("onCalls", entity);

    await db.put("audit_logs", {
      id: `${entity.id}_audit01`,
      tenantId: tenantId,
      entity_type: "onCall",
      entity_id: entity.id,
      action: "create",
      timestamp: now,
      hash: "hash_" + id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${entity.id}_act01`,
      tenantId: tenantId,
      type: "onCall",
      entity_id: entity.id,
      action: "created",
      description: `OnCall "${entity.name}" seeded`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};
