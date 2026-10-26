import sharp from 'sharp';
import { stat, rename, rm } from 'node:fs/promises';

const IMAGE = /\.(png|jpe?g)$/i;

export function isTexture(path) {
    return IMAGE.test(path);
}

/** Shrinks in place; keeps original when not smaller. */
export async function shrinkTexture(path, maxSize) {
    const meta = await sharp(path, { limitInputPixels: false }).metadata();
    if (Math.max(meta.width || 0, meta.height || 0) <= maxSize) return false;
    const temp = `${path}.small`;
    try {
        const pipe = sharp(path, { limitInputPixels: false }).resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true });
        await (/\.png$/i.test(path) ? pipe.png({ compressionLevel: 8 }) : pipe.jpeg({ quality: 88, mozjpeg: true })).toFile(temp);
        if ((await stat(temp)).size >= (await stat(path)).size) { await rm(temp, { force: true }); return false; }
        await rename(temp, path);
        return true;
    } catch (error) {
        await rm(temp, { force: true });
        throw new Error(`Texture shrink failed for ${path}: ${error.message}`);
    }
}
