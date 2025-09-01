import React, { useEffect, useState } from "react";
import { useWorkItems } from "../contexts/WorkItemsContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import SmartQueueTable from "../components/SmartQueueTable.jsx";
import SmartQueueCard from "../components/SmartQueueCard.jsx";
import { Filter, Shuffle, Info } from "lucide-react"; // enterprise icons only

export default function SmartQueue() {
  const { workItems = [] } = useWorkItems(); // ✅ safe default
  const { user } = useAuth();

  const [filtered, setFiltered] = useState([]);
  const [view, setView] = useState("table"); // default desktop
  const [roleFilter, setRoleFilter] = useState(null);

  // ✅ Apply role-based defaults
  useEffect(() => {
    if (!user) return;

    if (user.role === "Support Engineer") {
      setRoleFilter({ assignedTo: user.id });
    } else if (user.role === "Dispatcher") {
      setRoleFilter({ teamId: user.teamId });
    } else if (user.role === "Manager") {
      setRoleFilter({ scope: "all" });
    }
  }, [user]);

  // ✅ Filter and sort by Smart Score
  useEffect(() => {
    let relevant = Array.isArray(workItems) ? workItems.filter(Boolean) : [];

    if (roleFilter?.assignedTo) {
      relevant = relevant.filter((w) => w.assignedTo === roleFilter.assignedTo);
    } else if (roleFilter?.teamId) {
      relevant = relevant.filter((w) => w.teamId === roleFilter.teamId);
    }

    // Sort by smartScore if available
    relevant.sort((a, b) => (b.smartScore ?? 0) - (a.smartScore ?? 0));

    setFiltered(relevant);
  }, [workItems, roleFilter]);

  // ✅ Responsive view detection
  useEffect(() => {
    const handleResize = () => {
      setView(window.innerWidth < 768 ? "card" : "table");
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="p-4 flex flex-col gap-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Shuffle size={18} /> SmartQueue
      </h2>

      {/* Filters placeholder (config-driven) */}
      <div className="flex gap-2 items-center">
        <Filter size={16} />
        <span className="text-sm text-gray-600">Filters (configurable)</span>
      </div>

      {/* Queue Content */}
      {view === "table" ? (
        <SmartQueueTable items={filtered} />
      ) : (
        <SmartQueueCard items={filtered} />
      )}

      {/* Explanation for Smart Score */}
      <div className="text-xs text-gray-500 flex items-center gap-1">
        <Info size={14} /> Sorted by Smart Score (AI-prioritized)
      </div>
    </div>
  );
}