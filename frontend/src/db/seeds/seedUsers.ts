import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedUsers = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let users: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    users = [
      {
        id: `${tenantId}_user_monitoring`,
        tenantId,
        name: "Auto-Monitoring Bot",
        email: "monitor@dcnmeta.com",
        role: "system",
        team_id: `${tenantId}_team_noc`,
        created_at: now,
      },
      {
        id: `${tenantId}_user_noc01`,
        tenantId,
        name: "Ravi Kumar",
        email: "ravi.kumar@dcnmeta.com",
        role: "network_engineer",
        team_id: `${tenantId}_team_network`,
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    users = [
      {
        id: `${tenantId}_user_alerting`,
        tenantId,
        name: "Alerting System",
        email: "alerts@googleav.com",
        role: "system",
        team_id: `${tenantId}_team_sre`,
        created_at: now,
      },
      {
        id: `${tenantId}_user_devops01`,
        tenantId,
        name: "Maria Lopez",
        email: "maria.lopez@googleav.com",
        role: "devops_engineer",
        team_id: `${tenantId}_team_mediaops`,
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    users = [
      {
        id: `${tenantId}_user_monitor01`,
        tenantId,
        name: "Infra Monitor",
        email: "monitor@morningstarcloud.com",
        role: "system",
        team_id: `${tenantId}_team_dba`,
        created_at: now,
      },
      {
        id: `${tenantId}_user_dataeng01`,
        tenantId,
        name: "David Chen",
        email: "david.chen@morningstarcloud.com",
        role: "data_engineer",
        team_id: `${tenantId}_team_dataops`,
        created_at: now,
      },
    ];
  }

  for (const user of users) {
    await db.put("users", user);

    await db.put("audit_logs", {
      id: `${user.id}_audit01`,
      tenantId,
      entity_type: "user",
      entity_id: user.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + user.id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${user.id}_act01`,
      tenantId,
      type: "user",
      entity_id: user.id,
      action: "created",
      description: `User ${user.name} created`,
      timestamp: now,
      related_entity_ids: [{ type: "team", id: user.team_id }],
      tags: ["seed"],
    });
  }
};