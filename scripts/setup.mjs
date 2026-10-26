import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { ROOT, flag } from './io.mjs';
import { syncCatalog } from './sync-catalog.mjs';
function run(args) { return new Promise((ok, no) => { const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' }); child.on('error', no); child.on('exit', code => code === 0 ? ok() : no(new Error(`npm ${args.join(' ')} failed (${code}).`))); }); }
async function viewer() {
    console.log('\nInstalling the isolated USD viewer (browse/search itself has no dependencies).');
    await run(['install', '--prefix', 'tools/viewer', '--no-audit', '--no-fund']);
    await run(['run', 'build', '--prefix', 'tools/viewer']);
    console.log('Viewer installed with its license notices.');
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
