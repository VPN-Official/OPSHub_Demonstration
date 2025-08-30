import React, { useEffect, useState } from "react";
import SmartQueueCard from "../components/SmartQueueCard";
import SmartQueueRow from "../components/SmartQueueRow";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useNotifications } from "../context/NotificationsContext";
import { explainSmartScore } from "../utils/scoring";
import { useNavigate } from "react-router-dom";

export default function SmartQueue() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Filters
  const [assignment, setAssignment] = useState("all");
  const [priority, setPriority] = useState("all");
  const [sla, setSla] = useState("all");
  const [automation, setAutomation] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("smartscore");

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Mock WorkItems
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
      status: "open",
      work_type: "incident",
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
      status: "in_progress",
      work_type: "change",
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
      status: "resolved",
      work_type: "problem",
    },
  ]);

  const isOnline = useOnlineStatus();
  const { setNotifications } = useNotifications();
  const navigate = useNavigate();

  // Smart Score helper
  const addSmartScore = (wi) => {
    const reasons = explainSmartScore(wi, "u1");
    let score = 0;
    if (wi.priority === "priority_1") score += 50;
    else if (wi.priority === "priority_2") score += 30;
    if (wi.sla_remaining < 0) score += 40;
    else if (wi.sla_remaining < 15) score += 20;
    if (wi.impact >= 100000) score += 30;
    if (wi.automationEligible) score += 10;
    wi.smartscore = score;
    wi.reasons = reasons;
    return wi;
  };

  // Enhance workitems with score
  useEffect(() => {
    setWorkitems((prev) => prev.map(addSmartScore));
  }, []);

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

  // Assignment (mock)
  if (assignment === "me") filteredItems = filteredItems.filter((wi) => wi.owner === "Alice");
  if (assignment === "group") filteredItems = filteredItems.filter((wi) => ["Alice", "Bob"].includes(wi.owner));
  if (assignment === "unassigned") filteredItems = filteredItems.filter((wi) => !wi.owner);

  if (priority !== "all") filteredItems = filteredItems.filter((wi) => wi.priority === priority);

  if (sla !== "all") {
    filteredItems = filteredItems.filter((wi) => {
      if (sla === "breached") return wi.sla_remaining < 0;
      if (sla === "atrisk") return wi.sla_remaining >= 0 && wi.sla_remaining < 15;
      if (sla === "safe") return wi.sla_remaining >= 15;
      return true;
    });
  }

  if (automation !== "all") {
    filteredItems = filteredItems.filter((wi) =>
      automation === "eligible" ? wi.automationEligible : !wi.automationEligible
    );
  }

  if (status !== "all") {
    filteredItems = filteredItems.filter((wi) => wi.status === status);
  }

  // --- Sorting ---
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sort === "sla") return a.sla_remaining - b.sla_remaining;
    if (sort === "priority") return a.priority.localeCompare(b.priority);
    if (sort === "smartscore") return b.smartscore - a.smartscore;
    return a.id - b.id;
  });

  // --- Pagination ---
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paginatedItems = sortedItems.slice(start, end);

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
          <span className="px-2 py-1 text-xs rounded bg-red-600 text-white">{p1Count}</span>
        </div>
        <div className="p-3 bg-white dark:bg-gray-900 rounded shadow flex justify-between items-center">
          <span className="text-sm font-medium">P2 Incidents</span>
          <span className="px-2 py-1 text-xs rounded bg-orange-500 text-white">{p2Count}</span>
        </div>
        <div className="p-3 bg-white dark:bg-gray-900 rounded shadow flex justify-between items-center">
          <span className="text-sm font-medium">SLA Breaches</span>
          <span className="px-2 py-1 text-xs rounded bg-yellow-500 text-white">{slaBreaches}</span>
        </div>
        <div className="p-3 bg-white dark:bg-gray-900 rounded shadow flex justify-between items-center">
          <span className="text-sm font-medium">Automation Eligible</span>
          <span className="px-2 py-1 text-xs rounded bg-blue-500 text-white">{automationCount}</span>
        </div>
      </div>

      {/* --- Filters --- */}
      {!isMobile ? (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <select value={assignment} onChange={(e) => setAssignment(e.target.value)} className="p-2 border rounded text-sm">
            <option value="all">All Assignments</option>
            <option value="me">Assigned to Me</option>
            <option value="group">Assigned to My Group</option>
            <option value="unassigned">Unassigned</option>
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="p-2 border rounded text-sm">
            <option value="all">All Priorities</option>
            <option value="priority_1">P1</option>
            <option value="priority_2">P2</option>
          </select>
          <select value={sla} onChange={(e) => setSla(e.target.value)} className="p-2 border rounded text-sm">
            <option value="all">All SLA</option>
            <option value="breached">Breached</option>
            <option value="atrisk">At Risk</option>
            <option value="safe">Safe</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="p-2 border rounded text-sm">
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
          <select value={automation} onChange={(e) => setAutomation(e.target.value)} className="p-2 border rounded text-sm">
            <option value="all">All</option>
            <option value="eligible">Automation Eligible</option>
            <option value="manual">Manual Only</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="p-2 border rounded text-sm">
            <option value="smartscore">Sort by Smart Score</option>
            <option value="sla">Sort by SLA</option>
            <option value="priority">Sort by Priority</option>
          </select>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 mb-4">
          <button className={`px-2 py-1 rounded ${assignment === "me" ? "bg-blue-600 text-white" : "bg-gray-200"}`} onClick={() => setAssignment("me")}>Me</button>
          <button className={`px-2 py-1 rounded ${priority === "priority_1" ? "bg-red-600 text-white" : "bg-gray-200"}`} onClick={() => setPriority("priority_1")}>P1</button>
          <button className={`px-2 py-1 rounded ${sla === "breached" ? "bg-yellow-500 text-white" : "bg-gray-200"}`} onClick={() => setSla("breached")}>Breached</button>
          <button className={`px-2 py-1 rounded ${status === "open" ? "bg-green-600 text-white" : "bg-gray-200"}`} onClick={() => setStatus("open")}>Open</button>
        </div>
      )}

      {/* --- Main Content --- */}
      {paginatedItems.length === 0 ? (
        <div className="text-center py-10 text-gray-500">No workitems match your filter.</div>
      ) : isMobile ? (
        <div className="space-y-4">
          {paginatedItems.map((wi) => (
            <SmartQueueCard key={wi.id} workitem={wi} onClick={() => navigate(`/workitem/${wi.id}`)} />
          ))}
        </div>
      ) : (
        <table className="w-full text-sm border">
          <thead className="bg-gray-100 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">SLA</th>
              <th className="px-3 py-2">Impact</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Automation</th>
              <th className="px-3 py-2">Smart Score</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((wi) => (
              <SmartQueueRow key={wi.id} workitem={wi} onClick={() => navigate(`/workitem/${wi.id}`)} />
            ))}
          </tbody>
        </table>
      )}

      {/* --- Pagination Controls --- */}
      <div className="flex justify-between mt-4">
        <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
        <span>Page {page}</span>
        <button disabled={end >= sortedItems.length} onClick={() => setPage(page + 1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
      </div>
    </div>
  );
}
