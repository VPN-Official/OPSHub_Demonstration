import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAll, getById } from "../db/dbClient";
import { putWithAudit, removeWithAudit } from "../db/dbClient"
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { loadConfig } from "../config/configLoader";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------
export interface KnowledgeArticle {
  id: string;
  title: string;
  description?: string;
  type: string;   // config-driven
  status: string; // config-driven
  created_at: string;
  updated_at: string;

  // Relationships
  related_incident_ids: string[];
  related_problem_ids: string[];
  related_change_ids: string[];
  related_maintenance_ids: string[];
  compliance_requirement_ids: string[];
  owner_user_id?: string | null;
  owner_team_id?: string | null;

  // Content
  content: string;
  attachments?: {
    id: string;
    name: string;
    url: string;
    type: "document" | "image" | "video" | "other";
  }[];

  // Metrics
  usage_count?: number;
  helpful_votes?: number;
  not_helpful_votes?: number;
  last_used_at?: string | null;

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
interface KnowledgeBaseContextType {
  articles: KnowledgeArticle[];
  addArticle: (article: KnowledgeArticle, userId?: string) => Promise<void>;
  updateArticle: (article: KnowledgeArticle, userId?: string) => Promise<void>;
  deleteArticle: (id: string, userId?: string) => Promise<void>;
  refreshArticles: () => Promise<void>;
  getArticle: (id: string) => Promise<KnowledgeArticle | undefined>;

  // Expose config-driven options for dropdowns/validation
  config: {
    types: string[];
    statuses: string[];
  };
}

const KnowledgeBaseContext = createContext<KnowledgeBaseContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const KnowledgeBaseProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);

  const config = loadConfig(tenantId).knowledge;

  const refreshArticles = async () => {
    const all = await getAll<KnowledgeArticle>(tenantId, "knowledge_base");
    setArticles(all);
  };

  const getArticle = async (id: string) => {
    return getById<KnowledgeArticle>(tenantId, "knowledge_base", id);
  };

  const addArticle = async (article: KnowledgeArticle, userId?: string) => {
    // ✅ Validate against tenant config
    if (!config.types.includes(article.type)) {
      throw new Error(`Invalid knowledge type: ${article.type}`);
    }
    if (!config.statuses.includes(article.status)) {
      throw new Error(`Invalid knowledge status: ${article.status}`);
    }

    await putWithAudit(
      tenantId,
      "knowledge_base",
      article,
      userId,
      { action: "create", description: `Knowledge Article "${article.title}" created` },
      enqueue
    );
    await refreshArticles();
  };

  const updateArticle = async (article: KnowledgeArticle, userId?: string) => {
    await putWithAudit(
      tenantId,
      "knowledge_base",
      article,
      userId,
      { action: "update", description: `Knowledge Article "${article.title}" updated` },
      enqueue
    );
    await refreshArticles();
  };

  const deleteArticle = async (id: string, userId?: string) => {
    await removeWithAudit(
      tenantId,
      "knowledge_base",
      id,
      userId,
      { description: `Knowledge Article ${id} deleted` },
      enqueue
    );
    await refreshArticles();
  };

  useEffect(() => {
    refreshArticles();
  }, [tenantId]);

  return (
    <KnowledgeBaseContext.Provider
      value={{ articles, addArticle, updateArticle, deleteArticle, refreshArticles, getArticle, config }}
    >
      {children}
    </KnowledgeBaseContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------
export const useKnowledgeBase = () => {
  const ctx = useContext(KnowledgeBaseContext);
  if (!ctx) throw new Error("useKnowledgeBase must be used within KnowledgeBaseProvider");
  return ctx;
};

export const useKnowledgeArticleDetails = (id: string) => {
  const { articles } = useKnowledgeBase();
  return articles.find((a) => a.id === id) || null;
};