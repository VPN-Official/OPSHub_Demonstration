import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedServiceRequests = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let requests: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    requests = [
      {
        id: `${tenantId}_sr01`,
        tenantId,
        title: "Request VPN access for contractor",
        description: "New contractor requires VPN access to datacenter systems.",
        status: "open",
        priority: "medium",
        requested_by: `${tenantId}_user_enduser01`,
        assigned_team_id: `${tenantId}_team_network`,
        business_service_id: `${tenantId}_svc_network`,
        created_at: now,
        updated_at: now,
        tags: ["vpn", "access"],
      },
      {
        id: `${tenantId}_sr02`,
        tenantId,
        title: "Upgrade bandwidth for project servers",
        description: "Project Delta requires additional bandwidth for testing workloads.",
        status: "in_progress",
        priority: "high",
        requested_by: `${tenantId}_user_enduser02`,
        assigned_team_id: `${tenantId}_team_noc`,
        business_service_id: `${tenantId}_svc_network`,
        created_at: now,
        updated_at: now,
        tags: ["network", "bandwidth"],
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    requests = [
      {
        id: `${tenantId}_sr01`,
        tenantId,
        title: "New streaming channel setup",
        description: "Marketing team requested setup of a new event streaming channel for APAC.",
        status: "open",
        priority: "high",
        requested_by: `${tenantId}_user_enduser01`,
        assigned_team_id: `${tenantId}_team_mediaops`,
        business_service_id: `${tenantId}_svc_streaming`,
        created_at: now,
        updated_at: now,
        tags: ["streaming", "channel"],
      },
      {
        id: `${tenantId}_sr02`,
        tenantId,
        title: "Transcoding preset update",
        description: "Request to add new 4K transcoding presets for premium content tier.",
        status: "requested",
        priority: "medium",
        requested_by: `${tenantId}_user_enduser02`,
        assigned_team_id: `${tenantId}_team_mediaops`,
        business_service_id: `${tenantId}_svc_transcoding`,
        created_at: now,
        updated_at: now,
        tags: ["transcoding", "4k"],
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    requests = [
      {
        id: `${tenantId}_sr01`,
        tenantId,
        title: "Access to reporting dashboard",
        description: "Finance team member requested access to daily P&L reporting dashboard.",
        status: "open",
        priority: "medium",
        requested_by: `${tenantId}_user_enduser01`,
        assigned_team_id: `${tenantId}_team_dba`,
        business_service_id: `${tenantId}_svc_fin_reporting`,
        created_at: now,
        updated_at: now,
        tags: ["reporting", "access"],
      },
      {
        id: `${tenantId}_sr02`,
        tenantId,
        title: "Provision sandbox analytics cluster",
        description: "Data science team requested a sandbox Spark cluster for model training.",
        status: "approved",
        priority: "high",
        requested_by: `${tenantId}_user_enduser02`,
        assigned_team_id: `${tenantId}_team_dataops`,
        business_service_id: `${tenantId}_svc_data_analytics`,
        created_at: now,
        updated_at: now,
        tags: ["sandbox", "spark", "analytics"],
      },
    ];
  }

  for (const sr of requests) {
    await db.put("service_requests", sr);

    // Audit log
    await db.put("audit_logs", {
      id: `${sr.id}_audit01`,
      tenantId,
      entity_type: "service_request",
      entity_id: sr.id,
      action: "create",
      timestamp: now,
      hash: "hash_" + sr.id,
      tags: ["seed"],
    });

    // Activity
    await db.put("activity_timeline", {
      id: `${sr.id}_act01`,
      tenantId,
      type: "service_request",
      entity_id: sr.id,
      action: "created",
      description: `Service request "${sr.title}" raised for ${sr.business_service_id}`,
      timestamp: now,
      related_entity_ids: [
        { type: "business_service", id: sr.business_service_id },
      ],
      tags: ["seed"],
    });
  }
};