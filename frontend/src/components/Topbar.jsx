import React from "react";
import { Bell, Menu, Sun, Moon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../contexts/NotificationsContext.jsx";

export default function Topbar({ toggleSidebar, theme, toggleTheme }) {
  const navigate = useNavigate();
  const { badgeCount } = useNotifications();

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Hamburger (mobile only) */}
      <button
        className="md:hidden p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        onClick={toggleSidebar}
      >
        <Menu size={20} />
      </button>

      {/* App title (click → Pulse landing) */}
      <div
        className="font-bold text-lg cursor-pointer text-gray-900 dark:text-white"
        onClick={() => navigate("/pulse")}
      >
        OPSHub
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-4">
        {/* Theme toggle */}
        <button
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
          onClick={toggleTheme}
        >
          {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* Notifications Bell */}
        <button
          className="relative p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
          onClick={() => navigate("/notifications")}
        >
          <Bell size={20} />
          {badgeCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-bold rounded-full px-1 min-w-[16px] h-4 flex items-center justify-center">
              {badgeCount}
            </span>
          )}
        </button>

        {/* User placeholder */}
        <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white text-sm">
          U
        </div>
      </div>
    </div>
  );
}