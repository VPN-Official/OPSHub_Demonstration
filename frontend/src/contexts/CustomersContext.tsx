import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAll, getById } from "../db/dbClient";
import { putWithAudit, removeWithAudit } from "../db/dbClient"
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { loadConfig } from "../config/configLoader";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------

export interface Customer {
  id: string;
  name: string;
  description?: string;
  industry?: string; // config.business.customers.industries
  region?: string;   // config.business.customers.regions
  tier: string;      // config.business.customers.tiers
  created_at: string;
  updated_at: string;

  // Relationships
  end_user_ids: string[];
  business_service_ids: string[];
  contract_ids: string[];
  account_manager_user_id?: string;

  // Business & SLA
  sla_level?: string; // config.business.customers.sla_levels
  annual_contract_value?: number;
  penalty_costs_incurred?: number;

  // Risk & Compliance
  risk_score?: number;
  compliance_requirement_ids: string[];

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
}

// ---------------------------------
// Context Interface
// ---------------------------------

interface CustomersContextType {
  customers: Customer[];
  addCustomer: (cust: Customer, userId?: string) => Promise<void>;
  updateCustomer: (cust: Customer, userId?: string) => Promise<void>;
  deleteCustomer: (id: string, userId?: string) => Promise<void>;
  refreshCustomers: () => Promise<void>;
  getCustomer: (id: string) => Promise<Customer | undefined>;

  // NEW: expose config
  config: {
    tiers: string[];
    industries: string[];
    regions: string[];
    sla_levels: string[];
  };
}

const CustomersContext = createContext<CustomersContextType | undefined>(undefined);

// ---------------------------------
// Provider
// ---------------------------------

export const CustomersProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueue } = useSync();
  const [customers, setCustomers] = useState<Customer[]>([]);

  const config = loadConfig(tenantId).business.customers;

  const refreshCustomers = async () => {
    const all = await getAll<Customer>(tenantId, "customers");
    setCustomers(all);
  };

  const getCustomer = async (id: string) => {
    return getById<Customer>(tenantId, "customers", id);
  };

  const addCustomer = async (cust: Customer, userId?: string) => {
    // ✅ Validate against config
    if (!config.tiers.includes(cust.tier)) {
      throw new Error(`Invalid customer tier: ${cust.tier}`);
    }
    if (cust.industry && !config.industries.includes(cust.industry)) {
      throw new Error(`Invalid industry: ${cust.industry}`);
    }
    if (cust.region && !config.regions.includes(cust.region)) {
      throw new Error(`Invalid region: ${cust.region}`);
    }
    if (cust.sla_level && !config.sla_levels.includes(cust.sla_level)) {
      throw new Error(`Invalid SLA level: ${cust.sla_level}`);
    }

    await putWithAudit(
      tenantId,
      "customers",
      cust,
      userId,
      { action: "create", description: `Customer "${cust.name}" created` },
      enqueue
    );
    await refreshCustomers();
  };

  const updateCustomer = async (cust: Customer, userId?: string) => {
    await putWithAudit(
      tenantId,
      "customers",
      cust,
      userId,
      { action: "update", description: `Customer "${cust.name}" updated` },
      enqueue
    );
    await refreshCustomers();
  };

  const deleteCustomer = async (id: string, userId?: string) => {
    await removeWithAudit(
      tenantId,
      "customers",
      id,
      userId,
      { description: `Customer ${id} deleted` },
      enqueue
    );
    await refreshCustomers();
  };

  useEffect(() => {
    refreshCustomers();
  }, [tenantId]);

  return (
    <CustomersContext.Provider
      value={{
        customers,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        refreshCustomers,
        getCustomer,
        config,
      }}
    >
      {children}
    </CustomersContext.Provider>
  );
};

// ---------------------------------
// Hooks
// ---------------------------------

export const useCustomers = () => {
  const ctx = useContext(CustomersContext);
  if (!ctx) throw new Error("useCustomers must be used within CustomersProvider");
  return ctx;
};

export const useCustomerDetails = (id: string) => {
  const { customers } = useCustomers();
  return customers.find((c) => c.id === id) || null;
};