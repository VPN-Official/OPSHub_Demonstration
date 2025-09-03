// src/db/seeds/seedIncidents.ts - FULLY CORRECTED
import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedIncidents = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let incidents: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    incidents = [
      {
        id: `${tenantId}_inc01`,
        tenantId,
        title: "BGP Peering Down",
        description: "Primary BGP peer to AT&T showing DOWN status. Traffic failing over to secondary.",
        severity: "P1",
        priority: "high", // Added priority field
        status: "investigating",
        created_at: now,
        updated_at: now,
        asset_id: `${tenantId}_asset_router01`,
        service_component_id: `${tenantId}_comp_bgp_gateway`,
        business_service_id: `${tenantId}_svc_internet`,
        assigned_team_id: `${tenantId}_team_network`,
        assigned_to_user_id: `${tenantId}_user_netops01`, // Added assignee
        reported_by: `${tenantId}_user_monitor01`,
        impact: "high", // Added impact field
        urgency: "high", // Added urgency field
        category: "network", // Added category
        subcategory: "connectivity", // Added subcategory
        health_status: "red", // Added health status
        tags: ["bgp", "routing", "peering", "critical"],
        custom_fields: { // Added custom fields
          vendor: "cisco",
          circuit_id: "ATT-BGP-001"
        }
      },
      {
        id: `${tenantId}_inc02`,
        tenantId,
        title: "Exchange Server Disk Space",
        description: "Exchange server showing 95% disk usage on mail store partition.",
        severity: "P2",
        priority: "medium",
        status: "in_progress",
        created_at: now,
        updated_at: now,
        asset_id: `${tenantId}_asset_exchange01`,
        service_component_id: `${tenantId}_comp_exchange01`,
        business_service_id: `${tenantId}_svc_email`,
        assigned_team_id: `${tenantId}_team_windows`,
        assigned_to_user_id: `${tenantId}_user_sysadmin01`,
        reported_by: `${tenantId}_user_monitor01`,
        impact: "medium",
        urgency: "medium",
        category: "infrastructure",
        subcategory: "storage",
        health_status: "orange",
        tags: ["exchange", "disk", "storage", "email"],
        custom_fields: {
          vendor: "microsoft",
          partition: "D:\\MailStore"
        }
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    incidents = [
      {
        id: `${tenantId}_inc01`,
        tenantId,
        title: "GKE Node OOM Kills",
        description: "Multiple pods experiencing OOM kills on GKE cluster, affecting video transcoding pipeline.",
        severity: "P1",
        priority: "high",
        status: "investigating",
        created_at: now,
        updated_at: now,
        asset_id: `${tenantId}_asset_gke_node01`,
        service_component_id: `${tenantId}_comp_gke_cluster01`,
        business_service_id: `${tenantId}_svc_transcoding`,
        assigned_team_id: `${tenantId}_team_mediaops`,
        assigned_to_user_id: `${tenantId}_user_k8s01`,
        reported_by: `${tenantId}_user_devops01`,
        impact: "high",
        urgency: "high",
        category: "application",
        subcategory: "performance",
        health_status: "red",
        tags: ["gke", "oom", "transcoding", "kubernetes"],
        custom_fields: {
          cluster: "media-prod-01",
          namespace: "transcoding"
        }
      },
      {
        id: `${tenantId}_inc02`,
        tenantId,
        title: "CDN Cache Miss Ratio High",
        description: "CDN showing 60% cache miss ratio, causing increased origin load.",
        severity: "P2",
        priority: "medium",
        status: "in_progress",
        created_at: now,
        updated_at: now,
        asset_id: `${tenantId}_asset_cdn01`,
        service_component_id: `${tenantId}_comp_cdn01`,
        business_service_id: `${tenantId}_svc_content_delivery`,
        assigned_team_id: `${tenantId}_team_sre`,
        assigned_to_user_id: `${tenantId}_user_sre01`,
        reported_by: `${tenantId}_user_monitor01`,
        impact: "medium",
        urgency: "medium",
        category: "performance",
        subcategory: "caching",
        health_status: "orange",
        tags: ["cdn", "cache", "performance", "origin"],
        custom_fields: {
          provider: "cloudflare",
          cache_ratio: "40%"
        }
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    incidents = [
      {
        id: `${tenantId}_inc01`,
        tenantId,
        title: "Database Replication Lag",
        description: "Primary-replica sync lag of 45 minutes detected in financial reporting database.",
        severity: "P1",
        priority: "critical",
        status: "open",
        created_at: now,
        updated_at: now,
        asset_id: `${tenantId}_asset_db01`,
        service_component_id: `${tenantId}_comp_reportingdb`,
        business_service_id: `${tenantId}_svc_fin_reporting`,
        assigned_team_id: `${tenantId}_team_dba`,
        assigned_to_user_id: `${tenantId}_user_dba01`,
        reported_by: `${tenantId}_user_monitor01`,
        impact: "high",
        urgency: "high",
        category: "database",
        subcategory: "replication",
        health_status: "red",
        tags: ["database", "replication", "lag", "financial"],
        custom_fields: {
          database_type: "postgresql",
          lag_minutes: "45"
        }
      },
      {
        id: `${tenantId}_inc02`,
        tenantId,
        title: "ETL Pipeline Failure",
        description: "Nightly ETL job failed, delaying ingestion into analytics data lake.",
        severity: "P2",
        priority: "high",
        status: "investigating",
        created_at: now,
        updated_at: now,
        asset_id: `${tenantId}_asset_etl01`,
        service_component_id: `${tenantId}_comp_datalake01`,
        business_service_id: `${tenantId}_svc_data_analytics`,
        assigned_team_id: `${tenantId}_team_dataops`,
        assigned_to_user_id: `${tenantId}_user_dataeng01`,
        reported_by: `${tenantId}_user_dataeng01`,
        impact: "medium",
        urgency: "high",
        category: "data",
        subcategory: "etl",
        health_status: "orange",
        tags: ["etl", "pipeline", "datalake", "spark"],
        custom_fields: {
          pipeline_type: "spark",
          job_name: "nightly_financial_etl"
        }
      },
    ];
  }

  // Insert incidents with proper error handling
  for (const inc of incidents) {
    try {
      await db.put("incidents", inc);

      // Create COMPLETE audit log entry matching AuditLogEntry interface
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "incident",
        entity_id: inc.id,
        action: "create",
        description: `Created incident: ${inc.title} (${inc.severity})`,
        timestamp: now,
        user_id: "system", // Required field - using system for seed data
        tags: ["seed", "incident", "create"],
        hash: await generateHash({
          entity_type: "incident",
          entity_id: inc.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          severity: inc.severity,
          status: inc.status,
          business_service_id: inc.business_service_id,
          assigned_team_id: inc.assigned_team_id
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `Incident "${inc.title}" created with severity ${inc.severity}`,
        storeName: "incidents", // Required field for dbClient compatibility
        recordId: inc.id, // Required field for dbClient compatibility  
        action: "create",
        userId: "system", // Optional but helpful for tracking
        metadata: {
          incident_id: inc.id,
          severity: inc.severity,
          status: inc.status,
          business_service_id: inc.business_service_id,
          assigned_team_id: inc.assigned_team_id,
          related_entities: [
            { type: "asset", id: inc.asset_id },
            { type: "service_component", id: inc.service_component_id },
            { type: "business_service", id: inc.business_service_id },
            { type: "team", id: inc.assigned_team_id }
          ]
        }
      });

      console.log(`✅ Seeded incident: ${inc.id} - ${inc.title}`);
    } catch (error) {
      console.error(`❌ Failed to seed incident ${inc.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${incidents.length} incidents for ${tenantId}`);
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