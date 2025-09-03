import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedChangeRequests = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let changes: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    changes = [
      {
        id: `${tenantId}_chg01`,
        tenantId: tenantId,
        title: "Upgrade Router Firmware",
        description: "Planned upgrade to mitigate recurring CPU spikes.",
        status: "submitted",
        priority: "high",
        risk: "medium",
        change_type: "normal",
        category: "network",
        subcategory: "router",
        product_family: "Cisco",
        created_at: now,
        updated_at: now,
        related_problem_ids: [`${tenantId}_prob01`],
        related_incident_ids: [`${tenantId}_inc01`],
        service_component_ids: [`${tenantId}_comp_router01`],
        asset_ids: [`${tenantId}_asset_router01`],
        approval_required: true,
        approval_workflow: [
          { step: "network_team", approver_id: "user_net_mgr", status: "pending", timestamp: now },
        ],
        tags: ["change", "router"],
        health_status: "yellow",
      },
      {
        id: `${tenantId}_chg02`,
        tenantId: tenantId,
        title: "Emergency BGP Config Rollback",
        description: "Rollback to restore connectivity after outage.",
        status: "in_progress",
        priority: "emergency",
        risk: "high",
        change_type: "emergency",
        category: "network",
        subcategory: "bgp",
        product_family: "Cisco",
        created_at: now,
        updated_at: now,
        related_incident_ids: [`${tenantId}_inc02`],
        service_component_ids: [`${tenantId}_comp_switch01`],
        asset_ids: [`${tenantId}_asset_switch01`],
        approval_required: false,
        approval_workflow: [],
        tags: ["bgp", "rollback"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    changes = [
      {
        id: `${tenantId}_chg01`,
        tenantId: tenantId,
        title: "Patch Transcoding Cluster",
        description: "Deploy fix for memory leak in ffmpeg library.",
        status: "scheduled",
        priority: "high",
        risk: "medium",
        change_type: "normal",
        category: "application",
        subcategory: "transcoding",
        product_family: "ffmpeg",
        created_at: now,
        updated_at: now,
        related_problem_ids: [`${tenantId}_prob01`],
        related_incident_ids: [`${tenantId}_inc01`],
        service_component_ids: [`${tenantId}_comp_gke_cluster01`],
        asset_ids: [`${tenantId}_asset_gke_node01`],
        approval_required: true,
        approval_workflow: [
          { step: "app_team", approver_id: "user_app_mgr", status: "approved", timestamp: now },
        ],
        tags: ["transcoding", "patch"],
        health_status: "yellow",
      },
      {
        id: `${tenantId}_chg02`,
        tenantId: tenantId,
        title: "Scale Edge Nodes",
        description: "Increase edge node pool size to reduce streaming latency.",
        status: "submitted",
        priority: "medium",
        risk: "low",
        change_type: "standard",
        category: "infrastructure",
        subcategory: "edge",
        product_family: "gce",
        created_at: now,
        updated_at: now,
        related_incident_ids: [`${tenantId}_inc01`],
        service_component_ids: [`${tenantId}_comp_edge01`],
        asset_ids: [`${tenantId}_asset_gce_vm01`],
        approval_required: false,
        approval_workflow: [],
        tags: ["edge", "scaling"],
        health_status: "green",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    changes = [
      {
        id: `${tenantId}_chg01`,
        tenantId: tenantId,
        title: "Email Server Patch",
        description: "Apply Microsoft Exchange security patch.",
        status: "approved",
        priority: "high",
        risk: "medium",
        change_type: "normal",
        category: "messaging",
        subcategory: "exchange",
        product_family: "Microsoft Exchange",
        created_at: now,
        updated_at: now,
        related_incident_ids: [`${tenantId}_inc01`],
        service_component_ids: [`${tenantId}_comp_exchange01`],
        asset_ids: [`${tenantId}_asset_mx01`],
        approval_required: true,
        approval_workflow: [
          { step: "it_mgr", approver_id: "user_it_mgr", status: "approved", timestamp: now },
        ],
        tags: ["email", "patch"],
        health_status: "yellow",
      },
      {
        id: `${tenantId}_chg02`,
        tenantId: tenantId,
        title: "VPN Config Change",
        description: "Reconfigure VPN appliance for stronger encryption.",
        status: "submitted",
        priority: "medium",
        risk: "low",
        change_type: "standard",
        category: "network",
        subcategory: "vpn",
        product_family: "Cisco AnyConnect",
        created_at: now,
        updated_at: now,
        related_problem_ids: [`${tenantId}_prob01`],
        related_incident_ids: [`${tenantId}_inc02`],
        service_component_ids: [`${tenantId}_comp_vpn01`],
        asset_ids: [`${tenantId}_asset_vpn_appliance01`],
        approval_required: true,
        approval_workflow: [
          { step: "sec_team", approver_id: "user_sec_mgr", status: "pending", timestamp: now },
        ],
        tags: ["vpn", "config"],
        health_status: "green",
      },
    ];
  }

  // Insert into IndexedDB
  for (const chg of changes) {
    await db.put("change_requests", chg);

    // Light Audit log
    await db.put("audit_logs", {
      id: `${chg.id}_audit01`,
      tenantId: tenantId,
      entity_type: "change_request",
      entity_id: chg.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + chg.id,
      tags: ["seed"],
    });

    // Light Activity timeline
    await db.put("activities", {
      id: `${chg.id}_act01`,
      tenantId: tenantId,
      type: "change_request",
      entity_id: chg.id,
      action: "created",
      description: `Change Request "${chg.title}" seeded`,
      timestamp: now,
      related_entity_ids: (chg.related_incident_ids || []).map((id: string) => ({
        type: "incident",
        id,
      })),
      tags: ["seed"],
    });
  }
};