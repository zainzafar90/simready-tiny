import { icon, categoryIcon } from './icons.js';
import { escapeHtml as e, readStorage, writeStorage, parseState, stateUrl, validatedSaved, downloadJSON } from './utils.js';
import { normalizeCollections, createCollection, collectionName, mergeCollections } from './collections.js';
import { VirtualGrid } from './virtual-grid.js';

const $ = selector => document.querySelector(selector);
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
// Light is the default; an explicit preference from an earlier visit is respected.
document.documentElement.dataset.theme = readStorage('atlas.theme', 'light') === 'dark' ? 'dark' : 'light';
const readState = () => ({ ...parseState(location.href), format: '' });
let state = readState();
let catalog, worker, requestId = 0, cleanupDetail = null, detailGeneration = 0;
let pageDescription = '';
let toastTimer, searchTimer, resultIds = [], detailIds = [], returnFocus = null;
let assets = new Map(), config = { viewerUrl: '/vendor/usd/index.html' };
let view = readStorage('atlas.view', 'grid') === 'list' ? 'list' : 'grid';
let collections = normalizeCollections(readStorage('atlas.collections', []));
const rawSaved = readStorage('atlas.saved', []);
let saved = new Set(Array.isArray(rawSaved) ? rawSaved.filter(id => typeof id === 'string') : []);
const grid = new VirtualGrid($('#asset-grid'), $('#results-scroll'));
history.replaceState({ atlasIndex: 0 }, '', location.href);
const selectedCollection = () => collections.find(c => c.id === state.collection);
const presentSaved = () => [...saved].filter(id => assets.has(id));
const modalOpen = () => [...document.querySelectorAll('dialog')].some(dialog => dialog.open);

function toast(message) {
    const el = $('#toast');
    // A native dialog lives in the top layer, above normal fixed elements.
    (document.querySelector('#collection-dialog[open], #asset-dialog[open]') || document.body).append(el);
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; document.body.append(el); }, 3500);
}
function keepToast() { document.body.append($('#toast')); }
function saveState() { history.replaceState(history.state, '', stateUrl(state, location.pathname)); }
function pushState(detail = false) {
    const index = (history.state?.atlasIndex || 0) + 1;
    history.pushState({ atlasIndex: index, atlasDetail: detail }, '', stateUrl(state, location.pathname));
}
function renderCollections() {
    $('#collections').innerHTML = collections.map(c => `<button class="nav-item ${c.id === state.collection ? 'active' : ''}" data-collection="${e(c.id)}" aria-current="${c.id === state.collection}"><span>${icon('folder', 16)}</span><span>${e(c.name)}</span><span class="count">${c.ids.filter(id => assets.has(id)).length}</span></button>`).join('');
}
function syncControls() {
    if ($('#search').value !== state.query) $('#search').value = state.query;
    $('#sort').value = state.sort;
    $('.search-clear').hidden = !state.query;
    $('#saved-count').textContent = String(presentSaved().length);
    const collection = selectedCollection();
    const all = !state.saved && !state.collection;
    $('#all-assets').classList.toggle('active', all && !state.category);
    $('#saved-assets').classList.toggle('active', state.saved && !state.collection);
    $('#page-title').textContent = collection?.name || (state.saved ? 'Saved objects' : state.category || '3D Objects');
    pageDescription ||= $('#page-description').innerHTML;
    $('#page-description').innerHTML = state.saved ? '<span>Objects you’ve saved on this device.</span>' : pageDescription;
    $('#page-description').hidden = !!collection || !!state.category;
    $('#collection-manage').hidden = !collection;
    document.querySelectorAll('[data-category]').forEach(el => {
        const active = state.category === el.dataset.category;
        el.classList.toggle('active', active);
        el.setAttribute('aria-current', String(active));
    });
    document.querySelectorAll('[data-view]').forEach(el => {
        const active = el.dataset.view === view;
        el.classList.toggle('active', active);
        el.setAttribute('aria-pressed', String(active));
    });
    const dark = document.documentElement.dataset.theme === 'dark';
    $('#theme-button').innerHTML = icon(dark ? 'sun' : 'moon');
    $('#theme-button').setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
    $('meta[name="theme-color"]').content = dark ? '#171719' : '#ffffff';
    $('#clear-category').hidden = !state.category || !!collection;
    renderCollections();
}
function query() {
    clearTimeout(searchTimer);
    syncControls();
    saveState();
    if (!catalog) return;
    const collection = selectedCollection();
    worker.postMessage({ type: 'search', requestId: ++requestId, state: {
        ...state,
        saved: state.saved || !!collection,
        savedIds: collection ? collection.ids : [...saved],
    } });
}
function change(patch, push = true) {
    const before = stateUrl(state);
    state = { ...state, ...patch };
    if (push && before !== stateUrl(state)) pushState();
    query();
}
function persistCollections() {
    if (!writeStorage('atlas.collections', collections)) toast('Storage is unavailable. Export a backup before leaving.');
    renderCollections();
}
function toggleSaved(id) {
    if (!assets.has(id)) return false;
    saved.has(id) ? saved.delete(id) : saved.add(id);
    if (!writeStorage('atlas.saved', [...saved])) toast('Storage is unavailable. Export a backup before leaving.');
    $('#saved-count').textContent = String(presentSaved().length);
    grid.updateSaved(saved);
    if (state.saved) query();
    return saved.has(id);
}
function renderResults(result) {
    if (result.requestId !== requestId) return;
    resultIds = result.ids;
    $('#result-count').textContent = `${result.ids.length.toLocaleString()} ${result.ids.length === 1 ? 'asset' : 'assets'}`;
    $('#asset-total').textContent = result.ids.length.toLocaleString();
    document.querySelectorAll('[data-category]').forEach(el => { el.querySelector('.count').textContent = (result.facets[el.dataset.category] || 0).toLocaleString(); });
    grid.set(result.ids.map(id => assets.get(id)), saved, view);
    $('#empty-state').hidden = !!result.ids.length;
    if (!result.ids.length) {
        const collection = selectedCollection();
        const pristine = !state.query && !state.category && !state.format;
        const title = collection && pristine ? 'A little room for inspiration.' : state.saved && !presentSaved().length ? 'Your good finds live here.' : 'No objects found.';
        const message = collection && pristine ? 'Open an object and use Add to collection to keep it here.' : state.saved && !presentSaved().length ? 'Tap the heart on any object. Your saved objects stay in this browser.' : 'Try another word or clear a filter. Names, categories, and tags are all searchable.';
        $('#empty-state').innerHTML = `${icon(collection ? 'folder' : state.saved ? 'heart' : 'search', 32)}<h2>${title}</h2><p>${message}</p><button class="button" data-action="reset">Browse all objects ${icon('arrow', 14)}</button>`;
    }
}

async function showDetail(id, mode = 'push') {
    const asset = assets.get(id);
    if (!asset) { toast('This object is not in the current catalog.'); state.asset = ''; saveState(); return; }
    const wasOpen = $('#asset-dialog').open;
    if (!wasOpen) {
        returnFocus = document.activeElement;
        detailIds = resultIds.includes(id) ? [...resultIds] : catalog.assets.map(a => a.id);
    }
    const generation = ++detailGeneration;
    const focusedAction = wasOpen ? document.activeElement?.closest('[data-detail]')?.dataset.detail : '';
    const infoOpen = wasOpen ? !$('#asset-info')?.hidden : detailsOpenByDefault();
    keepToast();
    cleanupDetail?.({ keepOpen: true });
    cleanupDetail = null;
    state.asset = id;
    if (mode === 'push') pushState(true);
    else saveState();
    try {
        const { openDetail } = await import('./detail.js');
        if (generation !== detailGeneration) return;
        const index = detailIds.indexOf(id);
        cleanupDetail = openDetail($('#asset-dialog'), asset, {
            saved: saved.has(id), revision: catalog.revision, config, infoOpen,
            onSave: toggleSaved, onClose: closeDetail, toast,
            onInfoToggle: open => { if (matchMedia('(min-width:1024px)').matches) writeStorage('atlas.details', open); },
            onCollection: () => collectionPicker(asset),
            onNavigate: nextId => showDetail(nextId, 'replace'),
            context: { ids: detailIds, index, assets },
            onTag: tag => {
                hideDetail(); state.asset = '';
                history.replaceState({ ...history.state, atlasDetail: false }, '', stateUrl(state, location.pathname));
                change({ query: tag, category: '', saved: false, collection: '' });
                $('#search').focus();
            },
        });
        if (focusedAction) $('#asset-dialog').querySelector(`[data-detail="${focusedAction}"]:not(:disabled)`)?.focus({ preventScroll: true });
    } catch (error) {
        hideDetail(); toast('Could not open preview: ' + error.message); state.asset = ''; saveState();
    }
}
function detailsOpenByDefault() {
    return matchMedia('(min-width:1024px)').matches && readStorage('atlas.details', true) !== false;
}
function hideDetail() {
    detailGeneration++;
    keepToast();
    cleanupDetail?.(); cleanupDetail = null;
    if ($('#asset-dialog').open) $('#asset-dialog').close();
}
function closeDetail() {
    hideDetail();
    const fromPreview = history.state?.atlasDetail;
    state.asset = '';
    if (fromPreview) history.back(); else saveState();
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    else $('#results-scroll').focus({ preventScroll: true });
}
function toggleSidebar(force) {
    const open = typeof force === 'boolean' ? force : !$('#sidebar').classList.contains('open');
    $('#sidebar').classList.toggle('open', open);
    $('#sidebar-shade').hidden = !open;
    $('.workspace').inert = open;
    $('.filter-mobile').setAttribute('aria-expanded', String(open));
    if (open) $('#all-assets').focus(); else if (matchMedia('(max-width:800px)').matches) $('.filter-mobile').focus();
}
matchMedia('(min-width:801px)').addEventListener('change', event => { if (event.matches) toggleSidebar(false); });
$('#sidebar').addEventListener('keydown', event => {
    if (event.key !== 'Tab' || !$('#sidebar').classList.contains('open')) return;
    const nodes = [...$('#sidebar').querySelectorAll('button,a')].filter(el => !el.disabled && el.getClientRects().length);
    if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0].focus(); }
});

function collectionShell(title, body) {
    const dialog = $('#collection-dialog');
    keepToast();
    dialog.innerHTML = `<div class="dialog-heading"><strong id="collection-title">${e(title)}</strong><button class="icon-btn" data-action="close-collection" aria-label="Close collection dialog">${icon('close')}</button></div><div class="collection-body">${body}</div>`;
    if (!dialog.open) dialog.showModal();
    return dialog;
}
function closeCollection() { keepToast(); $('#collection-dialog').close(); }
function collectionEditor(existing = null, asset = null) {
    if ($('#sidebar').classList.contains('open')) toggleSidebar(false);
    const dialog = collectionShell(existing ? 'Edit collection' : 'New collection', `<p>${existing ? 'Make this space your own. Objects stay in the source library.' : 'Keep the objects for your next project together.'}</p><form id="collection-form"><label class="field-label" for="collection-name">Name</label><input id="collection-name" class="text-input" name="name" placeholder="e.g. Kitchen scene" value="${e(existing?.name || '')}" required maxlength="60" autocomplete="off"><div class="form-error" role="alert"></div><div class="form-actions">${existing ? `<button class="danger-button" type="button" id="delete-collection">Delete collection</button>` : ''}<button class="button" type="button" data-action="close-collection">Cancel</button><button class="button primary" type="submit">${existing ? 'Save changes' : 'Create collection'}</button></div></form>`);
    $('#collection-name').focus();
    $('#collection-form').onsubmit = event => {
        event.preventDefault();
        try {
            const name = collectionName($('#collection-name').value);
            if (collections.some(c => c.id !== existing?.id && c.name.toLowerCase() === name.toLowerCase())) throw new Error('A collection with this name already exists.');
            let item = existing;
            if (item) item.name = name;
            else { item = createCollection(collections, name, crypto.randomUUID()); collections.push(item); }
            if (asset && !item.ids.includes(asset.id)) item.ids.push(asset.id);
            persistCollections(); closeCollection();
            if (!asset) change({ collection: item.id, saved: false, category: '', query: '', format: '' });
            toast(asset ? `Added to ${name}` : existing ? 'Collection updated' : 'Collection created');
        } catch (error) { dialog.querySelector('.form-error').textContent = error.message; }
    };
    if (existing) $('#delete-collection').onclick = () => {
        collectionShell('Delete collection?', `<p>“${e(existing.name)}” will be removed from this browser. Its objects and your saved items will not be deleted.</p><div class="form-actions"><button class="button" id="cancel-delete">Keep collection</button><button class="button primary" id="confirm-delete">Delete collection</button></div>`);
        $('#cancel-delete').onclick = () => collectionEditor(existing);
        $('#confirm-delete').onclick = () => {
            collections = collections.filter(c => c.id !== existing.id); persistCollections(); closeCollection();
            if (state.collection === existing.id) change({ collection: '', saved: false });
            toast('Collection deleted');
        };
        $('#cancel-delete').focus();
    };
}
function collectionPicker(asset) {
    if (!collections.length) { collectionEditor(null, asset); return; }
    collectionShell('Add to collection', `<p>Keep ${e(asset.name)} in one or more of your collections.</p><form id="collection-picker"><div class="collection-choices">${collections.map(c => `<label class="collection-choice"><input type="checkbox" name="collection" value="${e(c.id)}" ${c.ids.includes(asset.id) ? 'checked' : ''}>${icon('folder', 16)}<span>${e(c.name)}</span><span class="count">${c.ids.length}</span></label>`).join('')}</div><div class="form-actions"><button class="text-action" type="button" id="picker-new">+ New collection</button><button class="button primary" type="submit">Done</button></div></form>`);
    $('#picker-new').onclick = () => collectionEditor(null, asset);
    $('#collection-picker').onsubmit = event => {
        event.preventDefault();
        const selected = new Set(new FormData(event.target).getAll('collection'));
        for (const collection of collections) {
            collection.ids = collection.ids.filter(id => id !== asset.id);
            if (selected.has(collection.id)) collection.ids.push(asset.id);
        }
        persistCollections(); closeCollection(); query(); toast('Collections updated');
    };
}
function exportLibrary() {
    downloadJSON('atlas-library.json', { version: 2, dataset: 'nvidia/simready-assets', exportedAt: new Date().toISOString(), ids: [...saved], collections });
    toast('Saved objects and collections exported');
}
function onReady(data) {
    catalog = data; assets = new Map(catalog.assets.map(a => [a.id, a]));
    if (state.collection && !selectedCollection()) { state.collection = ''; toast('That collection belongs to another browser. Showing all objects.'); }
    const categories = [...new Set(catalog.assets.map(a => a.category))].sort();
    $('#categories').innerHTML = categories.map(c => `<button class="nav-item" data-category="${e(c)}" title="${e(c)}"><span>${icon(categoryIcon(c), 15)}</span><span>${e(c)}</span><span class="count">0</span></button>`).join('');
    $('#all-count').textContent = catalog.assets.length.toLocaleString();
    query();
    if (state.asset) showDetail(state.asset, 'replace');
}
function errorState(message) {
    $('#asset-grid').setAttribute('aria-busy', 'false');
    $('#result-count').textContent = 'Unavailable'; $('#empty-state').hidden = false;
    $('#empty-state').innerHTML = `${icon('info', 32)}<h2>Could not load the library.</h2><p>${e(message)}</p><button class="button" data-action="retry">Try again</button>`;
}
function init() {
    worker?.terminate?.();
    try {
        worker = new Worker(new URL('./search.worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = ({ data }) => {
            if (data.type === 'ready') onReady(data.catalog);
            else if (data.type === 'results') renderResults(data);
            else if (data.type === 'error') errorState(data.message);
        };
        worker.onerror = () => errorState('Search could not start. Check the browser console or reload.');
        worker.postMessage({ type: 'init' });
    } catch (error) { errorState(error.message); }
}

$('#search').addEventListener('input', event => { state.query = event.target.value; clearTimeout(searchTimer); searchTimer = setTimeout(query, 25); });
$('#sort').addEventListener('change', event => change({ sort: event.target.value }));
document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const open = target.closest('[data-open]'), save = target.closest('[data-save]');
    const category = target.closest('[data-category]'), collection = target.closest('[data-collection]'), v = target.closest('[data-view]');
    if (open) { showDetail(open.dataset.open); return; }
    if (save) { toggleSaved(save.dataset.save); return; }
    if (category) {
        change({ category: state.category === category.dataset.category ? '' : category.dataset.category });
        if ($('#sidebar').classList.contains('open')) toggleSidebar(false); return;
    }
    if (collection) {
        change({ collection: collection.dataset.collection, saved: false, category: '', query: '', format: '' });
        if ($('#sidebar').classList.contains('open')) toggleSidebar(false); return;
    }
    if (v) { view = v.dataset.view; writeStorage('atlas.view', view); query(); return; }
    const action = target.closest('[data-action]')?.dataset.action;
    if (['all', 'saved'].includes(action) && $('#sidebar').classList.contains('open')) toggleSidebar(false);
    if (action === 'all') change({ saved: false, collection: '', category: '' });
    if (action === 'saved') change({ saved: true, collection: '', category: '' });
    if (action === 'reset') change({ query: '', category: '', format: '', saved: false, collection: '', sort: 'relevance', preview: false });
    if (action === 'reset-category') change({ category: '' });
    if (action === 'clear-query') { change({ query: '' }, false); $('#search').focus(); }
    if (action === 'toggle-sidebar') toggleSidebar();
    if (action === 'theme') {
        document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        writeStorage('atlas.theme', document.documentElement.dataset.theme); syncControls();
    }
    if (action === 'export') exportLibrary();
    if (action === 'import') $('#import-file').click();
    if (action === 'new-collection') collectionEditor();
    if (action === 'manage-collection') collectionEditor(selectedCollection());
    if (action === 'close-collection') closeCollection();
    if (action === 'retry') location.reload();
});
$('#import-file').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
        if (file.size > 5 * 1024 * 1024) throw new Error('Collection file exceeds 5 MB.');
        const data = JSON.parse(await file.text());
        if (data.dataset && data.dataset !== 'nvidia/simready-assets') throw new Error('This export is for a different dataset.');
        const ids = validatedSaved(data, assets);
        for (const id of ids) saved.add(id);
        collections = mergeCollections(collections, data.collections);
        if (!writeStorage('atlas.saved', [...saved]) || !writeStorage('atlas.collections', collections)) throw new Error('Browser storage is unavailable.');
        query(); toast(`Imported ${ids.length} matching saved objects and merged collections`);
    } catch (error) { toast('Import failed: ' + error.message); }
    event.target.value = '';
});
document.addEventListener('keydown', event => {
    const typing = event.target instanceof HTMLElement && (event.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName));
    if ((event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing)) {
        if (modalOpen()) return;
        event.preventDefault(); if ($('#sidebar').classList.contains('open')) toggleSidebar(false);
        $('#search').focus(); $('#search').select();
    }
    if (event.key === 'Escape' && !modalOpen()) {
        if ($('#sidebar').classList.contains('open')) toggleSidebar(false);
        else if (state.query) change({ query: '' }, false);
    }
});
$('#collection-dialog').addEventListener('close', keepToast);
window.addEventListener('popstate', () => {
    state = readState(); hideDetail();
    if (state.collection && !selectedCollection()) state.collection = '';
    query(); if (catalog && state.asset) showDetail(state.asset, 'replace');
});
window.addEventListener('storage', event => {
    if (event.key === 'atlas.saved') {
        const ids = readStorage('atlas.saved', []); saved = new Set(Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : []);
        query();
        const b = $('#asset-dialog [data-detail="save"]');
        if (b) { const on = saved.has(state.asset); b.setAttribute('aria-pressed', String(on)); b.querySelector('span').textContent = on ? 'Saved' : 'Save asset'; }
    }
    if (event.key === 'atlas.collections') { collections = normalizeCollections(readStorage('atlas.collections', [])); if (state.collection && !selectedCollection()) state.collection = ''; query(); }
});
window.addEventListener('offline', () => toast('You are offline. Loaded search still works; remote files may not.'));
fetch('/config.json').then(r => r.ok ? r.json() : {}).then(c => {
    config = { ...config, ...c };
    if (typeof c.name === 'string' && c.name.trim()) {
        const name = c.name.trim().slice(0, 40); $('#brand-name').textContent = name;
        $('.brand').setAttribute('aria-label', name + ' home'); document.title = document.title.replace(/^[^—]+—/, `${name} —`);
    }
    if (typeof c.subtitle === 'string') $('.brand-sub').textContent = c.subtitle.slice(0, 60);
    if (typeof c.contactEmail === 'string' && /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(c.contactEmail.trim())) {
        const link = $('#removal-link'); link.href = 'mailto:' + encodeURIComponent(c.contactEmail.trim()).replace('%40', '@') + '?subject=SimReady%20Tiny%20removal%20request'; link.hidden = false;
    }
}).catch(() => {});
syncControls(); init();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(error => console.warn('Atlas model cache unavailable', error.message)), { once: true });
