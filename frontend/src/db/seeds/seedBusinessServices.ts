// src/db/seeds/seedBusinessServices.ts - FULLY CORRECTED
import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";
import { addExternalSystemFieldsBatch } from "./externalSystemHelpers";

export const seedBusinessServices = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let services: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    services = [
      {
        id: `${tenantId}_svc_network`,
        tenantId,
        name: "Datacenter Network",
        description: "Core datacenter routing, switching and firewall services providing connectivity for all infrastructure.",
        owner_team_id: `${tenantId}_team_noc`,
        status: "operational",
        priority: "critical", // Added priority
        category: "infrastructure", // Added category
        subcategory: "network", // Added subcategory
        health_status: "yellow", // Added health status - yellow due to router issues
        created_at: now,
        updated_at: now,
        service_tier: "tier_1", // Added service tier
        availability_target: "99.99%", // Added availability target
        rto_minutes: 15, // Recovery Time Objective
        rpo_minutes: 5, // Recovery Point Objective
        business_criticality: "mission_critical", // Added business criticality
        customer_facing: false, // Internal infrastructure service
        compliance_requirements: ["sox", "iso27001"], // Added compliance
        cost_center: "IT_Infrastructure", // Added cost center
        service_hours: "24x7", // Added service hours
        escalation_policy: "immediate", // Added escalation policy
        monitoring_enabled: true, // Added monitoring flag
        backup_service_id: null, // No backup service
        dependencies: [], // Service dependencies
        sla_metrics: {
          availability: 99.95,
          response_time_ms: 50,
          throughput_mbps: 10000
        },
        contact_info: {
          primary_oncall: `${tenantId}_team_noc`,
          escalation_team: `${tenantId}_team_network`,
          email: "network-ops@dcn-meta.com"
        },
        tags: ["datacenter", "network", "infrastructure", "critical"],
        custom_fields: {
          primary_location: "DCN Meta DC1",
          backup_location: "DCN Meta DC2",
          bandwidth_capacity_gbps: 100,
          connected_assets_count: 200
        }
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    services = [
      {
        id: `${tenantId}_svc_streaming`,
        tenantId,
        name: "Live Streaming Service",
        description: "Handles low-latency global video streaming with real-time content delivery to millions of users.",
        owner_team_id: `${tenantId}_team_sre`,
        status: "operational",
        priority: "critical",
        category: "application",
        subcategory: "streaming",
        health_status: "green",
        created_at: now,
        updated_at: now,
        service_tier: "tier_0",
        availability_target: "99.99%",
        rto_minutes: 2,
        rpo_minutes: 0,
        business_criticality: "revenue_critical",
        customer_facing: true,
        compliance_requirements: ["gdpr", "coppa"],
        cost_center: "Media_Services",
        service_hours: "24x7",
        escalation_policy: "immediate",
        monitoring_enabled: true,
        backup_service_id: `${tenantId}_svc_transcoding`,
        dependencies: [`${tenantId}_asset_gce_vm01`],
        sla_metrics: {
          availability: 99.99,
          latency_p95_ms: 100,
          concurrent_viewers: 1000000
        },
        contact_info: {
          primary_oncall: `${tenantId}_team_sre`,
          escalation_team: `${tenantId}_team_mediaops`,
          email: "streaming-ops@av-google.com"
        },
        tags: ["streaming", "video", "live", "global"],
        custom_fields: {
          supported_formats: ["h264", "h265", "vp9"],
          max_bitrate_mbps: 50,
          geographic_regions: ["us", "eu", "apac"],
          cdn_providers: ["cloudflare", "fastly"]
        }
      },
      {
        id: `${tenantId}_svc_transcoding`,
        tenantId,
        name: "Media Transcoding",
        description: "Processes uploaded video content for multi-device playback with various quality levels and formats.",
        owner_team_id: `${tenantId}_team_mediaops`,
        status: "operational",
        priority: "high",
        category: "application",
        subcategory: "media_processing",
        health_status: "green",
        created_at: now,
        updated_at: now,
        service_tier: "tier_1",
        availability_target: "99.9%",
        rto_minutes: 10,
        rpo_minutes: 30,
        business_criticality: "business_critical",
        customer_facing: false,
        compliance_requirements: ["gdpr"],
        cost_center: "Media_Processing",
        service_hours: "24x7",
        escalation_policy: "standard",
        monitoring_enabled: true,
        backup_service_id: null,
        dependencies: [`${tenantId}_asset_gke_node01`],
        sla_metrics: {
          availability: 99.9,
          processing_time_minutes: 5,
          success_rate: 99.5
        },
        contact_info: {
          primary_oncall: `${tenantId}_team_mediaops`,
          escalation_team: `${tenantId}_team_sre`,
          email: "transcoding-ops@av-google.com"
        },
        tags: ["transcoding", "media", "processing", "kubernetes"],
        custom_fields: {
          processing_capacity_hours_per_day: 50000,
          supported_input_formats: ["mp4", "mov", "avi", "mkv"],
          output_qualities: ["240p", "480p", "720p", "1080p", "4k"],
          cluster_size: 12
        }
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    services = [
      {
        id: `${tenantId}_svc_fin_reporting`,
        tenantId,
        name: "Financial Reporting",
        description: "Generates end-of-day and intraday compliance & investor reports for regulatory requirements.",
        owner_team_id: `${tenantId}_team_dba`,
        status: "operational",
        priority: "critical",
        category: "application",
        subcategory: "financial",
        health_status: "yellow", // Yellow due to DB replication lag
        created_at: now,
        updated_at: now,
        service_tier: "tier_1",
        availability_target: "99.95%",
        rto_minutes: 30,
        rpo_minutes: 60,
        business_criticality: "regulatory_critical",
        customer_facing: true,
        compliance_requirements: ["sox", "sec", "finra"],
        cost_center: "Finance_Operations",
        service_hours: "business_hours_plus",
        escalation_policy: "immediate",
        monitoring_enabled: true,
        backup_service_id: null,
        dependencies: [`${tenantId}_asset_db01`],
        sla_metrics: {
          availability: 99.95,
          report_generation_time_minutes: 15,
          data_accuracy: 99.99
        },
        contact_info: {
          primary_oncall: `${tenantId}_team_dba`,
          escalation_team: `${tenantId}_team_dataops`,
          email: "fin-reporting@cloud-morningstar.com"
        },
        tags: ["financial", "reporting", "compliance", "regulatory"],
        custom_fields: {
          reporting_frequency: "daily",
          regulatory_deadlines: ["5pm_EST_daily"],
          data_retention_years: 7,
          report_types: ["10k", "10q", "earnings", "risk"]
        }
      },
      {
        id: `${tenantId}_svc_data_analytics`,
        tenantId,
        name: "Analytics Platform",
        description: "Cloud-hosted analytics and data science workloads supporting investment research and risk modeling.",
        owner_team_id: `${tenantId}_team_dataops`,
        status: "operational",
        priority: "high",
        category: "platform",
        subcategory: "analytics",
        health_status: "orange", // Orange due to ETL job failures
        created_at: now,
        updated_at: now,
        service_tier: "tier_2",
        availability_target: "99.5%",
        rto_minutes: 60,
        rpo_minutes: 240,
        business_criticality: "business_important",
        customer_facing: false,
        compliance_requirements: ["sox"],
        cost_center: "Data_Analytics",
        service_hours: "business_hours",
        escalation_policy: "standard",
        monitoring_enabled: true,
        backup_service_id: null,
        dependencies: [`${tenantId}_asset_etl01`],
        sla_metrics: {
          availability: 99.5,
          data_processing_time_hours: 4,
          pipeline_success_rate: 99.0
        },
        contact_info: {
          primary_oncall: `${tenantId}_team_dataops`,
          escalation_team: `${tenantId}_team_dba`,
          email: "analytics-ops@cloud-morningstar.com"
        },
        tags: ["analytics", "data", "etl", "research"],
        custom_fields: {
          data_volume_tb_per_day: 2.5,
          pipeline_count: 47,
          user_count: 125,
          supported_tools: ["spark", "jupyter", "tableau"]
        }
      },
    ];
  }

  // Add external system fields to all business services
  services = addExternalSystemFieldsBatch(services, 'business_service', tenantId);

  // Insert business services with proper error handling
  for (const svc of services) {
    try {
      await db.put("business_services", svc);

      // Create COMPLETE audit log entry matching AuditLogEntry interface
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "business_service",
        entity_id: svc.id,
        action: "create",
        description: `Business service created: ${svc.name} (${svc.category}) owned by ${svc.owner_team_id}`,
        timestamp: now,
        user_id: "system", // Required field - using system for service creation
        tags: ["seed", "business_service", "created"],
        hash: await generateHash({
          entity_type: "business_service",
          entity_id: svc.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          name: svc.name,
          category: svc.category,
          subcategory: svc.subcategory,
          status: svc.status,
          priority: svc.priority,
          service_tier: svc.service_tier,
          business_criticality: svc.business_criticality,
          customer_facing: svc.customer_facing,
          owner_team_id: svc.owner_team_id,
          availability_target: svc.availability_target,
          compliance_requirements: svc.compliance_requirements
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `Business service "${svc.name}" (${svc.category}) created with ${svc.service_tier} tier and ${svc.availability_target} availability target`,
        storeName: "business_services", // Required field for dbClient compatibility
        recordId: svc.id, // Required field for dbClient compatibility  
        action: "create",
        userId: "system", // System creates business services during seeding
        metadata: {
          service_id: svc.id,
          name: svc.name,
          category: svc.category,
          subcategory: svc.subcategory,
          service_configuration: {
            tier: svc.service_tier,
            availability_target: svc.availability_target,
            rto_minutes: svc.rto_minutes,
            rpo_minutes: svc.rpo_minutes
          },
          business_context: {
            criticality: svc.business_criticality,
            customer_facing: svc.customer_facing,
            compliance_requirements: svc.compliance_requirements,
            cost_center: svc.cost_center
          },
          operational_details: {
            owner_team: svc.owner_team_id,
            service_hours: svc.service_hours,
            escalation_policy: svc.escalation_policy,
            monitoring_enabled: svc.monitoring_enabled
          },
          dependencies: svc.dependencies,
          sla_metrics: svc.sla_metrics
        }
      });

      console.log(`✅ Seeded business service: ${svc.id} - ${svc.name}`);
    } catch (error) {
      console.error(`❌ Failed to seed business service ${svc.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${services.length} business services for ${tenantId}`);
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