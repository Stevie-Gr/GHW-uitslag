/* Local finance model. All amounts are integer euro cents. */
(function(root){
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
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
function normalize(d){
  d.finance=d.finance||{version:1,years:{},entries:[]};
  d.finance.years=d.finance.years||{};d.finance.entries=d.finance.entries||[];
  for(const e of d.finance.entries){e.payments=e.payments||{};e.members=e.members||[];e.attachments=e.attachments||[];}
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
    if(!e){e={id:'agenda-'+r.id,kind:'match',status:'planned',planned:0,fee:0,configured:false,payout:0,payments:{},members:[],attachments:[],category:'Wedstrijden'};f.entries.push(e);}
    e.agendaId=r.id;e.date=r.datum;e.title=r.titel||(r.serieNaam?`${r.serieNaam} - wedstrijd ${r.serieWedstrijdNummer}`:'Wedstrijd');
    if(r.gekoppeldeWedstrijdId)e.matchId=r.gekoppeldeWedstrijdId;
  }
  for(const w of d.wedstrijden||[]){
    let e=matchEntry(d,w.id);
    if(!e){e={id:'match-'+w.id,matchId:w.id,kind:'match',status:'planned',planned:0,fee:0,configured:false,payout:0,payments:{},members:[],attachments:[],category:'Wedstrijden'};f.entries.push(e);}
    if(!e.agendaId){e.date=w.datum;e.title=w.naam;}
    const ids=matchIds(d,w.id);
    const members=(d.uitslagen||[]).filter(u=>ids.includes(u.wedstrijdId)&&!u.afwezig).map(u=>u.visserId);
    e.members=[...new Set([...e.members,...members])];
  }
  return f;
}
function received(e){return Object.values(e.payments||{}).reduce((s,p)=>s+(Number.isSafeInteger(p.amount)?p.amount:0),0);}
function outstanding(e){if(e.kind!=='match'||e.status==='cancelled')return 0;return (e.members||[]).reduce((s,id)=>s+(Object.prototype.hasOwnProperty.call(e.payments||{},id)?0:e.fee||0),0);}
function stats(e){const income=e.kind==='match'?received(e):0;const out=e.status==='settled'?(e.payout||0):0;return {income,out,net:e.status==='settled'?out-income:0,reserved:e.status==='planned'?(e.planned||0):0,held:e.status==='planned'?income:0,open:outstanding(e)};}
function summary(d,year){const f=sync(d),y=f.years[year]||{},entries=f.entries.filter(e=>String(e.date).slice(0,4)===String(year));const total={budget:y.budget||0,carry:y.carry||0,income:0,out:0,net:0,reserved:0,held:0,open:0,missing:0};for(const e of entries){const s=stats(e);for(const k of ['income','out','net','reserved','held','open'])total[k]+=s[k];if(e.status==='planned'&&!e.configured)total.missing++;}total.start=total.budget+total.carry;total.balance=total.start+total.income-total.out;total.free=total.balance-total.reserved-total.held;return total;}
function cancel(e){if(received(e)||e.status==='settled')throw Error('Deze post heeft al een betaling of afrekening. Corrigeer die eerst; afgelasten is alleen voor onbetaalde posten.');e.status='cancelled';}
function previewImport(d,rows){
  const f=sync(d),seen=new Set();return rows.map(row=>{
    const r=copy(row);if(!r.externalId||!r.title)throw Error('ID en omschrijving zijn verplicht.');
    const key=r.kind+':'+r.externalId;if(seen.has(key))throw Error('Dubbel ID in Excel: '+r.externalId);seen.add(key);
    r.date=date(r.date);
    if(r.kind==='match'&&!['solo','koppel','gescheiden_koppel','serie'].includes(r.form))throw Error('Onbekend wedstrijdtype bij '+r.title);
    if(r.kind==='match'&&r.form==='serie'&&(!r.series||!Number.isInteger(r.number)||r.number<1))throw Error('Vul serienaam en wedstrijdnummer in bij '+r.title);
    const existing=f.entries.find(e=>e.kind===r.kind&&e.externalId===r.externalId);
    const agenda=existing?(d.roosterItems||[]).find(a=>a.id===existing.agendaId):null;
    const fields=[['Datum',existing?.date,r.date],['Omschrijving',existing?.title,r.title],['Begroot',existing?.planned,r.planned]];
    if(r.kind==='match')fields.push(['Inleg per visser',existing?.fee,r.fee],['Type',agenda?.wedstrijdVorm,r.form],['Water',agenda?.water||'',r.water||''],['Locatie',agenda?.locatie||'',r.location||''],['Serienaam',agenda?.serieNaam||'',r.series||''],['Wedstrijdnummer',Number(agenda?.serieWedstrijdNummer)||0,r.number||0],['Verzamelen',agenda?.verzamelen||'',r.gather||''],['Starttijd',agenda?.starttijd||'',r.start||''],['Eindtijd',agenda?.eindtijd||'',r.end||'']);
    else fields.push(['Categorie',existing?.category||'',r.category||'Overig']);
    const changes=fields.filter(([,a,b])=>a!==b).map(([label,before,after])=>({label,before,after}));
    const blocked=!!existing&&(existing.status!=='planned'||!!received(existing)||!!existing.matchId);
    return {row:r,id:existing?.id,changes,action:existing?(changes.length?'update':'same'):'new',blocked};
  });
}
function applyImport(d,items){
  const next=copy(d);const f=sync(next);
  for(const item of items){
    const p=previewImport(next,[item.row])[0];if(p.blocked&&p.action==='update')throw Error('Deze post is al in gebruik. Wijzig hem rechtstreeks in de app.');if(p.action==='same')continue;
    const r=p.row;let e=p.id?f.entries.find(e=>e.id===p.id):null;
    if(!e){e={id:'fin-'+Math.random().toString(36).slice(2),kind:r.kind,status:'planned',payout:0,payments:{},members:[],attachments:[]};f.entries.push(e);}
    Object.assign(e,{externalId:r.externalId,date:r.date,title:r.title,planned:r.planned,configured:true,category:r.kind==='match'?'Wedstrijden':r.category||'Overig'});
    if(r.kind==='match'){
      e.fee=r.fee;let a=(next.roosterItems||[]).find(a=>a.id===e.agendaId);
      if(!a){a={id:'rooster-'+Math.random().toString(36).slice(2),type:'wedstrijd',zichtbaar:true};next.roosterItems.push(a);e.agendaId=a.id;}
      Object.assign(a,{datum:r.date,titel:r.title,wedstrijdVorm:r.form,water:r.water||'',locatie:r.location||'',serieNaam:r.series||'',serieWedstrijdNummer:r.number||'',verzamelen:r.gather||'',starttijd:r.start||'',eindtijd:r.end||''});
    }
  }return next;
}
const api={cents,date,normalize,sync,matchIds,matchEntry,received,outstanding,stats,summary,cancel,previewImport,applyImport};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FinanceCore=api;
})(typeof window!=='undefined'?window:this);
