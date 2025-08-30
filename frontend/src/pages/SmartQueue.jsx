import React, { useEffect, useState } from "react";
import SmartQueueCard from "../components/SmartQueueCard";
import SmartQueueRow from "../components/SmartQueueRow";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useNotifications } from "../context/NotificationsContext";

export default function SmartQueue() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Filters
  const [assignment, setAssignment] = useState("all");
  const [priority, setPriority] = useState("all");
  const [sla, setSla] = useState("all");
  const [automation, setAutomation] = useState("all");
  const [sort, setSort] = useState("smartscore");

  // Sample workitems
  const [workitems, setWorkitems] = useState([
    {
      id: 1,
      title: "Cooling failure in DCN1",
      priority: "priority_1",
      sla_target_minutes: 60,
      sla_remaining: 12,
      impact: 500000,
      owner: "Alice",
      automationEligible: true,
    },
    {
      id: 2,
      title: "Patch update pending",
      priority: "priority_2",
      sla_target_minutes: 180,
      sla_remaining: 160,
      impact: 10000,
      owner: "Bob",
      automationEligible: false,
    },
    {
      id: 3,
      title: "Backup job delayed",
      priority: "priority_2",
      sla_target_minutes: 90,
      sla_remaining: -5,
      impact: 20000,
      owner: "Charlie",
      automationEligible: true,
    },
    {
      id: 4,
      title: "Unassigned database alert",
      priority: "priority_1",
      sla_target_minutes: 120,
      sla_remaining: 80,
      impact: 75000,
      owner: "",
      automationEligible: false,
    },
  ]);

  const isOnline = useOnlineStatus();
  const { setNotifications } = useNotifications();

  // Switch between card and table dynamically
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isOnline) setNotifications((prev) => [...prev, "Fetched Smart Queue"]);
    else setNotifications((prev) => [...prev, "Offline mode - showing cache"]);
  }, [isOnline]);

  // --- Filtering ---
  let filteredItems = [...workitems];

  // Assignment filter (simulated: current user = Alice, group = Alice+Bob)
  if (assignment === "me") {
    filteredItems = filteredItems.filter((wi) => wi.owner === "Alice");
  } else if (assignment === "group") {
    filteredItems = filteredItems.filter((wi) =>
      ["Alice", "Bob"].includes(wi.owner)
    );
  } else if (assignment === "unassigned") {
    filteredItems = filteredItems.filter((wi) => !wi.owner);
  }

  // Priority filter
  if (priority !== "all") {
    if (priority === "priority_3") {
      filteredItems = filteredItems.filter(
        (wi) => wi.priority !== "priority_1" && wi.priority !== "priority_2"
      );
    } else {
      filteredItems = filteredItems.filter((wi) => wi.priority === priority);
    }
  }

  // SLA filter
  if (sla !== "all") {
    filteredItems = filteredItems.filter((wi) => {
      if (sla === "breached") return wi.sla_remaining < 0;
      if (sla === "atrisk")
        return wi.sla_remaining >= 0 && wi.sla_remaining < 15;
      if (sla === "safe") return wi.sla_remaining >= 15;
      return true;
    });
  }

  // Automation filter
  if (automation !== "all") {
    filteredItems = filteredItems.filter((wi) =>
      automation === "eligible" ? wi.automationEligible : !wi.automationEligible
    );
  }

  // --- Sorting ---
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sort === "sla") return a.sla_remaining - b.sla_remaining;
    if (sort === "priority") return a.priority.localeCompare(b.priority);
    return a.id - b.id; // placeholder for smartscore
  });

  // --- Summary counts ---
  const p1Count = workitems.filter((w) => w.priority === "priority_1").length;
  const p2Count = workitems.filter((w) => w.priority === "priority_2").length;
  const slaBreaches = workitems.filter((w) => w.sla_remaining < 0).length;
  const automationCount = workitems.filter((w) => w.automationEligible).length;

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Smart Queue</h1>

      {/* --- Summary Bar --- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-3 bg-white dark:bg-gray-900 rounded shadow flex justify-between items-center">
          <span className="text-sm font-medium">P1 Incidents</span>
          <span className="px-2 py-1 text-xs rounded bg-red-600 text-white">
            {p1Count}
          </span>
        </div>
        <div className="p-3 bg-white dark:bg-gray-900 rounded shadow flex justify-between items-center">
          <span className="text-sm font-medium">P2 Incidents</span>
          <span className="px-2 py-1 text-xs rounded bg-orange-500 text-white">
            {p2Count}
          </span>
        </div>
        <div className="p-3 bg-white dark:bg-gray-900 rounded shadow flex justify-between items-center">
          <span className="text-sm font-medium">SLA Breaches</span>
          <span className="px-2 py-1 text-xs rounded bg-yellow-500 text-white">
            {slaBreaches}
          </span>
        </div>
        <div className="p-3 bg-white dark:bg-gray-900 rounded shadow flex justify-between items-center">
          <span className="text-sm font-medium">Automation Eligible</span>
          <span className="px-2 py-1 text-xs rounded bg-blue-500 text-white">
            {automationCount}
          </span>
        </div>
      </div>

      {/* --- Filters & Sort --- */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Assignment */}
        <select
          value={assignment}
          onChange={(e) => setAssignment(e.target.value)}
          className="p-2 border rounded text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="all">All Assignments</option>
          <option value="me">Assigned to Me</option>
          <option value="group">Assigned to My Group</option>
          <option value="unassigned">Unassigned</option>
        </select>

        {/* Priority */}
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="p-2 border rounded text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="all">All Priorities</option>
          <option value="priority_1">P1 Only</option>
          <option value="priority_2">P2 Only</option>
          <option value="priority_3">P3+</option>
        </select>

        {/* SLA */}
        <select
          value={sla}
          onChange={(e) => setSla(e.target.value)}
          className="p-2 border rounded text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="all">All SLA</option>
          <option value="breached">Breached</option>
          <option value="atrisk">At Risk (&lt;15m)</option>
          <option value="safe">Safe (&gt;15m)</option>
        </select>

        {/* Automation */}
        <select
          value={automation}
          onChange={(e) => setAutomation(e.target.value)}
          className="p-2 border rounded text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="all">All</option>
          <option value="eligible">Automation Eligible</option>
          <option value="manual">Manual Only</option>
        </select>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="p-2 border rounded text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="smartscore">Sort by Smart Score</option>
          <option value="sla">Sort by SLA</option>
          <option value="priority">Sort by Priority</option>
        </select>
      </div>

      {/* --- Main Content --- */}
      {isMobile ? (
        <div className="space-y-4">
          {sortedItems.map((wi) => (
            <SmartQueueCard key={wi.id} workitem={wi} />
          ))}
        </div>
      ) : (
        <table className="w-full text-sm border">
          <thead className="bg-gray-100 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Priority</th>
              <th className="px-3 py-2 text-left">SLA</th>
              <th className="px-3 py-2 text-left">Impact</th>
              <th className="px-3 py-2 text-left">Owner</th>
              <th className="px-3 py-2 text-left">Automation</th>
              <th className="px-3 py-2 text-left">Explain</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((wi) => (
              <SmartQueueRow key={wi.id} workitem={wi} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
