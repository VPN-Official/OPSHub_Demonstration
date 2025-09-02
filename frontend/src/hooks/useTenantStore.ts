import { useEffect, useState } from "react";
import { useTenant } from "../providers/TenantProvider";
import type { AIOpsDB } from "../db/seedIndexedDB";

// All entities must have tenant_id + health_status
export interface TenantEntity {
  id: string;
  tenant_id: string;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  [key: string]: any;
}

export const useTenantStore = <T extends TenantEntity>(
  storeName: keyof AIOpsDB
) => {
  const { db, tenantId } = useTenant();
  const [records, setRecords] = useState<T[]>([]);

  const refresh = async () => {
    if (!db || !tenantId) return;
    const tx = db.transaction(storeName, "readonly");
    const all = await tx.store.getAll();
    setRecords(all.filter((r: any) => r.tenant_id === tenantId));
  };

  const addOrUpdate = async (record: T) => {
    if (!db || !tenantId) return;
    const withTenant = { ...record, tenant_id: tenantId };
    await db.put(storeName, withTenant);
    await refresh();
  };

  const remove = async (id: string) => {
    if (!db) return;
    await db.delete(storeName, id);
    await refresh();
  };

  useEffect(() => {
    refresh();
  }, [db, tenantId]);

  return {
    records,
    refresh,
    addOrUpdate,
    remove,
  };
};