"""Browser interaction tests. Default: real HTTP origin. --in-memory: local content harness.
Install: python3 -m pip install playwright && python3 -m playwright install chromium
The in-memory harness is for environments whose browser blocks navigation. It runs the
actual UI/search source with mocked I/O, storage and history; it is NOT a deployed E2E test.
"""
import argparse, asyncio, json, os, shutil
from pathlib import Path
from playwright.async_api import async_playwright
from browser_harness import ROOT, memory_mount
from browser_checks import REPORTS, Session, check_gallery, check_search_and_filters, check_saving, check_preview_navigation, check_preview_panels, check_preview_viewer_and_close
from browser_collection_checks import check_collections, check_library_transfer, check_collection_delete
from browser_layout_checks import check_keyboard_and_theme, check_history, check_responsive_gallery, check_mobile_drawer, check_mobile_preview, check_stress

SCENARIOS = [
    check_gallery, check_search_and_filters, check_saving,
    check_preview_navigation, check_preview_panels, check_preview_viewer_and_close,
    check_collections, check_library_transfer, check_collection_delete,
    check_keyboard_and_theme, check_history, check_responsive_gallery, check_mobile_drawer, check_mobile_preview,
]
LIMITATIONS = ['In-memory mode replaces network, module loading, history, clipboard and storage; it is not a deployed E2E test.',
               'Real Hugging Face files, external USD/WASM rendering, authenticated Jev calls and Cloudflare deployment are not exercised.']


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--in-memory', action='store_true', help='Use explicit mocked I/O when browser navigation is restricted.')
    parser.add_argument('--url', default='http://127.0.0.1:4173')
    parser.add_argument('--catalog', help='Catalog JSON for --in-memory runs; defaults to the published manifest.')
    return parser.parse_args()


def load_fixture(catalog_arg):
    manifest = json.loads((ROOT / 'public/catalog-manifest.json').read_text())
    path = Path(catalog_arg) if catalog_arg else ROOT / 'public' / manifest['url'].lstrip('/')
    catalog = json.loads(path.read_text())
    if len(catalog['assets']) != 15 or catalog['mode'] != 'preview':
        raise RuntimeError('This regression suite uses the bundled 15-object preview fixture. Run it before replacing the catalog, or use a separate checkout.')
    return catalog


async def open_app(browser, args, catalog):
    context = await browser.new_context(viewport={'width': 1440, 'height': 1000}, color_scheme='dark', reduced_motion='reduce', accept_downloads=True)
    page = await context.new_page()
    session = Session(page=page, catalog=catalog, in_memory=args.in_memory)
    page.on('pageerror', lambda error: session.errors.append(str(error)))
    if args.in_memory: await memory_mount(page, catalog)
    else:
        await page.goto(args.url)
        await page.wait_for_selector('.asset-card')
    return context, session


def write_report(args, browser, session, mounted):
    report = {'mode': 'in-memory Chromium interaction harness' if args.in_memory else 'HTTP-origin browser integration', 'browser': browser.version,
              'checksPassed': len(session.checks), 'checks': session.checks, 'errors': session.errors,
              'syntheticStress': {'records': 2575, 'mountedCards': mounted, 'maxFilmstrip': 9}, 'limitations': LIMITATIONS}
    (REPORTS / 'browser.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


async def main():
    args = parse_args()
    REPORTS.mkdir(exist_ok=True)
    catalog = load_fixture(args.catalog)
    async with async_playwright() as p:
        executable = os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium')
        browser = await p.chromium.launch(**({'executable_path': executable} if executable else {}), headless=True, args=['--no-sandbox'])
        context, session = await open_app(browser, args, catalog)
        for scenario in SCENARIOS: await scenario(session)
        mounted = await check_stress(session, context, args.url)
        assert not session.errors, session.errors
        session.passed('No uncaught JavaScript errors during interaction checks')
        write_report(args, browser, session, mounted)
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
