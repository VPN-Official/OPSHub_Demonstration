import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAll, getById } from "../db/dbClient";
import { putWithAudit, removeWithAudit } from "../db/dbClient"
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { loadConfig } from "../config/configLoader";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------
export interface ComplianceRequirement {
  id: string;
  name: string;
  description?: string;
  type: string;   // must match config.compliance.types
  status: string; // must match config.compliance.statuses
  created_at: string;
  updated_at: string;

  // Relationships
  business_service_ids: string[];
  asset_ids: string[];
  vendor_ids: string[];
  contract_ids: string[];
  risk_ids: string[];
  owner_user_id?: string | null;
  owner_team_id?: string | null;

  // Evidence & Verification
  control_ids: string[];
  last_audited_at?: string | null;
  next_audit_due?: string | null;
  verified_by_user_id?: string | null;
  verified_at?: string | null;
  compliance_score?: number;

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------
interface ComplianceContextType {
  requirements: ComplianceRequirement[];
  addRequirement: (req: ComplianceRequirement, userId?: string) => Promise<void>;
  updateRequirement: (req: ComplianceRequirement, userId?: string) => Promise<void>;
  deleteRequirement: (id: string, userId?: string) => Promise<void>;
  refreshRequirements: () => Promise<void>;
  getRequirement: (id: string) => Promise<ComplianceRequirement | undefined>;

  // NEW: expose config for UI dropdowns
  config: {
    types: string[];
    statuses: string[];
  };
}

const ComplianceContext = createContext<ComplianceContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const ComplianceProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueue } = useSync();
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([]);

  const config = loadConfig(tenantId).compliance;

  const refreshRequirements = async () => {
    const all = await getAll<ComplianceRequirement>(tenantId, "compliance");
    setRequirements(all);
  };

  const getRequirement = async (id: string) => {
    return getById<ComplianceRequirement>(tenantId, "compliance", id);
  };

  const addRequirement = async (req: ComplianceRequirement, userId?: string) => {
    // ✅ Validate against tenant config
    if (!config.types.includes(req.type)) {
      throw new Error(`Invalid compliance type: ${req.type}`);
    }
    if (!config.statuses.includes(req.status)) {
      throw new Error(`Invalid compliance status: ${req.status}`);
    }

    await putWithAudit(
      tenantId,
      "compliance",
      req,
      userId,
      { action: "create", description: `Compliance Requirement "${req.name}" created` },
      enqueue
    );
    await refreshRequirements();
  };

  const updateRequirement = async (req: ComplianceRequirement, userId?: string) => {
    await putWithAudit(
      tenantId,
      "compliance",
      req,
      userId,
      { action: "update", description: `Compliance Requirement "${req.name}" updated` },
      enqueue
    );
    await refreshRequirements();
  };

  const deleteRequirement = async (id: string, userId?: string) => {
    await removeWithAudit(
      tenantId,
      "compliance",
      id,
      userId,
      { description: `Compliance Requirement ${id} deleted` },
      enqueue
    );
    await refreshRequirements();
  };

  useEffect(() => {
    refreshRequirements();
  }, [tenantId]);

  return (
    <ComplianceContext.Provider
      value={{
        requirements,
        addRequirement,
        updateRequirement,
        deleteRequirement,
        refreshRequirements,
        getRequirement,
        config,
      }}
    >
      {children}
    </ComplianceContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------
export const useComplianceRequirements = () => {
  const ctx = useContext(ComplianceContext);
  if (!ctx) throw new Error("useComplianceRequirements must be used within ComplianceProvider");
  return ctx;
};

export const useComplianceRequirementDetails = (id: string) => {
  const { requirements } = useComplianceRequirements();
  return requirements.find((r) => r.id === id) || null;
};