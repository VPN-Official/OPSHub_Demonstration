import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedEndUsers = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let endUsers: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    endUsers = [
      { id: `${tenantId}_user_enduser01`, tenantId, name: "Alice Johnson", email: "alice@meta.com", role: "contractor", created_at: now },
      { id: `${tenantId}_user_enduser02`, tenantId, name: "Brian Smith", email: "brian@meta.com", role: "developer", created_at: now },
    ];
  }

  if (tenantId === "tenant_av_google") {
    endUsers = [
      { id: `${tenantId}_user_enduser01`, tenantId, name: "Chloe Zhang", email: "chloe@google.com", role: "marketing", created_at: now },
      { id: `${tenantId}_user_enduser02`, tenantId, name: "Daniel Park", email: "daniel@google.com", role: "content_ops", created_at: now },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    endUsers = [
      { id: `${tenantId}_user_enduser01`, tenantId, name: "Emily Davis", email: "emily.davis@morningstar.com", role: "finance_analyst", created_at: now },
      { id: `${tenantId}_user_enduser02`, tenantId, name: "Frank Miller", email: "frank.miller@morningstar.com", role: "data_scientist", created_at: now },
    ];
  }

  for (const user of endUsers) {
    await db.put("end_users", user);

    await db.put("audit_logs", {
      id: `${user.id}_audit01`,
      tenantId,
      entity_type: "end_user",
      entity_id: user.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + user.id,
      tags: ["seed"],
    });
  }
};