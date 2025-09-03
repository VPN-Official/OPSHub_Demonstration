// src/contexts/EventsContext.tsx (ENTERPRISE FRONTEND REFACTORED)
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";

// ---------------------------------
// 1. Frontend-Only Type Definitions
// ---------------------------------

// Core async state pattern for UI state management
export interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  lastFetch: string | null;
  stale: boolean;
}

// Minimal Event interface - UI display focused
export interface Event {
  id: string;
  source_system: string;
  message: string;
  severity: string;
  captured_at: string;
  created_at: string;
  updated_at: string;

  // Relationships - IDs only for UI navigation
  asset_id?: string | null;
  service_component_id?: string | null;
  business_service_id?: string | null;
  related_incident_ids: string[];
  related_alert_ids: string[];

  // UI-relevant metadata
  correlation_id?: string | null;
  event_type?: string;
  event_source?: string;
  tags: string[];
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  
  // Sync metadata for offline support
  sync_status?: "clean" | "dirty" | "conflict";
  synced_at?: string;
  tenantId?: string;
}

// UI filters for client-side performance
export interface EventFilters {
  source_systems?: string[];
  severities?: string[];
  event_types?: string[];
  business_service_ids?: string[];
  asset_ids?: string[];
  search_query?: string;
  date_from?: string;
  date_to?: string;
  correlation_id?: string;
  health_status?: string[];
}

// UI configuration from backend
export interface EventsConfig {
  source_systems: string[];
  severities: string[];
  event_types: string[];
  refresh_interval_ms: number;
  cache_ttl_ms: number;
  max_events_cache: number;
}

// ---------------------------------
// 2. Frontend Context Interface
// ---------------------------------
interface EventsContextType {
  // Core async state
  eventsState: AsyncState<Event[]>;
  
  // UI operations (thin API wrappers)
  refreshEvents: () => Promise<void>;
  createEvent: (event: Omit<Event, 'id' | 'created_at' | 'updated_at'>, userId?: string) => Promise<void>;
  updateEvent: (eventId: string, updates: Partial<Event>, userId?: string) => Promise<void>;
  deleteEvent: (eventId: string, userId?: string) => Promise<void>;
  
  // Optimistic UI operations
  promoteToAlert: (eventId: string, userId: string) => Promise<void>;
  promoteToIncident: (eventId: string, userId: string) => Promise<void>;
  correlateEvents: (eventIds: string[], correlationId: string, userId?: string) => Promise<void>;
  
  // Client-side UI helpers (no business logic)
  getFilteredEvents: (filters: EventFilters) => Event[];
  searchEvents: (query: string) => Event[];
  getEventsByStatus: (status: string) => Event[];
  getRecentEvents: (hours?: number) => Event[];
  
  // UI state management
  filters: EventFilters;
  setFilters: (filters: EventFilters) => void;
  clearFilters: () => void;
  
  // Configuration for UI components
  config: EventsConfig;
}

const EventsContext = createContext<EventsContextType | undefined>(undefined);

// ---------------------------------
// 3. Enterprise Frontend Provider
// ---------------------------------
export const EventsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();
  
  // Core async state
  const [eventsState, setEventsState] = useState<AsyncState<Event[]>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    stale: true,
  });
  
  // UI filters state
  const [filters, setFilters] = useState<EventFilters>({});
  
  // Cache management
  const cacheRef = useRef<{
    data: Event[];
    timestamp: number;
    ttl: number;
  } | null>(null);
  
  // Extract UI config from backend configuration
  const config: EventsConfig = useMemo(() => ({
    source_systems: globalConfig?.telemetry?.events?.source_systems || 
                    ['application', 'infrastructure', 'network', 'security', 'monitoring'],
    severities: Object.keys(globalConfig?.severities || {}),
    event_types: globalConfig?.telemetry?.events?.types || 
                 ['system', 'application', 'user_action', 'alert', 'metric', 'trace'],
    refresh_interval_ms: globalConfig?.ui?.refresh_intervals?.events_ms || 30000,
    cache_ttl_ms: globalConfig?.ui?.cache_ttl?.events_ms || 300000, // 5 minutes
    max_events_cache: globalConfig?.ui?.max_cache_items?.events || 1000,
  }), [globalConfig]);
  
  // Cache validation helper
  const isCacheValid = useCallback(() => {
    if (!cacheRef.current) return false;
    const now = Date.now();
    return (now - cacheRef.current.timestamp) < cacheRef.current.ttl;
  }, []);
  
  // Optimistic update helper
  const updateEventOptimistically = useCallback((eventId: string, updates: Partial<Event>) => {
    setEventsState(prevState => ({
      ...prevState,
      data: prevState.data.map(event =>
        event.id === eventId 
          ? { ...event, ...updates, updated_at: new Date().toISOString() }
          : event
      ),
    }));
  }, []);
  
  // Rollback optimistic update
  const rollbackOptimisticUpdate = useCallback(async () => {
    if (isCacheValid() && cacheRef.current) {
      setEventsState(prevState => ({
        ...prevState,
        data: cacheRef.current!.data,
      }));
    } else {
      await refreshEvents();
    }
  }, [isCacheValid]);
  
  // Core refresh function - thin API wrapper
  const refreshEvents = useCallback(async () => {
    if (!tenantId) return;
    
    setEventsState(prevState => ({
      ...prevState,
      loading: true,
      error: null,
    }));
    
    try {
      const response = await fetch(`/api/v1/tenants/${tenantId}/events`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.statusText}`);
      }
      
      const events: Event[] = await response.json();
      
      // Update cache
      cacheRef.current = {
        data: events,
        timestamp: Date.now(),
        ttl: config.cache_ttl_ms,
      };
      
      setEventsState({
        data: events,
        loading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        stale: false,
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load events';
      setEventsState(prevState => ({
        ...prevState,
        loading: false,
        error: errorMessage,
        stale: true,
      }));
    }
  }, [tenantId, config.cache_ttl_ms]);
  
  // Create event with optimistic UI
  const createEvent = useCallback(async (
    event: Omit<Event, 'id' | 'created_at' | 'updated_at'>, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();
    const optimisticEvent: Event = {
      ...event,
      id: tempId,
      created_at: now,
      updated_at: now,
      tenantId,
      tags: event.tags || [],
      related_incident_ids: event.related_incident_ids || [],
      related_alert_ids: event.related_alert_ids || [],
      health_status: event.health_status || "gray",
      sync_status: "dirty",
    };
    
    // Optimistic update
    setEventsState(prevState => ({
      ...prevState,
      data: [optimisticEvent, ...prevState.data.slice(0, config.max_events_cache - 1)],
    }));
    
    try {
      const response = await fetch(`/api/v1/tenants/${tenantId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...event, userId }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create event: ${response.statusText}`);
      }
      
      const createdEvent: Event = await response.json();
      
      // Replace optimistic event with real event
      setEventsState(prevState => ({
        ...prevState,
        data: prevState.data.map(e => e.id === tempId ? createdEvent : e),
      }));
      
      // Queue for offline sync
      await enqueueItem({
        storeName: "events",
        entityId: createdEvent.id,
        action: "create",
        payload: createdEvent,
        priority: event.severity === 'critical' ? 'critical' : 'normal',
      });
      
    } catch (error) {
      // Remove optimistic event on failure
      setEventsState(prevState => ({
        ...prevState,
        data: prevState.data.filter(e => e.id !== tempId),
        error: error instanceof Error ? error.message : 'Failed to create event',
      }));
      throw error;
    }
  }, [tenantId, config.max_events_cache, enqueueItem]);
  
  // Update event with optimistic UI
  const updateEvent = useCallback(async (
    eventId: string, 
    updates: Partial<Event>, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    const originalEvent = eventsState.data.find(e => e.id === eventId);
    if (!originalEvent) throw new Error(`Event ${eventId} not found`);
    
    // Optimistic update
    updateEventOptimistically(eventId, updates);
    
    try {
      const response = await fetch(`/api/v1/tenants/${tenantId}/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, userId }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update event: ${response.statusText}`);
      }
      
      const updatedEvent: Event = await response.json();
      
      // Update with server response
      setEventsState(prevState => ({
        ...prevState,
        data: prevState.data.map(e => e.id === eventId ? updatedEvent : e),
      }));
      
      // Queue for offline sync
      await enqueueItem({
        storeName: "events",
        entityId: eventId,
        action: "update",
        payload: updatedEvent,
      });
      
    } catch (error) {
      // Rollback optimistic update
      await rollbackOptimisticUpdate();
      setEventsState(prevState => ({
        ...prevState,
        error: error instanceof Error ? error.message : 'Failed to update event',
      }));
      throw error;
    }
  }, [tenantId, eventsState.data, updateEventOptimistically, rollbackOptimisticUpdate, enqueueItem]);
  
  // Delete event with optimistic UI
  const deleteEvent = useCallback(async (eventId: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    const originalEvents = eventsState.data;
    
    // Optimistic removal
    setEventsState(prevState => ({
      ...prevState,
      data: prevState.data.filter(e => e.id !== eventId),
    }));
    
    try {
      const response = await fetch(`/api/v1/tenants/${tenantId}/events/${eventId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete event: ${response.statusText}`);
      }
      
      // Queue for offline sync
      await enqueueItem({
        storeName: "events",
        entityId: eventId,
        action: "delete",
        payload: null,
      });
      
    } catch (error) {
      // Rollback optimistic removal
      setEventsState(prevState => ({
        ...prevState,
        data: originalEvents,
        error: error instanceof Error ? error.message : 'Failed to delete event',
      }));
      throw error;
    }
  }, [tenantId, eventsState.data, enqueueItem]);
  
  // Promote to alert - optimistic UI operation
  const promoteToAlert = useCallback(async (eventId: string, userId: string) => {
    updateEventOptimistically(eventId, {
      health_status: "yellow",
      tags: [...(eventsState.data.find(e => e.id === eventId)?.tags || []), "promoted-to-alert"],
    });
    
    try {
      const response = await fetch(`/api/v1/tenants/${tenantId}/events/${eventId}/promote-to-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to promote event to alert: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Update with server response
      updateEventOptimistically(eventId, {
        related_alert_ids: [...(eventsState.data.find(e => e.id === eventId)?.related_alert_ids || []), result.alertId],
      });
      
    } catch (error) {
      await rollbackOptimisticUpdate();
      throw error;
    }
  }, [tenantId, eventsState.data, updateEventOptimistically, rollbackOptimisticUpdate]);
  
  // Promote to incident - optimistic UI operation
  const promoteToIncident = useCallback(async (eventId: string, userId: string) => {
    updateEventOptimistically(eventId, {
      health_status: "red",
      tags: [...(eventsState.data.find(e => e.id === eventId)?.tags || []), "promoted-to-incident"],
    });
    
    try {
      const response = await fetch(`/api/v1/tenants/${tenantId}/events/${eventId}/promote-to-incident`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to promote event to incident: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Update with server response
      updateEventOptimistically(eventId, {
        related_incident_ids: [...(eventsState.data.find(e => e.id === eventId)?.related_incident_ids || []), result.incidentId],
      });
      
    } catch (error) {
      await rollbackOptimisticUpdate();
      throw error;
    }
  }, [tenantId, eventsState.data, updateEventOptimistically, rollbackOptimisticUpdate]);
  
  // Correlate events - batch operation
  const correlateEvents = useCallback(async (eventIds: string[], correlationId: string, userId?: string) => {
    if (eventIds.length < 2) {
      throw new Error("At least 2 events are required for correlation");
    }
    
    // Optimistic updates for all events
    eventIds.forEach(eventId => {
      updateEventOptimistically(eventId, { correlation_id: correlationId });
    });
    
    try {
      const response = await fetch(`/api/v1/tenants/${tenantId}/events/correlate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventIds, correlationId, userId }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to correlate events: ${response.statusText}`);
      }
      
      // Server handles all correlation logic
      
    } catch (error) {
      await rollbackOptimisticUpdate();
      throw error;
    }
  }, [tenantId, updateEventOptimistically, rollbackOptimisticUpdate]);
  
  // Client-side filtering for UI performance (no business logic)
  const getFilteredEvents = useCallback((filters: EventFilters): Event[] => {
    let filtered = eventsState.data;
    
    if (filters.source_systems?.length) {
      filtered = filtered.filter(e => filters.source_systems!.includes(e.source_system));
    }
    
    if (filters.severities?.length) {
      filtered = filtered.filter(e => filters.severities!.includes(e.severity));
    }
    
    if (filters.event_types?.length) {
      filtered = filtered.filter(e => e.event_type && filters.event_types!.includes(e.event_type));
    }
    
    if (filters.business_service_ids?.length) {
      filtered = filtered.filter(e => e.business_service_id && filters.business_service_ids!.includes(e.business_service_id));
    }
    
    if (filters.asset_ids?.length) {
      filtered = filtered.filter(e => e.asset_id && filters.asset_ids!.includes(e.asset_id));
    }
    
    if (filters.health_status?.length) {
      filtered = filtered.filter(e => filters.health_status!.includes(e.health_status));
    }
    
    if (filters.correlation_id) {
      filtered = filtered.filter(e => e.correlation_id === filters.correlation_id);
    }
    
    if (filters.search_query) {
      const query = filters.search_query.toLowerCase();
      filtered = filtered.filter(e =>
        e.message.toLowerCase().includes(query) ||
        e.source_system.toLowerCase().includes(query) ||
        e.severity.toLowerCase().includes(query) ||
        e.event_type?.toLowerCase().includes(query) ||
        e.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    if (filters.date_from || filters.date_to) {
      filtered = filtered.filter(e => {
        const eventDate = new Date(e.captured_at);
        const fromDate = filters.date_from ? new Date(filters.date_from) : null;
        const toDate = filters.date_to ? new Date(filters.date_to) : null;
        
        return (!fromDate || eventDate >= fromDate) && (!toDate || eventDate <= toDate);
      });
    }
    
    return filtered;
  }, [eventsState.data]);
  
  // Simple client-side search for immediate UI feedback
  const searchEvents = useCallback((query: string): Event[] => {
    return getFilteredEvents({ search_query: query });
  }, [getFilteredEvents]);
  
  // Simple status filtering for UI
  const getEventsByStatus = useCallback((status: string): Event[] => {
    return eventsState.data.filter(e => e.health_status === status);
  }, [eventsState.data]);
  
  // Recent events for UI display
  const getRecentEvents = useCallback((hours: number = 24): Event[] => {
    const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    return eventsState.data.filter(e => new Date(e.captured_at) >= cutoffTime);
  }, [eventsState.data]);
  
  // Clear filters helper
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);
  
  // Auto-refresh based on config
  useEffect(() => {
    if (!tenantId || !globalConfig) return;
    
    // Initial load
    refreshEvents();
    
    // Setup auto-refresh
    const interval = setInterval(() => {
      if (!eventsState.loading) {
        refreshEvents();
      }
    }, config.refresh_interval_ms);
    
    return () => clearInterval(interval);
  }, [tenantId, globalConfig, refreshEvents, config.refresh_interval_ms, eventsState.loading]);
  
  // Mark data as stale when it gets old
  useEffect(() => {
    if (!eventsState.lastFetch) return;
    
    const timeout = setTimeout(() => {
      setEventsState(prevState => ({
        ...prevState,
        stale: true,
      }));
    }, config.cache_ttl_ms);
    
    return () => clearTimeout(timeout);
  }, [eventsState.lastFetch, config.cache_ttl_ms]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cacheRef.current = null;
    };
  }, []);
  
  const contextValue = useMemo(() => ({
    eventsState,
    refreshEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    promoteToAlert,
    promoteToIncident,
    correlateEvents,
    getFilteredEvents,
    searchEvents,
    getEventsByStatus,
    getRecentEvents,
    filters,
    setFilters,
    clearFilters,
    config,
  }), [
    eventsState,
    refreshEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    promoteToAlert,
    promoteToIncident,
    correlateEvents,
    getFilteredEvents,
    searchEvents,
    getEventsByStatus,
    getRecentEvents,
    filters,
    setFilters,
    clearFilters,
    config,
  ]);
  
  return (
    <EventsContext.Provider value={contextValue}>
      {children}
    </EventsContext.Provider>
  );
};

// ---------------------------------
// 4. Optimized Hooks
// ---------------------------------

// Main hook with full context
export const useEvents = (): EventsContextType => {
  const ctx = useContext(EventsContext);
  if (!ctx) {
    throw new Error("useEvents must be used within an EventsProvider");
  }
  return ctx;
};

// Selective hooks for performance (prevents unnecessary re-renders)
export const useEventsData = () => {
  const { eventsState } = useEvents();
  return eventsState;
};

export const useEventsOperations = () => {
  const { 
    refreshEvents, 
    createEvent, 
    updateEvent, 
    deleteEvent,
    promoteToAlert,
    promoteToIncident,
    correlateEvents 
  } = useEvents();
  
  return {
    refreshEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    promoteToAlert,
    promoteToIncident,
    correlateEvents,
  };
};

export const useEventsFiltering = () => {
  const { 
    getFilteredEvents, 
    searchEvents, 
    getEventsByStatus, 
    getRecentEvents,
    filters,
    setFilters,
    clearFilters 
  } = useEvents();
  
  return {
    getFilteredEvents,
    searchEvents,
    getEventsByStatus,
    getRecentEvents,
    filters,
    setFilters,
    clearFilters,
  };
};

export const useEventsConfig = () => {
  const { config } = useEvents();
  return config;
};

// Specialized hooks for common use cases
export const useCriticalEvents = () => {
  const { eventsState } = useEvents();
  return useMemo(
    () => eventsState.data.filter(e => e.severity === 'critical'),
    [eventsState.data]
  );
};

export const useCorrelatedEvents = (correlationId: string) => {
  const { eventsState } = useEvents();
  return useMemo(
    () => eventsState.data.filter(e => e.correlation_id === correlationId),
    [eventsState.data, correlationId]
  );
};

export const useEventsByBusinessService = (serviceId: string) => {
  const { eventsState } = useEvents();
  return useMemo(
    () => eventsState.data.filter(e => e.business_service_id === serviceId),
    [eventsState.data, serviceId]
  );
};