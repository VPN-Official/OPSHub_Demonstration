import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedActivityTimeline = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date();
  let timeline: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    timeline = [
      {
        id: `${tenantId}_tl01`,
        tenantId,
        entity_id: `${tenantId}_inc01`,
        entries: [
          { timestamp: new Date(now.getTime() - 600000).toISOString(), action: "alert_triggered", detail: "Router CPU alert fired" },
          { timestamp: new Date(now.getTime() - 300000).toISOString(), action: "incident_created", detail: "Incident INC01 logged" },
        ],
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    timeline = [
      {
        id: `${tenantId}_tl01`,
        tenantId,
        entity_id: `${tenantId}_prob01`,
        entries: [
          { timestamp: new Date(now.getTime() - 900000).toISOString(), action: "event_detected", detail: "Streaming Latency Event detected" },
          { timestamp: new Date(now.getTime() - 600000).toISOString(), action: "problem_created", detail: "Problem logged" },
        ],
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    timeline = [
      {
        id: `${tenantId}_tl01`,
        tenantId,
        entity_id: `${tenantId}_chg01`,
        entries: [
          { timestamp: new Date(now.getTime() - 3600000).toISOString(), action: "change_requested", detail: "DB replication tuning change raised" },
          { timestamp: new Date(now.getTime() - 1800000).toISOString(), action: "change_approved", detail: "Approved by DBA lead" },
        ],
      },
    ];
  }

  for (const tl of timeline) {
    await db.put("activity_timeline", tl);

    await db.put("audit_logs", {
      id: `${tl.id}_audit01`,
      tenantId,
      entity_type: "activity_timeline",
      entity_id: tl.id,
      action: "create",
      timestamp: now.toISOString(),
      hash: "hash_" + tl.id,
      tags: ["seed"],
    });
  }
};