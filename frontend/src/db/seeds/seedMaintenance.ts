import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedMaintenance = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date();
  const maintenances: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    maintenances.push(
      {
        id: `${tenantId}_mnt01`,
        tenantId,
        title: "Core Router Firmware Upgrade",
        description: "Scheduled firmware upgrade on Router R1 to address CPU utilization issues.",
        status: "scheduled",
        window_start: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), // +1 day
        window_end: new Date(now.getTime() + 26 * 60 * 60 * 1000).toISOString(),   // +2 hours
        asset_id: `${tenantId}_asset_router01`,
        service_component_id: `${tenantId}_comp_router01`,
        business_service_id: `${tenantId}_svc_network`,
        assigned_team_id: `${tenantId}_team_network`,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        tags: ["router", "firmware", "planned"],
      },
      {
        id: `${tenantId}_mnt02`,
        tenantId,
        title: "TOR Switch Replacement",
        description: "Planned replacement of TOR switch S1 due to recurring packet loss.",
        status: "approved",
        window_start: new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString(), // +3 days
        window_end: new Date(now.getTime() + 74 * 60 * 60 * 1000).toISOString(),   // +2 hours
        asset_id: `${tenantId}_asset_switch01`,
        service_component_id: `${tenantId}_comp_switch01`,
        business_service_id: `${tenantId}_svc_network`,
        assigned_team_id: `${tenantId}_team_network`,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        tags: ["switch", "hardware", "planned"],
      }
    );
  }

  if (tenantId === "tenant_av_google") {
    maintenances.push(
      {
        id: `${tenantId}_mnt01`,
        tenantId,
        title: "Edge VM Scaling Policy Update",
        description: "Scheduled change in scaling policy to optimize streaming performance.",
        status: "scheduled",
        window_start: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(), // +2 days
        window_end: new Date(now.getTime() + 50 * 60 * 60 * 1000).toISOString(),   // +2 hours
        asset_id: `${tenantId}_asset_gce_vm01`,
        service_component_id: `${tenantId}_comp_edge01`,
        business_service_id: `${tenantId}_svc_streaming`,
        assigned_team_id: `${tenantId}_team_sre`,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        tags: ["streaming", "scaling", "planned"],
      },
      {
        id: `${tenantId}_mnt02`,
        tenantId,
        title: "GKE Cluster Node Patching",
        description: "Planned Kubernetes patch rollout on transcoding GKE cluster nodes.",
        status: "approved",
        window_start: new Date(now.getTime() + 96 * 60 * 60 * 1000).toISOString(), // +4 days
        window_end: new Date(now.getTime() + 100 * 60 * 60 * 1000).toISOString(),  // +4 hours
        asset_id: `${tenantId}_asset_gke_node01`,
        service_component_id: `${tenantId}_comp_gke_cluster01`,
        business_service_id: `${tenantId}_svc_transcoding`,
        assigned_team_id: `${tenantId}_team_mediaops`,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        tags: ["gke", "patching", "planned"],
      }
    );
  }

  if (tenantId === "tenant_cloud_morningstar") {
    maintenances.push(
      {
        id: `${tenantId}_mnt01`,
        tenantId,
        title: "DB Cluster Maintenance Window",
        description: "Planned maintenance on reporting DB cluster to improve replication performance.",
        status: "scheduled",
        window_start: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), // +1 day
        window_end: new Date(now.getTime() + 30 * 60 * 60 * 1000).toISOString(),   // +6 hours
        asset_id: `${tenantId}_asset_db01`,
        service_component_id: `${tenantId}_comp_reportingdb`,
        business_service_id: `${tenantId}_svc_fin_reporting`,
        assigned_team_id: `${tenantId}_team_dba`,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        tags: ["database", "maintenance", "planned"],
      },
      {
        id: `${tenantId}_mnt02`,
        tenantId,
        title: "ETL Pipeline Optimization",
        description: "Scheduled Spark config tuning to improve nightly ETL reliability.",
        status: "approved",
        window_start: new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString(), // +3 days
        window_end: new Date(now.getTime() + 74 * 60 * 60 * 1000).toISOString(),   // +2 hours
        asset_id: `${tenantId}_asset_etl01`,
        service_component_id: `${tenantId}_comp_datalake01`,
        business_service_id: `${tenantId}_svc_data_analytics`,
        assigned_team_id: `${tenantId}_team_dataops`,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        tags: ["etl", "spark", "planned"],
      }
    );
  }

  for (const mnt of maintenances) {
    await db.put("maintenances", mnt);

    // Audit log
    await db.put("audit_logs", {
      id: `${mnt.id}_audit01`,
      tenantId,
      entity_type: "maintenance",
      entity_id: mnt.id,
      action: "create",
      timestamp: now.toISOString(),
      immutable_hash: "hash_" + mnt.id,
      tags: ["seed"],
    });

    // Activity
    await db.put("activities", {
      id: `${mnt.id}_act01`,
      tenantId,
      type: "maintenance",
      entity_id: mnt.id,
      action: "scheduled",
      description: `Maintenance "${mnt.title}" scheduled for ${mnt.business_service_id}`,
      timestamp: now.toISOString(),
      related_entity_ids: [
        { type: "asset", id: mnt.asset_id },
        { type: "service_component", id: mnt.service_component_id },
        { type: "business_service", id: mnt.business_service_id },
      ],
      tags: ["seed"],
    });
  }
};