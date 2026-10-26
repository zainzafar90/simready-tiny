import { AwsClient } from 'aws4fetch';
import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const REQUIRED = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
const ATTEMPTS = 5;
const CONTENT_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.usda': 'text/plain; charset=utf-8' };

export function contentType(key) {
    const dot = key.lastIndexOf('.');
    return CONTENT_TYPES[key.slice(dot).toLowerCase()] || 'application/octet-stream';
}

export function describeError(error) {
    const cause = error?.cause;
    return cause ? `${error.message} (${cause.code || cause.name || 'cause'}: ${cause.message || cause})` : String(error?.message || error);
}

export function encodeKey(key) {
    return key.split('/').map(encodeURIComponent).join('/');
}

export function createR2(env = process.env) {
    const missing = REQUIRED.filter(name => !env[name]);
    if (missing.length) throw new Error(`Missing R2 settings: ${missing.join(', ')}`);
    const aws = new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' });
    const base = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET || 'simready-tiny-models'}/`;

    async function once(method, key, init) {
        const response = await aws.fetch(base + encodeKey(key), { method, ...init, signal: AbortSignal.timeout(10 * 60_000) });
        if (method === 'HEAD' || response.ok) return response;
        const error = new Error(`R2 ${method} ${response.status} for ${key}: ${(await response.text()).slice(0, 200)}`);
        error.permanent = response.status < 500 && response.status !== 429;
        throw error;
    }
    async function request(method, key, init = {}) {
        for (let attempt = 1; ; attempt++) {
            try {
                return await once(method, key, init);
            } catch (error) {
                if (error.permanent || attempt >= ATTEMPTS) throw new Error(`R2 ${method} ${key} failed after ${attempt} attempt(s): ${describeError(error)}`);
                await sleep(Math.min(60_000, 1000 * 2 ** attempt));
            }
        }
    }
    return {
        async exists(key) {
            const response = await request('HEAD', key);
            if (response.status === 404) return false;
            if (!response.ok) throw new Error(`R2 HEAD ${response.status} for ${key}`);
            return true;
        },
        async putFile(key, path) {
            const body = await readFile(path);
            await request('PUT', key, { body, headers: { 'content-type': contentType(key), 'cache-control': 'public, max-age=31536000, immutable' } });
            return body.length;
        },
        async getJSON(key) {
            return (await request('GET', key)).json();
        },
        async putJSON(key, value) {
            await request('PUT', key, { body: JSON.stringify(value), headers: { 'content-type': 'application/json' } });
        },
    };
}
