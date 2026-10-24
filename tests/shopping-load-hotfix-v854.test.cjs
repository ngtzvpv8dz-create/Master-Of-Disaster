'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const js=fs.readFileSync(path.join(__dirname,'../shopping-v678.js'),'utf8');
const start=js.indexOf('    const shoppingFamily=name=>');
const end=js.indexOf('    return included;',start);
assert.ok(start>=0&&end>start,'real shopping deduplication block exists');
const originalBlock=js.slice(start,end+'    return included;'.length);
const run=new Function('rows','todayIso','fmtDate','fmtQty','collator','let rowMap;\n'+originalBlock);
const fmtDate=iso=>iso;
const fmtQty=(n,u)=>n+' '+u;
const collator=new Intl.Collator('de-DE');
const simulate=rows=>run(rows,()=> '2026-10-24',fmtDate,fmtQty,collator);
const general=(id,label,quantity,unit='g',status='now',neededBy='2026-10-24')=>({
 id,key:id,source:'general',section:status,label,secondary:'Einkauf geplant',
 general:{quantity,unit,needed_by:neededBy}
});
const gap=(id,label,quantity,unit='g',neededDate='2026-10-24',section='now')=>({
 id,key:id,source:'food-gap',section,label,primary:'Kaufen '+quantity,
 neededDate,currentStock:'Aktuell im Vorrat 0 '+unit,
 foodAction:{stockQuantity:quantity,stockUnit:unit}
});

test('the actual shopping buildRows block does not crash when 330g beef deficit is covered by 700g shopping row',()=>{
 const purchase=general('buy-beef','Mageres Rinderhack 5 %',700);
 const result=simulate([gap('beef-gap','Mageres Rinderhack 5 %',330),purchase]);
 assert.equal(result.length,1);
 assert.strictEqual(result[0],purchase,'update the real row, not a detached spread');
 assert.match(result[0].secondary,/Abgedeckter Rezeptbedarf 2026-10-24: 330 g/);
 assert.equal(result[0].currentStock,'Aktuell im Vorrat 0 g');
});

test('a second shortage is not swallowed after the 700g purchase has only 370g unused',()=>{
 const result=simulate([general('buy-beef','Mageres Rinderhack 5 %',700),
 gap('gap-1','Mageres Rinderhack 5 %',330),
 gap('gap-2','Mageres Rinderhack 5 %',380)]);
 assert.equal(result.length,2);
 assert.ok(result.some(row=>row.id==='gap-2'));
});

test('one spice jar covers recipe cumin grams without a separate 2g purchase row',()=>{
 const result=simulate([general('cumin-jar','Kreuzkümmel gemahlen',1,'Glas'),
 gap('cumin-gap','Kreuzkümmel gemahlen',2)]);
 assert.equal(result.length,1);
 assert.equal(result[0].id,'cumin-jar');
});

test('beef strips are never confused with lean beef mince',()=>{
 const result=simulate([general('buy-strips','Mageres Rindfleisch zum Kurzbraten',400),
 gap('beef-mince-gap','Mageres Rinderhack 5 %',330)]);
 assert.equal(result.length,2);
});

test('later groceries and shortages remain separate',()=>{
 const result=simulate([general('buy-later','Mageres Rinderhack 5 %',700,'g','later','2026-11-01'),
 gap('need-today','Mageres Rinderhack 5 %',330)]);
 assert.equal(result.length,2);
});

test('no supplier case must not crash',()=>{
 const result=simulate([gap('milk-gap','H-Milch',300,'ml')]);
 assert.equal(result.length,1);
});
