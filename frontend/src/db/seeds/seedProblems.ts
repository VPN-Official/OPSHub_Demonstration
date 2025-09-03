import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedProblems = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let problems: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    problems = [
      {
        id: `${tenantId}_prob01`,
        tenantId: tenantId,
        title: "Recurring Router CPU Spikes",
        description: "Multiple incidents linked to core router overutilization.",
        status: "analysis",
        priority: "P2",
        impact: "high",
        urgency: "medium",
        created_at: now,
        updated_at: now,
        related_incident_ids: [`${tenantId}_inc01`, `${tenantId}_inc02`],
        root_cause_summary: null,
        root_cause_category: "hardware",
        workaround_summary: "Restart router process clears CPU temporarily.",
        business_impact: "Inter-DC packet loss observed.",
        service_component_ids: [`${tenantId}_comp_router01`],
        asset_ids: [`${tenantId}_asset_router01`],
        tags: ["network", "router", "rca"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    problems = [
      {
        id: `${tenantId}_prob01`,
        tenantId: tenantId,
        title: "Transcoding Cluster Memory Leaks",
        description: "Incidents show recurring OOM kills in transcoding pods.",
        status: "root_cause_identified",
        priority: "P2",
        impact: "high",
        urgency: "medium",
        created_at: now,
        updated_at: now,
        related_incident_ids: [`${tenantId}_inc01`, `${tenantId}_inc02`],
        root_cause_summary: "Bug in ffmpeg library memory handling.",
        root_cause_category: "software",
        workaround_summary: "Restart pods every 6 hours.",
        business_impact: "Reduced video transcoding capacity during peak hours.",
        service_component_ids: [`${tenantId}_comp_gke_cluster01`],
        asset_ids: [`${tenantId}_asset_gke_node01`],
        tags: ["transcoding", "memory", "rca"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    problems = [
      {
        id: `${tenantId}_prob01`,
        tenantId: tenantId,
        title: "Recurring VPN Authentication Failures",
        description: "VPN outage incidents traced to faulty RADIUS config.",
        status: "analysis",
        priority: "P3",
        impact: "medium",
        urgency: "medium",
        created_at: now,
        updated_at: now,
        related_incident_ids: [`${tenantId}_inc02`],
        root_cause_summary: null,
        root_cause_category: "process_gap",
        workaround_summary: "Manual restart of RADIUS service restores access.",
        business_impact: "Remote staff intermittently lose connectivity.",
        service_component_ids: [`${tenantId}_comp_vpn01`],
        asset_ids: [`${tenantId}_asset_vpn_appliance01`],
        tags: ["vpn", "auth", "rca"],
        health_status: "yellow",
      },
    ];
  }

  // Insert into IndexedDB
  for (const prob of problems) {
    await db.put("problems", prob);

    // Light Audit log
    await db.put("audit_logs", {
      id: `${prob.id}_audit01`,
      tenantId: tenantId,
      entity_type: "problem",
      entity_id: prob.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + prob.id,
      tags: ["seed"],
    });

    // Light Activity timeline
    await db.put("activities", {
      id: `${prob.id}_act01`,
      tenantId: tenantId,
      type: "problem",
      entity_id: prob.id,
      action: "created",
      description: `Problem "${prob.title}" seeded`,
      timestamp: now,
      related_entity_ids: prob.related_incident_ids.map((id: string) => ({
        type: "incident",
        id,
      })),
      tags: ["seed"],
    });
  }
};