/* Fishing waters: one place per water for the draw location and default times. */
(function(root){
'use strict';
const norm=x=>String(x??'').trim().toLocaleLowerCase('nl');
const fields=['location','gather','start','end'];
const labels={name:'Viswater',location:'Locatie loting',gather:'Lotingtijd',start:'Starttijd',end:'Eindtijd'};
function list(d){d.finance=d.finance||{};if(!Array.isArray(d.finance.waters))d.finance.waters=derive(d);return d.finance.waters;}
function find(d,name){return list(d).find(w=>norm(w.name)===norm(name));}
/* Derive from history: per water the most frequently used location and times. */
function derive(d){
 const groups=new Map();
 for(const r of d.roosterItems||[]){if(r.type!=='wedstrijd'||!norm(r.water))continue;const k=norm(r.water);if(!groups.has(k))groups.set(k,{name:String(r.water).trim(),values:{location:[],gather:[],start:[],end:[]}});const g=groups.get(k);for(const [f,src] of [['location','locatie'],['gather','verzamelen'],['start','starttijd'],['end','eindtijd']])if(norm(r[src]))g.values[f].push(String(r[src]).trim());}
 for(const w of d.wedstrijden||[]){if(!norm(w.water))continue;const k=norm(w.water);if(!groups.has(k))groups.set(k,{name:String(w.water).trim(),values:{location:[],gather:[],start:[],end:[]}});const g=groups.get(k);for(const [f,src] of [['location','locatie'],['gather','verzamelen'],['start','starttijd'],['end','eindtijd']])if(norm(w[src]))g.values[f].push(String(w[src]).trim());}
 const mode=xs=>{if(!xs.length)return '';const n=new Map();for(const x of xs)n.set(norm(x),(n.get(norm(x))||0)+1);const best=[...n.entries()].sort((a,b)=>b[1]-a[1])[0][0];return xs.find(x=>norm(x)===best);};
 return [...groups.values()].map(g=>({name:g.name,location:mode(g.values.location),gather:mode(g.values.gather),start:mode(g.values.start),end:mode(g.values.end)})).sort((a,b)=>a.name.localeCompare(b.name,'nl'));
}
function upsert(d,water){
 const name=String(water.name||'').trim();if(!name)throw Error('Vul een naam voor het viswater in.');
 const waters=list(d);let w=waters.find(w=>norm(w.name)===norm(name));if(!w){w={name,location:'',gather:'',start:'',end:''};waters.push(w);}
 w.name=name;for(const f of fields)if(water[f]!==undefined)w[f]=String(water[f]||'').trim();
 waters.sort((a,b)=>a.name.localeCompare(b.name,'nl'));return w;
}
function remove(d,name){const waters=list(d);const i=waters.findIndex(w=>norm(w.name)===norm(name));if(i>=0)waters.splice(i,1);}
/* Fill blank planning fields of a row from the water's defaults. Filled values on the row always win. */
function complete(d,row){const w=find(d,row.water);if(!w)return row;const out={...row};for(const f of fields)if(!norm(out[f])&&norm(w[f]))out[f]=w[f];return out;}
const api={list,find,derive,upsert,remove,complete,fields,labels};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FinanceWaters=api;
})(typeof window!=='undefined'?window:this);
