// Helper functions for adding external system fields to seed data
import { ExternalSystemType } from "../../types/externalSystem";

// Map entity types to common external systems
const ENTITY_SYSTEM_MAP: Record<string, ExternalSystemType[]> = {
  incident: [ExternalSystemType.SERVICENOW, ExternalSystemType.REMEDY, ExternalSystemType.JIRA_SERVICE_DESK],
  problem: [ExternalSystemType.SERVICENOW, ExternalSystemType.DATADOG, ExternalSystemType.NEW_RELIC],
  change_request: [ExternalSystemType.SERVICENOW, ExternalSystemType.REMEDY, ExternalSystemType.JIRA_SERVICE_DESK],
  service_request: [ExternalSystemType.SERVICENOW, ExternalSystemType.JIRA_SERVICE_DESK],
  alert: [ExternalSystemType.DATADOG, ExternalSystemType.NEW_RELIC, ExternalSystemType.PROMETHEUS, ExternalSystemType.SPLUNK],
  metric: [ExternalSystemType.PROMETHEUS, ExternalSystemType.GRAFANA, ExternalSystemType.DATADOG],
  log: [ExternalSystemType.SPLUNK, ExternalSystemType.ELASTICSEARCH],
  event: [ExternalSystemType.DATADOG, ExternalSystemType.SPLUNK, ExternalSystemType.NEW_RELIC],
  trace: [ExternalSystemType.DATADOG, ExternalSystemType.DYNATRACE, ExternalSystemType.APPDYNAMICS],
  asset: [ExternalSystemType.SERVICENOW_CMDB, ExternalSystemType.DEVICE42, ExternalSystemType.LANSWEEPER],
  business_service: [ExternalSystemType.SERVICENOW, ExternalSystemType.SERVICENOW_CMDB],
  customer: [ExternalSystemType.SERVICENOW, ExternalSystemType.REMEDY],
  vendor: [ExternalSystemType.SERVICENOW],
  contract: [ExternalSystemType.SERVICENOW],
  knowledge: [ExternalSystemType.SERVICENOW, ExternalSystemType.SLACK],
  runbook: [ExternalSystemType.SERVICENOW, ExternalSystemType.INTERNAL],
  automation: [ExternalSystemType.INTERNAL],
  user: [ExternalSystemType.SERVICENOW, ExternalSystemType.SLACK, ExternalSystemType.TEAMS],
  team: [ExternalSystemType.SERVICENOW, ExternalSystemType.PAGERDUTY, ExternalSystemType.OPSGENIE],
};

// Sync status options with weights
const SYNC_STATUSES: Array<{ status: 'synced' | 'syncing' | 'error' | 'conflict'; weight: number }> = [
  { status: 'synced', weight: 70 },
  { status: 'syncing', weight: 15 },
  { status: 'error', weight: 10 },
  { status: 'conflict', weight: 5 }
];

// Common sync errors
const SYNC_ERRORS = [
  "Connection timeout to external API",
  "Authentication failed - token expired",
  "Rate limit exceeded",
  "Invalid response format",
  "Conflicting data between sources",
  "External system maintenance window",
  "Network connectivity issue",
  "Schema mismatch detected"
];

/**
 * Generate external system fields for a seed record
 * @param entityType - Type of entity (incident, problem, etc.)
 * @param entityId - ID of the entity
 * @param index - Index in array for variation
 * @param tenantId - Tenant ID for context
 */
export function generateExternalSystemFields(
  entityType: string,
  entityId: string,
  index: number = 0,
  tenantId?: string
) {
  // Get appropriate systems for this entity type
  const systems = ENTITY_SYSTEM_MAP[entityType] || [ExternalSystemType.INTERNAL];
  const primarySystem = systems[index % systems.length];
  
  // Determine sync status based on index for variety
  const statusChoice = SYNC_STATUSES[index % SYNC_STATUSES.length];
  
  // Calculate sync time (more recent for "synced", older for "error")
  const minutesAgo = statusChoice.status === 'synced' ? 5 + (index * 5) : 60 + (index * 30);
  const syncedAt = new Date(Date.now() - minutesAgo * 60000).toISOString();
  
  // Generate external ID based on system type
  const externalIdPrefix = getSystemPrefix(primarySystem);
  const externalId = `${externalIdPrefix}${String(index + 1).padStart(6, '0')}`;
  
  // Generate external URL
  const externalUrl = generateExternalUrl(primarySystem, entityType, externalId);
  
  // Calculate data completeness (higher for synced, lower for errors)
  const baseCompleteness = statusChoice.status === 'synced' ? 90 : 
                          statusChoice.status === 'syncing' ? 75 :
                          statusChoice.status === 'error' ? 60 : 70;
  const dataCompleteness = baseCompleteness + (index % 10);
  
  // Determine if has local changes
  const hasLocalChanges = statusChoice.status === 'error' || statusChoice.status === 'conflict' || 
                          (index % 3 === 0 && statusChoice.status === 'syncing');
  
  // Build data sources array
  const dataSources = [primarySystem];
  if (index % 2 === 0 && systems.length > 1) {
    dataSources.push(systems[1]);
  }
  
  // Build the external system fields object
  const fields: any = {
    source_system: primarySystem,
    external_id: externalId,
    external_url: externalUrl,
    sync_status: statusChoice.status,
    synced_at: syncedAt,
    data_completeness: dataCompleteness,
    data_sources: dataSources,
    has_local_changes: hasLocalChanges,
    source_priority: (index % 3) + 1
  };
  
  // Add sync_error if status is error or conflict
  if (statusChoice.status === 'error' || statusChoice.status === 'conflict') {
    fields.sync_error = SYNC_ERRORS[index % SYNC_ERRORS.length];
  }
  
  return fields;
}

/**
 * Get system-specific ID prefix
 */
function getSystemPrefix(system: ExternalSystemType): string {
  const prefixes: Record<string, string> = {
    [ExternalSystemType.SERVICENOW]: 'SN',
    [ExternalSystemType.REMEDY]: 'RMD',
    [ExternalSystemType.JIRA_SERVICE_DESK]: 'JSD',
    [ExternalSystemType.DATADOG]: 'DD',
    [ExternalSystemType.NEW_RELIC]: 'NR',
    [ExternalSystemType.APPDYNAMICS]: 'APD',
    [ExternalSystemType.DYNATRACE]: 'DT',
    [ExternalSystemType.SPLUNK]: 'SPL',
    [ExternalSystemType.ELASTICSEARCH]: 'ES',
    [ExternalSystemType.PROMETHEUS]: 'PROM',
    [ExternalSystemType.GRAFANA]: 'GRF',
    [ExternalSystemType.SERVICENOW_CMDB]: 'CMDB',
    [ExternalSystemType.DEVICE42]: 'D42',
    [ExternalSystemType.LANSWEEPER]: 'LS',
    [ExternalSystemType.SLACK]: 'SLK',
    [ExternalSystemType.TEAMS]: 'MST',
    [ExternalSystemType.PAGERDUTY]: 'PD',
    [ExternalSystemType.OPSGENIE]: 'OG',
    [ExternalSystemType.INTERNAL]: 'INT'
  };
  
  return prefixes[system] || 'EXT';
}

/**
 * Generate external URL for a given system and entity
 */
function generateExternalUrl(system: ExternalSystemType, entityType: string, externalId: string): string {
  const urlTemplates: Record<string, string> = {
    [ExternalSystemType.SERVICENOW]: `https://demo.service-now.com/${entityType}.do?sys_id=${externalId}`,
    [ExternalSystemType.REMEDY]: `https://demo.remedy.com/${entityType}/${externalId}`,
    [ExternalSystemType.JIRA_SERVICE_DESK]: `https://demo.atlassian.net/browse/${externalId}`,
    [ExternalSystemType.DATADOG]: `https://app.datadoghq.com/${entityType}/${externalId}`,
    [ExternalSystemType.NEW_RELIC]: `https://one.newrelic.com/${entityType}/${externalId}`,
    [ExternalSystemType.APPDYNAMICS]: `https://demo.appdynamics.com/${entityType}/${externalId}`,
    [ExternalSystemType.DYNATRACE]: `https://demo.dynatrace.com/${entityType}/${externalId}`,
    [ExternalSystemType.SPLUNK]: `https://splunk.example.com/${entityType}/${externalId}`,
    [ExternalSystemType.ELASTICSEARCH]: `https://elastic.cloud/${entityType}/${externalId}`,
    [ExternalSystemType.PROMETHEUS]: `https://prometheus.io/${entityType}/${externalId}`,
    [ExternalSystemType.GRAFANA]: `https://grafana.example.com/${entityType}/${externalId}`,
    [ExternalSystemType.SERVICENOW_CMDB]: `https://demo.service-now.com/cmdb_ci.do?sys_id=${externalId}`,
    [ExternalSystemType.DEVICE42]: `https://demo.device42.com/${entityType}/${externalId}`,
    [ExternalSystemType.LANSWEEPER]: `https://demo.lansweeper.com/${entityType}/${externalId}`,
    [ExternalSystemType.SLACK]: `https://slack.com/archives/${externalId}`,
    [ExternalSystemType.TEAMS]: `https://teams.microsoft.com/chat/${externalId}`,
    [ExternalSystemType.PAGERDUTY]: `https://demo.pagerduty.com/${entityType}/${externalId}`,
    [ExternalSystemType.OPSGENIE]: `https://demo.opsgenie.com/${entityType}/${externalId}`,
    [ExternalSystemType.INTERNAL]: `#internal/${entityType}/${externalId}`
  };
  
  return urlTemplates[system] || `#external/${system}/${entityType}/${externalId}`;
}

/**
 * Add external system fields to an existing seed object
 */
export function addExternalSystemFields<T extends Record<string, any>>(
  seedObject: T,
  entityType: string,
  index: number = 0,
  tenantId?: string
): T {
  const externalFields = generateExternalSystemFields(
    entityType,
    seedObject.id,
    index,
    tenantId
  );
  
  return {
    ...seedObject,
    ...externalFields
  };
}

/**
 * Batch add external system fields to an array of seed objects
 */
export function addExternalSystemFieldsBatch<T extends Record<string, any>>(
  seedArray: T[],
  entityType: string,
  tenantId?: string
): T[] {
  return seedArray.map((item, index) => 
    addExternalSystemFields(item, entityType, index, tenantId)
  );
}