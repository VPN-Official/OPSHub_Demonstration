import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedCustomers = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let customers: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    customers = [
      {
        id: `${tenantId}_cust01`,
        tenant_id: tenantId,
        name: "Meta Internal Teams",
        tier: "platinum",
        created_at: now,
        updated_at: now,
        business_service_ids: [`${tenantId}_svc_network`],
        tags: ["internal"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    customers = [
      {
        id: `${tenantId}_cust01`,
        tenant_id: tenantId,
        name: "YouTube Users",
        tier: "gold",
        created_at: now,
        updated_at: now,
        business_service_ids: [`${tenantId}_svc_streaming`, `${tenantId}_svc_transcoding`],
        tags: ["enduser"],
        health_status: "red",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    customers = [
      {
        id: `${tenantId}_cust01`,
        tenant_id: tenantId,
        name: "Gates Foundation Staff",
        tier: "gold",
        created_at: now,
        updated_at: now,
        business_service_ids: [`${tenantId}_svc_email`, `${tenantId}_svc_vpn`, `${tenantId}_svc_hr_portal`, `${tenantId}_svc_sharepoint`],
        tags: ["staff"],
        health_status: "yellow",
      },
    ];
  }

  for (const cust of customers) {
    await db.put("customers", cust);

    await db.put("audit_logs", {
      id: `${cust.id}_audit01`,
      tenant_id: tenantId,
      entity_type: "customer",
      entity_id: cust.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + cust.id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${cust.id}_act01`,
      tenant_id: tenantId,
      type: "customer",
      entity_id: cust.id,
      action: "created",
      description: `Customer "${cust.name}" seeded`,
      timestamp: now,
      related_entity_ids: cust.business_service_ids.map((id: string) => ({
        type: "business_service",
        id,
      })),
      tags: ["seed"],
    });
  }
};