import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedRunbooks = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let runbooks: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    runbooks = [
      {
        id: `${tenantId}_rb01`,
        tenantId,
        title: "Router Firmware Upgrade Procedure",
        description: "Comprehensive procedure for upgrading router firmware with minimal downtime",
        steps: [
          "Backup current configuration.",
          "Apply firmware package.",
          "Reload device and validate routing tables.",
        ],
        category: "infrastructure",
        subcategory: "network",
        priority: "high",
        severity: "medium",
        health_status: "green",
        status: "published",
        version: "1.0",
        author: "Network Operations Team",
        related_change_id: `${tenantId}_chg01`,
        created_at: now,
        updated_at: now,
        tags: ["router", "firmware", "runbook", "network", "infrastructure"],
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    runbooks = [
      {
        id: `${tenantId}_rb01`,
        tenantId,
        title: "Scaling Edge Node Pool",
        description: "Automated scaling procedures for edge computing infrastructure to handle traffic spikes",
        steps: [
          "Update autoscaler config.",
          "Validate latency improvements.",
          "Confirm rollback policy is active.",
        ],
        category: "cloud",
        subcategory: "scaling",
        priority: "high",
        severity: "low",
        health_status: "green",
        status: "published",
        version: "2.1",
        author: "Cloud Infrastructure Team",
        related_change_id: `${tenantId}_chg01`,
        created_at: now,
        updated_at: now,
        tags: ["scaling", "edge", "gce", "cloud", "automation"],
      },
      {
        id: `${tenantId}_rb02`,
        tenantId,
        title: "Update GKE Pod Memory Limits",
        description: "Standard procedure for adjusting memory limits in GKE deployments to prevent OOM kills",
        steps: [
          "Modify deployment resource specs.",
          "Roll out new configuration.",
          "Monitor for OOM kill reduction.",
        ],
        category: "kubernetes",
        subcategory: "resources",
        priority: "medium",
        severity: "medium",
        health_status: "yellow",
        status: "published",
        version: "1.5",
        author: "Kubernetes Team",
        related_change_id: `${tenantId}_chg02`,
        created_at: now,
        updated_at: now,
        tags: ["gke", "memory", "runbook", "kubernetes", "resources"],
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    runbooks = [
      {
        id: `${tenantId}_rb01`,
        tenantId,
        title: "Replication Tuning Procedure",
        description: "Database replication optimization to reduce lag and improve data consistency",
        steps: [
          "Enable parallel replication.",
          "Adjust replica I/O thread pool size.",
          "Validate replication lag reduction.",
        ],
        category: "database",
        subcategory: "replication",
        priority: "critical",
        severity: "high",
        health_status: "red",
        status: "published",
        version: "3.2",
        author: "Database Administration Team",
        related_change_id: `${tenantId}_chg01`,
        created_at: now,
        updated_at: now,
        tags: ["database", "replication", "runbook", "performance", "optimization"],
      },
      {
        id: `${tenantId}_rb02`,
        tenantId,
        title: "ETL Retry Policy Implementation",
        description: "Comprehensive retry mechanism for ETL jobs to improve data pipeline reliability",
        steps: [
          "Enable checkpointing in Spark job config.",
          "Set retry attempts = 3.",
          "Validate job completion rates.",
        ],
        category: "data",
        subcategory: "etl",
        priority: "high",
        severity: "medium",
        health_status: "yellow",
        status: "published",
        version: "2.0",
        author: "Data Engineering Team",
        related_change_id: `${tenantId}_chg02`,
        created_at: now,
        updated_at: now,
        tags: ["etl", "spark", "runbook", "data-pipeline", "reliability"],
      },
    ];
  }

  // Insert runbooks with proper error handling
  for (const runbook of runbooks) {
    try {
      await db.put("runbooks", runbook);

      // Create COMPLETE audit log entry
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "runbook",
        entity_id: runbook.id,
        action: "create",
        description: `Runbook published: "${runbook.title}" (${runbook.category}/${runbook.subcategory}) - Version ${runbook.version}`,
        timestamp: now,
        user_id: "system",
        tags: ["seed", "runbook", "create", runbook.category],
        hash: await generateHash({
          entity_type: "runbook",
          entity_id: runbook.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          category: runbook.category,
          subcategory: runbook.subcategory,
          priority: runbook.priority,
          severity: runbook.severity,
          status: runbook.status,
          version: runbook.version,
          author: runbook.author,
          related_change_id: runbook.related_change_id,
          step_count: runbook.steps.length,
          health_status: runbook.health_status
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `Runbook "${runbook.title}" published by ${runbook.author} (Version ${runbook.version})`,
        storeName: "runbooks",
        recordId: runbook.id,
        action: "create",
        userId: "system",
        metadata: {
          runbook_id: runbook.id,
          category: runbook.category,
          subcategory: runbook.subcategory,
          priority: runbook.priority,
          version: runbook.version,
          author: runbook.author,
          step_count: runbook.steps.length,
          related_entities: [
            { type: "change_request", id: runbook.related_change_id }
          ]
        }
      });

      console.log(`✅ Seeded runbook: ${runbook.id} - ${runbook.title}`);
    } catch (error) {
      console.error(`❌ Failed to seed runbook ${runbook.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${runbooks.length} runbooks for ${tenantId}`);
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