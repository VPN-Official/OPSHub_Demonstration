import React, { createContext, useContext, useState } from "react";

const WorkItemsContext = createContext();

export function WorkItemsProvider({ children }) {
  const [workItems, setWorkItems] = useState([
    // ⚡ Sample dataset of 15 work items across severities/services/sites
    {
      id: 101,
      title: "DB latency issue",
      description: "Read queries spiking beyond 200ms at peak traffic.",
      severity: "critical",
      status: "open",
      smartScore: 95,
      sla_due: "2025-09-01T12:00:00Z",
      assigned_to: { id: 45, name: "Alice" },
      assigned_group: { id: 12, name: "DBA Team" },
      created_by: "System: Monitoring",
      created_at: "2025-08-30T20:00:00Z",
      updated_at: "2025-08-30T21:30:00Z",
      business_service: { id: 5, name: "Payments API" },
      cost_center: { id: 3, name: "Cloud Infra" },
      location: "Meta DCN1",
      impact: "20k users affected",
      reason: "DB queries > 200ms during peak load",
      knowledge_links: [{ id: 301, title: "DB latency runbook", url: "#" }],
      originating_notifications: [{ id: 901, msg: "DB latency > 200ms", severity: "critical", ts: "2025-08-30T19:55:00Z" }],
      related_workitems: [{ id: 102, title: "Cache saturation", status: "in_progress" }],
      activity: [],
    },
    {
      id: 102,
      title: "Cache saturation",
      description: "Redis cluster near memory limits.",
      severity: "warning",
      status: "in_progress",
      smartScore: 80,
      sla_due: "2025-09-01T08:00:00Z",
      assigned_to: { id: 46, name: "Bob" },
      assigned_group: { id: 14, name: "Caching Ops" },
      created_by: "System: Monitoring",
      created_at: "2025-08-29T10:00:00Z",
      updated_at: "2025-08-30T12:00:00Z",
      business_service: { id: 6, name: "Compute Cluster" },
      cost_center: { id: 4, name: "Infra Ops" },
      location: "Meta DCN2",
      impact: "5 nodes degraded",
      reason: "Cache hit ratio dropped below 60%",
      knowledge_links: [{ id: 302, title: "Cache saturation guide", url: "#" }],
      originating_notifications: [],
      related_workitems: [],
      activity: [],
    },
    // ⚡ add more until you have 15
  ]);

  const getWorkItem = (id) => workItems.find((w) => String(w.id) === String(id));

  const addWorkItem = (workItem) =>
    setWorkItems((prev) => [...prev, { ...workItem, id: Date.now() }]);

  const updateWorkItem = (id, updates, actionLabel = null, actor = "Engineer") => {
    setWorkItems((prev) =>
      prev.map((w) => {
        if (String(w.id) !== String(id)) return w;

        const updated = {
          ...w,
          ...updates,
          updated_at: new Date().toISOString(),
        };

        if (actionLabel) {
          updated.activity = [
            ...w.activity,
            {
              ts: new Date().toISOString(),
              action: actionLabel,
              actor,
              details: JSON.stringify(updates),
            },
          ];
        }

        return updated;
      })
    );
  };

  const removeWorkItem = (id) =>
    setWorkItems((prev) => prev.filter((w) => String(w.id) !== String(id)));

  return (
    <WorkItemsContext.Provider
      value={{ workItems, getWorkItem, addWorkItem, updateWorkItem, removeWorkItem }}
    >
      {children}
    </WorkItemsContext.Provider>
  );
}

export const useWorkItems = () => useContext(WorkItemsContext);
