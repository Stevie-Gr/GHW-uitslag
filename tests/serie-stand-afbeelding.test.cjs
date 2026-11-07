let playwright;try{playwright=require('playwright');}catch(_){playwright=require('C:/Users/grootest/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const {chromium}=playwright;const path=require('path'),fs=require('fs'),os=require('os'),assert=require('node:assert/strict'),{pathToFileURL}=require('url');
// Serie Tussenstand/Eindstand: "Deel als afbeelding" -> preview modal -> PNG download.
(async()=>{
 const launch=async()=>{try{return await chromium.launch({channel:'msedge',headless:true});}catch(_){return await chromium.launch({channel:'chrome',headless:true});}};
 const browser=await launch();
 try{
  const page=await browser.newPage({viewport:{width:1200,height:900},acceptDownloads:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**',r=>r.abort());
  await page.goto(pathToFileURL(path.join(__dirname,'..','index.html')).href);
  await page.evaluate(()=>{
   const d=getData();
   const namen=['Kees de Vries','Jan Bakker','Piet Jansen','Henk Visser','Arie Mulder','Dirk Kok','Wim de Boer','Cor Dekker','Gerrit Smit','Jaap van Dijk','Ron Bos','Sjaak Vos','Nico Peters','Frans Hoek','Bram Maas','Leo Brouwer','Tom Dijkstra','Ed Groen','Rob Wolf','Ton Kuiper met een heel erg lange achternaam van Hoeksche Waard'];
   d.vissers=namen.map((n,i)=>({id:'v'+i,voornaam:n.split(' ')[0],achternaam:n.split(' ').slice(1).join(' ')}));
   d.competities=[{id:'s1',naam:'Voorjaarsserie',type:'serie',telBeste:4,seizoen:'2026',vissers:d.vissers.map(v=>v.id)}];
   d.wedstrijden=Array.from({length:5},(_,i)=>({id:'w'+(i+1),naam:'Voorjaarsserie wedstrijd '+(i+1),datum:'2026-0'+(i+1)+'-10',competitieId:'s1',serieWedstrijdNummer:i+1,vakken:[{vakId:'A',naam:'A',vissers:d.vissers.slice(0,10).map(v=>v.id)},{vakId:'B',naam:'B',vissers:d.vissers.slice(10).map(v=>v.id)}]}));
   d.uitslagen=d.wedstrijden.flatMap((w,wi)=>d.vissers.map((v,i)=>({id:w.id+v.id,wedstrijdId:w.id,visserId:v.id,gewicht:(i+wi)%7===0&&i>15?0:14000-i*600-wi*37,afwezig:(i+wi)%9===0&&i>12})));
   saveData(d);nav('serie',false);showSerieDetail('s1','punten',false);
  });
  const btn=page.locator('#serie-detail').getByRole('button',{name:'Deel als afbeelding'});
  assert.equal(await btn.count(),1);
  await btn.click();
  assert(await page.locator('#share-modal.open').count()===1);
  const prev=await page.locator('#share-preview-root').innerText();
  assert(/Tussenstand Voorjaarsserie/.test(prev));assert(/Plek/i.test(prev)&&/Punten/i.test(prev)&&/Gewicht/i.test(prev)&&/Deelnames/i.test(prev));
  assert.equal(await page.locator('#share-preview-root tbody tr').count(),20);
  assert(!(await page.locator('#share-excel-btn').isVisible()));
  const [dl]=await Promise.all([page.waitForEvent('download'),page.locator('#share-modal').getByRole('button',{name:'Download PNG'}).click()]);
  assert(/\.png$/.test(dl.suggestedFilename()));
  const out=process.env.PNG_OUT||path.join(os.tmpdir(),'serie-stand.png');
  await dl.saveAs(out);
  const buf=fs.readFileSync(out);assert.equal(buf.slice(1,4).toString(),'PNG');
  await page.locator('#share-modal').getByRole('button',{name:'Sluiten'}).click();
  assert.equal(await page.locator('#share-excel-btn').evaluate(e=>e.style.display),'');
  assert.deepEqual(errors,[]);
  console.log('PASS: serie-stand afbeelding',dl.suggestedFilename(),buf.length+' bytes');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
