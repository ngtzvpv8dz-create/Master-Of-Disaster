'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const runtime=fs.readFileSync(path.join(__dirname,'..','area-runtime-v609.js'),'utf8');
test('V1 bootstrap refreshes runtime and all food module paths after a release',()=>{
  require('./food-release-cache-helper.cjs').verifyFoodReleaseCache(index,runtime);
});
