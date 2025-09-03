import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedAiAgents = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let agents: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    agents = [
      {
        id: `${tenantId}_agent01`,
        tenantId: tenantId,
        name: "Router Triage Agent",
        type: "incident_triage",
        status: "active",
        model_type: "LLM",
        confidence_threshold: 0.8,
        input_sources: ["metrics", "logs"],
        tags: ["router", "ai"],
        created_at: now,
        updated_at: now,
        health_status: "yellow",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    agents = [
      {
        id: `${tenantId}_agent01`,
        tenantId: tenantId,
        name: "Latency Reduction Agent",
        type: "alert_correlation",
        status: "active",
        model_type: "ML model",
        confidence_threshold: 0.75,
        input_sources: ["metrics", "events"],
        tags: ["latency", "ai"],
        created_at: now,
        updated_at: now,
        health_status: "red",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    agents = [
      {
        id: `${tenantId}_agent01`,
        tenantId: tenantId,
        name: "Service Desk Assistant",
        type: "knowledge_recommendation",
        status: "active",
        model_type: "LLM",
        confidence_threshold: 0.7,
        input_sources: ["knowledge", "incidents"],
        tags: ["servicedesk", "ai"],
        created_at: now,
        updated_at: now,
        health_status: "green",
      },
    ];
  }

  for (const agent of agents) {
    await db.put("ai_agents", agent);

    await db.put("audit_logs", {
      id: `${agent.id}_audit01`,
      tenantId: tenantId,
      entity_type: "ai_agent",
      entity_id: agent.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + agent.id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${agent.id}_act01`,
      tenantId: tenantId,
      type: "ai_agent",
      entity_id: agent.id,
      action: "created",
      description: `AI Agent "${agent.name}" seeded`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};