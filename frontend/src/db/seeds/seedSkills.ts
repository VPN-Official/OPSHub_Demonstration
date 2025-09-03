import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedSkills = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let skills: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    skills = [
      {
        id: `${tenantId}_skill01`,
        tenantId,
        name: "BGP Troubleshooting",
        title: "Border Gateway Protocol Troubleshooting",
        description: "Advanced skills in diagnosing and resolving BGP routing issues, including path selection and convergence problems",
        team_id: `${tenantId}_team_network`,
        priority: "critical",
        category: "networking",
        subcategory: "routing_protocols",
        health_status: "green",
        skill_level: "expert",
        proficiency_required: "advanced",
        certification_equivalent: "CCNP Enterprise",
        domain: "network_operations",
        technology_stack: ["BGP", "OSPF", "IS-IS", "Route Reflectors"],
        prerequisites: ["TCP/IP fundamentals", "Routing basics", "Network troubleshooting"],
        training_duration_hours: 40,
        assessment_required: true,
        practical_experience_years: 3,
        business_criticality: "high",
        usage_frequency: "daily",
        created_at: now,
        tags: ["networking", "bgp", "troubleshooting", "critical"],
        custom_fields: {
          vendor_specific: ["Cisco", "Juniper", "Arista"],
          tools_required: ["Wireshark", "BGP Debugger", "Route Analyzer"],
          common_issues: ["route_dampening", "path_selection", "convergence_delays"],
          documentation_links: ["RFC4271", "BGP-Best-Practices"]
        }
      },
      {
        id: `${tenantId}_skill02`,
        tenantId,
        name: "Firewall Config",
        title: "Enterprise Firewall Configuration",
        description: "Comprehensive firewall rule management, NAT configuration, and security policy implementation",
        team_id: `${tenantId}_team_noc`,
        priority: "high",
        category: "security",
        subcategory: "firewall_management",
        health_status: "green",
        skill_level: "intermediate",
        proficiency_required: "intermediate",
        certification_equivalent: "CCNA Security",
        domain: "network_security",
        technology_stack: ["Cisco ASA", "Palo Alto", "Fortinet", "pfSense"],
        prerequisites: ["Network fundamentals", "TCP/IP", "Security concepts"],
        training_duration_hours: 24,
        assessment_required: true,
        practical_experience_years: 2,
        business_criticality: "high",
        usage_frequency: "weekly",
        created_at: now,
        tags: ["security", "firewall", "configuration", "high_priority"],
        custom_fields: {
          vendor_specific: ["Cisco", "Palo Alto", "Fortinet"],
          rule_types: ["access_control", "nat", "vpn", "application_control"],
          compliance_frameworks: ["PCI-DSS", "SOX", "NIST"],
          change_management: "required"
        }
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    skills = [
      {
        id: `${tenantId}_skill01`,
        tenantId,
        name: "Kubernetes Tuning",
        title: "Kubernetes Performance Optimization",
        description: "Advanced Kubernetes cluster tuning, resource optimization, and performance troubleshooting for media workloads",
        team_id: `${tenantId}_team_mediaops`,
        priority: "high",
        category: "container_orchestration",
        subcategory: "performance_tuning",
        health_status: "yellow",
        skill_level: "advanced",
        proficiency_required: "expert",
        certification_equivalent: "CKA + CKS",
        domain: "container_platforms",
        technology_stack: ["Kubernetes", "GKE", "Istio", "Prometheus", "Grafana"],
        prerequisites: ["Container fundamentals", "Kubernetes basics", "Linux administration"],
        training_duration_hours: 60,
        assessment_required: true,
        practical_experience_years: 2,
        business_criticality: "high",
        usage_frequency: "daily",
        created_at: now,
        tags: ["kubernetes", "tuning", "performance", "containers"],
        custom_fields: {
          cluster_types: ["GKE", "self_managed"],
          workload_types: ["transcoding", "streaming", "batch_processing"],
          optimization_areas: ["resource_limits", "scheduling", "networking", "storage"],
          monitoring_tools: ["Prometheus", "Grafana", "Jaeger"]
        }
      },
      {
        id: `${tenantId}_skill02`,
        tenantId,
        name: "CDN Optimization",
        title: "Content Delivery Network Optimization",
        description: "CDN configuration, caching strategies, and edge performance optimization for global content delivery",
        team_id: `${tenantId}_team_sre`,
        priority: "high",
        category: "content_delivery",
        subcategory: "performance_optimization",
        health_status: "green",
        skill_level: "intermediate",
        proficiency_required: "advanced",
        certification_equivalent: "Google Cloud CDN Specialist",
        domain: "content_delivery",
        technology_stack: ["Google Cloud CDN", "Cloudflare", "Akamai", "AWS CloudFront"],
        prerequisites: ["HTTP/HTTPS protocols", "Caching concepts", "DNS fundamentals"],
        training_duration_hours: 32,
        assessment_required: true,
        practical_experience_years: 1,
        business_criticality: "medium",
        usage_frequency: "weekly",
        created_at: now,
        tags: ["cdn", "optimization", "performance", "global_delivery"],
        custom_fields: {
          cdn_providers: ["Google Cloud CDN", "Cloudflare"],
          optimization_techniques: ["cache_tuning", "compression", "prefetching"],
          performance_metrics: ["ttfb", "cache_hit_ratio", "bandwidth_savings"],
          geographic_regions: ["global"]
        }
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    skills = [
      {
        id: `${tenantId}_skill01`,
        tenantId,
        name: "Postgres Replication",
        title: "PostgreSQL Replication and High Availability",
        description: "Advanced PostgreSQL replication setup, monitoring, and troubleshooting for financial data systems",
        team_id: `${tenantId}_team_dba`,
        priority: "critical",
        category: "database_administration",
        subcategory: "replication",
        health_status: "red",
        skill_level: "expert",
        proficiency_required: "expert",
        certification_equivalent: "PostgreSQL Professional",
        domain: "database_systems",
        technology_stack: ["PostgreSQL", "Streaming Replication", "Logical Replication", "pgBouncer"],
        prerequisites: ["PostgreSQL fundamentals", "SQL expertise", "Linux administration"],
        training_duration_hours: 50,
        assessment_required: true,
        practical_experience_years: 4,
        business_criticality: "critical",
        usage_frequency: "daily",
        created_at: now,
        tags: ["postgresql", "replication", "database", "critical"],
        custom_fields: {
          replication_types: ["streaming", "logical", "synchronous"],
          high_availability_tools: ["Patroni", "repmgr", "pg_auto_failover"],
          monitoring_tools: ["pg_stat_replication", "PostgreSQL logs"],
          compliance_requirements: ["SOX", "financial_regulations"]
        }
      },
      {
        id: `${tenantId}_skill02`,
        tenantId,
        name: "Spark Optimization",
        title: "Apache Spark Performance Optimization",
        description: "Advanced Spark tuning, job optimization, and cluster resource management for large-scale data processing",
        team_id: `${tenantId}_team_dataops`,
        priority: "high",
        category: "big_data",
        subcategory: "performance_tuning",
        health_status: "orange",
        skill_level: "advanced",
        proficiency_required: "advanced",
        certification_equivalent: "Databricks Certified Data Engineer",
        domain: "data_engineering",
        technology_stack: ["Apache Spark", "Scala", "PySpark", "Databricks", "YARN"],
        prerequisites: ["Spark fundamentals", "Scala/Python", "Distributed systems"],
        training_duration_hours: 45,
        assessment_required: true,
        practical_experience_years: 3,
        business_criticality: "high",
        usage_frequency: "daily",
        created_at: now,
        tags: ["spark", "optimization", "big_data", "performance"],
        custom_fields: {
          optimization_areas: ["memory_tuning", "partitioning", "caching", "joins"],
          cluster_managers: ["YARN", "Kubernetes", "Standalone"],
          data_formats: ["Parquet", "Delta Lake", "Avro"],
          use_cases: ["ETL", "analytics", "machine_learning"]
        }
      },
    ];
  }

  // Insert skills with proper error handling
  for (const skill of skills) {
    try {
      await db.put("skills", skill);

      // Create COMPLETE audit log entry
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "skill",
        entity_id: skill.id,
        action: "create",
        description: `Skill registered: ${skill.title} (${skill.skill_level}) - Required for ${skill.domain} in ${skill.team_id}`,
        timestamp: now,
        user_id: "system", // Required field
        tags: ["seed", "skill", "create", skill.category],
        hash: await generateHash({
          entity_type: "skill",
          entity_id: skill.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          skill_name: skill.name,
          title: skill.title,
          category: skill.category,
          subcategory: skill.subcategory,
          skill_level: skill.skill_level,
          proficiency_required: skill.proficiency_required,
          domain: skill.domain,
          team_id: skill.team_id,
          business_criticality: skill.business_criticality,
          training_duration_hours: skill.training_duration_hours,
          practical_experience_years: skill.practical_experience_years,
          certification_equivalent: skill.certification_equivalent,
          technology_stack: skill.technology_stack,
          assessment_required: skill.assessment_required
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `Skill "${skill.title}" registered for ${skill.team_id} with ${skill.skill_level} proficiency level`,
        storeName: "skills", // Required field for dbClient compatibility
        recordId: skill.id, // Required field for dbClient compatibility
        action: "create",
        userId: "system",
        metadata: {
          skill_id: skill.id,
          skill_name: skill.name,
          title: skill.title,
          skill_level: skill.skill_level,
          category: skill.category,
          domain: skill.domain,
          business_criticality: skill.business_criticality,
          training_requirements: {
            duration_hours: skill.training_duration_hours,
            prerequisites: skill.prerequisites,
            assessment_required: skill.assessment_required
          },
          related_entities: [
            { type: "team", id: skill.team_id }
          ].filter(entity => entity.id) // Remove null/undefined entries
        }
      });

      console.log(`✅ Seeded skill: ${skill.id} - ${skill.title}`);
    } catch (error) {
      console.error(`❌ Failed to seed skill ${skill.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${skills.length} skills for ${tenantId}`);
};

// Helper function to generate audit hash (simplified for seeding)
async function generateHash(data: any): Promise<string> {
  try {
    const { generateImmutableHash } = await import("../../utils/auditUtils");
    return await generateImmutableHash(data);
  } catch {
    // Fallback for seeding if utils not available
    return `seed_hash_${data.entity_id}_${Date.now()}`;
  }
}