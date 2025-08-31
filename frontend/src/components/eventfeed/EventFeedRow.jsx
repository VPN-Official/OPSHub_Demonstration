import React from "react";

export default function EventFeedRow({ notification, onAck, onDismiss, onOpenWorkItem }) {
  const sevColors = {
    critical: "text-red-600 font-bold",
    warning: "text-orange-600 font-semibold",
    info: "text-blue-600",
  };

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800">
      <td className="px-3 py-2">{notification.ts}</td>
      <td className={`px-3 py-2 ${sevColors[notification.severity]}`}>
        {notification.severity.toUpperCase()}
      </td>
      <td className="px-3 py-2">{notification.source || "System"}</td>
      <td className="px-3 py-2">{notification.msg}</td>
      <td className="px-3 py-2 flex gap-2">
        {notification.workitemId ? (
          <button
            onClick={onOpenWorkItem}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
          >
            Open WorkItem
          </button>
        ) : (
          <button
            onClick={onOpenWorkItem}
            className="px-2 py-1 text-xs bg-green-600 text-white rounded"
          >
            Create WorkItem
          </button>
        )}
        <button
          onClick={onAck}
          className="px-2 py-1 text-xs bg-gray-500 text-white rounded"
        >
          Ack
        </button>
        <button
          onClick={onDismiss}
          className="px-2 py-1 text-xs bg-red-600 text-white rounded"
        >
          Dismiss
        </button>
      </td>
    </tr>
  );
}
