/** Small, framework-independent browser helpers. */
export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function safeUrl(value, allowRelative = false) {
    if (typeof value !== 'string')
        return '';
    if (allowRelative && /^\/(?!\/)/.test(value) && !value.includes('\\'))
        return value;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' ? url.href : '';
    }
    catch {
        return '';
    }
}
export function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0)
        return 'Not indexed';
    if (bytes < 1024)
        return `${bytes} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let n = bytes / 1024, i = 0;
    while (n >= 1024 && i < units.length - 1) {
        n /= 1024;
        i++;
    }
    return `${n < 10 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}
export function readStorage(key, fallback) {
    try {
        const v = JSON.parse(localStorage.getItem(key) ?? 'null');
        return v ?? fallback;
    }
    catch {
        return fallback;
    }
}
export function writeStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    }
    catch {
        return false;
    }
}
export function parseState(input) {
    const params = new URL(input, 'http://localhost').searchParams;
    return {
        query: (params.get('q') || '').slice(0, 200),
        category: (params.get('category') || '').slice(0, 100),
        format: ['usd', 'usda', 'usdc', 'usdz'].includes(params.get('format')) ? params.get('format') : '',
        saved: params.get('saved') === '1',
        sort: ['name', 'size', 'relevance'].includes(params.get('sort')) ? params.get('sort') : 'relevance',
        preview: params.get('preview') === '1',
        asset: (params.get('asset') || '').slice(0, 1500),
        collection: (params.get('collection') || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80),
    };
}
export function stateUrl(state, path = '/') {
    const p = new URLSearchParams();
    if (state.query)
        p.set('q', state.query);
    if (state.category)
        p.set('category', state.category);
    if (state.format)
        p.set('format', state.format);
    if (state.saved)
        p.set('saved', '1');
    if (state.sort && state.sort !== 'relevance')
        p.set('sort', state.sort);
    if (state.preview)
        p.set('preview', '1');
    if (state.asset)
        p.set('asset', state.asset);
    if (state.collection)
        p.set('collection', state.collection);
    return path + (p.size ? '?' + p : '');
}
export function validatedSaved(data, validIds) {
    const ids = Array.isArray(data) ? data : data?.ids;
    if (!Array.isArray(ids) || ids.length > 100000)
        throw new Error('Expected a saved-assets export with an ids array.');
    return [...new Set(ids.filter(id => typeof id === 'string' && validIds.has(id)))];
}
export function downloadJSON(filename, data) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function copyText(text) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }
    const el = document.createElement('textarea');
    el.value = text;
    document.body.append(el);
    el.select();
    const ok = document.execCommand('copy');
    el.remove();
    if (!ok)
        throw new Error('Clipboard unavailable. Select and copy the text instead.');
}
