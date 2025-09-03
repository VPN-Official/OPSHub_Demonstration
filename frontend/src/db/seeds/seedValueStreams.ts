import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedValueStreams = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let streams: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    streams = [
      {
        id: `${tenantId}_vs01`,
        tenantId: tenantId,
        name: "Data Center Networking",
        description: "End-to-end networking for Meta’s global DCN.",
        industry: "Hi-Tech",
        tier: "gold",
        created_at: now,
        updated_at: now,
        business_service_ids: [],
        customer_ids: [],
        cost_center_ids: [],
        enterprise_kpi_ids: [],
        custom_kpis: [],
        risk_score: 70,
        tags: ["networking", "meta"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    streams = [
      {
        id: `${tenantId}_vs01`,
        tenantId: tenantId,
        name: "AV & Streaming",
        description: "End-to-end video streaming for Google services.",
        industry: "Media",
        tier: "gold",
        created_at: now,
        updated_at: now,
        business_service_ids: [],
        customer_ids: [],
        cost_center_ids: [],
        enterprise_kpi_ids: [],
        custom_kpis: [],
        risk_score: 60,
        tags: ["streaming", "google"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    streams = [
      {
        id: `${tenantId}_vs01`,
        tenantId: tenantId,
        name: "Service Desk",
        description: "End-to-end IT support for Gates Foundation staff.",
        industry: "Non-Profit",
        tier: "silver",
        created_at: now,
        updated_at: now,
        business_service_ids: [],
        customer_ids: [],
        cost_center_ids: [],
        enterprise_kpi_ids: [],
        custom_kpis: [],
        risk_score: 40,
        tags: ["servicedesk", "foundation"],
        health_status: "yellow",
      },
    ];
  }

  for (const vs of streams) {
    await db.put("value_streams", vs);

    // Light audit log
    await db.put("audit_logs", {
      id: `${vs.id}_audit01`,
      tenantId: tenantId,
      entity_type: "value_stream",
      entity_id: vs.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + vs.id,
      tags: ["seed"],
    });

    // Light activity
    await db.put("activities", {
      id: `${vs.id}_act01`,
      tenantId: tenantId,
      type: "value_stream",
      entity_id: vs.id,
      action: "created",
      description: `Value Stream "${vs.name}" seeded`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};