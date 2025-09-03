import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedAssets = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let assets: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    assets = [
      {
        id: `${tenantId}_asset_router01`,
        tenantId: tenantId,
        name: "Router-SJC-01",
        type: "network_device",
        status: "active",
        created_at: now,
        updated_at: now,
        service_component_id: `${tenantId}_comp_router01`,
        business_service_id: `${tenantId}_svc_network`,
        location: "SJC-1 Datacenter",
        tags: ["router", "network"],
        health_status: "red",
      },
      {
        id: `${tenantId}_asset_switch01`,
        tenantId: tenantId,
        name: "Switch-TOR-42",
        type: "network_device",
        status: "active",
        created_at: now,
        updated_at: now,
        service_component_id: `${tenantId}_comp_switch01`,
        business_service_id: `${tenantId}_svc_network`,
        location: "SJC-1 Datacenter",
        tags: ["switch"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    assets = [
      {
        id: `${tenantId}_asset_gce_vm01`,
        tenantId: tenantId,
        name: "VM-Edge-EU-01",
        type: "vm",
        status: "active",
        created_at: now,
        updated_at: now,
        service_component_id: `${tenantId}_comp_edge01`,
        business_service_id: `${tenantId}_svc_streaming`,
        location: "EU-West",
        tags: ["gce", "edge"],
        health_status: "red",
      },
      {
        id: `${tenantId}_asset_gke_node01`,
        tenantId: tenantId,
        name: "Node-Transcode-01",
        type: "container",
        status: "active",
        created_at: now,
        updated_at: now,
        service_component_id: `${tenantId}_comp_gke_cluster01`,
        business_service_id: `${tenantId}_svc_transcoding`,
        location: "US-East",
        tags: ["gke", "transcoding"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    assets = [
      {
        id: `${tenantId}_asset_mx01`,
        tenantId: tenantId,
        name: "Exchange-Mail-01",
        type: "server",
        status: "active",
        created_at: now,
        updated_at: now,
        service_component_id: `${tenantId}_comp_exchange01`,
        business_service_id: `${tenantId}_svc_email`,
        location: "HQ Datacenter",
        tags: ["exchange"],
        health_status: "red",
      },
      {
        id: `${tenantId}_asset_vpn_appliance01`,
        tenantId: tenantId,
        name: "VPN-Appliance-01",
        type: "network_device",
        status: "active",
        created_at: now,
        updated_at: now,
        service_component_id: `${tenantId}_comp_vpn01`,
        business_service_id: `${tenantId}_svc_vpn`,
        location: "HQ Datacenter",
        tags: ["vpn"],
        health_status: "orange",
      },
      {
        id: `${tenantId}_asset_ad_server01`,
        tenantId: tenantId,
        name: "AD-Server-01",
        type: "server",
        status: "active",
        created_at: now,
        updated_at: now,
        service_component_id: `${tenantId}_comp_ad01`,
        business_service_id: `${tenantId}_svc_hr_portal`,
        location: "HQ Datacenter",
        tags: ["ad"],
        health_status: "yellow",
      },
    ];
  }

  for (const asset of assets) {
    await db.put("assets", asset);

    await db.put("audit_logs", {
      id: `${asset.id}_audit01`,
      tenantId: tenantId,
      entity_type: "asset",
      entity_id: asset.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + asset.id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${asset.id}_act01`,
      tenantId: tenantId,
      type: "asset",
      entity_id: asset.id,
      action: "created",
      description: `Asset "${asset.name}" seeded`,
      timestamp: now,
      related_entity_ids: [{ type: "service_component", id: asset.service_component_id }],
      tags: ["seed"],
    });
  }
};