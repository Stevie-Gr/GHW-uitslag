let playwright;try{playwright=require('playwright');}catch(_){playwright=require('C:/Users/grootest/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const {chromium}=playwright;const path=require('path'),assert=require('node:assert/strict'),{pathToFileURL}=require('url');
// Home card + wedstrijd screen: buttons to Tussenstand, which turns into Eindstand after 6 matches.
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:360,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**',r=>r.abort());
  await page.goto(pathToFileURL(path.join(__dirname,'..','index.html')).href);
  const setup=n=>page.evaluate(n=>{
   const d=getData();
   d.vissers=[['a','Jan','Vries'],['b','Piet','Bos']].map(([id,voornaam,achternaam])=>({id,voornaam,achternaam}));
   d.competities=[{id:'s1',naam:'Winterserie',type:'serie',telBeste:4,seizoen:'2026',vissers:['a','b']}];
   d.wedstrijden=Array.from({length:n},(_,i)=>({id:'w'+(i+1),naam:'Winterserie wedstrijd '+(i+1),datum:'2026-0'+(i+1)+'-10',competitieId:'s1',serieWedstrijdNummer:i+1,vakken:[]}));
   d.uitslagen=d.wedstrijden.flatMap(w=>['a','b'].map((v,i)=>({id:w.id+v,wedstrijdId:w.id,visserId:v,gewicht:3000-i*500,afwezig:false})));
   saveData(d);nav('welcome');renderWelcomeDashboard();
  },n);
  await setup(5);
  const card=()=>page.locator('.wh-uitslag').innerText();
  let t=(await card()).toLowerCase();assert(t.includes('volledige uitslag'));assert(t.includes('tussenstand'));
  await page.locator('.wh-uitslag .wh-link',{hasText:/tussenstand/i}).click();
  assert(await page.locator('#serie-detail').isVisible());assert(/stand/i.test(await page.locator('#serie-detail').innerText()));
  assert.equal(await page.locator('#serie-detail').getByRole('button',{name:'Tussenstand'}).count(),1);
  // wedstrijd screen has a button to the stand
  await page.evaluate(()=>{nav('serie',false);showSerieWedDetail('w5','s1',false);});
  await page.locator('#serie-wed-detail').getByRole('button',{name:/Tussenstand/}).click();
  assert(await page.locator('#serie-detail').isVisible());assert(!(await page.locator('#serie-wed-detail').isVisible()));
  // 6 matches: Eindstand
  await setup(6);
  t=(await card()).toLowerCase();assert(t.includes('eindstand'));assert(!t.includes('tussenstand'));
  await page.evaluate(()=>{nav('serie',false);showSerieWedDetail('w6','s1',false);});
  assert.equal(await page.locator('#serie-wed-detail').getByRole('button',{name:/Eindstand/}).count(),1);
  assert.deepEqual(errors,[]);
  console.log('PASS: homepage card and wedstrijd screen link to Tussenstand, Eindstand after 6 matches');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
