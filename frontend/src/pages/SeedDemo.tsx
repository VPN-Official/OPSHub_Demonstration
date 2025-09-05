// src/pages/SeedDemo.tsx
import React, { useState } from "react";
import { seedAllTenants } from "../db/seeds/seedAllTenants";

export default function SeedDemo() {
  const [status, setStatus] = useState<string>("Idle");

  const handleSeed = async () => {
    try {
      setStatus("Seeding...");
      await seedAllTenants();
      setStatus("✅ Seeding complete");
    } catch (err) {
      console.error("❌ Seeding failed:", err);
      setStatus("❌ Seeding failed — check console");
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>🌱 Demo Data Seeder</h1>
      <p>Status: {status}</p>
      <button onClick={handleSeed}>Seed All Tenants</button>
    </div>
  );
}