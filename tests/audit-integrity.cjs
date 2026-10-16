// H03/H05/H07 regression: synthetic state and simulated disk/network only.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const harness=fs.readFileSync(path.join(__dirname,'regression.cjs'),'utf8').split('const tests = String.raw`')[0];
const outer={require,__dirname,console,URL,AbortController};
vm.runInNewContext(harness+'\nthis.context=context;this.app=appSource.slice(0,initIndex);',outer);
(async()=>await vm.runInContext(outer.app+String.raw`
(async()=>{
 let checks=0,syncs=0;const check=(value,msg)=>{assert(value,msg);checks++;};
 renderAll=()=>{};scheduleCloudSync=()=>syncs++;
 const fixture=(sym='TEST')=>({...emptyPortfolioState(),stocks:[{id:'test',positionId:'pos_test',sym,name:sym,qty:2,buy:100,avgBuy:100,openCost:200,date:'2026-01-01'}]});
 const valid=fixture();
 for(const mutate of [s=>s.stocks[0].qty=-1,s=>s.stocks[0].openCost=-100,s=>s.stocks[0].date='2026-13-40',s=>s.stocks.push({...s.stocks[0]}),s=>s.crypto.push({...s.stocks[0],id:'other'}),s=>s.stocks[0].openCost=999,s=>s.cedearExpenses=[{id:'fee',lotId:'missing',amountDecimal:'10',currency:'ARS'}]]){
  const candidate=JSON.parse(JSON.stringify(valid));mutate(candidate);check(!validatePortfolioStateShape(candidate),'Invalid semantic state rejected');
 }
 check(validatePortfolioStateShape(valid),'Normal state remains valid');
 check(isUSHoliday(new Date('2027-03-26T12:00:00Z'))&&isUSHoliday(new Date('2027-06-18T12:00:00Z')),'Official 2027 holidays included');
 check(validCalendarDate('2024-02-29')&&!validCalendarDate('2025-02-29'),'Real calendar validation');
 check(validCalendarDate('2026-01-01T10:00:00.000Z'),'Timestamp dates stay compatible');
 ST=fixture();save(true,{scheduleSync:false});const before=JSON.stringify(ST),stored=localStorage.getItem(SKEY),changed=localStorage.getItem('mrp_last_local_change');
 const write=localStorage.setItem;
 openEdit('stock','test');$('eName').value='New name';
 localStorage.setItem=(key,value)=>{if(key===SKEY)throw new Error('Synthetic quota');write(key,value);};
 check(saveEdit()===false,'Failed metadata edit reported');
 check(JSON.stringify(ST)===before&&localStorage.getItem(SKEY)===stored,'Metadata rollback keeps memory/disk identical');
 check($('toast').className.includes('err'),'Failed metadata edit never shows success');
 localStorage.setItem=write;
 localStorage.setItem=(key,value)=>{if(key==='mrp_last_local_change')throw new Error('Synthetic timestamp quota');write(key,value);};
 openEdit('stock','test');$('eName').value='Other name';saveEdit();
 check(JSON.stringify(ST)===before&&localStorage.getItem(SKEY)===stored&&localStorage.getItem('mrp_last_local_change')===changed,'Timestamp failure rolls back state and metadata');
 localStorage.setItem=write;
 localStorage.setItem=(key,value)=>{if(key===SKEY)throw new Error('Synthetic replacement quota');write(key,value);};
 assert.throws(()=>replacePortfolioState(fixture('IMPORTED'),{scheduleSync:true}),/conservaron/);checks++;
 check(JSON.stringify(ST)===before&&localStorage.getItem(SKEY)===stored,'Failed replacement keeps original');
 pendingConflict={cloud:fixture('CLOUD'),cloudUpdatedAt:'2026-10-15T10:00:00Z'};conflictChoice='cloud';
 const revision=localStorage.getItem('mrp_cloud_revision');await confirmConflictResolution();
 check(pendingConflict!==null&&JSON.stringify(ST)===before,'Failed cloud persistence keeps the conflict open');
 check(localStorage.getItem('mrp_cloud_revision')===revision,'Failed pull does not advance accepted revision');
 localStorage.setItem=write;pendingConflict=null;
 replacePortfolioState(fixture('IMPORTED'),{scheduleSync:true});
 check(ST.stocks[0].sym==='IMPORTED'&&JSON.parse(localStorage.getItem(SKEY)).stocks[0].sym==='IMPORTED','Successful replacement persists');
 check(localStorage.getItem(V3_MIGRATION_DONE_KEY)==='true','Migration marker persists with state');
 window._mrpInvalidLocalState=true;
 check(saveEdit()===false,'Invalid local source blocks mutations');
 replacePortfolioState(fixture('RECOVERED'));
 check(!window._mrpInvalidLocalState,'A valid explicit restore recovers invalid state');
 const xss=fixture();xss.stocks[0].name='<img src=x onerror=alert(1)>';
 replacePortfolioState(xss);check(!ST.stocks[0].name.includes('<'),'Normalization before persisted render');
 // Async refreshes commit their manual historical changes only after await.
 ST=fixture('ASYNC');save(true,{scheduleSync:false});const asyncStored=localStorage.getItem(SKEY),asyncBefore=JSON.stringify(ST);
 fetchWithFallback=async()=>({ok:true,json:async()=>({venta:1600,fechaActualizacion:new Date().toISOString()})});
 localStorage.setItem=(key,value)=>{if(key===SKEY)throw new Error('Synthetic async quota');write(key,value);};
 check(await refreshCedearCurrentCCL({manual:true})===false&&JSON.stringify(ST)===asyncBefore,'Manual CCL rolls back when persistence fails');
 fetchWithFallback=async()=>({ok:true,json:async()=>({chart:{result:[{meta:{regularMarketPrice:150,chartPreviousClose:140,currency:'USD',regularMarketTime:Math.floor(Date.now()/1000)}}]}})});
 refreshCedearCurrentCCL=async()=>false;fetchBenchmarks=()=>{};
 await updatePrices({automatic:false});
 check(ST.snaps.length===0&&localStorage.getItem(SKEY)===asyncStored,'Failed refresh cannot add an unpersisted historical snapshot');
 check($('toast').className.includes('err'),'Failed manual refresh never announces success');
 localStorage.setItem=write;
 // A response started by A cannot update B after the account switch.
 ST=fixture('ACCOUNT_A');save(true,{scheduleSync:false});localStorage.setItem(PORTFOLIO_OWNER_KEY,'A');loadedPortfolioOwner='A';syncUser={id:'A'};rememberCloudRevision('2026-10-15T10:00:00Z');
 let releaseWrite;
 sb={from(){const builder={update(){return builder;},insert(){return builder;},eq(){return builder;},select(){return builder;},maybeSingle(){return new Promise(resolve=>{releaseWrite=resolve;});}};return builder;}};
 const oldUpload=pushToCloud();switchPortfolioOwner('B');syncUser={id:'B'};
 releaseWrite({data:{updated_at:'2026-10-16T10:00:00Z'},error:null});
 check(await oldUpload===false,'Late upload is invalidated after changing owner');
 check(ST.stocks.length===0&&JSON.parse(localStorage.getItem(SKEY)).stocks.length===0&&readCloudRevision()===undefined,'Late A response does not modify B state or revision');
 console.log('OK Integridad de auditoría: '+checks+' comprobaciones sintéticas, sin red.');
})()
`,outer.context))().catch(error=>{console.error(error);process.exitCode=1;});
