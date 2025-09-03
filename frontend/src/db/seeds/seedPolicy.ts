import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedPolicy = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let policies: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    policies = [
      {
        id: `${tenantId}_pol01`,
        tenantId,
        name: "Critical Change Approval",
        description: "All firmware upgrades must be approved by Network Engineering Manager.",
        scope: "change_requests",
        status: "active",
        created_at: now,
        tags: ["network", "change", "approval"],
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    policies = [
      {
        id: `${tenantId}_pol01`,
        tenantId,
        name: "Latency SLA Enforcement",
        description: "Streaming latency must not exceed 250ms in any region.",
        scope: "metrics",
        status: "active",
        created_at: now,
        tags: ["sla", "latency", "streaming"],
      },
      {
        id: `${tenantId}_pol02`,
        tenantId,
        name: "Kubernetes Resource Quotas",
        description: "All transcoding pods must define CPU and memory limits.",
        scope: "service_components",
        status: "active",
        created_at: now,
        tags: ["gke", "quota", "policy"],
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    policies = [
      {
        id: `${tenantId}_pol01`,
        tenantId,
        name: "SOX Reporting Compliance",
        description: "Financial reporting services must meet SOX control requirements.",
        scope: "business_services",
        status: "active",
        created_at: now,
        tags: ["sox", "reporting", "policy"],
      },
      {
        id: `${tenantId}_pol02`,
        tenantId,
        name: "Data Retention",
        description: "ETL pipelines must retain source data for 7 years for audit purposes.",
        scope: "etl",
        status: "active",
        created_at: now,
        tags: ["etl", "data", "retention"],
      },
    ];
  }

  for (const pol of policies) {
    await db.put("policy", pol);

    await db.put("audit_logs", {
      id: `${pol.id}_audit01`,
      tenantId,
      entity_type: "policy",
      entity_id: pol.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + pol.id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${pol.id}_act01`,
      tenantId,
      type: "policy",
      entity_id: pol.id,
      action: "enforced",
      description: `Policy "${pol.name}" enforced for scope ${pol.scope}`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};