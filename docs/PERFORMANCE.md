# Performance

Measured on 2026-10-26. Re-run with the commands at the end.

## Page weight

| Part | Size (gzip) | When it loads |
|---|---:|---|
| Core JS + CSS (`src/` except the preview) | 27.5 KiB | Every page (32 KiB build budget) |
| Preview modules | 7.5 KiB | When an object is opened |
| Catalog (2,575 objects) | ~210 KiB (Brotli) | Once; cached forever by hash |
| Thumbnail | ~4 KB (512px) / ~28 KB (1024px) | Per visible card / per preview |
| 3D viewer | 0.5 MB JS + 2.3 MB WASM | First 3D preview; cached forever |

Thumbnails were ~836 KB PNGs before they were converted to WebP.

## Search (CPU, Apple M4 Pro, Node 22)

| Synthetic records | Build index | p50 | p95 | p99 |
|---:|---:|---:|---:|---:|
| 2,575 | 35 ms | 0.08 ms | 0.21 ms | 0.29 ms |
| 10,000 | 89 ms | 0.24 ms | 1.11 ms | 1.39 ms |

These are CPU timings only: no debounce, worker messaging or painting.

## Gallery on emulated phones (Pixel 7, CPU slowed 4×)

| Connection | First paint | Search ready | First images | Transferred |
|---|---:|---:|---:|---:|
| 4G | 0.2 s | 0.8 s | 1.1 s | 0.29 MB |
| Fast 3G (1.6 Mbit/s) | 0.5 s | 2.3 s | 2.7 s | 0.29 MB |
| Slow 3G (0.4 Mbit/s) | 1.2 s | 7.4 s | 8.9 s | 0.27 MB |

The gallery mounts at most ~20 cards for 2,575 results and stays bounded while scrolling.

## 3D models: mirror vs Hugging Face

The mirror keeps every model file but caps textures at 1024px: **233 GB → 43 GB (81% smaller)**, median model 13% of its original size. Only 14 models still exceed 250 MB, down from 578.

| Model | Hugging Face | Mirror |
|---|---:|---:|
| Wall socket (63 MB original) | 17.8 s, 43 requests | 9.9 s, 18 requests |
| Car fender (35 MB original) | 32.9 s, 35 requests | 10.8 s, 12 requests |
| Same model, second open | — | ~2.3 s (service-worker cache) |

On an emulated phone, the socket went from 55 s to 7 s on 4G, and from about 5.5 minutes to 33 s on fast 3G. These are single runs with software WebGL, so real devices with a GPU render faster; compare the ratios, not the absolute times.

## Reproduce

```sh
npm run bench
npm run build                         # prints the core gzip size
node scripts/serve.mjs --port 4175 &
python3 tools/perf/mobile-perf.py     # writes reports/perf/mobile-perf.json
```
