// src/db/seeds/seedMaintenance.ts - FULLY CORRECTED
import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedMaintenance = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  const maintenances: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    maintenances.push(
      {
        id: `${tenantId}_mnt01`,
        tenantId,
        title: "Core Router Firmware Upgrade",
        description: "Scheduled firmware upgrade on Router R1 to address CPU utilization issues and improve BGP stability.",
        status: "scheduled",
        priority: "high",
        severity: "P2",
        category: "infrastructure",
        subcategory: "network",
        maintenance_type: "planned",
        impact_level: "medium",
        window_start: new Date(Date.now() + 86400000).toISOString(), // +1 day
        window_end: new Date(Date.now() + 93600000).toISOString(),   // +2 hours
        duration_minutes: 120,
        asset_id: `${tenantId}_asset_router01`,
        asset_ids: [`${tenantId}_asset_router01`],
        service_component_id: `${tenantId}_comp_router01`,
        service_component_ids: [`${tenantId}_comp_router01`],
        business_service_id: `${tenantId}_svc_network`,
        business_service_ids: [`${tenantId}_svc_network`],
        assigned_team_id: `${tenantId}_team_network`,
        assigned_to_user_id: `${tenantId}_user_netops01`,
        requested_by: `${tenantId}_user_manager01`,
        approver_user_ids: [`${tenantId}_user_director01`],
        approval_status: "approved",
        change_request_id: `${tenantId}_chg01`,
        rollback_plan: "Revert to previous firmware version via TFTP",
        health_check_plan: "Verify BGP sessions, check CPU utilization, test routing",
        notification_sent: true,
        affected_user_count: 500,
        health_status: "yellow",
        created_at: now,
        updated_at: now,
        tags: ["router", "firmware", "planned", "network"],
        custom_fields: {
          current_version: "15.6.3",
          target_version: "15.7.2",
          vendor: "cisco",
          model: "isr-4431"
        }
      },
      {
        id: `${tenantId}_mnt02`,
        tenantId,
        title: "TOR Switch Replacement",
        description: "Planned replacement of TOR switch S1 due to recurring packet loss and hardware degradation.",
        status: "approved",
        priority: "critical",
        severity: "P1",
        category: "hardware",
        subcategory: "network",
        maintenance_type: "emergency",
        impact_level: "high",
        window_start: new Date(Date.now() + 259200000).toISOString(), // +3 days
        window_end: new Date(Date.now() + 266400000).toISOString(),   // +2 hours
        duration_minutes: 120,
        asset_id: `${tenantId}_asset_switch01`,
        asset_ids: [`${tenantId}_asset_switch01`],
        service_component_id: `${tenantId}_comp_switch01`,
        service_component_ids: [`${tenantId}_comp_switch01`],
        business_service_id: `${tenantId}_svc_network`,
        business_service_ids: [`${tenantId}_svc_network`, `${tenantId}_svc_lan`],
        assigned_team_id: `${tenantId}_team_network`,
        assigned_to_user_id: `${tenantId}_user_netops02`,
        requested_by: `${tenantId}_user_monitor01`,
        approver_user_ids: [`${tenantId}_user_director01`, `${tenantId}_user_manager01`],
        approval_status: "approved",
        change_request_id: `${tenantId}_chg02`,
        rollback_plan: "Keep old switch on standby, ready to reconnect if issues arise",
        health_check_plan: "Verify all port connectivity, check for CRC errors, monitor packet loss",
        notification_sent: true,
        affected_user_count: 1000,
        health_status: "red",
        created_at: now,
        updated_at: now,
        tags: ["switch", "hardware", "emergency", "replacement"],
        custom_fields: {
          old_switch_model: "cisco-3750x",
          new_switch_model: "cisco-9300",
          rack_location: "DC1-Row3-Rack7",
          port_count: 48
        }
      }
    );
  }

  if (tenantId === "tenant_av_google") {
    maintenances.push(
      {
        id: `${tenantId}_mnt01`,
        tenantId,
        title: "Edge VM Scaling Policy Update",
        description: "Scheduled change in auto-scaling policy to optimize streaming performance during peak hours.",
        status: "scheduled",
        priority: "high",
        severity: "P2",
        category: "configuration",
        subcategory: "performance",
        maintenance_type: "planned",
        impact_level: "low",
        window_start: new Date(Date.now() + 172800000).toISOString(), // +2 days
        window_end: new Date(Date.now() + 180000000).toISOString(),   // +2 hours
        duration_minutes: 120,
        asset_id: `${tenantId}_asset_gce_vm01`,
        asset_ids: [`${tenantId}_asset_gce_vm01`],
        service_component_id: `${tenantId}_comp_edge01`,
        service_component_ids: [`${tenantId}_comp_edge01`],
        business_service_id: `${tenantId}_svc_streaming`,
        business_service_ids: [`${tenantId}_svc_streaming`],
        assigned_team_id: `${tenantId}_team_sre`,
        assigned_to_user_id: `${tenantId}_user_sre01`,
        requested_by: `${tenantId}_user_sre_manager01`,
        approver_user_ids: [`${tenantId}_user_director01`],
        approval_status: "approved",
        change_request_id: `${tenantId}_chg01`,
        rollback_plan: "Revert scaling policy via Terraform rollback",
        health_check_plan: "Monitor latency metrics, check instance count, verify load distribution",
        notification_sent: false,
        affected_user_count: 50000,
        health_status: "green",
        created_at: now,
        updated_at: now,
        tags: ["streaming", "scaling", "planned", "gcp"],
        custom_fields: {
          region: "eu-west-1",
          min_instances: 10,
          max_instances: 50,
          target_cpu_utilization: 60
        }
      },
      {
        id: `${tenantId}_mnt02`,
        tenantId,
        title: "GKE Cluster Node Patching",
        description: "Planned Kubernetes security patch rollout on transcoding GKE cluster nodes.",
        status: "approved",
        priority: "medium",
        severity: "P3",
        category: "security",
        subcategory: "patching",
        maintenance_type: "planned",
        impact_level: "medium",
        window_start: new Date(Date.now() + 345600000).toISOString(), // +4 days
        window_end: new Date(Date.now() + 360000000).toISOString(),   // +4 hours
        duration_minutes: 240,
        asset_id: `${tenantId}_asset_gke_node01`,
        asset_ids: [`${tenantId}_asset_gke_node01`],
        service_component_id: `${tenantId}_comp_gke_cluster01`,
        service_component_ids: [`${tenantId}_comp_gke_cluster01`],
        business_service_id: `${tenantId}_svc_transcoding`,
        business_service_ids: [`${tenantId}_svc_transcoding`],
        assigned_team_id: `${tenantId}_team_mediaops`,
        assigned_to_user_id: `${tenantId}_user_k8s01`,
        requested_by: `${tenantId}_user_security01`,
        approver_user_ids: [`${tenantId}_user_mediaops_manager01`],
        approval_status: "approved",
        change_request_id: `${tenantId}_chg02`,
        rollback_plan: "Node rollback using GKE node pool versioning",
        health_check_plan: "Verify pod health, check node status, monitor transcoding queue",
        notification_sent: true,
        affected_user_count: 10000,
        health_status: "yellow",
        created_at: now,
        updated_at: now,
        tags: ["gke", "patching", "planned", "security"],
        custom_fields: {
          cluster_name: "media-prod-01",
          current_k8s_version: "1.25.8-gke.500",
          target_k8s_version: "1.26.2-gke.1000",
          node_count: 12
        }
      }
    );
  }

  if (tenantId === "tenant_cloud_morningstar") {
    maintenances.push(
      {
        id: `${tenantId}_mnt01`,
        tenantId,
        title: "DB Cluster Maintenance Window",
        description: "Planned maintenance on reporting DB cluster to improve replication performance and apply critical patches.",
        status: "scheduled",
        priority: "high",
        severity: "P2",
        category: "database",
        subcategory: "performance",
        maintenance_type: "planned",
        impact_level: "high",
        window_start: new Date(Date.now() + 86400000).toISOString(), // +1 day
        window_end: new Date(Date.now() + 108000000).toISOString(),   // +6 hours
        duration_minutes: 360,
        asset_id: `${tenantId}_asset_db01`,
        asset_ids: [`${tenantId}_asset_db01`],
        service_component_id: `${tenantId}_comp_reportingdb`,
        service_component_ids: [`${tenantId}_comp_reportingdb`],
        business_service_id: `${tenantId}_svc_fin_reporting`,
        business_service_ids: [`${tenantId}_svc_fin_reporting`],
        assigned_team_id: `${tenantId}_team_dba`,
        assigned_to_user_id: `${tenantId}_user_dba01`,
        requested_by: `${tenantId}_user_dba_manager01`,
        approver_user_ids: [`${tenantId}_user_director01`, `${tenantId}_user_compliance01`],
        approval_status: "approved",
        change_request_id: `${tenantId}_chg01`,
        rollback_plan: "Database backup restoration from pre-maintenance snapshot",
        health_check_plan: "Verify replication lag, check query performance, validate reporting accuracy",
        notification_sent: true,
        affected_user_count: 150,
        health_status: "orange",
        created_at: now,
        updated_at: now,
        tags: ["database", "maintenance", "planned", "postgresql"],
        custom_fields: {
          database_version: "13.8",
          patch_level: "13.11",
          replication_type: "streaming",
          expected_downtime_minutes: 30
        }
      },
      {
        id: `${tenantId}_mnt02`,
        tenantId,
        title: "ETL Pipeline Optimization",
        description: "Scheduled Spark configuration tuning to improve nightly ETL reliability and reduce failures.",
        status: "approved",
        priority: "medium",
        severity: "P3",
        category: "application",
        subcategory: "optimization",
        maintenance_type: "planned",
        impact_level: "low",
        window_start: new Date(Date.now() + 259200000).toISOString(), // +3 days
        window_end: new Date(Date.now() + 266400000).toISOString(),   // +2 hours
        duration_minutes: 120,
        asset_id: `${tenantId}_asset_etl01`,
        asset_ids: [`${tenantId}_asset_etl01`],
        service_component_id: `${tenantId}_comp_datalake01`,
        service_component_ids: [`${tenantId}_comp_datalake01`],
        business_service_id: `${tenantId}_svc_data_analytics`,
        business_service_ids: [`${tenantId}_svc_data_analytics`],
        assigned_team_id: `${tenantId}_team_dataops`,
        assigned_to_user_id: `${tenantId}_user_dataeng01`,
        requested_by: `${tenantId}_user_dataops_manager01`,
        approver_user_ids: [`${tenantId}_user_director01`],
        approval_status: "pending",
        change_request_id: `${tenantId}_chg02`,
        rollback_plan: "Revert Spark configuration to previous settings",
        health_check_plan: "Monitor job success rate, check processing time, verify data accuracy",
        notification_sent: false,
        affected_user_count: 75,
        health_status: "yellow",
        created_at: now,
        updated_at: now,
        tags: ["etl", "spark", "planned", "optimization"],
        custom_fields: {
          spark_version: "3.3.1",
          executor_memory: "8g",
          driver_memory: "4g",
          optimization_target: "reduce_failures"
        }
      }
    );
  }

  // Insert maintenance records with proper error handling
  for (const mnt of maintenances) {
    try {
      await db.put("maintenance", mnt);

      // Create COMPLETE audit log entry matching AuditLogEntry interface
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "maintenance",
        entity_id: mnt.id,
        action: "create",
        description: `Maintenance window created: ${mnt.title} (${mnt.maintenance_type}, ${mnt.priority} priority) scheduled for ${mnt.window_start}`,
        timestamp: now,
        user_id: "system", // Required field
        tags: ["seed", "maintenance", "create", mnt.maintenance_type],
        hash: await generateHash({
          entity_type: "maintenance",
          entity_id: mnt.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          maintenance_title: mnt.title,
          status: mnt.status,
          priority: mnt.priority,
          severity: mnt.severity,
          maintenance_type: mnt.maintenance_type,
          impact_level: mnt.impact_level,
          window_start: mnt.window_start,
          window_end: mnt.window_end,
          duration_minutes: mnt.duration_minutes,
          business_service_id: mnt.business_service_id,
          assigned_team_id: mnt.assigned_team_id,
          approval_status: mnt.approval_status,
          affected_user_count: mnt.affected_user_count
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `Maintenance "${mnt.title}" scheduled for ${mnt.business_service_id} (${mnt.maintenance_type} - ${mnt.impact_level} impact)`,
        storeName: "maintenance", // Required field for dbClient compatibility
        recordId: mnt.id, // Required field for dbClient compatibility  
        action: "create",
        userId: "system",
        metadata: {
          maintenance_id: mnt.id,
          maintenance_title: mnt.title,
          status: mnt.status,
          maintenance_type: mnt.maintenance_type,
          impact_level: mnt.impact_level,
          window_start: mnt.window_start,
          window_end: mnt.window_end,
          affected_users: mnt.affected_user_count,
          rollback_plan: mnt.rollback_plan,
          health_check_plan: mnt.health_check_plan,
          related_entities: [
            { type: "asset", id: mnt.asset_id },
            { type: "service_component", id: mnt.service_component_id },
            { type: "business_service", id: mnt.business_service_id },
            { type: "team", id: mnt.assigned_team_id },
            { type: "change_request", id: mnt.change_request_id }
          ]
        }
      });

      console.log(`✅ Seeded maintenance: ${mnt.id} - ${mnt.title}`);
    } catch (error) {
      console.error(`❌ Failed to seed maintenance ${mnt.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${maintenances.length} maintenance windows for ${tenantId}`);
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