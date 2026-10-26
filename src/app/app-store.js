import { readStorage } from '../shared/storage.js';
import { parseState, stateUrl } from '../shared/url-state.js';
import { normalizeCollections } from '../library/collections.js';

export const readState = () => parseState(location.href);

function readSaved() {
    const ids = readStorage('atlas.saved', []);
    return new Set(Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : []);
}

/** Single source of truth for page state. */
export const store = {
    state: readState(),
    catalog: null,
    assets: new Map(),
    config: { viewerUrl: '/vendor/usd/' },
    view: readStorage('atlas.view', 'grid') === 'list' ? 'list' : 'grid',
    collections: normalizeCollections(readStorage('atlas.collections', [])),
    saved: readSaved(),
    resultIds: [],
};

export function reloadSaved() {
    store.saved = readSaved();
}

export function reloadCollections() {
    store.collections = normalizeCollections(readStorage('atlas.collections', []));
    if (store.state.collection && !selectedCollection()) store.state.collection = '';
}

export const selectedCollection = () => store.collections.find(c => c.id === store.state.collection);

export const presentSaved = () => [...store.saved].filter(id => store.assets.has(id));

export function saveState() {
    history.replaceState(history.state, '', stateUrl(store.state, location.pathname));
}

export function pushState(detail = false) {
    history.pushState({ atlasDetail: detail }, '', stateUrl(store.state, location.pathname));
}
