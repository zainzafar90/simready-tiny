import { setTimeout as sleep } from 'node:timers/promises';
export async function fetchWithRetry(url, options = {}, dependencies = {}) {
    const fetcher = dependencies.fetcher || fetch, wait = dependencies.wait || sleep;
    const attempts = dependencies.attempts ?? 5;
    let last;
    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            const response = await fetcher(url, { ...options, signal: options.signal || AbortSignal.timeout(45000) });
            if (response.ok)
                return response;
            if (response.status !== 429 && response.status < 500)
                throw Object.assign(new Error(`HTTP ${response.status}: ${new URL(url).pathname}`), { permanent: true });
            last = new Error(`HTTP ${response.status}: upstream temporarily unavailable`);
            const retry = response.headers.get('retry-after');
            const seconds = retry ? (Number.isFinite(Number(retry)) ? Number(retry) : Math.max(0, (Date.parse(retry) - Date.now()) / 1000)) : 0;
            if (attempt < attempts - 1)
                await wait(Math.min(120000, Math.max(seconds * 1000, 500 * 2 ** attempt)));
        }
        catch (error) {
            if (error.permanent || options.signal?.aborted)
                throw error;
            last = error;
            if (attempt < attempts - 1)
                await wait(500 * 2 ** attempt);
        }
    }
    throw new Error(`Request failed after ${attempts} attempts: ${last?.message}`, { cause: last });
}
export function nextLink(header, base) {
    if (!header)
        return null;
    for (const part of header.split(/,(?=\s*<)/)) {
        const m = part.match(/<([^>]+)>\s*;.*rel="?next"?/);
        if (m) {
            const next = new URL(m[1], base);
            if (next.origin !== new URL(base).origin)
                throw new Error('Refusing cross-origin pagination URL');
            return next.href;
        }
    }
    return null;
}
