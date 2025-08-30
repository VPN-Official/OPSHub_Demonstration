import React from "react";

export default function ScheduleFilters({ activeLayers, setActiveLayers }) {
  const toggleLayer = (layer) => {
    setActiveLayers({ ...activeLayers, [layer]: !activeLayers[layer] });
  };

  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {["planned", "shifts", "blackouts"].map((layer) => (
        <button
          key={layer}
          onClick={() => toggleLayer(layer)}
          className={`px-3 py-1 rounded text-sm ${
            activeLayers[layer]
              ? "bg-blue-600 text-white"
              : "bg-gray-200 dark:bg-gray-700"
          }`}
        >
          {layer === "planned" && "Planned Work"}
          {layer === "shifts" && "Shifts"}
          {layer === "blackouts" && "Blackouts"}
        </button>
      ))}
    </div>
  );
}
