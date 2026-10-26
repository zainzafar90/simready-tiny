import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { ROOT, currentCatalog, readJSON, atomicJSON, loadEnv, arg, flag } from './io.mjs';
import { fetchWithRetry } from './http.mjs';
import { makeQuestions, normalizeJev } from './jev-lib.mjs';

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const OUTPUT = resolve(ROOT, 'tags.enrichment.json');
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function parseOptions(total) {
    const limit = Number(arg('--limit', Math.min(20, total)));
    if (!Number.isInteger(limit) || limit < 1 || limit > total) throw new Error(`--limit must be 1..${total}`);
    return { limit, images: flag('--images'), execute: flag('--execute'), model: process.env.JEV_MODEL || 'jev-latest' };
}

async function loadSharp() {
    try {
        return (await import('../tools/tagger/node_modules/sharp/lib/index.js')).default;
    } catch {
        throw new Error('Image mode needs sharp: npm install --prefix tools/tagger');
    }
}

async function thumbnailAsset(asset, sharp) {
    const url = asset.remoteThumbnailUrl || asset.thumbnailUrl;
    if (!url?.startsWith('https://huggingface.co/')) throw new Error('No remote PNG available for visual tagging.');
    const bytes = Buffer.from(await (await fetchWithRetry(url)).arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) throw new Error('Image exceeds 4 MiB source limit');
    /* Jev rejects 256px; pad to 320px */
    const png = await sharp(bytes, { limitInputPixels: 16000000 }).rotate().resize(320, 320, { fit: 'contain', background: '#353335' }).png().toBuffer();
    return { type: 'image', format: 'png', data_base64: png.toString('base64') };
}

async function askJev(asset, { questions, model, sharp }) {
    const body = { model, state: { name: asset.name, path: asset.packagePath, existingTags: asset.tags }, questions };
    if (sharp) {
        const ref = randomUUID();
        body.state.thumbnail = ref;
        body.assets = { [ref]: await thumbnailAsset(asset, sharp) };
    }
    const headers = { Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`, 'Content-Type': 'application/json', ...(sharp ? { 'TypeSafe-Danger-Zone-Images': 'true' } : {}) };
    const result = await (await fetchWithRetry(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body) })).json();
    if (!result.answers) throw new Error('Response has no answers');
    return result;
}

async function tagBatch(batch, revision, { questions, images, model }) {
    const sharp = images ? await loadSharp() : null, enrichment = await readJSON(OUTPUT, {});
    let failures = 0;
    for (const asset of batch) {
        const inputHash = createHash('sha256').update(JSON.stringify({ revision, id: asset.id, name: asset.name, questions, images, model })).digest('hex');
        if (enrichment[asset.id]?.inputHash === inputHash) { console.log('Cached:', asset.name); continue; }
        try {
            const result = await askJev(asset, { questions, model, sharp });
            enrichment[asset.id] = { ...normalizeJev(result.answers, questions), model: result.model || model, inputHash, answers: result.answers, usage: result.usage, createdAt: new Date().toISOString() };
            await atomicJSON(OUTPUT, enrichment);
            console.log('Review:', asset.name);
        } catch (error) {
            failures++;
            console.error(`tag:jev ${asset.id}: ${error.message}`);
        }
    }
    return failures;
}

async function main() {
    await loadEnv();
    const catalog = await currentCatalog(), options = parseOptions(catalog.assets.length);
    const questions = makeQuestions({ images: options.images }), batch = catalog.assets.slice(0, options.limit);
    if (!options.execute) {
        console.log(JSON.stringify({ dryRun: true, assets: batch.length, questionsPerAsset: Object.keys(questions).length, images: options.images, model: options.model, questions, note: 'No requests sent. Review this plan, then pass --execute. All results are pending review; no physical or license fields are written.' }, null, 2));
        return;
    }
    if (!process.env.TYPESAFE_API_KEY) throw new Error('Set TYPESAFE_API_KEY in .env or your shell. Never add it to public/config.json.');
    const failures = await tagBatch(batch, catalog.revision, { ...options, questions });
    console.log(`Finished. ${failures} failures. Review tags.enrichment.json, mark accepted entries status: approved, then npm run catalog:tags. Retried API requests may incur additional charges.`);
    if (failures) process.exitCode = 1;
}

main().catch(error => { console.error(`tag:jev: ${error.message}`); process.exitCode = 1; });
