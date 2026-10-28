'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const food=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');

test('completed snack shows recorded confirmation without repeat booking action',()=>{
  assert.match(food,/const recordedSnack=status==='completed'&&meal[.]meal_type==='snack'/);
  assert.match(food,/✓ Bereits als zubereitet gespeichert/);
  assert.equal((food.match(/[+]recordedSnack/g)||[]).length,3);
  assert.match(food,/const action=status==='planned'/);
  assert.match(food,/complete_food_meal/);
});
