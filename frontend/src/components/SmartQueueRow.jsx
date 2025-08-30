import React, { useState } from "react";
import { explainSmartScore } from "../utils/scoring";

export default function SmartQueueRow({ workitem }) {
  const [showWhy, setShowWhy] = useState(false);
  const reasons = explainSmartScore(workitem, "u1");

  return (
    <>
      <tr className="border-b">
        <td className="px-3 py-2">{workitem.id}</td>
        <td className="px-3 py-2">{workitem.title}</td>
        <td className="px-3 py-2">{workitem.priority}</td>
        <td className="px-3 py-2"><button onClick={() => setShowWhy(!showWhy)} className="text-xs text-ai-purple">Why?</button></td>
      </tr>
      {showWhy && (
        <tr><td colSpan="4" className="text-xs px-4 py-2"><ul>{reasons.map((r,i)=><li key={i}>{r}</li>)}</ul></td></tr>
      )}
    </>
  );
}
