import { createServer } from 'node:http';
import { stat, readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { brotliCompress, gzip, constants } from 'node:zlib';
import { promisify } from 'node:util';
import { ROOT, arg, flag, isMain } from './io.mjs';
import { readSiteConfig, renderIndex } from './site-config.mjs';
const UPSTREAM_HOSTS = ['https://huggingface.co', 'https://*.huggingface.co', 'https://*.hf.co'];

/** Model hosts: configured mirror plus Hugging Face. */
export function modelHosts(config) {
    const base = typeof config?.modelBaseUrl === 'string' && URL.canParse(config.modelBaseUrl) ? new URL(config.modelBaseUrl) : null;
    return [...(base?.protocol === 'https:' ? [base.origin] : []), ...UPSTREAM_HOSTS].join(' ');
}

export function contentSecurityPolicy(config) {
    const hosts = modelHosts(config);
    return `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${hosts}; connect-src 'self' ${hosts}; worker-src 'self' blob:; frame-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'`;
}

export const CSP = contentSecurityPolicy(readSiteConfig());
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8' };
const COMPRESSIBLE = /^(text\/|application\/(json|wasm)|image\/svg)/;
const brotli = promisify(brotliCompress), gzipAsync = promisify(gzip);
const compressed = new Map();
/* mirrors Cloudflare edge compression */
export function pickEncoding(acceptEncoding = '', type = '', size = 0) {
    if (size < 1024 || !COMPRESSIBLE.test(type)) return null;
    const accepts = name => acceptEncoding.split(',').some(part => {
        const [token, ...params] = part.trim().split(';');
        return token.trim() === name && !params.some(p => /^\s*q=0(\.0+)?\s*$/.test(p));
    });
    if (accepts('br')) return 'br';
    return accepts('gzip') ? 'gzip' : null;
}
async function compress(path, mtimeMs, body, encoding) {
    const key = `${encoding}:${path}:${mtimeMs}`;
    if (!compressed.has(key)) {
        if (compressed.size > 200) compressed.clear();
        const job = encoding === 'br' ? brotli(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }) : gzipAsync(body, { level: 6 });
        compressed.set(key, job.catch(error => { compressed.delete(key); throw error; }));
    }
    return compressed.get(key);
}
const MISSING = new Set(['ENOENT', 'ENOTDIR', 'EISDIR']);

function decodePath(url) {
    try {
        return decodeURIComponent(new URL(url, 'http://localhost').pathname);
    } catch {
        return null;
    }
}

export function isForbiddenPath(pathname) {
    const parts = pathname.split('/');
    return pathname.includes('\0') || pathname.includes('\\') || parts.includes('..') || parts.some(s => s.startsWith('.') && s !== '.well-known');
}

function resolveFile(pathname, dist) {
    const site = resolve(ROOT, dist ? 'dist' : 'public');
    const isIndex = pathname === '/' || pathname === '/index.html';
    const root = isIndex ? (dist ? site : ROOT) : !dist && pathname.startsWith('/src/') ? ROOT : site;
    const path = resolve(root, '.' + (isIndex ? '/index.html' : pathname));
    return path === root || path.startsWith(root + sep) ? path : null;
}

async function readTarget(path) {
    try {
        const info = await stat(path);
        return info.isFile() ? { info, body: await readFile(path) } : null;
    } catch (error) {
        if (MISSING.has(error.code)) return null;
        throw error;
    }
}

function responseHeaders(pathname, type, length, encoding) {
    /* viewer is a same-origin child frame */
    const csp = pathname.startsWith('/vendor/usd/') ? CSP.replace("frame-ancestors 'none'", "frame-ancestors 'self'") : CSP;
    return { 'Content-Type': type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': csp, 'Content-Length': length, ...(encoding ? { 'Content-Encoding': encoding, Vary: 'Accept-Encoding' } : {}) };
}

function send(res, status, message = '') {
    res.writeHead(status, message ? { 'Content-Type': 'text/plain' } : {});
    res.end(message);
}

async function handle(req, res, dist) {
    if (!['GET', 'HEAD'].includes(req.method)) return send(res, 405);
    const pathname = decodePath(req.url);
    if (pathname === null) return send(res, 400, 'Invalid URL');
    if (isForbiddenPath(pathname)) return send(res, 403, 'Forbidden');
    const path = resolveFile(pathname, dist);
    if (!path) return send(res, 403);
    const target = await readTarget(path);
    if (!target) return send(res, 404, 'Not found');
    if (!dist && path === resolve(ROOT, 'index.html')) target.body = Buffer.from(renderIndex(target.body.toString('utf8'), readSiteConfig()));
    const type = mime[extname(path)] || 'application/octet-stream';
    const encoding = pickEncoding(req.headers['accept-encoding'], type, target.body.length);
    const body = encoding ? await compress(path, target.info.mtimeMs, target.body, encoding) : target.body;
    res.writeHead(200, responseHeaders(pathname, type, body.length, encoding));
    res.end(req.method === 'HEAD' ? undefined : body);
}

export function createAppServer({ dist = false } = {}) {
    return createServer((req, res) => handle(req, res, dist).catch(error => {
        console.error(`serve: ${req.method} ${req.url} failed: ${error.message}`);
        if (!res.headersSent) send(res, 500, 'Server error');
    }));
}
if (isMain(import.meta.url)) {
    const port = Number(arg('--port', process.env.PORT || 4173)), host = arg('--host', '127.0.0.1');
    const server = createAppServer({ dist: flag('--dist') });
    server.on('error', error => { console.error(error.message); process.exitCode = 1; });
    server.listen(port, host, () => console.log(`\nSimReady Tiny → http://${host}:${server.address().port}\n${flag('--dist') ? 'Serving dist/' : 'Development mode · edit src/ and refresh'}\nRun npm run setup once to import the source catalog and install the optional 3D viewer.\n`));
}
