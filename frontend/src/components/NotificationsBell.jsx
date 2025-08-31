import React, { useState } from "react";
import { Bell, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useNotifications } from "../context/NotificationsContext";

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const { notifications, dismissNotification } = useNotifications();

  // Count unacked + criticals
  const unackedCount = notifications.filter((n) => !n.acked).length;
  const criticalCount = notifications.filter(
    (n) => n.severity === "critical" && !n.acked
  ).length;

  // Show last 3 notifications
  const latest = notifications.slice(0, 3);

  const sevColors = {
    critical: "text-red-600 font-bold",
    warning: "text-orange-600 font-semibold",
    info: "text-blue-600",
  };

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        className="relative p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-800"
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
      >
        <Bell size={20} />

        {/* Badge for unacked notifications */}
        {unackedCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-bold rounded-full px-1">
            {unackedCount}
          </span>
        )}

        {/* Red dot for criticals */}
        {criticalCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-600 rounded-full"></span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-900 rounded shadow-lg z-50">
          <div className="p-2 border-b border-gray-200 dark:border-gray-700 font-semibold text-sm">
            Notifications
          </div>
          <ul className="max-h-60 overflow-y-auto">
            {latest.map((n) => (
              <li
                key={n.id}
                className="px-3 py-2 text-sm border-b dark:border-gray-800 flex justify-between items-start"
              >
                <div>
                  <span className={sevColors[n.severity]}>
                    {n.severity.toUpperCase()}:
                  </span>{" "}
                  {n.msg}
                  <span className="block text-xs text-gray-500">{n.ts}</span>
                </div>
                <button
                  onClick={() => dismissNotification(n.id)}
                  className="text-gray-400 hover:text-red-600 ml-2"
                  aria-label="Dismiss notification"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
            {latest.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-500">
                No recent notifications
              </li>
            )}
          </ul>
          <div className="p-2 text-right">
            <Link
              to="/eventfeed"
              className="text-xs text-blue-600 hover:underline"
              onClick={() => setOpen(false)}
            >
              View full Event Feed →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
