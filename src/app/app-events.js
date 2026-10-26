import { writeStorage } from '../shared/storage.js';
import { $, toast, keepToast, modalOpen } from './app-dom.js';
import { store, readState, reloadSaved, reloadCollections, selectedCollection } from './app-store.js';
import { syncControls } from './page-render.js';
import { query, queueQuery, change } from './search-client.js';
import { showDetail, hideDetail } from './detail-controller.js';
import { toggleSaved, exportLibrary, importLibrary } from './library-actions.js';
import { collectionEditor, closeCollection } from './collection-dialogs.js';
import { toggleSidebar, closeSidebar, sidebarOpen } from './sidebar.js';

const ACTIONS = {
    all: () => { closeSidebar(); change({ saved: false, collection: '', category: '' }); },
    saved: () => { closeSidebar(); change({ saved: true, collection: '', category: '' }); },
    reset: () => change({ query: '', category: '', saved: false, collection: '', sort: 'relevance' }),
    'reset-category': () => change({ category: '' }),
    'clear-query': () => { change({ query: '' }, false); $('#search').focus(); },
    'toggle-sidebar': () => toggleSidebar(),
    theme: () => {
        document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        writeStorage('atlas.theme', document.documentElement.dataset.theme);
        syncControls();
    },
    export: exportLibrary,
    import: () => $('#import-file').click(),
    'new-collection': () => collectionEditor(),
    'manage-collection': () => collectionEditor(selectedCollection()),
    'close-collection': closeCollection,
    retry: () => location.reload(),
};

function handleSelection(target) {
    const open = target.closest('[data-open]'), save = target.closest('[data-save]');
    const category = target.closest('[data-category]'), collection = target.closest('[data-collection]'), view = target.closest('[data-view]');
    if (open) showDetail(open.dataset.open);
    else if (save) toggleSaved(save.dataset.save);
    else if (category) { change({ category: store.state.category === category.dataset.category ? '' : category.dataset.category }); closeSidebar(); }
    else if (collection) { change({ collection: collection.dataset.collection, saved: false, category: '', query: '' }); closeSidebar(); }
    else if (view) { store.view = view.dataset.view; writeStorage('atlas.view', store.view); query(); }
    else return false;
    return true;
}

function onClick(event) {
    if (!(event.target instanceof Element) || handleSelection(event.target)) return;
    ACTIONS[event.target.closest('[data-action]')?.dataset.action]?.();
}

function onKeydown(event) {
    const typing = event.target instanceof HTMLElement && (event.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName));
    const searchKey = (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing);
    if (searchKey && !modalOpen()) { event.preventDefault(); closeSidebar(); $('#search').focus(); $('#search').select(); }
    if (event.key !== 'Escape' || modalOpen()) return;
    if (sidebarOpen()) toggleSidebar(false);
    else if (store.state.query) change({ query: '' }, false);
}

function onStorage(event) {
    if (event.key === 'atlas.collections') { reloadCollections(); query(); }
    if (event.key !== 'atlas.saved') return;
    reloadSaved();
    query();
    const button = $('#asset-dialog [data-detail="save"]');
    if (!button) return;
    const on = store.saved.has(store.state.asset);
    button.setAttribute('aria-pressed', String(on));
    button.querySelector('span').textContent = on ? 'Saved' : 'Save asset';
}

function onPopState() {
    store.state = readState();
    hideDetail();
    if (store.state.collection && !selectedCollection()) store.state.collection = '';
    query();
    if (store.catalog && store.state.asset) showDetail(store.state.asset, 'replace');
}

export function bindAppEvents() {
    $('#search').addEventListener('input', event => { store.state.query = event.target.value; queueQuery(); });
    $('#sort').addEventListener('change', event => change({ sort: event.target.value }));
    $('#import-file').addEventListener('change', async event => {
        const file = event.target.files[0];
        if (file) await importLibrary(file);
        event.target.value = '';
    });
    $('#collection-dialog').addEventListener('close', keepToast);
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeydown);
    window.addEventListener('popstate', onPopState);
    window.addEventListener('storage', onStorage);
    window.addEventListener('offline', () => toast('You are offline. Loaded search still works; remote files may not.'));
}
