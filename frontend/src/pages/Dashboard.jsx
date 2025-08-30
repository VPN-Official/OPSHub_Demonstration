import React from "react";
import KpiCard from "../components/dashboard/KpiCard";
import WorkItemTrendsChart from "../components/dashboard/WorkItemTrendsChart";
import BusinessServiceHealthCard from "../components/dashboard/BusinessServiceHealthCard";

export default function Dashboard() {
  // Mock data for KPIs
  const kpis = {
    p1: 3,
    p2: 7,
    slaBreaches: 5,
  };

  // Mock WorkItem trends (last 7 days)
  const workitemTrends = [
    { date: "2025-08-25", p1: 2, p2: 5 },
    { date: "2025-08-26", p1: 1, p2: 4 },
    { date: "2025-08-27", p1: 0, p2: 3 },
    { date: "2025-08-28", p1: 3, p2: 6 },
    { date: "2025-08-29", p1: 2, p2: 4 },
    { date: "2025-08-30", p1: 4, p2: 7 },
    { date: "2025-08-31", p1: 1, p2: 2 },
  ];

  // Mock Business Service health
  const businessServices = [
    { name: "Payments Platform", p1: 2, slaBreaches: 1 },
    { name: "Messaging Platform", p1: 1, slaBreaches: 2 },
    { name: "User Identity", p1: 0, slaBreaches: 0 },
    { name: "Analytics", p1: 1, slaBreaches: 1 },
    { name: "Storage", p1: 0, slaBreaches: 2 },
  ];

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Operations Dashboard</h1>

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Active P1 Incidents" value={kpis.p1} color="red" />
        <KpiCard label="Active P2 Incidents" value={kpis.p2} color="orange" />
        <KpiCard label="SLA Breaches" value={kpis.slaBreaches} color="yellow" />
      </div>

      {/* Secondary insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <WorkItemTrendsChart data={workitemTrends} />
        <BusinessServiceHealthCard services={businessServices} />
      </div>
    </div>
  );
}
