import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";  // ← ADD THIS
import App from "./pages/App.jsx";
import ToastContainer from "./components/ui/ToastContainer.jsx";
import { ToastProvider } from "./contexts/ToastContext.jsx"
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { NotificationsProvider } from "./contexts/NotificationsContext.jsx";
import { ScheduleProvider } from "./contexts/ScheduleContext.jsx";
import { SyncProvider } from "./contexts/SyncContext.jsx";
import { WorkItemsProvider } from "./contexts/WorkItemsContext.jsx";
import { AutomationsProvider } from "./contexts/AutomationsContext.jsx";
import { KnowledgeProvider } from "./contexts/KnowledgeContext.jsx";
import { AgentsProvider } from "./contexts/AgentsContext.jsx";
import { NudgesProvider } from "./contexts/NudgesContext.jsx";
import { CostsProvider } from "./contexts/CostsContext.jsx";
import { RosterProvider } from "./contexts/RosterContext.jsx";
import { BusinessServicesProvider } from "./contexts/BusinessServicesContext.jsx";
import { ErrorBoundary } from "react-error-boundary";
import { seedDB } from "./seeder/seedDB.js";  // ← ADD THIS

// Fallback for error boundary
function Fallback({ error }) {
  return (
    <div className="p-4 bg-red-100 text-red-800">
      <h2 className="font-semibold mb-2">Something went wrong</h2>
      <pre className="text-xs">{error.message}</pre>
    </div>
  );
}

// Provider composition
function Providers({ children }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <SyncProvider>
          <WorkItemsProvider>
            <NotificationsProvider>
              <AutomationsProvider>
                <KnowledgeProvider>
                  <AgentsProvider>
                    <NudgesProvider>
                      <ScheduleProvider>
                        <CostsProvider>
                          <RosterProvider>
                            <BusinessServicesProvider>
                              {children}
                            </BusinessServicesProvider>
                          </RosterProvider>
                        </CostsProvider>
                      </ScheduleProvider>
                    </NudgesProvider>
                  </AgentsProvider>
                </KnowledgeProvider>
              </AutomationsProvider>
            </NotificationsProvider>
          </WorkItemsProvider>
        </SyncProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

// ← ADD THIS: Seed database before rendering
seedDB().then(() => {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <BrowserRouter>
        <ErrorBoundary FallbackComponent={Fallback}>
          <Providers>
            <App />
            <ToastContainer />
          </Providers>
        </ErrorBoundary>
      </BrowserRouter>
    </React.StrictMode>
  );
}).catch(console.error);

/* Register service worker */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("Service Worker registered:", reg))
      .catch((err) =>
        console.error("Service Worker registration failed:", err)
      );
  });
}