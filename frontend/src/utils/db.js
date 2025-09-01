import Dexie from "dexie";

// ✅ Initialize IndexedDB
export const db = new Dexie("OpsHubDB");

// ✅ Schema definition (with auth store added)
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
  syncQueue: "++id", // auto-increment
  auth: "id",
  notifications: "id,timestamp", // ✅ added table for NotificationsContext
});

// -------------------------------
// ✅ Helper functions
// -------------------------------
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

// -------------------------------
// ✅ Unified seeding function
// -------------------------------
export async function seedAll(data) {
  try {
    if (data.workItems) {
      await bulkSet("workItems", data.workItems);
    }
    if (data.automations) {
      await bulkSet("automations", data.automations);
    }
    if (data.knowledge) {
      await bulkSet("knowledge", data.knowledge);
    }
    if (data.agents) {
      await bulkSet("agents", data.agents);
    }
    if (data.nudges) {
      await bulkSet("nudges", data.nudges);
    }
    if (data.businessServices) {
      await bulkSet("businessServices", data.businessServices);
    }
    if (data.costs) {
      await bulkSet("costs", data.costs);
    }
    if (data.roster) {
      await bulkSet("roster", data.roster);
    }
    if (data.schedule) {
      await bulkSet("schedule", data.schedule);
    }
    if (data.syncQueue) {
      await bulkSet("syncQueue", data.syncQueue);
    }
    if (data.auth) {
      await bulkSet("auth", data.auth);
    }
  if (typeof window !== "undefined") {
    window.db = db;
  }
    console.log("✅ All seed data loaded successfully");
  } catch (err) {
    console.error("❌ Error seeding DB:", err);
  }
}