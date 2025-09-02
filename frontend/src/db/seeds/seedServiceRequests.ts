import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedServiceRequests = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let srs: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    srs = [
      {
        id: `${tenantId}_sr01`,
        tenant_id: tenantId,
        title: "Request VPN Access",
        description: "Network engineer requires VPN access for remote work.",
        status: "new",
        priority: "medium",
        urgency: "medium",
        request_type: "access",
        category: "network",
        subcategory: "vpn",
        product_family: "Cisco",
        created_at: now,
        updated_at: now,
        business_service_id: `${tenantId}_svc_network`,
        service_component_ids: [`${tenantId}_comp_vpn01`],
        asset_ids: [`${tenantId}_asset_vpn_appliance01`],
        requested_by_end_user_id: `${tenantId}_enduser01`,
        approved_by_user_ids: [],
        tasks: [
          { id: "task1", title: "Create VPN account", status: "pending" },
          { id: "task2", title: "Send credentials", status: "pending" },
        ],
        approval_required: true,
        approval_workflow: [
          { step: "net_mgr", approver_id: "user_net_mgr", status: "pending", timestamp: now },
        ],
        tags: ["vpn", "access"],
        health_status: "yellow",
      },
      {
        id: `${tenantId}_sr02`,
        tenant_id: tenantId,
        title: "Hardware Request – New Switch",
        description: "New TOR switch required for expansion.",
        status: "approved",
        priority: "low",
        urgency: "low",
        request_type: "hardware",
        category: "network",
        subcategory: "switch",
        product_family: "Arista",
        created_at: now,
        updated_at: now,
        business_service_id: `${tenantId}_svc_network`,
        service_component_ids: [],
        asset_ids: [],
        requested_by_end_user_id: `${tenantId}_enduser02`,
        approved_by_user_ids: ["user_net_mgr"],
        tasks: [{ id: "task1", title: "Procure hardware", status: "in_progress" }],
        approval_required: true,
        approval_workflow: [
          { step: "finance", approver_id: "user_fin_mgr", status: "approved", timestamp: now },
        ],
        tags: ["hardware", "switch"],
        health_status: "green",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    srs = [
      {
        id: `${tenantId}_sr01`,
        tenant_id: tenantId,
        title: "Access Request – Transcoding Logs",
        description: "Dev team member requests read access to GKE logs.",
        status: "new",
        priority: "low",
        urgency: "low",
        request_type: "access",
        category: "application",
        subcategory: "logging",
        product_family: "GCP",
        created_at: now,
        updated_at: now,
        business_service_id: `${tenantId}_svc_transcoding`,
        service_component_ids: [`${tenantId}_comp_gke_cluster01`],
        asset_ids: [`${tenantId}_asset_gke_node01`],
        requested_by_end_user_id: `${tenantId}_enduser01`,
        approved_by_user_ids: [],
        tasks: [{ id: "task1", title: "Grant log access", status: "pending" }],
        approval_required: true,
        approval_workflow: [
          { step: "sre_mgr", approver_id: "user_sre_mgr", status: "pending", timestamp: now },
        ],
        tags: ["logs", "access"],
        health_status: "yellow",
      },
      {
        id: `${tenantId}_sr02`,
        tenant_id: tenantId,
        title: "Software Request – ffmpeg Upgrade",
        description: "Developer requests upgraded ffmpeg binaries for testing.",
        status: "fulfilled",
        priority: "medium",
        urgency: "low",
        request_type: "software",
        category: "application",
        subcategory: "transcoding",
        product_family: "ffmpeg",
        created_at: now,
        updated_at: now,
        business_service_id: `${tenantId}_svc_transcoding`,
        service_component_ids: [],
        asset_ids: [],
        requested_by_end_user_id: `${tenantId}_enduser02`,
        approved_by_user_ids: ["user_app_mgr"],
        tasks: [{ id: "task1", title: "Deploy binaries", status: "completed" }],
        approval_required: true,
        approval_workflow: [
          { step: "app_mgr", approver_id: "user_app_mgr", status: "approved", timestamp: now },
        ],
        tags: ["software", "ffmpeg"],
        health_status: "green",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    srs = [
      {
        id: `${tenantId}_sr01`,
        tenant_id: tenantId,
        title: "Password Reset Request",
        description: "Staff member unable to access HR portal.",
        status: "in_progress",
        priority: "low",
        urgency: "low",
        request_type: "access",
        category: "account",
        subcategory: "password",
        product_family: "Active Directory",
        created_at: now,
        updated_at: now,
        business_service_id: `${tenantId}_svc_hr_portal`,
        service_component_ids: [`${tenantId}_comp_ad01`],
        asset_ids: [`${tenantId}_asset_ad_server01`],
        requested_by_end_user_id: `${tenantId}_enduser01`,
        approved_by_user_ids: [],
        tasks: [{ id: "task1", title: "Reset password", status: "in_progress" }],
        approval_required: false,
        approval_workflow: [],
        tags: ["password", "hr"],
        health_status: "yellow",
      },
      {
        id: `${tenantId}_sr02`,
        tenant_id: tenantId,
        title: "Access Request – SharePoint Site",
        description: "Staff requests access to Finance SharePoint.",
        status: "approved",
        priority: "medium",
        urgency: "medium",
        request_type: "access",
        category: "collaboration",
        subcategory: "sharepoint",
        product_family: "Microsoft",
        created_at: now,
        updated_at: now,
        business_service_id: `${tenantId}_svc_sharepoint`,
        service_component_ids: [],
        asset_ids: [],
        requested_by_end_user_id: `${tenantId}_enduser02`,
        approved_by_user_ids: ["user_it_mgr"],
        tasks: [{ id: "task1", title: "Add to AD group", status: "completed" }],
        approval_required: true,
        approval_workflow: [
          { step: "it_mgr", approver_id: "user_it_mgr", status: "approved", timestamp: now },
        ],
        tags: ["sharepoint", "access"],
        health_status: "green",
      },
    ];
  }

  // Insert into IndexedDB
  for (const sr of srs) {
    await db.put("service_requests", sr);

    // Light Audit log
    await db.put("audit_logs", {
      id: `${sr.id}_audit01`,
      tenant_id: tenantId,
      entity_type: "service_request",
      entity_id: sr.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + sr.id,
      tags: ["seed"],
    });

    // Light Activity timeline
    await db.put("activities", {
      id: `${sr.id}_act01`,
      tenant_id: tenantId,
      type: "service_request",
      entity_id: sr.id,
      action: "created",
      description: `Service Request "${sr.title}" seeded`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};