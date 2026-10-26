const MB = 1024 * 1024;
export const AUTO_LOAD_LIMIT_BYTES = 250 * MB;
/* sizes near the limit still auto-load */
const LIMIT_LEEWAY = 1.1;

/** Auto-load ceiling from network hints. */
export function autoLoadLimitBytes({ connection = null, compact = false } = {}) {
    if (connection?.saveData) return 0;
    const type = connection?.effectiveType;
    const byType = { 'slow-2g': 5 * MB, '2g': 5 * MB, '3g': 25 * MB }[type] ?? AUTO_LOAD_LIMIT_BYTES;
    const byDevice = compact ? 100 * MB : AUTO_LOAD_LIMIT_BYTES;
    /* raw downlink misreads fast links */
    const verySlow = type !== '4g' && Number(connection?.downlink) > 0 && connection.downlink < 1;
    return Math.min(byType, byDevice, verySlow ? 10 * MB : AUTO_LOAD_LIMIT_BYTES);
}

export function currentNetwork() {
    return { connection: globalThis.navigator?.connection || null, compact: globalThis.matchMedia?.('(max-width:600px)').matches ?? false };
}

/** Bytes the 3D preview actually downloads. */
export function previewBytes(asset) {
    return asset.previewSizeBytes ?? asset.packageSizeBytes;
}

export function shouldAutoLoad(asset, network = currentNetwork()) {
    const size = previewBytes(asset);
    const limit = autoLoadLimitBytes(network);
    return limit > 0 && (!Number.isFinite(size) || size <= limit * LIMIT_LEEWAY);
}

/** Tag for click-to-load models, else null. */
export function loadTag(asset, network = currentNetwork(), formatBytes = String) {
    const limit = autoLoadLimitBytes(network);
    if (limit === 0 || shouldAutoLoad(asset, network)) return null;
    return { label: 'Large', title: `On your connection, models over ${formatBytes(limit).replace(' ', '\u00a0')} load in 3D only when you choose Load 3D.` };
}
