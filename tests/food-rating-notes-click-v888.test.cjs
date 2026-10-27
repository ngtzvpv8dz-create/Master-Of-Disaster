'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');

function sliceBetween(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'Missing FOOD code boundaries: '+start);
  return source.slice(a,b);
}
test('Clicking feedback <summary> is intercepted before the meal card click handler can rebuild it',()=>{
  const handlers={};
  const card={
    dataset:{foodMealCard:'meal-123'},
    addEventListener:(name,handler)=>{handlers[name]=handler;}
  };
  const ctx={
    root:{querySelectorAll:()=>[card]},
    toggleMealCard:()=>{ctx.toggled=(ctx.toggled||0)+1;}
  };
  vm.createContext(ctx);
  vm.runInContext(sliceBetween(
    "    root.querySelectorAll('[data-food-meal-card]')",
    "    root.querySelectorAll('[data-food-cart-toggle]')"
  ),ctx);
  const acceptedSelectors=[];
  const feedbackEvent={target:{closest:selector=>{
    acceptedSelectors.push(selector);
    return selector.includes('.food-rating-note-v887')?{}:null;
  }}};
  handlers.click(feedbackEvent);
  assert.equal(ctx.toggled||0,0,'Feedback click should NOT toggle the meal');
  assert.ok(acceptedSelectors.some(s=>s.includes('details')&&s.includes('summary')));
  handlers.click({target:{closest:()=>null}});
  assert.equal(ctx.toggled,1,'Clicking the normal meal card still toggles it');
});

test('Native feedback details click stays within its component and toggle state survives rerenders',()=>{
  const handlers={};
  const form={dataset:{foodNoteKind:'recipe',foodNoteId:'recipe-xyz'}};
  const noteDetails={open:true,querySelector:()=>form,addEventListener:(type,cb)=>{handlers[type]=cb;}};
  const ctx={
    root:{querySelectorAll:()=>[noteDetails]},
    expandedRatingNotes:new Set(),
  };
  vm.createContext(ctx);
  vm.runInContext(sliceBetween(
    "    root.querySelectorAll('[data-food-rating-note-details]')",
    "    root.querySelectorAll('[data-food-rating-note-form]')"
  ),ctx);
  let stopped=false;
  handlers.click({stopPropagation:()=>{stopped=true;}});
  assert.equal(stopped,true);
  handlers.toggle();
  assert.equal(ctx.expandedRatingNotes.has('recipe:recipe-xyz'),true);
  noteDetails.open=false;
  handlers.toggle();
  assert.equal(ctx.expandedRatingNotes.has('recipe:recipe-xyz'),false);
});

test('Notes render editable textarea, existing feedback and preserve expanded state',()=>{
  const ctx={
    esc:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
    expandedRatingNotes:new Set(['recipe:r1'])
  };
  vm.createContext(ctx);
  vm.runInContext(sliceBetween('  function ratingNoteControl(entry,kind=\'recipe\'){','  async function saveRatingNote(')+'\nthis.renderNote=ratingNoteControl;',ctx);
  const html=ctx.renderNote({id:'r1',rating_note:'Weniger Wasser & kein Chaos'},'recipe');
  assert.match(html,/data-food-rating-note-details open/);
  assert.match(html,/textarea name="rating_note"/);
  assert.match(html,/Weniger Wasser &amp; kein Chaos/);
  assert.match(html,/Anmerkung zur Planung · vorhanden/);
  assert.match(html,/data-food-note-kind="recipe"/);
  const other=ctx.renderNote({id:'m1'},'meal');
  assert.doesNotMatch(other,/data-food-rating-note-details open/);
  assert.match(other,/Anmerkung zur Planung hinzufügen/);
});
