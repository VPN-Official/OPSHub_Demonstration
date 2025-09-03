import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedMetrics = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date();
  let metrics: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    metrics = [
      {
        id: `${tenantId}_metric01`,
        tenantId,
        name: "Router CPU Utilization",
        value: 92,
        unit: "%",
        collected_at: now.toISOString(),
        asset_id: `${tenantId}_asset_router01`,
        service_component_id: `${tenantId}_comp_router01`,
        business_service_id: `${tenantId}_svc_network`,
        tags: ["cpu", "router"],
      },
      {
        id: `${tenantId}_metric02`,
        tenantId,
        name: "Switch Port Error Rate",
        value: 15,
        unit: "errors/min",
        collected_at: now.toISOString(),
        asset_id: `${tenantId}_asset_switch01`,
        service_component_id: `${tenantId}_comp_switch01`,
        business_service_id: `${tenantId}_svc_network`,
        tags: ["switch", "crc"],
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    metrics = [
      {
        id: `${tenantId}_metric01`,
        tenantId,
        name: "Streaming Latency EU Edge",
        value: 280,
        unit: "ms",
        collected_at: now.toISOString(),
        asset_id: `${tenantId}_asset_gce_vm01`,
        service_component_id: `${tenantId}_comp_edge01`,
        business_service_id: `${tenantId}_svc_streaming`,
        tags: ["latency", "edge", "streaming"],
      },
      {
        id: `${tenantId}_metric02`,
        tenantId,
        name: "GKE Pod Memory Usage",
        value: 95,
        unit: "%",
        collected_at: now.toISOString(),
        asset_id: `${tenantId}_asset_gke_node01`,
        service_component_id: `${tenantId}_comp_gke_cluster01`,
        business_service_id: `${tenantId}_svc_transcoding`,
        tags: ["gke", "oom", "memory"],
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    metrics = [
      {
        id: `${tenantId}_metric01`,
        tenantId,
        name: "DB Replication Lag",
        value: 42,
        unit: "minutes",
        collected_at: now.toISOString(),
        asset_id: `${tenantId}_asset_db01`,
        service_component_id: `${tenantId}_comp_reportingdb`,
        business_service_id: `${tenantId}_svc_fin_reporting`,
        tags: ["database", "replication"],
      },
      {
        id: `${tenantId}_metric02`,
        tenantId,
        name: "ETL Job Failure Rate",
        value: 23,
        unit: "%",
        collected_at: now.toISOString(),
        asset_id: `${tenantId}_asset_etl01`,
        service_component_id: `${tenantId}_comp_datalake01`,
        business_service_id: `${tenantId}_svc_data_analytics`,
        tags: ["etl", "spark", "pipeline"],
      },
    ];
  }

  for (const metric of metrics) {
    await db.put("metrics", metric);

    // Audit log
    await db.put("audit_logs", {
      id: `${metric.id}_audit01`,
      tenantId,
      entity_type: "metric",
      entity_id: metric.id,
      action: "collect",
      timestamp: now.toISOString(),
      hash: "hash_" + metric.id,
      tags: ["seed"],
    });

    // Activity
    await db.put("activity_timeline", {
      id: `${metric.id}_act01`,
      tenantId,
      type: "metric",
      entity_id: metric.id,
      action: "collected",
      description: `Metric "${metric.name}" recorded at ${metric.value}${metric.unit}`,
      timestamp: now.toISOString(),
      related_entity_ids: [
        { type: "asset", id: metric.asset_id },
        { type: "service_component", id: metric.service_component_id },
        { type: "business_service", id: metric.business_service_id },
      ],
      tags: ["seed"],
    });
  }
};