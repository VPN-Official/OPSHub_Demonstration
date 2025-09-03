import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedOnCall = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let onCall: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    onCall = [
      { id: `${tenantId}_oncall01`, tenantId, team_id: `${tenantId}_team_noc`, user_id: `${tenantId}_user_noc01`, shift_start: now, shift_end: null },
    ];
  }

  if (tenantId === "tenant_av_google") {
    onCall = [
      { id: `${tenantId}_oncall01`, tenantId, team_id: `${tenantId}_team_sre`, user_id: `${tenantId}_user_devops01`, shift_start: now, shift_end: null },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    onCall = [
      { id: `${tenantId}_oncall01`, tenantId, team_id: `${tenantId}_team_dba`, user_id: `${tenantId}_user_dataeng01`, shift_start: now, shift_end: null },
    ];
  }

  for (const oc of onCall) {
    await db.put("on_call", oc);

    await db.put("audit_logs", {
      id: `${oc.id}_audit01`,
      tenantId,
      entity_type: "on_call",
      entity_id: oc.id,
      action: "create",
      timestamp: now,
      hash: "hash_" + oc.id,
      tags: ["seed"],
    });
  }
};