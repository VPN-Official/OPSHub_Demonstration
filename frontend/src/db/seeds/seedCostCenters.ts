import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedCostCenters = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let costCenters: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    costCenters = [
      {
        id: `${tenantId}_cc01`,
        tenantId,
        name: "Network Operations",
        budget: 500000,
        currency: "USD",
        owner_team_id: `${tenantId}_team_noc`,
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    costCenters = [
      {
        id: `${tenantId}_cc01`,
        tenantId,
        name: "MediaOps Budget",
        budget: 2000000,
        currency: "USD",
        owner_team_id: `${tenantId}_team_mediaops`,
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    costCenters = [
      {
        id: `${tenantId}_cc01`,
        tenantId,
        name: "Database & Reporting",
        budget: 1200000,
        currency: "USD",
        owner_team_id: `${tenantId}_team_dba`,
        created_at: now,
      },
      {
        id: `${tenantId}_cc02`,
        tenantId,
        name: "DataOps & Analytics",
        budget: 2500000,
        currency: "USD",
        owner_team_id: `${tenantId}_team_dataops`,
        created_at: now,
      },
    ];
  }

  for (const cc of costCenters) {
    await db.put("cost_centers", cc);

    await db.put("audit_logs", {
      id: `${cc.id}_audit01`,
      tenantId,
      entity_type: "cost_center",
      entity_id: cc.id,
      action: "create",
      timestamp: now,
      hash: "hash_" + cc.id,
      tags: ["seed"],
    });

    await db.put("activity_timeline", {
      id: `${cc.id}_act01`,
      tenantId,
      type: "cost_center",
      entity_id: cc.id,
      action: "created",
      description: `Cost center "${cc.name}" created with budget ${cc.budget} ${cc.currency}`,
      timestamp: now,
      related_entity_ids: [{ type: "team", id: cc.owner_team_id }],
      tags: ["seed"],
    });
  }
};