import React from "react";

export default function BusinessServiceHealthCard({ services }) {
  return (
    <div className="p-4 bg-white dark:bg-gray-900 rounded shadow">
      <h2 className="font-semibold mb-3">Business Service Health</h2>
      <ul className="space-y-2 text-sm">
        {services.map((s, i) => (
          <li
            key={i}
            className="flex justify-between border-b pb-1 last:border-none"
          >
            <span>{s.name}</span>
            <span className="text-xs">
              <span className="mr-3 text-red-600">P1: {s.p1}</span>
              <span className="text-yellow-600">SLA: {s.slaBreaches}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
