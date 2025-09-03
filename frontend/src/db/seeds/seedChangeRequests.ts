// src/db/seeds/seedChangeRequests.ts - FULLY CORRECTED
import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedChangeRequests = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let changes: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    changes = [
      {
        id: `${tenantId}_chg01`,
        tenantId,
        title: "Router firmware upgrade",
        description: "Upgrade core router firmware to optimize CPU usage and address stability issue identified in problem analysis.",
        type: "standard",
        change_category: "infrastructure", // Added category
        change_subcategory: "network", // Added subcategory
        status: "requested",
        priority: "high",
        risk_level: "medium", // Added risk level
        impact: "high", // Added impact assessment
        urgency: "medium", // Added urgency
        created_at: now,
        updated_at: now,
        scheduled_start_time: null, // Added scheduling fields
        scheduled_end_time: null,
        actual_start_time: null,
        actual_end_time: null,
        problem_id: `${tenantId}_prob01`,
        related_incident_ids: [`${tenantId}_inc01`], // Added incident relationships
        related_problem_ids: [`${tenantId}_prob01`],
        requested_by: `${tenantId}_user_noc01`,
        assigned_team_id: `${tenantId}_team_network`,
        assigned_to_user_id: `${tenantId}_user_netops01`, // Added specific assignee
        approver_user_ids: [`${tenantId}_user_manager01`], // Added approvers
        implementer_user_ids: [`${tenantId}_user_netops01`], // Added implementers
        business_service_id: `${tenantId}_svc_internet`, // Added business service
        asset_ids: [`${tenantId}_asset_router01`], // Added affected assets
        service_component_ids: [`${tenantId}_comp_router01`], // Added components
        approval_required: true, // Added approval tracking
        approval_workflow: [ // Added approval workflow
          {
            step: 1,
            approver_id: `${tenantId}_user_manager01`,
            role: "network_manager",
            status: "pending",
            required: true
          }
        ],
        pre_checks: [ // Added pre-implementation checks
          {
            check: "Backup current firmware",
            status: "pending",
            assigned_to: `${tenantId}_user_netops01`
          },
          {
            check: "Schedule maintenance window",
            status: "pending", 
            assigned_to: `${tenantId}_user_manager01`
          }
        ],
        post_checks: [ // Added post-implementation checks
          {
            check: "Verify BGP sessions",
            status: "pending",
            assigned_to: `${tenantId}_user_netops01`
          },
          {
            check: "Monitor CPU utilization",
            status: "pending",
            assigned_to: `${tenantId}_user_monitor01`
          }
        ],
        rollback_plan: "Revert to previous firmware version via console access", // Added rollback
        estimated_duration_minutes: 120, // Added duration estimate
        business_justification: "Resolve recurring CPU spikes affecting network performance", // Added justification
        health_status: "yellow", // Added health status
        tags: ["router", "firmware", "performance", "cpu"],
        custom_fields: {
          firmware_current: "15.6.3",
          firmware_target: "15.7.2",
          maintenance_window_required: true,
          vendor: "cisco"
        }
      },
      {
        id: `${tenantId}_chg02`,
        tenantId,
        title: "Replace unstable TOR switch",
        description: "Schedule hardware replacement for failing TOR switch identified in problem analysis. Emergency change due to packet loss impact.",
        type: "emergency",
        change_category: "hardware",
        change_subcategory: "network",
        status: "approved",
        priority: "critical",
        risk_level: "high",
        impact: "high",
        urgency: "high",
        created_at: now,
        updated_at: now,
        scheduled_start_time: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        scheduled_end_time: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
        actual_start_time: null,
        actual_end_time: null,
        problem_id: `${tenantId}_prob02`,
        related_incident_ids: [`${tenantId}_inc02`],
        related_problem_ids: [`${tenantId}_prob02`],
        requested_by: `${tenantId}_user_monitoring`,
        assigned_team_id: `${tenantId}_team_network`,
        assigned_to_user_id: `${tenantId}_user_netops02`,
        approver_user_ids: [`${tenantId}_user_manager01`, `${tenantId}_user_director01`],
        implementer_user_ids: [`${tenantId}_user_netops02`, `${tenantId}_user_datacenter01`],
        business_service_id: `${tenantId}_svc_lan`,
        asset_ids: [`${tenantId}_asset_switch01`],
        service_component_ids: [`${tenantId}_comp_switch01`],
        approval_required: true,
        approval_workflow: [
          {
            step: 1,
            approver_id: `${tenantId}_user_manager01`,
            role: "network_manager",
            status: "approved",
            required: true,
            approved_at: now
          },
          {
            step: 2,
            approver_id: `${tenantId}_user_director01`,
            role: "infrastructure_director",
            status: "approved",
            required: true,
            approved_at: now
          }
        ],
        pre_checks: [
          {
            check: "Verify replacement switch configuration",
            status: "completed",
            assigned_to: `${tenantId}_user_netops02`,
            completed_at: now
          },
          {
            check: "Coordinate with datacenter team",
            status: "completed",
            assigned_to: `${tenantId}_user_datacenter01`,
            completed_at: now
          }
        ],
        post_checks: [
          {
            check: "Verify all ports operational",
            status: "pending",
            assigned_to: `${tenantId}_user_netops02`
          },
          {
            check: "Monitor for packet loss",
            status: "pending",
            assigned_to: `${tenantId}_user_monitor01`
          }
        ],
        rollback_plan: "Reconnect old switch if new switch fails - maintain spare power cables",
        estimated_duration_minutes: 60,
        business_justification: "Emergency replacement to prevent widespread connectivity loss",
        health_status: "red",
        tags: ["switch", "hardware", "emergency", "replacement"],
        custom_fields: {
          switch_model_old: "cisco-3750x",
          switch_model_new: "cisco-9300",
          emergency_justification: "Active packet loss affecting business operations",
          change_window: "emergency"
        }
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    changes = [
      {
        id: `${tenantId}_chg01`,
        tenantId,
        title: "Edge VM scaling policy update",
        description: "Adjust auto-scaling thresholds on EU edge VM pool to handle peak loads and reduce latency issues.",
        type: "normal",
        change_category: "configuration",
        change_subcategory: "scaling",
        status: "in_progress",
        priority: "high",
        risk_level: "low",
        impact: "medium",
        urgency: "high",
        created_at: now,
        updated_at: now,
        scheduled_start_time: now,
        scheduled_end_time: new Date(Date.now() + 1800000).toISOString(), // 30 minutes
        actual_start_time: now,
        actual_end_time: null,
        problem_id: `${tenantId}_prob01`,
        related_incident_ids: [`${tenantId}_inc01`],
        related_problem_ids: [`${tenantId}_prob01`],
        requested_by: `${tenantId}_user_alerting`,
        assigned_team_id: `${tenantId}_team_sre`,
        assigned_to_user_id: `${tenantId}_user_sre01`,
        approver_user_ids: [`${tenantId}_user_sre_manager01`],
        implementer_user_ids: [`${tenantId}_user_sre01`],
        business_service_id: `${tenantId}_svc_streaming`,
        asset_ids: [`${tenantId}_asset_gce_vm01`],
        service_component_ids: [`${tenantId}_comp_edge01`],
        approval_required: true,
        approval_workflow: [
          {
            step: 1,
            approver_id: `${tenantId}_user_sre_manager01`,
            role: "sre_manager",
            status: "approved",
            required: true,
            approved_at: now
          }
        ],
        pre_checks: [
          {
            check: "Test scaling policy in staging",
            status: "completed",
            assigned_to: `${tenantId}_user_sre01`,
            completed_at: now
          }
        ],
        post_checks: [
          {
            check: "Monitor latency metrics for 1 hour",
            status: "in_progress",
            assigned_to: `${tenantId}_user_sre01`
          }
        ],
        rollback_plan: "Revert to previous scaling thresholds via Terraform",
        estimated_duration_minutes: 30,
        business_justification: "Improve streaming quality during peak EU viewing hours",
        health_status: "green",
        tags: ["scaling", "streaming", "performance", "gcp"],
        custom_fields: {
          scaling_metric: "cpu_utilization",
          threshold_old: "70%",
          threshold_new: "60%",
          region: "eu-west-1"
        }
      },
      {
        id: `${tenantId}_chg02`,
        tenantId,
        title: "GKE pod memory allocation tuning",
        description: "Update resource requests/limits for transcoding pods to prevent OOM kills and improve stability.",
        type: "standard",
        change_category: "configuration",
        change_subcategory: "containerization",
        status: "requested",
        priority: "medium",
        risk_level: "low",
        impact: "medium",
        urgency: "medium",
        created_at: now,
        updated_at: now,
        scheduled_start_time: null,
        scheduled_end_time: null,
        actual_start_time: null,
        actual_end_time: null,
        problem_id: `${tenantId}_prob02`,
        related_incident_ids: [`${tenantId}_inc02`],
        related_problem_ids: [`${tenantId}_prob02`],
        requested_by: `${tenantId}_user_devops01`,
        assigned_team_id: `${tenantId}_team_mediaops`,
        assigned_to_user_id: `${tenantId}_user_k8s01`,
        approver_user_ids: [`${tenantId}_user_mediaops_manager01`],
        implementer_user_ids: [`${tenantId}_user_k8s01`],
        business_service_id: `${tenantId}_svc_transcoding`,
        asset_ids: [`${tenantId}_asset_gke_node01`],
        service_component_ids: [`${tenantId}_comp_gke_cluster01`],
        approval_required: true,
        approval_workflow: [
          {
            step: 1,
            approver_id: `${tenantId}_user_mediaops_manager01`,
            role: "mediaops_manager",
            status: "pending",
            required: true
          }
        ],
        pre_checks: [
          {
            check: "Validate memory requirements with test workload",
            status: "pending",
            assigned_to: `${tenantId}_user_k8s01`
          }
        ],
        post_checks: [
          {
            check: "Monitor OOM kill metrics for 24 hours",
            status: "pending",
            assigned_to: `${tenantId}_user_k8s01`
          }
        ],
        rollback_plan: "Revert pod memory limits via kubectl patch",
        estimated_duration_minutes: 15,
        business_justification: "Eliminate transcoding failures due to memory constraints",
        health_status: "yellow",
        tags: ["gke", "oom", "tuning", "kubernetes"],
        custom_fields: {
          cluster_name: "media-prod-01",
          namespace: "transcoding",
          memory_limit_old: "2Gi",
          memory_limit_new: "4Gi"
        }
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    changes = [
      {
        id: `${tenantId}_chg01`,
        tenantId,
        title: "DB replication tuning",
        description: "Apply configuration changes to reduce lag in reporting DB replication and improve real-time analytics performance.",
        type: "normal",
        change_category: "database",
        change_subcategory: "performance",
        status: "approved",
        priority: "high",
        risk_level: "medium",
        impact: "high",
        urgency: "high",
        created_at: now,
        updated_at: now,
        scheduled_start_time: new Date(Date.now() + 1800000).toISOString(), // 30 minutes
        scheduled_end_time: new Date(Date.now() + 5400000).toISOString(), // 90 minutes
        actual_start_time: null,
        actual_end_time: null,
        problem_id: `${tenantId}_prob01`,
        related_incident_ids: [`${tenantId}_inc01`],
        related_problem_ids: [`${tenantId}_prob01`],
        requested_by: `${tenantId}_user_monitor01`,
        assigned_team_id: `${tenantId}_team_dba`,
        assigned_to_user_id: `${tenantId}_user_dba01`,
        approver_user_ids: [`${tenantId}_user_dba_manager01`, `${tenantId}_user_compliance01`],
        implementer_user_ids: [`${tenantId}_user_dba01`],
        business_service_id: `${tenantId}_svc_fin_reporting`,
        asset_ids: [`${tenantId}_asset_db01`],
        service_component_ids: [`${tenantId}_comp_reportingdb`],
        approval_required: true,
        approval_workflow: [
          {
            step: 1,
            approver_id: `${tenantId}_user_dba_manager01`,
            role: "dba_manager",
            status: "approved",
            required: true,
            approved_at: now
          },
          {
            step: 2,
            approver_id: `${tenantId}_user_compliance01`,
            role: "compliance_officer",
            status: "approved",
            required: true,
            approved_at: now
          }
        ],
        pre_checks: [
          {
            check: "Backup current database configuration",
            status: "completed",
            assigned_to: `${tenantId}_user_dba01`,
            completed_at: now
          },
          {
            check: "Verify compliance with financial regulations",
            status: "completed",
            assigned_to: `${tenantId}_user_compliance01`,
            completed_at: now
          }
        ],
        post_checks: [
          {
            check: "Monitor replication lag for 4 hours",
            status: "pending",
            assigned_to: `${tenantId}_user_dba01`
          },
          {
            check: "Validate real-time report accuracy",
            status: "pending",
            assigned_to: `${tenantId}_user_finops01`
          }
        ],
        rollback_plan: "Restore previous postgresql.conf and restart replica",
        estimated_duration_minutes: 60,
        business_justification: "Critical for regulatory reporting compliance and real-time analytics",
        health_status: "orange",
        tags: ["database", "replication", "performance", "compliance"],
        custom_fields: {
          database_version: "13.8",
          config_changes: ["wal_buffers", "max_wal_size", "checkpoint_segments"],
          compliance_framework: "SOX"
        }
      },
      {
        id: `${tenantId}_chg02`,
        tenantId,
        title: "ETL job retry policy",
        description: "Introduce retry & checkpointing to Spark ETL jobs to handle transient failures and improve data pipeline reliability.",
        type: "standard",
        change_category: "application",
        change_subcategory: "data_pipeline",
        status: "requested",
        priority: "medium",
        risk_level: "low",
        impact: "medium",
        urgency: "medium",
        created_at: now,
        updated_at: now,
        scheduled_start_time: null,
        scheduled_end_time: null,
        actual_start_time: null,
        actual_end_time: null,
        problem_id: `${tenantId}_prob02`,
        related_incident_ids: [`${tenantId}_inc02`],
        related_problem_ids: [`${tenantId}_prob02`],
        requested_by: `${tenantId}_user_dataeng01`,
        assigned_team_id: `${tenantId}_team_dataops`,
        assigned_to_user_id: `${tenantId}_user_dataeng01`,
        approver_user_ids: [`${tenantId}_user_dataops_manager01`],
        implementer_user_ids: [`${tenantId}_user_dataeng01`],
        business_service_id: `${tenantId}_svc_data_analytics`,
        asset_ids: [`${tenantId}_asset_etl01`],
        service_component_ids: [`${tenantId}_comp_datalake01`],
        approval_required: true,
        approval_workflow: [
          {
            step: 1,
            approver_id: `${tenantId}_user_dataops_manager01`,
            role: "dataops_manager",
            status: "pending",
            required: true
          }
        ],
        pre_checks: [
          {
            check: "Test retry logic in development environment",
            status: "pending",
            assigned_to: `${tenantId}_user_dataeng01`
          },
          {
            check: "Validate checkpoint storage capacity",
            status: "pending",
            assigned_to: `${tenantId}_user_dataeng01`
          }
        ],
        post_checks: [
          {
            check: "Monitor ETL success rate for 1 week",
            status: "pending",
            assigned_to: `${tenantId}_user_dataeng01`
          }
        ],
        rollback_plan: "Revert to previous ETL job configuration in Airflow",
        estimated_duration_minutes: 45,
        business_justification: "Reduce data pipeline failures and improve morning report reliability",
        health_status: "yellow",
        tags: ["etl", "spark", "resilience", "data_pipeline"],
        custom_fields: {
          spark_version: "3.3.1",
          retry_attempts: "3",
          checkpoint_interval: "10_minutes",
          affected_jobs: ["nightly_financial_etl", "daily_risk_etl"]
        }
      },
    ];
  }

  // Insert change requests with proper error handling
  for (const chg of changes) {
    try {
      await db.put("change_requests", chg);

      // Create COMPLETE audit log entry matching AuditLogEntry interface
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "change_request",
        entity_id: chg.id,
        action: "create",
        description: `Change request created: ${chg.title} (${chg.type}, ${chg.priority}) - ${chg.business_justification}`,
        timestamp: chg.created_at,
        user_id: chg.requested_by, // Change requests have real requesters
        tags: ["seed", "change_request", "create", chg.type],
        hash: await generateHash({
          entity_type: "change_request",
          entity_id: chg.id,
          action: "create",
          timestamp: chg.created_at,
          tenantId
        }),
        metadata: {
          change_title: chg.title,
          type: chg.type,
          status: chg.status,
          priority: chg.priority,
          risk_level: chg.risk_level,
          business_service_id: chg.business_service_id,
          assigned_team_id: chg.assigned_team_id,
          problem_id: chg.problem_id,
          approval_required: chg.approval_required,
          estimated_duration_minutes: chg.estimated_duration_minutes,
          related_counts: {
            incidents: chg.related_incident_ids.length,
            problems: chg.related_problem_ids.length,
            assets: chg.asset_ids.length,
            components: chg.service_component_ids.length
          }
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: chg.created_at,
        message: `Change request "${chg.title}" created (${chg.type}) for problem ${chg.problem_id} with ${chg.priority} priority`,
        storeName: "change_requests", // Required field for dbClient compatibility
        recordId: chg.id, // Required field for dbClient compatibility  
        action: "create",
        userId: chg.requested_by, // Real user created the change
        metadata: {
          change_id: chg.id,
          change_title: chg.title,
          type: chg.type,
          status: chg.status,
          priority: chg.priority,
          risk_level: chg.risk_level,
          impact: chg.impact,
          urgency: chg.urgency,
          business_justification: chg.business_justification,
          estimated_duration_minutes: chg.estimated_duration_minutes,
          approval_workflow: chg.approval_workflow,
          related_entities: [
            { type: "business_service", id: chg.business_service_id },
            { type: "team", id: chg.assigned_team_id },
            { type: "problem", id: chg.problem_id },
            ...chg.related_incident_ids.map((id: string) => ({ type: "incident", id })),
            ...chg.asset_ids.map((id: string) => ({ type: "asset", id })),
            ...chg.service_component_ids.map((id: string) => ({ type: "service_component", id }))
          ]
        }
      });

      console.log(`✅ Seeded change request: ${chg.id} - ${chg.title}`);
    } catch (error) {
      console.error(`❌ Failed to seed change request ${chg.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${changes.length} change requests for ${tenantId}`);
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