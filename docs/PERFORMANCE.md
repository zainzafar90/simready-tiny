# Performance report — Gallery edition

Measured on this implementation, not a claim of globally fastest or production performance.

Core browse/search JavaScript + CSS: **23,314 bytes (22.8 KiB) gzip**, measured per file at level 9. The build enforces a **32,768-byte (32 KiB) budget**. This excludes HTML, catalog JSON, images, the lazy detail module and the optional USD viewer. The full-screen detail module is 4,872 bytes gzip and loads only when an object is opened.

| Synthetic records | Index construction | Search p50 | Search p95 | Search p99 |
| --- | --- | --- | --- | --- |
| 2,575 | 103.641 ms | 0.166 ms | 0.678 ms | 0.982 ms |
| 10,000 | 310.649 ms | 0.574 ms | 2.961 ms | 3.801 ms |

Environment: v22.16.0, linux x64, INTEL(R) XEON(R) PLATINUM 8573C. Each size uses 1,200 measured queries after warm-up. These are Node CPU timings, excluding the 25 ms debounce, worker messaging, network, parsing, layout and painting. Sub-millisecond CPU search does not mean sub-millisecond visible response.

The Chromium stress check mounted **16 gallery cards for 2,575 records** at 1440 × 1000. Deep scrolling stayed under the test's 32-card limit. The full-screen result strip has at most **nine thumbnails**, even when browsing thousands of results.

The actual UI and real search worker were exercised in an in-memory harness with mocked network, module loading, clipboard, history and storage because the authoring browser blocks URL navigation. These are not deployed E2E, Lighthouse, INP or memory-leak certifications. Separate Node HTTP checks exercise the actual production static server and content-addressed imports; see `reports/production-smoke.json`.

## Reproduce

```sh
npm run bench
npm run build
npm run test:browser:memory
```

Playwright and Chromium are separate test prerequisites. For real-origin browser testing, start `npm start` and run `npm run test:browser`; see `TESTING.md`.

## Design choices

No core framework runtime, font downloads, model inference, server search API, or application dependency install. The worker owns the search index. Only visible cards and one overscan row per side mount. Existing card/image nodes are retained while scrolling. Preview navigation is bounded. A 3D viewer is neither imported nor mounted until explicitly requested, and its isolated iframe is removed when stopped, closed, or replaced.

Static app/catalog files have content-addressed names. Colors and spacing are CSS variables. Collection filtering reuses the existing worker rather than adding a second index.

## Remaining measurements

Profile the fully imported catalog on a low-end phone and a throttled connection. Measure first usable search, input-to-paint latency, image waterfalls and real viewer memory. Use those results to decide whether to mirror thumbnails, pre-serialize the index or split catalogs. No best-possible or production latency guarantee is implied.
