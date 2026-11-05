const assert=require('node:assert/strict'),C=require('../lib/finance-series.js');
// Series finance: separate prize pot and loose pot, explicit loose payments, and the eindprijs rule
// (series chosen + paid in full + at least "best X" matches fished).
const d={vissers:[{id:'a',naam:'A'},{id:'b',naam:'B'},{id:'c',naam:'C',aow:true},{id:'e',naam:'E'},{id:'f',naam:'F'},{id:'g',naam:'G'}],
 competities:[{id:'s1',naam:'Winter',type:'serie',telBeste:2,seizoen:'2026',vissers:['a','b','c','e','f','g']}],
 wedstrijden:[{id:'w1',naam:'Winter 1',datum:'2026-01-17',competitieId:'s1'},{id:'w2',naam:'Winter 2',datum:'2026-02-07',competitieId:'s1'},{id:'w3',naam:'Winter 3',datum:'2026-03-07',competitieId:'s1'}],
 uitslagen:[{wedstrijdId:'w1',visserId:'a'},{wedstrijdId:'w1',visserId:'b'},{wedstrijdId:'w1',visserId:'c'},{wedstrijdId:'w1',visserId:'e'},{wedstrijdId:'w1',visserId:'f'},{wedstrijdId:'w2',visserId:'a'},{wedstrijdId:'w2',visserId:'b'},{wedstrijdId:'w2',visserId:'c'}],
 roosterItems:[],finance:{version:3,years:{2026:{budget:0}},entries:[]}};
C.sync(d);
const p=d.finance.entries.find(e=>e.kind==='series');
Object.assign(p,{planned:4000,fee:1050,feeAow:900,looseFee:350,looseFeeAow:300,configured:true});
const w=n=>d.finance.entries.find(e=>e.matchId===n);
C.setSeriesMode(d,p.id,'a','series');C.setSeriesPaid(d,p.id,'a',true);
C.setSeriesMode(d,p.id,'b','series');
C.setSeriesMode(d,p.id,'c','loose');
C.setSeriesMode(d,p.id,'f','series');C.setSeriesPaid(d,p.id,'f',true);
// Eindprijs reasons.
let ep=v=>C.eindprijs(d,p,v);
assert.equal(ep('a').code,'ja');assert.equal(ep('a').ok,true);assert.equal(ep('a').fished,2);assert.equal(ep('a').min,2);
assert.equal(ep('b').code,'onbetaald');assert.equal(ep('c').code,'los');assert.equal(ep('e').code,'geen-keuze');assert.equal(ep('g').code,'geen-keuze');
assert.equal(ep('f').code,'nog-open');/* 1 of 2 fished, w3 still to come */ assert.equal(ep('f').remaining,1);
d.competities[0].telBeste=3;
assert.equal(ep('a').code,'nog-open');assert.equal(ep('f').code,'te-weinig');/* 1 fished + 1 to come cannot reach 3 */
d.competities[0].telBeste=2;
// Pots: the prize pot is club + paid series fees; loose fees are a separate pot that starts open.
let o=C.seriesOverview(d,p),t=o.totals;
assert.equal(t.club,4000);assert.equal(t.serieN.n,2);assert.equal(t.serieN.sum,2100);assert.equal(t.serieA.n,0);assert.equal(t.openS.n,1);assert.equal(t.openS.sum,1050);
assert.equal(t.pot,6100);assert.equal(C.pot(d,p),6100);assert.equal(t.loosePot,0);assert.deepEqual(t.counts,{ok:2,wa:1,lo:1,no:2});
const c=o.rows.find(r=>r.vid==='c');assert.deepEqual(c.loose.map(x=>x.state),['open','open','na']);assert.equal(c.loose[0].amount,300);/* AOW loose tariff */
assert.equal(t.looseOpen.n,2);assert.equal(t.looseOpen.sum,600);
// Ticking a loose payment moves it into the loose pot, never into the prize pot.
C.setLoosePaid(w('w1'),'c',true);o=C.seriesOverview(d,p);t=o.totals;
assert.equal(t.looseA.n,1);assert.equal(t.looseA.sum,300);assert.equal(t.loosePot,300);assert.equal(t.pot,6100);assert.equal(t.total,6400);assert.equal(C.loosePot(d,p),300);
assert.equal(o.rows.find(r=>r.vid==='c').loose[0].state,'paid');
assert.equal(C.open(d,2026).filter(i=>i.kind==='match').length,1);/* only w2 for c is still open */
C.setLoosePaid(w('w1'),'c',false);assert.equal(C.loosePot(d,p),0);
C.setLoosePaid(w('w1'),'c',true);
// Year result: loose pot is neutral by default (what comes in goes out), an own payout amount changes it.
let s=C.summary(d,2026);assert.equal(s.loose,300);assert.equal(s.spent,4000+2100+300);assert.equal(s.over,s.start-s.planned);
p.looseActual=200;s=C.summary(d,2026);assert.equal(s.over,s.start-s.planned+100);p.looseActual=null;
// Switching a fisher away from loose drops the loose payments from the pot.
C.setSeriesMode(d,p.id,'c','series');assert.equal(C.loosePot(d,p),0);C.setSeriesMode(d,p.id,'c','loose');assert.equal(C.loosePot(d,p),300);
// One-time migration: loose payments that counted as paid before stay paid, those marked unpaid stay open.
p.looseMigrated=false;w('w1').looseChecked={};w('w2').looseChecked={};w('w2').unpaid={c:true};
C.sync(d);assert.equal(C.loosePaid(w('w1'),{id:'c'}),true);assert.equal(C.loosePaid(w('w2'),{id:'c'}),false);assert.equal(p.looseMigrated,true);
C.sync(d);assert.equal(C.loosePaid(w('w2'),{id:'c'}),false);/* runs only once */
// Fishers who never fished are listed too, from the competition.
assert.ok(C.seriesOverview(d,p).rows.some(r=>r.vid==='g'));
// Groups and prize ladder.
assert.deepEqual(C.ladder(29900,10).prizes,[5000,4500,4000,3500,3000,2500,2000,2000,1750,1500]);/* pot 299,00 for 10 paid fishers */
assert.equal(C.ladder(29900,10).over,150);assert.equal(C.ladder(29900,10).total,29750);
assert.deepEqual(C.ladder(29900,0).prizes,[]);assert.equal(C.ladder(29900,0).over,29900);
assert.equal(C.ladder(1000,5).short,true);/* too little money for 5 prizes */
assert.equal(C.ladder(5000,1).prizes[0],5000);
const lad=C.ladder(20000,6);assert(lad.prizes.every((x,i,a)=>!i||x<=a[i-1]));assert.equal(lad.total+lad.over,20000);
assert(lad.prizes.every(x=>x%250===0));
o=C.seriesOverview(d,p);
const g=v=>o.rows.find(r=>r.vid===v);
assert.equal(g('a').group,'serie');assert.equal(g('b').group,'serie');assert.equal(g('f').group,'serie');
assert.equal(g('c').group,'kans');/* loose now, but 2 of 3 matches fished: can still reach 2 */
assert.equal(o.groups.serie+o.groups.kans+o.groups.los,o.rows.length);
assert.equal(o.prizes.sureN,1);/* only a: paid and enough matches */
assert(o.prizes.maxN>=o.prizes.sureN);assert(o.prizes.potMax>=o.prizes.potSure);
assert.equal(o.prizes.potSure,6100);
d.competities[0].telBeste=3;o=C.seriesOverview(d,p);
assert.equal(g('f').group,'serie');assert.equal(o.rows.find(r=>r.vid==='f').reach,false);/* paid but can no longer reach 3 */
assert.equal(o.prizes.sureN,0);
d.competities[0].telBeste=2;
// Same series for everybody: the competition name wins over a different agenda name (fresh browser == old browser).
{const e={vissers:[{id:'a',naam:'A'}],competities:[{id:'c1',naam:'Herfst Serie 2026',type:'serie',telBeste:2,seizoen:'2026',vissers:['a']}],
 wedstrijden:[{id:'m1',naam:'Herfst Serie 2026 wedstrijd 1',datum:'2026-10-03',competitieId:'c1'},{id:'m2',naam:'Herfst Serie 2026 wedstrijd 2',datum:'2026-10-10',competitieId:'c1'}],
 uitslagen:[{wedstrijdId:'m1',visserId:'a'},{wedstrijdId:'m2',visserId:'a'}],
 roosterItems:[{id:'r1',type:'wedstrijd',datum:'2026-10-03',titel:'Herfstserie · Water',wedstrijdVorm:'serie',serieNaam:'Herfstserie',gekoppeldeWedstrijdId:'m1'},{id:'r2',type:'wedstrijd',datum:'2026-10-10',titel:'Herfstserie · Water',wedstrijdVorm:'serie',serieNaam:'Herfstserie',gekoppeldeWedstrijdId:'m2'}],
 finance:{version:3,years:{2026:{budget:0}},entries:[]}};
 C.sync(e);const posts=e.finance.entries.filter(x=>x.kind==='series');
 assert.equal(posts.length,1);assert.equal(posts[0].title,'Herfst Serie 2026');assert.equal(posts[0].children.length,2);
 assert.equal(C.seriesOverview(e,posts[0]).matches,2);}
console.log('PASS: eindprijs reasons (ja/los/onbetaald/geen keuze/nog open/te weinig), prize pot vs loose pot, explicit loose ticks, neutral loose payout in the year result, one-time migration');
