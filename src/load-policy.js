const MB = 1024 * 1024;
export const AUTO_LOAD_LIMIT_BYTES = 250 * MB;
/* sizes near the limit still auto-load */
const LIMIT_LEEWAY = 1.1;

/** Auto-load ceiling from network hints. */
export function autoLoadLimitBytes({ connection = null, compact = false } = {}) {
    if (connection?.saveData) return 0;
    const byType = { 'slow-2g': 5 * MB, '2g': 5 * MB, '3g': 25 * MB }[connection?.effectiveType] ?? AUTO_LOAD_LIMIT_BYTES;
    const byDevice = compact ? 100 * MB : AUTO_LOAD_LIMIT_BYTES;
    const mbps = Number(connection?.downlink);
    const bySpeed = !(mbps > 0) ? AUTO_LOAD_LIMIT_BYTES : mbps < 1 ? 10 * MB : mbps < 2 ? 25 * MB : mbps < 5 ? 100 * MB : AUTO_LOAD_LIMIT_BYTES;
    return Math.min(byType, byDevice, bySpeed);
}

export function currentNetwork() {
    return { connection: globalThis.navigator?.connection || null, compact: globalThis.matchMedia?.('(max-width:600px)').matches ?? false };
}

export function shouldAutoLoad(asset, network = currentNetwork()) {
    const size = asset.packageSizeBytes;
    const limit = autoLoadLimitBytes(network);
    return limit > 0 && (!Number.isFinite(size) || size <= limit * LIMIT_LEEWAY);
}

/** Tag for click-to-load models, else null. */
export function loadTag(asset, network = currentNetwork(), formatBytes = String) {
    const limit = autoLoadLimitBytes(network);
    if (limit === 0 || shouldAutoLoad(asset, network)) return null;
    return { label: 'Large', title: `On your connection, models over ${formatBytes(limit)} load in 3D only when you choose Load 3D.` };
}
