import React from "react";

export default function TimelineTab({ workitemId }) {
  const timeline = [
    { ts: "2025-08-30 09:55", event: "Created" },
    { ts: "2025-08-30 10:05", event: "Assigned to Alice" },
    { ts: "2025-08-30 10:15", event: "Escalated to SME" },
  ];

  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
      <h2 className="font-semibold mb-2">Activity Timeline</h2>
      <ul className="space-y-2 text-sm">
        {timeline.map((t, i) => (
          <li key={i} className="border-l-2 pl-2 border-blue-600">
            <span className="font-mono text-xs text-gray-500">{t.ts}</span> — {t.event}
          </li>
        ))}
      </ul>
    </div>
  );
}
