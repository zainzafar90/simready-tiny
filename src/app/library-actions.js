import { writeStorage } from '../shared/storage.js';
import { downloadJSON } from '../shared/browser-io.js';
import { validatedSaved } from '../library/saved-import.js';
import { mergeCollections } from '../library/collections.js';
import { $, toast } from './app-dom.js';
import { store, presentSaved } from './app-store.js';
import { grid, renderCollections } from './page-render.js';
import { query } from './search-client.js';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const STORAGE_WARNING = 'Storage is unavailable. Export a backup before leaving.';

export function persistCollections() {
    if (!writeStorage('atlas.collections', store.collections)) toast(STORAGE_WARNING);
    renderCollections();
}

export function toggleSaved(id) {
    const { saved, assets } = store;
    if (!assets.has(id)) return false;
    if (saved.has(id)) saved.delete(id); else saved.add(id);
    if (!writeStorage('atlas.saved', [...saved])) toast(STORAGE_WARNING);
    $('#saved-count').textContent = String(presentSaved().length);
    grid.updateSaved(saved);
    if (store.state.saved) query();
    return saved.has(id);
}

export function exportLibrary() {
    downloadJSON('atlas-library.json', { version: 2, dataset: 'nvidia/simready-assets', exportedAt: new Date().toISOString(), ids: [...store.saved], collections: store.collections });
    toast('Saved objects and collections exported');
}

export async function importLibrary(file) {
    try {
        if (file.size > MAX_IMPORT_BYTES) throw new Error('Collection file exceeds 5 MB.');
        const data = JSON.parse(await file.text());
        if (data.dataset && data.dataset !== 'nvidia/simready-assets') throw new Error('This export is for a different dataset.');
        const ids = validatedSaved(data, store.assets);
        for (const id of ids) store.saved.add(id);
        store.collections = mergeCollections(store.collections, data.collections);
        if (!writeStorage('atlas.saved', [...store.saved]) || !writeStorage('atlas.collections', store.collections)) throw new Error('Browser storage is unavailable.');
        query();
        toast(`Imported ${ids.length} matching saved objects and merged collections`);
    } catch (error) {
        console.warn('Library import failed', file.name, error);
        toast('Import failed: ' + error.message);
    }
}
