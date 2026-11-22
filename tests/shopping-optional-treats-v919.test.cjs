'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','shopping-v678.js'),'utf8');
const start=source.indexOf('  const TREAT_IDEAS='),end=source.indexOf('  function shell(){',start);
assert(start>0&&end>start,'optional treat helpers must be present');
const state={products:[
  {id:'milka',active:true,brand:'Milka',product_name:'Danke Pralinen',category:'Süßigkeiten',package_quantity:114,package_unit:'g',nutrition_per_100:{energy_kcal:503},inventory_id:'stock-milka'},
  {id:'salty',active:true,brand:'Snack Day',product_name:'Salzstangen',category:'Salzige Snacks',package_quantity:250,package_unit:'g',nutrition_per_100:{energy_kcal:395},retailer:'Lidl',inventory_id:'stock-salty'},
  {id:'monster',active:true,brand:'Monster Energy',product_name:'Monster Energy Zero Sugar Original 500 ml',package_quantity:500,package_unit:'ml',retailer:'ALDI Nord',nutrition_per_100:{energy_kcal:3.4}},
  {id:'rice',active:true,brand:'ja!',product_name:'Naturreis',package_quantity:500,package_unit:'g',nutrition_per_100:{energy_kcal:350}}
],general:[],food:{inventory:[
  {id:'stock-milka',name:'Milka Pralinen',quantity:68.4,unit:'g',is_active:true},
  {id:'stock-salty',name:'Salzstangen',quantity:250,unit:'g',is_active:true}
]},treatDecisions:[]};
const normalize=x=>String(x||'').toLocaleLowerCase('de-DE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const monday=()=> '2026-11-16',now=()=> '2026-11-22';
const fmtQty=(v,u)=>v+' '+u;
const lib=new Function('state','shoppingNormalize','treatWeekStart','todayIso','esc','fmtQty','reload','client',source.slice(start,end)+'return {treatIdeaCards,optionalTreatMarkup,handleTreatAction,TREAT_IDEAS};')(
  state,normalize,monday,now,x=>String(x),fmtQty,async()=>{},()=>({})
);
test('all five distinct suggestions are available; unknown brands have NO fabricated calories',()=>{
 const cards=lib.treatIdeaCards();
 assert.deepEqual(cards.map(c=>c.key),['chips','chocolate','ice','energy','salty']);
 assert.equal(cards[0].kcal,null);
 assert.equal(cards[2].kcal,null);
 assert.equal(cards[0].productId,null);
 assert.equal(cards[2].productId,null);
});
test('known snack catalogue calories use actual package values and tested example portion',()=>{
 const cards=lib.treatIdeaCards();
 assert.equal(cards.find(x=>x.key==='energy').kcal,17);
 assert.equal(cards.find(x=>x.key==='chocolate').kcal,126);
 assert.equal(cards.find(x=>x.key==='salty').kcal,198);
 assert(cards.find(x=>x.key==='salty').inStock);
 assert(cards.find(x=>x.key==='chocolate').inStock);
 assert(!cards.find(x=>x.key==='energy').inStock);
 assert(!cards.some(x=>/reis/i.test(x.title)));
});
test('stocked items are presented for using up, not compulsory purchase',()=>{
 const html=lib.optionalTreatMarkup();
 assert.match(html,/OPTIONAL/);
 assert.match(html,/Bereits im Vorrat: 68.4 g/);
 assert.match(html,/data-treat-add="chips"/);
 assert.match(html,/data-treat-add="energy"/);
 assert.doesNotMatch(html,/data-treat-add="chocolate"/);
 assert.doesNotMatch(html,/data-treat-add="salty"/);
 assert.match(html,/kcal erst nach Produktwahl/);
 assert.match(html,/kein Pflichtkauf/i);
});
test('weekly dismissed and already accepted ideas cannot duplicate shopping wish',()=>{
 state.treatDecisions=[{week_start:'2026-11-16',idea_key:'ice',status:'dismissed'}];
 state.general=[{source_key:'optional-treat:2026-11-16:energy'}];
 const keys=lib.treatIdeaCards().map(x=>x.key);
 assert.deepEqual(keys,['chips','chocolate','salty']);
});
test('weekly decisions do not hide next week suggestions',()=>{
 state.treatDecisions=[{week_start:'2026-11-09',idea_key:'ice',status:'dismissed'}];
 state.general=[];
 assert.equal(lib.treatIdeaCards().length,5);
});
