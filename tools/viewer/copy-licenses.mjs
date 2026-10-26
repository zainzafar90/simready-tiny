import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/* runs after vite build empties the output */
const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(HERE, '../../public/vendor/usd/licenses');
const PACKAGES = [['@huggingface/usd-web-viewer', 'usd-web-viewer'], ['three', 'three']];

await mkdir(OUTPUT, { recursive: true });
let copied = 0;
for (const [pkg, label] of PACKAGES) {
    const dir = resolve(HERE, 'node_modules', pkg);
    for (const file of await readdir(dir)) {
        if (!/^(license|third_party|notice)/i.test(file) || !(await stat(resolve(dir, file))).isFile()) continue;
        await copyFile(resolve(dir, file), resolve(OUTPUT, `${label}-${file}`));
        copied++;
    }
}
if (!copied) throw new Error('No viewer license files found; refusing to ship the viewer without notices.');
console.log(`Copied ${copied} viewer license files.`);
