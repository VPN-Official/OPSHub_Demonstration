import './App.css'

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";

// Placeholder pages (to be implemented)
const Pulse = () => <div>Pulse Dashboard</div>;
const SmartQueue = () => <div>SmartQueue</div>;
const Schedule = () => <div>Schedule</div>;
const Intelligence = () => <div>Intelligence Center</div>;
const Notifications = () => <div>Notifications</div>;

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/pulse" />} />
          <Route path="/pulse" element={<Pulse />} />
          <Route path="/smartqueue" element={<SmartQueue />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/intelligence" element={<Intelligence />} />
          <Route path="/notifications" element={<Notifications />} />
          {/* Example: WorkItem detail */}
          <Route path="/incidents/:id" element={<div>Incident Detail</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}