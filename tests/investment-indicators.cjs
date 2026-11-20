// Synthetic market responses, positions and liquidity. No network or real account.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const harness = fs.readFileSync(path.join(__dirname,'regression.cjs'),'utf8').split('const tests = String.raw`')[0];
const outer = {require,__dirname,console,URL,AbortController};
vm.runInNewContext(harness+'\nthis.context=context; this.app=appSource.slice(0,initIndex);',outer);
vm.runInContext(outer.app+String.raw`
(async()=>{
  let checks = 0;
  const check = (condition,message) => {assert(condition,message); checks++;};
  const position = (id,sym) => ({
    id,positionId:'pos_'+id,sym,name:sym,qty:10,buy:50,openCost:500,avgBuy:50,
    status:'active',broker:'Synthetic',wallet:'Synthetic',date:'2026-01-01',costFeeStatus:'fees_recorded'
  });
  ST.stocks=[position('stock','AAPL')];
  ST.crypto=[position('crypto','BTC')];
  renderAll=()=>{}; updateMarketHours=()=>{}; showToast=()=>{}; checkAlerts=()=>{};
  renderAlerts=()=>{}; fetchBenchmarks=()=>{}; refreshCedearCurrentCCL=async()=>{};
  scheduleCloudSync=()=>{throw new Error('Automatic price refresh should not upload data');};

  const baseTime=Math.floor(Date.now()/1000)*1000-180000;
  let marketPrice=150,marketTime=baseTime,cryptoSource='binance';
  const reply=data=>({ok:true,json:async()=>data});
  fetchWithFallback=async url=>{
    if(url.includes('AAPL?'))return reply({chart:{result:[{meta:{
      symbol:'AAPL',regularMarketPrice:marketPrice,currency:'USD',regularMarketTime:marketTime/1000
    }}]}});
    if(url.includes('BTCUSDT')&&cryptoSource==='binance')return reply({symbol:'BTCUSDT',lastPrice:marketPrice,closeTime:marketTime});
    if(url.includes('coingecko')&&cryptoSource!=='binance') return reply({bitcoin:{
      usd:marketPrice,last_updated_at:cryptoSource==='with-time'?marketTime/1000:undefined
    }});
    return null;
  };

  const initial=JSON.parse(JSON.stringify(ST));
  await updatePrices({automatic:true});
  const stock=()=>ST.stocks[0],btc=()=>ST.crypto[0];
  check(positionDrawdown(stock()).status==='Historial insuficiente','A single observation cannot generate a drawdown');
  marketPrice=120; marketTime+=60000;
  await updatePrices({automatic:true});
  let drawdown=positionDrawdown(stock());
  check(drawdown.percent===-20&&drawdown.perUnit===-30&&drawdown.estimate===-300,'Drawdown uses timestamped unit prices and current size');
  check(drawdown.peak.maximumTime===baseTime&&drawdown.peak.source==='Yahoo Finance','Peak retains original date and provider');
  check(portfolioStatesEqual(ST,initial),'Automatic updates preserve positions, operations, costs and existing histories');
  check(readMarketPeaks().size===2&&positionDrawdown(btc()).currency==='USDT','Native crypto pricing is kept in its own denomination');
  const backup=exportMarketPeaks(ST);
  const key=marketPeakKey(stock());
  check(Object.keys(backup).length===2&&validateMarketPeaksBackup(backup,ST),'Exported maxima match positions and are valid for restore');
  check(!validateMarketPeaksBackup({[key]:{...backup[key],maximumTime:'0'}},ST),'Restore rejects invalid timestamps');
  check(!validateMarketPeaksBackup(backup,{...ST,stocks:[]}),'Restore rejects maxima for records outside the imported portfolio');
  check(!validateMarketPeaksBackup({[key]:{...backup[key],price:42}},ST),'Restore rejects a maximum below the latest observation');
  ST=JSON.parse(localStorage.getItem(SKEY));
  check(positionDrawdown(stock()).percent===-20,'Read persisted results in a fresh state instance');
  check(rankedDrawdowns(portfolioSummary(),20).every(row=>row.alert),'Threshold is inclusive and independent of gain rules');
  check(rankedDrawdowns(portfolioSummary(),null).every(row=>!row.alert),'Drawdown alert is opt-in');
  check(!validateProfitReviewSettings({drawdownThresholdPct:101}),'Invalid saved threshold is rejected');

  marketPrice=999; marketTime-=60000;
  await updatePrices({automatic:true});
  check(readMarketPeaks().get(marketPeakKey(stock())).price===150,'Out-of-order prices cannot overwrite a known maximum');
  check(positionDrawdown(stock()).status==='Historial insuficiente','Inconsistent quote cache cannot generate an alert');
  marketTime=baseTime+120000; marketPrice=110; cryptoSource='without-time';
  await updatePrices({automatic:true});
  check(priceStatusFor(btc())==='freshness_unknown'&&readMarketPeaks().size===2,'A missing provider time is not replaced by the refresh time');
  cryptoSource='with-time'; marketTime+=1000;
  await updatePrices({automatic:true});
  check(positionDrawdown(btc()).currency==='USD'&&positionDrawdown(btc()).status==='Historial insuficiente','USD prices do not reuse an earlier USDT maximum');
  check(readMarketPeaks().size===3,'Both BTC denomination records remain available separately');
  const sourceTimestamp=stock().priceSourceTimestamp;
  stock().priceSourceTimestamp='2020-01-01T00:00:00Z';
  check(positionDrawdown(stock()).status==='Cotización antigua'&&!rankedDrawdowns(portfolioSummary(),10).some(row=>row.alert),'Stale quotes cannot trigger review');
  stock().priceSourceTimestamp=sourceTimestamp;
  loadedPortfolioOwner='synthetic-other-owner';
  check(!readMarketPeaks().size,'A different portfolio owner cannot read these maxima');
  loadedPortfolioOwner=null;

  applyPositionOperation(stock(),'stock','COMPRA',{qty:10,price:70,comm:2,feeStatus:'recorded',date:'2026-01-02'});
  applyPositionOperation(stock(),'stock','VENTA',{qty:5,price:90,comm:1,feeStatus:'recorded',date:'2026-01-03'});
  check(stock().qty===15&&Math.abs(stock().openCost-901.5)<1e-9,'Partial sale removes only proportional open acquisition cost and recorded fees');
  check(Math.abs(calc(stock()).pnl-748.5)<1e-9&&Math.abs(recordedRealizedPnl(ST.hist[0])-148.5)<1e-9,'Open return is separate from proceeds and realized gain');
  check(positionDrawdown(stock()).estimate===-600&&positionDrawdown(stock()).peak.price===150,'Purchases and sales change the estimate, preserving the price maximum');
  check(calc({...stock(),costUnknown:true}).pnl===null&&calc({...stock(),cur:null}).pnl===null,'Missing valuation or cost generates no fictional gain');
  check(directUSDValuation({...stock(),openCost:null,avgBuy:60.1}).costUSD===901.5,'An older position can use its recorded average cost');

  const cash=(custodian,currency,balanceDecimal,availability='immediate')=>createLiquidityAccount({
    custodian,currency,balanceDecimal,availability,date:'2026-01-01'
  });
  const usd=cash('USD account','USD','100');
  const eur=cash('EUR account','EUR','60');
  const usdc=cash('Stablecoin wallet','USDC','70','invested');
  const second=cash('Second USD account','USD','20');
  check(liquidityReserveSummary().byCurrency.get('USD').available==='0','Existing balances start without investment allocations');
  const holdings=JSON.stringify([ST.stocks,ST.crypto,ST.hist,ST.snaps,ST.aSnaps]);
  setLiquidityReserve(usd,'40','30');
  setLiquidityReserve(eur,'18.25','7.50');
  setLiquidityReserve(usdc,'70','0');
  check(JSON.stringify([ST.stocks,ST.crypto,ST.hist,ST.snaps,ST.aSnaps])===holdings,'Allocating existing funds does not alter financial operations or position data');
  let cashSummary=liquidityReserveSummary().byCurrency;
  check(cashSummary.get('USD').total==='120'&&cashSummary.get('USD').available==='40','Accounts in the same currency count once');
  check(cashSummary.get('EUR').available==='18.25'&&cashSummary.get('USDC').available==='0','Currencies stay separate and locked funds are excluded');
  assert.throws(()=>setLiquidityReserve(usd,'100','1'),/caber en el saldo/);
  applyLiquidityMovement({type:'TRANSFERENCIA',liquidityId:usd.liquidityId,toLiquidityId:second.liquidityId,
    amountDecimal:'65',date:'2026-01-04'});
  cashSummary=liquidityReserveSummary().byCurrency;
  check(cashSummary.get('USD').total==='120'&&cashSummary.get('USD').available==='5'&&cashSummary.get('USD').committed==='30','Transfer preserves balance and only funded reserve remains available');
  check(!ST.hist[0].realizedPnl&&recordedRealizedPnl(ST.hist[0])===null,'Transfers between own accounts generate no realized gains');
  check(validatePortfolioStateShape(ST),'An allocation can exceed its later balance without making the portfolio invalid');
  check(!validateLiquidityState({liquidity:[{...usd,otherReserveDecimal:'-1'}]}),'Negative imported reserves are rejected');
  check(!validateLiquidityState({liquidity:[{...usd,investmentReserveDecimal:10}]}),'Imported allocation uses exact decimal strings');
  console.log('OK Investment indicators: '+checks+' synthetic assertions.');
})().catch(error=>{console.error(error);process.exitCode=1;});
`,vm.createContext({...outer.context,process}));
