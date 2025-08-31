import React, { createContext, useContext, useState } from "react";

const NotificationsContext = createContext();

const initialNotifications = [
  { id: 1, severity: "critical", msg: "CPU > 95% on DCN1", ts: "10:00" },
  { id: 2, severity: "warning", msg: "DB latency high", ts: "10:05" },
  { id: 3, severity: "info", msg: "Patch rollout completed", ts: "10:10" },
  { id: 4, severity: "critical", msg: "Storage node down", ts: "10:15" },
];

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState(initialNotifications);

  const dismissNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const addNotification = (notification) => {
    setNotifications((prev) => [notification, ...prev]);
  };

  const ackNotification = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, acked: true } : n))
    );
  };

  return (
    <NotificationsContext.Provider
      value={{ notifications, dismissNotification, addNotification, ackNotification }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationsContext);
