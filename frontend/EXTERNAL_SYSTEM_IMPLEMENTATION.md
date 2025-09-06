# External System Fields Implementation Guide

## ✅ COMPLETED (10 files)

1. ✅ ProblemsContext.tsx - Problem interface extended
2. ✅ ChangeRequestsContext.tsx - ChangeRequest interface extended
3. ✅ ServiceRequestsContext.tsx - ServiceRequest interface extended
4. ✅ MaintenanceContext.tsx - MaintenanceWork interface extended
5. ✅ RisksContext.tsx - Risk interface extended
6. ✅ WorkNotesContext.tsx - WorkItem interface extended (note: file is about WorkItems)
7. ✅ AssetsContext.tsx - Asset interface extended (removed duplicate fields)
8. ✅ BusinessServicesContext.tsx - BusinessService interface extended
9. ✅ ServiceComponentsContext.tsx - ServiceComponent interface extended
10. ✅ ContractsContext.tsx - Contract interface extended

## 🔄 REMAINING TO UPDATE (28 files)

### Pattern to Apply to Each File:

```typescript
// 1. Add import at top
import { ExternalSystemFields } from "../types/externalSystem";

// 2. Extend main interface
export interface [EntityName] extends ExternalSystemFields {
  // ... existing fields
  // REMOVE these if they exist (now provided by ExternalSystemFields):
  // - synced_at?: string;
  // - sync_status?: "clean" | "dirty" | "conflict";
}

// 3. Update UIFilters interface (if exists)
export interface [EntityName]UIFilters {
  // ... existing filters
  
  // Add external system filters
  sourceSystems?: string[];
  syncStatus?: ('synced' | 'syncing' | 'error' | 'conflict')[];
  hasConflicts?: boolean;
  hasLocalChanges?: boolean;
  dataCompleteness?: { min: number; max: number };
}

// 4. Update filter implementation (if exists)
// Add to getFiltered[EntityName] function:
if (filters.sourceSystems?.length) {
  if (!filters.sourceSystems.includes(item.source_system || '')) {
    return false;
  }
}
if (filters.syncStatus?.length) {
  if (!filters.syncStatus.includes(item.sync_status || 'synced')) {
    return false;
  }
}
```

## Files to Update:

### Assets & Configuration (1 remaining)
- [ ] CostCentersContext.tsx → `CostCenter` interface

### People & Organization (6 files)
- [ ] UsersContext.tsx → `User` interface
- [ ] TeamsContext.tsx → `Team` interface
- [ ] CustomersContext.tsx → `Customer` interface
- [ ] EndUsersContext.tsx → `EndUser` interface
- [ ] SkillsContext.tsx → `Skill` interface
- [ ] OnCallContext.tsx → `OnCallSchedule` interface

### Observability (5 files)
- [ ] EventsContext.tsx → `Event` interface
- [ ] TracesContext.tsx → `Trace` interface
- [ ] SystemMetricsContext.tsx → `SystemMetric` interface
- [ ] MetricsAnalyticsContext.tsx → `MetricAnalysis` interface
- [ ] BusinessImpactContext.tsx → `BusinessImpact` interface

### Knowledge & Automation (6 files)
- [ ] KnowledgeBaseContext.tsx → `KnowledgeArticle` interface
- [ ] RunbooksContext.tsx → `Runbook` interface
- [ ] AutomationRulesContext.tsx → `AutomationRule` interface
- [ ] PolicyContext.tsx → `Policy` interface
- [ ] AuditLogsContext.tsx → `AuditLog` interface
- [ ] KpisContext.tsx → `KPI` interface

### Collaboration & Communication (4 files)
- [ ] CollaborationContext.tsx → `CollaborationItem` interface
- [ ] StakeholderCommsContext.tsx → `Communication` interface
- [ ] ActivityTimelineContext.tsx → `Activity` interface
- [ ] WorkItemsContext.tsx → `WorkItem` interface (main aggregator)

### Operations (6 files)
- [ ] NavigationTraceContext.tsx → `EntityReference` interface
- [ ] OfflineCapabilityContext.tsx → `QueuedAction` interface
- [ ] ResourceOptimizationContext.tsx → `ResourceOptimization` interface
- [ ] ValueStreamsContext.tsx → `ValueStream` interface
- [ ] AIInsightsContext.tsx → `AIInsight` interface
- [ ] AiAgentsContext.tsx → `AIAgent` interface

## Special Cases to Watch For:

### Already have source_system field:
- AlertsContext.tsx ✅ (keep existing)
- MetricsContext.tsx ✅ (keep existing)
- LogsContext.tsx ✅ (keep existing)
- IncidentsContext.tsx ✅ (needs external_id, external_url added)

### May have different field names:
- Some contexts use `sync_status?: "clean" | "dirty" | "conflict"`
  - Change "dirty" to "syncing" to match ExternalSystemFields
- Some contexts already have `synced_at` and `sync_status` - remove duplicates

## Testing Checklist:

After all updates:
1. [ ] Run `npm run build` - should compile without TypeScript errors
2. [ ] Check no duplicate field definitions
3. [ ] Verify filter functions handle new fields
4. [ ] Test seed data generation with new fields
5. [ ] Verify IndexedDB stores new fields

## Quick Command to Find Remaining Files:

```bash
# Find all context files that need updating
find src/contexts -name "*Context.tsx" | xargs grep -l "export interface" | while read f; do
  if ! grep -q "ExternalSystemFields" "$f"; then
    echo "$f needs update"
  fi
done
```

## Seed Files to Update After Contexts:

Each seed file in `src/db/seeds/` needs to generate external system data:

```typescript
// Add to each seed file
import { ExternalSystemType } from '../../types/externalSystem';

// In seed data generation
source_system: ExternalSystemType.SERVICENOW,
external_id: `EXT-${entityType}-${id}`,
external_url: `https://demo.service-now.com/${entityType}/${id}`,
sync_status: 'synced',
synced_at: new Date().toISOString(),
data_completeness: 95,
data_sources: [ExternalSystemType.SERVICENOW],
has_local_changes: false,
source_priority: 1
```

## Database Updates Required:

### src/db/dbClient.ts
- Add `getBySourceSystem()` function
- Add `getConflicts()` function
- Update `putWithAudit()` to mark `has_local_changes`

### src/db/seedIndexedDB.ts
- Add indices for `source_system` and `sync_status`
- Add validation for external fields

### src/db/syncQueue.ts
- Add `queueExternalSync()` function
- Add `getPendingSyncBySystem()` function

## Time Remaining:
- 28 context files × 5 minutes = 2.5 hours
- Seed files update = 2 hours
- Database updates = 1 hour
- Testing = 1 hour
**Total: ~6.5 hours**