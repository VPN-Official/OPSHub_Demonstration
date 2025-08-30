import React from "react";
import ThemeToggle from "./ThemeToggle";
import TenantSelector from "./TenantSelector";
import NotificationsBell from "./NotificationsBell";

export default function Topbar() {
  return (
    <header className="flex items-center justify-between p-4 border-b bg-white dark:bg-gray-900 dark:border-gray-700">
      <div className="flex-1 max-w-md hidden sm:block">
        <input
          type="text"
          placeholder="Search..."
          className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-800 dark:text-gray-200"
        />
      </div>
      <button className="sm:hidden p-2">🔍</button>
      <div className="mx-4"><TenantSelector /></div>
      <div className="flex items-center space-x-3">
        <NotificationsBell />
        <ThemeToggle />
        <span className="font-medium">Alice Johnson</span>
        <img src="https://ui-avatars.com/api/?name=Alice+Johnson&background=6C63FF&color=fff" alt="User" className="w-8 h-8 rounded-full"/>
      </div>
    </header>
  );
}
