// src/pages/Pulse.tsx
import React from 'react';
import { useTenant } from '../providers/TenantProvider';
import { useNotifications } from '../providers/NotificationProvider';

export const Pulse: React.FC = () => {
  const { tenantId, config } = useTenant();
  const { notifications, activeCount } = useNotifications();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Pulse Dashboard</h1>
        <span className="text-sm text-gray-500">Tenant: {tenantId}</span>
      </div>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Active Incidents</h3>
          <p className="text-2xl font-bold text-red-600">0</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">SLA Breaches</h3>
          <p className="text-2xl font-bold text-orange-600">0</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Open Requests</h3>
          <p className="text-2xl font-bold text-blue-600">0</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Notifications</h3>
          <p className="text-2xl font-bold text-purple-600">{activeCount}</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <p className="text-gray-500">No recent activity</p>
      </div>
    </div>
  );
};