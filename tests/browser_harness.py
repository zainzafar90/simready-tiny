"""In-memory harness: runs the real UI modules with mocked network, storage and history."""
import base64, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

IMPORT = re.compile(r'^import\s+(?:\{([^}]*)\}\s+from\s+)?[\'"]([^\'"]+)[\'"];[ \t]*\n?', re.M)
DYNAMIC = re.compile(r'import\(\s*[\'"]([^\'"]+)[\'"]\s*\)')
EXPORT_NAME = re.compile(r'\bexport\s+(?:async\s+)?(?:function\*?|class|const|let)\s+([A-Za-z_$][\w$]*)')
GLOBALS = ("const location=window.__atlasLocation,history=window.__atlasHistory,localStorage=window.__atlasStorage,"
           "fetch=window.__atlasFetch,Worker=window.__atlasWorker;"
           "const crypto={randomUUID:()=>Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('')};")
MOCKS = {
    'shared/html': "const m=window.__atlasModules['shared/html'],original=m.safeUrl;m.safeUrl=(value,relative=false)=>window.__images[value]||original(value,relative);",
    'shared/browser-io': "const m=window.__atlasModules['shared/browser-io'];m.downloadJSON=(name,data)=>window.__exported={name,data};m.copyText=async text=>{window.__copied=text;};",
}

def module_key(path):
    return path.relative_to(ROOT / 'src').with_suffix('').as_posix()

def module_script(path):
    """Rewrites one ES module into a script that registers its exports."""
    text = path.read_text()
    near = lambda spec: (path.parent / spec).resolve()
    deps, prelude = [], []
    for names, spec in IMPORT.findall(text):
        deps.append(near(spec))
        if names.strip():
            prelude.append(f"const {{{names.replace(' as ', ':')}}}=window.__atlasModules[{json.dumps(module_key(near(spec)))}];")
    deps += [near(spec) for spec in DYNAMIC.findall(text)]
    body = IMPORT.sub('', text)
    body = DYNAMIC.sub(lambda m: f"Promise.resolve(window.__atlasModules[{json.dumps(module_key(near(m.group(1))))}])", body)
    body = body.replace('import.meta.url', "'http://atlas.test/src/app.js'")
    exports = EXPORT_NAME.findall(body)
    body = re.sub(r'\bexport\s+(?=(?:async\s+)?(?:function|class|const|let))', '', body)
    script = f"window.__atlasModules[{json.dumps(module_key(path))}]=(()=>{{{GLOBALS}{''.join(prelude)}\n{body}\nreturn {{{','.join(exports)}}};}})();"
    return deps, script

def module_order(entry):
    """Dependency-first order; cycles are rejected because scripts cannot share live bindings."""
    order, done, visiting = [], set(), []
    def visit(path):
        if path in done: return
        if path in visiting: raise RuntimeError('Import cycle: ' + ' -> '.join(module_key(p) for p in visiting + [path]))
        visiting.append(path)
        deps, script = module_script(path)
        for dep in deps: visit(dep)
        visiting.pop(); done.add(path)
        order.append((module_key(path), script))
    visit(entry)
    return order

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
    engine=(ROOT/'src/search/search-engine.js').read_text()
    engine=re.sub(r'\bexport\s+(?=function|class|const)','',engine)
    worker=(ROOT/'src/search/search.worker.js').read_text();worker=re.sub(r'^import .*?;\s*','',worker,flags=re.M)
    worker_prelude='const fixture='+json.dumps(catalog)+"; const fetch=async path=>new Response(JSON.stringify(path==='/catalog-manifest.json'?{url:'/data/catalog.abcdef.json'}:fixture));\n"
    await page.evaluate('''code=>{window.__atlasWorker=class{constructor(){const blob=new Blob([code],{type:'text/javascript'});const url=URL.createObjectURL(blob);const worker=new Worker(url);setTimeout(()=>URL.revokeObjectURL(url),2000);return worker;}}}''',worker_prelude+engine+'\n'+worker)
    for key, script in module_order(ROOT / 'src' / 'app.js'):
        await page.add_script_tag(content=script)
        if key in MOCKS: await page.evaluate('()=>{' + MOCKS[key] + '}')
    await page.wait_for_selector('.asset-card')
