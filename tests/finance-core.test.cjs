const assert=require('node:assert/strict'),C=require('../lib/finance-series.js');
// Everyone in a result has paid unless marked; couples pay per couple; series members choose once and confirm once.
const d={vissers:[{id:'a',naam:'A'},{id:'b',naam:'B'},{id:'c',naam:'C',aow:true},{id:'e',naam:'E'}],competities:[{id:'s1',naam:'Winter',type:'serie'}],
 wedstrijden:[{id:'k1',naam:'Koppel Spui',datum:'2026-03-28',isKoppel:true},{id:'w1',naam:'Winter 1',datum:'2026-01-17',competitieId:'s1'},{id:'w2',naam:'Winter 2',datum:'2026-02-07',competitieId:'s1'}],
 uitslagen:[{wedstrijdId:'k1',visserId:'a',koppelId:'K'},{wedstrijdId:'k1',visserId:'b',koppelId:'K'},{wedstrijdId:'k1',visserId:'e',koppelId:null},{wedstrijdId:'w1',visserId:'a'},{wedstrijdId:'w1',visserId:'c'},{wedstrijdId:'w2',visserId:'a'},{wedstrijdId:'w2',visserId:'c'},{wedstrijdId:'w2',visserId:'b'}],
 roosterItems:[],finance:{version:1,years:{2026:{budget:243500}},entries:[{id:'match-k1',kind:'match',matchId:'k1',status:'settled',payout:5000,payments:{a:{amount:1000}},planned:3000,fee:1000,configured:true,attachments:[{name:'x'}]},{id:'exp',kind:'expense',title:'Inkt',year:2026,date:'',planned:25000,configured:true,status:'planned'}]}};
// Fresh start: old payments, payouts and attachments are wiped; budget and tariffs stay.
C.sync(d);const k=d.finance.entries.find(e=>e.id==='match-k1');assert.equal(d.finance.version,3);assert.deepEqual(k.payments,{});assert.equal(k.status,'planned');assert.equal(k.payout,0);assert.deepEqual(k.attachments,[]);assert.equal(k.planned,3000);assert.equal(k.feeBasis,'koppel');
// Couple units: one per koppelId, a lone fisher is his own unit and owes the full couple fee.
const units=C.units(d,k);assert.deepEqual(units.map(u=>u.id).sort(),['e','k:K']);assert.equal(C.amount(d,k,units.find(u=>u.id==='k:K')),1000);assert.equal(C.amount(d,k,units.find(u=>u.id==='e')),1000);
assert.equal(C.open(d,2026).filter(i=>i.kind==='match').length,0);C.setUnpaid(k,'k:K',true);let o=C.open(d,2026);assert.equal(o.filter(i=>i.kind==='match').length,1);assert.deepEqual(o[0].unit.members,['a','b']);assert.equal(o[0].amount,1000);
// Series: parent created from the competition; tariffs; members must choose; AOW picks the AOW tariff.
const p=d.finance.entries.find(e=>e.kind==='series');assert.equal(p.title,'Winter');assert.equal(p.date,'2026-01-17');Object.assign(p,{planned:4000,fee:1050,feeAow:900,looseFee:350,looseFeeAow:300,configured:true});C.sync(d);
assert.deepEqual([...new Set(p.members)].sort(),['a','b','c']);assert.equal(C.open(d,2026).filter(i=>i.kind==='choice').length,3);// one choice per fisher per series
C.setSeriesMode(d,p.id,'a','series');C.setSeriesMode(d,p.id,'c','series');C.setSeriesMode(d,p.id,'b','loose');
o=C.open(d,2026);assert.equal(o.filter(i=>i.kind==='choice').length,0);const ser=o.filter(i=>i.kind==='series');assert.deepEqual(ser.map(i=>i.unit.id+':'+i.amount).sort(),['a:1050','c:900']);
const w2=d.finance.entries.find(e=>e.matchId==='w2');assert.equal(C.amount(d,w2,{id:'b',members:['b']}),350);assert.equal(C.amount(d,w2,{id:'a',members:['a']}),0);assert.equal(o.filter(i=>i.kind==='match').length,1);// still the couple
C.setUnpaid(w2,'b',true);assert.equal(C.open(d,2026).filter(i=>i.entryId===w2.id)[0].amount,350);C.setSeriesPaid(d,p.id,'a',true);assert.deepEqual(C.open(d,2026).filter(i=>i.kind==='series').map(i=>i.unit.id),['c']);
// Loose → series later: full series fee, no crediting.
C.setSeriesMode(d,p.id,'b','series');assert.equal(C.open(d,2026).filter(i=>i.kind==='series'&&i.unit.id==='b')[0].amount,1050);assert.equal(C.open(d,2026).filter(i=>i.entryId===w2.id).length,0);
// Loose fees are extra income: b fished w2 loose (350) before switching; put him back to loose for the check.
C.setSeriesMode(d,p.id,'b','loose');C.setUnpaid(w2,'b',false);assert.deepEqual(C.looseIncome(d,p).map(r=>r.vid+':'+r.count+':'+r.total),['b:1:350']);C.setUnpaid(w2,'b',true);assert.equal(C.looseIncome(d,p).length,0);C.setUnpaid(w2,'b',false);
d.finance.years[2026].extras=[{title:'Extra bijdrage vereniging',amount:50000}];
// Summary: spent defaults to the prize fund (fees + planned), so 'over' = budget + extras - planned while nothing deviates; an override changes it.
let s=C.summary(d,2026);assert.equal(s.planned,3000+25000+4000);assert.equal(s.inleg,C.inleg(d,k)+C.inleg(d,p));assert.equal(C.inleg(d,k),1000);/* couple K unpaid, lone e paid */assert.equal(C.inleg(d,p),1050+350);/* a confirmed series, b loose */assert.equal(s.spent,s.planned+s.inleg);assert.equal(s.extras,50000);assert.equal(s.start,243500+50000);assert.equal(s.over,s.start-s.planned);assert.equal(s.openCount,2);
k.actual=4500;s=C.summary(d,2026);assert.equal(s.spent,4500+25000+C.pot(d,p));assert.equal(s.over,s.start+s.inleg-s.spent);assert.equal(C.pot(d,k),4000);
C.setSeriesMode(d,p.id,'b','series');s=C.summary(d,2026);assert.equal(C.inleg(d,p),1050);assert.equal(s.openCount,3);
C.cancel(k);s=C.summary(d,2026);assert.equal(s.planned,29000);assert.equal(s.openCount,2);
// Money and dates.
assert.equal(C.cents('€ 3,50'),350);assert.equal(C.cents(10.5),1050);assert.throws(()=>C.cents('abc'));assert.equal(C.date('5-4-2026'),'2026-04-05');
console.log('PASS: fresh start wipe, paid-by-default, couple units, lone fisher full fee, series choice/confirm, AOW tariffs, loose→series full fee, summary planned/actual/over');
