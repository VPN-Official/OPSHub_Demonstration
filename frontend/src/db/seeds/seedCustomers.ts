import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedCustomers = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let customers: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    customers = [
      {
        id: `${tenantId}_cust01`,
        tenantId,
        name: "Meta Internal IT",
        description: "Internal technology operations requiring enterprise-grade network connectivity and security",
        industry: "Technology",
        region: "North America",
        category: "internal",
        subcategory: "it_operations",
        priority: "critical",
        severity: "high",
        health_status: "green",
        status: "active",
        tier: "platinum",
        contract_value: 2500000,
        satisfaction_score: 9.2,
        value_stream_id: `${tenantId}_vs01`,
        account_manager: "Sarah Chen",
        technical_contact: "Network Operations Team",
        sla_requirements: {
          uptime: "99.9%",
          response_time: "15min",
          resolution_time: "4hr"
        },
        created_at: now,
        updated_at: now,
        tags: ["meta", "internal", "technology", "enterprise", "platinum"],
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    customers = [
      {
        id: `${tenantId}_cust01`,
        tenantId,
        name: "YouTube Events Team",
        description: "YouTube's live events streaming platform requiring ultra-low latency content delivery",
        industry: "Media",
        region: "Global",
        category: "internal",
        subcategory: "live_events",
        priority: "critical",
        severity: "high",
        health_status: "yellow",
        status: "active",
        tier: "enterprise",
        contract_value: 5000000,
        satisfaction_score: 8.7,
        value_stream_id: `${tenantId}_vs01`,
        account_manager: "Alex Rodriguez",
        technical_contact: "Live Events SRE Team",
        sla_requirements: {
          latency: "<200ms",
          availability: "99.95%",
          concurrent_viewers: "10M+"
        },
        created_at: now,
        updated_at: now,
        tags: ["youtube", "live-events", "streaming", "global", "enterprise"],
      },
      {
        id: `${tenantId}_cust02`,
        tenantId,
        name: "Enterprise Broadcast Partner",
        description: "Large-scale broadcasting partner requiring reliable transcoding and content distribution",
        industry: "Broadcast",
        region: "APAC",
        category: "external",
        subcategory: "broadcast_partner",
        priority: "high",
        severity: "medium",
        health_status: "green",
        status: "active",
        tier: "gold",
        contract_value: 3200000,
        satisfaction_score: 8.9,
        value_stream_id: `${tenantId}_vs01`,
        account_manager: "Maria Kim",
        technical_contact: "Partner Solutions Team",
        sla_requirements: {
          transcoding_speed: "2x real-time",
          uptime: "99.9%",
          support_response: "30min"
        },
        created_at: now,
        updated_at: now,
        tags: ["broadcast", "partner", "apac", "transcoding", "gold"],
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    customers = [
      {
        id: `${tenantId}_cust01`,
        tenantId,
        name: "Morningstar Finance Division",
        description: "Internal financial reporting and analytics platform serving regulatory and business needs",
        industry: "Financial Services",
        region: "US",
        category: "internal",
        subcategory: "financial_operations",
        priority: "critical",
        severity: "critical",
        health_status: "red",
        status: "active",
        tier: "platinum",
        contract_value: 8000000,
        satisfaction_score: 7.8,
        value_stream_id: `${tenantId}_vs01`,
        account_manager: "David Park",
        technical_contact: "Financial Systems Team",
        sla_requirements: {
          data_freshness: "<15min",
          accuracy: "99.99%",
          availability: "99.99%"
        },
        created_at: now,
        updated_at: now,
        tags: ["morningstar", "finance", "internal", "compliance", "platinum"],
      },
      {
        id: `${tenantId}_cust02`,
        tenantId,
        name: "Global Investment Clients",
        description: "External investment management clients requiring real-time financial data and analytics",
        industry: "Investment Management",
        region: "Global",
        category: "external",
        subcategory: "investment_clients",
        priority: "critical",
        severity: "high",
        health_status: "orange",
        status: "active",
        tier: "enterprise",
        contract_value: 12000000,
        satisfaction_score: 8.5,
        value_stream_id: `${tenantId}_vs01`,
        account_manager: "Jennifer Wu",
        technical_contact: "Client Services Team",
        sla_requirements: {
          data_latency: "<10min",
          uptime: "99.95%",
          support_tier: "24/7 premium"
        },
        created_at: now,
        updated_at: now,
        tags: ["investment", "clients", "global", "real-time", "enterprise"],
      },
    ];
  }

  // Insert customers with proper error handling
  for (const customer of customers) {
    try {
      await db.put("customers", customer);

      // Create COMPLETE audit log entry
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "customer",
        entity_id: customer.id,
        action: "create",
        description: `Customer onboarded: "${customer.name}" (${customer.category}/${customer.subcategory}) - Tier: ${customer.tier}, Value: $${customer.contract_value.toLocaleString()}`,
        timestamp: now,
        user_id: "system",
        tags: ["seed", "customer", "create", customer.category, customer.tier],
        hash: await generateHash({
          entity_type: "customer",
          entity_id: customer.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          category: customer.category,
          subcategory: customer.subcategory,
          priority: customer.priority,
          severity: customer.severity,
          status: customer.status,
          industry: customer.industry,
          region: customer.region,
          tier: customer.tier,
          contract_value: customer.contract_value,
          satisfaction_score: customer.satisfaction_score,
          account_manager: customer.account_manager,
          technical_contact: customer.technical_contact,
          health_status: customer.health_status,
          sla_requirements: customer.sla_requirements
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `Customer "${customer.name}" onboarded - ${customer.tier} tier, $${customer.contract_value.toLocaleString()} contract value`,
        storeName: "customers",
        recordId: customer.id,
        action: "create",
        userId: "system",
        metadata: {
          customer_id: customer.id,
          category: customer.category,
          subcategory: customer.subcategory,
          industry: customer.industry,
          region: customer.region,
          tier: customer.tier,
          contract_value: customer.contract_value,
          account_manager: customer.account_manager,
          customer_details: {
            satisfaction_score: customer.satisfaction_score,
            sla_requirements: customer.sla_requirements,
            value_stream_alignment: customer.value_stream_id
          },
          related_entities: [
            { type: "value_stream", id: customer.value_stream_id }
          ]
        }
      });

      console.log(`✅ Seeded customer: ${customer.id} - ${customer.name}`);
    } catch (error) {
      console.error(`❌ Failed to seed customer ${customer.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${customers.length} customers for ${tenantId}`);
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