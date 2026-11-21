'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const migration=fs.readFileSync(path.join(__dirname,'..','supabase','migrations',
  '20261121092300_food_preserve_consumed_lot_provenance_v912.sql'),'utf8');
const [functionsSource]=migration.split('DO $validation$');
test('every lot-consuming SQL function retains zero-quantity historical lots',()=>{
  assert.match(functionsSource,/CREATE OR REPLACE FUNCTION public\.consume_food_inventory_lots\(/);
  assert.match(functionsSource,/CREATE OR REPLACE FUNCTION public\.consume_food_inventory_lots_for_meal\(/);
  assert.doesNotMatch(functionsSource,/delete\s+from\s+public\.food_inventory_lots\b/i);
  const closed=[...functionsSource.matchAll(/UPDATE public\.food_inventory_lots\s+SET unopened_packages=0,\s+opened_packages=0,\s+opened_remaining_quantity=NULL,\s+opened_remaining_unit=NULL/gi)];
  assert.equal(closed.length,5,'all five prior deletions now preserve the historic lot id');
});
