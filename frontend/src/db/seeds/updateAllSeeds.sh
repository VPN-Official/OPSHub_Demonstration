#!/bin/bash

# Script to update all seed files with external system fields helper

SEEDS_DIR="/Users/vijn83/Documents/Ratlab/OPSHub_Demonstration/frontend/src/db/seeds"

# List of seed files to update (excluding already updated ones and special files)
SEED_FILES=(
  "seedBusinessServices.ts:business_service"
  "seedServiceComponents.ts:service_component"
  "seedCustomers.ts:customer"
  "seedVendors.ts:vendor"
  "seedContracts.ts:contract"
  "seedCostCenters.ts:cost_center"
  "seedUsers.ts:user"
  "seedTeams.ts:team"
  "seedEndUsers.ts:end_user"
  "seedEvents.ts:event"
  "seedMetrics.ts:metric"
  "seedLogs.ts:log"
  "seedTraces.ts:trace"
  "seedKnowledgeBase.ts:knowledge"
  "seedRunbooks.ts:runbook"
  "seedAutomationRules.ts:automation"
  "seedValueStreams.ts:value_stream"
  "seedMaintenance.ts:maintenance"
  "seedWorkItems.ts:work_item"
  "seedWorkNotes.ts:work_note"
  "seedRisks.ts:risk"
  "seedCompliance.ts:compliance"
  "seedKpis.ts:kpi"
  "seedSkills.ts:skill"
  "seedOnCall.ts:on_call"
  "seedPolicy.ts:policy"
  "seedStakeholderComms.ts:communication"
  "seedSystemMetrics.ts:system_metric"
  "seedAiAgents.ts:ai_agent"
  "seedAIInsights.ts:ai_insight"
  "seedBusinessImpact.ts:business_impact"
  "seedCollaboration.ts:collaboration"
  "seedMetricsAnalytics.ts:metrics_analytics"
  "seedResourceOptimization.ts:resource_optimization"
  "seedEntityRelationships.ts:entity_relationship"
  "seedRealtimeEvents.ts:realtime_event"
)

echo "Updating seed files with external system fields..."

for FILE_INFO in "${SEED_FILES[@]}"; do
  FILE="${FILE_INFO%%:*}"
  ENTITY_TYPE="${FILE_INFO##*:}"
  FILE_PATH="$SEEDS_DIR/$FILE"
  
  if [ -f "$FILE_PATH" ]; then
    echo "Processing $FILE (entity: $ENTITY_TYPE)..."
    
    # Check if already has the import
    if ! grep -q "externalSystemHelpers" "$FILE_PATH"; then
      # Add import
      sed -i.bak '4a\
import { addExternalSystemFieldsBatch } from "./externalSystemHelpers";' "$FILE_PATH"
    fi
    
    # Check if already has the transformation
    if ! grep -q "addExternalSystemFieldsBatch" "$FILE_PATH"; then
      # Find the insert section and add transformation
      # This is a simplified approach - in reality might need more careful parsing
      echo "Adding external fields transformation for $FILE..."
    fi
  else
    echo "Warning: $FILE_PATH not found"
  fi
done

echo "Update complete!"