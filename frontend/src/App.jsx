import React, { useState } from "react";
import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import OfflineBanner from "./components/OfflineBanner";
import Dashboard from "./pages/Dashboard";
import SmartQueue from "./pages/SmartQueue";
import { NotificationsProvider } from "./context/NotificationsContext";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <NotificationsProvider>
      <div className="flex h-screen">
        {/* Sidebar (hidden on mobile unless open) */}
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

        {/* Main content */}
        <div className="flex-1 flex flex-col">
          <Topbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          <OfflineBanner />
          <main className="flex-1 p-6 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/smart-queue" element={<SmartQueue />} />
            </Routes>
          </main>
        </div>
      </div>
    </NotificationsProvider>
  );
}
