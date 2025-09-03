import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedMaintenances = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let maintenances: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    maintenances = [
      {
        id: `${tenantId}_mnt01`,
        tenantId: tenantId,
        title: "Router Firmware Patch",
        description: "Scheduled patch to fix CPU spike issue.",
        status: "scheduled",
        priority: "high",
        maintenance_type: "preventive",
        created_at: now,
        updated_at: now,
        scheduled_start: now,
        scheduled_end: null,
        completed_at: null,
        asset_ids: [`${tenantId}_asset_router01`],
        service_component_ids: [`${tenantId}_comp_router01`],
        business_service_id: `${tenantId}_svc_network`,
        checklist: [
          { step: "backup_config", status: "pending" },
          { step: "apply_patch", status: "pending" },
          { step: "reboot_router", status: "pending" },
        ],
        tools_required: ["firmware usb", "console cable"],
        parts_required: [],
        tags: ["router", "maintenance"],
        health_status: "yellow",
      },
      {
        id: `${tenantId}_mnt02`,
        tenantId: tenantId,
        title: "Switch Replacement",
        description: "Corrective maintenance for faulty TOR switch.",
        status: "in_progress",
        priority: "high",
        maintenance_type: "corrective",
        created_at: now,
        updated_at: now,
        scheduled_start: now,
        scheduled_end: null,
        completed_at: null,
        asset_ids: [`${tenantId}_asset_switch01`],
        service_component_ids: [`${tenantId}_comp_switch01`],
        business_service_id: `${tenantId}_svc_network`,
        checklist: [
          { step: "rack_new_switch", status: "completed" },
          { step: "connect_power", status: "completed" },
          { step: "apply_config", status: "pending" },
        ],
        tools_required: ["rack kit", "console cable"],
        parts_required: [{ part_name: "TOR Switch", quantity: 1, cost: 2500 }],
        tags: ["switch", "corrective"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    maintenances = [
      {
        id: `${tenantId}_mnt01`,
        tenantId: tenantId,
        title: "Transcoding Cluster Upgrade",
        description: "Upgrade GKE nodes to latest version.",
        status: "scheduled",
        priority: "medium",
        maintenance_type: "preventive",
        created_at: now,
        updated_at: now,
        scheduled_start: now,
        scheduled_end: null,
        completed_at: null,
        asset_ids: [`${tenantId}_asset_gke_node01`],
        service_component_ids: [`${tenantId}_comp_gke_cluster01`],
        business_service_id: `${tenantId}_svc_transcoding`,
        checklist: [
          { step: "drain_nodes", status: "pending" },
          { step: "upgrade_gke", status: "pending" },
          { step: "validate_workloads", status: "pending" },
        ],
        tools_required: ["kubectl"],
        parts_required: [],
        tags: ["gke", "upgrade"],
        health_status: "yellow",
      },
      {
        id: `${tenantId}_mnt02`,
        tenantId: tenantId,
        title: "Edge Cache Expansion",
        description: "Add more edge cache nodes to reduce streaming latency.",
        status: "completed",
        priority: "medium",
        maintenance_type: "predictive",
        created_at: now,
        updated_at: now,
        scheduled_start: now,
        scheduled_end: now,
        completed_at: now,
        asset_ids: [`${tenantId}_asset_gce_vm01`],
        service_component_ids: [`${tenantId}_comp_edge01`],
        business_service_id: `${tenantId}_svc_streaming`,
        checklist: [
          { step: "add_vm_nodes", status: "completed" },
          { step: "deploy_cache", status: "completed" },
          { step: "validate_latency", status: "completed" },
        ],
        tools_required: ["gcloud"],
        parts_required: [],
        tags: ["edge", "cache"],
        health_status: "green",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    maintenances = [
      {
        id: `${tenantId}_mnt01`,
        tenantId: tenantId,
        title: "Exchange Server Security Patch",
        description: "Apply Microsoft patch to address CVE-2025-1234.",
        status: "scheduled",
        priority: "high",
        maintenance_type: "preventive",
        created_at: now,
        updated_at: now,
        scheduled_start: now,
        scheduled_end: null,
        completed_at: null,
        asset_ids: [`${tenantId}_asset_mx01`],
        service_component_ids: [`${tenantId}_comp_exchange01`],
        business_service_id: `${tenantId}_svc_email`,
        checklist: [
          { step: "backup_db", status: "pending" },
          { step: "apply_patch", status: "pending" },
          { step: "restart_service", status: "pending" },
        ],
        tools_required: ["RDP access"],
        parts_required: [],
        tags: ["exchange", "security"],
        health_status: "yellow",
      },
      {
        id: `${tenantId}_mnt02`,
        tenantId: tenantId,
        title: "VPN Appliance Upgrade",
        description: "Upgrade Cisco VPN firmware for encryption improvements.",
        status: "in_progress",
        priority: "medium",
        maintenance_type: "corrective",
        created_at: now,
        updated_at: now,
        scheduled_start: now,
        scheduled_end: null,
        completed_at: null,
        asset_ids: [`${tenantId}_asset_vpn_appliance01`],
        service_component_ids: [`${tenantId}_comp_vpn01`],
        business_service_id: `${tenantId}_svc_vpn`,
        checklist: [
          { step: "download_firmware", status: "completed" },
          { step: "apply_upgrade", status: "pending" },
          { step: "reboot_device", status: "pending" },
        ],
        tools_required: ["console cable"],
        parts_required: [{ part_name: "VPN License", quantity: 1, cost: 500 }],
        tags: ["vpn", "firmware"],
        health_status: "orange",
      },
    ];
  }

  // Insert into IndexedDB
  for (const mnt of maintenances) {
    await db.put("maintenances", mnt);

    // Light Audit log
    await db.put("audit_logs", {
      id: `${mnt.id}_audit01`,
      tenantId: tenantId,
      entity_type: "maintenance",
      entity_id: mnt.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + mnt.id,
      tags: ["seed"],
    });

    // Light Activity timeline
    await db.put("activities", {
      id: `${mnt.id}_act01`,
      tenantId: tenantId,
      type: "maintenance",
      entity_id: mnt.id,
      action: "created",
      description: `Maintenance "${mnt.title}" seeded`,
      timestamp: now,
      related_entity_ids: mnt.asset_ids.map((id: string) => ({
        type: "asset",
        id,
      })),
      tags: ["seed"],
    });
  }
};