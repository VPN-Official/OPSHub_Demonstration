// src/pages/Pulse.tsx
import React, { useEffect, useState } from 'react';
import { useTenant } from '../providers/TenantProvider';
import { useNotifications } from '../providers/NotificationProvider';
import { useIncidents } from '../contexts/IncidentsContext';
import { useProblems } from '../contexts/ProblemsContext';
import { useChangeRequests } from '../contexts/ChangeRequestsContext';
import { useServiceRequests } from '../contexts/ServiceRequestsContext';
import { useActivityTimeline } from '../providers/ActivityTimelineProvider';
import { useAlerts } from '../contexts/AlertsContext';

export const Pulse: React.FC = () => {
  const { tenantId, config } = useTenant();
  const { notifications, activeCount } = useNotifications();
  const { incidents } = useIncidents();
  const { problems } = useProblems();
  const { changeRequests } = useChangeRequests();
  const { serviceRequests } = useServiceRequests();
  const { activities, getRecentActivities } = useActivityTimeline();
  const { alerts } = useAlerts();

  // Calculate metrics - safely access data arrays
  const activeIncidents = (incidents.data || []).filter(inc => 
    inc.status === 'open' || inc.status === 'investigating' || inc.status === 'in_progress'
  ).length;
  
  const slaBreach = (incidents.data || []).filter(inc => 
    inc.sla_status === 'breached'
  ).length + (problems.data || []).filter(p => 
    p.sla_status === 'breached'
  ).length;
  
  const openRequests = (serviceRequests.data || []).filter(sr => 
    sr.status !== 'completed' && sr.status !== 'cancelled' && sr.status !== 'closed'
  ).length + (changeRequests.data || []).filter(cr => 
    cr.status !== 'implemented' && cr.status !== 'cancelled' && cr.status !== 'failed'
  ).length;

  const criticalAlerts = (alerts.data || []).filter(a => 
    a.severity === 'critical' && a.status === 'active'
  ).length;

  // Check if any data is still loading
  const isLoading = incidents.loading || problems.loading || 
                    changeRequests.loading || serviceRequests.loading || 
                    alerts.loading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pulse Dashboard</h1>
        <span className="text-sm text-gray-500 dark:text-gray-400">Tenant: {tenantId}</span>
      </div>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Incidents</h3>
          <p className="text-2xl font-bold text-red-600">{activeIncidents}</p>
          <p className="text-xs text-gray-400 mt-1">
            {criticalAlerts > 0 && `${criticalAlerts} critical alert${criticalAlerts > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">SLA Breaches</h3>
          <p className="text-2xl font-bold text-orange-600">{slaBreach}</p>
          <p className="text-xs text-gray-400 mt-1">Requires attention</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Open Requests</h3>
          <p className="text-2xl font-bold text-blue-600">{openRequests}</p>
          <p className="text-xs text-gray-400 mt-1">Service & Change</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Notifications</h3>
          <p className="text-2xl font-bold text-purple-600">{activeCount}</p>
          <p className="text-xs text-gray-400 mt-1">Active alerts</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Recent Activity</h2>
        {getRecentActivities(5).length > 0 ? (
          <div className="space-y-3">
            {getRecentActivities(5).map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3 text-sm">
                <span className={`inline-block w-2 h-2 rounded-full mt-1.5 ${
                  activity.action === 'create' ? 'bg-green-500' :
                  activity.action === 'update' ? 'bg-blue-500' :
                  'bg-red-500'
                }`} />
                <div className="flex-1">
                  <p className="text-gray-700 dark:text-gray-300">{activity.message}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {new Date(activity.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">No recent activity</p>
        )}
      </div>
    </div>
  );
};