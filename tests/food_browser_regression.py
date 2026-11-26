"""Browser regression tests for FOOD; synthetic data only, no live DB."""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
browser_name = sys.argv[1]
source = (ROOT / "food-v544.js").read_text(encoding="utf-8")
anchor = "    checkShopping\n  };"
assert source.count(anchor) == 1, "FOOD test hook changed"
source = source.replace(anchor, """    checkShopping,__test:{recipeInstructionAmounts,mealCookingPlan,displayRecipeTitle,canonicalIngredientName,recipePresentation}
  };""")
with sync_playwright() as playwright:
    browser = getattr(playwright, browser_name).launch()
    page = browser.new_page(viewport={"width": 390, "height": 844})
    # Isolate this test from any real service, including Supabase.
    page.route("**/*", lambda route: route.abort())
    page.set_content('<html lang="de"><body><main id="result"></main></body></html>')
    page.add_script_tag(content=source)
    result = page.evaluate("""() => {
      const t=window.__modFoodV544.__test;
      const tomato={name:'Tomaten',quantity:100,unit:'g'};
      const egg={name:'Eier',quantity:1,unit:'Stück'};
      const recipe={food_recipe_ingredients:[tomato,egg],instructions:'1. 100 g Tomaten schneiden.\\n2. 1 Ei kochen.'};
      const changed=[{...tomato,quantity:108},{...egg,quantity:2}];
      const plan=t.mealCookingPlan(recipe,changed,null);
      const target=document.querySelector('#result');
      const list=document.createElement('ol');
      for(const step of plan.steps){
        const li=document.createElement('li');li.textContent=step;list.appendChild(li);
      }
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
    }""")
    for name, passed in result.items():
        print(f"{browser_name}: {name}: {'PASS' if passed else 'FAIL'}")
    assert all(result.values()), result
    assert page.locator("#result li").count() == 2
    assert page.locator("#result li").first.inner_text() == "108 g Tomaten schneiden."
    assert page.locator("#result li").nth(1).inner_text() == "2 Eier kochen."
    browser.close()
print(f"{browser_name}: all {len(result)+3} checks passed")
