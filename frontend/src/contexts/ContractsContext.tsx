import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAll, getById } from "../db/dbClient";
import { putWithAudit, removeWithAudit } from "../db/dbClient"
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { loadConfig } from "../config/configLoader";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------

export interface Contract {
  id: string;
  name: string;
  description?: string;
  type: string;   // config.business.contracts.types
  status: string; // config.business.contracts.statuses
  start_date: string;
  end_date?: string | null;
  renewal_date?: string | null;
  created_at: string;
  updated_at: string;

  // Relationships
  customer_id?: string | null;
  business_service_ids: string[];
  vendor_id?: string | null;
  cost_center_id?: string | null;
  owner_user_id?: string | null;

  // SLA/OLA Terms
  uptime_target?: number;
  response_time_target?: number;
  resolution_time_target?: number;
  penalty_per_breach?: number;

  // Financials
  annual_value?: number;
  total_contract_value?: number;
  currency?: string; // config.business.contracts.currencies

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

interface ContractsContextType {
  contracts: Contract[];
  addContract: (contract: Contract, userId?: string) => Promise<void>;
  updateContract: (contract: Contract, userId?: string) => Promise<void>;
  deleteContract: (id: string, userId?: string) => Promise<void>;
  refreshContracts: () => Promise<void>;
  getContract: (id: string) => Promise<Contract | undefined>;

  // NEW: expose config
  config: {
    types: string[];
    statuses: string[];
    currencies: string[];
    sla_defaults: {
      uptime_target?: number;
      response_time_target?: number;
      resolution_time_target?: number;
    };
  };
}

const ContractsContext = createContext<ContractsContextType | undefined>(undefined);

// ---------------------------------
// Provider
// ---------------------------------

export const ContractsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const [contracts, setContracts] = useState<Contract[]>([]);

  const config = loadConfig(tenantId).business.contracts;

  const refreshContracts = async () => {
    const all = await getAll<Contract>(tenantId, "contracts");
    setContracts(all);
  };

  const getContract = async (id: string) => {
    return getById<Contract>(tenantId, "contracts", id);
  };

  const addContract = async (contract: Contract, userId?: string) => {
    // ✅ Validate against config
    if (!config.types.includes(contract.type)) {
      throw new Error(`Invalid contract type: ${contract.type}`);
    }
    if (!config.statuses.includes(contract.status)) {
      throw new Error(`Invalid contract status: ${contract.status}`);
    }
    if (contract.currency && !config.currencies.includes(contract.currency)) {
      throw new Error(`Invalid currency: ${contract.currency}`);
    }

    await putWithAudit(
      tenantId,
      "contracts",
      contract,
      userId,
      { action: "create", description: `Contract "${contract.name}" created` },
      enqueue
    );
    await refreshContracts();
  };

  const updateContract = async (contract: Contract, userId?: string) => {
    await putWithAudit(
      tenantId,
      "contracts",
      contract,
      userId,
      { action: "update", description: `Contract "${contract.name}" updated` },
      enqueue
    );
    await refreshContracts();
  };

  const deleteContract = async (id: string, userId?: string) => {
    await removeWithAudit(
      tenantId,
      "contracts",
      id,
      userId,
      { description: `Contract ${id} deleted` },
      enqueue
    );
    await refreshContracts();
  };

  useEffect(() => {
    refreshContracts();
  }, [tenantId]);

  return (
    <ContractsContext.Provider
      value={{
        contracts,
        addContract,
        updateContract,
        deleteContract,
        refreshContracts,
        getContract,
        config,
      }}
    >
      {children}
    </ContractsContext.Provider>
  );
};

// ---------------------------------
// Hooks
// ---------------------------------

export const useContracts = () => {
  const ctx = useContext(ContractsContext);
  if (!ctx) throw new Error("useContracts must be used within ContractsProvider");
  return ctx;
};

export const useContractDetails = (id: string) => {
  const { contracts } = useContracts();
  return contracts.find((c) => c.id === id) || null;
};