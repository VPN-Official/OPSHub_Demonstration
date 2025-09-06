// src/db/seeds/seedServiceRequests.ts - FULLY CORRECTED
import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";
import { addExternalSystemFieldsBatch } from "./externalSystemHelpers";

export const seedServiceRequests = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let requests: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    requests = [
      {
        id: `${tenantId}_sr01`,
        tenantId,
        title: "Request VPN access for contractor",
        description: "New contractor requires VPN access to datacenter systems for infrastructure maintenance project.",
        status: "open",
        priority: "medium",
        severity: "P3", // Added severity
        category: "access_request", // Added category
        subcategory: "vpn", // Added subcategory
        requested_by: `${tenantId}_user_enduser01`,
        assigned_team_id: `${tenantId}_team_network`,
        assigned_to_user_id: `${tenantId}_user_netops01`, // Added assignee
        business_service_id: `${tenantId}_svc_network`,
        approval_status: "pending", // Added approval tracking
        approval_required: true,
        approver_user_ids: [`${tenantId}_user_manager01`], // Added approvers
        sla_due_date: new Date(Date.now() + 86400000).toISOString(), // 24 hours SLA
        fulfillment_type: "manual", // Added fulfillment type
        catalog_item_id: "cat_vpn_access", // Added catalog reference
        cost_estimate: 0, // Added cost tracking
        impact: "low", // Added impact
        urgency: "medium", // Added urgency
        created_at: now,
        updated_at: now,
        health_status: "yellow", // Added health status
        tags: ["vpn", "access", "contractor", "network"],
        custom_fields: {
          contractor_company: "TechConsult Inc",
          access_duration_days: 90,
          vpn_profile: "contractor_limited",
          justification: "Infrastructure upgrade project"
        }
      },
      {
        id: `${tenantId}_sr02`,
        tenantId,
        title: "Upgrade bandwidth for project servers",
        description: "Project Delta requires additional bandwidth for testing workloads. Current 1Gbps insufficient for load testing.",
        status: "in_progress",
        priority: "high",
        severity: "P2",
        category: "infrastructure_request",
        subcategory: "bandwidth",
        requested_by: `${tenantId}_user_enduser02`,
        assigned_team_id: `${tenantId}_team_noc`,
        assigned_to_user_id: `${tenantId}_user_noc01`,
        business_service_id: `${tenantId}_svc_network`,
        approval_status: "approved",
        approval_required: true,
        approver_user_ids: [`${tenantId}_user_manager01`, `${tenantId}_user_director01`],
        sla_due_date: new Date(Date.now() + 172800000).toISOString(), // 48 hours SLA
        fulfillment_type: "semi_automated",
        catalog_item_id: "cat_bandwidth_upgrade",
        cost_estimate: 5000,
        impact: "medium",
        urgency: "high",
        created_at: now,
        updated_at: now,
        health_status: "orange",
        tags: ["network", "bandwidth", "upgrade", "project"],
        custom_fields: {
          project_name: "Project Delta",
          current_bandwidth_gbps: 1,
          requested_bandwidth_gbps: 10,
          justification: "Load testing for Q1 release",
          budget_code: "PROJ-DELTA-2025"
        }
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    requests = [
      {
        id: `${tenantId}_sr01`,
        tenantId,
        title: "New streaming channel setup",
        description: "Marketing team requested setup of a new event streaming channel for APAC region product launches and virtual events.",
        status: "open",
        priority: "high",
        severity: "P2",
        category: "service_provisioning",
        subcategory: "streaming",
        requested_by: `${tenantId}_user_enduser01`,
        assigned_team_id: `${tenantId}_team_mediaops`,
        assigned_to_user_id: `${tenantId}_user_mediaops01`,
        business_service_id: `${tenantId}_svc_streaming`,
        approval_status: "pending",
        approval_required: true,
        approver_user_ids: [`${tenantId}_user_mediaops_manager01`],
        sla_due_date: new Date(Date.now() + 259200000).toISOString(), // 72 hours SLA
        fulfillment_type: "automated",
        catalog_item_id: "cat_streaming_channel",
        cost_estimate: 2500,
        impact: "medium",
        urgency: "high",
        created_at: now,
        updated_at: now,
        health_status: "yellow",
        tags: ["streaming", "channel", "apac", "marketing"],
        custom_fields: {
          channel_name: "APAC_Product_Launch",
          expected_viewers: 50000,
          bitrate_kbps: 8000,
          regions: ["apac", "us-west"],
          event_date: new Date(Date.now() + 604800000).toISOString() // 1 week
        }
      },
      {
        id: `${tenantId}_sr02`,
        tenantId,
        title: "Transcoding preset update",
        description: "Request to add new 4K HDR transcoding presets for premium content tier. Required for new subscription package launch.",
        status: "requested",
        priority: "medium",
        severity: "P3",
        category: "configuration_change",
        subcategory: "transcoding",
        requested_by: `${tenantId}_user_enduser02`,
        assigned_team_id: `${tenantId}_team_mediaops`,
        assigned_to_user_id: null,
        business_service_id: `${tenantId}_svc_transcoding`,
        approval_status: "pending",
        approval_required: false,
        approver_user_ids: [],
        sla_due_date: new Date(Date.now() + 432000000).toISOString(), // 5 days SLA
        fulfillment_type: "semi_automated",
        catalog_item_id: "cat_transcode_preset",
        cost_estimate: 0,
        impact: "low",
        urgency: "medium",
        created_at: now,
        updated_at: now,
        health_status: "green",
        tags: ["transcoding", "4k", "hdr", "premium"],
        custom_fields: {
          preset_type: "4K_HDR",
          codec: "h265",
          container: "mp4",
          audio_codec: "aac",
          target_devices: ["smart_tv", "tablet", "desktop"]
        }
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    requests = [
      {
        id: `${tenantId}_sr01`,
        tenantId,
        title: "Access to reporting dashboard",
        description: "Finance team member requested read-only access to daily P&L reporting dashboard for regulatory compliance reporting.",
        status: "open",
        priority: "medium",
        severity: "P3",
        category: "access_request",
        subcategory: "dashboard",
        requested_by: `${tenantId}_user_enduser01`,
        assigned_team_id: `${tenantId}_team_dba`,
        assigned_to_user_id: `${tenantId}_user_dba01`,
        business_service_id: `${tenantId}_svc_fin_reporting`,
        approval_status: "pending",
        approval_required: true,
        approver_user_ids: [`${tenantId}_user_compliance01`, `${tenantId}_user_dba_manager01`],
        sla_due_date: new Date(Date.now() + 86400000).toISOString(), // 24 hours SLA
        fulfillment_type: "manual",
        catalog_item_id: "cat_dashboard_access",
        cost_estimate: 0,
        impact: "low",
        urgency: "medium",
        created_at: now,
        updated_at: now,
        health_status: "green",
        tags: ["reporting", "access", "finance", "compliance"],
        custom_fields: {
          dashboard_name: "Daily_PnL_Report",
          access_level: "read_only",
          department: "Finance",
          compliance_requirement: "SOX",
          data_sensitivity: "confidential"
        }
      },
      {
        id: `${tenantId}_sr02`,
        tenantId,
        title: "Provision sandbox analytics cluster",
        description: "Data science team requested a sandbox Spark cluster for machine learning model training on financial risk analysis.",
        status: "approved",
        priority: "high",
        severity: "P2",
        category: "infrastructure_request",
        subcategory: "compute",
        requested_by: `${tenantId}_user_enduser02`,
        assigned_team_id: `${tenantId}_team_dataops`,
        assigned_to_user_id: `${tenantId}_user_dataeng01`,
        business_service_id: `${tenantId}_svc_data_analytics`,
        approval_status: "approved",
        approval_required: true,
        approver_user_ids: [`${tenantId}_user_dataops_manager01`, `${tenantId}_user_director01`],
        sla_due_date: new Date(Date.now() + 172800000).toISOString(), // 48 hours SLA
        fulfillment_type: "automated",
        catalog_item_id: "cat_spark_cluster",
        cost_estimate: 15000,
        impact: "low",
        urgency: "high",
        created_at: now,
        updated_at: now,
        health_status: "green",
        tags: ["sandbox", "spark", "analytics", "ml"],
        custom_fields: {
          cluster_size: "8_nodes",
          spark_version: "3.3.1",
          memory_per_node_gb: 64,
          cpu_cores_per_node: 16,
          duration_days: 30,
          project_code: "ML-RISK-2025"
        }
      },
    ];
  }

  // Add external system fields to all requests
  requests = addExternalSystemFieldsBatch(requests, 'service_request', tenantId);

  // Insert service requests with proper error handling
  for (const sr of requests) {
    try {
      await db.put("service_requests", sr);

      // Create COMPLETE audit log entry matching AuditLogEntry interface
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "service_request",
        entity_id: sr.id,
        action: "create",
        description: `Service request created: ${sr.title} (${sr.priority} priority, ${sr.status} status)`,
        timestamp: now,
        user_id: sr.requested_by, // Service requests have real requesters
        tags: ["seed", "service_request", "create", sr.category],
        hash: await generateHash({
          entity_type: "service_request",
          entity_id: sr.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          request_title: sr.title,
          status: sr.status,
          priority: sr.priority,
          severity: sr.severity,
          category: sr.category,
          subcategory: sr.subcategory,
          business_service_id: sr.business_service_id,
          assigned_team_id: sr.assigned_team_id,
          approval_required: sr.approval_required,
          fulfillment_type: sr.fulfillment_type,
          cost_estimate: sr.cost_estimate,
          sla_due_date: sr.sla_due_date
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `Service request "${sr.title}" raised by user for ${sr.category}/${sr.subcategory}`,
        storeName: "service_requests", // Required field for dbClient compatibility
        recordId: sr.id, // Required field for dbClient compatibility  
        action: "create",
        userId: sr.requested_by, // Real user created the request
        metadata: {
          service_request_id: sr.id,
          request_title: sr.title,
          status: sr.status,
          priority: sr.priority,
          severity: sr.severity,
          category: sr.category,
          subcategory: sr.subcategory,
          approval_status: sr.approval_status,
          fulfillment_type: sr.fulfillment_type,
          cost_estimate: sr.cost_estimate,
          impact: sr.impact,
          urgency: sr.urgency,
          sla_due_date: sr.sla_due_date,
          related_entities: [
            { type: "business_service", id: sr.business_service_id },
            { type: "team", id: sr.assigned_team_id },
            { type: "user", id: sr.requested_by },
            ...(sr.assigned_to_user_id ? [{ type: "user", id: sr.assigned_to_user_id }] : []),
            ...sr.approver_user_ids.map((id: string) => ({ type: "user", id }))
          ]
        }
      });

      console.log(`✅ Seeded service request: ${sr.id} - ${sr.title}`);
    } catch (error) {
      console.error(`❌ Failed to seed service request ${sr.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${requests.length} service requests for ${tenantId}`);
};

// Helper function to generate audit hash (simplified for seeding)
async function generateHash(data: any): Promise<string> {
  try {
    const { generateImmutableHash } = await import("../../utils/auditUtils");
    return await generateImmutableHash(data);
  } catch {
    // Fallback for seeding if utils not available
    return `seed_hash_${data.entity_id}_${Date.now()}`;
  }
}