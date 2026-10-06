// Isolated browser checks with synthetic holdings and no external requests.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('/Users/marcos/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let checks=0;const check=(condition,message)=>{assert(condition,message);checks++;};
(async()=>{
  const server=http.createServer((req,res)=>{res.writeHead(req.url==='/'?200:204,{'Content-Type':'text/html; charset=utf-8'});res.end(req.url==='/'?html:'');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;let browser;
  try{
    browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(origin);
    await page.evaluate(()=>{
      const asset=(id,sym,custodian,qty,cur)=>({id,positionId:'pos_'+id,sym,name:sym,wallet:custodian,broker:custodian,custody:'exchange',qty,buy:100,avgBuy:100,openCost:qty*100,status:'active',cur,quoteCurrency:'USD',priceStatus:'realtime',priceSource:'Synthetic',priceSourceTimestamp:new Date().toISOString(),date:'2026-01-01',costFeeStatus:'fees_recorded'});
      ST.crypto=[asset('btc_binance','BTC','Binance',10,150),asset('btc_exodus','BTC','Exodus',10,50)];
      ST.stocks=[{...asset('aapl','AAPL','Broker',1,150),tg:150}];ST.otros=[];ST.hist=[];ST.liquidity=[];ST.profitReview={...profitReviewSettings(),gainThresholdPct:null,concentrationThresholdPct:null};
      createLiquidityAccount({custodian:'Binance',currency:'USD',balanceDecimal:'10000',availability:'immediate',assetKind:'fiat',date:'2026-01-01'});
      renderAll();showTab('risk');
    });
    const preserved=await page.evaluate(()=>JSON.stringify([ST.crypto,ST.stocks,ST.otros,ST.hist,ST.snaps,ST.aSnaps,ST.liquidity,portfolioSummary()]));
    check(await page.locator('#profitReviewTb').textContent().then(text=>text.includes('AAPL')&&text.includes('Target alcanzado')&&!text.includes('Ganancia relevante')),'Target works with undefined thresholds');
    check(await page.locator('#profitReviewState').textContent().then(text=>text.includes('umbral pendiente')),'Unconfigured thresholds are explicit');
    await page.locator('#profitReviewSettings summary').click();
    check(await page.locator('#profitGainThreshold').inputValue()===''&&await page.locator('#profitWeightThreshold').inputValue()==='','No default percentages');
    await page.locator('#profitGainThreshold').fill('50');await page.locator('#profitWeightThreshold').fill('40');
    await page.locator('#profitReviewSettings button').click();
    check(await page.locator('#profitReviewTb tr').count()===2,'Two distinct positions require review');
    check(await page.locator('#profitReviewTb').textContent().then(text=>text.includes('Binance')&&!text.includes('Exodus')),'Losing same-symbol custodian remains separate');
    check(await page.locator('#profitReviewTb').textContent().then(text=>text.includes('Ganancia + concentración')&&text.includes('Revisar toma parcial de beneficios')),'Reasons and partial review visible');
    check(await page.locator('.profit-review').textContent().then(text=>text.includes('% de activos invertidos')&&!text.includes('Vender')),'Weight label and review-only wording');
    check(await page.evaluate(saved=>JSON.stringify([ST.crypto,ST.stocks,ST.otros,ST.hist,ST.snaps,ST.aSnaps,ST.liquidity,portfolioSummary()])===saved,preserved),'Settings do not alter holdings, history, cash or metrics');
    check(await page.locator('#riskTb tr').count()===2,'Existing consolidated concentration remains');
    await page.locator('#profitReviewTb .btn-view').first().click();
    check(await page.locator('#detailGrid').textContent().then(text=>text.includes('69,')||text.includes('69.')),'Details use position weight rather than consolidated instrument weight');
    await page.evaluate(()=>closeDetailModal());
    await page.locator('#profitReviewSettings summary').click();await page.locator('#profitGainThreshold').fill('60');
    await page.evaluate(()=>renderRisk());
    check(await page.locator('#profitGainThreshold').inputValue()==='60','Quote refresh preserves unsaved settings inputs');
    await page.locator('#profitGainThreshold').fill('50');await page.locator('#profitReviewSettings button').click();
    await page.evaluate(()=>{
      const id=ST.liquidity[0].liquidityId;
      commitLiquidityMutation(()=>{applyPositionOperation(ST.crypto[0],'crypto','VENTA',{qty:2,price:150,comm:2,feeStatus:'recorded',date:'2026-01-02'});applyLiquidityFunding(ST.hist[0],{liquidityId:id,amountDecimal:'298'});});
    });
    await page.locator('#profitReviewTb .btn-view').first().click();
    const details=await page.locator('#detailGrid').textContent();
    check(details.includes('Beneficio realizado')&&details.includes('98')&&details.includes('Liquidez liberada')&&details.includes('298')&&details.includes('80'),'Profit, released cash and remaining proportion are distinct');
    await page.evaluate(()=>closeDetailModal());await page.waitForTimeout(350);await page.locator('.profit-review').screenshot({path:'/private/tmp/mrp-profit-review-desktop.png'});
    await page.setViewportSize({width:390,height:844});
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Risk mobile has no page overflow');
    check(await page.locator('.profit-review .tbl-wrap').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Review items need no horizontal scroll on mobile');
    check(await page.locator('#profitReviewTb tr').first().evaluate(el=>getComputedStyle(el).display==='grid'),'Mobile rows expose all metrics in compact items');
    await page.locator('#profitReviewSettings summary').click();
    check(await page.locator('#profitGainThreshold').isVisible()&&await page.locator('#profitWeightThreshold').isVisible(),'Mobile settings remain readable');
    await page.waitForTimeout(350);await page.locator('.profit-review').screenshot({path:'/private/tmp/mrp-profit-review-mobile.png'});
    check(await page.locator('.logo-version').evaluate(el=>getComputedStyle(el).fontSize==='9px'),'Version label increased by one pixel');
    await page.evaluate(()=>{ST.crypto[0].wallet='<img src=x onerror="window.profitXss=1">';renderRisk();});
    check(await page.locator('#profitReviewTb img').count()===0&&await page.evaluate(()=>window.profitXss===undefined),'Untrusted custodians stay inert');
    await page.locator('#profitReviewSettings button').click();await page.reload();
    check(await page.evaluate(()=>ST.profitReview.gainThresholdPct===50&&ST.profitReview.concentrationThresholdPct===40),'Explicit settings survive reload');
    assert.deepEqual(errors,[]);console.log(`OK Gestión de beneficios UI: ${checks} comprobaciones desktop/móvil; red externa bloqueada.`);
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
