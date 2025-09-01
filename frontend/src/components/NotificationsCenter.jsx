import React, { useState } from "react";
import { useNotifications } from "../contexts/NotificationsContext.jsx";
import { Bell, CheckCircle2, XCircle, Trash2 } from "lucide-react"; // ✅ Lucide icons

/**
 * NotificationsCenter
 * - Unified notification feed
 * - Filters: All, Unacked, Dismissed
 * - Badge count = active + unacknowledged
 * - Dismiss individually or all
 */
export default function NotificationsCenter() {
  const {
    activeFeed,
    dismissedFeed,
    acknowledgeNotification,
    dismissNotification,
    dismissAllNotifications,
    badgeCount,
  } = useNotifications();

  const [filter, setFilter] = useState("all");

  // ✅ Apply filter
  const filtered =
    filter === "all"
      ? activeFeed
      : filter === "unacked"
      ? activeFeed.filter((n) => !n.acknowledged)
      : dismissedFeed;

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Bell size={20} /> Notifications
        </h2>
        <span className="bg-blue-600 text-white px-2 py-1 rounded-full text-xs">
          {badgeCount}
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-3 text-sm border-b pb-2">
        <button
          onClick={() => setFilter("all")}
          className={filter === "all" ? "text-blue-600 font-semibold" : "text-gray-600"}
        >
          All
        </button>
        <button
          onClick={() => setFilter("unacked")}
          className={filter === "unacked" ? "text-blue-600 font-semibold" : "text-gray-600"}
        >
          Unacknowledged
        </button>
        <button
          onClick={() => setFilter("dismissed")}
          className={filter === "dismissed" ? "text-blue-600 font-semibold" : "text-gray-600"}
        >
          Dismissed
        </button>
      </div>

      {/* Feed */}
      <div className="flex flex-col gap-2">
        {filtered.length === 0 && (
          <div className="text-sm text-gray-500">No notifications found.</div>
        )}

        {filtered.map((n) => (
          <div
            key={n.id}
            className={`p-3 border rounded-lg flex justify-between items-center ${
              n.dismissed ? "bg-gray-50 text-gray-400" : "bg-white"
            }`}
          >
            <div>
              <p className="text-sm">{n.message}</p>
              <span className="text-xs text-gray-500">
                {new Date(n.timestamp).toLocaleString()}
              </span>
            </div>
            <div className="flex gap-2">
              {!n.acknowledged && !n.dismissed && (
                <button
                  onClick={() => acknowledgeNotification(n.id)}
                  className="text-green-600 hover:text-green-800"
                  title="Acknowledge"
                >
                  <CheckCircle2 size={18} />
                </button>
              )}
              {!n.dismissed && (
                <button
                  onClick={() => dismissNotification(n.id)}
                  className="text-red-600 hover:text-red-800"
                  title="Dismiss"
                >
                  <XCircle size={18} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Dismiss All */}
      {filter !== "dismissed" && filtered.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={dismissAllNotifications}
            className="flex items-center gap-1 px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-sm"
          >
            <Trash2 size={14} /> Dismiss All
          </button>
        </div>
      )}
    </div>
  );
}