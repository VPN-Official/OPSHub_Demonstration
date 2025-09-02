import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedIncidents = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let incidents: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    incidents = [
      {
        id: `${tenantId}_inc01`,
        tenant_id: tenantId,
        title: "Core Router Down in SJC-1",
        description: "Major backbone outage affecting traffic in US-West region.",
        status: "new",
        priority: "P1",
        impact: "critical",
        urgency: "high",
        created_at: now,
        updated_at: now,
        business_service_id: `${tenantId}_svc_network`,
        service_component_ids: [`${tenantId}_comp_router01`],
        asset_ids: [`${tenantId}_asset_router01`],
        related_alert_ids: [`${tenantId}_alert_router_cpu`],
        tags: ["network", "backbone", "critical"],
        health_status: "red",
      },
      {
        id: `${tenantId}_inc02`,
        tenant_id: tenantId,
        title: "High Latency in DCN Fabric",
        description: "Packet drops detected in EU region, impacting inter-DC replication.",
        status: "in_progress",
        priority: "P2",
        impact: "high",
        urgency: "medium",
        created_at: now,
        updated_at: now,
        business_service_id: `${tenantId}_svc_network`,
        service_component_ids: [`${tenantId}_comp_switch01`],
        asset_ids: [`${tenantId}_asset_switch01`],
        related_alert_ids: [],
        tags: ["latency", "fabric"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    incidents = [
      {
        id: `${tenantId}_inc01`,
        tenant_id: tenantId,
        title: "YouTube Live Streaming Outage",
        description: "Streaming buffers >30s on EU region edge nodes.",
        status: "new",
        priority: "P1",
        impact: "critical",
        urgency: "high",
        created_at: now,
        updated_at: now,
        business_service_id: `${tenantId}_svc_streaming`,
        service_component_ids: [`${tenantId}_comp_edge01`],
        asset_ids: [`${tenantId}_asset_gce_vm01`],
        related_alert_ids: [`${tenantId}_alert_stream_latency`],
        tags: ["streaming", "latency", "p1"],
        health_status: "red",
      },
      {
        id: `${tenantId}_inc02`,
        tenant_id: tenantId,
        title: "Transcoding Cluster Overloaded",
        description: "High CPU usage on transcoding workloads.",
        status: "in_progress",
        priority: "P2",
        impact: "high",
        urgency: "medium",
        created_at: now,
        updated_at: now,
        business_service_id: `${tenantId}_svc_transcoding`,
        service_component_ids: [`${tenantId}_comp_gke_cluster01`],
        asset_ids: [`${tenantId}_asset_gke_node01`],
        related_alert_ids: [],
        tags: ["transcoding", "cpu"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    incidents = [
      {
        id: `${tenantId}_inc01`,
        tenant_id: tenantId,
        title: "Email Service Unavailable",
        description: "Foundation staff unable to send/receive email.",
        status: "new",
        priority: "P1",
        impact: "high",
        urgency: "high",
        created_at: now,
        updated_at: now,
        business_service_id: `${tenantId}_svc_email`,
        service_component_ids: [`${tenantId}_comp_exchange01`],
        asset_ids: [`${tenantId}_asset_mx01`],
        related_alert_ids: [`${tenantId}_alert_mail_queue`],
        tags: ["email", "servicedesk", "foundation"],
        health_status: "red",
      },
      {
        id: `${tenantId}_inc02`,
        tenant_id: tenantId,
        title: "VPN Access Issues",
        description: "Remote staff unable to authenticate into VPN.",
        status: "in_progress",
        priority: "P2",
        impact: "medium",
        urgency: "medium",
        created_at: now,
        updated_at: now,
        business_service_id: `${tenantId}_svc_vpn`,
        service_component_ids: [`${tenantId}_comp_vpn01`],
        asset_ids: [`${tenantId}_asset_vpn_appliance01`],
        related_alert_ids: [],
        tags: ["vpn", "access"],
        health_status: "orange",
      },
    ];
  }

  // Insert into IndexedDB
  for (const inc of incidents) {
    await db.put("incidents", inc);

    // Light Audit log
    await db.put("audit_logs", {
      id: `${inc.id}_audit01`,
      tenant_id: tenantId,
      entity_type: "incident",
      entity_id: inc.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + inc.id,
      tags: ["seed"],
    });

    // Light Activity timeline
    await db.put("activities", {
      id: `${inc.id}_act01`,
      tenant_id: tenantId,
      type: "incident",
      entity_id: inc.id,
      action: "created",
      description: `Incident "${inc.title}" seeded`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};