// Browser acceptance with isolated storage, inert text fixtures and all outbound requests blocked.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium,browserExecutable,artifactPath}=require('./browser-runtime.cjs');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

(async()=>{
  const server=http.createServer((request,response)=>{
    response.writeHead(request.url==='/'?200:204,{'Content-Type':'text/html; charset=utf-8'});
    response.end(request.url==='/'?html:'');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  let browser,checks=0;
  const check=(condition,message)=>{assert(condition,message);checks++;};
  const inert='<b data-audit-fixture="text" onfocus="">Prueba & "comillas" y apóstrofe</b>';
  const longText='Observación '.repeat(85)+'a'.repeat(300);
  const errors=[];
  try{
    browser=await chromium.launch({headless:true,executablePath:browserExecutable()});
    async function open(){
      const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000}});
      await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
      const page=await context.newPage();
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(origin);
      return page;
    }
    const page=await open();
    await page.evaluate(({inert,longText})=>{
      const now=new Date().toISOString();
      ST=emptyPortfolioState();
      const stock=(id,sym)=>({id,positionId:'pos_'+id,sym,name:sym,assetType:'stock',broker:'Fixture',
        qty:0,openCost:0,cur:150,priceSource:'Synthetic',priceSourceTimestamp:now,priceStatus:'delayed',date:'2026-01-01'});
      const old=stock('old','OLD');
      const fresh=stock('fresh','SYN');
      ST.stocks.push(old,fresh);
      applyPositionOperation(old,'stock','COMPRA',{qty:1,price:100,comm:0,feeStatus:'confirmed_zero',date:'2026-01-02'});
      old.priceSourceTimestamp='2020-01-01T00:00:00Z';
      applyPositionOperation(fresh,'stock','COMPRA',{qty:3,price:50,comm:0,feeStatus:'not_recorded',date:'2026-01-02'});
      applyPositionOperation(fresh,'stock','VENTA',{qty:1,price:100,comm:0,feeStatus:'confirmed_zero',notes:inert,date:'2026-01-03'});
      createLiquidityAccount({custodian:inert,currency:'USD',balanceDecimal:'100',date:'2026-01-02'});
      ST.alerts=[{id:'alert-one',sym:'SYN',cond:'above',price:100,note:inert+' '+longText},
        {id:'alert-two',sym:'OLD',cond:'above',price:100,note:''}];
      const observed=new Map();
      collectMarketObservation(observed,fresh);
      recordMarketPeaks(observed);
      renderAll();
      showTab('dash');
    },{inert,longText});
    check((await page.locator('#dHeroTotalSub').textContent()).includes('Incluye cotizaciones antiguas'),'Dashboard warns beside the total');
    check((await page.locator('#dHeroPnlPct').textContent()).includes('Provisional'),'Portfolio G/P carries the provisional state');
    await page.evaluate(()=>showTab('risk'));
    check((await page.locator('#profitReviewState').textContent()).includes('provisionales'),'Risk warns about provisional results');
    check((await page.locator('#riskTb').textContent()).includes('cotizaciones antiguas'),'Risk identifies stale components in concentration');
    await page.evaluate(()=>showTab('stocks'));
    check((await page.locator('#sTb').textContent()).includes('Provisional'),'Position table identifies provisional figures');
    await page.evaluate(()=>showTab('hist'));
    const saleRow=page.locator('#hTb tr').filter({hasText:'VENTA'});
    check((await saleRow.textContent()).includes('Provisional'),'Sale history qualifies the result');
    await saleRow.getByRole('button',{name:'Ver nota de la operación'}).click();
    check((await page.locator('#detailGrid').textContent()).includes(inert),'Operation notes are shown as text');
    await page.evaluate(()=>{closeDetailModal();showTab('liquidity');});
    check((await page.locator('#liquidityTb').textContent()).includes(inert),'Liquidity custodian is shown as text');
    await page.evaluate(()=>showTab('cfg'));
    const alerts=page.locator('#alertsList');
    check((await alerts.textContent()).includes(inert+' '+longText),'Long alert text and special characters survive rendering');
    check(await alerts.locator('[data-audit-fixture], [onfocus]').count()===0,'Inert markup and empty event attributes are never DOM nodes');
    check((await alerts.locator('.price-alert').nth(0).textContent()).includes('ALCANZADO'),'Fresh alert continues to show a reached threshold');
    check(!(await alerts.locator('.price-alert').nth(1).textContent()).includes('ALCANZADO'),'Old quote is displayed without a reached threshold');
    check(await alerts.locator('.price-alert').nth(1).locator('.price-alert-text div').isHidden(),'An empty note stays hidden');
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:900});
      check(await alerts.evaluate(node=>node.scrollWidth<=node.clientWidth+1),'Alert remains within layout at '+width);
      await alerts.screenshot({path:artifactPath('mrp-integrity-alerts-'+width+'.png')});
      await page.evaluate(()=>showTab('dash'));
      check(await page.locator('#dHeroTotalSub').isVisible(),'Freshness warning remains visible at '+width);
      await page.evaluate(()=>showTab('cfg'));
    }

    const downloading=page.waitForEvent('download');
    await page.getByRole('button',{name:/Exportar backup/}).click();
    const buffer=fs.readFileSync(await (await downloading).path());
    const backup=JSON.parse(buffer);
    check(Object.keys(backup.marketPeaksBackup).length===1,'Export still includes synthetic price maxima');
    const restored=await open();
    await restored.locator('#importFile').setInputFiles({name:'portfolio-fixture.json',mimeType:'application/json',buffer});
    await restored.waitForFunction(()=>ST.hist.length===4);
    const roundTrip=await restored.evaluate(()=>{
      const sale=ST.hist.find(entry=>entry.type==='VENTA');
      return {state:sale.realizedPnl,status:realizedResult(sale).status,
        quantities:ST.stocks.map(asset=>asset.qty),
        balances:ST.liquidity.map(account=>account.balanceDecimal),peaks:readMarketPeaks().size};
    });
    check(roundTrip.state===50&&roundTrip.status==='provisional','Import preserves the historical amount and derived state');
    check(JSON.stringify(roundTrip.quantities)==='[1,2]'&&JSON.stringify(roundTrip.balances)==='["100"]'&&roundTrip.peaks===1,'Quantities, balances and maxima survive export and restore');
    check(await restored.locator('[data-audit-fixture], [onfocus=""]').count()===0,'Imported inert attributes are not interpreted as markup');
    assert.deepEqual(errors,[]);
    console.log('OK Portfolio integrity UI: '+checks+' checks on desktop/mobile and isolated backup restore.');
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
