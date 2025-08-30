import React from "react";

export default function BusinessServiceHealth({ businessService }) {
  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
      <h2 className="font-semibold mb-2">Business Service Health</h2>
      <p className="text-sm font-medium">{businessService}</p>
      <ul className="text-xs space-y-1 mt-2">
        <li>SLA breaches today: 2</li>
        <li>Active incidents: 3</li>
        <li>Compliance certs: PCI, GDPR</li>
      </ul>
    </div>
  );
}
