import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedWorkNotes = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let notes: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    notes = [
      {
        id: `${tenantId}_wn01`,
        tenantId,
        entity_type: "incident",
        entity_id: `${tenantId}_inc01`,
        author: `${tenantId}_user_noc01`,
        note: "CPU utilization confirmed >90%. Monitoring traffic patterns.",
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    notes = [
      {
        id: `${tenantId}_wn01`,
        tenantId,
        entity_type: "problem",
        entity_id: `${tenantId}_prob01`,
        author: `${tenantId}_user_devops01`,
        note: "Latency spikes observed at EU edge nodes. Rerouting traffic as a workaround.",
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    notes = [
      {
        id: `${tenantId}_wn01`,
        tenantId,
        entity_type: "change_request",
        entity_id: `${tenantId}_chg01`,
        author: `${tenantId}_user_dataeng01`,
        note: "DB config tuning applied in test environment. Awaiting results.",
        created_at: now,
      },
    ];
  }

  for (const wn of notes) {
    await db.put("work_notes", wn);

    await db.put("audit_logs", {
      id: `${wn.id}_audit01`,
      tenantId,
      entity_type: "work_note",
      entity_id: wn.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + wn.id,
      tags: ["seed"],
    });
  }
};