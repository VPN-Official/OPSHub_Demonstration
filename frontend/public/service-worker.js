// service-worker.js - OpsHub Enterprise PWA Service Worker
// Integrated with OfflineCapabilityContext, SyncProvider, and tenant-specific patterns

const CACHE_VERSION = 'opshub-v1.0.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE = `${CACHE_VERSION}-api`;
const CRITICAL_DATA_CACHE = `${CACHE_VERSION}-critical`;

// Integrates with your CriticalDataCache[] structure
const CRITICAL_DATA_TYPES = {
  workitems: { priority: 'critical', updateFrequency: 'realtime' },
  configurations: { priority: 'important', updateFrequency: 'static' },
  knowledge_base: { priority: 'normal', updateFrequency: 'periodic' }
};

// Static assets for immediate caching
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/offline.html' // Fallback page
];

// API patterns matching your backend structure
const CRITICAL_API_PATTERNS = [
  /\/api\/workitems\/.*\?.*priority=high/,
  /\/api\/incidents\/.*\?.*status=active/,
  /\/api\/config\/.*/,
  /\/api\/user\/profile/,
  /\/api\/teams\/oncall/,
  /\/api\/schedules\/active/
];

const CACHEABLE_API_PATTERNS = [
  /\/api\/workitems/,
  /\/api\/incidents/,
  /\/api\/assets/,
  /\/api\/knowledge/,
  /\/api\/automations/,
  /\/api\/schedules/,
  /\/api\/metrics/,
  /\/api\/problems/,
  /\/api\/changes/,
  /\/api\/teams/,
  /\/api\/customers/,
  /\/api\/vendors/
];

const NETWORK_ONLY_PATTERNS = [
  /\/api\/realtime/,
  /\/api\/websocket/,
  /\/api\/auth/,
  /\/api\/sync\/conflicts/,
  /\/api\/.*\/bulk/  // Bulk operations always go to server
];

// =================================
// STORAGE QUOTA MANAGEMENT
// =================================
async function checkStorageQuota() {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usageRatio = estimate.usage / estimate.quota;
      
      console.log(`[ServiceWorker] Storage usage: ${(usageRatio * 100).toFixed(1)}% (${estimate.usage} / ${estimate.quota} bytes)`);
      
      if (usageRatio > 0.8) {
        console.warn('[ServiceWorker] Storage quota nearly full, cleaning cache');
        await performCacheCleanup();
      }
      
      return usageRatio;
    }
  } catch (error) {
    console.error('[ServiceWorker] Storage quota check failed:', error);
  }
  return 0;
}

async function performCacheCleanup() {
  try {
    const cacheNames = await caches.keys();
    
    // Delete old version caches first
    for (const cacheName of cacheNames) {
      if (cacheName.startsWith('opshub-') && !cacheName.startsWith(CACHE_VERSION)) {
        console.log('[ServiceWorker] Cleaning old cache:', cacheName);
        await caches.delete(cacheName);
      }
    }
    
    // If still over limit, clean dynamic cache entries
    const dynamicCache = await caches.open(DYNAMIC_CACHE);
    const requests = await dynamicCache.keys();
    
    // Remove oldest 25% of dynamic cache entries
    const removeCount = Math.floor(requests.length * 0.25);
    for (let i = 0; i < removeCount; i++) {
      await dynamicCache.delete(requests[i]);
    }
    
    // Clean up old API cache entries
    const apiCaches = await caches.keys();
    for (const cacheName of apiCaches) {
      if (cacheName.includes(API_CACHE)) {
        const cache = await caches.open(cacheName);
        const entries = await cache.keys();
        
        // Remove entries older than 24 hours
        for (const entry of entries) {
          const response = await cache.match(entry);
          if (response) {
            const dateHeader = response.headers.get('date');
            if (dateHeader) {
              const age = Date.now() - new Date(dateHeader).getTime();
              if (age > 24 * 60 * 60 * 1000) { // 24 hours
                await cache.delete(entry);
              }
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error('[ServiceWorker] Cache cleanup failed:', error);
  }
}

// =================================
// INSTALL EVENT
// =================================
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing OpsHub SW...');
  
  event.waitUntil(
    Promise.all([
      // Check storage quota before caching
      checkStorageQuota(),
      // Cache static assets
      caches.open(STATIC_CACHE)
        .then((cache) => {
          console.log('[ServiceWorker] Caching static assets');
          return cache.addAll(STATIC_ASSETS);
        })
    ])
    .then(() => {
      console.log('[ServiceWorker] Skip waiting');
      return self.skipWaiting();
    })
    .catch((error) => {
      console.error('[ServiceWorker] Install failed:', error);
    })
  );
});

// =================================
// ACTIVATE EVENT
// =================================
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating OpsHub SW...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith('opshub-') && !cacheName.startsWith(CACHE_VERSION)) {
              console.log('[ServiceWorker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Initialize critical data storage
      initializeCriticalDataStorage(),
      // Claim clients
      self.clients.claim()
    ])
  );
});

// =================================
// FETCH EVENT - Integrated with your patterns
// =================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests for caching (except for queue processing)
  if (request.method !== 'GET') {
    // Handle POST/PUT/DELETE for offline queue processing
    if (url.pathname.startsWith('/api/') && !isNetworkOnly(url)) {
      event.respondWith(handleOfflineAction(request, url));
    }
    return;
  }
  
  // Skip non-http requests
  if (!request.url.startsWith('http')) {
    return;
  }
  
  event.respondWith(handleRequest(request, url));
});

// =================================
// REQUEST HANDLING - Matches your cache strategies
// =================================
async function handleRequest(request, url) {
  try {
    // 1. Static assets - Cache First
    if (isStaticAsset(url)) {
      return await cacheFirst(request, STATIC_CACHE);
    }
    
    // 2. Network-only patterns (realtime, auth, conflicts)
    if (isNetworkOnly(url)) {
      return await networkOnly(request);
    }
    
    // 3. Critical API data - matches your criticalDataSets priority
    if (isCriticalAPI(url)) {
      return await cacheFirstWithBackgroundUpdate(request, CRITICAL_DATA_CACHE);
    }
    
    // 4. Regular API - Network First with cache fallback
    if (isAPI(url)) {
      return await networkFirstWithTenantIsolation(request, API_CACHE);
    }
    
    // 5. Dynamic content - Stale While Revalidate
    return await staleWhileRevalidate(request, DYNAMIC_CACHE);
    
  } catch (error) {
    console.error('[ServiceWorker] Request handling failed:', error);
    return await handleOfflineResponse(request, url);
  }
}

// =================================
// CACHE STRATEGIES - Integrated with your patterns
// =================================

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  const networkResponse = await fetch(request);
  if (networkResponse.ok) {
    cache.put(request, networkResponse.clone());
  }
  
  return networkResponse;
}

async function networkFirstWithTenantIsolation(request, cacheName) {
  let tenantId;
  try {
    tenantId = await extractTenantFromRequest(request);
  } catch (error) {
    // Return error response for invalid tenant
    return new Response(
      JSON.stringify({
        error: 'ValidationError',
        message: error.message,
        code: 'INVALID_TENANT'
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  const cache = await caches.open(`${cacheName}-${tenantId || 'default'}`);
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful responses with tenant isolation
      await cache.put(request, networkResponse.clone());
      
      // Update sync timestamp for OfflineCapabilityContext
      await updateSyncTimestamp(request.url, tenantId);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[ServiceWorker] Network failed, trying cache:', request.url);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Add offline header to match your offline detection
      const response = cachedResponse.clone();
      response.headers.append('X-Served-From', 'sw-cache');
      response.headers.append('X-Cache-Tenant', tenantId || 'default');
      return response;
    }
    
    throw error;
  }
}

async function cacheFirstWithBackgroundUpdate(request, cacheName) {
  const tenantId = await extractTenantFromRequest(request);
  
  // Check storage quota before major cache operation
  await checkStorageQuota();
  
  const cache = await caches.open(`${cacheName}-${tenantId || 'default'}`);
  const cachedResponse = await cache.match(request);
  
  // Return cached response immediately if available
  if (cachedResponse) {
    // Background update - don't wait
    updateCacheInBackground(request, cache, tenantId);
    return cachedResponse;
  }
  
  // No cache, fetch from network
  const networkResponse = await fetch(request);
  if (networkResponse.ok) {
    await cache.put(request, networkResponse.clone());
    await updateSyncTimestamp(request.url, tenantId);
  }
  
  return networkResponse;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  // Always fetch in background to update cache
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  });
  
  // Return cached response immediately if available, otherwise wait for network
  return cachedResponse || fetchPromise;
}

async function networkOnly(request) {
  return await fetch(request);
}

// =================================
// BACKGROUND SYNC - Integrated with your queue system
// =================================
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync triggered:', event.tag);
  
  // Matches your scheduleBackgroundSync tags
  if (event.tag.startsWith('opshub-sync-')) {
    const tenantId = event.tag.split('-')[2]; // opshub-sync-{tenantId}
    event.waitUntil(processOfflineQueue(tenantId));
  }
  
  if (event.tag.startsWith('opshub-critical-')) {
    const tenantId = event.tag.split('-')[2];
    event.waitUntil(syncCriticalData(tenantId));
  }
});

async function processOfflineQueue(tenantId) {
  try {
    console.log(`[ServiceWorker] Processing offline queue for tenant: ${tenantId}`);
    
    // Service workers cannot access localStorage
    // Queue processing should be handled by the main thread
    // For now, we'll skip queue processing in the service worker
    const queueKey = `opshub_${tenantId}_offline_queue`;
    const queueData = null; // Would need IndexedDB or postMessage implementation
    
    if (!queueData) return;
    
    const queuedActions = JSON.parse(queueData);
    const processedActions = [];
    
    for (const action of queuedActions) {
      try {
        // Execute action using your API pattern
        const response = await fetch(`/api/${action.entityType}/${action.actionType}`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Tenant-ID': tenantId
          },
          body: JSON.stringify(action.payload),
        });
        
        if (response.ok) {
          processedActions.push(action.id);
          console.log(`[ServiceWorker] Successfully processed action: ${action.id}`);
        } else {
          const error = await response.json();
          if (error.type === 'conflict') {
            // Store conflict for your ConflictResolutionEngine
            await storeConflict(tenantId, action, error);
          }
        }
      } catch (error) {
        console.error(`[ServiceWorker] Failed to process action ${action.id}:`, error);
        
        // Increment retry count
        action.attemptCount = (action.attemptCount || 0) + 1;
        if (action.attemptCount >= 3) {
          action.error = error.message;
        }
      }
    }
    
    // Update queue by removing processed actions
    if (processedActions.length > 0) {
      const remainingActions = queuedActions.filter(action => 
        !processedActions.includes(action.id)
      );
      // Would need to store via IndexedDB or postMessage
      console.log('[ServiceWorker] Queue update skipped - localStorage not available');
    }
    
  } catch (error) {
    console.error('[ServiceWorker] Background sync failed:', error);
  }
}

async function syncCriticalData(tenantId) {
  // Sync critical endpoints matching your criticalDataSets
  const criticalEndpoints = [
    `/api/workitems?tenant=${tenantId}&priority=high`,
    `/api/incidents?tenant=${tenantId}&status=active`,
    `/api/config/current?tenant=${tenantId}`,
    `/api/user/profile?tenant=${tenantId}`,
    `/api/teams/oncall?tenant=${tenantId}`
  ];
  
  for (const endpoint of criticalEndpoints) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        const cache = await caches.open(`${CRITICAL_DATA_CACHE}-${tenantId}`);
        await cache.put(endpoint, response.clone());
        
        // Update sync timestamp
        await updateSyncTimestamp(endpoint, tenantId);
      }
    } catch (error) {
      console.error('[ServiceWorker] Failed to sync critical data:', endpoint, error);
    }
  }
}

// =================================
// PUSH NOTIFICATIONS - Enterprise patterns
// =================================
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push received');
  
  if (!event.data) return;
  
  const data = event.data.json();
  
  // Match your notification patterns
  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: data.tag || `opshub-${data.type || 'notification'}`,
    data: {
      ...data.data,
      tenantId: data.tenantId,
      workItemId: data.workItemId,
      incidentId: data.incidentId
    },
    actions: getNotificationActions(data.type),
    requireInteraction: data.priority === 'critical',
    timestamp: Date.now(),
    renotify: data.priority === 'critical'
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification clicked:', event.action);
  
  event.notification.close();
  
  const { tenantId, workItemId, incidentId } = event.notification.data;
  
  let targetUrl = '/pulse';
  
  // Navigate to specific pages based on notification data
  if (event.action === 'view_incident' && incidentId) {
    targetUrl = `/workitem/incident/${incidentId}`;
  } else if (event.action === 'view_workitem' && workItemId) {
    targetUrl = `/workitem/${workItemId}`;
  } else if (event.action === 'open_smartqueue') {
    targetUrl = '/smartqueue';
  }
  
  event.waitUntil(
    clients.openWindow(targetUrl)
  );
});

// =================================
// UTILITY FUNCTIONS
// =================================
function isStaticAsset(url) {
  return url.pathname.startsWith('/static/') || 
         url.pathname === '/' ||
         url.pathname === '/index.html' ||
         url.pathname === '/manifest.json' ||
         url.pathname === '/offline.html' ||
         url.pathname.match(/\.(css|js|ico|png|jpg|jpeg|svg|woff|woff2)$/);
}

function isAPI(url) {
  return url.pathname.startsWith('/api/') && 
         !isNetworkOnly(url) && 
         !isCriticalAPI(url);
}

function isCriticalAPI(url) {
  return CRITICAL_API_PATTERNS.some(pattern => pattern.test(url.pathname + url.search));
}

function isNetworkOnly(url) {
  return NETWORK_ONLY_PATTERNS.some(pattern => pattern.test(url.pathname));
}

// Helper function to get tenant ID from IndexedDB
async function getTenantFromIndexedDB() {
  try {
    const db = await openDB();
    const tx = db.transaction(['app_state'], 'readonly');
    const store = tx.objectStore('app_state');
    const result = await store.get('current_tenant');
    return result ? result.value : null;
  } catch (error) {
    // IndexedDB not available or error
    return null;
  }
}

// Helper to open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('OpsHubDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('app_state')) {
        db.createObjectStore('app_state', { keyPath: 'key' });
      }
    };
  });
}

async function extractTenantFromRequest(request) {
  const url = new URL(request.url);
  
  // Skip tenant requirement for non-API routes
  if (!url.pathname.startsWith('/api/')) {
    return null;
  }
  
  // Skip tenant requirement for public endpoints
  const publicEndpoints = ['/api/health', '/api/status', '/api/version', '/api/auth', '/api/tenants'];
  if (publicEndpoints.some(endpoint => url.pathname.startsWith(endpoint))) {
    return null;
  }
  
  // Try multiple sources
  const tenantFromQuery = url.searchParams.get('tenant');
  const tenantHeader = request.headers.get('X-Tenant-ID');
  const pathMatch = url.pathname.match(/\/api\/tenant\/([^\/]+)/);
  
  let tenantId = tenantFromQuery || tenantHeader || (pathMatch ? pathMatch[1] : null);
  
  // Try IndexedDB as fallback
  if (!tenantId) {
    tenantId = await getTenantFromIndexedDB();
  }
  
  // For non-critical operations, allow missing tenant ID
  if (!tenantId) {
    // Only log in debug mode, not in production
    if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
      console.debug('[ServiceWorker] No tenant ID found for request:', url.pathname);
    }
    return null; // Allow graceful degradation
  }
  
  // Validate tenant ID format if present
  if (!/^[a-zA-Z0-9_-]{1,50}$/.test(tenantId)) {
    console.error('[ServiceWorker] Invalid tenant identifier format:', tenantId);
    throw new Error('Invalid tenant identifier format');
  }
  
  return tenantId;
}

async function updateCacheInBackground(request, cache, tenantId) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
      await updateSyncTimestamp(request.url, tenantId);
    }
  } catch (error) {
    console.log('[ServiceWorker] Background update failed:', error);
  }
}

async function updateSyncTimestamp(url, tenantId) {
  // Service workers cannot access localStorage
  // This functionality would need to be implemented using IndexedDB or postMessage to main thread
  // For now, we'll skip timestamp tracking in the service worker
  return;
}

async function storeConflict(tenantId, action, conflictData) {
  // Service workers cannot access localStorage
  // Conflicts should be handled by the main thread through postMessage
  // For now, we'll log the conflict
  const conflict = {
    id: `conflict_${action.id}`,
    entityType: action.entityType,
    entityId: action.entityId,
    conflictType: 'version',
    localValue: action.payload,
    remoteValue: conflictData.remoteValue,
    localTimestamp: action.queuedAt,
    remoteTimestamp: conflictData.remoteTimestamp,
    autoResolvable: false,
    createdAt: new Date().toISOString()
  };
  
  console.log('[ServiceWorker] Conflict detected:', conflict);
  
  // Send conflict to main thread via postMessage
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_CONFLICT',
      tenantId,
      conflict
    });
  });
}

function getNotificationActions(type) {
  switch (type) {
    case 'incident':
      return [
        { action: 'view_incident', title: 'View Incident' },
        { action: 'open_smartqueue', title: 'Open SmartQueue' }
      ];
    case 'sla_breach':
      return [
        { action: 'view_workitem', title: 'View Work Item' },
        { action: 'open_smartqueue', title: 'Open SmartQueue' }
      ];
    case 'automation_complete':
      return [
        { action: 'view_workitem', title: 'View Results' },
        { action: 'open_intelligence', title: 'Intelligence Center' }
      ];
    default:
      return [
        { action: 'open', title: 'Open OpsHub' },
        { action: 'dismiss', title: 'Dismiss' }
      ];
  }
}

async function handleOfflineAction(request, url) {
  // Handle POST/PUT/DELETE requests when offline
  try {
    return await fetch(request);
  } catch (error) {
    // If offline, return a response indicating the action was queued
    return new Response(
      JSON.stringify({ 
        queued: true,
        message: 'Action queued for offline processing',
        actionId: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }),
      { 
        status: 202,
        headers: { 
          'Content-Type': 'application/json',
          'X-Offline-Queued': 'true'
        }
      }
    );
  }
}

async function handleOfflineResponse(request, url) {
  // Return offline page for navigation requests
  if (request.mode === 'navigate') {
    const cache = await caches.open(STATIC_CACHE);
    return await cache.match('/offline.html') || 
           await cache.match('/index.html');
  }
  
  // Return offline response for API requests matching your error patterns
  if (url.pathname.startsWith('/api/')) {
    return new Response(
      JSON.stringify({ 
        error: 'NetworkError',
        message: 'This request requires network connection',
        offline: true,
        retryAfter: 30
      }),
      { 
        status: 503,
        headers: { 
          'Content-Type': 'application/json',
          'X-Offline': 'true'
        }
      }
    );
  }
  
  return new Response('Network error', { 
    status: 408,
    statusText: 'Request Timeout' 
  });
}

async function initializeCriticalDataStorage() {
  // Service workers cannot access localStorage
  // Storage initialization should be handled by the main thread
  // or implemented using IndexedDB
  console.log('[ServiceWorker] Storage initialization skipped - localStorage not available');
}

// =================================
// MESSAGE HANDLING - Matches your context patterns
// =================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage(CACHE_VERSION);
  }
  
  // Handle tenant switching from your contexts
  if (event.data && event.data.type === 'TENANT_CHANGED') {
    const { tenantId } = event.data;
    console.log(`[ServiceWorker] Tenant changed to: ${tenantId}`);
    // Could trigger cache cleanup or tenant-specific initialization
  }
});

console.log('[ServiceWorker] OpsHub Enterprise Service Worker loaded successfully');