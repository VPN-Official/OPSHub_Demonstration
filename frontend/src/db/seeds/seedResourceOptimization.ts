// src/db/seeds/seedResourceOptimization.ts
import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedResourceOptimization = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  const resourcePools: any[] = [];
  const resourceAllocations: any[] = [];
  const optimizationRecommendations: any[] = [];
  const scalingPolicies: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    // Resource Pools
    resourcePools.push(
      {
        id: `${tenantId}_pool001`,
        tenantId,
        name: "Data Center Compute Pool",
        type: "compute",
        totalCapacity: 1000,
        usedCapacity: 750,
        availableCapacity: 250,
        reservedCapacity: 100,
        unit: "vCPUs",
        costPerUnit: 0.05,
        location: "DC-WEST-1",
        provider: "on-premise",
        healthStatus: "healthy",
        metadata: {
          hypervisor: "VMware vSphere 7.0",
          cpu_model: "Intel Xeon Gold 6248",
          oversubscription_ratio: 3
        },
        allocations: [
          `${tenantId}_alloc001`,
          `${tenantId}_alloc002`,
          `${tenantId}_alloc003`
        ],
        updatedAt: now
      },
      {
        id: `${tenantId}_pool002`,
        tenantId,
        name: "Storage Pool - SAN",
        type: "storage",
        totalCapacity: 500,
        usedCapacity: 475,
        availableCapacity: 25,
        reservedCapacity: 50,
        unit: "TB",
        costPerUnit: 50,
        location: "DC-WEST-1",
        provider: "on-premise",
        healthStatus: "degraded",
        metadata: {
          storage_type: "SAN",
          raid_level: "RAID-10",
          iops_limit: 100000,
          deduplication_enabled: true,
          compression_ratio: 1.5
        },
        allocations: [
          `${tenantId}_alloc004`,
          `${tenantId}_alloc005`
        ],
        updatedAt: now
      },
      {
        id: `${tenantId}_pool003`,
        tenantId,
        name: "Network Bandwidth Pool",
        type: "network",
        totalCapacity: 10000,
        usedCapacity: 6000,
        availableCapacity: 4000,
        reservedCapacity: 500,
        unit: "Mbps",
        costPerUnit: 0.001,
        location: "DC-WEST-1",
        provider: "on-premise",
        healthStatus: "healthy",
        metadata: {
          link_type: "10G Ethernet",
          redundancy: "dual-path",
          qos_enabled: true
        },
        allocations: [],
        updatedAt: now
      }
    );

    // Resource Allocations
    resourceAllocations.push(
      {
        id: `${tenantId}_alloc001`,
        tenantId,
        resourceId: `${tenantId}_pool001`,
        resourceType: "cpu",
        allocatedTo: `${tenantId}_svc_internet`,
        allocationType: "service",
        amount: 200,
        unit: "vCPUs",
        utilization: 75,
        cost: 240, // per day
        priority: "critical",
        startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endTime: null,
        tags: ["production", "critical", "sla-bound"],
        metadata: {
          auto_scaling: true,
          min_allocation: 100,
          max_allocation: 400
        }
      },
      {
        id: `${tenantId}_alloc002`,
        tenantId,
        resourceId: `${tenantId}_pool001`,
        resourceType: "cpu",
        allocatedTo: `${tenantId}_svc_email`,
        allocationType: "service",
        amount: 300,
        unit: "vCPUs",
        utilization: 45,
        cost: 360,
        priority: "high",
        startTime: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        endTime: null,
        tags: ["production", "email"],
        metadata: {
          auto_scaling: false,
          peak_hours: "08:00-18:00"
        }
      },
      {
        id: `${tenantId}_alloc003`,
        tenantId,
        resourceId: `${tenantId}_pool001`,
        resourceType: "cpu",
        allocatedTo: `${tenantId}_team_development`,
        allocationType: "team",
        amount: 250,
        unit: "vCPUs",
        utilization: 20,
        cost: 300,
        priority: "low",
        startTime: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        endTime: null,
        tags: ["development", "non-production"],
        metadata: {
          shutdown_weekends: true,
          cost_center: "R&D"
        }
      },
      {
        id: `${tenantId}_alloc004`,
        tenantId,
        resourceId: `${tenantId}_pool002`,
        resourceType: "storage",
        allocatedTo: `${tenantId}_asset_exchange01`,
        allocationType: "entity",
        amount: 300,
        unit: "TB",
        utilization: 95,
        cost: 15000,
        priority: "critical",
        startTime: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        endTime: null,
        tags: ["production", "exchange", "email-storage"],
        metadata: {
          growth_rate: "1TB/week",
          retention_policy: "90 days"
        }
      }
    );

    // Optimization Recommendations
    optimizationRecommendations.push(
      {
        id: `${tenantId}_opt001`,
        tenantId,
        type: "rightsizing",
        resourceId: `${tenantId}_alloc002`,
        resourceType: "cpu",
        currentState: {
          allocation: 300,
          utilization: 45,
          cost: 360
        },
        recommendedState: {
          allocation: 150,
          utilization: 90,
          cost: 180
        },
        impact: {
          costSavings: 180,
          performanceGain: 0,
          riskScore: 0.2,
          implementationEffort: "low"
        },
        confidence: 0.88,
        reasoning: "Email service consistently uses only 45% of allocated CPU. Historical data shows peak usage never exceeds 60%.",
        automationAvailable: true,
        automationScriptId: `${tenantId}_script_rightsize_cpu`,
        approvalRequired: true,
        alternativeOptions: [
          {
            action: "Reduce to 200 vCPUs",
            savings: 120,
            risk: 0.1
          },
          {
            action: "Implement auto-scaling",
            savings: 150,
            risk: 0.3
          }
        ],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now
      },
      {
        id: `${tenantId}_opt002`,
        tenantId,
        type: "consolidation",
        resourceId: `${tenantId}_alloc003`,
        resourceType: "cpu",
        currentState: {
          allocation: 250,
          utilization: 20,
          cost: 300,
          environment: "dedicated"
        },
        recommendedState: {
          allocation: 50,
          utilization: 100,
          cost: 60,
          environment: "shared"
        },
        impact: {
          costSavings: 240,
          performanceGain: -5,
          riskScore: 0.4,
          implementationEffort: "medium"
        },
        confidence: 0.75,
        reasoning: "Development environment severely underutilized. Can be consolidated with other non-production workloads.",
        automationAvailable: false,
        approvalRequired: true,
        prerequisities: [
          "Migrate to container platform",
          "Implement resource quotas",
          "Update CI/CD pipelines"
        ],
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now
      },
      {
        id: `${tenantId}_opt003`,
        tenantId,
        type: "migration",
        resourceId: `${tenantId}_alloc004`,
        resourceType: "storage",
        currentState: {
          storageType: "SAN",
          performance: "high",
          cost: 15000
        },
        recommendedState: {
          storageType: "Object Storage + Archive",
          performance: "tiered",
          cost: 5000
        },
        impact: {
          costSavings: 10000,
          performanceGain: -10,
          riskScore: 0.5,
          implementationEffort: "high"
        },
        confidence: 0.82,
        reasoning: "Email archive data (>30 days) can be moved to cheaper object storage with minimal performance impact.",
        automationAvailable: true,
        automationScriptId: `${tenantId}_script_storage_tiering`,
        approvalRequired: true,
        implementationPlan: [
          "Analyze email access patterns",
          "Configure storage tiering policy",
          "Migrate historical data to archive tier",
          "Update Exchange configuration",
          "Monitor performance for 30 days"
        ],
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now
      }
    );

    // Auto-scaling Policies
    scalingPolicies.push(
      {
        id: `${tenantId}_scale001`,
        tenantId,
        name: "Internet Service Auto-scaling",
        resourcePoolId: `${tenantId}_pool001`,
        enabled: true,
        triggers: [
          {
            metric: "cpu_utilization",
            threshold: 80,
            operator: "gte",
            duration: 300 // 5 minutes
          },
          {
            metric: "response_time",
            threshold: 1000,
            operator: "gt",
            duration: 180 // 3 minutes
          }
        ],
        actions: [
          {
            type: "scale_out",
            amount: 50, // vCPUs
            cooldown: 600 // 10 minutes
          }
        ],
        scaleDownTriggers: [
          {
            metric: "cpu_utilization",
            threshold: 30,
            operator: "lt",
            duration: 1800 // 30 minutes
          }
        ],
        scaleDownActions: [
          {
            type: "scale_in",
            amount: 25,
            cooldown: 900 // 15 minutes
          }
        ],
        constraints: {
          minCapacity: 100,
          maxCapacity: 400,
          maxCostPerHour: 50,
          allowedTimeWindows: [
            { start: "00:00", end: "23:59" } // 24/7
          ],
          blackoutWindows: []
        },
        notifications: [
          `${tenantId}_user_netops01`,
          `${tenantId}_team_infrastructure`
        ],
        lastTriggered: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        history: [
          {
            timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
            trigger: "cpu_utilization >= 80%",
            action: "scale_out +50 vCPUs",
            result: "success",
            newCapacity: 250
          }
        ],
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: now
      }
    );

    // Capacity Forecasts
    const capacityForecasts = [
      {
        id: `${tenantId}_forecast001`,
        tenantId,
        resourceId: `${tenantId}_pool002`,
        resourceType: "storage",
        predictions: Array(30).fill(0).map((_, i) => ({
          timestamp: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString(),
          predictedUsage: 475 + (i * 1), // 1TB per day growth
          confidenceInterval: [475 + (i * 0.8), 475 + (i * 1.2)],
          probabilityOfExhaustion: i >= 25 ? (i - 24) * 0.2 : 0
        })),
        exhaustionDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
        recommendedAction: "Expand storage pool or implement aggressive archival",
        seasonalPatterns: [
          {
            period: "weekly",
            pattern: [1.2, 1.1, 1.0, 1.0, 1.3, 0.7, 0.6] // Mon-Sun multipliers
          }
        ],
        confidence: 0.87,
        modelType: "linear_regression_with_seasonality",
        lastUpdated: now
      }
    ];

    // Cost Optimizations
    const costOptimizations = [
      {
        id: `${tenantId}_costopt001`,
        tenantId,
        category: "underutilized",
        resourceIds: [`${tenantId}_alloc002`, `${tenantId}_alloc003`],
        currentCost: 660, // per day
        optimizedCost: 240,
        savingsAmount: 420,
        savingsPercentage: 63.6,
        implementationSteps: [
          "Analyze usage patterns for past 90 days",
          "Identify peak usage windows",
          "Right-size allocations based on P95 usage",
          "Implement auto-scaling for peak periods",
          "Monitor for 30 days post-implementation"
        ],
        automationScript: "scripts/rightsize_underutilized.sh",
        riskAssessment: {
          level: "low",
          factors: [
            "Temporary performance impact during resize",
            "Potential for insufficient capacity during unexpected peaks"
          ],
          mitigations: [
            "Implement gradual reduction",
            "Keep manual override capability",
            "Set up alerting for utilization spikes"
          ]
        },
        approvalStatus: "pending",
        createdAt: now
      }
    ];

    // Store resource optimization data
    for (const pool of resourcePools) {
      await db.put("resourcePools", pool);
    }
    for (const allocation of resourceAllocations) {
      await db.put("resourceAllocations", allocation);
    }
    for (const recommendation of optimizationRecommendations) {
      await db.put("optimizationRecommendations", recommendation);
    }
    for (const policy of scalingPolicies) {
      await db.put("scalingPolicies", policy);
    }
    for (const forecast of capacityForecasts) {
      await db.put("capacityForecasts", forecast);
    }
    for (const optimization of costOptimizations) {
      await db.put("costOptimizations", optimization);
    }

  } else if (tenantId === "tenant_aws_financial") {
    resourcePools.push(
      {
        id: `${tenantId}_pool001`,
        tenantId,
        name: "AWS EC2 Compute Pool - Trading",
        type: "compute",
        totalCapacity: 5000,
        usedCapacity: 4000,
        availableCapacity: 1000,
        reservedCapacity: 3500,
        unit: "vCPUs",
        costPerUnit: 0.08,
        location: "us-east-1",
        provider: "AWS",
        healthStatus: "healthy",
        metadata: {
          instance_types: ["m5.24xlarge", "c5n.18xlarge"],
          reserved_instances: 35,
          spot_instances: 10,
          on_demand: 5
        },
        updatedAt: now
      }
    );

    resourceAllocations.push(
      {
        id: `${tenantId}_alloc001`,
        tenantId,
        resourceId: `${tenantId}_pool001`,
        resourceType: "cpu",
        allocatedTo: `${tenantId}_svc_trading`,
        allocationType: "service",
        amount: 3500,
        unit: "vCPUs",
        utilization: 65,
        cost: 6720, // per day
        priority: "critical",
        startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        endTime: null,
        tags: ["production", "trading", "latency-sensitive", "reserved"],
        metadata: {
          sla_requirement: "99.99%",
          latency_target: "10ms",
          compliance: ["SOX", "MiFID II"]
        }
      }
    );

    optimizationRecommendations.push(
      {
        id: `${tenantId}_opt001`,
        tenantId,
        type: "reserved_instance",
        resourceId: `${tenantId}_pool001`,
        resourceType: "compute",
        currentState: {
          on_demand_instances: 5,
          reserved_instances: 35,
          spot_instances: 10,
          monthly_cost: 201600
        },
        recommendedState: {
          on_demand_instances: 2,
          reserved_instances: 40,
          spot_instances: 8,
          monthly_cost: 161280
        },
        impact: {
          costSavings: 40320,
          performanceGain: 0,
          riskScore: 0.1,
          implementationEffort: "low"
        },
        confidence: 0.92,
        reasoning: "Trading platform has predictable baseline load. Converting 5 on-demand to reserved instances saves 20% with 3-year commitment.",
        automationAvailable: true,
        approvalRequired: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now
      }
    );
  } else if (tenantId === "tenant_ecommerce") {
    resourcePools.push(
      {
        id: `${tenantId}_pool001`,
        tenantId,
        name: "Kubernetes Cluster - Production",
        type: "compute",
        totalCapacity: 2000,
        usedCapacity: 800,
        availableCapacity: 1200,
        reservedCapacity: 500,
        unit: "vCPUs",
        costPerUnit: 0.06,
        location: "multi-region",
        provider: "GCP",
        healthStatus: "healthy",
        metadata: {
          cluster_version: "1.27",
          nodes: 50,
          auto_scaling_enabled: true,
          preemptible_nodes: 20
        },
        updatedAt: now
      }
    );

    // Black Friday Scaling Policy
    scalingPolicies.push(
      {
        id: `${tenantId}_scale001`,
        tenantId,
        name: "Black Friday Auto-scaling",
        resourcePoolId: `${tenantId}_pool001`,
        enabled: true,
        triggers: [
          {
            metric: "request_rate",
            threshold: 10000,
            operator: "gt",
            duration: 60
          },
          {
            metric: "response_time_p95",
            threshold: 500,
            operator: "gt",
            duration: 120
          }
        ],
        actions: [
          {
            type: "scale_out",
            amount: 200, // vCPUs (5 nodes)
            cooldown: 300
          }
        ],
        constraints: {
          minCapacity: 500,
          maxCapacity: 10000,
          maxCostPerHour: 500,
          allowedTimeWindows: [
            { start: "00:00", end: "23:59" }
          ]
        },
        predictiveScaling: {
          enabled: true,
          lookAheadMinutes: 30,
          historicalData: "black_friday_2023"
        },
        lastTriggered: null,
        history: [],
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: now
      }
    );
  }

  console.log(`Seeded resource optimization data for ${tenantId}`);
  return { resourcePools, resourceAllocations, optimizationRecommendations, scalingPolicies };
};