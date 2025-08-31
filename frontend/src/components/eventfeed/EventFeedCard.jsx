import React from "react";

export default function EventFeedCard({ notification, onAck, onDismiss, onOpenWorkItem }) {
  return (
    <div className="p-3 bg-white dark:bg-gray-900 rounded shadow flex flex-col gap-2">
      <div className="flex justify-between">
        <span className="font-mono text-xs text-gray-500">{notification.ts}</span>
        <span
          className={`px-2 py-0.5 text-xs text-white rounded ${
            notification.severity === "critical"
              ? "bg-red-600"
              : notification.severity === "warning"
              ? "bg-orange-500"
              : "bg-blue-500"
          }`}
        >
          {notification.severity.toUpperCase()}
        </span>
      </div>
      <p className="text-sm">
        <span className="font-semibold">{notification.source || "System"}: </span>
        {notification.msg}
      </p>
      <div className="flex gap-2">
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
      </div>
    </div>
  );
}
