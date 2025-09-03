// src/db/seedIndexedDB.ts - FULL PASS, tenant aware, all contexts aligned
import { openDB, DBSchema, IDBPDatabase } from "idb";

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
}

// ---------------------------------
// 2. Init DB - FULL TENANT AWARE
// ---------------------------------
export const initDB = () =>
  openDB<AIOpsDB>("AIOpsDB", 2, {   // ⬅ bumped version to 2 to force upgrade
    upgrade(db) {
      const stores = [
        "incidents", "problems", "change_requests", "service_requests",
        "maintenance", "alerts", "metrics", "logs", "events", "traces",
        "value_streams", "business_services", "service_components", "assets",
        "customers", "vendors", "contracts", "cost_centers",
        "risks", "compliance", "kpis", "knowledge_base", "runbooks",
        "automation_rules", "ai_agents", "audit_logs", "activity_timeline",
        "end_users", "on_call", "policy", "skills", "stakeholder_comms",
        "system_metrics", "teams", "users", "work_items", "work_notes",
        "sync_queue", "notifications", "tenant_configs"
      ];

      for (const store of stores) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: "id" });
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
};

// ---------------------------------
// 4. Reset / Reseed Helpers
// ---------------------------------
export const resetDB = async (tenantId?: string) => {
  const tenantsToReset = tenantId ? [tenantId] : DEMO_TENANTS;

  for (const tenant of tenantsToReset) {
    console.log(`🧹 Resetting tenant: ${tenant}`);

    try {
      const db = await initDB(tenant);

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

export const reseedDB = async (tenantId?: string, mode: "minimal" | "demo" = "demo") => {
  console.log(`🔄 Resetting & reseeding ${tenantId ? `tenant ${tenantId}` : "all tenants"}...`);

  await resetDB(tenantId);
  await seedIndexedDB(tenantId, mode);

  console.log("✅ Reseed complete.");
};