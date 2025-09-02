import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedKnowledgeBase = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let articles: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    articles = [
      {
        id: `${tenantId}_kb01`,
        tenant_id: tenantId,
        title: "Router CPU Spike Troubleshooting",
        type: "troubleshooting",
        status: "published",
        content: "Steps to diagnose and fix router CPU issues...",
        related_incident_ids: [`${tenantId}_inc01`],
        tags: ["router", "cpu"],
        created_at: now,
        updated_at: now,
        health_status: "green",
      },
      {
        id: `${tenantId}_kb02`,
        tenant_id: tenantId,
        title: "Switch CRC Error SOP",
        type: "sop",
        status: "published",
        content: "Procedure to handle CRC errors on TOR switches...",
        related_incident_ids: [`${tenantId}_inc02`],
        tags: ["switch", "sop"],
        created_at: now,
        updated_at: now,
        health_status: "yellow",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    articles = [
      {
        id: `${tenantId}_kb01`,
        tenant_id: tenantId,
        title: "Stream Latency Tuning Guide",
        type: "how_to",
        status: "published",
        content: "How to adjust edge nodes for optimal latency...",
        related_incident_ids: [`${tenantId}_inc01`],
        tags: ["latency", "streaming"],
        created_at: now,
        updated_at: now,
        health_status: "green",
      },
      {
        id: `${tenantId}_kb02`,
        tenant_id: tenantId,
        title: "Transcoding Pod OOM Fix",
        type: "troubleshooting",
        status: "published",
        content: "Steps to prevent OOM kills in transcoding workloads...",
        related_incident_ids: [`${tenantId}_inc02`],
        tags: ["gke", "oom"],
        created_at: now,
        updated_at: now,
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    articles = [
      {
        id: `${tenantId}_kb01`,
        tenant_id: tenantId,
        title: "Exchange Mail Queue Troubleshooting",
        type: "troubleshooting",
        status: "published",
        content: "Procedure to troubleshoot mail queue backlogs...",
        related_incident_ids: [`${tenantId}_inc01`],
        tags: ["exchange", "mail"],
        created_at: now,
        updated_at: now,
        health_status: "red",
      },
      {
        id: `${tenantId}_kb02`,
        tenant_id: tenantId,
        title: "VPN Tunnel Drop SOP",
        type: "sop",
        status: "published",
        content: "Steps to investigate VPN tunnel drops...",
        related_incident_ids: [`${tenantId}_inc02`],
        tags: ["vpn", "sop"],
        created_at: now,
        updated_at: now,
        health_status: "yellow",
      },
    ];
  }

  for (const kb of articles) {
    await db.put("knowledge_base", kb);

    await db.put("audit_logs", {
      id: `${kb.id}_audit01`,
      tenant_id: tenantId,
      entity_type: "knowledge",
      entity_id: kb.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + kb.id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${kb.id}_act01`,
      tenant_id: tenantId,
      type: "knowledge",
      entity_id: kb.id,
      action: "created",
      description: `Knowledge Article "${kb.title}" seeded`,
      timestamp: now,
      related_entity_ids: kb.related_incident_ids.map((id: string) => ({
        type: "incident",
        id,
      })),
      tags: ["seed"],
    });
  }
};