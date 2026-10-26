const CACHE = 'atlas-hf-v1';
const MAX_ENTRIES = 3000;
const MAX_BYTES = 2 * 1024 ** 3;
/* revision-pinned URLs never change */
const PINNED = /^https:\/\/(huggingface\.co\/datasets\/nvidia\/simready-assets\/resolve|simready-models\.zainzafar\.net)\/[0-9a-f]{40}\//;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
})()));

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET' || request.headers.has('range') || !PINNED.test(request.url)) return;
    event.respondWith(cacheFirst(request, event));
});

async function cacheFirst(request, event) {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request.url);
    if (hit) return hit;
    const response = await fetch(request);
    if (response.ok && response.type === 'cors') event.waitUntil(store(cache, request.url, response.clone()));
    return response;
}

async function store(cache, url, response) {
    try {
        await cache.put(url, response);
        await trim(cache);
    } catch (error) {
        console.warn('Atlas cache write skipped', url, error?.name);
    }
}

async function overBudget() {
    const { usage = 0, quota = Infinity } = await navigator.storage?.estimate?.() ?? {};
    return usage > Math.min(MAX_BYTES, quota * 0.5);
}

async function trim(cache) {
    const keys = await cache.keys();
    let drop = Math.max(0, keys.length - MAX_ENTRIES);
    for (const key of keys.slice(0, drop)) await cache.delete(key);
    while (drop < keys.length - 1 && await overBudget()) {
        for (const key of keys.slice(drop, drop + 20)) await cache.delete(key);
        drop += 20;
    }
}
