// src/db/seeds/seedCollaboration.ts
import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedCollaboration = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  const activeUsers: any[] = [];
  const chatSessions: any[] = [];
  const handoffs: any[] = [];
  const approvals: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    // Active Users/Presence
    activeUsers.push(
      {
        id: `${tenantId}_presence001`,
        tenantId,
        userId: `${tenantId}_user_netops01`,
        username: "John Smith",
        status: "online",
        statusMessage: "Working on BGP issue",
        currentEntity: {
          type: "incident",
          id: `${tenantId}_inc01`,
          label: "BGP Peering Down"
        },
        location: {
          page: "/incidents/inc01",
          component: "incident-details"
        },
        lastActivity: now,
        activeTime: 3600, // seconds
        avatar: "/avatars/john.jpg",
        role: "Network Engineer",
        team: `${tenantId}_team_network`,
        capabilities: ["network", "routing", "bgp", "cisco"]
      },
      {
        id: `${tenantId}_presence002`,
        tenantId,
        userId: `${tenantId}_user_sysadmin01`,
        username: "Sarah Johnson",
        status: "busy",
        statusMessage: "In maintenance window",
        currentEntity: {
          type: "asset",
          id: `${tenantId}_asset_exchange01`,
          label: "Exchange Server"
        },
        location: {
          page: "/assets/exchange01",
          component: "maintenance-tasks"
        },
        lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        activeTime: 7200,
        avatar: "/avatars/sarah.jpg",
        role: "System Administrator",
        team: `${tenantId}_team_infrastructure`,
        capabilities: ["windows", "exchange", "active-directory"]
      },
      {
        id: `${tenantId}_presence003`,
        tenantId,
        userId: `${tenantId}_user_manager01`,
        username: "Mike Chen",
        status: "away",
        statusMessage: "Back in 15 minutes",
        currentEntity: null,
        location: {
          page: "/dashboard",
          component: "executive-dashboard"
        },
        lastActivity: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        activeTime: 1800,
        avatar: "/avatars/mike.jpg",
        role: "Operations Manager",
        team: `${tenantId}_team_management`,
        capabilities: ["management", "escalation", "approval"]
      }
    );

    // Chat Sessions
    chatSessions.push(
      {
        id: `${tenantId}_chat001`,
        tenantId,
        type: "entity_discussion",
        entityType: "incident",
        entityId: `${tenantId}_inc01`,
        title: "BGP Peering Issue Discussion",
        participants: [
          `${tenantId}_user_netops01`,
          `${tenantId}_user_netops02`,
          `${tenantId}_user_manager01`
        ],
        messages: [
          {
            id: `${tenantId}_msg001`,
            userId: `${tenantId}_user_netops01`,
            username: "John Smith",
            message: "BGP session is flapping. Seeing MTU errors in logs.",
            timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            attachments: [],
            reactions: [
              { emoji: "👍", userId: `${tenantId}_user_manager01` }
            ],
            edited: false
          },
          {
            id: `${tenantId}_msg002`,
            userId: `${tenantId}_user_netops02`,
            username: "Alice Brown",
            message: "I see the same pattern. Let me check the peer configuration.",
            timestamp: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
            attachments: [
              {
                type: "file",
                name: "bgp_config.txt",
                url: "/attachments/bgp_config.txt",
                size: 4096
              }
            ],
            reactions: [],
            edited: false
          },
          {
            id: `${tenantId}_msg003`,
            userId: `${tenantId}_user_manager01`,
            username: "Mike Chen",
            message: "@john.smith How long until we can implement the fix?",
            timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
            attachments: [],
            reactions: [],
            mentions: [`${tenantId}_user_netops01`],
            edited: false
          },
          {
            id: `${tenantId}_msg004`,
            userId: `${tenantId}_user_netops01`,
            username: "John Smith",
            message: "MTU mismatch confirmed. Need a 5-minute maintenance window to apply the fix.",
            timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
            attachments: [],
            reactions: [
              { emoji: "✅", userId: `${tenantId}_user_manager01` },
              { emoji: "🚀", userId: `${tenantId}_user_netops02` }
            ],
            edited: false
          }
        ],
        status: "active",
        createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        lastMessageAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        pinnedMessages: [`${tenantId}_msg004`]
      },
      {
        id: `${tenantId}_chat002`,
        tenantId,
        type: "war_room",
        title: "P1 Incident War Room",
        participants: [
          `${tenantId}_user_netops01`,
          `${tenantId}_user_sysadmin01`,
          `${tenantId}_user_manager01`,
          `${tenantId}_user_oncall01`
        ],
        messages: [
          {
            id: `${tenantId}_msg005`,
            userId: `${tenantId}_user_manager01`,
            username: "Mike Chen",
            message: "Starting P1 war room for BGP issue. All hands on deck.",
            timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
            attachments: [],
            reactions: [],
            isAnnouncement: true
          }
        ],
        status: "active",
        createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        lastMessageAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        metadata: {
          incident_id: `${tenantId}_inc01`,
          severity: "P1",
          bridge_number: "+1-555-0123",
          recording_url: "/recordings/war_room_001.mp3"
        }
      }
    );

    // Handoffs
    handoffs.push(
      {
        id: `${tenantId}_handoff001`,
        tenantId,
        workItemType: "incident",
        workItemId: `${tenantId}_inc01`,
        fromUser: `${tenantId}_user_netops03`,
        fromUsername: "Bob Wilson",
        toUser: `${tenantId}_user_netops01`,
        toUsername: "John Smith",
        reason: "shift_change",
        notes: "BGP issue ongoing. MTU mismatch suspected. Failover to secondary peer active.",
        attachments: [
          {
            type: "runbook",
            id: `${tenantId}_runbook_bgp`,
            name: "BGP Troubleshooting Runbook"
          }
        ],
        priority: "urgent",
        status: "accepted",
        requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        acceptedAt: new Date(Date.now() - 1.9 * 60 * 60 * 1000).toISOString(),
        completedAt: new Date(Date.now() - 1.9 * 60 * 60 * 1000).toISOString()
      },
      {
        id: `${tenantId}_handoff002`,
        tenantId,
        workItemType: "change_request",
        workItemId: `${tenantId}_chr002`,
        fromUser: `${tenantId}_user_sysadmin01`,
        fromUsername: "Sarah Johnson",
        toTeam: `${tenantId}_team_infrastructure`,
        reason: "expertise_needed",
        notes: "Need Exchange specialist for mail store optimization",
        priority: "normal",
        status: "pending",
        requestedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        skillsRequired: ["exchange", "powershell", "storage"]
      }
    );

    // Approvals
    approvals.push(
      {
        id: `${tenantId}_approval001`,
        tenantId,
        entityType: "change_request",
        entityId: `${tenantId}_chr001`,
        title: "Emergency BGP Configuration Change",
        requestedBy: `${tenantId}_user_netops01`,
        requestedByName: "John Smith",
        approvalChain: [
          {
            userId: `${tenantId}_user_manager01`,
            username: "Mike Chen",
            role: "Operations Manager",
            order: 1,
            decision: "approved",
            comments: "Approved for emergency fix",
            decidedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            required: true
          },
          {
            userId: `${tenantId}_user_cab01`,
            username: "CAB Member",
            role: "Change Advisory Board",
            order: 2,
            decision: null,
            comments: null,
            decidedAt: null,
            required: true
          }
        ],
        currentStep: 2,
        status: "pending",
        priority: "urgent",
        dueBy: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        businessJustification: "Critical BGP peering failure affecting internet connectivity",
        riskAssessment: {
          level: "medium",
          mitigation: "Tested in lab environment, rollback plan ready"
        },
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        metadata: {
          change_window: "emergency",
          rollback_time: "5 minutes",
          testing_completed: true
        }
      }
    );

    // Team Activity
    const teamActivity = [
      {
        id: `${tenantId}_activity001`,
        tenantId,
        userId: `${tenantId}_user_netops01`,
        activityType: "entity_view",
        entityType: "incident",
        entityId: `${tenantId}_inc01`,
        description: "Viewing incident: BGP Peering Down",
        timestamp: now,
        duration: 120
      },
      {
        id: `${tenantId}_activity002`,
        tenantId,
        userId: `${tenantId}_user_sysadmin01`,
        activityType: "entity_edit",
        entityType: "asset",
        entityId: `${tenantId}_asset_exchange01`,
        description: "Updated Exchange server configuration",
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        duration: 300,
        changes: {
          disk_quota: { old: "1TB", new: "1.5TB" }
        }
      }
    ];

    // Assistance Requests
    const assistanceRequests = [
      {
        id: `${tenantId}_assist001`,
        tenantId,
        requestedBy: `${tenantId}_user_netops01`,
        workItemType: "incident",
        workItemId: `${tenantId}_inc01`,
        expertiseNeeded: ["bgp", "cisco", "routing"],
        urgency: "high",
        description: "Need BGP expert to review configuration",
        status: "fulfilled",
        respondedBy: `${tenantId}_user_netops02`,
        requestedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
        respondedAt: new Date(Date.now() - 38 * 60 * 1000).toISOString()
      }
    ];

    // Store collaboration data
    for (const user of activeUsers) {
      await db.put("activeUsers", user);
    }
    for (const chat of chatSessions) {
      await db.put("chatSessions", chat);
    }
    for (const handoff of handoffs) {
      await db.put("handoffs", handoff);
    }
    for (const approval of approvals) {
      await db.put("approvals", approval);
    }
    for (const activity of teamActivity) {
      await db.put("teamActivity", activity);
    }
    for (const request of assistanceRequests) {
      await db.put("assistanceRequests", request);
    }

  } else if (tenantId === "tenant_aws_financial") {
    activeUsers.push(
      {
        id: `${tenantId}_presence001`,
        tenantId,
        userId: `${tenantId}_user_trader01`,
        username: "David Lee",
        status: "online",
        statusMessage: "Monitoring trading platform",
        currentEntity: {
          type: "business_service",
          id: `${tenantId}_svc_trading`,
          label: "Trading Platform"
        },
        location: {
          page: "/services/trading",
          component: "realtime-monitoring"
        },
        lastActivity: now,
        activeTime: 14400,
        avatar: "/avatars/david.jpg",
        role: "Trading Platform Engineer",
        team: `${tenantId}_team_trading`,
        capabilities: ["trading", "latency", "java", "fix-protocol"]
      }
    );

    chatSessions.push(
      {
        id: `${tenantId}_chat001`,
        tenantId,
        type: "entity_discussion",
        entityType: "change_request",
        entityId: `${tenantId}_chr001`,
        title: "Trading Platform Optimization Discussion",
        participants: [
          `${tenantId}_user_trader01`,
          `${tenantId}_user_devops01`
        ],
        messages: [
          {
            id: `${tenantId}_msg001`,
            userId: `${tenantId}_user_trader01`,
            username: "David Lee",
            message: "Latency optimization ready for deployment. Need CAB approval.",
            timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
            attachments: [
              {
                type: "file",
                name: "performance_test_results.pdf",
                url: "/attachments/perf_test.pdf",
                size: 245760
              }
            ],
            reactions: [],
            edited: false
          }
        ],
        status: "active",
        createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        lastMessageAt: new Date(Date.now() - 45 * 60 * 1000).toISOString()
      }
    );
  } else if (tenantId === "tenant_ecommerce") {
    activeUsers.push(
      {
        id: `${tenantId}_presence001`,
        tenantId,
        userId: `${tenantId}_user_sre01`,
        username: "Emma Davis",
        status: "online",
        statusMessage: "Black Friday prep",
        currentEntity: {
          type: "business_service",
          id: `${tenantId}_svc_website`,
          label: "E-commerce Website"
        },
        location: {
          page: "/services/website",
          component: "capacity-planning"
        },
        lastActivity: now,
        activeTime: 7200,
        avatar: "/avatars/emma.jpg",
        role: "Site Reliability Engineer",
        team: `${tenantId}_team_sre`,
        capabilities: ["kubernetes", "scaling", "monitoring", "chaos-engineering"]
      }
    );

    approvals.push(
      {
        id: `${tenantId}_approval001`,
        tenantId,
        entityType: "scaling_request",
        entityId: `${tenantId}_scale001`,
        title: "Black Friday Capacity Scaling",
        requestedBy: `${tenantId}_user_sre01`,
        requestedByName: "Emma Davis",
        approvalChain: [
          {
            userId: `${tenantId}_user_manager01`,
            username: "Tech Lead",
            role: "Technical Lead",
            order: 1,
            decision: "approved",
            comments: "Scaling plan looks good",
            decidedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            required: true
          },
          {
            userId: `${tenantId}_user_finance01`,
            username: "Finance Manager",
            role: "Finance",
            order: 2,
            decision: "approved",
            comments: "Budget approved for peak season",
            decidedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
            required: true
          }
        ],
        currentStep: 3,
        status: "approved",
        priority: "high",
        businessJustification: "10x traffic expected for Black Friday sale",
        riskAssessment: {
          level: "low",
          mitigation: "Auto-scaling tested, CDN capacity reserved"
        },
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
      }
    );
  }

  console.log(`Seeded collaboration data for ${tenantId}`);
  return { activeUsers, chatSessions, handoffs, approvals };
};