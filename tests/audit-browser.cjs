// Real UI paths, fresh contexts per scenario, all non-local requests blocked.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,browserExecutable}=require('./browser-runtime.cjs');
const root=path.resolve(__dirname,'..');let checks=0;const check=(v,m)=>{assert(v,m);checks++;};
(async()=>{
 const server=http.createServer((req,res)=>{
  const rel=new URL(req.url,'http://localhost').pathname;const file=rel==='/'?'index.html':rel.slice(1);
  if(!['index.html','assets/xlsx-worker.js','assets/vendor/xlsx-0.20.3.min.js'].includes(file)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':file.endsWith('.js')?'application/javascript':'text/html; charset=utf-8'});res.end(fs.readFileSync(path.join(root,file)));
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:browserExecutable()});
 async function scenario(name,run){
  const context=await browser.newContext();await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await context.addInitScript(()=>Object.defineProperty(navigator,'onLine',{get:()=>false}));
  const page=await context.newPage();page.on('dialog',dialog=>dialog.accept());const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{await page.goto(origin);await run(page);assert.deepEqual(errors,[],name+' browser errors');console.log('OK '+name);}finally{await context.close();}
 }
 try{
  await scenario('H01 CSV hostil y campos entrecomillados',async page=>{
   await page.evaluate(()=>{window.auditXss=0;processCSV(new File(['date,type,symbol,qty,price,fee\r\n"2026-01-01","BUY","BTC","1","100","0"'],'<img src=x onerror="window.auditXss=1">.csv',{type:'text/csv'}));});
   await page.waitForSelector('#csvModal');await page.waitForTimeout(100);
   check(await page.evaluate(()=>window.auditXss===0&&document.querySelectorAll('#csvModal img').length===0),'Filename is inert');
   check((await page.locator('#csvModal').innerText()).includes('<img src=x'),'Filename displayed literally');
   check(await page.evaluate(()=>csvPendingOps.length===1&&csvPendingOps[0].feeStatus==='confirmed_zero'),'Quoted CSV and explicit zero commission');
  });
  await scenario('H04 compra/venta e importación idempotente',async page=>{
   const result=await page.evaluate(()=>{
    ST=emptyPortfolioState();ST.crypto=[{id:'btc',positionId:'pos_btc',sym:'BTC',name:'Bitcoin',wallet:'Binance',qty:10,buy:100,avgBuy:100,openCost:1000,date:'2026-01-01'}];
    csvPendingOps=[{sym:'BTC',date:'2026-01-02',type:'COMPRA',qty:1,price:100,comm:0,importId:'synthetic-source:2'},{sym:'BTC',date:'2026-01-02',type:'VENTA',qty:1,price:100,comm:0,importId:'synthetic-source:3'}];
    showImportPreview(csvPendingOps,'synthetic.csv');confirmCSVImport();const first={qty:ST.crypto[0].qty,count:ST.hist.length};
    showImportPreview(csvPendingOps,'synthetic.csv');confirmCSVImport();return {first,qty:ST.crypto[0].qty,count:ST.hist.length};
   });check(result.first.qty===10&&result.first.count===2,'Buy and sell both applied');check(result.qty===10&&result.count===2,'Reimport is idempotent');
   const repeated=await page.evaluate(()=>{
    csvPendingOps=[2,3].map(i=>({sym:'BTC',date:'2026-01-03',type:'COMPRA',qty:1,price:100,comm:0,importId:'other-source:'+i}));showImportPreview(csvPendingOps,'synthetic.csv');confirmCSVImport();return {qty:ST.crypto[0].qty,count:ST.hist.length};
   });check(repeated.qty===12&&repeated.count===4,'Identical legitimate rows retain distinct source IDs');
  });
  await scenario('H03 backup JSON con disco lleno',async page=>{
   await page.evaluate(()=>{
    ST=emptyPortfolioState();ST.stocks=[{id:'test',positionId:'pos_test',sym:'OLD',name:'Original',qty:1,buy:100,openCost:100,date:'2026-01-01'}];save(true,{scheduleSync:false});
    const write=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===SKEY)throw new DOMException('Synthetic quota','QuotaExceededError');return write.call(this,k,v);};
    importData({target:{files:[new File([JSON.stringify({...ST,stocks:[{...ST.stocks[0],sym:'NEW'}]})],'synthetic.json')],value:''}});
   });await page.waitForTimeout(150);
   check(await page.evaluate(()=>ST.stocks[0].sym==='OLD'&&JSON.parse(localStorage.getItem(SKEY)).stocks[0].sym==='OLD'),'JSON failure preserves state and disk');
   check(await page.locator('#toast').evaluate(e=>e.classList.contains('err')),'JSON failure shows error');
  });
  await scenario('H05 cuentas A, local y B aisladas',async page=>{
   const result=await page.evaluate(async()=>{
    ST=emptyPortfolioState();ST.stocks=[{id:'a',positionId:'pos_a',sym:'ACCOUNT_A',name:'A',qty:1,buy:100,openCost:100,date:'2026-01-01'}];save(true,{scheduleSync:false});localStorage.setItem(PORTFOLIO_OWNER_KEY,'A');loadedPortfolioOwner='A';
    syncUser={id:'A'};sb={auth:{signOut:async()=>({})}};await signOutSync();const afterLogout=ST.stocks.length;
    syncUser={id:'B'};sb={};readCloudPortfolio=async()=>null;let uploads=0;pushToCloud=async()=>{uploads++;return true;};await checkForConflictsAndSync();const bCount=ST.stocks.length;
    ensurePortfolioOwner('A');return {afterLogout,bCount,uploads,restored:ST.stocks[0]?.sym};
   });check(result.afterLogout===0&&result.bCount===0&&result.uploads===0,'B never receives or uploads A');check(result.restored==='ACCOUNT_A','Returning to A restores its preserved portfolio');
   check(await page.evaluate(()=>{syncUser={id:'C'};const before=JSON.stringify(ST),owner=currentPortfolioOwner(),write=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===SKEY)throw new DOMException('Synthetic quota','QuotaExceededError');return write.call(this,k,v);};try{ensurePortfolioOwner('C');return false;}catch{return JSON.stringify(ST)===before&&currentPortfolioOwner()===owner;}}),'Failed owner switch does not lose or reassign data');
  });
  await scenario('H05 asociación local exige una decisión',async page=>{
   const result=await page.evaluate(()=>{ST=emptyPortfolioState();ST.stocks=[{id:'local',positionId:'pos_local',sym:'LOCAL',name:'Local',qty:1,buy:100,openCost:100,date:'2026-01-01'}];save(true,{scheduleSync:false});let asked=0;window.confirm=()=>{asked++;return false;};ensurePortfolioOwner('B');const count=ST.stocks.length;switchPortfolioOwner('local');return {asked,count,local:ST.stocks[0]?.sym};});
   check(result.asked===1&&result.count===0&&result.local==='LOCAL','Declining association preserves a separate local portfolio');
  });
  await scenario('H05 protección entre pestañas',async page=>{
   await page.evaluate(()=>{ST=emptyPortfolioState();ST.stocks=[{id:'a',positionId:'pos_a',sym:'ACCOUNT_A',name:'A',qty:1,buy:100,openCost:100,date:'2026-01-01'}];save(true,{scheduleSync:false});ensurePortfolioOwner('A');});
   const second=await page.context().newPage();await second.goto(origin);await second.evaluate(()=>ensurePortfolioOwner('B'));
   await page.waitForFunction(()=>window._mrpExternalStateChanged===true);
   check(await page.evaluate(()=>{try{ensurePortfolioOwner('A');return false;}catch{return currentPortfolioOwner()==='A'&&localStorage.getItem(PORTFOLIO_OWNER_KEY)==='B';}}),'A stale tab cannot relabel B data');
   check(await second.evaluate(()=>ST.stocks.length===0&&JSON.parse(localStorage.getItem(ownerArchiveKey('A'))).state.stocks[0].sym==='ACCOUNT_A'),'Both owners preserved across tabs');
   await second.close();
  });
  await scenario('H06 resultado neto explícito, incluido cero',async page=>{
   const result=await page.evaluate(()=>{ST.trading.positions=[{id:'trade',sym:'TEST',name:'Test',entry:100,qty:2,dir:'long',style:'swing',status:'open',date:'2026-01-01'}];closeTrade('trade');const retained=ST.trading.positions[0].status;saveTrade();const missing=ST.trading.positions[0].status;$('tPnlReal').value='0';saveTrade();return {retained,missing,status:ST.trading.positions[0].status,pnl:ST.trading.positions[0].pnlReal};});
   check(result.retained==='open'&&result.missing==='open','Missing realized result does not close');check(result.status==='closed'&&result.pnl===0,'An explicit net zero is preserved');
  });
  await scenario('H02 Excel actualizado y aislado',async page=>{
   const XLSX=require('../assets/vendor/xlsx-0.20.3.min.js');check(XLSX.version==='0.20.3','Pinned official parser version');
   const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Tiempo','Par','Lado','Precio','Ejecutado','Tarifa'],['2026-01-02 10:00:00','BTCUSDT','BUY',100,'1BTC','0USDT']]),'Trades');
   const bytes=Array.from(XLSX.write(book,{type:'buffer',bookType:'xlsx'}));
   await page.evaluate(bytes=>processCSV(new File([new Uint8Array(bytes)],'synthetic.xlsx',{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),bytes);
   await page.waitForSelector('#csvModal');
   check(await page.evaluate(()=>window.XLSX===undefined&&csvPendingOps.length===1&&csvPendingOps[0].sym==='BTC'&&csvPendingOps[0].qty===1),'Workbook parsed only inside worker');
  });
  await scenario('H07 entradas inválidas no sustituyen la cartera',async page=>{
   await page.evaluate(()=>{ST=emptyPortfolioState();ST.stocks=[{id:'valid',positionId:'pos_valid',sym:'VALID',name:'Valid',qty:1,buy:100,openCost:100,date:'2026-01-01'}];save(true,{scheduleSync:false});const bad={stocks:[{id:'bad',sym:'BAD',qty:-1,openCost:-100,date:'2026-13-40'}],crypto:[]};importData({target:{files:[new File([JSON.stringify(bad)],'invalid.json')],value:''}});});await page.waitForTimeout(100);
   check(await page.evaluate(()=>ST.stocks[0].sym==='VALID'&&JSON.parse(localStorage.getItem(SKEY)).stocks[0].sym==='VALID'),'Invalid backup leaves both copies unchanged');
  });
  console.log('OK Auditoría navegador: '+checks+' comprobaciones; datos sintéticos, red externa bloqueada.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
