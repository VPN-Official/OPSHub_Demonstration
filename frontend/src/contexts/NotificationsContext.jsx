import React, { createContext, useContext, useState, useEffect } from "react";
import { getAll, setItem, delItem, clearStore, seedAll } from "../utils/db.js";

const NotificationsContext = createContext();

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  // 🔄 Load from IndexedDB
  async function load() {
    const items = await getAll("notifications");
    if (!items.length) {
      await seedAll({ notifications: [] }); // ✅ centralized seeding
    }

    // TTL filter (default: 48h)
    const now = Date.now();
    const validItems = items.filter((n) => !n.ttl || now - n.timestamp < n.ttl);
    setNotifications(validItems);
  }

  // ➕ Add notification
  async function addNotification(message, type = "info", ttl = 1000 * 60 * 60 * 48) {
    const notification = {
      id: Date.now(),
      message,
      type,
      acknowledged: false,
      dismissed: false,
      timestamp: Date.now(),
      ttl,
    };
    await setItem("notifications", notification);
    load();
  }

  // ✅ Acknowledge notification
  async function acknowledge(id) {
    const updated = notifications.map((n) =>
      n.id === id ? { ...n, acknowledged: true } : n
    );
    await seedAll({ notifications: updated });
    load();
  }

  // ❌ Dismiss notification (mark as dismissed, not delete)
  async function dismiss(id) {
    const updated = notifications.map((n) =>
      n.id === id ? { ...n, dismissed: true } : n
    );
    await seedAll({ notifications: updated });
    load();
  }

  // ❌ Clear all notifications
  async function clearAll() {
    await clearStore("notifications");
    load();
  }

  // -----------------------------
  // 🔹 Derived State
  // -----------------------------
  const activeFeed = notifications.filter((n) => !n.dismissed);
  const dismissedFeed = notifications.filter((n) => n.dismissed);
  const badgeCount = activeFeed.filter((n) => !n.acknowledged).length;

  // -----------------------------
  // 🔹 Aliases for UI
  // -----------------------------
  const acknowledgeNotification = (id) => acknowledge(id);
  const dismissNotification = (id) => dismiss(id);
  const dismissAllNotifications = () => clearAll();

  useEffect(() => {
    load();
  }, []);

  return (
    <NotificationsContext.Provider
      value={{
        // core
        notifications,
        addNotification,
        acknowledge,
        dismiss,
        clearAll,
        // derived
        activeFeed,
        dismissedFeed,
        badgeCount,
        // aliases for UI
        acknowledgeNotification,
        dismissNotification,
        dismissAllNotifications,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}

