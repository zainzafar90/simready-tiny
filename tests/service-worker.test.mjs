import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const SOURCE = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const REV = 'a'.repeat(40);
const MIRROR = `https://models.example.com/${REV}/mug/simready_usd/m.usd`;

function fakeResponse(headers = {}, { ok = true, type = 'cors' } = {}) {
    return { ok, type, headers: new Headers(headers), clone() { return this; } };
}

/** Loads sw.js with an in-memory Cache Storage. */
function loadWorker(network) {
    const listeners = {}, store = new Map(), fetched = [];
    const cache = { match: async url => store.get(url), put: async (url, response) => { store.set(url, response); }, keys: async () => [...store.keys()], delete: async url => store.delete(url) };
    const self = { addEventListener: (type, handler) => { listeners[type] = handler; }, skipWaiting() {}, clients: { claim: async () => {} } };
    const fetch = async request => { fetched.push(request.url); return network(request.url); };
    runInNewContext(SOURCE, { self, caches: { open: async () => cache, keys: async () => [], delete: async () => {} }, fetch, navigator: {}, console, Promise });
    async function request(url, headers = {}) {
        let reply = null;
        const waits = [];
        listeners.fetch({ request: { url, method: 'GET', headers: new Headers(headers) }, respondWith: value => { reply = value; }, waitUntil: value => waits.push(value) });
        const response = reply && await reply;
        await Promise.all(waits);
        return response;
    }
    return { request, store, fetched };
}

test('commit-pinned models are cached once and then served offline', async () => {
    const sw = loadWorker(() => fakeResponse({ 'content-length': '10' }));
    await sw.request(MIRROR);
    await sw.request(MIRROR);
    assert.deepEqual(sw.fetched, [MIRROR]);
    assert.ok(sw.store.has(MIRROR));
});

test('unpinned URLs and range requests bypass the worker', async () => {
    const sw = loadWorker(() => fakeResponse({ 'content-length': '10' }));
    assert.equal(await sw.request('https://huggingface.co/datasets/nvidia/simready-assets/resolve/main/m.usd'), null);
    assert.equal(await sw.request(MIRROR, { range: 'bytes=0-9' }), null);
    assert.equal(sw.store.size, 0);
});

test('responses without a length, over 512 MB, opaque or failed are not cached', async () => {
    for (const response of [fakeResponse(), fakeResponse({ 'content-length': String(513 * 1024 ** 2) }), fakeResponse({ 'content-length': '10' }, { type: 'opaque' }), fakeResponse({ 'content-length': '10' }, { ok: false })]) {
        const sw = loadWorker(() => response);
        await sw.request(MIRROR);
        assert.equal(sw.store.size, 0);
    }
});
