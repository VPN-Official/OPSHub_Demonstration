import React, { createContext, useContext, useState, useEffect } from "react";
import { getAll, setItem, clearStore, seedAll } from "../utils/db.js";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // 🔄 Load persisted user from IndexedDB
  async function load() {
    const users = await getAll("auth"); // ⚠ ensure "auth" is added to db.js schema
    if (!users.length) {
      await seedAll({ auth: [] });
      setUser(null);
    } else {
      setUser(users[0]); // single-user context
    }
  }

  // 🔐 Login
async function login(userData) {
  await clearStore("auth"); // ensure only one
  const record = { id: "currentUser", ...userData };
  await setItem("auth", record);
  setUser(record);
}

  // 🚪 Logout
  async function logout() {
    await clearStore("auth");
    setUser(null);
  }

  // 👤 Get role
  function getRole() {
    return user?.role || "guest";
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, getRole, role: user?.role }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}