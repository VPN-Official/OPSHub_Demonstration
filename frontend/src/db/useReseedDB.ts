import { useState, useCallback } from "react";
import { reseedDB, resetDB, seedIndexedDB } from "../db/seedIndexedDB";

export const useReseedDB = () => {
  const [loading, setLoading] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const handleReset = useCallback(async () => {
    setLoading(true);
    setLastAction("resetting");
    try {
      await resetDB();
      setLastAction("reset complete");
    } catch (err) {
      console.error("❌ Error resetting DB", err);
      setLastAction("reset failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSeed = useCallback(async () => {
    setLoading(true);
    setLastAction("seeding");
    try {
      await seedIndexedDB();
      setLastAction("seed complete");
    } catch (err) {
      console.error("❌ Error seeding DB", err);
      setLastAction("seed failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleReseed = useCallback(async () => {
    setLoading(true);
    setLastAction("reseeding");
    try {
      await reseedDB();
      setLastAction("reseed complete");
    } catch (err) {
      console.error("❌ Error reseeding DB", err);
      setLastAction("reseed failed");
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    lastAction,
    resetDB: handleReset,
    seedDB: handleSeed,
    reseedDB: handleReseed,
  };
};