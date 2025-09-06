/**
 * Standard fields for tracking external system data sources
 * Used across all contexts to provide consistent source attribution
 */
export interface ExternalSystemFields {
  /**
   * Identifier of the source system (e.g., "servicenow", "datadog", "splunk")
   * Used for displaying source badges and icons in the UI
   */
  source_system?: string;
  
  /**
   * Original ID from the external system
   * Used for correlation and deep-linking back to source
   */
  external_id?: string;
  
  /**
   * Direct URL to view this record in the external system
   * Used for "View in [System]" buttons
   */
  external_url?: string;
  
  /**
   * Current synchronization status with external system
   * - synced: Data is up-to-date
   * - syncing: Sync in progress  
   * - error: Sync failed
   * - conflict: Data conflicts need resolution
   */
  sync_status?: 'synced' | 'syncing' | 'error' | 'conflict';
  
  /**
   * ISO timestamp of last successful sync
   * Used to show "Last updated: X mins ago" in UI
   */
  synced_at?: string;
  
  /**
   * Error message from last failed sync attempt
   * Displayed to users when sync_status is 'error'
   */
  sync_error?: string;
  
  /**
   * Percentage of data completeness (0-100)
   * Used for data quality indicators
   */
  data_completeness?: number;
  
  /**
   * List of all systems that contributed to this record
   * Used when data is merged from multiple sources
   */
  data_sources?: string[];
  
  /**
   * Indicates if this record has been modified locally
   * and needs to sync back to the external system
   */
  has_local_changes?: boolean;
  
  /**
   * Priority of this data source when conflicts occur
   * Lower numbers = higher priority
   */
  source_priority?: number;
}

/**
 * Type helper to add external system fields to any interface
 */
export type WithExternalSystem<T> = T & ExternalSystemFields;

/**
 * Common external system identifiers
 */
export enum ExternalSystemType {
  // ITSM
  SERVICENOW = 'servicenow',
  REMEDY = 'remedy',
  JIRA_SERVICE_DESK = 'jira_service_desk',
  
  // APM
  DATADOG = 'datadog',
  NEW_RELIC = 'new_relic',
  APPDYNAMICS = 'appdynamics',
  DYNATRACE = 'dynatrace',
  
  // MELT
  SPLUNK = 'splunk',
  ELASTICSEARCH = 'elasticsearch',
  PROMETHEUS = 'prometheus',
  GRAFANA = 'grafana',
  
  // CMDB
  SERVICENOW_CMDB = 'servicenow_cmdb',
  DEVICE42 = 'device42',
  LANSWEEPER = 'lansweeper',
  
  // Collaboration
  SLACK = 'slack',
  TEAMS = 'teams',
  PAGERDUTY = 'pagerduty',
  OPSGENIE = 'opsgenie',
  
  // Internal
  INTERNAL = 'internal'
}

/**
 * Helper to generate external URL based on system type
 */
export function generateExternalUrl(
  systemType: string,
  entityType: string,
  externalId: string
): string {
  // This will be populated based on tenant configuration
  // For now, return a placeholder
  return `#external/${systemType}/${entityType}/${externalId}`;
}