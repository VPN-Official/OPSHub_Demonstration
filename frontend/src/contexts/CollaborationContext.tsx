// src/contexts/CollaborationContext.tsx
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
import { useAuth } from "../providers/AuthProvider";
import { useRealtimeStream } from "./RealtimeStreamContext";
import { useOfflineCapability } from "./OfflineCapabilityContext";

// ---------------------------------
// 1. User and Team Types
// ---------------------------------

export interface ActiveUser {
  userId: string;
  username: string;
  email?: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  currentEntity?: { type: string; id: string };
  lastActivity: string;
  avatar?: string;
  role?: string;
  team?: string;
  skills?: string[];
}

export interface TeamPresenceStatus {
  teamId: string;
  teamName: string;
  onlineCount: number;
  totalMembers: number;
  availability: number; // percentage
  members: TeamMember[];
}

export interface TeamMember {
  userId: string;
  username: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  currentWorkload?: number;
  activeIncidents?: number;
  lastSeen?: string;
}

export interface UserActivity {
  id: string;
  userId: string;
  username?: string;
  activityType: 'view' | 'edit' | 'comment' | 'assign' | 'resolve' | 'escalate';
  entityType?: string;
  entityId?: string;
  timestamp: string;
  description: string;
  metadata?: Record<string, any>;
}

// ---------------------------------
// 2. Communication Types
// ---------------------------------

export interface ChatSession {
  id: string;
  entityType?: string;
  entityId?: string;
  title?: string;
  participants: string[];
  messages: ChatMessage[];
  createdAt: string;
  createdBy: string;
  lastMessageAt?: string;
  status: 'active' | 'archived' | 'closed';
  unreadCount?: Record<string, number>;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  userId: string;
  username?: string;
  message: string;
  timestamp: string;
  editedAt?: string;
  attachments?: MessageAttachment[];
  reactions?: MessageReaction[];
  replyTo?: string;
  mentions?: string[];
  status?: 'sent' | 'delivered' | 'read';
}

export interface MessageAttachment {
  id: string;
  type: 'file' | 'image' | 'link' | 'code';
  name: string;
  url: string;
  size?: number;
  mimeType?: string;
  thumbnail?: string;
}

export interface MessageReaction {
  emoji: string;
  userId: string;
  timestamp: string;
}

export interface CollaborationNotification {
  id: string;
  type: 'mention' | 'handoff' | 'approval' | 'assistance' | 'assignment' | 'escalation';
  from: string;
  fromUsername?: string;
  to: string;
  message: string;
  entityRef?: { type: string; id: string; name?: string };
  timestamp: string;
  read: boolean;
  actionRequired?: boolean;
  priority?: 'urgent' | 'high' | 'normal' | 'low';
}

export interface Mention {
  id: string;
  userId: string;
  mentionedBy: string;
  mentionedByUsername?: string;
  context: string;
  entityType?: string;
  entityId?: string;
  timestamp: string;
  resolved: boolean;
}

// ---------------------------------
// 3. Handoff and Assignment Types
// ---------------------------------

export interface HandoffRequest {
  id: string;
  workItemId: string;
  workItemType: string;
  workItemTitle?: string;
  fromUser: string;
  fromUsername?: string;
  toUser?: string;
  toTeam?: string;
  notes: string;
  context?: Record<string, any>;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  requestedAt: string;
  respondedAt?: string;
  responseNotes?: string;
  expiresAt?: string;
}

export interface AssignmentHistory {
  id: string;
  entityType: string;
  entityId: string;
  entityTitle?: string;
  assignedTo: string;
  assignedToUsername?: string;
  assignedBy: string;
  assignedByUsername?: string;
  assignedAt: string;
  unassignedAt?: string;
  duration?: number; // minutes
  reason?: string;
  outcome?: 'resolved' | 'escalated' | 'transferred' | 'cancelled';
}

export interface EscalationStatus {
  id: string;
  entityType: string;
  entityId: string;
  entityTitle?: string;
  currentLevel: number;
  maxLevel: number;
  escalationPath: EscalationLevel[];
  escalatedTo: string;
  escalatedBy: string;
  escalatedAt: string;
  reason: string;
  expectedResolution?: string;
  autoEscalated: boolean;
}

export interface EscalationLevel {
  level: number;
  userId?: string;
  teamId?: string;
  name: string;
  sla?: number; // minutes
  reached?: boolean;
  reachedAt?: string;
}

// ---------------------------------
// 4. Approval Workflow Types
// ---------------------------------

export interface ApprovalChain {
  id: string;
  entityType: string;
  entityId: string;
  entityTitle?: string;
  templateId?: string;
  approvers: ApprovalNode[];
  currentStep: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
  createdBy: string;
  createdAt: string;
  completedAt?: string;
  expiresAt?: string;
  metadata?: Record<string, any>;
}

export interface ApprovalNode {
  userId: string;
  username?: string;
  role?: string;
  order: number;
  required: boolean;
  decision?: 'approved' | 'rejected' | 'abstained';
  comments?: string;
  decidedAt?: string;
  delegatedTo?: string;
  conditions?: ApprovalCondition[];
}

export interface ApprovalCondition {
  field: string;
  operator: 'equals' | 'greater' | 'less' | 'contains' | 'in';
  value: any;
}

export interface PendingApproval {
  id: string;
  chainId: string;
  entityType: string;
  entityId: string;
  entityTitle?: string;
  requestedBy: string;
  requestedByUsername?: string;
  requestedAt: string;
  dueBy?: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  description?: string;
  canDelegate: boolean;
}

export interface ApprovalDecision {
  decision: 'approved' | 'rejected' | 'abstained';
  comments?: string;
  conditions?: string[];
  delegateTo?: string;
}

// ---------------------------------
// 5. Team Coordination Types
// ---------------------------------

export interface PresenceStatus {
  status: 'online' | 'away' | 'busy' | 'offline';
  message?: string;
  autoReply?: boolean;
  returnTime?: string;
}

export interface AssistanceRequest {
  id: string;
  workItemId: string;
  workItemType: string;
  workItemTitle?: string;
  requestedBy: string;
  requestedByUsername?: string;
  expertise: string[];
  description: string;
  urgency: 'immediate' | 'urgent' | 'normal' | 'low';
  status: 'open' | 'assigned' | 'resolved' | 'cancelled';
  requestedAt: string;
  assignedTo?: string;
  resolvedAt?: string;
  resolution?: string;
}

export interface TeamAnnouncement {
  id: string;
  teamId?: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'alert' | 'success';
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
  acknowledged: string[]; // user IDs who acknowledged
  pinned: boolean;
}

// ---------------------------------
// 6. Collaboration Context Interface
// ---------------------------------

export interface CollaborationContextProps {
  // Real-time collaboration state
  activeUsers: ActiveUser[];
  teamPresence: TeamPresenceStatus[];
  userActivity: UserActivity[];
  currentUserStatus: PresenceStatus;
  
  // Chat and communication
  chatSessions: ChatSession[];
  notifications: CollaborationNotification[];
  mentions: Mention[];
  announcements: TeamAnnouncement[];
  
  // Handoff and assignment management  
  handoffQueue: HandoffRequest[];
  assignmentHistory: AssignmentHistory[];
  escalationStatus: EscalationStatus[];
  assistanceRequests: AssistanceRequest[];
  
  // Collaboration actions
  startChatSession: (entityId?: string, entityType?: string, participants?: string[]) => Promise<ChatSession>;
  sendMessage: (sessionId: string, message: string, attachments?: File[]) => Promise<void>;
  editMessage: (messageId: string, newMessage: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  
  // Handoff management
  requestHandoff: (workItemId: string, workItemType: string, target: string, notes: string) => Promise<void>;
  acceptHandoff: (handoffId: string, notes?: string) => Promise<void>;
  rejectHandoff: (handoffId: string, reason: string) => Promise<void>;
  cancelHandoff: (handoffId: string) => Promise<void>;
  
  // Team coordination
  announcePresence: (status: PresenceStatus) => void;
  requestAssistance: (workItemId: string, workItemType: string, expertise: string[], description: string) => Promise<void>;
  offerAssistance: (requestId: string) => Promise<void>;
  postAnnouncement: (announcement: Omit<TeamAnnouncement, 'id' | 'createdBy' | 'createdAt' | 'acknowledged'>) => Promise<void>;
  acknowledgeAnnouncement: (announcementId: string) => Promise<void>;
  
  // Approval workflows
  approvalChains: ApprovalChain[];
  pendingApprovals: PendingApproval[];
  submitForApproval: (entityId: string, entityType: string, approvers: ApprovalNode[]) => Promise<void>;
  processApproval: (approvalId: string, decision: ApprovalDecision) => Promise<void>;
  delegateApproval: (approvalId: string, delegateTo: string) => Promise<void>;
  
  // Notification management
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  clearNotifications: (type?: string) => Promise<void>;
  
  // User and team queries
  findUser: (query: string) => ActiveUser[];
  getTeamMembers: (teamId: string) => TeamMember[];
  getUserActivity: (userId: string, limit?: number) => UserActivity[];
  getEntityCollaborators: (entityType: string, entityId: string) => ActiveUser[];
}

// ---------------------------------
// 7. Collaboration Engine
// ---------------------------------

class CollaborationEngine {
  private presenceMap: Map<string, PresenceStatus> = new Map();
  private activityLog: UserActivity[] = [];
  private sessionParticipants: Map<string, Set<string>> = new Map();
  private typingIndicators: Map<string, Set<string>> = new Map();
  
  public updatePresence(userId: string, status: PresenceStatus): void {
    this.presenceMap.set(userId, status);
  }
  
  public getPresence(userId: string): PresenceStatus | undefined {
    return this.presenceMap.get(userId);
  }
  
  public logActivity(activity: UserActivity): void {
    this.activityLog.unshift(activity);
    // Keep only last 1000 activities
    if (this.activityLog.length > 1000) {
      this.activityLog = this.activityLog.slice(0, 1000);
    }
  }
  
  public getUserActivities(userId: string, limit: number = 50): UserActivity[] {
    return this.activityLog
      .filter(a => a.userId === userId)
      .slice(0, limit);
  }
  
  public getEntityActivities(entityType: string, entityId: string, limit: number = 50): UserActivity[] {
    return this.activityLog
      .filter(a => a.entityType === entityType && a.entityId === entityId)
      .slice(0, limit);
  }
  
  public joinSession(sessionId: string, userId: string): void {
    if (!this.sessionParticipants.has(sessionId)) {
      this.sessionParticipants.set(sessionId, new Set());
    }
    this.sessionParticipants.get(sessionId)!.add(userId);
  }
  
  public leaveSession(sessionId: string, userId: string): void {
    this.sessionParticipants.get(sessionId)?.delete(userId);
  }
  
  public getSessionParticipants(sessionId: string): string[] {
    return Array.from(this.sessionParticipants.get(sessionId) || []);
  }
  
  public setTyping(sessionId: string, userId: string, isTyping: boolean): void {
    if (!this.typingIndicators.has(sessionId)) {
      this.typingIndicators.set(sessionId, new Set());
    }
    
    if (isTyping) {
      this.typingIndicators.get(sessionId)!.add(userId);
    } else {
      this.typingIndicators.get(sessionId)?.delete(userId);
    }
  }
  
  public getTypingUsers(sessionId: string): string[] {
    return Array.from(this.typingIndicators.get(sessionId) || []);
  }
  
  public generateHandoffContext(workItem: any): Record<string, any> {
    return {
      priority: workItem.priority,
      age: Date.now() - new Date(workItem.createdAt).getTime(),
      lastUpdated: workItem.updatedAt,
      tags: workItem.tags,
      relatedItems: workItem.relatedItems,
    };
  }
  
  public calculateEscalationPath(
    entityType: string,
    priority: string,
    currentLevel: number = 0
  ): EscalationLevel[] {
    const basePath: EscalationLevel[] = [
      { level: 1, name: 'Level 1 Support', sla: 30 },
      { level: 2, name: 'Level 2 Support', sla: 60 },
      { level: 3, name: 'Level 3 Support', sla: 120 },
      { level: 4, name: 'Management', sla: 240 },
    ];
    
    // Adjust based on priority
    if (priority === 'urgent' || priority === 'critical') {
      basePath.forEach(level => {
        level.sla = level.sla ? level.sla / 2 : undefined;
      });
    }
    
    return basePath;
  }
  
  public determineApprovers(
    entityType: string,
    entityData: any
  ): ApprovalNode[] {
    const approvers: ApprovalNode[] = [];
    
    // Add approvers based on entity type and data
    if (entityType === 'change') {
      approvers.push({
        userId: 'cab_member_1',
        username: 'CAB Member',
        role: 'Change Advisory Board',
        order: 1,
        required: true,
      });
      
      if (entityData.risk === 'high') {
        approvers.push({
          userId: 'manager_1',
          username: 'IT Manager',
          role: 'Management',
          order: 2,
          required: true,
        });
      }
    }
    
    return approvers;
  }
}

// ---------------------------------
// 8. Provider Component
// ---------------------------------

const CollaborationContext = createContext<CollaborationContextProps | null>(null);

export const CollaborationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { subscribeToEntity, onEntityUpdate, connectionStatus } = useRealtimeStream();
  const { isOnline, enqueueAction } = useOfflineCapability();
  
  // State management
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [teamPresence, setTeamPresence] = useState<TeamPresenceStatus[]>([]);
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);
  const [currentUserStatus, setCurrentUserStatus] = useState<PresenceStatus>({
    status: 'online',
  });
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [notifications, setNotifications] = useState<CollaborationNotification[]>([]);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [announcements, setAnnouncements] = useState<TeamAnnouncement[]>([]);
  const [handoffQueue, setHandoffQueue] = useState<HandoffRequest[]>([]);
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentHistory[]>([]);
  const [escalationStatus, setEscalationStatus] = useState<EscalationStatus[]>([]);
  const [assistanceRequests, setAssistanceRequests] = useState<AssistanceRequest[]>([]);
  const [approvalChains, setApprovalChains] = useState<ApprovalChain[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  
  // Collaboration engine
  const collaborationEngine = useRef(new CollaborationEngine());
  
  // Initialize collaboration data
  useEffect(() => {
    if (!tenantId || !user) return;
    
    const loadCollaborationData = async () => {
      try {
        // Load from database
        const [sessions, notifs, handoffs, approvals] = await Promise.all([
          getAll('chat_sessions', tenantId),
          getAll('notifications', tenantId),
          getAll('handoff_requests', tenantId),
          getAll('approval_chains', tenantId),
        ]);
        
        setChatSessions(sessions);
        setNotifications(notifs.filter((n: any) => n.to === user.id));
        setHandoffQueue(handoffs);
        setApprovalChains(approvals);
        
        // Filter pending approvals for current user
        const pending = approvals
          .filter((chain: ApprovalChain) => 
            chain.status === 'pending' &&
            chain.approvers.some(node => 
              node.userId === user.id && !node.decision
            )
          )
          .map((chain: ApprovalChain) => ({
            id: `pending_${chain.id}`,
            chainId: chain.id,
            entityType: chain.entityType,
            entityId: chain.entityId,
            entityTitle: chain.entityTitle,
            requestedBy: chain.createdBy,
            requestedAt: chain.createdAt,
            dueBy: chain.expiresAt,
            priority: 'normal' as const,
            canDelegate: true,
          }));
        
        setPendingApprovals(pending);
        
      } catch (error) {
        console.error('[Collaboration] Failed to load data:', error);
      }
    };
    
    loadCollaborationData();
  }, [tenantId, user]);
  
  // Update presence based on connection status
  useEffect(() => {
    if (!user) return;
    
    const status = connectionStatus === 'connected' ? 'online' :
                  connectionStatus === 'reconnecting' ? 'away' : 'offline';
    
    setCurrentUserStatus(prev => ({ ...prev, status }));
    
    // Broadcast presence
    if (isOnline) {
      collaborationEngine.current.updatePresence(user.id, { status });
    }
  }, [connectionStatus, user, isOnline]);
  
  // Simulate active users and team presence
  useEffect(() => {
    if (!user) return;
    
    // Mock active users
    const mockUsers: ActiveUser[] = [
      {
        userId: user.id,
        username: user.name || user.email,
        email: user.email,
        status: currentUserStatus.status,
        lastActivity: new Date().toISOString(),
        role: user.role,
        team: 'Operations',
      },
      {
        userId: 'user_2',
        username: 'Sarah Chen',
        email: 'sarah@example.com',
        status: 'online',
        currentEntity: { type: 'incident', id: 'INC001' },
        lastActivity: new Date().toISOString(),
        role: 'Senior Engineer',
        team: 'Operations',
        skills: ['kubernetes', 'aws', 'python'],
      },
      {
        userId: 'user_3',
        username: 'Mike Johnson',
        email: 'mike@example.com',
        status: 'busy',
        currentEntity: { type: 'change', id: 'CHG001' },
        lastActivity: new Date(Date.now() - 300000).toISOString(),
        role: 'Team Lead',
        team: 'Operations',
        skills: ['management', 'itil', 'azure'],
      },
      {
        userId: 'user_4',
        username: 'Emily Davis',
        email: 'emily@example.com',
        status: 'away',
        lastActivity: new Date(Date.now() - 900000).toISOString(),
        role: 'Engineer',
        team: 'Development',
        skills: ['react', 'nodejs', 'mongodb'],
      },
    ];
    
    setActiveUsers(mockUsers);
    
    // Calculate team presence
    const teams = new Map<string, TeamPresenceStatus>();
    
    mockUsers.forEach(user => {
      const teamId = user.team || 'unassigned';
      if (!teams.has(teamId)) {
        teams.set(teamId, {
          teamId,
          teamName: teamId,
          onlineCount: 0,
          totalMembers: 0,
          availability: 0,
          members: [],
        });
      }
      
      const team = teams.get(teamId)!;
      team.totalMembers++;
      if (user.status === 'online' || user.status === 'busy') {
        team.onlineCount++;
      }
      
      team.members.push({
        userId: user.userId,
        username: user.username,
        status: user.status,
        lastSeen: user.lastActivity,
      });
    });
    
    teams.forEach(team => {
      team.availability = (team.onlineCount / team.totalMembers) * 100;
    });
    
    setTeamPresence(Array.from(teams.values()));
    
  }, [user, currentUserStatus]);
  
  // Chat and communication
  const startChatSession = useCallback(async (
    entityId?: string,
    entityType?: string,
    participants: string[] = []
  ): Promise<ChatSession> => {
    if (!user) throw new Error('User not authenticated');
    
    const session: ChatSession = {
      id: `chat_${Date.now()}`,
      entityType,
      entityId,
      title: entityType && entityId ? `${entityType} ${entityId}` : 'Direct Chat',
      participants: [user.id, ...participants],
      messages: [],
      createdAt: new Date().toISOString(),
      createdBy: user.id,
      status: 'active',
      unreadCount: {},
    };
    
    setChatSessions(prev => [...prev, session]);
    
    // Save to database
    await putWithAudit('chat_sessions', session.id, session, user.id);
    
    // Join session
    collaborationEngine.current.joinSession(session.id, user.id);
    
    return session;
  }, [user]);
  
  const sendMessage = useCallback(async (
    sessionId: string,
    message: string,
    attachments: File[] = []
  ): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    
    const session = chatSessions.find(s => s.id === sessionId);
    if (!session) throw new Error('Session not found');
    
    // Process attachments
    const messageAttachments: MessageAttachment[] = [];
    for (const file of attachments) {
      // In real implementation, upload file and get URL
      messageAttachments.push({
        id: `attach_${Date.now()}`,
        type: file.type.startsWith('image/') ? 'image' : 'file',
        name: file.name,
        url: URL.createObjectURL(file),
        size: file.size,
        mimeType: file.type,
      });
    }
    
    // Extract mentions
    const mentionPattern = /@(\w+)/g;
    const mentionedUsers: string[] = [];
    let match;
    while ((match = mentionPattern.exec(message)) !== null) {
      mentionedUsers.push(match[1]);
    }
    
    const chatMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      sessionId,
      userId: user.id,
      username: user.name || user.email,
      message,
      timestamp: new Date().toISOString(),
      attachments: messageAttachments,
      mentions: mentionedUsers,
      status: isOnline ? 'sent' : 'delivered',
    };
    
    // Update session
    setChatSessions(prev => prev.map(s => 
      s.id === sessionId 
        ? { 
            ...s, 
            messages: [...s.messages, chatMessage],
            lastMessageAt: chatMessage.timestamp,
          }
        : s
    ));
    
    // Create mentions
    mentionedUsers.forEach(mentionedUser => {
      const mention: Mention = {
        id: `mention_${Date.now()}_${mentionedUser}`,
        userId: mentionedUser,
        mentionedBy: user.id,
        mentionedByUsername: user.name || user.email,
        context: message.substring(0, 100),
        entityType: session.entityType,
        entityId: session.entityId,
        timestamp: chatMessage.timestamp,
        resolved: false,
      };
      
      setMentions(prev => [...prev, mention]);
      
      // Create notification for mentioned user
      const notification: CollaborationNotification = {
        id: `notif_${Date.now()}`,
        type: 'mention',
        from: user.id,
        fromUsername: user.name || user.email,
        to: mentionedUser,
        message: `You were mentioned: "${message.substring(0, 50)}..."`,
        entityRef: session.entityId ? {
          type: session.entityType!,
          id: session.entityId,
          name: session.title,
        } : undefined,
        timestamp: chatMessage.timestamp,
        read: false,
        actionRequired: false,
      };
      
      setNotifications(prev => [...prev, notification]);
    });
    
    // Save or queue message
    if (isOnline) {
      await putWithAudit('chat_messages', chatMessage.id, chatMessage, user.id);
    } else {
      await enqueueAction({
        actionType: 'send_message',
        entityType: 'chat',
        entityId: sessionId,
        payload: chatMessage,
        priority: 'normal',
      });
    }
  }, [user, chatSessions, isOnline, enqueueAction]);
  
  const editMessage = useCallback(async (
    messageId: string,
    newMessage: string
  ): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    
    setChatSessions(prev => prev.map(session => ({
      ...session,
      messages: session.messages.map(msg => 
        msg.id === messageId && msg.userId === user.id
          ? { ...msg, message: newMessage, editedAt: new Date().toISOString() }
          : msg
      ),
    })));
    
    if (isOnline) {
      await putWithAudit('chat_messages', messageId, { message: newMessage, editedAt: new Date().toISOString() }, user.id);
    }
  }, [user, isOnline]);
  
  const deleteMessage = useCallback(async (messageId: string): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    
    setChatSessions(prev => prev.map(session => ({
      ...session,
      messages: session.messages.filter(msg => 
        !(msg.id === messageId && msg.userId === user.id)
      ),
    })));
    
    if (isOnline) {
      await removeWithAudit('chat_messages', messageId, user.id);
    }
  }, [user, isOnline]);
  
  const addReaction = useCallback(async (
    messageId: string,
    emoji: string
  ): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    
    setChatSessions(prev => prev.map(session => ({
      ...session,
      messages: session.messages.map(msg => {
        if (msg.id === messageId) {
          const reactions = msg.reactions || [];
          const existingReaction = reactions.find(r => r.userId === user.id);
          
          if (existingReaction) {
            // Update existing reaction
            return {
              ...msg,
              reactions: reactions.map(r => 
                r.userId === user.id ? { ...r, emoji } : r
              ),
            };
          } else {
            // Add new reaction
            return {
              ...msg,
              reactions: [...reactions, { emoji, userId: user.id, timestamp: new Date().toISOString() }],
            };
          }
        }
        return msg;
      }),
    })));
  }, [user]);
  
  // Handoff management
  const requestHandoff = useCallback(async (
    workItemId: string,
    workItemType: string,
    target: string,
    notes: string
  ): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    
    const handoff: HandoffRequest = {
      id: `handoff_${Date.now()}`,
      workItemId,
      workItemType,
      fromUser: user.id,
      fromUsername: user.name || user.email,
      toUser: target.startsWith('user_') ? target : undefined,
      toTeam: !target.startsWith('user_') ? target : undefined,
      notes,
      priority: 'normal',
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };
    
    setHandoffQueue(prev => [...prev, handoff]);
    
    // Create notification
    const notification: CollaborationNotification = {
      id: `notif_${Date.now()}`,
      type: 'handoff',
      from: user.id,
      fromUsername: user.name || user.email,
      to: target,
      message: `Handoff requested for ${workItemType} ${workItemId}`,
      entityRef: { type: workItemType, id: workItemId },
      timestamp: handoff.requestedAt,
      read: false,
      actionRequired: true,
      priority: handoff.priority,
    };
    
    setNotifications(prev => [...prev, notification]);
    
    if (isOnline) {
      await putWithAudit('handoff_requests', handoff.id, handoff, user.id);
    } else {
      await enqueueAction({
        actionType: 'request_handoff',
        entityType: workItemType,
        entityId: workItemId,
        payload: handoff,
        priority: 'normal',
      });
    }
  }, [user, isOnline, enqueueAction]);
  
  const acceptHandoff = useCallback(async (
    handoffId: string,
    notes?: string
  ): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    
    setHandoffQueue(prev => prev.map(h => 
      h.id === handoffId 
        ? { 
            ...h, 
            status: 'accepted', 
            respondedAt: new Date().toISOString(),
            responseNotes: notes,
          }
        : h
    ));
    
    const handoff = handoffQueue.find(h => h.id === handoffId);
    if (handoff) {
      // Create assignment history
      const assignment: AssignmentHistory = {
        id: `assign_${Date.now()}`,
        entityType: handoff.workItemType,
        entityId: handoff.workItemId,
        assignedTo: user.id,
        assignedToUsername: user.name || user.email,
        assignedBy: handoff.fromUser,
        assignedByUsername: handoff.fromUsername,
        assignedAt: new Date().toISOString(),
        reason: 'Handoff accepted',
      };
      
      setAssignmentHistory(prev => [...prev, assignment]);
    }
    
    if (isOnline) {
      await putWithAudit('handoff_requests', handoffId, { status: 'accepted', responseNotes: notes }, user.id);
    }
  }, [user, handoffQueue, isOnline]);
  
  const rejectHandoff = useCallback(async (
    handoffId: string,
    reason: string
  ): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    
    setHandoffQueue(prev => prev.map(h => 
      h.id === handoffId 
        ? { 
            ...h, 
            status: 'rejected', 
            respondedAt: new Date().toISOString(),
            responseNotes: reason,
          }
        : h
    ));
    
    if (isOnline) {
      await putWithAudit('handoff_requests', handoffId, { status: 'rejected', responseNotes: reason }, user.id);
    }
  }, [user, isOnline]);
  
  const cancelHandoff = useCallback(async (handoffId: string): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    
    setHandoffQueue(prev => prev.map(h => 
      h.id === handoffId && h.fromUser === user.id
        ? { ...h, status: 'cancelled' }
        : h
    ));
    
    if (isOnline) {
      await putWithAudit('handoff_requests', handoffId, { status: 'cancelled' }, user.id);
    }
  }, [user, isOnline]);
  
  // Team coordination
  const announcePresence = useCallback((status: PresenceStatus): void => {
    setCurrentUserStatus(status);
    
    if (user) {
      collaborationEngine.current.updatePresence(user.id, status);
      
      // Log activity
      const activity: UserActivity = {
        id: `activity_${Date.now()}`,
        userId: user.id,
        username: user.name || user.email,
        activityType: 'edit',
        timestamp: new Date().toISOString(),
        description: `Status changed to ${status.status}`,
      };
      
      collaborationEngine.current.logActivity(activity);
      setUserActivity(prev => [activity, ...prev].slice(0, 100));
    }
  }, [user]);
  
  const requestAssistance = useCallback(async (
    workItemId: string,
    workItemType: string,
    expertise: string[],
    description: string
  ): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    
    const request: AssistanceRequest = {
      id: `assist_${Date.now()}`,
      workItemId,
      workItemType,
      requestedBy: user.id,
      requestedByUsername: user.name || user.email,
      expertise,
      description,
      urgency: 'normal',
      status: 'open',
      requestedAt: new Date().toISOString(),
    };
    
    setAssistanceRequests(prev => [...prev, request]);
    
    // Notify team members with matching skills
    const matchingUsers = activeUsers.filter(u => 
      u.skills?.some(skill => expertise.includes(skill))
    );
    
    matchingUsers.forEach(targetUser => {
      const notification: CollaborationNotification = {
        id: `notif_${Date.now()}_${targetUser.userId}`,
        type: 'assistance',
        from: user.id,
        fromUsername: user.name || user.email,
        to: targetUser.userId,
        message: `Assistance needed: ${expertise.join(', ')}`,
        entityRef: { type: workItemType, id: workItemId },
        timestamp: request.requestedAt,
        read: false,
        actionRequired: true,
      };
      
      setNotifications(prev => [...prev, notification]);
    });
    
    if (isOnline) {
      await putWithAudit('assistance_requests', request.id, request, user.id);
    }
  }, [user, activeUsers, isOnline]);
  
  const offerAssistance = useCallback(async (requestId: string): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    
    setAssistanceRequests(prev => prev.map(r => 
      r.id === requestId 
        ? { 
            ...r, 
            status: 'assigned', 
            assignedTo: user.id,
            resolvedAt: new Date().toISOString(),
          }
        : r
    ));
    
    if (isOnline) {
      await putWithAudit('assistance_requests', requestId, { status: 'assigned', assignedTo: user.id }, user.id);
    }
  }, [user, isOnline]);
  
  const postAnnouncement = useCallback(async (
    announcement: Omit<TeamAnnouncement, 'id' | 'createdBy' | 'createdAt' | 'acknowledged'>
  ): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    
    const newAnnouncement: TeamAnnouncement = {
      ...announcement,
      id: `announce_${Date.now()}`,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      acknowledged: [],
    };
    
    setAnnouncements(prev => [newAnnouncement, ...prev]);
    
    if (isOnline) {
      await putWithAudit('announcements', newAnnouncement.id, newAnnouncement, user.id);
    }
  }, [user, isOnline]);
  
  const acknowledgeAnnouncement = useCallback(async (announcementId: string): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    
    setAnnouncements(prev => prev.map(a => 
      a.id === announcementId 
        ? { 
            ...a, 
            acknowledged: [...new Set([...a.acknowledged, user.id])],
          }
        : a
    ));
    
    if (isOnline) {
      const announcement = announcements.find(a => a.id === announcementId);
      if (announcement) {
        await putWithAudit('announcements', announcementId, {
          acknowledged: [...new Set([...announcement.acknowledged, user.id])],
        }, user.id);
      }
    }
  }, [user, announcements, isOnline]);
  
  // Approval workflows
  const submitForApproval = useCallback(async (
    entityId: string,
    entityType: string,
    approvers: ApprovalNode[]
  ): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    
    const chain: ApprovalChain = {
      id: `approval_${Date.now()}`,
      entityType,
      entityId,
      approvers,
      currentStep: 0,
      status: 'pending',
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    
    setApprovalChains(prev => [...prev, chain]);
    
    // Create pending approvals for first approver
    const firstApprover = approvers[0];
    if (firstApprover) {
      const pending: PendingApproval = {
        id: `pending_${chain.id}_${firstApprover.userId}`,
        chainId: chain.id,
        entityType,
        entityId,
        requestedBy: user.id,
        requestedByUsername: user.name || user.email,
        requestedAt: chain.createdAt,
        priority: 'normal',
        canDelegate: true,
      };
      
      setPendingApprovals(prev => [...prev, pending]);
      
      // Notify approver
      const notification: CollaborationNotification = {
        id: `notif_${Date.now()}`,
        type: 'approval',
        from: user.id,
        fromUsername: user.name || user.email,
        to: firstApprover.userId,
        message: `Approval required for ${entityType} ${entityId}`,
        entityRef: { type: entityType, id: entityId },
        timestamp: chain.createdAt,
        read: false,
        actionRequired: true,
        priority: 'normal',
      };
      
      setNotifications(prev => [...prev, notification]);
    }
    
    if (isOnline) {
      await putWithAudit('approval_chains', chain.id, chain, user.id);
    }
  }, [user, isOnline]);
  
  const processApproval = useCallback(async (
    approvalId: string,
    decision: ApprovalDecision
  ): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    
    const pending = pendingApprovals.find(p => p.id === approvalId);
    if (!pending) throw new Error('Approval not found');
    
    const chain = approvalChains.find(c => c.id === pending.chainId);
    if (!chain) throw new Error('Approval chain not found');
    
    // Update chain
    setApprovalChains(prev => prev.map(c => {
      if (c.id === chain.id) {
        const updatedApprovers = c.approvers.map(a => 
          a.userId === user.id 
            ? { ...a, decision: decision.decision, comments: decision.comments, decidedAt: new Date().toISOString() }
            : a
        );
        
        // Check if chain is complete
        const allDecided = updatedApprovers.every(a => a.decision);
        const anyRejected = updatedApprovers.some(a => a.decision === 'rejected');
        
        return {
          ...c,
          approvers: updatedApprovers,
          currentStep: c.currentStep + 1,
          status: anyRejected ? 'rejected' : allDecided ? 'approved' : 'pending',
          completedAt: allDecided ? new Date().toISOString() : undefined,
        };
      }
      return c;
    }));
    
    // Remove from pending
    setPendingApprovals(prev => prev.filter(p => p.id !== approvalId));
    
    // If approved and more approvers, create next pending
    if (decision.decision === 'approved' && chain.currentStep + 1 < chain.approvers.length) {
      const nextApprover = chain.approvers[chain.currentStep + 1];
      const nextPending: PendingApproval = {
        id: `pending_${chain.id}_${nextApprover.userId}`,
        chainId: chain.id,
        entityType: chain.entityType,
        entityId: chain.entityId,
        requestedBy: chain.createdBy,
        requestedAt: new Date().toISOString(),
        priority: 'normal',
        canDelegate: true,
      };
      
      setPendingApprovals(prev => [...prev, nextPending]);
    }
    
    if (isOnline) {
      await putWithAudit('approval_chains', chain.id, { 
        approvers: chain.approvers,
        currentStep: chain.currentStep + 1,
        status: chain.status,
      }, user.id);
    }
  }, [user, pendingApprovals, approvalChains, isOnline]);
  
  const delegateApproval = useCallback(async (
    approvalId: string,
    delegateTo: string
  ): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    
    const pending = pendingApprovals.find(p => p.id === approvalId);
    if (!pending) throw new Error('Approval not found');
    
    // Update chain
    setApprovalChains(prev => prev.map(c => {
      if (c.id === pending.chainId) {
        return {
          ...c,
          approvers: c.approvers.map(a => 
            a.userId === user.id 
              ? { ...a, delegatedTo: delegateTo }
              : a
          ),
        };
      }
      return c;
    }));
    
    // Update pending approval
    setPendingApprovals(prev => prev.map(p => 
      p.id === approvalId 
        ? { ...p, to: delegateTo }
        : p
    ));
    
    if (isOnline) {
      const chain = approvalChains.find(c => c.id === pending.chainId);
      if (chain) {
        await putWithAudit('approval_chains', chain.id, { approvers: chain.approvers }, user.id);
      }
    }
  }, [user, pendingApprovals, approvalChains, isOnline]);
  
  // Notification management
  const markNotificationRead = useCallback(async (notificationId: string): Promise<void> => {
    setNotifications(prev => prev.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    ));
    
    if (isOnline) {
      await putWithAudit('notifications', notificationId, { read: true }, user?.id || 'system');
    }
  }, [isOnline, user]);
  
  const markAllNotificationsRead = useCallback(async (): Promise<void> => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    
    if (isOnline && user) {
      const unreadNotifs = notifications.filter(n => !n.read && n.to === user.id);
      for (const notif of unreadNotifs) {
        await putWithAudit('notifications', notif.id, { read: true }, user.id);
      }
    }
  }, [notifications, isOnline, user]);
  
  const clearNotifications = useCallback(async (type?: string): Promise<void> => {
    setNotifications(prev => 
      type ? prev.filter(n => n.type !== type) : []
    );
  }, []);
  
  // User and team queries
  const findUser = useCallback((query: string): ActiveUser[] => {
    const lowerQuery = query.toLowerCase();
    return activeUsers.filter(u => 
      u.username.toLowerCase().includes(lowerQuery) ||
      u.email?.toLowerCase().includes(lowerQuery) ||
      u.role?.toLowerCase().includes(lowerQuery) ||
      u.skills?.some(s => s.toLowerCase().includes(lowerQuery))
    );
  }, [activeUsers]);
  
  const getTeamMembers = useCallback((teamId: string): TeamMember[] => {
    const team = teamPresence.find(t => t.teamId === teamId);
    return team?.members || [];
  }, [teamPresence]);
  
  const getUserActivity = useCallback((userId: string, limit: number = 50): UserActivity[] => {
    return collaborationEngine.current.getUserActivities(userId, limit);
  }, []);
  
  const getEntityCollaborators = useCallback((
    entityType: string,
    entityId: string
  ): ActiveUser[] => {
    // Get users who have activity on this entity
    const activities = collaborationEngine.current.getEntityActivities(entityType, entityId);
    const userIds = new Set(activities.map(a => a.userId));
    
    return activeUsers.filter(u => userIds.has(u.userId));
  }, [activeUsers]);
  
  // Log user activities
  useEffect(() => {
    if (!user) return;
    
    const logActivity = (activity: Omit<UserActivity, 'id' | 'timestamp'>) => {
      const fullActivity: UserActivity = {
        ...activity,
        id: `activity_${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
      
      collaborationEngine.current.logActivity(fullActivity);
      setUserActivity(prev => [fullActivity, ...prev].slice(0, 100));
    };
    
    // Subscribe to entity updates for activity logging
    const unsubscribe = onEntityUpdate((update) => {
      logActivity({
        userId: user.id,
        username: user.name || user.email,
        activityType: update.updateType === 'created' ? 'edit' : 'view',
        entityType: update.entityType,
        entityId: update.entityId,
        description: `${update.updateType} ${update.entityType}`,
      });
    });
    
    return unsubscribe;
  }, [user, onEntityUpdate]);
  
  // Memoized context value
  const value = useMemo<CollaborationContextProps>(() => ({
    // State
    activeUsers,
    teamPresence,
    userActivity,
    currentUserStatus,
    chatSessions,
    notifications,
    mentions,
    announcements,
    handoffQueue,
    assignmentHistory,
    escalationStatus,
    assistanceRequests,
    approvalChains,
    pendingApprovals,
    
    // Actions
    startChatSession,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    requestHandoff,
    acceptHandoff,
    rejectHandoff,
    cancelHandoff,
    announcePresence,
    requestAssistance,
    offerAssistance,
    postAnnouncement,
    acknowledgeAnnouncement,
    submitForApproval,
    processApproval,
    delegateApproval,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    findUser,
    getTeamMembers,
    getUserActivity,
    getEntityCollaborators,
  }), [
    activeUsers,
    teamPresence,
    userActivity,
    currentUserStatus,
    chatSessions,
    notifications,
    mentions,
    announcements,
    handoffQueue,
    assignmentHistory,
    escalationStatus,
    assistanceRequests,
    approvalChains,
    pendingApprovals,
    startChatSession,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    requestHandoff,
    acceptHandoff,
    rejectHandoff,
    cancelHandoff,
    announcePresence,
    requestAssistance,
    offerAssistance,
    postAnnouncement,
    acknowledgeAnnouncement,
    submitForApproval,
    processApproval,
    delegateApproval,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    findUser,
    getTeamMembers,
    getUserActivity,
    getEntityCollaborators,
  ]);
  
  return (
    <CollaborationContext.Provider value={value}>
      {children}
    </CollaborationContext.Provider>
  );
};

// ---------------------------------
// 9. Custom Hooks
// ---------------------------------

export const useCollaboration = (): CollaborationContextProps => {
  const context = useContext(CollaborationContext);
  if (!context) {
    throw new Error('useCollaboration must be used within CollaborationProvider');
  }
  return context;
};

export const useTeamPresence = (teamId?: string) => {
  const { teamPresence, activeUsers } = useCollaboration();
  
  const team = teamId 
    ? teamPresence.find(t => t.teamId === teamId)
    : teamPresence[0];
  
  const onlineMembers = team 
    ? activeUsers.filter(u => 
        u.team === team.teamName && 
        (u.status === 'online' || u.status === 'busy')
      )
    : [];
  
  return {
    team,
    onlineMembers,
    availability: team?.availability || 0,
    isAvailable: (team?.availability || 0) > 50,
  };
};

export const useChat = (entityType?: string, entityId?: string) => {
  const {
    chatSessions,
    startChatSession,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
  } = useCollaboration();
  
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (!entityType || !entityId) return;
    
    // Find existing session for entity
    const existingSession = chatSessions.find(s => 
      s.entityType === entityType && s.entityId === entityId
    );
    
    if (existingSession) {
      setCurrentSession(existingSession);
    }
  }, [entityType, entityId, chatSessions]);
  
  const startChat = useCallback(async (participants?: string[]) => {
    setLoading(true);
    try {
      const session = await startChatSession(entityId, entityType, participants);
      setCurrentSession(session);
      return session;
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, startChatSession]);
  
  const send = useCallback(async (message: string, attachments?: File[]) => {
    if (!currentSession) {
      const session = await startChat();
      if (session) {
        await sendMessage(session.id, message, attachments);
      }
    } else {
      await sendMessage(currentSession.id, message, attachments);
    }
  }, [currentSession, startChat, sendMessage]);
  
  return {
    session: currentSession,
    messages: currentSession?.messages || [],
    loading,
    startChat,
    send,
    edit: editMessage,
    delete: deleteMessage,
    react: addReaction,
  };
};

export const useNotifications = () => {
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
  } = useCollaboration();
  
  const unreadCount = notifications.filter(n => !n.read).length;
  const hasUnread = unreadCount > 0;
  
  const byType = useMemo(() => {
    const grouped: Record<string, CollaborationNotification[]> = {};
    notifications.forEach(n => {
      if (!grouped[n.type]) {
        grouped[n.type] = [];
      }
      grouped[n.type].push(n);
    });
    return grouped;
  }, [notifications]);
  
  return {
    notifications,
    unreadCount,
    hasUnread,
    byType,
    markRead: markNotificationRead,
    markAllRead: markAllNotificationsRead,
    clear: clearNotifications,
  };
};

export const useApprovals = () => {
  const {
    pendingApprovals,
    approvalChains,
    submitForApproval,
    processApproval,
    delegateApproval,
  } = useCollaboration();
  
  const [processing, setProcessing] = useState<string | null>(null);
  
  const approve = useCallback(async (approvalId: string, comments?: string) => {
    setProcessing(approvalId);
    try {
      await processApproval(approvalId, {
        decision: 'approved',
        comments,
      });
    } finally {
      setProcessing(null);
    }
  }, [processApproval]);
  
  const reject = useCallback(async (approvalId: string, comments: string) => {
    setProcessing(approvalId);
    try {
      await processApproval(approvalId, {
        decision: 'rejected',
        comments,
      });
    } finally {
      setProcessing(null);
    }
  }, [processApproval]);
  
  const delegate = useCallback(async (approvalId: string, userId: string) => {
    setProcessing(approvalId);
    try {
      await delegateApproval(approvalId, userId);
    } finally {
      setProcessing(null);
    }
  }, [delegateApproval]);
  
  return {
    pendingApprovals,
    approvalChains,
    processing,
    submitForApproval,
    approve,
    reject,
    delegate,
    hasPending: pendingApprovals.length > 0,
  };
};