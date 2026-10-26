'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const food=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');
const nutrition=fs.readFileSync(path.join(__dirname,'..','food-nutrition-v711.js'),'utf8');
const between=(source,start,end)=>{
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert(a>=0&&b>a,'Source boundary missing '+start);
  return source.slice(a,b);
};

test('Completed generic food recognizes exactly one historical nutrition source after the stock lot is consumed',()=>{
  const ctx={text:v=>String(v??'').trim().toLocaleLowerCase('de-DE'),
    number:v=>v==null?null:Number(v),itemName:v=>v.name};
  vm.createContext(ctx);
  vm.runInContext(between(nutrition,'  function withPreparedNutrition(items,meal){','  function nutritionForMeal(')+'\nthis.match=withPreparedNutrition;',ctx);
  const data={status:'completed',prepared_sources_snapshot:{sources:[
    {inventory_id:'gut-guenstig',name:'Körniger Frischkäse',unit:'g',quantity:210,nutrition_per_100:{energy_kcal:73,protein_g:12}},
    {inventory_id:'apple',name:'Pink Lady',unit:'Stück',quantity:1}
  ]}};
  const ingredient={id:'snack',name:'Körniger Frischkäse',inventory_id:null,unit:'g',quantity:210};
  const matched=ctx.match([ingredient],data)[0];
  assert.equal(matched.prepared_nutrition_per_100.energy_kcal,73);
  assert.equal(matched.prepared_nutrition_per_100.protein_g,12);
  assert.equal(ctx.match([{...ingredient,quantity:100}],data)[0].prepared_nutrition_per_100,undefined);
  assert.equal(ctx.match([{...ingredient,inventory_id:'other'}],data)[0].prepared_nutrition_per_100,undefined);
  assert.equal(ctx.match([ingredient],{...data,status:'planned'})[0].prepared_nutrition_per_100,undefined);
  const ambiguous={...data,prepared_sources_snapshot:{sources:[...data.prepared_sources_snapshot.sources,
    {...data.prepared_sources_snapshot.sources[0],inventory_id:'second'}]}};
  assert.equal(ctx.match([ingredient],ambiguous)[0].prepared_nutrition_per_100,undefined);
});

test('Today, Plan and History all render stars for recipe and standalone meals',()=>{
  const renderer=between(food,'  function mealCard(meal,inHistory=false){','  function todayView(data){');
  assert.match(renderer,/const mealRatingMarkup=status!=='skipped'/);
  assert.match(renderer,/historyRecipe\?recipeRatingControl\(historyRecipe\):recipeRatingControl\(meal,'meal'\)/);
  assert.equal((renderer.match(/\+mealRatingMarkup/g)||[]).length,3);
  assert.doesNotMatch(renderer,/inHistory&&status==='completed'/);
  assert.match(food,/data-food-rate-meal/);
  assert.match(food,/setMealRating\(button.dataset.foodRateMeal/);
  assert.match(food,/rating,rating_updated_at,food_meal_ingredients/);
  assert.match(food,/\.update\(\{rating:next,rating_updated_at:next===null\?null:new Date\(\)\.toISOString\(\)\}\)/);
});
