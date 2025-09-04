import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedWorkItems = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let workItems: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    workItems = [
      {
        id: `${tenantId}_workItem01`,
        tenantId: tenantId,
        title: "Network Infrastructure Upgrade Task",
        name: "TOR Switch Replacement Planning",
        description: "Plan and coordinate the replacement of Top-of-Rack switches in the data center to improve network reliability",
        work_item_type: "maintenance",
        status: "in_progress",
        priority: "high",
        category: "infrastructure",
        subcategory: "network_hardware",
        health_status: "green",
        assigned_to: `${tenantId}_user_network01`,
        assigned_team: `${tenantId}_team_noc`,
        reporter: `${tenantId}_user_manager01`,
        estimated_effort_hours: 16,
        actual_effort_hours: 12,
        complexity: "medium",
        business_impact: "medium",
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        start_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        completion_percentage: 75,
        related_incident_id: null,
        related_change_request_id: `${tenantId}_change_tor_replacement`,
        dependencies: [],
        subtasks: [
          "Inventory current switches",
          "Order replacement hardware",
          "Schedule maintenance window",
          "Prepare rollback plan"
        ],
        acceptance_criteria: [
          "Zero packet loss during switchover",
          "All network services remain available",
          "Rollback plan tested and verified"
        ],
        created_at: now,
        updated_at: now,
        tags: ["meta", "network", "infrastructure", "maintenance"],
        custom_fields: {
          vendor: "Cisco",
          model: "Nexus 9300",
          maintenance_window: "weekend",
          impact_assessment: "completed"
        }
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    workItems = [
      {
        id: `${tenantId}_workItem01`,
        tenantId: tenantId,
        title: "Streaming Latency Optimization Project",
        name: "EU Edge Node Performance Tuning",
        description: "Optimize streaming latency performance at European edge nodes to meet SLA requirements and improve customer experience",
        work_item_type: "performance_improvement",
        status: "blocked",
        priority: "critical",
        category: "performance",
        subcategory: "latency_optimization",
        health_status: "red",
        assigned_to: `${tenantId}_user_sre01`,
        assigned_team: `${tenantId}_team_sre`,
        reporter: `${tenantId}_user_vp_mediaops`,
        estimated_effort_hours: 40,
        actual_effort_hours: 28,
        complexity: "high",
        business_impact: "high",
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        start_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        completion_percentage: 60,
        related_incident_id: `${tenantId}_incident_latency01`,
        related_change_request_id: null,
        blocked_reason: "Waiting for infrastructure capacity allocation",
        dependencies: ["CDN capacity increase", "Load balancer configuration"],
        subtasks: [
          "Analyze current latency patterns",
          "Identify bottlenecks in EU regions",
          "Design optimization strategy",
          "Implement caching improvements",
          "Deploy configuration changes"
        ],
        acceptance_criteria: [
          "Latency < 250ms in all EU regions",
          "No degradation in other regions",
          "SLA compliance > 95%"
        ],
        created_at: now,
        updated_at: now,
        tags: ["google", "streaming", "performance", "critical"],
        custom_fields: {
          affected_regions: ["eu-west-1", "eu-central-1"],
          customer_impact: "premium_users",
          sla_target: "250ms",
          current_performance: "285ms"
        }
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    workItems = [
      {
        id: `${tenantId}_workItem01`,
        tenantId: tenantId,
        title: "SOX Compliance Remediation Task",
        name: "Financial Reporting Controls Enhancement",
        description: "Address SOX compliance violations in financial reporting systems and implement enhanced controls to meet regulatory requirements",
        work_item_type: "compliance",
        status: "urgent",
        priority: "critical",
        category: "compliance",
        subcategory: "sox_remediation",
        health_status: "red",
        assigned_to: `${tenantId}_user_compliance01`,
        assigned_team: `${tenantId}_team_compliance`,
        reporter: `${tenantId}_user_cfo`,
        estimated_effort_hours: 80,
        actual_effort_hours: 45,
        complexity: "high",
        business_impact: "critical",
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        completion_percentage: 40,
        related_incident_id: `${tenantId}_incident_sox_violation01`,
        related_change_request_id: `${tenantId}_change_sox_remediation`,
        regulatory_deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        dependencies: ["Database replication fix", "Audit trail implementation"],
        subtasks: [
          "Document current control gaps",
          "Design enhanced control framework",
          "Implement automated controls",
          "Test control effectiveness",
          "Prepare audit documentation"
        ],
        acceptance_criteria: [
          "All SOX controls pass testing",
          "Audit trail completeness verified",
          "External auditor approval obtained"
        ],
        created_at: now,
        updated_at: now,
        tags: ["morningstar", "compliance", "sox", "critical"],
        custom_fields: {
          control_framework: "COSO",
          auditor: "External Financial Auditor",
          penalty_risk: "$500,000",
          remediation_owner: "CFO Office"
        }
      },
    ];
  }

  // Insert work items with proper error handling
  for (const workItem of workItems) {
    try {
      await db.put("work_items", workItem);

      // Create COMPLETE audit log entry
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "work_item",
        entity_id: workItem.id,
        action: "create",
        description: `Work item created: ${workItem.title} (${workItem.priority}) - ${workItem.status} - ${workItem.completion_percentage}% complete`,
        timestamp: now,
        user_id: "system", // Required field
        tags: ["seed", "work_item", "create", workItem.category],
        hash: await generateHash({
          entity_type: "work_item",
          entity_id: workItem.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          title: workItem.title,
          work_item_type: workItem.work_item_type,
          status: workItem.status,
          priority: workItem.priority,
          category: workItem.category,
          assigned_to: workItem.assigned_to,
          assigned_team: workItem.assigned_team,
          reporter: workItem.reporter,
          business_impact: workItem.business_impact,
          complexity: workItem.complexity,
          estimated_effort_hours: workItem.estimated_effort_hours,
          due_date: workItem.due_date,
          completion_percentage: workItem.completion_percentage,
          related_incident_id: workItem.related_incident_id,
          related_change_request_id: workItem.related_change_request_id
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `Work item "${workItem.title}" created with ${workItem.priority} priority and assigned to ${workItem.assigned_team}`,
        storeName: "work_items", // Required field for dbClient compatibility
        recordId: workItem.id, // Required field for dbClient compatibility
        action: "create",
        userId: "system",
        metadata: {
          work_item_id: workItem.id,
          title: workItem.title,
          work_item_type: workItem.work_item_type,
          status: workItem.status,
          priority: workItem.priority,
          category: workItem.category,
          progress: {
            completion_percentage: workItem.completion_percentage,
            estimated_effort_hours: workItem.estimated_effort_hours,
            actual_effort_hours: workItem.actual_effort_hours
          },
          assignment: {
            assigned_to: workItem.assigned_to,
            assigned_team: workItem.assigned_team,
            reporter: workItem.reporter
          },
          timeline: {
            due_date: workItem.due_date,
            start_date: workItem.start_date
          },
          related_entities: [
            { type: "incident", id: workItem.related_incident_id },
            { type: "change_request", id: workItem.related_change_request_id },
            { type: "user", id: workItem.assigned_to },
            { type: "team", id: workItem.assigned_team }
          ].filter(entity => entity.id) // Remove null/undefined entries
        }
      });

      console.log(`✅ Seeded work item: ${workItem.id} - ${workItem.title}`);
    } catch (error) {
      console.error(`❌ Failed to seed work item ${workItem.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${workItems.length} work items for ${tenantId}`);
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
