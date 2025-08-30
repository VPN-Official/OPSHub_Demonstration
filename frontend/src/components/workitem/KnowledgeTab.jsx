import React from "react";

export default function KnowledgeTab({ workitemId }) {
  const kbDocs = [
    { title: "DB Connection Issues", body: "Check listener, firewall, and creds." },
    { title: "Cooling System Failures", body: "Verify fan RPM and PSU health." },
  ];

  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
      <h2 className="font-semibold mb-2">Knowledge Base</h2>
      <ul className="space-y-3 text-sm">
        {kbDocs.map((d, i) => (
          <li key={i}>
            <p className="font-semibold">{d.title}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">{d.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
