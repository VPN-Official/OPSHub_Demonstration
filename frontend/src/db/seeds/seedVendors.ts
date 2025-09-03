import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedVendors = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let vendors: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    vendors = [
      {
        id: `${tenantId}_vendor01`,
        tenantId: tenantId,
        name: "Cisco",
        tier: "strategic",
        created_at: now,
        updated_at: now,
        business_service_ids: [`${tenantId}_svc_network`],
        tags: ["network"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    vendors = [
      {
        id: `${tenantId}_vendor01`,
        tenantId: tenantId,
        name: "GCP",
        tier: "strategic",
        created_at: now,
        updated_at: now,
        business_service_ids: [`${tenantId}_svc_streaming`, `${tenantId}_svc_transcoding`],
        tags: ["cloud"],
        health_status: "red",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    vendors = [
      {
        id: `${tenantId}_vendor01`,
        tenantId: tenantId,
        name: "Microsoft",
        tier: "strategic",
        created_at: now,
        updated_at: now,
        business_service_ids: [`${tenantId}_svc_email`, `${tenantId}_svc_sharepoint`],
        tags: ["microsoft"],
        health_status: "yellow",
      },
    ];
  }

  for (const vendor of vendors) {
    await db.put("vendors", vendor);

    await db.put("audit_logs", {
      id: `${vendor.id}_audit01`,
      tenantId: tenantId,
      entity_type: "vendor",
      entity_id: vendor.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + vendor.id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${vendor.id}_act01`,
      tenantId: tenantId,
      type: "vendor",
      entity_id: vendor.id,
      action: "created",
      description: `Vendor "${vendor.name}" seeded`,
      timestamp: now,
      related_entity_ids: vendor.business_service_ids.map((id: string) => ({
        type: "business_service",
        id,
      })),
      tags: ["seed"],
    });
  }
};