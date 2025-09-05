import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedWorkNotes = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let notes: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    notes = [
      {
        id: `${tenantId}_wn01`,
        tenantId,
        title: "Incident Investigation Update",
        entity_type: "incident",
        entity_id: `${tenantId}_inc01`,
        parent_entity_title: "Router CPU utilization exceeded 90%",
        author: `${tenantId}_user_noc01`,
        author_name: "John Network",
        author_role: "NOC Engineer",
        note: "CPU utilization confirmed >90%. Monitoring traffic patterns.",
        note_type: "investigation",
        priority: "high",
        category: "technical_analysis",
        subcategory: "performance_investigation",
        health_status: "yellow",
        visibility: "internal",
        work_type: "troubleshooting",
        status: "active",
        urgency: "medium",
        time_spent_minutes: 15,
        next_action: "Continue monitoring and prepare mitigation plan",
        escalation_required: false,
        customer_facing: false,
        contains_sensitive_data: false,
        tags: ["cpu", "performance", "monitoring", "investigation"],
        created_at: now,
        last_updated: now,
        custom_fields: {
          current_cpu_utilization: "92%",
          threshold: "90%",
          monitoring_duration: "5 minutes",
          affected_services: ["network_routing"]
        }
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    notes = [
      {
        id: `${tenantId}_wn01`,
        tenantId,
        title: "Problem Analysis - Latency Spikes",
        entity_type: "problem",
        entity_id: `${tenantId}_prob01`,
        parent_entity_title: "Streaming Latency Performance Issues",
        author: `${tenantId}_user_devops01`,
        author_name: "Alex DevOps",
        author_role: "SRE Engineer",
        note: "Latency spikes observed at EU edge nodes. Rerouting traffic as a workaround.",
        note_type: "workaround",
        priority: "critical",
        category: "problem_resolution",
        subcategory: "traffic_management",
        health_status: "orange",
        visibility: "team",
        work_type: "mitigation",
        status: "implemented",
        urgency: "high",
        time_spent_minutes: 30,
        next_action: "Monitor rerouting effectiveness and plan permanent fix",
        escalation_required: true,
        customer_facing: true,
        contains_sensitive_data: false,
        workaround_effectiveness: "moderate",
        permanent_fix_required: true,
        tags: ["latency", "eu_region", "workaround", "traffic_routing"],
        created_at: now,
        last_updated: now,
        custom_fields: {
          affected_regions: ["eu-west-1", "eu-central-1"],
          traffic_reroute_percentage: "40%",
          latency_improvement: "15ms",
          customer_impact_reduced: true
        }
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    notes = [
      {
        id: `${tenantId}_wn01`,
        tenantId,
        title: "Change Implementation Progress",
        entity_type: "change_request",
        entity_id: `${tenantId}_chg01`,
        parent_entity_title: "Database Configuration Optimization",
        author: `${tenantId}_user_dataeng01`,
        author_name: "Chris DataEng",
        author_role: "Database Engineer",
        note: "DB config tuning applied in test environment. Awaiting results.",
        note_type: "progress_update",
        priority: "high",
        category: "implementation",
        subcategory: "testing",
        health_status: "green",
        visibility: "team",
        work_type: "configuration",
        status: "testing",
        urgency: "medium",
        time_spent_minutes: 45,
        next_action: "Analyze test results and prepare for production deployment",
        escalation_required: false,
        customer_facing: false,
        contains_sensitive_data: false,
        testing_phase: "integration",
        approval_required: true,
        rollback_plan_ready: true,
        tags: ["database", "configuration", "testing", "performance"],
        created_at: now,
        last_updated: now,
        custom_fields: {
          test_environment: "staging",
          config_parameters_changed: 5,
          expected_performance_improvement: "20%",
          test_duration_planned: "24 hours"
        }
      },
    ];
  }

  // Insert work notes with proper error handling
  for (const workNote of notes) {
    try {
      await db.put("work_notes", workNote);

      // Create COMPLETE audit log entry
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "work_note",
        entity_id: workNote.id,
        action: "create",
        description: `Work note added: ${workNote.title} by ${workNote.author_name} (${workNote.note_type}) for ${workNote.entity_type}`,
        timestamp: now,
        user_id: "system", // Required field
        tags: ["seed", "work_note", "create", workNote.category],
        hash: await generateHash({
          entity_type: "work_note",
          entity_id: workNote.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          title: workNote.title,
          note_type: workNote.note_type,
          entity_type: workNote.entity_type,
          entity_id: workNote.entity_id,
          parent_entity_title: workNote.parent_entity_title,
          author: workNote.author,
          author_name: workNote.author_name,
          author_role: workNote.author_role,
          priority: workNote.priority,
          category: workNote.category,
          work_type: workNote.work_type,
          status: workNote.status,
          urgency: workNote.urgency,
          time_spent_minutes: workNote.time_spent_minutes,
          visibility: workNote.visibility,
          customer_facing: workNote.customer_facing,
          escalation_required: workNote.escalation_required
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `Work note "${workNote.title}" added by ${workNote.author_name} for ${workNote.entity_type} (${workNote.note_type})`,
        storeName: "work_notes", // Required field for dbClient compatibility
        recordId: workNote.id, // Required field for dbClient compatibility
        action: "create",
        userId: "system",
        metadata: {
          work_note_id: workNote.id,
          title: workNote.title,
          note_type: workNote.note_type,
          entity_type: workNote.entity_type,
          entity_id: workNote.entity_id,
          author_name: workNote.author_name,
          work_type: workNote.work_type,
          priority: workNote.priority,
          time_spent_minutes: workNote.time_spent_minutes,
          progress_info: {
            status: workNote.status,
            next_action: workNote.next_action,
            escalation_required: workNote.escalation_required
          },
          related_entities: [
            { type: workNote.entity_type, id: workNote.entity_id },
            { type: "user", id: workNote.author }
          ].filter(entity => entity.id) // Remove null/undefined entries
        }
      });

      console.log(`✅ Seeded work note: ${workNote.id} - ${workNote.title}`);
    } catch (error) {
      console.error(`❌ Failed to seed work note ${workNote.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${notes.length} work notes for ${tenantId}`);
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