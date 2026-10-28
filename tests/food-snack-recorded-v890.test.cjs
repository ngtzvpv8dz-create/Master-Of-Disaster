'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const food=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');

test('completed snacks use the existing preparation status without a duplicate row',()=>{
  assert.doesNotMatch(food,/recordedSnack|Bereits als zubereitet gespeichert|kein zweiter Vorratsabzug/);
  assert.match(food,/const action=status==='planned'/);
  assert.match(food,/const statusMeta=status==='completed'/);
  assert.match(food,/mealPlanMeta\(meal\)\+' · '\+statusMeta/);
  assert.match(food,/complete_food_meal/);
});
