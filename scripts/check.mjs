import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './io.mjs';
let files = 0, failed = 0;
for (const dir of ['src', 'scripts', 'tests', 'tools/viewer'])
    for (const name of await readdir(resolve(ROOT, dir))) {
        if (!/\.(js|mjs)$/.test(name))
            continue;
        const result = spawnSync(process.execPath, ['--check', resolve(ROOT, dir, name)], { encoding: 'utf8' });
        files++;
        if (result.status) {
            failed++;
            console.error(result.stderr);
        }
    }
console.log(`${files} JavaScript modules checked. ${failed} syntax errors.`);
if (failed)
    process.exitCode = 1;
