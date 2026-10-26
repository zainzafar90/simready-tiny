"""Gallery and 3D-preview performance under emulated devices and networks.

Start a server first:  node scripts/serve.mjs --port 4175
Run:                   python3 tools/perf/mobile-perf.py [--base http://127.0.0.1:4175]
Report:                reports/perf/mobile-perf.json
Compares the original Hugging Face files with the R2 mirror of shrunk copies.
"""
import argparse, asyncio, json, time
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
REVISION = '524747d9b5e1f21b5b18b56041788c01d745f1a1'
HF = f'https://huggingface.co/datasets/nvidia/simready-assets/resolve/{REVISION}/'
MIRROR = f'https://simready-models.zainzafar.net/{REVISION}/'
MODELS = {
    'pan (2 MB)': 'kitchenware_pan_c01/simready_usd/sm_kitchenware_pan_c01_01.usd',
    'fender (35 MB)': 'bodyPart_fender_rear_b01/simready_usd/sm_bodyPart_fender_rear_b01_01.usd',
    'socket (63 MB)': 'socket_a03/simready_usd/sm_socket_a03_01.usd',
}
MBPS = 1_000_000 / 8
PROFILES = [
    {'name': 'Desktop, no throttling', 'device': None, 'cpu': 1, 'net': None},
    {'name': 'Phone, 4G', 'device': 'Pixel 7', 'cpu': 4, 'net': {'latency': 60, 'downloadThroughput': 9 * MBPS, 'uploadThroughput': 1.5 * MBPS}},
    {'name': 'Phone, fast 3G', 'device': 'Pixel 7', 'cpu': 4, 'net': {'latency': 150, 'downloadThroughput': 1.6 * MBPS, 'uploadThroughput': 0.75 * MBPS}},
    {'name': 'Phone, slow 3G', 'device': 'Pixel 7', 'cpu': 4, 'net': {'latency': 400, 'downloadThroughput': 0.4 * MBPS, 'uploadThroughput': 0.4 * MBPS}},
]
TIMEOUT_S = 300


async def new_page(browser, playwright, profile):
    device = dict(playwright.devices[profile['device']]) if profile['device'] else {'viewport': {'width': 1440, 'height': 900}}
    context = await browser.new_context(**device, service_workers='block', bypass_csp=True)
    page = await context.new_page()
    cdp = await context.new_cdp_session(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.setCacheDisabled', {'cacheDisabled': True})
    if profile['net']: await cdp.send('Network.emulateNetworkConditions', {'offline': False, **profile['net']})
    if profile['cpu'] > 1: await cdp.send('Emulation.setCPUThrottlingRate', {'rate': profile['cpu']})
    return context, page


def transferred_mb(entries):
    return round(sum(entries) / 1024 ** 2, 2)


async def measure_gallery(browser, playwright, profile, base):
    context, page = await new_page(browser, playwright, profile)
    sizes = []
    page.on('requestfinished', lambda r: asyncio.ensure_future(r.sizes()).add_done_callback(lambda f: f.cancelled() or f.exception() or sizes.append(f.result()['responseBodySize'] + f.result()['responseHeadersSize'])))
    await page.add_init_script("window.__lcp=0;new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true})")
    start = time.monotonic()
    await page.goto(base + '/')
    await page.wait_for_function("document.querySelector('#result-count')?.textContent.endsWith('assets')", timeout=TIMEOUT_S * 1000)
    searchable = time.monotonic() - start
    await page.wait_for_function("(()=>{const i=[...document.querySelectorAll('.asset-card img')].slice(0,4);return i.length===4&&i.every(x=>x.complete&&x.naturalWidth)})()", timeout=TIMEOUT_S * 1000)
    first_images = time.monotonic() - start
    fcp = await page.evaluate("performance.getEntriesByName('first-contentful-paint')[0]?.startTime||0")
    lcp = await page.evaluate('window.__lcp')
    await asyncio.sleep(0.5)
    await context.close()
    return {'fcpS': round(fcp / 1000, 2), 'lcpS': round(lcp / 1000, 2), 'searchReadyS': round(searchable, 2), 'firstImagesS': round(first_images, 2), 'mb': transferred_mb(sizes)}


def track_network(page):
    """Counts transferred bytes and in-flight requests."""
    sizes, inflight = [], {'n': 0, 'idle_since': time.monotonic()}
    def settle(delta):
        inflight['n'] += delta
        if inflight['n'] == 0: inflight['idle_since'] = time.monotonic()
    def record(future):
        if not future.cancelled() and not future.exception(): sizes.append(future.result()['responseBodySize'])
    page.on('request', lambda r: settle(1))
    page.on('requestfailed', lambda r: settle(-1))
    page.on('requestfinished', lambda r: (settle(-1), asyncio.ensure_future(r.sizes()).add_done_callback(record)))
    return sizes, inflight


async def await_viewer(page, inflight, start):
    deadline = time.monotonic() + TIMEOUT_S
    while time.monotonic() < deadline:
        events = await page.evaluate('__ev')
        if any(e['type'] == 'error' for e in events): return {'readyS': None, 'texturesDoneS': None, 'error': 'viewer error'}
        ready = next((e for e in events if e['type'] == 'ready'), None)
        if ready and inflight['n'] == 0 and time.monotonic() - inflight['idle_since'] > 2:
            return {'readyS': round(ready['t'] / 1000, 1), 'texturesDoneS': round(inflight['idle_since'] - start, 1), 'error': None}
        await asyncio.sleep(0.5)
    return {'readyS': None, 'texturesDoneS': None, 'error': f'timeout {TIMEOUT_S}s'}


async def measure_model(browser, playwright, profile, base, model_url):
    context, page = await new_page(browser, playwright, profile)
    sizes, inflight = track_network(page)
    await page.add_init_script("window.__ev=[];addEventListener('message',e=>{if(e.data?.source==='atlas-viewer')__ev.push({type:e.data.type,f:e.data.fraction,t:performance.now()})})")
    start = time.monotonic()
    await page.goto(f'{base}/vendor/usd/index.html#model={model_url}')
    result = await await_viewer(page, inflight, start)
    result['mb'] = transferred_mb(sizes)
    await context.close()
    return result


def estimate_s(mb, profile):
    return round(mb * 1024 ** 2 / profile['net']['downloadThroughput'], 0) if profile['net'] else 0


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', default='http://127.0.0.1:4175')
    args = parser.parse_args()
    report = {'profiles': [], 'modelBytes': {}}
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        for profile in PROFILES:
            row = {'profile': profile['name'], 'gallery': await measure_gallery(browser, p, profile, args.base), 'models': {}}
            print(profile['name'], 'gallery', row['gallery'], flush=True)
            for label, path in MODELS.items():
                for variant, url in (('original', HF + path), ('optimized', MIRROR + path)):
                    known = report['modelBytes'].get(f'{label}:{variant}')
                    if known and estimate_s(known, profile) > TIMEOUT_S:
                        result = {'skipped': True, 'estimatedS': estimate_s(known, profile), 'mb': known}
                    else:
                        result = await measure_model(browser, p, profile, args.base, url)
                        report['modelBytes'].setdefault(f'{label}:{variant}', result['mb'])
                    row['models'][f'{label} {variant}'] = result
                    print(' ', label, variant, result, flush=True)
            report['profiles'].append(row)
        await browser.close()
    out = ROOT / 'reports' / 'perf'; out.mkdir(parents=True, exist_ok=True)
    (out / 'mobile-perf.json').write_text(json.dumps(report, indent=2))


asyncio.run(main())
