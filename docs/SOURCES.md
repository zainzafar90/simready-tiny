# Primary references

Checked 2026-10-26. These references describe external contracts; they are not evidence that the integrations were successfully run in the authoring environment.

- NVIDIA source dataset and asset paths: https://huggingface.co/datasets/nvidia/simready-assets
- Hugging Face USD viewer, createViewer/load options, worker/WASM bundling and license notices: https://huggingface.co/docs/huggingface.js/main/en/usd-web-viewer/README
- Hugging Face Hub API: https://huggingface.co/docs/hub/api
- TypeSafe structured request/response quickstart: https://docs.typesafe.ai/introduction/quickstart
- TypeSafe experimental image request format, image limits and opt-in header: https://docs.typesafe.ai/images
- Cloudflare static-asset headers: https://developers.cloudflare.com/workers/static-assets/headers/
- Cloudflare static-asset billing and limitations: https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/

## Code verification references

- `reports/unit-tests.tap`: actual Node test output.
- `reports/browser.json`: actual Chromium harness results and limitations.
- `reports/build.json`: measured gzip bytes per core source file.
- `reports/benchmark.json`: CPU environment, fixture type and raw timing summary.

No claim of unrestricted NVIDIA asset redistribution, universal USD compatibility or globally fastest search is made.

## UI reference

The user supplied Brainwave screenshots and https://ui8-brainwave-2.vercel.app/assets/3d-objects. The new Atlas implementation uses the layout direction, not the reference site’s source code, branding, or illustration files.
