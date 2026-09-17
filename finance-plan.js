/* Editable year plan: one worksheet, few mandatory fields, stable invisible links, all errors reported at once. */
(function(root){
'use strict';
const C=typeof module!=='undefined'&&module.exports?require('./finance-series.js'):root.FinanceCore;
const W=typeof module!=='undefined'&&module.exports?require('./finance-waters.js'):root.FinanceWaters;
const clone=x=>JSON.parse(JSON.stringify(x)), norm=x=>String(x??'').trim().toLocaleLowerCase('nl'), blank=x=>x===null||x===undefined||x==='';
const nameKey=s=>norm(s).replace(/[^a-z0-9]+/g,' ').trim();
const headers=['Vorm','Wedstrijdnaam / omschrijving','Serie','Datum','Einddatum','Viswater','Locatie loting','Lotingtijd','Starttijd','Eindtijd','Hengeltype','Begroot','Inleg','Inleg hele serie','Inleg hele serie AOW','_Koppeling'];
const keys=['form','title','series','date','endDate','water','location','gather','start','end','rod','planned','fee','seriesFee','seriesFeeAow','id'];
const aliases={'Wedstrijdvorm':'form','Inleg per wedstrijd':'fee','Soort':'soort'};
const forms={solo:'Individueel',koppel:'Koppel',gescheiden_koppel:'Gescheiden koppel',serie:'Serie',expense:'Overige uitgave'};
const compareKeys=['title','date','endDate','form','series','rod','water','location','gather','start','end','planned','fee','seriesFee','seriesFeeAow'];
const amountKeys=['planned','fee','seriesFee','seriesFeeAow'];
const yearOf=e=>String(e.date||e.year||'').slice(0,4);
const autoTitle=(series,n)=>series+' - wedstrijd '+n;
const derivedTitle=r=>r.form==='serie'?(r.water?r.series+' · '+r.water:''):(r.water?forms[r.form]+' '+r.water:'');
const hints={};
function matchForm(d,w){const comp=(d.competities||[]).find(c=>c.id===w.competitieId);return comp?.type==='serie'?'serie':w.gescheidenGroepId||w.wedstrijdType==='gescheiden_koppel'?'gescheiden_koppel':w.isKoppel?'koppel':'solo';}
function duplicates(d,year){d=clone(d);C.sync(d);const entries=d.finance.entries.filter(e=>e.kind==='match'&&yearOf(e)===String(year)&&e.status!=='cancelled'),out=[];for(const a of entries.filter(e=>e.agendaId&&!e.matchId)){const agenda=d.roosterItems.find(r=>r.id===a.agendaId);if(agenda?.gekoppeldeWedstrijdId)continue;for(const b of entries.filter(e=>e.matchId&&!e.agendaId&&e.date===a.date)){const key=a.id+'|'+b.id;if((d.finance.separatePairs||[]).includes(key))continue;const w=d.wedstrijden.find(w=>w.id===b.matchId);if(w)out.push({key,agendaId:a.id,resultId:b.id,date:a.date,agendaTitle:a.title,resultTitle:b.title,agendaForm:forms[agenda.wedstrijdVorm]||'Onbekend',resultForm:forms[matchForm(d,w)]});}}return out;}
function resolveDuplicate(d,year,key,choice){const next=clone(d);C.sync(next);const pair=duplicates(next,year).find(p=>p.key===key);if(!pair)throw Error('Dit paar is intussen gewijzigd. Controleer de lijst opnieuw.');if(choice==='separate'){next.finance.separatePairs=[...new Set([...(next.finance.separatePairs||[]),key])];return next;}if(!['agenda','result'].includes(choice))throw Error('Kies welke naam je wilt behouden.');
 const f=next.finance,a=f.entries.find(e=>e.id===pair.agendaId),b=f.entries.find(e=>e.id===pair.resultId),r=next.roosterItems.find(r=>r.id===a.agendaId),w=next.wedstrijden.find(w=>w.id===b.matchId),form=matchForm(next,w);
 if(a.seriesId!==b.seriesId&&(a.seriesId||b.seriesId))throw Error('Deze regels horen niet bij dezelfde serie. Controleer eerst de serie-indeling in de app.');
 if(a.configured&&b.configured&&(a.planned!==b.planned||a.fee!==b.fee))throw Error('Beide posten hebben verschillende financiële bedragen. Maak deze eerst gelijk in Financiën voordat je koppelt.');
 if((a.payout||a.status==='settled')&&(b.payout||b.status==='settled'))throw Error('Beide posten hebben een afrekening. Controleer deze eerst in Financiën.');
 for(const id of Object.keys(a.payments||{}))if(Object.hasOwn(b.payments||{},id))throw Error('Dezelfde visser heeft op beide posten een betaling. Controleer die eerst in Financiën.');
 if(choice==='agenda'&&r.wedstrijdVorm!==form)throw Error('De wedstrijdvorm verschilt van de bestaande uitslag. Kies de uitslag als basis om de deelnemersindeling te behouden.');
 // Store both original records for recovery; never discard receipts or results.
 f.linkHistory=f.linkHistory||[];f.linkHistory.push({date:new Date().toISOString(),agenda:clone(a),result:clone(b),roster:clone(r),match:clone(w)});
 if(!a.configured&&b.configured){a.planned=b.planned;a.fee=b.fee;a.configured=true;}
 a.payments={...a.payments,...b.payments};a.members=[...new Set([...a.members,...b.members])];a.attachments=[...a.attachments,...b.attachments];a.note=[a.note,b.note].filter(Boolean).join('\n');if(b.status==='settled'||b.payout){a.status=b.status;a.payout=b.payout;}
 a.matchId=b.matchId;r.gekoppeldeWedstrijdId=b.matchId;r.wedstrijdVorm=form;
 if(choice==='result'){r.titel=w.naam;for(const [rk,wk] of [['water','water'],['locatie','locatie'],['verzamelen','verzamelen'],['starttijd','starttijd'],['eindtijd','eindtijd'],['hengeltype','hengeltype'],['einddatum','einddatum']])if(w[wk])r[rk]=w[wk];}
 else if(!w.gescheidenGroepId)w.naam=r.titel;
 f.entries=f.entries.filter(e=>e.id!==b.id);C.sync(next);return next;
}
/* Current plan of a year as flat rows. Series amounts appear on the first match by date. */
function rows(d,year){
 d=clone(d);C.sync(d);
 const entries=d.finance.entries.filter(e=>e.kind!=='series'&&yearOf(e)===String(year)&&e.status!=='cancelled');
 const result=entries.map(e=>{const a=(d.roosterItems||[]).find(a=>a.id===e.agendaId)||{},w=(d.wedstrijden||[]).find(w=>w.id===e.matchId)||{},p=C.seriesFor(d,e);
 return {id:e.id,kind:e.kind,title:e.title||'',autoTitle:!!a.autoTitel,date:e.date||'',endDate:a.einddatum||'',form:e.kind==='expense'?'expense':p?'serie':a.wedstrijdVorm||matchForm(d,w),series:p?.title||'',rod:a.hengeltype||'',water:a.water||w.water||'',location:a.locatie||w.locatie||'',gather:a.verzamelen||'',start:a.starttijd||'',end:a.eindtijd||'',planned:e.configured?e.planned:null,fee:e.kind==='match'&&!p&&e.configured?e.fee:null,seriesFee:null,seriesFeeAow:null,year:Number(year)};});
 result.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||a.title.localeCompare(b.title));
 const seen=new Set();for(const r of result){if(r.form!=='serie'||r.kind!=='match')continue;const e=d.finance.entries.find(e=>e.id===r.id),p=C.seriesFor(d,e);r.planned=r.fee=null;if(!seen.has(p.id)){seen.add(p.id);r.planned=p.configured?p.planned:null;r.fee=p.configured?p.looseFee:null;r.seriesFee=p.configured?p.fee:null;r.seriesFeeAow=p.configured?(p.feeAow||0):null;}}
 return result;
}
/* Rows for the download: current plan, or a proposal copied from the previous year, plus club budget hints. */
function sheetRows(d,year){
 let data=rows(d,year),proposal=false;
 if(!data.some(r=>r.kind==='match')){const prev=rows(d,Number(year)-1).filter(r=>r.kind==='match'||r.kind==='expense');if(prev.length){proposal=true;data=prev.map(r=>({...r,id:'',date:'',endDate:'',year:Number(year)}));}}
 const list=hints[year]||[];const used=new Set();const free=r=>!used.has(r);
 // Series amounts live on the first row of each series (rows() convention).
 const seriesFirst=[];for(const r of data)if(r.form==='serie'&&!seriesFirst.some(x=>nameKey(x.series)===nameKey(r.series)))seriesFirst.push(r);
 const similar=(a,b)=>a===b||(a.length>=5&&b.length>=5&&(a.includes(b)||b.includes(a)));
 const candidates=(h)=>{const k=nameKey(h.title);if(h.water&&h.form&&h.form!=='serie'&&h.form!=='expense'){const byWater=data.filter(r=>free(r)&&r.kind==='match'&&r.form===h.form&&nameKey(r.water)===nameKey(h.water)).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));if(byWater.length)return byWater[0];}
  if(h.form==='serie'){const pool=seriesFirst.filter(free);return pool.find(r=>nameKey(r.series)===k)||pool.find(r=>similar(nameKey(r.series),k));}
  const pool=data.filter(r=>free(r)&&r.form!=='serie'&&(h.form==='expense'?r.kind==='expense':r.kind==='match'));return pool.find(r=>nameKey(r.title)===k)||pool.find(r=>similar(nameKey(r.title),k));};
 const extra=[];
 for(const h of list){const r=candidates(h);if(r){used.add(r);if(r.planned===null){r.planned=h.planned;r.hinted=true;}continue;}
  extra.push({id:'',kind:h.form==='expense'?'expense':'match',title:h.form==='serie'||(h.water&&h.form)?'':h.title,series:h.form==='serie'?h.title:'',form:h.form||'',date:'',endDate:'',rod:'',water:h.water||'',location:'',gather:'',start:'',end:'',planned:h.planned,fee:null,seriesFee:null,seriesFeeAow:null,year:Number(year),hinted:true});}
 return {rows:[...data,...extra],proposal,hintBudget:list.budget||null};
}
function time(v){if(v instanceof Date)v=v.toISOString().slice(11,16);else if(typeof v==='number'){const m=Math.round((v%1)*1440);v=String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');}const s=String(v??'').trim();if(!/^([01]?\d|2[0-3])[:.][0-5]\d$/.test(s))throw Error('Gebruik een tijd zoals 08:30.');return s.replace('.',':').padStart(5,'0');}
function date(v){if(typeof v==='number')v=new Date(Math.round((v-25569)*86400000));return C.date(v);}
function cellValue(v){if(v&&typeof v==='object'&&!(v instanceof Date)){if('result' in v)return v.result;if(v.richText)return v.richText.map(t=>t.text).join('');if('text' in v)return v.text;throw Error('Gebruik ingevulde waarden, geen formules of gekoppelde cellen.');}return v;}
function readWaters(ws,errors){
 const out=[];if(!ws)return out;
 ws.eachRow((row,n)=>{if(n<2)return;const v=i=>{try{return cellValue(row.getCell(i).value);}catch(e){errors.push({line:n,sheet:'Viswateren',column:headers[5+i-1]||'',message:e.message});return null;}};const [name,location,gather,start,end]=[1,2,3,4,5].map(v);if([name,location,gather,start,end].every(blank))return;
  if(blank(name)){errors.push({line:n,sheet:'Viswateren',column:'Viswater',message:'Naam van het viswater ontbreekt.'});return;}
  const w={name:String(name).trim(),location:String(location??'').trim(),gather:'',start:'',end:''};
  for(const [k,val,col] of [['gather',gather,'Lotingtijd'],['start',start,'Starttijd'],['end',end,'Eindtijd']]){if(blank(val))continue;try{w[k]=time(val);}catch(e){errors.push({line:n,sheet:'Viswateren',column:col,message:e.message});}}
  if(out.some(x=>norm(x.name)===norm(w.name)))errors.push({line:n,sheet:'Viswateren',column:'Viswater',message:'Dit viswater staat er twee keer in.'});else out.push(w);});
 return out;
}
function read(wb){
 const ws=wb.getWorksheet('Jaarplanning');if(!ws)throw Error('Gebruik de download uit de app: het blad Jaarplanning ontbreekt.');
 const year=Number(cellValue(ws.getCell('B2').value));if(!Number.isInteger(year)||year<2000||year>2100)throw Error('Vul bovenaan een geldig jaar in (2000–2100).');
 const errors=[],warnings=[];const fail=(line,column,message)=>errors.push({line,sheet:'Jaarplanning',column,message});
 let budget=null,carry=null;for(const [cell,label,set] of [['D2','Jaarbudget',v=>budget=v],['F2','Meegenomen uit vorig jaar',v=>carry=v]]){const v=cellValue(ws.getCell(cell).value);if(blank(v))continue;try{set(C.cents(v));}catch(e){fail(2,label,e.message);}}
 const cols={};ws.getRow(7).eachCell((c,i)=>{const label=String(c.text||'').trim(),key=aliases[label]||keys[headers.indexOf(label)];if(!key)return;if(cols[key])throw Error('Dubbele kolom: '+label);cols[key]=i;});
 for(const k of ['form','title','date','planned'])if(!cols[k])throw Error('Kolom ontbreekt: '+headers[keys.indexOf(k)]+'. Gebruik de download uit de app.');
 const label=k=>headers[keys.indexOf(k)]||k;
 const result=[];
 ws.eachRow((row,n)=>{if(n<8)return;const raw={};let bad=false;for(const k of [...keys,'soort']){if(!cols[k]){raw[k]=null;continue;}try{raw[k]=cellValue(row.getCell(cols[k]).value);}catch(e){fail(n,label(k),e.message);raw[k]=null;bad=true;}}
  if(keys.filter(k=>k!=='id').every(k=>blank(raw[k]))&&blank(raw.soort))return;
  let form=Object.keys(forms).find(k=>norm(forms[k])===norm(raw.form))||'';if(norm(raw.soort)==='overige uitgave')form='expense';
  if(!form){if(blank(raw.form)){warnings.push('Rij '+n+' ('+String(raw.title||raw.series||'zonder naam').trim()+') is overgeslagen: kies eerst een vorm.');return;}fail(n,'Vorm','Kies Individueel, Koppel, Gescheiden koppel, Serie of Overige uitgave.');return;}
  const kind=form==='expense'?'expense':'match';
  const r={id:String(raw.id||'').trim(),kind,form,title:String(raw.title??'').trim(),series:String(raw.series??'').trim(),date:'',endDate:'',water:String(raw.water??'').trim(),location:String(raw.location??'').trim(),gather:'',start:'',end:'',rod:'',planned:null,fee:null,seriesFee:null,seriesFeeAow:null,year,line:n,autoTitle:false};
  for(const [k,col] of [['date','Datum'],['endDate','Einddatum']]){if(blank(raw[k]))continue;try{r[k]=date(raw[k]);}catch(e){fail(n,col,e.message);}}
  for(const k of ['gather','start','end']){if(blank(raw[k]))continue;try{r[k]=time(raw[k]);}catch(e){fail(n,label(k),e.message);}}
  for(const k of amountKeys){if(blank(raw[k]))continue;try{r[k]=C.cents(raw[k]);}catch(e){fail(n,label(k),e.message);}}
  if(!blank(raw.rod)){const rod=norm(raw.rod);if(!['vaste stok','vrij'].includes(rod))fail(n,'Hengeltype','Kies Vaste stok of Vrij, of laat leeg.');else r.rod=rod==='vrij'?'Vrij':'Vaste stok';}
  if(r.date&&yearOf(r)!==String(year))fail(n,'Datum','Datum valt buiten het jaar bovenaan ('+year+').');
  if(kind==='expense'){if(!r.title)fail(n,label('title'),'Omschrijving ontbreekt.');if(['series','endDate','water','location','gather','start','end','rod'].some(k=>!blank(raw[k]))||r.fee!==null||r.seriesFee!==null||r.seriesFeeAow!==null)fail(n,'Vorm','Vul bij een overige uitgave alleen omschrijving, eventuele datum en Begroot in.');}
  else{
   if(!r.title&&!r.series&&!r.water)fail(n,label('title'),'Vul een wedstrijdnaam of een viswater in (de app maakt dan zelf een naam, bijvoorbeeld “Koppel Spui”).');
   if(form==='serie'&&!r.series)fail(n,'Serie','Serienaam ontbreekt.');
   if(form!=='serie'&&r.series)fail(n,'Serie','Kies vorm Serie bij een serienaam, of maak de kolom Serie leeg.');
   if(form!=='serie'&&(r.seriesFee!==null||r.seriesFeeAow!==null))fail(n,'Inleg hele serie','Serie-inleg hoort alleen bij vorm Serie.');
   if(r.gather&&r.start&&r.gather>r.start)fail(n,'Lotingtijd','Loting moet uiterlijk bij de start plaatsvinden.');
   if(r.start&&r.end&&r.date&&(r.endDate||r.date)+'T'+r.end<=r.date+'T'+r.start)fail(n,'Eindtijd','Einde moet na de start vallen; vul zo nodig Einddatum in.');
   if(r.endDate&&r.date&&r.endDate<r.date)fail(n,'Einddatum','Einddatum ligt vóór de datum.');
   if(!r.title){r.autoTitle=true;r.title=derivedTitle(r);}
  }
  result.push(r);
 });
 // Series: 3–6 matches, unique dates, one set of amounts anywhere in the series.
 const groups=new Map();for(const r of result.filter(r=>r.form==='serie')){const k=norm(r.series);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
 for(const group of groups.values()){
  group.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||a.line-b.line);const first=group[0];
  if(group.every(r=>!r.date)){warnings.push('Serie '+first.series+' (rij '+group.map(r=>r.line).join(', ')+') is overgeslagen: vul eerst de wedstrijddatums in.');for(const r of group)result.splice(result.indexOf(r),1);continue;}
  if(group.length<3||group.length>6)fail(first.line,'Serie',first.series+': een serie heeft 3 tot 6 wedstrijden (nu '+group.length+').');
  const dates=group.map(r=>r.date).filter(Boolean);if(new Set(dates).size!==dates.length)fail(first.line,'Datum',first.series+': gebruik verschillende wedstrijddatums.');
  const amounts={};for(const k of amountKeys){const src=group.find(r=>r[k]!==null);amounts[k]=src?src[k]:null;for(const r of group)if(r[k]!==null&&r[k]!==amounts[k])fail(r.line,label(k),first.series+': '+label(k)+' is hier '+(r[k]/100).toFixed(2)+' maar op rij '+src.line+' '+(amounts[k]/100).toFixed(2)+'. Gebruik één bedrag voor de hele serie.');}
  group.forEach((r,i)=>{r.number=i+1;for(const k of amountKeys)r[k]=i===0?amounts[k]:null;if(r.autoTitle&&!r.title)r.title=autoTitle(r.series,r.number);});
 }
 const seen=new Map();for(const r of result){if(!r.date&&r.kind==='match')continue;const k=r.kind+'|'+norm(r.title)+'|'+r.date+(r.autoTitle?'|'+r.start:'');if(seen.has(k))fail(r.line,label('title'),'Dubbele post: '+r.title+(r.date?' op '+r.date:'')+' (ook op rij '+seen.get(k)+').'+(r.autoTitle?' Geef een van beide een eigen naam of een starttijd.':''));else seen.set(k,r.line);}
 const waters=readWaters(wb.getWorksheet('Viswateren'),errors);
 if(errors.length){const e=Error(errors.length===1?'Er is 1 fout in het bestand.':'Er zijn '+errors.length+' fouten in het bestand.');e.errors=errors;e.warnings=warnings;throw e;}
 if(!result.length)throw Error('Het bestand bevat nog geen ingevulde posten.');
 return {year,budget,carry,rows:result,waters,warnings};
}
function preview(d,plan,mapping={}){
 const dd=clone(d);C.sync(dd);for(const w of plan.waters||[])W.upsert(dd,w);
 const old=rows(dd,plan.year),used=new Set(),items=[];
 for(const src of plan.rows){let e;const r={...src};
  if(Object.hasOwn(mapping,r.line)){e=old.find(e=>e.id===mapping[r.line]);if(mapping[r.line]&&!e)throw Error('Ongeldige koppeling.');}
  else if(r.id){e=old.find(e=>e.id===r.id);if(!e)throw Error('Rij '+r.line+': de oorspronkelijke post bestaat niet meer in dit jaar. Maak de verborgen kolom _Koppeling leeg of download opnieuw uit deze app.');}
  else{let same=[];if(r.kind==='match'&&r.date){same=old.filter(e=>e.kind==='match'&&e.date===r.date&&e.form===r.form&&(r.form!=='serie'||norm(e.series)===norm(r.series))&&(!r.water||!e.water||norm(e.water)===norm(r.water)));if(same.length>1)same=same.filter(e=>norm(e.title)===norm(r.title)||(r.start&&e.start===r.start));}
   if(same.length===1)e=same[0];else{const exact=old.filter(e=>e.kind===r.kind&&norm(e.title)===norm(r.title)&&e.date===r.date);if(exact.length===1)e=exact[0];else{const sameName=old.filter(e=>e.kind===r.kind&&norm(e.title)===norm(r.title));if(sameName.length===1)e=sameName[0];}}}
  const explicit=Object.hasOwn(mapping,r.line)||!!r.id;
  // A budget line linked by hand to an existing match inherits what it left blank.
  if(e&&!r.id&&Object.hasOwn(mapping,r.line)){for(const k of ['date','endDate','series','rod','water','location','gather','start','end'])if(blank(r[k]))r[k]=e[k];if(!r.title||r.autoTitle){r.title=e.title;r.autoTitle=false;}if(e.kind==='match')r.form=e.form;}
  if(r.kind==='match')Object.assign(r,W.complete(dd,r));
  let error='';if(e&&used.has(e.id))error='Dezelfde bestaande post is tweemaal gekoppeld. Maak in Excel de verborgen kolom _Koppeling leeg bij gekopieerde rijen.';else if(e&&e.kind!==r.kind)error='Soort wijzigen bij een bestaande post kan niet.';else if(r.kind==='match'&&!r.date)error='Datum ontbreekt. Vul een datum in of koppel deze regel aan een bestaande wedstrijd.';
  if(e&&!error)used.add(e.id);
  const cmp=r.kind==='expense'?['title','date','planned']:compareKeys;
  const changes=cmp.filter(k=>(e?.[k]??'')!==(r[k]??'')).map(k=>({key:k,before:e?.[k],after:r[k]}));
  items.push({row:r,id:error?undefined:e?.id,action:error?'error':e?(changes.length?'update':'same'):'new',changes,explicit,error});
 }
 const missing=old.filter(e=>!used.has(e.id));for(const item of items)if(!item.id&&!item.explicit)item.candidates=missing.filter(e=>e.kind===item.row.kind);
 const y=dd.finance.years[plan.year]||{};const budget=[];if(plan.budget!==null&&plan.budget!==(y.budget||0))budget.push({key:'budget',label:'Jaarbudget',before:y.budget||0,after:plan.budget});if(plan.carry!==null&&plan.carry!==(y.carry||0))budget.push({key:'carry',label:'Meegenomen uit vorig jaar',before:y.carry||0,after:plan.carry});
 const waters=(plan.waters||[]).map(w=>{const cur=W.find(d,w.name);const changed=!cur||W.fields.some(f=>(cur[f]||'')!==(w[f]||''));return {...w,action:!cur?'new':changed?'update':'same'};});
 return {year:plan.year,plan,mapping,items,missing,budget,waters,warnings:plan.warnings||[]};
}
function apply(d,p,selected,remove=[]){
 const next=clone(d);C.sync(next);next.roosterItems=next.roosterItems||[];
 const chosen=p.items.filter(i=>selected.includes(i.row.line));
 const broken=chosen.filter(i=>i.error);if(broken.length)throw Error('Los eerst op: '+broken.map(i=>'rij '+i.row.line+' ('+i.error+')').join('; '));
 if(chosen.some(i=>i.candidates?.length))throw Error('Kies voor de niet herkende rijen of ze nieuw zijn of bij een bestaande post horen.');
 // A series is one budget: all changed rows in a series are committed together.
 for(const i of chosen.filter(i=>i.row.form==='serie'))if(p.items.some(j=>norm(j.row.series)===norm(i.row.series)&&j.action!=='same'&&!selected.includes(j.row.line)))throw Error('Selecteer alle wijzigingen van serie '+i.row.series+' samen.');
 const id=()=> 'plan-'+Math.random().toString(36).slice(2)+Date.now().toString(36);
 const parents=new Map();
 const renames=new Map();for(const i of chosen){const e=next.finance.entries.find(e=>e.id===i.id),parent=C.seriesFor(next,e);if(!parent||parent.kind!=='series'||norm(parent.title)===norm(i.row.series))continue;if(i.row.form!=='serie')throw Error('Een bestaande seriewedstrijd kan niet via Excel uit de serie worden gehaald.');if(renames.has(parent.id)&&renames.get(parent.id)!==i.row.series)throw Error('Gebruik één nieuwe naam voor de hele serie.');renames.set(parent.id,i.row.series);}
 for(const [pid,name] of renames){const parent=next.finance.entries.find(e=>e.id===pid),children=next.finance.entries.filter(e=>e.seriesId===pid&&e.status!=='cancelled');if(children.some(e=>!chosen.some(i=>i.id===e.id&&norm(i.row.series)===norm(name))))throw Error('Wijzig de serienaam bij alle wedstrijden van de serie samen.');if(next.finance.entries.some(e=>e.kind==='series'&&e.id!==pid&&yearOf(e)===String(p.year)&&norm(e.title)===norm(name)))throw Error('Er bestaat al een andere serie met deze naam.');parent.title=name;parent.seriesKey=p.year+':'+norm(name);for(const e of next.finance.entries.filter(e=>e.seriesId===pid)){const a=next.roosterItems.find(a=>a.id===e.agendaId);if(a)a.serieNaam=name;const w=(next.wedstrijden||[]).find(w=>w.id===e.matchId),comp=(next.competities||[]).find(c=>c.id===w?.competitieId);if(comp&&comp.type==='serie')comp.naam=name;}}
 for(const i of chosen){const r=i.row;let e=next.finance.entries.find(e=>e.id===i.id);if(e?.kind==='match'){const a=next.roosterItems.find(a=>a.id===e.agendaId);if((e.seriesId&&norm(C.seriesFor(next,e)?.title)!==norm(r.series))||(!e.seriesId&&r.form==='serie'&&(e.matchId||C.received(e))))throw Error('Wijzig de serie-indeling van een bestaande wedstrijd in de app.');if(e.matchId&&a?.wedstrijdVorm!==r.form)throw Error('Wijzig de wedstrijdvorm van een gestarte wedstrijd in de app.');}
  if(!e){e={id:id(),kind:r.kind,status:'planned',payout:0,payments:{},members:[],attachments:[]};next.finance.entries.push(e);}
  Object.assign(e,{title:r.title,date:r.date,year:r.year});
  if(r.kind==='expense'){e.planned=r.planned??0;e.configured=r.planned!==null;e.category=e.category||'Overig';continue;}
  let a=next.roosterItems.find(a=>a.id===e.agendaId);if(!a){a={id:id(),type:'wedstrijd',zichtbaar:true};next.roosterItems.push(a);e.agendaId=a.id;}
  Object.assign(a,{titel:r.title,autoTitel:!!r.autoTitle,datum:r.date,einddatum:r.endDate,wedstrijdVorm:r.form,serieNaam:r.form==='serie'?r.series:'',serieWedstrijdNummer:r.number||'',hengeltype:r.rod,water:r.water,locatie:r.location,verzamelen:r.gather,starttijd:r.start,eindtijd:r.end});
  if(r.form==='serie'){if(r.number===1)parents.set(norm(r.series),r);}else{e.planned=r.planned??0;e.fee=r.fee??0;e.configured=r.planned!==null;e.feeBasis=['koppel','gescheiden_koppel'].includes(r.form)?'koppel':'person';}
  for(const w of (next.wedstrijden||[]).filter(w=>C.matchIds(next,e.matchId).includes(w.id)))Object.assign(w,{naam:r.title,datum:r.date,water:r.water,locatie:r.location,hengeltype:r.rod,einddatum:r.endDate,verzamelen:r.gather,starttijd:r.start,eindtijd:r.end});
 }
 C.sync(next);for(const [name,r] of parents){const parent=next.finance.entries.find(e=>e.kind==='series'&&yearOf(e)===String(p.year)&&norm(e.title)===name);if(!parent)continue;Object.assign(parent,{planned:r.planned??0,fee:r.seriesFee??0,looseFee:r.fee??0,feeAow:r.seriesFeeAow??0,configured:r.planned!==null,migrationNotice:false});}
 for(const rid of remove){if(!p.missing.some(e=>e.id===rid))throw Error('Ongeldige ontbrekende post.');const e=next.finance.entries.find(e=>e.id===rid);if(e.matchId&&(next.uitslagen||[]).some(u=>C.matchIds(next,e.matchId).includes(u.wedstrijdId)))throw Error(e.title+': er zijn al uitslagen; behoud deze post.');C.cancel(e);const a=next.roosterItems.find(a=>a.id===e.agendaId);if(a)a.zichtbaar=false;}
 for(const parent of next.finance.entries.filter(e=>e.kind==='series'&&yearOf(e)===String(p.year))){const children=next.finance.entries.filter(e=>e.seriesId===parent.id);if(children.length&&children.every(e=>e.status==='cancelled'))C.cancel(parent);}
 for(const w of p.waters||[])W.upsert(next,w);
 if(p.budget.length){const y=next.finance.years[p.year]||{budget:0,carry:0};for(const b of p.budget)y[b.key]=b.after;y.configured=true;next.finance.years[p.year]=y;}
 C.sync(next);return next;
}
async function workbook(ExcelJS,d,year){
 const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('Jaarplanning'),data=sheetRows(d,year),y=(d.finance?.years||{})[year]||{},waters=W.list(clone(d));
 const dark={argb:'FF203B43'},euro='€ #,##0.00';
 ws.getCell('A1').value='HSV Groot Hoeksche Waard · Jaarplanning';ws.mergeCells('A1:F1');ws.getCell('A1').font={bold:true,size:16,color:dark};ws.getRow(1).height=32;
 ws.getCell('A2').value='Jaar:';ws.getCell('B2').value=Number(year);ws.getCell('C2').value='Jaarbudget:';ws.getCell('D2').value=y.budget?y.budget/100:data.hintBudget?data.hintBudget/100:null;ws.getCell('E2').value='Meegenomen uit vorig jaar:';ws.getCell('F2').value=y.carry?y.carry/100:null;for(const c of ['A2','C2','E2'])ws.getCell(c).font={bold:true};for(const c of ['D2','F2'])ws.getCell(c).numFmt=euro;ws.getCell('B2').alignment={horizontal:'left'};
 const notes=[
  'Verplicht per regel: Vorm, Datum en Viswater of Naam. Laat je de naam leeg, dan maakt de app hem uit vorm en water (“Koppel Spui”; bij een serie “Winterserie · Spui”). Alles anders mag leeg en staat dan in de app als “nog invullen”.',
  'Serie: elke wedstrijd één regel met eigen water en lotingplek. Begroot en de inleg-tarieven vul je op één willekeurige regel van de serie in. Inleg = per persoon; bij Koppel en Gescheiden koppel per koppel.',
  (data.proposal?'Dit is een voorstel op basis van vorig jaar: vul de datums in en pas bedragen aan. ':'')+'Lege lotingplek en tijden worden bij upload aangevuld uit het blad Viswateren. Regels zonder Vorm worden overgeslagen. Datums dd-mm-jjjj, tijden uu:mm.'];
 notes.forEach((text,i)=>{const n=3+i;ws.mergeCells(n,1,n,15);ws.getCell(n,1).value=text;ws.getCell(n,1).alignment={wrapText:true,vertical:'top'};ws.getRow(n).height=30;});
 ws.getRow(7).values=headers;ws.getRow(7).font={bold:true,color:{argb:'FFFFFFFF'}};ws.getRow(7).fill={type:'pattern',pattern:'solid',fgColor:dark};ws.getRow(7).height=32;ws.getRow(7).alignment={vertical:'middle',wrapText:true};
 const widths=[20,34,22,14,14,26,26,12,12,12,14,14,14,18,20,24];widths.forEach((w,i)=>ws.getColumn(i+1).width=w);ws.getColumn(16).hidden=true;ws.views=[{state:'frozen',ySplit:7,xSplit:2}];
 for(const r of data.rows){const m=r.kind==='match';ws.addRow([forms[r.form]||'',r.autoTitle?'':r.title,m?r.series:null,r.date?new Date(r.date+'T00:00:00Z'):null,m&&r.endDate?new Date(r.endDate+'T00:00:00Z'):null,m?r.water:null,m?r.location:null,m?r.gather:null,m?r.start:null,m?r.end:null,m?r.rod:null,r.planned===null?null:r.planned/100,m&&r.fee!==null?r.fee/100:null,m&&r.seriesFee!==null?r.seriesFee/100:null,m&&r.seriesFeeAow!==null?r.seriesFeeAow/100:null,r.id]);}
 const end=Math.max(107,7+data.rows.length+20),waterRange='Viswateren!$A$2:$A$'+Math.max(2,waters.length+21);
 for(let n=8;n<=end;n++){const row=ws.getRow(n),r=data.rows[n-8];for(let c=1;c<=15;c++){const cell=ws.getCell(n,c);cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:n%2?'FFF0F6F4':'FFFFFFFF'}};cell.alignment={vertical:'middle'};if(c===4||c===5)cell.numFmt='dd-mm-yyyy';if(c>=12)cell.numFmt=euro;}
  if(r&&(r.hinted||r.proposal||!r.id))for(let c=1;c<=15;c++)ws.getCell(n,c).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF4D6'}};row.height=22;
  ws.getCell(n,1).dataValidation={type:'list',allowBlank:true,formulae:['"Individueel,Koppel,Gescheiden koppel,Serie,Overige uitgave"'],showErrorMessage:true,error:'Kies een waarde uit de lijst.'};
  ws.getCell(n,11).dataValidation={type:'list',allowBlank:true,formulae:['"Vaste stok,Vrij"'],showErrorMessage:true,error:'Kies Vaste stok of Vrij.'};
  ws.getCell(n,6).dataValidation={type:'list',allowBlank:true,formulae:[waterRange],showErrorMessage:false};}
 ws.autoFilter={from:'A7',to:'P'+end};
 const wsW=wb.addWorksheet('Viswateren');wsW.getRow(1).values=['Viswater','Locatie loting','Lotingtijd','Starttijd','Eindtijd'];wsW.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};wsW.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:dark};wsW.getRow(1).height=28;[28,30,12,12,12].forEach((w,i)=>wsW.getColumn(i+1).width=w);wsW.views=[{state:'frozen',ySplit:1}];
 for(const w of waters)wsW.addRow([w.name,w.location,w.gather,w.start,w.end]);
 for(let n=2;n<=waters.length+21;n++)for(let c=1;c<=5;c++){wsW.getCell(n,c).fill={type:'pattern',pattern:'solid',fgColor:{argb:n%2?'FFF0F6F4':'FFFFFFFF'}};}
 wsW.getCell('G1').value='Per viswater één lotingplek en vaste tijden. Deze tabel wordt bij upload overgenomen in de app; een afwijkende waarde op een wedstrijdregel wint voor die wedstrijd.';wsW.getCell('G1').alignment={wrapText:true,vertical:'top'};wsW.getColumn(7).width=60;
 return wb;
}
const api={duplicates,resolveDuplicate,headers,forms,rows,sheetRows,read,preview,apply,workbook,yearOf,hints};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FinancePlan=api;
})(typeof window!=='undefined'?window:this);
