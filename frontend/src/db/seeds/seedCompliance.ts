import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedCompliance = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let compliance: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    compliance = [
      {
        id: `${tenantId}_comp01`,
        tenantId,
        framework: "ISO 27001",
        control: "A.12.1.2 - Change Management",
        status: "compliant",
        owner_team_id: `${tenantId}_team_noc`,
        last_audit_date: now,
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    compliance = [
      {
        id: `${tenantId}_comp01`,
        tenantId,
        framework: "SOC 2",
        control: "CC7.2 - Incident Response",
        status: "compliant",
        owner_team_id: `${tenantId}_team_sre`,
        last_audit_date: now,
        created_at: now,
      },
      {
        id: `${tenantId}_comp02`,
        tenantId,
        framework: "GDPR",
        control: "Article 32 - Security of Processing",
        status: "in_progress",
        owner_team_id: `${tenantId}_team_mediaops`,
        last_audit_date: now,
        created_at: now,
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    compliance = [
      {
        id: `${tenantId}_comp01`,
        tenantId,
        framework: "SOX",
        control: "Section 404 - Financial Reporting Controls",
        status: "non_compliant",
        owner_team_id: `${tenantId}_team_dba`,
        last_audit_date: now,
        created_at: now,
      },
      {
        id: `${tenantId}_comp02`,
        tenantId,
        framework: "PCI DSS",
        control: "Requirement 10 - Track and Monitor All Access",
        status: "compliant",
        owner_team_id: `${tenantId}_team_dataops`,
        last_audit_date: now,
        created_at: now,
      },
    ];
  }

  for (const comp of compliance) {
    await db.put("compliance", comp);

    await db.put("audit_logs", {
      id: `${comp.id}_audit01`,
      tenantId,
      entity_type: "compliance",
      entity_id: comp.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + comp.id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${comp.id}_act01`,
      tenantId,
      type: "compliance",
      entity_id: comp.id,
      action: "audited",
      description: `Compliance control "${comp.control}" for framework ${comp.framework} set to ${comp.status}`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};