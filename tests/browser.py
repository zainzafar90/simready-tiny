"""Browser interaction tests. Default: real HTTP origin. --in-memory: local content harness.
Install: python3 -m pip install playwright && python3 -m playwright install chromium
The in-memory harness is for environments whose browser blocks navigation. It runs the
actual UI/search source with mocked I/O, storage and history; it is NOT a deployed E2E test.
"""
import argparse, asyncio, base64, json, os, re, shutil, subprocess, time
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / 'reports'

def module_source(name, exports, imports=''):
    text=(ROOT/'src'/f'{name}.js').read_text()
    text=re.sub(r'^import .*?;\s*', '', text, flags=re.M)
    text=re.sub(r'\bexport\s+(?=(?:async\s+)?function|class|const|let)', '', text)
    prelude='const location=window.__atlasLocation, history=window.__atlasHistory, localStorage=window.__atlasStorage, fetch=window.__atlasFetch;'
    return f'window.__atlasModules[{json.dumps(name)}]=(()=>{{{prelude}{imports}\n{text}\nreturn {{{exports}}};}})();'

async def memory_mount(page, catalog, stress=False):
    html=(ROOT/'index.html').read_text()
    html=re.sub(r'<link[^>]*>', '', html)
    html=re.sub(r'<script.*?</script>', '', html, flags=re.S)
    html=html.replace('</head>','<style>'+(ROOT/'src/styles.css').read_text()+'</style></head>')
    await page.set_content(html)
    used={a.get('thumbnailUrl') for a in catalog['assets']}|{'/thumbs/food_produce_banana_m01.webp'}
    image_map={f'/thumbs/{f.name}':'data:image/webp;base64,'+base64.b64encode(f.read_bytes()).decode() for f in (ROOT/'public/thumbs').glob('*.webp') if f'/thumbs/{f.name}' in used}
    await page.evaluate('''({catalog,images,config})=>{
      window.__atlasModules={}; window.__catalog=catalog;window.__images=images;
      window.__atlasLocation={href:'http://atlas.test/',origin:'http://atlas.test',pathname:'/',reload:()=>{}};
      const stack=[{state:null,url:'/'}];let index=0;
      const update=()=>{const u=new URL(stack[index].url,'http://atlas.test');Object.assign(window.__atlasLocation,{href:u.href,pathname:u.pathname});};
      window.__atlasHistory={get state(){return stack[index].state},replaceState(s,unused,url){stack[index]={state:s,url};update()},pushState(s,unused,url){stack.splice(++index);stack[index]={state:s,url};update()},back(){if(index){index--;update();queueMicrotask(()=>window.dispatchEvent(new PopStateEvent('popstate',{state:stack[index].state}))) }},forward(){if(index<stack.length-1){index++;update();queueMicrotask(()=>window.dispatchEvent(new PopStateEvent('popstate',{state:stack[index].state})))}}};
      const storage=new Map();window.__atlasStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))};
      window.__atlasFetch=async path=>path==='/config.json'?new Response(JSON.stringify(config),{status:200}):new Response('missing',{status:404});
    }''',{'catalog':catalog,'images':image_map,'config':json.loads((ROOT/'public/config.json').read_text())})
    engine=(ROOT/'src/search-engine.js').read_text()
    engine=re.sub(r'\bexport\s+(?=function|class|const)','',engine)
    worker=(ROOT/'src/search.worker.js').read_text();worker=re.sub(r'^import .*?;\s*','',worker,flags=re.M)
    worker_prelude='const fixture='+json.dumps(catalog)+"; const fetch=async path=>new Response(JSON.stringify(path==='/catalog-manifest.json'?{url:'/data/catalog.abcdef.json'}:fixture));\n"
    await page.evaluate('''code=>{window.__atlasWorker=class{constructor(){const blob=new Blob([code],{type:'text/javascript'});const url=URL.createObjectURL(blob);const worker=new Worker(url);setTimeout(()=>URL.revokeObjectURL(url),2000);return worker;}}}''',worker_prelude+engine+'\n'+worker)
    await page.add_script_tag(content=module_source('utils','escapeHtml,safeUrl,formatBytes,readStorage,writeStorage,parseState,stateUrl,validatedSaved,downloadJSON,copyText'))
    await page.evaluate('''()=>{const u=window.__atlasModules.utils,original=u.safeUrl;u.safeUrl=(value,relative=false)=>window.__images[value]||original(value,relative);u.downloadJSON=(name,data)=>window.__exported={name,data};u.copyText=async text=>{window.__copied=text;};}''')
    await page.add_script_tag(content=module_source('icons','icon,categoryIcon'))
    await page.add_script_tag(content=module_source('load-policy','AUTO_LOAD_LIMIT_BYTES,autoLoadLimitBytes,currentNetwork,shouldAutoLoad,loadTag'))
    await page.add_script_tag(content=module_source('collections','normalizeCollections,createCollection,collectionName,mergeCollections'))
    imports="const {escapeHtml:e,safeUrl,formatBytes}=window.__atlasModules.utils;const {icon}=window.__atlasModules.icons;const {currentNetwork,loadTag}=window.__atlasModules['load-policy'];"
    await page.add_script_tag(content=module_source('virtual-grid','VirtualGrid',imports))
    await page.add_script_tag(content=module_source('detail-viewer','createViewer,clampFraction,stageLabel'))
    imports="const {escapeHtml:e,safeUrl,formatBytes,copyText}=window.__atlasModules.utils;const {icon}=window.__atlasModules.icons;const {createViewer}=window.__atlasModules['detail-viewer'];const {shouldAutoLoad}=window.__atlasModules['load-policy'];"
    await page.add_script_tag(content=module_source('detail','openDetail,packageCommand',imports))
    app=(ROOT/'src/app.js').read_text();app=re.sub(r'^import .*?;\s*','',app,flags=re.M)
    app=app.replace("import('./detail.js')","Promise.resolve(window.__atlasModules.detail)").replace('import.meta.url',"'http://atlas.test/app/app.js'")
    prelude="const {icon,categoryIcon}=window.__atlasModules.icons;const {escapeHtml:e,readStorage,writeStorage,parseState,stateUrl,validatedSaved,downloadJSON}=window.__atlasModules.utils;const {VirtualGrid}=window.__atlasModules['virtual-grid'];const {normalizeCollections,createCollection,collectionName,mergeCollections}=window.__atlasModules.collections;const crypto={randomUUID:()=>Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('')};const location=window.__atlasLocation,history=window.__atlasHistory,fetch=window.__atlasFetch,Worker=window.__atlasWorker;"
    await page.add_script_tag(content='(()=>{'+prelude+'\n'+app+'})();')
    await page.wait_for_selector('.asset-card')


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--in-memory', action='store_true', help='Use explicit mocked I/O when browser navigation is restricted.')
    parser.add_argument('--url', default='http://127.0.0.1:4173')
    parser.add_argument('--catalog', help='Catalog JSON for --in-memory runs; defaults to the published manifest.')
    args = parser.parse_args()
    REPORTS.mkdir(exist_ok=True)
    manifest = json.loads((ROOT / 'public/catalog-manifest.json').read_text())
    catalog_path = Path(args.catalog) if args.catalog else ROOT / 'public' / manifest['url'].lstrip('/')
    catalog = json.loads(catalog_path.read_text())
    if len(catalog['assets']) != 15 or catalog['mode'] != 'preview':
        raise RuntimeError('This regression suite uses the bundled 15-object preview fixture. Run it before replacing the catalog, or use a separate checkout.')
    checks, errors = [], []
    def passed(name):
        checks.append(name)
        print('PASS', name, flush=True)
    async def results(page, text):
        await page.wait_for_function('(text) => document.querySelector("#result-count").textContent === text', arg=text)
    async def shot(page, name):
        # Drop test-created focus rings; keyboard visibility is checked separately.
        await page.evaluate('document.activeElement?.blur()')
        await page.screenshot(path=str(REPORTS / name), full_page=True)
    async with async_playwright() as p:
        executable = os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium')
        browser = await p.chromium.launch(**({'executable_path': executable} if executable else {}), headless=True, args=['--no-sandbox'])
        context = await browser.new_context(viewport={'width': 1440, 'height': 1000}, color_scheme='dark', reduced_motion='reduce', accept_downloads=True)
        page = await context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        if args.in_memory: await memory_mount(page, catalog)
        else:
            await page.goto(args.url)
            await page.wait_for_selector('.asset-card')
        await results(page, '15 assets')
        assert await page.locator('html').get_attribute('data-theme') == 'light'
        passed('Fresh install defaults to light even with a dark OS preference')
        assert await page.locator('#asset-grid .asset-card').count() <= 15
        assert await page.locator('.asset-card').first.evaluate('el=>el.clientWidth') >= 180
        assert await page.evaluate("new Set([...document.querySelectorAll('.asset-card')].map(c=>c.style.left)).size") >= 5
        passed('Desktop layout fits five or more object columns')
        assert await page.locator('iframe,canvas').count() == 0
        passed('Browsing does not create a WebGL canvas or 3D iframe')
        await shot(page, 'desktop.png')
        await page.locator('#search').fill('bannana')
        await results(page, '1 asset')
        assert await page.locator('.asset-name').inner_text() == 'Banana'
        passed('Typo-tolerant search uses the real Web Worker')
        await page.locator('#search').fill('zqxwkjgfr')
        await results(page, '0 assets')
        assert await page.locator('#empty-state').is_visible()
        await page.locator('#empty-state [data-action="reset"]').click()
        await results(page, '15 assets')
        passed('Empty search recovers to the full gallery')
        await page.locator('[data-category="Food & produce"]').click()
        await results(page, '3 assets')
        assert await page.locator('#page-title').inner_text() == 'Food & produce'
        passed('Category selection updates the title, counts, and results')
        await page.locator('[data-action="reset-category"]').first.click()
        await results(page, '15 assets')
        await page.locator('#sort').select_option('name')
        await results(page, '15 assets')
        assert await page.locator('#sort').input_value() == 'name'
        await page.locator('#sort').select_option('relevance')
        passed('Inline sort control works')
        await page.locator('[data-view="list"]').click()
        await page.wait_for_selector('.asset-card.list')
        await page.locator('[data-view="grid"]').click()
        await page.wait_for_selector('.asset-card:not(.list)')
        passed('List and grid views share the same search state')
        await page.locator('.asset-card').first.hover()
        await page.locator('[data-save]').first.click()
        assert await page.locator('#saved-count').inner_text() == '1'
        await page.locator('#saved-assets').click()
        await results(page, '1 asset')
        await page.locator('#all-assets').click()
        await results(page, '15 assets')
        passed('Heart buttons and both saved navigation entry points work')
        await page.locator('[data-open]').first.click()
        await page.wait_for_selector('#asset-dialog[open]')
        assert await page.locator('#detail-title').inner_text() == 'Banana'
        assert await page.locator('#asset-info').is_visible()
        assert await page.locator('.film-thumb').count() == 9
        assert await page.locator('iframe,canvas').count() == 0
        passed('Full-screen preview shows details on desktop and nine thumbnails')
        await shot(page, 'detail.png')
        await page.locator('[data-detail="next"]').click()
        await page.wait_for_function('document.querySelector("#detail-title").textContent !== "Banana"')
        await page.keyboard.press('ArrowLeft')
        await page.wait_for_function('document.querySelector("#detail-title").textContent === "Banana"')
        assert await page.locator('[data-detail="previous"]').is_disabled()
        passed('Next/previous buttons and arrow keys follow the current results')
        await page.locator('.film-thumb').nth(2).click()
        await page.wait_for_function('document.querySelector("#detail-title").textContent === "CT injection system"')
        await page.keyboard.press('s')
        assert await page.locator('[data-detail="save"]').get_attribute('aria-pressed') == 'true'
        passed('Thumbnail navigation and save shortcut work')
        assert await page.locator('#asset-info').is_visible()
        await page.keyboard.press('i')
        assert await page.locator('#asset-info').is_hidden()
        await page.keyboard.press('i')
        assert await page.locator('#asset-info').is_visible()
        await shot(page, 'detail-info.png')
        await page.locator('[data-detail="info-close"]').click()
        assert await page.locator('#asset-info').is_hidden()
        passed('Desktop opens details by default; the panel still collapses')
        await page.locator('[data-detail="download"]').click()
        assert await page.locator('#download-menu').is_visible()
        await page.keyboard.press('Escape')
        assert await page.locator('#download-menu').is_hidden()
        assert await page.locator('#asset-dialog').evaluate('el=>el.open')
        passed('Escape dismisses download options before closing the preview')
        if args.in_memory:
            await page.locator('[data-detail="more"]').click()
            await page.locator('[data-detail="share"]').click()
            shared = await page.evaluate('window.__copied')
            assert '?asset=' in shared and 'collection=' not in shared and 'saved=' not in shared
            passed('Shared asset links exclude device-local filters and collections')
            await page.locator('[data-detail="download"]').click()
            await page.locator('#download-menu [data-detail="command"]').click()
            assert '--include' in await page.evaluate('window.__copied')
            passed('Full-package download command can be copied')
        await page.wait_for_function('document.querySelector("#viewer-status").textContent.includes("not installed")')
        assert await page.locator('iframe').count() == 0
        assert await page.locator('#detail-preview img').count() == 1
        assert 'Retry' in await page.locator('[data-detail="viewer"]').inner_text()
        passed('3D loads automatically; a missing viewer keeps the image and offers Retry')
        await page.keyboard.press('Tab')
        assert await page.evaluate('document.querySelector("#asset-dialog").contains(document.activeElement)')
        passed('Native modal keeps keyboard focus inside the preview')
        await page.keyboard.press('Escape')
        await page.wait_for_function('!document.querySelector("#asset-dialog").open')
        assert await page.locator('#asset-dialog').evaluate('el=>el.children.length') == 0
        passed('Closing clears preview content and restores the gallery')
        await page.locator('[data-action="new-collection"]').first.click()
        await page.locator('#collection-name').fill('Robot workshop')
        await page.locator('#collection-form button[type="submit"]').click()
        await results(page, '0 assets')
        assert await page.locator('#page-title').inner_text() == 'Robot workshop'
        assert await page.locator('#collections [data-collection]').count() == 1
        passed('New named collections persist and have an intentional empty state')
        await page.locator('#all-assets').click()
        await results(page, '15 assets')
        await page.locator('[data-open]').first.click()
        await page.locator('[data-detail="more"]').click()
        await page.locator('[data-detail="collection"]').click()
        await page.locator('.collection-choice input').check()
        await page.locator('#collection-picker button[type="submit"]').click()
        assert not await page.locator('#collection-dialog').evaluate('el=>el.open')
        assert await page.locator('#asset-dialog').evaluate('el=>el.open')
        await page.keyboard.press('Escape')
        await page.locator('#collections [data-collection]').click()
        await results(page, '1 asset')
        assert await page.locator('.asset-name').inner_text() == 'Banana'
        passed('Collection membership is editable from a nested preview dialog')
        await page.locator('#collection-manage').click()
        await page.locator('#collection-name').fill('Kitchen scene')
        await page.locator('#collection-form button[type="submit"]').click()
        await page.wait_for_function('document.querySelector("#page-title").textContent === "Kitchen scene"')
        passed('Renaming a collection updates sidebar and gallery')
        if args.in_memory:
            await page.locator('[data-action="export"]').click()
            exported = await page.evaluate('window.__exported.data')
            assert exported['version'] == 2 and exported['collections'][0]['name'] == 'Kitchen scene'
            passed('Library export includes saved IDs and named collections')
            imported = {'version': 2, 'dataset': 'nvidia/simready-assets', 'ids': [catalog['assets'][1]['id']], 'collections': [{'id': 'imported', 'name': 'Imported collection', 'ids': [catalog['assets'][1]['id']]}]}
            await page.locator('#import-file').set_input_files({'name':'atlas-library.json','mimeType':'application/json','buffer':json.dumps(imported).encode()})
            await page.wait_for_function('document.querySelectorAll("#collections [data-collection]").length === 2')
            passed('Versioned collection import merges without replacing existing collections')
        await page.locator('#collection-manage').click()
        await page.locator('#delete-collection').click()
        await page.locator('#cancel-delete').click()
        assert await page.locator('#collection-name').input_value() == 'Kitchen scene'
        await page.locator('#delete-collection').click()
        await page.locator('#confirm-delete').click()
        await results(page, '15 assets')
        passed('Collection deletion requires confirmation and does not delete objects')
        await page.locator('[data-open]').first.focus()
        await page.keyboard.press('ArrowRight')
        assert await page.evaluate('document.activeElement.closest("[data-index]").dataset.index === "1"')
        await page.keyboard.press('/')
        assert await page.locator('#search').evaluate('el=>el===document.activeElement')
        passed('Gallery arrow keys and slash-to-search remain accessible')
        await page.locator('[data-action="theme"]').click()
        assert await page.locator('html').get_attribute('data-theme') == 'dark'
        await shot(page, 'dark.png')
        await page.locator('[data-action="theme"]').click()
        passed('Optional dark mode keeps the same visual hierarchy')
        await page.locator('[data-category="Food & produce"]').click()
        await results(page, '3 assets')
        if args.in_memory: await page.evaluate('window.__atlasHistory.back()')
        else: await page.go_back()
        await results(page, '15 assets')
        if args.in_memory: await page.evaluate('window.__atlasHistory.forward()')
        else: await page.go_forward()
        await results(page, '3 assets')
        await page.locator('#all-assets').click()
        await results(page, '15 assets')
        passed('Browser back and forward restore gallery state')
        for width in [1280, 800, 768, 390, 320]:
            await page.set_viewport_size({'width':width,'height':844})
            await page.wait_for_timeout(70)
            assert not await page.evaluate('document.documentElement.scrollWidth > innerWidth'), f'Overflow at {width}px'
        passed('Gallery has no horizontal overflow at 1280, 800, 768, 390, and 320px')
        await page.set_viewport_size({'width':390,'height':844})
        await page.wait_for_timeout(80)
        assert await page.locator('.asset-card').nth(1).evaluate('el=>Math.round(parseFloat(el.style.top))') == 0
        assert await page.locator('.asset-card').nth(2).evaluate('el=>parseFloat(el.style.top)') > 0
        passed('Mobile gallery keeps two columns')
        await shot(page, 'mobile.png')
        await page.locator('.filter-mobile').click()
        assert await page.locator('.workspace').evaluate('el=>el.inert')
        await page.locator('[data-category="Food & produce"]').click()
        await results(page, '3 assets')
        assert not await page.locator('.workspace').evaluate('el=>el.inert')
        passed('Mobile drawer closes after navigation and releases inert state')
        await page.locator('.filter-mobile').click()
        await page.keyboard.press('Escape')
        assert not await page.locator('#sidebar').evaluate('el=>el.classList.contains("open")')
        passed('Escape closes the mobile navigation drawer')
        await page.locator('.filter-mobile').click()
        await page.locator('#all-assets').click()
        await results(page, '15 assets')
        await page.locator('[data-open]').first.click()
        assert not await page.evaluate('document.documentElement.scrollWidth > innerWidth')
        await shot(page, 'mobile-detail.png')
        await page.locator('[data-detail="more"]').click()
        await page.locator('[data-detail="info"]').click()
        assert await page.locator('#asset-info').is_visible()
        assert await page.locator('#asset-info').evaluate('el=>el.getBoundingClientRect().right<=innerWidth+1')
        await shot(page, 'mobile-info.png')
        await page.locator('[data-detail="info-close"]').click()
        passed('Mobile preview and details sheet fit the viewport')
        await page.set_viewport_size({'width':320,'height':568})
        await page.wait_for_timeout(80)
        rect = await page.locator('.stage-frame').evaluate('el=>({w:el.clientWidth,h:el.clientHeight})')
        assert abs(rect['w']-rect['h']) <= 1
        assert await page.locator('.preview-actions').evaluate('el=>el.getBoundingClientRect().right<=innerWidth')
        passed('Compact 320px preview keeps square media and visible actions')
        await page.keyboard.press('Escape')
        # Synthetic data measures bounded UI cost without claiming it is the live NVIDIA catalog.
        stress = json.loads(subprocess.check_output(['node','--input-type=module','-e',"import{stressAssets}from'./tests/fixtures.mjs';console.log(JSON.stringify(stressAssets(2575)))"],cwd=ROOT))
        stress_catalog = {**catalog,'assets':stress,'mode':'snapshot','revision':'synthetic-test-only'}
        stress_page = await context.new_page()
        await stress_page.set_viewport_size({'width':1440,'height':1000})
        stress_page.on('pageerror',lambda error:errors.append(str(error)))
        if args.in_memory: await memory_mount(stress_page,stress_catalog)
        else:
            await stress_page.route('**/catalog-manifest.json',lambda route:route.fulfill(json={'url':'/data/catalog.abcdef.json'}))
            await stress_page.route('**/data/catalog.abcdef.json',lambda route:route.fulfill(json=stress_catalog))
            await stress_page.goto(args.url)
        await results(stress_page,'2,575 assets')
        mounted = await stress_page.locator('.asset-card').count()
        assert mounted <= 32
        passed(f'2,575-item desktop gallery mounts only {mounted} cards')
        await stress_page.locator('#results-scroll').evaluate('el=>el.scrollTop=el.scrollHeight')
        await stress_page.wait_for_timeout(100)
        assert await stress_page.locator('.asset-card').count() <= 32
        passed('Deep scrolling keeps the card DOM bounded')
        before = await stress_page.locator('#results-scroll').evaluate('el=>el.scrollTop')
        await stress_page.locator('[data-open]').last.click()
        await stress_page.wait_for_selector('#asset-dialog[open]')
        assert await stress_page.locator('.film-thumb').count() <= 9
        await stress_page.keyboard.press('ArrowLeft')
        await stress_page.keyboard.press('Escape')
        await stress_page.wait_for_function('!document.querySelector("#asset-dialog").open')
        await stress_page.wait_for_timeout(100)
        after = await stress_page.locator('#results-scroll').evaluate('el=>el.scrollTop')
        assert abs(before-after)<2, (before,after)
        passed('Preview navigation and close preserve deep gallery scroll')
        await stress_page.locator('#search').fill('banana')
        await results(stress_page,'129 assets')
        passed('Search remains correct after 2,575-item deep-scroll navigation')
        assert not errors, errors
        passed('No uncaught JavaScript errors during interaction checks')
        report = {'mode':'in-memory Chromium interaction harness' if args.in_memory else 'HTTP-origin browser integration', 'browser':browser.version, 'checksPassed':len(checks), 'checks':checks, 'errors':errors, 'syntheticStress':{'records':2575,'mountedCards':mounted,'maxFilmstrip':9}, 'limitations':['In-memory mode replaces network, module loading, history, clipboard and storage; it is not a deployed E2E test.','Real Hugging Face files, external USD/WASM rendering, authenticated Jev calls and Cloudflare deployment are not exercised.']}
        (REPORTS/'browser.json').write_text(json.dumps(report,indent=2))
        print(json.dumps(report,indent=2))
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
