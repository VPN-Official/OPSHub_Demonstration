import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedVendors = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let vendors: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    vendors = [
      {
        id: `${tenantId}_vendor01`,
        tenantId,
        name: "Cisco Systems",
        description: "Leading network infrastructure hardware provider for enterprise routing and switching solutions",
        type: "hardware",
        region: "Global",
        category: "infrastructure",
        subcategory: "network_hardware",
        priority: "critical",
        severity: "high",
        health_status: "green",
        status: "active",
        tier: "strategic",
        performance_score: 9.1,
        contract_value: 3500000,
        contact_email: "support@cisco.com",
        account_manager: "John Mitchell",
        technical_contact: "TAC Support Team",
        support_level: "24/7 premium",
        certifications: ["ISO 27001", "SOC 2 Type II", "FedRAMP"],
        sla_metrics: {
          uptime: "99.99%",
          response_time: "4hr",
          resolution_time: "24hr"
        },
        created_at: now,
        updated_at: now,
        tags: ["cisco", "hardware", "networking", "infrastructure", "strategic"],
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    vendors = [
      {
        id: `${tenantId}_vendor01`,
        tenantId,
        name: "Google Cloud",
        description: "Primary cloud infrastructure provider for compute, storage, and managed services",
        type: "cloud",
        region: "Global",
        category: "cloud_services",
        subcategory: "iaas_paas",
        priority: "critical",
        severity: "high",
        health_status: "green",
        status: "active",
        tier: "strategic",
        performance_score: 9.4,
        contract_value: 8500000,
        contact_email: "support@cloud.google.com",
        account_manager: "Sarah Zhang",
        technical_contact: "Cloud Customer Engineering",
        support_level: "enterprise premium",
        certifications: ["SOC 1/2/3", "ISO 27001", "PCI DSS", "HIPAA"],
        sla_metrics: {
          availability: "99.95%",
          response_time: "15min",
          resolution_time: "4hr"
        },
        created_at: now,
        updated_at: now,
        tags: ["google-cloud", "cloud", "iaas", "paas", "strategic"],
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    vendors = [
      {
        id: `${tenantId}_vendor01`,
        tenantId,
        name: "Amazon Web Services",
        description: "Primary cloud infrastructure provider for data analytics and enterprise workloads",
        type: "cloud",
        region: "US/EU",
        category: "cloud_services",
        subcategory: "data_analytics",
        priority: "critical",
        severity: "critical",
        health_status: "orange",
        status: "active",
        tier: "strategic",
        performance_score: 8.9,
        contract_value: 12000000,
        contact_email: "support@aws.amazon.com",
        account_manager: "Michael Torres",
        technical_contact: "Enterprise Support Team",
        support_level: "enterprise 24/7",
        certifications: ["SOC 1/2/3", "ISO 27001", "PCI DSS", "FedRAMP High"],
        sla_metrics: {
          availability: "99.99%",
          response_time: "15min",
          resolution_time: "2hr"
        },
        created_at: now,
        updated_at: now,
        tags: ["aws", "cloud", "data-analytics", "enterprise", "strategic"],
      },
      {
        id: `${tenantId}_vendor02`,
        tenantId,
        name: "Cloudera",
        description: "Enterprise data platform provider for big data analytics and machine learning workloads",
        type: "software",
        region: "Global",
        category: "data_platform",
        subcategory: "big_data",
        priority: "high",
        severity: "medium",
        health_status: "yellow",
        status: "active",
        tier: "preferred",
        performance_score: 8.2,
        contract_value: 2800000,
        contact_email: "support@cloudera.com",
        account_manager: "Lisa Chen",
        technical_contact: "Professional Services Team",
        support_level: "business critical",
        certifications: ["SOC 2 Type II", "ISO 27001", "GDPR Compliant"],
        sla_metrics: {
          uptime: "99.9%",
          response_time: "2hr",
          resolution_time: "8hr"
        },
        created_at: now,
        updated_at: now,
        tags: ["cloudera", "big-data", "analytics", "hadoop", "preferred"],
      },
    ];
  }

  // Insert vendors with proper error handling
  for (const vendor of vendors) {
    try {
      await db.put("vendors", vendor);

      // Create COMPLETE audit log entry
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "vendor",
        entity_id: vendor.id,
        action: "create",
        description: `Vendor onboarded: "${vendor.name}" (${vendor.category}/${vendor.subcategory}) - Tier: ${vendor.tier}, Performance: ${vendor.performance_score}/10`,
        timestamp: now,
        user_id: "system",
        tags: ["seed", "vendor", "create", vendor.category, vendor.tier],
        hash: await generateHash({
          entity_type: "vendor",
          entity_id: vendor.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          category: vendor.category,
          subcategory: vendor.subcategory,
          priority: vendor.priority,
          severity: vendor.severity,
          status: vendor.status,
          type: vendor.type,
          region: vendor.region,
          tier: vendor.tier,
          performance_score: vendor.performance_score,
          contract_value: vendor.contract_value,
          account_manager: vendor.account_manager,
          support_level: vendor.support_level,
          health_status: vendor.health_status,
          certifications: vendor.certifications,
          sla_metrics: vendor.sla_metrics
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `Vendor "${vendor.name}" onboarded - ${vendor.tier} tier, $${vendor.contract_value.toLocaleString()} contract, ${vendor.performance_score}/10 performance`,
        storeName: "vendors",
        recordId: vendor.id,
        action: "create",
        userId: "system",
        metadata: {
          vendor_id: vendor.id,
          category: vendor.category,
          subcategory: vendor.subcategory,
          type: vendor.type,
          region: vendor.region,
          tier: vendor.tier,
          contract_value: vendor.contract_value,
          account_manager: vendor.account_manager,
          vendor_details: {
            performance_score: vendor.performance_score,
            support_level: vendor.support_level,
            certifications: vendor.certifications,
            sla_metrics: vendor.sla_metrics,
            contact_info: {
              email: vendor.contact_email,
              technical_contact: vendor.technical_contact
            }
          }
        }
      });

      console.log(`✅ Seeded vendor: ${vendor.id} - ${vendor.name}`);
    } catch (error) {
      console.error(`❌ Failed to seed vendor ${vendor.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${vendors.length} vendors for ${tenantId}`);
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