'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const runtime=fs.readFileSync(path.join(__dirname,'..','area-runtime-v609.js'),'utf8');
const version='20261121-physical-stock-provenance-v912';
test('V1 bootstrap refreshes runtime and all food module paths after a release',()=>{
  assert.match(index,new RegExp('area-runtime-v609\\.js\\?v='+version));
  assert.match(runtime,new RegExp('food-v544\\.js\\?v='+version));
  assert.equal(runtime.split('./food-v544.js?v='+version).length-1,4);
  assert.doesNotMatch(runtime,/food-v544\.js\?v=20261118-shopping-stock-alias-v909/);
});
