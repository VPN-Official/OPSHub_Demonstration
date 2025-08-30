import React from "react";

export default function InfoTab({ workitem }) {
  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
      <h2 className="font-semibold mb-2">Details</h2>
      <ul className="text-sm space-y-1">
        <li><strong>ID:</strong> {workitem.id}</li>
        <li><strong>Title:</strong> {workitem.title}</li>
        <li><strong>Priority:</strong> {workitem.priority}</li>
        <li><strong>SLA Remaining:</strong> {workitem.sla_remaining} min</li>
        <li><strong>Impact:</strong> ${workitem.impact.toLocaleString()}</li>
        <li><strong>Owner:</strong> {workitem.owner || "Unassigned"}</li>
        <li><strong>Status:</strong> {workitem.status}</li>
        <li><strong>Service:</strong> {workitem.service}</li>
        <li><strong>Business Service:</strong> {workitem.businessService}</li>
      </ul>
    </div>
  );
}
