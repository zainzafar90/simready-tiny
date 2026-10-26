import sharp from 'sharp';
import { open, stat, rename, rm } from 'node:fs/promises';

const IMAGE = /\.(png|jpe?g)$/i;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
/* sharp's default ceiling, kept explicit */
const MAX_INPUT_PIXELS = 0x3fff * 0x3fff;

export function isTexture(path) {
    return IMAGE.test(path);
}

export function sniffImage(header) {
    if (header.subarray(0, 8).equals(PNG_MAGIC)) return 'png';
    if (header.subarray(0, 3).equals(JPEG_MAGIC)) return 'jpeg';
    return null;
}

async function readHeader(path) {
    const file = await open(path, 'r');
    try {
        const { buffer, bytesRead } = await file.read(Buffer.alloc(8), 0, 8, 0);
        return buffer.subarray(0, bytesRead);
    } finally {
        await file.close();
    }
}

/** Shrinks in place; keeps original when not smaller. */
export async function shrinkTexture(path, maxSize) {
    const format = sniffImage(await readHeader(path));
    if (!format) { console.warn(`Skipping non-PNG/JPEG texture: ${path}`); return false; }
    const options = { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' };
    const meta = await sharp(path, options).metadata();
    if (meta.format !== format) throw new Error(`Texture content mismatch for ${path}: ${meta.format}`);
    if (Math.max(meta.width || 0, meta.height || 0) <= maxSize) return false;
    const temp = `${path}.small`;
    try {
        const pipe = sharp(path, options).resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true });
        await (format === 'png' ? pipe.png({ compressionLevel: 8 }) : pipe.jpeg({ quality: 88, mozjpeg: true })).toFile(temp);
        if ((await stat(temp)).size >= (await stat(path)).size) { await rm(temp, { force: true }); return false; }
        await rename(temp, path);
        return true;
    } catch (error) {
        await rm(temp, { force: true });
        throw new Error(`Texture shrink failed for ${path}: ${error.message}`);
    }
}
