import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedIncidents = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let incidents: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    incidents = [
      {
        id: `${tenantId}_inc01`,
        tenantId,
        title: "Router CPU threshold breach",
        description: "Core datacenter router exceeded 95% CPU utilization, impacting east-west traffic.",
        severity: "P1",
        status: "open",
        created_at: now,
        updated_at: now,
        asset_id: `${tenantId}_asset_router01`,
        service_component_id: `${tenantId}_comp_router01`,
        business_service_id: `${tenantId}_svc_network`,
        assigned_team_id: `${tenantId}_team_noc`,
        reported_by: `${tenantId}_user_monitoring`,
        tags: ["network", "cpu", "router"],
      },
      {
        id: `${tenantId}_inc02`,
        tenantId,
        title: "Switch flapping causing packet loss",
        description: "Top-of-rack switch is flapping intermittently, resulting in packet drops for connected servers.",
        severity: "P2",
        status: "investigating",
        created_at: now,
        updated_at: now,
        asset_id: `${tenantId}_asset_switch01`,
        service_component_id: `${tenantId}_comp_switch01`,
        business_service_id: `${tenantId}_svc_network`,
        assigned_team_id: `${tenantId}_team_network`,
        reported_by: `${tenantId}_user_noc01`,
        tags: ["switch", "packetloss"],
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    incidents = [
      {
        id: `${tenantId}_inc01`,
        tenantId,
        title: "Streaming service outage on EU edge node",
        description: "Users in EU region reporting playback failures due to edge node latency and dropped connections.",
        severity: "P1",
        status: "open",
        created_at: now,
        updated_at: now,
        asset_id: `${tenantId}_asset_gce_vm01`,
        service_component_id: `${tenantId}_comp_edge01`,
        business_service_id: `${tenantId}_svc_streaming`,
        assigned_team_id: `${tenantId}_team_sre`,
        reported_by: `${tenantId}_user_alerting`,
        tags: ["streaming", "latency", "edge"],
      },
      {
        id: `${tenantId}_inc02`,
        tenantId,
        title: "GKE transcoding pods OOMKilled",
        description: "Several transcoding pods in GKE cluster were OOM killed, causing backlog in media pipeline.",
        severity: "P2",
        status: "in_progress",
        created_at: now,
        updated_at: now,
        asset_id: `${tenantId}_asset_gke_node01`,
        service_component_id: `${tenantId}_comp_gke_cluster01`,
        business_service_id: `${tenantId}_svc_transcoding`,
        assigned_team_id: `${tenantId}_team_mediaops`,
        reported_by: `${tenantId}_user_devops01`,
        tags: ["gke", "oom", "transcoding"],
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    incidents = [
      {
        id: `${tenantId}_inc01`,
        tenantId,
        title: "Database replication lag",
        description: "Primary-replica sync lag of 45 minutes detected in financial reporting database.",
        severity: "P1",
        status: "open",
        created_at: now,
        updated_at: now,
        asset_id: `${tenantId}_asset_db01`,
        service_component_id: `${tenantId}_comp_reportingdb`,
        business_service_id: `${tenantId}_svc_fin_reporting`,
        assigned_team_id: `${tenantId}_team_dba`,
        reported_by: `${tenantId}_user_monitor01`,
        tags: ["database", "replication", "lag"],
      },
      {
        id: `${tenantId}_inc02`,
        tenantId,
        title: "ETL pipeline failure",
        description: "Nightly ETL job failed, delaying ingestion into analytics data lake.",
        severity: "P2",
        status: "investigating",
        created_at: now,
        updated_at: now,
        asset_id: `${tenantId}_asset_etl01`,
        service_component_id: `${tenantId}_comp_datalake01`,
        business_service_id: `${tenantId}_svc_data_analytics`,
        assigned_team_id: `${tenantId}_team_dataops`,
        reported_by: `${tenantId}_user_dataeng01`,
        tags: ["etl", "pipeline", "datalake"],
      },
    ];
  }

  for (const inc of incidents) {
    await db.put("incidents", inc);

    // Audit log
    await db.put("audit_logs", {
      id: `${inc.id}_audit01`,
      tenantId,
      entity_type: "incident",
      entity_id: inc.id,
      action: "create",
      timestamp: now,
      hash: "hash_" + inc.id,
      tags: ["seed"],
    });

    // Activity
    await db.put("activity_timeline", {
      id: `${inc.id}_act01`,
      tenantId,
      type: "incident",
      entity_id: inc.id,
      action: "created",
      description: `Incident "${inc.title}" created for ${inc.business_service_id}`,
      timestamp: now,
      related_entity_ids: [
        { type: "asset", id: inc.asset_id },
        { type: "service_component", id: inc.service_component_id },
      ],
      tags: ["seed"],
    });
  }
};