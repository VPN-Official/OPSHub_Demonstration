import React, { useState, useEffect } from "react";
import NotificationRow from "../components/notifications/NotificationRow";
import NotificationCard from "../components/notifications/NotificationCard";

export default function NotificationsCenter() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Mock notifications
  const notifications = [
    {
      id: 1,
      ts: "2025-08-31 10:00",
      severity: "critical",
      source: "Prometheus",
      msg: "CPU > 95% on DCN1 spine",
      workitemId: 101,
    },
    {
      id: 2,
      ts: "2025-08-31 10:05",
      severity: "warning",
      source: "Nagios",
      msg: "DB latency high",
      workitemId: null,
    },
    {
      id: 3,
      ts: "2025-08-31 10:10",
      severity: "info",
      source: "Automation",
      msg: "Patch rollout completed successfully",
      workitemId: null,
    },
  ];

  // Filtering
  const filtered = notifications.filter((n) =>
    filter === "all" ? true : n.severity === filter
  );

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Notifications Center</h1>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {["all", "critical", "warning", "info"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-sm ${
              filter === f
                ? "bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-700"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      {isMobile ? (
        <div className="space-y-3">
          {filtered.map((n) => (
            <NotificationCard key={n.id} notification={n} />
          ))}
        </div>
      ) : (
        <table className="w-full text-sm border">
          <thead className="bg-gray-100 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Severity</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Message</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((n) => (
              <NotificationRow key={n.id} notification={n} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
