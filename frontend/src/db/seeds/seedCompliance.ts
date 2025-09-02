import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedCompliance = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let reqs: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    reqs = [
      {
        id: `${tenantId}_comp01`,
        tenant_id: tenantId,
        name: "ISO27001 A.12",
        type: "standard",
        status: "active",
        created_at: now,
        updated_at: now,
        business_service_ids: [`${tenantId}_svc_network`],
        tags: ["iso27001"],
        health_status: "green",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    reqs = [
      {
        id: `${tenantId}_comp01`,
        tenant_id: tenantId,
        name: "SOC2 Type II",
        type: "standard",
        status: "active",
        created_at: now,
        updated_at: now,
        business_service_ids: [`${tenantId}_svc_streaming`, `${tenantId}_svc_transcoding`],
        tags: ["soc2"],
        health_status: "green",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    reqs = [
      {
        id: `${tenantId}_comp01`,
        tenant_id: tenantId,
        name: "HIPAA Section 164",
        type: "regulatory",
        status: "active",
        created_at: now,
        updated_at: now,
        business_service_ids: [`${tenantId}_svc_email`, `${tenantId}_svc_hr_portal`],
        tags: ["hipaa"],
        health_status: "yellow",
      },
    ];
  }

  for (const req of reqs) {
    await db.put("compliance", req);

    await db.put("audit_logs", {
      id: `${req.id}_audit01`,
      tenant_id: tenantId,
      entity_type: "compliance",
      entity_id: req.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + req.id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${req.id}_act01`,
      tenant_id: tenantId,
      type: "compliance",
      entity_id: req.id,
      action: "created",
      description: `Compliance Requirement "${req.name}" seeded`,
      timestamp: now,
      related_entity_ids: req.business_service_ids.map((id: string) => ({
        type: "business_service",
        id,
      })),
      tags: ["seed"],
    });
  }
};