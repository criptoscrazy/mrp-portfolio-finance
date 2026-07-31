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

  const cedear = {
    id:'ced1',type:'cedeaar',sym:'AAPL',name:'Apple Inc.',qty:100,ratio:10,buyARS:23000,ccl:1400,
    buyUSD:23000/1400,priceUSD:23000/1400,capitalUSD:100*(23000/1400),date:'2025-07-01',broker:'Test',note:'Prueba'
  };
  ST = sanitizePortfolioState({ ...base, otros:[cedear], snaps:[] });
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
    if (url.includes('AAPL.BA')) return { ok:true, json:async () => ({ chart:{ result:[{ meta:{ regularMarketPrice:24000, chartPreviousClose:23500, currency:'ARS', regularMarketTime:1785517200 } }] } }) };
    return null;
  };

  localStorage.setItem('mrp_last_local_change', '2026-07-31T09:00:00Z');
  await updatePrices({ automatic:true });
  const updatedCedear = ST.otros.find(item => item.id === 'ced1');
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

  $('otroEditId').value = 'ced1';
  const editValues = { name:'Apple editado', qty:'120', ratio:'10', buyARS:'22000', ccl:'1300', date:'2025-07-02', broker:'Broker editado', note:'Nota editada' };
  Object.entries(editValues).forEach(([key, value]) => { $('oe_' + key).value = value; });
  saveOtroEdit();
  const editedCedear = ST.otros.find(item => item.id === 'ced1');
  assert.strictEqual(editedCedear.name, 'Apple editado', 'Debe editar activos de Otros');
  assert.strictEqual(editedCedear.qty, 120, 'Debe guardar la cantidad editada');
  assert(Math.abs(editedCedear.capitalUSD - (120 * 22000 / 1300)) < .001, 'Debe recalcular derivados del CEDEAR');
  assert.strictEqual(editedCedear.cur, 24000, 'Editar no debe borrar la última cotización');

  openOtroEdit('ced1');
  assert($('otroEditModalOverlay').classList.contains('open'), 'Debe abrir el editor de Otros');
  assert.strictEqual($('oe_qty').value, 120, 'El editor debe cargar la cantidad actual');
  assert.strictEqual($('oe_sym').readOnly, true, 'El símbolo debe quedar protegido en la edición');
  closeOtroEdit();

  renderOtros();
  assert($('cedTb').innerHTML.includes('24.000,00'), 'La tabla CEDEAR debe mostrar el precio actual ARS');
  assert($('cedTb').innerHTML.includes('btn-view'), 'La tabla CEDEAR debe incluir Más información');
  assert($('cedTb').innerHTML.includes('btn-edit'), 'La tabla CEDEAR debe incluir Editar');

  openAssetDetails('otro', 'ced1');
  assert($('detailModalOverlay').classList.contains('open'), 'Debe abrir el detalle de solo lectura');
  const detailText = $('detailGrid').children.flatMap(item => item.children.map(child => child.textContent)).join(' | ');
  assert(detailText.includes('Precio actual BYMA'), 'El detalle debe identificar el precio BYMA');
  assert(detailText.includes('Ganancia / pérdida nominal'), 'El detalle debe mostrar la rentabilidad CEDEAR');

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
