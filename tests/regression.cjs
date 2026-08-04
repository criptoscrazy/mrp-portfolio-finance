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

  const makeLot=(id,sym,date,qty,unit,total,ticket,ratio='10')=>({id,type:'cedeaar',sym,name:sym,dated:date,date,
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
  assert.strictEqual(ST.snaps.length, 0, 'La actualización automática no debe crear snapshots');
  assert.strictEqual(localStorage.getItem('mrp_last_local_change'), '2026-07-31T09:00:00Z', 'La actualización automática no debe cambiar el timestamp de usuario');
  assert.strictEqual(scheduledSyncs, 0, 'La actualización automática no debe subir cotizaciones a la nube');

  await updatePrices({ automatic:false });
  assert.strictEqual(ST.snaps.length, 1, 'La actualización manual sí debe mantener la evolución diaria');
  assert.notStrictEqual(localStorage.getItem('mrp_last_local_change'), '2026-07-31T09:00:00Z', 'La actualización manual debe sincronizar su snapshot');
  assert.strictEqual(scheduledSyncs, 1, 'La actualización manual sí debe programar la sincronización');

  $('otroEditId').value = 'a1';
  const editValues = { name:'Apple editado',purchaseCurrency:'USD_MEP',quantityDecimal:'281',ratioDecimal:'10',unitPriceDecimal:'10.6500',grossAmountDecimal:'2992.65',totalCostDecimal:'3013.29',cclAtPurchaseDecimal:'',mepAtPurchaseDecimal:'',historicalArsEquivalentDecimal:'',ticketNumber:'874213',informationSource:'Broker',date:'2025-07-29',broker:'Broker editado',note:'Nota editada' };
  Object.entries(editValues).forEach(([key, value]) => { $('oe_' + key).value = value; });
  saveOtroEdit();
  const editedCedear = ST.otros.find(item => item.id === 'a1');
  assert.strictEqual(editedCedear.name, 'Apple editado', 'Debe editar activos de Otros');
  assert.strictEqual(editedCedear.quantityDecimal,'281','Debe guardar la cantidad decimal editada');
  assert.strictEqual(editedCedear.totalCostDecimal,'3013.29','Debe conservar el costo total del lote');
  assert.strictEqual(editedCedear.cur, 24000, 'Editar no debe borrar la última cotización');

  openOtroEdit('a1');
  assert($('otroEditModalOverlay').classList.contains('open'), 'Debe abrir el editor de Otros');
  assert.strictEqual($('oe_quantityDecimal').value,'281','El editor debe cargar la cantidad actual');
  assert.strictEqual($('oe_sym').readOnly, true, 'El símbolo debe quedar protegido en la edición');
  closeOtroEdit();

  renderOtros();
  assert($('cedTb').innerHTML.includes('24.000,00'), 'La tabla CEDEAR debe mostrar el precio actual ARS');
  assert($('cedTb').innerHTML.includes('9.042,97'), 'La tabla CEDEAR debe mostrar el costo MEP consolidado');
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

  console.log('OK: sincronización, CEDEAR, edición y detalles');
})()
`;

(async () => {
  const script = new vm.Script(`${appSource.slice(0, initIndex)}\n${tests}`, { filename: 'index-inline.js' });
  await script.runInContext(context);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
