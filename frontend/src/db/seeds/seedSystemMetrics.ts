import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedSystemMetrics = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let sysMetrics: any[] = [];

  sysMetrics = [
    {
      id: `${tenantId}_sys01`,
      tenantId,
      name: "Platform API Response Time",
      title: "AIOps Platform API Response Time",
      description: "Average response time for AIOps platform API endpoints across all services",
      metric_type: "response_time",
      value: 180,
      unit: "ms",
      target: 200,
      threshold_warning: 250,
      threshold_critical: 500,
      priority: "high",
      category: "performance",
      subcategory: "api_latency",
      health_status: "green",
      data_source: "api_gateway",
      collection_method: "automated",
      aggregation_period: "5min",
      retention_days: 90,
      owner_team: "platform_engineering",
      business_impact: "user_experience",
      measurement_frequency: "continuous",
      measured_at: now,
      last_updated: now,
      trend: "stable",
      percentile: "p95",
      sample_count: 1250,
      min_value: 85,
      max_value: 320,
      tags: ["platform", "api", "performance", "latency"],
      custom_fields: {
        endpoint_types: ["read", "write", "search"],
        geographic_regions: ["us-east", "us-west", "eu"],
        client_types: ["web", "mobile", "api"],
        sla_target: 200
      }
    },
    {
      id: `${tenantId}_sys02`,
      tenantId,
      name: "Agent Availability",
      title: "AIOps Agent Availability",
      description: "Percentage of AIOps agents that are online and responsive across all monitored systems",
      metric_type: "availability",
      value: 99.8,
      unit: "%",
      target: 99.9,
      threshold_warning: 99.5,
      threshold_critical: 99.0,
      priority: "critical",
      category: "availability",
      subcategory: "agent_health",
      health_status: "yellow",
      data_source: "agent_heartbeat",
      collection_method: "heartbeat_monitoring",
      aggregation_period: "1min",
      retention_days: 365,
      owner_team: "platform_operations",
      business_impact: "monitoring_coverage",
      measurement_frequency: "continuous",
      measured_at: now,
      last_updated: now,
      trend: "declining",
      percentile: null,
      sample_count: 2850,
      total_agents: 2850,
      online_agents: 2844,
      offline_agents: 6,
      tags: ["agents", "availability", "monitoring", "health"],
      custom_fields: {
        agent_types: ["system", "application", "network"],
        deployment_environments: ["production", "staging"],
        agent_versions: ["v2.1.0", "v2.0.8"],
        auto_restart_enabled: true
      }
    },
    {
      id: `${tenantId}_sys03`,
      tenantId,
      name: "Data Pipeline Throughput",
      title: "AIOps Data Pipeline Throughput",
      description: "Number of data records processed per second through the AIOps ingestion and processing pipeline",
      metric_type: "throughput",
      value: 4500,
      unit: "records/sec",
      target: 5000,
      threshold_warning: 3000,
      threshold_critical: 2000,
      priority: "high",
      category: "throughput",
      subcategory: "data_processing",
      health_status: "yellow",
      data_source: "kafka_metrics",
      collection_method: "streaming_telemetry",
      aggregation_period: "1min",
      retention_days: 30,
      owner_team: "data_engineering",
      business_impact: "data_freshness",
      measurement_frequency: "continuous",
      measured_at: now,
      last_updated: now,
      trend: "stable",
      percentile: null,
      sample_count: 4500,
      peak_value: 6200,
      off_peak_value: 2800,
      tags: ["pipeline", "throughput", "data_processing", "ingestion"],
      custom_fields: {
        pipeline_stages: ["ingestion", "transformation", "enrichment", "storage"],
        data_types: ["metrics", "logs", "traces", "events"],
        processing_latency_ms: 45,
        queue_depth: 125
      }
    },
  ];

  // Insert system metrics with proper error handling
  for (const metric of sysMetrics) {
    try {
      await db.put("system_metrics", metric);

      // Create COMPLETE audit log entry
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "system_metric",
        entity_id: metric.id,
        action: "create",
        description: `System metric recorded: ${metric.title} - ${metric.value}${metric.unit} (Target: ${metric.target}${metric.unit})`,
        timestamp: now,
        user_id: "system", // Required field
        tags: ["seed", "system_metric", "measurement", metric.category],
        hash: await generateHash({
          entity_type: "system_metric",
          entity_id: metric.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          metric_name: metric.name,
          title: metric.title,
          metric_type: metric.metric_type,
          current_value: metric.value,
          target_value: metric.target,
          unit: metric.unit,
          category: metric.category,
          priority: metric.priority,
          health_status: metric.health_status,
          data_source: metric.data_source,
          collection_method: metric.collection_method,
          trend: metric.trend,
          business_impact: metric.business_impact,
          owner_team: metric.owner_team,
          threshold_warning: metric.threshold_warning,
          threshold_critical: metric.threshold_critical
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `System metric "${metric.title}" recorded at ${metric.value}${metric.unit} (${metric.trend} trend, ${metric.health_status} status)`,
        storeName: "system_metrics", // Required field for dbClient compatibility
        recordId: metric.id, // Required field for dbClient compatibility
        action: "create",
        userId: "system",
        metadata: {
          metric_id: metric.id,
          metric_name: metric.name,
          measurement: {
            value: metric.value,
            unit: metric.unit,
            target: metric.target,
            trend: metric.trend
          },
          performance: {
            health_status: metric.health_status,
            sample_count: metric.sample_count,
            min_value: metric.min_value,
            max_value: metric.max_value
          },
          system_info: {
            data_source: metric.data_source,
            collection_method: metric.collection_method,
            owner_team: metric.owner_team,
            business_impact: metric.business_impact
          },
          related_entities: [] // System metrics don't typically have direct entity relationships
        }
      });

      console.log(`✅ Seeded system metric: ${metric.id} - ${metric.title}`);
    } catch (error) {
      console.error(`❌ Failed to seed system metric ${metric.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${sysMetrics.length} system metrics for ${tenantId}`);
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