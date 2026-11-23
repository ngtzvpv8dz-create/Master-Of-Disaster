'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const runtime=fs.readFileSync(path.join(__dirname,'..','area-runtime-v609.js'),'utf8');
const runtimeVersion='20261122-snapshot-alias-930';
const policyVersion='20261122-food-rules-917';
test('V1 bootstrap refreshes runtime and all food module paths after a release',()=>{
  assert.ok(index.includes('./area-runtime-v609.js?v=20261123-food-raw-reference-931'));
  assert.equal(runtime.split('./food-nutrition-v711.js?v=20261123-raw-reference-931').length-1,4);
  assert.ok(runtime.includes('./food-v544.js?v='+runtimeVersion));
  assert.equal(runtime.split('./food-v544.js?v='+runtimeVersion).length-1,4);
  assert.equal(runtime.split('./food-freshness-v913.js?v='+policyVersion).length-1,4);
  assert.doesNotMatch(runtime,/food-v544\.js\?v=20261118-shopping-stock-alias-v909/);
});
