// src/layouts/AppLayout.tsx - FIXED without problematic PrimeReact components
import React, { ReactNode, useState } from "react";
import { useTheme } from "../providers/ThemeProvider";
import { useNotifications } from "../providers/NotificationProvider";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { PWAInstallPrompt } from '../components/PWAInstallPrompt';
import { OfflineStatusIndicator } from '../components/OfflineStatusIndicator';
import { ServiceWorkerUpdateNotification } from '../components/ServiceWorkerUpdateNotification';
import { useOfflineCapability } from '../contexts/OfflineCapabilityContext';

export const AppLayout = ({ children }: { children?: ReactNode }) => {
  const { mode, toggleTheme } = useTheme();
  const { activeCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { serviceWorkerState } = useOfflineCapability();

  const menuItems = [
    {
      label: "Pulse",
      icon: "📊",
      path: "/pulse",
      active: location.pathname === "/pulse"
    },
    {
      label: "SmartQueue",
      icon: "📋",
      path: "/smartqueue",
      active: location.pathname === "/smartqueue"
    },
    {
      label: "Schedule",
      icon: "📅",
      path: "/schedule",
      active: location.pathname === "/schedule"
    },
    {
      label: "Intelligence",
      icon: "🤖",
      path: "/intelligence",
      active: location.pathname === "/intelligence"
    },
    {
      label: "Notifications",
      icon: "🔔",
      path: "/notifications",
      active: location.pathname === "/notifications"
    },
  ];

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      <OfflineStatusIndicator />
      <ServiceWorkerUpdateNotification />
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:relative z-50 md:z-auto
        w-64 h-full bg-white dark:bg-gray-900 
        border-r border-gray-200 dark:border-gray-700
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              🚀 OpsHub
            </h1>
            <button
              className="md:hidden text-gray-500"
              onClick={() => setSidebarOpen(false)}
            >
              ✕
            </button>
          </div>

          <nav className="space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left
                  transition-colors duration-200
                  ${item.active
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }
                `}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
                {item.path === '/notifications' && activeCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    {activeCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top Bar */}
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">

            {/* Left Side - Menu Toggle + Back */}
            <div className="flex items-center gap-3">
              <button
                className="md:hidden p-2 text-gray-600 dark:text-gray-300"
                onClick={() => setSidebarOpen(true)}
              >
                ☰
              </button>

              <button
                onClick={() => navigate(-1)}
                className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                title="Go back"
              >
                ←
              </button>

              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {menuItems.find(item => item.active)?.label || 'OpsHub'}
              </h2>
            </div>

            {/* Right Side - Actions */}
            <div className="flex items-center gap-2">

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                title={mode === "light" ? "Switch to dark mode" : "Switch to light mode"}
              >
                {mode === "light" ? "🌙" : "☀️"}
              </button>

              {/* Notifications */}
              <button
                onClick={() => navigate("/notifications")}
                className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                title="Notifications"
              >
                🔔
                {activeCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {activeCount > 99 ? '99+' : activeCount}
                  </span>
                )}
              </button>

              {/* User Menu */}
              <div className="relative">
                <button className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                  👤
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800 p-4">
          {children || <Outlet />}
        </main>
      </div>
      <PWAInstallPrompt />
    </div>
  );
};