'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');

const start=source.indexOf('  // Photo-inventory rule V906:');
const end=source.indexOf('  // V848: product families',start);
assert(start>=0&&end>start,'V906 MHD/traceability helpers must exist');
const js=source.slice(start,end);
const helpers=new Function('state','num','fmtDate','esc',
  js+'return {normalizeInventoryMhdLabel,inventoryMhdMarkup,inventoryTraceabilityIssues,inventoryTraceabilityMarkup};')(
  {},value=>value==null?null:Number(value),
  value=>String(value).slice(0,10),
  value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
);

const item={id:'backin',name:'Backpulver',quantity:9,unit:'Päckchen',is_active:true};
const product={id:'p-backin',brand:'Dr. Oetker',product_name:'Original Backin Backpulver',variant:'16-g-Päckchen'};
const lot={id:'lot-0827',inventory_id:'backin',product_id:'p-backin',unopened_packages:9,opened_packages:0,
  package_quantity:1,package_unit:'Päckchen',best_before_label:'08/2027',best_before_date:null};
const data={lots:[lot],products:[product]};

test('MHD print 0827 is 08/2027, without inventing a calendar day',()=>{
  assert.equal(helpers.normalizeInventoryMhdLabel('0827'),'08/2027');
  assert.equal(helpers.normalizeInventoryMhdLabel('08/27'),'08/2027');
  assert.equal(helpers.normalizeInventoryMhdLabel('8.2027'),'08/2027');
  assert.equal(helpers.inventoryMhdMarkup(item,data),'<span class="food-stock-mhd-v707">MHD 08/2027</span>');
});
test('all verified Backin links yield no traceability warning',()=>{
  assert.deepEqual(helpers.inventoryTraceabilityIssues(item,data),[]);
  assert.equal(helpers.inventoryTraceabilityMarkup(item,data),'');
});
test('brand and MHD written in a note cannot substitute for missing physical lot',()=>{
  assert.deepEqual(helpers.inventoryTraceabilityIssues({...item,note:'Dr. Oetker; 08/2027'},{
    lots:[],products:[product]}),['Chargenzuordnung fehlt']);
});
test('present lot must link structured product, otherwise issue is visible',()=>{
  const issues=helpers.inventoryTraceabilityIssues(item,{lots:[{...lot,product_id:null}],products:[product]});
  assert(issues.includes('Produktzuordnung fehlt'));
  assert.match(helpers.inventoryTraceabilityMarkup(item,{lots:[{...lot,product_id:null}],products:[product]}),/Erfassung noch prüfen/);
});
test('branded packaged lot with empty MHD is marked incomplete',()=>{
  const issues=helpers.inventoryTraceabilityIssues(item,{lots:[{...lot,best_before_label:null}],products:[product]});
  assert(issues.includes('MHD fehlt'));
});
test('empty stock is not marked as missing a lot',()=>{
  assert.deepEqual(helpers.inventoryTraceabilityIssues({...item,quantity:0},{lots:[],products:[]}),[]);
});
test('Päckchen content weight never becomes number of packages in add-lot form',()=>{
  const start=source.indexOf('    // 16 g per Päckchen means ONE Päckchen');
  const end=source.indexOf('    const productSelect=',start);
  assert(start>0&&end>start,'counted unit protection must exist');
  const compute=new Function('item','existing',source.slice(start,end)+'return packageSize;');
  assert.equal(compute({unit:'Päckchen',usage_content_quantity:16},null),1);
  assert.equal(compute({unit:'Päckchen',usage_content_quantity:7},null),1);
  assert.equal(compute({unit:'Päckchen',usage_content_quantity:16},{package_quantity:2}),2);
});
test('new/edit lot forms require explicit MHD decision and known product link',()=>{
  assert.match(source,/if\(products\.length&&!String\(form\.get\('product_id'\)\|\|''\)\.trim\(\)\)/);
  assert.match(source,/if\(!expiry&&form\.get\('mhd_unknown'\)!=='on'\)/);
  assert.match(source,/p_product_id:lot\.product_id\|\|null,p_best_before_label:expiry/);
  assert.match(source,/\+currentProduct\+traceability\+nextUse/);
});
