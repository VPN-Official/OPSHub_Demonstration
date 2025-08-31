import React, { useState } from "react";
import { useWorkItems } from "../context/WorkItemsContext";
import SmartQueueFilters from "../components/smartqueue/SmartQueueFilters";
import SmartQueueTable from "../components/smartqueue/SmartQueueTable";
import SmartQueueCard from "../components/smartqueue/SmartQueueCard";
import SmartQueuePagination from "../components/smartqueue/SmartQueuePagination";

export default function SmartQueue() {
  const { workItems } = useWorkItems();
  const [filters, setFilters] = useState({
    severity: "all",
    assigned: "all",
    service: "all",
    status: "all",
  });
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Apply filters
  const filtered = workItems.filter((w) => {
    if (filters.severity !== "all" && w.severity !== filters.severity) return false;
    if (filters.assigned === "me" && !w.assigned_to) return false; // placeholder "me"
    if (filters.assigned === "unassigned" && w.assigned_to) return false;
    if (filters.service !== "all" && w.business_service?.name !== filters.service) return false;
    if (filters.status !== "all" && w.status !== filters.status) return false;
    return true;
  });

  // Pagination
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const isMobile = window.innerWidth < 768;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Smart Queue</h1>
      <SmartQueueFilters filters={filters} setFilters={setFilters} />
      {isMobile ? (
        <div className="space-y-3">
          {paginated.map((w) => <SmartQueueCard key={w.id} item={w} />)}
        </div>
      ) : (
        <SmartQueueTable items={paginated} />
      )}
      <SmartQueuePagination
        page={page}
        setPage={setPage}
        total={filtered.length}
        pageSize={pageSize}
      />
    </div>
  );
}
