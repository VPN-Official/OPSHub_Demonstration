import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedKpis = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let kpis: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    kpis = [
      {
        id: `${tenantId}_kpi01`,
        tenantId,
        name: "Network Uptime",
        description: "Percentage of time network infrastructure is available and operational",
        value: 99.95,
        unit: "%",
        target: 99.9,
        threshold_warning: 99.5,
        threshold_critical: 99.0,
        priority: "critical",
        category: "availability",
        subcategory: "uptime",
        health_status: "green",
        frequency: "daily",
        calculation_method: "(uptime_minutes / total_minutes) * 100",
        data_source: "network_monitoring",
        owner_team_id: `${tenantId}_team_noc`,
        measured_at: now,
        business_service_id: `${tenantId}_svc_network`,
        trend: "stable",
        variance_percent: 0.02,
        historical_average: 99.93,
        days_since_target_met: 45,
        last_breach_date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: now,
        tags: ["uptime", "sla", "network", "availability"],
        custom_fields: {
          measurement_window: "24h",
          reporting_schedule: "daily",
          escalation_threshold: 99.0,
          related_assets: ["router01", "switch01"]
        }
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    kpis = [
      {
        id: `${tenantId}_kpi01`,
        tenantId,
        name: "Streaming Latency SLA Compliance",
        description: "Percentage of streaming sessions meeting latency SLA requirements",
        value: 92,
        unit: "%",
        target: 95,
        threshold_warning: 93,
        threshold_critical: 90,
        priority: "high",
        category: "performance",
        subcategory: "latency",
        health_status: "yellow",
        frequency: "hourly",
        calculation_method: "(sessions_meeting_sla / total_sessions) * 100",
        data_source: "streaming_analytics",
        owner_team_id: `${tenantId}_team_sre`,
        measured_at: now,
        business_service_id: `${tenantId}_svc_streaming`,
        trend: "declining",
        variance_percent: -3.2,
        historical_average: 94.5,
        days_since_target_met: 12,
        last_breach_date: now,
        created_at: now,
        tags: ["latency", "sla", "streaming", "performance"],
        custom_fields: {
          measurement_window: "1h",
          reporting_schedule: "hourly",
          sla_threshold_ms: 250,
          affected_regions: ["eu-west-1"]
        }
      },
      {
        id: `${tenantId}_kpi02`,
        tenantId,
        name: "Transcoding Job Success Rate",
        description: "Percentage of transcoding jobs completing successfully without errors",
        value: 87,
        unit: "%",
        target: 95,
        threshold_warning: 90,
        threshold_critical: 85,
        priority: "medium",
        category: "reliability",
        subcategory: "job_success",
        health_status: "orange",
        frequency: "daily",
        calculation_method: "(successful_jobs / total_jobs) * 100",
        data_source: "job_scheduler",
        owner_team_id: `${tenantId}_team_mediaops`,
        measured_at: now,
        business_service_id: `${tenantId}_svc_transcoding`,
        trend: "improving",
        variance_percent: 2.1,
        historical_average: 85.2,
        days_since_target_met: 28,
        last_breach_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: now,
        tags: ["transcoding", "success_rate", "jobs", "reliability"],
        custom_fields: {
          measurement_window: "24h",
          reporting_schedule: "daily",
          job_types: ["video", "audio"],
          cluster_name: "media-prod-01"
        }
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    kpis = [
      {
        id: `${tenantId}_kpi01`,
        tenantId,
        name: "Timely Regulatory Reports",
        description: "Percentage of regulatory reports submitted within required deadlines",
        value: 97,
        unit: "%",
        target: 100,
        threshold_warning: 98,
        threshold_critical: 95,
        priority: "critical",
        category: "compliance",
        subcategory: "timeliness",
        health_status: "yellow",
        frequency: "monthly",
        calculation_method: "(on_time_reports / total_reports) * 100",
        data_source: "compliance_system",
        owner_team_id: `${tenantId}_team_compliance`,
        measured_at: now,
        business_service_id: `${tenantId}_svc_fin_reporting`,
        trend: "stable",
        variance_percent: -1.5,
        historical_average: 98.5,
        days_since_target_met: 90,
        last_breach_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: now,
        tags: ["reporting", "compliance", "regulatory", "timeliness"],
        custom_fields: {
          measurement_window: "monthly",
          reporting_schedule: "monthly",
          regulatory_bodies: ["SEC", "FINRA"],
          report_types: ["10-K", "10-Q", "8-K"]
        }
      },
      {
        id: `${tenantId}_kpi02`,
        tenantId,
        name: "ETL Job Completion",
        description: "Percentage of ETL data pipeline jobs completing successfully",
        value: 91,
        unit: "%",
        target: 98,
        threshold_warning: 95,
        threshold_critical: 90,
        priority: "high",
        category: "data_quality",
        subcategory: "pipeline_success",
        health_status: "orange",
        frequency: "daily",
        calculation_method: "(successful_etl_jobs / total_etl_jobs) * 100",
        data_source: "data_pipeline_monitor",
        owner_team_id: `${tenantId}_team_dataops`,
        measured_at: now,
        business_service_id: `${tenantId}_svc_data_analytics`,
        trend: "improving",
        variance_percent: 4.2,
        historical_average: 87.3,
        days_since_target_met: 60,
        last_breach_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: now,
        tags: ["etl", "pipeline", "data_quality", "success_rate"],
        custom_fields: {
          measurement_window: "24h",
          reporting_schedule: "daily",
          pipeline_count: 47,
          data_sources: ["CRM", "ERP", "Market Data"]
        }
      },
    ];
  }

  // Insert KPIs with proper error handling
  for (const kpi of kpis) {
    try {
      await db.put("kpis", kpi);

      // Create COMPLETE audit log entry
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "kpi",
        entity_id: kpi.id,
        action: "create",
        description: `KPI measurement recorded: ${kpi.name} - ${kpi.value}${kpi.unit} (Target: ${kpi.target}${kpi.unit})`,
        timestamp: now,
        user_id: "system", // Required field
        tags: ["seed", "kpi", "measurement", kpi.category],
        hash: await generateHash({
          entity_type: "kpi",
          entity_id: kpi.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          kpi_name: kpi.name,
          current_value: kpi.value,
          target_value: kpi.target,
          unit: kpi.unit,
          priority: kpi.priority,
          category: kpi.category,
          health_status: kpi.health_status,
          trend: kpi.trend,
          variance_percent: kpi.variance_percent,
          days_since_target_met: kpi.days_since_target_met,
          business_service_id: kpi.business_service_id,
          owner_team_id: kpi.owner_team_id
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `KPI "${kpi.name}" measured at ${kpi.value}${kpi.unit} (${kpi.trend} trend, ${kpi.health_status} status)`,
        storeName: "kpis", // Required field for dbClient compatibility
        recordId: kpi.id, // Required field for dbClient compatibility
        action: "create",
        userId: "system",
        metadata: {
          kpi_id: kpi.id,
          measurement: {
            value: kpi.value,
            unit: kpi.unit,
            target: kpi.target,
            variance_percent: kpi.variance_percent
          },
          performance: {
            trend: kpi.trend,
            health_status: kpi.health_status,
            days_since_target_met: kpi.days_since_target_met
          },
          related_entities: [
            { type: "business_service", id: kpi.business_service_id },
            { type: "team", id: kpi.owner_team_id }
          ].filter(entity => entity.id) // Remove null/undefined entries
        }
      });

      console.log(`✅ Seeded KPI: ${kpi.id} - ${kpi.name}`);
    } catch (error) {
      console.error(`❌ Failed to seed KPI ${kpi.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${kpis.length} KPIs for ${tenantId}`);
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