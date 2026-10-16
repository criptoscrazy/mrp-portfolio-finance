// Public symbols with synthetic holdings in a fresh browser. Cloud is blocked.
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium,browserExecutable}=require('./browser-runtime.cjs');
const publicMode=process.env.MRP_PUBLIC==='1';
const expectedRelease=require('node:fs').readFileSync(path.resolve(__dirname,'..','index.html'),'utf8').match(/<meta name="mrp-release" content="([^"]+)"/)[1];
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:browserExecutable()});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1100}});
    await page.addInitScript(()=>Object.defineProperty(navigator,'onLine',{get:()=>false}));
    await page.route('https://**/*',route=>{
      const url=route.request().url();
      return /^https:\/\/(criptoscrazy\.github\.io|r\.jina\.ai)\//.test(url)||url.includes('cdn.jsdelivr.net/npm/@tabler/icons-webfont')?route.continue():route.abort();
    });
    await page.route('http://**/*',route=>route.abort());
    const url=publicMode?'https://criptoscrazy.github.io/mrp-portfolio-finance/':pathToFileURL(path.resolve(__dirname,'..','index.html')).href;
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(900);
    const result=await page.evaluate(async()=>{
      localStorage.clear();
      const lot=(sym,name,qty,cost)=>({id:'test_'+sym,positionId:'pos_test_'+sym,type:'cedeaar',sym,name,broker:'Synthetic broker',date:'2026-01-01',purchaseCurrency:'USD_MEP',quantityDecimal:String(qty),qty,ratioDecimal:'10',ratio:10,unitPriceDecimal:decDiv(String(cost),String(qty),8),totalCostDecimal:String(cost),schemaVersion:'cedear-lots-v1',cur:100,priceSource:'Yahoo Finance · BYMA',priceSourceTimestamp:'2020-01-01T00:00:00Z',priceUpdatedAt:'2020-01-01T00:00:00Z',priceStatus:'last_close'});
      ST={...ST,stocks:[],crypto:[],otros:[lot('AAPL','Apple Inc.',80,900),lot('NVDA','NVIDIA',27,200),lot('TSLA','Tesla',7,150)],hist:[],liquidity:[],cedearSales:[],cedearExpenses:[],cedearValuations:[],snaps:[],cedearCurrentCclDecimal:'1600',cedearCurrentCclSource:'Synthetic fixed conversion',cedearCurrentCclSourceTimestamp:new Date().toISOString()};
      const identity=()=>JSON.stringify(ST.otros.map(({id,positionId,quantityDecimal,totalCostDecimal,date,broker})=>({id,positionId,quantityDecimal,totalCostDecimal,date,broker})));
      const before=identity();
      // Simulate the observed unavailable browser/proxy route. Reader is real.
      fetchWithFallback=async()=>null;refreshCedearCurrentCCL=async()=>{};fetchBenchmarks=()=>{};
      await updatePrices({automatic:true});
      renderAll();showTab('otros');showOtrosTab('cedeares');
      const summary=portfolioSummary(),review=profitReviewData(summary);
      return {release:APP_RELEASE,version:document.querySelector('.logo-version').textContent,integrity:before===identity()&&ST.hist.length===0&&ST.cedearValuations.length===0,prices:ST.otros.map(asset=>({symbol:asset.quoteSymbol,price:asset.cur,currency:asset.quoteCurrency,time:asset.priceSourceTimestamp,status:priceStatusFor(asset)})),total:summary.totalUSD,expected:consolidateCedears().reduce((sum,group)=>sum+Number(group.currentValueUSD),0),table:document.querySelector('#cedTb').innerText,reviews:review.rows.map(row=>({sym:row.item.sym,reasons:row.reasons})),reviewPositions:review.positions.map(row=>({sym:row.item.sym,currentUSD:row.item.currentUSD,costUSD:row.item.costUSD})),thresholds:profitReviewSettings(),weightReliable:review.weightReliable,persisted:JSON.parse(localStorage.getItem(SKEY)).otros.map(asset=>asset.cur)};
    });
    assert.equal(result.release,expectedRelease);
    assert(result.integrity,'Synthetic holding identity/history changed');
    assert.equal(result.prices.length,3);
    for(const quote of result.prices){assert(quote.symbol.endsWith('.BA'));assert.equal(quote.currency,'ARS');assert(quote.price>100);assert(!['stale','freshness_unknown','pending'].includes(quote.status),'Provider timestamp is not recent: '+JSON.stringify(quote));}
    assert(Math.abs(result.total-result.expected)<0.000001,'Dashboard and CEDEAR table valuations differ');
    for(const position of result.reviewPositions){const gain=(position.currentUSD-position.costUSD)/position.costUSD*100;assert.equal(result.reviews.some(row=>row.sym===position.sym),gain>=result.thresholds.gainThresholdPct,'Profit review must follow the actual live return for '+position.sym);}
    assert(result.weightReliable,'Concentration remains unreliable after quotes');
    assert.deepEqual(result.persisted,result.prices.map(quote=>quote.price));
    await page.waitForTimeout(350);
    await page.screenshot({path:'/private/tmp/mrp-cedear-provider-'+(publicMode?'public':'local')+'.png',fullPage:true});
    console.log(JSON.stringify({ok:true,mode:publicMode?'public':'local',...result}));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
