import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedLogs = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let logs: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    logs = [
      {
        id: `${tenantId}_log01`,
        tenantId,
        source_system: "Syslog",
        message: "CRITICAL: Router CPU utilization exceeded 90%",
        level: "error",
        captured_at: now,
        asset_id: `${tenantId}_asset_router01`,
        service_component_id: `${tenantId}_comp_router01`,
        business_service_id: `${tenantId}_svc_network`,
        tags: ["router", "cpu"],
        health_status: "red",
      },
      {
        id: `${tenantId}_log02`,
        tenantId,
        source_system: "Syslog",
        message: "WARN: Switch port errors increasing on TOR switch",
        level: "warn",
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
    logs = [
      {
        id: `${tenantId}_log01`,
        tenantId,
        source_system: "Stackdriver",
        message: "ERROR: Stream latency threshold breached on EU edge node",
        level: "error",
        captured_at: now,
        asset_id: `${tenantId}_asset_gce_vm01`,
        service_component_id: `${tenantId}_comp_edge01`,
        business_service_id: `${tenantId}_svc_streaming`,
        tags: ["latency", "streaming"],
        health_status: "red",
      },
      {
        id: `${tenantId}_log02`,
        tenantId,
        source_system: "GKE",
        message: "WARN: Pod OOM kill event detected in transcoding workload",
        level: "warn",
        captured_at: now,
        asset_id: `${tenantId}_asset_gke_node01`,
        service_component_id: `${tenantId}_comp_gke_cluster01`,
        business_service_id: `${tenantId}_svc_transcoding`,
        tags: ["gke", "oom"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    logs = [
      {
        id: `${tenantId}_log01`,
        tenantId,
        source_system: "CloudWatch",
        message: "ERROR: Mail queue backlog exceeded 500 messages",
        level: "error",
        captured_at: now,
        asset_id: `${tenantId}_asset_mx01`,
        service_component_id: `${tenantId}_comp_exchange01`,
        business_service_id: `${tenantId}_svc_email`,
        tags: ["exchange", "queue"],
        health_status: "red",
      },
      {
        id: `${tenantId}_log02`,
        tenantId,
        source_system: "Cisco ASA",
        message: "WARN: VPN tunnel drops observed during peak hours",
        level: "warn",
        captured_at: now,
        asset_id: `${tenantId}_asset_vpn_appliance01`,
        service_component_id: `${tenantId}_comp_vpn01`,
        business_service_id: `${tenantId}_svc_vpn`,
        tags: ["vpn", "tunnel"],
        health_status: "orange",
      },
    ];
  }

  for (const log of logs) {
    await db.put("logs", log);

    // Audit log
    await db.put("audit_logs", {
      id: `${log.id}_audit01`,
      tenantId,
      entity_type: "log",
      entity_id: log.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + log.id,
      tags: ["seed"],
    });

    // Activity
    await db.put("activities", {
      id: `${log.id}_act01`,
      tenantId,
      type: "log",
      entity_id: log.id,
      action: "collected",
      description: `Log from ${log.source_system} seeded`,
      timestamp: now,
      related_entity_ids: log.asset_id
        ? [{ type: "asset", id: log.asset_id }]
        : [],
      tags: ["seed"],
    });
  }
};