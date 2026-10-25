import { createServer } from 'node:http';
import { stat, readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { ROOT, arg, flag, isMain } from './io.mjs';
export const CSP = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; connect-src 'self' https:; worker-src 'self' blob:; frame-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'";
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8' };
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
            let body;
            try {
                if (!(await stat(path)).isFile())
                    throw new Error('not-file');
                body = await readFile(path);
            }
            catch {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not found');
                return;
            }
            const headers = { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': CSP, 'Content-Length': body.length };
            // Viewer is an intentionally same-origin child frame.
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
