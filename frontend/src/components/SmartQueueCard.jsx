import React, { useState } from "react";
import { explainSmartScore } from "../utils/scoring";

export default function SmartQueueCard({ workitem }) {
  const [showWhy, setShowWhy] = useState(false);
  const reasons = explainSmartScore(workitem, "u1");

  return (
    <div className="bg-white dark:bg-gray-900 shadow rounded p-4 mb-4">
      <h3 className="font-bold">{workitem.title}</h3>
      <p className="text-xs text-gray-500">Priority: {workitem.priority}</p>
      <button onClick={() => setShowWhy(!showWhy)} className="text-sm text-ai-purple hover:underline">
        {showWhy ? "Hide Why" : "Why?"}
      </button>
      {showWhy && (
        <ul className="mt-2 text-xs list-disc pl-4">
          {reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}
    </div>
  );
}
