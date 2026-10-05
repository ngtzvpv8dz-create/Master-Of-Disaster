const assert=require('node:assert/strict');
const resolver=require('../food-stock-resolver-v746.js');

const rows=[
  {id:'feta',name:'Hirtenkäse',quantity:170,unit:'g',is_active:true,family_name:'Feta / Hirtenkäse',catalog_family_name:'Feta / Hirtenkäse',catalog_variant_label:'Hirtenkäse · leicht'},
  {id:'pap-block',name:'Blockpaprika rot',quantity:534,unit:'g',is_active:true,family_name:'Paprika rot',catalog_family_name:'Paprika',catalog_group_label:'Rot',catalog_variant_label:'Blockpaprika'},
  {id:'pap-spitz',name:'Spitzpaprika Kapia Sweet',quantity:243,unit:'g',is_active:true,family_name:'Paprika rot',catalog_family_name:'Paprika',catalog_group_label:'Rot',catalog_variant_label:'Spitzpaprika · Kapia Sweet'},
  {id:'spin-fresh',name:'Babyspinat frisch',quantity:70,unit:'g',is_active:true,family_name:'Spinat',catalog_family_name:'Spinat',catalog_variant_label:'Babyspinat · frisch'},
  {id:'spin-empty',name:'Blattspinat',quantity:0,unit:'g',is_active:true,family_name:'Spinat',catalog_family_name:'Spinat',catalog_variant_label:'Blattspinat · frisch'},
  {id:'spin-tk',name:'Blattspinat TK',quantity:802,unit:'g',is_active:true,family_name:'Spinat',catalog_family_name:'Spinat',catalog_variant_label:'Blattspinat · TK'},
  {id:'salsa-hot',name:'Chio Dip Hot Salsa',quantity:140,unit:'ml',is_active:true,family_name:'Chio Dip Salsa',catalog_family_name:'Salsa Dip',catalog_variant_label:'Hot'},
  {id:'salsa-mild',name:'Chio Dip Mild Salsa',quantity:330,unit:'ml',is_active:true,family_name:'Chio Dip Salsa',catalog_family_name:'Salsa Dip',catalog_variant_label:'Mild'},
  {id:'cream',name:'Frischkäse leicht',quantity:190,unit:'g',is_active:true,family_name:'Frischkäse leicht',catalog_family_name:'Frischkäse',catalog_variant_label:'Leicht'},
  {id:'dinkel',name:'Dinkelmehl Type 1050',quantity:720,unit:'g',is_active:true,family_name:null,catalog_family_name:'Mehl',catalog_group_label:'Dinkel',catalog_variant_label:'Type 1050'},
  {id:'rice-long',name:'Langkornreis',quantity:500,unit:'g',is_active:true,family_name:null,catalog_family_name:'Reis',catalog_group_label:'Kochbeutel',catalog_variant_label:'Langkorn'},
  {id:'rice-nature',name:'Naturreis im Kochbeutel',quantity:199,unit:'g',is_active:true,family_name:null,catalog_family_name:'Reis',catalog_group_label:'Kochbeutel',catalog_variant_label:'Naturreis'}
];
const aliases=[
  {inventory_id:'cream',alias:'Light-Frischkäse'}
];

let r=resolver.resolve({item:{name:'Feta / Hirtenkäse',unit:'g'},inventoryRows:rows,inventoryAliases:aliases});
assert.equal(r.resolution,'family');
assert.equal(r.available,170);

r=resolver.resolve({item:{name:'Paprika rot',unit:'g'},inventoryRows:rows,inventoryAliases:aliases});
assert.equal(r.available,777);

r=resolver.resolve({item:{name:'Spinat frisch',unit:'g'},inventoryRows:rows,inventoryAliases:aliases});
assert.equal(r.available,70);

r=resolver.resolve({item:{name:'Spinat',unit:'g'},inventoryRows:rows,inventoryAliases:aliases});
assert.equal(r.available,872);

r=resolver.resolve({item:{inventory_id:'salsa-mild',name:'Chio Dip Mild Salsa',unit:'ml'},inventoryRows:rows,inventoryAliases:aliases});
assert.equal(r.resolution,'inventory_id');
assert.equal(r.available,330);

r=resolver.resolve({item:{name:'Light-Frischkäse',unit:'g'},inventoryRows:rows,inventoryAliases:aliases});
assert.equal(r.resolution,'alias');
assert.equal(r.available,190);

r=resolver.resolve({item:{name:'Mehl Dinkel Type 1050',unit:'g'},inventoryRows:rows,inventoryAliases:aliases});
assert.equal(r.resolution,'catalog');
assert.equal(r.available,720);

r=resolver.resolve({item:{name:'Reis',unit:'g'},inventoryRows:rows,inventoryAliases:aliases});
assert.equal(r.resolution,'none');
assert.equal(r.available,0);

assert.equal(resolver.familyNeedMatch('Feta / Hirtenkäse','Feta / Hirtenkäse').mode,'generic');
assert.equal(resolver.familyNeedMatch('Spinat TK','Spinat').mode,'frozen');
assert.equal(resolver.familyNeedMatch('Paprika rot','Paprika rot').mode,'generic');

console.log('V746 food stock resolver regression OK');
