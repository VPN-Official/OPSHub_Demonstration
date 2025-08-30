import React from "react";

export default function KpiCard({ label, value, color }) {
  const colors = {
    red: "bg-red-600",
    orange: "bg-orange-500",
    yellow: "bg-yellow-500",
    blue: "bg-blue-600",
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-900 rounded shadow flex justify-between items-center">
      <span className="text-sm font-medium">{label}</span>
      <span className={`px-3 py-1 text-lg font-bold text-white rounded ${colors[color]}`}>
        {value}
      </span>
    </div>
  );
}
