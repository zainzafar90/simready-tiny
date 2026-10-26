import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './io.mjs';
let files = 0, failed = 0;
const sources = await readdir(resolve(ROOT, 'src'), { recursive: true });
const listings = [['src', sources], ...await Promise.all(['scripts', 'tests', 'tools/viewer'].map(async dir => [dir, await readdir(resolve(ROOT, dir))]))];
for (const [dir, names] of listings)
    for (const name of names) {
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
