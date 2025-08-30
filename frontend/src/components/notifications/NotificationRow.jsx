import React from "react";
import { useNavigate } from "react-router-dom";

export default function NotificationRow({ notification }) {
  const navigate = useNavigate();

  const sevColors = {
    critical: "text-red-600 font-bold",
    warning: "text-orange-600 font-semibold",
    info: "text-blue-600",
  };

  const handleAck = () => {
    console.log(`Acknowledged ${notification.id}`);
  };

  const handleCreate = () => {
    console.log(`Create WorkItem from notification ${notification.id}`);
  };

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800">
      <td className="px-3 py-2">{notification.ts}</td>
      <td className={`px-3 py-2 ${sevColors[notification.severity]}`}>
        {notification.severity.toUpperCase()}
      </td>
      <td className="px-3 py-2">{notification.source}</td>
      <td className="px-3 py-2">{notification.msg}</td>
      <td className="px-3 py-2 flex gap-2">
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
      </td>
    </tr>
  );
}
