const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const backupPath = process.argv[2];
if (!backupPath) {
  console.error('Uso: node tests/migration-v3-dry-run.cjs /ruta/al/backup.json');
  process.exit(2);
}

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match => match[1])
  .filter(source => source.trim());
const appSource = scripts.sort((a, b) => b.length - a.length)[0];
const initIndex = appSource.indexOf('// ═══════════════════════════════════════════\n// INIT\n');
assert(initIndex > 0, 'No se encontró el bloque INIT');

class ElementStub {
  constructor() { this.style={}; this.classList={add(){},remove(){},contains(){return false},toggle(){}}; this.value=''; this.textContent=''; this.innerHTML=''; this.children=[]; }
  addEventListener() {}
  append() {}
  appendChild(child) { return child; }
  replaceChildren() {}
  setAttribute() {}
  querySelector() { return null; }
}
const elements=new Map();
const documentStub={
  visibilityState:'visible',activeElement:null,documentElement:new ElementStub(),
  getElementById(id){if(!elements.has(id))elements.set(id,new ElementStub());return elements.get(id);},
  createElement(){return new ElementStub();},addEventListener(){},querySelectorAll(){return[];}
};
const storage=new Map();
const context=vm.createContext({
  console,document:documentStub,window:{addEventListener(){},innerWidth:1440},
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},
  location:{href:'http://127.0.0.1/',origin:'http://127.0.0.1',pathname:'/'},navigator:{onLine:true},
  URL,AbortController,confirm:()=>true,getComputedStyle:()=>({getPropertyValue:()=>''}),
  setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}
});

const raw=fs.readFileSync(path.resolve(backupPath),'utf8');
JSON.parse(raw);
context.__dryRunRaw=raw;
const result=new vm.Script(`${appSource.slice(0,initIndex)}\nmigratePortfolioV2ToV3(JSON.parse(__dryRunRaw),{dryRun:true})`).runInContext(context);
const before=result.report.before||{};
const after=result.report.after||{};
const publicReport={
  ok:result.report.errors.length===0,
  schemaVersion:result.state.schemaVersion,
  alreadyMigrated:result.report.alreadyMigrated,
  positions:result.report.positions,
  legacyHistory:result.report.legacyHistory,
  cedearLots:result.report.cedearLots,
  counts:{
    stocks:after.stocks?.count||0,crypto:after.crypto?.count||0,etfs:after.etfs?.count||0,
    tokens:after.tokens?.count||0,bonds:after.bonds?.count||0,cedearLots:after.cedears?.count||0,
    history:after.history||0,expenses:after.expenses||0,valuations:after.valuations||0
  },
  preserved:{
    positionsAndCosts:JSON.stringify({...before,snapshots:undefined,assetSnapshots:undefined})===JSON.stringify({...after,snapshots:undefined,assetSnapshots:undefined}),
    snapshots:before.snapshots===after.snapshots,
    assetSnapshots:before.assetSnapshots===after.assetSnapshots
  },
  warnings:result.report.warnings,
  errors:result.report.errors
};
console.log(JSON.stringify(publicReport,null,2));
if(!publicReport.ok||Object.values(publicReport.preserved).some(value=>!value))process.exitCode=1;
