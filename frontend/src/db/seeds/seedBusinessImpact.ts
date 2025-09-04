// src/db/seeds/seedBusinessImpact.ts
import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedBusinessImpact = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  const businessImpacts: any[] = [];
  const slaStatuses: any[] = [];
  const dependencyMaps: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    // Business Impact Assessments
    businessImpacts.push(
      {
        id: `${tenantId}_impact001`,
        tenantId,
        entityType: "incident",
        entityId: `${tenantId}_inc01`,
        impactType: "service_degradation",
        severity: "high",
        businessServices: [`${tenantId}_svc_internet`],
        metrics: {
          users_affected: 5000,
          revenue_impact_per_hour: 25000,
          productivity_loss_hours: 150,
          brand_reputation_score: -5
        },
        cascadeEffects: [
          {
            serviceId: `${tenantId}_svc_vpn`,
            impact: "partial",
            probability: 0.8,
            description: "VPN services rely on BGP for routing"
          },
          {
            serviceId: `${tenantId}_svc_cloud_access`,
            impact: "degraded",
            probability: 0.6,
            description: "Cloud connectivity may be rerouted"
          }
        ],
        timeline: {
          detected: now,
          business_impact_start: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          estimated_resolution: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        },
        mitigation: {
          available: true,
          description: "Traffic rerouted through secondary BGP peer",
          effectiveness: 0.7,
          implementation_time_minutes: 15
        },
        compliance_implications: [
          {
            framework: "SOC2",
            control: "Availability",
            status: "at_risk",
            notes: "Service availability SLA may be breached"
          }
        ],
        calculatedAt: now
      },
      {
        id: `${tenantId}_impact002`,
        tenantId,
        entityType: "asset",
        entityId: `${tenantId}_asset_exchange01`,
        impactType: "capacity_constraint",
        severity: "medium",
        businessServices: [`${tenantId}_svc_email`],
        metrics: {
          users_affected: 5000,
          service_degradation_percent: 20,
          email_delay_minutes: 5,
          support_tickets_expected: 50
        },
        cascadeEffects: [
          {
            serviceId: `${tenantId}_svc_calendar`,
            impact: "minor",
            probability: 0.3,
            description: "Calendar sync may be delayed"
          }
        ],
        timeline: {
          detected: now,
          business_impact_start: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          estimated_resolution: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
        },
        mitigation: {
          available: true,
          description: "Archive old emails and expand storage",
          effectiveness: 0.9,
          implementation_time_minutes: 120
        },
        compliance_implications: [],
        calculatedAt: now
      }
    );

    // SLA Status
    slaStatuses.push(
      {
        id: `${tenantId}_sla001`,
        tenantId,
        serviceId: `${tenantId}_svc_internet`,
        slaName: "Internet Connectivity SLA",
        target: 99.9,
        current: 99.7,
        period: "monthly",
        status: "at_risk",
        breachThreshold: 99.9,
        measurements: {
          uptime_percent: 99.7,
          mttr_minutes: 45,
          mttr_target: 30,
          incidents_count: 3,
          incidents_threshold: 5
        },
        penalties: {
          type: "credit",
          amount_per_breach: 5000,
          current_liability: 2500
        },
        nextReview: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        reportingPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        reportingPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: now
      },
      {
        id: `${tenantId}_sla002`,
        tenantId,
        serviceId: `${tenantId}_svc_email`,
        slaName: "Email Service SLA",
        target: 99.5,
        current: 99.8,
        period: "monthly",
        status: "healthy",
        breachThreshold: 99.5,
        measurements: {
          uptime_percent: 99.8,
          delivery_time_seconds: 3,
          delivery_target: 5,
          mailbox_availability: 99.9
        },
        penalties: {
          type: "credit",
          amount_per_breach: 2500,
          current_liability: 0
        },
        nextReview: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        reportingPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        reportingPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: now
      }
    );

    // Dependency Maps
    dependencyMaps.push(
      {
        id: `${tenantId}_depmap001`,
        tenantId,
        serviceId: `${tenantId}_svc_internet`,
        name: "Internet Service Dependencies",
        dependencies: [
          {
            type: "service_component",
            id: `${tenantId}_comp_bgp_gateway`,
            criticality: "critical",
            redundancy: "active-passive",
            failoverTime: 30
          },
          {
            type: "asset",
            id: `${tenantId}_asset_router01`,
            criticality: "critical",
            redundancy: "active-active",
            failoverTime: 0
          },
          {
            type: "asset",
            id: `${tenantId}_asset_router02`,
            criticality: "critical",
            redundancy: "active-active",
            failoverTime: 0
          },
          {
            type: "vendor",
            id: `${tenantId}_vendor_att`,
            criticality: "high",
            redundancy: "multi-vendor",
            sla: 99.9
          }
        ],
        impactRadius: {
          direct: 5,
          indirect: 12,
          total: 17
        },
        riskScore: 72,
        lastValidated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: now
      }
    );
  } else if (tenantId === "tenant_aws_financial") {
    businessImpacts.push(
      {
        id: `${tenantId}_impact001`,
        tenantId,
        entityType: "business_service",
        entityId: `${tenantId}_svc_trading`,
        impactType: "latency_degradation",
        severity: "critical",
        businessServices: [`${tenantId}_svc_trading`],
        metrics: {
          revenue_impact_per_minute: 5000,
          trades_delayed: 150,
          competitive_disadvantage_score: 8,
          regulatory_risk: "medium"
        },
        cascadeEffects: [
          {
            serviceId: `${tenantId}_svc_risk_management`,
            impact: "delayed_calculations",
            probability: 1.0,
            description: "Risk calculations depend on real-time trade data"
          },
          {
            serviceId: `${tenantId}_svc_reporting`,
            impact: "stale_data",
            probability: 0.7,
            description: "Reports may show outdated positions"
          }
        ],
        timeline: {
          detected: now,
          business_impact_start: now,
          estimated_resolution: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        },
        mitigation: {
          available: true,
          description: "Route critical trades through low-latency path",
          effectiveness: 0.8,
          implementation_time_minutes: 5
        },
        compliance_implications: [
          {
            framework: "MiFID II",
            control: "Best Execution",
            status: "breached",
            notes: "Latency exceeds best execution requirements"
          },
          {
            framework: "SEC",
            control: "Fair Access",
            status: "at_risk",
            notes: "Some clients experiencing disadvantage"
          }
        ],
        calculatedAt: now
      }
    );

    slaStatuses.push(
      {
        id: `${tenantId}_sla001`,
        tenantId,
        serviceId: `${tenantId}_svc_trading`,
        slaName: "Trading Platform SLA",
        target: 99.99,
        current: 99.98,
        period: "daily",
        status: "warning",
        breachThreshold: 99.99,
        measurements: {
          uptime_percent: 99.98,
          latency_p99_ms: 25,
          latency_target_ms: 20,
          order_success_rate: 99.95
        },
        penalties: {
          type: "refund",
          amount_per_breach: 50000,
          current_liability: 0
        },
        nextReview: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        reportingPeriodStart: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        reportingPeriodEnd: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        updatedAt: now
      }
    );
  } else if (tenantId === "tenant_ecommerce") {
    businessImpacts.push(
      {
        id: `${tenantId}_impact001`,
        tenantId,
        entityType: "business_service",
        entityId: `${tenantId}_svc_checkout`,
        impactType: "conversion_loss",
        severity: "high",
        businessServices: [`${tenantId}_svc_checkout`],
        metrics: {
          conversion_rate_drop: 15,
          abandoned_carts: 450,
          revenue_loss: 67500,
          customer_satisfaction_drop: 12
        },
        cascadeEffects: [
          {
            serviceId: `${tenantId}_svc_inventory`,
            impact: "reservation_timeout",
            probability: 0.4,
            description: "Reserved items may be released"
          },
          {
            serviceId: `${tenantId}_svc_fulfillment`,
            impact: "delayed_processing",
            probability: 0.2,
            description: "Order queue may be impacted"
          }
        ],
        timeline: {
          detected: now,
          business_impact_start: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
          estimated_resolution: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        },
        mitigation: {
          available: true,
          description: "Enable checkout queue and retry mechanism",
          effectiveness: 0.6,
          implementation_time_minutes: 20
        },
        compliance_implications: [
          {
            framework: "PCI-DSS",
            control: "Availability",
            status: "compliant",
            notes: "Payment processing still secure despite delays"
          }
        ],
        calculatedAt: now
      }
    );

    slaStatuses.push(
      {
        id: `${tenantId}_sla001`,
        tenantId,
        serviceId: `${tenantId}_svc_website`,
        slaName: "Website Availability SLA",
        target: 99.95,
        current: 99.96,
        period: "monthly",
        status: "healthy",
        breachThreshold: 99.95,
        measurements: {
          uptime_percent: 99.96,
          page_load_time_seconds: 2.1,
          page_load_target: 3,
          error_rate: 0.02
        },
        penalties: {
          type: "credit",
          amount_per_breach: 10000,
          current_liability: 0
        },
        nextReview: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        reportingPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        reportingPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: now
      }
    );
  }

  // Cost tracking
  const costImpacts = [
    {
      id: `${tenantId}_cost001`,
      tenantId,
      entityType: "incident",
      entityId: `${tenantId}_inc01`,
      costType: "operational",
      amount: 25000,
      currency: "USD",
      breakdown: {
        labor: 5000,
        lost_revenue: 15000,
        sla_penalty: 2500,
        emergency_resources: 2500
      },
      period: "per_hour",
      actualCost: 12500,
      projectedCost: 25000,
      costCenter: `${tenantId}_cc_operations`,
      approvedBy: `${tenantId}_user_cfo`,
      calculatedAt: now
    }
  ];

  // Store business impact data
  for (const impact of businessImpacts) {
    await db.put("businessImpacts", impact);
  }
  for (const sla of slaStatuses) {
    await db.put("slaStatuses", sla);
  }
  for (const depMap of dependencyMaps) {
    await db.put("dependencyMaps", depMap);
  }
  for (const cost of costImpacts) {
    await db.put("costImpacts", cost);
  }

  console.log(`Seeded business impact data for ${tenantId}: ${businessImpacts.length} impacts, ${slaStatuses.length} SLAs, ${dependencyMaps.length} dependency maps, ${costImpacts.length} cost impacts`);
  return { businessImpacts, slaStatuses, dependencyMaps, costImpacts };
};