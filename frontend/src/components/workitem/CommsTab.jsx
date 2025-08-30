import React from "react";

export default function CommsTab({ workitemId }) {
  const comms = [
    { audience: "Leadership", msg: "Cooling failure being worked, ETA 20 min." },
    { audience: "Customer", msg: "Minor impact on service, monitoring closely." },
  ];

  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
      <h2 className="font-semibold mb-2">Stakeholder Comms</h2>
      <ul className="space-y-2 text-sm">
        {comms.map((c, i) => (
          <li key={i} className="border-b pb-1">
            <span className="font-semibold">{c.audience}:</span> {c.msg}
          </li>
        ))}
      </ul>
    </div>
  );
}
