import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useWorkItems } from "../../context/WorkItemsContext";

export default function SmartQueueTable({ items = [] }) {
  const { updateWorkItem } = useWorkItems();
  const [showWhy, setShowWhy] = useState(null); // track which row is expanded

  if (!items.length) {
    return (
      <p className="text-sm text-gray-500 p-4">
        No work items match the current filters.
      </p>
    );
  }

  const handleAck = (item) => {
    if (item.status === "open") {
      updateWorkItem(item.id, { status: "in_progress" }, "ack");
    }
  };

  const handleAssign = (item) => {
    updateWorkItem(
      item.id,
      {
        assigned_to: { id: 999, name: "Me (Engineer)" },
        status: item.status === "open" ? "in_progress" : item.status,
      },
      "assign"
    );
  };

  const handleClose = (item) => {
    if (item.status !== "closed") {
      updateWorkItem(item.id, { status: "closed" }, "close");
    }
  };

  return (
    <table className="w-full text-sm border">
      <thead className="bg-gray-100 dark:bg-gray-800">
        <tr>
          <th className="px-3 py-2">ID</th>
          <th className="px-3 py-2">Title</th>
          <th className="px-3 py-2">Severity</th>
          <th className="px-3 py-2">Status</th>
          <th className="px-3 py-2">Business Service</th>
          <th className="px-3 py-2">Assigned To</th>
          <th className="px-3 py-2">Actions</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <React.Fragment key={item.id}>
            <tr className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="px-3 py-2">#{item.id}</td>
              <td className="px-3 py-2">
                <Link
                  to={`/workitem/${item.id}`}
                  className="text-blue-600 hover:underline"
                >
                  {item.title}
                </Link>
              </td>
              <td className="px-3 py-2 capitalize">{item.severity}</td>
              <td className="px-3 py-2 capitalize">{item.status}</td>
              <td className="px-3 py-2">
                {item.business_service?.name || "-"}
              </td>
              <td className="px-3 py-2">
                {item.assigned_to?.name || "Unassigned"}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleAck(item)}
                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
                    disabled={item.status !== "open"}
                  >
                    Ack
                  </button>
                  <button
                    onClick={() => handleAssign(item)}
                    className="px-2 py-1 text-xs bg-green-600 text-white rounded"
                  >
                    Assign
                  </button>
                  <button
                    onClick={() => handleClose(item)}
                    className="px-2 py-1 text-xs bg-red-600 text-white rounded"
                    disabled={item.status === "closed"}
                  >
                    Close
                  </button>
                  <button
                    onClick={() =>
                      setShowWhy(showWhy === item.id ? null : item.id)
                    }
                    className="px-2 py-1 text-xs bg-gray-600 text-white rounded"
                  >
                    Why?
                  </button>
                </div>
              </td>
            </tr>
            {showWhy === item.id && (
              <tr>
                <td colSpan="7" className="px-3 py-2 bg-yellow-50 text-sm">
                  <strong>Why prioritized?</strong> {item.reason}
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
}
