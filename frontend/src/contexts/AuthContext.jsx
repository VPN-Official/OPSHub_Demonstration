import React, { createContext, useContext, useState, useEffect } from "react";
import { getAll, setItem, clearStore, isSeeded } from "../utils/db.js";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // 🔄 Load persisted user from IndexedDB
  async function load() {
    try {
      setIsLoading(true);
      const users = await getAll("auth");
      
      if (!users.length) {
        // Only check if database needs seeding, don't trigger seeding here
        const alreadySeeded = await isSeeded();
        if (!alreadySeeded) {
          console.log("🔍 Auth store empty, but global seeding will handle this");
        }
        setUser(null);
      } else {
        setUser(users[0]); // single-user context
      }
    } catch (error) {
      console.error("Failed to load auth data:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  // 🔐 Enhanced Login with validation
  async function login(userData) {
    try {
      if (!userData || !userData.username) {
        throw new Error("Username is required");
      }

      await clearStore("auth"); // ensure only one user
      const record = { 
        id: "currentUser", 
        ...userData,
        loginTime: Date.now(),
        lastActivity: Date.now()
      };
      
      await setItem("auth", record);
      setUser(record);
      
      console.log(`✅ User ${userData.username} logged in as ${userData.role}`);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  }

  // 🚪 Enhanced Logout with cleanup
  async function logout() {
    try {
      await clearStore("auth");
      setUser(null);
      console.log("✅ User logged out successfully");
    } catch (error) {
      console.error("Logout failed:", error);
      // Set user to null even if storage clear fails
      setUser(null);
    }
  }

  // 👤 Get role with fallback
  function getRole() {
    return user?.role || "guest";
  }

  // 🔄 Update last activity
  async function updateActivity() {
    if (user) {
      try {
        const updatedUser = {
          ...user,
          lastActivity: Date.now()
        };
        await setItem("auth", updatedUser);
        setUser(updatedUser);
      } catch (error) {
        console.error("Failed to update user activity:", error);
      }
    }
  }

  // 🕒 Check if user session is valid
  function isSessionValid() {
    if (!user) return false;
    
    const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();
    const lastActivity = user.lastActivity || user.loginTime;
    
    return (now - lastActivity) < SESSION_TIMEOUT;
  }

  // Enhanced loading with session validation
  useEffect(() => {
    let isMounted = true;
    
    const loadAndValidate = async () => {
      try {
        if (isMounted) {
          await load();
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
        }
      }
    };

    loadAndValidate();

    return () => {
      isMounted = false;
    };
  }, []);

  // Automatic activity tracking
  useEffect(() => {
    if (!user) return;

    const handleActivity = () => {
      updateActivity();
    };

    // Track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Session validation interval
    const interval = setInterval(() => {
      if (!isSessionValid()) {
        console.log("Session expired, logging out");
        logout();
      }
    }, 60000); // Check every minute

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      clearInterval(interval);
    };
  }, [user]);

  const contextValue = {
    user,
    isLoading,
    login,
    logout,
    getRole,
    updateActivity,
    isSessionValid,
    role: user?.role,
    isAuthenticated: !!user && isSessionValid()
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}