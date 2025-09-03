import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedCustomers = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let customers: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    customers = [
      {
        id: `${tenantId}_cust01`,
        tenantId,
        name: "Meta Internal IT",
        industry: "Technology",
        region: "North America",
        value_stream_id: `${tenantId}_vs01`,
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    customers = [
      {
        id: `${tenantId}_cust01`,
        tenantId,
        name: "YouTube Events Team",
        industry: "Media",
        region: "Global",
        value_stream_id: `${tenantId}_vs01`,
        created_at: now,
      },
      {
        id: `${tenantId}_cust02`,
        tenantId,
        name: "Enterprise Broadcast Partner",
        industry: "Broadcast",
        region: "APAC",
        value_stream_id: `${tenantId}_vs01`,
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    customers = [
      {
        id: `${tenantId}_cust01`,
        tenantId,
        name: "Morningstar Finance Division",
        industry: "Financial Services",
        region: "US",
        value_stream_id: `${tenantId}_vs01`,
        created_at: now,
      },
      {
        id: `${tenantId}_cust02`,
        tenantId,
        name: "Global Investment Clients",
        industry: "Investment Management",
        region: "Global",
        value_stream_id: `${tenantId}_vs01`,
        created_at: now,
      },
    ];
  }

  for (const cust of customers) {
    await db.put("customers", cust);

    // Audit log
    await db.put("audit_logs", {
      id: `${cust.id}_audit01`,
      tenantId,
      entity_type: "customer",
      entity_id: cust.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + cust.id,
      tags: ["seed"],
    });

    // Activity
    await db.put("activities", {
      id: `${cust.id}_act01`,
      tenantId,
      type: "customer",
      entity_id: cust.id,
      action: "created",
      description: `Customer "${cust.name}" onboarded into value stream ${cust.value_stream_id}`,
      timestamp: now,
      related_entity_ids: [
        { type: "value_stream", id: cust.value_stream_id },
      ],
      tags: ["seed"],
    });
  }
};