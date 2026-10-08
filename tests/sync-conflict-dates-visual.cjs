// Isolated UI verification; external services and user sessions are excluded.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('/Users/marcos/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
(async()=>{
  const server=http.createServer((req,res)=>{res.writeHead(req.url==='/'?200:204,{'Content-Type':'text/html; charset=utf-8'});res.end(req.url==='/'?html:'');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;let browser;
  try{
    browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
    const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/New_York'});
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(origin);
    await page.evaluate(()=>{
      localStorage.setItem('mrp_last_local_change','2026-10-08T09:41:18.000Z');
      showConflictModal({stocks:[{id:'local'}],crypto:[]},{stocks:[{id:'cloud'}],crypto:[]},'2026-10-06T18:57:30.000Z');
    });
    assert.match(await page.locator('#conflictLocalInfo').textContent(),/8\/10\/26, 11:41:18 \(Madrid\)/);
    assert.match(await page.locator('#conflictCloudInfo').textContent(),/6\/10\/26, 20:57:30 \(Madrid\)/);
    assert(await page.locator('#btnConflictConfirm').isDisabled());
    await page.locator('#conflictModalOverlay .modal').screenshot({path:'/private/tmp/mrp-sync-dates-desktop.png'});
    await page.setViewportSize({width:390,height:844});
    for(const id of ['conflictLocalInfo','conflictCloudInfo']){
      assert(await page.locator('#'+id).isVisible());
      assert(await page.locator('#'+id).evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    }
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.locator('#conflictModalOverlay .modal').screenshot({path:'/private/tmp/mrp-sync-dates-mobile.png'});
    await page.evaluate(()=>{localStorage.removeItem('mrp_last_local_change');showConflictModal({stocks:[],crypto:[]},{stocks:[],crypto:[]},null);});
    assert.match(await page.locator('#conflictLocalInfo').textContent(),/Fecha desconocida$/);
    assert.match(await page.locator('#conflictCloudInfo').textContent(),/Fecha desconocida$/);
    assert(await page.locator('#btnConflictConfirm').isDisabled());
    assert.deepEqual(errors,[]);
    console.log('OK fechas de conflicto UI: desktop/móvil, horario Madrid independiente del navegador, sin elección automática ni red externa.');
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
