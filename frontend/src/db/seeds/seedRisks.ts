import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedRisks = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let risks: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    risks = [
      {
        id: `${tenantId}_risk01`,
        tenant_id: tenantId,
        title: "Unpatched Router Firmware",
        category: "security",
        status: "identified",
        severity: "high",
        likelihood: "likely",
        impact: "high",
        score: 85,
        created_at: now,
        updated_at: now,
        business_service_ids: [`${tenantId}_svc_network`],
        asset_ids: [`${tenantId}_asset_router01`],
        tags: ["router", "security"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    risks = [
      {
        id: `${tenantId}_risk01`,
        tenant_id: tenantId,
        title: "Transcoding Memory Leaks",
        category: "availability",
        status: "assessed",
        severity: "high",
        likelihood: "possible",
        impact: "high",
        score: 75,
        created_at: now,
        updated_at: now,
        business_service_ids: [`${tenantId}_svc_transcoding`],
        asset_ids: [`${tenantId}_asset_gke_node01`],
        tags: ["memory", "availability"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    risks = [
      {
        id: `${tenantId}_risk01`,
        tenant_id: tenantId,
        title: "Exchange Vulnerability CVE-2025-1234",
        category: "security",
        status: "mitigation_planned",
        severity: "critical",
        likelihood: "likely",
        impact: "critical",
        score: 95,
        created_at: now,
        updated_at: now,
        business_service_ids: [`${tenantId}_svc_email`],
        asset_ids: [`${tenantId}_asset_mx01`],
        tags: ["exchange", "vuln"],
        health_status: "red",
      },
    ];
  }

  for (const risk of risks) {
    await db.put("risks", risk);

    await db.put("audit_logs", {
      id: `${risk.id}_audit01`,
      tenant_id: tenantId,
      entity_type: "risk",
      entity_id: risk.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + risk.id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${risk.id}_act01`,
      tenant_id: tenantId,
      type: "risk",
      entity_id: risk.id,
      action: "created",
      description: `Risk "${risk.title}" seeded`,
      timestamp: now,
      related_entity_ids: risk.asset_ids.map((id: string) => ({
        type: "asset",
        id,
      })),
      tags: ["seed"],
    });
  }
};