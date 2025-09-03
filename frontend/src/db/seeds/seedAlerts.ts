import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedAlerts = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let alerts: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    alerts = [
      {
        id: `${tenantId}_alert01`,
        tenantId: tenantId,
        title: "Router CPU > 90%",
        description: "Core router CPU utilization high for 5+ minutes.",
        status: "open",
        severity: "critical",
        created_at: now,
        updated_at: now,
        source_system: "Prometheus",
        source_event_ids: [`${tenantId}_event01`],
        correlation_id: null,
        related_incident_id: `${tenantId}_inc01`,
        related_problem_id: `${tenantId}_prob01`,
        related_change_id: null,
        related_asset_ids: [`${tenantId}_asset_router01`],
        related_service_component_ids: [`${tenantId}_comp_router01`],
        business_service_id: `${tenantId}_svc_network`,
        tags: ["cpu", "router", "p1"],
        health_status: "red",
      },
      {
        id: `${tenantId}_alert02`,
        tenantId: tenantId,
        title: "Switch Port Errors",
        description: "High CRC errors detected on TOR switch.",
        status: "acknowledged",
        severity: "warning",
        created_at: now,
        updated_at: now,
        source_system: "Splunk",
        source_event_ids: [],
        correlation_id: null,
        related_incident_id: `${tenantId}_inc02`,
        related_problem_id: null,
        related_change_id: null,
        related_asset_ids: [`${tenantId}_asset_switch01`],
        related_service_component_ids: [`${tenantId}_comp_switch01`],
        business_service_id: `${tenantId}_svc_network`,
        tags: ["switch", "crc"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    alerts = [
      {
        id: `${tenantId}_alert01`,
        tenantId: tenantId,
        title: "Stream Latency > 30s",
        description: "YouTube Live latency exceeded threshold.",
        status: "open",
        severity: "critical",
        created_at: now,
        updated_at: now,
        source_system: "Datadog",
        source_event_ids: [`${tenantId}_event01`],
        correlation_id: null,
        related_incident_id: `${tenantId}_inc01`,
        related_problem_id: null,
        related_change_id: null,
        related_asset_ids: [`${tenantId}_asset_gce_vm01`],
        related_service_component_ids: [`${tenantId}_comp_edge01`],
        business_service_id: `${tenantId}_svc_streaming`,
        tags: ["latency", "streaming", "p1"],
        health_status: "red",
      },
      {
        id: `${tenantId}_alert02`,
        tenantId: tenantId,
        title: "Transcoding Pod OOM Killed",
        description: "GKE pod terminated due to out-of-memory.",
        status: "acknowledged",
        severity: "warning",
        created_at: now,
        updated_at: now,
        source_system: "GKE",
        source_event_ids: [],
        correlation_id: null,
        related_incident_id: `${tenantId}_inc02`,
        related_problem_id: `${tenantId}_prob01`,
        related_change_id: null,
        related_asset_ids: [`${tenantId}_asset_gke_node01`],
        related_service_component_ids: [`${tenantId}_comp_gke_cluster01`],
        business_service_id: `${tenantId}_svc_transcoding`,
        tags: ["gke", "oom", "transcoding"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    alerts = [
      {
        id: `${tenantId}_alert01`,
        tenantId: tenantId,
        title: "Mail Queue Backlog > 500",
        description: "Exchange mail queues are growing rapidly.",
        status: "open",
        severity: "critical",
        created_at: now,
        updated_at: now,
        source_system: "Exchange Monitor",
        source_event_ids: [],
        correlation_id: null,
        related_incident_id: `${tenantId}_inc01`,
        related_problem_id: null,
        related_change_id: null,
        related_asset_ids: [`${tenantId}_asset_mx01`],
        related_service_component_ids: [`${tenantId}_comp_exchange01`],
        business_service_id: `${tenantId}_svc_email`,
        tags: ["exchange", "mail", "queue"],
        health_status: "red",
      },
      {
        id: `${tenantId}_alert02`,
        tenantId: tenantId,
        title: "VPN Tunnel Drops",
        description: "Intermittent tunnel drops on VPN appliance.",
        status: "acknowledged",
        severity: "warning",
        created_at: now,
        updated_at: now,
        source_system: "Cisco ASA",
        source_event_ids: [],
        correlation_id: null,
        related_incident_id: `${tenantId}_inc02`,
        related_problem_id: `${tenantId}_prob01`,
        related_change_id: null,
        related_asset_ids: [`${tenantId}_asset_vpn_appliance01`],
        related_service_component_ids: [`${tenantId}_comp_vpn01`],
        business_service_id: `${tenantId}_svc_vpn`,
        tags: ["vpn", "tunnel"],
        health_status: "orange",
      },
    ];
  }

  // Insert into IndexedDB
  for (const alert of alerts) {
    await db.put("alerts", alert);

    // Light Audit log
    await db.put("audit_logs", {
      id: `${alert.id}_audit01`,
      tenantId: tenantId,
      entity_type: "alert",
      entity_id: alert.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + alert.id,
      tags: ["seed"],
    });

    // Light Activity timeline
    await db.put("activities", {
      id: `${alert.id}_act01`,
      tenantId: tenantId,
      type: "alert",
      entity_id: alert.id,
      action: "created",
      description: `Alert "${alert.title}" seeded`,
      timestamp: now,
      related_entity_ids: alert.related_asset_ids.map((id: string) => ({
        type: "asset",
        id,
      })),
      tags: ["seed"],
    });
  }
};