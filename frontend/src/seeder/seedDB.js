import { seedAll } from "../utils/db.js";
import seedData from "../config/seedData.json";

export async function seedDB() {
  try {
    await seedAll(seedData);
    console.log("✅ Seed data loaded into IndexedDB (from config)");
  } catch (err) {
    console.error("❌ Failed to seed DB:", err);
  }
}