# ALL Remaining Issues Found

## 🔴 CRITICAL: Wrong sync_status Type Definitions
These contexts have the OLD sync status values ("clean" | "dirty" | "conflict"):

1. **LogsContext.tsx** - Line with `sync_status?: "clean" | "dirty" | "conflict";`
2. **IncidentsContext.tsx** - Has old type definition
3. **MetricsContext.tsx** - Has old type definition
4. **VendorsContext.tsx** - Has old type AND uses "dirty" value
5. **ProblemsContext.tsx** - Has old type definition
6. **AlertsContext.tsx** - Has old type definition
7. **SystemMetricsContext.tsx** - Uses "dirty" value
8. **ActivityTimelineProvider.tsx** - Has old type AND uses "dirty" value
9. **dbClient.ts** - Uses "clean" value (line 693)

**CORRECT VALUES:** `'synced' | 'syncing' | 'error' | 'conflict'`

## 🔴 CRITICAL: Non-null Assertions on Filters
These will crash if filter value is undefined:

### ServiceRequestsContext.tsx
- `filters.tags!.some(tag => sr.tags.includes(tag))`

### TeamsContext.tsx
- `filters.search!.toLowerCase()`

### MetricsContext.tsx
- `filters.healthStatus!.includes(m.health_status)`
- `filters.sourceSystem!.toLowerCase()`
- `filters.tags!.some(tag => m.tags.includes(tag))`
- ALSO: Using `sourceSystem` instead of `sourceSystems`

### EndUsersContext.tsx
- `filters.tags!.some(tag => user.tags.includes(tag))`

### AuditLogsContext.tsx
- `filters.complianceFramework!`

### ProblemsContext.tsx
- `filters.tags!.some(tag => p.tags.includes(tag))`

### AlertsContext.tsx
- `filters.tags!.some(tag => a.tags.includes(tag))`

### ValueStreamsContext.tsx
- `filters.risk_threshold!`

### StakeholderCommsContext.tsx (MANY!)
- `filters.status!.includes(c.status)`
- `filters.channel!.includes(c.channel)`
- `filters.audience!.includes(c.audience)`
- `filters.priority!.includes(c.priority)`
- `filters.dateRange!.start`
- `filters.dateRange!.end`
- `filters.channel!.includes(t.channel)`
- `filters.audience!.includes(t.audience)`

### SkillsContext.tsx
- `filters.tags!.some(tag => skill.tags.includes(tag))`

## 🟡 MEDIUM: Wrong Filter Field Names

### MetricsContext.tsx
- Using `filters.sourceSystem` (singular)
- Should be `filters.sourceSystems` (plural)

## 🟢 Type Consistency Issues

### Sync Status Values Being Set:
- Most use `"syncing" as const` ✅
- SystemMetricsContext uses `"dirty" as const` ❌
- ActivityTimelineProvider uses `"dirty"` ❌
- dbClient.ts uses `"clean" as const` ❌
- VendorsContext uses `"dirty"` ❌

## 📊 Summary Statistics

- **Files with Critical Issues:** 20+
- **Non-null Assertions to Fix:** 20+
- **Wrong sync_status Definitions:** 9 files
- **Wrong sync_status Values:** 4 locations
- **Wrong Filter Field Names:** 1 file

## 🚨 Risk Assessment

**If Not Fixed:**
1. Runtime crashes when filters are undefined
2. Type mismatches causing TypeScript errors
3. Sync status comparisons will fail
4. Data won't sync properly with external systems
5. Filter operations will crash the UI

**Estimated Time to Fix All:** 3-4 hours
**Risk Level:** VERY HIGH - Will cause production failures