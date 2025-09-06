# Critical Fixes Needed - External System Fields

## 🔴 HIGH PRIORITY ISSUES (Will cause runtime errors)

### 1. Non-null Assertions on Optional Fields
These will crash if the field is undefined:

**LogsContext.tsx:**
```typescript
// WRONG - will crash if source_system is undefined
source_system: logData.source_system!,

// CORRECT
source_system: logData.source_system || 'unknown',
```

**AlertsContext.tsx:**
```typescript
// WRONG - will crash if sourceSystem is undefined
filtered = filtered.filter(a => filters.sourceSystem!.includes(a.source_system));

// CORRECT
if (filters.sourceSystems?.length) {
  filtered = filtered.filter(a => 
    a.source_system && filters.sourceSystems.includes(a.source_system)
  );
}
```

**EventsContext.tsx:**
```typescript
// WRONG
filtered = filtered.filter(e => filters.source_systems!.includes(e.source_system));

// CORRECT
if (filters.source_systems?.length) {
  filtered = filtered.filter(e => 
    e.source_system && filters.source_systems.includes(e.source_system)
  );
}
```

### 2. Filter Field Name Inconsistencies

**AlertsContext.tsx:**
- Using: `filters.sourceSystem` (singular)
- Should be: `filters.sourceSystems` (plural)
- This breaks the naming convention

**EventsContext.tsx:**
- Using: `filters.source_systems` (snake_case in filter)
- Should be: `filters.sourceSystems` (camelCase in filter)

### 3. Missing Null Checks in Filters

**TracesContext.tsx:**
```typescript
// Current (unsafe)
if (filters.source_system && trace.source_system !== filters.source_system)

// Should be
if (filters.sourceSystems?.length && 
    (!trace.source_system || !filters.sourceSystems.includes(trace.source_system)))
```

## 🟡 MEDIUM PRIORITY ISSUES (Inconsistencies)

### 4. Mixed Field Access Patterns

Some contexts check for field existence, others don't:
- Need consistent pattern: always use optional chaining `?.`
- Need consistent defaults for missing fields

### 5. Sync Status Value Inconsistencies

Check all places using sync_status for:
- 'synced' | 'syncing' | 'error' | 'conflict' (correct)
- Not 'dirty' or 'clean' or other values

### 6. Data Sources Array Handling

Ensure all contexts handle:
- Empty arrays `[]`
- Undefined `undefined`
- Single vs multiple sources

## 🟢 LOW PRIORITY (Best Practices)

### 7. Type Guards for External Fields

Add helper functions:
```typescript
function hasExternalSource(item: any): boolean {
  return item.source_system && item.source_system !== 'internal';
}

function isInSync(item: any): boolean {
  return item.sync_status === 'synced';
}

function hasConflict(item: any): boolean {
  return item.sync_status === 'conflict';
}
```

### 8. Default Values for External Fields

Standardize defaults:
```typescript
const DEFAULT_EXTERNAL_FIELDS = {
  source_system: 'internal',
  sync_status: 'synced' as const,
  data_completeness: 100,
  data_sources: [],
  has_local_changes: false,
  source_priority: 1
};
```

## 📋 Files That Need Immediate Fixes

1. **LogsContext.tsx** - Remove non-null assertions
2. **AlertsContext.tsx** - Fix filter field name and null checks
3. **EventsContext.tsx** - Fix filter field name and null checks
4. **TracesContext.tsx** - Add proper null checks

## 🚨 Testing Required

After fixes, test these scenarios:
1. Create entity without external fields
2. Filter by source system when some items have no source_system
3. Sync status transitions from undefined to 'synced'
4. Handle conflicts when external_id is missing
5. Display items with partial external field data

## Summary

**Total Issues Found:** 8
**Critical (will crash):** 3
**Important (wrong behavior):** 2
**Minor (best practices):** 3

**Estimated Time to Fix:** 2-3 hours
**Risk if Not Fixed:** HIGH - Runtime errors in production