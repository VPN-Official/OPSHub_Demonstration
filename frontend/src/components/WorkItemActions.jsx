import React from "react";
import { useWorkItems } from "../contexts/WorkItemsContext.jsx";
import { useToast, TOAST_TYPES } from "../contexts/ToastContext.jsx";
import { Play, User, MessageSquare } from "lucide-react";

/**
 * WorkItemActions
 * - Shared action buttons for work items
 * - Used in both SmartQueueTable and SmartQueueCard
 */
export default function WorkItemActions({ itemId, compact = false }) {
  const { updateWorkItem } = useWorkItems();
  const { addToast } = useToast();

  const handleReassign = () => {
    updateWorkItem(itemId, { assignedTo: "dispatcher-queue" });
    addToast({ message: "Work item reassigned", type: TOAST_TYPES.INFO });
  };

  const handleAutomation = () => {
    addToast({ message: `Automation triggered for ${itemId}`, type: TOAST_TYPES.SUCCESS });
    // 🔧 TODO: actual automation trigger logic
  };

  const handleChat = () => {
    addToast({ message: `Chat opened for ${itemId}`, type: TOAST_TYPES.INFO });
    // 🔧 TODO: integrate chat modal/context
  };

  return (
    <div className={`flex ${compact ? "gap-2" : "gap-3 mt-2"}`}>
      <button
        onClick={handleReassign}
        className={`flex items-center gap-1 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-sm`}
      >
        <User size={14} /> {!compact && "Reassign"}
      </button>
      <button
        onClick={handleAutomation}
        className={`flex items-center gap-1 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-sm`}
      >
        <Play size={14} /> {!compact && "Automate"}
      </button>
      <button
        onClick={handleChat}
        className={`flex items-center gap-1 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-sm`}
      >
        <MessageSquare size={14} /> {!compact && "Chat"}
      </button>
    </div>
  );
}