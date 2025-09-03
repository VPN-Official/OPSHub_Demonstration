import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedBusinessServices = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let services: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    services = [
      {
        id: `${tenantId}_svc_network`,
        tenantId,
        name: "Datacenter Network",
        description: "Core datacenter routing, switching and firewall services.",
        owner_team_id: `${tenantId}_team_noc`,
        status: "operational",
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    services = [
      {
        id: `${tenantId}_svc_streaming`,
        tenantId,
        name: "Live Streaming Service",
        description: "Handles low-latency global video streaming.",
        owner_team_id: `${tenantId}_team_sre`,
        status: "operational",
        created_at: now,
      },
      {
        id: `${tenantId}_svc_transcoding`,
        tenantId,
        name: "Media Transcoding",
        description: "Processes uploaded video content for multi-device playback.",
        owner_team_id: `${tenantId}_team_mediaops`,
        status: "operational",
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    services = [
      {
        id: `${tenantId}_svc_fin_reporting`,
        tenantId,
        name: "Financial Reporting",
        description: "Generates end-of-day and intraday compliance & investor reports.",
        owner_team_id: `${tenantId}_team_dba`,
        status: "operational",
        created_at: now,
      },
      {
        id: `${tenantId}_svc_data_analytics`,
        tenantId,
        name: "Analytics Platform",
        description: "Cloud-hosted analytics and data science workloads.",
        owner_team_id: `${tenantId}_team_dataops`,
        status: "operational",
        created_at: now,
      },
    ];
  }

  for (const svc of services) {
    await db.put("business_services", svc);

    await db.put("audit_logs", {
      id: `${svc.id}_audit01`,
      tenantId,
      entity_type: "business_service",
      entity_id: svc.id,
      action: "create",
      timestamp: now,
      hash: "hash_" + svc.id,
      tags: ["seed"],
    });

    await db.put("activity_timeline", {
      id: `${svc.id}_act01`,
      tenantId,
      type: "business_service",
      entity_id: svc.id,
      action: "created",
      description: `Business service ${svc.name} created`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};