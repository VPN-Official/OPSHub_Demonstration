import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedTeams = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let teams: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    teams = [
      {
        id: `${tenantId}_team_noc`,
        tenantId,
        name: "Network Operations Center",
        description: "24x7 monitoring and troubleshooting of DCN infra.",
        created_at: now,
      },
      {
        id: `${tenantId}_team_network`,
        tenantId,
        name: "Network Engineering",
        description: "Handles deep troubleshooting and configuration changes.",
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    teams = [
      {
        id: `${tenantId}_team_sre`,
        tenantId,
        name: "SRE Team",
        description: "Site Reliability Engineers ensuring streaming uptime.",
        created_at: now,
      },
      {
        id: `${tenantId}_team_mediaops`,
        tenantId,
        name: "MediaOps",
        description: "Focuses on transcoding, encoding, and media pipeline health.",
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    teams = [
      {
        id: `${tenantId}_team_dba`,
        tenantId,
        name: "Database Administrators",
        description: "Responsible for relational DB uptime, replication, and backups.",
        created_at: now,
      },
      {
        id: `${tenantId}_team_dataops`,
        tenantId,
        name: "DataOps Team",
        description: "Maintains ETL pipelines and analytics workloads.",
        created_at: now,
      },
    ];
  }

  for (const team of teams) {
    await db.put("teams", team);

    await db.put("audit_logs", {
      id: `${team.id}_audit01`,
      tenantId,
      entity_type: "team",
      entity_id: team.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + team.id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${team.id}_act01`,
      tenantId,
      type: "team",
      entity_id: team.id,
      action: "created",
      description: `Team ${team.name} created`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};