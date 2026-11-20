// Live public quotes and downloadable backups in two isolated, synthetic browser profiles.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium,browserExecutable}=require('./browser-runtime.cjs');

const publicMode=process.env.MRP_PUBLIC==='1';
const forceReader=process.env.MRP_FORCE_YAHOO_READER==='1';
const publicUrl='https://criptoscrazy.github.io/mrp-portfolio-finance/';
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const expected=html.match(/<meta name="mrp-release" content="([^"]+)"/)[1];
const providerHosts=new Set(['data-api.binance.vision','api.coingecko.com','min-api.cryptocompare.com',
  'query1.finance.yahoo.com','query2.finance.yahoo.com','api.allorigins.win','r.jina.ai','dolarapi.com','dolarazo.com.ar']);

(async()=>{
  const server=http.createServer((request,response)=>{
    response.writeHead(request.url==='/'?200:204,{'Content-Type':'text/html; charset=utf-8'});
    response.end(request.url==='/'?html:'');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=publicMode?publicUrl:'http://127.0.0.1:'+server.address().port+'/';
  let browser;
  const responses=new Set();
  try{
    browser=await chromium.launch({headless:true,executablePath:browserExecutable()});
    async function openProfile(){
      const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1024}});
      await context.addInitScript(()=>Object.defineProperty(navigator,'onLine',{get:()=>false}));
      await context.route('**/*',route=>{
        const request=new URL(route.request().url());
        if(forceReader&&((['query1.finance.yahoo.com','query2.finance.yahoo.com'].includes(request.hostname)&&
          request.pathname.includes('/finance/'))||request.hostname==='api.allorigins.win')) return route.abort();
        if ((request.origin===new URL(url).origin&&request.pathname===new URL(url).pathname)||
            (request.protocol==='https:'&&providerHosts.has(request.hostname)&&route.request().method()==='GET')) {
          return route.continue();
        }
        return route.abort();
      });
      const page=await context.newPage();
      page.on('response',response=>{
        const host=new URL(response.url()).hostname;
        if(providerHosts.has(host))responses.add(host+':'+response.status());
      });
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(url,{waitUntil:'domcontentloaded'});
      assert.equal(await page.locator('.logo-version').textContent(),'v'+expected);
      return {page,errors};
    }

    const {page,errors}=await openProfile();
    await page.evaluate(()=>{
      const base=(sym,qty,buy,id=sym)=>({id:'fixture_'+id,positionId:'pos_fixture_'+id,sym,name:sym,
        qty,buy,openCost:qty*buy,avgBuy:buy,broker:'Synthetic broker',date:'2026-01-01',status:'active'});
      const cedear=base('AAPL',10,9,'CEDEAR');
      ST.stocks=[base('AAPL',2,120)];
      ST.crypto=[{...base('BTC',0.2,32000),wallet:'Synthetic wallet'},{...base('ETH',1,1000),wallet:'Synthetic wallet'}];
      ST.otros=[{...base('VWRA',1,120),type:'etf',market:'LSE',priceSymbol:'VWRA.L',listingCurrency:'USD'},
        {...cedear,type:'cedeaar',schemaVersion:'cedear-lots-v1',purchaseCurrency:'USD_MEP',
          quantityDecimal:'10',ratioDecimal:'10',unitPriceDecimal:'9',totalCostDecimal:'90'}];
      ST.liquidity=[
        {liquidityId:'liq_fixture_usd',custodian:'Synthetic bank',currency:'USD',balanceDecimal:'100',
          investmentReserveDecimal:'40',otherReserveDecimal:'30',assetKind:'fiat',availability:'immediate',product:'Checking',date:'2026-01-01'},
        {liquidityId:'liq_fixture_eur',custodian:'Synthetic bank',currency:'EUR',balanceDecimal:'80',
          investmentReserveDecimal:'20',assetKind:'fiat',availability:'immediate',product:'Savings',date:'2026-01-01'}];
      window.syntheticBefore=JSON.parse(JSON.stringify(ST));
      fetchBenchmarks=()=>{};
    });
    await page.evaluate(()=>updatePrices({automatic:true}));
    const first=await page.evaluate(()=>({
      quotes:portfolioValuations().map(item=>{
        const asset=marketPriceAsset(item);
        return {id:item.id,symbol:asset.quoteSymbol||item.sym,unit:marketQuoteUnit(asset),price:Number(asset.cur)||null,
          source:item.source,time:item.sourceTimestamp,status:priceStatusFor(asset),pnl:item.pnlUSD};
      }),
      ccl:ST.cedearCurrentCclDecimal, cclSource:ST.cedearCurrentCclSource,
      same:portfolioStatesEqual(ST,window.syntheticBefore)
    }));
    console.log(JSON.stringify({mode:publicMode?'public':'local',release:expected,...first,responses:[...responses]}));
    assert(first.same,'Quote update altered a financial record');
    assert(first.quotes.every(quote=>quote.price>0&&Number.isFinite(Date.parse(quote.time))&&quote.pnl!==null&&
      !['pending','stale','freshness_unknown'].includes(quote.status)),'A required provider quote was missing or stale');
    assert(Number(first.ccl)>0&&first.cclSource,'The CEDEAR conversion was not fetched');
    if(forceReader)assert(responses.has('r.jina.ai:200'),'The Yahoo reader did not receive a live response');
    // Later refreshes only need crypto. The first refresh exercises the full market pipeline.
    await page.route('**/*',route=>{
      const host=new URL(route.request().url()).hostname;
      return ['query1.finance.yahoo.com','query2.finance.yahoo.com','api.allorigins.win','r.jina.ai'].includes(host)?route.abort():route.fallback();
    });
    let drawdowns=[];
    for(let attempt=0;attempt<8;attempt++){
      await page.waitForTimeout(2000);
      drawdowns=await page.evaluate(async()=>{
        await updatePrices({automatic:true});
        return ST.crypto.map(asset=>({id:asset.id,symbol:asset.sym,quantity:asset.qty,...positionDrawdown(asset)}))
          .filter(drawdown=>drawdown.status===null);
      });
      if(drawdowns.some(drawdown=>drawdown.percent<0))break;
    }
    assert(drawdowns.length>0,'The provider did not return two distinct timestamps');
    for(const row of drawdowns){
      assert(Math.abs(row.percent-(row.current/row.peak.price-1)*100)<1e-8);
      assert(Math.abs(row.estimate-(row.current-row.peak.price)*row.quantity)<1e-8);
    }
    const check=await page.evaluate(()=>{
      showTab('dash');
      const summary=portfolioSummary();
      return {same:portfolioStatesEqual(ST,window.syntheticBefore),
        dashboard:document.querySelector('#dHeroPnl').textContent,expected:fmt(summary.pnlUSD),
        reserve:[...liquidityReserveSummary().byCurrency].map(([currency,row])=>[currency,row.available])};
    });
    assert(check.same,'Later prices altered financial records');
    assert.equal(check.dashboard,check.expected);
    assert.deepEqual(check.reserve,[['EUR','20'],['USD','40']]);

    const beforeReload=await page.evaluate(()=>JSON.stringify([...readMarketPeaks()]));
    await page.reload({waitUntil:'domcontentloaded'});
    assert.equal(await page.evaluate(()=>JSON.stringify([...readMarketPeaks()])),beforeReload,'Maxima changed across reload');
    await page.evaluate(()=>showTab('cfg'));
    const downloadEvent=page.waitForEvent('download');
    await page.getByRole('button',{name:/Exportar backup/}).click();
    const download=await downloadEvent;
    const buffer=fs.readFileSync(await download.path());
    const backup=JSON.parse(buffer);
    assert(Object.keys(backup.marketPeaksBackup).length>=first.quotes.length);

    const fresh=await openProfile();
    assert.equal(await fresh.page.evaluate(()=>readMarketPeaks().size),0);
    const restore=bytes=>fresh.page.locator('#importFile').setInputFiles({name:'synthetic-portfolio.json',mimeType:'application/json',buffer:bytes});
    await restore(buffer);
    await fresh.page.waitForFunction(()=>readMarketPeaks().size>0);
    const restored=await fresh.page.evaluate(()=>({
      peaks:Object.fromEntries(readMarketPeaks()),
      drawdowns:ST.crypto.map(asset=>({id:asset.id,symbol:asset.sym,quantity:asset.qty,...positionDrawdown(asset)}))
        .filter(drawdown=>drawdown.status===null),
      plainState:!Object.hasOwn(ST,'marketPeaksBackup')
    }));
    assert.deepEqual(restored.peaks,backup.marketPeaksBackup);
    assert.deepEqual(restored.drawdowns,drawdowns);
    assert(restored.plainState,'Backup-only data was included in sync state');

    const snapshot=()=>fresh.page.evaluate(()=>[localStorage.getItem(SKEY),localStorage.getItem(marketPeakStorageKey())]);
    const restoredStorage=await snapshot();
    const invalid=JSON.parse(buffer);
    const key=Object.keys(invalid.marketPeaksBackup)[0];
    invalid.marketPeaksBackup[key].price=0;
    await restore(Buffer.from(JSON.stringify(invalid)));
    await fresh.page.waitForFunction(()=>document.querySelector('#toastMsg').textContent.includes('no parece ser un backup válido'));
    assert.deepEqual(await snapshot(),restoredStorage,'A malformed backup altered persisted data');

    await fresh.page.evaluate(()=>{
      window.confirm=()=>true;
      const write=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){
        if(key===SKEY){
          Storage.prototype.setItem=write;
          throw new DOMException('Synthetic save failure','QuotaExceededError');
        }
        return write.call(this,key,value);
      };
    });
    await restore(Buffer.from(JSON.stringify({...backup,marketPeaksBackup:{}})));
    await fresh.page.waitForFunction(()=>Storage.prototype.setItem.toString().includes('[native code]'));
    assert.deepEqual(await snapshot(),restoredStorage,'A failed portfolio save must also roll back the maxima');

    const legacy=await openProfile();
    const {marketPeaksBackup,...legacyBackup}=backup;
    await legacy.page.locator('#importFile').setInputFiles({
      name:'legacy-synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacyBackup))
    });
    await legacy.page.waitForFunction(()=>ST.crypto.some(asset=>asset.id==='fixture_BTC'));
    assert.equal(await legacy.page.evaluate(()=>readMarketPeaks().size),0,'Legacy backups remain importable');
    assert.deepEqual(errors.concat(fresh.errors),[]);
    console.log(JSON.stringify({ok:true,drawdowns,restoredMaxima:Object.keys(restored.peaks).length,
      reserve:check.reserve,portfolioIntact:check.same,backupRejectedWithoutChanges:true,rollback:true,legacyAccepted:true,publicMode}));
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
