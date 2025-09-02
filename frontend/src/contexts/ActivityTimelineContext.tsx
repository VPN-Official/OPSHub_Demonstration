import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAll } from "../db/dbClient";
import { putWithAudit } from "../db/dbClientWithAudit"; // audit trail integration
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";

export type ActivityType =
  | "incident"
  | "service_request"
  | "problem"
  | "change"
  | "maintenance"
  | "alert"
  | "asset"
  | "service"
  | "knowledge"
  | "runbook"
  | "automation"
  | "ai_agent"
  | "compliance"
  | "risk"
  | "user"
  | "team"
  | "other";

export interface Activity {
  id: string;
  type: ActivityType;
  entity_id: string;
  action: string;
  description?: string;
  timestamp: string;

  // Actor
  user_id?: string | null;
  team_id?: string | null;
  ai_agent_id?: string | null;
  automation_rule_id?: string | null;

  // Relationships
  related_entity_ids: {
    type: ActivityType;
    id: string;
  }[];

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
}

// ---------------------------------
// Context Interface
// ---------------------------------
interface ActivityTimelineContextType {
  activities: Activity[];
  addActivity: (activity: Activity) => Promise<void>;
  refreshActivities: () => Promise<void>;
  getActivitiesByEntity: (entityId: string, type: ActivityType) => Activity[];
  clearActivities: () => void; // local cache only
}

const ActivityTimelineContext = createContext<ActivityTimelineContextType | undefined>(undefined);

// ---------------------------------
// Provider
// ---------------------------------
export const ActivityTimelineProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueue } = useSync();
  const [activities, setActivities] = useState<Activity[]>([]);

  const refreshActivities = async () => {
    const all = await getAll<Activity>(tenantId, "activities");
    // Prepend latest first
    setActivities(all.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)));
  };

  const addActivity = async (activity: Activity) => {
    await putWithAudit(
      tenantId,
      "activities",
      activity,
      activity.user_id,
      { action: "create", description: `Activity "${activity.action}" on ${activity.type}:${activity.entity_id}` },
      enqueue
    );
    // Prepend in local cache
    setActivities((prev) => [activity, ...prev]);
  };

  const getActivitiesByEntity = (entityId: string, type: ActivityType) => {
    return activities.filter((a) => a.entity_id === entityId && a.type === type);
  };

  const clearActivities = () => {
    setActivities([]);
  };

  useEffect(() => {
    refreshActivities();
  }, [tenantId]);

  return (
    <ActivityTimelineContext.Provider
      value={{ activities, addActivity, refreshActivities, getActivitiesByEntity, clearActivities }}
    >
      {children}
    </ActivityTimelineContext.Provider>
  );
};

// ---------------------------------
// Hooks
// ---------------------------------
export const useActivityTimeline = () => {
  const ctx = useContext(ActivityTimelineContext);
  if (!ctx) throw new Error("useActivityTimeline must be used within ActivityTimelineProvider");
  return ctx;
};

export const useEntityActivities = (entityId: string, type: ActivityType) => {
  const { getActivitiesByEntity } = useActivityTimeline();
  return getActivitiesByEntity(entityId, type);
};