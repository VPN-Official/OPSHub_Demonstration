import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedEvents = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let events: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    events = [
      {
        id: `${tenantId}_event01`,
        tenant_id: tenantId,
        source_system: "Syslog",
        message: "Router process restarted automatically",
        severity: "info",
        captured_at: now,
        asset_id: `${tenantId}_asset_router01`,
        service_component_id: `${tenantId}_comp_router01`,
        business_service_id: `${tenantId}_svc_network`,
        tags: ["router", "restart"],
        health_status: "yellow",
      },
      {
        id: `${tenantId}_event02`,
        tenant_id: tenantId,
        source_system: "Syslog",
        message: "BGP session flaps detected on edge switch",
        severity: "warning",
        captured_at: now,
        asset_id: `${tenantId}_asset_switch01`,
        service_component_id: `${tenantId}_comp_switch01`,
        business_service_id: `${tenantId}_svc_network`,
        tags: ["bgp", "flap"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    events = [
      {
        id: `${tenantId}_event01`,
        tenant_id: tenantId,
        source_system: "GKE",
        message: "Autoscaling triggered: 5 new pods added",
        severity: "info",
        captured_at: now,
        asset_id: `${tenantId}_asset_gke_node01`,
        service_component_id: `${tenantId}_comp_gke_cluster01`,
        business_service_id: `${tenantId}_svc_transcoding`,
        tags: ["autoscaling", "gke"],
        health_status: "green",
      },
      {
        id: `${tenantId}_event02`,
        tenant_id: tenantId,
        source_system: "Datadog",
        message: "High latency alert cleared after scaling",
        severity: "info",
        captured_at: now,
        asset_id: `${tenantId}_asset_gce_vm01`,
        service_component_id: `${tenantId}_comp_edge01`,
        business_service_id: `${tenantId}_svc_streaming`,
        tags: ["latency", "resolved"],
        health_status: "green",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    events = [
      {
        id: `${tenantId}_event01`,
        tenant_id: tenantId,
        source_system: "Exchange Monitor",
        message: "Database backup completed successfully",
        severity: "info",
        captured_at: now,
        asset_id: `${tenantId}_asset_mx01`,
        service_component_id: `${tenantId}_comp_exchange01`,
        business_service_id: `${tenantId}_svc_email`,
        tags: ["backup", "exchange"],
        health_status: "green",
      },
      {
        id: `${tenantId}_event02`,
        tenant_id: tenantId,
        source_system: "Cisco ASA",
        message: "VPN configuration updated successfully",
        severity: "info",
        captured_at: now,
        asset_id: `${tenantId}_asset_vpn_appliance01`,
        service_component_id: `${tenantId}_comp_vpn01`,
        business_service_id: `${tenantId}_svc_vpn`,
        tags: ["vpn", "config"],
        health_status: "green",
      },
    ];
  }

  for (const event of events) {
    await db.put("events", event);

    // Light audit log
    await db.put("audit_logs", {
      id: `${event.id}_audit01`,
      tenant_id: tenantId,
      entity_type: "event",
      entity_id: event.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + event.id,
      tags: ["seed"],
    });

    // Light activity
    await db.put("activities", {
      id: `${event.id}_act01`,
      tenant_id: tenantId,
      type: "event",
      entity_id: event.id,
      action: "collected",
      description: `Event "${event.message}" seeded`,
      timestamp: now,
      related_entity_ids: event.asset_id
        ? [{ type: "asset", id: event.asset_id }]
        : [],
      tags: ["seed"],
    });
  }
};