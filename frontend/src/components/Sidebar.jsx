import React from "react";
import { LayoutDashboard, Zap, Users, X, Calendar, Bell } from "lucide-react";
import { NavLink } from "react-router-dom";

const navItems = [
  { path: "/", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { path: "/smart-queue", label: "Smart Queue", icon: <Zap size={18} /> },
  { path: "/schedule", label: "Smart Queue", icon: <Calendar size={18} /> },
  { path: "/teams", label: "Teams", icon: <Users size={18} /> },
  { path: "/notifications", label: "Notifications", icon: <Bell size={18} /> },
];

export default function Sidebar({ isOpen, setIsOpen }) {
  return (
    <>
      {/* Desktop sidebar (always visible) */}
      <aside className="hidden sm:flex w-64 bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 flex-col p-4">
        <h2 className="text-primary font-bold text-lg mb-6">AIOps Platform</h2>
        <nav className="space-y-2">
          {navItems.map((item, i) => (
            <NavLink
              key={i}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center space-x-2 px-3 py-2 rounded hover:bg-gray-800 ${isActive ? "bg-primary text-white" : ""
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Mobile drawer */}
      {isOpen && (
        <div className="sm:hidden fixed inset-0 z-40 flex">
          {/* Overlay */}
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setIsOpen(false)}></div>

          {/* Drawer */}
          <aside className="relative w-64 bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 flex flex-col p-4 z-50">
            <button onClick={() => setIsOpen(false)} className="self-end mb-4">
              <X size={22} />
            </button>
            <h2 className="text-primary font-bold text-lg mb-6">AIOps Platform</h2>
            <nav className="space-y-2">
              {navItems.map((item, i) => (
                <NavLink
                  key={i}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center space-x-2 px-3 py-2 rounded hover:bg-gray-800 ${isActive ? "bg-primary text-white" : ""
                    }`
                  }
                  onClick={() => setIsOpen(false)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
