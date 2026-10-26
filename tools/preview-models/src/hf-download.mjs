import { createWriteStream } from 'node:fs';
import { stat, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const DATASET = 'https://huggingface.co/datasets/nvidia/simready-assets/resolve';
const ATTEMPTS = 6;
const FILE_TIMEOUT_MS = 15 * 60_000;

export function hfUrl(revision, path) {
    return `${DATASET}/${revision}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export function isTransient(status) {
    return status === 408 || status === 429 || status >= 500;
}

function backoffMs(attempt, retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(300_000, seconds * 1000);
    return Math.min(120_000, 1000 * 2 ** attempt);
}

async function attemptDownload(url, target, expectedSize, headers) {
    const response = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(FILE_TIMEOUT_MS) });
    if (!response.ok) return { ok: false, status: response.status, retryAfter: response.headers.get('retry-after') };
    await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
    const size = (await stat(target)).size;
    if (Number.isFinite(expectedSize) && size !== expectedSize) return { ok: false, status: 'size', detail: `${size} != ${expectedSize}` };
    return { ok: true, size };
}

/** Downloads one file; retries transient failures. */
export async function download(url, target, expectedSize, token = process.env.HF_TOKEN) {
    const headers = token ? { authorization: `Bearer ${token}` } : {};
    let last = 'unknown';
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        try {
            const result = await attemptDownload(url, target, expectedSize, headers);
            if (result.ok) return result.size;
            last = `HTTP ${result.status}${result.detail ? ` (${result.detail})` : ''}`;
            if (typeof result.status === 'number' && !isTransient(result.status)) throw Object.assign(new Error(last), { permanent: true });
            await sleep(backoffMs(attempt, result.retryAfter));
        } catch (error) {
            await rm(target, { force: true });
            if (error.permanent) throw error;
            last = error.cause ? `${error.message} (${error.cause.code || error.cause.message})` : error.message;
            await sleep(backoffMs(attempt));
        }
    }
    throw new Error(`Download failed after ${ATTEMPTS} attempts: ${last}`);
}
