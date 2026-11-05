let playwright;try{playwright=require('playwright');}catch(_){playwright=require('C:/Users/grootest/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const {chromium}=playwright;const path=require('path'),os=require('os'),fs=require('fs'),assert=require('node:assert/strict'),{pathToFileURL}=require('url');
// Series tab "Financiën" on a phone: seriepot vs losse-inleg pot, serie/los, betaald, eindprijs. Viewers never see it.
// Login is cloud based, so the test switches the admin state on directly instead of signing in.
const out=path.join(os.tmpdir(),'hsv-finance-test');fs.mkdirSync(out,{recursive:true});
const nl=t=>String(t).replace(/\u00a0/g,' ').replace(/\s+/g,' ');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:360,height:800},deviceScaleFactor:2}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('https://**',r=>r.abort());
  await page.goto(pathToFileURL(path.join(__dirname,'..','index.html')).href);
  await page.evaluate(()=>{
   const d=getData();
   d.vissers=[['a','Jan','Vries'],['b','Piet','Bos'],['c','Arie','Kok',true],['e','Dirk','Jansen'],['f','Wim','Smit']].map(([id,voornaam,achternaam,aow])=>({id,voornaam,achternaam,aow:!!aow}));
   d.competities=[{id:'s1',naam:'Winterserie',type:'serie',telBeste:2,seizoen:'2026',vissers:['a','b','c','e','f']}];
   d.wedstrijden=[['w1','2026-01-17'],['w2','2026-02-07'],['w3','2026-03-07']].map(([id,datum],i)=>({id,naam:'Winterserie wedstrijd '+(i+1),datum,competitieId:'s1',serieWedstrijdNummer:i+1,vakken:[]}));
   const rows=[['w1',['a','b','c','e','f']],['w2',['a','b','c']]];
   d.uitslagen=rows.flatMap(([w,ids])=>ids.map((v,i)=>({id:w+v,wedstrijdId:w,visserId:v,gewicht:5000-i*500,afwezig:false})));
   FinanceCore.sync(d);const p=d.finance.entries.find(e=>e.kind==='series');Object.assign(p,{planned:4000,fee:1050,feeAow:900,looseFee:350,looseFeeAow:300,configured:true});
   saveData(d);
  });
  const open=async()=>{await page.evaluate(()=>{nav('serie');showSerieDetail('s1','uitslagen');});};
  // Viewer: no Financiën tab, stand unchanged.
  await open();assert.equal(await page.locator('#serie-detail').getByRole('button',{name:'Financiën'}).count(),0);
  await page.evaluate(()=>showSerieDetail('s1','punten'));const standViewer=nl(await page.locator('#serie-detail').innerText());
  assert(!standViewer.includes('★')&&!standViewer.includes('Serie betaald'));
  // Admin: tab appears.
  await page.evaluate(()=>{isAdmin=true;currentAdmin={id:'t',naam:'Test',rol:'hoofd'};updateAdminUi();});
  await open();await page.locator('#serie-detail').getByRole('button',{name:'Financiën'}).click();await page.locator('.fs').waitFor();
  let t=nl(await page.locator('.fs').innerText());
  assert(t.includes('Alleen zichtbaar voor beheerders'));assert(t.includes('Totale opbrengst van de serie'));assert(t.includes('Seriepot'));assert(t.includes('Losse-inleg pot'));
  assert.equal(await page.locator('.fs-row').count(),5);assert(t.includes('Kies serie of los'));
  assert((await page.locator('.fs-tile.sel').count())===0);
  // Jan: serie, paid.
  const row=n=>page.locator('.fs-row').filter({hasText:n});
  await row('Jan Vries').click();await page.locator('.fs-seg .btn',{hasText:'Serie'}).first().click();
  await page.locator('.fs-pay').click();
  t=nl(await page.locator('.fs').innerText());
  assert(t.includes('Seriepot · naar de eindprijzen'));assert(nl(await page.locator('.fs-pots .card').first().innerText()).includes('€ 50,50'));/* 40,00 club + 10,50 serie */
  assert(nl(await row('Jan Vries').innerText()).includes('Serie betaald'));
  assert(nl(await row('Jan Vries').innerText()).includes('★ eindprijs 1'));/* chosen, paid and 2 of 2 matches fished */
  // Arie (AOW): los, tick W1 → loose pot only, prize pot unchanged.
  await row('Arie Kok').click();await page.locator('.fs-seg .btn',{hasText:'Los'}).click();
  assert.equal(await page.locator('.fs-wk').count(),3);assert.equal(await page.locator('.fs-wk.na').count(),1);/* W3 not fished yet */
  await page.locator('.fs-wk.open').first().click();
  const pots=page.locator('.fs-pots .card');
  assert(nl(await pots.nth(1).innerText()).includes('€ 3,00'));/* AOW loose tariff */
  assert(nl(await pots.first().innerText()).includes('€ 50,50'));
  assert(nl(await page.locator('.fs-total').innerText()).includes('€ 13,50'));/* 10,50 serie + 3,00 los */
  assert(nl(await page.locator('.fs-sheet').innerText()).includes('Geen eindprijs: doet los mee'));
  // Piet: serie but not paid → no prize. Filter on open.
  await row('Piet Bos').click();await page.locator('.fs-seg .btn',{hasText:'Serie'}).first().click();
  assert((await page.locator('.fs-sheet').innerText()).includes('serie nog niet betaald'));
  await page.locator('.fs-tile',{hasText:'Serie open'}).click();assert.equal(await page.locator('.fs-row').count(),1);
  await page.locator('.fs-tile',{hasText:'Serie open'}).click();assert.equal(await page.locator('.fs-row').count(),5);
  // Phone layout: nothing wider than the screen, tap targets at least 44px high.
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  const small=await page.evaluate(()=>[...document.querySelectorAll('.fs-row,.fs-tile,.fs-seg .btn,.fs-pay,.fs-wk')].filter(e=>e.offsetParent&&e.getBoundingClientRect().height<44).length);assert.equal(small,0);
  await page.locator('.fs').screenshot({path:path.join(out,'serie-financien-360.png')});
  // The stand stays plain for admins too.
  await page.evaluate(()=>showSerieDetail('s1','punten'));const standAdmin=nl(await page.locator('#serie-detail').innerText());
  assert(!standAdmin.includes('★')&&!standAdmin.includes('Serie betaald'));
  // Entry screen of a match: a loose fisher is open until the box 'Betaald' is ticked; it lands in the loose pot.
  await page.evaluate(()=>{nav('invoer');openInvoer('w2');});await page.locator('.fin-pay-panel').waitFor();
  const cb=page.locator('.fin-pay-panel input[data-fin-change="loose-paid"]');assert.equal(await cb.count(),1);assert.equal(await cb.isChecked(),false);
  await cb.check();assert.equal(await page.evaluate(()=>{const d=getData();return FinanceCore.loosePot(d,d.finance.entries.find(e=>e.kind==='series'));}),600);
  // Year result: the loose pot is neutral by default.
  const res=await page.evaluate(()=>{const s=Finance.summary();return {loose:s.loose,over:s.over,start:s.start,planned:s.planned};});
  assert.equal(res.loose,600);assert.equal(res.over,res.start-res.planned);
  assert.deepEqual(errors,[]);
  console.log('PASS: viewer sees no Financiën tab, admin tab on 360px, serie/los/betaald, AOW loose tariff, prize pot vs loose pot, eindprijs star, filters, stand unchanged, tap targets');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
