// Synthetic portfolio only; all external requests are intercepted.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const {chromium}=require('/Users/marcos/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
(async()=>{
  const server=http.createServer((req,res)=>res.end(html));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin=`http://127.0.0.1:${server.address().port}`;
  let browser;
  try{
    browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    let fail=false,requests=[];
    await context.route('**/*',async route=>{
      const req=route.request();
      if(req.url().includes('/functions/v1/portfolio-news')){
        const asset=req.postDataJSON();requests.push(asset);
        return route.fulfill({status:fail?502:200,contentType:'application/json',body:JSON.stringify(fail?{error:'Unavailable'}:{items:[{sym:asset.symbol,title:'Noticia <img src=x onerror=alert(1)> '+asset.symbol,link:'https://news.google.com/articles/test',source:'Fuente de prueba',pubDate:'2026-10-04T10:00:00Z',language:asset.kind==='etf'?'en':'es'}]})});
      }
      return req.url().startsWith(origin)?route.continue():route.abort();
    });
    await context.addInitScript(()=>Object.defineProperty(navigator,'onLine',{get:()=>false}));
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin,{waitUntil:'domcontentloaded'});await page.waitForTimeout(400);
    await page.evaluate(()=>{
      ST.crypto=Array.from({length:10},(_,i)=>({id:'test'+i,positionId:'test'+i,sym:'T'+i,name:'Test '+i,qty:1,buy:10,openCost:10,cur:12,wallet:'Synthetic'}));
      ST.otros=[{id:'etf-test',positionId:'etf-test',type:'etf',sym:'VWRA',name:'Vanguard',qty:2,buy:100,openCost:200,cur:110,broker:'Synthetic'}];
      LANG='es';applyLang();
    });
    const before=await page.evaluate(()=>JSON.stringify(ST));
    await page.evaluate(()=>showTab('news'));await page.waitForFunction(()=>!newsLoading);
    assert.equal(await page.locator('.tab.active').getAttribute('onclick'),"showTab('news')",'Active tab follows the new order');
    assert.equal(await page.locator('.news-card').count(),11,'All symbols, including ETFs beyond first eight');
    assert(requests.some(a=>a.symbol==='VWRA'&&a.kind==='etf'));
    assert(requests.every(a=>Object.keys(a).sort().join(',')==='kind,name,symbol'),'No holdings or custodian sent');
    assert.equal(await page.locator('.news-title img').count(),0,'News title is text, not HTML');
    assert((await page.locator('#newsGrid').innerText()).includes('EN · Fuente original'));
    await page.evaluate(()=>fetchNews());assert.equal(await page.locator('.news-card').count(),11,'Second refresh does not access removed placeholder');
    await page.locator('#news-VWRA').click();assert.equal(await page.locator('.news-card').count(),1);
    assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.mkt-name')).fontSize),'11px');
    for(const lang of ['es','en']){
      await page.evaluate(lang=>{LANG=lang;applyLang();},lang);
      assert.deepEqual(await page.locator('.tab').evaluateAll(t=>t.slice(-5).map(n=>n.getAttribute('onclick'))),["showTab('evol')","showTab('news')","showTab('tv')","showTab('trading')","showTab('cfg')"]);
    }
    await page.evaluate(()=>{LANG='es';applyLang();filterNews('all');});
    await page.screenshot({path:'/private/tmp/mrp-news-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/private/tmp/mrp-news-mobile.png',fullPage:true});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No mobile page overflow');
    fail=true;await page.evaluate(()=>{allNewsItems=[];return fetchNews();});
    assert.equal(await page.locator('.news-skeleton').count(),0);
    assert((await page.locator('#newsGrid').innerText()).includes('Las fuentes no están disponibles'));
    assert.equal(await page.locator('#newsRefresh').isDisabled(),false);
    assert.equal(await page.evaluate(()=>JSON.stringify(ST)),before,'Financial state unchanged');
    assert.deepEqual(errors,[]);
    console.log('OK: repeated refresh, all assets, Spanish/English, safe text, failure state, tabs, typography, mobile, unchanged portfolio');
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
