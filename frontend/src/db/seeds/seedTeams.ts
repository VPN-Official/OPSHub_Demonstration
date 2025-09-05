// src/db/seeds/seedTeams.ts - FULLY CORRECTED
import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedTeams = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let teams: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    teams = [
      {
        id: `${tenantId}_team_noc`,
        tenantId,
        name: "Network Operations Center",
        description: "24x7 monitoring and troubleshooting of DCN infrastructure. Primary response team for network incidents.",
        created_at: now,
        updated_at: now,
        status: "active", // Added status
        priority: "high", // Added priority for critical teams
        category: "operations", // Added category
        subcategory: "monitoring", // Added subcategory
        health_status: "green", // Added health status
        team_lead: "Sarah Johnson", // Added team lead
        team_size: 12, // Added team size
        shift_coverage: "24x7", // Added shift coverage
        escalation_level: 1, // Added escalation level
        on_call_rotation: true, // Added on-call indicator
        primary_focus: ["network_monitoring", "incident_response", "performance_analysis"],
        expertise_areas: ["cisco", "juniper", "network_protocols", "syslog"],
        contact_info: {
          email: "noc@dcn-meta.com",
          slack_channel: "#noc-alerts",
          phone: "+1-555-NOC-HELP"
        },
        tags: ["noc", "network", "24x7", "monitoring"],
        custom_fields: {
          location: "primary_datacenter",
          backup_location: "remote_noc",
          sla_response_time_minutes: 5
        }
      },
      {
        id: `${tenantId}_team_network`,
        tenantId,
        name: "Network Engineering",
        description: "Handles deep troubleshooting, configuration changes, and network architecture planning.",
        created_at: now,
        updated_at: now,
        status: "active",
        priority: "high",
        category: "engineering",
        subcategory: "network",
        health_status: "green",
        team_lead: "Marcus Chen",
        team_size: 8,
        shift_coverage: "business_hours",
        escalation_level: 2,
        on_call_rotation: true,
        primary_focus: ["network_design", "troubleshooting", "capacity_planning"],
        expertise_areas: ["routing", "switching", "sdwan", "network_security"],
        contact_info: {
          email: "neteng@dcn-meta.com",
          slack_channel: "#network-eng",
          phone: "+1-555-NET-ENG"
        },
        tags: ["engineering", "network", "architecture", "design"],
        custom_fields: {
          certifications_required: ["CCIE", "JNCIE"],
          project_focus: "sdwan_migration",
          budget_allocation: "high"
        }
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    teams = [
      {
        id: `${tenantId}_team_sre`,
        tenantId,
        name: "SRE Team",
        description: "Site Reliability Engineers ensuring streaming platform uptime and performance optimization.",
        created_at: now,
        updated_at: now,
        status: "active",
        priority: "critical",
        category: "engineering",
        subcategory: "reliability",
        health_status: "green",
        team_lead: "Alex Rodriguez",
        team_size: 15,
        shift_coverage: "24x7",
        escalation_level: 1,
        on_call_rotation: true,
        primary_focus: ["reliability", "performance", "automation", "monitoring"],
        expertise_areas: ["kubernetes", "gcp", "terraform", "prometheus"],
        contact_info: {
          email: "sre@av-google.com",
          slack_channel: "#sre-alerts",
          phone: "+1-555-SRE-HELP"
        },
        tags: ["sre", "reliability", "streaming", "automation"],
        custom_fields: {
          sli_targets: {
            uptime: "99.99%",
            latency_p99: "100ms",
            error_rate: "0.01%"
          },
          incident_response_time_minutes: 2
        }
      },
      {
        id: `${tenantId}_team_mediaops`,
        tenantId,
        name: "MediaOps",
        description: "Focuses on transcoding, encoding, and media pipeline health. Specialized in video processing workflows.",
        created_at: now,
        updated_at: now,
        status: "active",
        priority: "high",
        category: "operations",
        subcategory: "media",
        health_status: "green",
        team_lead: "Emma Thompson",
        team_size: 10,
        shift_coverage: "24x7",
        escalation_level: 2,
        on_call_rotation: true,
        primary_focus: ["transcoding", "video_processing", "content_delivery"],
        expertise_areas: ["ffmpeg", "gstreamer", "cdn", "video_codecs"],
        contact_info: {
          email: "mediaops@av-google.com",
          slack_channel: "#media-ops",
          phone: "+1-555-MEDIA-OPS"
        },
        tags: ["mediaops", "transcoding", "video", "streaming"],
        custom_fields: {
          processing_capacity_hours_per_day: 50000,
          supported_formats: ["h264", "h265", "vp9", "av1"],
          quality_metrics_target: "95% successful transcodes"
        }
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    teams = [
      {
        id: `${tenantId}_team_dba`,
        tenantId,
        name: "Database Administrators",
        description: "Responsible for relational database uptime, replication, backups, and performance optimization.",
        created_at: now,
        updated_at: now,
        status: "active",
        priority: "critical",
        category: "administration",
        subcategory: "database",
        health_status: "yellow",
        team_lead: "David Kim",
        team_size: 6,
        shift_coverage: "24x7",
        escalation_level: 1,
        on_call_rotation: true,
        primary_focus: ["database_maintenance", "backup_recovery", "performance_tuning"],
        expertise_areas: ["postgresql", "mysql", "oracle", "mongodb"],
        contact_info: {
          email: "dba@cloud-morningstar.com",
          slack_channel: "#dba-alerts",
          phone: "+1-555-DBA-HELP"
        },
        tags: ["dba", "database", "postgresql", "backup"],
        custom_fields: {
          backup_schedule: "every_4_hours",
          replication_targets: ["dr_site", "analytics_replica"],
          performance_sla: "query_response_sub_100ms"
        }
      },
      {
        id: `${tenantId}_team_dataops`,
        tenantId,
        name: "DataOps Team",
        description: "Maintains ETL pipelines, analytics workloads, and data quality monitoring for financial reporting systems.",
        created_at: now,
        updated_at: now,
        status: "active",
        priority: "high",
        category: "operations",
        subcategory: "data",
        health_status: "orange",
        team_lead: "Lisa Wang",
        team_size: 8,
        shift_coverage: "business_hours_plus",
        escalation_level: 2,
        on_call_rotation: false,
        primary_focus: ["etl_pipelines", "data_quality", "analytics_infrastructure"],
        expertise_areas: ["spark", "airflow", "snowflake", "python"],
        contact_info: {
          email: "dataops@cloud-morningstar.com",
          slack_channel: "#dataops",
          phone: "+1-555-DATA-OPS"
        },
        tags: ["dataops", "etl", "analytics", "spark"],
        custom_fields: {
          pipeline_success_rate_target: "99.5%",
          data_freshness_sla_hours: 4,
          supported_data_sources: 47
        }
      },
    ];
  }

  // Insert teams with proper error handling
  for (const team of teams) {
    try {
      await db.put("teams", team);

      // Create COMPLETE audit log entry matching AuditLogEntry interface
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "team",
        entity_id: team.id,
        action: "create",
        description: `Team created: ${team.name} (${team.category}) with ${team.team_size} members`,
        timestamp: now,
        user_id: "system", // Required field - using system for team creation
        tags: ["seed", "team", "created"],
        hash: await generateHash({
          entity_type: "team",
          entity_id: team.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          name: team.name,
          category: team.category,
          subcategory: team.subcategory,
          status: team.status,
          priority: team.priority,
          team_lead: team.team_lead,
          team_size: team.team_size,
          shift_coverage: team.shift_coverage,
          escalation_level: team.escalation_level,
          on_call_rotation: team.on_call_rotation
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `Team "${team.name}" created with ${team.team_size} members, led by ${team.team_lead}`,
        storeName: "teams", // Required field for dbClient compatibility
        recordId: team.id, // Required field for dbClient compatibility  
        action: "create",
        userId: "system", // System creates teams during seeding
        metadata: {
          team_id: team.id,
          name: team.name,
          category: team.category,
          team_lead: team.team_lead,
          team_size: team.team_size,
          shift_coverage: team.shift_coverage,
          expertise_areas: team.expertise_areas,
          primary_focus: team.primary_focus,
          contact_info: team.contact_info,
          escalation_level: team.escalation_level
        }
      });

      console.log(`✅ Seeded team: ${team.id} - ${team.name}`);
    } catch (error) {
      console.error(`❌ Failed to seed team ${team.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${teams.length} teams for ${tenantId}`);
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