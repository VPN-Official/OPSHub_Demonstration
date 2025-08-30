import React from "react";

export default function LogsTab({ workitemId }) {
  const logs = [
    { ts: "2025-08-30 10:00", source: "Prometheus", msg: "CPU usage > 90%" },
    { ts: "2025-08-30 10:05", source: "Splunk", msg: "Database connection timeout" },
    { ts: "2025-08-30 10:10", source: "DCN Agent", msg: "Cooling fan alert" },
  ];

  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
      <h2 className="font-semibold mb-2">System Logs</h2>
      <ul className="space-y-2 text-sm">
        {logs.map((l, i) => (
          <li key={i} className="border-b pb-1">
            <span className="font-mono text-xs text-gray-500">{l.ts}</span> — 
            <span className="ml-1 font-semibold">{l.source}:</span> {l.msg}
          </li>
        ))}
      </ul>
    </div>
  );
}
