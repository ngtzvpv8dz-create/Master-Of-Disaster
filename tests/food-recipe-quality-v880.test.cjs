'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');
const start=src.indexOf('  // V880: Validate a recipe');
const end=src.indexOf('  const recipeInventoryOptionLabel=',start);
assert.ok(start>=0&&end>start,'production recipe audit implementation exists');
const audit=new Function(src.slice(start,end)+'\nreturn auditFoodRecipeBeforeSave;')();
const ing=(name,quantity,unit)=>({name,quantity,unit});
const koefte=[
  ing('Wasser',100,'ml'),ing('Kartoffeln',340,'g'),
  ing('Rinderhackfleisch Light',310,'g'),ing('Olivenöl',10,'ml')
];
test('İzmir Köfte uses water explicitly and each ingredient',()=>{
  const result=audit('1. Kartoffeln waschen und schneiden.\\n2. Hackfleisch in Olivenöl braten.\\n3. 100 ml Wasser in die Tomatensauce gießen.',koefte,'İzmir Köfte');
  assert.deepEqual(result.errors,[]);
  assert.deepEqual(result.warnings,[]);
  assert.equal(result.instructions.split('\n').length,3);
});
test('generic water placeholders are rejected',()=>{
  const result=audit('1. 100 ml Wasser für den vorgesehenen Kochschritt abmessen.\\n2. Kartoffeln und Hackfleisch garen.',koefte);
  assert.match(result.errors.join(' '),/Platzhalter/);
});
test('quantified cooking water not in ingredients is rejected',()=>{
  const result=audit('1. 100 ml Wasser zum Garen der Kartoffeln bereitstellen.\\n2. Rinderhackfleisch anbraten.',koefte.slice(1));
  assert.match(result.errors.join(' '),/fehlt in der Zutatenliste/);
});
test('water totals must match',()=>{
  const result=audit('1. Kartoffeln schneiden.\\n2. Hackfleisch mit Olivenöl braten.\\n3. 200 ml Wasser in die Sauce geben.',koefte);
  assert.match(result.errors.join(' '),/Gesamtmenge Wasser/);
});
test('1.000 ml discarded cooking water is recognized',()=>{
  const result=audit('1. 1.000 ml Kochwasser zum Pochieren aufkochen.\\n2. 2 Eier hineingeben und garen.',[ing('Wasser',1000,'ml'),ing('Eier Größe M',2,'Stück')]);
  assert.deepEqual(result.errors,[]);
});
test('second egg requires second listed egg',()=>{
  const result=audit('1. Ein Ei verrühren.\\n2. Das zweite Ei separat stocken lassen.',[ing('Eier Größe M',1,'Stück')]);
  assert.match(result.errors.join(' '),/zweites Ei/);
});
test('new instructions are normalized as numbered steps',()=>{
  const result=audit('Banane schälen.\\nKürbiskerne abwiegen.',[ing('Bananen',1,'Stück'),ing('Kürbiskerne',10,'g')]);
  assert.deepEqual(result.errors,[]);
  assert.match(result.instructions,/^1\. Banane schälen\.\n2\. Kürbiskerne abwiegen\./);
});
test('Protein Coffee as drink requires exactly 30 g and 250 ml milk',()=>{
  const good=audit('Pulver vorbereiten.\\n30 g Protein Coffee mit 250 ml Milch shaken.',[
    ing('Protein Coffee Classic Coffee',30,'g'),ing('H-Milch 1,5 %',250,'ml')
  ],'Protein Coffee & Apfel');
  assert.deepEqual(good.errors,[]);
  const wrong=audit('Milch bereitstellen.\\n30 g Protein Coffee in 150 ml Milch shaken.',[
    ing('Protein Coffee Classic Coffee',30,'g'),ing('H-Milch 1,5 %',150,'ml')
  ],'Protein Coffee');
  assert.match(wrong.errors.join(' '),/250 ml Milch/);
});
test('Isoclear as a drink requires 30 g powder and 500 ml water',()=>{
  const wrong=audit('Wasser kalt abmessen.\\n30 g Isoclear in 250 ml Wasser shaken.',[
    ing('ESN Isoclear Strawberry Lime',30,'g'),ing('Wasser',250,'ml')
  ],'Isoclear & Apfel');
  assert.match(wrong.errors.join(' '),/500 ml Wasser/);
});
test('protein-coffee powder in pancake batter is not treated as drink',()=>{
  const r=audit('10 g Protein Coffee in Milch verrühren.\\nAus dem Teig Pfannkuchen backen.',[
    ing('Protein Coffee Classic Coffee',10,'g'),ing('H-Milch 1,5 %',300,'ml')
  ],'Bananen-Hafer-Pfannküchlein');
  assert.deepEqual(r.errors,[]);
});
test('save points use validator for both create and edit',()=>{
  assert.match(src,/insert\(\{user_id:user.id,title,meal_type:mealType,description,servings,prep_minutes:prepMinutes,instructions:validatedInstructions/);
  assert.match(src,/p_instructions:validatedInstructions/);
  assert.equal((src.match(/checkedFoodRecipeInstructions\(instructions,ingredients,title\)/g)||[]).length,2);
});
