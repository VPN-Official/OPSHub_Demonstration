import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedProblems = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let problems: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    problems = [
      {
        id: `${tenantId}_prob01`,
        tenantId,
        title: "High CPU utilization on core router",
        description: "Router CPU spikes observed repeatedly. Linked to incident router01 (threshold breach).",
        status: "open",
        priority: "high",
        created_at: now,
        updated_at: now,
        assigned_team_id: `${tenantId}_team_network`,
        related_incident_ids: [`${tenantId}_inc01`],
        tags: ["router", "performance"],
      },
      {
        id: `${tenantId}_prob02`,
        tenantId,
        title: "Switch instability causing packet loss",
        description: "TOR switch flapping across multiple incidents. RCA pending hardware diagnostics.",
        status: "investigating",
        priority: "medium",
        created_at: now,
        updated_at: now,
        assigned_team_id: `${tenantId}_team_network`,
        related_incident_ids: [`${tenantId}_inc02`],
        tags: ["switch", "packetloss"],
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    problems = [
      {
        id: `${tenantId}_prob01`,
        tenantId,
        title: "EU edge node service degradation",
        description: "Streaming latency issues tied to overloaded EU edge VM. Workaround: reroute traffic.",
        status: "open",
        priority: "high",
        created_at: now,
        updated_at: now,
        assigned_team_id: `${tenantId}_team_sre`,
        related_incident_ids: [`${tenantId}_inc01`],
        tags: ["streaming", "latency", "edge"],
      },
      {
        id: `${tenantId}_prob02`,
        tenantId,
        title: "GKE transcoding workload instability",
        description: "OOM kills repeatedly observed in transcoding pods. Potential memory misconfiguration.",
        status: "in_progress",
        priority: "medium",
        created_at: now,
        updated_at: now,
        assigned_team_id: `${tenantId}_team_mediaops`,
        related_incident_ids: [`${tenantId}_inc02`],
        tags: ["gke", "oom", "transcoding"],
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    problems = [
      {
        id: `${tenantId}_prob01`,
        tenantId,
        title: "Database replication lag recurring",
        description: "Replication lag spikes during reporting hours. Linked to high transaction load.",
        status: "open",
        priority: "high",
        created_at: now,
        updated_at: now,
        assigned_team_id: `${tenantId}_team_dba`,
        related_incident_ids: [`${tenantId}_inc01`],
        tags: ["database", "replication", "lag"],
      },
      {
        id: `${tenantId}_prob02`,
        tenantId,
        title: "ETL job reliability issues",
        description: "Nightly ETL failures linked to unstable Spark cluster. RCA ongoing.",
        status: "investigating",
        priority: "medium",
        created_at: now,
        updated_at: now,
        assigned_team_id: `${tenantId}_team_dataops`,
        related_incident_ids: [`${tenantId}_inc02`],
        tags: ["etl", "pipeline", "spark"],
      },
    ];
  }

  for (const prob of problems) {
    await db.put("problems", prob);

    // Audit log
    await db.put("audit_logs", {
      id: `${prob.id}_audit01`,
      tenantId,
      entity_type: "problem",
      entity_id: prob.id,
      action: "create",
      timestamp: now,
      hash: "hash_" + prob.id,
      tags: ["seed"],
    });

    // Activity
    await db.put("activity_timeline", {
      id: `${prob.id}_act01`,
      tenantId,
      type: "problem",
      entity_id: prob.id,
      action: "created",
      description: `Problem "${prob.title}" created, linked to ${prob.related_incident_ids.length} incident(s)`,
      timestamp: now,
      related_entity_ids: prob.related_incident_ids.map((id: string) => ({
        type: "incident",
        id,
      })),
      tags: ["seed"],
    });
  }
};