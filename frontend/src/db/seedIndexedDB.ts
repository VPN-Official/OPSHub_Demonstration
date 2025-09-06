// src/db/seedIndexedDB.ts - FULL PASS, tenant aware, all contexts aligned
import { openDB, DBSchema, IDBPDatabase } from "idb";

// Demo tenants
export const DEMO_TENANTS = [
  "tenant_dcn_meta",
  "tenant_aws_financial", 
  "tenant_ecommerce"
];

// Import seeder functions
import { seedIncidents } from "./seeds/seedIncidents";
import { seedProblems } from "./seeds/seedProblems";
import { seedChangeRequests } from "./seeds/seedChangeRequests";
import { seedServiceRequests } from "./seeds/seedServiceRequests";
import { seedMaintenance } from "./seeds/seedMaintenance"; // ✅ fixed singular
import { seedAlerts } from "./seeds/seedAlerts";

import { seedMetrics } from "./seeds/seedMetrics";
import { seedLogs } from "./seeds/seedLogs";
import { seedEvents } from "./seeds/seedEvents";
import { seedTraces } from "./seeds/seedTraces";

import { seedValueStreams } from "./seeds/seedValueStreams";
import { seedBusinessServices } from "./seeds/seedBusinessServices";
import { seedServiceComponents } from "./seeds/seedServiceComponents";
import { seedAssets } from "./seeds/seedAssets";
import { seedCustomers } from "./seeds/seedCustomers";
import { seedVendors } from "./seeds/seedVendors";
import { seedContracts } from "./seeds/seedContracts";
import { seedCostCenters } from "./seeds/seedCostCenters";

import { seedRisks } from "./seeds/seedRisks";
import { seedCompliance } from "./seeds/seedCompliance";
import { seedKpis } from "./seeds/seedKpis";
import { seedKnowledgeBase } from "./seeds/seedKnowledgeBase";
import { seedRunbooks } from "./seeds/seedRunbooks";
import { seedAutomationRules } from "./seeds/seedAutomationRules";
import { seedAiAgents } from "./seeds/seedAiAgents";

import { seedAuditLogs } from "./seeds/seedAuditLogs";
import { seedActivityTimeline } from "./seeds/seedActivityTimeline";
import { seedEndUsers } from "./seeds/seedEndUsers";
import { seedOnCall } from "./seeds/seedOnCall";
import { seedPolicy } from "./seeds/seedPolicy";
import { seedSkills } from "./seeds/seedSkills";
import { seedStakeholderComms } from "./seeds/seedStakeholderComms";
import { seedSystemMetrics } from "./seeds/seedSystemMetrics";
import { seedTeams } from "./seeds/seedTeams";
import { seedUsers } from "./seeds/seedUsers";
import { seedWorkItems } from "./seeds/seedWorkItems";
import { seedWorkNotes } from "./seeds/seedWorkNotes";

// New context-specific seeders
import { seedRealtimeEvents } from "./seeds/seedRealtimeEvents";
import { seedEntityRelationships } from "./seeds/seedEntityRelationships";
import { seedAIInsights } from "./seeds/seedAIInsights";
import { seedBusinessImpact } from "./seeds/seedBusinessImpact";
import { seedCollaboration } from "./seeds/seedCollaboration";
import { seedMetricsAnalytics } from "./seeds/seedMetricsAnalytics";
import { seedResourceOptimization } from "./seeds/seedResourceOptimization";

// ---------------------------------
// 1. DB Schema - Enhanced with ALL contexts, tenant aware
// ---------------------------------
export interface AIOpsDB extends DBSchema {
  // Work family
  incidents: { key: string; value: any };
  problems: { key: string; value: any };
  change_requests: { key: string; value: any };
  service_requests: { key: string; value: any };
  maintenance: { key: string; value: any };
  alerts: { key: string; value: any };

  // MELT family
  metrics: { key: string; value: any };
  logs: { key: string; value: any };
  events: { key: string; value: any };
  traces: { key: string; value: any };

  // Business family
  value_streams: { key: string; value: any };
  business_services: { key: string; value: any };
  service_components: { key: string; value: any };
  assets: { key: string; value: any };
  customers: { key: string; value: any };
  vendors: { key: string; value: any };
  contracts: { key: string; value: any };
  cost_centers: { key: string; value: any };

  // Governance family
  risks: { key: string; value: any };
  compliance: { key: string; value: any };
  kpis: { key: string; value: any };
  knowledge_base: { key: string; value: any };
  runbooks: { key: string; value: any };
  automation_rules: { key: string; value: any };
  ai_agents: { key: string; value: any };

  // Cross-cutting
  audit_logs: { key: string; value: any };
  activity_timeline: { key: string; value: any };
  end_users: { key: string; value: any };
  on_call: { key: string; value: any };
  policy: { key: string; value: any };
  skills: { key: string; value: any };
  stakeholder_comms: { key: string; value: any };
  system_metrics: { key: string; value: any };
  teams: { key: string; value: any };
  users: { key: string; value: any };
  work_items: { key: string; value: any };
  work_notes: { key: string; value: any };

  // Infrastructure
  sync_queue: { key: string; value: any };
  notifications: { key: string; value: any };
  tenant_configs: { key: string; value: any };

  // New Context-specific stores
  // Realtime & Navigation
  realtimeEvents: { key: string; value: any };
  entityRelationships: { key: string; value: any };
  navigationContexts: { key: string; value: any };
  
  // AI Insights
  aiInsights: { key: string; value: any };
  aiRecommendations: { key: string; value: any };
  aiPredictions: { key: string; value: any };
  aiScores: { key: string; value: any };
  
  // Business Impact
  businessImpacts: { key: string; value: any };
  slaStatuses: { key: string; value: any };
  dependencyMaps: { key: string; value: any };
  costImpacts: { key: string; value: any };
  
  // Collaboration
  activeUsers: { key: string; value: any };
  chatSessions: { key: string; value: any };
  handoffs: { key: string; value: any };
  approvals: { key: string; value: any };
  teamActivity: { key: string; value: any };
  assistanceRequests: { key: string; value: any };
  
  // Metrics Analytics
  kpiMetrics: { key: string; value: any };
  dashboards: { key: string; value: any };
  analyticsReports: { key: string; value: any };
  forecasts: { key: string; value: any };
  anomalies: { key: string; value: any };
  
  // Resource Optimization
  resourcePools: { key: string; value: any };
  resourceAllocations: { key: string; value: any };
  optimizationRecommendations: { key: string; value: any };
  scalingPolicies: { key: string; value: any };
  capacityForecasts: { key: string; value: any };
  costOptimizations: { key: string; value: any };
}

// ---------------------------------
// 2. Init DB - FULL TENANT AWARE
// ---------------------------------
export const initDB = () =>
  openDB<AIOpsDB>("AIOpsDB", 3, {   // ⬅ bumped version to 3 for new context stores
    upgrade(db) {
      const stores = [
        // Original stores
        "incidents", "problems", "change_requests", "service_requests",
        "maintenance", "alerts", "metrics", "logs", "events", "traces",
        "value_streams", "business_services", "service_components", "assets",
        "customers", "vendors", "contracts", "cost_centers",
        "risks", "compliance", "kpis", "knowledge_base", "runbooks",
        "automation_rules", "ai_agents", "audit_logs", "activity_timeline",
        "end_users", "on_call", "policy", "skills", "stakeholder_comms",
        "system_metrics", "teams", "users", "work_items", "work_notes",
        "sync_queue", "notifications", "tenant_configs",
        
        // New context stores
        "realtimeEvents", "entityRelationships", "navigationContexts",
        "aiInsights", "aiRecommendations", "aiPredictions", "aiScores",
        "businessImpacts", "slaStatuses", "dependencyMaps", "costImpacts",
        "activeUsers", "chatSessions", "handoffs", "approvals",
        "teamActivity", "assistanceRequests",
        "kpiMetrics", "dashboards", "analyticsReports", "forecasts", "anomalies",
        "resourcePools", "resourceAllocations", "optimizationRecommendations",
        "scalingPolicies", "capacityForecasts", "costOptimizations"
      ];

      for (const store of stores) {
        if (!db.objectStoreNames.contains(store)) {
          const objectStore = db.createObjectStore(store, { keyPath: "id" });
          
          // Add indices for external system fields on relevant stores
          // Skip system stores that don't need external system tracking
          const systemStores = ['sync_queue', 'notifications', 'audit_logs', 'activity_timeline'];
          if (!systemStores.includes(store)) {
            // Add external system indices
            objectStore.createIndex('source_system', 'source_system', { unique: false });
            objectStore.createIndex('sync_status', 'sync_status', { unique: false });
            objectStore.createIndex('external_id', 'external_id', { unique: false });
            objectStore.createIndex('has_local_changes', 'has_local_changes', { unique: false });
            
            // Add compound index for source system + sync status
            objectStore.createIndex('source_sync', ['source_system', 'sync_status'], { unique: false });
          }
          
          // Add tenant index for all stores
          objectStore.createIndex('tenantId', 'tenantId', { unique: false });
        }
      }
    },
  });

// ---------------------------------
// 3. Seeder Orchestration
// ---------------------------------
export const seedAll = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  await seedIncidents(tenantId, db);
  await seedProblems(tenantId, db);
  await seedChangeRequests(tenantId, db);
  await seedServiceRequests(tenantId, db);
  await seedMaintenance(tenantId, db);
  await seedAlerts(tenantId, db);

  await seedMetrics(tenantId, db);
  await seedLogs(tenantId, db);
  await seedEvents(tenantId, db);
  await seedTraces(tenantId, db);

  await seedValueStreams(tenantId, db);
  await seedBusinessServices(tenantId, db);
  await seedServiceComponents(tenantId, db);
  await seedAssets(tenantId, db);
  await seedCustomers(tenantId, db);
  await seedVendors(tenantId, db);
  await seedContracts(tenantId, db);
  await seedCostCenters(tenantId, db);

  await seedRisks(tenantId, db);
  await seedCompliance(tenantId, db);
  await seedKpis(tenantId, db);
  await seedKnowledgeBase(tenantId, db);
  await seedRunbooks(tenantId, db);
  await seedAutomationRules(tenantId, db);
  await seedAiAgents(tenantId, db);

  await seedAuditLogs(tenantId, db);
  await seedActivityTimeline(tenantId, db);
  await seedEndUsers(tenantId, db);
  await seedOnCall(tenantId, db);
  await seedPolicy(tenantId, db);
  await seedSkills(tenantId, db);
  await seedStakeholderComms(tenantId, db);
  await seedSystemMetrics(tenantId, db);
  await seedTeams(tenantId, db);
  await seedUsers(tenantId, db);
  await seedWorkItems(tenantId, db);
  await seedWorkNotes(tenantId, db);

  // Seed new context-specific data
  await seedRealtimeEvents(tenantId, db);
  await seedEntityRelationships(tenantId, db);
  await seedAIInsights(tenantId, db);
  await seedBusinessImpact(tenantId, db);
  await seedCollaboration(tenantId, db);
  await seedMetricsAnalytics(tenantId, db);
  await seedResourceOptimization(tenantId, db);
};

// ---------------------------------
// 4. Reset / Reseed Helpers
// ---------------------------------
export const resetDB = async (tenantId?: string) => {
  const tenantsToReset = tenantId ? [tenantId] : DEMO_TENANTS;
  const db = await initDB();

  for (const tenant of tenantsToReset) {
    console.log(`🧹 Resetting tenant: ${tenant}`);

    try {

      for (const store of Array.from(db.objectStoreNames)) {
        const tx = db.transaction(store, "readwrite");
        await tx.store.clear();
        await tx.done;
      }

      console.log(`✅ Tenant ${tenant} reset complete`);
    } catch (error) {
      console.error(`❌ Failed to reset tenant ${tenant}:`, error);
      throw error;
    }
  }
};

// Main seeding function
export const seedIndexedDB = async (tenantId?: string, mode: "minimal" | "demo" = "demo") => {
  const db = await initDB();
  const tenantsToSeed = tenantId ? [tenantId] : DEMO_TENANTS;

  console.log(`🌱 Seeding ${tenantsToSeed.length} tenant(s) in ${mode} mode...`);

  for (const tenant of tenantsToSeed) {
    console.log(`📦 Seeding tenant: ${tenant}`);
    
    try {
      if (mode === "minimal") {
        // Minimal seeding - just core entities
        await seedIncidents(tenant, db);
        await seedProblems(tenant, db);
        await seedAlerts(tenant, db);
        await seedBusinessServices(tenant, db);
        await seedAssets(tenant, db);
        await seedTeams(tenant, db);
        await seedUsers(tenant, db);
      } else {
        // Full demo seeding
        await seedAll(tenant, db);
      }
      
      console.log(`✅ Tenant ${tenant} seeded successfully`);
    } catch (error) {
      console.error(`❌ Failed to seed tenant ${tenant}:`, error);
      throw error;
    }
  }

  console.log("🎉 All tenants seeded successfully!");
  return db;
};

export const reseedDB = async (tenantId?: string, mode: "minimal" | "demo" = "demo") => {
  console.log(`🔄 Resetting & reseeding ${tenantId ? `tenant ${tenantId}` : "all tenants"}...`);

  await resetDB(tenantId);
  await seedIndexedDB(tenantId, mode);

  console.log("✅ Reseed complete.");
};