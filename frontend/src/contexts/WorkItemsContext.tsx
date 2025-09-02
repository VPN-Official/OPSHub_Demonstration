import { useIncidents, useIncidentDetails } from "./IncidentsContext";
import { useServiceRequests, useServiceRequestDetails } from "./ServiceRequestsContext";
import { useChangeRequests, useChangeRequestDetails } from "./ChangeRequestsContext";
import { useProblems, useProblemDetails } from "./ProblemsContext";
import { useMaintenanceWorks, useMaintenanceWorkDetails } from "./MaintenanceContext";

// ---------------------------------
// 1. Unified Work Item Type
// ---------------------------------

export type WorkItemType =
  | "incident"
  | "service_request"
  | "change"
  | "problem"
  | "maintenance";

export interface WorkItem {
  id: string;
  type: WorkItemType;
  title: string;
  status: string;
  priority?: string;
  created_at: string;
  updated_at: string;
  assigned_to_user_id?: string | null;
  assigned_to_team_id?: string | null;
  business_service_id?: string | null;
}

// ---------------------------------
// 2. Hook for Unified Work Items (Queue)
// ---------------------------------

export const useWorkItems = (): WorkItem[] => {
  const { incidents } = useIncidents();
  const { serviceRequests } = useServiceRequests();
  const { changeRequests } = useChangeRequests();
  const { problems } = useProblems();
  const { maintenanceWorks } = useMaintenanceWorks();

  const incidentItems: WorkItem[] = incidents.map((i) => ({
    id: i.id,
    type: "incident",
    title: i.title,
    status: i.status,
    priority: i.priority,
    created_at: i.created_at,
    updated_at: i.updated_at,
    assigned_to_user_id: i.assigned_to_user_id,
    assigned_to_team_id: i.assigned_to_team_id,
    business_service_id: i.business_service_id,
  }));

  const serviceRequestItems: WorkItem[] = serviceRequests.map((sr) => ({
    id: sr.id,
    type: "service_request",
    title: sr.title,
    status: sr.status,
    priority: sr.priority,
    created_at: sr.created_at,
    updated_at: sr.updated_at,
    assigned_to_user_id: sr.assigned_to_user_id,
    assigned_to_team_id: sr.assigned_to_team_id,
    business_service_id: sr.business_service_id,
  }));

  const changeRequestItems: WorkItem[] = changeRequests.map((cr) => ({
    id: cr.id,
    type: "change",
    title: cr.title,
    status: cr.status,
    priority: cr.priority,
    created_at: cr.created_at,
    updated_at: cr.updated_at,
    assigned_to_user_id: cr.implementer_user_ids[0] || null,
    assigned_to_team_id: cr.assigned_team_id || null,
    business_service_id: cr.business_service_id,
  }));

  const problemItems: WorkItem[] = problems.map((p) => ({
    id: p.id,
    type: "problem",
    title: p.title,
    status: p.status,
    priority: p.priority,
    created_at: p.created_at,
    updated_at: p.updated_at,
    assigned_to_user_id: p.assigned_to_user_id,
    assigned_to_team_id: p.assigned_to_team_id,
    business_service_id: p.business_service_id,
  }));

  const maintenanceItems: WorkItem[] = maintenanceWorks.map((m) => ({
    id: m.id,
    type: "maintenance",
    title: m.title,
    status: m.status,
    priority: m.priority,
    created_at: m.created_at,
    updated_at: m.updated_at,
    assigned_to_user_id: m.assigned_to_user_id,
    assigned_to_team_id: m.assigned_to_team_id,
    business_service_id: m.business_service_id,
  }));

  return [
    ...incidentItems,
    ...serviceRequestItems,
    ...changeRequestItems,
    ...problemItems,
    ...maintenanceItems,
  ];
};

// ---------------------------------
// 3. Hook for Work Item Details
// ---------------------------------

export const useWorkItemDetails = (id: string, type: WorkItemType) => {
  switch (type) {
    case "incident":
      return useIncidentDetails(id);
    case "service_request":
      return useServiceRequestDetails(id);
    case "change":
      return useChangeRequestDetails(id);
    case "problem":
      return useProblemDetails(id);
    case "maintenance":
      return useMaintenanceWorkDetails(id);
    default:
      return null;
  }
};

// ---------------------------------
// 4. Generic Filter Hook
// ---------------------------------

export const useWorkItemsFilter = (
  filters: Record<string, string | number | boolean>
): WorkItem[] => {
  const items = useWorkItems();

  return items.filter((item) =>
    Object.entries(filters).every(([key, value]) => {
      // @ts-ignore — dynamic key access
      return item[key] === value;
    })
  );
};