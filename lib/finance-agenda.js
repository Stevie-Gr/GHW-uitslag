/* Public schedule exposes fisher tariffs only. Preserve extra planning fields in the manual editor. */
(function(){
const previousPlanning=getRoosterPlanningItems;
getRoosterPlanningItems=function(...args){const items=previousPlanning(...args),d=getData();return items.map(item=>{const a=d.roosterItems.find(a=>a.id===item.id);if(!a)return item;const e=d.finance.entries.find(e=>e.agendaId===a.id),p=FinanceCore.seriesFor(d,e);return {...item,hengeltype:a.hengeltype||'',einddatum:a.einddatum||'',entryFee:(p||e)?.configured?(p?p.looseFee:e.fee):null,seriesFee:p?.configured?p.fee:null};});};
const previousTime=getRoosterTijdRegel;
getRoosterTijdRegel=function(item){const euro=n=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(n/100);return [previousTime(item),item.einddatum?'Einddatum: '+item.einddatum:'',item.hengeltype,item.entryFee!=null?'Inleg '+euro(item.entryFee)+' per wedstrijd':'',item.seriesFee!=null?euro(item.seriesFee)+' voor de hele serie':''].filter(Boolean).join(' · ');};
const previousEditor=renderRoosterBeheer;
renderRoosterBeheer=function(...args){const result=previousEditor(...args),field=document.getElementById('rooster-item-einde');if(field&&!document.getElementById('rooster-item-hengeltype')){const a=getData().roosterItems.find(a=>a.id===beheerRoosterEditId)||{};field.parentElement.insertAdjacentHTML('afterend','<div class="fg"><label>Hengeltype</label><select id="rooster-item-hengeltype"><option value="">Nog invullen</option><option>Vaste stok</option><option>Vrij</option></select></div><div class="fg"><label>Einddatum (alleen bij andere dag)</label><input type="date" id="rooster-item-einddatum"></div>');document.getElementById('rooster-item-hengeltype').value=a.hengeltype||'';document.getElementById('rooster-item-einddatum').value=a.einddatum||'';}return result;};
renderWelcomeDashboard();
})();
