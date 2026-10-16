const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
let runtime;
try{runtime=require('playwright');}
catch{runtime=require(process.env.MRP_PLAYWRIGHT_PATH||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core'));}
const browserExecutable=()=>process.env.MRP_CHROME_EXECUTABLE||(process.platform==='darwin'&&fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':undefined);
const artifactPath=name=>path.join(os.tmpdir(),name);
module.exports={chromium:runtime.chromium,browserExecutable,artifactPath};
