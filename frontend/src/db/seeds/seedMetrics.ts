import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedMetrics = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let metrics: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    metrics = [
      {
        id: `${tenantId}_metric01`,
        tenantId: tenantId,
        source_system: "Prometheus",
        name: "router_cpu_usage",
        value: 92,
        unit: "%",
        captured_at: now,
        asset_id: `${tenantId}_asset_router01`,
        service_component_id: `${tenantId}_comp_router01`,
        business_service_id: `${tenantId}_svc_network`,
        tags: ["cpu", "router"],
        health_status: "red",
      },
      {
        id: `${tenantId}_metric02`,
        tenantId: tenantId,
        source_system: "Prometheus",
        name: "switch_port_errors",
        value: 150,
        unit: "errors/s",
        captured_at: now,
        asset_id: `${tenantId}_asset_switch01`,
        service_component_id: `${tenantId}_comp_switch01`,
        business_service_id: `${tenantId}_svc_network`,
        tags: ["switch", "crc"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    metrics = [
      {
        id: `${tenantId}_metric01`,
        tenantId: tenantId,
        source_system: "Datadog",
        name: "stream_latency",
        value: 32000,
        unit: "ms",
        captured_at: now,
        asset_id: `${tenantId}_asset_gce_vm01`,
        service_component_id: `${tenantId}_comp_edge01`,
        business_service_id: `${tenantId}_svc_streaming`,
        tags: ["latency", "streaming"],
        health_status: "red",
      },
      {
        id: `${tenantId}_metric02`,
        tenantId: tenantId,
        source_system: "GKE",
        name: "pod_memory_usage",
        value: 85,
        unit: "%",
        captured_at: now,
        asset_id: `${tenantId}_asset_gke_node01`,
        service_component_id: `${tenantId}_comp_gke_cluster01`,
        business_service_id: `${tenantId}_svc_transcoding`,
        tags: ["memory", "pod"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    metrics = [
      {
        id: `${tenantId}_metric01`,
        tenantId: tenantId,
        source_system: "Exchange Monitor",
        name: "mail_queue_depth",
        value: 650,
        unit: "messages",
        captured_at: now,
        asset_id: `${tenantId}_asset_mx01`,
        service_component_id: `${tenantId}_comp_exchange01`,
        business_service_id: `${tenantId}_svc_email`,
        tags: ["exchange", "queue"],
        health_status: "red",
      },
      {
        id: `${tenantId}_metric02`,
        tenantId: tenantId,
        source_system: "Cisco ASA",
        name: "vpn_tunnel_drops",
        value: 12,
        unit: "drops/min",
        captured_at: now,
        asset_id: `${tenantId}_asset_vpn_appliance01`,
        service_component_id: `${tenantId}_comp_vpn01`,
        business_service_id: `${tenantId}_svc_vpn`,
        tags: ["vpn", "tunnel"],
        health_status: "orange",
      },
    ];
  }

  for (const metric of metrics) {
    await db.put("metrics", metric);

    // Light audit log
    await db.put("audit_logs", {
      id: `${metric.id}_audit01`,
      tenantId: tenantId,
      entity_type: "metric",
      entity_id: metric.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + metric.id,
      tags: ["seed"],
    });

    // Light activity
    await db.put("activities", {
      id: `${metric.id}_act01`,
      tenantId: tenantId,
      type: "metric",
      entity_id: metric.id,
      action: "collected",
      description: `Metric "${metric.name}" seeded`,
      timestamp: now,
      related_entity_ids: metric.asset_id
        ? [{ type: "asset", id: metric.asset_id }]
        : [],
      tags: ["seed"],
    });
  }
};