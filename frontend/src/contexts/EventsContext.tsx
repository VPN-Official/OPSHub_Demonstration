import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  getAll,
  getById as dbGetById,
  putWithAudit,
  removeWithAudit,
} from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { loadConfig } from "../config/configLoader";
import { useServiceComponents } from "./ServiceComponentsContext";
import { useBusinessServices } from "./BusinessServicesContext";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------
export interface Event {
  id: string;
  source_system: string; // config.telemetry.events.source_systems
  message: string;
  severity: string; // config.telemetry.events.severities
  captured_at: string;

  asset_id?: string | null;
  service_component_id?: string | null;
  business_service_id?: string | null;

  correlation_id?: string | null;

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
}

export interface EventDetails extends Event {
  service_component?: any;
  business_service?: any;
}

interface EventsContextType {
  events: Event[];
  refresh: () => Promise<void>;
  addEvent: (event: Event) => Promise<void>;
  updateEvent: (event: Event) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  getEventById: (id: string) => Promise<Event | undefined>;
}

const EventsContext = createContext<EventsContextType | undefined>(undefined);

// ---------------------------------
// 2. Provider
// ---------------------------------
export const EventsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const [events, setEvents] = useState<Event[]>([]);
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    if (tenantId) {
      loadConfig(tenantId).then(setConfig);
      refresh();
    }
  }, [tenantId]);

  const refresh = async () => {
    if (!tenantId) return;
    const data = await getAll<Event>("events", tenantId);
    setEvents(data);
  };

  const validateEvent = (event: Event) => {
    if (!config) return;

    if (!config.telemetry?.events?.source_systems.includes(event.source_system)) {
      throw new Error(`Invalid source system: ${event.source_system}`);
    }
    if (!config.telemetry?.events?.severities.includes(event.severity)) {
      throw new Error(`Invalid severity: ${event.severity}`);
    }
  };

  const ensureMetadata = (event: Event): Event => {
    return {
      ...event,
      tags: event.tags ?? [],
      health_status: event.health_status ?? "gray",
      sync_status: event.sync_status ?? "dirty",
      synced_at: event.synced_at ?? new Date().toISOString(),
    };
  };

  const addEvent = async (event: Event) => {
    validateEvent(event);
    const enriched = ensureMetadata({
      ...event,
      captured_at: event.captured_at ?? new Date().toISOString(),
    });
    await putWithAudit("events", enriched, tenantId, {
      action: "create",
      description: `Created event from ${event.source_system}`,
    });
    enqueue("events", enriched);
    await refresh();
  };

  const updateEvent = async (event: Event) => {
    validateEvent(event);
    const enriched = ensureMetadata(event);
    await putWithAudit("events", enriched, tenantId, {
      action: "update",
      description: `Updated event ${event.id}`,
    });
    enqueue("events", enriched);
    await refresh();
  };

  const deleteEvent = async (id: string) => {
    await removeWithAudit("events", id, tenantId, {
      action: "delete",
      description: `Deleted event ${id}`,
    });
    enqueue("events", { id, deleted: true });
    await refresh();
  };

  const getEventById = async (id: string) => {
    return dbGetById<Event>("events", id, tenantId);
  };

  return (
    <EventsContext.Provider
      value={{ events, refresh, addEvent, updateEvent, deleteEvent, getEventById }}
    >
      {children}
    </EventsContext.Provider>
  );
};

// ---------------------------------
// 3. Hooks
// ---------------------------------
export const useEvents = (): EventsContextType => {
  const ctx = useContext(EventsContext);
  if (!ctx) {
    throw new Error("useEvents must be used within an EventsProvider");
  }
  return ctx;
};

export const useEventDetails = (id: string): EventDetails | undefined => {
  const { events } = useEvents();
  const { serviceComponents } = useServiceComponents();
  const { businessServices } = useBusinessServices();

  const event = events.find((e) => e.id === id);
  if (!event) return undefined;

  const service_component = event.service_component_id
    ? serviceComponents.find((c) => c.id === event.service_component_id)
    : undefined;

  const business_service = event.business_service_id
    ? businessServices.find((b) => b.id === event.business_service_id)
    : undefined;

  return {
    ...event,
    service_component,
    business_service,
  };
};