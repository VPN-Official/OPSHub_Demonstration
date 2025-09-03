import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedStakeholderComms = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let comms: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    comms = [
      {
        id: `${tenantId}_comm01`,
        tenantId,
        title: "Planned Infrastructure Maintenance Notification",
        subject: "TOR Switch Replacement - Scheduled Maintenance",
        audience: "CIO",
        audience_type: "executive",
        recipient_email: "cio@meta.com",
        sender_name: "Network Operations Team",
        sender_email: "noc@meta.com",
        message: "Planned TOR switch replacement scheduled for next week. No customer impact expected.",
        message_type: "maintenance_notification",
        channel: "email",
        priority: "medium",
        category: "maintenance",
        subcategory: "infrastructure",
        health_status: "green",
        status: "sent",
        urgency: "normal",
        business_impact: "none",
        communication_purpose: "proactive_notification",
        follow_up_required: false,
        escalation_level: 0,
        delivery_confirmation: true,
        read_receipt_requested: false,
        related_incident_id: null,
        related_change_request_id: `${tenantId}_change_tor_replacement`,
        scheduled_maintenance_window: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        estimated_duration: "4 hours",
        created_at: now,
        sent_at: now,
        tags: ["maintenance", "infrastructure", "proactive", "no_impact"],
        custom_fields: {
          maintenance_type: "hardware_replacement",
          affected_systems: ["TOR Switch"],
          backup_procedures: "redundant_switch_available",
          rollback_plan: "revert_to_original_switch"
        }
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    comms = [
      {
        id: `${tenantId}_comm01`,
        tenantId,
        title: "Critical SLA Breach - Immediate Attention Required",
        subject: "EU Streaming Latency SLA Breaches - Action Required",
        audience: "VP MediaOps",
        audience_type: "executive",
        recipient_email: "vp.mediaops@google.com",
        sender_name: "SRE Team",
        sender_email: "sre@google.com",
        message: "Streaming latency SLA at EU edge breached 3 times this week. Root cause under review.",
        message_type: "sla_breach_alert",
        channel: "slack",
        priority: "high",
        category: "performance",
        subcategory: "sla_breach",
        health_status: "red",
        status: "sent",
        urgency: "urgent",
        business_impact: "customer_experience",
        communication_purpose: "escalation",
        follow_up_required: true,
        escalation_level: 2,
        delivery_confirmation: true,
        read_receipt_requested: true,
        related_incident_id: `${tenantId}_incident_latency01`,
        related_change_request_id: null,
        sla_threshold: "250ms",
        current_performance: "285ms avg",
        breach_count: 3,
        created_at: now,
        sent_at: now,
        tags: ["sla_breach", "performance", "urgent", "customer_impact"],
        custom_fields: {
          affected_regions: ["eu-west-1"],
          customer_tier: "premium",
          estimated_affected_users: 15000,
          remediation_eta: "4 hours"
        }
      },
      {
        id: `${tenantId}_comm02`,
        tenantId,
        title: "Feature Rollout Notification - Premium Customers",
        subject: "New Transcoding Presets - Premium Feature Rollout",
        audience: "Customer Success",
        audience_type: "business_unit",
        recipient_email: "customer.success@google.com",
        sender_name: "MediaOps Team",
        sender_email: "mediaops@google.com",
        message: "New transcoding presets rollout planned for premium customers.",
        message_type: "feature_announcement",
        channel: "email",
        priority: "medium",
        category: "product",
        subcategory: "feature_rollout",
        health_status: "green",
        status: "sent",
        urgency: "normal",
        business_impact: "positive",
        communication_purpose: "feature_notification",
        follow_up_required: true,
        escalation_level: 0,
        delivery_confirmation: true,
        read_receipt_requested: false,
        related_incident_id: null,
        related_change_request_id: `${tenantId}_change_transcoding_presets`,
        rollout_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        customer_segment: "premium",
        created_at: now,
        sent_at: now,
        tags: ["feature_rollout", "premium", "transcoding", "positive"],
        custom_fields: {
          feature_name: "Advanced Transcoding Presets",
          target_customers: "premium_tier",
          expected_adoption_rate: "75%",
          support_documentation: "available"
        }
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    comms = [
      {
        id: `${tenantId}_comm01`,
        tenantId,
        title: "Critical Financial Systems Issue - Immediate Action",
        subject: "URGENT: Financial DB Replication Lag - Impact on Reporting",
        audience: "CFO",
        audience_type: "c_level",
        recipient_email: "cfo@morningstar.com",
        sender_name: "Database Administration Team",
        sender_email: "dba@morningstar.com",
        message: "Financial reporting DB replication lag identified. ETA for fix: 2 hours.",
        message_type: "critical_issue_notification",
        channel: "email",
        priority: "critical",
        category: "system_outage",
        subcategory: "database",
        health_status: "red",
        status: "sent",
        urgency: "critical",
        business_impact: "financial_reporting",
        communication_purpose: "critical_incident",
        follow_up_required: true,
        escalation_level: 3,
        delivery_confirmation: true,
        read_receipt_requested: true,
        related_incident_id: `${tenantId}_incident_db_lag01`,
        related_change_request_id: null,
        issue_severity: "critical",
        estimated_resolution: "2 hours",
        business_continuity_impact: "high",
        regulatory_impact: "potential",
        created_at: now,
        sent_at: now,
        tags: ["critical", "database", "financial", "regulatory_risk"],
        custom_fields: {
          affected_systems: ["Financial Reporting DB", "SOX Controls"],
          lag_duration: "42 minutes",
          acceptable_lag: "30 minutes",
          mitigation_steps: "failover_to_backup"
        }
      },
      {
        id: `${tenantId}_comm02`,
        tenantId,
        title: "SOX Compliance Violation - Remediation Required",
        subject: "SOX Non-Compliance Alert - Immediate Remediation Plan",
        audience: "Regulatory Affairs",
        audience_type: "compliance_team",
        recipient_email: "regulatory@morningstar.com",
        sender_name: "Compliance Monitoring System",
        sender_email: "compliance@morningstar.com",
        message: "SOX non-compliance detected in reporting controls. Remediation plan underway.",
        message_type: "compliance_violation",
        channel: "portal",
        priority: "critical",
        category: "compliance",
        subcategory: "sox_violation",
        health_status: "red",
        status: "sent",
        urgency: "urgent",
        business_impact: "regulatory_violation",
        communication_purpose: "compliance_alert",
        follow_up_required: true,
        escalation_level: 2,
        delivery_confirmation: true,
        read_receipt_requested: true,
        related_incident_id: `${tenantId}_incident_sox_violation01`,
        related_change_request_id: `${tenantId}_change_sox_remediation`,
        compliance_framework: "SOX",
        violation_type: "control_deficiency",
        remediation_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_at: now,
        sent_at: now,
        tags: ["sox", "compliance", "violation", "critical"],
        custom_fields: {
          control_id: "ITGC-404.1",
          violation_severity: "material_weakness",
          auditor_notification_required: true,
          remediation_owner: "IT Controls Team"
        }
      },
    ];
  }

  // Insert stakeholder communications with proper error handling
  for (const comm of comms) {
    try {
      await db.put("stakeholder_comms", comm);

      // Create COMPLETE audit log entry
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "stakeholder_comm",
        entity_id: comm.id,
        action: "create",
        description: `Stakeholder communication sent: ${comm.title} to ${comm.audience} via ${comm.channel} (${comm.priority} priority)`,
        timestamp: now,
        user_id: "system", // Required field
        tags: ["seed", "stakeholder_comm", "send", comm.category],
        hash: await generateHash({
          entity_type: "stakeholder_comm",
          entity_id: comm.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          title: comm.title,
          subject: comm.subject,
          audience: comm.audience,
          audience_type: comm.audience_type,
          channel: comm.channel,
          priority: comm.priority,
          category: comm.category,
          message_type: comm.message_type,
          urgency: comm.urgency,
          business_impact: comm.business_impact,
          escalation_level: comm.escalation_level,
          sender_name: comm.sender_name,
          recipient_email: comm.recipient_email,
          follow_up_required: comm.follow_up_required,
          related_incident_id: comm.related_incident_id,
          related_change_request_id: comm.related_change_request_id
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `${comm.priority.toUpperCase()} communication "${comm.title}" sent to ${comm.audience} via ${comm.channel}`,
        storeName: "stakeholder_comms", // Required field for dbClient compatibility
        recordId: comm.id, // Required field for dbClient compatibility
        action: "create",
        userId: "system",
        metadata: {
          communication_id: comm.id,
          title: comm.title,
          audience: comm.audience,
          channel: comm.channel,
          priority: comm.priority,
          urgency: comm.urgency,
          message_type: comm.message_type,
          business_impact: comm.business_impact,
          escalation_level: comm.escalation_level,
          delivery_status: {
            sent_at: comm.sent_at,
            delivery_confirmation: comm.delivery_confirmation,
            read_receipt_requested: comm.read_receipt_requested
          },
          related_entities: [
            { type: "incident", id: comm.related_incident_id },
            { type: "change_request", id: comm.related_change_request_id }
          ].filter(entity => entity.id) // Remove null/undefined entries
        }
      });

      console.log(`✅ Seeded stakeholder communication: ${comm.id} - ${comm.title}`);
    } catch (error) {
      console.error(`❌ Failed to seed stakeholder communication ${comm.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${comms.length} stakeholder communications for ${tenantId}`);
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