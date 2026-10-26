import { escapeHtml as e } from '../shared/html.js';
import { icon } from '../shared/icons.js';
import { createCollection, collectionName } from '../library/collections.js';
import { $, toast, keepToast } from './app-dom.js';
import { store } from './app-store.js';
import { query, change } from './search-client.js';
import { persistCollections } from './library-actions.js';
import { closeSidebar } from './sidebar.js';

function collectionShell(title, body) {
    const dialog = $('#collection-dialog');
    keepToast();
    dialog.innerHTML = `<div class="dialog-heading"><strong id="collection-title">${e(title)}</strong><button class="icon-btn" data-action="close-collection" aria-label="Close collection dialog">${icon('close')}</button></div><div class="collection-body">${body}</div>`;
    if (!dialog.open) dialog.showModal();
    return dialog;
}

export function closeCollection() {
    keepToast();
    $('#collection-dialog').close();
}

function editorBody(existing) {
    const intro = existing ? 'Make this space your own. Objects stay in the source library.' : 'Keep the objects for your next project together.';
    const remove = existing ? '<button class="danger-button" type="button" id="delete-collection">Delete collection</button>' : '';
    return `<p>${intro}</p><form id="collection-form"><label class="field-label" for="collection-name">Name</label><input id="collection-name" class="text-input" name="name" placeholder="e.g. Kitchen scene" value="${e(existing?.name || '')}" required maxlength="60" autocomplete="off"><div class="form-error" role="alert"></div><div class="form-actions">${remove}<button class="button" type="button" data-action="close-collection">Cancel</button><button class="button primary" type="submit">${existing ? 'Save changes' : 'Create collection'}</button></div></form>`;
}

function saveCollection(existing, asset) {
    const name = collectionName($('#collection-name').value);
    if (store.collections.some(c => c.id !== existing?.id && c.name.toLowerCase() === name.toLowerCase())) throw new Error('A collection with this name already exists.');
    let item = existing;
    if (item) item.name = name;
    else { item = createCollection(store.collections, name, crypto.randomUUID()); store.collections.push(item); }
    if (asset && !item.ids.includes(asset.id)) item.ids.push(asset.id);
    persistCollections();
    closeCollection();
    if (!asset) change({ collection: item.id, saved: false, category: '', query: '' });
    toast(asset ? `Added to ${name}` : existing ? 'Collection updated' : 'Collection created');
}

function confirmDelete(existing) {
    collectionShell('Delete collection?', `<p>“${e(existing.name)}” will be removed from this browser. Its objects and your saved items will not be deleted.</p><div class="form-actions"><button class="button" id="cancel-delete">Keep collection</button><button class="button primary" id="confirm-delete">Delete collection</button></div>`);
    $('#cancel-delete').onclick = () => collectionEditor(existing);
    $('#confirm-delete').onclick = () => {
        store.collections = store.collections.filter(c => c.id !== existing.id);
        persistCollections();
        closeCollection();
        if (store.state.collection === existing.id) change({ collection: '', saved: false });
        toast('Collection deleted');
    };
    $('#cancel-delete').focus();
}

export function collectionEditor(existing = null, asset = null) {
    closeSidebar();
    const dialog = collectionShell(existing ? 'Edit collection' : 'New collection', editorBody(existing));
    $('#collection-name').focus();
    $('#collection-form').onsubmit = event => {
        event.preventDefault();
        try { saveCollection(existing, asset); } catch (error) { dialog.querySelector('.form-error').textContent = error.message; }
    };
    if (existing) $('#delete-collection').onclick = () => confirmDelete(existing);
}

export function collectionPicker(asset) {
    if (!store.collections.length) { collectionEditor(null, asset); return; }
    const choices = store.collections.map(c => `<label class="collection-choice"><input type="checkbox" name="collection" value="${e(c.id)}" ${c.ids.includes(asset.id) ? 'checked' : ''}>${icon('folder', 16)}<span>${e(c.name)}</span><span class="count">${c.ids.length}</span></label>`).join('');
    collectionShell('Add to collection', `<p>Keep ${e(asset.name)} in one or more of your collections.</p><form id="collection-picker"><div class="collection-choices">${choices}</div><div class="form-actions"><button class="text-action" type="button" id="picker-new">+ New collection</button><button class="button primary" type="submit">Done</button></div></form>`);
    $('#picker-new').onclick = () => collectionEditor(null, asset);
    $('#collection-picker').onsubmit = event => {
        event.preventDefault();
        const selected = new Set(new FormData(event.target).getAll('collection'));
        for (const collection of store.collections) {
            collection.ids = collection.ids.filter(id => id !== asset.id);
            if (selected.has(collection.id)) collection.ids.push(asset.id);
        }
        persistCollections();
        closeCollection();
        query();
        toast('Collections updated');
    };
}
