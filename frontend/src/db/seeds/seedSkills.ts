import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedSkills = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let skills: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    skills = [
      { id: `${tenantId}_skill01`, tenantId, name: "BGP Troubleshooting", team_id: `${tenantId}_team_network`, created_at: now },
      { id: `${tenantId}_skill02`, tenantId, name: "Firewall Config", team_id: `${tenantId}_team_noc`, created_at: now },
    ];
  }

  if (tenantId === "tenant_av_google") {
    skills = [
      { id: `${tenantId}_skill01`, tenantId, name: "Kubernetes Tuning", team_id: `${tenantId}_team_mediaops`, created_at: now },
      { id: `${tenantId}_skill02`, tenantId, name: "CDN Optimization", team_id: `${tenantId}_team_sre`, created_at: now },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    skills = [
      { id: `${tenantId}_skill01`, tenantId, name: "Postgres Replication", team_id: `${tenantId}_team_dba`, created_at: now },
      { id: `${tenantId}_skill02`, tenantId, name: "Spark Optimization", team_id: `${tenantId}_team_dataops`, created_at: now },
    ];
  }

  for (const skill of skills) {
    await db.put("skills", skill);

    await db.put("audit_logs", {
      id: `${skill.id}_audit01`,
      tenantId,
      entity_type: "skill",
      entity_id: skill.id,
      action: "create",
      timestamp: now,
      hash: "hash_" + skill.id,
      tags: ["seed"],
    });
  }
};