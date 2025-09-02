import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------

export type PolicyType =
  | "security"
  | "compliance"
  | "governance"
  | "operations"
  | "financial"
  | "data"
  | "other";

export type PolicyStatus = "draft" | "approved" | "retired";

export interface Policy {
  id: string;
  name: string;                        // "Password Rotation Policy"
  description?: string;
  type: PolicyType;
  status: PolicyStatus;
  created_at: string;
  updated_at: string;

  // Relationships
  business_service_ids: string[];      // FK → BusinessServicesContext
  asset_ids: string[];                 // FK → AssetsContext
  vendor_ids: string[];                // FK → VendorsContext
  contract_ids: string[];              // FK → ContractsContext
  compliance_requirement_ids: string[];// FK → ComplianceContext
  owner_user_id?: string | null;       // FK → UsersContext
  owner_team_id?: string | null;       // FK → TeamsContext

  // Enforcement
  enforcement_mode: "monitor" | "enforce" | "exception_based";
  exception_process?: string;          // how to request exceptions
  related_runbook_ids: string[];       // FK → RunbooksContext
  related_automation_rule_ids: string[]; // FK → AutomationRulesContext

  // Metrics
  compliance_score?: number;           // 0–100%
  violations_count?: number;           // number of detected breaches
  last_reviewed_at?: string | null;
  next_review_due?: string | null;

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

interface PolicyContextType {
  policies: Policy[];
  addPolicy: (policy: Policy) => void;
  updatePolicy: (policy: Policy) => void;
  deletePolicy: (id: string) => void;
  refreshPolicies: () => Promise<void>;
}

const PolicyContext = createContext<PolicyContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------

export const PolicyProvider = ({ children }: { children: ReactNode }) => {
  const [policies, setPolicies] = useState<Policy[]>([]);

  const refreshPolicies = async () => {
    // TODO: Load from IndexedDB + sync with Postgres
  };

  const addPolicy = (policy: Policy) => {
    setPolicies((prev) => [...prev, policy]);
    // TODO: Persist
  };

  const updatePolicy = (policy: Policy) => {
    setPolicies((prev) => prev.map((p) => (p.id === policy.id ? policy : p)));
    // TODO: Persist update
  };

  const deletePolicy = (id: string) => {
    setPolicies((prev) => prev.filter((p) => p.id !== id));
    // TODO: Delete
  };

  useEffect(() => {
    refreshPolicies();
  }, []);

  return (
    <PolicyContext.Provider
      value={{ policies, addPolicy, updatePolicy, deletePolicy, refreshPolicies }}
    >
      {children}
    </PolicyContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------

export const usePolicies = () => {
  const ctx = useContext(PolicyContext);
  if (!ctx) throw new Error("usePolicies must be used within PolicyProvider");
  return ctx;
};

export const usePolicyDetails = (id: string) => {
  const { policies } = usePolicies();
  return policies.find((p) => p.id === id) || null;
};