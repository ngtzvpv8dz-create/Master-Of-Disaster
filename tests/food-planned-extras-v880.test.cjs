'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=x=>fs.readFileSync(path.join(__dirname,'..',x),'utf8');
const proposed=read('food-planned-extras-v880.js');
const logged=read('food-extra-snacks-v828.js');
const nutrition=read('food-nutrition-v711.js');
const loader=read('area-runtime-v609.js');
const migration=read('supabase/migrations/20261025185641_food_planned_extras_genussbudget_v1.sql');

test('optional Genuss-Extras mount after actual snack area in FOOD today',()=>{
 assert.match(loader,/food-planned-extras-v880[.]js[?]v=\d+-/);
 assert.match(proposed,/extra[.]insertAdjacentElement\('afterend',el\)/);
 assert.match(proposed,/food-extra-snacks-v828/);
 assert.match(proposed,/new Intl[.]DateTimeFormat\('en-CA',[\s\S]*?Europe\/Berlin/);
});
test('planned is NOT eaten and the checklist requires deliberate action',()=>{
 assert.match(proposed,/const visibleRows=rows[.]filter\(r=>r[.]source_key!==WORK_COFFEE_KEY\)/);
 assert.match(proposed,/visibleRows[.]filter\(r=>r[.]status==='planned'\)/);
 assert.match(proposed,/data-treat-confirm/);
 assert.match(proposed,/data-treat-skip/);
 assert.match(proposed,/data-treat-undo/);
 assert.match(proposed,/data-treat-restore/);
 assert.match(proposed,/rpc\('confirm_food_planned_extra_v1'/);
 assert.match(proposed,/rpc\('undo_food_planned_extra_v1'/);
 assert.doesNotMatch(proposed,/from\('food_inventory'\)[.]update/);
 assert.match(nutrition,/from\('food_extra_consumptions'\)/);
});
test('SQL confirms and consumes stock atomically, no count on skip',()=>{
 assert.match(migration,/create table if not exists public[.]food_planned_extras/i);
 assert.match(migration,/enable row level security/i);
 assert.match(migration,/auth[.]uid\(\)/);
 assert.match(migration,/insert into public[.]food_extra_consumptions/i);
 assert.match(migration,/perform public[.]consume_food_inventory\(/i);
 assert.match(migration,/if v_plan[.]status!='planned'/);
 assert.match(proposed,/update\(\{status:what==='skip'\?'skipped':'planned'/);
});
test('confirmed planned extra cannot be silently hand-edited or deleted without rollback',()=>{
 assert.match(logged,/food-planned-extra-v1-/);
 assert.match(logged,/supabase[.]rpc\('undo_food_planned_extra_v1'/);
 assert.match(logged,/food-planned-extra-v1-.*?\?'':'<button/);
});

test('planned quantity edit has pencil and updates logged snack plus stock atomically',()=>{
 assert.match(proposed,/data-treat-edit/);
 assert.match(proposed,/data-treat-edit-form/);
 assert.match(proposed,/edit_food_planned_extra_v1/);
 assert.match(proposed,/row[.]status==='confirmed'/);
 assert.match(migration,/create or replace function public[.]confirm_food_planned_extra_v1/);
 const editMigration=read('supabase/migrations/20261025202100_food_planned_extra_edit_v1.sql');
 assert.match(editMigration,/edit_food_planned_extra_v1/);
 assert.match(editMigration,/food_extra_consumptions e set/);
 assert.match(editMigration,/consume_food_inventory\(/);
 assert.match(editMigration,/adjust_food_inventory\(/);
 assert.match(editMigration,/mod\(p_quantity,5[.]7\)/);
});
test('historical meal prep with missing original shows labeled recipe reference',()=>{
 const food=read('food-v544.js');
 assert.match(food,/Rezept-Zutaten \(historische Mengen nicht belegt\)/);
 assert.match(food,/referenceIngredients/);
});
