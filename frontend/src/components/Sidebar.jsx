import React from "react";
import { NavLink } from "react-router-dom";
import {
  Activity,
  ListChecks,
  Bell,
  Calendar,
  Zap,
} from "lucide-react";

export default function Sidebar({ isOpen, onClose }) {
  const menuItems = [
    { to: "/pulse", label: "Pulse", icon: Activity },
    { to: "/smartqueue", label: "Smart Queue", icon: ListChecks },
    { to: "/notifications", label: "Notifications", icon: Bell },
    { to: "/schedule", label: "Schedule", icon: Calendar },
    { to: "/intelligence", label: "Intelligence Center", icon: Zap },
  ];

  return (
    <div
      className={`fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-lg transform transition-transform duration-200 ease-in-out border-r border-gray-200 dark:border-gray-700
        ${isOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
    >
      <div className="flex flex-col h-full">
        {/* Logo / App Name */}
        <div className="p-4 font-bold text-lg border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          OPSHub
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1 bg-gray-50 dark:bg-gray-800">
          {menuItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition ${
                  isActive
                    ? "bg-blue-600 text-white font-semibold"
                    : "text-gray-700 dark:text-gray-200"
                }`
              }
              onClick={onClose}
            >
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}