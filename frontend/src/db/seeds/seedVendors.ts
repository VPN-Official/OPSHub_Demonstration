import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedVendors = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let vendors: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    vendors = [
      {
        id: `${tenantId}_vendor01`,
        tenantId,
        name: "Cisco Systems",
        type: "hardware",
        region: "Global",
        contact_email: "support@cisco.com",
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    vendors = [
      {
        id: `${tenantId}_vendor01`,
        tenantId,
        name: "Google Cloud",
        type: "cloud",
        region: "Global",
        contact_email: "support@cloud.google.com",
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    vendors = [
      {
        id: `${tenantId}_vendor01`,
        tenantId,
        name: "Amazon Web Services",
        type: "cloud",
        region: "US/EU",
        contact_email: "support@aws.amazon.com",
        created_at: now,
      },
      {
        id: `${tenantId}_vendor02`,
        tenantId,
        name: "Cloudera",
        type: "software",
        region: "Global",
        contact_email: "support@cloudera.com",
        created_at: now,
      },
    ];
  }

  for (const vendor of vendors) {
    await db.put("vendors", vendor);

    await db.put("audit_logs", {
      id: `${vendor.id}_audit01`,
      tenantId,
      entity_type: "vendor",
      entity_id: vendor.id,
      action: "create",
      timestamp: now,
      hash: "hash_" + vendor.id,
      tags: ["seed"],
    });

    await db.put("activity_timeline", {
      id: `${vendor.id}_act01`,
      tenantId,
      type: "vendor",
      entity_id: vendor.id,
      action: "onboarded",
      description: `Vendor ${vendor.name} onboarded`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};