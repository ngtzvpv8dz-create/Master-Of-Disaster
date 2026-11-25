'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const runtime=fs.readFileSync(path.join(__dirname,'..','area-runtime-v609.js'),'utf8');
// The release token is deliberately pinned in ONE activation test.
// On a FOOD release change it here together with the loader and its index URL.
const releaseToken='20261125-food-lot-gross';
const policyVersion='20261122-food-rules-917';
test('V1 bootstrap refreshes runtime and all food module paths after a release',()=>{
  assert.ok(index.includes('./area-runtime-v609.js?v='+releaseToken+'"'));
  for(const asset of ['food-v544.js','food-nutrition-v711.js']){
    const pattern=new RegExp(asset.replaceAll('.','\\.')+"\\?v=([^']+)'",'g');
    const versions=[...runtime.matchAll(pattern)].map(m=>m[1]);
    assert.deepEqual(versions,Array(4).fill(releaseToken),asset+' loader version drift');
  }
  assert.equal(runtime.split('./food-freshness-v913.js?v='+policyVersion+"'").length-1,4);
  assert.doesNotMatch(runtime,/food-v544\.js\?v=20261118-shopping-stock-alias-v909/);
});
