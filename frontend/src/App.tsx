// src/App.tsx - FIXED with proper imports and routing
import './App.css';
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProviders } from "./providers/AppProviders";
import { AppLayout } from "./layouts/AppLayout";
import { TenantSetup } from "./components/setup/TenantSetup";
import { useTenant } from "./providers/TenantProvider";
import SeedDemo from "./pages/SeedDemo";

// Import the actual page components
import { Pulse } from "./pages/Pulse";
import { SmartQueue } from "./pages/SmartQueue";
import { Schedule } from "./pages/Schedule";  
import { Intelligence } from "./pages/Intelligence";
import { Notifications } from "./pages/Notifications";

// Main App Component (inside providers)
const AppContent = () => {
  const { tenantId, isInitialized, isLoading, error } = useTenant();

  // Show tenant setup if no tenant selected
  if (!tenantId) {
    return <TenantSetup />;
  }

  // Show loading during tenant initialization
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Initializing tenant...</p>
        </div>
      </div>
    );
  }

  // Show error if tenant initialization failed
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-xl mb-4">⚠️ Initialization Error</div>
          <p className="text-gray-700 mb-4">{error}</p>
          <button 
            onClick={() => {
              localStorage.removeItem('tenantId');
              window.location.reload();
            }} 
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Reset & Choose Different Tenant
          </button>
        </div>
      </div>
    );
  }

  // Show app only when tenant is properly initialized
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Preparing workspace...</p>
        </div>
      </div>
    );
  }

  // Main application routes
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/pulse" replace />} />
          <Route path="pulse" element={<Pulse />} />
          <Route path="smartqueue" element={<SmartQueue />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="intelligence" element={<Intelligence />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="/seed" element={<SeedDemo />} />
          
          {/* WorkItem detail routes - placeholder until detail pages are built */}
          <Route path="incidents/:id" element={<div className="p-4">Incident Detail (Coming Soon)</div>} />
          <Route path="problems/:id" element={<div className="p-4">Problem Detail (Coming Soon)</div>} />
          <Route path="changes/:id" element={<div className="p-4">Change Detail (Coming Soon)</div>} />
          <Route path="requests/:id" element={<div className="p-4">Service Request Detail (Coming Soon)</div>} />
          
          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/pulse" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

// Root App with Provider Wrapper
const App: React.FC = () => {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
};

export default App;