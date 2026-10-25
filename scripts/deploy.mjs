import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROOT, currentCatalog, flag } from './io.mjs';
import { build } from './build.mjs';
const catalog = await currentCatalog();
if (catalog.mode !== 'snapshot' && !flag('--allow-preview')) {
    console.error('Deployment blocked: the bundled preview is not the complete catalog. Run npm run setup, or explicitly pass --allow-preview for a demo.');
    process.exitCode = 1;
}
else if (!flag('--allow-preview') && !await stat(resolve(ROOT, 'public/vendor/usd/index.html')).then(() => true).catch(() => false)) {
    console.error('Deployment blocked: USD viewer has not been built. Run npm run viewer:setup.');
    process.exitCode = 1;
}
else {
    await build();
    const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'wrangler@4', 'deploy'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('error', e => { console.error(e); process.exitCode = 1; });
    child.on('exit', code => process.exitCode = code || 0);
}
