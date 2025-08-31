import React from "react";
import ThemeToggle from "./ThemeToggle";
import TenantSelector from "./TenantSelector";
import NotificationsBell from "./NotificationsBell";
import { Menu } from "lucide-react";

export default function Topbar({ onMenuClick }) {
  return (
    <header className="flex items-center justify-between p-4 border-b bg-white dark:bg-gray-900 dark:border-gray-700">
      {/* Hamburger (mobile only) */}
      <button
        className="sm:hidden p-2"
        onClick={onMenuClick}
        aria-label="Toggle sidebar menu">
        <Menu size={22} />
      </button>

      {/* Search */}
      <div className="flex-1 max-w-md hidden sm:block">
        <input
          type="text"
          placeholder="Search..."
          className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-800 dark:text-gray-200"
        />
      </div>

      {/* Tenant + Controls */}
      <div className="flex items-center space-x-3">
        <TenantSelector />
        <NotificationsBell />
        <ThemeToggle />
        <span className="font-medium">Alice Johnson</span>
      </div>
    </header>
  );
}
