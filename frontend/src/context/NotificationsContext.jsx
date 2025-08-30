import React, { createContext, useState, useContext } from "react";
const NotificationsContext = createContext();
export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  return (
    <NotificationsContext.Provider value={{ notifications, setNotifications }}>
      {children}
    </NotificationsContext.Provider>
  );
}
export function useNotifications() { return useContext(NotificationsContext); }
