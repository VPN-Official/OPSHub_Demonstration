import React from "react";
import { LayoutDashboard, Zap } from "lucide-react";
import { NavLink } from "react-router-dom";

const navItems = [
  { path: "/", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { path: "/smart-queue", label: "Smart Queue", icon: <Zap size={18} /> },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-gray-900 text-gray-200 flex flex-col p-4">
      <h2 className="text-primary font-bold text-lg mb-6">AIOps Platform</h2>
      <nav className="space-y-2">
        {navItems.map((item, i) => (
          <NavLink
            key={i}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center space-x-2 px-3 py-2 rounded hover:bg-gray-800 \${isActive ? "bg-primary text-white" : ""}`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
