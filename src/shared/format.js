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
