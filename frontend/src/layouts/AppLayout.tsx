import { ReactNode } from "react";
import { Sidebar } from "primereact/sidebar";
import { Menubar } from "primereact/menubar";
import { useTheme } from "../providers/ThemeProvider";
import { useNotifications } from "../providers/NotificationProvider";
import { Link, Outlet, useNavigate } from "react-router-dom";

// ---------------------------------
// Layout Component
// ---------------------------------
export const AppLayout = ({ children }: { children?: ReactNode }) => {
  const { mode, toggleTheme } = useTheme();
  const { activeCount } = useNotifications();
  const navigate = useNavigate();

  const menuItems = [
    { label: "Pulse", icon: "pi pi-chart-bar", command: () => navigate("/pulse") },
    { label: "SmartQueue", icon: "pi pi-list", command: () => navigate("/smartqueue") },
    { label: "Schedule", icon: "pi pi-calendar", command: () => navigate("/schedule") },
    { label: "Intelligence", icon: "pi pi-bolt", command: () => navigate("/intelligence") },
    { label: "Notifications", icon: "pi pi-bell", command: () => navigate("/notifications") },
  ];

  const topbarItems = [
    {
      label: mode === "light" ? "Dark Mode" : "Light Mode",
      icon: mode === "light" ? "pi pi-moon" : "pi pi-sun",
      command: toggleTheme,
    },
    {
      label: "Notifications",
      icon: "pi pi-bell",
      command: () => navigate("/notifications"),
      template: () => (
        <button
          className="relative p-2"
          onClick={() => navigate("/notifications")}
        >
          <i className="pi pi-bell text-lg"></i>
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full text-xs px-1">
              {activeCount}
            </span>
          )}
        </button>
      ),
    },
    {
      label: "User",
      icon: "pi pi-user",
      items: [
        { label: "Profile", icon: "pi pi-id-card" },
        { label: "Logout", icon: "pi pi-sign-out" },
      ],
    },
  ];

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <Sidebar visible position="left" className="w-64" showCloseIcon={false}>
        <h2 className="text-xl font-semibold mb-4">OpsHub</h2>
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.label}>
              <button
                className="flex items-center gap-2 w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                onClick={item.command}
              >
                <i className={item.icon}></i> {item.label}
              </button>
            </li>
          ))}
        </ul>
      </Sidebar>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <div className="flex items-center justify-between p-2 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)}>
              <i className="pi pi-arrow-left"></i>
            </button>
            <span className="font-bold text-lg">OpsHub</span>
          </div>
          <Menubar model={topbarItems} className="border-0 bg-transparent" />
        </div>

        {/* Content Area */}
        <main className="flex-1 p-4 overflow-y-auto bg-gray-100 dark:bg-gray-800">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};