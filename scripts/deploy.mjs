import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROOT, currentCatalog, isMain } from './io.mjs';
import { remoteThumbnails } from './catalog-lib.mjs';
import { build } from './build.mjs';

/** Reasons the current tree must not be published. */
export function deployBlockers(catalog, viewerInstalled) {
    const blockers = [];
    if (catalog.mode !== 'snapshot') blockers.push('The catalog is not a full snapshot. Run npm run catalog:sync.');
    if (!viewerInstalled) blockers.push('The 3D viewer is not built. Run npm run viewer:setup.');
    const remote = remoteThumbnails(catalog);
    if (remote) blockers.push(`${remote} assets still use remote thumbnails. Run npm run catalog:thumbs -- --confirm-rights.`);
    return blockers;
}

async function viewerInstalled() {
    try {
        await stat(resolve(ROOT, 'public/vendor/usd/index.html'));
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') return false;
        throw error;
    }
}

function wranglerDeploy() {
    const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'wrangler@4', 'deploy'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('error', error => { console.error(`wrangler failed to start: ${error.message}`); process.exitCode = 1; });
    child.on('exit', code => { process.exitCode = code || 0; });
}

async function main() {
    const blockers = deployBlockers(await currentCatalog(), await viewerInstalled());
    if (blockers.length) {
        for (const blocker of blockers) console.error(`Deployment blocked: ${blocker}`);
        process.exitCode = 1;
        return;
    }
    await build();
    wranglerDeploy();
}

if (isMain(import.meta.url)) main().catch(error => { console.error(`deploy: ${error.message}`); process.exitCode = 1; });
