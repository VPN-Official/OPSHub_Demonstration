// src/db/seeds/seedKnowledgeBase.ts - FULLY CORRECTED
import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedKnowledgeBase = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let kbArticles: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    kbArticles = [
      {
        id: `${tenantId}_kb01`,
        tenantId,
        title: "Troubleshooting High CPU on Routers",
        description: "Comprehensive guide for diagnosing and resolving high CPU utilization on network routers",
        content: `## Problem Description
High CPU utilization on routers can cause performance degradation and connectivity issues.

## Symptoms
- BGP session flapping
- Slow routing convergence
- Packet processing delays
- Management interface unresponsive

## Root Causes
1. BGP table size exceeding capacity
2. Control plane policing misconfiguration
3. Process memory leaks
4. DDoS attacks or traffic storms

## Resolution Steps
1. **Verify process table**
   - SSH to router: \`show processes cpu sorted\`
   - Identify top CPU consumers
   - Document baseline vs current usage

2. **Check BGP sessions**
   - Run: \`show ip bgp summary\`
   - Verify peer count and prefix counts
   - Check for route flapping: \`show ip bgp flap-statistics\`

3. **Review firmware release notes**
   - Check current version: \`show version\`
   - Review known issues in release notes
   - Plan firmware upgrade if needed

4. **Implement CPU protection**
   - Configure control plane policing
   - Set process priority levels
   - Enable CPU threshold alerts

## Preventive Measures
- Regular firmware updates
- BGP prefix filtering
- Control plane protection
- Capacity planning reviews`,
        category: "troubleshooting",
        subcategory: "network",
        article_type: "solution",
        status: "published",
        priority: "high",
        severity: "P2",
        related_service_id: `${tenantId}_svc_network`,
        related_component_ids: [`${tenantId}_comp_router01`],
        related_problem_ids: [`${tenantId}_prob01`],
        related_incident_ids: [`${tenantId}_inc01`],
        author_id: `${tenantId}_user_netops01`,
        reviewer_id: `${tenantId}_user_manager01`,
        approval_status: "approved",
        version: "1.2",
        view_count: 247,
        helpful_count: 189,
        not_helpful_count: 12,
        avg_resolution_time_minutes: 45,
        effectiveness_score: 0.85,
        last_reviewed: now,
        next_review_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        created_at: now,
        updated_at: now,
        health_status: "green",
        tags: ["router", "cpu", "network", "bgp", "troubleshooting", "performance"],
        custom_fields: {
          applies_to_models: ["cisco-isr-4431", "cisco-isr-4451"],
          minimum_ios_version: "15.6",
          difficulty_level: "intermediate",
          estimated_time_minutes: 45
        }
      },
      {
        id: `${tenantId}_kb02`,
        tenantId,
        title: "Switch Port Error Recovery Procedure",
        description: "Step-by-step guide for recovering from switch port errors and CRC failures",
        content: `## Overview
This article provides procedures for diagnosing and recovering from switch port errors.

## Error Types
- CRC errors
- Frame errors
- Collision errors
- Late collisions

## Diagnostic Steps
1. Check error counters: \`show interfaces counters errors\`
2. Verify cable integrity
3. Review port configuration
4. Check for duplex mismatches

## Recovery Procedure
1. Document current errors
2. Clear interface counters
3. Monitor for recurring errors
4. Replace cable if needed
5. Escalate to hardware replacement if persistent`,
        category: "troubleshooting",
        subcategory: "network",
        article_type: "procedure",
        status: "published",
        priority: "medium",
        severity: "P3",
        related_service_id: `${tenantId}_svc_network`,
        related_component_ids: [`${tenantId}_comp_switch01`],
        related_problem_ids: [`${tenantId}_prob02`],
        related_incident_ids: [],
        author_id: `${tenantId}_user_netops02`,
        reviewer_id: `${tenantId}_user_manager01`,
        approval_status: "approved",
        version: "1.0",
        view_count: 156,
        helpful_count: 120,
        not_helpful_count: 8,
        avg_resolution_time_minutes: 30,
        effectiveness_score: 0.88,
        last_reviewed: now,
        next_review_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: now,
        updated_at: now,
        health_status: "green",
        tags: ["switch", "port", "errors", "crc", "recovery"],
        custom_fields: {
          applies_to_models: ["cisco-3750x", "cisco-9300"],
          difficulty_level: "basic",
          estimated_time_minutes: 30
        }
      }
    ];
  }

  if (tenantId === "tenant_av_google") {
    kbArticles = [
      {
        id: `${tenantId}_kb01`,
        tenantId,
        title: "Streaming Latency Mitigation",
        description: "Comprehensive guide for diagnosing and mitigating streaming latency issues",
        content: `## Problem Statement
High latency in streaming services affects user experience and can cause buffering.

## Diagnostic Steps
1. **Validate edge node load**
   - Check CPU/memory utilization
   - Review concurrent connection counts
   - Analyze bandwidth consumption

2. **Scale GCE instances**
   - Review auto-scaling metrics
   - Adjust scaling thresholds
   - Add instances to affected regions

3. **Apply CDN routing rules**
   - Update GeoDNS configuration
   - Implement request routing policies
   - Enable CDN cache warming

## Performance Tuning
- Optimize encoding settings
- Implement adaptive bitrate streaming
- Configure edge caching strategies
- Enable HTTP/3 and QUIC protocols`,
        category: "performance",
        subcategory: "streaming",
        article_type: "solution",
        status: "published",
        priority: "high",
        severity: "P2",
        related_service_id: `${tenantId}_svc_streaming`,
        related_component_ids: [`${tenantId}_comp_edge01`, `${tenantId}_comp_cdn01`],
        related_problem_ids: [`${tenantId}_prob01`],
        related_incident_ids: [`${tenantId}_inc01`],
        author_id: `${tenantId}_user_sre01`,
        reviewer_id: `${tenantId}_user_sre_manager01`,
        approval_status: "approved",
        version: "2.1",
        view_count: 512,
        helpful_count: 456,
        not_helpful_count: 23,
        avg_resolution_time_minutes: 60,
        effectiveness_score: 0.91,
        last_reviewed: now,
        next_review_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: now,
        updated_at: now,
        health_status: "green",
        tags: ["streaming", "latency", "performance", "cdn", "edge"],
        custom_fields: {
          platforms: ["web", "mobile", "smart-tv"],
          regions: ["eu-west", "us-east", "apac"],
          difficulty_level: "advanced",
          estimated_time_minutes: 60
        }
      },
      {
        id: `${tenantId}_kb02`,
        tenantId,
        title: "OOM Kill Prevention in GKE Pods",
        description: "Best practices for preventing and resolving OOM kills in Kubernetes pods",
        content: `## Understanding OOM Kills
Out of Memory kills occur when pods exceed their memory limits.

## Prevention Strategies
1. **Review pod specifications**
   - Analyze memory consumption patterns
   - Set appropriate requests and limits
   - Use vertical pod autoscaler

2. **Increase memory requests/limits**
   - Update deployment manifests
   - Consider node capacity
   - Plan for peak usage

3. **Apply horizontal pod autoscaler**
   - Configure HPA based on memory metrics
   - Set appropriate min/max replicas
   - Test scaling behavior

## Monitoring Setup
- Configure memory alerts
- Implement pod restart notifications
- Track OOM kill frequency
- Analyze memory leak patterns`,
        category: "troubleshooting",
        subcategory: "kubernetes",
        article_type: "best_practice",
        status: "published",
        priority: "high",
        severity: "P2",
        related_service_id: `${tenantId}_svc_transcoding`,
        related_component_ids: [`${tenantId}_comp_gke_cluster01`],
        related_problem_ids: [`${tenantId}_prob02`],
        related_incident_ids: [`${tenantId}_inc02`],
        author_id: `${tenantId}_user_k8s01`,
        reviewer_id: `${tenantId}_user_mediaops_manager01`,
        approval_status: "approved",
        version: "1.5",
        view_count: 324,
        helpful_count: 289,
        not_helpful_count: 15,
        avg_resolution_time_minutes: 45,
        effectiveness_score: 0.89,
        last_reviewed: now,
        next_review_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: now,
        updated_at: now,
        health_status: "green",
        tags: ["gke", "oom", "kubernetes", "memory", "pods"],
        custom_fields: {
          kubernetes_versions: ["1.24", "1.25", "1.26"],
          workload_types: ["batch", "streaming", "transcoding"],
          difficulty_level: "intermediate",
          estimated_time_minutes: 45
        }
      }
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    kbArticles = [
      {
        id: `${tenantId}_kb01`,
        tenantId,
        title: "Database Replication Lag Resolution",
        description: "Comprehensive guide for diagnosing and resolving PostgreSQL replication lag",
        content: `## Problem Overview
Replication lag in PostgreSQL can impact reporting accuracy and compliance.

## Diagnostic Process
1. **Check replica I/O thread**
   - Query: SELECT * FROM pg_stat_replication;
   - Monitor WAL replay lag
   - Check network connectivity

2. **Increase replication slots**
   - Evaluate slot configuration
   - Adjust max_replication_slots
   - Monitor slot usage

3. **Monitor long-running queries**
   - Identify blocking queries
   - Review query performance
   - Implement query timeouts

## Optimization Techniques
- Tune WAL parameters
- Optimize checkpoint settings
- Implement connection pooling
- Consider streaming vs logical replication`,
        category: "database",
        subcategory: "replication",
        article_type: "solution",
        status: "published",
        priority: "critical",
        severity: "P1",
        related_service_id: `${tenantId}_svc_fin_reporting`,
        related_component_ids: [`${tenantId}_comp_reportingdb`],
        related_problem_ids: [`${tenantId}_prob01`],
        related_incident_ids: [`${tenantId}_inc01`],
        author_id: `${tenantId}_user_dba01`,
        reviewer_id: `${tenantId}_user_dba_manager01`,
        approval_status: "approved",
        version: "3.0",
        view_count: 892,
        helpful_count: 823,
        not_helpful_count: 34,
        avg_resolution_time_minutes: 120,
        effectiveness_score: 0.92,
        last_reviewed: now,
        next_review_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: now,
        updated_at: now,
        health_status: "green",
        tags: ["database", "replication", "postgresql", "lag", "performance"],
        custom_fields: {
          postgresql_versions: ["12", "13", "14"],
          replication_types: ["streaming", "logical"],
          compliance_frameworks: ["SOX", "GDPR"],
          difficulty_level: "expert",
          estimated_time_minutes: 120
        }
      },
      {
        id: `${tenantId}_kb02`,
        tenantId,
        title: "ETL Job Failure Recovery Guide",
        description: "Step-by-step troubleshooting for Spark ETL job failures",
        content: `## Common Failure Patterns
- Out of memory errors
- Data skew issues
- Network timeouts
- Corrupted input files

## Troubleshooting Steps
1. **Validate input data**
   - Check data format consistency
   - Verify schema compliance
   - Scan for corrupt records

2. **Check Spark executor logs**
   - Review executor stderr/stdout
   - Analyze stack traces
   - Monitor resource utilization

3. **Retry with checkpoint enabled**
   - Enable checkpointing
   - Configure checkpoint intervals
   - Set appropriate storage location

## Performance Optimization
- Adjust executor memory
- Tune partition counts
- Implement data caching
- Optimize shuffle operations`,
        category: "data_engineering",
        subcategory: "etl",
        article_type: "troubleshooting",
        status: "published",
        priority: "high",
        severity: "P2",
        related_service_id: `${tenantId}_svc_data_analytics`,
        related_component_ids: [`${tenantId}_comp_datalake01`],
        related_problem_ids: [`${tenantId}_prob02`],
        related_incident_ids: [`${tenantId}_inc02`],
        author_id: `${tenantId}_user_dataeng01`,
        reviewer_id: `${tenantId}_user_dataops_manager01`,
        approval_status: "approved",
        version: "2.2",
        view_count: 567,
        helpful_count: 498,
        not_helpful_count: 28,
        avg_resolution_time_minutes: 90,
        effectiveness_score: 0.88,
        last_reviewed: now,
        next_review_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: now,
        updated_at: now,
        health_status: "green",
        tags: ["etl", "spark", "pipeline", "troubleshooting", "data"],
        custom_fields: {
          spark_versions: ["3.2", "3.3", "3.4"],
          cluster_managers: ["yarn", "kubernetes"],
          data_formats: ["parquet", "avro", "orc"],
          difficulty_level: "advanced",
          estimated_time_minutes: 90
        }
      }
    ];
  }

  // Insert knowledge base articles with proper error handling
  for (const kb of kbArticles) {
    try {
      await db.put("knowledge_base", kb);

      // Create COMPLETE audit log entry matching AuditLogEntry interface
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "knowledge_base",
        entity_id: kb.id,
        action: "create",
        description: `Knowledge article created: ${kb.title} (${kb.article_type}, ${kb.priority} priority) - ${kb.effectiveness_score * 100}% effectiveness`,
        timestamp: now,
        user_id: "system", // Required field
        tags: ["seed", "knowledge_base", "create", kb.category],
        hash: await generateHash({
          entity_type: "knowledge_base",
          entity_id: kb.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          article_title: kb.title,
          article_type: kb.article_type,
          category: kb.category,
          subcategory: kb.subcategory,
          status: kb.status,
          priority: kb.priority,
          severity: kb.severity,
          version: kb.version,
          effectiveness_score: kb.effectiveness_score,
          view_count: kb.view_count,
          helpful_count: kb.helpful_count,
          related_service_id: kb.related_service_id,
          author_id: kb.author_id
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `Knowledge article "${kb.title}" published (${kb.article_type}) with ${kb.effectiveness_score * 100}% effectiveness score`,
        storeName: "knowledge_base", // Required field for dbClient compatibility
        recordId: kb.id, // Required field for dbClient compatibility  
        action: "create",
        userId: "system",
        metadata: {
          article_id: kb.id,
          article_title: kb.title,
          article_type: kb.article_type,
          category: kb.category,
          subcategory: kb.subcategory,
          status: kb.status,
          priority: kb.priority,
          version: kb.version,
          effectiveness_metrics: {
            score: kb.effectiveness_score,
            view_count: kb.view_count,
            helpful_count: kb.helpful_count,
            not_helpful_count: kb.not_helpful_count,
            avg_resolution_time_minutes: kb.avg_resolution_time_minutes
          },
          review_schedule: {
            last_reviewed: kb.last_reviewed,
            next_review_date: kb.next_review_date
          },
          related_entities: [
            { type: "business_service", id: kb.related_service_id },
            { type: "user", id: kb.author_id },
            { type: "user", id: kb.reviewer_id },
            ...kb.related_component_ids.map((id: string) => ({ type: "service_component", id })),
            ...kb.related_problem_ids.map((id: string) => ({ type: "problem", id })),
            ...kb.related_incident_ids.map((id: string) => ({ type: "incident", id }))
          ]
        }
      });

      console.log(`✅ Seeded knowledge article: ${kb.id} - ${kb.title}`);
    } catch (error) {
      console.error(`❌ Failed to seed knowledge article ${kb.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${kbArticles.length} knowledge base articles for ${tenantId}`);
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