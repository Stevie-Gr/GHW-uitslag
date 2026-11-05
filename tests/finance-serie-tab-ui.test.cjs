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
   FinanceCore.sync(d);saveData(d);
   // In-memory stand-in for the online tables (the real ones are protected by RLS).
   window.__db={serie_tarief:[{serie_id:'s1',club:4000,fee:1050,fee_aow:900,loose_fee:350,loose_fee_aow:300,loose_payout:null}],serie_deelname:[],serie_los_betaald:[],serie_opgave:[]};window.__fail=false;window.__calls=0;
   const key={serie_tarief:['serie_id'],serie_deelname:['serie_id','visser_id'],serie_los_betaald:['serie_id','wedstrijd_id','visser_id'],serie_opgave:['serie_id','visser_id']};
   window.__rt=[];
   cloudClient={auth:{onAuthStateChange(){}},channel(){const c={on(_e,_f,cb){window.__rt.push(cb);return c;},subscribe(){return c;}};return c;},removeChannel(){window.__rtGone=true;},from(t){
    const rows=()=>window.__db[t],ok=()=>window.__fail?{error:{message:'nep-fout'}}:{error:null};
    return {
     select(){return {eq:(c,v)=>Promise.resolve({data:rows().filter(r=>r[c]===v),error:null})};},
     upsert(row){window.__calls++;if(window.__fail)return Promise.resolve(ok());const i=rows().findIndex(r=>key[t].every(k=>r[k]===row[k]));if(i>=0)rows()[i]=row;else rows().push(row);return Promise.resolve(ok());},
     delete(){return {match:m=>{window.__calls++;if(window.__fail)return Promise.resolve(ok());window.__db[t]=rows().filter(r=>!Object.keys(m).every(k=>r[k]===m[k]));return Promise.resolve(ok());}};}
    };}};
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
  t=t.toLowerCase();assert(t.includes('serie-inleg'));assert(t.includes('losse inleg'));assert(t.includes('seriepot'));assert(t.includes('wedstrijd 3 van 3'));assert(t.includes('serievissers'));assert(!t.includes('maximaal'));/* prizes are folded away */
  assert.equal(await page.locator('.fs-row').count(),0);/* nobody chose serie yet: everybody is under Losse deelname */
  await page.locator('.fs-fold',{hasText:'Losse deelname'}).click();
  assert.equal(await page.locator('.fs-row').count(),5);
  // Nobody has chosen yet, all 5 can still reach "beste 2": they are all in "Nog te winnen".
  assert.equal(await page.locator('.fs-tag-may').count(),5);
  const row=n=>page.locator('.fs-row').filter({hasText:n});const tap=n=>row(n).locator('.fs-main').click();const prizes=async()=>{if(!await page.locator('.fs-prizes').count())await page.locator('.fs-fold',{hasText:'Prijzen'}).click();};
  // Jan: serie, paid → moves to Serie-vissers and gets a prize place.
  await tap('Jan Vries');await page.locator('.fs-seg .btn',{hasText:'Serie'}).first().click();
  await page.locator('.fs-pay').click();
  t=nl(await page.locator('.fs').innerText());
  assert(/serievissers/i.test(t));
  assert(/seriepot\s*€ 50,50/i.test(nl(await page.locator('.fs-sum').innerText())));/* 40,00 club + 10,50 serie */
  assert(nl(await row('Jan Vries').innerText()).toLowerCase().includes('betaald'));
  assert(nl(await row('Jan Vries').innerText()).includes('★'));/* paid and 2 of 2 matches fished */
  await prizes();assert(nl(await page.locator('.fs-prizes').innerText()).toLowerCase().includes('zeker · 1'));
  assert(nl(await page.locator('.fs-prizes').innerText()).toUpperCase().includes('NOG OVER'));
  // Prize ladder: the maximum counts everybody who can still reach it.
  await page.locator('.fs-prizes .btn',{hasText:'Maximaal'}).click();
  assert(nl(await page.locator('.fs-prizes').innerText()).toLowerCase().includes('maximaal · 1'));/* only serie-inschrijvingen count */
  // Arie (AOW): los, tick W1 → loose pot only, prize pot unchanged.
  await tap('Arie Kok');await page.locator('.fs-seg .btn',{hasText:'Los'}).click();
  assert.equal(await page.locator('.fs-wk').count(),3);assert.equal(await page.locator('.fs-wk.na').count(),1);/* W3 not fished yet */
  await page.locator('.fs-wk.open').first().click();
  const sum=nl(await page.locator('.fs-sum').innerText());assert(/losse inleg\s*€ 3,00/i.test(sum));/* AOW loose tariff */
  assert(/seriepot\s*€ 50,50/i.test(sum));
  assert(/totaal binnen\s*€ 13,50/i.test(sum));/* 10,50 serie + 3,00 los */
  assert(nl(await page.locator('.fs-sheet').innerText()).includes('Eindprijs'));
  // Piet: serie but not paid → stays in Serie-vissers without star.
  await tap('Piet Bos');await page.locator('.fs-seg .btn',{hasText:'Serie'}).first().click();
  assert(nl(await row('Piet Bos').innerText()).includes('Open'));assert(!nl(await row('Piet Bos').innerText()).includes('★'));
  // Next match: sign-ups. Dirk fished 1 of 2, signs up for match 3 → projected 2/2.
  const sw=n=>row(n).locator('.fs-chk');
  await sw('Dirk Jansen').click();
  assert.equal(await page.evaluate(()=>window.__db.serie_opgave.length),1);
  assert(nl(await row('Dirk Jansen').innerText()).includes('→ 2/2'));assert(nl(await row('Dirk Jansen').innerText()).includes('Aangemeld'));
  await sw('Dirk Jansen').click();assert.equal(await page.evaluate(()=>window.__db.serie_opgave.length),0);/* toggles off again */
  await sw('Dirk Jansen').click();
  await page.locator('.fs-prizes .btn',{hasText:'Verwacht'}).click();
  assert(nl(await page.locator('.fs-prizes').innerText()).toLowerCase().includes('verwacht · 2'));/* Jan (paid) and Piet (serie, unpaid but enough matches); Dirk has not chosen serie */
  // Phone layout: nothing wider than the screen, tap targets at least 44px high.
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  const small=await page.evaluate(()=>[...document.querySelectorAll('.fs-main,.fs-seg .btn,.fs-pay,.fs-wk,.fs-fold')].filter(e=>e.offsetParent&&e.getBoundingClientRect().height<44).length);assert.equal(small,0);
  await page.locator('.fs').screenshot({path:path.join(out,'serie-financien-360.png')});
  // The stand stays plain for admins too.
  await page.evaluate(()=>showSerieDetail('s1','punten'));const standAdmin=nl(await page.locator('#serie-detail').innerText());
  assert(!standAdmin.includes('★')&&!standAdmin.includes('Serie betaald'));
  // Payments are really stored in the online table, not in the shared stand data.
  const db=await page.evaluate(()=>window.__db);
  assert.equal(db.serie_deelname.length,3);assert(db.serie_deelname.some(r=>r.visser_id==='a'&&r.keuze==='series'&&r.betaald===true));
  assert.equal(db.serie_los_betaald.length,1);
  assert.equal(await page.evaluate(()=>JSON.stringify(zonderLokaleDelen(getData())).includes('serie_deelname')),false);
  // Ticking keeps the scroll position (no jump to the top).
  await page.evaluate(()=>{showSerieDetail('s1','financien');});await page.locator('.fs').waitFor();
  await page.evaluate(()=>window.scrollTo(0,200));const y0=await page.evaluate(()=>window.scrollY);
  await tap('Wim Smit');await page.locator('.fs-seg .btn',{hasText:'Los'}).click();
  assert(Math.abs(await page.evaluate(()=>window.scrollY)-y0)<=2,'scroll jumped');
  // Failing save: the change is reverted from the server.
  await page.evaluate(()=>{window.__fail=true;});
  await page.locator('.fs-seg .btn',{hasText:'Serie'}).first().click();
  await page.evaluate(()=>{window.__fail=false;});
  await page.waitForTimeout(300);
  assert.equal((await page.locator('.fs-sheet .fs-seg .btn.on').first().innerText()).trim().toLowerCase(),'los');/* back to the saved state: Los */
  // Live: a payment saved by another admin shows up without pressing Verversen.
  await page.evaluate(()=>{window.__db.serie_deelname=window.__db.serie_deelname.filter(r=>r.visser_id!=='f').concat({serie_id:'s1',visser_id:'f',keuze:'series',betaald:true});window.__rt.forEach(f=>f({}));});
  await page.waitForTimeout(700);
  assert(nl(await row('Wim Smit').innerText()).includes('Betaald'));
  assert(await page.evaluate(()=>window.__rt.length)===4);/* one listener per table */
  // Admin Financiën page is hidden.
  await page.evaluate(()=>nav('admin-home'));
  const adminText=nl(await page.locator('body').innerText());assert(!/Begroting|Jaaragenda/.test(adminText));
  assert.equal(await page.locator('#nav-finance:visible').count(),0);
  // Logging out wipes the cached payments.
  assert.equal(await page.evaluate(()=>{Finance.serieAllowed;return typeof Finance.serieAllowed;}),'function');
  assert.deepEqual(errors,[]);
  console.log('PASS: viewer sees no Financiën tab, admin tab on 360px, serie/los/betaald, AOW loose tariff, prize pot vs loose pot, eindprijs star, filters, stand unchanged, tap targets');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
