import { escapeHtml as e } from '../shared/html.js';
import { icon, categoryIcon } from '../shared/icons.js';
import { VirtualGrid } from '../gallery/virtual-grid.js';
import { $ } from './app-dom.js';
import { store, selectedCollection, presentSaved } from './app-store.js';

export const grid = new VirtualGrid($('#asset-grid'), $('#results-scroll'));
let pageDescription = '';

export function renderCollections() {
    const { collections, state, assets } = store;
    $('#collections').innerHTML = collections.map(c => `<button class="nav-item ${c.id === state.collection ? 'active' : ''}" data-collection="${e(c.id)}" aria-current="${c.id === state.collection}"><span>${icon('folder', 16)}</span><span>${e(c.name)}</span><span class="count">${c.ids.filter(id => assets.has(id)).length}</span></button>`).join('');
}

export function renderCategories(catalog) {
    const categories = [...new Set(catalog.assets.map(a => a.category))].sort();
    $('#categories').innerHTML = categories.map(c => `<button class="nav-item" data-category="${e(c)}" title="${e(c)}"><span>${icon(categoryIcon(c), 15)}</span><span>${e(c)}</span><span class="count">0</span></button>`).join('');
    $('#all-count').textContent = catalog.assets.length.toLocaleString();
}

function syncHeading(collection) {
    const { state } = store;
    $('#page-title').textContent = collection?.name || (state.saved ? 'Saved objects' : state.category || '3D Objects');
    pageDescription ||= $('#page-description').innerHTML;
    $('#page-description').innerHTML = state.saved ? '<span>Objects you’ve saved on this device.</span>' : pageDescription;
    $('#page-description').hidden = !!collection || !!state.category;
    $('#collection-manage').hidden = !collection;
    $('#clear-category').hidden = !state.category || !!collection;
}

function syncToggles(selector, isActive, attribute) {
    document.querySelectorAll(selector).forEach(el => {
        const active = isActive(el);
        el.classList.toggle('active', active);
        el.setAttribute(attribute, String(active));
    });
}

function syncTheme() {
    const dark = document.documentElement.dataset.theme === 'dark';
    $('#theme-button').innerHTML = icon(dark ? 'sun' : 'moon');
    $('#theme-button').setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
    $('meta[name="theme-color"]').content = dark ? '#171719' : '#ffffff';
}

export function syncControls() {
    const { state } = store;
    if ($('#search').value !== state.query) $('#search').value = state.query;
    $('#sort').value = state.sort;
    $('.search-clear').hidden = !state.query;
    $('#saved-count').textContent = String(presentSaved().length);
    $('#all-assets').classList.toggle('active', !state.saved && !state.collection && !state.category);
    $('#saved-assets').classList.toggle('active', state.saved && !state.collection);
    syncHeading(selectedCollection());
    syncToggles('[data-category]', el => state.category === el.dataset.category, 'aria-current');
    syncToggles('[data-view]', el => el.dataset.view === store.view, 'aria-pressed');
    syncTheme();
    renderCollections();
}

function emptyCopy() {
    const { state } = store, collection = selectedCollection();
    const pristine = !state.query && !state.category;
    if (collection && pristine) return { iconName: 'folder', title: 'A little room for inspiration.', message: 'Open an object and use Add to collection to keep it here.' };
    if (state.saved && !presentSaved().length) return { iconName: 'heart', title: 'Your good finds live here.', message: 'Tap the heart on any object. Your saved objects stay in this browser.' };
    return { iconName: 'search', title: 'No objects found.', message: 'Try another word or clear a filter. Names, categories, and tags are all searchable.' };
}

export function renderResults(result) {
    store.resultIds = result.ids;
    $('#result-count').textContent = `${result.ids.length.toLocaleString()} ${result.ids.length === 1 ? 'asset' : 'assets'}`;
    $('#asset-total').textContent = result.ids.length.toLocaleString();
    document.querySelectorAll('[data-category]').forEach(el => { el.querySelector('.count').textContent = (result.facets[el.dataset.category] || 0).toLocaleString(); });
    grid.set(result.ids.map(id => store.assets.get(id)), store.saved, store.view);
    $('#empty-state').hidden = !!result.ids.length;
    if (result.ids.length) return;
    const { iconName, title, message } = emptyCopy();
    $('#empty-state').innerHTML = `${icon(iconName, 32)}<h2>${title}</h2><p>${message}</p><button class="button" data-action="reset">Browse all objects ${icon('arrow', 14)}</button>`;
}

export function errorState(message) {
    $('#asset-grid').setAttribute('aria-busy', 'false');
    $('#result-count').textContent = 'Unavailable';
    $('#empty-state').hidden = false;
    $('#empty-state').innerHTML = `${icon('info', 32)}<h2>Could not load the library.</h2><p>${e(message)}</p><button class="button" data-action="retry">Try again</button>`;
}
