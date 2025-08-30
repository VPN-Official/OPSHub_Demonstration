import React, { useState } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "../context/NotificationsContext";

export default function NotificationsBell() {
  const { notifications } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
        <Bell className="w-5 h-5" />
        {notifications.length > 0 && (
          <span className="absolute top-0 right-0 bg-error text-white text-xs px-1 rounded-full">
            {notifications.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 shadow-lg rounded p-2 z-50">
          <h3 className="font-bold text-sm mb-2">Notifications</h3>
          {notifications.length === 0 ? (
            <p className="text-xs text-gray-500">No notifications</p>
          ) : (
            <ul className="text-xs space-y-1">
              {notifications.slice(0, 5).map((n, idx) => (
                <li key={idx} className="p-1 border-b dark:border-gray-700">{n}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
