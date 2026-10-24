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
  'let rowMap; const food={plannedShoppingUses:[]}; const inventory=[]; const shoppingFamilyLabel=x=>x;\n'+source.slice(start,stop+'    return included;'.length));
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

test('not hide missing excess: combine buy 500g pepper +120g into one 620g purchase',()=>{
  const result=covered(general('Rote Paprika',500,'g'),gap('Paprika rot',620,'g'));
  assert.equal(result.length,1);
  assert.match(result[0].primary,/620 g/);
  assert.equal(result[0].checkoutOverrideQuantity,620);
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
  assert.match(result[0].secondary,/Packungs-\/Abtropf-\/Stückgewicht prüfen/);
  assert.equal(result[0].general.quantity,1);
});

test('extra rows have no fictional needed date and planned purchases are not called needed',()=>{
  assert.match(source,/Freiwilliger Vorratskauf, kein fester Einkaufstermin/);
  assert.match(source,/Einkauf vorgesehen am /);
  assert.doesNotMatch(source,/Benötigt am /);
});


test('monthly frozen spinach in cart covers the 80g recipe gap and other November needs',()=>{
  const monthly=general('TK-Blattspinat, Monatsreserve',1500,'g',date,'cart');
  const gaps=[
    gap('Blattspinat TK',80,'g','2026-10-28'),
    gap('Blattspinat TK',180,'g','2026-11-01','later'),
    gap('Blattspinat TK',240,'g','2026-11-11','later'),
    gap('Blattspinat TK',280,'g','2026-11-23','later')
  ];
  const rows=simulate([monthly,...gaps]);
  assert.equal(rows.length,1,'The already planned 1500g should cover all listed needs');
  assert.equal(rows[0],monthly);
  assert.equal(monthly.general.quantity,1500,'No inventory or cart data is changed');
  assert.equal(simulate([general('Babyspinat frisch',100,'g'),gap('Blattspinat TK',80,'g','2026-10-28')]).length,2,
    'Fresh spinach must not cover frozen spinach demand');
});


test('whole shopping purchases absorb the concrete recipe needs, not two lines',()=>{
  const recipes=[
    [general('Hähnchenbrustfilet',500,'g','2026-10-28'),gap('Hähnchenbrustfilet',550,'g','2026-10-29'),550],
    [general('Mageres Rinderhack (ca. 5 % Fett)',250,'g','2026-10-28'),gap('Mageres Rinderhack (ca. 5 % Fett)',260,'g','2026-10-28'),260],
    [general('Tomaten (frisch, Sorte prüfen)',500,'g','2026-10-28'),gap('Tomaten (frisch, Sorte prüfen)',605,'g','2026-10-28'),605],
    [general('Ricotta',250,'g','2026-11-11'),gap('Ricotta',110,'g','2026-11-11'),null],
    [general('Edamame TK (ohne Schote)',300,'g','2026-11-11'),gap('Edamame TK (ohne Schote)',130,'g','2026-11-11'),null],
    [general('Mozzarella Light',200,'g','2026-11-11'),gap('Mozzarella Light',45,'g','2026-11-11'),null],
    [general('Hummus',150,'g','2026-11-06'),gap('Hummus',90,'g','2026-11-07'),null],
    [general('Quinoa',250,'g','2026-11-06'),gap('Quinoa',120,'g','2026-11-07'),null],
    [general('Gochujang',1,'Glas','2026-11-04'),gap('Gochujang',10,'g','2026-11-05'),null]
  ];
  for(const [g,f,total] of recipes){
    const rows=covered(g,f);
    assert.equal(rows.length,1,g.label+' must be one line');
    if(total!==null)assert.equal(rows[0].checkoutOverrideQuantity,total,g.label+' checkout matches display');
  }
});
test('unverified gram-to-bottle/fruit purchases show one caution, not a fictional conversion',()=>{
  for(const [g,f] of [
    [general('Kiwi',5,'Stück','2026-10-30'),gap('Kiwi',110,'g','2026-10-30')],
    [general('Sojasauce',1,'Flasche','2026-11-04'),gap('Sojasauce',35,'ml','2026-11-05')],
    [general('Mais (Dose)',1,'Dose','2026-10-30'),gap('Mais (Dose)',80,'g','2026-10-31')]
  ]){
    const rows=covered(g,f);
    assert.equal(rows.length,1,g.label+' needs one real purchase row');
    assert.equal(rows[0].flags.unitMismatch,true,'Unknown package conversion must be visible');
  }
});
test('frozen green beans and brown rice are never combined with fresh beans or white rice',()=>{
  assert.equal(covered(
    general('Grüne Bohnen (Zubereitungsform prüfen)',400,'g','2026-11-18'),
    gap('Grüne Bohnen TK',310,'g','2026-11-18')).length,2);
  assert.equal(covered(
    general('Langkornreis (trocken)',500,'g','2026-10-28'),
    gap('Naturreis (trocken)',110,'g','2026-10-28')).length,2);
});
