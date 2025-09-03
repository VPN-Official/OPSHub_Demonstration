import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedKpis = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let kpis: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    kpis = [
      {
        id: `${tenantId}_kpi01`,
        tenantId,
        name: "Network Uptime",
        value: 99.95,
        unit: "%",
        target: 99.9,
        measured_at: now,
        business_service_id: `${tenantId}_svc_network`,
        tags: ["uptime", "sla"],
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    kpis = [
      {
        id: `${tenantId}_kpi01`,
        tenantId,
        name: "Streaming Latency SLA Compliance",
        value: 92,
        unit: "%",
        target: 95,
        measured_at: now,
        business_service_id: `${tenantId}_svc_streaming`,
        tags: ["latency", "sla"],
      },
      {
        id: `${tenantId}_kpi02`,
        tenantId,
        name: "Transcoding Job Success Rate",
        value: 87,
        unit: "%",
        target: 95,
        measured_at: now,
        business_service_id: `${tenantId}_svc_transcoding`,
        tags: ["transcoding", "success_rate"],
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    kpis = [
      {
        id: `${tenantId}_kpi01`,
        tenantId,
        name: "Timely Regulatory Reports",
        value: 97,
        unit: "%",
        target: 100,
        measured_at: now,
        business_service_id: `${tenantId}_svc_fin_reporting`,
        tags: ["reporting", "compliance"],
      },
      {
        id: `${tenantId}_kpi02`,
        tenantId,
        name: "ETL Job Completion",
        value: 91,
        unit: "%",
        target: 98,
        measured_at: now,
        business_service_id: `${tenantId}_svc_data_analytics`,
        tags: ["etl", "pipeline"],
      },
    ];
  }

  for (const kpi of kpis) {
    await db.put("kpis", kpi);

    await db.put("audit_logs", {
      id: `${kpi.id}_audit01`,
      tenantId,
      entity_type: "kpi",
      entity_id: kpi.id,
      action: "record",
      timestamp: now,
      hash: "hash_" + kpi.id,
      tags: ["seed"],
    });

    await db.put("activity_timeline", {
      id: `${kpi.id}_act01`,
      tenantId,
      type: "kpi",
      entity_id: kpi.id,
      action: "recorded",
      description: `KPI "${kpi.name}" recorded at ${kpi.value}${kpi.unit}`,
      timestamp: now,
      related_entity_ids: [{ type: "business_service", id: kpi.business_service_id }],
      tags: ["seed"],
    });
  }
};