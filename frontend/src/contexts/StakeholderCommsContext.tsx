// src/contexts/StakeholderCommsContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
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

// ---------------------------------
// 1. Type Definitions
// ---------------------------------
export type CommChannel = 
  | "email" 
  | "sms" 
  | "chat" 
  | "portal" 
  | "phone" 
  | "push_notification"
  | "slack"
  | "teams"
  | "webhook"
  | "api"
  | "other";

export type CommAudience =
  | "executive"
  | "business_user"
  | "customer"
  | "vendor"
  | "internal_it"
  | "end_user"
  | "stakeholder"
  | "media"
  | "regulatory"
  | "other";

export type CommStatus = 
  | "draft" 
  | "scheduled" 
  | "sent" 
  | "delivered" 
  | "read" 
  | "failed" 
  | "cancelled";

export type CommPriority = 
  | "low" 
  | "normal" 
  | "high" 
  | "urgent";

export interface CommRecipient {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  user_id?: string | null;     // FK → UsersContext
  end_user_id?: string | null; // FK → EndUsersContext
  customer_id?: string | null; // FK → CustomersContext
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
  variables: string[];  // List of template variables like {{incident_id}}, {{customer_name}}
}

export interface StakeholderComm {
  id: string;
  related_entity_type: "incident" | "change" | "problem" | "maintenance" | "alert" | "other";
  related_entity_id: string;      // FK to Incident/Change/Problem/Maintenance
  entity_name?: string;            // Cached name for display
  audience: CommAudience;
  channel: CommChannel;
  priority: CommPriority;
  status: CommStatus;
  created_at: string;
  updated_at: string;
  scheduled_at?: string | null;
  sent_at?: string | null;

  // Message content
  subject: string;
  message: string;
  template_id?: string | null;     // FK → CommTemplate
  personalized: boolean;          // Whether message was personalized per recipient

  // Actor information
  sender_user_id?: string | null;   // FK → UsersContext
  sender_team_id?: string | null;   // FK → TeamsContext
  automation_rule_id?: string | null; // FK → AutomationRulesContext (for automated comms)
  ai_agent_id?: string | null;     // FK → AiAgentsContext

  // Recipients and delivery
  recipients: CommRecipient[];
  total_recipients: number;
  successful_deliveries: number;
  failed_deliveries: number;
  read_count: number;

  // Business context
  business_service_id?: string | null;
  customer_id?: string | null;
  cost_center_id?: string | null;
  is_public_facing: boolean;
  regulatory_required?: boolean;

  // Approval workflow
  requires_approval: boolean;
  approval_status?: "pending" | "approved" | "rejected";
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string;

  // Delivery settings
  retry_count: number;
  max_retries: number;
  retry_delay_minutes: number;
  delivery_window?: {
    start_time?: string; // HH:MM format
    end_time?: string;   // HH:MM format
    timezone?: string;
    business_days_only?: boolean;
  };

  // Tracking and analytics
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
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
  tenantId?: string;
}

export interface CommDetails extends StakeholderComm {
  sender?: any;
  template?: CommTemplate;
  related_entity?: any;
  business_service?: any;
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------
interface StakeholderCommsContextType {
  communications: StakeholderComm[];
  templates: CommTemplate[];
  
  // Communication operations
  addCommunication: (comm: StakeholderComm, userId?: string) => Promise<void>;
  updateCommunication: (comm: StakeholderComm, userId?: string) => Promise<void>;
  deleteCommunication: (id: string, userId?: string) => Promise<void>;
  refreshCommunications: () => Promise<void>;
  getCommunication: (id: string) => Promise<StakeholderComm | undefined>;

  // Template operations
  addTemplate: (template: CommTemplate, userId?: string) => Promise<void>;
  updateTemplate: (template: CommTemplate, userId?: string) => Promise<void>;
  deleteTemplate: (id: string, userId?: string) => Promise<void>;
  refreshTemplates: () => Promise<void>;
  getTemplate: (id: string) => Promise<CommTemplate | undefined>;

  // Communication-specific operations
  sendCommunication: (commId: string, userId?: string) => Promise<void>;
  scheduleCommunication: (commId: string, scheduledAt: string, userId?: string) => Promise<void>;
  cancelCommunication: (commId: string, userId: string, reason?: string) => Promise<void>;
  retryCommunication: (commId: string, userId?: string) => Promise<void>;
  approveCommunication: (commId: string, approverId: string, comments?: string) => Promise<void>;
  rejectCommunication: (commId: string, reviewerId: string, reason: string) => Promise<void>;
  markAsRead: (commId: string, recipientId: string) => Promise<void>;
  createFromTemplate: (templateId: string, entityId: string, entityType: string, overrides?: Partial<StakeholderComm>) => Promise<StakeholderComm>;

  // Filtering and querying
  getCommunicationsByEntity: (entityId: string, entityType: string) => StakeholderComm[];
  getCommunicationsByChannel: (channel: CommChannel) => StakeholderComm[];
  getCommunicationsByAudience: (audience: CommAudience) => StakeholderComm[];
  getCommunicationsByStatus: (status: CommStatus) => StakeholderComm[];
  getCommunicationsBySender: (senderId: string) => StakeholderComm[];
  getPendingApprovals: () => StakeholderComm[];
  getScheduledCommunications: () => StakeholderComm[];
  getFailedCommunications: () => StakeholderComm[];
  getCommunicationsNeedingFollowUp: () => StakeholderComm[];
  searchCommunications: (query: string) => StakeholderComm[];

  // Analytics
  getCommunicationStats: (timeframe?: "day" | "week" | "month") => {
    totalSent: number;
    deliveryRate: number;
    openRate: number;
    responseRate: number;
    channelBreakdown: Record<CommChannel, number>;
    audienceBreakdown: Record<CommAudience, number>;
  };

  // Config integration
  config: {
    channels: string[];
    audiences: string[];
    statuses: string[];
    priorities: string[];
  };
}

const StakeholderCommsContext = createContext<StakeholderCommsContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const StakeholderCommsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();
  const [communications, setCommunications] = useState<StakeholderComm[]>([]);
  const [templates, setTemplates] = useState<CommTemplate[]>([]);

  const config = {
    channels: globalConfig?.communications?.channels || [
      "email", "sms", "chat", "portal", "phone", "push_notification", "slack", "teams", "webhook", "api", "other"
    ],
    audiences: globalConfig?.communications?.audiences || [
      "executive", "business_user", "customer", "vendor", "internal_it", "end_user", "stakeholder", "media", "regulatory", "other"
    ],
    statuses: globalConfig?.communications?.statuses || [
      "draft", "scheduled", "sent", "delivered", "read", "failed", "cancelled"
    ],
    priorities: globalConfig?.communications?.priorities || [
      "low", "normal", "high", "urgent"
    ],
  };

  // Communication operations
  const refreshCommunications = useCallback(async () => {
    if (!tenantId) return;
    try {
      const all = await getAll<StakeholderComm>(tenantId, "stakeholder_communications");
      setCommunications(all);
    } catch (error) {
      console.error("Failed to refresh communications:", error);
    }
  }, [tenantId]);

  const getCommunication = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    return getById<StakeholderComm>(tenantId, "stakeholder_communications", id);
  }, [tenantId]);

  const addCommunication = useCallback(async (comm: StakeholderComm, userId?: string) => {
    if (!tenantId) return;

    // ✅ Config validation
    if (!config.channels.includes(comm.channel)) {
      throw new Error(`Invalid communication channel: ${comm.channel}`);
    }
    if (!config.audiences.includes(comm.audience)) {
      throw new Error(`Invalid audience: ${comm.audience}`);
    }
    if (!config.statuses.includes(comm.status)) {
      throw new Error(`Invalid status: ${comm.status}`);
    }
    if (!config.priorities.includes(comm.priority)) {
      throw new Error(`Invalid priority: ${comm.priority}`);
    }

    const enrichedComm: StakeholderComm = {
      ...comm,
      created_at: comm.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      total_recipients: comm.recipients.length,
      successful_deliveries: 0,
      failed_deliveries: 0,
      read_count: 0,
      retry_count: 0,
      max_retries: comm.max_retries || 3,
      retry_delay_minutes: comm.retry_delay_minutes || 30,
      health_status: comm.health_status || "green",
      sync_status: "dirty",
      tenantId,
    };

    await putWithAudit(
      tenantId,
      "stakeholder_communications",
      enrichedComm,
      userId,
      { action: "create", description: `Communication "${comm.subject}" created for ${comm.audience}` },
      enqueueItem
    );
    await refreshCommunications();
  }, [tenantId, config, enqueueItem, refreshCommunications]);

  const updateCommunication = useCallback(async (comm: StakeholderComm, userId?: string) => {
    if (!tenantId) return;

    const enrichedComm: StakeholderComm = {
      ...comm,
      updated_at: new Date().toISOString(),
      sync_status: "dirty",
      tenantId,
    };

    await putWithAudit(
      tenantId,
      "stakeholder_communications",
      enrichedComm,
      userId,
      { action: "update", description: `Communication "${comm.subject}" updated` },
      enqueueItem
    );
    await refreshCommunications();
  }, [tenantId, enqueueItem, refreshCommunications]);

  const deleteCommunication = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) return;

    const comm = await getCommunication(id);
    const commSubject = comm?.subject || id;

    await removeWithAudit(
      tenantId,
      "stakeholder_communications",
      id,
      userId,
      { action: "delete", description: `Communication "${commSubject}" deleted` },
      enqueueItem
    );
    await refreshCommunications();
  }, [tenantId, getCommunication, enqueueItem, refreshCommunications]);

  // Template operations
  const refreshTemplates = useCallback(async () => {
    if (!tenantId) return;
    try {
      const all = await getAll<CommTemplate>(tenantId, "communication_templates");
      setTemplates(all);
    } catch (error) {
      console.error("Failed to refresh communication templates:", error);
    }
  }, [tenantId]);

  const getTemplate = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    return getById<CommTemplate>(tenantId, "communication_templates", id);
  }, [tenantId]);

  const addTemplate = useCallback(async (template: CommTemplate, userId?: string) => {
    if (!tenantId) return;

    // ✅ Config validation
    if (!config.channels.includes(template.channel)) {
      throw new Error(`Invalid template channel: ${template.channel}`);
    }
    if (!config.audiences.includes(template.audience)) {
      throw new Error(`Invalid template audience: ${template.audience}`);
    }

    await putWithAudit(
      tenantId,
      "communication_templates",
      template,
      userId,
      { action: "create", description: `Communication template "${template.name}" created` },
      enqueueItem
    );
    await refreshTemplates();
  }, [tenantId, config, enqueueItem, refreshTemplates]);

  const updateTemplate = useCallback(async (template: CommTemplate, userId?: string) => {
    await putWithAudit(
      tenantId,
      "communication_templates",
      template,
      userId,
      { action: "update", description: `Communication template "${template.name}" updated` },
      enqueueItem
    );
    await refreshTemplates();
  }, [tenantId, enqueueItem, refreshTemplates]);

  const deleteTemplate = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) return;

    const template = await getTemplate(id);
    const templateName = template?.name || id;

    await removeWithAudit(
      tenantId,
      "communication_templates",
      id,
      userId,
      { action: "delete", description: `Communication template "${templateName}" deleted` },
      enqueueItem
    );
    await refreshTemplates();
  }, [tenantId, getTemplate, enqueueItem, refreshTemplates]);

  // Communication-specific operations
  const sendCommunication = useCallback(async (commId: string, userId?: string) => {
    const comm = await getCommunication(commId);
    if (!comm) return;

    const updatedComm = {
      ...comm,
      status: "sent" as CommStatus,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await updateCommunication(updatedComm, userId);
  }, [getCommunication, updateCommunication]);

  const scheduleCommunication = useCallback(async (commId: string, scheduledAt: string, userId?: string) => {
    const comm = await getCommunication(commId);
    if (!comm) return;

    const updatedComm = {
      ...comm,
      status: "scheduled" as CommStatus,
      scheduled_at: scheduledAt,
      updated_at: new Date().toISOString(),
    };

    await updateCommunication(updatedComm, userId);
  }, [getCommunication, updateCommunication]);

  const cancelCommunication = useCallback(async (commId: string, userId: string, reason?: string) => {
    const comm = await getCommunication(commId);
    if (!comm) return;

    const updatedComm = {
      ...comm,
      status: "cancelled" as CommStatus,
      updated_at: new Date().toISOString(),
      custom_fields: {
        ...comm.custom_fields,
        cancellation_reason: reason,
        cancelled_by: userId,
      },
    };

    await updateCommunication(updatedComm, userId);
  }, [getCommunication, updateCommunication]);

  const retryCommunication = useCallback(async (commId: string, userId?: string) => {
    const comm = await getCommunication(commId);
    if (!comm || comm.retry_count >= comm.max_retries) return;

    const updatedComm = {
      ...comm,
      status: "sent" as CommStatus,
      retry_count: comm.retry_count + 1,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await updateCommunication(updatedComm, userId);
  }, [getCommunication, updateCommunication]);

  const approveCommunication = useCallback(async (commId: string, approverId: string, comments?: string) => {
    const comm = await getCommunication(commId);
    if (!comm) return;

    const updatedComm = {
      ...comm,
      approval_status: "approved" as const,
      approved_by: approverId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      custom_fields: {
        ...comm.custom_fields,
        approval_comments: comments,
      },
    };

    await updateCommunication(updatedComm, approverId);
  }, [getCommunication, updateCommunication]);

  const rejectCommunication = useCallback(async (commId: string, reviewerId: string, reason: string) => {
    const comm = await getCommunication(commId);
    if (!comm) return;

    const updatedComm = {
      ...comm,
      approval_status: "rejected" as const,
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
      custom_fields: {
        ...comm.custom_fields,
        rejected_by: reviewerId,
      },
    };

    await updateCommunication(updatedComm, reviewerId);
  }, [getCommunication, updateCommunication]);

  const markAsRead = useCallback(async (commId: string, recipientId: string) => {
    const comm = await getCommunication(commId);
    if (!comm) return;

    const updatedRecipients = comm.recipients.map(r => 
      r.id === recipientId 
        ? { ...r, delivery_status: "read" as const, read_at: new Date().toISOString() }
        : r
    );

    const readCount = updatedRecipients.filter(r => r.delivery_status === "read").length;

    const updatedComm = {
      ...comm,
      recipients: updatedRecipients,
      read_count: readCount,
      updated_at: new Date().toISOString(),
    };

    await updateCommunication(updatedComm);
  }, [getCommunication, updateCommunication]);

  const createFromTemplate = useCallback(async (templateId: string, entityId: string, entityType: string, overrides?: Partial<StakeholderComm>): Promise<StakeholderComm> => {
    const template = await getTemplate(templateId);
    if (!template) throw new Error("Template not found");

    const newComm: StakeholderComm = {
      id: `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      related_entity_id: entityId,
      related_entity_type: entityType as any,
      audience: template.audience,
      channel: template.channel,
      priority: "normal",
      status: "draft",
      subject: template.subject_template,
      message: template.body_template,
      template_id: templateId,
      personalized: false,
      recipients: [],
      total_recipients: 0,
      successful_deliveries: 0,
      failed_deliveries: 0,
      read_count: 0,
      requires_approval: false,
      retry_count: 0,
      max_retries: 3,
      retry_delay_minutes: 30,
      is_public_facing: false,
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      health_status: "green",
      sync_status: "dirty",
      tenantId: tenantId!,
      ...overrides,
    };

    return newComm;
  }, [getTemplate, tenantId]);

  // Filtering functions
  const getCommunicationsByEntity = useCallback((entityId: string, entityType: string) => {
    return communications.filter(c => 
      c.related_entity_id === entityId && c.related_entity_type === entityType
    );
  }, [communications]);

  const getCommunicationsByChannel = useCallback((channel: CommChannel) => {
    return communications.filter(c => c.channel === channel);
  }, [communications]);

  const getCommunicationsByAudience = useCallback((audience: CommAudience) => {
    return communications.filter(c => c.audience === audience);
  }, [communications]);

  const getCommunicationsByStatus = useCallback((status: CommStatus) => {
    return communications.filter(c => c.status === status);
  }, [communications]);

  const getCommunicationsBySender = useCallback((senderId: string) => {
    return communications.filter(c => 
      c.sender_user_id === senderId || c.sender_team_id === senderId
    );
  }, [communications]);

  const getPendingApprovals = useCallback(() => {
    return communications.filter(c => 
      c.requires_approval && c.approval_status === "pending"
    );
  }, [communications]);

  const getScheduledCommunications = useCallback(() => {
    return communications.filter(c => c.status === "scheduled");
  }, [communications]);

  const getFailedCommunications = useCallback(() => {
    return communications.filter(c => c.status === "failed");
  }, [communications]);

  const getCommunicationsNeedingFollowUp = useCallback(() => {
    return communications.filter(c => c.follow_up_required === true);
  }, [communications]);

  const searchCommunications = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return communications.filter(c => 
      c.subject.toLowerCase().includes(lowerQuery) ||
      c.message.toLowerCase().includes(lowerQuery) ||
      c.audience.toLowerCase().includes(lowerQuery) ||
      c.channel.toLowerCase().includes(lowerQuery) ||
      c.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }, [communications]);

  const getCommunicationStats = useCallback((timeframe: "day" | "week" | "month" = "week") => {
    const cutoffDate = new Date();
    switch (timeframe) {
      case "day":
        cutoffDate.setDate(cutoffDate.getDate() - 1);
        break;
      case "week":
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        break;
      case "month":
        cutoffDate.setMonth(cutoffDate.getMonth() - 1);
        break;
    }
    
    const recentComms = communications.filter(c => 
      new Date(c.created_at) >= cutoffDate
    );

    const totalSent = recentComms.filter(c => c.status === "sent" || c.status === "delivered").length;
    const delivered = recentComms.reduce((sum, c) => sum + c.successful_deliveries, 0);
    const totalRecipients = recentComms.reduce((sum, c) => sum + c.total_recipients, 0);
    const totalReads = recentComms.reduce((sum, c) => sum + c.read_count, 0);
    const totalResponses = recentComms.reduce((sum, c) => sum + (c.response_count || 0), 0);

    const channelBreakdown = recentComms.reduce((acc, c) => {
      acc[c.channel] = (acc[c.channel] || 0) + 1;
      return acc;
    }, {} as Record<CommChannel, number>);

    const audienceBreakdown = recentComms.reduce((acc, c) => {
      acc[c.audience] = (acc[c.audience] || 0) + 1;
      return acc;
    }, {} as Record<CommAudience, number>);

    return {
      totalSent,
      deliveryRate: totalRecipients > 0 ? delivered / totalRecipients : 0,
      openRate: totalRecipients > 0 ? totalReads / totalRecipients : 0,
      responseRate: totalRecipients > 0 ? totalResponses / totalRecipients : 0,
      channelBreakdown,
      audienceBreakdown,
    };
  }, [communications]);

  // Initialize
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshCommunications();
      refreshTemplates();
    }
  }, [tenantId, globalConfig, refreshCommunications, refreshTemplates]);

  return (
    <StakeholderCommsContext.Provider
      value={{
        communications,
        templates,
        addCommunication,
        updateCommunication,
        deleteCommunication,
        refreshCommunications,
        getCommunication,
        addTemplate,
        updateTemplate,
        deleteTemplate,
        refreshTemplates,
        getTemplate,
        sendCommunication,
        scheduleCommunication,
        cancelCommunication,
        retryCommunication,
        approveCommunication,
        rejectCommunication,
        markAsRead,
        createFromTemplate,
        getCommunicationsByEntity,
        getCommunicationsByChannel,
        getCommunicationsByAudience,
        getCommunicationsByStatus,
        getCommunicationsBySender,
        getPendingApprovals,
        getScheduledCommunications,
        getFailedCommunications,
        getCommunicationsNeedingFollowUp,
        searchCommunications,
        getCommunicationStats,
        config,
      }}
    >
      {children}
    </StakeholderCommsContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------
export const useStakeholderComms = () => {
  const ctx = useContext(StakeholderCommsContext);
  if (!ctx) throw new Error("useStakeholderComms must be used within StakeholderCommsProvider");
  return ctx;
};

export const useStakeholderCommDetails = (id: string) => {
  const { communications } = useStakeholderComms();
  return communications.find((c) => c.id === id) || null;
};

export const useCommTemplate = (id: string) => {
  const { templates } = useStakeholderComms();
  return templates.find((t) => t.id === id) || null;
};

export const useEntityComms = (entityId: string, entityType: StakeholderComm["related_entity_type"]) => {
  const { getCommunicationsByEntity } = useStakeholderComms();
  return getCommunicationsByEntity(entityId, entityType);
};

// Utility hooks
export const usePendingApprovals = () => {
  const { getPendingApprovals } = useStakeholderComms();
  return getPendingApprovals();
};

export const useScheduledCommunications = () => {
  const { getScheduledCommunications } = useStakeholderComms();
  return getScheduledCommunications();
};

export const useFailedCommunications = () => {
  const { getFailedCommunications } = useStakeholderComms();
  return getFailedCommunications();
};

export const useCommunicationStats = (timeframe?: "day" | "week" | "month") => {
  const { getCommunicationStats } = useStakeholderComms();
  return getCommunicationStats(timeframe);
};