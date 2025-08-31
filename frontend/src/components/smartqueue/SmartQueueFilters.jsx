import React from "react";
import { useWorkItems } from "../../context/WorkItemsContext";

export default function SmartQueueFilters({ filters, setFilters }) {
  const { workItems } = useWorkItems();

  const services = Array.from(
    new Set(workItems.map((w) => w.business_service?.name).filter(Boolean))
  );

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      {/* Severity */}
      <select
        value={filters.severity}
        onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
        className="px-2 py-1 border rounded text-sm"
      >
        <option value="all">All Severities</option>
        <option value="critical">Critical</option>
        <option value="warning">Warning</option>
        <option value="info">Info</option>
      </select>

      {/* Assignment */}
      <select
        value={filters.assigned}
        onChange={(e) => setFilters({ ...filters, assigned: e.target.value })}
        className="px-2 py-1 border rounded text-sm"
      >
        <option value="all">All Assignments</option>
        <option value="me">Assigned to Me</option>
        <option value="unassigned">Unassigned</option>
      </select>

      {/* Business Service */}
      <select
        value={filters.service}
        onChange={(e) => setFilters({ ...filters, service: e.target.value })}
        className="px-2 py-1 border rounded text-sm"
      >
        <option value="all">All Services</option>
        {services.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {/* Status */}
      <select
        value={filters.status}
        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        className="px-2 py-1 border rounded text-sm"
      >
        <option value="all">All Statuses</option>
        <option value="open">Open</option>
        <option value="in_progress">In Progress</option>
        <option value="resolved">Resolved</option>
        <option value="closed">Closed</option>
      </select>
    </div>
  );
}
