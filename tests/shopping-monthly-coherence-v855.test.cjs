'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../shopping-v678.js'),'utf8');
const start=source.indexOf('    const shoppingFamily=name=>');
const stop=source.indexOf('    return included;',start);
assert.ok(start>0&&stop>start,'purchase deduplication in production source');
const run=new Function('rows','todayIso','fmtDate','fmtQty','collator',
  'let rowMap;\n'+source.slice(start,stop+'    return included;'.length));
const date='2026-10-24',fmtDate=s=>s,fmtQty=(q,u)=>q+' '+u;
const simulate=rows=>run(rows,()=>date,fmtDate,fmtQty,new Intl.Collator('de-DE'));
const general=(label,quantity,unit,when=date,section='now')=>({
  id:'G'+label,source:'general',section,label,secondary:'Einkauf vorgesehen',
  general:{quantity,unit,needed_by:when}
});
const gap=(label,quantity,unit,when='2026-10-25',section='now')=>({
  id:'F'+label,source:'food-gap',section,label,neededDate:when,primary:'Kaufen '+quantity+' '+unit,
  foodAction:{stockQuantity:quantity,stockUnit:unit}
});
const covered=(g,f)=>simulate([g,f]);

test('double items in the user shopping list are covered by ONE actual purchase',()=>{
  const items=[
    [general('Ayran',500,'ml'),gap('Ayran',500,'ml')],
    [general('Butter',1,'Packung'),gap('Butter',7,'g')],
    [general('Eier Größe M',10,'Stück'),gap('Eier Größe M',7,'Stück')],
    [general('Getrocknete Minze',1,'Glas'),gap('Getrocknete Minze',1,'g')],
    [general('Skyr Natur',500,'g'),gap('Skyr Natur',250,'g')],
    [general('TK-Beerenmischung',750,'g'),gap('TK-Beerenmischung',200,'g')],
    [general('Vollkornbrot',1,'Laib'),gap('Vollkornbrot',200,'g')],
    [general('Zucchini frisch',350,'g'),gap('Zucchini',304,'g')],
    [general('Passata 500 g',500,'g'),gap('Passierte Tomaten',140,'g')],
    [general('Rote Paprika',500,'g'),gap('Paprika rot',311,'g')],
    [general('Magerquark 500 g',500,'g'),gap('Magerquark',300,'g')],
    [general('Naturjoghurt',1000,'g'),gap('Naturjoghurt 1,5 %',500,'g')]
  ];
  for(const [g,f] of items){
    const result=covered(g,f);
    assert.equal(result.length,1,'Must not list '+g.label+' plus '+f.label);
    assert.equal(result[0],g);
  }
});

test('do not hide missing excess: buy 500g pepper, need 620g, display 120g additional',()=>{
  const result=covered(general('Rote Paprika',500,'g'),gap('Paprika rot',620,'g'));
  assert.equal(result.length,2);
  assert.match(result.find(x=>x.source==='food-gap').primary,/120 g/);
});

test('can cover near future with a planned later purchase but not old fresh goods',()=>{
  assert.equal(covered(general('Skyr Natur',500,'g','2026-11-04','later'),
    gap('Skyr Natur',250,'g','2026-11-05','later')).length,1);
  assert.equal(covered(general('Skyr Natur',500,'g',date),
    gap('Skyr Natur',250,'g','2026-11-05','later')).length,2);
});

test('do not confuse different beef cuts or wrong dates',()=>{
  assert.equal(covered(general('Mageres Rindfleisch zum Kurzbraten',400,'g'),
    gap('Mageres Rinderhack 5 %',330,'g')).length,2);
  assert.equal(covered(general('Ayran',500,'ml','2026-10-30','later'),
    gap('Ayran',250,'ml','2026-10-25')).length,2);
});

test('one package estimate is visible, while real stock and checkout remain untouched',()=>{
  const row=general('Vollkornbrot',1,'Laib');
  const result=covered(row,gap('Vollkornbrot',200,'g'));
  assert.equal(result.length,1);
  assert.match(result[0].secondary,/Gebindegröße beim Einkauf prüfen/);
  assert.equal(result[0].general.quantity,1);
});

test('extra rows have no fictional needed date and planned purchases are not called needed',()=>{
  assert.match(source,/Freiwilliger Vorratskauf, kein fester Einkaufstermin/);
  assert.match(source,/Einkauf vorgesehen am /);
  assert.doesNotMatch(source,/Benötigt am /);
});
