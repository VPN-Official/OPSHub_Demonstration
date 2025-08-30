import React from "react";

export default function AutomationsTab({ workitemId }) {
  const playbooks = [
    { name: "Restart DB Service", desc: "Restarts DB daemon on primary node" },
    { name: "Apply BGP Rollback", desc: "Reverts last BGP config change" },
  ];

  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
      <h2 className="font-semibold mb-2">Automations</h2>
      <ul className="space-y-2">
        {playbooks.map((p, i) => (
          <li key={i} className="flex justify-between items-center">
            <div>
              <p className="font-semibold text-sm">{p.name}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">{p.desc}</p>
            </div>
            <button className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700">
              Run
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
