import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

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
        control_id: "A.12.1.2",
        title: "Change Management Control",
        description: "Ensures proper change management procedures for network infrastructure",
        status: "compliant",
        priority: "high",
        category: "change_management",
        subcategory: "procedures",
        health_status: "green",
        owner_team_id: `${tenantId}_team_noc`,
        auditor: "Internal IT Audit",
        compliance_score: 95,
        evidence_count: 8,
        findings_count: 0,
        risk_level: "low",
        maturity_level: "optimized",
        implementation_date: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        last_audit_date: now,
        next_audit_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        remediation_deadline: null,
        created_at: now,
        tags: ["iso27001", "change_management", "network"],
        custom_fields: {
          control_family: "Operational Security",
          audit_frequency: "annual",
          automation_level: "high",
          related_policies: ["POL-001", "POL-007"]
        }
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
        control_id: "CC7.2",
        title: "System Incident Response",
        description: "Procedures for detecting, analyzing and responding to security incidents",
        status: "compliant",
        priority: "critical",
        category: "incident_response",
        subcategory: "procedures",
        health_status: "green",
        owner_team_id: `${tenantId}_team_sre`,
        auditor: "External SOC 2 Auditor",
        compliance_score: 98,
        evidence_count: 15,
        findings_count: 0,
        risk_level: "low",
        maturity_level: "managed",
        implementation_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        last_audit_date: now,
        next_audit_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        remediation_deadline: null,
        created_at: now,
        tags: ["soc2", "incident_response", "security"],
        custom_fields: {
          control_family: "Common Criteria",
          audit_frequency: "annual",
          automation_level: "high",
          related_runbooks: ["RB-001", "RB-003"]
        }
      },
      {
        id: `${tenantId}_comp02`,
        tenantId,
        framework: "GDPR",
        control: "Article 32 - Security of Processing",
        control_id: "Art32",
        title: "Technical and Organisational Measures",
        description: "Implementation of appropriate technical and organisational measures for data security",
        status: "in_progress",
        priority: "high",
        category: "data_protection",
        subcategory: "technical_measures",
        health_status: "yellow",
        owner_team_id: `${tenantId}_team_mediaops`,
        auditor: "Data Protection Officer",
        compliance_score: 75,
        evidence_count: 8,
        findings_count: 3,
        risk_level: "medium",
        maturity_level: "defined",
        implementation_date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        last_audit_date: now,
        next_audit_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        remediation_deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: now,
        tags: ["gdpr", "data_protection", "encryption"],
        custom_fields: {
          control_family: "Data Protection Rights",
          audit_frequency: "quarterly",
          automation_level: "medium",
          data_categories: ["personal", "sensitive"]
        }
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
        control_id: "404",
        title: "Internal Control Over Financial Reporting",
        description: "Assessment of internal controls over financial reporting for regulatory compliance",
        status: "non_compliant",
        priority: "critical",
        category: "financial_controls",
        subcategory: "reporting",
        health_status: "red",
        owner_team_id: `${tenantId}_team_dba`,
        auditor: "External Financial Auditor",
        compliance_score: 60,
        evidence_count: 5,
        findings_count: 7,
        risk_level: "high",
        maturity_level: "defined",
        implementation_date: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
        last_audit_date: now,
        next_audit_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        remediation_deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: now,
        tags: ["sox", "financial_controls", "reporting", "critical"],
        custom_fields: {
          control_family: "Financial Reporting",
          audit_frequency: "quarterly",
          automation_level: "low",
          deficiency_type: "material_weakness"
        }
      },
      {
        id: `${tenantId}_comp02`,
        tenantId,
        framework: "PCI DSS",
        control: "Requirement 10 - Track and Monitor All Access",
        control_id: "REQ10",
        title: "Logging and Monitoring Requirements",
        description: "Track and monitor all access to network resources and cardholder data",
        status: "compliant",
        priority: "high",
        category: "access_control",
        subcategory: "monitoring",
        health_status: "green",
        owner_team_id: `${tenantId}_team_dataops`,
        auditor: "QSA (Qualified Security Assessor)",
        compliance_score: 92,
        evidence_count: 12,
        findings_count: 1,
        risk_level: "low",
        maturity_level: "optimized",
        implementation_date: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
        last_audit_date: now,
        next_audit_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        remediation_deadline: null,
        created_at: now,
        tags: ["pci_dss", "logging", "access_control", "monitoring"],
        custom_fields: {
          control_family: "Access Control",
          audit_frequency: "annual",
          automation_level: "high",
          log_retention_days: 365
        }
      },
    ];
  }

  // Insert compliance records with proper error handling
  for (const comp of compliance) {
    try {
      await db.put("compliance", comp);

      // Create COMPLETE audit log entry
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "compliance",
        entity_id: comp.id,
        action: "create",
        description: `Compliance control registered: ${comp.title} (${comp.framework} ${comp.control_id}) - Status: ${comp.status}`,
        timestamp: now,
        user_id: "system", // Required field
        tags: ["seed", "compliance", "create", comp.category],
        hash: await generateHash({
          entity_type: "compliance",
          entity_id: comp.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          framework: comp.framework,
          control_id: comp.control_id,
          status: comp.status,
          priority: comp.priority,
          compliance_score: comp.compliance_score,
          risk_level: comp.risk_level,
          maturity_level: comp.maturity_level,
          auditor: comp.auditor,
          findings_count: comp.findings_count,
          evidence_count: comp.evidence_count,
          next_audit_date: comp.next_audit_date
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `Compliance control "${comp.title}" (${comp.framework}) audited with status ${comp.status} and score ${comp.compliance_score}%`,
        storeName: "compliance", // Required field for dbClient compatibility
        recordId: comp.id, // Required field for dbClient compatibility
        action: "create",
        userId: "system",
        metadata: {
          compliance_id: comp.id,
          framework: comp.framework,
          control_id: comp.control_id,
          status: comp.status,
          compliance_score: comp.compliance_score,
          risk_level: comp.risk_level,
          auditor: comp.auditor,
          findings_count: comp.findings_count,
          related_entities: [
            { type: "team", id: comp.owner_team_id }
          ]
        }
      });

      console.log(`✅ Seeded compliance: ${comp.id} - ${comp.title}`);
    } catch (error) {
      console.error(`❌ Failed to seed compliance ${comp.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${compliance.length} compliance records for ${tenantId}`);
};

// Helper function to generate audit hash (simplified for seeding)
async function generateHash(data: any): Promise<string> {
  try {
    const { generateImmutableHash } = await import("../../utils/auditUtils");
    return await generateImmutableHash(data);
  } catch {
    // Fallback for seeding if utils not available
    return `seed_hash_${data.entity_id}_${Date.now()}`;
  }
}