import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
    base: '/vendor/usd/',
    optimizeDeps: { exclude: ['@huggingface/usd-web-viewer'] },
    worker: { format: 'es' },
    build: { outDir: fileURLToPath(new URL('../../public/vendor/usd', import.meta.url)), emptyOutDir: true, target: 'es2022', assetsInlineLimit: 0, sourcemap: false }
});
