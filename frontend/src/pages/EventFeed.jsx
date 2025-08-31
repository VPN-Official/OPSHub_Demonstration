import React, { useState, useEffect } from "react";
import { useNotifications } from "../context/NotificationsContext";
import { useNavigate } from "react-router-dom";
import EventFeedRow from "../components/eventfeed/EventFeedRow";
import EventFeedCard from "../components/eventfeed/EventFeedCard";

export default function EventFeed() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [filter, setFilter] = useState("unacked"); // 👈 default = unacked to match Bell badge
  const { notifications, dismissNotification, ackNotification } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Filtering logic (with "unacked" option)
  const filtered = notifications.filter((n) => {
    if (filter === "all") return true;
    if (filter === "unacked") return !n.acked;
    return n.severity === filter;
  });

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Event Feed</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Raw system events and alerts. Not all require action. 
        Use filters to focus on what matters, or promote to WorkItems when necessary.
      </p>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {["all", "unacked", "critical", "warning", "info"].map((f) => (
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

      {/* Render rows or cards depending on screen */}
      {isMobile ? (
        <div className="space-y-3">
          {filtered.map((n) => (
            <EventFeedCard
              key={n.id}
              notification={n}
              onAck={() => ackNotification(n.id)}
              onDismiss={() => dismissNotification(n.id)}
              onOpenWorkItem={() =>
                n.workitemId
                  ? navigate(`/workitem/${n.workitemId}`)
                  : console.log("Create WorkItem from notification", n.id)
              }
            />
          ))}
          {filtered.length === 0 && (
            <p className="text-gray-500 text-sm">No notifications</p>
          )}
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
              <EventFeedRow
                key={n.id}
                notification={n}
                onAck={() => ackNotification(n.id)}
                onDismiss={() => dismissNotification(n.id)}
                onOpenWorkItem={() =>
                  n.workitemId
                    ? navigate(`/workitem/${n.workitemId}`)
                    : console.log("Create WorkItem from notification", n.id)
                }
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
