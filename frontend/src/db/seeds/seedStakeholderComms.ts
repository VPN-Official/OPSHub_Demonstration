import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedStakeholderComms = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let comms: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    comms = [
      {
        id: `${tenantId}_comm01`,
        tenantId,
        audience: "CIO",
        message: "Planned TOR switch replacement scheduled for next week. No customer impact expected.",
        channel: "email",
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    comms = [
      {
        id: `${tenantId}_comm01`,
        tenantId,
        audience: "VP MediaOps",
        message: "Streaming latency SLA at EU edge breached 3 times this week. Root cause under review.",
        channel: "slack",
        created_at: now,
      },
      {
        id: `${tenantId}_comm02`,
        tenantId,
        audience: "Customer Success",
        message: "New transcoding presets rollout planned for premium customers.",
        channel: "email",
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    comms = [
      {
        id: `${tenantId}_comm01`,
        tenantId,
        audience: "CFO",
        message: "Financial reporting DB replication lag identified. ETA for fix: 2 hours.",
        channel: "email",
        created_at: now,
      },
      {
        id: `${tenantId}_comm02`,
        tenantId,
        audience: "Regulatory Affairs",
        message: "SOX non-compliance detected in reporting controls. Remediation plan underway.",
        channel: "portal",
        created_at: now,
      },
    ];
  }

  for (const comm of comms) {
    await db.put("stakeholder_comms", comm);

    await db.put("audit_logs", {
      id: `${comm.id}_audit01`,
      tenantId,
      entity_type: "stakeholder_comm",
      entity_id: comm.id,
      action: "send",
      timestamp: now,
      immutable_hash: "hash_" + comm.id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${comm.id}_act01`,
      tenantId,
      type: "stakeholder_comm",
      entity_id: comm.id,
      action: "sent",
      description: `Communication sent to ${comm.audience}: "${comm.message}"`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};