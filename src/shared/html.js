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
