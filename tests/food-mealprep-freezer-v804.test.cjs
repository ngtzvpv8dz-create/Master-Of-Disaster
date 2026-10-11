'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'food-v544.js'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261011170000_food_mealprep_freezer_lifecycle_v804.sql'),'utf8');

test('V804 food frontend parses',()=>{
  assert.doesNotThrow(()=>new vm.Script(source,{filename:'food-v544.js'}));
});

test('meal prep freezer is a separate cloud source with TK and thaw sections',()=>{
  for(const token of [
    'food_mealprep_freezer_portions','mealPrepFreezer:take',
    'function mealprepFreezerMarkup','function bookedMealPrepFreezeMarkup',
    "cookedFrozen.map(row=>mealprepFreezerMarkup(row))",
    'cookedDue.map(row=>mealprepFreezerMarkup',
    'cookedLater.map(row=>mealprepFreezerMarkup',
    'register_food_mealprep_frozen','advance_food_mealprep_freezer',
    'is-frozen-mealprep-v804'
  ])assert(source.includes(token),token);
});

test('prepared meal prep has independent lifecycle from raw freezer lots',()=>{
  assert(migration.includes('CREATE TABLE IF NOT EXISTS public.food_mealprep_freezer_portions'));
  assert(migration.includes('REFERENCES public.food_leftovers'));
  assert(migration.includes('meal_id uuid UNIQUE'));
  assert(migration.includes("status IN ('frozen','thawing','thawed','consumed','cancelled')"));
  assert(migration.includes('ENABLE ROW LEVEL SECURITY'));
  assert(migration.includes('auth.uid()'));
  assert(migration.includes('sync_food_mealprep_freezer_meal'));
  assert(migration.includes("NEW.status='completed'"));
});
