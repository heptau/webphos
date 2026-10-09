// Service Worker for miniPaint - Offline Support
// This file will be copied to dist/ during build

const CACHE_NAME = 'minipaint-v4.14.5-mac';
const STATIC_ASSETS = [
	'./index.html',
	'./manifest.webmanifest',
	'./images/manifest/192x192.png',
	'./images/manifest/512x512.png',
	'./images/manifest/192x192-maskable.png',
	'./images/manifest/512x512-maskable.png',
];

const CACHE_STRATEGIES = {
	// Cache first for static assets
	static: 'cache-first',
	// Network first for API calls
	api: 'network-first',
	// Stale while revalidate for images
	images: 'stale-while-revalidate',
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			console.log('[SW] Caching static assets');
			return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { credentials: 'same-origin' })));
		}).then(() => self.skipWaiting())
	);
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames.map((cacheName) => {
					if (cacheName !== CACHE_NAME) {
						console.log('[SW] Deleting old cache:', cacheName);
						return caches.delete(cacheName);
					}
				})
			);
		}).then(() => self.clients.claim())
	);
});

// Fetch event - handle requests with appropriate strategy
self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);

	// Skip non-GET requests
	if (request.method !== 'GET') {
		return;
	}

	// Skip cross-origin requests (except for allowed domains)
	if (url.origin !== location.origin && !is_allowed_origin(url.origin)) {
		return;
	}

	// Determine cache strategy based on request type
	const strategy = get_strategy(request, url);

	event.respondWith(handle_request(request, strategy));
});

// Check if origin is allowed for caching
function is_allowed_origin(origin) {
	const allowedOrigins = [
		'https://pixabay.com',
		'https://api.pixabay.com',
		'https://www.googleapis.com',
		'https://fonts.gstatic.com',
		'https://fonts.googleapis.com',
	];
	return allowedOrigins.includes(origin);
}

// Determine caching strategy
function get_strategy(request, url) {
	// Static assets (JS, CSS, fonts)
	if (request.destination === 'script' ||
		request.destination === 'style' ||
		request.destination === 'font') {
		return CACHE_STRATEGIES.static;
	}

	// Images
	if (request.destination === 'image') {
		return CACHE_STRATEGIES.images;
	}

	// API calls
	if (url.origin !== location.origin) {
		return CACHE_STRATEGIES.api;
	}

	// HTML documents - network first for fresh content
	if (request.destination === 'document') {
		return CACHE_STRATEGIES.api;
	}

	// Default: network first
	return CACHE_STRATEGIES.api;
}

// Handle request with specified strategy
async function handle_request(request, strategy) {
	const cache = await caches.open(CACHE_NAME);

	switch (strategy) {
		case 'cache-first':
			return cache_first(request, cache);
		case 'network-first':
			return network_first(request, cache);
		case 'stale-while-revalidate':
			return stale_while_revalidate(request, cache);
		default:
			return network_first(request, cache);
	}
}

// Cache first strategy
async function cache_first(request, cache) {
	const cachedResponse = await cache.match(request);
	if (cachedResponse) {
		return cachedResponse;
	}

	try {
		const networkResponse = await fetch(request);
		if (networkResponse.ok) {
			cache.put(request, networkResponse.clone());
		}
		return networkResponse;
	} catch (error) {
		console.error('[SW] Fetch failed:', error);
		// Return offline fallback for navigation requests
		if (request.destination === 'document') {
			return caches.match('/index.html');
		}
		throw error;
	}
}

// Network first strategy
async function network_first(request, cache) {
	try {
		const networkResponse = await fetch(request);
		if (networkResponse.ok) {
			cache.put(request, networkResponse.clone());
		}
		return networkResponse;
	} catch (error) {
		console.log('[SW] Network failed, trying cache:', request.url);
		const cachedResponse = await cache.match(request);
		if (cachedResponse) {
			return cachedResponse;
		}
		// Return offline fallback for navigation requests
		if (request.destination === 'document') {
			return caches.match('/index.html');
		}
		throw error;
	}
}

// Stale while revalidate strategy
async function stale_while_revalidate(request, cache) {
	const cachedResponse = await cache.match(request);

	// Fetch in background
	const fetchPromise = fetch(request).then((networkResponse) => {
		if (networkResponse.ok) {
			cache.put(request, networkResponse.clone());
		}
		return networkResponse;
	}).catch(() => {
		// Ignore network errors, return cached
	});

	// Return cached immediately if available
	if (cachedResponse) {
		// The background update (fetchPromise) keeps running
		return cachedResponse;
	}

	// No cache, wait for network
	return await fetchPromise;
}

// Handle messages from clients
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}

	if (event.data && event.data.type === 'CLEAR_CACHE') {
		event.waitUntil(
			caches.keys().then((cacheNames) => {
				return Promise.all(
					cacheNames.map((cacheName) => caches.delete(cacheName))
				);
			})
		);
	}

	if (event.data && event.data.type === 'GET_CACHE_STATUS') {
		event.waitUntil(
			caches.open(CACHE_NAME).then((cache) => {
				return cache.keys().then((keys) => {
					event.ports[0].postMessage({
						type: 'CACHE_STATUS',
						cachedUrls: keys.map(req => req.url),
						cacheName: CACHE_NAME,
					});
				});
			})
		);
	}
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
	if (event.tag === 'save-image') {
		event.waitUntil(sync_saved_images());
	}
});

async function sync_saved_images() {
	// Implementation for syncing saved images when back online
	console.log('[SW] Syncing saved images...');
}

// Push notifications (if needed in future)
self.addEventListener('push', (event) => {
	if (event.data) {
		const data = event.data.json();
		const options = {
			body: data.body,
			icon: '/images/manifest/192x192.png',
			badge: '/images/manifest/192x192.png',
			data: data.url,
		};
		event.waitUntil(self.registration.showNotification(data.title, options));
	}
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	if (event.notification.data) {
		event.waitUntil(clients.openWindow(event.notification.data));
	}
});
