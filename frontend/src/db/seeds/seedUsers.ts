// src/db/seeds/seedUsers.ts - FULLY CORRECTED
import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedUsers = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let users: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    users = [
      {
        id: `${tenantId}_user_monitoring`,
        tenantId,
        name: "Auto-Monitoring Bot",
        email: "monitor@dcnmeta.com",
        role: "system",
        status: "active", // Added status
        priority: "high", // Added priority
        category: "automation", // Added category
        subcategory: "monitoring", // Added subcategory
        health_status: "green", // Added health status
        team_id: `${tenantId}_team_noc`,
        created_at: now,
        updated_at: now,
        last_login: now,
        account_type: "service", // Added account type
        permissions: ["read", "monitor", "alert"], // Added permissions
        timezone: "UTC", // Added timezone
        notification_preferences: {
          email: true,
          slack: true,
          sms: false
        },
        security_clearance: "standard", // Added security clearance
        on_call_eligible: false, // Added on-call eligibility
        expertise_areas: ["monitoring", "alerting", "automation"],
        contact_info: {
          phone: null,
          slack_handle: "@monitoring-bot",
          alternate_email: null
        },
        tags: ["system", "monitoring", "automation", "bot"],
        custom_fields: {
          bot_version: "2.1.0",
          monitoring_scope: "network_infrastructure",
          alert_frequency: "real_time"
        }
      },
      {
        id: `${tenantId}_user_noc01`,
        tenantId,
        name: "Ravi Kumar",
        email: "ravi.kumar@dcnmeta.com",
        role: "network_engineer",
        status: "active",
        priority: "high",
        category: "engineering",
        subcategory: "network",
        health_status: "green",
        team_id: `${tenantId}_team_network`,
        created_at: now,
        updated_at: now,
        last_login: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        account_type: "employee",
        permissions: ["read", "write", "configure", "troubleshoot"],
        timezone: "Asia/Kolkata",
        notification_preferences: {
          email: true,
          slack: true,
          sms: true
        },
        security_clearance: "elevated",
        on_call_eligible: true,
        expertise_areas: ["cisco", "juniper", "routing", "switching"],
        contact_info: {
          phone: "+91-9876543210",
          slack_handle: "@ravi.kumar",
          alternate_email: "ravi.personal@gmail.com"
        },
        tags: ["engineer", "network", "cisco", "on-call"],
        custom_fields: {
          employee_id: "DCN-001",
          certifications: ["CCIE", "JNCIE-ENT"],
          years_experience: 8,
          current_project: "sdwan_migration"
        }
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    users = [
      {
        id: `${tenantId}_user_alerting`,
        tenantId,
        name: "Alerting System",
        email: "alerts@googleav.com",
        role: "system",
        status: "active",
        priority: "critical",
        category: "automation",
        subcategory: "alerting",
        health_status: "green",
        team_id: `${tenantId}_team_sre`,
        created_at: now,
        updated_at: now,
        last_login: now,
        account_type: "service",
        permissions: ["read", "monitor", "alert", "escalate"],
        timezone: "UTC",
        notification_preferences: {
          email: true,
          slack: true,
          sms: true
        },
        security_clearance: "standard",
        on_call_eligible: false,
        expertise_areas: ["alerting", "monitoring", "escalation"],
        contact_info: {
          phone: null,
          slack_handle: "@alert-system",
          alternate_email: null
        },
        tags: ["system", "alerting", "sre", "automation"],
        custom_fields: {
          alert_channels: ["slack", "pagerduty", "email"],
          escalation_timeout_minutes: 15,
          supported_metrics: 500
        }
      },
      {
        id: `${tenantId}_user_devops01`,
        tenantId,
        name: "Maria Lopez",
        email: "maria.lopez@googleav.com",
        role: "devops_engineer",
        status: "active",
        priority: "high",
        category: "engineering",
        subcategory: "devops",
        health_status: "green",
        team_id: `${tenantId}_team_mediaops`,
        created_at: now,
        updated_at: now,
        last_login: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
        account_type: "employee",
        permissions: ["read", "write", "deploy", "configure"],
        timezone: "America/Los_Angeles",
        notification_preferences: {
          email: true,
          slack: true,
          sms: false
        },
        security_clearance: "elevated",
        on_call_eligible: true,
        expertise_areas: ["kubernetes", "terraform", "gcp", "media_processing"],
        contact_info: {
          phone: "+1-555-MARIA-01",
          slack_handle: "@maria.lopez",
          alternate_email: "maria.personal@gmail.com"
        },
        tags: ["engineer", "devops", "kubernetes", "media"],
        custom_fields: {
          employee_id: "AV-005",
          certifications: ["CKA", "GCP-ACE", "Terraform-Associate"],
          specialization: "media_pipeline_automation",
          current_sprint: "transcoding_optimization"
        }
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    users = [
      {
        id: `${tenantId}_user_monitor01`,
        tenantId,
        name: "Infra Monitor",
        email: "monitor@morningstarcloud.com",
        role: "system",
        status: "active",
        priority: "high",
        category: "automation",
        subcategory: "infrastructure",
        health_status: "yellow",
        team_id: `${tenantId}_team_dba`,
        created_at: now,
        updated_at: now,
        last_login: now,
        account_type: "service",
        permissions: ["read", "monitor", "backup", "alert"],
        timezone: "UTC",
        notification_preferences: {
          email: true,
          slack: true,
          sms: false
        },
        security_clearance: "standard",
        on_call_eligible: false,
        expertise_areas: ["database_monitoring", "backup_verification", "performance_tracking"],
        contact_info: {
          phone: null,
          slack_handle: "@infra-monitor",
          alternate_email: null
        },
        tags: ["system", "monitoring", "database", "backup"],
        custom_fields: {
          monitoring_frequency: "every_5_minutes",
          backup_verification: "automated",
          performance_baseline_days: 90
        }
      },
      {
        id: `${tenantId}_user_dataeng01`,
        tenantId,
        name: "David Chen",
        email: "david.chen@morningstarcloud.com",
        role: "data_engineer",
        status: "active",
        priority: "high",
        category: "engineering",
        subcategory: "data",
        health_status: "orange",
        team_id: `${tenantId}_team_dataops`,
        created_at: now,
        updated_at: now,
        last_login: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
        account_type: "employee",
        permissions: ["read", "write", "etl_manage", "pipeline_config"],
        timezone: "America/New_York",
        notification_preferences: {
          email: true,
          slack: true,
          sms: true
        },
        security_clearance: "elevated",
        on_call_eligible: true,
        expertise_areas: ["spark", "airflow", "python", "sql"],
        contact_info: {
          phone: "+1-555-DAVID-02",
          slack_handle: "@david.chen",
          alternate_email: "dchen.personal@outlook.com"
        },
        tags: ["engineer", "data", "etl", "spark"],
        custom_fields: {
          employee_id: "MS-042",
          certifications: ["AWS-Data-Analytics", "Databricks-Associate"],
          current_focus: "pipeline_reliability_improvement",
          pipeline_ownership_count: 15
        }
      },
    ];
  }

  // Insert users with proper error handling
  for (const user of users) {
    try {
      await db.put("users", user);

      // Create COMPLETE audit log entry matching AuditLogEntry interface
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "user",
        entity_id: user.id,
        action: "create",
        description: `User created: ${user.name} (${user.role}) assigned to ${user.team_id}`,
        timestamp: now,
        user_id: "system", // Required field - using system for user creation
        tags: ["seed", "user", "created"],
        hash: await generateHash({
          entity_type: "user",
          entity_id: user.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          name: user.name,
          email: user.email,
          role: user.role,
          category: user.category,
          subcategory: user.subcategory,
          status: user.status,
          priority: user.priority,
          team_id: user.team_id,
          account_type: user.account_type,
          security_clearance: user.security_clearance,
          on_call_eligible: user.on_call_eligible
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `User "${user.name}" (${user.role}) created and assigned to team ${user.team_id}`,
        storeName: "users", // Required field for dbClient compatibility
        recordId: user.id, // Required field for dbClient compatibility  
        action: "create",
        userId: "system", // System creates users during seeding
        metadata: {
          user_id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          category: user.category,
          account_type: user.account_type,
          team_assignment: {
            team_id: user.team_id,
            assignment_date: now
          },
          permissions: user.permissions,
          security_clearance: user.security_clearance,
          expertise_areas: user.expertise_areas,
          contact_info: user.contact_info,
          on_call_eligible: user.on_call_eligible
        }
      });

      console.log(`✅ Seeded user: ${user.id} - ${user.name} (${user.role})`);
    } catch (error) {
      console.error(`❌ Failed to seed user ${user.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${users.length} users for ${tenantId}`);
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