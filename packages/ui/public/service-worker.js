/**
 * OXY ENGINE - SERVICE WORKER
 * ============================
 * Progressive Web App (PWA) offline support
 * 
 * Features:
 * - Cache static assets for offline access
 * - Network-first strategy for API calls
 * - Cache-first strategy for static resources
 * - Background sync for failed requests
 * 
 */

const CACHE_NAME = 'oxy-engine-v1'
const RUNTIME_CACHE = 'oxy-runtime-v1'

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/settings',
  '/onboarding',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-180.png',
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...')
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => {
        console.log('[Service Worker] Installation complete')
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error('[Service Worker] Installation failed:', error)
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...')
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => {
      console.log('[Service Worker] Activation complete')
      return self.clients.claim()
    })
  )
})

// Fetch event - handle network requests
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return
  }
  
  // API requests - network first, fallback to cache
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/v1')) {
    event.respondWith(networkFirst(request))
    return
  }
  
  // Static assets - cache first, fallback to network
  if (request.destination === 'image' || 
      request.destination === 'font' || 
      request.destination === 'script' || 
      request.destination === 'style') {
    event.respondWith(cacheFirst(request))
    return
  }
  
  // HTML pages - network first, fallback to cache
  event.respondWith(networkFirst(request))
})

/**
 * Network-first strategy
 * Try network, fallback to cache, then show offline page
 */
async function networkFirst(request) {
  try {
    // Try network request
    const networkResponse = await fetch(request)
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.log('[Service Worker] Network failed, trying cache:', error)
    
    // Try cache
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Return offline page for HTML requests
    if (request.destination === 'document') {
      const offlineCache = await caches.match('/offline')
      if (offlineCache) {
        return offlineCache
      }
    }
    
    // No cache available, return error
    return new Response('Offline - No cached version available', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain'
      })
    })
  }
}

/**
 * Cache-first strategy
 * Try cache, fallback to network
 */
async function cacheFirst(request) {
  // Try cache first
  const cachedResponse = await caches.match(request)
  if (cachedResponse) {
    return cachedResponse
  }
  
  // Fetch from network
  try {
    const networkResponse = await fetch(request)
    
    // Cache for next time
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.error('[Service Worker] Fetch failed:', error)
    return new Response('Resource not available offline', {
      status: 503,
      statusText: 'Service Unavailable'
    })
  }
}

// Background sync for failed API requests
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync triggered:', event.tag)
  
  if (event.tag === 'sync-api-requests') {
    event.waitUntil(syncAPIRequests())
  }
})

async function syncAPIRequests() {
  // Implement background sync logic for failed API requests
  console.log('[Service Worker] Syncing failed API requests...')
  // This would retry failed requests stored in IndexedDB
}

// Push notifications (future feature)
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received')
  
  const options = {
    body: event.data ? event.data.text() : 'New notification from Oxy Engine',
    icon: '/icon-192.png',
    badge: '/icon-180.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Dashboard'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  }
  
  event.waitUntil(
    self.registration.showNotification('Oxy Engine', options)
  )
})

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event.action)
  
  event.notification.close()
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/dashboard')
    )
  }
})

console.log('[Service Worker] Loaded successfully')

