import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedKnowledgeBase = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let kbArticles: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    kbArticles = [
      {
        id: `${tenantId}_kb01`,
        tenantId,
        title: "Troubleshooting High CPU on Routers",
        content: "Steps: 1) Verify process table. 2) Check BGP sessions. 3) Review firmware release notes.",
        related_service_id: `${tenantId}_svc_network`,
        created_at: now,
        tags: ["router", "cpu", "network"],
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    kbArticles = [
      {
        id: `${tenantId}_kb01`,
        tenantId,
        title: "Streaming Latency Mitigation",
        content: "Steps: 1) Validate edge node load. 2) Scale GCE instances. 3) Apply CDN routing rules.",
        related_service_id: `${tenantId}_svc_streaming`,
        created_at: now,
        tags: ["streaming", "latency"],
      },
      {
        id: `${tenantId}_kb02`,
        tenantId,
        title: "OOM Kill in GKE Pods",
        content: "Steps: 1) Review pod specs. 2) Increase memory requests/limits. 3) Apply horizontal pod autoscaler.",
        related_service_id: `${tenantId}_svc_transcoding`,
        created_at: now,
        tags: ["gke", "oom", "kubernetes"],
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    kbArticles = [
      {
        id: `${tenantId}_kb01`,
        tenantId,
        title: "Database Replication Lag",
        content: "Steps: 1) Check replica I/O thread. 2) Increase replication slots. 3) Monitor long-running queries.",
        related_service_id: `${tenantId}_svc_fin_reporting`,
        created_at: now,
        tags: ["database", "replication"],
      },
      {
        id: `${tenantId}_kb02`,
        tenantId,
        title: "ETL Job Failure Troubleshooting",
        content: "Steps: 1) Validate input data. 2) Check Spark executor logs. 3) Retry with checkpoint enabled.",
        related_service_id: `${tenantId}_svc_data_analytics`,
        created_at: now,
        tags: ["etl", "spark", "pipeline"],
      },
    ];
  }

  for (const kb of kbArticles) {
    await db.put("knowledge_base", kb);

    await db.put("audit_logs", {
      id: `${kb.id}_audit01`,
      tenantId,
      entity_type: "knowledge_base",
      entity_id: kb.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + kb.id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${kb.id}_act01`,
      tenantId,
      type: "knowledge_base",
      entity_id: kb.id,
      action: "published",
      description: `Knowledge article "${kb.title}" published`,
      timestamp: now,
      related_entity_ids: [{ type: "business_service", id: kb.related_service_id }],
      tags: ["seed"],
    });
  }
};