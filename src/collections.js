/** Local collection data, deliberately independent of UI and browser APIs. */
const MAX_COLLECTIONS = 200;
const MAX_IDS = 100000;
export function normalizeCollections(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.slice(0, MAX_COLLECTIONS).flatMap(item => {
        if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || seen.has(item.id)) return [];
        const name = typeof item.name === 'string' ? item.name.trim().slice(0, 60) : '';
        if (!name || !Array.isArray(item.ids)) return [];
        seen.add(item.id);
        return [{ id: item.id, name, ids: [...new Set(item.ids.filter(id => typeof id === 'string' && id.length <= 1500))].slice(0, MAX_IDS) }];
    });
}
export function collectionName(value) {
    const name = String(value || '').trim();
    if (!name || name.length > 60) throw new Error('Use a collection name between 1 and 60 characters.');
    return name;
}
export function createCollection(collections, name, id) {
    if (collections.length >= MAX_COLLECTIONS) throw new Error('You can keep up to 200 collections.');
    const clean = collectionName(name);
    if (collections.some(c => c.name.toLowerCase() === clean.toLowerCase())) throw new Error('A collection with this name already exists.');
    return { id, name: clean, ids: [] };
}
export function mergeCollections(existing, incoming) {
    const result = normalizeCollections(existing);
    for (const item of normalizeCollections(incoming)) {
        const match = result.find(c => c.id === item.id);
        if (match) match.ids = [...new Set([...match.ids, ...item.ids])].slice(0, MAX_IDS);
        else if (result.length < MAX_COLLECTIONS) result.push(item);
    }
    return result;
}
