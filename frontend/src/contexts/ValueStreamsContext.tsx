// src/contexts/ValueStreamsContext.tsx (REFACTORED - Frontend UI State Management Only)
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";
import { ExternalSystemFields } from "../types/externalSystem";

// ---------------------------------
// 1. Frontend-Only Type Definitions
// ---------------------------------

/**
 * AsyncState wrapper for UI state management
 */
export interface AsyncState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  lastFetch: string | null;
  staleness: 'fresh' | 'stale' | 'expired';
}

/**
 * UI Filter state for client-side filtering
 */
export interface ValueStreamUIFilters {
  industry?: string;
  tier?: string;
  health_status?: string;
  owner_id?: string;
  owner_type?: 'user' | 'team';
  search_query?: string;
  maturity?: string;
  high_value_only?: boolean;
  risk_threshold?: number;
  // External system filtering
  sourceSystems?: string[];
  syncStatus?: ('synced' | 'syncing' | 'error' | 'conflict')[];
  hasConflicts?: boolean;
  hasLocalChanges?: boolean;
  dataCompleteness?: { min: number; max: number };
}

/**
 * UI sort options for client-side sorting
 */
export interface ValueStreamUISortOptions {
  field: 'name' | 'annual_value' | 'health_status' | 'created_at' | 'updated_at';
  direction: 'asc' | 'desc';
}

/**
 * Optimistic update state for UI feedback
 */
export interface OptimisticUpdate {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity?: ValueStream;
  timestamp: string;
}

/**
 * Value Stream entity (simplified for UI display)
 */
export interface ValueStream extends ExternalSystemFields {
  id: string;
  name: string;
  description: string;
  industry?: string;
  tier?: string;
  created_at: string;
  updated_at: string;

  // Ownership
  business_owner_user_id?: string | null;
  business_owner_team_id?: string | null;
  technical_owner_user_id?: string | null;
  product_owner_user_id?: string | null;
  
  // Display metadata
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  annual_value?: number | null;
  strategic_importance?: string;
  tags: string[];
  
  // UI-specific metadata
  ui_metadata?: {
    favorite?: boolean;
    last_viewed?: string;
    user_notes?: string;
  };
  // synced_at, sync_status removed - inherited from ExternalSystemFields
}

/**
 * API Response wrapper
 */
export interface APIResponse<T> {
  data: T;
  message?: string;
  metadata?: {
    total_count?: number;
    page?: number;
    page_size?: number;
  };
}

/**
 * API Error structure
 */
export interface APIError {
  message: string;
  field?: string;
  code: string;
  validation_errors?: Array<{ field: string; message: string }>;
}

// ---------------------------------
// 2. Frontend Context Interface
// ---------------------------------
interface ValueStreamsContextType {
  // Core UI State
  valueStreams: AsyncState<ValueStream>;
  selectedStreamId: string | null;
  optimisticUpdates: OptimisticUpdate[];
  
  // UI Filters & Sorting
  filters: ValueStreamUIFilters;
  sortOptions: ValueStreamUISortOptions;
  
  // Core Operations (API orchestration only)
  createValueStream: (vs: Omit<ValueStream, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateValueStream: (id: string, updates: Partial<ValueStream>) => Promise<void>;
  deleteValueStream: (id: string) => Promise<void>;
  refreshValueStreams: () => Promise<void>;
  
  // UI State Management
  setSelectedStream: (id: string | null) => void;
  setFilters: (filters: Partial<ValueStreamUIFilters>) => void;
  clearFilters: () => void;
  setSortOptions: (sort: ValueStreamUISortOptions) => void;
  markStreamAsFavorite: (id: string, favorite: boolean) => void;
  updateUserNotes: (id: string, notes: string) => void;
  
  // Client-side UI Helpers (no business logic)
  getFilteredAndSortedStreams: () => ValueStream[];
  searchStreams: (query: string) => ValueStream[];
  getStreamsByStatus: (status: ValueStream['health_status']) => ValueStream[];
  
  // Configuration from backend
  config: {
    industries: string[];
    tiers: string[];
    importance_levels: string[];
    health_statuses: string[];
  };
  
  // Cache management
  invalidateCache: () => void;
  getCacheInfo: () => { lastFetch: string | null; staleness: string };
}

const ValueStreamsContext = createContext<ValueStreamsContextType | undefined>(undefined);

// ---------------------------------
// 3. Constants & Configuration
// ---------------------------------
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_PAGE_SIZE = 50;

const DEFAULT_FILTERS: ValueStreamUIFilters = {};
const DEFAULT_SORT: ValueStreamUISortOptions = { field: 'name', direction: 'asc' };

// ---------------------------------
// 4. API Client Functions (thin wrappers)
// ---------------------------------

/**
 * Thin API client wrapper - no business logic, just HTTP calls
 */
class ValueStreamAPIClient {
  constructor(private tenantId: string) {}

  async fetchAll(filters?: ValueStreamUIFilters): Promise<APIResponse<ValueStream[]>> {
    const params = new URLSearchParams();
    if (filters?.industry) params.append('industry', filters.industry);
    if (filters?.tier) params.append('tier', filters.tier);
    if (filters?.health_status) params.append('health_status', filters.health_status);
    if (filters?.owner_id) params.append('owner_id', filters.owner_id);
    if (filters?.high_value_only) params.append('high_value_only', 'true');
    
    const response = await fetch(`/api/${this.tenantId}/value-streams?${params}`);
    if (!response.ok) {
      const error: APIError = await response.json();
      throw new Error(error.message || 'Failed to fetch value streams');
    }
    return response.json();
  }

  async fetchById(id: string): Promise<APIResponse<ValueStream>> {
    const response = await fetch(`/api/${this.tenantId}/value-streams/${id}`);
    if (!response.ok) {
      const error: APIError = await response.json();
      throw new Error(error.message || 'Failed to fetch value stream');
    }
    return response.json();
  }

  async create(valueStream: Omit<ValueStream, 'id' | 'created_at' | 'updated_at'>): Promise<APIResponse<ValueStream>> {
    const response = await fetch(`/api/${this.tenantId}/value-streams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(valueStream),
    });
    if (!response.ok) {
      const error: APIError = await response.json();
      throw new Error(error.message || 'Failed to create value stream');
    }
    return response.json();
  }

  async update(id: string, updates: Partial<ValueStream>): Promise<APIResponse<ValueStream>> {
    const response = await fetch(`/api/${this.tenantId}/value-streams/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const error: APIError = await response.json();
      throw new Error(error.message || 'Failed to update value stream');
    }
    return response.json();
  }

  async delete(id: string): Promise<void> {
    const response = await fetch(`/api/${this.tenantId}/value-streams/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error: APIError = await response.json();
      throw new Error(error.message || 'Failed to delete value stream');
    }
  }

  async updateUserMetadata(id: string, metadata: ValueStream['ui_metadata']): Promise<void> {
    const response = await fetch(`/api/${this.tenantId}/value-streams/${id}/ui-metadata`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    });
    if (!response.ok) {
      const error: APIError = await response.json();
      throw new Error(error.message || 'Failed to update user metadata');
    }
  }
}

// ---------------------------------
// 5. Provider Implementation
// ---------------------------------
export const ValueStreamsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();

  // Core UI State
  const [valueStreams, setValueStreams] = useState<AsyncState<ValueStream>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    staleness: 'expired',
  });

  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdate[]>([]);
  const [filters, setFiltersState] = useState<ValueStreamUIFilters>(DEFAULT_FILTERS);
  const [sortOptions, setSortOptionsState] = useState<ValueStreamUISortOptions>(DEFAULT_SORT);

  // API Client instance
  const apiClient = useMemo(() => 
    tenantId ? new ValueStreamAPIClient(tenantId) : null, 
    [tenantId]
  );

  // Configuration from backend
  const config = useMemo(() => ({
    industries: globalConfig?.business?.value_streams?.industries || 
               ['technology', 'manufacturing', 'financial_services', 'healthcare', 'retail', 'consulting'],
    tiers: globalConfig?.business?.value_streams?.tiers || 
           ['strategic', 'core', 'supporting', 'experimental'],
    importance_levels: globalConfig?.business?.value_streams?.importance_levels || 
                      ['critical', 'high', 'medium', 'low'],
    health_statuses: ['green', 'yellow', 'orange', 'red', 'gray'],
  }), [globalConfig]);

  // ---------------------------------
  // 6. Cache Management
  // ---------------------------------
  const updateStaleness = useCallback((lastFetch: string) => {
    const now = Date.now();
    const fetchTime = new Date(lastFetch).getTime();
    const age = now - fetchTime;
    
    let staleness: AsyncState<ValueStream>['staleness'];
    if (age > CACHE_TTL_MS * 2) staleness = 'expired';
    else if (age > CACHE_TTL_MS) staleness = 'stale';
    else staleness = 'fresh';
    
    setValueStreams(prev => ({ ...prev, staleness }));
  }, []);

  const invalidateCache = useCallback(() => {
    setValueStreams(prev => ({ ...prev, staleness: 'expired' }));
  }, []);

  const getCacheInfo = useCallback(() => ({
    lastFetch: valueStreams.lastFetch,
    staleness: valueStreams.staleness,
  }), [valueStreams.lastFetch, valueStreams.staleness]);

  // ---------------------------------
  // 7. Optimistic Updates for UI
  // ---------------------------------
  const addOptimisticUpdate = useCallback((update: OptimisticUpdate) => {
    setOptimisticUpdates(prev => [...prev, update]);
    
    // Auto-remove after 30 seconds
    setTimeout(() => {
      setOptimisticUpdates(prev => prev.filter(u => u.id !== update.id));
    }, 30000);
  }, []);

  const removeOptimisticUpdate = useCallback((id: string) => {
    setOptimisticUpdates(prev => prev.filter(u => u.id !== id));
  }, []);

  const rollbackOptimisticUpdate = useCallback((id: string) => {
    setOptimisticUpdates(prev => prev.filter(u => u.id !== id));
    // Refresh data to restore actual state
    refreshValueStreams();
  }, []);

  // ---------------------------------
  // 8. Core API Operations
  // ---------------------------------
  const refreshValueStreams = useCallback(async () => {
    if (!apiClient) return;

    setValueStreams(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await apiClient.fetchAll(filters);
      const now = new Date().toISOString();
      
      setValueStreams({
        data: response.data,
        loading: false,
        error: null,
        lastFetch: now,
        staleness: 'fresh',
      });

      // Update staleness after cache TTL
      setTimeout(() => updateStaleness(now), CACHE_TTL_MS);
      
    } catch (error) {
      setValueStreams(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }));
    }
  }, [apiClient, filters, updateStaleness]);

  const createValueStream = useCallback(async (
    valueStreamData: Omit<ValueStream, 'id' | 'created_at' | 'updated_at'>
  ) => {
    if (!apiClient) throw new Error('API client not available');

    const tempId = `temp-${Date.now()}`;
    const optimisticStream: ValueStream = {
      ...valueStreamData,
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: valueStreamData.tags || [],
      health_status: valueStreamData.health_status || 'gray',
    };

    // Show optimistic update immediately
    setValueStreams(prev => ({
      ...prev,
      data: [...prev.data, optimisticStream],
    }));

    const optimisticUpdate: OptimisticUpdate = {
      id: tempId,
      type: 'create',
      entity: optimisticStream,
      timestamp: new Date().toISOString(),
    };
    addOptimisticUpdate(optimisticUpdate);

    try {
      const response = await apiClient.create(valueStreamData);
      
      // Replace optimistic entity with real one
      setValueStreams(prev => ({
        ...prev,
        data: prev.data.map(vs => vs.id === tempId ? response.data : vs),
      }));
      
      removeOptimisticUpdate(tempId);

      // Queue for offline sync
      await enqueueItem({
        storeName: "value_streams",
        entityId: response.data.id,
        action: "create",
        payload: response.data,
        priority: valueStreamData.strategic_importance === 'critical' ? 'critical' : 'normal',
      });

    } catch (error) {
      // Remove optimistic update and show error
      setValueStreams(prev => ({
        ...prev,
        data: prev.data.filter(vs => vs.id !== tempId),
        error: error instanceof Error ? error.message : 'Failed to create value stream',
      }));
      removeOptimisticUpdate(tempId);
      throw error;
    }
  }, [apiClient, enqueueItem, addOptimisticUpdate, removeOptimisticUpdate]);

  const updateValueStream = useCallback(async (id: string, updates: Partial<ValueStream>) => {
    if (!apiClient) throw new Error('API client not available');

    const originalStream = valueStreams.data.find(vs => vs.id === id);
    if (!originalStream) throw new Error('Value stream not found');

    const optimisticStream = { ...originalStream, ...updates, updated_at: new Date().toISOString() };

    // Show optimistic update immediately
    setValueStreams(prev => ({
      ...prev,
      data: prev.data.map(vs => vs.id === id ? optimisticStream : vs),
    }));

    const optimisticUpdate: OptimisticUpdate = {
      id: `update-${id}-${Date.now()}`,
      type: 'update',
      entity: optimisticStream,
      timestamp: new Date().toISOString(),
    };
    addOptimisticUpdate(optimisticUpdate);

    try {
      const response = await apiClient.update(id, updates);
      
      // Replace with real updated data
      setValueStreams(prev => ({
        ...prev,
        data: prev.data.map(vs => vs.id === id ? response.data : vs),
      }));
      
      removeOptimisticUpdate(optimisticUpdate.id);

      // Queue for offline sync
      await enqueueItem({
        storeName: "value_streams",
        entityId: id,
        action: "update",
        payload: response.data,
      });

    } catch (error) {
      // Rollback optimistic update
      setValueStreams(prev => ({
        ...prev,
        data: prev.data.map(vs => vs.id === id ? originalStream : vs),
        error: error instanceof Error ? error.message : 'Failed to update value stream',
      }));
      removeOptimisticUpdate(optimisticUpdate.id);
      throw error;
    }
  }, [apiClient, valueStreams.data, enqueueItem, addOptimisticUpdate, removeOptimisticUpdate]);

  const deleteValueStream = useCallback(async (id: string) => {
    if (!apiClient) throw new Error('API client not available');

    const streamToDelete = valueStreams.data.find(vs => vs.id === id);
    if (!streamToDelete) throw new Error('Value stream not found');

    // Remove from UI immediately (optimistic)
    setValueStreams(prev => ({
      ...prev,
      data: prev.data.filter(vs => vs.id !== id),
    }));

    const optimisticUpdate: OptimisticUpdate = {
      id: `delete-${id}-${Date.now()}`,
      type: 'delete',
      entity: streamToDelete,
      timestamp: new Date().toISOString(),
    };
    addOptimisticUpdate(optimisticUpdate);

    try {
      await apiClient.delete(id);
      removeOptimisticUpdate(optimisticUpdate.id);

      // Queue for offline sync
      await enqueueItem({
        storeName: "value_streams",
        entityId: id,
        action: "delete",
        payload: null,
      });

    } catch (error) {
      // Restore deleted item
      setValueStreams(prev => ({
        ...prev,
        data: [...prev.data, streamToDelete],
        error: error instanceof Error ? error.message : 'Failed to delete value stream',
      }));
      removeOptimisticUpdate(optimisticUpdate.id);
      throw error;
    }
  }, [apiClient, valueStreams.data, enqueueItem, addOptimisticUpdate, removeOptimisticUpdate]);

  // ---------------------------------
  // 9. UI State Management
  // ---------------------------------
  const setSelectedStream = useCallback((id: string | null) => {
    setSelectedStreamId(id);
    
    // Update last viewed timestamp for UI metadata
    if (id && apiClient) {
      const stream = valueStreams.data.find(vs => vs.id === id);
      if (stream) {
        const updatedMetadata = {
          ...stream.ui_metadata,
          last_viewed: new Date().toISOString(),
        };
        apiClient.updateUserMetadata(id, updatedMetadata).catch(console.warn);
      }
    }
  }, [apiClient, valueStreams.data]);

  const setFilters = useCallback((newFilters: Partial<ValueStreamUIFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  const setSortOptions = useCallback((sort: ValueStreamUISortOptions) => {
    setSortOptionsState(sort);
  }, []);

  const markStreamAsFavorite = useCallback(async (id: string, favorite: boolean) => {
    if (!apiClient) return;

    // Optimistic UI update
    setValueStreams(prev => ({
      ...prev,
      data: prev.data.map(vs => vs.id === id ? {
        ...vs,
        ui_metadata: { ...vs.ui_metadata, favorite }
      } : vs),
    }));

    try {
      const stream = valueStreams.data.find(vs => vs.id === id);
      if (stream) {
        const updatedMetadata = { ...stream.ui_metadata, favorite };
        await apiClient.updateUserMetadata(id, updatedMetadata);
      }
    } catch (error) {
      // Rollback on error
      setValueStreams(prev => ({
        ...prev,
        data: prev.data.map(vs => vs.id === id ? {
          ...vs,
          ui_metadata: { ...vs.ui_metadata, favorite: !favorite }
        } : vs),
      }));
      console.warn('Failed to update favorite status:', error);
    }
  }, [apiClient, valueStreams.data]);

  const updateUserNotes = useCallback(async (id: string, notes: string) => {
    if (!apiClient) return;

    try {
      const stream = valueStreams.data.find(vs => vs.id === id);
      if (stream) {
        const updatedMetadata = { ...stream.ui_metadata, user_notes: notes };
        await apiClient.updateUserMetadata(id, updatedMetadata);
        
        setValueStreams(prev => ({
          ...prev,
          data: prev.data.map(vs => vs.id === id ? {
            ...vs,
            ui_metadata: updatedMetadata
          } : vs),
        }));
      }
    } catch (error) {
      console.warn('Failed to update user notes:', error);
    }
  }, [apiClient, valueStreams.data]);

  // ---------------------------------
  // 10. Client-side UI Helpers (Simple filters only)
  // ---------------------------------
  const getFilteredAndSortedStreams = useCallback(() => {
    let filtered = [...valueStreams.data];

    // Simple client-side filtering for immediate UI responsiveness
    if (filters.industry) {
      filtered = filtered.filter(vs => vs.industry === filters.industry);
    }
    if (filters.tier) {
      filtered = filtered.filter(vs => vs.tier === filters.tier);
    }
    if (filters.health_status) {
      filtered = filtered.filter(vs => vs.health_status === filters.health_status);
    }
    if (filters.owner_id) {
      const ownerField = filters.owner_type === 'team' 
        ? 'business_owner_team_id' 
        : 'business_owner_user_id';
      filtered = filtered.filter(vs => vs[ownerField] === filters.owner_id);
    }
    if (filters.search_query) {
      const query = filters.search_query.toLowerCase();
      filtered = filtered.filter(vs => 
        vs.name.toLowerCase().includes(query) ||
        vs.description.toLowerCase().includes(query) ||
        vs.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    if (filters.high_value_only && filters.risk_threshold) {
      filtered = filtered.filter(vs => 
        (vs.annual_value && vs.annual_value >= filters.risk_threshold) ||
        vs.strategic_importance === 'critical'
      );
    }

    // Simple client-side sorting
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortOptions.field) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'annual_value':
          aValue = a.annual_value || 0;
          bValue = b.annual_value || 0;
          break;
        case 'created_at':
          aValue = a.created_at;
          bValue = b.created_at;
          break;
        case 'updated_at':
          aValue = a.updated_at;
          bValue = b.updated_at;
          break;
        case 'health_status':
          const statusOrder = { green: 5, yellow: 4, orange: 3, red: 2, gray: 1 };
          aValue = statusOrder[a.health_status] || 0;
          bValue = statusOrder[b.health_status] || 0;
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOptions.direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return sortOptions.direction === 'asc' 
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }
    });

    return filtered;
  }, [valueStreams.data, filters, sortOptions]);

  const searchStreams = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return valueStreams.data.filter(vs => 
      vs.name.toLowerCase().includes(lowerQuery) ||
      vs.description.toLowerCase().includes(lowerQuery) ||
      vs.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }, [valueStreams.data]);

  const getStreamsByStatus = useCallback((status: ValueStream['health_status']) => {
    return valueStreams.data.filter(vs => vs.health_status === status);
  }, [valueStreams.data]);

  // ---------------------------------
  // 11. Effects
  // ---------------------------------
  
  // Auto-refresh when tenant or filters change
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshValueStreams();
    }
  }, [tenantId, globalConfig, refreshValueStreams]);

  // Auto-update staleness indicator
  useEffect(() => {
    if (valueStreams.lastFetch) {
      const interval = setInterval(() => {
        updateStaleness(valueStreams.lastFetch!);
      }, 60000); // Check every minute

      return () => clearInterval(interval);
    }
  }, [valueStreams.lastFetch, updateStaleness]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear any pending timeouts/intervals
      setOptimisticUpdates([]);
    };
  }, []);

  // ---------------------------------
  // 12. Context Value
  // ---------------------------------
  const contextValue = useMemo(() => ({
    // Core UI State
    valueStreams,
    selectedStreamId,
    optimisticUpdates,
    
    // UI Filters & Sorting
    filters,
    sortOptions,
    
    // Core Operations
    createValueStream,
    updateValueStream,
    deleteValueStream,
    refreshValueStreams,
    
    // UI State Management
    setSelectedStream,
    setFilters,
    clearFilters,
    setSortOptions,
    markStreamAsFavorite,
    updateUserNotes,
    
    // Client-side UI Helpers
    getFilteredAndSortedStreams,
    searchStreams,
    getStreamsByStatus,
    
    // Configuration
    config,
    
    // Cache management
    invalidateCache,
    getCacheInfo,
  }), [
    valueStreams, selectedStreamId, optimisticUpdates, filters, sortOptions,
    createValueStream, updateValueStream, deleteValueStream, refreshValueStreams,
    setSelectedStream, setFilters, clearFilters, setSortOptions,
    markStreamAsFavorite, updateUserNotes,
    getFilteredAndSortedStreams, searchStreams, getStreamsByStatus,
    config, invalidateCache, getCacheInfo
  ]);

  return (
    <ValueStreamsContext.Provider value={contextValue}>
      {children}
    </ValueStreamsContext.Provider>
  );
};

// ---------------------------------
// 13. Hooks
// ---------------------------------

/**
 * Main hook to access value streams context
 */
export const useValueStreams = () => {
  const ctx = useContext(ValueStreamsContext);
  if (!ctx) throw new Error("useValueStreams must be used within ValueStreamsProvider");
  return ctx;
};

/**
 * Hook for selective subscription to specific value stream
 */
export const useValueStreamDetails = (id: string | null) => {
  const { valueStreams } = useValueStreams();
  return useMemo(() => 
    id ? valueStreams.data.find(vs => vs.id === id) || null : null, 
    [valueStreams.data, id]
  );
};

/**
 * Hook for filtered streams with memoization
 */
export const useFilteredValueStreams = () => {
  const { getFilteredAndSortedStreams } = useValueStreams();
  return useMemo(() => getFilteredAndSortedStreams(), [getFilteredAndSortedStreams]);
};

/**
 * Hook for streams by health status
 */
export const useValueStreamsByStatus = (status: ValueStream['health_status']) => {
  const { getStreamsByStatus } = useValueStreams();
  return useMemo(() => getStreamsByStatus(status), [getStreamsByStatus, status]);
};

/**
 * Hook for favorite streams
 */
export const useFavoriteValueStreams = () => {
  const { valueStreams } = useValueStreams();
  return useMemo(() => 
    valueStreams.data.filter(vs => vs.ui_metadata?.favorite === true), 
    [valueStreams.data]
  );
};