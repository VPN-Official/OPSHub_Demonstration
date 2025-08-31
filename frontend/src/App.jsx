import React, { useState } from "react";
import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import OfflineBanner from "./components/OfflineBanner";
import Dashboard from "./pages/Dashboard";
import SmartQueue from "./pages/SmartQueue";
import WorkItemDetail from "./pages/WorkItemDetail";
import ScheduleView from "./pages/ScheduleView";
import EventFeed from "./pages/EventFeed";
import { NotificationsProvider } from "./context/NotificationsContext";
import { WorkItemsProvider } from "./context/WorkItemsContext";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <WorkItemsProvider>
      <NotificationsProvider>
        <div className="flex h-screen">
          {/* Sidebar (hidden on mobile unless open) */}
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          {/* Main content */}
          <div className="flex-1 flex flex-col">
            <Topbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
            <OfflineBanner />
            <main className="flex-1 p-6 overflow-y-auto">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/smartqueue" element={<SmartQueue />} />
                {/* WorkItem detail drilldown */}
                <Route path="/workitem/:id" element={<WorkItemDetail />} />
                {/* Schedule view */}
                <Route path="/schedule" element={<ScheduleView />} />
                {/* Notifications center */}
                <Route path="/eventfeed" element={<EventFeed />} />

                {/* Fallback */}
                <Route path="*" element={<div>Page Not Found</div>} />
              </Routes>
            </main>
          </div>
        </div>
      </NotificationsProvider>
    </WorkItemsProvider>
  );
}
