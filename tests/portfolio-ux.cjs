// Compare the same isolated fixture and exercise the workspace on both viewport sizes.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium,browserExecutable,artifactPath}=require('./browser-runtime.cjs');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const baseline=process.env.MRP_UX_BASE;
const previous=baseline&&execFileSync('git',['show',baseline+':index.html'],{cwd:root,encoding:'utf8'});
const now=new Date().toISOString();
const views=['dash','stocks','crypto','otros','liquidity','dca','risk','income','hist','evol','news','tv','trading','cfg'];

(async()=>{
  const server=http.createServer((req,res)=>{
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    res.end(req.url==='/baseline'?previous:html);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const publicPage=process.env.MRP_UX_PUBLIC;
  const appUrl=publicPage||origin+'/';
  let browser;
  const errors=[];
  async function open(width,url=appUrl){
    const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
    await context.route('**/*',route=>{
      const url=route.request().url();
      return [appUrl,origin+'/baseline'].includes(url)||url.startsWith('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/')?route.continue():route.abort();
    });
    await context.addInitScript(()=>Object.defineProperty(navigator,'onLine',{get:()=>false}));
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url);
    await page.evaluate(now=>{
      ST=emptyPortfolioState();
      const position=(sym,scope,extra={})=>({id:'fixture-'+sym,positionId:'pos_fixture_'+sym,sym,name:'Nombre completo de '+sym,
        assetType:scope,qty:2,buy:50,openCost:100,cur:70,priceStatus:'delayed',priceSourceTimestamp:now,
        priceSource:'Fixture · test only',broker:'Custodio de prueba',date:'2026-01-02',...extra});
      ST.stocks=[position('SYN','stock',{qty:0,openCost:0,status:'closed'})];
      applyPositionOperation(ST.stocks[0],'stock','COMPRA',{qty:2,price:50,comm:0,feeStatus:'not_recorded',date:'2026-01-02'});
      ST.crypto=[position('BTC','crypto',{wallet:'Custodio cripto'})];
      const ced=position('CED','cedeaar',{type:'cedeaar',schemaVersion:'cedear-lots-v1',qty:10,quantityDecimal:'10',
        ratioDecimal:'1',unitPriceDecimal:'100',totalCostDecimal:'1000',historicalArsEquivalentDecimal:'1000',
        purchaseCurrency:'ARS',feeStatus:'confirmed_zero',cclAtPurchaseDecimal:'100',cur:110,priceUpdatedAt:now});
      ST.otros=[position('VWRA','etf',{type:'etf',market:'LSE',priceSymbol:'VWRA.L',listingCurrency:'USD'}),ced,
        position('TOK','token',{type:'token',exchange:'Custodio tokenizado'}),
        position('BON','bono',{type:'bono',nominal:1000,capUSD:900,buyPct:90,rate:5})];
      applyCedearSale(ced.positionId,{qty:5,price:100,comm:0,currency:'ARS',date:'2026-01-03',feeStatus:'confirmed_zero'});
      ST.cedearCurrentCclDecimal='100';ST.cedearCurrentCclUpdatedAt=now;ST.cedearCurrentCclSourceTimestamp=now;
      const cash=createLiquidityAccount({custodian:'Custodio USD',currency:'USD',balanceDecimal:'100',date:'2026-01-01'});
      setLiquidityReserve(cash,'20','70');
      createLiquidityAccount({custodian:'Custodio EUR',currency:'EUR',balanceDecimal:'25',date:'2026-01-01'});
      ST.selAsset=ST.stocks[0];
      LANG='es';applyLang();showTab('dash');renderAll();
    },now);
    return page;
  }
  const financial=page=>page.evaluate(()=>JSON.stringify({
    portfolio:portfolioSummary(),wealth:financialSummary(),reserve:[...liquidityReserveSummary().byCurrency],
    cedears:consolidateCedears(),history:ST.hist.map(row=>[row.operationId,recordedRealizedPnl(row)]),
    state:JSON.parse(JSON.stringify(ST)),backup:readMarketPeaks().size
  }));
  try{
    browser=await chromium.launch({headless:true,executablePath:browserExecutable()});
    for(const width of [1440,390,320]){
      const page=await open(width);
      assert.equal((await page.locator('.logo-version').textContent()).trim(),'v'+html.match(/name="mrp-release" content="([^"]+)"/)[1]);
      const unchanged=()=>page.evaluate(()=>JSON.stringify(ST));
      const before=await unchanged();
      if(width===1440&&previous){
        // Generate one fixture only, including its IDs, and give the exact same state to both versions.
        const old=await open(width,origin+'/baseline');
        await old.evaluate(state=>{ST=state;renderAll();},JSON.parse(before));
        assert.equal(await financial(page),await financial(old),'All financial objects must match the published baseline');
        for(const selector of ['#dHeroTotal','#dHeroPnl','#dHeroPnlPct','#dCap','#dPositions','#dClassPnlTb']){
          assert.equal(await page.locator(selector).textContent(),await old.locator(selector).textContent(),selector+' displays the same figure(s)');
        }
        const oldValues=await old.locator('#dashLiquidityTotals strong').allTextContents();
        assert.equal(await page.locator('#dashInvested strong').textContent(),oldValues[0]);
        assert.equal(await page.locator('#dashAvailable strong').textContent(),oldValues[3]);
        await old.context().close();
        console.log('OK: same input state, identical valuations, lot costs, history and reserves against '+baseline);
      }
      assert.equal(await page.locator('.portfolio-nav > :is(button,details)').count(),5);
      assert.equal(await page.locator('.portfolio-nav [data-view]').count(),14);
      assert.equal(await page.locator('.dash-summary > div').count(),4);
      assert(await page.locator('#dHeroTotal').isVisible());
      assert(!(await page.locator('#dashAllocation').isVisible()));
      const bounds=await page.evaluate(()=>({
        width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
        outliers:[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).slice(0,10).map(el=>[el.tagName,el.id,el.className])
      }));
      assert(bounds.scrollWidth<=bounds.width+1,'Dashboard fits viewport: '+JSON.stringify(bounds));
      if(width!==320)await page.screenshot({path:artifactPath('mrp-ux-dashboard-'+width+'.png'),animations:'disabled'});
      const visit=async view=>{
        const target=page.locator('.portfolio-nav [data-view="'+view+'"]');
        if(!await target.isVisible())await target.locator('xpath=ancestor::details/summary').click();
        await target.click();
        assert(await page.locator('#tab-'+view).isVisible(),view+' is accessible');
        assert.equal(await target.getAttribute('aria-current'),'page');
      };
      for(const view of views)await visit(view);
      assert.equal(await unchanged(),before,'Navigation leaves state byte-identical');
      await visit('liquidity');
      const account=page.locator('#liquidityTb tr').filter({hasText:'Custodio USD'});
      await account.getByRole('button',{name:/Editar reserva/}).click();
      assert.equal(await page.locator('#liqReserveOther').inputValue(),'70');
      await page.locator('#liquidityOverlay .btn-cancel').click();
      await page.locator('#liquidityReserves > summary').click();
      assert(await page.locator('#liquidityReserveCurrencies').isVisible());
      assert((await page.locator('#liquidityReserveCurrencies').textContent()).includes('Disponible para recompras'));
      if(width!==320)await page.screenshot({path:artifactPath('mrp-ux-liquidity-'+width+'.png'),animations:'disabled'});
      await visit('stocks');
      const row=page.locator('#sTb tr').first();
      await row.getByRole('button',{name:/Comprar/}).click();
      assert(await page.locator('#positionOperationOverlay').isVisible());
      await page.evaluate(()=>closePositionOperation());
      await row.getByRole('button',{name:/Vender/}).click();
      assert(await page.locator('#positionOperationOverlay').isVisible());
      await page.evaluate(()=>closePositionOperation());
      await row.getByRole('button',{name:/Más información/}).click();
      assert(await page.locator('#detailGrid').isVisible());
      await page.evaluate(()=>closeDetailModal());
      const assetMenu=page.locator('.nav-group').first();
      for(const [sub,tbody] of [['etf','etfTb'],['cedeares','cedTb'],['token','tokTb'],['bonos','bonTb']]){
        await assetMenu.locator('summary').click();
        await assetMenu.locator('[data-asset-subview="'+sub+'"]').click();
        assert(await page.locator('#'+tbody+' .btn-buy').first().isVisible());
        assert(await page.locator('#'+tbody+' .btn-sell').first().isVisible());
        const span=await page.locator('#'+tbody).evaluate(body=>{
          const wrap=body.closest('.tbl-wrap');return [wrap.scrollWidth,wrap.clientWidth];
        });
        assert(span[0]<=span[1]+1,sub+' table overflow: '+span.join('/'));
      }
      await assetMenu.locator('summary').click();
      await assetMenu.locator('[data-asset-subview="cedeares"]').click();
      await page.locator('#cedTb .btn-view').click();
      assert(await page.locator('#cedLotsModalOverlay').isVisible());
      assert.equal(await page.locator('#cedLotsTb tr').count(),1);
      await page.evaluate(()=>closeCEDLots());
      if(width!==320)await page.locator('#cedTb-table').screenshot({path:artifactPath('mrp-ux-ce-dear-'+width+'.png'),animations:'disabled'});
      assert.equal(await unchanged(),before,'Reading assets, reserves or lots does not change the portfolio');
      assert.equal(await page.evaluate(()=>{
        const account=liquidityAccounts().find(item=>item.currency==='USD');
        applyLiquidityMovement({liquidityId:account.liquidityId,type:'RETIRO',amountDecimal:'40',date:'2026-01-04'});
        return findLiquidity(account.liquidityId).balanceDecimal;
      }),'60','Existing reserves remain informational and do not block a permitted movement');
      await page.context().close();
    }
    assert.deepEqual(errors,[]);
    console.log('OK: five accesses, 14 routes, mobile asset actions, disclosures and read-only state at 1440, 390 and 320 px.');
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
