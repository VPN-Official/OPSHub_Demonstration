import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedServiceComponents = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let components: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    components = [
      {
        id: `${tenantId}_comp_router01`,
        tenant_id: tenantId,
        name: "Core Router",
        description: "Cisco core router in SJC-1.",
        type: "infrastructure",
        status: "operational",
        created_at: now,
        updated_at: now,
        business_service_id: `${tenantId}_svc_network`,
        asset_ids: [],
        tags: ["router"],
        health_status: "orange",
      },
      {
        id: `${tenantId}_comp_switch01`,
        tenant_id: tenantId,
        name: "TOR Switch",
        description: "Top of Rack switch in SJC-1.",
        type: "infrastructure",
        status: "degraded",
        created_at: now,
        updated_at: now,
        business_service_id: `${tenantId}_svc_network`,
        asset_ids: [],
        tags: ["switch"],
        health_status: "orange",
      },
      {
        id: `${tenantId}_comp_vpn01`,
        tenant_id: tenantId,
        name: "VPN Gateway",
        description: "Remote access VPN appliance.",
        type: "infrastructure",
        status: "operational",
        created_at: now,
        updated_at: now,
        business_service_id: `${tenantId}_svc_network`,
        asset_ids: [],
        tags: ["vpn"],
        health_status: "yellow",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    components = [
      {
        id: `${tenantId}_comp_edge01`,
        tenant_id: tenantId,
        name: "Edge Node Pool",
        description: "VMs serving video content at the edge.",
        type: "application",
        status: "degraded",
        created_at: now,
        updated_at: now,
        business_service_id: `${tenantId}_svc_streaming`,
        asset_ids: [],
        tags: ["edge", "latency"],
        health_status: "red",
      },
      {
        id: `${tenantId}_comp_gke_cluster01`,
        tenant_id: tenantId,
        name: "Transcoding Cluster",
        description: "Kubernetes cluster running video transcoding.",
        type: "application",
        status: "operational",
        created_at: now,
        updated_at: now,
        business_service_id: `${tenantId}_svc_transcoding`,
        asset_ids: [],
        tags: ["gke", "transcoding"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    components = [
      {
        id: `${tenantId}_comp_exchange01`,
        tenant_id: tenantId,
        name: "Exchange Server",
        description: "Email messaging backend.",
        type: "application",
        status: "degraded",
        created_at: now,
        updated_at: now,
        business_service_id: `${tenantId}_svc_email`,
        asset_ids: [],
        tags: ["exchange"],
        health_status: "red",
      },
      {
        id: `${tenantId}_comp_vpn01`,
        tenant_id: tenantId,
        name: "VPN Appliance",
        description: "Cisco VPN concentrator.",
        type: "infrastructure",
        status: "degraded",
        created_at: now,
        updated_at: now,
        business_service_id: `${tenantId}_svc_vpn`,
        asset_ids: [],
        tags: ["vpn"],
        health_status: "orange",
      },
      {
        id: `${tenantId}_comp_ad01`,
        tenant_id: tenantId,
        name: "Active Directory",
        description: "Authentication and identity service.",
        type: "middleware",
        status: "operational",
        created_at: now,
        updated_at: now,
        business_service_id: `${tenantId}_svc_hr_portal`,
        asset_ids: [],
        tags: ["ad"],
        health_status: "yellow",
      },
    ];
  }

  for (const comp of components) {
    await db.put("service_components", comp);

    await db.put("audit_logs", {
      id: `${comp.id}_audit01`,
      tenant_id: tenantId,
      entity_type: "service_component",
      entity_id: comp.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + comp.id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${comp.id}_act01`,
      tenant_id: tenantId,
      type: "service_component",
      entity_id: comp.id,
      action: "created",
      description: `Service Component "${comp.name}" seeded`,
      timestamp: now,
      related_entity_ids: [{ type: "business_service", id: comp.business_service_id }],
      tags: ["seed"],
    });
  }
};