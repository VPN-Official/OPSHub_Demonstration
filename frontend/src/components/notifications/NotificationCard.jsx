import React from "react";
import { useNavigate } from "react-router-dom";

export default function NotificationCard({ notification }) {
  const navigate = useNavigate();

  const sevColors = {
    critical: "bg-red-600",
    warning: "bg-orange-500",
    info: "bg-blue-500",
  };

  const handleAck = () => {
    console.log(`Acknowledged ${notification.id}`);
  };

  const handleCreate = () => {
    console.log(`Create WorkItem from notification ${notification.id}`);
  };

  return (
    <div className="p-3 bg-white dark:bg-gray-900 rounded shadow">
      <div className="flex justify-between items-center">
        <span className="font-mono text-xs text-gray-500">
          {notification.ts}
        </span>
        <span
          className={`px-2 py-0.5 text-xs text-white rounded ${sevColors[notification.severity]}`}
        >
          {notification.severity.toUpperCase()}
        </span>
      </div>
      <p className="mt-2 text-sm">
        <span className="font-semibold">{notification.source}: </span>
        {notification.msg}
      </p>
      <div className="flex gap-2 mt-2">
        {notification.workitemId ? (
          <button
            onClick={() => navigate(`/workitem/${notification.workitemId}`)}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
          >
            Open WorkItem
          </button>
        ) : (
          <button
            onClick={handleCreate}
            className="px-2 py-1 text-xs bg-green-600 text-white rounded"
          >
            Create WorkItem
          </button>
        )}
        <button
          onClick={handleAck}
          className="px-2 py-1 text-xs bg-gray-500 text-white rounded"
        >
          Ack
        </button>
      </div>
    </div>
  );
}
