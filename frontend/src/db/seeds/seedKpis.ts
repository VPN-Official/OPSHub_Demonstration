import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedKpis = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let kpis: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    kpis = [
      {
        id: `${tenantId}_kpi01`,
        tenant_id: tenantId,
        name: "Network Uptime",
        unit: "%",
        description: "Availability of core network services",
        created_at: now,
        updated_at: now,
        tags: ["uptime"],
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    kpis = [
      {
        id: `${tenantId}_kpi01`,
        tenant_id: tenantId,
        name: "Streaming Latency",
        unit: "ms",
        description: "Median stream latency",
        created_at: now,
        updated_at: now,
        tags: ["latency"],
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    kpis = [
      {
        id: `${tenantId}_kpi01`,
        tenant_id: tenantId,
        name: "Ticket Resolution Time",
        unit: "minutes",
        description: "Mean time to resolve tickets",
        created_at: now,
        updated_at: now,
        tags: ["mttr"],
      },
    ];
  }

  for (const kpi of kpis) {
    await db.put("kpis", kpi);

    await db.put("audit_logs", {
      id: `${kpi.id}_audit01`,
      tenant_id: tenantId,
      entity_type: "kpi",
      entity_id: kpi.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + kpi.id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${kpi.id}_act01`,
      tenant_id: tenantId,
      type: "kpi",
      entity_id: kpi.id,
      action: "created",
      description: `KPI "${kpi.name}" seeded`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};