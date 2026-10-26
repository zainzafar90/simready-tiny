import { readStorage, writeStorage } from '../shared/storage.js';
import { stateUrl } from '../shared/url-state.js';
import { $, toast, keepToast } from './app-dom.js';
import { store, saveState, pushState } from './app-store.js';
import { change } from './search-client.js';
import { toggleSaved } from './library-actions.js';
import { collectionPicker } from './collection-dialogs.js';

const WIDE = '(min-width:1024px)';
let cleanupDetail = null, detailGeneration = 0, detailIds = [], returnFocus = null;

const detailsOpenByDefault = () => matchMedia(WIDE).matches && readStorage('atlas.details', true) !== false;

export function hideDetail() {
    detailGeneration++;
    keepToast();
    cleanupDetail?.();
    cleanupDetail = null;
    if ($('#asset-dialog').open) $('#asset-dialog').close();
}

export function closeDetail() {
    hideDetail();
    const fromPreview = history.state?.atlasDetail;
    store.state.asset = '';
    if (fromPreview) history.back(); else saveState();
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    else $('#results-scroll').focus({ preventScroll: true });
}

function searchTag(tag) {
    hideDetail();
    store.state.asset = '';
    history.replaceState({ ...history.state, atlasDetail: false }, '', stateUrl(store.state, location.pathname));
    change({ query: tag, category: '', saved: false, collection: '' });
    $('#search').focus();
}

function detailOptions(asset, infoOpen) {
    return {
        saved: store.saved.has(asset.id), revision: store.catalog.revision, config: store.config, infoOpen,
        onSave: toggleSaved, onClose: closeDetail, toast, onTag: searchTag,
        onInfoToggle: open => { if (matchMedia(WIDE).matches) writeStorage('atlas.details', open); },
        onCollection: () => collectionPicker(asset),
        onNavigate: nextId => showDetail(nextId, 'replace'),
        context: { ids: detailIds, index: detailIds.indexOf(asset.id), assets: store.assets },
    };
}

function rememberOrigin(id) {
    returnFocus = document.activeElement;
    detailIds = store.resultIds.includes(id) ? [...store.resultIds] : store.catalog.assets.map(a => a.id);
}

export async function showDetail(id, mode = 'push') {
    const asset = store.assets.get(id);
    if (!asset) { toast('This object is not in the current catalog.'); store.state.asset = ''; saveState(); return; }
    const wasOpen = $('#asset-dialog').open;
    if (!wasOpen) rememberOrigin(id);
    const generation = ++detailGeneration;
    const focusedAction = wasOpen ? document.activeElement?.closest('[data-detail]')?.dataset.detail : '';
    const infoOpen = wasOpen ? !$('#asset-info')?.hidden : detailsOpenByDefault();
    keepToast();
    cleanupDetail?.({ keepOpen: true });
    cleanupDetail = null;
    store.state.asset = id;
    if (mode === 'push') pushState(true); else saveState();
    try {
        const { openDetail } = await import('../preview/preview-dialog.js');
        if (generation !== detailGeneration) return;
        cleanupDetail = openDetail($('#asset-dialog'), asset, detailOptions(asset, infoOpen));
        if (focusedAction) $('#asset-dialog').querySelector(`[data-detail="${focusedAction}"]:not(:disabled)`)?.focus({ preventScroll: true });
    } catch (error) {
        console.error('Preview failed to open', id, error);
        hideDetail();
        toast('Could not open preview: ' + error.message);
        store.state.asset = '';
        saveState();
    }
}
