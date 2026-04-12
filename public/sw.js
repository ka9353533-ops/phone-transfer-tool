const CACHE_NAME = 'phone-transfer-v1';
const ASSETS = ['/', '/index.html', '/files.html', '/history.html', '/settings.html', '/manifest.json'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ));
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    if (e.request.url.includes('/api/') || e.request.url.includes('/upload') || e.request.url.includes('/socket.io')) {
        return; // never cache API calls
    }
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});

// Push notification support
self.addEventListener('push', e => {
    const data = e.data ? e.data.json() : {};
    self.registration.showNotification(data.title || 'Phone Transfer', {
        body: data.body || 'Transfer complete!',
        icon: '/icon-192.png'
    });
});
