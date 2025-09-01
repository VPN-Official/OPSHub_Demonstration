// utils/db.js - Enhanced with seeding protection
import Dexie from "dexie";

export const db = new Dexie("OpsHubDB");

// Add seeding state tracking
let seedingInProgress = false;
let seedingCompleted = false;

db.version(1).stores({
  workItems: "id",
  automations: "id",
  knowledge: "id",
  agents: "id",
  nudges: "id",
  costs: "id",
  businessServices: "id",
  roster: "id",
  schedule: "id",
  syncQueue: "++id",
  failedSync: "++id",
  auth: "id",
  notifications: "id,timestamp",
  systemState: "key", // Track seeding state
});

export async function getAll(store) {
  return db[store].toArray();
}

export async function setItem(store, value) {
  return db[store].put(value);
}

export async function delItem(store, key) {
  return db[store].delete(key);
}

export async function clearStore(store) {
  return db[store].clear();
}

export async function bulkSet(store, values) {
  return db[store].bulkPut(values);
}

// Enhanced seeding protection
export async function seedAll(data) {
  // Prevent multiple simultaneous seeding attempts
  if (seedingInProgress) {
    console.log("⏳ Seeding already in progress, waiting...");
    // Wait for seeding to complete
    while (seedingInProgress) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return;
  }

  // Check if already seeded
  try {
    const seedState = await db.systemState.get("seeded");
    if (seedState?.value && seedingCompleted) {
      console.log("✅ Database already seeded, skipping");
      return;
    }
  } catch (error) {
    console.log("Seed state check failed, proceeding with seeding");
  }

  seedingInProgress = true;
  
  try {
    console.log("🌱 Starting database seeding...");
    
    // Seed all data stores
    if (data.workItems && data.workItems.length > 0) {
      await bulkSet("workItems", data.workItems);
      console.log(`✅ Seeded ${data.workItems.length} work items`);
    }
    if (data.automations && data.automations.length > 0) {
      await bulkSet("automations", data.automations);
      console.log(`✅ Seeded ${data.automations.length} automations`);
    }
    if (data.knowledge && data.knowledge.length > 0) {
      await bulkSet("knowledge", data.knowledge);
      console.log(`✅ Seeded ${data.knowledge.length} knowledge articles`);
    }
    if (data.agents && data.agents.length > 0) {
      await bulkSet("agents", data.agents);
      console.log(`✅ Seeded ${data.agents.length} agents`);
    }
    if (data.nudges && data.nudges.length > 0) {
      await bulkSet("nudges", data.nudges);
      console.log(`✅ Seeded ${data.nudges.length} nudges`);
    }
    if (data.businessServices && data.businessServices.length > 0) {
      await bulkSet("businessServices", data.businessServices);
      console.log(`✅ Seeded ${data.businessServices.length} business services`);
    }
    if (data.costs && data.costs.length > 0) {
      await bulkSet("costs", data.costs);
      console.log(`✅ Seeded ${data.costs.length} cost records`);
    }
    if (data.roster && data.roster.length > 0) {
      await bulkSet("roster", data.roster);
      console.log(`✅ Seeded ${data.roster.length} roster entries`);
    }
    if (data.schedule && data.schedule.length > 0) {
      await bulkSet("schedule", data.schedule);
      console.log(`✅ Seeded ${data.schedule.length} schedule items`);
    }
    if (data.syncQueue && data.syncQueue.length > 0) {
      await bulkSet("syncQueue", data.syncQueue);
      console.log(`✅ Seeded ${data.syncQueue.length} sync queue items`);
    }
    if (data.auth && data.auth.length > 0) {
      await bulkSet("auth", data.auth);
      console.log(`✅ Seeded ${data.auth.length} auth records`);
    }

    // Mark seeding as completed
    await db.systemState.put({ key: "seeded", value: true, timestamp: Date.now() });
    seedingCompleted = true;
    
    if (typeof window !== "undefined") {
      window.db = db;
    }
    
    console.log("✅ All seed data loaded successfully");
  } catch (err) {
    console.error("❌ Error seeding DB:", err);
    throw err;
  } finally {
    seedingInProgress = false;
  }
}

// Helper to check if database is seeded
export async function isSeeded() {
  try {
    const seedState = await db.systemState.get("seeded");
    return !!seedState?.value;
  } catch (error) {
    return false;
  }
}

// Helper to reset seeding state (for development/testing)
export async function resetSeedState() {
  await db.systemState.delete("seeded");
  seedingCompleted = false;
  console.log("🔄 Seed state reset");
}