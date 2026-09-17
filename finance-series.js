/* A series has one prize fund; day entries collect occasional entrants' fees. */
(function(root){
'use strict';
const C=typeof module!=='undefined'&&module.exports?require('./finance-core.js'):root.FinanceCore;
const baseSync=C.sync,baseStats=C.stats,baseOpen=C.outstanding,basePreview=C.previewImport,baseApply=C.applyImport;
const sum=xs=>xs.reduce((a,b)=>a+b,0);
const key=(name,year)=>String(year)+':'+String(name).trim().toLocaleLowerCase('nl');
const fresh=(id,name,year)=>({id,kind:'series',seriesKey:key(name,year),title:name,date:year+'-01-01',category:'Series',planned:0,fee:0,looseFee:0,payout:0,status:'planned',configured:false,payments:{},members:[],attachments:[],enrollments:{}});
C.seriesFor=function(d,e){return e?.kind==='series'?e:d.finance.entries.find(p=>p.id===e?.seriesId);};
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
  p.enrollments=p.enrollments||{};p.children=g.children.map(e=>e.id);
  // Preserve legacy figures for review; repeated contributions are never added together.
  const legacy=g.children.filter(e=>!e.seriesId&&e.configured&&(e.planned||e.fee||e.payout||C.received(e)));
  if(legacy.length){p.previousContributions=[...new Set([...(p.previousContributions||[]),...legacy.map(e=>e.planned)])];p.migrationNotice=true;if(!p.configured){const values=p.previousContributions;p.planned=values.length===1?values[0]:sum(legacy.map(e=>e.planned));}} 
  for(const e of g.children){
   if(!e.seriesId){e.seriesPrevious={planned:e.planned,fee:e.fee,status:e.status,payout:e.payout||0};if(e.status==='settled')p.payout+=(e.payout||0);}
   e.seriesId=p.id;e.planned=0;e.payout=0;e.fee=p.looseFee||0;e.configured=p.configured;
   if(e.status==='settled')e.status='planned';
   e.seriesModes=p.enrollments;
  }
  p.members=[...new Set([...(p.members||[]),...g.children.flatMap(e=>e.members||[])])];
 }
 for(const p of f.entries.filter(e=>e.kind==='series')){p.enrollments=p.enrollments||{};p.children=p.children||[];}
 return f;
};
C.outstanding=function(e){
 if(e.status==='cancelled')return 0;
 if(e.kind==='series')return (e.members||[]).filter(id=>e.enrollments?.[id]==='series'&&!Object.hasOwn(e.payments,id)).length*(e.fee||0);
 if(e.seriesId)return (e.members||[]).filter(id=>e.seriesModes?.[id]==='loose'&&!Object.hasOwn(e.payments,id)).length*(e.fee||0);
 return baseOpen(e);
};
C.stats=function(e){
 if(e.seriesId){const income=C.received(e),extra=sum(Object.entries(e.payments||{}).filter(([id])=>e.seriesModes?.[id]==='loose').map(([,p])=>p.amount));return {income,out:0,net:0,reserved:0,held:income-extra,open:C.outstanding(e),extra};}
 if(e.kind==='series'){
  const income=C.received(e),out=e.status==='cancelled'?0:e.payout||0,used=Math.max(0,out-income);
  return {income,out,net:e.status==='settled'?out-income:used,reserved:e.status==='planned'?Math.max(0,(e.planned||0)-used):0,held:e.status==='planned'?Math.max(0,income-out):0,open:C.outstanding(e),extra:0};
 }
 return {...baseStats(e),extra:0};
};
C.summary=function(d,year){const f=C.sync(d),y=f.years[year]||{},entries=f.entries.filter(e=>String(e.date||e.year).slice(0,4)===String(year));const t={budget:y.budget||0,carry:y.carry||0,income:0,out:0,net:0,reserved:0,held:0,open:0,extra:0,missing:0,unclassified:0};for(const e of entries){const s=C.stats(e);for(const k of ['income','out','net','reserved','held','open','extra'])t[k]+=s[k]||0;if(e.status==='planned'&&!e.configured&&!e.seriesId)t.missing++;if(e.kind==='series')t.unclassified+=(e.members||[]).filter(id=>!e.enrollments[id]).length;}t.start=t.budget+t.carry;t.balance=t.start+t.income-t.out;t.free=t.balance-t.reserved-t.held;return t;};
const baseCancel=C.cancel;C.cancel=function(e){if(e.kind==='series'&&e.payout)throw Error('Deze serie heeft al uitgekeerd prijzengeld. Corrigeer de afrekening eerst.');baseCancel(e);};
C.setSeriesMode=function(d,seriesId,member,mode){
 C.sync(d);const p=d.finance.entries.find(e=>e.id===seriesId&&e.kind==='series');if(!p||!['series','loose'].includes(mode))throw Error('Kies deelname aan de serie of een losse wedstrijd.');
 const children=d.finance.entries.filter(e=>e.seriesId===seriesId),prior=p.enrollments[member];
 if(prior&&prior!==mode&&(Object.hasOwn(p.payments,member)||children.some(e=>Object.hasOwn(e.payments,member))))throw Error('Zet bestaande betalingen eerst terug naar openstaand voordat je de deelname wijzigt.');
 if(!prior&&mode==='series'){
  const old=children.filter(e=>Object.hasOwn(e.payments,member));
  if(old.length){p.payments[member]={amount:sum(old.map(e=>e.payments[member].amount))+(p.payments[member]?.amount||0),date:old[0].payments[member].date||p.date};old.forEach(e=>delete e.payments[member]);}
 }
 p.enrollments[member]=mode;if(!p.members.includes(member))p.members.push(member);C.sync(d);
};
C.previewImport=function(d,rows){
 C.sync(d);const seen=new Set();return rows.map(r=>{
  const k=r.kind+':'+r.externalId;if(seen.has(k))throw Error('Dubbel ID in Excel: '+r.externalId);seen.add(k);
  if(r.kind!=='series'){
   if(r.kind==='match'&&r.form==='serie'&&(r.planned||r.fee))throw Error('Vul bedragen voor een serie één keer op het tabblad Series in. Laat de bedragen bij de afzonderlijke seriewedstrijden leeg of 0.');
   const p=basePreview(d,[r])[0];if(r.kind==='match'&&r.form==='serie')p.changes=p.changes.filter(c=>!['Begroot','Inleg per visser'].includes(c.label));if(p.id)p.action=p.changes.length?'update':'same';return p;
  }
  if(!r.externalId||!r.title||!/^\d{4}-01-01$/.test(r.date))throw Error('Vul ID, jaar en serienaam in op het tabblad Series.');
  const e=d.finance.entries.find(e=>e.kind==='series'&&(e.externalId===r.externalId||e.seriesKey===key(r.title,r.date.slice(0,4))));
  const changes=[['Serienaam',e?.title,r.title],['Jaar',e?.date.slice(0,4),r.date.slice(0,4)],['Begroot',e?.planned,r.planned],['Inleg serie',e?.fee,r.fee],['Inleg losse wedstrijd',e?.looseFee,r.looseFee]].filter(([,a,b])=>a!==b).map(([label,before,after])=>({label,before,after}));
  const children=d.finance.entries.filter(c=>c.seriesId===e?.id);
  return {row:r,id:e?.id,changes,action:e?(changes.length||!e.configured?'update':'same'):'new',blocked:!!e&&(e.status!=='planned'||!!C.received(e)||children.some(c=>!!C.received(c)))};
 });
};
C.applyImport=function(d,items){
 // Series first: a new schedule can then resolve its shared tariffs immediately.
 let next=JSON.parse(JSON.stringify(d));C.sync(next);
 for(const item of items.filter(i=>i.row.kind==='series')){
  const p=C.previewImport(next,[item.row])[0];if(p.blocked&&p.action==='update')throw Error('Deze serie heeft al betalingen. Wijzig haar rechtstreeks in de app.');
  const r=p.row;let e=next.finance.entries.find(e=>e.id===p.id);if(!e){e=fresh('series-'+encodeURIComponent(key(r.title,r.date.slice(0,4))),r.title,r.date.slice(0,4));next.finance.entries.push(e);}
  if(e.configured&&(e.title!==r.title||e.date!==r.date)&&e.children?.length)throw Error('Wijzig de naam of het jaar van een gekoppelde serie in de app.');
  Object.assign(e,{externalId:r.externalId,planned:r.planned,fee:r.fee,looseFee:r.looseFee,configured:true,migrationNotice:false});
 }
 next=baseApply(next,items.filter(i=>i.row.kind!=='series'));C.sync(next);return next;
};
if(typeof module!=='undefined'&&module.exports)module.exports=C;
})(typeof window!=='undefined'?window:this);
