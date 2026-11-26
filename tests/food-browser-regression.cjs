'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const playwright=require('playwright');
const browserName=process.argv[2];
assert.ok(['chromium','webkit','firefox'].includes(browserName));
let source=fs.readFileSync(path.join(__dirname,'..','food-v544.js'),'utf8');
const anchor='    checkShopping\n  };';
assert.equal(source.split(anchor).length,2,'FOOD test hook changed');
source=source.replace(anchor,'    checkShopping,__test:{recipeInstructionAmounts,mealCookingPlan,displayRecipeTitle,canonicalIngredientName,recipePresentation}\n  };');
(async()=>{
  const browser=await playwright[browserName].launch();
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.route('**/*',route=>route.abort());
    await page.setContent('<html lang="de"><body><main id="result"></main></body></html>');
    await page.addScriptTag({content:source});
    const result=await page.evaluate(()=>{
      const t=window.__modFoodV544.__test;
      const tomato={name:'Tomaten',quantity:100,unit:'g'};
      const egg={name:'Eier',quantity:1,unit:'Stück'};
      const recipe={food_recipe_ingredients:[tomato,egg],instructions:'1. 100 g Tomaten schneiden.\n2. 1 Ei kochen.'};
      const changed=[{...tomato,quantity:108},{...egg,quantity:2}];
      const plan=t.mealCookingPlan(recipe,changed,null);
      const target=document.querySelector('#result');
      const list=document.createElement('ol');
      for(const step of plan.steps){const li=document.createElement('li');li.textContent=step;list.appendChild(li);}
      target.appendChild(list);
      const override={text:'1. 108 g Tomaten schneiden.',ingredients:[changed[0]]};
      return {
        quantities:plan.steps[0]==='108 g Tomaten schneiden.'&&plan.steps[1]==='2 Eier kochen.',
        remove:t.mealCookingPlan(recipe,[tomato],null).pending,
        add:t.mealCookingPlan(recipe,[...changed,{name:'Senf',quantity:16,unit:'g'}],null).pending,
        replace:t.mealCookingPlan(recipe,[tomato,{name:'Pita',quantity:1,unit:'Stück'}],null).pending,
        staleHidden:t.mealCookingPlan(recipe,[tomato],null).steps.length===0,
        overrideAccepted:!t.mealCookingPlan(recipe,[changed[0]],override).pending,
        overrideInvalidated:t.mealCookingPlan(recipe,changed,override).pending,
        title:t.displayRecipeTitle('Pita (Monatsplan F26)')==='Pita',
        spinach:t.canonicalIngredientName({name:'TK Blattspinat'})==='Blattspinat, tiefgekühlt'
      };
    });
    for(const [name,ok] of Object.entries(result)){console.log(browserName+': '+name+': '+(ok?'PASS':'FAIL'));assert.equal(ok,true,name);}
    assert.equal(await page.locator('#result li').count(),2);
    assert.equal(await page.locator('#result li').first().innerText(),'108 g Tomaten schneiden.');
    assert.equal(await page.locator('#result li').nth(1).innerText(),'2 Eier kochen.');
    console.log(browserName+': all '+(Object.keys(result).length+3)+' checks passed');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
