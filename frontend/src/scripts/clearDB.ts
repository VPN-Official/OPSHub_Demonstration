#!/usr/bin/env ts-node

import { openDB } from "idb";
import { AIOpsDB } from "../seeds/seedIndexedDB";

(async () => {
  try {
    console.log("🧹 Clearing AIOpsDB...");

    const db = await openDB<AIOpsDB>("AIOpsDB", 2);

    // Loop over all object stores and clear them
    const tx = db.transaction(db.objectStoreNames, "readwrite");
    for (const storeName of db.objectStoreNames) {
      console.log(`   - Clearing store: ${storeName}`);
      tx.objectStore(storeName).clear();
    }
    await tx.done;

    console.log("✅ All stores cleared.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to clear DB:", err);
    process.exit(1);
  }
})();