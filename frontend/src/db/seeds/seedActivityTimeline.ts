import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedActivityTimeline = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date();
  let timeline: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    timeline = [
      {
        id: `${tenantId}_tl01`,
        tenantId,
        timestamp: new Date(now.getTime() - 600000).toISOString(),
        message: "Router CPU alert triggered - Router R1 CPU usage above threshold",
        storeName: "incidents",
        recordId: `${tenantId}_inc01`,
        action: "alert_triggered",
        userId: "system",
        category: "alert",
        subcategory: "cpu_threshold",
        priority: "critical",
        severity: "high",
        health_status: "red",
        metadata: {
          alert_id: `${tenantId}_alert01`,
          threshold_value: 90,
          current_value: 92,
          asset_id: `${tenantId}_asset_router01`,
          related_entities: [
            { type: "alert", id: `${tenantId}_alert01` },
            { type: "asset", id: `${tenantId}_asset_router01` }
          ]
        },
        tags: ["router", "cpu", "threshold", "critical", "infrastructure"]
      },
      {
        id: `${tenantId}_tl02`,
        tenantId,
        timestamp: new Date(now.getTime() - 300000).toISOString(),
        message: "Incident INC01 created - Critical router CPU utilization incident",
        storeName: "incidents",
        recordId: `${tenantId}_inc01`,
        action: "incident_created",
        userId: "system",
        category: "incident",
        subcategory: "auto_creation",
        priority: "critical",
        severity: "high",
        health_status: "red",
        metadata: {
          incident_id: `${tenantId}_inc01`,
          triggered_by_alert: `${tenantId}_alert01`,
          auto_created: true,
          escalation_level: 1,
          related_entities: [
            { type: "alert", id: `${tenantId}_alert01` },
            { type: "incident", id: `${tenantId}_inc01` }
          ]
        },
        tags: ["incident", "auto-creation", "critical", "network", "escalation"]
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    timeline = [
      {
        id: `${tenantId}_tl01`,
        tenantId,
        timestamp: new Date(now.getTime() - 900000).toISOString(),
        message: "Streaming latency event detected - EU edge node performance degradation",
        storeName: "events",
        recordId: `${tenantId}_evt01`,
        action: "event_detected",
        userId: "system",
        category: "performance",
        subcategory: "latency",
        priority: "high",
        severity: "medium",
        health_status: "yellow",
        metadata: {
          event_id: `${tenantId}_evt01`,
          latency_ms: 285,
          threshold_ms: 250,
          region: "eu-west-1",
          edge_node: "edge-01",
          related_entities: [
            { type: "event", id: `${tenantId}_evt01` },
            { type: "asset", id: `${tenantId}_asset_gce_vm01` }
          ]
        },
        tags: ["streaming", "latency", "edge", "performance", "eu-west"]
      },
      {
        id: `${tenantId}_tl02`,
        tenantId,
        timestamp: new Date(now.getTime() - 600000).toISOString(),
        message: "Problem logged - Systematic edge node latency issues identified",
        storeName: "problems",
        recordId: `${tenantId}_prob01`,
        action: "problem_created",
        userId: "sre_team",
        category: "problem",
        subcategory: "systematic_issue",
        priority: "high",
        severity: "medium",
        health_status: "yellow",
        metadata: {
          problem_id: `${tenantId}_prob01`,
          root_cause_analysis: "in_progress",
          affected_services: ["streaming", "transcoding"],
          impact_level: "moderate",
          related_entities: [
            { type: "problem", id: `${tenantId}_prob01` },
            { type: "event", id: `${tenantId}_evt01` }
          ]
        },
        tags: ["problem", "rca", "streaming", "edge-computing", "systematic"]
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    timeline = [
      {
        id: `${tenantId}_tl01`,
        tenantId,
        timestamp: new Date(now.getTime() - 3600000).toISOString(),
        message: "Database replication tuning change request submitted",
        storeName: "change_requests",
        recordId: `${tenantId}_chg01`,
        action: "change_requested",
        userId: "dba_team_lead",
        category: "change_management",
        subcategory: "database_tuning",
        priority: "critical",
        severity: "high",
        health_status: "orange",
        metadata: {
          change_id: `${tenantId}_chg01`,
          change_type: "performance_optimization",
          risk_level: "medium",
          business_justification: "reduce_replication_lag",
          affected_systems: ["reporting_db", "analytics_platform"],
          related_entities: [
            { type: "change_request", id: `${tenantId}_chg01` },
            { type: "asset", id: `${tenantId}_asset_db01` }
          ]
        },
        tags: ["change", "database", "replication", "performance", "tuning"]
      },
      {
        id: `${tenantId}_tl02`,
        tenantId,
        timestamp: new Date(now.getTime() - 1800000).toISOString(),
        message: "Change request approved by DBA lead - Database optimization authorized",
        storeName: "change_requests",
        recordId: `${tenantId}_chg01`,
        action: "change_approved",
        userId: "dba_lead",
        category: "change_management",
        subcategory: "approval",
        priority: "critical",
        severity: "medium",
        health_status: "green",
        metadata: {
          change_id: `${tenantId}_chg01`,
          approver: "Database Team Lead",
          approval_reason: "critical_performance_improvement",
          scheduled_window: "maintenance_window",
          rollback_plan: "verified",
          related_entities: [
            { type: "change_request", id: `${tenantId}_chg01` },
            { type: "user", id: "dba_lead" }
          ]
        },
        tags: ["approval", "database", "maintenance", "authorized", "performance"]
      },
    ];
  }

  // Insert timeline entries with proper error handling
  // Note: We don't create audit logs for timeline entries to avoid circular dependencies
  for (const entry of timeline) {
    try {
      await db.put("activity_timeline", entry);
      console.log(`✅ Seeded activity timeline entry: ${entry.id} - ${entry.message}`);
    } catch (error) {
      console.error(`❌ Failed to seed timeline entry ${entry.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${timeline.length} activity timeline entries for ${tenantId}`);
};