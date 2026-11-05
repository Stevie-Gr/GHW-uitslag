/* Finance UI for the trusted-device edition of HSV GHW. */
(function(){
'use strict';
const C=FinanceCore;
/* Admin page Financiën (begroting, jaarplanning, ...) is hidden on request; set to true to bring it back. The series tab does not depend on it. */
const ADMIN_FINANCE_VISIBLE=false;
const state={year:new Date().getFullYear(),detail:null,view:'overview',preview:null,importErrors:null};
const money=n=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format((n||0)/100);
const E=escapeHtml, A=escapeHtmlAttr;
const euroInput=n=>((n||0)/100).toFixed(2);
const byId=id=>document.getElementById(id);
const read=id=>byId(id)?.value??'';
const button=(label,action,extra='',cls='btn btn-gh')=>`<button type="button" class="${cls}" data-fin="${action}" ${extra}>${label}</button>`;
const input=(id,label,value='',type='text',extra='')=>`<label class="fin-field"><span>${label}</span><input id="${id}" type="${type}" value="${A(value)}" ${extra}></label>`;
const amount=(id,label,value=0)=>input(id,label,euroInput(value),'number','min="0" max="10000000" step="0.01" inputmode="decimal" required');
function profile(){return isAdmin&&currentAdmin?currentAdmin:null;}
function access(){const a=profile();return a?.rol==='hoofd'?'write':a?.financeAccess||'none';}
function allowed(edit=false){return edit?access()==='write':['read','write'].includes(access());}
function requireAccess(edit=false){if(!allowed(edit))throw Error(edit?'Je hebt geen financiële bewerkrechten.':'Je hebt geen toegang tot de financiële administratie.');}
function onlyFinance(){return ADMIN_FINANCE_VISIBLE&&!!profile()?.financeOnly;}
function currentEntry(d){return d.finance.entries.find(e=>e.id===state.detail);}
function save(d){requireAccess(true);saveData(d);}
function noticeError(err){showAppNotice(err.message||String(err),'warn',6500);}
const oldNormalize=ensureAdminData;
ensureAdminData=function(d){const permissions=new Map((d.admins||[]).map(a=>[a.id,{financeAccess:a.financeAccess,financeOnly:a.financeOnly}]));const out=oldNormalize(d);for(const a of out.admins){const p=permissions.get(a.id)||{};a.financeAccess=['none','read','write'].includes(p.financeAccess)?p.financeAccess:'none';a.financeOnly=p.financeOnly===true&&a.rol!=='hoofd';}C.sync(out);return out;};
const oldSave=saveData;
saveData=function(d){try{return oldSave(d);}catch(e){if(e.name==='QuotaExceededError')showAppNotice('Opslaan mislukt: de browseropslag is vol. Maak een back-up en verklein of verwijder bijlagen.','warn',10000);throw e;}};
const page=document.createElement('div');page.className='pv';page.id='pv-finance';byId('pv-admin-home').parentNode.appendChild(page);
const navButton=document.createElement('button');navButton.id='nav-finance';navButton.className='sb-btn';navButton.textContent='Financiën';navButton.style.display='none';navButton.onclick=()=>nav('finance');byId('admin-nav').after(navButton);
titles.finance='Financiën';ADMIN_PAGES.push('finance');
const oldNav=nav;
nav=function(p,...args){if(p==='finance'&&!ADMIN_FINANCE_VISIBLE)return;if(p==='finance'&&!allowed()){if(!isAdmin)openPin();else showAppNotice('Geen toegang tot financiën.','warn');return;}if(onlyFinance()&&ADMIN_PAGES.includes(p)&&!['finance','admin-home'].includes(p)){showAppNotice('Dit account heeft alleen financiële toegang.','warn');return;}if(p==='backup'&&!isHoofdAdmin()){showAppNotice('Volledige back-ups zijn alleen voor de hoofdbeheerder.','warn');return;}oldNav(p,...args);if(p==='finance')render();};
const oldAdminUi=updateAdminUi;
updateAdminUi=function(){oldAdminUi();navButton.style.display=ADMIN_FINANCE_VISIBLE&&allowed()?'flex':'none';if(onlyFinance())byId('admin-nav').style.display='none';byId('nav-backup').style.display=isHoofdAdmin()?'flex':'none';if(!allowed()){page.innerHTML='';document.querySelectorAll('.fin-pay-panel').forEach(el=>el.remove());}};
const oldHome=renderAdminHome;
renderAdminHome=function(){if(!ADMIN_FINANCE_VISIBLE)return oldHome();if(onlyFinance()){byId('admin-home-content').innerHTML=`<div class="card"><div class="stitle">Welkom ${E(currentAdmin.naam)}</div><p>Jouw toegang: ${access()==='write'?'begroting bekijken en bewerken':'begroting bekijken'}.</p>${button('Open financiën','open','','btn btn-g')}</div>`;return;}oldHome();const today=todayMatches(getData());byId('admin-home-content').insertAdjacentHTML('afterbegin',`<div class="card fin-home"><div><div class="stitle">Wedstrijd van vandaag</div><div class="sub">${today.length?E(today.map(m=>m.title).join(' · ')):'Vandaag staat er geen wedstrijd in de agenda.'}</div></div>${today.length?button(today.length>1?'Kies wedstrijd':'Naar de invoer','today','','btn btn-g'):''}</div><div id="fin-today-list" class="fin-toolbar"></div>`+(allowed()?`<div class="card fin-home"><div><div class="stitle">Financiën</div><div class="sub">Begroting, werkelijke kosten en wie nog moet betalen.</div></div>${button('Open financiën','open','','btn btn-g')}</div>`:''));};
const oldLogout=doLogout;
doLogout=function(){state.detail=null;state.preview=null;clearStore();oldLogout();page.innerHTML='';};
const oldAccounts=renderAdminGegevensPane;
renderAdminGegevensPane=function(){return oldAccounts()+(ADMIN_FINANCE_VISIBLE&&isHoofdAdmin()?permissionsHtml():'');};
function permissionsHtml(){return `<div class="card"><div class="stitle">Toegang tot financiën</div><p class="sub">Alleen hoofdadmins kunnen de financiën bekijken en bewerken. De financiën staan alleen in deze browser en gaan niet mee naar de online opslag; maak dus regelmatig een backup.</p></div>`;}
const formLabel={solo:'Individueel',koppel:'Koppel',gescheiden_koppel:'Gescheiden koppel',serie:'Serie'};
const nameOf=(d,id)=>{const v=(d.vissers||[]).find(v=>v.id===id);return v?vNaam(v):'Verwijderde visser';};
const unitLabel=(d,u)=>u.members.map(id=>nameOf(d,id)).join(' & ');
const yearEntries=d=>d.finance.entries.filter(e=>String(e.date||e.year).slice(0,4)===String(state.year));
function agendaOf(d,e){const a=(d.roosterItems||[]).find(a=>a.id===e.agendaId)||{},w=(d.wedstrijden||[]).find(w=>w.id===e.matchId)||{};return {form:a.wedstrijdVorm||(w.gescheidenGroepId?'gescheiden_koppel':w.isKoppel?'koppel':'solo'),water:a.water||w.water||'',location:a.locatie||w.locatie||'',gather:a.verzamelen||'',start:a.starttijd||'',end:a.eindtijd||'',rod:a.hengeltype||'',endDate:a.einddatum||''};}
function agendaLine(d,e){if(e.kind!=='match')return e.kind==='series'?'Serie':'Overige uitgave';const a=agendaOf(d,e),p=C.seriesFor(d,e);return [p?'Serie '+p.title:formLabel[a.form],a.water,a.location,[a.gather,a.start,a.end].filter(Boolean).join(' / '),a.rod].filter(Boolean).join(' · ');}
function actualOf(e){return C.spent(getData(),e);}
function overview(){
 const d=getData(),s=C.summary(d,state.year),write=allowed(true),items=C.open(d,state.year);
 const list=yearEntries(d).filter(e=>!e.seriesId&&e.status!=='cancelled').sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||a.title.localeCompare(b.title));
 const openFor=e=>items.filter(i=>i.entryId===e.id||(e.kind==='series'&&d.finance.entries.some(c=>c.seriesId===e.id&&c.id===i.entryId)));
 return `<div class="fin-heading"><div><span class="fin-eyebrow">CONCOURSBEGROTING</span><h1>Begroting ${state.year}</h1></div><label class="fin-year">Kalenderjaar<input id="fin-year" type="number" min="2000" max="2100" value="${state.year}" data-fin-change="year"></label></div>
 <div class="card fin-result ${s.over<0?'fin-negative':'fin-available'}"><div class="fin-result-head"><span class="fin-eyebrow">RESULTAAT ${state.year}</span><strong>${s.over<0?'− ':'+ '}${money(Math.abs(s.over))}</strong><small>${s.over<0?'tekort':'over'} · heel jaar, alles wat nog komt telt als begroot</small></div><table class="fin-staat"><tbody><tr><td>+</td><td>Begroting vereniging</td><td>${money(s.budget+s.carry)}</td></tr>${s.extras?`<tr><td>+</td><td>Extra bijdrage</td><td>${money(s.extras)}</td></tr>`:''}<tr><td>+</td><td>Inleg vissers</td><td>${money(s.inleg)}</td></tr><tr><td>+</td><td>Losse inleg series (aparte pot)</td><td>${money(s.loose)}</td></tr><tr><td>−</td><td>Uitgaven · prijzengeld, losse pot en kosten</td><td>${money(s.spent)}</td></tr><tr class="fin-staat-total"><td>=</td><td>Resultaat ${state.year}</td><td>${money(s.over)}</td></tr></tbody></table><p class="fin-staat-foot">Begroot t/m vandaag <b>${money(s.plannedToDate)}</b> · heel jaar <b>${money(s.planned)}</b>${s.extras?'':' · '+'<a href="#" data-fin="budget">extra bijdrage toevoegen</a>'}</p></div>
 ${s.missing?`<div class="info">${s.missing} post(en) hebben nog geen begroot bedrag; die tellen nog niet mee.</div>`:''}${!s.start&&write?'<div class="info">Vul de begroting in via <b>Begroting instellen</b> of cel D2 van de jaarplanning.</div>':''}
 ${items.length?openCard(d,items,write):''}
 <div class="fin-toolbar">${write?button('Begroting instellen','budget')+button('+ Overige uitgave','new','','btn btn-g')+button('Jaarplanning downloaden','template')+button('Jaarplanning uploaden','import')+button('Viswateren','waters')+button('Dubbele wedstrijden','duplicates'):''}${isHoofdAdmin()?button('Back-up downloaden','backup')+button('Toegangsrechten','rights'):''}</div>
 <div class="card fin-ledger"><div class="fin-list-heading"><h2>Wedstrijden en uitgaven</h2><span>${list.length} posten</span></div><div class="fin-table-head"><span>Post / datum</span><span>Inleg</span><span>Begroot</span><span>Uitgegeven</span></div>${list.length?list.map(e=>{const o=openFor(e),act=actualOf(e);return `<button class="fin-row" data-fin="detail" data-id="${A(e.id)}"><span class="fin-post"><strong>${E(e.title)}</strong><small>${E(e.date?nlDatum(e.date):'Geen datum')} · ${E(agendaLine(d,e))}</small></span><span><small class="fin-mobile-label">Inleg</small>${e.kind==='expense'?'—':money(C.inleg(d,e))}${o.length?` <span class="fin-badge open">${o.length} open</span>`:''}</span><span><small class="fin-mobile-label">Begroot</small>${e.configured?money(e.planned):'<em>Nog invullen</em>'}</span><span><small class="fin-mobile-label">Uitgegeven</small>${e.configured?(e.actual!==null?'<b>'+money(act)+'</b>':money(act)):'—'}</span></button>`;}).join(''):'<div class="fin-empty">Nog geen posten. Upload een jaarplanning of voeg een uitgave toe.</div>'}</div>
 ${yearEntries(d).some(e=>e.status==='cancelled')?`<p class="fin-footnote">Vervallen posten worden niet getoond en tellen niet mee.</p>`:''}`;
}
function openCard(d,items,write){
 const money0=n=>money(n||0);const choices=new Map();for(const i of items.filter(i=>i.kind==='choice'))choices.set(i.entryId,(choices.get(i.entryId)||0)+1);
 const choiceRows=[...choices.entries()].map(([id,n])=>`<div class="fin-payment"><span><strong>${E(d.finance.entries.find(e=>e.id===id)?.title||'Serie')}</strong><small>${n} visser(s) nog <em>serie of los</em> kiezen</small></span>${button('Kiezen','detail',`data-id="${A(id)}"`)}</div>`).join('');
 const rows=choiceRows+items.filter(i=>i.kind!=='choice').map(i=>`<div class="fin-payment"><span><strong>${E(unitLabel(d,i.unit))}</strong><small>${E(i.title)}${i.date&&i.kind!=='series'?' · '+E(nlDatum(i.date)):''} · ${i.kind==='series'?'serietarief '+money0(i.amount):money0(i.amount)}</small></span>${write?button('Alsnog betaald','settle-open',`data-entry="${A(i.entryId)}" data-unit="${A(i.unit.id)}" data-kind="${i.kind}"`,'btn btn-g btn-sm'):''}</div>`).join('');
 const total=items.reduce((s,i)=>s+(i.amount||0),0);
 return `<div class="card fin-open"><div class="fin-list-heading"><h2>Nog niet betaald</h2><span>${items.filter(i=>i.kind!=='choice').length} · ${money(total)}</span></div>${rows}</div>`;
}
function budgetHtml(){const y=getData().finance.years[state.year]||{},extras=[...(y.extras||[]),{title:'',amount:0}];return `${back()}<div class="card"><h2>Begroting ${state.year}</h2><p class="sub">Het totaal dat de vereniging voor het concours beschikbaar stelt, eventueel plus wat uit het vorige jaar is overgebleven.</p><form id="fin-budget-form"><div class="fin-fields">${amount('fin-budget','Begroting',y.budget)}${amount('fin-carry','Meegenomen uit vorig jaar',y.carry)}</div><h3>Extra bijdragen</h3><p class="sub">Bijvoorbeeld een extra bijdrage van de vereniging of een sponsor. Een lege regel wordt overgeslagen.</p>${extras.map((x,i)=>`<div class="fin-fields fin-extra-row"><label class="fin-field"><span>Omschrijving</span><input data-extra-title value="${A(x.title)}" placeholder="Extra bijdrage vereniging"></label><label class="fin-field"><span>Bedrag</span><input data-extra-amount type="number" min="0" step="0.01" inputmode="decimal" value="${euroInput(x.amount)}"></label></div>`).join('')}<button class="btn btn-g">Opslaan</button></form></div>`;}
function back(){return button('← Begroting','back','', 'btn btn-gh fin-back');}
function amountsForm(e,write){const isSeries=e.kind==='series',isMatch=e.kind==='match';return `<form id="fin-entry-form"><fieldset ${write?'':'disabled'}><div class="fin-fields">${input('fin-title',isSeries?'Serienaam':'Omschrijving',e.title,'text','required')}${isMatch||e.kind==='expense'?input('fin-date','Datum',e.date,'date',isMatch?'required':''):''}${amount('fin-planned',isSeries?'Begroot · bijdrage hele serie':isMatch?'Begroot · bijdrage vereniging':'Begroot',e.planned)}${amount('fin-actual',isSeries||isMatch?'Uitbetaald prijzengeld (vooringevuld: prijzenpot)':'Uitgegeven (vooringevuld: begroot)',actualOf(e))}${isMatch&&!e.seriesId?amount('fin-fee','Inleg '+(e.feeBasis==='koppel'?'per koppel':'per persoon'),e.fee)+(agendaOf(getData(),e).form!=='solo'?`<label class="fin-field"><span>Inleg rekenen</span><select id="fin-fee-basis"><option value="koppel" ${e.feeBasis==='koppel'?'selected':''}>per koppel</option><option value="person" ${e.feeBasis!=='koppel'?'selected':''}>per persoon</option></select></label>`:''):''}${isSeries?amount('fin-series-loose','Inleg los',e.looseFee)+amount('fin-series-loose-aow','Inleg los · AOW',e.looseFeeAow||0)+amount('fin-series-fee','Inleg hele serie',e.fee)+amount('fin-series-aow','Inleg hele serie · AOW',e.feeAow||0)+amount('fin-loose-actual','Uitbetaald uit losse-inleg pot (vooringevuld: de pot)',C.looseSpent(getData(),e)):''}</div>${write?'<button class="btn btn-g" type="submit">Opslaan</button>':''}</fieldset></form>`;}
function participantsHtml(d,e,editable){
 const units=C.units(d,e),p=C.seriesFor(d,e);
 if(!units.length)return '<p class="sub">De deelnemers verschijnen zodra de uitslag is ingevoerd.</p>';
 return `<div class="fin-payment-list">${units.map(u=>{const vid=u.members[0],mode=p?p.enrollments[vid]||'':'',a=C.amount(d,e,u),unpaid=p&&mode==='loose'?!C.loosePaid(e,u):Object.prototype.hasOwnProperty.call(e.unpaid,u.id),aow=u.members.some(id=>C.isAow(d,id)),seriesPaid=p&&mode==='series'?Object.prototype.hasOwnProperty.call(p.seriesPaid,vid):false;
  const status=a===null?'<em class="fin-error-text">kies serie of los</em>':mode==='series'?(seriesPaid?'serie betaald':'serietarief '+money(C.seriesAmount(d,p,vid))+' <b>open</b>'):unpaid?money(a)+' <b>open</b>':a?money(a)+' betaald':'—';
  const controls=!editable?'':p?`<select data-fin-change="series-mode" data-id="${A(p.id)}" data-member="${A(vid)}" class="${mode?'':'fin-choose'}"><option value="">Kies…</option><option value="series" ${mode==='series'?'selected':''}>Serie</option><option value="loose" ${mode==='loose'?'selected':''}>Los</option></select>${mode==='series'?`<label><input type="checkbox" data-fin-change="series-paid" data-id="${A(p.id)}" data-member="${A(vid)}" ${seriesPaid?'checked':''}> Serie betaald</label>`:mode==='loose'?`<label><input type="checkbox" data-fin-change="loose-paid" data-id="${A(e.id)}" data-unit="${A(u.id)}" ${unpaid?'':'checked'}> Betaald</label>`:''}`:`<label><input type="checkbox" data-fin-change="unpaid" data-id="${A(e.id)}" data-unit="${A(u.id)}" ${unpaid?'checked':''}> Nog niet betaald</label>`;
  return `<div class="fin-payment fin-series-person"><span><strong>${E(unitLabel(d,u))}${aow?' <span class="fin-badge">AOW</span>':''}</strong><small>${status}</small></span>${controls}</div>`;}).join('')}</div>`;
}
function looseCard(d,p){const rows=C.looseIncome(d,p);if(!rows.length)return '';const total=rows.reduce((s,r)=>s+r.total,0);return `<div class="card"><div class="fin-list-heading"><h2>Losse inleg · aparte pot</h2><span>${money(total)}</span></div><p class="sub">Losse deelnemers betalen per wedstrijd en tellen pas mee als je ze afvinkt. Dit geld zit niet in de seriepot; je vult hieronder zelf in wat je eruit uitbetaalt.</p>${rows.map(r=>`<div class="fin-payment"><span><strong>${E(nameOf(d,r.vid))}</strong><small>${r.count} wedstrijd${r.count===1?'':'en'} los</small></span><span>${money(r.total)}</span></div>`).join('')}</div>`;}
function seriesMembersHtml(d,p,editable){const ids=[...new Set(p.members||[])].sort((a,b)=>nameOf(d,a).localeCompare(nameOf(d,b),'nl'));if(!ids.length)return '<p class="sub">Nog geen deelnemers; die verschijnen na de eerste uitslag.</p>';
 return `<div class="fin-payment-list">${ids.map(vid=>{const mode=p.enrollments[vid]||'',paid=Object.prototype.hasOwnProperty.call(p.seriesPaid,vid),aow=C.isAow(d,vid);const status=!mode?'<em class="fin-error-text">kies serie of los</em>':mode==='series'?(paid?'serie betaald':'serietarief '+money(C.seriesAmount(d,p,vid))+' <b>open</b>'):'los · per wedstrijd';
  const controls=!editable?'':`<select data-fin-change="series-mode" data-id="${A(p.id)}" data-member="${A(vid)}" class="${mode?'':'fin-choose'}"><option value="">Kies…</option><option value="series" ${mode==='series'?'selected':''}>Serie</option><option value="loose" ${mode==='loose'?'selected':''}>Los</option></select>${mode==='series'?`<label><input type="checkbox" data-fin-change="series-paid" data-id="${A(p.id)}" data-member="${A(vid)}" ${paid?'checked':''}> Serie betaald</label>`:''}`;
  return `<div class="fin-payment fin-series-person"><span><strong>${E(nameOf(d,vid))}${aow?' <span class="fin-badge">AOW</span>':''}</strong><small>${status}</small></span>${controls}</div>`;}).join('')}</div>`;}
function moneyLine(d,e){if(e.kind==='expense'||!e.configured)return '';const i=C.inleg(d,e),p=C.pot(d,e),sp=C.spent(d,e);return `<div class="fin-summary fin-summary-small"><div><span>Inleg</span><strong>${money(i)}</strong></div><div><span>Begroot</span><strong>${money(e.planned)}</strong></div><div><span>Prijzenpot</span><strong>${money(p)}</strong></div><div><span>Uitbetaald</span><strong>${money(sp)}</strong></div><div class="${p-sp<0?'fin-negative':'fin-available'}"><span>Verschil</span><strong>${money(p-sp)}</strong></div></div>`;}
function detailHtml(){
 const d=getData(),e=currentEntry(d);if(!e){state.view='overview';return overview();}const write=allowed(true);
 if(e.kind==='series'){const children=d.finance.entries.filter(c=>c.seriesId===e.id).sort((a,b)=>a.date.localeCompare(b.date));return `${back()}<div class="card"><span class="fin-eyebrow">SERIE</span><h1>${E(e.title)}</h1>${moneyLine(d,e)}${amountsForm(e,write)}</div><div class="card"><div class="fin-list-heading"><h2>Deelnemers</h2><span>${e.members.length}</span></div><p class="sub">Kies per visser serie of los. Een seriedeelnemer staat open tot je <b>Serie betaald</b> aanvinkt; losse deelnemers markeer je per wedstrijd.</p>${seriesMembersHtml(d,e,write)}</div>${looseCard(d,e)}<div class="card"><h2>Wedstrijden</h2>${children.map(c=>`<div class="fin-payment"><span><strong>${E(c.title)}</strong><small>${E(nlDatum(c.date))} · ${E(agendaLine(d,c).replace(/^Serie [^·]*·\s*/,''))}</small></span>${button('Openen','detail',`data-id="${A(c.id)}"`)}</div>`).join('')||'<p class="sub">Nog geen wedstrijden in deze serie.</p>'}</div>${write&&e.status==='planned'?`<div class="fin-toolbar">${button('Serie laten vervallen','cancel')}</div>`:''}`;}
 const p=C.seriesFor(d,e),a=e.kind==='match'?agendaOf(d,e):null;
 return `${p?button('← '+E(p.title),'detail',`data-id="${A(p.id)}"`,'btn btn-gh fin-back'):back()}<div class="card"><span class="fin-eyebrow">${e.kind==='match'?'WEDSTRIJD':'OVERIGE UITGAVE'}</span><h1>${E(e.title)}</h1>${a?`<p class="sub">${E([e.date?nlDatum(e.date):'',formLabel[a.form],a.water,a.location].filter(Boolean).join(' · '))}${a.gather||a.start||a.end?'<br>Loting '+E(a.gather||'—')+' · start '+E(a.start||'—')+' · einde '+E(a.end||'—'):''}${a.rod?' · '+E(a.rod):''}</p>`:''}${p?`<p class="sub">Tarieven van de serie: los ${money(p.looseFee)} (AOW ${money(p.looseFeeAow)}), hele serie ${money(p.fee)} (AOW ${money(p.feeAow)}). Inleg deze wedstrijd (los): ${money(C.inleg(d,e))}. Begroot en uitbetaald staan bij de serie.</p>`:moneyLine(d,e)+amountsForm(e,write)}</div>
 ${e.kind==='match'?`<div class="card"><div class="fin-list-heading"><h2>Deelnemers</h2>${write?(e.matchId?button('Open wedstrijdinvoer','participants',`data-id="${A(e.matchId)}"`):e.agendaId?button('Wedstrijdinvoer starten','start-match',`data-id="${A(e.agendaId)}"`):''):''}</div><p class="sub">Iedereen in de uitslag telt als betaald. Markeer alleen wie nog moet betalen${p?'; kies bij een serie eerst serie of los':''}.</p>${participantsHtml(d,e,write)}</div>`:''}
 ${write&&e.status==='planned'?`<div class="fin-toolbar">${button(e.kind==='match'?'Wedstrijd laten vervallen':'Uitgave laten vervallen','cancel')}</div>`:''}`;
}
function mountPayments(){
 document.querySelectorAll('.fin-pay-panel').forEach(el=>el.remove());if(!ADMIN_FINANCE_VISIBLE||!isAdmin||!invoerState?.wId)return;
 const d=getData(),e=C.matchEntry(d,invoerState.wId);if(!e||e.status==='cancelled')return;
 const p=C.seriesFor(d,e),el=document.createElement('section');el.className='card fin-pay-panel';
 el.innerHTML=`<div class="fin-list-heading"><h2>Inschrijfgeld</h2><span>${p?'serie · los '+money(p.looseFee)+' / hele serie '+money(p.fee):money(e.fee)+(e.feeBasis==='koppel'?' per koppel':' per persoon')}</span></div><p class="sub">Iedereen telt als betaald. ${p?'Kies per visser serie of los; markeer wie nog moet betalen.':'Markeer alleen wie nog niet betaald heeft.'}</p>${participantsHtml(d,e,true)}`;
 byId('invoer-form')?.appendChild(el);
}
const oldInvoer=renderInvoerForm;
renderInvoerForm=function(){oldInvoer();mountPayments();};
function todayMatches(d){const today=getVandaagIso();const agenda=(d.roosterItems||[]).filter(r=>r.type==='wedstrijd'&&r.datum===today&&r.zichtbaar!==false&&d.finance.entries.find(e=>e.agendaId===r.id)?.status!=='cancelled');const started=(d.wedstrijden||[]).filter(w=>w.datum===today&&!agenda.some(r=>r.gekoppeldeWedstrijdId===w.id));return [...agenda.map(r=>({id:r.id,title:r.titel||r.serieNaam,agenda:true,matchId:r.gekoppeldeWedstrijdId})),...started.map(w=>({id:w.id,title:w.naam,agenda:false,matchId:w.id}))];}
function openToday(item){if(item.matchId){nav('invoer');openInvoer(item.matchId);}else maakWedstrijdVanRoosterItem(item.id);}
function render(){if(!allowed()){page.innerHTML='';return;}page.innerHTML=state.view==='detail'?detailHtml():state.view==='duplicates'?duplicatesHtml():state.view==='budget'?budgetHtml():state.view==='import'?importHtml():state.view==='waters'?watersHtml():state.view==='rights'&&isHoofdAdmin()?back()+permissionsHtml():overview();document.querySelector('.page').scrollTop=0;}
function openDetail(id){requireAccess();state.detail=id;state.view='detail';nav('finance');}
function newExpense(){requireAccess(true);const d=getData(),id='expense-'+uid();d.finance.entries.push({id,kind:'expense',title:'Nieuwe uitgave',date:'',year:state.year,category:'Overig',planned:0,actual:null,status:'planned',configured:false,unpaid:{},members:[]});save(d);openDetail(id);}
function duplicatesHtml(){const pairs=FinancePlan.duplicates(getData(),state.year);return back()+'<div class="card"><h2>Mogelijk dubbele wedstrijden · '+state.year+'</h2><p>Deze regels staan op dezelfde datum, maar zijn nog niet gekoppeld. Kies per paar of ze dezelfde wedstrijd zijn. Er wordt niets automatisch samengevoegd.</p><p class="sub">Bij koppelen blijven uitslagen, betalingen en bonnen behouden. Bij een afwijkende wedstrijdvorm gebruik je de uitslag als basis, zodat de deelnemersindeling behouden blijft.</p></div>'+pairs.map(p=>'<div class="card"><h3>'+E(nlDatum(p.date))+'</h3><p><strong>Agenda:</strong> '+E(p.agendaTitle)+' · '+E(p.agendaForm)+'</p><p><strong>Uitslagen:</strong> '+E(p.resultTitle)+' · '+E(p.resultForm)+'</p><div class="fin-toolbar">'+button('Koppelen · agenda als basis','resolve-duplicate','data-key="'+A(p.key)+'" data-choice="agenda" '+(p.agendaForm!==p.resultForm?'disabled':''))+button('Koppelen · uitslag als basis','resolve-duplicate','data-key="'+A(p.key)+'" data-choice="result"')+button('Apart houden','resolve-duplicate','data-key="'+A(p.key)+'" data-choice="separate"')+'</div></div>').join('')+(!pairs.length?'<div class="card"><p>Geen onbeoordeelde dubbele paren gevonden. Je kunt de bijgewerkte jaarplanning downloaden.</p>'+button('Jaarplanning downloaden','template')+'</div>':'');}
function importHtml(){const p=state.preview,err=state.importErrors;const labels={title:'Naam',date:'Datum',endDate:'Einddatum',form:'Vorm',series:'Serie',rod:'Hengeltype',water:'Viswater',location:'Locatie loting',gather:'Lotingtijd',start:'Starttijd',end:'Eindtijd',planned:'Begroot',fee:'Inleg los / per wedstrijd',seriesFee:'Inleg hele serie',seriesFeeAow:'Inleg hele serie AOW',looseFeeAow:'Inleg los AOW',actual:'Uitbetaald / uitgegeven',feeBasis:'Inleg rekenen'};const val=(k,v)=>v===null||v===undefined||v===''?'—':k==='feeBasis'?(v==='koppel'?'per koppel':'per persoon'):['planned','fee','seriesFee','seriesFeeAow','looseFeeAow','actual'].includes(k)?money(v):k==='form'?(FinancePlan.forms[v]||v):String(v);
 const warnings=w=>w?.length?'<div class="fin-warnings"><strong>Overgeslagen</strong>'+w.map(t=>'<small>'+E(t)+'</small>').join('')+'</div>':'';
 let html=back()+'<div class="card"><h2>Jaarplanning · '+state.year+'</h2><p>Download de planning, vul aan en upload het bestand terug. Eén blad vult agenda én begroting; het blad Viswateren vult lotingplek en tijden automatisch aan.</p><p class="sub">Verplicht per regel: Vorm, Datum en een naam. Alles anders mag leeg (“nog invullen”). Bij een serie zet je de bedragen op één willekeurige regel. Bestaande betalingen, uitslagen en bonnen blijven bewaard.</p><div class="fin-toolbar">'+button('Jaarplanning downloaden','template')+button('Viswateren beheren','waters')+'</div><label class="fin-field"><span>Ingevulde jaarplanning uploaden (.xlsx)</span><input type="file" id="fin-import-file" accept=".xlsx"></label></div>';
 if(err)html+='<div class="card fin-errors"><h2>'+E(err.message)+'</h2><p class="sub">Verbeter de regels in Excel en upload opnieuw. Er is niets gewijzigd.</p><table><thead><tr><th>Blad</th><th>Rij</th><th>Kolom</th><th>Melding</th></tr></thead><tbody>'+err.errors.map(x=>'<tr><td>'+E(x.sheet||'')+'</td><td>'+x.line+'</td><td>'+E(x.column||'')+'</td><td>'+E(x.message)+'</td></tr>').join('')+'</tbody></table>'+warnings(err.warnings)+'</div>';
 if(p){const status={new:'Nieuw',same:'Ongewijzigd',update:'Gewijzigd',error:'Nog oplossen'};
  html+='<div class="card"><h2>Controleer de verschillen</h2><p>Jaar '+p.year+'. Kies welke wijzigingen je wilt overnemen. Wijzigingen binnen één serie worden samen verwerkt.</p>'+warnings(p.warnings)
  +(p.budget.length?'<div class="fin-import-row"><input type="checkbox" checked disabled><span><strong>Jaarbudget '+p.year+'</strong>'+p.budget.map(b=>'<small>'+E(b.label)+': '+money(b.before)+' → '+money(b.after)+'</small>').join('')+'</span></div>':'')
  +p.items.map(x=>'<div class="fin-import-row'+(x.error?' error':'')+'"><input type="checkbox" data-fin-import="'+x.row.line+'" '+(x.action==='same'||x.error?'disabled':'checked')+'><span><strong>'+E(x.row.title||x.row.series)+'</strong><small>Rij '+x.row.line+' · '+E(x.row.date?nlDatum(x.row.date):'Datum nog onbekend')+' · '+status[x.action]+'</small>'+(x.error?'<small class="fin-error-text">'+E(x.error)+'</small>':'')+x.changes.map(c=>'<small>'+labels[c.key]+': '+E(val(c.key,c.before))+' → '+E(val(c.key,c.after))+'</small>').join('')+(x.candidates?.length?'<label class="fin-field"><span>'+(x.error?'Koppel aan een bestaande post of vul een datum in Excel in.':'Is dit een nieuwe post of een gewijzigde bestaande post?')+'</span><select data-plan-map="'+x.row.line+'"><option value="?">Kies een koppeling</option>'+(x.error?'':'<option value="">Nieuwe post</option>')+x.candidates.map(e=>'<option value="'+A(e.id)+'">'+E(e.title+' · '+(e.date?nlDatum(e.date):'Geen datum'))+'</option>').join('')+'</select></label>':'')+'</span></div>').join('')
  +(p.waters.some(w=>w.action!=='same')?'<h3>Viswateren</h3>'+p.waters.filter(w=>w.action!=='same').map(w=>'<div class="fin-import-row"><input type="checkbox" checked disabled><span><strong>'+E(w.name)+'</strong><small>'+(w.action==='new'?'Nieuw':'Gewijzigd')+' · '+E([w.location,w.gather,w.start,w.end].filter(Boolean).join(' · ')||'geen standaardwaarden')+'</small></span></div>').join(''):'')
  +(p.missing.length?'<h3>Ontbreekt in nieuwe upload</h3><p>Deze posten blijven behouden, tenzij je hieronder aangeeft dat ze vervallen.</p>'+p.missing.map(e=>'<label class="fin-import-row"><input type="checkbox" data-plan-remove="'+A(e.id)+'"><span>'+E(e.title)+'<small>'+E(e.date?nlDatum(e.date):'Geen datum')+' · Laten vervallen en reservering vrijgeven</small></span></label>').join(''):'')
  +'<div class="fin-toolbar">'+button('Geselecteerde wijzigingen overnemen','apply-import','','btn btn-g')+button('Annuleren','clear-import')+'</div></div>';}
 return html;}
function watersHtml(){const d=getData(),waters=FinanceWaters.list(d),w=allowed(true);return back()+'<div class="card"><h2>Viswateren</h2><p>Per viswater één lotingplek en vaste tijden. Laat je die velden in de jaarplanning leeg, dan vult de upload ze hieruit aan. De tabel is voorgevuld uit je bestaande agenda; corrigeer wat niet klopt.</p>'+(waters.length?'<div class="fin-table-head fin-waters-head"><span>Viswater</span><span>Locatie loting</span><span>Loting</span><span>Start</span><span>Einde</span><span></span></div>'+waters.map(x=>'<div class="fin-water-row" data-water="'+A(x.name)+'"><input value="'+A(x.name)+'" data-water-field="name" '+(w?'':'disabled')+'><input value="'+A(x.location)+'" data-water-field="location" placeholder="Nog invullen" '+(w?'':'disabled')+'><input value="'+A(x.gather)+'" data-water-field="gather" placeholder="uu:mm" '+(w?'':'disabled')+'><input value="'+A(x.start)+'" data-water-field="start" placeholder="uu:mm" '+(w?'':'disabled')+'><input value="'+A(x.end)+'" data-water-field="end" placeholder="uu:mm" '+(w?'':'disabled')+'>'+(w?button('Verwijderen','remove-water','data-name="'+A(x.name)+'"'):'')+'</div>').join(''):'<p class="sub">Nog geen viswateren. Voeg er een toe of upload een jaarplanning met het blad Viswateren.</p>')+(w?'<form id="fin-water-form" class="fin-fields">'+input('fin-water-name','Nieuw viswater','','text','required')+input('fin-water-location','Locatie loting')+'<button class="btn btn-g">Toevoegen</button></form>':'')+'</div>';}
let importSequence=0;
async function readImport(file){requireAccess(true);const seq=++importSequence;state.preview=null;state.importErrors=null;if(!file)return;try{if(file.size>8*1024*1024)throw Error('Het bestand is te groot (maximaal 8 MB).');const wb=new ExcelJS.Workbook();await wb.xlsx.load(await file.arrayBuffer());if(seq!==importSequence)return;requireAccess(true);const plan=FinancePlan.read(wb);if(plan.rows.length>1000)throw Error('Maximaal 1000 posten per upload.');state.preview=FinancePlan.preview(getData(),plan);state.planSnapshot=localStorage.getItem(SK);render();}catch(e){if(seq===importSequence){state.preview=null;if(e.errors){state.importErrors={message:e.message,errors:e.errors,warnings:e.warnings||[]};render();return;}render();}throw e;}}
document.addEventListener('change',ev=>{const el=ev.target;if(!el.matches('[data-plan-map]'))return;try{requireAccess(true);if(el.value==='?')return;const p=state.preview,mapping={...p.mapping,[el.dataset.planMap]:el.value};state.preview=FinancePlan.preview(getData(),p.plan,mapping);render();}catch(e){noticeError(e);}});
async function downloadWorkbook(wb,name){try{const src=getShareLogoSrc();if(src.startsWith('data:image/')){const id=wb.addImage({base64:src,extension:src.includes('image/png')?'png':'jpeg'});const sheet=wb.getWorksheet('Jaarplanning')||wb.getWorksheet('Uitleg')||wb.getWorksheet('Jaaroverzicht');if(sheet){const img=new Image();await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=src;});const h=55,w=h*img.naturalWidth/img.naturalHeight;sheet.addImage(id,{tl:{col:sheet.name==='Jaarplanning'?13:3,row:0},ext:{width:w,height:h}});}}}catch(_){}const bytes=await wb.xlsx.writeBuffer();triggerBlobDownload(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),name);}
async function template(){requireAccess(true);const pairs=FinancePlan.duplicates(getData(),state.year);if(pairs.length&&!confirm('Er zijn '+pairs.length+' mogelijk dubbele wedstrijdparen. Annuleren opent de controle per paar. Toch nu downloaden?')){state.view='duplicates';render();return;}const wb=await FinancePlan.workbook(ExcelJS,getData(),state.year);await downloadWorkbook(wb,'HSV_GHW_Jaarplanning_'+state.year+'.xlsx');}
async function action(name,el){
 if(name.startsWith('fs-'))return fsAction(name,el);
 if(name==='today'){if(!isAdmin)throw Error('Log eerst in.');const d=getData(),list=todayMatches(d);if(!list.length)throw Error('Er staat vandaag geen wedstrijd in de agenda.');if(list.length===1)return openToday(list[0]);const box=byId('fin-today-list');if(box)box.innerHTML=list.map((m,i)=>button(m.title,'today-pick',`data-index="${i}"`)).join('');return;}
 if(name==='today-pick'){const list=todayMatches(getData());return openToday(list[Number(el.dataset.index)]);}
 requireAccess();const d=getData(),e=currentEntry(d);
 switch(name){
 case 'open':state.view='overview';nav('finance');return;
 case 'back':state.view='overview';state.detail=null;render();return;
 case 'detail':openDetail(el.dataset.id);return;
 case 'budget':requireAccess(true);state.view='budget';render();return;
 case 'new':newExpense();return;
 case 'rights':if(!isHoofdAdmin())throw Error('Alleen de hoofdbeheerder beheert rechten.');state.view='rights';render();return;
 case 'import':requireAccess(true);state.view='import';state.preview=null;state.importErrors=null;nav('finance');return;
 case 'waters':requireAccess();state.view='waters';render();return;
 case 'remove-water':requireAccess(true);if(!confirm('Viswater "'+el.dataset.name+'" uit de tabel verwijderen? Bestaande wedstrijden veranderen niet.'))return;FinanceWaters.remove(d,el.dataset.name);save(d);render();return;
 case 'duplicates':requireAccess(true);state.view='duplicates';render();return;
 case 'resolve-duplicate':requireAccess(true);save(FinancePlan.resolveDuplicate(d,state.year,el.dataset.key,el.dataset.choice));render();showAppNotice(el.dataset.choice==='separate'?'De wedstrijden blijven apart.':'Gekoppeld. De volgende download bevat één regel voor deze wedstrijd.');return;
 case 'template':await template();return;
 case 'clear-import':state.preview=null;state.importErrors=null;render();return;
 case 'apply-import':{requireAccess(true);if(!state.preview)throw Error('Kies eerst een bestand.');if(localStorage.getItem(SK)!==state.planSnapshot)throw Error('Gegevens zijn sinds de controle gewijzigd. Upload het bestand opnieuw om de actuele verschillen te controleren.');const chosen=[...document.querySelectorAll('[data-fin-import]:checked')].map(x=>Number(x.dataset.finImport)),remove=[...document.querySelectorAll('[data-plan-remove]:checked')].map(x=>x.dataset.planRemove);if(!chosen.length&&!remove.length)throw Error('Er zijn geen wijzigingen geselecteerd.');save(FinancePlan.apply(d,state.preview,chosen,remove));state.year=state.preview.year;state.preview=null;state.view='overview';render();showAppNotice('Agenda en begroting bijgewerkt. Een nieuwe download bevat de actuele gegevens.');return;}
 case 'settle-open':{requireAccess(true);const t=d.finance.entries.find(x=>x.id===el.dataset.entry);if(!t)throw Error('Post niet gevonden.');if(el.dataset.kind==='series')C.setSeriesPaid(d,t.id,el.dataset.unit,true);else if(t.seriesId)C.setLoosePaid(t,el.dataset.unit,true);else C.setUnpaid(t,el.dataset.unit,false);save(d);render();showAppNotice('Als betaald gemarkeerd.');return;}
 case 'cancel':requireAccess(true);if(e.kind==='match'&&e.matchId&&(d.uitslagen||[]).some(u=>C.matchIds(d,e.matchId).includes(u.wedstrijdId)))throw Error('Deze wedstrijd heeft al een uitslag en kan niet vervallen.');if(!confirm('Deze post laten vervallen? Hij telt dan niet meer mee in de begroting.'))return;C.cancel(e);if(e.kind==='series')for(const c of d.finance.entries.filter(c=>c.seriesId===e.id))C.cancel(c);const a=d.roosterItems.find(a=>a.id===e.agendaId);if(a)a.zichtbaar=false;save(d);state.view='overview';render();return;
 case 'participants':requireAccess(true);if(onlyFinance())throw Error('Open de wedstrijd via het uitslagenbeheer.');nav('invoer');openInvoer(el.dataset.id);return;
 case 'start-match':requireAccess(true);if(onlyFinance())throw Error('Laat een wedstrijdbeheerder de wedstrijd eerst starten vanuit de agenda.');nav('invoer');maakWedstrijdVanRoosterItem(el.dataset.id);return;
 case 'backup':requireAccess(true);exporteerBackup();return;
 }
}
function afterPaymentChange(el){if(el.closest('.fin-pay-panel'))mountPayments();else render();}
async function change(el){
 const kind=el.dataset.finChange;
 if(kind==='year'){const y=Number(el.value);if(!Number.isInteger(y)||y<2000||y>2100)throw Error('Kies een jaar tussen 2000 en 2100.');state.year=y;render();return;}
 if(kind==='permission'||kind==='finance-only'){if(!isHoofdAdmin())throw Error('Alleen de hoofdbeheerder beheert rechten.');const d=getData(),a=d.admins.find(a=>a.id===el.dataset.id);if(a.rol==='hoofd')return;if(kind==='permission')a.financeAccess=el.value;else a.financeOnly=el.checked;saveData(d);updateAdminUi();return;}
 if(kind==='aow'){if(!isAdmin)throw Error('Log eerst in.');const d=getData(),v=d.vissers.find(v=>v.id===el.dataset.id);if(!v)throw Error('Visser niet gevonden.');v.aow=el.checked;saveData(d);return;}
 if(kind==='series-mode'){if(!isAdmin)throw Error('Log eerst in.');const d=getData();if(!el.value)return;C.setSeriesMode(d,el.dataset.id,el.dataset.member,el.value);saveData(d);afterPaymentChange(el);return;}
 if(kind==='series-paid'){if(!isAdmin)throw Error('Log eerst in.');const d=getData();C.setSeriesPaid(d,el.dataset.id,el.dataset.member,el.checked);saveData(d);afterPaymentChange(el);return;}
 if(kind==='loose-paid'){if(!isAdmin)throw Error('Log eerst in.');const d=getData(),e=d.finance.entries.find(e=>e.id===el.dataset.id);if(!e)throw Error('Wedstrijd niet gevonden.');C.setLoosePaid(e,el.dataset.unit,el.checked);saveData(d);afterPaymentChange(el);return;}
 if(kind==='unpaid'){if(!isAdmin)throw Error('Log eerst in.');const d=getData(),e=d.finance.entries.find(e=>e.id===el.dataset.id);if(!e)throw Error('Wedstrijd niet gevonden.');C.setUnpaid(e,el.dataset.unit,el.checked);saveData(d);afterPaymentChange(el);return;}
 if(el.dataset.waterField){requireAccess(true);const d=getData(),rowEl=el.closest('[data-water]'),w=FinanceWaters.find(d,rowEl.dataset.water);if(!w)throw Error('Viswater niet gevonden.');const f=el.dataset.waterField,v=el.value.trim();
  if(f==='name'){if(!v)throw Error('Naam mag niet leeg zijn.');if(FinanceWaters.find(d,v)&&FinanceWaters.find(d,v)!==w)throw Error('Dit viswater bestaat al.');w.name=v;}
  else if(['gather','start','end'].includes(f)){if(v&&!/^([01]?\d|2[0-3])[:.][0-5]\d$/.test(v))throw Error('Gebruik een tijd zoals 08:30.');w[f]=v?v.replace('.',':').padStart(5,'0'):'';}
  else w[f]=v;save(d);render();return;}
 if(el.id==='fin-import-file')await readImport(el.files[0]);
}
function submit(form){
 requireAccess(true);const d=getData(),e=currentEntry(d);
 if(form.id==='fin-budget-form'){const extras=[...form.querySelectorAll('.fin-extra-row')].map(r=>({title:r.querySelector('[data-extra-title]').value.trim(),amount:C.cents(r.querySelector('[data-extra-amount]').value)})).filter(x=>x.title||x.amount);if(extras.some(x=>!x.title))throw Error('Geef elke extra bijdrage een omschrijving.');d.finance.years[state.year]={budget:C.cents(read('fin-budget')),carry:C.cents(read('fin-carry')),extras,configured:true};save(d);state.view='overview';}
 if(form.id==='fin-water-form'){FinanceWaters.upsert(d,{name:read('fin-water-name'),location:read('fin-water-location')});save(d);}
 if(form.id==='fin-entry-form'){
  const title=read('fin-title').trim();if(!title)throw Error('Vul een omschrijving in.');const planned=C.cents(read('fin-planned')),actual=C.cents(read('fin-actual'));
  Object.assign(e,{title,planned,configured:true});e.actual=null;e.actual=actual===C.pot(d,e)?null:actual;
  if(e.kind!=='series'){const date=byId('fin-date')?(read('fin-date')?C.date(read('fin-date')):''):e.date;if(e.kind==='match'&&!date)throw Error('Een wedstrijd heeft een datum nodig.');e.date=date;e.year=Number((date||'').slice(0,4))||e.year||state.year;}
  if(e.kind==='match'&&!e.seriesId){e.fee=C.cents(read('fin-fee'));if(byId('fin-fee-basis'))e.feeBasis=read('fin-fee-basis');}
  if(e.kind==='series'){const la=C.cents(read('fin-loose-actual'));e.looseActual=la===C.loosePot(d,e)?null:la;Object.assign(e,{looseFee:C.cents(read('fin-series-loose')),looseFeeAow:C.cents(read('fin-series-loose-aow')),fee:C.cents(read('fin-series-fee')),feeAow:C.cents(read('fin-series-aow'))});const old=e.title;for(const c of d.finance.entries.filter(c=>c.seriesId===e.id)){const a=d.roosterItems.find(a=>a.id===c.agendaId);if(a&&a.serieNaam===old)a.serieNaam=title;const w=(d.wedstrijden||[]).find(w=>w.id===c.matchId),comp=(d.competities||[]).find(c2=>c2.id===w?.competitieId);if(comp&&comp.naam===old)comp.naam=title;}e.seriesKey=state.year+':'+title.trim().toLocaleLowerCase('nl');}
  else{const r=d.roosterItems.find(r=>r.id===e.agendaId);if(r){r.titel=title;r.autoTitel=false;if(e.date)r.datum=e.date;}for(const wid of C.matchIds(d,e.matchId)){const w=d.wedstrijden.find(w=>w.id===wid);if(w){w.naam=title;if(e.date)w.datum=e.date;}}}
  save(d);
 }
 if(form.id==='fin-user-form'){if(!isHoofdAdmin())throw Error('Alleen de hoofdbeheerder beheert accounts.');const name=read('fin-user-name').trim(),code=read('fin-user-code').trim();if(!name||code.length<4)throw Error('Vul een naam en een code van minimaal vier tekens in.');d.admins.push({id:uid(),naam:name,code,rol:'admin',actief:true,financeOnly:true,financeAccess:read('fin-user-right')});save(d);if(state.view!=='rights')renderBeheer();}
 render();showAppNotice('Opgeslagen.');
}
document.addEventListener('click',ev=>{const el=ev.target.closest('[data-fin]');if(el){ev.preventDefault();Promise.resolve(action(el.dataset.fin,el)).catch(noticeError);}});
document.addEventListener('change',ev=>{if(ev.target.matches('[data-fin-change],[data-water-field],#fin-import-file'))Promise.resolve(change(ev.target)).catch(err=>{noticeError(err);if(['unpaid','loose-paid','series-mode','series-paid'].includes(ev.target.dataset.finChange))afterPaymentChange(ev.target);});});
document.addEventListener('submit',ev=>{if(ev.target.id.startsWith('fin-')){ev.preventDefault();try{submit(ev.target);}catch(err){noticeError(err);}}});
const originalImport=renderImport;renderImport=function(){originalImport();if(ADMIN_FINANCE_VISIBLE&&allowed(true))byId('pv-import').insertAdjacentHTML('afterbegin',`<div class="card"><h2>Jaaragenda en begroting</h2><p>Importeer geplande wedstrijden en uitgaven via Financiën.</p>${button('Jaarplanning importeren','import')}</div>`);};
const oldBackupRender=renderBackup;renderBackup=function(){if(!isHoofdAdmin()){showAppNotice('Alleen de hoofdbeheerder beheert volledige back-ups.','warn');return;}oldBackupRender();};
exporteerBackup=function(){if(!isHoofdAdmin()){showAppNotice('Alleen de hoofdbeheerder kan een volledige back-up maken.','warn');return;}const data=getData(),meta=maakBackupMetadata(data);triggerBlobDownload(new Blob([JSON.stringify({meta,data},null,2)],{type:'application/json'}),'HSV_GHW_backup_'+new Date().toISOString().slice(0,10)+'.json');showAppNotice('Back-up inclusief financiën gedownload.');};
const oldRestore=bevestigHerstel;bevestigHerstel=function(){if(!isHoofdAdmin())return;oldRestore();doLogout();};
const oldWipe=wisAlles;wisAlles=function(){if(!isHoofdAdmin())return;oldWipe();};
const oldPlanning=getRoosterPlanningItems;getRoosterPlanningItems=function(d){return oldPlanning(d).map(r=>{const e=d.finance?.entries.find(e=>e.agendaId===r.id);return e?.status==='cancelled'?{...r,titel:'Afgelast · '+r.titel}:r;});};
const oldStart=maakWedstrijdVanRoosterItem;maakWedstrijdVanRoosterItem=function(id){const e=getData().finance.entries.find(e=>e.agendaId===id);if(e?.status==='cancelled'){showAppNotice('Deze wedstrijd is vervallen. Heropen hem eerst via de jaarplanning.','warn');return;}oldStart(id);};
// AOW flag per fisher, maintained in the fishers list.
const oldVissers=renderBVissers;renderBVissers=function(){oldVissers();const d=getData();document.querySelectorAll('#bv-vissers tr[data-visser-id]').forEach(tr=>{const v=d.vissers.find(v=>v.id===tr.dataset.visserId),td=tr.children[1];if(!v||!td||td.querySelector('[data-fin-change="aow"]'))return;td.insertAdjacentHTML('beforeend',`<label class="fin-aow"><input type="checkbox" data-fin-change="aow" data-id="${A(v.id)}" ${v.aow?'checked':''}> AOW-tarief</label>`);});};

// ── Tabblad Financiën bij een serie ──
// Betaalgegevens staan in afgeschermde online tabellen (alleen ingelogde beheerders); nooit in de gedeelde uitslagen-opslag.
const serieAllowed=()=>!!isAdmin;
const fs={serieId:null,filter:null,open:null,rates:false,prizes:false,los:false,ladder:'exp',view:'overzicht',last:{next:1,toGo:0}};
const FS_SYM={ok:'✓',wa:'!',lo:'–',no:'?'};
const FS_TILE=[['ok','Serie betaald'],['wa','Serie open'],['lo','Los'],['no','Kies nog']];
const store={};
const bucket=id=>store[id]||(store[id]={ready:false,loading:null,error:'',tarief:null,deel:{},los:{},opgave:{}});
/* Live: when another admin changes a payment, reload this series. Open series are refreshed at once, the others when opened. */
let rt=null,rtTimer=null;
function rtPing(){
 for(const k of Object.keys(store))store[k].stale=true;
 clearTimeout(rtTimer);
 rtTimer=setTimeout(async()=>{const id=fs.serieId;if(!id||!fsOnScreen()||!bucket(id).ready)return;await loadSerie(id,true);if(!fs.rates)fsRefresh();},250);
}
function startRealtime(){
 if(rt||!cloudClient||!isAdmin||typeof cloudClient.channel!=='function')return;
 rt=cloudClient.channel('serie-betaling');
 for(const table of ['serie_tarief','serie_deelname','serie_los_betaald','serie_opgave'])rt.on('postgres_changes',{event:'*',schema:'public',table},rtPing);
 rt.subscribe();
}
function stopRealtime(){clearTimeout(rtTimer);if(rt&&cloudClient)try{cloudClient.removeChannel(rt);}catch(_){}rt=null;}
window.addEventListener('focus',()=>{if(rt)rtPing();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&rt)rtPing();});
function clearStore(){stopRealtime();for(const k of Object.keys(store))delete store[k];fs.open=null;fs.filter=null;fs.rates=false;}
async function loadSerie(id,force){
 const b=bucket(id);if(b.loading)return b.loading;if(b.ready&&!force&&!b.stale)return;
 b.loading=(async()=>{try{
  if(!cloudClient)throw Error('Geen verbinding met de online opslag. Ververs de pagina.');
  const q=t=>cloudClient.from(t).select('*').eq('serie_id',id);
  const [a,d,l,o]=await Promise.all([q('serie_tarief'),q('serie_deelname'),q('serie_los_betaald'),q('serie_opgave')]);
  for(const r of [a,d,l,o])if(r.error)throw r.error;
  b.tarief=a.data[0]||null;b.deel={};d.data.forEach(r=>{b.deel[r.visser_id]=r;});b.los={};l.data.forEach(r=>{b.los[r.wedstrijd_id+'|'+r.visser_id]=true;});b.opgave={};o.data.forEach(r=>{b.opgave[r.visser_id]=r.volgnummer;});b.ready=true;b.stale=false;b.error='';
 }catch(e){b.error=e.message||String(e);}finally{b.loading=null;}})();
 return b.loading;
}
function seriesPost(d,s){const n=x=>String(x||'').trim().toLocaleLowerCase('nl');const list=d.finance.entries.filter(e=>e.kind==='series'&&e.status!=='cancelled'&&n(e.title)===n(s.naam));return list.find(e=>String(e.date||'').slice(0,4)===String(s.seizoen))||list[0]||null;}
/* Lay the online payment rows over the series post. Everything that was kept locally before is ignored: a clean start. */
function overlay(d,p,b){
 const t=b.tarief||{};
 Object.assign(p,{fee:t.fee||0,feeAow:t.fee_aow||0,looseFee:t.loose_fee||0,looseFeeAow:t.loose_fee_aow||0,planned:t.club||0,looseActual:t.loose_payout??null,totalMatches:t.wedstrijden_totaal||0,opgave:{...(b.opgave||{})},configured:true,enrollments:{},seriesPaid:{}});
 for(const [vid,r] of Object.entries(b.deel)){p.enrollments[vid]=r.keuze;if(r.keuze==='series'&&r.betaald)p.seriesPaid[vid]=true;}
 C.sync(d);
 for(const c of d.finance.entries.filter(c=>c.seriesId===p.id)){c.looseChecked={};c.unpaid={};for(const k of Object.keys(b.los)){const [wid,vid]=k.split('|');if(wid===c.matchId)c.looseChecked[vid]=true;}}
}
function fsStatus(r){
 const e=r.eind,g=e.fished+'/'+e.min+(r.signed?' → '+Math.min(r.projected,e.min)+'/'+e.min+' · opgegeven':''),togo=e.remaining?' · '+e.remaining+' te gaan':'';
 if(r.group==='serie')return (r.paid?'Betaald':'Open '+money(r.fee))+' · '+g+(r.reach?togo:' · valt af');
 if(r.group==='kans')return g+(r.need?' · nog '+r.need+' nodig':' · genoeg')+togo;
 if(r.mode==='loose'){const paid=r.loose.filter(x=>x.state==='paid').length,all=r.loose.filter(x=>x.state==='paid'||x.state==='open').length;return 'Los · '+paid+' van '+all+' betaald';}
 return 'Geen prijs meer mogelijk · '+g;
}
function fsReason(r,prize){
 const e=r.eind;
 if(e.code==='ja')return '<b class="fs-yes">★ komt in aanmerking'+(prize?' · eindprijs '+prize:'')+'</b>';
 if(e.code==='los')return 'Geen eindprijs: doet los mee';
 if(e.code==='onbetaald')return 'Geen eindprijs: serie nog niet betaald';
 if(e.code==='geen-keuze')return 'Nog niet bepaald: kies serie of los';
 if(e.code==='nog-open')return 'Nog niet te zeggen: '+e.fished+' van '+e.min+' wedstrijden gevist';
 return 'Geen eindprijs: '+e.fished+' van '+e.min+' wedstrijden gevist, er zijn te weinig wedstrijden over';
}
function fsSheet(p,r,prize,serieId){
 let h='<div class="fs-sheet"><div class="fs-seg"><button type="button" class="btn btn-gh'+(r.mode==='series'?' on':'')+'" data-fin="fs-mode" data-vid="'+A(r.vid)+'" data-mode="series">Serie</button><button type="button" class="btn btn-gh'+(r.mode==='loose'?' on':'')+'" data-fin="fs-mode" data-vid="'+A(r.vid)+'" data-mode="loose">Los</button></div>';
 if(r.mode==='series')h+='<button type="button" class="btn fs-pay'+(r.paid?' paid':'')+'" data-fin="fs-paid" data-vid="'+A(r.vid)+'">'+(r.paid?'✓ Serie betaald · ':'Markeer serie betaald · ')+money(r.fee)+'</button>';
 else if(r.mode==='loose'){h+='<div class="fs-weeks">'+r.loose.map(x=>{
  if(x.state==='na'||x.state==='abs')return '<button type="button" class="btn btn-gh fs-wk na" disabled><span>W'+x.n+'</span><span>'+(x.state==='na'?'nog niet':'niet gevist')+'</span></button>';
  return '<button type="button" class="btn btn-gh fs-wk '+(x.state==='paid'?'paid':'open')+'" data-fin="fs-loose" data-entry="'+A(x.entryId)+'" data-vid="'+A(x.unitId)+'"><span>W'+x.n+'</span><span>'+(x.state==='paid'?'✓ ':'! ')+money(x.amount)+'</span></button>';}).join('')+'</div>';}
 else h+='<p class="fs-sub">Kies hierboven serie of los.</p>';
 return h+'<p class="fs-sub fs-why">Eindprijs: '+fsReason(r,prize)+'</p></div>';
}
function ratesForm(b){
 const t=b.tarief||{},f=(id,label,v,req)=>'<label class="fin-field"><span>'+label+'</span><input id="'+id+'" type="number" min="0" max="100000" step="0.01" inputmode="decimal" value="'+(v==null?'':euroInput(v))+'" '+(req?'required':'')+'></label>';
 return '<form id="fs-rates-form" class="card fs-rates"><p class="fs-lbl">Tarieven van deze serie</p><div class="fin-fields">'+f('fs-club','Bijdrage vereniging',t.club||0,true)+f('fs-fee','Hele serie · normaal',t.fee||0,true)+f('fs-fee-aow','Hele serie · AOW',t.fee_aow||0,true)+f('fs-loose','Los per wedstrijd · normaal',t.loose_fee||0,true)+f('fs-loose-aow','Los per wedstrijd · AOW',t.loose_fee_aow||0,true)+f('fs-loose-payout','Uitbetaling losse pot (leeg = de pot)',t.loose_payout,false)+'<label class="fin-field"><span>Aantal wedstrijden in de serie</span><input id="fs-total" type="number" min="1" max="30" step="1" inputmode="numeric" value="'+(t.wedstrijden_totaal||'')+'"></label></div><button class="btn btn-g fs-save" type="submit">Opslaan</button></form>';
}
const GROUPS=[['serie','Serie-vissers'],['kans','Nog te winnen'],['los','Losse deelname']];
function ladderHtml(l,n,pot){
 if(!n)return '<p class="fs-sub">Nog niemand.</p>';
 if(!l.prizes.length)return '<p class="fs-sub">Pot '+money(pot)+' is te klein voor '+n+' prijzen.</p>';
 const half=Math.ceil(l.prizes.length/2),cell=(x,i)=>'<li><span>'+(i+1)+'</span><b>'+money(x)+'</b></li>';
 const col=(from,to)=>'<ol class="fs-lad-col">'+l.prizes.slice(from,to).map((x,i)=>cell(x,from+i)).join('')+'</ol>';
 return '<div class="fs-lad">'+col(0,half)+(l.prizes.length>1?col(half,l.prizes.length):'')+'</div><p class="fs-lad-sum"><span>Verdeeld '+money(l.total)+' van '+money(pot)+'</span><b class="fs-over">NOG OVER '+money(l.over)+'</b></p>';
}
function volgendeHtml(d,ov,b){
 const signed=ov.rows.filter(r=>r.signed),done=ov.toGo<=0;
 const reach=signed.filter(r=>r.projected>=ov.min).length,paid=signed.filter(r=>r.paid).length;
 let h='<div class="card fs-stats"><div class="fs-stat"><span>Wedstrijd</span><b>'+(done?'klaar':ov.next+' van '+ov.matches)+'</b></div><div class="fs-stat"><span>Opgegeven</span><b>'+signed.length+'</b><small>'+paid+' serie betaald</small></div><div class="fs-stat"><span>Halen minimum</span><b>'+reach+'</b><small>beste '+ov.min+' telt</small></div></div>';
 if(done)return h+'<div class="card"><p class="fs-sub">Alle wedstrijden van de serie zijn gevist. Wijzig bij Tarieven het aantal wedstrijden als er nog een bijkomt.</p></div>';
 const rows=ov.rows.slice().sort((a,b2)=>nameOf(d,a.vid).localeCompare(nameOf(d,b2.vid),'nl'));
 return h+'<div class="card fs-list">'+rows.map(r=>{
  const e=r.eind,line=e.fished+'/'+e.min+(r.signed?' → '+Math.min(r.projected,e.min)+'/'+e.min:'')+(r.signed&&r.projected>=e.min?' · haalt het':'');
  return '<button type="button" class="fs-row fs-b-'+r.status+'" data-fin="fs-signup" data-vid="'+A(r.vid)+'" aria-pressed="'+(r.signed?'true':'false')+'"><span class="fs-sym fs-'+r.status+'">'+FS_SYM[r.status]+'</span><span class="fs-who"><strong>'+E(nameOf(d,r.vid))+(r.aow?' <span class="fin-badge">AOW</span>':'')+'</strong><small>'+line+'</small></span><span class="fs-chk'+(r.signed?' on':'')+'">'+(r.signed?'✓ Doet mee':'Doet mee')+'</span></button>';
 }).join('')+'</div>';
}
function serieTab(serieId){
 fs.serieId=serieId;if(!serieAllowed())return '';
 const d=getData(),s=(d.competities||[]).find(c=>c.id===serieId);if(!s)return '';
 C.sync(d);const p=seriesPost(d,s);
 if(!p)return '<div class="card"><p>Deze serie heeft nog geen financiële post. Zodra de serie in de agenda of in een uitslag staat, verschijnt hij hier.</p></div>';
 const b=bucket(serieId);startRealtime();
 if(b.ready&&b.stale&&!b.loading)loadSerie(serieId,true).then(fsRefresh);
 if(!b.ready){
  if(!b.loading&&!b.error)loadSerie(serieId).then(fsRefresh);
  return b.error?'<div class="card"><p>De betaalgegevens konden niet worden geladen.</p><p class="fs-sub">'+E(b.error)+'</p><div class="fin-toolbar">'+button('Opnieuw proberen','fs-reload')+'</div></div>':'<div class="card"><p class="fs-sub">Betaalgegevens laden…</p></div>';
 }
 overlay(d,p,b);
 const ov=C.seriesOverview(d,p),t=ov.totals,pz=ov.prizes,noRates=!b.tarief;
 const order=(typeof berekenSerieStand==='function'?berekenSerieStand(serieId,d):[]).map(x=>x.vid),place={};let k=0;
 const sureRows=new Set(ov.rows.filter(r=>r.eind.ok).map(r=>r.vid));
 for(const vid of order)if(sureRows.has(vid))place[vid]=++k;
 for(const r of ov.rows)if(r.eind.ok&&!place[r.vid])place[r.vid]=++k;
 const sort=(a,b2)=>nameOf(d,a.vid).localeCompare(nameOf(d,b2.vid),'nl');
 fs.last={next:ov.next,toGo:ov.toGo};
 let h='';
 if(noRates)h+='<div class="info">Vul eerst de tarieven van deze serie in.</div>';
 if(noRates||fs.rates)h+=ratesForm(b);
 const kans=ov.rows.filter(r=>r.group==='serie'&&r.reach).length,sers=ov.rows.filter(r=>r.group==='serie').length,done=ov.toGo<=0;
 const head=!ov.matches?'Vul bij Tarieven het aantal wedstrijden in':done?'Serie klaar · '+ov.matches+' wedstrijden':'Wedstrijd '+ov.next+' van '+ov.matches;
 const stat=(label,val,sub)=>'<div class="fs-stat"><span>'+label+'</span><b>'+val+'</b>'+(sub?'<small>'+sub+'</small>':'')+'</div>';
 h+='<div class="card fs-sum"><p class="fs-sum-h">'+head+'</p><div class="fs-stats fs-stats-in">'+stat('Serievissers',sers,'beste '+ov.min+' telt')+stat('Kans op prijs',kans,ov.rows.filter(r=>r.signed).length+' komen volgende')+stat('Seriepot',money(t.pot),'incl. vereniging '+money(t.club))+'</div><div class="fs-inleg"><div><b>Serie-inleg</b><span>ontvangen '+money(t.seriesIncome)+' ('+(t.serieN.n+t.serieA.n)+'×) · nog te betalen '+money(t.openS.sum)+' ('+t.openS.n+'×)</span></div><div><b>Losse inleg</b><span>ontvangen '+money(t.loosePot)+' ('+(t.looseN.n+t.looseA.n)+'×) · nog te betalen '+money(t.looseOpen.sum)+' ('+t.looseOpen.n+'×)</span></div><div><b>Opbrengst</b><span>Opbrengst '+money(t.seriesIncome+t.loosePot)+' · losse pot '+money(t.loosePot)+'</span></div></div></div>';
 const mode=['sure','exp','max'].includes(fs.ladder)?fs.ladder:'exp',L=pz[mode],pot=mode==='max'?pz.potMax:mode==='exp'?pz.potExp:pz.potSure,n=pz[mode+'N'];
 const tg=(key,label,num)=>'<button type="button" class="btn btn-gh'+(mode===key?' on':'')+'" data-fin="fs-ladder" data-mode="'+key+'">'+label+' · '+num+'</button>';
 h+='<button type="button" class="btn btn-gh fs-fold" data-fin="fs-prizes" aria-expanded="'+(fs.prizes?'true':'false')+'">Prijzen '+(fs.prizes?'▴':'▾')+'</button>';
 if(fs.prizes)h+='<div class="card fs-prizes"><div class="fs-seg three">'+tg('sure','Zeker',pz.sureN)+tg('exp','Verwacht',pz.expN)+tg('max','Maximaal',pz.maxN)+'</div>'+ladderHtml(L,n,pot)+'</div>';
 const rowHtml=r=>{
  const open=fs.open===r.vid,pl=place[r.vid],star=pl&&pz.sure.prizes[pl-1]!=null?' · <b class="fs-yes">★ '+money(pz.sure.prizes[pl-1])+'</b>':'';
  const lab=r.group==='los'?'':(r.mode==='series'&&r.eind.fished>=ov.min)?'<span class="fs-tag fs-tag-ok">Zeker</span>':(r.group==='serie'&&!r.reach)?'<span class="fs-tag fs-tag-no">Valt af</span>':'<span class="fs-tag fs-tag-may">Kan nog</span>';
  const sw=r.eind.fished>=1&&!done?'<button type="button" class="fs-chk'+(r.signed?' on':'')+'" data-fin="fs-signup" data-vid="'+A(r.vid)+'" aria-pressed="'+(r.signed?'true':'false')+'">'+(r.signed?'✓ Komt':'Komt?')+'</button>':'';
  return '<div class="fs-row fs-b-'+r.status+'"><button type="button" class="fs-main" data-fin="fs-open" data-vid="'+A(r.vid)+'" aria-expanded="'+open+'"><span class="fs-who"><strong>'+E(nameOf(d,r.vid))+(r.aow?' <span class="fin-badge">AOW</span>':'')+' '+lab+'</strong><small>'+fsStatus(r)+star+'</small></span><span class="fs-chev">'+(open?'▴':'▾')+'</span></button>'+sw+'</div>'+(open?fsSheet(p,r,pl?money(pz.sure.prizes[pl-1]||0):'',serieId):'');
 };
 const inMain=r=>r.group==='serie'||(r.group==='kans'&&r.signed&&r.projected>=ov.min)||r.vid===fs.open;/* losse vissers staan onder Losse deelname, tenzij ze op Komt staan en het minimum halen */
 const main=ov.rows.filter(inMain).sort((a2,b2)=>(a2.group===b2.group?0:a2.group==='serie'?-1:1)||sort(a2,b2));
 if(main.length)h+='<div class="card fs-list">'+main.map(rowHtml).join('')+'</div>';
 const los=ov.rows.filter(r=>!inMain(r)).sort(sort);
 if(los.length){
  h+='<button type="button" class="btn btn-gh fs-fold" data-fin="fs-los" aria-expanded="'+(fs.los?'true':'false')+'">Losse deelname · '+los.length+' '+(fs.los?'▴':'▾')+'</button>';
  if(fs.los)h+='<div class="card fs-list">'+los.map(rowHtml).join('')+'</div>';
 }
 h+='<div class="fin-toolbar">'+button(fs.rates?'Tarieven sluiten':'Tarieven','fs-rates')+button('Verversen','fs-reload')+'</div>';
 return '<div class="fs">'+h+'</div>';
}
function fsOnScreen(){return typeof currentScreen!=='undefined'&&currentScreen.kind==='serie-detail'&&currentScreen.tab==='financien'&&currentScreen.serieId===fs.serieId;}
/* Re-render the tab without jumping back to the top of the page. */
function fsRefresh(){
 if(!fs.serieId||typeof renderSerieTab!=='function'||!fsOnScreen())return;
 const y=[window.scrollY,document.documentElement.scrollTop,document.body.scrollTop];
 renderSerieTab(fs.serieId,'financien',false);
 window.scrollTo(0,y[0]);document.documentElement.scrollTop=y[1];document.body.scrollTop=y[2];
}
const nowIso=()=>new Date().toISOString();
/* Optimistic write: show the change at once, save it online, and reload from the server when saving fails. */
async function fsSave(serieId,apply,op){
 const b=bucket(serieId);apply(b);fsRefresh();
 try{const {error}=await op();if(error)throw error;}
 catch(e){noticeError(Error('Opslaan mislukt: '+(e.message||e)));await loadSerie(serieId,true);fsRefresh();}
}
async function fsAction(name,el){
 if(!isAdmin)throw Error('Log eerst in.');
 const id=fs.serieId,b=id?bucket(id):null;
 switch(name){
 case 'fs-filter':fs.filter=fs.filter===el.dataset.key?null:el.dataset.key;fs.open=null;fsRefresh();return;
 case 'fs-open':fs.open=fs.open===el.dataset.vid?null:el.dataset.vid;fsRefresh();return;
 case 'fs-ladder':fs.ladder=['sure','exp','max'].includes(el.dataset.mode)?el.dataset.mode:'exp';fsRefresh();return;
 case 'fs-view':fs.view=el.dataset.view==='volgende'?'volgende':'overzicht';fs.open=null;fsRefresh();return;
 case 'fs-signup':{const vid=el.dataset.vid,nr=fs.last.next;if(fs.last.toGo<=0)throw Error('Alle wedstrijden zijn al gevist.');const on=b.opgave[vid]===nr;
  return fsSave(id,x=>{if(on)delete x.opgave[vid];else x.opgave[vid]=nr;},()=>on?cloudClient.from('serie_opgave').delete().match({serie_id:id,visser_id:vid}):cloudClient.from('serie_opgave').upsert({serie_id:id,visser_id:vid,volgnummer:nr,updated_at:nowIso()},{onConflict:'serie_id,visser_id'}));}
 case 'fs-prizes':fs.prizes=!fs.prizes;fsRefresh();return;
 case 'fs-los':fs.los=!fs.los;fsRefresh();return;
 case 'fs-rates':fs.rates=!fs.rates;fsRefresh();return;
 case 'fs-reload':b.error='';await loadSerie(id,true);fsRefresh();return;
 case 'fs-mode':{const vid=el.dataset.vid,mode=el.dataset.mode;if(!['series','loose'].includes(mode))return;
  return fsSave(id,x=>{x.deel[vid]={serie_id:id,visser_id:vid,keuze:mode,betaald:false};},()=>cloudClient.from('serie_deelname').upsert({serie_id:id,visser_id:vid,keuze:mode,betaald:false,updated_at:nowIso()},{onConflict:'serie_id,visser_id'}));}
 case 'fs-paid':{const vid=el.dataset.vid,row=b.deel[vid];if(!row||row.keuze!=='series')throw Error('Kies eerst Serie.');const flag=!row.betaald;
  return fsSave(id,x=>{x.deel[vid]={...row,betaald:flag};},()=>cloudClient.from('serie_deelname').upsert({serie_id:id,visser_id:vid,keuze:'series',betaald:flag,updated_at:nowIso()},{onConflict:'serie_id,visser_id'}));}
 case 'fs-loose':{const vid=el.dataset.vid,c=getData().finance.entries.find(x=>x.id===el.dataset.entry);if(!c||!c.matchId)throw Error('Wedstrijd niet gevonden.');const wid=c.matchId,key=wid+'|'+vid,paid=!!b.los[key];
  return fsSave(id,x=>{if(paid)delete x.los[key];else x.los[key]=true;},()=>paid?cloudClient.from('serie_los_betaald').delete().match({serie_id:id,wedstrijd_id:wid,visser_id:vid}):cloudClient.from('serie_los_betaald').upsert({serie_id:id,wedstrijd_id:wid,visser_id:vid,updated_at:nowIso()},{onConflict:'serie_id,wedstrijd_id,visser_id'}));}
 }
}
async function fsSubmitRates(){
 if(!isAdmin)throw Error('Log eerst in.');
 const id=fs.serieId,v=x=>C.cents(read(x)),payRaw=read('fs-loose-payout').trim();
 const row={serie_id:id,club:v('fs-club'),fee:v('fs-fee'),fee_aow:v('fs-fee-aow'),loose_fee:v('fs-loose'),loose_fee_aow:v('fs-loose-aow'),loose_payout:payRaw===''?null:C.cents(payRaw),wedstrijden_totaal:read('fs-total').trim()===''?null:Math.max(1,Math.min(30,parseInt(read('fs-total'),10)||1)),updated_at:nowIso()};
 const {error}=await cloudClient.from('serie_tarief').upsert(row,{onConflict:'serie_id'});if(error)throw Error('Opslaan mislukt: '+(error.message||error));
 bucket(id).tarief=row;fs.rates=false;fsRefresh();showAppNotice('Tarieven opgeslagen.');
}
document.addEventListener('submit',ev=>{if(ev.target.id==='fs-rates-form'){ev.preventDefault();fsSubmitRates().catch(noticeError);}});
window.Finance={render,access,allowed,serieAllowed,openDetail,state,serieTab,summary:()=>C.summary(getData(),state.year),open:()=>C.open(getData(),state.year)};
updateAdminUi();
})();
