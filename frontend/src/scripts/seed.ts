#!/usr/bin/env ts-node

import { seedAllTenants } from "../db/seeds/seedAllTenants";

(async () => {
  try {
    console.log("🌱 Starting tenant seeding...");
    await seedAllTenants();
    console.log("✅ Seeding complete.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  }
})();