export function validatedSaved(data, validIds) {
    const ids = Array.isArray(data) ? data : data?.ids;
    if (!Array.isArray(ids) || ids.length > 100000)
        throw new Error('Expected a saved-assets export with an ids array.');
    return [...new Set(ids.filter(id => typeof id === 'string' && validIds.has(id)))];
}
