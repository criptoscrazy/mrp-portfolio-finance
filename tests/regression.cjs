const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match => match[1])
  .filter(source => source.trim());
const appSource = scripts.sort((a, b) => b.length - a.length)[0];
const initMarker = '// ═══════════════════════════════════════════\n// INIT\n';
const initIndex = appSource.indexOf(initMarker);
assert(initIndex > 0, 'No se encontró el bloque INIT');

class ClassList {
  constructor() { this.values = new Set(); }
  add(...names) { names.forEach(name => this.values.add(name)); }
  remove(...names) { names.forEach(name => this.values.delete(name)); }
  contains(name) { return this.values.has(name); }
  toggle(name, force) {
    const active = force === undefined ? !this.values.has(name) : Boolean(force);
    active ? this.values.add(name) : this.values.delete(name);
    return active;
  }
}

const elements = new Map();
class ElementStub {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.classList = new ClassList();
    this.style = {};
    this.children = [];
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
  }
  set id(value) { this._id = value; if (value) elements.set(value, this); }
  get id() { return this._id || ''; }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = [...children]; }
  setAttribute() {}
  addEventListener() {}
  querySelector() { return null; }
  closest() { return null; }
  getBoundingClientRect() { return { right: 0 }; }
}

const documentStub = {
  visibilityState: 'visible',
  activeElement: null,
  documentElement: new ElementStub('html'),
  getElementById(id) {
    if (!elements.has(id)) {
      const element = new ElementStub();
      element.id = id;
    }
    return elements.get(id);
  },
  createElement(tagName) { return new ElementStub(tagName); },
  addEventListener() {},
  querySelectorAll() { return []; }
};

const storage = new Map();
const localStorageStub = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
};

const context = vm.createContext({
  assert,
  console,
  document: documentStub,
  window: { addEventListener() {}, innerWidth: 1440 },
  localStorage: localStorageStub,
  location: { href: 'http://127.0.0.1:8765/', origin: 'http://127.0.0.1:8765', pathname: '/' },
  navigator: { onLine: true },
  URL,
  AbortController,
  confirm: () => true,
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  setTimeout: () => 1,
  clearTimeout() {},
  setInterval: () => 1,
  clearInterval() {}
});

const tests = String.raw`
(async () => {
  const base = {
    stocks:[{id:'s1',sym:'MSFT',name:'Microsoft',qty:2,buy:100,date:'2026-07-01',cur:200,ch:.01,priceSource:'Yahoo Finance',priceUpdatedAt:'2026-07-31T10:00:00Z'}],
    crypto:[],hist:[],income:[],apyPositions:[],alerts:[],otros:[],snaps:[],aSnaps:{},selAsset:null
  };
  const quoteOnlyDifference = JSON.parse(JSON.stringify(base));
  quoteOnlyDifference.stocks[0].cur = 205;
  quoteOnlyDifference.stocks[0].ch = -.02;
  quoteOnlyDifference.stocks[0].priceUpdatedAt = '2026-07-31T10:03:00Z';
  quoteOnlyDifference.stocks[0].quoteCurrency = 'USD';
  assert(portfolioStatesEqual(base, quoteOnlyDifference), 'Las cotizaciones derivadas no deben crear conflictos');

  const realDifference = JSON.parse(JSON.stringify(base));
  realDifference.stocks[0].qty = 3;
  assert(!portfolioStatesEqual(base, realDifference), 'Un cambio real de cantidad debe seguir detectándose');

  const reordered = { selAsset:null, aSnaps:{}, snaps:[], otros:[], alerts:[], apyPositions:[], income:[], hist:[], crypto:[], stocks:base.stocks };
  assert(portfolioStatesEqual(base, reordered), 'El orden de las propiedades no debe producir conflictos falsos');

  const hostileId = 'x");alert(1)//</button><img src=x onerror=alert(2)>';
  const encodedArgument = inlineArg(hostileId);
  assert(!encodedArgument.includes('<') && !encodedArgument.includes('>'), 'Los argumentos inline no deben permitir HTML');
  const decodedArgument = encodedArgument
    .replaceAll('&quot;', '"').replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
  assert.strictEqual(Function('return ' + decodedArgument)(), hostileId, 'El id hostil debe seguir siendo solo un literal de texto');

  ST = sanitizePortfolioState(JSON.parse(JSON.stringify(base)));
  localStorage.setItem('mrp_last_local_change', '2026-07-31T09:00:00Z');
  save(true, { scheduleSync:false, markChanged:false });
  assert.strictEqual(localStorage.getItem('mrp_last_local_change'), '2026-07-31T09:00:00Z', 'Guardar cotizaciones no debe marcar una edición');

  const legacyCedear = {id:'legacy',type:'cedeaar',sym:'KO',name:'Coca-Cola',qty:100,ratio:3,buyARS:23000,ccl:1400,date:'2025-07-01',broker:'Test',note:'Prueba'};
  const migrated = upgradeCedearState(sanitizePortfolioState({ ...base, otros:[legacyCedear] }));
  assert.strictEqual(migrated.otros[0].purchaseCurrency,'ARS','La migración debe clasificar registros anteriores como ARS');
  assert.strictEqual(migrated.otros[0].quantityDecimal,'100','La migración debe preservar la cantidad');
  assert.strictEqual(migrated.otros[0].unitPriceDecimal,'23000','La migración debe mover el precio unitario');
  assert.strictEqual(migrated.otros[0].cclAtPurchaseDecimal,'1400','La migración debe preservar el CCL histórico');
  assert.strictEqual(migrated.otros[0].totalCostDecimal,'2300000','La migración debe preservar el costo histórico conocido');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(upgradeCedearState(migrated))),JSON.parse(JSON.stringify(migrated)),'La migración debe ser idempotente');
  assert(portfolioStatesEqual({ ...base, otros:[legacyCedear] },migrated),'La migración compatible no debe provocar un conflicto de sincronización');

  const makeLot=(id,sym,date,qty,unit,total,ticket,ratio='10')=>({id,positionId:'pos_cedear_'+sym.toLowerCase()+'_test',assetType:'cedeaar',type:'cedeaar',sym,name:sym,dated:date,date,
    purchaseCurrency:'USD_MEP',quantityDecimal:qty,ratioDecimal:ratio,unitPriceDecimal:unit,
    grossAmountDecimal:decMul(qty,unit),totalCostDecimal:total,cclAtPurchaseDecimal:null,mepAtPurchaseDecimal:null,
    historicalArsEquivalentDecimal:null,ticketNumber:ticket,informationSource:'Caso de aceptación',schemaVersion:'cedear-lots-v1',
    qty:Number(qty),ratio:Number(ratio),buyARS:null,ccl:null,broker:'Test',note:''});
  const lots=[
    makeLot('a1','AAPL','2025-07-29','281','10.6500','3013.29','874213'),
    makeLot('a2','AAPL','2025-08-06','279','10.7778','3027.75','918256'),
    makeLot('a3','AAPL','2025-08-08','204','11.2000','2300.55','932233'),
    makeLot('a4','AAPL','2025-09-16','58','12.0100','701.38','1122656'),
    makeLot('n1','NVDA','2025-07-29','271','7.3892','2016.29','874215','8'),
    makeLot('t1','TSLA','2025-07-29','69','21.4993','1493.68','874214','12')
  ];
  ST = sanitizePortfolioState({ ...base, otros:lots,cedearExpenses:[],cedearValuations:[],snaps:[] });
  const groups=consolidateCedears();
  const apple=groups.find(group=>group.sym==='AAPL');
  assert.strictEqual(apple.quantity,'822','AAPL debe consolidar 822 CEDEARs exactamente');
  assert.strictEqual(apple.costs.USD_MEP,'9042.97','AAPL debe consolidar 9042.97 USD MEP exactamente');
  assert.strictEqual(apple.averages.USD_MEP,'11.00118005','El promedio AAPL debe ser 11.00118005');
  assert.strictEqual(apple.lots.length,4,'AAPL debe conservar cuatro lotes');
  assert.strictEqual(decDiv('3013.29','281',8),'10.72345196','El efectivo unitario del primer lote AAPL debe ser exacto');
  assert.strictEqual(decDiv('3027.75','279',8),'10.85215054','El efectivo unitario del segundo lote AAPL debe ser exacto');
  assert.strictEqual(decDiv('2300.55','204',8),'11.27720588','El efectivo unitario del tercer lote AAPL debe ser exacto');
  assert.strictEqual(decDiv('701.38','58',8),'12.09275862','El efectivo unitario del cuarto lote AAPL debe ser exacto');
  assert.strictEqual(groups.find(group=>group.sym==='NVDA').averages.USD_MEP,'7.4401845','NVDA debe promediar 7.4401845');
  assert.strictEqual(groups.find(group=>group.sym==='TSLA').averages.USD_MEP,'21.64753623','TSLA debe promediar 21.64753623');
  assert.strictEqual(apple.pnlARS,null,'Sin equivalente histórico ARS el resultado nominal debe quedar pendiente');
  assert.strictEqual(apple.pnlImplicitUSD,null,'Sin precio/CCL actual el resultado implícito debe quedar pendiente');

  const mixedLot={...makeLot('mixed','AAPL','2025-10-01','1','10','10','MIXED'),purchaseCurrency:'USD_CABLE'};
  ST.cedearExpenses=[{id:'fee1',lotId:'mixed',concept:'Comisión ARS',amountDecimal:'100',currency:'ARS'}];
  const mixedGroup=consolidateCedears([...lots,mixedLot]).find(group=>group.sym==='AAPL');
  assert.strictEqual(mixedGroup.costs.ARS,'100','Un gasto en otra moneda debe conservarse por separado');
  assert.strictEqual(mixedGroup.pnlImplicitUSD,null,'No se debe combinar MEP y cable para una G/P implícita');
  ST.cedearExpenses=[];

  const preMigration={ ...base, otros:[legacyCedear] };
  localStorage.setItem(SKEY,JSON.stringify(preMigration));
  localStorage.removeItem(CEDEAR_MIGRATION_BACKUP_KEY);
  loadState();
  assert(localStorage.getItem(CEDEAR_MIGRATION_BACKUP_KEY),'La carga debe generar backup antes de migrar');
  assert.strictEqual(ST.otros[0].schemaVersion,'cedear-lots-v1','La carga debe migrar el registro anterior');
  ST = sanitizePortfolioState({ ...base, otros:lots,cedearExpenses:[],cedearValuations:[],snaps:[] });

  renderAll = () => {};
  updateMarketHours = () => {};
  checkAlerts = () => {};
  fetchBenchmarks = () => {};
  renderAlerts = () => {};
  showToast = () => {};
  let scheduledSyncs = 0;
  scheduleCloudSync = () => { scheduledSyncs++; };
  fetchWithFallback = async url => {
    if (url.includes('dolarapi.com/v1/dolares/contadoconliqui')) return { ok:true, json:async () => ({ venta:1200, fechaActualizacion:'2026-08-04T10:00:00.000Z' }) };
    if (url.includes('MSFT')) return { ok:true, json:async () => ({ chart:{ result:[{ meta:{ regularMarketPrice:210, chartPreviousClose:205, currency:'USD', regularMarketTime:1785517200 } }] } }) };
    if (url.includes('AAPL.BA')||url.includes('NVDA.BA')||url.includes('TSLA.BA')) return { ok:true, json:async () => ({ chart:{ result:[{ meta:{ regularMarketPrice:24000, chartPreviousClose:23500, currency:'ARS', regularMarketTime:1785517200 } }] } }) };
    return null;
  };

  localStorage.setItem('mrp_last_local_change', '2026-07-31T09:00:00Z');
  await updatePrices({ automatic:true });
  const updatedCedear = ST.otros.find(item => item.id === 'a1');
  assert.strictEqual(updatedCedear.cur, 24000, 'Debe cargar el precio actual del CEDEAR');
  assert.strictEqual(updatedCedear.quoteSymbol, 'AAPL.BA', 'Debe consultar el ticker BYMA');
  assert.strictEqual(updatedCedear.quoteCurrency, 'ARS', 'Debe conservar la moneda ARS');
  assert(updatedCedear.priceSource.includes('BYMA'), 'Debe identificar la fuente BYMA');
  assert.strictEqual(ST.cedearCurrentCclDecimal, '1200', 'Debe guardar el CCL automático válido');
  assert.strictEqual(ST.cedearCurrentCclMode, 'auto', 'Debe identificar la fuente automática del CCL');
  assert.strictEqual(ST.cedearCurrentCclMethod, 'CCL venta', 'Debe conservar la modalidad de CCL utilizada');
  assert(ST.cedearCurrentCclSourceTimestamp, 'Debe conservar el timestamp de la fuente del CCL');
  assert(ST.cedearCurrentCclRetrievedAt, 'Debe conservar cuándo MRP consultó el CCL');
  assert(updatedCedear.priceSourceTimestamp, 'Debe conservar el timestamp de la cotización BYMA');
  assert(updatedCedear.priceRetrievedAt, 'Debe conservar cuándo MRP consultó la cotización BYMA');
  assert.strictEqual(updatedCedear.priceStatus, 'last_close', 'Una cotización antigua debe identificarse como último cierre, no como tiempo real');
  const valuedApple=consolidateCedears().find(group=>group.sym==='AAPL');
  assert.strictEqual(valuedApple.historicalUSD, '9042.97', 'El coste USD MEP debe ser el importe histórico real pagado');
  assert.strictEqual(valuedApple.currentValueUSD, '16440', 'El valor actual USD debe ser ARS dividido por CCL actual');
  assert.strictEqual(valuedApple.pnlUSD, '7397.03', 'La G/P USD no debe depender del CCL histórico');
  assert(valuedApple.quoteCclSkewMs >= 0, 'La valoración CEDEAR debe conservar el desfase entre CCL y cotización');
  const consolidatedSummary=portfolioSummary();
  const consolidatedCedears=consolidatedSummary.valued.filter(item=>item.assetClass==='CEDEARs');
  assert.strictEqual(consolidatedCedears.length, 3, 'El Dashboard debe consolidar los seis lotes en tres posiciones CEDEAR sin duplicarlos');
  assert.strictEqual(consolidatedSummary.byClass.CEDEARs, 23240, 'El Dashboard debe incorporar los CEDEARs en USD');
  const retainedCCL=ST.cedearCurrentCclDecimal;
  fetchWithFallback = async () => null;
  assert.strictEqual(await refreshCedearCurrentCCL(), false, 'Debe informar si no hay CCL automático disponible');
  assert.strictEqual(ST.cedearCurrentCclDecimal, retainedCCL, 'Un fallo de fuente no debe reemplazar el CCL válido por cero');
  fetchWithFallback = async url => {
    if (url.includes('dolarapi.com/v1/dolares/contadoconliqui')) return { ok:true, json:async () => ({ venta:1200, fechaActualizacion:'2026-08-04T10:00:00.000Z' }) };
    if (url.includes('MSFT')) return { ok:true, json:async () => ({ chart:{ result:[{ meta:{ regularMarketPrice:210, chartPreviousClose:205, currency:'USD', regularMarketTime:1785517200 } }] } }) };
    if (url.includes('AAPL.BA')||url.includes('NVDA.BA')||url.includes('TSLA.BA')) return { ok:true, json:async () => ({ chart:{ result:[{ meta:{ regularMarketPrice:24000, chartPreviousClose:23500, currency:'ARS', regularMarketTime:1785517200 } }] } }) };
    return null;
  };
  assert.strictEqual(ST.snaps.length, 0, 'La actualización automática no debe crear snapshots');
  assert.strictEqual(localStorage.getItem('mrp_last_local_change'), '2026-07-31T09:00:00Z', 'La actualización automática no debe cambiar el timestamp de usuario');
  assert.strictEqual(scheduledSyncs, 0, 'La actualización automática no debe subir cotizaciones a la nube');

  await updatePrices({ automatic:false });
  assert.strictEqual(ST.snaps.length, 1, 'La actualización manual sí debe mantener la evolución diaria');
  assert.notStrictEqual(localStorage.getItem('mrp_last_local_change'), '2026-07-31T09:00:00Z', 'La actualización manual debe sincronizar su snapshot');
  assert.strictEqual(scheduledSyncs, 1, 'La actualización manual sí debe programar la sincronización');

  const totalBeforePending=portfolioSummary().totalUSD;
  ST.stocks.push({id:'pending',sym:'PEND',name:'Activo sin cotización',qty:5,buy:999,date:'2026-08-01'});
  const pendingSummary=portfolioSummary();
  assert.strictEqual(pendingSummary.totalUSD, totalBeforePending, 'Un coste histórico no puede sustituir silenciosamente una cotización faltante');
  assert(pendingSummary.pending.some(item=>item.id==='pending'&&item.status==='pending'), 'El activo sin precio debe permanecer identificado como pendiente');
  const stateBeforeOnlyPending=ST;
  ST=sanitizePortfolioState({ ...base, stocks:[{id:'only-pending',sym:'N/D',name:'Solo pendiente',qty:1,buy:100,date:'2026-08-01'}], otros:[] });
  assert.strictEqual(portfolioSummary().totalUSD, null, 'Un portafolio con posiciones sin valoración debe mostrar N/D, no cero');
  ST=stateBeforeOnlyPending;

  $('otroEditId').value = 'a1';
  const editValues = { name:'Apple editado',purchaseCurrency:'USD_MEP',quantityDecimal:'281',ratioDecimal:'10',unitPriceDecimal:'10.6500',grossAmountDecimal:'2992.65',totalCostDecimal:'3013.29',cclAtPurchaseDecimal:'',mepAtPurchaseDecimal:'',historicalArsEquivalentDecimal:'',ticketNumber:'874213',informationSource:'Broker',date:'2025-07-30',broker:'Broker editado',note:'Nota editada' };
  Object.entries(editValues).forEach(([key, value]) => { $('oe_' + key).value = value; });
  saveOtroEdit();
  const editedCedear = ST.otros.find(item => item.id === 'a1');
  assert.strictEqual(editedCedear.name, 'Apple editado', 'Debe editar activos de Otros');
  assert.strictEqual(editedCedear.quantityDecimal,'281','Debe guardar la cantidad decimal editada');
  assert.strictEqual(editedCedear.totalCostDecimal,'3013.29','Debe conservar el costo total del lote');
  assert.strictEqual(editedCedear.cur, 24000, 'Editar no debe borrar la última cotización');
  const historicalValuationsBeforeRender=JSON.stringify(ST.cedearValuations);
  renderCedearTimeline();
  assert($('cedTimelineTb').innerHTML.includes('2025-07-29'), 'Editar metadatos no debe reescribir la fecha histórica del lote');
  assert($('cedTimelineTb').innerHTML.includes('Valuación histórica'), 'El Timeline debe identificar sus valuaciones como históricas');
  assert.strictEqual(JSON.stringify(ST.cedearValuations), historicalValuationsBeforeRender, 'Renderizar el Timeline no debe modificar los snapshots históricos');

  openOtroEdit('a1');
  assert($('otroEditModalOverlay').classList.contains('open'), 'Debe abrir el editor de Otros');
  assert.strictEqual($('oe_quantityDecimal').value,'281','El editor debe cargar la cantidad actual');
  assert.strictEqual($('oe_sym').readOnly, true, 'El símbolo debe quedar protegido en la edición');
  closeOtroEdit();

  renderOtros();
  assert($('cedTb').innerHTML.includes('24.000,00'), 'La tabla CEDEAR debe mostrar el precio actual ARS');
  assert($('cedTb').innerHTML.includes('9.042,97'), 'La tabla CEDEAR debe mostrar el costo MEP consolidado');
  assert($('cedTb').innerHTML.includes('16.440,00'), 'La tabla CEDEAR debe destacar el valor actual USD');
  assert($('cedTb').innerHTML.includes('Ver lotes'), 'La tabla CEDEAR debe abrir compras/lotes');

  openAssetDetails('otro', 'a1');
  assert($('detailModalOverlay').classList.contains('open'), 'Debe abrir el detalle de solo lectura');
  const detailText = $('detailGrid').children.flatMap(item => item.children.map(child => child.textContent)).join(' | ');
  assert(detailText.includes('Precio actual BYMA'), 'El detalle debe identificar el precio BYMA');
  assert(detailText.includes('Costo total'), 'El detalle debe mostrar el costo total del lote');
  assert(detailText.includes('Ticket / comprobante'), 'El detalle debe mostrar trazabilidad del ticket');

  renderTbl(ST.stocks, 'sTb', 'stock');
  assert($('sTb').children[0].innerHTML.includes('btn-view'), 'Acciones también debe ofrecer Más información');
  openAssetDetails('stock', 's1');
  assert($('detailSub').textContent.includes('Acción'), 'El detalle común debe funcionar para acciones');
  renderTbl([{id:'hostile-row',positionId:'pos_stock_hostile',assetType:'stock',status:'active',sym:'BAD',name:'<img src=x onerror=alert(1)>',sector:'<script>alert(2)</script>',qty:1,buy:1,avgBuy:1,openCost:1,date:'2026-01-01',broker:'<svg onload=alert(3)>',note:'<b>nota</b>'}], 'sTb', 'stock');
  assert(!$('sTb').children[0].innerHTML.includes('<img src=x'),'Las posiciones importadas no deben inyectar HTML en la tabla');
  assert(!$('sTb').children[0].innerHTML.includes('<script>'),'Las posiciones importadas no deben materializar etiquetas script');

  const v2ForMigration={
    ...base,
    stocks:[
      {id:'btc-stock-no',sym:'AAPL',name:'Apple',qty:2,buy:100,date:'2025-01-01',broker:'Broker A'},
      {id:'btc-stock-other',sym:'AAPL',name:'Apple',qty:3,buy:120,date:'2025-01-02',broker:'Broker B'}
    ],
    crypto:[
      {id:'btc-binance',sym:'BTC',name:'Bitcoin',qty:1,buy:30000,date:'2025-01-01',custody:'exchange',wallet:'Binance'},
      {id:'btc-exodus',sym:'BTC',name:'Bitcoin',qty:2,buy:35000,date:'2025-01-02',custody:'hot',wallet:'Exodus'}
    ],
    hist:[{id:'legacy-buy',date:'2025-01-01',type:'COMPRA',sym:'BTC',qty:1,price:30000,comm:0,notes:'Carga anterior'}],
    otros:lots,
    cedearExpenses:[],cedearValuations:[{id:'snap-ced',date:'2025-08-01',sym:'AAPL',cedearPriceArsDecimal:'20000',cclDecimal:'1200',source:'Prueba'}],
    snaps:[{date:'2025-08-01',value:12345}],aSnaps:{BTC:[{date:'2025-01-01',value:30000}]}
  };
  const dryRun=migratePortfolioV2ToV3(v2ForMigration,{dryRun:true});
  assert.strictEqual(dryRun.report.errors.length,0,'El dry run V2→V3 debe conservar cantidades, costes y colecciones históricas');
  assert.deepStrictEqual(dryRun.report.before,dryRun.report.after,'El informe antes/después debe ser idéntico');
  assert.strictEqual(dryRun.state.hist[0].legacy,true,'El Historial V2 debe conservarse como legado sin reconstruir posiciones');
  assert.strictEqual(dryRun.state.snaps[0].value,12345,'Los snapshots deben conservarse exactamente');
  assert.strictEqual(dryRun.state.aSnaps.BTC[0].value,30000,'Los snapshots por activo deben conservarse exactamente');
  assert.strictEqual(dryRun.state.otros[0].quantityDecimal,lots[0].quantityDecimal,'Los lotes CEDEAR deben conservar su cantidad original');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(migratePortfolioV2ToV3(dryRun.state).state)),JSON.parse(JSON.stringify(dryRun.state)),'La migración V3 debe ser idempotente');

  localStorage.removeItem(SKEY);
  localStorage.removeItem(LEGACY_SKEY);
  localStorage.removeItem(V3_MIGRATION_DONE_KEY);
  localStorage.setItem(LEGACY_SKEY,JSON.stringify(v2ForMigration));
  localStorage.setItem(V3_MIGRATION_DONE_KEY,'true');
  ST=sanitizePortfolioState({stocks:[],crypto:[],otros:[],hist:[],income:[],apyPositions:[],alerts:[],snaps:[],aSnaps:{},selAsset:null});
  loadState();
  assert.strictEqual(ST.stocks.length,0,'Un V2 antiguo no debe reaparecer después de vaciar V3 intencionadamente');

  ST=dryRun.state;
  const btcBinance=ST.crypto.find(item=>item.wallet==='Binance');
  const btcExodus=ST.crypto.find(item=>item.wallet==='Exodus');
  assert.notStrictEqual(btcBinance.positionId,btcExodus.positionId,'El mismo símbolo en custodios distintos debe tener positionId diferente');
  assert(positionIsClosed({qty:0},'crypto'),'Una posición heredada con cantidad cero debe considerarse cerrada aunque no tenga status');
  assert.strictEqual(resolveImportedPosition({sym:'BTC',notes:'CSV import'}),null,'Un CSV no debe elegir silenciosamente entre dos custodios del mismo símbolo');
  assert.strictEqual(resolveImportedPosition({sym:'BTC',notes:'Binance export'}).asset,btcBinance,'Un archivo Binance debe identificar la posición Binance cuando es única');
  const sol={id:'sol-unique',positionId:'pos_crypto_sol_unique',assetType:'crypto',sym:'SOL',name:'Solana',qty:2,buy:100,avgBuy:100,openCost:200,status:'active',date:'2025-01-01',custody:'exchange',wallet:'Kraken'};
  ST.crypto.push(sol);
  assert.strictEqual(resolveImportedPosition({sym:'SOL',notes:'CSV import'}).asset,sol,'Un CSV puede dirigirse a una única posición inequívoca');
  applyPositionOperation(btcBinance,'crypto','COMPRA',{qty:1,price:50000,comm:100,date:'2026-08-10',notes:'Segunda compra'});
  assert.strictEqual(btcBinance.buy,30000,'P. COMPRA debe conservar el precio original');
  assert.strictEqual(btcBinance.qty,2,'La compra debe aumentar la cantidad de la posición exacta');
  assert.strictEqual(btcBinance.openCost,80100,'El coste abierto debe incluir la compra y su comisión');
  assert.strictEqual(btcBinance.avgBuy,40050,'P. PROM. DCA debe ser el promedio ponderado actual');
  assert.strictEqual(calcDCA(btcBinance).avgPrice,40050,'DCA debe leer la posición y no mezclar custodios');
  assert.strictEqual(calcDCA(btcExodus).avgPrice,35000,'El BTC de Exodus debe conservar su propio promedio');
  const historyAfterBuy=ST.hist[0];
  assert.strictEqual(historyAfterBuy.positionId,btcBinance.positionId,'La compra automática debe quedar vinculada a positionId');
  assert.strictEqual(historyAfterBuy.price,50000,'Historial debe conservar el precio individual de la compra');

  applyPositionOperation(btcBinance,'crypto','VENTA',{qty:.5,price:60000,comm:50,date:'2026-08-11',notes:'Venta parcial'});
  assert.strictEqual(btcBinance.qty,1.5,'La venta parcial debe reducir la cantidad');
  assert.strictEqual(btcBinance.avgBuy,40050,'Una venta parcial no debe alterar el promedio de las unidades abiertas');
  assert.strictEqual(ST.hist[0].price,60000,'Historial debe conservar el precio individual de venta');
  assert(Math.abs(ST.hist[0].realizedPnl-9925)<1e-8,'La venta debe calcular P/L realizado sobre el coste medio abierto');
  const beforeOversell=JSON.stringify(btcBinance);
  assert.throws(()=>applyPositionOperation(btcBinance,'crypto','VENTA',{qty:99,price:1,comm:0,date:'2026-08-12'}),/No podés vender más/,'Debe impedir la sobreventa');
  assert.strictEqual(JSON.stringify(btcBinance),beforeOversell,'Una sobreventa rechazada no debe modificar la posición');
  applyPositionOperation(btcBinance,'crypto','VENTA',{qty:1.5,price:45000,comm:0,date:'2026-08-12',notes:'Cierre'});
  assert.strictEqual(btcBinance.qty,0,'La venta total debe dejar cantidad cero');
  assert.strictEqual(btcBinance.status,'closed','La venta total debe cerrar la posición sin borrar su Historial');
  const closedPositionId=btcBinance.positionId;
  applyPositionOperation(btcBinance,'crypto','COMPRA',{qty:.25,price:42000,comm:5,date:'2026-08-13',notes:'Reapertura'});
  assert.strictEqual(btcBinance.positionId,closedPositionId,'Reabrir no debe crear una identidad nueva');
  assert.strictEqual(btcBinance.status,'active','Una compra posterior al cierre debe reactivar la posición');
  assert.strictEqual(btcBinance.buy,30000,'Reabrir debe conservar el precio de la primera compra histórica');
  assert.strictEqual(btcBinance.qty,.25,'La posición reabierta debe contener solo las nuevas unidades abiertas');

  const bond={id:'bond-test',positionId:'pos_bono_test',assetType:'bono',type:'bono',sym:'AL30',name:'AL30',nominal:1000,buyPct:90,avgBuy:90,openCost:900,capUSD:900,status:'active',date:'2025-01-01',broker:'Broker A'};
  applyPositionOperation(bond,'bono','COMPRA',{qty:1000,price:110,comm:0,date:'2026-08-13',notes:'Compra bono'});
  assert.strictEqual(bond.nominal,2000,'La compra de bonos debe aumentar el nominal');
  assert.strictEqual(bond.openCost,2000,'La compra de bonos debe usar precio porcentual');
  assert.strictEqual(bond.avgBuy,100,'El promedio de bonos debe conservarse en puntos porcentuales');
  applyPositionOperation(bond,'bono','VENTA',{qty:500,price:120,comm:0,date:'2026-08-14',notes:'Venta bono'});
  assert.strictEqual(bond.openCost,1500,'La venta parcial de bonos debe retirar el coste porcentual correcto');
  assert.strictEqual(bond.avgBuy,100,'La venta parcial no debe cambiar el promedio porcentual de las unidades abiertas');

  ST=dryRun.state;
  if(!ST.cedearSales)ST.cedearSales=[];
  const cedearPosition=consolidateCedears().find(group=>group.sym==='AAPL');
  const originalLots=JSON.stringify(ST.otros.filter(item=>item.type==='cedeaar'));
  const snapshotsBeforeSale=JSON.stringify(ST.cedearValuations);
  applyCedearSale(cedearPosition.positionId,{qty:300,price:15,comm:10,currency:'USD_MEP',date:'2026-08-12',notes:'Venta CEDEAR'});
  assert.strictEqual(consolidateCedears().find(group=>group.positionId===cedearPosition.positionId).quantity,'522','La venta CEDEAR debe reducir la cantidad disponible por lotes');
  assert.strictEqual(JSON.stringify(ST.otros.filter(item=>item.type==='cedeaar')),originalLots,'La venta CEDEAR no debe reescribir los lotes originales');
  assert.strictEqual(JSON.stringify(ST.cedearValuations),snapshotsBeforeSale,'La venta CEDEAR no debe alterar snapshots existentes');
  renderCedearTimeline();
  assert($('cedTimelineTb').innerHTML.includes('Venta'),'El Timeline CEDEAR debe incorporar la venta');
  assert($('cedTimelineTb').innerHTML.includes('Venta registrada'),'Una venta CEDEAR no debe figurar como valuación pendiente');
  assert.strictEqual(ST.hist[0].positionId,cedearPosition.positionId,'La venta CEDEAR debe vincularse a su posición');

  console.log('OK: V3 posiciones, operaciones, migración, sincronización y CEDEAR');
})()
`;

(async () => {
  const script = new vm.Script(`${appSource.slice(0, initIndex)}\n${tests}`, { filename: 'index-inline.js' });
  await script.runInContext(context);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
