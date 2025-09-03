import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedCostCenters = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let centers: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    centers = [
      {
        id: `${tenantId}_cc01`,
        tenantId: tenantId,
        code: "DCN-OPS-01",
        name: "Networking Operations",
        created_at: now,
        updated_at: now,
        business_service_ids: [`${tenantId}_svc_network`],
        annual_budget: 5000000,
        currency: "USD",
        tags: ["networking"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    centers = [
      {
        id: `${tenantId}_cc01`,
        tenantId: tenantId,
        code: "STREAM-OPS-01",
        name: "Streaming Operations",
        created_at: now,
        updated_at: now,
        business_service_ids: [`${tenantId}_svc_streaming`, `${tenantId}_svc_transcoding`],
        annual_budget: 2000000,
        currency: "USD",
        tags: ["streaming"],
        health_status: "red",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    centers = [
      {
        id: `${tenantId}_cc01`,
        tenantId: tenantId,
        code: "IT-OPS-01",
        name: "IT Operations",
        created_at: now,
        updated_at: now,
        business_service_ids: [`${tenantId}_svc_email`, `${tenantId}_svc_vpn`, `${tenantId}_svc_hr_portal`, `${tenantId}_svc_sharepoint`],
        annual_budget: 500000,
        currency: "USD",
        tags: ["itops"],
        health_status: "yellow",
      },
    ];
  }

  for (const cc of centers) {
    await db.put("cost_centers", cc);

    await db.put("audit_logs", {
      id: `${cc.id}_audit01`,
      tenantId: tenantId,
      entity_type: "cost_center",
      entity_id: cc.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + cc.id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${cc.id}_act01`,
      tenantId: tenantId,
      type: "cost_center",
      entity_id: cc.id,
      action: "created",
      description: `Cost Center "${cc.name}" seeded`,
      timestamp: now,
      related_entity_ids: cc.business_service_ids.map((id: string) => ({
        type: "business_service",
        id,
      })),
      tags: ["seed"],
    });
  }
};