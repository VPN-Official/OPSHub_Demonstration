import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedValueStreams = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let streams: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    streams = [
      {
        id: `${tenantId}_vs01`,
        tenantId,
        name: "Enterprise Connectivity",
        description: "Provides secure, reliable network connectivity for enterprise workloads.",
        business_service_ids: [`${tenantId}_svc_network`],
        owner_team_id: `${tenantId}_team_network`,
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    streams = [
      {
        id: `${tenantId}_vs01`,
        tenantId,
        name: "Content Delivery",
        description: "Ensures low-latency live streaming and transcoding at scale.",
        business_service_ids: [`${tenantId}_svc_streaming`, `${tenantId}_svc_transcoding`],
        owner_team_id: `${tenantId}_team_sre`,
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    streams = [
      {
        id: `${tenantId}_vs01`,
        tenantId,
        name: "Financial Insights",
        description: "Supports compliance, reporting, and advanced analytics for investors.",
        business_service_ids: [`${tenantId}_svc_fin_reporting`, `${tenantId}_svc_data_analytics`],
        owner_team_id: `${tenantId}_team_dataops`,
        created_at: now,
      },
    ];
  }

  for (const vs of streams) {
    await db.put("value_streams", vs);

    // Audit log
    await db.put("audit_logs", {
      id: `${vs.id}_audit01`,
      tenantId,
      entity_type: "value_stream",
      entity_id: vs.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + vs.id,
      tags: ["seed"],
    });

    // Activity
    await db.put("activities", {
      id: `${vs.id}_act01`,
      tenantId,
      type: "value_stream",
      entity_id: vs.id,
      action: "created",
      description: `Value Stream "${vs.name}" created linking services: ${vs.business_service_ids.join(", ")}`,
      timestamp: now,
      related_entity_ids: vs.business_service_ids.map((id: string) => ({
        type: "business_service",
        id,
      })),
      tags: ["seed"],
    });
  }
};