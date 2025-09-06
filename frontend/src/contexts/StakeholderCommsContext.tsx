// src/contexts/StakeholderCommsContext.tsx - REFACTORED FOR ENTERPRISE FRONTEND ARCHITECTURE
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { 
  getAll,
  getById,
  putWithAudit,
  removeWithAudit,
} from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";
import { ExternalSystemFields } from "../types/externalSystem";

// ---------------------------------
// 1. Core Types (Domain Models)
// ---------------------------------
export type CommChannel = 
  | "email" | "sms" | "chat" | "portal" | "phone" 
  | "push_notification" | "slack" | "teams" | "webhook" | "api" | "other";

export type CommAudience =
  | "executive" | "business_user" | "customer" | "vendor" 
  | "internal_it" | "end_user" | "stakeholder" | "media" | "regulatory" | "other";

export type CommStatus = 
  | "draft" | "scheduled" | "sent" | "delivered" | "read" | "failed" | "cancelled";

export type CommPriority = "low" | "normal" | "high" | "urgent";

export interface CommRecipient {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  user_id?: string | null;
  end_user_id?: string | null;
  customer_id?: string | null;
  role?: string;
  department?: string;
  delivery_status?: "pending" | "delivered" | "bounced" | "read" | "failed";
  delivered_at?: string | null;
  read_at?: string | null;
  error_message?: string;
}

export interface CommTemplate {
  id: string;
  name: string;
  subject_template: string;
  body_template: string;
  channel: CommChannel;
  audience: CommAudience;
  variables: string[];
}

export interface StakeholderComm extends ExternalSystemFields {
  id: string;
  related_entity_type: "incident" | "change" | "problem" | "maintenance" | "alert" | "other";
  related_entity_id: string;
  entity_name?: string;
  audience: CommAudience;
  channel: CommChannel;
  priority: CommPriority;
  status: CommStatus;
  created_at: string;
  updated_at: string;
  scheduled_at?: string | null;
  sent_at?: string | null;

  // Content
  subject: string;
  message: string;
  template_id?: string | null;
  personalized: boolean;

  // Actors
  sender_user_id?: string | null;
  sender_team_id?: string | null;
  automation_rule_id?: string | null;
  ai_agent_id?: string | null;

  // Recipients & Delivery
  recipients: CommRecipient[];
  total_recipients: number;
  successful_deliveries: number;
  failed_deliveries: number;
  read_count: number;

  // Business Context
  business_service_id?: string | null;
  customer_id?: string | null;
  cost_center_id?: string | null;
  is_public_facing: boolean;
  regulatory_required?: boolean;

  // Approval Workflow
  requires_approval: boolean;
  approval_status?: "pending" | "approved" | "rejected";
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string;

  // Delivery Settings
  retry_count: number;
  max_retries: number;
  retry_delay_minutes: number;
  delivery_window?: {
    start_time?: string;
    end_time?: string;
    timezone?: string;
    business_days_only?: boolean;
  };

  // Analytics
  opened_count?: number;
  clicked_count?: number;
  response_count?: number;
  escalated?: boolean;
  escalated_at?: string | null;
  follow_up_required?: boolean;
  follow_up_at?: string | null;

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  // synced_at, sync_status replaced with ExternalSystemFields
  tenantId?: string;
}

// ---------------------------------
// 2. AsyncState Interface for UI State Management
// ---------------------------------
export interface AsyncState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  lastFetch: string | null;
  stale: boolean;
}

interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number;
}

interface UIFilters {
  status?: CommStatus[];
  channel?: CommChannel[];
  audience?: CommAudience[];
  priority?: CommPriority[];
  search?: string;
  entityId?: string;
  entityType?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  // External system filtering
  sourceSystems?: string[];
  syncStatus?: ('synced' | 'syncing' | 'error' | 'conflict')[];
  hasConflicts?: boolean;
  hasLocalChanges?: boolean;
  dataCompleteness?: { min: number; max: number };
}

interface OptimisticUpdate<T> {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: T;
  timestamp: string;
}

// ---------------------------------
// 3. UI-Focused Context Interface
// ---------------------------------
interface StakeholderCommsContextType {
  // Async State Management
  communications: AsyncState<StakeholderComm>;
  templates: AsyncState<CommTemplate>;
  
  // API Operations (thin wrappers)
  createCommunication: (comm: Partial<StakeholderComm>, userId?: string) => Promise<StakeholderComm>;
  updateCommunication: (id: string, updates: Partial<StakeholderComm>, userId?: string) => Promise<StakeholderComm>;
  deleteCommunication: (id: string, userId?: string) => Promise<void>;
  getCommunication: (id: string) => Promise<StakeholderComm | null>;
  
  createTemplate: (template: Partial<CommTemplate>, userId?: string) => Promise<CommTemplate>;
  updateTemplate: (id: string, updates: Partial<CommTemplate>, userId?: string) => Promise<CommTemplate>;
  deleteTemplate: (id: string, userId?: string) => Promise<void>;
  getTemplate: (id: string) => Promise<CommTemplate | null>;

  // Communication Actions (API calls)
  sendCommunication: (id: string, userId?: string) => Promise<void>;
  scheduleCommunication: (id: string, scheduledAt: string, userId?: string) => Promise<void>;
  cancelCommunication: (id: string, userId: string, reason?: string) => Promise<void>;
  retryCommunication: (id: string, userId?: string) => Promise<void>;
  approveCommunication: (id: string, approverId: string, comments?: string) => Promise<void>;
  rejectCommunication: (id: string, reviewerId: string, reason: string) => Promise<void>;
  markAsRead: (commId: string, recipientId: string) => Promise<void>;
  createFromTemplate: (templateId: string, entityData: any) => Promise<StakeholderComm>;

  // Client-Side UI Helpers
  getFilteredCommunications: (filters: UIFilters) => StakeholderComm[];
  getFilteredTemplates: (filters: Pick<UIFilters, 'search' | 'channel' | 'audience'>) => CommTemplate[];
  searchCommunications: (query: string) => StakeholderComm[];
  searchTemplates: (query: string) => CommTemplate[];

  // Cache & Performance
  refreshData: () => Promise<void>;
  invalidateCache: () => void;
  
  // UI State Management
  filters: UIFilters;
  setFilters: (filters: Partial<UIFilters>) => void;
  clearFilters: () => void;
  
  // Configuration (from backend)
  config: {
    channels: CommChannel[];
    audiences: CommAudience[];
    statuses: CommStatus[];
    priorities: CommPriority[];
    cache: CacheConfig;
  };
}

// ---------------------------------
// 4. Default State & Configuration
// ---------------------------------
const DEFAULT_ASYNC_STATE = <T,>(): AsyncState<T> => ({
  data: [],
  loading: false,
  error: null,
  lastFetch: null,
  stale: false,
});

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 1000,
};

const DEFAULT_FILTERS: UIFilters = {};

const StakeholderCommsContext = createContext<StakeholderCommsContextType | undefined>(undefined);

// ---------------------------------
// 5. Provider Implementation
// ---------------------------------
export const StakeholderCommsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();

  // Core async state
  const [communications, setCommunications] = useState<AsyncState<StakeholderComm>>(DEFAULT_ASYNC_STATE);
  const [templates, setTemplates] = useState<AsyncState<CommTemplate>>(DEFAULT_ASYNC_STATE);
  
  // UI state
  const [filters, setFiltersState] = useState<UIFilters>(DEFAULT_FILTERS);
  
  // Optimistic updates tracking
  const optimisticUpdatesRef = useRef<OptimisticUpdate<any>[]>([]);
  
  // Cache management
  const cacheTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Configuration from backend
  const config = useMemo(() => ({
    channels: globalConfig?.communications?.channels || [
      "email", "sms", "chat", "portal", "phone", "push_notification", "slack", "teams", "webhook", "api", "other"
    ] as CommChannel[],
    audiences: globalConfig?.communications?.audiences || [
      "executive", "business_user", "customer", "vendor", "internal_it", "end_user", "stakeholder", "media", "regulatory", "other"
    ] as CommAudience[],
    statuses: globalConfig?.communications?.statuses || [
      "draft", "scheduled", "sent", "delivered", "read", "failed", "cancelled"
    ] as CommStatus[],
    priorities: globalConfig?.communications?.priorities || [
      "low", "normal", "high", "urgent"
    ] as CommPriority[],
    cache: globalConfig?.communications?.cache || DEFAULT_CACHE_CONFIG,
  }), [globalConfig]);

  // ---------------------------------
  // 6. Cache Management
  // ---------------------------------
  const setCacheTimer = useCallback((key: string, ttl: number) => {
    // Clear existing timer
    const existing = cacheTimersRef.current.get(key);
    if (existing) clearTimeout(existing);

    // Set new timer
    const timer = setTimeout(() => {
      if (key === 'communications') {
        setCommunications(prev => ({ ...prev, stale: true }));
      } else if (key === 'templates') {
        setTemplates(prev => ({ ...prev, stale: true }));
      }
      cacheTimersRef.current.delete(key);
    }, ttl);

    cacheTimersRef.current.set(key, timer);
  }, []);

  const invalidateCache = useCallback(() => {
    // Clear all timers
    cacheTimersRef.current.forEach(timer => clearTimeout(timer));
    cacheTimersRef.current.clear();
    
    // Mark all data as stale
    setCommunications(prev => ({ ...prev, stale: true }));
    setTemplates(prev => ({ ...prev, stale: true }));
  }, []);

  // ---------------------------------
  // 7. Data Fetching Functions
  // ---------------------------------
  const fetchCommunications = useCallback(async (): Promise<void> => {
    if (!tenantId) return;

    setCommunications(prev => ({ ...prev, loading: true, error: null }));

    try {
      const data = await getAll<StakeholderComm>(tenantId, "stakeholder_comms");
      const now = new Date().toISOString();
      
      setCommunications({
        data,
        loading: false,
        error: null,
        lastFetch: now,
        stale: false,
      });

      setCacheTimer('communications', config.cache.ttl);
    } catch (error) {
      setCommunications(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch communications',
      }));
    }
  }, [tenantId, config.cache.ttl, setCacheTimer]);

  const fetchTemplates = useCallback(async (): Promise<void> => {
    if (!tenantId) return;

    setTemplates(prev => ({ ...prev, loading: true, error: null }));

    try {
      // TODO: Templates should be filtered from stakeholder_comms store or stored separately
      // For now, return empty array as communication_templates store doesn't exist
      const data: CommTemplate[] = [];
      const now = new Date().toISOString();
      
      setTemplates({
        data,
        loading: false,
        error: null,
        lastFetch: now,
        stale: false,
      });

      setCacheTimer('templates', config.cache.ttl);
    } catch (error) {
      setTemplates(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch templates',
      }));
    }
  }, [tenantId, config.cache.ttl, setCacheTimer]);

  // ---------------------------------
  // 8. Optimistic UI Helpers
  // ---------------------------------
  const addOptimisticUpdate = useCallback(<T,>(update: OptimisticUpdate<T>) => {
    optimisticUpdatesRef.current.push(update);
  }, []);

  const removeOptimisticUpdate = useCallback((id: string) => {
    optimisticUpdatesRef.current = optimisticUpdatesRef.current.filter(u => u.id !== id);
  }, []);

  const rollbackOptimisticUpdate = useCallback((id: string) => {
    const update = optimisticUpdatesRef.current.find(u => u.id === id);
    if (!update) return;

    if (update.type === 'create') {
      setCommunications(prev => ({
        ...prev,
        data: prev.data.filter(c => c.id !== id),
      }));
    } else if (update.type === 'delete') {
      setCommunications(prev => ({
        ...prev,
        data: [...prev.data, update.entity as StakeholderComm],
      }));
    }
    
    removeOptimisticUpdate(id);
  }, [removeOptimisticUpdate]);

  // ---------------------------------
  // 9. API Operations (Thin Wrappers)
  // ---------------------------------
  const createCommunication = useCallback(async (
    commData: Partial<StakeholderComm>,
    userId?: string
  ): Promise<StakeholderComm> => {
    if (!tenantId) throw new Error("No tenant selected");

    // Create optimistic entity
    const tempId = `temp_${Date.now()}`;
    const optimisticComm: StakeholderComm = {
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      health_status: "green",
      sync_status: "syncing",
      tenantId,
      recipients: [],
      total_recipients: 0,
      successful_deliveries: 0,
      failed_deliveries: 0,
      read_count: 0,
      retry_count: 0,
      max_retries: 3,
      retry_delay_minutes: 30,
      requires_approval: false,
      personalized: false,
      is_public_facing: false,
      tags: [],
      ...commData,
    } as StakeholderComm;

    // Optimistic UI update
    setCommunications(prev => ({
      ...prev,
      data: [optimisticComm, ...prev.data],
    }));

    addOptimisticUpdate({
      id: tempId,
      type: 'create',
      entity: optimisticComm,
      timestamp: new Date().toISOString(),
    });

    try {
      // Call API (backend handles business logic)
      await putWithAudit(
        tenantId,
        "stakeholder_communications",
        optimisticComm,
        userId,
        { action: "create", description: `Communication "${optimisticComm.subject}" created` },
        enqueueItem
      );

      removeOptimisticUpdate(tempId);
      return optimisticComm;
    } catch (error) {
      rollbackOptimisticUpdate(tempId);
      throw error;
    }
  }, [tenantId, enqueueItem, addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate]);

  const updateCommunication = useCallback(async (
    id: string,
    updates: Partial<StakeholderComm>,
    userId?: string
  ): Promise<StakeholderComm> => {
    if (!tenantId) throw new Error("No tenant selected");

    const existing = communications.data.find(c => c.id === id);
    if (!existing) throw new Error("Communication not found");

    const updated = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
      sync_status: "syncing" as const,
    };

    // Optimistic UI update
    setCommunications(prev => ({
      ...prev,
      data: prev.data.map(c => c.id === id ? updated : c),
    }));

    try {
      await putWithAudit(
        tenantId,
        "stakeholder_communications",
        updated,
        userId,
        { action: "update", description: `Communication "${updated.subject}" updated` },
        enqueueItem
      );

      return updated;
    } catch (error) {
      // Rollback
      setCommunications(prev => ({
        ...prev,
        data: prev.data.map(c => c.id === id ? existing : c),
      }));
      throw error;
    }
  }, [tenantId, communications.data, enqueueItem]);

  const deleteCommunication = useCallback(async (id: string, userId?: string): Promise<void> => {
    if (!tenantId) throw new Error("No tenant selected");

    const existing = communications.data.find(c => c.id === id);
    if (!existing) return;

    // Optimistic UI update
    setCommunications(prev => ({
      ...prev,
      data: prev.data.filter(c => c.id !== id),
    }));

    addOptimisticUpdate({
      id,
      type: 'delete',
      entity: existing,
      timestamp: new Date().toISOString(),
    });

    try {
      await removeWithAudit(
        tenantId,
        "stakeholder_communications",
        id,
        userId,
        { action: "delete", description: `Communication "${existing.subject}" deleted` },
        enqueueItem
      );

      removeOptimisticUpdate(id);
    } catch (error) {
      rollbackOptimisticUpdate(id);
      throw error;
    }
  }, [tenantId, communications.data, enqueueItem, addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate]);

  const getCommunication = useCallback(async (id: string): Promise<StakeholderComm | null> => {
    if (!tenantId) return null;

    // Check cache first
    const cached = communications.data.find(c => c.id === id);
    if (cached && !communications.stale) return cached;

    // Fetch from API
    try {
      return await getById<StakeholderComm>(tenantId, "stakeholder_communications", id);
    } catch {
      return null;
    }
  }, [tenantId, communications.data, communications.stale]);

  // Template operations (similar pattern)
  const createTemplate = useCallback(async (
    templateData: Partial<CommTemplate>,
    userId?: string
  ): Promise<CommTemplate> => {
    if (!tenantId) throw new Error("No tenant selected");

    const template: CommTemplate = {
      id: `template_${Date.now()}`,
      variables: [],
      ...templateData,
    } as CommTemplate;

    // Optimistic update
    setTemplates(prev => ({
      ...prev,
      data: [template, ...prev.data],
    }));

    try {
      await putWithAudit(
        tenantId,
        "communication_templates",
        template,
        userId,
        { action: "create", description: `Template "${template.name}" created` },
        enqueueItem
      );

      return template;
    } catch (error) {
      // Rollback
      setTemplates(prev => ({
        ...prev,
        data: prev.data.filter(t => t.id !== template.id),
      }));
      throw error;
    }
  }, [tenantId, enqueueItem]);

  const updateTemplate = useCallback(async (
    id: string,
    updates: Partial<CommTemplate>,
    userId?: string
  ): Promise<CommTemplate> => {
    if (!tenantId) throw new Error("No tenant selected");

    const existing = templates.data.find(t => t.id === id);
    if (!existing) throw new Error("Template not found");

    const updated = { ...existing, ...updates };

    setTemplates(prev => ({
      ...prev,
      data: prev.data.map(t => t.id === id ? updated : t),
    }));

    try {
      await putWithAudit(
        tenantId,
        "communication_templates",
        updated,
        userId,
        { action: "update", description: `Template "${updated.name}" updated` },
        enqueueItem
      );

      return updated;
    } catch (error) {
      setTemplates(prev => ({
        ...prev,
        data: prev.data.map(t => t.id === id ? existing : t),
      }));
      throw error;
    }
  }, [tenantId, templates.data, enqueueItem]);

  const deleteTemplate = useCallback(async (id: string, userId?: string): Promise<void> => {
    if (!tenantId) throw new Error("No tenant selected");

    const existing = templates.data.find(t => t.id === id);
    if (!existing) return;

    setTemplates(prev => ({
      ...prev,
      data: prev.data.filter(t => t.id !== id),
    }));

    try {
      await removeWithAudit(
        tenantId,
        "communication_templates",
        id,
        userId,
        { action: "delete", description: `Template "${existing.name}" deleted` },
        enqueueItem
      );
    } catch (error) {
      setTemplates(prev => ({
        ...prev,
        data: [...prev.data, existing],
      }));
      throw error;
    }
  }, [tenantId, templates.data, enqueueItem]);

  const getTemplate = useCallback(async (id: string): Promise<CommTemplate | null> => {
    if (!tenantId) return null;

    const cached = templates.data.find(t => t.id === id);
    if (cached && !templates.stale) return cached;

    try {
      return await getById<CommTemplate>(tenantId, "communication_templates", id);
    } catch {
      return null;
    }
  }, [tenantId, templates.data, templates.stale]);

  // ---------------------------------
  // 10. Communication Actions (API calls)
  // ---------------------------------
  const sendCommunication = useCallback(async (id: string, userId?: string): Promise<void> => {
    // API call - backend handles all business logic
    await updateCommunication(id, { 
      status: "sent", 
      sent_at: new Date().toISOString() 
    }, userId);
  }, [updateCommunication]);

  const scheduleCommunication = useCallback(async (
    id: string, 
    scheduledAt: string, 
    userId?: string
  ): Promise<void> => {
    await updateCommunication(id, { 
      status: "scheduled", 
      scheduled_at: scheduledAt 
    }, userId);
  }, [updateCommunication]);

  const cancelCommunication = useCallback(async (
    id: string, 
    userId: string, 
    reason?: string
  ): Promise<void> => {
    await updateCommunication(id, { 
      status: "cancelled",
      custom_fields: { cancellation_reason: reason, cancelled_by: userId }
    }, userId);
  }, [updateCommunication]);

  const retryCommunication = useCallback(async (id: string, userId?: string): Promise<void> => {
    const comm = await getCommunication(id);
    if (!comm || comm.retry_count >= comm.max_retries) return;

    await updateCommunication(id, {
      status: "sent",
      retry_count: comm.retry_count + 1,
      sent_at: new Date().toISOString(),
    }, userId);
  }, [getCommunication, updateCommunication]);

  const approveCommunication = useCallback(async (
    id: string, 
    approverId: string, 
    comments?: string
  ): Promise<void> => {
    await updateCommunication(id, {
      approval_status: "approved",
      approved_by: approverId,
      approved_at: new Date().toISOString(),
      custom_fields: { approval_comments: comments },
    }, approverId);
  }, [updateCommunication]);

  const rejectCommunication = useCallback(async (
    id: string, 
    reviewerId: string, 
    reason: string
  ): Promise<void> => {
    await updateCommunication(id, {
      approval_status: "rejected",
      rejection_reason: reason,
      custom_fields: { rejected_by: reviewerId },
    }, reviewerId);
  }, [updateCommunication]);

  const markAsRead = useCallback(async (commId: string, recipientId: string): Promise<void> => {
    const comm = await getCommunication(commId);
    if (!comm) return;

    // Frontend only updates UI state - backend handles delivery tracking
    const updatedRecipients = comm.recipients.map(r => 
      r.id === recipientId 
        ? { ...r, delivery_status: "read" as const, read_at: new Date().toISOString() }
        : r
    );

    await updateCommunication(commId, {
      recipients: updatedRecipients,
      read_count: updatedRecipients.filter(r => r.delivery_status === "read").length,
    });
  }, [getCommunication, updateCommunication]);

  const createFromTemplate = useCallback(async (
    templateId: string, 
    entityData: any
  ): Promise<StakeholderComm> => {
    const template = await getTemplate(templateId);
    if (!template) throw new Error("Template not found");

    // Frontend creates base structure - backend handles template processing
    return createCommunication({
      related_entity_id: entityData.id,
      related_entity_type: entityData.type,
      audience: template.audience,
      channel: template.channel,
      subject: template.subject_template,
      message: template.body_template,
      template_id: templateId,
      status: "draft",
      priority: "normal",
    });
  }, [getTemplate, createCommunication]);

  // ---------------------------------
  // 11. Client-Side UI Helpers
  // ---------------------------------
  const getFilteredCommunications = useCallback((filters: UIFilters): StakeholderComm[] => {
    let filtered = communications.data;

    if (filters.status?.length) {
      filtered = filtered.filter(c => filters.status?.includes(c.status) || false);
    }
    if (filters.channel?.length) {
      filtered = filtered.filter(c => filters.channel?.includes(c.channel) || false);
    }
    if (filters.audience?.length) {
      filtered = filtered.filter(c => filters.audience?.includes(c.audience) || false);
    }
    if (filters.priority?.length) {
      filtered = filtered.filter(c => filters.priority?.includes(c.priority) || false);
    }
    if (filters.entityId) {
      filtered = filtered.filter(c => c.related_entity_id === filters.entityId);
    }
    if (filters.entityType) {
      filtered = filtered.filter(c => c.related_entity_type === filters.entityType);
    }
    if (filters.search) {
      const query = filters.search.toLowerCase();
      filtered = filtered.filter(c => 
        c.subject.toLowerCase().includes(query) ||
        c.message.toLowerCase().includes(query) ||
        c.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    if (filters.dateRange) {
      filtered = filtered.filter(c => 
        filters.dateRange && 
        c.created_at >= filters.dateRange.start && 
        c.created_at <= filters.dateRange.end
      );
    }

    return filtered;
  }, [communications.data]);

  const getFilteredTemplates = useCallback((
    filters: Pick<UIFilters, 'search' | 'channel' | 'audience'>
  ): CommTemplate[] => {
    let filtered = templates.data;

    if (filters.channel?.length) {
      filtered = filtered.filter(t => filters.channel?.includes(t.channel) || false);
    }
    if (filters.audience?.length) {
      filtered = filtered.filter(t => filters.audience?.includes(t.audience) || false);
    }
    if (filters.search) {
      const query = filters.search.toLowerCase();
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.subject_template.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [templates.data]);

  const searchCommunications = useCallback((query: string): StakeholderComm[] => {
    if (!query.trim()) return communications.data;
    
    const lowerQuery = query.toLowerCase();
    return communications.data.filter(c => 
      c.subject.toLowerCase().includes(lowerQuery) ||
      c.message.toLowerCase().includes(lowerQuery) ||
      c.audience.toLowerCase().includes(lowerQuery) ||
      c.channel.toLowerCase().includes(lowerQuery) ||
      c.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      c.entity_name?.toLowerCase().includes(lowerQuery)
    );
  }, [communications.data]);

  const searchTemplates = useCallback((query: string): CommTemplate[] => {
    if (!query.trim()) return templates.data;
    
    const lowerQuery = query.toLowerCase();
    return templates.data.filter(t => 
      t.name.toLowerCase().includes(lowerQuery) ||
      t.subject_template.toLowerCase().includes(lowerQuery) ||
      t.body_template.toLowerCase().includes(lowerQuery)
    );
  }, [templates.data]);

  // ---------------------------------
  // 12. UI State Management
  // ---------------------------------
  const setFilters = useCallback((newFilters: Partial<UIFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  const refreshData = useCallback(async () => {
    await Promise.all([fetchCommunications(), fetchTemplates()]);
  }, [fetchCommunications, fetchTemplates]);

  // ---------------------------------
  // 13. Initialization & Cleanup
  // ---------------------------------
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshData();
    } else {
      setCommunications(DEFAULT_ASYNC_STATE);
      setTemplates(DEFAULT_ASYNC_STATE);
    }
  }, [tenantId, globalConfig, refreshData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cacheTimersRef.current.forEach(timer => clearTimeout(timer));
      cacheTimersRef.current.clear();
    };
  }, []);

  // Auto-refresh when data becomes stale
  useEffect(() => {
    if (communications.stale && !communications.loading) {
      fetchCommunications();
    }
  }, [communications.stale, communications.loading, fetchCommunications]);

  useEffect(() => {
    if (templates.stale && !templates.loading) {
      fetchTemplates();
    }
  }, [templates.stale, templates.loading, fetchTemplates]);

  // ---------------------------------
  // 14. Context Value (Memoized for Performance)
  // ---------------------------------
  const contextValue = useMemo(() => ({
    // State
    communications,
    templates,
    
    // CRUD Operations
    createCommunication,
    updateCommunication,
    deleteCommunication,
    getCommunication,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplate,
    
    // Communication Actions
    sendCommunication,
    scheduleCommunication,
    cancelCommunication,
    retryCommunication,
    approveCommunication,
    rejectCommunication,
    markAsRead,
    createFromTemplate,
    
    // UI Helpers
    getFilteredCommunications,
    getFilteredTemplates,
    searchCommunications,
    searchTemplates,
    
    // Cache & Performance
    refreshData,
    invalidateCache,
    
    // UI State
    filters,
    setFilters,
    clearFilters,
    
    // Config
    config,
  }), [
    communications, templates, createCommunication, updateCommunication, deleteCommunication, getCommunication,
    createTemplate, updateTemplate, deleteTemplate, getTemplate, sendCommunication, scheduleCommunication,
    cancelCommunication, retryCommunication, approveCommunication, rejectCommunication, markAsRead, 
    createFromTemplate, getFilteredCommunications, getFilteredTemplates, searchCommunications, 
    searchTemplates, refreshData, invalidateCache, filters, setFilters, clearFilters, config
  ]);

  return (
    <StakeholderCommsContext.Provider value={contextValue}>
      {children}
    </StakeholderCommsContext.Provider>
  );
};

// ---------------------------------
// 15. Hooks for Consumers
// ---------------------------------
export const useStakeholderComms = () => {
  const ctx = useContext(StakeholderCommsContext);
  if (!ctx) throw new Error("useStakeholderComms must be used within StakeholderCommsProvider");
  return ctx;
};

// Selective subscription hooks for performance
export const useStakeholderCommDetails = (id: string) => {
  const { communications } = useStakeholderComms();
  return useMemo(() => 
    communications.data.find(c => c.id === id) || null, 
    [communications.data, id]
  );
};

export const useCommTemplate = (id: string) => {
  const { templates } = useStakeholderComms();
  return useMemo(() => 
    templates.data.find(t => t.id === id) || null, 
    [templates.data, id]
  );
};

export const useEntityComms = (entityId: string, entityType: string) => {
  const { getFilteredCommunications } = useStakeholderComms();
  return useMemo(() => 
    getFilteredCommunications({ entityId, entityType }), 
    [getFilteredCommunications, entityId, entityType]
  );
};

export const useCommsByStatus = (status: CommStatus[]) => {
  const { getFilteredCommunications } = useStakeholderComms();
  return useMemo(() => 
    getFilteredCommunications({ status }), 
    [getFilteredCommunications, status]
  );
};

export const usePendingApprovals = () => {
  const { communications } = useStakeholderComms();
  return useMemo(() => 
    communications.data.filter(c => c.requires_approval && c.approval_status === "pending"),
    [communications.data]
  );
};

export const useScheduledCommunications = () => {
  const { getFilteredCommunications } = useStakeholderComms();
  return useMemo(() => 
    getFilteredCommunications({ status: ["scheduled"] }), 
    [getFilteredCommunications]
  );
};

export const useFailedCommunications = () => {
  const { getFilteredCommunications } = useStakeholderComms();
  return useMemo(() => 
    getFilteredCommunications({ status: ["failed"] }), 
    [getFilteredCommunications]
  );
};