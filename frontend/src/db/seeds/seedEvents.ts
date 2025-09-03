// src/db/seeds/seedEvents.ts - FULLY CORRECTED
import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedEvents = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date();
  let events: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    events = [
      {
        id: `${tenantId}_evt01`,
        tenantId,
        title: "Network Infrastructure Degradation",
        description: "Multiple BGP peer failures detected across core routing infrastructure. Service impact: partial internet connectivity loss.",
        severity: "critical",
        priority: "high", // Added priority
        status: "active",
        category: "infrastructure", // Added category
        subcategory: "network", // Added subcategory
        event_type: "service_degradation", // Added event type
        impact_scope: "multi_service", // Added impact scope
        detected_at: now.toISOString(),
        last_updated_at: now.toISOString(), // Added last update timestamp
        resolved_at: null, // Added resolution tracking
        duration_minutes: null, // Will be calculated when resolved
        related_alert_ids: [`${tenantId}_alert01`],
        related_incident_ids: [`${tenantId}_inc01`], // Added incident relationship
        related_problem_ids: [`${tenantId}_prob01`], // Added problem relationship
        asset_id: `${tenantId}_asset_router01`,
        service_component_id: `${tenantId}_comp_bgp_gateway`,
        business_service_id: `${tenantId}_svc_internet`,
        root_cause_analysis: "BGP peer configuration drift detected", // Added RCA
        business_impact: "Partial internet connectivity affecting 25% of users", // Added business impact
        affected_user_count: 250, // Added affected users
        escalation_level: 2, // Added escalation tracking
        health_status: "red", // Added health status
        tags: ["bgp", "routing", "peering", "infrastructure"],
        custom_fields: {
          peer_count_total: 4,
          peer_count_down: 2,
          traffic_reroute_percentage: 75
        }
      },
      {
        id: `${tenantId}_evt02`,
        tenantId,
        title: "Email Service Performance Issues",
        description: "Exchange server experiencing high queue lengths and processing delays. Email delivery affected.",
        severity: "major",
        priority: "medium",
        status: "active",
        category: "application",
        subcategory: "messaging",
        event_type: "performance_degradation",
        impact_scope: "single_service",
        detected_at: now.toISOString(),
        last_updated_at: now.toISOString(),
        resolved_at: null,
        duration_minutes: null,
        related_alert_ids: [`${tenantId}_alert02`],
        related_incident_ids: [`${tenantId}_inc02`],
        related_problem_ids: [],
        asset_id: `${tenantId}_asset_exchange01`,
        service_component_id: `${tenantId}_comp_exchange01`,
        business_service_id: `${tenantId}_svc_email`,
        root_cause_analysis: "Database maintenance causing transport queue buildup",
        business_impact: "Email delays up to 30 minutes, affecting internal communications",
        affected_user_count: 500,
        escalation_level: 1,
        health_status: "orange",
        tags: ["exchange", "email", "queue", "performance"],
        custom_fields: {
          queue_size_current: 247,
          queue_size_normal: 50,
          processing_delay_minutes: 15
        }
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    events = [
      {
        id: `${tenantId}_evt01`,
        tenantId,
        title: "EU Streaming Service Outage",
        description: "European edge nodes experiencing widespread latency issues affecting video streaming quality and availability.",
        severity: "critical",
        priority: "critical",
        status: "active",
        category: "service",
        subcategory: "streaming",
        event_type: "service_outage",
        impact_scope: "regional",
        detected_at: now.toISOString(),
        last_updated_at: now.toISOString(),
        resolved_at: null,
        duration_minutes: null,
        related_alert_ids: [`${tenantId}_alert01`],
        related_incident_ids: [`${tenantId}_inc01`],
        related_problem_ids: [`${tenantId}_prob01`],
        asset_id: `${tenantId}_asset_gce_vm01`,
        service_component_id: `${tenantId}_comp_edge01`,
        business_service_id: `${tenantId}_svc_streaming`,
        root_cause_analysis: "Edge node capacity exceeded during peak viewing hours",
        business_impact: "50% of EU users experiencing buffering and connection failures",
        affected_user_count: 125000,
        escalation_level: 3,
        health_status: "red",
        tags: ["streaming", "latency", "edge", "europe"],
        custom_fields: {
          region: "eu-west-1",
          latency_p95_ms: 285,
          capacity_utilization: 98,
          concurrent_viewers: 125000
        }
      },
      {
        id: `${tenantId}_evt02`,
        tenantId,
        title: "Transcoding Pipeline Instability",
        description: "Kubernetes transcoding workloads experiencing frequent OOM kills and pod restarts, affecting video processing.",
        severity: "major",
        priority: "high",
        status: "active",
        category: "application",
        subcategory: "containerization",
        event_type: "application_instability",
        impact_scope: "single_service",
        detected_at: now.toISOString(),
        last_updated_at: now.toISOString(),
        resolved_at: null,
        duration_minutes: null,
        related_alert_ids: [`${tenantId}_alert02`],
        related_incident_ids: [`${tenantId}_inc02`],
        related_problem_ids: [`${tenantId}_prob02`],
        asset_id: `${tenantId}_asset_gke_node01`,
        service_component_id: `${tenantId}_comp_gke_cluster01`,
        business_service_id: `${tenantId}_svc_transcoding`,
        root_cause_analysis: "Memory allocation insufficient for high-resolution video processing",
        business_impact: "Video processing delays of 2-4 hours, affecting content availability",
        affected_user_count: 15000,
        escalation_level: 1,
        health_status: "orange",
        tags: ["kubernetes", "transcoding", "oom", "memory"],
        custom_fields: {
          cluster_name: "media-prod-01",
          oom_kill_count_last_hour: 12,
          pod_restart_count: 47,
          processing_backlog_hours: 3.5
        }
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    events = [
      {
        id: `${tenantId}_evt01`,
        tenantId,
        title: "Financial Reporting Database Crisis",
        description: "Critical replication lag in PostgreSQL cluster affecting real-time financial analytics and regulatory reporting.",
        severity: "critical",
        priority: "critical",
        status: "active",
        category: "database",
        subcategory: "replication",
        event_type: "data_availability",
        impact_scope: "business_critical",
        detected_at: now.toISOString(),
        last_updated_at: now.toISOString(),
        resolved_at: null,
        duration_minutes: null,
        related_alert_ids: [`${tenantId}_alert01`],
        related_incident_ids: [`${tenantId}_inc01`],
        related_problem_ids: [`${tenantId}_prob01`],
        asset_id: `${tenantId}_asset_db01`,
        service_component_id: `${tenantId}_comp_reportingdb`,
        business_service_id: `${tenantId}_svc_fin_reporting`,
        root_cause_analysis: "Massive transaction load during market close overwhelming replica I/O",
        business_impact: "Real-time analytics delayed, regulatory reporting at risk",
        affected_user_count: 150,
        escalation_level: 3,
        health_status: "red",
        tags: ["postgresql", "replication", "financial", "regulatory"],
        custom_fields: {
          replication_lag_minutes: 42,
          affected_reports: ["daily_pnl", "risk_metrics", "compliance_summary"],
          regulatory_deadline: "2025-01-16T09:00:00Z"
        }
      },
      {
        id: `${tenantId}_evt02`,
        tenantId,
        title: "Data Analytics Pipeline Degradation",
        description: "Spark ETL jobs failing at high rate, causing data lake ingestion delays and affecting morning analytics reports.",
        severity: "major",
        priority: "high",
        status: "active",
        category: "data",
        subcategory: "etl",
        event_type: "data_processing_failure",
        impact_scope: "analytical_services",
        detected_at: now.toISOString(),
        last_updated_at: now.toISOString(),
        resolved_at: null,
        duration_minutes: null,
        related_alert_ids: [`${tenantId}_alert02`],
        related_incident_ids: [`${tenantId}_inc02`],
        related_problem_ids: [`${tenantId}_prob02`],
        asset_id: `${tenantId}_asset_etl01`,
        service_component_id: `${tenantId}_comp_datalake01`,
        business_service_id: `${tenantId}_svc_data_analytics`,
        root_cause_analysis: "Cluster resource contention during peak processing hours",
        business_impact: "Morning analytics reports delayed by 4-6 hours",
        affected_user_count: 75,
        escalation_level: 2,
        health_status: "orange",
        tags: ["spark", "etl", "datalake", "analytics"],
        custom_fields: {
          failure_rate_percent: 23,
          jobs_failed_count: 11,
          jobs_total_count: 47,
          data_delay_hours: 4.5
        }
      },
    ];
  }

  // Insert events with proper error handling
  for (const evt of events) {
    try {
      await db.put("events", evt);

      // Create COMPLETE audit log entry matching AuditLogEntry interface
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "event",
        entity_id: evt.id,
        action: "create",
        description: `Service event detected: ${evt.title} (${evt.severity}) - ${evt.business_impact}`,
        timestamp: evt.detected_at,
        user_id: "system", // Required field - events are system detected
        tags: ["seed", "event", "detected", evt.severity],
        hash: await generateHash({
          entity_type: "event",
          entity_id: evt.id,
          action: "create",
          timestamp: evt.detected_at,
          tenantId
        }),
        metadata: {
          event_title: evt.title,
          severity: evt.severity,
          status: evt.status,
          event_type: evt.event_type,
          impact_scope: evt.impact_scope,
          business_service_id: evt.business_service_id,
          asset_id: evt.asset_id,
          affected_user_count: evt.affected_user_count,
          escalation_level: evt.escalation_level,
          related_counts: {
            alerts: evt.related_alert_ids.length,
            incidents: evt.related_incident_ids.length,
            problems: evt.related_problem_ids.length
          }
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: evt.detected_at,
        message: `Service event "${evt.title}" detected with ${evt.severity} severity affecting ${evt.affected_user_count} users`,
        storeName: "events", // Required field for dbClient compatibility
        recordId: evt.id, // Required field for dbClient compatibility  
        action: "create",
        userId: "system", // System detects events
        metadata: {
          event_id: evt.id,
          event_title: evt.title,
          severity: evt.severity,
          event_type: evt.event_type,
          impact_scope: evt.impact_scope,
          business_impact: evt.business_impact,
          affected_users: evt.affected_user_count,
          escalation_level: evt.escalation_level,
          root_cause: evt.root_cause_analysis,
          related_entities: [
            { type: "asset", id: evt.asset_id },
            { type: "service_component", id: evt.service_component_id },
            { type: "business_service", id: evt.business_service_id },
            ...evt.related_alert_ids.map((id: string) => ({ type: "alert", id })),
            ...evt.related_incident_ids.map((id: string) => ({ type: "incident", id })),
            ...evt.related_problem_ids.map((id: string) => ({ type: "problem", id }))
          ]
        }
      });

      console.log(`✅ Seeded event: ${evt.id} - ${evt.title}`);
    } catch (error) {
      console.error(`❌ Failed to seed event ${evt.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${events.length} events for ${tenantId}`);
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