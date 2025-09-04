// src/components/setup/TenantSetup.tsx
import React, { useState } from 'react';
import { useTenant } from '../../providers/TenantProvider';

const AVAILABLE_TENANTS = [
  { 
    id: 'tenant_dcn_meta', 
    name: 'Meta DCN Operations',
    description: 'Data Center Networking operations for Meta infrastructure'
  },
  { 
    id: 'tenant_av_google', 
    name: 'Google AV & Streaming',
    description: 'Audio/Video streaming services operations'
  },
  { 
    id: 'tenant_sd_gates', 
    name: 'Gates Foundation Service Desk',
    description: 'IT Service Desk operations for Bill & Melinda Gates Foundation'
  }
];

export const TenantSetup: React.FC = () => {
  const { setTenant, isLoading } = useTenant();
  const [selectedTenant, setSelectedTenant] = useState<string>('');

  const handleTenantSelect = async () => {
    if (!selectedTenant) return;
    
    try {
      await setTenant(selectedTenant);
    } catch (error) {
      console.error('Failed to initialize tenant:', error);
      // Error handling is done in App.tsx
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            🚀 OpsHub AIOps Platform
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Select your operations environment to get started
          </p>
        </div>

        {/* Tenant Selection */}
        <div className="space-y-4 mb-8">
          <label className="block text-sm font-medium text-gray-700">
            Choose Operations Environment:
          </label>
          
          {AVAILABLE_TENANTS.map((tenant) => (
            <div
              key={tenant.id}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                selectedTenant === tenant.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedTenant(tenant.id)}
            >
              <div className="flex items-center">
                <input
                  type="radio"
                  name="tenant"
                  value={tenant.id}
                  checked={selectedTenant === tenant.id}
                  onChange={(e) => setSelectedTenant(e.target.value)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <div className="ml-3">
                  <div className="text-sm font-medium text-gray-900">
                    {tenant.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {tenant.description}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-center">
          <button
            onClick={handleTenantSelect}
            disabled={!selectedTenant || isLoading}
            className={`px-8 py-3 rounded-lg font-medium transition-colors ${
              selectedTenant && !isLoading
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Initializing...
              </div>
            ) : (
              'Initialize Environment'
            )}
          </button>
        </div>

        {/* Info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Each environment contains demo data for different operational scenarios.</p>
          <p className="mt-1">You can switch environments anytime from the user menu.</p>
        </div>
      </div>
    </div>
  );
};