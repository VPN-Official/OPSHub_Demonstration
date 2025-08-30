import React from "react";

export default function EscalationPath({ workitem }) {
  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
      <h2 className="font-semibold mb-2">Escalation Path</h2>
      <p className="text-sm">Current Team: {workitem.team}</p>
      <p className="text-sm">Escalated To: {workitem.escalatedTo}</p>
      <p className="text-xs text-gray-500 mt-2">On-call rotation loaded from Ops roster</p>
    </div>
  );
}
