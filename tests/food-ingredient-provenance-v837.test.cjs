const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const food=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');
const runtime=fs.readFileSync(path.join(__dirname,'..','area-runtime-v609.js'),'utf8');

// Protect compound family labels against disappearing source allocations.
const start=food.indexOf('  const familyText=value=>');
const end=food.indexOf('  const familyRowMode=',start);
assert(start>=0&&end>start,'Family matching helpers found');
const context={
  FAMILY_FRESH_QUALIFIERS:new Set(['frisch','bio']),
  FAMILY_FROZEN_QUALIFIERS:new Set(['tk','gefroren'])
};
vm.createContext(context);
vm.runInContext(food.slice(start,end)+'\nthis.match=familyNeedMatch;',context);
for(const name of ['Feta / Hirtenkäse','Feta','Hirtenkäse']){
  assert.equal(context.match(name,'Feta / Hirtenkäse')?.matched,true,
    'Feta family must resolve for '+name);
}
assert.equal(context.match('Tomaten','Feta / Hirtenkäse'),null,
  'Different ingredients cannot be matched as Feta');

// Do not drop source information silently for ingredients without a link.
assert(food.includes('allocationMarkup(allocation,item)||missingIngredientSourceMarkup(item)'),
  'All planned and recipe ingredients need source display or explicit status');
assert(food.includes('const original=Array.isArray(snapshot?.ingredients)') &&
  food.includes('const itemRows=original.filter(item=>item?.eaten_only_extra!==true)'),
  'Unmatched historical ingredients remain visible even when no source was recorded');
assert(food.includes('snapshot?.sources'),
  'Historical sources must still use immutable saved meal snapshot');
assert(/food-v544\.js\?v=\d+-/.test(runtime),
  'All FOOD entry points need updated cache version');
console.log('PASS: Feta whole/alias matching and consistent provenance fallbacks');


// V930: A consumed Haferkeks must not appear twice merely because its saved
// physical product is named "ja! Hafergebäck". Ambiguous weights stay separate.
const preparedStart=food.indexOf('  function preparedIngredientListMarkup(meal){');
const preparedEnd=food.indexOf('  // A missing product link is visible',preparedStart);
assert(preparedStart>=0&&preparedEnd>preparedStart,'Prepared source renderer exists');
Object.assign(context,{
  state:{ingredientIdentities:[]},
  fmtQty:(n,u)=>n+' '+u,
  num:n=>n===null||n===undefined?null:Number(n),
  ingredientQuantityForDisplay:item=>item.quantity+' '+item.unit,
  esc:v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
});
vm.runInContext(food.slice(food.indexOf('  const ingredientName=item=>'),food.indexOf('  // Physical bread slices remain whole'))+'\n'+food.slice(preparedStart,preparedEnd)+'\nthis.renderPrepared=preparedIngredientListMarkup;',context);
const snackHtml=context.renderPrepared({
  ingredients:[],
  prepared_sources_snapshot:{
    ingredients:[
      {name:'H-Milch 1,5 %',quantity:250,unit:'ml'},
      {name:'Haferkeks',quantity:30,unit:'g'},
      {name:'Protein Coffee Classic Coffee',quantity:30,unit:'g'}
    ],
    sources:[
      {name:'ja! Hafergebäck',label:'ja! Hafergebäck · knuspriges Gebäck aus Schweden, 600 g',quantity:30,unit:'g'},
      {name:'Protein Coffee Classic Coffee',label:'MaxiNutrition MaxPresso · Classic Coffee',quantity:30,unit:'g'},
      {name:'H-Milch 1,5 %',label:'Milbona H-Milch',quantity:250,unit:'ml'}
    ]
  }
});
assert.equal((snackHtml.match(/<li\b/g)||[]).length,3,
  '30 g Hafergebäck is an allocation of Haferkeks, not a fourth ingredient');
assert.match(snackHtml,/<span>Haferkeks<\/span><b>30 g<\/b>/);
assert.match(snackHtml,/ja! Hafergebäck/);
const ambiguousHtml=context.renderPrepared({
  ingredients:[],
  prepared_sources_snapshot:{
    ingredients:[{name:'A',quantity:30,unit:'g'},{name:'B',quantity:30,unit:'g'}],
    sources:[{name:'X',quantity:30,unit:'g'},{name:'Y',quantity:30,unit:'g'}]
  }
});
assert.equal((ambiguousHtml.match(/<li\b/g)||[]).length,4,
  'Equal weights with multiple candidates must not be assigned by guesswork');
console.log('PASS: historical Haferkeks mapping is unique and ambiguous aliases stay separate');
