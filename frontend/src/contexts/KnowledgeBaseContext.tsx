// src/contexts/KnowledgeBaseContext.tsx (REFACTORED - ENTERPRISE FRONTEND)
import React, { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  ReactNode, 
  useCallback,
  useMemo,
  useRef
} from "react";
import { 
  getAll, 
  getById, 
  putWithAudit, 
  removeWithAudit 
} from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";

// ---------------------------------
// 1. UI State Management Types
// ---------------------------------
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetch: string | null;
  stale: boolean;
}

export interface CacheConfig {
  ttl: number; // milliseconds
  maxSize: number;
}

export interface OptimisticUpdate<T> {
  id: string;
  operation: 'create' | 'update' | 'delete';
  originalData?: T;
  optimisticData: T | null;
  timestamp: number;
}

// ---------------------------------
// 2. Core Entity Types (UI-focused)
// ---------------------------------
export interface KnowledgeAttachment {
  id: string;
  name: string;
  url: string;
  type: "document" | "image" | "video" | "audio" | "other";
  size_bytes?: number;
  mime_type?: string;
  uploaded_by?: string;
  uploaded_at?: string;
}

export interface KnowledgeVersion {
  version: number;
  content: string;
  author_user_id: string;
  created_at: string;
  change_summary?: string;
  word_count?: number;
}

export interface KnowledgeReview {
  reviewer_user_id: string;
  reviewed_at: string;
  status: "approved" | "rejected" | "needs_revision";
  comments?: string;
  next_review_date?: string;
}

export interface KnowledgeMetrics {
  view_count: number;
  helpful_votes: number;
  not_helpful_votes: number;
  search_hits: number;
  last_accessed_at?: string;
  average_rating?: number;
  effectiveness_score?: number;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  created_at: string;
  updated_at: string;

  // Content Management
  content: string;
  content_format?: "markdown" | "html" | "plain_text";
  summary?: string;
  keywords: string[];
  version: number;
  version_history: KnowledgeVersion[];
  
  // Attachments & Media
  attachments: KnowledgeAttachment[];
  featured_image?: string;
  
  // Relationships
  related_incident_ids: string[];
  related_problem_ids: string[];
  related_change_ids: string[];
  related_maintenance_ids: string[];
  related_article_ids: string[];
  compliance_requirement_ids: string[];
  
  // Ownership & Governance
  owner_user_id?: string | null;
  owner_team_id?: string | null;
  author_user_ids: string[];
  
  // Categorization & Access
  category?: string;
  subcategory?: string;
  audience?: "internal" | "external" | "customer" | "partner";
  access_level?: "public" | "internal" | "restricted";
  language?: string;
  
  // Workflow & Review
  workflow_status?: "draft" | "review" | "approved" | "published" | "archived";
  review_required?: boolean;
  review_frequency_days?: number;
  last_reviewed_at?: string;
  next_review_date?: string;
  reviews: KnowledgeReview[];
  
  // Usage Analytics
  metrics: KnowledgeMetrics;
  feedback: Array<{
    user_id?: string;
    rating: number;
    comments?: string;
    submitted_at: string;
    helpful: boolean;
  }>;
  
  // SEO & Discovery
  slug?: string;
  meta_title?: string;
  meta_description?: string;
  search_terms?: string[];
  
  // Expiration & Lifecycle
  expiry_date?: string;
  auto_archive?: boolean;
  archived_at?: string;
  archived_reason?: string;

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
  tenantId?: string;
}

// ---------------------------------
// 3. UI Filter & Search Types
// ---------------------------------
export interface KnowledgeFilters {
  type?: string;
  status?: string;
  category?: string;
  audience?: string;
  workflow_status?: string;
  tags?: string[];
  author_ids?: string[];
  needs_review?: boolean;
  published_only?: boolean;
}

export interface KnowledgeSort {
  field: 'title' | 'updated_at' | 'view_count' | 'rating' | 'created_at';
  direction: 'asc' | 'desc';
}

// ---------------------------------
// 4. API Response Types
// ---------------------------------
export interface KnowledgeStatsResponse {
  totalArticles: number;
  publishedArticles: number;
  articlesNeedingReview: number;
  totalViews: number;
  averageRating: number;
  articlesByType: Record<string, number>;
  articlesByCategory: Record<string, number>;
  topAuthors: Array<{ authorId: string; articleCount: number }>;
}

export interface EngagementDataResponse {
  date: string;
  views: number;
  ratings: number;
  helpfulVotes: number;
}

// ---------------------------------
// 5. Context Interface (Frontend-focused)
// ---------------------------------
interface KnowledgeBaseContextType {
  // Core async state
  articlesState: AsyncState<KnowledgeArticle[]>;
  
  // Optimistic updates
  optimisticUpdates: OptimisticUpdate<KnowledgeArticle>[];
  
  // API Operations (thin wrappers)
  createArticle: (article: Omit<KnowledgeArticle, 'id' | 'created_at' | 'updated_at'>, userId?: string) => Promise<void>;
  updateArticle: (id: string, updates: Partial<KnowledgeArticle>, userId?: string) => Promise<void>;
  deleteArticle: (id: string, userId?: string) => Promise<void>;
  
  // Article Operations (API calls)
  publishArticle: (articleId: string, userId?: string) => Promise<void>;
  archiveArticle: (articleId: string, reason: string, userId?: string) => Promise<void>;
  reviewArticle: (articleId: string, review: KnowledgeReview) => Promise<void>;
  addVersion: (articleId: string, content: string, changeSummary: string, userId: string) => Promise<void>;
  recordView: (articleId: string, userId?: string) => Promise<void>;
  rateArticle: (articleId: string, rating: number, comments?: string, userId?: string) => Promise<void>;
  
  // Attachment Operations (API calls)
  addAttachment: (articleId: string, attachment: Omit<KnowledgeAttachment, 'id' | 'uploaded_at'>, userId?: string) => Promise<void>;
  removeAttachment: (articleId: string, attachmentId: string, userId?: string) => Promise<void>;
  
  // Data Operations
  refreshArticles: (force?: boolean) => Promise<void>;
  getArticle: (id: string) => Promise<KnowledgeArticle | null>;
  
  // Client-side UI helpers (no business logic)
  getFilteredArticles: (filters: KnowledgeFilters) => KnowledgeArticle[];
  getSortedArticles: (articles: KnowledgeArticle[], sort: KnowledgeSort) => KnowledgeArticle[];
  searchArticles: (query: string, fields?: string[]) => KnowledgeArticle[];
  
  // Quick accessors for UI
  publishedArticles: KnowledgeArticle[];
  draftArticles: KnowledgeArticle[];
  articlesNeedingReview: KnowledgeArticle[];
  
  // Analytics (from API)
  getStats: () => Promise<KnowledgeStatsResponse>;
  getEngagement: (timeframe?: "week" | "month" | "quarter") => Promise<EngagementDataResponse[]>;
  
  // Configuration from backend
  config: {
    types: string[];
    statuses: string[];
    categories: string[];
    audiences: string[];
    access_levels: string[];
    content_formats: string[];
    languages: string[];
  };
}

const KnowledgeBaseContext = createContext<KnowledgeBaseContextType | undefined>(undefined);

// ---------------------------------
// 6. Provider Implementation
// ---------------------------------
export const KnowledgeBaseProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig, validateEnum } = useConfig();
  
  // Core async state
  const [articlesState, setArticlesState] = useState<AsyncState<KnowledgeArticle[]>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    stale: true,
  });
  
  // Optimistic updates tracking
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdate<KnowledgeArticle>[]>([]);
  
  // Cache management
  const cacheRef = useRef<Map<string, { data: KnowledgeArticle; timestamp: number }>>(new Map());
  const cacheConfig: CacheConfig = { ttl: 5 * 60 * 1000, maxSize: 1000 }; // 5 minutes TTL
  
  // Extract configuration
  const config = useMemo(() => ({
    types: globalConfig?.knowledge?.types || 
           ['faq', 'troubleshooting', 'how_to', 'reference', 'policy', 'training'],
    statuses: globalConfig?.statuses?.knowledge || 
              ['draft', 'review', 'approved', 'published', 'archived', 'expired'],
    categories: globalConfig?.knowledge?.categories || 
                ['technical', 'business', 'process', 'policy', 'training', 'faq'],
    audiences: ['internal', 'external', 'customer', 'partner'],
    access_levels: ['public', 'internal', 'restricted'],
    content_formats: ['markdown', 'html', 'plain_text'],
    languages: globalConfig?.knowledge?.languages || ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh'],
  }), [globalConfig]);
  
  // Basic UI validation only
  const validateForUI = useCallback((article: Partial<KnowledgeArticle>) => {
    const errors: string[] = [];
    
    if (!article.title || article.title.trim().length < 3) {
      errors.push("Title must be at least 3 characters");
    }
    
    if (!article.content || article.content.trim().length < 10) {
      errors.push("Content must be at least 10 characters");
    }
    
    if (article.type && !config.types.includes(article.type)) {
      errors.push(`Invalid type: ${article.type}`);
    }
    
    return errors;
  }, [config]);
  
  // Cache management utilities
  const getCachedArticle = useCallback((id: string): KnowledgeArticle | null => {
    const cached = cacheRef.current.get(id);
    if (cached && Date.now() - cached.timestamp < cacheConfig.ttl) {
      return cached.data;
    }
    return null;
  }, [cacheConfig.ttl]);
  
  const setCachedArticle = useCallback((article: KnowledgeArticle) => {
    const cache = cacheRef.current;
    
    // Evict old entries if cache is full
    if (cache.size >= cacheConfig.maxSize) {
      const oldestKey = Array.from(cache.keys())[0];
      cache.delete(oldestKey);
    }
    
    cache.set(article.id, {
      data: article,
      timestamp: Date.now()
    });
  }, [cacheConfig.maxSize]);
  
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);
  
  // Optimistic update helpers
  const addOptimisticUpdate = useCallback(<T,>(update: OptimisticUpdate<T>) => {
    setOptimisticUpdates(prev => [...prev, update as OptimisticUpdate<KnowledgeArticle>]);
  }, []);
  
  const removeOptimisticUpdate = useCallback((id: string) => {
    setOptimisticUpdates(prev => prev.filter(u => u.id !== id));
  }, []);
  
  const rollbackOptimisticUpdate = useCallback((id: string) => {
    const update = optimisticUpdates.find(u => u.id === id);
    if (update && update.originalData && articlesState.data) {
      setArticlesState(prev => ({
        ...prev,
        data: prev.data?.map(article => 
          article.id === id ? update.originalData! : article
        ) || null
      }));
    }
    removeOptimisticUpdate(id);
  }, [optimisticUpdates, articlesState.data, removeOptimisticUpdate]);
  
  // Apply optimistic updates to data
  const articlesWithOptimisticUpdates = useMemo(() => {
    if (!articlesState.data) return [];
    
    let articles = [...articlesState.data];
    
    optimisticUpdates.forEach(update => {
      switch (update.operation) {
        case 'create':
          if (update.optimisticData && !articles.find(a => a.id === update.id)) {
            articles.unshift(update.optimisticData);
          }
          break;
        case 'update':
          if (update.optimisticData) {
            articles = articles.map(a => a.id === update.id ? update.optimisticData! : a);
          }
          break;
        case 'delete':
          articles = articles.filter(a => a.id !== update.id);
          break;
      }
    });
    
    return articles;
  }, [articlesState.data, optimisticUpdates]);
  
  // API Operations
  const refreshArticles = useCallback(async (force = false) => {
    if (!tenantId) return;
    
    // Check if we need to fetch
    const now = Date.now();
    const lastFetch = articlesState.lastFetch ? new Date(articlesState.lastFetch).getTime() : 0;
    const isStale = now - lastFetch > cacheConfig.ttl;
    
    if (!force && !articlesState.stale && !isStale && articlesState.data) {
      return;
    }
    
    setArticlesState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const articles = await getAll<KnowledgeArticle>(tenantId, "knowledge_base");
      
      // Sort for UI performance (published first, then by popularity)
      articles.sort((a, b) => {
        if (a.workflow_status === 'published' && b.workflow_status !== 'published') return -1;
        if (b.workflow_status === 'published' && a.workflow_status !== 'published') return 1;
        
        const aViews = a.metrics.view_count || 0;
        const bViews = b.metrics.view_count || 0;
        if (aViews !== bViews) return bViews - aViews;
        
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
      
      // Update cache
      articles.forEach(article => setCachedArticle(article));
      
      setArticlesState({
        data: articles,
        loading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        stale: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch articles';
      setArticlesState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
        stale: true,
      }));
    }
  }, [tenantId, articlesState.lastFetch, articlesState.stale, articlesState.data, cacheConfig.ttl, setCachedArticle]);
  
  const getArticle = useCallback(async (id: string): Promise<KnowledgeArticle | null> => {
    if (!tenantId) return null;
    
    // Check cache first
    const cached = getCachedArticle(id);
    if (cached) return cached;
    
    try {
      const article = await getById<KnowledgeArticle>(tenantId, "knowledge_base", id);
      if (article) {
        setCachedArticle(article);
      }
      return article || null;
    } catch (error) {
      console.error(`Failed to get article ${id}:`, error);
      return null;
    }
  }, [tenantId, getCachedArticle, setCachedArticle]);
  
  const createArticle = useCallback(async (articleData: Omit<KnowledgeArticle, 'id' | 'created_at' | 'updated_at'>, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    // Basic UI validation
    const validationErrors = validateForUI(articleData);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(', '));
    }
    
    const tempId = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const optimisticArticle: KnowledgeArticle = {
      ...articleData,
      id: tempId,
      created_at: now,
      updated_at: now,
      tenantId,
      tags: articleData.tags || [],
      health_status: "gray",
      sync_status: "dirty",
      keywords: articleData.keywords || [],
      version: 1,
      version_history: [],
      attachments: articleData.attachments || [],
      reviews: [],
      feedback: [],
      metrics: {
        view_count: 0,
        helpful_votes: 0,
        not_helpful_votes: 0,
        search_hits: 0,
      },
      related_incident_ids: [],
      related_problem_ids: [],
      related_change_ids: [],
      related_maintenance_ids: [],
      related_article_ids: [],
      compliance_requirement_ids: [],
      author_user_ids: userId ? [userId] : [],
    };
    
    // Add optimistic update
    addOptimisticUpdate({
      id: tempId,
      operation: 'create',
      optimisticData: optimisticArticle,
      timestamp: Date.now(),
    });
    
    try {
      // Call backend API (handles all business logic)
      await putWithAudit(
        tenantId,
        "knowledge_base",
        optimisticArticle,
        userId,
        {
          action: "create",
          description: `Created knowledge article: ${articleData.title}`,
          tags: ["knowledge", "create", articleData.type],
        }
      );
      
      // Enqueue for sync
      await enqueueItem({
        storeName: "knowledge_base",
        entityId: optimisticArticle.id,
        action: "create",
        payload: optimisticArticle,
        priority: 'normal',
      });
      
      // Remove optimistic update and refresh
      removeOptimisticUpdate(tempId);
      await refreshArticles(true);
    } catch (error) {
      // Rollback optimistic update
      rollbackOptimisticUpdate(tempId);
      throw error;
    }
  }, [tenantId, validateForUI, addOptimisticUpdate, enqueueItem, removeOptimisticUpdate, refreshArticles, rollbackOptimisticUpdate]);
  
  const updateArticle = useCallback(async (id: string, updates: Partial<KnowledgeArticle>, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    // Basic UI validation for updated fields
    const validationErrors = validateForUI(updates);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(', '));
    }
    
    const currentArticle = articlesWithOptimisticUpdates.find(a => a.id === id);
    if (!currentArticle) {
      throw new Error("Article not found");
    }
    
    const optimisticArticle = {
      ...currentArticle,
      ...updates,
      updated_at: new Date().toISOString(),
      sync_status: "dirty" as const,
    };
    
    // Add optimistic update
    addOptimisticUpdate({
      id: id,
      operation: 'update',
      originalData: currentArticle,
      optimisticData: optimisticArticle,
      timestamp: Date.now(),
    });
    
    try {
      // Call backend API (handles business logic)
      await putWithAudit(
        tenantId,
        "knowledge_base",
        optimisticArticle,
        userId,
        {
          action: "update",
          description: `Updated knowledge article: ${optimisticArticle.title}`,
          tags: ["knowledge", "update"],
        }
      );
      
      // Enqueue for sync
      await enqueueItem({
        storeName: "knowledge_base",
        entityId: id,
        action: "update",
        payload: optimisticArticle,
      });
      
      // Remove optimistic update and refresh
      removeOptimisticUpdate(id);
      await refreshArticles(true);
    } catch (error) {
      // Rollback optimistic update
      rollbackOptimisticUpdate(id);
      throw error;
    }
  }, [tenantId, validateForUI, articlesWithOptimisticUpdates, addOptimisticUpdate, enqueueItem, removeOptimisticUpdate, refreshArticles, rollbackOptimisticUpdate]);
  
  const deleteArticle = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    const currentArticle = articlesWithOptimisticUpdates.find(a => a.id === id);
    if (!currentArticle) {
      throw new Error("Article not found");
    }
    
    // Add optimistic update
    addOptimisticUpdate({
      id: id,
      operation: 'delete',
      originalData: currentArticle,
      optimisticData: null,
      timestamp: Date.now(),
    });
    
    try {
      // Call backend API
      await removeWithAudit(
        tenantId,
        "knowledge_base",
        id,
        userId,
        {
          action: "delete",
          description: `Deleted knowledge article: ${currentArticle.title}`,
          tags: ["knowledge", "delete"],
        }
      );
      
      // Enqueue for sync
      await enqueueItem({
        storeName: "knowledge_base",
        entityId: id,
        action: "delete",
        payload: null,
      });
      
      // Remove optimistic update and refresh
      removeOptimisticUpdate(id);
      await refreshArticles(true);
    } catch (error) {
      // Rollback optimistic update
      rollbackOptimisticUpdate(id);
      throw error;
    }
  }, [tenantId, articlesWithOptimisticUpdates, addOptimisticUpdate, enqueueItem, removeOptimisticUpdate, refreshArticles, rollbackOptimisticUpdate]);
  
  // Article Operations (API calls - backend handles business logic)
  const publishArticle = useCallback(async (articleId: string, userId?: string) => {
    // Backend handles all validation and business logic
    await updateArticle(articleId, { workflow_status: 'published' }, userId);
  }, [updateArticle]);
  
  const archiveArticle = useCallback(async (articleId: string, reason: string, userId?: string) => {
    // Backend handles all validation and business logic
    await updateArticle(articleId, { 
      workflow_status: 'archived',
      archived_at: new Date().toISOString(),
      archived_reason: reason 
    }, userId);
  }, [updateArticle]);
  
  const reviewArticle = useCallback(async (articleId: string, review: KnowledgeReview) => {
    const article = await getArticle(articleId);
    if (!article) throw new Error("Article not found");
    
    const updatedReviews = [...article.reviews, review];
    await updateArticle(articleId, {
      reviews: updatedReviews,
      last_reviewed_at: review.reviewed_at,
      next_review_date: review.next_review_date,
    }, review.reviewer_user_id);
  }, [getArticle, updateArticle]);
  
  const addVersion = useCallback(async (articleId: string, content: string, changeSummary: string, userId: string) => {
    const article = await getArticle(articleId);
    if (!article) throw new Error("Article not found");
    
    // Backend handles version increment logic
    const newVersionEntry: KnowledgeVersion = {
      version: article.version + 1,
      content,
      author_user_id: userId,
      created_at: new Date().toISOString(),
      change_summary: changeSummary,
      word_count: content.split(' ').length,
    };
    
    await updateArticle(articleId, {
      content,
      version: article.version + 1,
      version_history: [...article.version_history, newVersionEntry],
    }, userId);
  }, [getArticle, updateArticle]);
  
  const recordView = useCallback(async (articleId: string, userId?: string) => {
    // Simple API call - backend handles metric calculation
    try {
      await fetch(`/api/knowledge/${articleId}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tenantId }),
      });
    } catch (error) {
      console.error('Failed to record view:', error);
      // Non-blocking operation
    }
  }, [tenantId]);
  
  const rateArticle = useCallback(async (articleId: string, rating: number, comments?: string, userId?: string) => {
    if (rating < 1 || rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }
    
    // Backend handles all rating calculation logic
    try {
      await fetch(`/api/knowledge/${articleId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comments, userId, tenantId }),
      });
      
      await refreshArticles(true);
    } catch (error) {
      console.error('Failed to rate article:', error);
      throw error;
    }
  }, [tenantId, refreshArticles]);
  
  // Attachment operations (API calls)
  const addAttachment = useCallback(async (articleId: string, attachment: Omit<KnowledgeAttachment, 'id' | 'uploaded_at'>, userId?: string) => {
    try {
      await fetch(`/api/knowledge/${articleId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...attachment, userId, tenantId }),
      });
      
      await refreshArticles(true);
    } catch (error) {
      console.error('Failed to add attachment:', error);
      throw error;
    }
  }, [tenantId, refreshArticles]);
  
  const removeAttachment = useCallback(async (articleId: string, attachmentId: string, userId?: string) => {
    try {
      await fetch(`/api/knowledge/${articleId}/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tenantId }),
      });
      
      await refreshArticles(true);
    } catch (error) {
      console.error('Failed to remove attachment:', error);
      throw error;
    }
  }, [tenantId, refreshArticles]);
  
  // Client-side UI helpers (simple, no business logic)
  const getFilteredArticles = useCallback((filters: KnowledgeFilters): KnowledgeArticle[] => {
    return articlesWithOptimisticUpdates.filter(article => {
      if (filters.type && article.type !== filters.type) return false;
      if (filters.status && article.status !== filters.status) return false;
      if (filters.category && article.category !== filters.category) return false;
      if (filters.audience && article.audience !== filters.audience) return false;
      if (filters.workflow_status && article.workflow_status !== filters.workflow_status) return false;
      if (filters.published_only && article.workflow_status !== 'published') return false;
      if (filters.needs_review && article.workflow_status !== 'review') return false;
      if (filters.tags?.length && !filters.tags.some(tag => article.tags.includes(tag))) return false;
      if (filters.author_ids?.length && !filters.author_ids.some(id => article.author_user_ids.includes(id))) return false;
      
      return true;
    });
  }, [articlesWithOptimisticUpdates]);
  
  const getSortedArticles = useCallback((articles: KnowledgeArticle[], sort: KnowledgeSort): KnowledgeArticle[] => {
    return [...articles].sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sort.field) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'updated_at':
          aValue = new Date(a.updated_at).getTime();
          bValue = new Date(b.updated_at).getTime();
          break;
        case 'created_at':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'view_count':
          aValue = a.metrics.view_count || 0;
          bValue = b.metrics.view_count || 0;
          break;
        case 'rating':
          aValue = a.metrics.average_rating || 0;
          bValue = b.metrics.average_rating || 0;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, []);
  
  const searchArticles = useCallback((query: string, fields: string[] = ['title', 'content', 'description', 'summary']): KnowledgeArticle[] => {
    if (!query.trim()) return articlesWithOptimisticUpdates;
    
    const lowerQuery = query.toLowerCase();
    return articlesWithOptimisticUpdates.filter(article => {
      return fields.some(field => {
        const value = (article as any)[field];
        if (typeof value === 'string') {
          return value.toLowerCase().includes(lowerQuery);
        }
        if (Array.isArray(value)) {
          return value.some(v => String(v).toLowerCase().includes(lowerQuery));
        }
        return false;
      });
    });
  }, [articlesWithOptimisticUpdates]);
  
  // Quick accessors for UI
  const publishedArticles = useMemo(() => 
    articlesWithOptimisticUpdates.filter(a => a.workflow_status === 'published'), 
    [articlesWithOptimisticUpdates]
  );
  
  const draftArticles = useMemo(() => 
    articlesWithOptimisticUpdates.filter(a => a.workflow_status === 'draft'), 
    [articlesWithOptimisticUpdates]
  );
  
  const articlesNeedingReview = useMemo(() => {
    const now = new Date();
    return articlesWithOptimisticUpdates.filter(a => {
      if (a.workflow_status === 'review') return true;
      if (a.next_review_date && new Date(a.next_review_date) <= now) return true;
      return false;
    });
  }, [articlesWithOptimisticUpdates]);
  
  // Analytics (from backend API)
  const getStats = useCallback(async (): Promise<KnowledgeStatsResponse> => {
    try {
      const response = await fetch(`/api/knowledge/stats?tenant=${tenantId}`);
      return response.json();
    } catch (error) {
      console.error('Failed to get knowledge stats:', error);
      throw error;
    }
  }, [tenantId]);
  
  const getEngagement = useCallback(async (timeframe: "week" | "month" | "quarter" = "month"): Promise<EngagementDataResponse[]> => {
    try {
      const response = await fetch(`/api/knowledge/engagement?tenant=${tenantId}&timeframe=${timeframe}`);
      return response.json();
    } catch (error) {
      console.error('Failed to get engagement data:', error);
      throw error;
    }
  }, [tenantId]);
  
  // Initialize and handle tenant changes
  useEffect(() => {
    if (tenantId && globalConfig) {
      clearCache();
      refreshArticles(true);
    }
    
    return () => {
      clearCache();
    };
  }, [tenantId, globalConfig, refreshArticles, clearCache]);
  
  // Mark data as stale periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (!articlesState.loading && articlesState.lastFetch) {
        const age = Date.now() - new Date(articlesState.lastFetch).getTime();
        if (age > cacheConfig.ttl) {
          setArticlesState(prev => ({ ...prev, stale: true }));
        }
      }
    }, cacheConfig.ttl / 2);
    
    return () => clearInterval(interval);
  }, [articlesState.loading, articlesState.lastFetch, cacheConfig.ttl]);
  
  return (
    <KnowledgeBaseContext.Provider
      value={{
        articlesState,
        optimisticUpdates,
        createArticle,
        updateArticle,
        deleteArticle,
        publishArticle,
        archiveArticle,
        reviewArticle,
        addVersion,
        recordView,
        rateArticle,
        addAttachment,
        removeAttachment,
        refreshArticles,
        getArticle,
        getFilteredArticles,
        getSortedArticles,
        searchArticles,
        publishedArticles,
        draftArticles,
        articlesNeedingReview,
        getStats,
        getEngagement,
        config,
      }}
    >
      {children}
    </KnowledgeBaseContext.Provider>
  );
};

// ---------------------------------
// 7. Hooks
// ---------------------------------
export const useKnowledgeBase = () => {
  const ctx = useContext(KnowledgeBaseContext);
  if (!ctx) throw new Error("useKnowledgeBase must be used within KnowledgeBaseProvider");
  return ctx;
};

// Selective subscription hooks for performance
export const useKnowledgeArticles = () => {
  const { articlesState, refreshArticles } = useKnowledgeBase();
  return {
    articles: articlesState.data || [],
    loading: articlesState.loading,
    error: articlesState.error,
    stale: articlesState.stale,
    refresh: refreshArticles,
  };
};

export const useKnowledgeFilters = (filters: KnowledgeFilters) => {
  const { getFilteredArticles } = useKnowledgeBase();
  return useMemo(() => getFilteredArticles(filters), [getFilteredArticles, filters]);
};

export const useKnowledgeSearch = (query: string) => {
  const { searchArticles } = useKnowledgeBase();
  return useMemo(() => searchArticles(query), [searchArticles, query]);
};

export const usePublishedArticles = () => {
  const { publishedArticles } = useKnowledgeBase();
  return publishedArticles;
};

export const useArticlesNeedingReview = () => {
  const { articlesNeedingReview } = useKnowledgeBase();
  return articlesNeedingReview;
};

export const useKnowledgeArticle = (id: string | null) => {
  const { getArticle } = useKnowledgeBase();
  const [article, setArticle] = useState<KnowledgeArticle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!id) {
      setArticle(null);
      setError(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    getArticle(id)
      .then(setArticle)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load article'))
      .finally(() => setLoading(false));
  }, [id, getArticle]);
  
  return { article, loading, error };
};