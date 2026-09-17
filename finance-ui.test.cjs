let playwright;try{playwright=require('playwright');}catch(_){playwright=require('C:/Users/grootest/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const {chromium}=playwright;const ExcelJS=require('./exceljs.min.js'),fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict'),{pathToFileURL}=require('url');
const out=path.join(os.tmpdir(),'hsv-finance-test');fs.mkdirSync(out,{recursive:true});
(async()=>{
 // Fixture: a couple match with results, a series with two matches, an expense; uploaded via the year plan.
 const wb=await require('./finance-plan.js').workbook(ExcelJS,{roosterItems:[],wedstrijden:[]},2026),ws=wb.getWorksheet('Jaarplanning');for(let n=8;n<=80;n++)ws.getRow(n).values=[];
 ws.getRow(8).values=['Koppel','Spui koppel 1','','28-03-2026',null,'Spui','Oud-Beijerland','07:30','08:00','12:00','Vrij',30,10];ws.getRow(9).values=['Overige uitgave','Nieuwe weegschaal',null,'01-10-2026',null,null,null,null,null,null,null,200];
 const fixture=path.join(out,'planning.xlsx');fs.writeFileSync(fixture,Buffer.from(await wb.xlsx.writeBuffer()));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.route('https://**',r=>r.abort());await page.goto(pathToFileURL(path.join(process.cwd(),'index.html')).href);
 await page.locator('#admin-entry-btn').click();await page.locator('#pin-admin-select').selectOption('head-admin');await page.locator('#pin-inp').fill('1234');await page.getByRole('button',{name:'Inloggen',exact:true}).click();
 // Home shows today's match card.
 assert(await page.getByText('Wedstrijd van vandaag').isVisible());
 await page.locator('#nav-finance').click();await page.locator('#fin-year').fill('2026');await page.locator('#fin-year').dispatchEvent('change');const click=a=>page.locator('#pv-finance [data-fin="'+a+'"]').first().click();
 // Budget and plan upload.
 await click('budget');await page.locator('#fin-budget').fill('2435');await page.locator('#fin-carry').fill('0');await page.locator('#fin-budget-form button').click();
 await click('import');await page.locator('#fin-import-file').setInputFiles(fixture);await page.getByText('Controleer de verschillen').waitFor();await click('apply-import');
 let s=await page.evaluate(()=>Finance.summary());assert.equal(s.start,243500);assert.equal(s.planned,3000+20000);assert.equal(s.over,243500-23000);
 assert(await page.locator('.fin-summary').isVisible());assert.equal(await page.locator('.fin-row').count(),2);assert.equal(await page.locator('.fin-open').count(),0);
 // Start the couple match from the agenda entry, enter two couples + a lone fisher, everyone counts as paid.
 await page.evaluate(()=>{const d=getData();d.vissers=[{id:'a',voornaam:'An',achternaam:'A'},{id:'b',voornaam:'Bo',achternaam:'B'},{id:'c',voornaam:'Cas',achternaam:'C',aow:true}];saveData(d);const r=d.roosterItems[0];maakWedstrijdVanRoosterItem(r.id);const dd=getData();const w=dd.wedstrijden[0];dd.uitslagen=[{id:'u1',wedstrijdId:w.id,visserId:'a',koppelId:'K1',gewicht:100},{id:'u2',wedstrijdId:w.id,visserId:'b',koppelId:'K1',gewicht:200},{id:'u3',wedstrijdId:w.id,visserId:'c',koppelId:null,gewicht:300}];saveData(dd);nav('invoer');openInvoer(w.id);});
 await page.locator('.fin-pay-panel').waitFor();assert.equal(await page.locator('.fin-pay-panel .fin-payment').count(),2);
 const panelText=await page.locator('.fin-pay-panel').textContent();assert(panelText.includes('An A & Bo B'));assert(panelText.includes('AOW'));assert.equal(await page.evaluate(()=>Finance.open().length),0);
 // Mark the couple as not paid; it appears in the open card; settle it from the overview.
 await page.locator('.fin-pay-panel input[data-fin-change="unpaid"]').first().check();assert.equal(await page.evaluate(()=>Finance.open().length),1);
 await page.locator('#nav-finance').click();await page.locator('.fin-open').waitFor();assert((await page.locator('.fin-open').textContent()).includes('€ 10,00'));await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'overview-mobile.png'),fullPage:true});await page.setViewportSize({width:1400,height:1000});
 await click('settle-open');assert.equal(await page.locator('.fin-open').count(),0);
 // Actual cost override on the expense counts in 'over'; leaving it equal to planned stores nothing.
 await page.locator('.fin-row').filter({hasText:'Nieuwe weegschaal'}).click();assert.equal(await page.locator('#fin-actual').inputValue(),'200.00');await page.locator('#fin-actual').fill('235');await page.locator('#fin-entry-form button').click();s=await page.evaluate(()=>Finance.summary());assert.equal(s.spent,3020+23500);assert.equal(s.planned,23000);assert.equal(s.inleg,2000);
 // AOW flag lives in the fishers list.
 await page.evaluate(()=>renderBVissers());assert.equal(await page.locator('[data-fin-change="aow"]').count(),3);
 // Fresh-start migration: legacy payments in storage are wiped on load, results stay.
 await page.evaluate(()=>{const d=getData();d.finance.version=1;d.finance.entries[0].payments={a:{amount:1000}};localStorage.setItem(SK,JSON.stringify(d));});await page.reload();await page.locator('#admin-entry-btn').click();await page.locator('#pin-admin-select').selectOption('head-admin');await page.locator('#pin-inp').fill('1234');await page.getByRole('button',{name:'Inloggen',exact:true}).click();
 const after=await page.evaluate(()=>{const d=getData();return {version:d.finance.version,payments:d.finance.entries.map(e=>Object.keys(e.payments||{}).length).reduce((a,b)=>a+b,0),uitslagen:d.uitslagen.length,actual:d.finance.entries.find(e=>e.title==='Nieuwe weegschaal').actual};});assert.equal(after.version,3);assert.equal(after.payments,0);assert.equal(after.uitslagen,3);assert.equal(after.actual,null);
 assert.deepEqual(errors,[]);console.log('PASS: today card, budget + plan upload, simple summary, paid-by-default with couple units and AOW badge, open card + settle, actual override, AOW flag in fishers, fresh-start wipe, mobile overview');console.log(out);
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
