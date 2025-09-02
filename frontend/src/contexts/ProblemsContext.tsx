import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  getAll,
  getById as dbGetById,
  putWithAudit,
  removeWithAudit,
} from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { loadConfig } from "../config/configLoader";
import { useEndUsers } from "./EndUsersContext";
import { useIncidents } from "./IncidentsContext";
import { useBusinessServices } from "./BusinessServicesContext";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------
export interface LinkedRecommendation {
  reference_id: string;
  type: "runbook" | "knowledge" | "automation" | "ai_agent";
  confidence: number;
  recommendation: string;
  status: "suggested" | "accepted" | "rejected" | "executed";
  suggested_at: string;
  acted_at?: string | null;
  acted_by_user_id?: string | null;
}

export interface Problem {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  impact: string;
  urgency: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  closed_at?: string | null;

  business_service_id?: string | null;
  incident_ids?: string[];

  reported_by?: string; // userId

  recommendations?: LinkedRecommendation[];

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
}

export interface ProblemDetails extends Problem {
  reporter?: any;
  business_service?: any;
  incidents?: any[];
}

interface ProblemsContextType {
  problems: Problem[];
  refresh: () => Promise<void>;
  addProblem: (problem: Problem) => Promise<void>;
  updateProblem: (problem: Problem) => Promise<void>;
  deleteProblem: (id: string) => Promise<void>;
  getProblemById: (id: string) => Promise<Problem | undefined>;
}

const ProblemsContext = createContext<ProblemsContextType | undefined>(
  undefined
);

// ---------------------------------
// 2. Provider
// ---------------------------------
export const ProblemsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueue } = useSync();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    if (tenantId) {
      loadConfig(tenantId).then(setConfig);
      refresh();
    }
  }, [tenantId]);

  const refresh = async () => {
    if (!tenantId) return;
    const data = await getAll<Problem>("problems", tenantId);
    setProblems(data);
  };

  const validateProblem = (problem: Problem) => {
    if (!config) return;

    if (!config.statuses.includes(problem.status)) {
      throw new Error(`Invalid status: ${problem.status}`);
    }
    if (!config.priorities.includes(problem.priority)) {
      throw new Error(`Invalid priority: ${problem.priority}`);
    }
    if (!config.impacts.includes(problem.impact)) {
      throw new Error(`Invalid impact: ${problem.impact}`);
    }
    if (!config.urgencies.includes(problem.urgency)) {
      throw new Error(`Invalid urgency: ${problem.urgency}`);
    }
  };

  const ensureMetadata = (problem: Problem): Problem => {
    return {
      ...problem,
      tags: problem.tags ?? [],
      health_status: problem.health_status ?? "gray",
      sync_status: problem.sync_status ?? "dirty",
      synced_at: problem.synced_at ?? new Date().toISOString(),
    };
  };

  const addProblem = async (problem: Problem) => {
    validateProblem(problem);
    const enriched = ensureMetadata({
      ...problem,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await putWithAudit("problems", enriched, tenantId, {
      action: "create",
      description: `Created problem ${problem.title}`,
    });
    enqueue("problems", enriched);
    await refresh();
  };

  const updateProblem = async (problem: Problem) => {
    validateProblem(problem);
    const enriched = ensureMetadata({
      ...problem,
      updated_at: new Date().toISOString(),
    });
    await putWithAudit("problems", enriched, tenantId, {
      action: "update",
      description: `Updated problem ${problem.id}`,
    });
    enqueue("problems", enriched);
    await refresh();
  };

  const deleteProblem = async (id: string) => {
    await removeWithAudit("problems", id, tenantId, {
      action: "delete",
      description: `Deleted problem ${id}`,
    });
    enqueue("problems", { id, deleted: true });
    await refresh();
  };

  const getProblemById = async (id: string) => {
    return dbGetById<Problem>("problems", id, tenantId);
  };

  return (
    <ProblemsContext.Provider
      value={{ problems, refresh, addProblem, updateProblem, deleteProblem, getProblemById }}
    >
      {children}
    </ProblemsContext.Provider>
  );
};

// ---------------------------------
// 3. Hooks
// ---------------------------------
export const useProblems = (): ProblemsContextType => {
  const ctx = useContext(ProblemsContext);
  if (!ctx) {
    throw new Error("useProblems must be used within a ProblemsProvider");
  }
  return ctx;
};

export const useProblemDetails = (id: string): ProblemDetails | undefined => {
  const { problems } = useProblems();
  const { endUsers } = useEndUsers();
  const { incidents } = useIncidents();
  const { businessServices } = useBusinessServices();

  const problem = problems.find((p) => p.id === id);
  if (!problem) return undefined;

  const reporter = problem.reported_by
    ? endUsers.find((u) => u.id === problem.reported_by)
    : undefined;

  const relatedIncidents = problem.incident_ids
    ? incidents.filter((i) => problem.incident_ids?.includes(i.id))
    : [];

  const business_service = problem.business_service_id
    ? businessServices.find((b) => b.id === problem.business_service_id)
    : undefined;

  return {
    ...problem,
    reporter,
    incidents: relatedIncidents,
    business_service,
  };
};