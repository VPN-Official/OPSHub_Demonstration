// src/db/seedIndexedDB.ts - ENHANCED with tenant support and missing functions
import { openDB, DBSchema, IDBPDatabase } from "idb";

// Import seeder functions
import { seedIncidents } from "./seeds/seedIncidents";
import { seedProblems } from "./seeds/seedProblems";
import { seedChangeRequests } from "./seeds/seedChangeRequests";
import { seedServiceRequests } from "./seeds/seedServiceRequests";
import { seedMaintenances } from "./seeds/seedMaintenances";
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
import { seedActivities } from "./seeds/seedActivities";
import { seedActivityTimeline } from "./seeds/seedActivityTimeline";
import { seedEndUsers } from "./seeds/seedEndUsers";
import { seedMaintenance } from "./seeds/seedMaintenance";
import { seedOnCall } from "./seeds/seedOnCall";
import { seedPolicy } from "./seeds/seedPolicy";
import { seedSkills } from "./seeds/seedSkills";
import { seedStakeholderComms } from "./seeds/seedStakeholderComms";
import { seedSystemMetrics } from "./seeds/seedSystemMetrics";
import { seedTeams } from "./seeds/seedTeams";
import { seedUsers } from "./seeds/seedUsers";
import { seedWorkItems } from "./seeds/seedWorkItems";
import { seedWorkNotes } from "./seeds/seedWorkNotes";


// ---------------------------------
// 1. DB Schema - Enhanced with proper types
// ---------------------------------
export interface AIOpsDB extends DBSchema {
  // Work family
  incidents: { key: string; value: any; };
  problems: { key: string; value: any; };
  change_requests: { key: string; value: any; };
  service_requests: { key: string; value: any; };
  maintenances: { key: string; value: any; };
  alerts: { key: string; value: any; };

  // MELT family
  metrics: { key: string; value: any; };
  logs: { key: string; value: any; };
  events: { key: string; value: any; };
  traces: { key: string; value: any; };

  // Business family
  value_streams: { key: string; value: any; };
  business_services: { key: string; value: any; };
  service_components: { key: string; value: any; };
  assets: { key: string; value: any; };
  customers: { key: string; value: any; };
  vendors: { key: string; value: any; };
  contracts: { key: string; value: any; };
  cost_centers: { key: string; value: any; };

  // Governance family
  risks: { key: string; value: any; };
  compliance: { key: string; value: any; };
  kpis: { key: string; value: any; };
  knowledge_base: { key: string; value: any; };
  runbooks: { key: string; value: any; };
  automation_rules: { key: string; value: any; };
  ai_agents: { key: string; value: any; };

  // Cross-cutting
  audit_logs: { key: string; value: any; };
  activities: { key: string; value: any; };
  activity_timeline: { key: string; value: any; };
  
  // Infrastructure
  sync_queue: { key: string; value: any; };
  notifications: { key: string; value: any; };
  tenant_configs: { key: string; value: any; };
}

// ---------------------------------
// 2. Init DB - TENANT AWARE
// ---------------------------------
export const initDB = async (tenantId?: string): Promise<IDBPDatabase<AIOpsDB>> => {
  const dbName = tenantId ? `aiops-${tenantId}` : "aiops-db";
  
  return openDB<AIOpsDB>(dbName, 1, {
    upgrade(db) {
      const stores: (keyof AIOpsDB)[] = [
        // Work family
        "incidents",
        "problems", 
        "change_requests",
        "service_requests",
        "maintenances",
        "alerts",
        
        // MELT family
        "metrics",
        "logs",
        "events", 
        "traces",
        
        // Business family
        "value_streams",
        "business_services",
        "service_components",
        "assets",
        "customers",
        "vendors",
        "contracts",
        "cost_centers",
        
        // Governance family
        "risks",
        "compliance",
        "kpis",
        "knowledge_base",
        "runbooks",
        "automation_rules",
        "ai_agents",
        
        // Cross-cutting
        "audit_logs",
        "activities",
        "activity_timeline",
        
        // Infrastructure
        "sync_queue",
        "notifications", 
        "tenant_configs",
      ];
      
      for (const store of stores) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: "id" });
        }
      }
    },
  });
};

// ---------------------------------
// 3. Seed Functions - TENANT AWARE
// ---------------------------------
const DEMO_TENANTS = ["tenant_dcn_meta", "tenant_av_google", "tenant_sd_gates"];

// Main seeding function - supports specific tenant or all tenants
export const seedIndexedDB = async (tenantId?: string, mode: 'minimal' | 'demo' = 'demo') => {
  const tenantsToSeed = tenantId ? [tenantId] : DEMO_TENANTS;
  
  for (const tenant of tenantsToSeed) {
    console.log(`🌱 Seeding tenant: ${tenant} (${mode} mode)`);
    
    const db = await initDB(tenant);
    
    try {
      // Business first (foundation)
      await seedValueStreams(tenant, db);
      await seedBusinessServices(tenant, db);  
      await seedServiceComponents(tenant, db);
      await seedAssets(tenant, db);
      await seedCustomers(tenant, db);
      await seedVendors(tenant, db);
      await seedContracts(tenant, db);
      await seedCostCenters(tenant, db);

      // Governance
      await seedRisks(tenant, db);
      await seedCompliance(tenant, db);
      await seedKpis(tenant, db);
      await seedKnowledgeBase(tenant, db);
      await seedRunbooks(tenant, db);
      await seedAutomationRules(tenant, db);
      await seedAiAgents(tenant, db);

      // Work family
      await seedIncidents(tenant, db);
      await seedProblems(tenant, db);
      await seedChangeRequests(tenant, db);
      await seedServiceRequests(tenant, db);
      await seedMaintenances(tenant, db);
      await seedAlerts(tenant, db);

      // MELT (only in demo mode)
      if (mode === 'demo') {
        await seedMetrics(tenant, db);
        await seedLogs(tenant, db);
        await seedEvents(tenant, db);
        await seedTraces(tenant, db);
      }

      // Cross-cutting
      await seedAuditLogs(tenant, db);
      await seedActivities(tenant, db);
      
      console.log(`✅ Tenant ${tenant} seeded successfully`);
      
    } catch (error) {
      console.error(`❌ Failed to seed tenant ${tenant}:`, error);
      throw error;
    }
  }
  
  console.log(`✅ Seeding completed for ${tenantsToSeed.length} tenant(s)`);
};

// ---------------------------------
// 4. Reset Functions - TENANT AWARE
// ---------------------------------
export const resetDB = async (tenantId?: string) => {
  const tenantsToReset = tenantId ? [tenantId] : DEMO_TENANTS;
  
  for (const tenant of tenantsToReset) {
    console.log(`🧹 Resetting tenant: ${tenant}`);
    
    try {
      const db = await initDB(tenant);
      
      // Clear all stores
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

export const reseedDB = async (tenantId?: string, mode: 'minimal' | 'demo' = 'demo') => {
  console.log(`🔄 Resetting & reseeding ${tenantId ? `tenant ${tenantId}` : 'all tenants'}...`);
  
  await resetDB(tenantId);
  await seedIndexedDB(tenantId, mode);
  
  console.log("✅ Reseed complete.");
};

export const seedAll = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  await seedActivityTimeline(tenantId, db);
  await seedEndUsers(tenantId, db);
  await seedMaintenance(tenantId, db);
  await seedOnCall(tenantId, db);
  await seedPolicy(tenantId, db);
  await seedSkills(tenantId, db);
  await seedStakeholderComms(tenantId, db);
  await seedSystemMetrics(tenantId, db);
  await seedTeams(tenantId, db);
  await seedUsers(tenantId, db);
  await seedWorkItems(tenantId, db);
  await seedWorkNotes(tenantId, db);
};
