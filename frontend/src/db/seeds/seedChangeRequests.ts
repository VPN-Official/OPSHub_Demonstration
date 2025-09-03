import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedChangeRequests = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let changes: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    changes = [
      {
        id: `${tenantId}_chg01`,
        tenantId,
        title: "Router firmware upgrade",
        description: "Upgrade core router firmware to optimize CPU usage and address stability issue.",
        type: "standard",
        status: "requested",
        priority: "high",
        created_at: now,
        updated_at: now,
        problem_id: `${tenantId}_prob01`,
        requested_by: `${tenantId}_user_noc01`,
        assigned_team_id: `${tenantId}_team_network`,
        tags: ["router", "firmware"],
      },
      {
        id: `${tenantId}_chg02`,
        tenantId,
        title: "Replace unstable TOR switch",
        description: "Schedule hardware replacement for failing TOR switch identified in problem prob02.",
        type: "emergency",
        status: "approved",
        priority: "critical",
        created_at: now,
        updated_at: now,
        problem_id: `${tenantId}_prob02`,
        requested_by: `${tenantId}_user_monitoring`,
        assigned_team_id: `${tenantId}_team_network`,
        tags: ["switch", "hardware"],
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    changes = [
      {
        id: `${tenantId}_chg01`,
        tenantId,
        title: "Edge VM scaling policy update",
        description: "Adjust auto-scaling thresholds on EU edge VM pool to handle peak loads.",
        type: "normal",
        status: "in_progress",
        priority: "high",
        created_at: now,
        updated_at: now,
        problem_id: `${tenantId}_prob01`,
        requested_by: `${tenantId}_user_alerting`,
        assigned_team_id: `${tenantId}_team_sre`,
        tags: ["scaling", "streaming"],
      },
      {
        id: `${tenantId}_chg02`,
        tenantId,
        title: "GKE pod memory allocation tuning",
        description: "Update resource requests/limits for transcoding pods to prevent OOM kills.",
        type: "standard",
        status: "requested",
        priority: "medium",
        created_at: now,
        updated_at: now,
        problem_id: `${tenantId}_prob02`,
        requested_by: `${tenantId}_user_devops01`,
        assigned_team_id: `${tenantId}_team_mediaops`,
        tags: ["gke", "oom", "tuning"],
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    changes = [
      {
        id: `${tenantId}_chg01`,
        tenantId,
        title: "DB replication tuning",
        description: "Apply configuration changes to reduce lag in reporting DB replication.",
        type: "normal",
        status: "approved",
        priority: "high",
        created_at: now,
        updated_at: now,
        problem_id: `${tenantId}_prob01`,
        requested_by: `${tenantId}_user_monitor01`,
        assigned_team_id: `${tenantId}_team_dba`,
        tags: ["database", "replication"],
      },
      {
        id: `${tenantId}_chg02`,
        tenantId,
        title: "ETL job retry policy",
        description: "Introduce retry & checkpointing to Spark ETL jobs to handle transient failures.",
        type: "standard",
        status: "requested",
        priority: "medium",
        created_at: now,
        updated_at: now,
        problem_id: `${tenantId}_prob02`,
        requested_by: `${tenantId}_user_dataeng01`,
        assigned_team_id: `${tenantId}_team_dataops`,
        tags: ["etl", "spark", "resilience"],
      },
    ];
  }

  for (const chg of changes) {
    await db.put("change_requests", chg);

    // Audit log
    await db.put("audit_logs", {
      id: `${chg.id}_audit01`,
      tenantId,
      entity_type: "change_request",
      entity_id: chg.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + chg.id,
      tags: ["seed"],
    });

    // Activity
    await db.put("activities", {
      id: `${chg.id}_act01`,
      tenantId,
      type: "change_request",
      entity_id: chg.id,
      action: "created",
      description: `Change request "${chg.title}" raised for problem ${chg.problem_id}`,
      timestamp: now,
      related_entity_ids: [{ type: "problem", id: chg.problem_id }],
      tags: ["seed"],
    });
  }
};