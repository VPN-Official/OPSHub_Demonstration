// src/contexts/RealtimeStreamContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";

// ---------------------------------
// 1. WebSocket Connection Types
// ---------------------------------

export type ConnectionStatus = 
  | 'connected' 
  | 'reconnecting' 
  | 'disconnected' 
  | 'offline' 
  | 'initializing';

export interface EventStream {
  id: string;
  entityType: string;
  entityId: string;
  subscriptionType: 'entity' | 'metrics' | 'status';
  createdAt: string;
  lastEventAt?: string;
  eventCount: number;
  active: boolean;
}

export interface LiveMetric {
  id: string;
  metricType: string;
  entityId?: string;
  entityType?: string;
  value: number | string | boolean;
  unit?: string;
  timestamp: string;
  trend?: 'up' | 'down' | 'stable';
  thresholds?: {
    critical?: number;
    warning?: number;
    normal?: number;
  };
  metadata?: Record<string, any>;
}

export interface StatusUpdate {
  id: string;
  entityType: string;
  entityId: string;
  previousStatus: string;
  currentStatus: string;
  changedAt: string;
  changedBy?: string;
  reason?: string;
  impactLevel?: 'critical' | 'high' | 'medium' | 'low';
  relatedEntities?: Array<{
    entityType: string;
    entityId: string;
    relationship: string;
  }>;
}

export interface EntityUpdate {
  id: string;
  entityType: string;
  entityId: string;
  updateType: 'created' | 'updated' | 'deleted' | 'state_changed';
  fields?: string[];
  previousValues?: Record<string, any>;
  currentValues?: Record<string, any>;
  timestamp: string;
  userId?: string;
  source?: 'user' | 'system' | 'integration' | 'automation';
  metadata?: Record<string, any>;
}

export interface MetricUpdate {
  metricId: string;
  entityType: string | undefined;
  entityId: string | undefined;
  value: any;
  timestamp: string;
  delta?: number;
  percentageChange?: number;
  anomalyDetected?: boolean;
  anomalyScore?: number;
}

// ---------------------------------
// 2. WebSocket Management Types
// ---------------------------------

export interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  messageTimeout: number;
  batchingInterval: number;
  maxBatchSize: number;
  compressionEnabled: boolean;
}

export interface WebSocketMessage {
  id: string;
  type: 'event' | 'metric' | 'status' | 'entity' | 'heartbeat' | 'ack';
  payload: any;
  timestamp: string;
  sequenceNumber?: number;
  correlationId?: string;
}

export interface SubscriptionRequest {
  subscriptionId: string;
  entityType?: string;
  entityId?: string;
  metricTypes?: string[];
  eventTypes?: string[];
  filters: Record<string, any>;
}

// ---------------------------------
// 3. Event Handler Types
// ---------------------------------

export type EntityUpdateHandler = (update: EntityUpdate) => void;
export type MetricUpdateHandler = (metric: MetricUpdate) => void;
export type StatusChangeHandler = (status: StatusUpdate) => void;
export type ConnectionHandler = (status: ConnectionStatus) => void;

export interface EventHandlers {
  entityUpdates: Map<string, EntityUpdateHandler[]>;
  metricUpdates: Map<string, MetricUpdateHandler[]>;
  statusChanges: Map<string, StatusChangeHandler[]>;
  connectionChanges: ConnectionHandler[];
}

// ---------------------------------
// 4. Realtime Stream Context
// ---------------------------------

export interface RealtimeStreamContextProps {
  // Connection state
  connectionStatus: ConnectionStatus;
  activeStreams: EventStream[];
  isConnected: boolean;
  reconnectAttempts: number;
  lastConnectedAt: string | undefined;
  lastDisconnectedAt: string | undefined;
  connectionLatency: number | undefined;
  
  // Real-time data
  liveMetrics: LiveMetric[];
  statusUpdates: StatusUpdate[];
  entityUpdates: EntityUpdate[];
  recentEvents: WebSocketMessage[];
  
  // Subscription management
  subscribeToEntity: (entityType: string, entityId: string, options?: SubscriptionOptions) => Promise<string>;
  unsubscribeFromEntity: (entityType: string, entityId: string) => Promise<void>;
  subscribeToMetrics: (metricTypes: string[], options?: SubscriptionOptions) => Promise<string>;
  unsubscribeFromMetrics: (metricTypes: string[]) => Promise<void>;
  subscribeToStatus: (entityTypes: string[], options?: SubscriptionOptions) => Promise<string>;
  unsubscribeFromStatus: (entityTypes: string[]) => Promise<void>;
  
  // Event handlers
  onEntityUpdate: (handler: EntityUpdateHandler, entityType?: string) => () => void;
  onMetricUpdate: (handler: MetricUpdateHandler, metricType?: string) => () => void;
  onStatusChange: (handler: StatusChangeHandler, entityType?: string) => () => void;
  onConnectionChange: (handler: ConnectionHandler) => () => void;
  
  // Connection management
  reconnect: () => Promise<void>;
  disconnect: () => void;
  pauseUpdates: () => void;
  resumeUpdates: () => void;
  clearEventHistory: () => void;
  
  // Utilities
  getStreamStatistics: () => StreamStatistics;
  getConnectionHealth: () => ConnectionHealth;
  isEntitySubscribed: (entityType: string, entityId: string) => boolean;
  isMetricSubscribed: (metricType: string) => boolean;
  
  // Batching and optimization
  flushPendingMessages: () => void;
  setUpdateThrottling: (enabled: boolean, interval?: number) => void;
}

export interface SubscriptionOptions {
  priority?: 'high' | 'normal' | 'low';
  filters?: Record<string, any>;
  includeHistory?: boolean;
  historyLimit?: number;
  autoResubscribe?: boolean;
}

export interface StreamStatistics {
  totalMessages: number;
  messagesPerSecond: number;
  totalBytes: number;
  bytesPerSecond: number;
  activeSubscriptions: number;
  queuedMessages: number;
  droppedMessages: number;
  averageLatency: number;
}

export interface ConnectionHealth {
  status: ConnectionStatus;
  uptime: number;
  reconnectCount: number;
  lastError?: string;
  latency: number;
  throughput: number;
  healthScore: number; // 0-100
}

const RealtimeStreamContext = createContext<RealtimeStreamContextProps | null>(null);

// ---------------------------------
// 5. WebSocket Manager Class
// ---------------------------------

class WebSocketManager {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private subscriptions: Map<string, SubscriptionRequest> = new Map();
  private sequenceNumber: number = 0;
  private reconnectAttempts: number = 0;
  private messageHandlers: Map<string, (message: WebSocketMessage) => void> = new Map();
  private connectionStartTime?: number;
  private statistics: StreamStatistics = {
    totalMessages: 0,
    messagesPerSecond: 0,
    totalBytes: 0,
    bytesPerSecond: 0,
    activeSubscriptions: 0,
    queuedMessages: 0,
    droppedMessages: 0,
    averageLatency: 0,
  };

  constructor(config: WebSocketConfig) {
    this.config = config;
  }

  connect(
    onOpen: () => void,
    onMessage: (message: WebSocketMessage) => void,
    onError: (error: Error) => void,
    onClose: () => void
  ): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(this.config.url);
      this.connectionStartTime = Date.now();

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.resubscribeAll();
        this.flushMessageQueue();
        onOpen();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.statistics.totalMessages++;
          this.statistics.totalBytes += event.data.length;
          
          // Handle acknowledgments
          if (message.type === 'ack' && message.correlationId) {
            const handler = this.messageHandlers.get(message.correlationId);
            if (handler) {
              handler(message);
              this.messageHandlers.delete(message.correlationId);
            }
          }
          
          onMessage(message);
        } catch (error) {
          console.error('[WebSocket] Message parse error:', error);
        }
      };

      this.ws.onerror = (event) => {
        console.error('[WebSocket] Error:', event);
        onError(new Error('WebSocket error'));
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        this.stopHeartbeat();
        onClose();
        this.scheduleReconnect(onOpen, onMessage, onError, onClose);
      };
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      onError(error as Error);
      this.scheduleReconnect(onOpen, onMessage, onError, onClose);
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    delete this.connectionStartTime;
  }

  send(message: WebSocketMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          message.sequenceNumber = ++this.sequenceNumber;
          message.correlationId = message.correlationId || `msg_${this.sequenceNumber}`;
          
          // Set up acknowledgment handler if needed
          if (message.type !== 'heartbeat') {
            const timeout = setTimeout(() => {
              this.messageHandlers.delete(message.correlationId!);
              reject(new Error('Message timeout'));
            }, this.config.messageTimeout);

            this.messageHandlers.set(message.correlationId, () => {
              clearTimeout(timeout);
              resolve();
            });
          }

          const data = JSON.stringify(message);
          this.ws.send(data);
          
          if (message.type === 'heartbeat') {
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      } else {
        // Queue message for later
        this.messageQueue.push(message);
        this.statistics.queuedMessages = this.messageQueue.length;
        resolve();
      }
    });
  }

  subscribe(request: SubscriptionRequest): void {
    this.subscriptions.set(request.subscriptionId, request);
    this.statistics.activeSubscriptions = this.subscriptions.size;
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        id: `sub_${Date.now()}`,
        type: 'event',
        payload: {
          action: 'subscribe',
          ...request,
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  unsubscribe(subscriptionId: string): void {
    if (this.subscriptions.has(subscriptionId)) {
      this.subscriptions.delete(subscriptionId);
      this.statistics.activeSubscriptions = this.subscriptions.size;
      
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          id: `unsub_${Date.now()}`,
          type: 'event',
          payload: {
            action: 'unsubscribe',
            subscriptionId,
          },
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          id: `hb_${Date.now()}`,
          type: 'heartbeat',
          payload: { timestamp: Date.now() },
          timestamp: new Date().toISOString(),
        });
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(
    onOpen: () => void,
    onMessage: (message: WebSocketMessage) => void,
    onError: (error: Error) => void,
    onClose: () => void
  ): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect(onOpen, onMessage, onError, onClose);
    }, delay);
  }

  private resubscribeAll(): void {
    this.subscriptions.forEach((request) => {
      this.send({
        id: `resub_${Date.now()}`,
        type: 'event',
        payload: {
          action: 'subscribe',
          ...request,
        },
        timestamp: new Date().toISOString(),
      });
    });
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
    this.statistics.queuedMessages = this.messageQueue.length;
  }

  getStatistics(): StreamStatistics {
    const now = Date.now();
    const uptime = this.connectionStartTime ? (now - this.connectionStartTime) / 1000 : 0;
    
    return {
      ...this.statistics,
      messagesPerSecond: uptime > 0 ? this.statistics.totalMessages / uptime : 0,
      bytesPerSecond: uptime > 0 ? this.statistics.totalBytes / uptime : 0,
    };
  }

  getConnectionHealth(): ConnectionHealth {
    const status = this.ws?.readyState === WebSocket.OPEN ? 'connected' : 'disconnected';
    const uptime = this.connectionStartTime ? Date.now() - this.connectionStartTime : 0;
    const stats = this.getStatistics();
    
    // Calculate health score (0-100)
    let healthScore = 100;
    if (status !== 'connected') healthScore -= 50;
    if (this.reconnectAttempts > 0) healthScore -= Math.min(this.reconnectAttempts * 5, 20);
    if (stats.droppedMessages > 0) healthScore -= Math.min(stats.droppedMessages, 20);
    if (stats.queuedMessages > 10) healthScore -= Math.min(stats.queuedMessages / 2, 10);
    
    return {
      status: status as ConnectionStatus,
      uptime,
      reconnectCount: this.reconnectAttempts,
      latency: stats.averageLatency,
      throughput: stats.bytesPerSecond,
      healthScore: Math.max(0, healthScore),
    };
  }
}

// ---------------------------------
// 6. Provider Component
// ---------------------------------

export const RealtimeStreamProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { tenantId } = useTenant();
  const { triggerSync } = useSync();
  const { config } = useConfig();
  
  // State management
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('initializing');
  const [activeStreams, setActiveStreams] = useState<EventStream[]>([]);
  const [liveMetrics, setLiveMetrics] = useState<LiveMetric[]>([]);
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
  const [entityUpdates, setEntityUpdates] = useState<EntityUpdate[]>([]);
  const [recentEvents, setRecentEvents] = useState<WebSocketMessage[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [updateThrottling, setUpdateThrottlingState] = useState({ enabled: false, interval: 100 });
  
  // Connection metadata
  const [connectionMetadata, setConnectionMetadata] = useState<{
    lastConnectedAt?: string;
    lastDisconnectedAt?: string;
    connectionLatency?: number;
    reconnectAttempts: number;
  }>({
    reconnectAttempts: 0,
  });
  
  // Event handlers registry
  const eventHandlers = useRef<EventHandlers>({
    entityUpdates: new Map(),
    metricUpdates: new Map(),
    statusChanges: new Map(),
    connectionChanges: [],
  });
  
  // WebSocket manager instance
  const wsManager = useRef<WebSocketManager | null>(null);
  
  // Throttling timers
  const throttleTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  
  // Initialize WebSocket configuration
  const wsConfig: WebSocketConfig = useMemo(() => ({
    url: config?.websocket?.url || `ws://localhost:8080/ws/${tenantId}`,
    reconnectInterval: config?.websocket?.reconnectInterval || 3000,
    maxReconnectAttempts: config?.websocket?.maxReconnectAttempts || 10,
    heartbeatInterval: config?.websocket?.heartbeatInterval || 30000,
    messageTimeout: config?.websocket?.messageTimeout || 5000,
    batchingInterval: config?.websocket?.batchingInterval || 100,
    maxBatchSize: config?.websocket?.maxBatchSize || 100,
    compressionEnabled: config?.websocket?.compressionEnabled !== false,
  }), [config, tenantId]);
  
  // Initialize WebSocket manager
  useEffect(() => {
    if (!tenantId) return;
    
    wsManager.current = new WebSocketManager(wsConfig);
    
    const handleOpen = () => {
      setConnectionStatus('connected');
      setConnectionMetadata(prev => ({
        ...prev,
        lastConnectedAt: new Date().toISOString(),
        reconnectAttempts: 0,
      }));
      
      // Notify connection handlers
      eventHandlers.current.connectionChanges.forEach(handler => handler('connected'));
    };
    
    const handleMessage = (message: WebSocketMessage) => {
      if (isPaused) return;
      
      // Add to recent events (keep last 100)
      setRecentEvents(prev => [...prev.slice(-99), message].slice(-100));
      
      // Process message based on type
      switch (message.type) {
        case 'metric':
          handleMetricUpdate(message);
          break;
        case 'status':
          handleStatusUpdate(message);
          break;
        case 'entity':
          handleEntityUpdate(message);
          break;
        case 'event':
          handleGenericEvent(message);
          break;
      }
    };
    
    const handleError = (error: Error) => {
      console.error('[RealtimeStream] WebSocket error:', error);
      setConnectionStatus('reconnecting');
    };
    
    const handleClose = () => {
      setConnectionStatus('disconnected');
      setConnectionMetadata(prev => ({
        ...prev,
        lastDisconnectedAt: new Date().toISOString(),
        reconnectAttempts: prev.reconnectAttempts + 1,
      }));
      
      // Notify connection handlers
      eventHandlers.current.connectionChanges.forEach(handler => handler('disconnected'));
    };
    
    // Connect to WebSocket
    wsManager.current.connect(handleOpen, handleMessage, handleError, handleClose);
    
    // Cleanup on unmount
    return () => {
      wsManager.current?.disconnect();
      throttleTimers.current.forEach(timer => clearTimeout(timer));
    };
  }, [tenantId, wsConfig, isPaused]);
  
  // Handle metric updates
  const handleMetricUpdate = useCallback((message: WebSocketMessage) => {
    const metric = message.payload as LiveMetric;
    
    // Apply throttling if enabled
    if (updateThrottling.enabled) {
      const key = `metric_${metric.metricType}_${metric.entityId || 'global'}`;
      if (throttleTimers.current.has(key)) {
        return;
      }
      
      throttleTimers.current.set(key, setTimeout(() => {
        throttleTimers.current.delete(key);
      }, updateThrottling.interval));
    }
    
    // Update live metrics
    setLiveMetrics(prev => {
      const index = prev.findIndex(m => 
        m.metricType === metric.metricType && 
        m.entityId === metric.entityId
      );
      
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = metric;
        return updated;
      }
      return [...prev, metric].slice(-1000); // Keep last 1000 metrics
    });
    
    // Notify metric handlers
    const metricUpdate: MetricUpdate = {
      metricId: metric.id,
      entityType: metric.entityType || undefined,
      entityId: metric.entityId || undefined,
      value: metric.value,
      timestamp: metric.timestamp,
    };
    
    // Global handlers
    eventHandlers.current.metricUpdates.get('*')?.forEach(handler => handler(metricUpdate));
    // Specific handlers
    eventHandlers.current.metricUpdates.get(metric.metricType)?.forEach(handler => handler(metricUpdate));
  }, [updateThrottling]);
  
  // Handle status updates
  const handleStatusUpdate = useCallback((message: WebSocketMessage) => {
    const status = message.payload as StatusUpdate;
    
    // Update status updates
    setStatusUpdates(prev => [...prev, status].slice(-500)); // Keep last 500 status updates
    
    // Notify status handlers
    eventHandlers.current.statusChanges.get('*')?.forEach(handler => handler(status));
    eventHandlers.current.statusChanges.get(status.entityType)?.forEach(handler => handler(status));
  }, []);
  
  // Handle entity updates  
  const handleEntityUpdate = useCallback((message: WebSocketMessage) => {
    const update = message.payload as EntityUpdate;
    
    // Apply throttling if enabled
    if (updateThrottling.enabled) {
      const key = `entity_${update.entityType}_${update.entityId}`;
      if (throttleTimers.current.has(key)) {
        return;
      }
      
      throttleTimers.current.set(key, setTimeout(() => {
        throttleTimers.current.delete(key);
      }, updateThrottling.interval));
    }
    
    // Update entity updates
    setEntityUpdates(prev => [...prev, update].slice(-500)); // Keep last 500 entity updates
    
    // Update active streams
    if (update.updateType === 'created' || update.updateType === 'updated') {
      const streamId = `${update.entityType}_${update.entityId}`;
      setActiveStreams(prev => {
        const existing = prev.find(s => 
          s.entityType === update.entityType && 
          s.entityId === update.entityId
        );
        
        if (existing) {
          return prev.map(s => 
            s.id === existing.id 
              ? { ...s, lastEventAt: update.timestamp, eventCount: s.eventCount + 1 }
              : s
          );
        }
        return prev;
      });
    }
    
    // Notify entity handlers
    eventHandlers.current.entityUpdates.get('*')?.forEach(handler => handler(update));
    eventHandlers.current.entityUpdates.get(update.entityType)?.forEach(handler => handler(update));
  }, [updateThrottling]);
  
  // Handle generic events
  const handleGenericEvent = useCallback((message: WebSocketMessage) => {
    // Process based on event action
    const { action, data } = message.payload;
    
    switch (action) {
      case 'stream_created':
        setActiveStreams(prev => [...prev, data]);
        break;
      case 'stream_closed':
        setActiveStreams(prev => prev.filter(s => s.id !== data.id));
        break;
      case 'batch_update':
        // Handle batch updates
        if (data.metrics) {
          data.metrics.forEach((metric: LiveMetric) => {
            handleMetricUpdate({ ...message, payload: metric });
          });
        }
        if (data.entities) {
          data.entities.forEach((entity: EntityUpdate) => {
            handleEntityUpdate({ ...message, payload: entity });
          });
        }
        break;
    }
  }, [handleMetricUpdate, handleEntityUpdate]);
  
  // Subscription management
  const subscribeToEntity = useCallback(async (
    entityType: string,
    entityId: string,
    options?: SubscriptionOptions
  ): Promise<string> => {
    const subscriptionId = `entity_${entityType}_${entityId}_${Date.now()}`;
    const request: SubscriptionRequest = {
      subscriptionId,
      entityType,
      entityId,
      filters: options?.filters || {},
    };
    
    wsManager.current?.subscribe(request);
    
    // Create stream record
    const stream: EventStream = {
      id: subscriptionId,
      entityType,
      entityId,
      subscriptionType: 'entity',
      createdAt: new Date().toISOString(),
      eventCount: 0,
      active: true,
    };
    
    setActiveStreams(prev => [...prev, stream]);
    
    // Request history if needed
    if (options?.includeHistory) {
      // This would typically fetch from backend
      await triggerSync();
    }
    
    return subscriptionId;
  }, [triggerSync]);
  
  const unsubscribeFromEntity = useCallback(async (
    entityType: string,
    entityId: string
  ): Promise<void> => {
    const stream = activeStreams.find(s => 
      s.entityType === entityType && 
      s.entityId === entityId
    );
    
    if (stream) {
      wsManager.current?.unsubscribe(stream.id);
      setActiveStreams(prev => prev.filter(s => s.id !== stream.id));
    }
  }, [activeStreams]);
  
  const subscribeToMetrics = useCallback(async (
    metricTypes: string[],
    options?: SubscriptionOptions
  ): Promise<string> => {
    const subscriptionId = `metrics_${metricTypes.join('_')}_${Date.now()}`;
    const request: SubscriptionRequest = {
      subscriptionId,
      metricTypes,
      filters: options?.filters || {},
    };
    
    wsManager.current?.subscribe(request);
    
    // Create stream record for each metric type
    metricTypes.forEach(metricType => {
      const stream: EventStream = {
        id: `${subscriptionId}_${metricType}`,
        entityType: 'metric',
        entityId: metricType,
        subscriptionType: 'metrics',
        createdAt: new Date().toISOString(),
        eventCount: 0,
        active: true,
      };
      
      setActiveStreams(prev => [...prev, stream]);
    });
    
    return subscriptionId;
  }, []);
  
  const unsubscribeFromMetrics = useCallback(async (
    metricTypes: string[]
  ): Promise<void> => {
    const streams = activeStreams.filter(s => 
      s.subscriptionType === 'metrics' && 
      metricTypes.includes(s.entityId)
    );
    
    streams.forEach(stream => {
      wsManager.current?.unsubscribe(stream.id);
    });
    
    setActiveStreams(prev => prev.filter(s => 
      !(s.subscriptionType === 'metrics' && metricTypes.includes(s.entityId))
    ));
  }, [activeStreams]);
  
  const subscribeToStatus = useCallback(async (
    entityTypes: string[],
    options?: SubscriptionOptions
  ): Promise<string> => {
    const subscriptionId = `status_${entityTypes.join('_')}_${Date.now()}`;
    const request: SubscriptionRequest = {
      subscriptionId,
      eventTypes: entityTypes.map(type => `${type}_status`),
      filters: options?.filters || {},
    };
    
    wsManager.current?.subscribe(request);
    
    // Create stream record
    const stream: EventStream = {
      id: subscriptionId,
      entityType: 'status',
      entityId: entityTypes.join(','),
      subscriptionType: 'status',
      createdAt: new Date().toISOString(),
      eventCount: 0,
      active: true,
    };
    
    setActiveStreams(prev => [...prev, stream]);
    
    return subscriptionId;
  }, []);
  
  const unsubscribeFromStatus = useCallback(async (
    entityTypes: string[]
  ): Promise<void> => {
    const streamId = entityTypes.join(',');
    const stream = activeStreams.find(s => 
      s.subscriptionType === 'status' && 
      s.entityId === streamId
    );
    
    if (stream) {
      wsManager.current?.unsubscribe(stream.id);
      setActiveStreams(prev => prev.filter(s => s.id !== stream.id));
    }
  }, [activeStreams]);
  
  // Event handler registration
  const onEntityUpdate = useCallback((
    handler: EntityUpdateHandler,
    entityType?: string
  ): (() => void) => {
    const key = entityType || '*';
    if (!eventHandlers.current.entityUpdates.has(key)) {
      eventHandlers.current.entityUpdates.set(key, []);
    }
    eventHandlers.current.entityUpdates.get(key)!.push(handler);
    
    // Return unsubscribe function
    return () => {
      const handlers = eventHandlers.current.entityUpdates.get(key);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index >= 0) {
          handlers.splice(index, 1);
        }
      }
    };
  }, []);
  
  const onMetricUpdate = useCallback((
    handler: MetricUpdateHandler,
    metricType?: string
  ): (() => void) => {
    const key = metricType || '*';
    if (!eventHandlers.current.metricUpdates.has(key)) {
      eventHandlers.current.metricUpdates.set(key, []);
    }
    eventHandlers.current.metricUpdates.get(key)!.push(handler);
    
    // Return unsubscribe function
    return () => {
      const handlers = eventHandlers.current.metricUpdates.get(key);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index >= 0) {
          handlers.splice(index, 1);
        }
      }
    };
  }, []);
  
  const onStatusChange = useCallback((
    handler: StatusChangeHandler,
    entityType?: string
  ): (() => void) => {
    const key = entityType || '*';
    if (!eventHandlers.current.statusChanges.has(key)) {
      eventHandlers.current.statusChanges.set(key, []);
    }
    eventHandlers.current.statusChanges.get(key)!.push(handler);
    
    // Return unsubscribe function
    return () => {
      const handlers = eventHandlers.current.statusChanges.get(key);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index >= 0) {
          handlers.splice(index, 1);
        }
      }
    };
  }, []);
  
  const onConnectionChange = useCallback((
    handler: ConnectionHandler
  ): (() => void) => {
    eventHandlers.current.connectionChanges.push(handler);
    
    // Return unsubscribe function
    return () => {
      const index = eventHandlers.current.connectionChanges.indexOf(handler);
      if (index >= 0) {
        eventHandlers.current.connectionChanges.splice(index, 1);
      }
    };
  }, []);
  
  // Connection management
  const reconnect = useCallback(async (): Promise<void> => {
    setConnectionStatus('reconnecting');
    wsManager.current?.disconnect();
    
    // Reinitialize connection
    setTimeout(() => {
      wsManager.current?.connect(
        () => setConnectionStatus('connected'),
        (message) => handleGenericEvent({ ...message, id: message.id, type: 'event', timestamp: new Date().toISOString(), payload: message }),
        (error) => console.error(error),
        () => setConnectionStatus('disconnected')
      );
    }, 1000);
  }, [handleGenericEvent]);
  
  const disconnect = useCallback((): void => {
    wsManager.current?.disconnect();
    setConnectionStatus('disconnected');
    setActiveStreams([]);
  }, []);
  
  const pauseUpdates = useCallback((): void => {
    setIsPaused(true);
  }, []);
  
  const resumeUpdates = useCallback((): void => {
    setIsPaused(false);
  }, []);
  
  const clearEventHistory = useCallback((): void => {
    setRecentEvents([]);
    setEntityUpdates([]);
    setStatusUpdates([]);
  }, []);
  
  // Utility functions
  const getStreamStatistics = useCallback((): StreamStatistics => {
    return wsManager.current?.getStatistics() || {
      totalMessages: recentEvents.length,
      messagesPerSecond: 0,
      totalBytes: 0,
      bytesPerSecond: 0,
      activeSubscriptions: activeStreams.length,
      queuedMessages: 0,
      droppedMessages: 0,
      averageLatency: connectionMetadata.connectionLatency || 0,
    };
  }, [activeStreams, recentEvents, connectionMetadata]);
  
  const getConnectionHealth = useCallback((): ConnectionHealth => {
    return wsManager.current?.getConnectionHealth() || {
      status: connectionStatus,
      uptime: 0,
      reconnectCount: connectionMetadata.reconnectAttempts,
      latency: connectionMetadata.connectionLatency || 0,
      throughput: 0,
      healthScore: connectionStatus === 'connected' ? 100 : 0,
    };
  }, [connectionStatus, connectionMetadata]);
  
  const isEntitySubscribed = useCallback((
    entityType: string,
    entityId: string
  ): boolean => {
    return activeStreams.some(s => 
      s.entityType === entityType && 
      s.entityId === entityId &&
      s.active
    );
  }, [activeStreams]);
  
  const isMetricSubscribed = useCallback((
    metricType: string
  ): boolean => {
    return activeStreams.some(s => 
      s.subscriptionType === 'metrics' && 
      s.entityId === metricType &&
      s.active
    );
  }, [activeStreams]);
  
  const flushPendingMessages = useCallback((): void => {
    // This would trigger the WebSocket manager to flush its queue
    // Implementation depends on the WebSocket manager's internal queue
  }, []);
  
  const setUpdateThrottling = useCallback((
    enabled: boolean,
    interval?: number
  ): void => {
    setUpdateThrottlingState({
      enabled,
      interval: interval || 100,
    });
    
    // Clear existing throttle timers when disabled
    if (!enabled) {
      throttleTimers.current.forEach(timer => clearTimeout(timer));
      throttleTimers.current.clear();
    }
  }, []);
  
  // Context value
  const value = useMemo<RealtimeStreamContextProps>(() => ({
    // Connection state
    connectionStatus,
    activeStreams,
    isConnected: connectionStatus === 'connected',
    reconnectAttempts: connectionMetadata.reconnectAttempts,
    lastConnectedAt: connectionMetadata.lastConnectedAt || undefined,
    lastDisconnectedAt: connectionMetadata.lastDisconnectedAt || undefined,
    connectionLatency: connectionMetadata.connectionLatency || undefined,
    
    // Real-time data
    liveMetrics,
    statusUpdates,
    entityUpdates,
    recentEvents,
    
    // Subscription management
    subscribeToEntity,
    unsubscribeFromEntity,
    subscribeToMetrics,
    unsubscribeFromMetrics,
    subscribeToStatus,
    unsubscribeFromStatus,
    
    // Event handlers
    onEntityUpdate,
    onMetricUpdate,
    onStatusChange,
    onConnectionChange,
    
    // Connection management
    reconnect,
    disconnect,
    pauseUpdates,
    resumeUpdates,
    clearEventHistory,
    
    // Utilities
    getStreamStatistics,
    getConnectionHealth,
    isEntitySubscribed,
    isMetricSubscribed,
    
    // Batching and optimization
    flushPendingMessages,
    setUpdateThrottling,
  }), [
    connectionStatus,
    activeStreams,
    connectionMetadata,
    liveMetrics,
    statusUpdates,
    entityUpdates,
    recentEvents,
    subscribeToEntity,
    unsubscribeFromEntity,
    subscribeToMetrics,
    unsubscribeFromMetrics,
    subscribeToStatus,
    unsubscribeFromStatus,
    onEntityUpdate,
    onMetricUpdate,
    onStatusChange,
    onConnectionChange,
    reconnect,
    disconnect,
    pauseUpdates,
    resumeUpdates,
    clearEventHistory,
    getStreamStatistics,
    getConnectionHealth,
    isEntitySubscribed,
    isMetricSubscribed,
    flushPendingMessages,
    setUpdateThrottling,
  ]);
  
  return (
    <RealtimeStreamContext.Provider value={value}>
      {children}
    </RealtimeStreamContext.Provider>
  );
};

// ---------------------------------
// 7. Custom Hook
// ---------------------------------

export const useRealtimeStream = (): RealtimeStreamContextProps => {
  const context = useContext(RealtimeStreamContext);
  if (!context) {
    throw new Error('useRealtimeStream must be used within RealtimeStreamProvider');
  }
  return context;
};

// ---------------------------------
// 8. Selective Subscription Hooks
// ---------------------------------

export const useEntityStream = (
  entityType: string,
  entityId: string,
  options?: SubscriptionOptions
) => {
  const { 
    subscribeToEntity, 
    unsubscribeFromEntity, 
    onEntityUpdate,
    entityUpdates,
    isEntitySubscribed,
  } = useRealtimeStream();
  
  const [localUpdates, setLocalUpdates] = useState<EntityUpdate[]>([]);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  
  useEffect(() => {
    let unsubscribeHandler: (() => void) | null = null;
    
    const subscribe = async () => {
      const id = await subscribeToEntity(entityType, entityId, options);
      setSubscriptionId(id);
      
      // Register handler for this specific entity
      unsubscribeHandler = onEntityUpdate((update) => {
        if (update.entityType === entityType && update.entityId === entityId) {
          setLocalUpdates(prev => [...prev, update].slice(-100));
        }
      }, entityType);
    };
    
    subscribe();
    
    return () => {
      if (subscriptionId) {
        unsubscribeFromEntity(entityType, entityId);
      }
      if (unsubscribeHandler) {
        unsubscribeHandler();
      }
    };
  }, [entityType, entityId]);
  
  return {
    updates: localUpdates,
    isSubscribed: isEntitySubscribed(entityType, entityId),
    allUpdates: entityUpdates.filter(u => 
      u.entityType === entityType && 
      u.entityId === entityId
    ),
  };
};

export const useMetricStream = (
  metricTypes: string[],
  options?: SubscriptionOptions
) => {
  const { 
    subscribeToMetrics, 
    unsubscribeFromMetrics, 
    onMetricUpdate,
    liveMetrics,
    isMetricSubscribed,
  } = useRealtimeStream();
  
  const [localMetrics, setLocalMetrics] = useState<LiveMetric[]>([]);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  
  useEffect(() => {
    let unsubscribeHandlers: (() => void)[] = [];
    
    const subscribe = async () => {
      const id = await subscribeToMetrics(metricTypes, options);
      setSubscriptionId(id);
      
      // Register handlers for each metric type
      metricTypes.forEach(metricType => {
        const unsubscribe = onMetricUpdate((metric) => {
          setLocalMetrics(prev => {
            const index = prev.findIndex(m => 
              m.metricType === metricType && 
              m.entityId === metric.entityId
            );
            
            if (index >= 0 && prev[index]) {
              const updated = [...prev];
              updated[index] = {
                ...prev[index],
                value: metric.value,
                timestamp: metric.timestamp,
              };
              return updated;
            }
            return prev;
          });
        }, metricType);
        
        unsubscribeHandlers.push(unsubscribe);
      });
    };
    
    subscribe();
    
    return () => {
      if (subscriptionId) {
        unsubscribeFromMetrics(metricTypes);
      }
      unsubscribeHandlers.forEach(unsubscribe => unsubscribe());
    };
  }, [metricTypes.join(',')]);
  
  return {
    metrics: localMetrics,
    isSubscribed: metricTypes.every(type => isMetricSubscribed(type)),
    allMetrics: liveMetrics.filter(m => 
      metricTypes.includes(m.metricType)
    ),
  };
};

export const useConnectionStatus = () => {
  const { 
    connectionStatus, 
    isConnected,
    reconnectAttempts,
    getConnectionHealth,
    reconnect,
    disconnect,
  } = useRealtimeStream();
  
  const [health, setHealth] = useState<ConnectionHealth>(getConnectionHealth());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setHealth(getConnectionHealth());
    }, 5000);
    
    return () => clearInterval(interval);
  }, [getConnectionHealth]);
  
  return {
    status: connectionStatus,
    isConnected,
    reconnectAttempts,
    health,
    reconnect,
    disconnect,
  };
};

// Export types are already exported above as interfaces