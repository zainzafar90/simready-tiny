import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './io.mjs';

const DIRS = ['src', 'public', 'scripts', 'tests', 'tools/viewer', 'tools/preview-models/src', 'tools/preview-models/test'];
const SKIP = /(^|\/)(node_modules|vendor|dist)\//;

async function modules(dir) {
    const names = await readdir(resolve(ROOT, dir), { recursive: true });
    return names.filter(name => /\.(js|mjs)$/.test(name) && !SKIP.test(name)).map(name => resolve(ROOT, dir, name));
}

function syntaxError(file) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.error) throw new Error(`Could not run node --check on ${file}: ${result.error.message}`);
    return result.status ? result.stderr : '';
}

const files = (await Promise.all(DIRS.map(modules))).flat();
const errors = files.map(syntaxError).filter(Boolean);
for (const error of errors) console.error(error);
console.log(`${files.length} JavaScript modules checked. ${errors.length} syntax errors.`);
if (errors.length) process.exitCode = 1;
