// src/db/seeds/seedProblems.ts - FULLY CORRECTED
import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedProblems = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let problems: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    problems = [
      {
        id: `${tenantId}_prob01`,
        tenantId,
        title: "High CPU utilization on core router",
        description: "Router CPU spikes observed repeatedly during peak hours. Root cause analysis links to BGP table size and inefficient route processing.",
        status: "open",
        priority: "high",
        severity: "P2", // Added severity
        impact: "high", // Added impact
        urgency: "medium", // Added urgency
        category: "infrastructure", // Added category
        subcategory: "network", // Added subcategory
        created_at: now,
        updated_at: now,
        assigned_team_id: `${tenantId}_team_network`,
        assigned_to_user_id: `${tenantId}_user_netops01`, // Added assignee
        reported_by: `${tenantId}_user_monitor01`, // Added reporter
        business_service_id: `${tenantId}_svc_internet`, // Added business service
        root_cause: "BGP table memory consumption exceeding capacity", // Added root cause
        workaround: "Traffic load balancing across secondary routers", // Added workaround
        related_incident_ids: [`${tenantId}_inc01`],
        related_change_ids: [], // Added for completeness
        health_status: "orange", // Added health status
        tags: ["router", "performance", "bgp", "cpu"],
        custom_fields: {
          cpu_threshold: "85%",
          affected_routers: ["router01", "router02"]
        }
      },
      {
        id: `${tenantId}_prob02`,
        tenantId,
        title: "Switch instability causing packet loss",
        description: "TOR switch experiencing intermittent port flapping across multiple network segments. Hardware diagnostics pending.",
        status: "investigating",
        priority: "medium",
        severity: "P3",
        impact: "medium",
        urgency: "medium",
        category: "hardware",
        subcategory: "network",
        created_at: now,
        updated_at: now,
        assigned_team_id: `${tenantId}_team_network`,
        assigned_to_user_id: `${tenantId}_user_netops02`,
        reported_by: `${tenantId}_user_monitor01`,
        business_service_id: `${tenantId}_svc_lan`,
        root_cause: "Suspected hardware failure in switch fabric",
        workaround: "Port mirroring to backup switch ports",
        related_incident_ids: [`${tenantId}_inc02`],
        related_change_ids: [],
        health_status: "yellow",
        tags: ["switch", "packetloss", "hardware", "tor"],
        custom_fields: {
          switch_model: "cisco-3750x",
          affected_ports: ["Gi1/0/1", "Gi1/0/2"]
        }
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    problems = [
      {
        id: `${tenantId}_prob01`,
        tenantId,
        title: "EU edge node service degradation",
        description: "Streaming latency issues in European region due to overloaded edge VMs. Performance degradation during peak viewing hours.",
        status: "open",
        priority: "high",
        severity: "P2",
        impact: "high",
        urgency: "high",
        category: "performance",
        subcategory: "streaming",
        created_at: now,
        updated_at: now,
        assigned_team_id: `${tenantId}_team_sre`,
        assigned_to_user_id: `${tenantId}_user_sre01`,
        reported_by: `${tenantId}_user_monitor01`,
        business_service_id: `${tenantId}_svc_streaming`,
        root_cause: "Insufficient edge node capacity for regional load",
        workaround: "Traffic rerouting to US edge nodes with CDN",
        related_incident_ids: [`${tenantId}_inc01`],
        related_change_ids: [],
        health_status: "red",
        tags: ["streaming", "latency", "edge", "europe"],
        custom_fields: {
          region: "eu-west-1",
          latency_ms: "250",
          capacity_utilization: "95%"
        }
      },
      {
        id: `${tenantId}_prob02`,
        tenantId,
        title: "GKE transcoding workload instability",
        description: "Recurring OOM kills in transcoding pods causing job failures. Memory allocation and resource limits need optimization.",
        status: "in_progress",
        priority: "medium",
        severity: "P3",
        impact: "medium",
        urgency: "medium",
        category: "application",
        subcategory: "containerization",
        created_at: now,
        updated_at: now,
        assigned_team_id: `${tenantId}_team_mediaops`,
        assigned_to_user_id: `${tenantId}_user_k8s01`,
        reported_by: `${tenantId}_user_devops01`,
        business_service_id: `${tenantId}_svc_transcoding`,
        root_cause: "Memory limits too low for high-resolution transcoding jobs",
        workaround: "Reduced concurrent transcoding jobs and pod restarts",
        related_incident_ids: [`${tenantId}_inc02`],
        related_change_ids: [],
        health_status: "orange",
        tags: ["gke", "oom", "transcoding", "kubernetes"],
        custom_fields: {
          cluster: "media-prod-01",
          namespace: "transcoding",
          memory_limit: "2Gi",
          oom_kill_count: "47"
        }
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    problems = [
      {
        id: `${tenantId}_prob01`,
        tenantId,
        title: "Database replication lag recurring",
        description: "PostgreSQL replica experiencing consistent lag spikes during financial reporting batch jobs, affecting real-time analytics.",
        status: "open",
        priority: "high",
        severity: "P1",
        impact: "high",
        urgency: "high",
        category: "database",
        subcategory: "replication",
        created_at: now,
        updated_at: now,
        assigned_team_id: `${tenantId}_team_dba`,
        assigned_to_user_id: `${tenantId}_user_dba01`,
        reported_by: `${tenantId}_user_monitor01`,
        business_service_id: `${tenantId}_svc_fin_reporting`,
        root_cause: "High transaction volume overwhelming replica I/O capacity",
        workaround: "Read queries redirected to secondary replica during peak hours",
        related_incident_ids: [`${tenantId}_inc01`],
        related_change_ids: [],
        health_status: "red",
        tags: ["database", "replication", "lag", "postgresql"],
        custom_fields: {
          max_lag_minutes: "45",
          avg_lag_minutes: "15",
          replica_type: "streaming"
        }
      },
      {
        id: `${tenantId}_prob02`,
        tenantId,
        title: "ETL job reliability issues",
        description: "Nightly Spark ETL jobs failing intermittently due to cluster instability. Data lake ingestion delays affecting morning reports.",
        status: "investigating",
        priority: "medium",
        severity: "P2",
        impact: "medium",
        urgency: "high",
        category: "data",
        subcategory: "etl",
        created_at: now,
        updated_at: now,
        assigned_team_id: `${tenantId}_team_dataops`,
        assigned_to_user_id: `${tenantId}_user_dataeng01`,
        reported_by: `${tenantId}_user_dataeng01`,
        business_service_id: `${tenantId}_svc_data_analytics`,
        root_cause: "Spark cluster resource contention and driver memory issues",
        workaround: "Manual job restarts with increased driver memory allocation",
        related_incident_ids: [`${tenantId}_inc02`],
        related_change_ids: [],
        health_status: "orange",
        tags: ["etl", "pipeline", "spark", "datalake"],
        custom_fields: {
          failure_rate: "23%",
          cluster_size: "8_nodes",
          driver_memory: "4g"
        }
      },
    ];
  }

  // Insert problems with proper error handling
  for (const prob of problems) {
    try {
      await db.put("problems", prob);

      // Create COMPLETE audit log entry matching AuditLogEntry interface
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "problem",
        entity_id: prob.id,
        action: "create",
        description: `Created problem: ${prob.title} (${prob.severity}) - linked to ${prob.related_incident_ids.length} incident(s)`,
        timestamp: now,
        user_id: "system", // Required field
        tags: ["seed", "problem", "create"],
        hash: await generateHash({
          entity_type: "problem",
          entity_id: prob.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          severity: prob.severity,
          status: prob.status,
          business_service_id: prob.business_service_id,
          assigned_team_id: prob.assigned_team_id,
          related_incident_count: prob.related_incident_ids.length
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `Problem "${prob.title}" created with severity ${prob.severity}, linked to ${prob.related_incident_ids.length} incident(s)`,
        storeName: "problems", // Required field for dbClient compatibility
        recordId: prob.id, // Required field for dbClient compatibility  
        action: "create",
        userId: "system", // Optional but helpful for tracking
        metadata: {
          problem_id: prob.id,
          severity: prob.severity,
          status: prob.status,
          business_service_id: prob.business_service_id,
          assigned_team_id: prob.assigned_team_id,
          root_cause: prob.root_cause,
          workaround: prob.workaround,
          related_entities: [
            { type: "business_service", id: prob.business_service_id },
            { type: "team", id: prob.assigned_team_id },
            ...prob.related_incident_ids.map((id: string) => ({ type: "incident", id }))
          ]
        }
      });

      console.log(`✅ Seeded problem: ${prob.id} - ${prob.title}`);
    } catch (error) {
      console.error(`❌ Failed to seed problem ${prob.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${problems.length} problems for ${tenantId}`);
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