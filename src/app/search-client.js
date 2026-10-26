import { stateUrl } from '../shared/url-state.js';
import { store, selectedCollection, saveState, pushState } from './app-store.js';
import { syncControls, renderResults, errorState } from './page-render.js';

const TYPING_DELAY_MS = 25;
let worker = null, requestId = 0, typingTimer = 0;

export function query() {
    clearTimeout(typingTimer);
    syncControls();
    saveState();
    if (!store.catalog) return;
    const collection = selectedCollection(), { state } = store;
    worker.postMessage({ type: 'search', requestId: ++requestId, state: {
        ...state,
        saved: state.saved || !!collection,
        savedIds: collection ? collection.ids : [...store.saved],
    } });
}

export function queueQuery() {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(query, TYPING_DELAY_MS);
}

export function change(patch, push = true) {
    const before = stateUrl(store.state);
    store.state = { ...store.state, ...patch };
    if (push && before !== stateUrl(store.state)) pushState();
    query();
}

function onWorkerMessage(data, onReady) {
    if (data.type === 'ready') onReady(data.catalog);
    else if (data.type === 'results' && data.requestId === requestId) renderResults(data);
    else if (data.type === 'error') errorState(data.message);
}

export function startSearch(onReady) {
    try {
        worker = new Worker(new URL('../search/search.worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = ({ data }) => onWorkerMessage(data, onReady);
        worker.onerror = event => {
            console.error('Search worker failed', event.message || event);
            errorState('Search could not start. Check the browser console or reload.');
        };
        worker.postMessage({ type: 'init' });
    } catch (error) {
        console.error('Search worker could not start', error);
        errorState(error.message);
    }
}
