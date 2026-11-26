'use strict';
const assert=require('node:assert/strict');
function verifyFoodReleaseCache(index,runtime){
  const version=index.match(/version:'V(\d+)'/);
  const loader=index.match(/\.\/area-runtime-v609\.js\?v=([^"']+)/);
  assert.ok(version&&loader,'Build and staged runtime cache key must be declared');
  const token=loader[1];
  assert.match(token,new RegExp('^\\d{8}-v'+version[1]+'(?:-|$)'),'Runtime token must match the published build');
  for(const [name,expected] of [['food-v544.js',4],['food-nutrition-v711.js',4],['food-freshness-v913.js',4],['shopping-v678.js',2]]){
    const urls=[...runtime.matchAll(/'\.\/([^'?]+)\?v=([^']+)'/g)].filter(m=>m[1]===name);
    assert.equal(urls.length,expected,name+' must occur at all expected loader entry points');
    assert.ok(urls.every(m=>m[2]===token),name+' has a stale cache key');
  }
  assert.match(index,/food-v544\.css\?v=[^"']+/);
}
module.exports={verifyFoodReleaseCache};
