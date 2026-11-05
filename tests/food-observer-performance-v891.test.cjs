'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const original=fs.readFileSync(path.join(__dirname,'..','food-nutrition-v711.js'),'utf8');
const anchor='  schedule(450);\n})();';
assert.equal(original.split(anchor).length,2,'stable nutrition module test insertion point');
const instrumented=original.replace(anchor,
  '  window.__modFoodNutritionV711.__test={isFoodRenderNode};\n'+anchor);

function setup(){
  let callback=null,scheduled=0;
  const window={};
  const document={documentElement:{},addEventListener(){}};
  class MutationObserver{constructor(fn){callback=fn;}observe(){}}
  const schedule=()=>++scheduled;
  new Function('window','document','MutationObserver','setTimeout','clearTimeout',instrumented)(
    window,document,MutationObserver,schedule,()=>{});
  assert.equal(typeof callback,'function');
  const node=(selector,hasChild=false)=>({
    nodeType:1,
    matches:query=>query.split(', ').includes(selector),
    querySelector:query=>hasChild&&query.includes('[data-food-meal-card]')?{}:null
  });
  const emit=addedNodes=>callback([{type:'childList',addedNodes}]);
  return {node,emit,get count(){return scheduled;},helper:window.__modFoodNutritionV711.__test.isFoodRenderNode};
}

test('unrelated DOM, own warning inserts and text nodes cannot reload nutrition',()=>{
  const app=setup(),before=app.count;
  app.emit([app.node('.food-nutrition-card-warning-v795')]);
  app.emit([app.node('#food-extra-snacks-v828')]);
  app.emit([app.node('.mod-app-hub-v515')]);
  app.emit([{nodeType:3}]);
  assert.equal(app.count,before);
});

test('new Food meals, recipes and relevant Food subtree still schedule refresh',()=>{
  const app=setup(),before=app.count;
  app.emit([app.node('[data-food-meal-card]')]);
  app.emit([app.node('[data-food-recipe-card]')]);
  app.emit([app.node('.food-content-v544')]);
  app.emit([app.node('.new-section',true)]);
  assert.equal(app.count,before+4);
});
