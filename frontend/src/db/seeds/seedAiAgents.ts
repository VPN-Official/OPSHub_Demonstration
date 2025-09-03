import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

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
        linked_team_id: `${tenantId}_team_noc`,
        created_at: now,
        tags: ["network", "copilot", "ai"],
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
        linked_team_id: `${tenantId}_team_sre`,
        created_at: now,
        tags: ["sre", "streaming", "ai"],
      },
      {
        id: `${tenantId}_agent02`,
        tenantId,
        name: "MediaOps Copilot",
        description: "Specialized in diagnosing GKE transcoding workload issues and memory utilization anomalies.",
        scope: ["incidents", "traces", "knowledge_base", "runbooks"],
        linked_team_id: `${tenantId}_team_mediaops`,
        created_at: now,
        tags: ["mediaops", "transcoding", "gke", "ai"],
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
        linked_team_id: `${tenantId}_team_dba`,
        created_at: now,
        tags: ["database", "replication", "ai"],
      },
      {
        id: `${tenantId}_agent02`,
        tenantId,
        name: "DataOps Copilot",
        description: "Helps DataOps team with ETL failures, Spark optimization, and automation of retries.",
        scope: ["incidents", "traces", "runbooks", "automation_rules"],
        linked_team_id: `${tenantId}_team_dataops`,
        created_at: now,
        tags: ["etl", "spark", "ai"],
      },
    ];
  }

  for (const agent of agents) {
    await db.put("ai_agents", agent);

    // Audit log
    await db.put("audit_logs", {
      id: `${agent.id}_audit01`,
      tenantId,
      entity_type: "ai_agent",
      entity_id: agent.id,
      action: "create",
      timestamp: now,
      hash: "hash_" + agent.id,
      tags: ["seed"],
    });

    // Activity
    await db.put("activity_timeline", {
      id: `${agent.id}_act01`,
      tenantId,
      type: "ai_agent",
      entity_id: agent.id,
      action: "activated",
      description: `AI Agent "${agent.name}" activated for team ${agent.linked_team_id}`,
      timestamp: now,
      related_entity_ids: [{ type: "team", id: agent.linked_team_id }],
      tags: ["seed"],
    });
  }
};