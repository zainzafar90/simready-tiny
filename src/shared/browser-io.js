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
