import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

/* Layout */
import Sidebar from "../components/Sidebar.jsx";
import Topbar from "../components/Topbar.jsx";

/* Pages / Components */
import Pulse from "../components/Pulse.jsx";
import SmartQueue from "../components/SmartQueue.jsx";
import WorkItemDetail from "../components/WorkItemDetail.jsx";
import NotificationsCenter from "../components/NotificationsCenter.jsx";
import ScheduleView from "../components/ScheduleView.jsx";
import IntelligenceCenter from "../components/IntelligenceCenter.jsx";
import AutomationDetail from "../components/AutomationDetail.jsx";
import KnowledgeDetail from "../components/KnowledgeDetail.jsx";
import AgentDetail from "../components/AgentDetail.jsx";
import NudgeDetail from "../components/NudgeDetail.jsx";
import LoginPage from "./LoginPage.jsx";

/* Context */
import { useAuth } from "../contexts/AuthContext.jsx";
import { useSync } from "../contexts/SyncContext.jsx";

/* Banner for offline state */
function OfflineBanner() {
  return (
    <div className="bg-yellow-100 text-yellow-800 px-4 py-2 text-sm text-center">
      You are offline — changes will sync when connection is restored.
    </div>
  );
}

export default function App() {
  const { user, role } = useAuth();
  const { online } = useSync();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Theme toggle
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  const toggleTheme = () =>
    setTheme((prev) => (prev === "light" ? "dark" : "light"));

  // If not logged in → show login
  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="flex h-screen bg-[var(--bg)] text-[var(--fg)]">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content - FIXED: Add left margin on desktop to account for sidebar */}
      <div className="flex-1 flex flex-col overflow-hidden md:ml-64">
        <Topbar
          toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          theme={theme}
          toggleTheme={toggleTheme}
        />

        {/* Offline banner */}
        {!online && <OfflineBanner />}

        {/* Routed pages */}
        <main className="flex-1 overflow-auto">
          <Routes>
            {/* Landing = Pulse (role-based dashboard) */}
            <Route path="/" element={<Navigate to="/pulse" replace />} />
            <Route path="/pulse" element={<Pulse role={role} />} />

            {/* SmartQueue (role-aware) */}
            <Route path="/queue" element={<SmartQueue role={role} />} />
            <Route path="/smartqueue" element={<Navigate to="/queue" replace />} />

            {/* WorkItem detail */}
            <Route path="/workitem/:id" element={<WorkItemDetail />} />

            {/* Notifications */}
            <Route path="/notifications" element={<NotificationsCenter />} />

            {/* Schedule (role-aware) */}
            <Route path="/schedule" element={<ScheduleView role={role} />} />

            {/* Intelligence Center + details */}
            <Route path="/intelligence" element={<IntelligenceCenter role={role} />} />
            <Route path="/intelligence/automation/:id" element={<AutomationDetail />} />
            <Route path="/intelligence/knowledge/:id" element={<KnowledgeDetail />} />
            <Route path="/intelligence/agent/:id" element={<AgentDetail />} />
            <Route path="/intelligence/nudge/:id" element={<NudgeDetail />} />

            {/* Catch-all → redirect to pulse */}
            <Route path="*" element={<Navigate to="/pulse" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}