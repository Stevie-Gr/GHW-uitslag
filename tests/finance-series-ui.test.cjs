let playwright;try{playwright=require('playwright');}catch(_){playwright=require('C:/Users/grootest/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const {chromium}=playwright;const ExcelJS=require('../exceljs.min.js'),fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict'),{pathToFileURL}=require('url');
const out=path.join(os.tmpdir(),'hsv-finance-test');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const wb=await require('../finance-plan.js').workbook(ExcelJS,{roosterItems:[],wedstrijden:[]},2026),ws=wb.getWorksheet('Jaarplanning');for(let n=8;n<=80;n++)ws.getRow(n).values=[];
 for(let n=1;n<=3;n++)ws.getRow(7+n).values=['Serie','','Winterserie','0'+n+'-02-2026',null,'Kreek Dokters','Boezem & Co.','07:30','08:00','12:00','Vaste stok',n===1?40:null,n===1?3.5:null,n===1?10.5:null,n===1?9:null,n===1?3:null];
 const fixture=path.join(out,'series.xlsx');fs.writeFileSync(fixture,Buffer.from(await wb.xlsx.writeBuffer()));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.route('https://**',r=>r.abort());await page.goto(pathToFileURL(path.join(__dirname,'..','index.html')).href);
 await page.locator('#admin-entry-btn').click();await page.locator('#pin-admin-select').selectOption('head-admin');await page.locator('#pin-inp').fill('1234');await page.getByRole('button',{name:'Inloggen',exact:true}).click();await page.locator('#nav-finance').click();await page.locator('#fin-year').fill('2026');await page.locator('#fin-year').dispatchEvent('change');const click=a=>page.locator('#pv-finance [data-fin="'+a+'"]').first().click();
 await click('import');await page.locator('#fin-import-file').setInputFiles(fixture);await page.getByText('Controleer de verschillen').waitFor();await click('apply-import');
 // One series line in the overview, four tariffs stored.
 assert.equal(await page.locator('.fin-row').count(),1);const p=await page.evaluate(()=>getData().finance.entries.find(e=>e.kind==='series'));assert.deepEqual([p.planned,p.looseFee,p.fee,p.feeAow,p.looseFeeAow],[4000,350,1050,900,300]);
 // Start match 1 with two fishers (one AOW) and enter results: both must choose series or loose.
 await page.evaluate(()=>{const d=getData();d.vissers=[{id:'full',voornaam:'Serie',achternaam:'Visser'},{id:'loose',voornaam:'Losse',achternaam:'Visser',aow:true}];saveData(d);maakWedstrijdVanRoosterItem(getData().roosterItems.find(r=>r.serieWedstrijdNummer===1).id);const dd=getData();const w=dd.wedstrijden[0];dd.uitslagen=['full','loose'].map(id=>({id:w.id+id,wedstrijdId:w.id,visserId:id,gewicht:1000}));saveData(dd);nav('invoer');openInvoer(w.id);});
 await page.locator('.fin-pay-panel').waitFor();assert.equal(await page.locator('.fin-pay-panel .fin-choose').count(),2);assert.equal(await page.evaluate(()=>Finance.open().filter(i=>i.kind==='choice').length),2);
 await page.locator('.fin-pay-panel select[data-fin-change="series-mode"]').nth(0).selectOption('series');await page.locator('.fin-pay-panel select[data-fin-change="series-mode"]').nth(1).selectOption('loose');
 // Series member is open for the (normal) series fee until confirmed; the loose AOW fisher counts as paid at the AOW loose fee.
 let open=await page.evaluate(()=>Finance.open());assert.deepEqual(open.map(i=>i.kind+':'+i.amount),['series:1050']);
 await page.locator('.fin-pay-panel input[data-fin-change="unpaid"]').check();open=await page.evaluate(()=>Finance.open());assert.deepEqual(open.map(i=>i.kind+':'+i.amount).sort(),['match:300','series:1050']);
 await page.locator('.fin-pay-panel input[data-fin-change="series-paid"]').check();open=await page.evaluate(()=>Finance.open());assert.deepEqual(open.map(i=>i.kind+':'+i.amount),['match:300']);
 // Series detail lists members with their choice; the open card settles the loose fee.
 await page.locator('#nav-finance').click();await page.locator('.fin-row').click();assert.equal(await page.locator('.fin-payment-list .fin-payment').count(),2);assert((await page.locator('.fin-payment-list').textContent()).includes('serie betaald'));
 await click('back');await click('settle-open');assert.equal(await page.evaluate(()=>Finance.open().length),0);
 // Public agenda shows fisher tariffs, never the club contribution.
 const line=await page.evaluate(()=>getRoosterTijdRegel(getRoosterPlanningItems(getData())[0]));assert(line.includes('3,50'));assert(!line.includes('40,00'));
 assert.deepEqual(errors,[]);console.log('PASS: series via plan upload, four tariffs, choose series/loose at entry, AOW loose tariff, confirm series payment, open card settle, public tariffs');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
