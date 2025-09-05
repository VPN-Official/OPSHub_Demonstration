import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { v4 as uuidv4 } from "uuid";

export const seedActivities = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date();

  const perTenantActivities: Record<string, any[]> = {
    tenant_dcn_meta: [
      { type: "incident", entity_id: "inc-1001", action: "created", description: "New P1 incident logged" },
      { type: "problem", entity_id: "prob-2001", action: "analysis", description: "Problem under root cause analysis" },
      { type: "change", entity_id: "chg-3001", action: "submitted", description: "Change request submitted" },
    ],
    tenant_av_google: [
      { type: "alert", entity_id: "alert-4001", action: "triggered", description: "Kubernetes pod crash alert triggered" },
      { type: "metric", entity_id: "metric-5001", action: "captured", description: "CPU usage metric collected" },
      { type: "automation", entity_id: "auto-6001", action: "executed", description: "Auto-healing workflow executed" },
    ],
    tenant_sd_gates: [
      { type: "service_request", entity_id: "sr-7001", action: "approved", description: "VPN access request approved" },
      { type: "knowledge", entity_id: "kb-8001", action: "referenced", description: "Knowledge article used in resolution" },
      { type: "maintenance", entity_id: "mnt-9001", action: "completed", description: "Switch maintenance completed" },
    ],
  };

  const activities = (perTenantActivities[tenantId] || []).map((a) => ({
    id: uuidv4(),
    ...a,
    timestamp: now.toISOString(),
    user_id: "system_admin",
    team_id: "ops_team",
    ai_agent_id: null,
    automation_rule_id: null,
    related_entity_ids: [],
    tags: ["seed", "init"],
    custom_fields: { tenantId },
  }));

  for (const act of activities) {
    await db.put("activity_timeline", act);
  }

  console.log(`✅ Seeded ${activities.length} activities for ${tenantId}`);
};