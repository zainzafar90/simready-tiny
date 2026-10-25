import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import { ROOT, flag } from './io.mjs';
import { syncCatalog } from './sync-catalog.mjs';
function run(args) { return new Promise((ok, no) => { const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' }); child.on('error', no); child.on('exit', code => code === 0 ? ok() : no(new Error(`npm ${args.join(' ')} failed (${code}).`))); }); }
async function viewer() {
    console.log('\nInstalling the isolated USD viewer (browse/search itself has no dependencies).');
    await run(['install', '--prefix', 'tools/viewer', '--no-audit', '--no-fund']);
    await run(['run', 'build', '--prefix', 'tools/viewer']);
    const output = resolve(ROOT, 'public/vendor/usd');
    await mkdir(resolve(output, 'licenses'), { recursive: true });
    for (const [pkg, label] of [['@huggingface/usd-web-viewer', 'usd-web-viewer'], ['three', 'three']]) {
        const dir = resolve(ROOT, 'tools/viewer/node_modules', pkg);
        for (const file of await readdir(dir))
            if (/^(license|third_party)/i.test(file) && (await stat(resolve(dir, file))).isFile())
                await copyFile(resolve(dir, file), resolve(output, 'licenses', label + '-' + file));
    }
    console.log('Viewer installed. It loads only on explicit activation.');
}
let failed = false;
if (!flag('--viewer-only'))
    try {
        await syncCatalog();
    }
    catch (error) {
        failed = true;
        console.error('\nCatalog import failed:', error.message, '\nExisting catalog preserved. Run npm run catalog:sync to retry.');
    }
if (!flag('--catalog-only'))
    try {
        await viewer();
    }
    catch (error) {
        failed = true;
        console.error('\nViewer setup failed:', error.message, '\nBrowse/search is still usable. Run npm run viewer:setup to retry.');
    }
if (failed)
    process.exitCode = 1;
else
    console.log('\nSetup finished. Run npm start to browse, or npm run deploy to publish.');
