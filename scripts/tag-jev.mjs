import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { ROOT, currentCatalog, readJSON, atomicJSON, loadEnv, arg, flag } from './io.mjs';
import { fetchWithRetry } from './http.mjs';
import { makeQuestions, normalizeJev } from './jev-lib.mjs';
await loadEnv();
const catalog = await currentCatalog(), limit = Number(arg('--limit', Math.min(20, catalog.assets.length))), images = flag('--images'), execute = flag('--execute'), model = process.env.JEV_MODEL || 'jev-latest';
if (!Number.isInteger(limit) || limit < 1 || limit > catalog.assets.length)
    throw new Error(`--limit must be 1..${catalog.assets.length}`);
const questions = makeQuestions({ images }), batch = catalog.assets.slice(0, limit);
if (!execute) {
    console.log(JSON.stringify({ dryRun: true, assets: batch.length, questionsPerAsset: Object.keys(questions).length, images, model, questions, note: 'No requests sent. Review this plan, then pass --execute. All results are pending review; no physical or license fields are written.' }, null, 2));
}
else {
    if (!process.env.TYPESAFE_API_KEY)
        throw new Error('Set TYPESAFE_API_KEY in .env or your shell. Never add it to public/config.json.');
    let sharp;
    if (images) {
        try {
            sharp = (await import('../tools/tagger/node_modules/sharp/lib/index.js')).default;
        }
        catch {
            throw new Error('Image mode needs sharp: npm install --prefix tools/tagger');
        }
    }
    const output = resolve(ROOT, 'tags.enrichment.json'), enrichment = await readJSON(output, {});
    let failures = 0;
    for (const asset of batch) {
        const imageUrl = asset.remoteThumbnailUrl || asset.thumbnailUrl;
        const hash = createHash('sha256').update(JSON.stringify({ revision: catalog.revision, id: asset.id, name: asset.name, questions, images, model })).digest('hex');
        if (enrichment[asset.id]?.inputHash === hash) {
            console.log('Cached:', asset.name);
            continue;
        }
        try {
            const body = { model, state: { name: asset.name, path: asset.packagePath, existingTags: asset.tags }, questions };
            if (images) {
                if (!imageUrl?.startsWith('https://huggingface.co/'))
                    throw new Error('No remote PNG available for visual tagging.');
                const response = await fetchWithRetry(imageUrl), bytes = Buffer.from(await response.arrayBuffer());
                if (bytes.length > 4 * 1024 * 1024)
                    throw new Error('Image exceeds 4 MiB source limit');
                // Jev currently rejects 256px images. Pad/resize to a supported 320px square.
                const png = await sharp(bytes, { limitInputPixels: 16000000 }).rotate().resize(320, 320, { fit: 'contain', background: '#353335' }).png().toBuffer();
                const ref = randomUUID();
                body.state.thumbnail = ref;
                body.assets = { [ref]: { type: 'image', format: 'png', data_base64: png.toString('base64') } };
            }
            const response = await fetchWithRetry('https://api.typesafe.ai/v1/systemone', { method: 'POST', headers: { Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`, 'Content-Type': 'application/json', ...(images ? { 'TypeSafe-Danger-Zone-Images': 'true' } : {}) }, body: JSON.stringify(body) });
            const result = await response.json();
            if (!result.answers)
                throw new Error('Response has no answers');
            enrichment[asset.id] = { ...normalizeJev(result.answers, questions), model: result.model || model, inputHash: hash, answers: result.answers, usage: result.usage, createdAt: new Date().toISOString() };
            await atomicJSON(output, enrichment);
            console.log('Review:', asset.name);
        }
        catch (error) {
            failures++;
            console.error(asset.name, error.message);
        }
    }
    console.log(`Finished. ${failures} failures. Review tags.enrichment.json, mark accepted entries status: approved, then npm run catalog:tags. Retried API requests may incur additional charges.`);
    if (failures)
        process.exitCode = 1;
}
