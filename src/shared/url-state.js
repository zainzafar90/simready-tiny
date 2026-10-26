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
