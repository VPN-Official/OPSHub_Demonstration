import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, ListCheck, Calendar, Activity } from "lucide-react";

export default function Sidebar({ isOpen, onClose }) {
  const baseClasses =
    "flex items-center gap-2 px-3 py-2 rounded transition-colors duration-200 hover:bg-gray-200 dark:hover:bg-gray-800";
  const activeClasses =
    "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600";

  return (
    <>
      {/* Backdrop (mobile only) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <nav
        className={`fixed md:static top-0 left-0 h-full w-56 bg-white dark:bg-gray-900 p-4 space-y-2 transform transition-transform duration-200 z-50
          ${isOpen ? "translate-x-0" : "-translate-x-full"} 
          md:translate-x-0`}
      >
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            isActive ? `${baseClasses} ${activeClasses}` : baseClasses
          }
          onClick={onClose}
        >
          <LayoutDashboard size={18} /> <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/smartqueue"
          className={({ isActive }) =>
            isActive ? `${baseClasses} ${activeClasses}` : baseClasses
          }
          onClick={onClose}
        >
          <ListCheck size={18} /> <span>Smart Queue</span>
        </NavLink>

        <NavLink
          to="/schedule"
          className={({ isActive }) =>
            isActive ? `${baseClasses} ${activeClasses}` : baseClasses
          }
          onClick={onClose}
        >
          <Calendar size={18} /> <span>Schedule</span>
        </NavLink>

        <NavLink
          to="/eventfeed"
          className={({ isActive }) =>
            isActive ? `${baseClasses} ${activeClasses}` : baseClasses
          }
          onClick={onClose}
        >
          <Activity size={18} /> <span>Event Feed</span>
        </NavLink>
      </nav>
    </>
  );
}
