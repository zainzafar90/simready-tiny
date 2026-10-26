import { createServer } from 'node:http';
import { stat, readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { brotliCompress, gzip, constants } from 'node:zlib';
import { promisify } from 'node:util';
import { ROOT, arg, flag, isMain } from './io.mjs';
export const CSP = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; connect-src 'self' https:; worker-src 'self' blob:; frame-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'";
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
export function createAppServer({ dist = false } = {}) {
    return createServer(async (req, res) => {
        if (!['GET', 'HEAD'].includes(req.method)) {
            res.writeHead(405);
            res.end();
            return;
        }
        try {
            let pathname;
            try {
                pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
            }
            catch {
                res.writeHead(400);
                res.end('Invalid URL');
                return;
            }
            if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').includes('..') || pathname.split('/').some(s => s.startsWith('.') && s !== '.well-known')) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }
            let root = dist ? resolve(ROOT, 'dist') : resolve(ROOT, 'public');
            let relative = pathname;
            if (!dist && pathname.startsWith('/src/')) {
                root = ROOT;
            }
            if (pathname === '/' || pathname === '/index.html') {
                root = dist ? resolve(ROOT, 'dist') : ROOT;
                relative = '/index.html';
            }
            const path = resolve(root, '.' + relative);
            if (path !== root && !path.startsWith(root + sep)) {
                res.writeHead(403);
                res.end();
                return;
            }
            let body, info;
            try {
                info = await stat(path);
                if (!info.isFile())
                    throw new Error('not-file');
                body = await readFile(path);
            }
            catch {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not found');
                return;
            }
            const type = mime[extname(path)] || 'application/octet-stream';
            const encoding = pickEncoding(req.headers['accept-encoding'], type, body.length);
            if (encoding)
                body = await compress(path, info.mtimeMs, body, encoding);
            const headers = { 'Content-Type': type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': CSP, 'Content-Length': body.length, ...(encoding ? { 'Content-Encoding': encoding, Vary: 'Accept-Encoding' } : {}) };
            /* viewer is a same-origin child frame */
            if (pathname.startsWith('/vendor/usd/'))
                headers['Content-Security-Policy'] = CSP.replace("frame-ancestors 'none'", "frame-ancestors 'self'");
            res.writeHead(200, headers);
            res.end(req.method === 'HEAD' ? undefined : body);
        }
        catch (error) {
            res.writeHead(500);
            res.end('Server error');
            console.error(error.message);
        }
    });
}
if (isMain(import.meta.url)) {
    const port = Number(arg('--port', process.env.PORT || 4173)), host = arg('--host', '127.0.0.1');
    const server = createAppServer({ dist: flag('--dist') });
    server.on('error', error => { console.error(error.message); process.exitCode = 1; });
    server.listen(port, host, () => console.log(`\nAtlas → http://${host}:${server.address().port}\n${flag('--dist') ? 'Serving dist/' : 'Development mode · edit src/ and refresh'}\nRun npm run setup once to import the source catalog and install the optional 3D viewer.\n`));
}
