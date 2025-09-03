import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { v4 as uuidv4 } from "uuid";

export const seedAuditLogs = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date();

  const perTenantLogs: Record<string, any[]> = {
    tenant_dcn_meta: [
      {
        entity_type: "system",
        entity_id: "bootstrap",
        action: "create",
        description: "MetaOps bootstrap completed",
      },
      {
        entity_type: "incident",
        entity_id: "inc-1001",
        action: "update",
        description: "Incident priority changed to P1",
      },
      {
        entity_type: "change",
        entity_id: "chg-2001",
        action: "approve",
        description: "Change Request approved by CAB",
      },
    ],
    tenant_av_google: [
      {
        entity_type: "alert",
        entity_id: "alert-3001",
        action: "acknowledge",
        description: "CPU > 90% acknowledged by NOC",
      },
      {
        entity_type: "metric",
        entity_id: "metric-4001",
        action: "read",
        description: "Prometheus metric retrieved",
      },
      {
        entity_type: "automation_rule",
        entity_id: "auto-5001",
        action: "execute",
        description: "Auto-scale triggered",
      },
    ],
    tenant_sd_gates: [
      {
        entity_type: "service_request",
        entity_id: "sr-6001",
        action: "create",
        description: "Service request for VPN access created",
      },
      {
        entity_type: "problem",
        entity_id: "prob-7001",
        action: "update",
        description: "Root cause identified: faulty switch",
      },
      {
        entity_type: "knowledge",
        entity_id: "kb-8001",
        action: "read",
        description: "SOP on VPN troubleshooting accessed",
      },
    ],
  };

  const logs = (perTenantLogs[tenantId] || []).map((l) => ({
    id: uuidv4(),
    ...l,
    timestamp: now.toISOString(),
    user_id: "system_admin",
    team_id: "ops_team",
    ai_agent_id: null,
    automation_rule_id: null,
    ip_address: "10.0.0.1",
    location: tenantId,
    device_id: "seed-runner",
    hash: uuidv4(),
    compliance_flags: ["SOX"],
    tags: ["seed", "init"],
    custom_fields: { tenantId },
  }));

  for (const log of logs) {
    await db.put("audit_logs", log);
  }

  console.log(`✅ Seeded ${logs.length} audit logs for ${tenantId}`);
};