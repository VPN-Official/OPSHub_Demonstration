// src/db/seeds/seedAlerts.ts - FULLY CORRECTED
import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedAlerts = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let alerts: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    alerts = [
      {
        id: `${tenantId}_alert01`,
        tenantId,
        source: "Syslog",
        title: "Router CPU utilization exceeded 90%",
        description: "Core router R1 CPU usage above threshold for 5 minutes. Current utilization: 92%.",
        severity: "critical",
        priority: "high", // Added priority
        status: "active",
        category: "performance", // Added category
        subcategory: "cpu", // Added subcategory
        triggered_at: now,
        acknowledged_at: null, // Added acknowledgment tracking
        resolved_at: null, // Added resolution tracking
        asset_id: `${tenantId}_asset_router01`,
        service_component_id: `${tenantId}_comp_router01`,
        business_service_id: `${tenantId}_svc_network`,
        alert_rule_id: `${tenantId}_rule_cpu_threshold`, // Added rule reference
        metric_name: "cpu.utilization", // Added metric reference
        threshold_value: 90, // Added threshold
        current_value: 92, // Added current value
        escalation_level: 1, // Added escalation tracking
        notification_sent: true, // Added notification status
        health_status: "red", // Added health status
        tags: ["router", "cpu", "performance", "threshold"],
        custom_fields: {
          router_model: "cisco-isr-4431",
          interface_count: 24,
          uptime_hours: 168
        }
      },
      {
        id: `${tenantId}_alert02`,
        tenantId,
        source: "SNMP",
        title: "Switch port errors increasing",
        description: "CRC errors detected on TOR switch S1 port Gi1/0/1. Error rate: 0.5% over 10 minutes.",
        severity: "warning",
        priority: "medium",
        status: "active",
        category: "network",
        subcategory: "errors",
        triggered_at: now,
        acknowledged_at: null,
        resolved_at: null,
        asset_id: `${tenantId}_asset_switch01`,
        service_component_id: `${tenantId}_comp_switch01`,
        business_service_id: `${tenantId}_svc_network`,
        alert_rule_id: `${tenantId}_rule_port_errors`,
        metric_name: "interface.errors.crc",
        threshold_value: 0.1,
        current_value: 0.5,
        escalation_level: 0,
        notification_sent: true,
        health_status: "yellow",
        tags: ["switch", "crc", "errors", "interface"],
        custom_fields: {
          switch_model: "cisco-3750x",
          port_id: "Gi1/0/1",
          error_count: 47
        }
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    alerts = [
      {
        id: `${tenantId}_alert01`,
        tenantId,
        source: "Stackdriver",
        title: "Stream latency threshold breached",
        description: "EU edge node latency > 250ms observed for 120 seconds. Current avg: 285ms.",
        severity: "critical",
        priority: "high",
        status: "active",
        category: "performance",
        subcategory: "latency",
        triggered_at: now,
        acknowledged_at: null,
        resolved_at: null,
        asset_id: `${tenantId}_asset_gce_vm01`,
        service_component_id: `${tenantId}_comp_edge01`,
        business_service_id: `${tenantId}_svc_streaming`,
        alert_rule_id: `${tenantId}_rule_latency_threshold`,
        metric_name: "streaming.latency.p95",
        threshold_value: 250,
        current_value: 285,
        escalation_level: 1,
        notification_sent: true,
        health_status: "red",
        tags: ["latency", "edge", "streaming", "performance"],
        custom_fields: {
          region: "eu-west-1",
          instance_type: "n1-highmem-4",
          concurrent_streams: 1247
        }
      },
      {
        id: `${tenantId}_alert02`,
        tenantId,
        source: "GKE Metrics",
        title: "Pod OOM kills detected",
        description: "Transcoding workload pods killed due to memory limits. 5 kills in last 10 minutes.",
        severity: "warning",
        priority: "medium",
        status: "active",
        category: "resource",
        subcategory: "memory",
        triggered_at: now,
        acknowledged_at: null,
        resolved_at: null,
        asset_id: `${tenantId}_asset_gke_node01`,
        service_component_id: `${tenantId}_comp_gke_cluster01`,
        business_service_id: `${tenantId}_svc_transcoding`,
        alert_rule_id: `${tenantId}_rule_oom_kills`,
        metric_name: "container.memory.oom_kills",
        threshold_value: 3,
        current_value: 5,
        escalation_level: 0,
        notification_sent: true,
        health_status: "orange",
        tags: ["gke", "oom", "transcoding", "memory"],
        custom_fields: {
          cluster_name: "media-prod-01",
          namespace: "transcoding",
          pod_count: 12,
          memory_limit_gb: 2
        }
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    alerts = [
      {
        id: `${tenantId}_alert01`,
        tenantId,
        source: "CloudWatch",
        title: "DB replication lag",
        description: "Replication lag > 30 min on reporting DB cluster. Current lag: 42 minutes.",
        severity: "critical",
        priority: "high",
        status: "active",
        category: "database",
        subcategory: "replication",
        triggered_at: now,
        acknowledged_at: null,
        resolved_at: null,
        asset_id: `${tenantId}_asset_db01`,
        service_component_id: `${tenantId}_comp_reportingdb`,
        business_service_id: `${tenantId}_svc_fin_reporting`,
        alert_rule_id: `${tenantId}_rule_replication_lag`,
        metric_name: "database.replication.lag_minutes",
        threshold_value: 30,
        current_value: 42,
        escalation_level: 1,
        notification_sent: true,
        health_status: "red",
        tags: ["database", "replication", "lag", "postgresql"],
        custom_fields: {
          database_type: "postgresql",
          replica_count: 3,
          primary_instance: "db-primary-01"
        }
      },
      {
        id: `${tenantId}_alert02`,
        tenantId,
        source: "Spark Metrics",
        title: "ETL job failures detected",
        description: "Failure rate > 20% observed in nightly ETL ingestion jobs. Current rate: 23%.",
        severity: "warning",
        priority: "medium",
        status: "active",
        category: "data",
        subcategory: "etl",
        triggered_at: now,
        acknowledged_at: null,
        resolved_at: null,
        asset_id: `${tenantId}_asset_etl01`,
        service_component_id: `${tenantId}_comp_datalake01`,
        business_service_id: `${tenantId}_svc_data_analytics`,
        alert_rule_id: `${tenantId}_rule_etl_failure_rate`,
        metric_name: "etl.job.failure_rate_percent",
        threshold_value: 20,
        current_value: 23,
        escalation_level: 0,
        notification_sent: true,
        health_status: "orange",
        tags: ["etl", "spark", "pipeline", "failure"],
        custom_fields: {
          cluster_size: "8_nodes",
          job_count_total: 47,
          job_count_failed: 11
        }
      },
    ];
  }

  // Insert alerts with proper error handling
  for (const alert of alerts) {
    try {
      await db.put("alerts", alert);

      // Create COMPLETE audit log entry matching AuditLogEntry interface
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "alert",
        entity_id: alert.id,
        action: "create",
        description: `Alert triggered: ${alert.title} (${alert.severity}) from ${alert.source}`,
        timestamp: now,
        user_id: "system", // Required field - using system for alert triggers
        tags: ["seed", "alert", "triggered"],
        hash: await generateHash({
          entity_type: "alert",
          entity_id: alert.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          severity: alert.severity,
          status: alert.status,
          source: alert.source,
          business_service_id: alert.business_service_id,
          asset_id: alert.asset_id,
          threshold_value: alert.threshold_value,
          current_value: alert.current_value,
          metric_name: alert.metric_name
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `Alert "${alert.title}" triggered from ${alert.source} with severity ${alert.severity}`,
        storeName: "alerts", // Required field for dbClient compatibility
        recordId: alert.id, // Required field for dbClient compatibility  
        action: "create",
        userId: "system", // System triggers alerts
        metadata: {
          alert_id: alert.id,
          severity: alert.severity,
          source: alert.source,
          metric_name: alert.metric_name,
          threshold_breach: {
            threshold: alert.threshold_value,
            current: alert.current_value
          },
          related_entities: [
            { type: "asset", id: alert.asset_id },
            { type: "service_component", id: alert.service_component_id },
            { type: "business_service", id: alert.business_service_id }
          ]
        }
      });

      console.log(`✅ Seeded alert: ${alert.id} - ${alert.title}`);
    } catch (error) {
      console.error(`❌ Failed to seed alert ${alert.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${alerts.length} alerts for ${tenantId}`);
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