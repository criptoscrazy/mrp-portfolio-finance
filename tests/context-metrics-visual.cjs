// Read-only UI projection tests. No real portfolio, credentials or external network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');
const {chromium} = require('/Users/marcos/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const test = fs.readFileSync(path.join(__dirname, 'cost-mean-visual.cjs'), 'utf8');
const ctx = {};
vm.runInNewContext(test.slice(test.indexOf('const quoteTime ='), test.indexOf('(async () =>')) + '\nthis.fixtures = fixtures;', ctx);
const fixtures = JSON.parse(JSON.stringify(ctx.fixtures));
const direct = (id, type, qty, cost, cur) => ({id,positionId:id,type,sym:id,name:id,qty,buy:cost/qty,openCost:cost,cur,quoteCurrency:'USD',priceStatus:'last_close',priceSource:'Prueba',broker:'Prueba',date:'2026-09-01'});
fixtures.stocks = [direct('stock', 'stock', 2, 200, 150), {...direct('stock-pending','stock',1,50,0),cur:null}];
fixtures.otros.push(direct('etf','etf',3,600,250),direct('token','token',4,400,120),{id:'bond',positionId:'bond',type:'bono',sym:'BONO',nominal:1000,capUSD:900});

(async () => {
  const server = http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    await context.addInitScript(()=>Object.defineProperty(navigator,'onLine',{get:()=>false}));
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin,{waitUntil:'domcontentloaded'});await page.waitForTimeout(600);
    await page.evaluate(fixtures=>{ST=fixtures;LANG='es';renderAll();applyLang();},fixtures);
    const before=await page.evaluate(()=>JSON.stringify(ST));
    for(const [tab,sub,assetClass] of [
      ['stocks',null,'Acciones'],['crypto',null,'Cripto'],['otros','etf','ETFs'],
      ['otros','cedeares','CEDEARs'],['otros','token','Tokenizadas'],['otros','bonos','Bonos']
    ]) {
      await page.locator(`.tab[onclick="showTab('${tab}')"]`).click();
      if(sub)await page.locator('#otrosTab-'+sub).click();
      const metrics=await page.evaluate(assetClass=>{
        const global=portfolioSummary();
        const scoped=portfolioSummary(global.items.filter(item=>item.assetClass===assetClass));
        return {scope:metricAssetClass(),value:$('kV').textContent,expectedValue:scoped.totalUSD==null?'N/D':fmt(scoped.totalUSD),
          cost:$('kCost').textContent,expectedCost:scoped.pnlItems.length||!scoped.items.length?fmt(scoped.costUSD):'N/D',
          pnl:$('kPnl').textContent,expectedPnl:scoped.pnlItems.length?fmt(scoped.pnlUSD):'N/D',
          roi:$('kROI').textContent,expectedRoi:scoped.roiUSD!=null?fmtPct(scoped.roiUSD*100):'N/D',
          positions:$('kPos').textContent,expectedPositions:String(scoped.items.length),
          classValue:global.byClass[assetClass],scopedValue:scoped.totalUSD};
      },assetClass);
      assert.equal(metrics.scope,assetClass);
      for(const key of ['value','cost','pnl','roi','positions'])assert.equal(metrics[key],metrics['expected'+key[0].toUpperCase()+key.slice(1)],assetClass+' '+key);
      if(metrics.classValue!=null)assert.equal(metrics.scopedValue,metrics.classValue,'Exactly the Dashboard class value');
      const classRow=page.locator('#dClassPnlTb tr').filter({has:page.locator('td.sym', {hasText:assetClass})});
      const classCells=await classRow.locator('td.num').allTextContents();
      assert.deepEqual(classCells,[metrics.cost,metrics.value,metrics.pnl,metrics.roi],'Dashboard class breakdown must match the module');
      assert.equal(await page.locator('#kpiStrip').isVisible(),true);
      assert.equal(await page.locator('#kpiStrip > .kpi').count(),5);
    }
    await page.evaluate(()=>{showTab('otros');showOtrosTab('cedeares');});
    await page.waitForTimeout(300);
    await page.screenshot({path:'/private/tmp/mrp-context-cedears-desktop.png',fullPage:true});
    await page.evaluate(()=>showTab('dash'));
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#kpiStrip').isVisible(),false,'Only one global executive summary');
    assert.equal(await page.locator('#dHeroTotal').isVisible(),true);
    assert.equal(await page.locator('#dPositions').isVisible(),true);
    assert.equal(await page.locator('#btnTxt').isVisible(),true,'Global update control retained');
    await page.screenshot({path:'/private/tmp/mrp-context-dashboard-desktop.png',fullPage:true});
    await page.evaluate(()=>showTab('hist'));
    assert.equal(await page.evaluate(()=>metricAssetClass()),null,'Cross-category views retain global scope');
    assert.equal(await page.evaluate(()=>$('kV').textContent===fmt(portfolioSummary().totalUSD)),true);
    assert.equal(await page.evaluate(()=>JSON.stringify(ST)),before,'Navigation must not alter any financial data');
    await page.evaluate(()=>{showTab('otros');showOtrosTab('cedeares');ST.cedearCurrentCclDecimal='1500';renderAll();});
    assert.equal(await page.evaluate(()=>$('kV').textContent===fmt(portfolioSummary().byClass.CEDEARs)),true,'CCL refresh uses the common valuation');
    await page.evaluate(()=>{showTab('crypto');ST.crypto[0].cur=65000;renderAll();});
    assert.equal(await page.evaluate(()=>$('kV').textContent===fmt(portfolioSummary().byClass.Cripto)),true,'Price refresh uses the same Dashboard value');
    await page.evaluate(()=>{ST.crypto.forEach(asset=>asset.cur=null);renderAll();});
    assert.equal(await page.locator('#kV').textContent(),'N/D');
    assert.equal(await page.locator('#kPnl').textContent(),'N/D');
    assert.equal(await page.locator('#kCost').textContent(),'N/D');
    assert.equal(await page.locator('#kROI').textContent(),'N/D');
    assert.equal(await page.locator('#kPos').textContent(),'2','Pending positions still count');
    await page.evaluate(()=>{LANG='en';applyLang();});
    assert.equal(await page.locator('#kValueLabel').textContent(),'Current value · Crypto');
    assert.equal(await page.locator('#kCostLabel').textContent(),'Validated historical cost');
    await page.evaluate(fixtures=>{ST=fixtures;LANG='es';applyLang();showTab('otros');showOtrosTab('cedeares');},fixtures);
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(300);
    const layout=await page.evaluate(()=>({width:innerWidth,bodyWidth:document.documentElement.scrollWidth,kpisWidth:$('kpiStrip').getBoundingClientRect().width}));
    assert(layout.bodyWidth<=layout.width+1,JSON.stringify(layout));
    assert(layout.kpisWidth<=layout.width+1);
    await page.screenshot({path:'/private/tmp/mrp-context-cedears-mobile.png',fullPage:true});
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({ok:true,categories:6,network:'Blocked; synthetic data only',layout}));
  } finally {
    if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
