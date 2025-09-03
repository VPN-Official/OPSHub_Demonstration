// src/db/seeds/seedMetrics.ts - FULLY CORRECTED
import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedMetrics = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date();
  let metrics: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    metrics = [
      {
        id: `${tenantId}_metric01`,
        tenantId,
        name: "Router CPU Utilization",
        description: "CPU usage percentage on core network router",
        value: 87.3,
        unit: "%",
        metric_type: "gauge", // Added metric type
        category: "performance", // Added category
        source: "snmp_exporter", // Added source
        collected_at: now.toISOString(),
        data_retention_days: 90, // Added retention policy
        asset_id: `${tenantId}_asset_router01`,
        service_component_id: `${tenantId}_comp_router01`,
        business_service_id: `${tenantId}_svc_network`,
        alert_threshold_warning: 80, // Added thresholds
        alert_threshold_critical: 90,
        health_status: "orange", // Added health status
        tags: ["cpu", "router", "performance", "snmp"],
        custom_fields: {
          collection_interval_seconds: 60,
          router_model: "cisco-isr-4431",
          location: "datacenter-01"
        }
      },
      {
        id: `${tenantId}_metric02`,
        tenantId,
        name: "Exchange Queue Length",
        description: "Number of emails in Exchange server mail queue",
        value: 247,
        unit: "count",
        metric_type: "gauge",
        category: "application",
        source: "wmi_exporter",
        collected_at: now.toISOString(),
        data_retention_days: 30,
        asset_id: `${tenantId}_asset_exchange01`,
        service_component_id: `${tenantId}_comp_exchange01`,
        business_service_id: `${tenantId}_svc_email`,
        alert_threshold_warning: 100,
        alert_threshold_critical: 500,
        health_status: "red",
        tags: ["exchange", "queue", "email", "wmi"],
        custom_fields: {
          collection_interval_seconds: 300,
          queue_type: "submission",
          server_version: "2019"
        }
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    metrics = [
      {
        id: `${tenantId}_metric01`,
        tenantId,
        name: "Stream Latency P95",
        description: "95th percentile streaming latency from EU edge nodes",
        value: 285.7,
        unit: "ms",
        metric_type: "histogram",
        category: "performance",
        source: "stackdriver",
        collected_at: now.toISOString(),
        data_retention_days: 365,
        asset_id: `${tenantId}_asset_gce_vm01`,
        service_component_id: `${tenantId}_comp_edge01`,
        business_service_id: `${tenantId}_svc_streaming`,
        alert_threshold_warning: 200,
        alert_threshold_critical: 250,
        health_status: "red",
        tags: ["latency", "streaming", "p95", "edge"],
        custom_fields: {
          collection_interval_seconds: 30,
          region: "eu-west-1",
          sample_count: 1247
        }
      },
      {
        id: `${tenantId}_metric02`,
        tenantId,
        name: "GKE Pod Memory Usage",
        description: "Memory utilization across transcoding pods",
        value: 78.4,
        unit: "%",
        metric_type: "gauge",
        category: "resource",
        source: "kubernetes_metrics",
        collected_at: now.toISOString(),
        data_retention_days: 90,
        asset_id: `${tenantId}_asset_gke_node01`,
        service_component_id: `${tenantId}_comp_gke_cluster01`,
        business_service_id: `${tenantId}_svc_transcoding`,
        alert_threshold_warning: 70,
        alert_threshold_critical: 85,
        health_status: "orange",
        tags: ["memory", "gke", "transcoding", "kubernetes"],
        custom_fields: {
          collection_interval_seconds: 15,
          cluster_name: "media-prod-01",
          namespace: "transcoding",
          pod_count: 12
        }
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    metrics = [
      {
        id: `${tenantId}_metric01`,
        tenantId,
        name: "Database Replication Lag",
        description: "PostgreSQL replica lag in minutes for financial reporting cluster",
        value: 42.5,
        unit: "minutes",
        metric_type: "gauge",
        category: "database",
        source: "postgres_exporter",
        collected_at: now.toISOString(),
        data_retention_days: 180,
        asset_id: `${tenantId}_asset_db01`,
        service_component_id: `${tenantId}_comp_reportingdb`,
        business_service_id: `${tenantId}_svc_fin_reporting`,
        alert_threshold_warning: 15,
        alert_threshold_critical: 30,
        health_status: "red",
        tags: ["database", "replication", "lag", "postgresql"],
        custom_fields: {
          collection_interval_seconds: 60,
          database_version: "13.8",
          replica_count: 3,
          primary_instance: "db-primary-01"
        }
      },
      {
        id: `${tenantId}_metric02`,
        tenantId,
        name: "ETL Job Failure Rate",
        description: "Percentage of failed Spark ETL jobs in data analytics pipeline",
        value: 23.4,
        unit: "%",
        metric_type: "gauge",
        category: "data",
        source: "spark_metrics",
        collected_at: now.toISOString(),
        data_retention_days: 120,
        asset_id: `${tenantId}_asset_etl01`,
        service_component_id: `${tenantId}_comp_datalake01`,
        business_service_id: `${tenantId}_svc_data_analytics`,
        alert_threshold_warning: 10,
        alert_threshold_critical: 20,
        health_status: "red",
        tags: ["etl", "spark", "pipeline", "failure_rate"],
        custom_fields: {
          collection_interval_seconds: 900,
          cluster_size: "8_nodes",
          job_count_total: 47,
          job_count_failed: 11
        }
      },
    ];
  }

  // Insert metrics with proper error handling
  for (const metric of metrics) {
    try {
      await db.put("metrics", metric);

      // Create COMPLETE audit log entry matching AuditLogEntry interface
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "metric",
        entity_id: metric.id,
        action: "collect",
        description: `Metric collected: ${metric.name} = ${metric.value}${metric.unit} from ${metric.source}`,
        timestamp: metric.collected_at,
        user_id: "system", // Required field - metrics are system collected
        tags: ["seed", "metric", "collect"],
        hash: await generateHash({
          entity_type: "metric",
          entity_id: metric.id,
          action: "collect",
          timestamp: metric.collected_at,
          tenantId
        }),
        metadata: {
          metric_name: metric.name,
          value: metric.value,
          unit: metric.unit,
          source: metric.source,
          business_service_id: metric.business_service_id,
          asset_id: metric.asset_id,
          category: metric.category,
          health_status: metric.health_status
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: metric.collected_at,
        message: `Metric "${metric.name}" collected: ${metric.value}${metric.unit} (${metric.health_status} status)`,
        storeName: "metrics", // Required field for dbClient compatibility
        recordId: metric.id, // Required field for dbClient compatibility  
        action: "create",
        userId: "system", // System collects metrics
        metadata: {
          metric_id: metric.id,
          metric_name: metric.name,
          value: metric.value,
          unit: metric.unit,
          source: metric.source,
          category: metric.category,
          thresholds: {
            warning: metric.alert_threshold_warning,
            critical: metric.alert_threshold_critical
          },
          collection_details: {
            interval_seconds: metric.custom_fields?.collection_interval_seconds,
            retention_days: metric.data_retention_days
          },
          related_entities: [
            { type: "asset", id: metric.asset_id },
            { type: "service_component", id: metric.service_component_id },
            { type: "business_service", id: metric.business_service_id }
          ]
        }
      });

      console.log(`✅ Seeded metric: ${metric.id} - ${metric.name} = ${metric.value}${metric.unit}`);
    } catch (error) {
      console.error(`❌ Failed to seed metric ${metric.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${metrics.length} metrics for ${tenantId}`);
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