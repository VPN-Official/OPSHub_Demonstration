import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedServiceComponents = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let components: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    components = [
      {
        id: `${tenantId}_comp_router01`,
        tenantId,
        name: "Core Router",
        type: "network_device",
        business_service_id: `${tenantId}_svc_network`,
        status: "operational",
        created_at: now,
      },
      {
        id: `${tenantId}_comp_switch01`,
        tenantId,
        name: "Top-of-Rack Switch",
        type: "network_device",
        business_service_id: `${tenantId}_svc_network`,
        status: "operational",
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    components = [
      {
        id: `${tenantId}_comp_edge01`,
        tenantId,
        name: "EU Edge Node",
        type: "compute_node",
        business_service_id: `${tenantId}_svc_streaming`,
        status: "operational",
        created_at: now,
      },
      {
        id: `${tenantId}_comp_gke_cluster01`,
        tenantId,
        name: "GKE Transcoding Cluster",
        type: "kubernetes_cluster",
        business_service_id: `${tenantId}_svc_transcoding`,
        status: "operational",
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    components = [
      {
        id: `${tenantId}_comp_reportingdb`,
        tenantId,
        name: "Reporting Database",
        type: "database",
        business_service_id: `${tenantId}_svc_fin_reporting`,
        status: "operational",
        created_at: now,
      },
      {
        id: `${tenantId}_comp_datalake01`,
        tenantId,
        name: "Data Lake Ingestion Service",
        type: "etl_pipeline",
        business_service_id: `${tenantId}_svc_data_analytics`,
        status: "operational",
        created_at: now,
      },
    ];
  }

  for (const comp of components) {
    await db.put("service_components", comp);

    await db.put("audit_logs", {
      id: `${comp.id}_audit01`,
      tenantId,
      entity_type: "service_component",
      entity_id: comp.id,
      action: "create",
      timestamp: now,
      hash: "hash_" + comp.id,
      tags: ["seed"],
    });

    await db.put("activity_timeline", {
      id: `${comp.id}_act01`,
      tenantId,
      type: "service_component",
      entity_id: comp.id,
      action: "created",
      description: `Service component ${comp.name} created`,
      timestamp: now,
      related_entity_ids: [
        { type: "business_service", id: comp.business_service_id },
      ],
      tags: ["seed"],
    });
  }
};