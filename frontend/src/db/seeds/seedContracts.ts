import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedContracts = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let contracts: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    contracts = [
      {
        id: `${tenantId}_contract01`,
        tenantId,
        vendor_id: `${tenantId}_vendor01`,
        title: "Cisco Hardware Support SLA",
        sla_hours: "24x7",
        expiry_date: "2026-12-31",
        status: "active",
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    contracts = [
      {
        id: `${tenantId}_contract01`,
        tenantId,
        vendor_id: `${tenantId}_vendor01`,
        title: "Google Cloud Enterprise Support",
        sla_hours: "24x7",
        expiry_date: "2025-12-31",
        status: "active",
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    contracts = [
      {
        id: `${tenantId}_contract01`,
        tenantId,
        vendor_id: `${tenantId}_vendor01`,
        title: "AWS Enterprise Support",
        sla_hours: "24x7",
        expiry_date: "2026-06-30",
        status: "active",
        created_at: now,
      },
      {
        id: `${tenantId}_contract02`,
        tenantId,
        vendor_id: `${tenantId}_vendor02`,
        title: "Cloudera Platform Subscription",
        sla_hours: "Business Hours",
        expiry_date: "2025-09-30",
        status: "active",
        created_at: now,
      },
    ];
  }

  for (const contract of contracts) {
    await db.put("contracts", contract);

    await db.put("audit_logs", {
      id: `${contract.id}_audit01`,
      tenantId,
      entity_type: "contract",
      entity_id: contract.id,
      action: "create",
      timestamp: now,
      hash: "hash_" + contract.id,
      tags: ["seed"],
    });

    await db.put("activity_timeline", {
      id: `${contract.id}_act01`,
      tenantId,
      type: "contract",
      entity_id: contract.id,
      action: "signed",
      description: `Contract "${contract.title}" created for vendor ${contract.vendor_id}`,
      timestamp: now,
      related_entity_ids: [{ type: "vendor", id: contract.vendor_id }],
      tags: ["seed"],
    });
  }
};