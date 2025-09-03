import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedContracts = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let contracts: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    contracts = [
      {
        id: `${tenantId}_contract01`,
        tenantId,
        vendor_id: `${tenantId}_vendor01`,
        title: "Cisco Hardware Support SLA",
        description: "Comprehensive 24x7 hardware support and maintenance contract for network infrastructure",
        sla_hours: "24x7",
        expiry_date: "2026-12-31",
        category: "support",
        subcategory: "hardware_maintenance",
        priority: "critical",
        severity: "high",
        health_status: "green",
        status: "active",
        contract_type: "support_maintenance",
        contract_value: 850000,
        auto_renewal: true,
        payment_terms: "annual",
        penalty_clauses: ["SLA breach penalties", "Late payment fees"],
        performance_metrics: {
          response_time: "4hr",
          resolution_time: "24hr",
          uptime_guarantee: "99.99%"
        },
        key_contacts: {
          vendor_manager: "John Mitchell",
          client_manager: "Network Operations Manager"
        },
        created_at: now,
        updated_at: now,
        tags: ["cisco", "hardware", "support", "sla", "24x7"],
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    contracts = [
      {
        id: `${tenantId}_contract01`,
        tenantId,
        vendor_id: `${tenantId}_vendor01`,
        title: "Google Cloud Enterprise Support",
        description: "Enterprise-grade cloud support with premium SLA and dedicated technical account management",
        sla_hours: "24x7",
        expiry_date: "2025-12-31",
        category: "cloud_support",
        subcategory: "enterprise",
        priority: "critical",
        severity: "high",
        health_status: "green",
        status: "active",
        contract_type: "enterprise_support",
        contract_value: 1200000,
        auto_renewal: true,
        payment_terms: "monthly",
        penalty_clauses: ["Service credit for SLA breaches", "Performance guarantees"],
        performance_metrics: {
          response_time: "15min",
          resolution_time: "4hr",
          availability_guarantee: "99.95%"
        },
        key_contacts: {
          vendor_manager: "Sarah Zhang",
          client_manager: "SRE Team Lead"
        },
        created_at: now,
        updated_at: now,
        tags: ["google-cloud", "enterprise", "support", "sla", "premium"],
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    contracts = [
      {
        id: `${tenantId}_contract01`,
        tenantId,
        vendor_id: `${tenantId}_vendor01`,
        title: "AWS Enterprise Support",
        description: "Comprehensive AWS enterprise support with dedicated Technical Account Manager and architectural guidance",
        sla_hours: "24x7",
        expiry_date: "2026-06-30",
        category: "cloud_support",
        subcategory: "enterprise",
        priority: "critical",
        severity: "critical",
        health_status: "orange",
        status: "active",
        contract_type: "enterprise_support",
        contract_value: 1800000,
        auto_renewal: false,
        payment_terms: "monthly",
        penalty_clauses: ["Service credits for outages", "SLA breach remediation"],
        performance_metrics: {
          response_time: "15min",
          resolution_time: "2hr",
          availability_guarantee: "99.99%"
        },
        key_contacts: {
          vendor_manager: "Michael Torres",
          client_manager: "Cloud Architecture Team"
        },
        created_at: now,
        updated_at: now,
        tags: ["aws", "enterprise", "support", "tam", "critical"],
      },
      {
        id: `${tenantId}_contract02`,
        tenantId,
        vendor_id: `${tenantId}_vendor02`,
        title: "Cloudera Platform Subscription",
        description: "Enterprise data platform subscription with professional services and business hours support",
        sla_hours: "Business Hours",
        expiry_date: "2025-09-30",
        category: "software_license",
        subcategory: "data_platform",
        priority: "high",
        severity: "medium",
        health_status: "yellow",
        status: "active",
        contract_type: "software_subscription",
        contract_value: 650000,
        auto_renewal: true,
        payment_terms: "quarterly",
        penalty_clauses: ["License compliance penalties", "Usage overage fees"],
        performance_metrics: {
          response_time: "2hr",
          resolution_time: "8hr",
          uptime_guarantee: "99.9%"
        },
        key_contacts: {
          vendor_manager: "Lisa Chen",
          client_manager: "Data Platform Team Lead"
        },
        created_at: now,
        updated_at: now,
        tags: ["cloudera", "subscription", "data-platform", "analytics", "business-hours"],
      },
    ];
  }

  // Insert contracts with proper error handling
  for (const contract of contracts) {
    try {
      await db.put("contracts", contract);

      // Create COMPLETE audit log entry
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "contract",
        entity_id: contract.id,
        action: "create",
        description: `Contract executed: "${contract.title}" (${contract.category}/${contract.subcategory}) - Value: $${contract.contract_value.toLocaleString()}, Expires: ${contract.expiry_date}`,
        timestamp: now,
        user_id: "system",
        tags: ["seed", "contract", "create", contract.category, contract.contract_type],
        hash: await generateHash({
          entity_type: "contract",
          entity_id: contract.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          category: contract.category,
          subcategory: contract.subcategory,
          priority: contract.priority,
          severity: contract.severity,
          status: contract.status,
          contract_type: contract.contract_type,
          contract_value: contract.contract_value,
          expiry_date: contract.expiry_date,
          auto_renewal: contract.auto_renewal,
          payment_terms: contract.payment_terms,
          vendor_id: contract.vendor_id,
          sla_hours: contract.sla_hours,
          health_status: contract.health_status,
          performance_metrics: contract.performance_metrics,
          key_contacts: contract.key_contacts
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `Contract "${contract.title}" executed - $${contract.contract_value.toLocaleString()} value, ${contract.sla_hours} support`,
        storeName: "contracts",
        recordId: contract.id,
        action: "create",
        userId: "system",
        metadata: {
          contract_id: contract.id,
          category: contract.category,
          subcategory: contract.subcategory,
          contract_type: contract.contract_type,
          contract_value: contract.contract_value,
          vendor_id: contract.vendor_id,
          contract_details: {
            expiry_date: contract.expiry_date,
            sla_hours: contract.sla_hours,
            auto_renewal: contract.auto_renewal,
            payment_terms: contract.payment_terms,
            performance_metrics: contract.performance_metrics,
            key_contacts: contract.key_contacts,
            penalty_clauses: contract.penalty_clauses
          },
          related_entities: [
            { type: "vendor", id: contract.vendor_id }
          ]
        }
      });

      console.log(`✅ Seeded contract: ${contract.id} - ${contract.title}`);
    } catch (error) {
      console.error(`❌ Failed to seed contract ${contract.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${contracts.length} contracts for ${tenantId}`);
};

// Helper function to generate audit hash
async function generateHash(data: any): Promise<string> {
  try {
    const { generateImmutableHash } = await import("../../utils/auditUtils");
    return await generateImmutableHash(data);
  } catch {
    // Fallback for seeding if utils not available
    return `seed_hash_${data.entity_id}_${Date.now()}`;
  }
}