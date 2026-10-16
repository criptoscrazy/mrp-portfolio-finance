const {spawnSync}=require('node:child_process');
const suites=['regression','liquidity','profit-review','sync-conflict-dates','cedear-quotes-layout','keepalive','news-edge','migration-v3-dry-run','audit-integrity','database-hardening','news-ux','liquidity-visual','profit-review-visual','sync-conflict-dates-visual','cost-mean-visual','context-metrics-visual','cedear-visual','audit-browser'];
for(const suite of suites){
  console.log('\nPrueba: '+suite);
  const args=['tests/'+suite+'.cjs'];if(suite==='migration-v3-dry-run')args.push('tests/fixtures/position-v2-sample.json');
  const result=spawnSync(process.execPath,args,{stdio:'inherit',env:process.env});
  if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);
}
console.log('\nOK: '+suites.length+' programas de prueba. La prueba de proveedores públicos se ejecuta por separado.');
