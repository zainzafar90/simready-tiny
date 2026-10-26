import { icon } from './shared/icons.js';
import { readStorage } from './shared/storage.js';
import { $, toast } from './app/app-dom.js';
import { store, selectedCollection } from './app/app-store.js';
import { syncControls, renderCategories } from './app/page-render.js';
import { query, startSearch } from './app/search-client.js';
import { showDetail } from './app/detail-controller.js';
import { loadSiteConfig } from './app/site-config.js';
import { bindAppEvents } from './app/app-events.js';
import { bindSidebar } from './app/sidebar.js';

function onCatalogReady(catalog) {
    store.catalog = catalog;
    store.assets = new Map(catalog.assets.map(a => [a.id, a]));
    if (store.state.collection && !selectedCollection()) {
        store.state.collection = '';
        toast('That collection belongs to another browser. Showing all objects.');
    }
    renderCategories(catalog);
    query();
    if (store.state.asset) showDetail(store.state.asset, 'replace');
}

function registerModelCache() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(error => console.warn('Model cache unavailable', error.message)), { once: true });
}

document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
/* light by default; saved choice wins */
document.documentElement.dataset.theme = readStorage('atlas.theme', 'light') === 'dark' ? 'dark' : 'light';
history.replaceState({ atlasIndex: 0 }, '', location.href);
bindSidebar();
bindAppEvents();
loadSiteConfig();
syncControls();
startSearch(onCatalogReady);
registerModelCache();
