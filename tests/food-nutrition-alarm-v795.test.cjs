const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const nutrition=fs.readFileSync(path.join(__dirname,'..','food-nutrition-v711.js'),'utf8');
const food=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','food-v544.css'),'utf8');
const start=nutrition.indexOf('  function nutritionProblem(item,data,allocationOverride=null){');
const end=nutrition.indexOf('\n  function patchNutritionAlarm(',start);
assert(start>0&&end>start,'Nutrition problem diagnostics and warning markup must exist');
const context={
  ZERO_NAMES:new Set(['wasser','leitungswasser','salz']),
  text:x=>String(x||'').trim().toLocaleLowerCase('de-DE'),
  key:x=>String(x||'').toLocaleLowerCase('de-DE').replace(/[^a-z0-9äöüß]+/g,''),
  number:x=>x===null||x===undefined||x===''?null:(Number.isFinite(Number(x))?Number(x):null),
  itemName:x=>String(x.name||x.label||'Zutat'),
  nutritionOf:p=>({kcal:p?.nutrition_per_100?.energy_kcal??null,protein:p?.nutrition_per_100?.protein_g??null}),
  genericFamilyAllocation:()=>null,
  genericFamilyNutrition:()=>null,
  // Simulate an old catalogue product with valid nutrition, currently chosen
  // as fallback. A new package in the SAME inventory must still raise an alarm.
  sourceFor:()=>({nutrition:{kcal:63,protein:2.2},product:null,stock:null}),
  basisAmount:item=>Number(item.quantity)
};
vm.createContext(context);
vm.runInContext(nutrition.slice(start,end)+'\nthis.audit=nutritionProblem;this.warningMarkup=mealNutritionWarningMarkup;',context);

const ingredient={id:'vegetable-1',inventory_id:'asia-stock',name:'Gemüsepfanne Asiatische Art',unit:'g',quantity:360};
const stock={id:'asia-stock',name:'Gemüsepfanne Asiatische Art',quantity:710,unit:'g'};
const oldProduct={id:'old-750',brand:'Freshona',product_name:'Gemüsepfanne Asiatische Art',variant:'750-g-Packung',nutrition_per_100:{energy_kcal:63,protein_g:2.2}};
const newProduct={id:'new-600',brand:'Freshona',product_name:'Bio-Gemüse Asia',variant:'600-g-Packung',nutrition_per_100:{}};
const data={
  inventory:[stock],
  products:[oldProduct,newProduct],
  lots:[{inventory_id:'asia-stock',product_id:'new-600',unopened_packages:1,opened_remaining_quantity:null}]
};
const warning=context.audit(ingredient,data);
assert(warning,'Active 600g package missing nutrition MUST raise an alert despite old product data');
assert.match(warning.reason,/Bio-Gemüse Asia/);
assert.match(warning.reason,/Kalorien und Protein/);
assert.equal(warning.id,'vegetable-1');
const html=context.warningMarkup([{id:'meal-1',type:'dinner',title:'Hähnchen-Reis-Wokpfanne',issues:[warning]}]);
assert.match(html,/WICHTIG: NÄHRWERTE FEHLEN/);
assert.match(html,/Abendessen/);
assert.match(html,/Hähnchen-Reis-Wokpfanne/);
assert.match(html,/Gemüsepfanne Asiatische Art/);
assert.match(html,/data-food-nutrition-goto="meal-1"/);

// Updating nutrition MUST clear the warning on the next refresh.
data.products=[oldProduct,{...newProduct,nutrition_per_100:{energy_kcal:46,protein_g:1.6}}];
assert.equal(context.audit(ingredient,data),null,'Known complete product must stop alarming');
// Provisional product nutrition still triggers a visible warning, without
// treating an estimated energy total as a missing numeric value.
data.products=[oldProduct,{...newProduct,nutrition_per_100:{energy_kcal:46,protein_g:1.6},
  product_data:{nutrition_provisional:true,nutrition_requires_packaging_check:true}}];
const provisional=context.audit(ingredient,data);
assert.equal(provisional.provisional,true);
assert.match(provisional.reason,/vorläufig/);
assert.match(context.warningMarkup([{id:'meal-1',type:'dinner',title:'Hähnchen-Reis-Wokpfanne',issues:[provisional]}]),/NÄHRWERTE UNBESTÄTIGT/);


const missingProtein={...newProduct,nutrition_per_100:{energy_kcal:46}};
data.products=[oldProduct,missingProtein];
assert.match(context.audit(ingredient,data).reason,/Protein/);
assert.doesNotMatch(context.audit(ingredient,data).reason,/Kalorien und Protein/);

// Salt and water intentionally have 0 kcal without product lookup.
assert.equal(context.audit({id:'salt-1',name:'Salz',quantity:1,unit:'g'},data),null);
assert.equal(context.audit({id:'water-1',name:'Wasser',quantity:300,unit:'ml'},data),null);
assert.match(food,/data-food-nutrition-alarm/);
assert.match(food,/data-food-ingredient-id/);
assert(food.indexOf('data-food-nutrition-alarm')<food.indexOf('data-food-day-summary-today'),
  'Warning must precede day totals directly under the Tagesplan heading');
assert.match(nutrition,/patchMealNutritionProblems\(card,issues\)/);
assert.match(nutrition,/patchNutritionAlarm\(root,todayWarnings\)/);
assert.match(css,/food-nutrition-ingredient-bad-v795/);
assert.match(css,/food-nutrition-alarm-flame-v795/);
console.log('PASS: V795 missing nutrition alarm pinpoints meal, active purchase product and ingredient; salt zero; alarms clear on repair');
