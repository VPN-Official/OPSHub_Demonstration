import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedOnCall = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let onCall: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    onCall = [
      {
        id: `${tenantId}_oncall01`,
        tenantId,
        title: "Primary Network Operations Shift",
        description: "Primary on-call rotation for network infrastructure monitoring and incident response",
        team_id: `${tenantId}_team_noc`,
        user_id: `${tenantId}_user_noc01`,
        user_name: "John Network",
        priority: "critical",
        category: "primary",
        subcategory: "operations",
        health_status: "green",
        status: "active",
        shift_type: "primary",
        rotation_type: "weekly",
        shift_start: now,
        shift_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        escalation_level: 1,
        contact_methods: ["phone", "sms", "email", "slack"],
        response_time_sla: 15, // minutes
        backup_user_id: `${tenantId}_user_noc02`,
        backup_user_name: "Sarah Backup",
        notification_preferences: {
          immediate: ["critical", "high"],
          delayed: ["medium"],
          suppressed: ["low"]
        },
        skills_required: ["network_troubleshooting", "incident_response", "escalation_procedures"],
        services_covered: [`${tenantId}_svc_network`, `${tenantId}_svc_infrastructure`],
        created_at: now,
        tags: ["oncall", "network", "operations", "primary"],
        custom_fields: {
          rotation_schedule: "week_1_2023",
          coverage_hours: "24x7",
          handoff_notes: "Router maintenance scheduled for Thursday",
          recent_incidents: 3
        }
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    onCall = [
      {
        id: `${tenantId}_oncall01`,
        tenantId,
        title: "SRE Streaming Platform On-Call",
        description: "Site Reliability Engineering on-call for streaming infrastructure and performance issues",
        team_id: `${tenantId}_team_sre`,
        user_id: `${tenantId}_user_devops01`,
        user_name: "Alex DevOps",
        priority: "high",
        category: "sre",
        subcategory: "streaming",
        health_status: "yellow",
        status: "active",
        shift_type: "primary",
        rotation_type: "daily",
        shift_start: now,
        shift_end: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        escalation_level: 1,
        contact_methods: ["pagerduty", "slack", "phone"],
        response_time_sla: 5, // minutes for streaming issues
        backup_user_id: `${tenantId}_user_sre02`,
        backup_user_name: "Morgan SRE",
        notification_preferences: {
          immediate: ["critical", "high"],
          delayed: [],
          suppressed: ["low"]
        },
        skills_required: ["kubernetes", "gcp", "monitoring", "performance_tuning"],
        services_covered: [`${tenantId}_svc_streaming`, `${tenantId}_svc_transcoding`],
        created_at: now,
        tags: ["oncall", "sre", "streaming", "performance"],
        custom_fields: {
          rotation_schedule: "daily_2023_q4",
          coverage_hours: "business_hours",
          handoff_notes: "Latency issues in EU region need monitoring",
          recent_escalations: 2
        }
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    onCall = [
      {
        id: `${tenantId}_oncall01`,
        tenantId,
        title: "Database Critical Systems On-Call",
        description: "Database administration on-call for critical financial reporting systems and data infrastructure",
        team_id: `${tenantId}_team_dba`,
        user_id: `${tenantId}_user_dataeng01`,
        user_name: "Chris DataEng",
        priority: "critical",
        category: "database",
        subcategory: "financial_systems",
        health_status: "red",
        status: "active",
        shift_type: "primary",
        rotation_type: "weekly",
        shift_start: now,
        shift_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        escalation_level: 1,
        contact_methods: ["phone", "sms", "email", "teams"],
        response_time_sla: 10, // minutes for financial systems
        backup_user_id: `${tenantId}_user_dba02`,
        backup_user_name: "Jamie DBA",
        notification_preferences: {
          immediate: ["critical", "high"],
          delayed: ["medium"],
          suppressed: []
        },
        skills_required: ["postgresql", "replication", "performance_tuning", "disaster_recovery"],
        services_covered: [`${tenantId}_svc_fin_reporting`, `${tenantId}_svc_data_analytics`],
        created_at: now,
        tags: ["oncall", "database", "financial", "critical"],
        custom_fields: {
          rotation_schedule: "week_3_2023",
          coverage_hours: "24x7",
          handoff_notes: "Replication lag issues require immediate attention",
          compliance_requirements: ["SOX", "audit_trail"]
        }
      },
    ];
  }

  // Insert on-call schedules with proper error handling
  for (const oc of onCall) {
    try {
      await db.put("on_call", oc);

      // Create COMPLETE audit log entry
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "on_call",
        entity_id: oc.id,
        action: "create",
        description: `On-call schedule created: ${oc.title} - ${oc.user_name} (${oc.team_id}) with ${oc.response_time_sla}min SLA`,
        timestamp: now,
        user_id: "system", // Required field
        tags: ["seed", "on_call", "create", oc.category],
        hash: await generateHash({
          entity_type: "on_call",
          entity_id: oc.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          title: oc.title,
          team_id: oc.team_id,
          user_id: oc.user_id,
          user_name: oc.user_name,
          priority: oc.priority,
          category: oc.category,
          shift_type: oc.shift_type,
          rotation_type: oc.rotation_type,
          response_time_sla: oc.response_time_sla,
          escalation_level: oc.escalation_level,
          backup_user_id: oc.backup_user_id,
          services_covered: oc.services_covered,
          skills_required: oc.skills_required
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `On-call schedule "${oc.title}" activated for ${oc.user_name} with ${oc.response_time_sla}-minute response SLA`,
        storeName: "on_call", // Required field for dbClient compatibility
        recordId: oc.id, // Required field for dbClient compatibility
        action: "create",
        userId: "system",
        metadata: {
          oncall_id: oc.id,
          title: oc.title,
          user_name: oc.user_name,
          team_id: oc.team_id,
          shift_type: oc.shift_type,
          rotation_type: oc.rotation_type,
          response_time_sla: oc.response_time_sla,
          coverage: {
            start: oc.shift_start,
            end: oc.shift_end,
            services: oc.services_covered
          },
          related_entities: [
            { type: "team", id: oc.team_id },
            { type: "user", id: oc.user_id },
            { type: "backup_user", id: oc.backup_user_id },
            ...(oc.services_covered?.map((serviceId: string) => ({ type: "service", id: serviceId })) || [])
          ].filter(entity => entity.id) // Remove null/undefined entries
        }
      });

      console.log(`✅ Seeded on-call: ${oc.id} - ${oc.title}`);
    } catch (error) {
      console.error(`❌ Failed to seed on-call ${oc.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${onCall.length} on-call schedules for ${tenantId}`);
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