import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAll, getById } from "../db/dbClient";
import { putWithAudit, removeWithAudit } from "../db/dbClient"
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";

// ---------------------------------
// Types
// ---------------------------------
export type RiskCategory =
  | "security"
  | "compliance"
  | "availability"
  | "performance"
  | "vendor"
  | "financial"
  | "other";

export type RiskStatus =
  | "identified"
  | "assessed"
  | "mitigation_planned"
  | "mitigated"
  | "accepted"
  | "rejected"
  | "closed";

export interface Risk {
  id: string;
  title: string;
  description?: string;
  category: RiskCategory;
  status: RiskStatus;
  severity: "low" | "medium" | "high" | "critical";
  likelihood: "rare" | "unlikely" | "possible" | "likely" | "almost_certain";
  impact: "low" | "medium" | "high" | "critical";
  score?: number;
  created_at: string;
  updated_at: string;

  // Relationships
  business_service_ids: string[];
  asset_ids: string[];
  vendor_ids: string[];
  compliance_requirement_ids: string[];
  owner_user_id?: string | null;
  owner_team_id?: string | null;

  // Mitigation
  mitigation_plan?: string;
  mitigation_deadline?: string | null;
  residual_risk?: string;
  accepted_by_user_id?: string | null;
  accepted_at?: string | null;

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
interface RisksContextType {
  risks: Risk[];
  addRisk: (risk: Risk, userId?: string) => Promise<void>;
  updateRisk: (risk: Risk, userId?: string) => Promise<void>;
  deleteRisk: (id: string, userId?: string) => Promise<void>;
  refreshRisks: () => Promise<void>;
  getRisk: (id: string) => Promise<Risk | undefined>;
}

const RisksContext = createContext<RisksContextType | undefined>(undefined);

// ---------------------------------
// Provider
// ---------------------------------
export const RisksProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const [risks, setRisks] = useState<Risk[]>([]);

  const refreshRisks = async () => {
    const all = await getAll<Risk>(tenantId, "risks");
    setRisks(all);
  };

  const getRisk = async (id: string) => {
    return getById<Risk>(tenantId, "risks", id);
  };

  const addRisk = async (risk: Risk, userId?: string) => {
    await putWithAudit(
      tenantId,
      "risks",
      risk,
      userId,
      { action: "create", description: `Risk "${risk.title}" created` },
      enqueue
    );
    await refreshRisks();
  };

  const updateRisk = async (risk: Risk, userId?: string) => {
    await putWithAudit(
      tenantId,
      "risks",
      risk,
      userId,
      { action: "update", description: `Risk "${risk.title}" updated` },
      enqueue
    );
    await refreshRisks();
  };

  const deleteRisk = async (id: string, userId?: string) => {
    await removeWithAudit(
      tenantId,
      "risks",
      id,
      userId,
      { description: `Risk ${id} deleted` },
      enqueue
    );
    await refreshRisks();
  };

  useEffect(() => {
    refreshRisks();
  }, [tenantId]);

  return (
    <RisksContext.Provider
      value={{ risks, addRisk, updateRisk, deleteRisk, refreshRisks, getRisk }}
    >
      {children}
    </RisksContext.Provider>
  );
};

// ---------------------------------
// Hooks
// ---------------------------------
export const useRisks = () => {
  const ctx = useContext(RisksContext);
  if (!ctx) throw new Error("useRisks must be used within RisksProvider");
  return ctx;
};

export const useRiskDetails = (id: string) => {
  const { risks } = useRisks();
  return risks.find((r) => r.id === id) || null;
};
