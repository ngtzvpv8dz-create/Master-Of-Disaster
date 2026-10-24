'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../food-v544.js'),'utf8');
const a=src.indexOf('  function inventoryCountedPieces(item){');
const b=src.indexOf('  function inventoryCard(item,nextUses){',a);
assert.ok(a>0&&b>a);
const calc=new Function('state',src.slice(a,b)+'\nreturn inventoryCountedPieces')({
  products:[{inventory_id:'milka',active:true,product_data:{net_weight_g:114,pieces_per_box:20,grams_per_piece:5.7}}]
});
test('Milka 114g twenty units and integer-only consumption',()=>{
  const item={id:'milka',unit:'g',quantity:91.2,family_name:'Pralinen'};
  assert.equal(calc(item).remaining,16);
  assert.equal(calc({...item,quantity:79.8}).remaining,14);
  assert.equal(calc({...item,quantity:85.51}),null);
  assert.match(src,/data-food-piece-consume/);
  assert.match(src,/p_expected_quantity:Number\(item.quantity\)/);
});