import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedEvents = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date();
  let events: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    events = [
      {
        id: `${tenantId}_evt01`,
        tenantId,
        title: "Network Degradation Detected",
        description: "Aggregated alerts show router CPU and switch errors impacting datacenter traffic.",
        severity: "major",
        status: "active",
        detected_at: now.toISOString(),
        related_alert_ids: [`${tenantId}_alert01`, `${tenantId}_alert02`],
        asset_id: `${tenantId}_asset_router01`,
        service_component_id: `${tenantId}_comp_router01`,
        business_service_id: `${tenantId}_svc_network`,
        tags: ["network", "degradation"],
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    events = [
      {
        id: `${tenantId}_evt01`,
        tenantId,
        title: "Streaming Latency Event",
        description: "Clustered metrics & alerts indicate degraded performance at EU edge node.",
        severity: "critical",
        status: "active",
        detected_at: now.toISOString(),
        related_alert_ids: [`${tenantId}_alert01`],
        asset_id: `${tenantId}_asset_gce_vm01`,
        service_component_id: `${tenantId}_comp_edge01`,
        business_service_id: `${tenantId}_svc_streaming`,
        tags: ["streaming", "latency", "edge"],
      },
      {
        id: `${tenantId}_evt02`,
        tenantId,
        title: "Transcoding Workload Instability",
        description: "Multiple pod OOM kills aggregated into a workload-level event.",
        severity: "major",
        status: "active",
        detected_at: now.toISOString(),
        related_alert_ids: [`${tenantId}_alert02`],
        asset_id: `${tenantId}_asset_gke_node01`,
        service_component_id: `${tenantId}_comp_gke_cluster01`,
        business_service_id: `${tenantId}_svc_transcoding`,
        tags: ["gke", "oom", "transcoding"],
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    events = [
      {
        id: `${tenantId}_evt01`,
        tenantId,
        title: "Replication Lag Event",
        description: "CloudWatch alerts + DB metrics correlated: replication lag > 40 min.",
        severity: "critical",
        status: "active",
        detected_at: now.toISOString(),
        related_alert_ids: [`${tenantId}_alert01`],
        asset_id: `${tenantId}_asset_db01`,
        service_component_id: `${tenantId}_comp_reportingdb`,
        business_service_id: `${tenantId}_svc_fin_reporting`,
        tags: ["database", "replication"],
      },
      {
        id: `${tenantId}_evt02`,
        tenantId,
        title: "ETL Pipeline Degradation",
        description: "ETL failure rates above 20% flagged as service event.",
        severity: "major",
        status: "active",
        detected_at: now.toISOString(),
        related_alert_ids: [`${tenantId}_alert02`],
        asset_id: `${tenantId}_asset_etl01`,
        service_component_id: `${tenantId}_comp_datalake01`,
        business_service_id: `${tenantId}_svc_data_analytics`,
        tags: ["etl", "spark", "pipeline"],
      },
    ];
  }

  for (const evt of events) {
    await db.put("events", evt);

    // Audit log
    await db.put("audit_logs", {
      id: `${evt.id}_audit01`,
      tenantId,
      entity_type: "event",
      entity_id: evt.id,
      action: "create",
      timestamp: now.toISOString(),
      immutable_hash: "hash_" + evt.id,
      tags: ["seed"],
    });

    // Activity
    await db.put("activities", {
      id: `${evt.id}_act01`,
      tenantId,
      type: "event",
      entity_id: evt.id,
      action: "detected",
      description: `Event "${evt.title}" detected with severity ${evt.severity}`,
      timestamp: now.toISOString(),
      related_entity_ids: [
        { type: "asset", id: evt.asset_id },
        { type: "service_component", id: evt.service_component_id },
        { type: "business_service", id: evt.business_service_id },
      ],
      tags: ["seed"],
    });
  }
};