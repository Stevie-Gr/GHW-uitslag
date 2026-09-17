/* A series is one budget line with four tariffs; its matches share the members and the series choice per fisher. */
(function(root){
'use strict';
const C=typeof module!=='undefined'&&module.exports?require('./finance-core.js'):root.FinanceCore;
const baseSync=C.sync;
const key=(name,year)=>String(year)+':'+String(name).trim().toLocaleLowerCase('nl');
const fresh=(id,name,year)=>({id,kind:'series',seriesKey:key(name,year),title:name,date:year+'-01-01',category:'Series',planned:0,fee:0,feeAow:0,looseFee:0,looseFeeAow:0,actual:null,status:'planned',configured:false,unpaid:{},members:[],enrollments:{},seriesPaid:{}});
C.sync=function(d){
 const f=baseSync(d),groups=new Map();
 for(const e of f.entries){
  if(e.kind!=='match')continue;
  const r=(d.roosterItems||[]).find(r=>r.id===e.agendaId),w=(d.wedstrijden||[]).find(w=>w.id===e.matchId),comp=(d.competities||[]).find(c=>c.id===w?.competitieId);
  const name=r?.wedstrijdVorm==='serie'?r.serieNaam:comp?.type==='serie'?comp.naam:null;
  if(!name)continue;const year=String(e.date||'').slice(0,4);if(!/^\d{4}$/.test(year))continue;
  const k=key(name,year);if(!groups.has(k))groups.set(k,{name,year,children:[]});groups.get(k).children.push(e);
 }
 for(const [k,g] of groups){
  let p=f.entries.find(e=>e.kind==='series'&&e.seriesKey===k);
  if(!p){p=fresh('series-'+encodeURIComponent(k),g.name,g.year);f.entries.push(p);}
  p.enrollments=p.enrollments||{};p.seriesPaid=p.seriesPaid||{};p.children=g.children.map(e=>e.id);
  for(const e of g.children){e.seriesId=p.id;e.planned=0;e.fee=p.looseFee||0;e.feeBasis='person';e.configured=p.configured;}
  p.members=[...new Set(g.children.flatMap(e=>e.members||[]))];
  // A series is dated on its first match, so it sorts and reads naturally in the overview.
  const dates=g.children.map(e=>e.date).filter(Boolean).sort();p.date=dates[0]||g.year+'-01-01';
 }
 for(const p of f.entries.filter(e=>e.kind==='series')){p.enrollments=p.enrollments||{};p.seriesPaid=p.seriesPaid||{};p.children=p.children||[];}
 return f;
};
if(typeof module!=='undefined'&&module.exports)module.exports=C;
})(typeof window!=='undefined'?window:this);
