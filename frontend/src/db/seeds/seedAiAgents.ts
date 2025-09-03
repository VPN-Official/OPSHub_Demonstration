import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedAiAgents = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let agents: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    agents = [
      {
        id: `${tenantId}_agent01`,
        tenantId,
        name: "NetOps Copilot",
        description: "AI assistant for Network Operations Center. Suggests RCA, runbooks, and automations for network incidents.",
        scope: ["incidents", "alerts", "knowledge_base", "runbooks"],
        category: "operational_ai",
        subcategory: "network_operations",
        priority: "high",
        severity: "low",
        health_status: "green",
        status: "active",
        version: "2.1.0",
        model_type: "copilot",
        capabilities: ["incident_analysis", "rca_suggestions", "runbook_recommendations", "automation_triggers"],
        linked_team_id: `${tenantId}_team_noc`,
        deployment_environment: "production",
        last_training_date: now,
        created_at: now,
        updated_at: now,
        tags: ["network", "copilot", "ai", "operations", "incident-response"],
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    agents = [
      {
        id: `${tenantId}_agent01`,
        tenantId,
        name: "Streaming SRE Copilot",
        description: "Helps SREs optimize streaming latency and resolve edge node issues.",
        scope: ["metrics", "events", "automation_rules", "knowledge_base"],
        category: "sre_ai",
        subcategory: "streaming",
        priority: "high",
        severity: "medium",
        health_status: "green",
        status: "active",
        version: "3.0.2",
        model_type: "sre_copilot",
        capabilities: ["latency_optimization", "edge_diagnostics", "performance_analysis", "auto_scaling"],
        linked_team_id: `${tenantId}_team_sre`,
        deployment_environment: "production",
        last_training_date: now,
        created_at: now,
        updated_at: now,
        tags: ["sre", "streaming", "ai", "latency", "edge-computing"],
      },
      {
        id: `${tenantId}_agent02`,
        tenantId,
        name: "MediaOps Copilot",
        description: "Specialized in diagnosing GKE transcoding workload issues and memory utilization anomalies.",
        scope: ["incidents", "traces", "knowledge_base", "runbooks"],
        category: "media_ai",
        subcategory: "transcoding",
        priority: "medium",
        severity: "medium",
        health_status: "yellow",
        status: "active",
        version: "1.8.1",
        model_type: "media_copilot",
        capabilities: ["gke_diagnostics", "memory_analysis", "transcoding_optimization", "workload_monitoring"],
        linked_team_id: `${tenantId}_team_mediaops`,
        deployment_environment: "production",
        last_training_date: now,
        created_at: now,
        updated_at: now,
        tags: ["mediaops", "transcoding", "gke", "ai", "memory-optimization"],
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    agents = [
      {
        id: `${tenantId}_agent01`,
        tenantId,
        name: "DB Reliability Copilot",
        description: "Assists DBAs in diagnosing replication lag and performance bottlenecks.",
        scope: ["metrics", "events", "knowledge_base", "automation_rules"],
        category: "database_ai",
        subcategory: "reliability",
        priority: "critical",
        severity: "high",
        health_status: "red",
        status: "active",
        version: "4.1.3",
        model_type: "db_copilot",
        capabilities: ["replication_analysis", "performance_tuning", "bottleneck_detection", "lag_prediction"],
        linked_team_id: `${tenantId}_team_dba`,
        deployment_environment: "production",
        last_training_date: now,
        created_at: now,
        updated_at: now,
        tags: ["database", "replication", "ai", "performance", "reliability"],
      },
      {
        id: `${tenantId}_agent02`,
        tenantId,
        name: "DataOps Copilot",
        description: "Helps DataOps team with ETL failures, Spark optimization, and automation of retries.",
        scope: ["incidents", "traces", "runbooks", "automation_rules"],
        category: "data_ai",
        subcategory: "pipeline_ops",
        priority: "high",
        severity: "medium",
        health_status: "orange",
        status: "active",
        version: "2.5.0",
        model_type: "dataops_copilot",
        capabilities: ["etl_diagnostics", "spark_optimization", "retry_automation", "pipeline_monitoring"],
        linked_team_id: `${tenantId}_team_dataops`,
        deployment_environment: "production",
        last_training_date: now,
        created_at: now,
        updated_at: now,
        tags: ["etl", "spark", "ai", "data-pipeline", "automation"],
      },
    ];
  }

  // Insert AI agents with proper error handling
  for (const agent of agents) {
    try {
      await db.put("ai_agents", agent);

      // Create COMPLETE audit log entry
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "ai_agent",
        entity_id: agent.id,
        action: "create",
        description: `AI Agent deployed: "${agent.name}" (${agent.category}/${agent.subcategory}) - Version ${agent.version} for ${agent.linked_team_id}`,
        timestamp: now,
        user_id: "system",
        tags: ["seed", "ai_agent", "create", agent.category],
        hash: await generateHash({
          entity_type: "ai_agent",
          entity_id: agent.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          category: agent.category,
          subcategory: agent.subcategory,
          priority: agent.priority,
          severity: agent.severity,
          status: agent.status,
          version: agent.version,
          model_type: agent.model_type,
          linked_team_id: agent.linked_team_id,
          deployment_environment: agent.deployment_environment,
          capabilities: agent.capabilities,
          scope: agent.scope,
          health_status: agent.health_status
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `AI Agent "${agent.name}" (${agent.model_type}) deployed and activated for ${agent.linked_team_id}`,
        storeName: "ai_agents",
        recordId: agent.id,
        action: "create",
        userId: "system",
        metadata: {
          agent_id: agent.id,
          category: agent.category,
          subcategory: agent.subcategory,
          model_type: agent.model_type,
          version: agent.version,
          deployment_environment: agent.deployment_environment,
          linked_team_id: agent.linked_team_id,
          ai_capabilities: {
            scope: agent.scope,
            capabilities: agent.capabilities,
            specialization: agent.description
          },
          related_entities: [
            { type: "team", id: agent.linked_team_id }
          ]
        }
      });

      console.log(`✅ Seeded AI agent: ${agent.id} - ${agent.name}`);
    } catch (error) {
      console.error(`❌ Failed to seed AI agent ${agent.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${agents.length} AI agents for ${tenantId}`);
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