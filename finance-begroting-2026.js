/* One-off: club budget 2026 (source: Boekhouding/bron/Begroting 2026.xlsx). Used only to pre-fill the year plan download for 2026. */
(function(root){
'use strict';
const P=typeof module!=='undefined'&&module.exports?require('./finance-plan.js'):root.FinancePlan;
// [title, euro, form, water]. form: 'serie' | 'koppel' | 'gescheiden_koppel' | 'solo' | 'expense' | '' (user decides). With a water, the hint is matched to the n-th match of that form on that water by date.
P.hints[2026]=[
 ['Winterserie',40,'serie'],['Voorjaarsserie',110,'serie'],['Spui koppel 1',30,'koppel','Spui'],['Spui koppel 2',30,'koppel','Spui'],['Spui individueel',15,'solo','Spui'],
 ['Vakantiewedstrijd 1',15,'solo'],['Vakantiewedstrijd 2',15,'solo'],['Vakantiewedstrijd 3',30,'solo'],['Vakantiewedstrijd 4',15,'solo'],['Vakantiewedstrijd 5',15,'solo'],
 ['Herfstserie',110,'serie'],['Kerstserie',125,'serie'],['Boerengat koppel 1',30,'koppel','Boerengat'],['Boerengat koppel 2',30,'koppel','Boerengat'],['Boerengat koppel 3',30,'koppel','Boerengat'],
 ['Wantij koppel',30,'koppel','Wantij'],['Kanaal van steenenhoek individueel',15,'solo','Kanaal van Steenenhoek'],['Maas bij Lith',30,'','Maas bij Lith'],['Bergse Maas Koppel',30,'koppel','Bergse Maas'],
 ['Kanaal door Voorne gescheiden koppel',30,'gescheiden_koppel','Kanaal door Voorne'],['Kanaal door Voorne gescheiden koppel',30,'gescheiden_koppel','Kanaal door Voorne'],['Blinde koppel',30,'koppel'],
 ['Nachtmarathon',75,''],['Jeugddag',500,''],['Noord-Holland Cup',30,''],['C. Orgers Bokaal',200,''],['Kreekcup',100,''],['Sint Nicolaaswedstrijd',75,''],
 ['Inkt/papier',250,'expense'],['Toeters en weegschalen',100,'expense'],['Kanjercompetitie',100,''],['Vergunning Noord-Holland Markervaart',40,'expense'],['Vergunning Kinselmeer',130,'expense']
].map(([title,euro,form,water])=>({title,planned:euro*100,form,water:water||''}));
P.hints[2026].budget=243500;
})(typeof window!=='undefined'?window:this);
