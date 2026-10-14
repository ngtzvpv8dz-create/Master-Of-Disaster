'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','food-nutrition-v711.js'),'utf8');
const begin=source.indexOf('  function patchMeta(');
const end=source.indexOf('  // Je Mahlzeit:',begin);
assert.ok(begin>=0&&end>begin,'Nutrition patch implementation exists');
const patchMeta=new Function('nutritionText',
  source.slice(begin,end)+'return patchMeta;'
)(n=>Math.round(n.kcal)+' kcal · '+n.protein+' g Protein');

function mealCard(base='1 Portion · Geplant'){
  const attributes=new Map();
  const em={
    textContent:base,
    title:'',
    hasAttribute:key=>attributes.has(key),
    getAttribute:key=>attributes.get(key),
    setAttribute:(key,value)=>attributes.set(key,String(value)),
    removeAttribute:key=>attributes.delete(key)
  };
  return {em,card:{dataset:{},querySelector:()=>em}};
}

test('repeated missing tomato nutrition does not multiply Klasse I',()=>{
  const {em,card}=mealCard();
  for(let i=0;i<75;i++){
    assert.equal(patchMeta(card,{complete:false,missing:['Rispentomaten aus Niedersachsen · Klasse I']}),false);
  }
  assert.equal((em.textContent.match(/Klasse I/g)||[]).length,1);
  assert.equal((em.textContent.match(/Nährwerte prüfen:/g)||[]).length,1);
  assert.ok(em.textContent.length<170);
  assert.match(em.textContent,/1 Portion/);
  assert.match(em.textContent,/Geplant/);
});

test('valid nutrition replaces an earlier message containing separators and remains stable',()=>{
  const {em,card}=mealCard('2 Wraps · Geplant');
  patchMeta(card,{complete:false,missing:['Rispentomaten aus Niedersachsen · Klasse I']});
  for(let i=0;i<75;i++)patchMeta(card,{complete:true,kcal:430.4,protein:29.2,missing:[]});
  assert.equal(em.textContent,'2 Wraps · 430 kcal · 29.2 g Protein · Geplant');
  assert.ok(!em.title);
  assert.equal(card.dataset.foodNutritionV711,'dynamic');
});

test('same-element nutrition recalculation uses initial meal heading, not last render',()=>{
  const {em,card}=mealCard('1 Portion · Vorbereitung · Geplant');
  patchMeta(card,{complete:true,kcal:280,protein:21,missing:[]});
  patchMeta(card,{complete:true,kcal:300,protein:22,missing:[]});
  assert.equal(em.textContent,'1 Portion · Vorbereitung · 300 kcal · 22 g Protein · Geplant');
});
