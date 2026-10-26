import { performance } from 'node:perf_hooks';
import { cpus, platform, arch } from 'node:os';
import { resolve } from 'node:path';
import { SearchEngine } from '../src/search/search-engine.js';
import { stressAssets } from '../tests/fixtures.mjs';
import { ROOT, atomicJSON } from './io.mjs';
/* ~10x today's M4 numbers; CI-safe */
const LIMITS = { 2575: { indexMs: 500, searchP95Ms: 5 }, 10000: { indexMs: 1500, searchP95Ms: 15 } };
const cases = ['banana', 'bana', 'bannana', 'storage cart', '"medical instrument"', 'green -paint', 'variant12', 'zqxwkjgfr', 'trolley', 'warehouse rack', 'red', ''];
const reports = [];
for (const count of [2575, 10000]) {
    const data = stressAssets(count);
    const start = performance.now();
    const engine = new SearchEngine(data), indexMs = performance.now() - start;
    for (let i = 0; i < 100; i++)
        engine.search({ query: cases[i % cases.length] });
    const samples = [];
    for (let i = 0; i < 1200; i++) {
        const t = performance.now();
        engine.search({ query: cases[i % cases.length] });
        samples.push(performance.now() - t);
    }
    samples.sort((a, b) => a - b);
    const p = q => Number(samples[Math.floor((samples.length - 1) * q)].toFixed(3));
    reports.push({ assets: count, samples: samples.length, indexMs: Number(indexMs.toFixed(3)), searchP50Ms: p(.5), searchP95Ms: p(.95), searchP99Ms: p(.99), worstMs: p(1) });
}
const output = { environment: { node: process.version, os: platform(), arch: arch(), cpu: cpus()[0]?.model }, fixture: 'Synthetic records, not the full live NVIDIA catalog. Node CPU timings; no browser render/network time included.', reports };
await atomicJSON(resolve(ROOT, 'reports/benchmark.json'), output);
for (const r of reports) console.log(`${r.assets} records: index ${r.indexMs} ms, search p50 ${r.searchP50Ms} ms, p95 ${r.searchP95Ms} ms, worst ${r.worstMs} ms`);
const failures = reports.flatMap(r => Object.entries(LIMITS[r.assets]).filter(([key, limit]) => r[key] > limit).map(([key, limit]) => `${r.assets} records: ${key} ${r[key]} ms exceeds ${limit} ms`));
for (const failure of failures) console.error(`Benchmark limit exceeded: ${failure}`);
if (failures.length) process.exitCode = 1;
