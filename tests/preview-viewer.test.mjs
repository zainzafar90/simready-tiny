import test from 'node:test';
import assert from 'node:assert/strict';
import { isTransientViewerError, viewerErrorMessage, modelSources } from '../src/preview/preview-viewer.js';

test('network-style viewer errors are treated as transient', () => {
    assert.equal(isTransientViewerError('could not fetch https://huggingface.co/x.usd'), true);
    assert.equal(isTransientViewerError('TypeError: Failed to fetch'), true);
    assert.equal(isTransientViewerError('HTTP 503'), true);
    assert.equal(isTransientViewerError('Unsupported model origin.'), false);
});

test('transient errors get a plain message without the raw URL', () => {
    assert.equal(viewerErrorMessage('could not fetch https://huggingface.co/x.usd').includes('huggingface.co/x'), false);
    assert.match(viewerErrorMessage('Layer limit exceeded'), /^3D preview unavailable: Layer limit exceeded/);
});

test('model sources put the mirror first and keep Hugging Face as fallback', () => {
    const revision = 'a'.repeat(40), upstream = 'https://huggingface.co/datasets/nvidia/simready-assets/resolve/x/mug/simready_usd/m.usd';
    assert.deepEqual(modelSources({ upstream, usdPath: 'mug/simready_usd/m.usd', revision, baseUrl: 'https://models.example.com' }), [`https://models.example.com/${revision}/mug/simready_usd/m.usd`, upstream]);
    assert.deepEqual(modelSources({ upstream, usdPath: 'mug/a b.usd', revision, baseUrl: '' }), [upstream]);
    assert.deepEqual(modelSources({ upstream, usdPath: 'mug/m.usd', revision: 'main', baseUrl: 'https://models.example.com/' }), [upstream]);
    assert.equal(modelSources({ upstream, usdPath: 'mug/a#b?.usd', revision, baseUrl: 'https://m.example.com/' })[0], `https://m.example.com/${revision}/mug/a%23b%3F.usd`);
    assert.deepEqual(modelSources({ upstream, usdPath: 'mug/m.usd', revision, baseUrl: 'http://m.example.com/' }), [upstream]);
});
