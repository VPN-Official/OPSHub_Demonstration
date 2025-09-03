import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedContracts = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let contracts: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    contracts = [
      {
        id: `${tenantId}_contract01`,
        tenantId: tenantId,
        name: "Cisco Support SLA",
        type: "vendor",
        status: "active",
        start_date: now,
        created_at: now,
        updated_at: now,
        vendor_id: `${tenantId}_vendor01`,
        business_service_ids: [`${tenantId}_svc_network`],
        penalty_per_breach: 10000,
        tags: ["sla"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    contracts = [
      {
        id: `${tenantId}_contract01`,
        tenantId: tenantId,
        name: "GCP Service SLA",
        type: "vendor",
        status: "active",
        start_date: now,
        created_at: now,
        updated_at: now,
        vendor_id: `${tenantId}_vendor01`,
        business_service_ids: [`${tenantId}_svc_streaming`, `${tenantId}_svc_transcoding`],
        penalty_per_breach: 5000,
        tags: ["sla"],
        health_status: "red",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    contracts = [
      {
        id: `${tenantId}_contract01`,
        tenantId: tenantId,
        name: "Microsoft Enterprise Agreement",
        type: "vendor",
        status: "active",
        start_date: now,
        created_at: now,
        updated_at: now,
        vendor_id: `${tenantId}_vendor01`,
        business_service_ids: [`${tenantId}_svc_email`, `${tenantId}_svc_sharepoint`],
        penalty_per_breach: 2000,
        tags: ["ea"],
        health_status: "yellow",
      },
    ];
  }

  for (const contract of contracts) {
    await db.put("contracts", contract);

    await db.put("audit_logs", {
      id: `${contract.id}_audit01`,
      tenantId: tenantId,
      entity_type: "contract",
      entity_id: contract.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + contract.id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${contract.id}_act01`,
      tenantId: tenantId,
      type: "contract",
      entity_id: contract.id,
      action: "created",
      description: `Contract "${contract.name}" seeded`,
      timestamp: now,
      related_entity_ids: contract.business_service_ids.map((id: string) => ({
        type: "business_service",
        id,
      })),
      tags: ["seed"],
    });
  }
};