// Synthetic accounting cases. Network and personal data are not used.
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const harness=fs.readFileSync(path.join(__dirname,'regression.cjs'),'utf8').split('const tests = String.raw`')[0];
const outer={require,__dirname,console,URL,AbortController};
vm.runInNewContext(harness+'\nthis.context=context; this.app=appSource.slice(0,initIndex);',outer);
vm.runInContext(outer.app+String.raw`
let checks=0;
const check=(condition,message)=>{assert(condition,message);checks++;};
const reset=()=>{ST=emptyPortfolioState();};
const now=new Date().toISOString();
const dated='2026-01-02';
const blank=(id='one')=>({id,positionId:'pos_'+id,assetType:'stock',sym:'SYN',name:'Synthetic',broker:'Fixture',
  qty:0,openCost:0,status:'closed',cur:150,priceSourceTimestamp:now,priceStatus:'delayed',date:'2026-01-01'});
const trade=(asset,type,qty,price,comm,feeStatus,date=dated)=>{
  applyPositionOperation(asset,'stock',type,{qty,price,comm,feeStatus,date});
  return ST.hist[0];
};
reset();
const incomplete=blank(); ST.stocks.push(incomplete);
const unknown=trade(incomplete,'COMPRA',10,100,0,'not_recorded');
const zero=trade(incomplete,'COMPRA',10,120,0,'confirmed_zero');
const sale=trade(incomplete,'VENTA',5,150,2,'recorded');
const before=JSON.stringify(ST.hist);
check(knownOperationCommission(unknown)===null&&knownOperationCommission(zero)===0,'Explicit zero differs from an unknown fee');
check(knownOperationCommission({...zero,comm:null,commission:null})===null,'A missing amount cannot be treated as explicitly zero');
check(knownOperationCommission({...zero,commission:2})===null,'An inconsistent zero flag does not confirm a fee');
check(incomplete.openCost===1650&&sale.openCostBefore===2200&&sale.realizedPnl===198,'Partial sale preserves proportional costs and net proceeds');
check(realizedResult(sale).status==='provisional'&&realizedResult(sale).amount===198,'Confirmed sale fee does not certify acquisition basis');
check(calc(incomplete).result.status==='provisional'&&calc(incomplete).pnl===600,'Open G/P based on known costs is also provisional');
check(JSON.stringify(ST.hist)===before,'Review does not rewrite the transaction history');

const full=blank('two'); ST.stocks.push(full);
trade(full,'COMPRA',10,100,10,'recorded');
trade(full,'COMPRA',10,120,0,'confirmed_zero');
const sold=trade(full,'VENTA',5,150,0,'confirmed_zero');
check(sold.openCostBefore-sold.openCostAfter===552.5&&realizedResult(sold).amount===197.5,'Complete commissions produce the original average-cost result');
check(realizedResult(sold).status==='confirmed'&&calc(full).result.status==='confirmed','Complete open and realized results are confirmed');
trade(full,'COMPRA',2,140,0,'not_recorded');
check(realizedResult(sold).status==='confirmed','Later purchases do not relabel reliable historical sales');
check(calc(full).result.status==='provisional','Later missing costs affect the still-open result');
const missingSale=trade(full,'VENTA',3,160,0,'not_recorded');
check(realizedResult(missingSale).status==='insufficient','Unknown net proceeds suppress realized figure');
const missing=blank('missing');missing.qty=3;missing.openCost=null;ST.stocks.push(missing);
const unsupported=trade(missing,'VENTA',1,150,0,'confirmed_zero');
check(unsupported.realizedPnl===null&&realizedResult(unsupported).status==='insufficient'&&calc(missing).pnl===null,'Missing basis never turns sale proceeds into profit');
check(!priorAcquisitionFeesKnown({...sold},ST),'A detached record cannot certify the acquisition chain');

const lot=(id,broker,currency,quantity,cost,extra={})=>({
  id,positionId:'pos_'+broker,sym:'SYN',name:'Synthetic CEDEAR',broker,type:'cedeaar',schemaVersion:'cedear-lots-v1',
  qty:Number(quantity),quantityDecimal:quantity,ratioDecimal:'10',unitPriceDecimal:decDiv(cost,quantity,12),
  totalCostDecimal:cost,purchaseCurrency:currency,cur:100,priceSourceTimestamp:now,priceUpdatedAt:now,priceStatus:'delayed',
  date:'2026-01-01',...extra
});
const sellLot=(positionId,qty,currency,comm=0,price=100)=>{
  applyCedearSale(positionId,{qty,price,comm,currency,date:dated,feeStatus:comm?'recorded':'confirmed_zero'});
  return ST.hist[0];
};
reset();
const pesos=lot('ars','pesos','ARS','10','1000',{historicalArsEquivalentDecimal:'1000',feeStatus:'confirmed_zero'});
ST.otros.push(pesos);
const lotBefore=JSON.stringify(pesos);
const firstSale=sellLot(pesos.positionId,5,'ARS');
let group=consolidateCedears()[0];
check(group.quantity==='5'&&group.historicalARS==='500'&&group.currentValueARS==='500'&&group.pnlARS==='0','Required 10 to 5 case has ARS 500 basis and no open loss');
check(cedearLotValues(pesos,{historical:true}).historicalARS==='1000'&&JSON.stringify(pesos)===lotBefore,'Original lot and historical ARS do not change');
check(realizedResult(firstSale).status==='confirmed'&&realizedResult(firstSale).amount===0,'Confirmed realized zero is retained');
const secondSale=sellLot(pesos.positionId,2,'ARS',4);
group=consolidateCedears()[0];
check(group.quantity==='3'&&group.historicalARS==='300'&&realizedResult(secondSale).amount===-4,'Second partial disposal subtracts exactly its remaining cost');
check(decAdd(group.historicalARS,decSum(ST.cedearSales.map(row=>row.costRemovedDecimal)))==='1000','Remaining basis and sale fragments reconcile to original');

reset();
const first=lot('mep','mep','USD_MEP','3','10',{unitPriceDecimal:'3',grossAmountDecimal:'9',historicalArsEquivalentDecimal:'12000'});
const second=lot('second','mep','USD_MEP','2','8',{unitPriceDecimal:'4',grossAmountDecimal:'8',historicalArsEquivalentDecimal:'9600',date:'2026-01-02'});
const other=lot('other','other','USD_MEP','2','30');
ST.otros=[second,first,other];
ST.cedearExpenses=[{id:'fee',lotId:first.id,concept:'Fees',currency:'USD_MEP',amountDecimal:'1'}];
ST.cedearCurrentCclDecimal='1000';ST.cedearCurrentCclUpdatedAt=now;
const one=sellLot(first.positionId,1,'USD_MEP',1,5);
const two=sellLot(first.positionId,3,'USD_MEP',1,5);
check(ST.cedearSales.filter(row=>row.saleGroupId===two.operationId).map(row=>row.lotId).join(',')==='mep,second','Oldest lot is consumed first; second custodian is excluded');
check(realizedResult(one).status==='confirmed'&&realizedResult(two).status==='provisional','CEDEAR fee proof is evaluated for the lots each sale actually consumes');
check(decAdd(cedearLotValues(first).total,decSum(ST.cedearSales.filter(row=>row.lotId===first.id).map(row=>row.costRemovedDecimal)))==='10','Sequential fractional allocations conserve cost plus recorded purchase expenses');
const remaining=consolidateCedears().find(row=>row.positionId===first.positionId);
check(remaining.historicalUSD==='4'&&remaining.historicalARS==='4800'&&remaining.quantity==='1','Remaining MEP and historical ARS bases retain their own denominations');
check(consolidateCedears().find(row=>row.positionId===other.positionId).quantity==='2','Custodians are consolidated separately');
check(remaining.currentValueUSD==='0.1','Current USD applies current CCL to current ARS value separately');
const cashLot=lot('mixed','mep','ARS','4','400',{date:'2025-01-01'});
ST.otros.push(cashLot);
check(consolidateCedears().find(row=>row.positionId===first.positionId).pnlUSD===null,'Open mixed currencies cannot produce a comparable USD MEP cost');
const mixed=sellLot(first.positionId,4,'USD_MEP',0,5);
check(realizedResult(mixed).status==='insufficient'&&mixed.realizedPnl===null,'Do not compare an ARS acquisition with sale in USD MEP');
check(consolidateCedears().find(row=>row.positionId===first.positionId).historicalUSD==='4','A sold ARS lot no longer contaminates the open MEP cost');
ST.cedearExpenses.push({id:'fx',lotId:second.id,concept:'Fee in ARS',currency:'ARS',amountDecimal:'20'});
check(consolidateCedears().find(row=>row.positionId===first.positionId).historicalUSD===null,'Do not omit an unconverted expense from dashboard acquisition cost');

reset();
const old=blank();
ST.stocks=[old];trade(old,'COMPRA',2,100,0,'confirmed_zero');
old.priceSourceTimestamp='2020-01-01T00:00:00Z';
const summary=portfolioSummary();
check(summary.totalUSD===300&&summary.pnlUSD===100&&summary.oldValuations.length===1&&summary.provisional.length===1,'Old quotes still contribute the same amount and carry a provisional label');
check(!profitReviewData(summary).weightReliable&&priceAlertHit({cond:'above',price:100},old)===null,'Old quotes neither certify concentration nor trigger an alert');
check(priceAlertHit({cond:'above',price:100},{...old,priceSourceTimestamp:now})===true,'Fresh quotes use the normal alert threshold');
const usdt=directUSDValuation({...old,priceSourceTimestamp:now,priceSource:'Binance · USDT'},'Cripto');
check(usdt.currentUSD===300&&openResult(usdt).status==='provisional','Existing USDT equivalence stays in the total and is disclosed as an estimate');
const usd=createLiquidityAccount({custodian:'Bank',currency:'USD',balanceDecimal:'100',date:dated});
const eur=createLiquidityAccount({custodian:'Bank',currency:'EUR',balanceDecimal:'25',date:dated});
const baseline=financialSummary().totalUSD;
setLiquidityReserve(usd,'30','40');setLiquidityReserve(eur,'4','3');
check(financialSummary().totalUSD===baseline&&liquidityAccounts().length===2,'Reserves annotate existing accounts and never create value');
check(liquidityReserveSummary().byCurrency.get('EUR').available==='4'&&liquidityReserveSummary().byCurrency.get('USD').available==='30','Reserves stay in their native currencies');
check(validatePortfolioStateShape(ST)&&portfolioStatesEqual(ST,sanitizePortfolioState(JSON.parse(JSON.stringify(ST)))),'Schema and comparable backup round trip stay compatible');
console.log('OK Portfolio financial integrity: '+checks+' synthetic checks.');
`,outer.context);
