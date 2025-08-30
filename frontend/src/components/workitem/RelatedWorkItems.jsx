import React from "react";

export default function RelatedWorkItems({ service }) {
  const related = [
    { id: 44, title: "DB latency high", priority: "P2" },
    { id: 45, title: "Patch rollback required", priority: "P3" },
  ];

  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded mt-4">
      <h2 className="font-semibold mb-2">Related WorkItems (Service: {service})</h2>
      <ul className="text-sm space-y-1">
        {related.map((r) => (
          <li key={r.id} className="flex justify-between">
            <span>#{r.id} — {r.title}</span>
            <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded">{r.priority}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
