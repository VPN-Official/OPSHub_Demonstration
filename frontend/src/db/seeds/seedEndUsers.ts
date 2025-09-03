import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedEndUsers = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let endUsers: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    endUsers = [
      {
        id: `${tenantId}_user_enduser01`,
        tenantId,
        name: "Alice Johnson",
        email: "alice@meta.com",
        username: "alice.johnson",
        role: "contractor",
        title: "Network Security Contractor",
        department: "IT Operations",
        manager_id: `${tenantId}_user_manager01`,
        priority: "medium",
        category: "external",
        subcategory: "contractor",
        health_status: "green",
        status: "active",
        phone: "+1-555-0101",
        location: "Menlo Park, CA",
        timezone: "America/Los_Angeles",
        start_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        contract_end_date: new Date(Date.now() + 270 * 24 * 60 * 60 * 1000).toISOString(),
        last_login: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        access_level: "standard",
        team_ids: [`${tenantId}_team_noc`],
        skills: ["network_security", "firewall_config", "vpn_setup"],
        certifications: ["CCNA", "Security+"],
        created_at: now,
        tags: ["contractor", "network", "security"],
        custom_fields: {
          contractor_company: "SecureTech Solutions",
          hourly_rate: 85,
          clearance_level: "confidential",
          equipment_assigned: ["laptop001", "badge001"]
        }
      },
      {
        id: `${tenantId}_user_enduser02`,
        tenantId,
        name: "Brian Smith",
        email: "brian@meta.com",
        username: "brian.smith",
        role: "developer",
        title: "Full Stack Developer",
        department: "Engineering",
        manager_id: `${tenantId}_user_manager02`,
        priority: "high",
        category: "employee",
        subcategory: "developer",
        health_status: "green",
        status: "active",
        phone: "+1-555-0102",
        location: "San Francisco, CA",
        timezone: "America/Los_Angeles",
        start_date: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString(),
        contract_end_date: null,
        last_login: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        access_level: "elevated",
        team_ids: [`${tenantId}_team_development`],
        skills: ["javascript", "python", "react", "node.js"],
        certifications: ["AWS Solutions Architect", "Scrum Master"],
        created_at: now,
        tags: ["employee", "developer", "fullstack"],
        custom_fields: {
          employee_id: "EMP-2022-0847",
          performance_rating: "exceeds_expectations",
          salary_band: "L5",
          remote_eligible: true
        }
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    endUsers = [
      {
        id: `${tenantId}_user_enduser01`,
        tenantId,
        name: "Chloe Zhang",
        email: "chloe@google.com",
        username: "chloe.zhang",
        role: "marketing",
        title: "Senior Marketing Manager",
        department: "Marketing",
        manager_id: `${tenantId}_user_manager01`,
        priority: "medium",
        category: "employee",
        subcategory: "marketing",
        health_status: "green",
        status: "active",
        phone: "+1-555-0201",
        location: "Mountain View, CA",
        timezone: "America/Los_Angeles",
        start_date: new Date(Date.now() - 1095 * 24 * 60 * 60 * 1000).toISOString(),
        contract_end_date: null,
        last_login: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        access_level: "standard",
        team_ids: [`${tenantId}_team_marketing`],
        skills: ["digital_marketing", "analytics", "campaign_management"],
        certifications: ["Google Analytics", "Google Ads"],
        created_at: now,
        tags: ["employee", "marketing", "manager"],
        custom_fields: {
          employee_id: "EMP-2021-0523",
          performance_rating: "meets_expectations",
          salary_band: "L4",
          budget_authority: 250000
        }
      },
      {
        id: `${tenantId}_user_enduser02`,
        tenantId,
        name: "Daniel Park",
        email: "daniel@google.com",
        username: "daniel.park",
        role: "content_ops",
        title: "Content Operations Specialist",
        department: "Content Operations",
        manager_id: `${tenantId}_user_manager03`,
        priority: "medium",
        category: "employee",
        subcategory: "operations",
        health_status: "green",
        status: "active",
        phone: "+1-555-0202",
        location: "San Bruno, CA",
        timezone: "America/Los_Angeles",
        start_date: new Date(Date.now() - 540 * 24 * 60 * 60 * 1000).toISOString(),
        contract_end_date: null,
        last_login: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        access_level: "standard",
        team_ids: [`${tenantId}_team_contentops`],
        skills: ["content_moderation", "workflow_optimization", "quality_assurance"],
        certifications: ["YouTube Creator", "Content Safety"],
        created_at: now,
        tags: ["employee", "content", "operations"],
        custom_fields: {
          employee_id: "EMP-2022-1156",
          performance_rating: "exceeds_expectations",
          salary_band: "L3",
          shift_schedule: "morning"
        }
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    endUsers = [
      {
        id: `${tenantId}_user_enduser01`,
        tenantId,
        name: "Emily Davis",
        email: "emily.davis@morningstar.com",
        username: "emily.davis",
        role: "finance_analyst",
        title: "Senior Financial Analyst",
        department: "Finance",
        manager_id: `${tenantId}_user_manager01`,
        priority: "high",
        category: "employee",
        subcategory: "analyst",
        health_status: "green",
        status: "active",
        phone: "+1-555-0301",
        location: "Chicago, IL",
        timezone: "America/Chicago",
        start_date: new Date(Date.now() - 1460 * 24 * 60 * 60 * 1000).toISOString(),
        contract_end_date: null,
        last_login: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        access_level: "elevated",
        team_ids: [`${tenantId}_team_finance`],
        skills: ["financial_modeling", "excel", "sql", "regulatory_reporting"],
        certifications: ["CFA", "FRM"],
        created_at: now,
        tags: ["employee", "finance", "analyst", "senior"],
        custom_fields: {
          employee_id: "EMP-2020-0334",
          performance_rating: "exceeds_expectations",
          salary_band: "L5",
          security_clearance: "confidential"
        }
      },
      {
        id: `${tenantId}_user_enduser02`,
        tenantId,
        name: "Frank Miller",
        email: "frank.miller@morningstar.com",
        username: "frank.miller",
        role: "data_scientist",
        title: "Principal Data Scientist",
        department: "Research & Development",
        manager_id: `${tenantId}_user_manager02`,
        priority: "high",
        category: "employee",
        subcategory: "scientist",
        health_status: "green",
        status: "active",
        phone: "+1-555-0302",
        location: "Chicago, IL",
        timezone: "America/Chicago",
        start_date: new Date(Date.now() - 912 * 24 * 60 * 60 * 1000).toISOString(),
        contract_end_date: null,
        last_login: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        access_level: "elevated",
        team_ids: [`${tenantId}_team_dataops`, `${tenantId}_team_research`],
        skills: ["machine_learning", "python", "r", "spark", "tensorflow"],
        certifications: ["AWS ML Specialty", "Google Cloud ML"],
        created_at: now,
        tags: ["employee", "data_science", "machine_learning", "principal"],
        custom_fields: {
          employee_id: "EMP-2021-0789",
          performance_rating: "outstanding",
          salary_band: "L6",
          phd_field: "statistics"
        }
      },
    ];
  }

  // Insert end users with proper error handling
  for (const user of endUsers) {
    try {
      await db.put("end_users", user);

      // Create COMPLETE audit log entry
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "end_user",
        entity_id: user.id,
        action: "create",
        description: `End user account created: ${user.name} (${user.email}) - ${user.title} in ${user.department}`,
        timestamp: now,
        user_id: "system", // Required field
        tags: ["seed", "end_user", "create", user.category],
        hash: await generateHash({
          entity_type: "end_user",
          entity_id: user.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          name: user.name,
          email: user.email,
          role: user.role,
          title: user.title,
          department: user.department,
          category: user.category,
          status: user.status,
          access_level: user.access_level,
          location: user.location,
          start_date: user.start_date,
          manager_id: user.manager_id,
          team_ids: user.team_ids,
          skills: user.skills,
          certifications: user.certifications
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `End user "${user.name}" (${user.title}) account created with ${user.access_level} access level`,
        storeName: "end_users", // Required field for dbClient compatibility
        recordId: user.id, // Required field for dbClient compatibility
        action: "create",
        userId: "system",
        metadata: {
          user_id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          title: user.title,
          department: user.department,
          access_level: user.access_level,
          location: user.location,
          skills_count: user.skills?.length || 0,
          certifications_count: user.certifications?.length || 0,
          related_entities: [
            { type: "manager", id: user.manager_id },
            ...(user.team_ids?.map((teamId: string) => ({ type: "team", id: teamId })) || [])
          ].filter(entity => entity.id) // Remove null/undefined entries
        }
      });

      console.log(`✅ Seeded end user: ${user.id} - ${user.name}`);
    } catch (error) {
      console.error(`❌ Failed to seed end user ${user.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${endUsers.length} end users for ${tenantId}`);
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