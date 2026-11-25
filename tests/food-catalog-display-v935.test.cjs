'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');
const cut=code.indexOf('  const api={');
const window={addEventListener(){}};
const document={addEventListener(){},documentElement:{},body:{classList:{contains(){return false;}}}};
new Function('window','document','MutationObserver',code.slice(0,cut)+'window.__test={canonicalIngredientName,canonicalInstructionText,ingredientName,setState:v=>{state=v}};})();')(window,document,class{});
const {canonicalIngredientName:display,canonicalInstructionText:instructions,ingredientName:booking,setState}=window.__test;
test('canonical labels and old booking keys are separate',()=>{
 const item={name:'Spinat TK',quantity:300,unit:'g',inventory_id:'spinach'};
 setState({ingredientIdentities:[{source_name:'Spinat TK',inventory_id:'spinach',canonical_name:'Blattspinat, tiefgekühlt',resolution:'matched'}]});
 const before=JSON.stringify(item);
 assert.equal(display(item),'Blattspinat, tiefgekühlt');assert.equal(booking(item),'Spinat TK');
 assert.equal(JSON.stringify(item),before);
 assert.equal(instructions(['300 g Spinat TK erhitzen.'],[item])[0],'300 g Blattspinat, tiefgekühlt erhitzen.');
});
test('history follows confirmed fresh and frozen source, not current stock',()=>{
 assert.equal(display({name:'Spinat'},{name:'Babyspinat frisch',frozen:false}),'Blattspinat, frisch');
 assert.equal(display({name:'Spinat'},{name:'Blattspinat TK',frozen:true}),'Blattspinat, tiefgekühlt');
 assert.equal(display({name:'Spinat'}),'Blattspinat, Zustand offen');
});
test('catalogue refresh applies new matches; ambiguous names are not guessed',()=>{
 setState({ingredientIdentities:[{source_name:'Example',inventory_id:'a',canonical_name:'Variante A',resolution:'matched'},{source_name:'Example',inventory_id:'b',canonical_name:'Variante B',resolution:'matched'}]});
 assert.equal(display({name:'Example',inventory_id:'b'}),'Variante B');assert.equal(display({name:'Example'}),'Example');
 setState({ingredientIdentities:[{source_name:'Example',canonical_name:'Neuer Name',resolution:'matched'}]});
 assert.equal(display({name:'Example'}),'Neuer Name');
 assert.equal(display({name:'Eier Größe M'}),'Hühnereier, Größe M');
 assert.equal(display({name:'Mango (essbar)'}),'Mango, frisch');
});

test('position-level recipe selection and actual historical source override shared generic name',()=>{
 setState({ingredientIdentities:[
  {source_name:'Kartoffeln',canonical_name:'Kartoffeln, Kochtyp offen',resolution:'variant_open'},
  {ingredient_id:'historic',original_name:'Kartoffeln',canonical_name:'Kartoffeln, festkochend',resolution:'historical_documented'},
  {ingredient_id:'future',original_name:'Kartoffeln',canonical_name:'Kartoffeln, festkochend oder vorwiegend festkochend',resolution:'flexible'}
 ]});
 assert.equal(display({id:'historic',name:'Kartoffeln'}),'Kartoffeln, festkochend');
 assert.equal(display({id:'future',name:'Kartoffeln'}),'Kartoffeln, festkochend oder vorwiegend festkochend');
 assert.equal(display({id:'historic',name:'Kartoffeln'},{name:'Kartoffeln',label:'Gala · vorwiegend festkochend'}),'Kartoffeln, vorwiegend festkochend');
 assert.equal(display({name:'Miso-Paste',label:'35 g Miso-Paste hell'}),'Misopaste, hell');
 assert.equal(display({name:'Miso-Paste'},{name:'Miso-Paste dunkel'}),'Misopaste, dunkel');
 assert.equal(display({name:'Zwiebel'},{name:'Zwiebel',label:'Speisezwiebeln',frozen:false}),'Zwiebeln, frisch, Farbe nicht dokumentiert');
});
