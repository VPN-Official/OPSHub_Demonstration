import React from 'react';
import { useTenant } from '../providers/TenantProvider';

export const SmartQueue: React.FC = () => {
  const { tenantId } = useTenant();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">SmartQueue</h1>
        <div className="flex gap-2">
          <select className="border border-gray-300 rounded-md px-3 py-1">
            <option>All Items</option>
            <option>Assigned to me</option>
            <option>My group</option>
          </select>
        </div>
      </div>
      
      {/* Filters */}
      <div className="flex gap-4 p-4 bg-gray-50 rounded-lg">
        <input 
          type="text" 
          placeholder="Search work items..." 
          className="flex-1 border border-gray-300 rounded-md px-3 py-2"
        />
        <select className="border border-gray-300 rounded-md px-3 py-2">
          <option>All Types</option>
          <option>Incidents</option>
          <option>Service Requests</option>
          <option>Change Requests</option>
        </select>
      </div>

      {/* Work Items Table */}
      <div className="bg-white rounded-lg shadow">
        <table className="w-full">
          <thead className="border-b">
            <tr>
              <th className="text-left p-4">ID</th>
              <th className="text-left p-4">Title</th>
              <th className="text-left p-4">Type</th>
              <th className="text-left p-4">Priority</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Smart Score</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="p-8 text-center text-gray-500">
                No work items found
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};