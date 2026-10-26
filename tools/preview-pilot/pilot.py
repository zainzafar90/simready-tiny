"""Self-hosted preview pilot: record what the viewer fetches, mirror it with smaller textures, compare.

Run with the dev server up (npm run dev):
  python3 tools/preview-pilot/pilot.py --count 10 [--max-texture 1024]
Writes mirrored files to public/preview-models/ and a report to reports/preview-pilot.json.
"""
import argparse, asyncio, json, shutil, subprocess, tempfile, time, urllib.request
from pathlib import Path
from urllib.parse import urlparse, unquote
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
BASE = 'http://127.0.0.1:4173'
HF_PREFIX = '/datasets/nvidia/simready-assets/resolve/'
OUT = ROOT / 'public' / 'preview-models'
IMAGE_EXTS = {'.png', '.jpg', '.jpeg'}
LOAD_TIMEOUT_S = 180


def pick_assets(count):
    manifest = json.loads((ROOT / 'public/catalog-manifest.json').read_text())
    catalog = json.loads((ROOT / 'public' / manifest['url'].lstrip('/')).read_text())
    sized = sorted((a for a in catalog['assets'] if a.get('packageSizeBytes')), key=lambda a: a['packageSizeBytes'])
    auto = [a for a in sized if a['packageSizeBytes'] <= 250 * 1024 ** 2]
    step = max(1, len(auto) // count)
    return catalog['revision'], [auto[min(len(auto) - 1, i * step + step // 2)] for i in range(count)]


def hf_relative(url):
    path = urlparse(url).path
    return unquote(path[len(HF_PREFIX):]) if path.startswith(HF_PREFIX) else None


async def load_in_viewer(browser, model_url, shot_path):
    context = await browser.new_context(viewport={'width': 900, 'height': 900}, service_workers='block')
    page = await context.new_page()
    files = {}

    async def on_finished(request):
        origin = request
        while origin.redirected_from: origin = origin.redirected_from
        sizes = await request.sizes()
        files[origin.url] = files.get(origin.url, 0) + sizes['responseBodySize']
    page.on('requestfinished', lambda r: asyncio.ensure_future(on_finished(r)))
    await page.add_init_script("window.__events=[];addEventListener('message',e=>{if(e.data?.source==='atlas-viewer')__events.push({...e.data,t:performance.now()})})")
    start = time.monotonic()
    await page.goto(f'{BASE}/vendor/usd/index.html#model={model_url}')
    result = {'ready_s': None, 'error': None}
    while time.monotonic() - start < LOAD_TIMEOUT_S:
        events = await page.evaluate('__events')
        done = next((e for e in events if e['type'] in ('ready', 'error')), None)
        if done:
            result['ready_s'] = round(done['t'] / 1000, 2) if done['type'] == 'ready' else None
            result['error'] = done.get('message') if done['type'] == 'error' else None
            break
        await asyncio.sleep(0.25)
    await page.wait_for_load_state('networkidle', timeout=LOAD_TIMEOUT_S * 1000)
    result['done_s'] = round(time.monotonic() - start, 2)
    await page.screenshot(path=str(shot_path))
    await context.close()
    result['files'] = files
    return result


def shrink_image(path, max_size):
    info = subprocess.run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', str(path)], capture_output=True, text=True, check=True).stdout
    width, height = (int(line.split(':')[1]) for line in info.splitlines()[1:3])
    if max(width, height) <= max_size: return False
    subprocess.run(['sips', '-Z', str(max_size), str(path)], capture_output=True, check=True)
    return True


def mirror(revision, urls, max_size):
    resized = 0
    for url in urls:
        relative = hf_relative(url)
        if not relative or not relative.startswith(revision + '/'): continue
        target = OUT / relative
        if target.exists(): continue
        target.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as temp:
            with urllib.request.urlopen(url, timeout=120) as response: shutil.copyfileobj(response, temp)
        tmp_path = Path(temp.name)
        try:
            if target.suffix.lower() in IMAGE_EXTS: resized += shrink_image(tmp_path, max_size)
            tmp_path.rename(target)
        finally:
            tmp_path.unlink(missing_ok=True)
    return resized


def summarize(run):
    hf = {u: n for u, n in run['files'].items() if hf_relative(u) or '/preview-models/' in u}
    return {'readyS': run['ready_s'], 'doneS': run['done_s'], 'error': run['error'], 'files': len(hf), 'mb': round(sum(hf.values()) / 1024 ** 2, 2)}


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--count', type=int, default=10)
    parser.add_argument('--max-texture', type=int, default=1024)
    args = parser.parse_args()
    revision, assets = pick_assets(args.count)
    shots = ROOT / 'reports' / 'preview-pilot'; shots.mkdir(parents=True, exist_ok=True)
    rows = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        for asset in assets:
            name = asset['packagePath']
            original = await load_in_viewer(browser, asset['usdUrl'], shots / f'{name}-original.png')
            resized = mirror(revision, original['files'], args.max_texture)
            local_url = f"{BASE}/preview-models/{revision}/{asset['usdPath']}"
            optimized = await load_in_viewer(browser, local_url, shots / f'{name}-optimized.png')
            row = {'asset': name, 'packageMb': round(asset['packageSizeBytes'] / 1024 ** 2, 1), 'resizedTextures': resized, 'original': summarize(original), 'optimized': summarize(optimized)}
            rows.append(row)
            print(json.dumps(row), flush=True)
        await browser.close()
    total = lambda key: round(sum(r[key]['mb'] for r in rows), 1)
    report = {'maxTexture': args.max_texture, 'assets': rows, 'originalMb': total('original'), 'optimizedMb': total('optimized'),
              'note': 'Optimized copies are served from localhost, so their times exclude real network latency.'}
    (ROOT / 'reports' / 'preview-pilot.json').write_text(json.dumps(report, indent=2))
    print(f"Transferred: {report['originalMb']} MB original -> {report['optimizedMb']} MB optimized")


asyncio.run(main())
