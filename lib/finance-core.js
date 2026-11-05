/* Simple club budget: what is planned, what it really cost, and who still has to pay. Amounts are integer euro cents. */
(function(root){
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
function cents(value){
  if(typeof value==='number'){if(!Number.isFinite(value)||value<0||value>10000000)throw Error('Vul een geldig positief bedrag in.');return Math.round(value*100);}
  let s=String(value??'').trim().replace(/\s|€/g,'');
  if(!s) return 0;
  if(s.includes(',')) s=s.replace(/\./g,'').replace(',','.');
  if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('Gebruik een bedrag zoals 150,00.');
  return cents(Number(s));
}
function date(value){
  if(value instanceof Date && !isNaN(value))return value.toISOString().slice(0,10);
  let s=String(value??'').trim();
  if(/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(s)){const [d,m,y]=s.split(/[-/]/);s=`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||isNaN(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw Error('Gebruik een geldige datum (dd-mm-jjjj).');
  return s;
}
/* Everyone in a result has paid unless marked otherwise; series members confirm once. */
function normalize(d){
  d.finance=d.finance||{version:3,years:{},entries:[]};
  d.finance.years=d.finance.years||{};d.finance.entries=d.finance.entries||[];
  if(d.finance.version!==3){
    // Fresh start of the payment administration (agreed 17-09-2026): results, budget, tariffs and waters stay.
    for(const e of d.finance.entries){e.payments={};e.unpaid={};e.enrollments=e.kind==='series'?{}:undefined;e.seriesPaid=e.kind==='series'?{}:undefined;e.attachments=[];e.payout=0;if(e.status==='settled')e.status='planned';e.actual=null;delete e.note;delete e.seriesPrevious;delete e.previousContributions;delete e.migrationNotice;}
    d.finance.version=3;
  }
  for(const e of d.finance.entries){e.unpaid=e.unpaid||{};e.members=e.members||[];if(e.actual===undefined)e.actual=null;if(e.kind==='match')e.looseChecked=e.looseChecked||{};if(e.kind==='series'){e.enrollments=e.enrollments||{};e.seriesPaid=e.seriesPaid||{};if(e.looseActual===undefined)e.looseActual=null;}}
  return d.finance;
}
function matchIds(d,wid){const w=(d.wedstrijden||[]).find(w=>w.id===wid);return w?.gescheidenGroepId?(d.wedstrijden||[]).filter(x=>x.gescheidenGroepId===w.gescheidenGroepId).map(x=>x.id):[wid].filter(Boolean);}
function matchEntry(d,wid){normalize(d);const ids=matchIds(d,wid);return d.finance.entries.find(e=>e.kind==='match'&&ids.includes(e.matchId));}
function sync(d){
  const f=normalize(d);
  for(const r of d.roosterItems||[]){
    if(r.type!=='wedstrijd')continue;
    let e=f.entries.find(e=>e.agendaId===r.id);
    if(!e && r.gekoppeldeWedstrijdId)e=matchEntry(d,r.gekoppeldeWedstrijdId);
    if(!e){e={id:'agenda-'+r.id,kind:'match',status:'planned',planned:0,fee:0,configured:false,actual:null,unpaid:{},members:[],category:'Wedstrijden'};f.entries.push(e);}
    e.agendaId=r.id;e.date=r.datum;e.title=r.titel||(r.serieNaam?`${r.serieNaam} - wedstrijd ${r.serieWedstrijdNummer}`:'Wedstrijd');
    if(r.gekoppeldeWedstrijdId)e.matchId=r.gekoppeldeWedstrijdId;
    if(!e.feeBasis)e.feeBasis=['koppel','gescheiden_koppel'].includes(r.wedstrijdVorm)?'koppel':'person';
  }
  for(const w of d.wedstrijden||[]){
    let e=matchEntry(d,w.id);
    if(!e){e={id:'match-'+w.id,matchId:w.id,kind:'match',status:'planned',planned:0,fee:0,configured:false,actual:null,unpaid:{},members:[],category:'Wedstrijden'};f.entries.push(e);}
    if(!e.agendaId){e.date=w.datum;e.title=w.naam;}
    if(!e.feeBasis)e.feeBasis=(w.isKoppel||w.gescheidenGroepId)?'koppel':'person';
    const ids=matchIds(d,w.id);
    e.members=[...new Set((d.uitslagen||[]).filter(u=>ids.includes(u.wedstrijdId)&&!u.afwezig).map(u=>u.visserId))];
  }
  return f;
}
/* Payment units of a match: one per fisher, or one per couple when the fee is per couple. */
function units(d,e){
  if(!e||e.kind!=='match')return [];
  const ids=matchIds(d,e.matchId),rows=(d.uitslagen||[]).filter(u=>ids.includes(u.wedstrijdId)&&!u.afwezig);
  if(!rows.length)return (e.members||[]).map(id=>({id,members:[id]}));
  if(e.feeBasis!=='koppel')return [...new Set(rows.map(u=>u.visserId))].map(id=>({id,members:[id]}));
  const groups=new Map();for(const u of rows){const k=u.koppelId?'k:'+u.koppelId:u.visserId;if(!groups.has(k))groups.set(k,[]);if(!groups.get(k).includes(u.visserId))groups.get(k).push(u.visserId);}
  return [...groups.entries()].map(([id,members])=>({id,members}));
}
const seriesFor=(d,e)=>e?.kind==='series'?e:(d.finance.entries||[]).find(p=>p.id===e?.seriesId);
const isAow=(d,vid)=>!!(d.vissers||[]).find(v=>v.id===vid)?.aow;
/* Amount a unit owes for this match; null when a series choice is still missing. */
function amount(d,e,unit){
  const p=e.seriesId?seriesFor(d,e):null;
  if(!p)return e.fee||0;
  const vid=unit.members[0],mode=p.enrollments[vid];
  if(mode==='series')return 0;
  if(mode==='loose')return isAow(d,vid)?(p.looseFeeAow||0):(p.looseFee||0);
  return null;
}
const seriesAmount=(d,p,vid)=>isAow(d,vid)?(p.feeAow||0):(p.fee||0);
/* Loose fees inside a series are open until explicitly ticked as paid (per match, per fisher). */
const loosePaid=(c,u)=>has(c.looseChecked,u.id);
/* Open items of a year: unpaid match units, unconfirmed series members, and members without a series choice. */
function open(d,year){
  const f=sync(d),out=[];
  for(const e of f.entries){
    if(String(e.date||e.year).slice(0,4)!==String(year)||e.status==='cancelled')continue;
    if(e.kind==='match'){for(const u of units(d,e)){const a=amount(d,e,u);if(a===null){const p=seriesFor(d,e);if(!out.some(i=>i.kind==='choice'&&i.entryId===p.id&&i.unit.id===u.id))out.push({entryId:p.id,title:p.title,date:p.date,unit:u,amount:null,kind:'choice'});}else if(a>0&&(e.seriesId?!loosePaid(e,u):has(e.unpaid,u.id)))out.push({entryId:e.id,title:e.title,date:e.date,unit:u,amount:a,kind:'match'});}}
    if(e.kind==='series'){const members=[...new Set(f.entries.filter(c=>c.seriesId===e.id).flatMap(c=>c.members))];for(const vid of members)if(e.enrollments[vid]==='series'&&!has(e.seriesPaid,vid))out.push({entryId:e.id,title:e.title,date:e.date,unit:{id:vid,members:[vid]},amount:seriesAmount(d,e,vid),kind:'series'});}
  }
  return out;
}
/* Loose entry fees inside a series form their own pot: per fisher the matches fished loose that were explicitly ticked as paid. */
function looseIncome(d,p){
  const f=sync(d),out=[];
  for(const c of f.entries.filter(c=>c.seriesId===p.id&&c.status!=='cancelled'))for(const u of units(d,c)){const vid=u.members[0];if(p.enrollments[vid]!=='loose'||!loosePaid(c,u))continue;const a=amount(d,c,u)||0;let row=out.find(r=>r.vid===vid);if(!row){row={vid,count:0,total:0};out.push(row);}row.count++;row.total+=a;}
  return out;
}
/* Entry fees actually received: paid units of a match; for a series only the confirmed series fees (loose fees are a separate pot). */
function inleg(d,e){
  const f=sync(d);
  if(e.kind==='series'){const members=[...new Set(f.entries.filter(c=>c.seriesId===e.id).flatMap(c=>c.members))];return members.filter(v=>e.enrollments[v]==='series'&&has(e.seriesPaid,v)).reduce((s,v)=>s+seriesAmount(d,e,v),0);}
  if(e.kind!=='match')return 0;
  return units(d,e).reduce((s,u)=>{const a=amount(d,e,u);return s+(a&&!has(e.unpaid,u.id)?a:0);},0);
}
/* Prize fund of a match or series: fees received plus the club contribution. Spent defaults to the prize fund (matches) or the budgeted amount (expenses). */
const pot=(d,e)=>e.kind==='expense'?(e.planned||0):inleg(d,e)+(e.planned||0);
const spent=(d,e)=>e.actual??pot(d,e);
/* The loose-fee pot of a series is separate from the series prize pot. Its payout is typed in by hand; default is the pot itself, so it stays neutral for the year result. */
const loosePot=(d,p)=>looseIncome(d,p).reduce((s,r)=>s+r.total,0);
const looseSpent=(d,p)=>p.looseActual??loosePot(d,p);
function summary(d,year){
  const f=sync(d),y=f.years[year]||{},entries=f.entries.filter(e=>String(e.date||e.year).slice(0,4)===String(year)&&e.status!=='cancelled'&&!e.seriesId);
  const t={budget:y.budget||0,carry:y.carry||0,extras:(y.extras||[]).reduce((s,x)=>s+(x.amount||0),0),inleg:0,planned:0,spent:0,missing:0};
  t.loose=0;t.plannedToDate=0;const today=new Date().toISOString().slice(0,10);for(const e of entries){if(!e.configured){t.missing++;continue;}t.planned+=e.planned||0;if(!e.date||e.date<=today)t.plannedToDate+=e.planned||0;t.inleg+=inleg(d,e);t.spent+=spent(d,e);if(e.kind==='series'){t.loose+=loosePot(d,e);t.spent+=looseSpent(d,e);}}
  t.start=t.budget+t.carry+t.extras;t.over=t.start+t.inleg+t.loose-t.spent;
  const items=open(d,year);t.openCount=items.filter(i=>i.kind!=='choice').length;t.openAmount=items.reduce((s,i)=>s+(i.amount||0),0);t.choices=items.filter(i=>i.kind==='choice').length;
  return t;
}
function cancel(e){e.status='cancelled';}
function setUnpaid(e,unitId,flag){e.unpaid=e.unpaid||{};if(flag)e.unpaid[unitId]=true;else delete e.unpaid[unitId];}
function setSeriesMode(d,seriesId,vid,mode){sync(d);const p=d.finance.entries.find(e=>e.id===seriesId&&e.kind==='series');if(!p||!['series','loose'].includes(mode))throw Error('Kies serie of los.');p.enrollments[vid]=mode;if(mode==='loose')delete p.seriesPaid[vid];}
function setSeriesPaid(d,seriesId,vid,flag){sync(d);const p=d.finance.entries.find(e=>e.id===seriesId&&e.kind==='series');if(!p)throw Error('Serie niet gevonden.');if(flag)p.seriesPaid[vid]=true;else delete p.seriesPaid[vid];}
function setLoosePaid(e,unitId,flag){e.looseChecked=e.looseChecked||{};if(flag)e.looseChecked[unitId]=true;else delete e.looseChecked[unitId];}
const norm=x=>String(x||'').trim().toLocaleLowerCase('nl');
/* The result competition that belongs to a series budget post (same name; same season when several exist). */
function seriesCompetition(d,p){
  const list=(d.competities||[]).filter(c=>c.type==='serie'&&norm(c.naam)===norm(p.title));
  return list.find(c=>String(c.seizoen)===String(p.date||'').slice(0,4))||list[0]||null;
}
const seriesMatches=(d,p)=>sync(d).entries.filter(c=>c.seriesId===p.id&&c.status!=='cancelled').sort((a,b)=>String(a.date).localeCompare(String(b.date)));
/* Prize eligibility: series chosen, series paid in full, and at least "best X" matches fished. */
/* Matches already fished, matches still to come (the series total is set per series; without it, planned matches without results count). */
function seriesProgress(d,p){
  const kids=seriesMatches(d,p),played=kids.filter(c=>(c.members||[]).length).length;
  const total=p.totalMatches>0?p.totalMatches:kids.length;
  return {played,total,toGo:Math.max(0,total-played),next:played+1};
}
function eindprijs(d,p,vid){
  const kids=seriesMatches(d,p),comp=seriesCompetition(d,p),min=comp?.telBeste||kids.length,mode=p.enrollments[vid];
  const fished=kids.filter(c=>(c.members||[]).includes(vid)).length,pr=seriesProgress(d,p),remaining=pr.toGo;
  const signed=remaining>0&&(p.opgave||{})[vid]===pr.next,projected=fished+(signed?1:0);
  let code;
  if(!mode)code='geen-keuze';else if(mode==='loose')code='los';else if(!has(p.seriesPaid,vid))code='onbetaald';
  else if(fished>=min)code='ja';else if(fished+remaining>=min)code='nog-open';else code='te-weinig';
  return {ok:code==='ja',code,fished,min,remaining,signed,projected};
}
/* Prize ladder for n prizes from a pot (cents). Place 1 gets the most, steps are 5,00; in the lowest places a step may be 2,50 or 0.
   The top amount is not fixed: we pick the ladder that leaves the least in NOG OVER (fewest small steps on a tie). */
function ladder(pot,n){
  const U=250,T=500;pot=Math.max(0,pot|0);
  if(n<1||pot<U)return {prizes:[],total:0,over:pot};
  const small=Math.min(3,n-1),combos=[[]];
  for(let i=0;i<small;i++){const next=[];for(const c of combos)for(const s of [T,U,0])next.push(c.concat(s));combos.length=0;combos.push(...next);}
  let best=null;
  for(let b=T;b<=pot;b+=U)for(const c of combos){
    const steps=c.concat(Array(n-1-small).fill(T)),p=[b];
    for(const st of steps)p.push(p[p.length-1]+st);
    const total=p.reduce((a,x)=>a+x,0);
    if(total>pot)continue;
    const over=pot-total,odd=steps.filter(x=>x!==T).length;
    if(!best||over<best.over||(over===best.over&&odd<best.odd))best={prizes:p.reverse(),total,over,odd};
  }
  if(!best){const each=Math.floor(pot/n/U)*U;if(each<U)return {prizes:[],total:0,over:pot,short:true};const prizes=Array(n).fill(each),total=each*n;return {prizes,total,over:pot-total};}
  return {prizes:best.prizes,total:best.total,over:best.over};
}
/* Everything the series Financiën tab shows, computed in one place. */
function seriesOverview(d,p){
  const kids=seriesMatches(d,p),comp=seriesCompetition(d,p),vids=[...new Set([...(p.members||[]),...((comp&&comp.vissers)||[])])];
  const t={club:p.planned||0,serieN:{n:0,sum:0},serieA:{n:0,sum:0},openS:{n:0,sum:0},looseN:{n:0,sum:0},looseA:{n:0,sum:0},looseOpen:{n:0,sum:0},counts:{ok:0,wa:0,lo:0,no:0}};
  const rows=vids.map(vid=>{
    const mode=p.enrollments[vid]||'',aow=isAow(d,vid),paid=mode==='series'&&has(p.seriesPaid,vid),status=mode==='series'?(paid?'ok':'wa'):mode==='loose'?'lo':'no';
    t.counts[status]++;
    if(mode==='series'){const a=seriesAmount(d,p,vid);if(paid){const b=aow?t.serieA:t.serieN;b.n++;b.sum+=a;}else{t.openS.n++;t.openS.sum+=a;}}
    const loose=mode==='loose'?kids.map((c,i)=>{
      const u=units(d,c).find(x=>x.members[0]===vid),a=u?amount(d,c,u)||0:0;
      const state=u?(loosePaid(c,u)?'paid':'open'):(c.members||[]).length?'abs':'na';
      if(state==='paid'){const b=aow?t.looseA:t.looseN;b.n++;b.sum+=a;}else if(state==='open'){t.looseOpen.n++;t.looseOpen.sum+=a;}
      return {entryId:c.id,unitId:vid,n:i+1,date:c.date,state,amount:a};
    }):[];
    const eind=eindprijs(d,p,vid),reach=eind.fished+eind.remaining>=eind.min,need=Math.max(0,eind.min-eind.fished);
    const group=mode==='series'?'serie':reach?'kans':'los';
    return {vid,aow,mode,paid,status,group,reach,need,signed:eind.signed,projected:eind.projected,fee:seriesAmount(d,p,vid),loose,eind};
  });
  t.seriesIncome=t.serieN.sum+t.serieA.sum;t.pot=t.club+t.seriesIncome;t.spent=spent(d,p);
  t.loosePot=t.looseN.sum+t.looseA.sum;t.looseSpent=looseSpent(d,p);t.total=t.pot+t.loosePot;
  const ov0min=comp?.telBeste||kids.length,progress=seriesProgress(d,p);
  /* Prizes: only fishers with "serie betaald" get one. Zeker = paid and already enough matches; Maximaal = everyone who could still pay and reach it. */
  const sure=rows.filter(r=>r.mode==='series'&&r.eind.fished>=ov0min),/* Zeker: serie gekozen en al genoeg gevist; betaling staat er los van */maxRows=rows.filter(r=>r.reach&&r.mode==='series');/* only serie-inschrijvingen count for prizes and pot */
  const extra=maxRows.filter(r=>!r.paid).reduce((a,r)=>a+r.fee,0);
  /* Verwacht: alle serievissers die de eindprijs halen (nu of na de volgende wedstrijd), ook als ze nog moeten betalen; hun inleg telt mee in de pot. */
  const expRows=rows.filter(r=>r.mode==='series'&&r.projected>=ov0min&&r.reach),potExp=t.pot+expRows.filter(r=>!r.paid).reduce((a,r)=>a+r.fee,0);
  const prizes={sureN:sure.length,expN:expRows.length,maxN:maxRows.length,potSure:t.pot+sure.filter(r=>!r.paid).reduce((a,r)=>a+r.fee,0),potExp,potMax:t.pot+extra,sure:ladder(t.pot+sure.filter(r=>!r.paid).reduce((a,r)=>a+r.fee,0),sure.length),exp:ladder(potExp,expRows.length),max:ladder(t.pot+extra,maxRows.length)};
  const groups={serie:rows.filter(r=>r.group==='serie').length,kans:rows.filter(r=>r.group==='kans').length,los:rows.filter(r=>r.group==='los').length};
  return {rows,totals:t,matches:progress.total,played:progress.played,toGo:progress.toGo,next:progress.next,min:ov0min,prizes,groups};
}
const api={cents,date,normalize,sync,matchIds,matchEntry,seriesFor,units,amount,seriesAmount,isAow,open,looseIncome,loosePaid,loosePot,looseSpent,inleg,pot,spent,summary,cancel,setUnpaid,setLoosePaid,setSeriesMode,setSeriesPaid,seriesCompetition,seriesProgress,eindprijs,ladder,seriesOverview};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FinanceCore=api;
})(typeof window!=='undefined'?window:this);
