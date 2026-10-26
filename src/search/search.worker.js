import { SearchEngine } from './search-engine.js';
let engine;
self.onmessage = async ({ data }) => {
    try {
        if (data.type === 'init') {
            const response = await fetch('/catalog-manifest.json', { cache: 'no-cache' });
            if (!response.ok)
                throw new Error(`Catalog manifest unavailable (${response.status}).`);
            const manifest = await response.json();
            if (!/^\/data\/catalog\.[a-f0-9]+\.json$/.test(manifest.url))
                throw new Error('Invalid catalog location.');
            const catalogResponse = await fetch(manifest.url);
            if (!catalogResponse.ok)
                throw new Error(`Catalog unavailable (${catalogResponse.status}).`);
            const catalog = await catalogResponse.json();
            if (!Array.isArray(catalog.assets) || catalog.assets.length > 100000)
                throw new Error('Invalid catalog. Run npm run catalog:sync.');
            engine = new SearchEngine(catalog.assets);
            self.postMessage({ type: 'ready', catalog });
        }
        else if (data.type === 'search' && engine)
            self.postMessage({ type: 'results', requestId: data.requestId, ...engine.search(data.state) });
    }
    catch (error) {
        self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    }
};
