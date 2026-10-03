// Isolated browser test: synthetic fixtures only; external network is blocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('/Users/marcos/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const quoteTime = '2026-10-03T10:00:00Z';
const lot = (id, sym, qty, unit, cost, broker = 'Allaria', ratio = '10') => ({
  id, positionId:`pos_cedear_${sym.toLowerCase()}_${broker.toLowerCase()}`, type:'cedeaar', assetType:'cedeaar',
  sym, name:sym, date:'2025-07-29', broker, purchaseCurrency:'USD_MEP', quantityDecimal:qty,
  unitPriceDecimal:unit, totalCostDecimal:cost, ratioDecimal:ratio,
  qty:Number(qty), ratio:Number(ratio), cur:24000, quoteCurrency:'ARS', priceStatus:'last_close',
  priceSource:'Prueba visual BYMA', priceUpdatedAt:quoteTime, priceSourceTimestamp:quoteTime
});
const fixtures = {
  stocks:[], crypto:[
    {id:'btc1',positionId:'btc-binance',sym:'BTC',name:'Bitcoin',qty:1,buy:40000,openCost:40050,wallet:'Binance',cur:60000,quoteCurrency:'USD',priceUpdatedAt:quoteTime},
    {id:'btc2',positionId:'btc-exodus',sym:'BTC',name:'Bitcoin',qty:2,buy:30000,openCost:70000,wallet:'Exodus',cur:60000,quoteCurrency:'USD',priceUpdatedAt:quoteTime}
  ], otros:[
    lot('a1','AAPL','281','10.6500','3013.29'),lot('a2','AAPL','279','10.7778','3027.75'),
    lot('a3','AAPL','204','11.2000','2300.55'),lot('a4','AAPL','58','12.0100','701.38'),
    lot('n1','NVDA','271','7.3892','2016.29','Allaria','8'),lot('t1','TSLA','69','21.4993','1493.68','Allaria','12'),
    lot('a-other','AAPL','10','10','150','Otro broker')
  ],hist:[],income:[],apyPositions:[],alerts:[],cedearExpenses:[],cedearSales:[],
  cedearValuations:[{id:'immutable-synthetic',date:'2026-08-04',sym:'AAPL',marketPriceARSDecimal:'24000'}],
  snaps:[],aSnaps:{},selAsset:null,cedearCurrentCclDecimal:'1200',cedearCurrentCclUpdatedAt:quoteTime
};

(async () => {
  const server = http.createServer((request,response) => {
    if(request.url!=='/') { response.writeHead(204);response.end();return; }
    response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});response.end(html);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    await context.addInitScript(()=>Object.defineProperty(navigator,'onLine',{get:()=>false}));
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(600);
    await page.evaluate(fixtures=>{
      ST=structuredClone(fixtures);LANG='es';applyLang();renderAll();showTab('dca');
      window.__beforeCostMean=JSON.stringify(ST);
    },fixtures);
    await page.waitForTimeout(350);
    assert.equal(await page.locator('.tab.active span').innerText(),'Coste medio por posición');
    const allaria=page.locator('#dcaTb tr[data-position-id="pos_cedear_aapl_allaria"]');
    assert.equal(await allaria.count(),1);
    assert((await allaria.innerText()).includes('9.042,97'));
    assert((await allaria.innerText()).includes('11,00'));
    assert((await allaria.innerText()).includes('20,00'));
    assert.equal(await page.locator('#dcaTb tr').count(),6,'Two BTC + four CEDEAR positions');
    assert.equal(await page.locator('#dcaTb tr[data-position-id="pos_cedear_aapl_otro broker"]').count(),1);
    assert.equal(await page.locator('#dcaTb tr[data-position-id="btc-binance"]').count(),1);
    assert.equal(await page.locator('#dcaTb tr[data-position-id="btc-exodus"]').count(),1);
    assert(await page.evaluate(()=>JSON.stringify(ST)===window.__beforeCostMean));
    const screenshots={desktop:'/private/tmp/mrp-cost-mean-desktop.png',mobile:'/private/tmp/mrp-cost-mean-mobile.png'};
    await page.screenshot({path:screenshots.desktop,fullPage:true});

    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:screenshots.mobile,fullPage:true});
    const mobile=await page.evaluate(()=>({
      viewport:innerWidth,bodyWidth:document.documentElement.scrollWidth,
      tableWidth:document.querySelector('#dcaTb').closest('.tbl-wrap').scrollWidth,
      tableViewport:document.querySelector('#dcaTb').closest('.tbl-wrap').clientWidth,
      visualWidth:document.querySelector('#dcaVisual').scrollWidth,
      visualViewport:document.querySelector('#dcaVisual').clientWidth,
      tabLabelWidth:document.querySelector('#costMeanTab span').getBoundingClientRect().width,
      tabWidth:document.querySelector('#costMeanTab').clientWidth
    }));
    assert(mobile.bodyWidth<=mobile.viewport+1,`Page overflow: ${JSON.stringify(mobile)}`);
    assert(mobile.visualWidth<=mobile.visualViewport+1,`Comparison overflow: ${JSON.stringify(mobile)}`);
    assert(mobile.tabLabelWidth<=mobile.tabWidth-20,'The full tab name must fit without overlapping');
    assert(mobile.tableWidth>mobile.tableViewport,'Mobile table must scroll within its container');

    await page.evaluate(()=>{
      ST.cedearCurrentCclDecimal='1500';renderAll();
    });
    assert((await allaria.innerText()).includes('16,00'),'Active view must re-render with current CCL');
    await page.evaluate(()=>{ST.otros.find(lot=>lot.id==='a1').totalCostDecimal=null;renderDCA();});
    assert((await allaria.innerText()).includes('Pendiente'));
    assert((await allaria.innerText()).includes('N/D'));
    await page.evaluate(()=>{
      ST.otros.find(lot=>lot.id==='a1').broker='<img src=x onerror="window.__xss=1">';
      ST.otros.find(lot=>lot.id==='a1').sym='<svg onload="window.__xss=2">';renderDCA();
    });
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#dcaTb img, #dcaTb svg, #dcaVisual img, #dcaVisual svg').count(),0);
    assert.equal(await page.evaluate(()=>window.__xss||0),0);
    await page.evaluate(()=>{LANG='en';applyLang();renderDCA();});
    assert.equal(await page.locator('.tab.active span').innerText(),'Average cost per position');
    assert.equal(await page.locator('#dcaTitle').textContent(),'Average cost per position');
    assert.deepEqual(errors,[],'No application JavaScript errors');
    console.log(JSON.stringify({ok:true,screenshots,mobile,network:'External requests blocked; synthetic data only'}));
  } finally {
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
