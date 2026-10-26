import test from 'node:test';
import assert from 'node:assert/strict';
import { autoLoadLimitBytes, shouldAutoLoad, loadTag, previewBytes } from '../src/preview/load-policy.js';

const MB = 1024 * 1024;
const asset = size => ({ packageSizeBytes: size * MB });

test('auto-load limit follows network hints', () => {
    assert.equal(autoLoadLimitBytes({ connection: { saveData: true, effectiveType: '4g' } }), 0);
    assert.equal(autoLoadLimitBytes({ connection: { effectiveType: '2g' } }), 5 * MB);
    assert.equal(autoLoadLimitBytes({ connection: { effectiveType: '3g' } }), 25 * MB);
    assert.equal(autoLoadLimitBytes({ connection: { effectiveType: '4g', downlink: 1.35 } }), 250 * MB);
    assert.equal(autoLoadLimitBytes({ connection: { effectiveType: '4g', downlink: 10 } }), 250 * MB);
    assert.equal(autoLoadLimitBytes({ connection: { effectiveType: '3g', downlink: 0.5 } }), 10 * MB);
});

test('without network hints, phones use a smaller limit', () => {
    assert.equal(autoLoadLimitBytes({ compact: false }), 250 * MB);
    assert.equal(autoLoadLimitBytes({ compact: true }), 100 * MB);
    assert.equal(autoLoadLimitBytes({ compact: true, connection: { effectiveType: '4g', downlink: 10 } }), 100 * MB);
});

test('shouldAutoLoad respects the adaptive limit', () => {
    const slow = { connection: { effectiveType: '3g', downlink: 1.5 } };
    assert.equal(shouldAutoLoad(asset(20), slow), true);
    assert.equal(shouldAutoLoad(asset(60), slow), false);
    assert.equal(shouldAutoLoad({}, slow), true);
    assert.equal(shouldAutoLoad({}, { connection: { saveData: true } }), false);
});

test('near-limit packages still auto-load', () => {
    const fast = { connection: { effectiveType: '4g', downlink: 10 } };
    assert.equal(shouldAutoLoad(asset(251), fast), true);
    assert.equal(shouldAutoLoad(asset(300), fast), false);
});

test('cards tag only models that wait for a click', () => {
    const fast = { connection: { effectiveType: '4g', downlink: 10 } };
    assert.equal(loadTag(asset(100), fast), null);
    assert.equal(loadTag(asset(400), fast).label, 'Large');
    assert.equal(loadTag(asset(400), { connection: { saveData: true } }), null);
});

test('optimized preview size wins over the original package size', () => {
    const fast = { connection: { effectiveType: '4g', downlink: 10 } };
    const big = { packageSizeBytes: 600 * MB, previewSizeBytes: 80 * MB };
    assert.equal(previewBytes(big), 80 * MB);
    assert.equal(shouldAutoLoad(big, fast), true);
    assert.equal(loadTag(big, fast), null);
});
