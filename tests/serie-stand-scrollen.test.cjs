let playwright;try{playwright=require('playwright');}catch(_){playwright=require('C:/Users/grootest/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const {chromium}=playwright;const path=require('path'),assert=require('node:assert/strict'),{pathToFileURL}=require('url');
// Brede serie-stand moet horizontaal scrollbaar zijn op telefoon-liggend (>900px) en kleine laptops.
(async()=>{
 const launch=async()=>{try{return await chromium.launch({channel:'msedge',headless:true});}catch(_){return await chromium.launch({channel:'chrome',headless:true});}};
 const browser=await launch();
 try{
  for(const [w,h] of [[932,430],[1100,800],[844,390]]){
   const ctx=await browser.newContext({viewport:{width:w,height:h}}),page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://**',r=>r.abort());
   await page.goto(pathToFileURL(path.join(__dirname,'..','index.html')).href);
   const r=await page.evaluate(()=>{
    const d=getData();
    d.vissers=Array.from({length:14},(_,i)=>({id:'v'+i,voornaam:'Visser '+i,achternaam:'van der Linden'}));
    d.competities=[{id:'s1',naam:'Voorjaarsserie',type:'serie',telBeste:4,seizoen:'2026',vissers:d.vissers.map(v=>v.id)}];
    d.wedstrijden=Array.from({length:6},(_,i)=>({id:'w'+(i+1),naam:'Voorjaarsserie wedstrijd '+(i+1),datum:'2026-0'+(i+1)+'-10',competitieId:'s1',vakken:[{vakId:'A',naam:'A',vissers:d.vissers.map(v=>v.id)}]}));
    d.uitslagen=d.wedstrijden.flatMap((wd,wi)=>d.vissers.map((v,i)=>({id:wd.id+v.id,wedstrijdId:wd.id,visserId:v.id,gewicht:14000-i*600-wi*37,afwezig:false})));
    saveData(d);nav('serie',false);showSerieDetail('s1','punten',false);
    const card=[...document.querySelectorAll('#serie-detail .card')].find(c=>c.querySelector('table.tbl'));
    card.scrollLeft=300;
    return {client:card.clientWidth,scroll:card.scrollWidth,left:card.scrollLeft,vw:innerWidth};
   });
   assert(r.client<=r.vw,`kaart (${r.client}px) breder dan scherm (${r.vw}px) bij ${w}px`);
   assert(r.scroll>r.client,`tabel scrolt niet bij ${w}px`);
   assert(r.left>0,`scrollLeft blijft 0 bij ${w}px`);
   assert.deepEqual(errors,[]);
   await ctx.close();
  }
  console.log('PASS: serie-stand scrolt horizontaal bij 932, 1100 en 844 px');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
