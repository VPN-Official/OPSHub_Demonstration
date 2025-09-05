import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedCostCenters = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let costCenters: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    costCenters = [
      {
        id: `${tenantId}_cc01`,
        tenantId,
        name: "Network Operations",
        description: "Budget allocation for network infrastructure operations, maintenance, and support services",
        budget: 500000,
        spent: 285000,
        remaining: 215000,
        currency: "USD",
        fiscal_year: "2024",
        category: "operations",
        subcategory: "infrastructure",
        priority: "critical",
        severity: "high",
        health_status: "green",
        status: "active",
        budget_type: "operational",
        approval_level: "director",
        utilization_rate: 57.0,
        owner_team_id: `${tenantId}_team_noc`,
        approver: "Network Director",
        budget_period: "annual",
        variance_threshold: 10.0,
        created_at: now,
        updated_at: now,
        tags: ["network", "operations", "infrastructure", "operational", "critical"],
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    costCenters = [
      {
        id: `${tenantId}_cc01`,
        tenantId,
        name: "MediaOps Budget",
        description: "Budget for media operations including streaming infrastructure, transcoding, and content delivery",
        budget: 2000000,
        spent: 1450000,
        remaining: 550000,
        currency: "USD",
        fiscal_year: "2024",
        category: "media_operations",
        subcategory: "content_delivery",
        priority: "high",
        severity: "medium",
        health_status: "yellow",
        status: "active",
        budget_type: "project",
        approval_level: "vp",
        utilization_rate: 72.5,
        owner_team_id: `${tenantId}_team_mediaops`,
        approver: "VP of Engineering",
        budget_period: "annual",
        variance_threshold: 15.0,
        created_at: now,
        updated_at: now,
        tags: ["media", "operations", "streaming", "transcoding", "project"],
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    costCenters = [
      {
        id: `${tenantId}_cc01`,
        tenantId,
        name: "Database & Reporting",
        description: "Budget for database infrastructure, reporting systems, and data compliance initiatives",
        budget: 1200000,
        spent: 980000,
        remaining: 220000,
        currency: "USD",
        fiscal_year: "2024",
        category: "data_management",
        subcategory: "database_operations",
        priority: "critical",
        severity: "critical",
        health_status: "red",
        status: "active",
        budget_type: "operational",
        approval_level: "cto",
        utilization_rate: 81.7,
        owner_team_id: `${tenantId}_team_dba`,
        approver: "Chief Technology Officer",
        budget_period: "annual",
        variance_threshold: 5.0,
        created_at: now,
        updated_at: now,
        tags: ["database", "reporting", "compliance", "operational", "critical"],
      },
      {
        id: `${tenantId}_cc02`,
        tenantId,
        name: "DataOps & Analytics",
        description: "Budget for data operations, ETL infrastructure, analytics platforms, and machine learning initiatives",
        budget: 2500000,
        spent: 1875000,
        remaining: 625000,
        currency: "USD",
        fiscal_year: "2024",
        category: "data_analytics",
        subcategory: "data_pipeline",
        priority: "high",
        severity: "high",
        health_status: "orange",
        status: "active",
        budget_type: "strategic",
        approval_level: "cto",
        utilization_rate: 75.0,
        owner_team_id: `${tenantId}_team_dataops`,
        approver: "Chief Technology Officer",
        budget_period: "annual",
        variance_threshold: 12.0,
        created_at: now,
        updated_at: now,
        tags: ["dataops", "analytics", "etl", "ml", "strategic"],
      },
    ];
  }

  // Insert cost centers with proper error handling
  for (const costCenter of costCenters) {
    try {
      await db.put("cost_centers", costCenter);

      // Create COMPLETE audit log entry
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "cost_center",
        entity_id: costCenter.id,
        action: "create",
        description: `Cost center established: "${costCenter.name}" (${costCenter.category}/${costCenter.subcategory}) - Budget: ${costCenter.currency} ${costCenter.budget.toLocaleString()}, Utilization: ${costCenter.utilization_rate}%`,
        timestamp: now,
        user_id: "system",
        tags: ["seed", "cost_center", "create", costCenter.category, costCenter.budget_type],
        hash: await generateHash({
          entity_type: "cost_center",
          entity_id: costCenter.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          category: costCenter.category,
          subcategory: costCenter.subcategory,
          priority: costCenter.priority,
          severity: costCenter.severity,
          status: costCenter.status,
          budget_type: costCenter.budget_type,
          budget: costCenter.budget,
          spent: costCenter.spent,
          remaining: costCenter.remaining,
          currency: costCenter.currency,
          utilization_rate: costCenter.utilization_rate,
          owner_team_id: costCenter.owner_team_id,
          approver: costCenter.approver,
          approval_level: costCenter.approval_level,
          health_status: costCenter.health_status,
          fiscal_year: costCenter.fiscal_year,
          variance_threshold: costCenter.variance_threshold
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `Cost center "${costCenter.name}" established - ${costCenter.currency} ${costCenter.budget.toLocaleString()} budget, ${costCenter.utilization_rate}% utilized`,
        storeName: "cost_centers",
        recordId: costCenter.id,
        action: "create",
        userId: "system",
        metadata: {
          cost_center_id: costCenter.id,
          category: costCenter.category,
          subcategory: costCenter.subcategory,
          budget_type: costCenter.budget_type,
          budget: costCenter.budget,
          currency: costCenter.currency,
          owner_team_id: costCenter.owner_team_id,
          budget_details: {
            total_budget: costCenter.budget,
            amount_spent: costCenter.spent,
            remaining_budget: costCenter.remaining,
            utilization_rate: costCenter.utilization_rate,
            fiscal_year: costCenter.fiscal_year,
            approval_level: costCenter.approval_level,
            approver: costCenter.approver,
            variance_threshold: costCenter.variance_threshold
          },
          related_entities: [
            { type: "team", id: costCenter.owner_team_id }
          ]
        }
      });

      console.log(`✅ Seeded cost center: ${costCenter.id} - ${costCenter.name}`);
    } catch (error) {
      console.error(`❌ Failed to seed cost center ${costCenter.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${costCenters.length} cost centers for ${tenantId}`);
};

// Helper function to generate audit hash
async function generateHash(data: any): Promise<string> {
  try {
    const { generateImmutableHash } = await import("../../utils/auditUtils");
    return await generateImmutableHash(data);
  } catch {
    // Fallback for seeding if utils not available
    return `seed_hash_${data.entity_id}_${Date.now()}`;
  }
}