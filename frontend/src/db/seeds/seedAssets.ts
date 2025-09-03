import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedAssets = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let assets: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    assets = [
      {
        id: `${tenantId}_asset_router01`,
        tenantId,
        name: "Router R1",
        type: "router",
        location: "DCN Meta DC1",
        service_component_id: `${tenantId}_comp_router01`,
        status: "active",
        created_at: now,
      },
      {
        id: `${tenantId}_asset_switch01`,
        tenantId,
        name: "Switch S1",
        type: "switch",
        location: "DCN Meta DC1",
        service_component_id: `${tenantId}_comp_switch01`,
        status: "active",
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    assets = [
      {
        id: `${tenantId}_asset_gce_vm01`,
        tenantId,
        name: "Edge VM EU1",
        type: "gce_vm",
        location: "Belgium Region",
        service_component_id: `${tenantId}_comp_edge01`,
        status: "active",
        created_at: now,
      },
      {
        id: `${tenantId}_asset_gke_node01`,
        tenantId,
        name: "GKE Node n1",
        type: "gke_node",
        location: "Belgium Region",
        service_component_id: `${tenantId}_comp_gke_cluster01`,
        status: "active",
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    assets = [
      {
        id: `${tenantId}_asset_db01`,
        tenantId,
        name: "Reporting DB Primary",
        type: "postgresql_instance",
        location: "AWS us-east-1",
        service_component_id: `${tenantId}_comp_reportingdb`,
        status: "active",
        created_at: now,
      },
      {
        id: `${tenantId}_asset_etl01`,
        tenantId,
        name: "ETL Worker Cluster",
        type: "spark_cluster",
        location: "AWS us-east-1",
        service_component_id: `${tenantId}_comp_datalake01`,
        status: "active",
        created_at: now,
      },
    ];
  }

  for (const asset of assets) {
    await db.put("assets", asset);

    await db.put("audit_logs", {
      id: `${asset.id}_audit01`,
      tenantId,
      entity_type: "asset",
      entity_id: asset.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + asset.id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${asset.id}_act01`,
      tenantId,
      type: "asset",
      entity_id: asset.id,
      action: "created",
      description: `Asset ${asset.name} created`,
      timestamp: now,
      related_entity_ids: [
        { type: "service_component", id: asset.service_component_id },
      ],
      tags: ["seed"],
    });
  }
};