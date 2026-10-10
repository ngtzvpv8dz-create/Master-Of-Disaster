/* V776 · Dynamic FOOD nutrition with active-lot product identity.
   Rechnet Rezept- und Mahlzeitenwerte aus den aktuellen Zutatenmengen.
   Generische Zutatenfamilien werden sichtbar und planreihenfolge-bewusst
   auf konkrete Vorratsprodukte aufgeteilt. */
(function(){
  'use strict';
  if(window.__modFoodNutritionV711)return;

  const VERSION='V777';
  const ROOT_ID='modFoodV544';
  const ZERO_NAMES=new Set(['wasser','leitungswasser','salz']);
  let timer=null;
  let running=false;
  let rerun=false;
  let lastStatus={recipes:0,meals:0,dynamicRecipes:0,dynamicMeals:0,unresolvedRecipes:[],unresolvedMeals:[]};

  const number=value=>{
    if(value===null||value===undefined||value==='')return null;
    const n=Number(value);
    return Number.isFinite(n)?n:null;
  };
  const text=value=>String(value||'').trim().toLocaleLowerCase('de-DE').replace(/[·_]+/g,' ').replace(/\s+/g,' ');
  const key=value=>{
    const raw=text(value).replace(/[^a-z0-9äöüß]+/g,'');
    return raw==='schwarzerpfeffer'?'pfefferschwarz':raw;
  };
  const itemName=item=>String(item?.name||item?.label||'Zutat').trim();

  function nutrient(source,names){
    const data=source&&typeof source==='object'?source:{};
    for(const name of names){
      const n=number(data[name]);
      if(n!==null)return n;
    }
    return null;
  }

  function nutritionOf(product){
    const n=product?.nutrition_per_100||{};
    return {
      kcal:nutrient(n,['energy_kcal','calories_kcal','kcal']),
      protein:nutrient(n,['protein_g','protein']),
      carbs:nutrient(n,['carbohydrates_g','carbs_g']),
      fat:nutrient(n,['fat_g'])
    };
  }

  function signature(product){
    const n=nutritionOf(product);
    return [n.kcal,n.protein,n.carbs,n.fat].map(v=>v===null?'?':String(v)).join('|');
  }

  function chooseProduct(rows){
    const usable=(rows||[]).filter(row=>{
      const n=nutritionOf(row);
      return n.kcal!==null&&n.protein!==null;
    });
    if(!usable.length)return null;
    return new Set(usable.map(signature)).size===1?usable[0]:null;
  }

  // Bei mehreren historischen Marken im Produktstamm gilt die tatsächlich
  // vorhandene Charge. Unterschiedliche aktive Chargen bleiben ggf. offen.
  function productForStock(stock,data){
    if(!stock?.id)return null;
    const id=String(stock.id);
    const products=(data?.products||[]).filter(p=>String(p.inventory_id||'')===id);
    if(!products.length)return null;
    const liveIds=new Set((data?.lots||[])
      .filter(lot=>String(lot.inventory_id||'')===id)
      .filter(lot=>number(lot.unopened_packages)>0||number(lot.opened_remaining_quantity)>0)
      .map(lot=>String(lot.product_id||'')).filter(Boolean));
    return chooseProduct(liveIds.size
      ?products.filter(product=>liveIds.has(String(product.id))):products);
  }

  function rowMode(row){
    const value=text((row?.name||'')+' '+(row?.variant_label||''));
    if(/(?:^|\s)(?:tk|tiefkühl|tiefgekühlt|tiefgefroren|gefroren)(?:\s|$)/.test(value))return 'frozen';
    if(/(?:^|\s)(?:frisch|frische|frischer|frisches|babyspinat)(?:\s|$)/.test(value))return 'fresh';
    return 'neutral';
  }

  function familyMatch(name,family){
    const need=text(name);
    const base=text(family);
    if(!need||!base)return null;
    if(need===base)return 'generic';
    if(need.startsWith(base+' ')||need.endsWith(' '+base)){
      if(/\b(?:tk|tiefkühl|tiefgekühlt|tiefgefroren|gefroren)\b/.test(need))return 'frozen';
      if(/\b(?:frisch|frische|frischer|frisches|bio|babyspinat)\b/.test(need))return 'fresh';
      return 'generic';
    }
    return null;
  }

  function lotDateForInventory(inventoryId,data){
    const dates=(data?.lots||[])
      .filter(lot=>String(lot.inventory_id||'')===String(inventoryId||''))
      .filter(lot=>Number(lot.unopened_packages||0)>0||Number(lot.opened_remaining_quantity||0)>0)
      .map(lot=>String(lot.purchased_on||''))
      .filter(Boolean)
      .sort();
    if(dates.length)return dates[0];
    const stock=(data?.inventory||[]).find(row=>String(row.id)===String(inventoryId||''));
    return '9999-12-31';
  }

  function stockAmountInBaseUnit(stock,targetUnit){
    const quantity=number(stock?.quantity);
    if(quantity===null||quantity<=0)return 0;
    const source=text(stock?.unit);
    const target=text(targetUnit);
    if(source===target)return quantity;
    if(source==='kg'&&target==='g')return quantity*1000;
    if(source==='g'&&target==='kg')return quantity/1000;
    if(source==='l'&&target==='ml')return quantity*1000;
    if(source==='ml'&&target==='l')return quantity/1000;
    return null;
  }

  function displayProductForStock(stock,data){
    return productForStock(stock,data);
  }

  function concreteProductLabel(stock,data){
    const product=displayProductForStock(stock,data);
    const brand=String(product?.brand||'').trim();
    const productName=String(product?.product_name||stock?.name||'').trim();
    const fallbackVariant=String(stock?.variant_label||'').trim();
    const productVariant=String(product?.variant||'').trim();
    const variant=productVariant||fallbackVariant;
    let label=[brand,productName].filter(Boolean).join(' ').trim()||String(stock?.name||'Produkt').trim();
    const normalizedLabel=text(label);
    if(variant&&!normalizedLabel.includes(text(variant)))label+=' · '+variant;
    return label;
  }

  function genericFamilyAllocation(item,data){
    const name=itemName(item);
    const unit=text(item?.unit);
    if(item?.inventory_id){
      const pinned=(data?.inventory||[]).find(row=>String(row.id)===String(item.inventory_id));
      const family=String(pinned?.family_name||'').trim();
      if(!family||text(name)!==text(family))return null;
    }
    if(!['g','kg','ml','l'].includes(unit))return null;

    const inventory=(data?.inventory||[])
      .filter(row=>row?.is_active!==false)
      .filter(row=>familyMatch(name,row.family_name)==='generic')
      .filter(row=>number(row.quantity)>0);

    if(!inventory.length)return null;

    const compatible=inventory
      .map(stock=>({stock,available:stockAmountInBaseUnit(stock,unit)}))
      .filter(entry=>entry.available!==null&&entry.available>0)
      .sort((a,b)=>{
        const da=lotDateForInventory(a.stock.id,data);
        const db=lotDateForInventory(b.stock.id,data);
        return da.localeCompare(db)||Number(a.stock.sort_order||0)-Number(b.stock.sort_order||0)||String(a.stock.id).localeCompare(String(b.stock.id));
      });

    if(!compatible.length)return null;

    let remaining=number(item.quantity);
    if(remaining===null||remaining<0)return {complete:false,missing:[name+' (Menge)'],allocations:[],remaining:null};

    const allocations=[];
    for(const entry of compatible){
      if(remaining<=0)break;
      const take=Math.min(entry.available,remaining);
      allocations.push({
        inventoryId:String(entry.stock.id),
        stock:entry.stock,
        product:displayProductForStock(entry.stock,data),
        label:concreteProductLabel(entry.stock,data),
        take,
        unit:item?.unit||unit
      });
      remaining-=take;
    }

    return {
      complete:remaining<=0.0001,
      missing:remaining>0.0001?[name+' (Vorrat reicht aktuell nicht)']:[],
      allocations,
      remaining:Math.max(0,remaining)
    };
  }

  function genericFamilyNutrition(item,data,allocationOverride=null){
    const allocation=allocationOverride||genericFamilyAllocation(item,data);
    if(!allocation)return null;
    if(!allocation.complete)return {complete:false,missing:allocation.missing||[itemName(item)]};

    let kcal=0;
    let protein=0;
    for(const part of allocation.allocations||[]){
      const stock=part.stock||(data?.inventory||[]).find(row=>String(row.id)===String(part.inventoryId||''));
      const product=productForStock(stock,data);
      if(!product)return {complete:false,missing:[stock?.name||itemName(item)]};
      const nutrition=nutritionOf(product);
      if(nutrition.kcal===null||nutrition.protein===null)return {complete:false,missing:[part.stock?.name||itemName(item)]};
      kcal+=nutrition.kcal*part.take/100;
      protein+=nutrition.protein*part.take/100;
    }
    return {complete:true,kcal,protein,missing:[]};
  }

  function quantityInStockUnit(item,stock){
    const qty=number(item?.quantity);
    if(qty===null||qty<0)return null;
    const from=text(item?.unit);
    const to=text(stock?.unit);
    if(from===to)return qty;
    if(from==='kg'&&to==='g')return qty*1000;
    if(from==='g'&&to==='kg')return qty/1000;
    if(from==='l'&&to==='ml')return qty*1000;
    if(from==='ml'&&to==='l')return qty/1000;
    return null;
  }

  function cloneDataWithStock(data,quantities){
    return {
      ...data,
      inventory:(data?.inventory||[]).map(stock=>({
        ...stock,
        quantity:quantities.has(String(stock.id))?quantities.get(String(stock.id)):stock.quantity
      }))
    };
  }

  function reserveSpecific(item,quantities,data){
    if(!item?.inventory_id)return false;
    const id=String(item.inventory_id);
    const stock=(data?.inventory||[]).find(row=>String(row.id)===id);
    if(!stock)return false;
    const need=quantityInStockUnit(item,stock);
    if(need===null)return false;
    const current=number(quantities.get(id));
    if(current===null)return false;
    quantities.set(id,Math.max(0,current-need));
    return true;
  }

  function reserveGenericAllocation(allocation,quantities,data){
    for(const part of allocation?.allocations||[]){
      const id=String(part.inventoryId||'');
      const stock=(data?.inventory||[]).find(row=>String(row.id)===id);
      if(!stock)continue;
      const itemLike={quantity:part.take,unit:part.unit};
      const need=quantityInStockUnit(itemLike,stock);
      const current=number(quantities.get(id));
      if(need===null||current===null)continue;
      quantities.set(id,Math.max(0,current-need));
    }
  }

  function plannedMealAllocationState(data){
    const quantities=new Map((data?.inventory||[]).map(stock=>[String(stock.id),Math.max(0,number(stock.quantity)||0)]));
    const contexts=new Map();
    const allocations=new Map();
    const today=todayIso();
    const meals=[...(data?.meals||[])]
      .filter(meal=>String(meal.meal_date||'')>=today)
      .sort((a,b)=>String(a.meal_date||'').localeCompare(String(b.meal_date||''))||
        Number(a.sort_order||0)-Number(b.sort_order||0)||
        String(a.id||'').localeCompare(String(b.id||'')));

    for(const meal of meals){
      const id=String(meal.id||'');
      const before=cloneDataWithStock(data,quantities);
      contexts.set(id,before);

      if(text(meal.status)==='completed'||meal.inventory_booked_at)continue;

      const perIngredient=new Map();
      const items=[...(meal.food_meal_ingredients||[])].sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0));
      for(const item of items){
        const live=cloneDataWithStock(data,quantities);
        const allocation=genericFamilyAllocation(item,live);
        if(allocation){
          if(item?.id)perIngredient.set(String(item.id),allocation);
          reserveGenericAllocation(allocation,quantities,data);
          continue;
        }
        if(item?.inventory_id)reserveSpecific(item,quantities,data);
      }
      allocations.set(id,perIngredient);
    }
    return {contexts,allocations};
  }

  function noteNutrition(stock){
    const note=String(stock?.note||'');
    const kcal=note.match(/([0-9]+(?:[.,][0-9]+)?)\s*kcal\s*\/\s*100\s*g/i);
    const protein=note.match(/protein\s*:?\s*([0-9]+(?:[.,][0-9]+)?)\s*g\s*\/\s*100\s*g/i);
    if(!kcal||!protein)return null;
    return {kcal:Number(kcal[1].replace(',','.')),protein:Number(protein[1].replace(',','.')),carbs:null,fat:null};
  }

  function sourceFor(item,data){
    const name=itemName(item);
    if(ZERO_NAMES.has(text(name)))return {nutrition:{kcal:0,protein:0,carbs:0,fat:0},product:null,stock:null};

    const inventory=data.inventory;
    const products=data.products;
    let stock=item?.inventory_id?inventory.find(row=>String(row.id)===String(item.inventory_id)):null;

    if(!stock){
      const exact=inventory.filter(row=>key(row.name)===key(name));
      if(exact.length===1)stock=exact[0];
    }

    let product=null;
    if(stock){
      product=productForStock(stock,data);
      if(!product&&stock.family_name){
        let related=inventory.filter(row=>text(row.family_name)===text(stock.family_name));
        const mode=rowMode(stock);
        if(mode==='fresh')related=related.filter(row=>rowMode(row)!=='frozen');
        if(mode==='frozen')related=related.filter(row=>rowMode(row)==='frozen');
        const currentProducts=related.map(row=>productForStock(row,data)).filter(Boolean);
        product=chooseProduct(currentProducts);
      }
    }else{
      const familyRows=inventory.filter(row=>familyMatch(name,row.family_name));
      if(familyRows.length){
        const requested=familyMatch(name,familyRows[0].family_name);
        let related=familyRows;
        if(requested==='fresh')related=related.filter(row=>rowMode(row)!=='frozen');
        if(requested==='frozen')related=related.filter(row=>rowMode(row)==='frozen');
        const currentProducts=related.map(row=>productForStock(row,data)).filter(Boolean);
        product=chooseProduct(currentProducts);
      }
      if(!product&&!familyRows.length)product=chooseProduct(products.filter(row=>key(row.product_name)===key(name)));
    }

    if(product)return {nutrition:nutritionOf(product),product,stock};
    const fromNote=noteNutrition(stock);
    return fromNote?{nutrition:fromNote,product:null,stock}:null;
  }

  function basisAmount(item,source){
    const qty=number(item?.quantity);
    if(qty===null||qty<0)return null;
    const unit=text(item?.unit);
    if(unit==='g'||unit==='ml')return qty;
    if(unit==='kg'||unit==='l')return qty*1000;

    const product=source?.product||{};
    const productData=product.product_data&&typeof product.product_data==='object'?product.product_data:{};
    const packageUnit=text(product.package_unit);
    const servingUnit=text(product.serving_unit);
    const values=[
      productData.piece_weight_g,
      productData.unit_weight_g,
      productData.slice_weight_g,
      (servingUnit==='g'||servingUnit==='ml')?product.serving_quantity:null,
      (number(product.servings_per_package)>0&&(packageUnit==='g'||packageUnit==='ml'))
        ?number(product.package_quantity)/number(product.servings_per_package)
        :null,
      (/^(päckchen|packung)$/.test(unit)&&(packageUnit==='g'||packageUnit==='ml'))?product.package_quantity:null
    ].map(number).filter(v=>v!==null&&v>0);
    if(values.length)return qty*values[0];

    const note=String(source?.stock?.note||'');
    const unitPattern=unit==='zehe'?'zehe(?:n)?':unit==='scheibe'?'scheibe(?:n)?':unit==='stück'?'stück':unit==='päckchen'?'päckchen':unit==='packung'?'packung(?:en)?':null;
    if(unitPattern){
      const match=note.match(new RegExp('([0-9]+(?:[.,][0-9]+)?)\\s*g\\s+pro\\s+'+unitPattern,'i'));
      if(match){
        const weight=Number(match[1].replace(',','.'));
        if(Number.isFinite(weight)&&weight>0)return qty*weight;
      }
    }
    return null;
  }

  function calculate(items,servings,data,allocationMap=null){
    const rows=Array.isArray(items)?items:[];
    if(!rows.length)return {complete:false,missing:['Keine Zutaten']};
    const div=Math.max(.01,number(servings)||1);
    let kcal=0,protein=0;
    const missing=[];
    for(const item of rows){
      const allocationOverride=item?.id&&allocationMap?.get?.(String(item.id))||null;
      const familyNutrition=genericFamilyNutrition(item,data,allocationOverride);
      if(familyNutrition){
        if(!familyNutrition.complete){missing.push(...(familyNutrition.missing||[itemName(item)]));continue;}
        kcal+=familyNutrition.kcal;
        protein+=familyNutrition.protein;
        continue;
      }
      const source=sourceFor(item,data);
      if(!source){missing.push(itemName(item));continue;}
      const amount=basisAmount(item,source);
      if(amount===null){missing.push(itemName(item)+' ('+(item?.unit||'Einheit')+')');continue;}
      if(source.nutrition.kcal===null||source.nutrition.protein===null){missing.push(itemName(item));continue;}
      kcal+=source.nutrition.kcal*amount/100;
      protein+=source.nutrition.protein*amount/100;
    }
    if(missing.length)return {complete:false,missing:[...new Set(missing)]};
    return {complete:true,kcal:kcal/div,protein:protein/div,missing:[]};
  }

  const zeroNutrition=()=>({complete:true,kcal:0,protein:0,missing:[]});
  const combine=(a,b)=>a?.complete&&b?.complete
    ?{complete:true,kcal:a.kcal+b.kcal,protein:a.protein+b.protein,missing:[]}
    :{complete:false,missing:[...(a?.missing||[]),...(b?.missing||[])]};

  function formatNumber(value,max=1){
    return new Intl.NumberFormat('de-DE',{maximumFractionDigits:max}).format(value);
  }
  function nutritionText(n){
    return n?.complete?Math.round(n.kcal)+' kcal · '+formatNumber(n.protein,1)+' g Protein':'';
  }

  function ensureAllocationStyle(){
    if(document.getElementById('food-ingredient-allocation-style-v711'))return;
    const style=document.createElement('style');
    style.id='food-ingredient-allocation-style-v711';
    style.textContent=
      '.food-recipe-detail-block-v572 ul li.food-ingredient-has-allocation-v711{display:grid!important;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:3px 10px}'+
      '.food-recipe-detail-block-v572 ul li.food-ingredient-has-allocation-v711>span{grid-column:1}'+
      '.food-recipe-detail-block-v572 ul li.food-ingredient-has-allocation-v711>b{grid-column:2}'+
      '.food-ingredient-allocation-v711{grid-column:1/-1;display:grid;gap:2px;margin:1px 0 1px 14px;padding:0}'+
      '.food-ingredient-allocation-line-v711{display:flex;align-items:baseline;justify-content:space-between;gap:10px;color:#78857b;font-size:9px;line-height:1.35}'+
      '.food-ingredient-allocation-line-v711>span{min-width:0}'+
      '.food-ingredient-allocation-line-v711>b{flex:none;color:#607365;font-size:9px;font-weight:800}'+
      '.food-ingredient-allocation-missing-v711{color:#a06a4d!important}';
    document.head.appendChild(style);
  }

  function formatQty(value,unit){
    const n=number(value);
    if(n===null)return '';
    return formatNumber(n,2)+' '+String(unit||'').trim();
  }

  function patchIngredientAllocations(){
    /* V712: Sichtbare FIFO-Aufteilung wird direkt von food-v544.js gerendert.
       Dieses Overlay bleibt ausschließlich für dynamische Nährwerte zuständig. */
    return 0;
  }

  function patchMeta(card,nutrition){
    const em=card.querySelector('button[data-food-recipe-toggle] em,button[data-food-meal-toggle] em');
    if(!em)return false;
    const parts=String(em.textContent||'').split(/\s*·\s*/).filter(Boolean)
      .filter(part=>!/^\d+(?:[.,]\d+)?\s*kcal$/i.test(part)&&!/^\d+(?:[.,]\d+)?\s*g\s+Protein$/i.test(part)&&!/^(kcal|Nährwerte) offen$/i.test(part));
    const nutritionParts=nutrition?.complete
      ?nutritionText(nutrition).split(/\s*·\s*/)
      :['kcal offen'];
    let insertAt=parts.findIndex(part=>/zubereitet|geplant|erledigt|vorbereitet|gegessen/i.test(part));
    if(insertAt<0)insertAt=parts.findIndex(part=>/Portion(?:en)?\s+zubereitet/i.test(part));
    if(insertAt<0)insertAt=parts.length;
    parts.splice(insertAt,0,...nutritionParts);
    const next=parts.join(' · ');
    if(em.textContent!==next)em.textContent=next;
    card.dataset.foodNutritionV711=nutrition?.complete?'dynamic':'unresolved';
    if(nutrition?.complete)em.removeAttribute('title');
    else em.title='Noch keine vollständigen Nährwerte: '+[...new Set(nutrition?.missing||[])].join(', ');
    return Boolean(nutrition?.complete);
  }

  // Je Mahlzeit: dynamische Nährwerte pro Portion * an diesem Tag gegessene Portionen.
  // Für Meal Prep bleibt die zubereitete Gesamtmenge der Divisor, niemals die Tagessumme.
  function recordDailyNutrition(totals,meal,nutrition){
    const date=String(meal?.meal_date||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
    const day=totals.get(date)||{kcal:0,protein:0,meals:0,unresolved:0};
    day.meals++;
    if(nutrition?.complete){
      const eaten=number(meal?.eaten_servings);
      const portions=eaten!==null&&eaten>0?eaten:1;
      day.kcal+=nutrition.kcal*portions;
      day.protein+=nutrition.protein*portions;
    }else day.unresolved++;
    totals.set(date,day);
  }

  function dailySummary(day){
    if(!day||!day.meals)return {
      kcal:'0 kcal',protein:'0 g',note:'Noch keine Mahlzeiten eingeplant.',incomplete:false
    };
    const incomplete=day.unresolved>0;
    const allMissing=day.unresolved===day.meals;
    const suffix=incomplete?' bisher':'';
    return {
      kcal:allMissing?'kcal offen':formatNumber(Math.round(day.kcal),0)+' kcal'+suffix,
      protein:allMissing?'Protein offen':formatNumber(day.protein,1)+' g'+suffix,
      note:incomplete
        ?day.unresolved+' '+(day.unresolved===1?'Mahlzeit ohne vollständige Nährwerte':'Mahlzeiten ohne vollständige Nährwerte')
        :day.meals+' '+(day.meals===1?'Mahlzeit':'Mahlzeiten')+' im Tagesplan',
      incomplete
    };
  }

  function setText(el,value){
    if(el&&el.textContent!==value)el.textContent=value;
  }

  function patchDailyTotals(root,totals){
    // Die beiden festen Anzeigeplätze werden bereits beim Erstellen der Tageskarte
    // erzeugt. Kein Suchen nach "HEUTE", denn die FOOD-Ansicht entfernt diese Überschrift.
    const todayPanel=root.querySelector('[data-food-day-summary-today]');
    if(todayPanel){
      const day=dailySummary(totals.get(todayIso()));
      setText(todayPanel.querySelector('[data-food-day-kcal]'),day.kcal);
      setText(todayPanel.querySelector('[data-food-day-protein]'),day.protein);
      setText(todayPanel.querySelector('[data-food-day-summary-note]'),day.note);
      todayPanel.classList.toggle('is-incomplete-v777',day.incomplete);
    }

    // Alle im Plan angezeigten Tage, auch zugeklappte, erhalten denselben Stand.
    root.querySelectorAll('[data-food-plan-day]').forEach(group=>{
      const line=group.querySelector('[data-food-day-summary-plan]');
      if(!line)return;
      const day=dailySummary(totals.get(String(group.dataset.foodPlanDay||'')));
      setText(line,day.kcal+' · '+day.protein+(day.incomplete?' · unvollständig':''));
      line.classList.toggle('is-incomplete-v777',day.incomplete);
    });
  }

  function ensureDailyTotalStyle(){
    if(document.getElementById('food-day-summary-style-v777'))return;
    const style=document.createElement('style');
    style.id='food-day-summary-style-v777';
    style.textContent=
      '.food-day-summary-v777{box-sizing:border-box;max-width:100%;min-width:0;display:grid;gap:9px;margin:4px 0 14px;padding:13px 14px;border:1px solid rgba(54,93,67,.16);border-radius:17px;background:linear-gradient(135deg,rgba(246,250,240,.97),rgba(225,236,222,.95));box-shadow:0 8px 18px rgba(43,72,48,.05);color:#263c2b}'+
      '.food-day-summary-title-v777{color:#57765b;font-size:10px;font-weight:850;letter-spacing:.11em}'+
      '.food-day-summary-values-v777{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}'+
      '.food-day-stat-v777{min-width:0;padding:10px 11px;border:1px solid rgba(58,100,70,.1);border-radius:12px;background:rgba(255,255,255,.78)}'+
      '.food-day-stat-v777 small{display:block;margin-bottom:5px;color:#677c6c;font-size:10px;font-weight:700}'+
      '.food-day-stat-v777 strong{display:block;color:#234d36;font-size:clamp(15px,4.5vw,22px);font-weight:850;line-height:1.2;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}'+
      '.food-day-summary-note-v777{color:#6a7d6d;font-size:10px;line-height:1.4}'+
      '.food-day-summary-v777.is-incomplete-v777 .food-day-stat-v777 strong{color:#a46b37}'+
      '.food-day-summary-v777.is-incomplete-v777 .food-day-summary-note-v777{color:#946733}'+
      '.food-plan-day-v685>.food-day-label-v544 .food-plan-day-summary-v777{display:block;margin-top:5px;color:#356344;font-size:11px;font-weight:800;line-height:1.4;overflow-wrap:anywhere}'+
      '.food-plan-day-v685>.food-day-label-v544 .food-plan-day-summary-v777.is-incomplete-v777{color:#9d7138}';
    document.head.appendChild(style);
  }

  function plusDays(iso,days){
    const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);
  }
  function todayIso(){
    try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin'}).format(new Date());}
    catch(_){return new Date().toISOString().slice(0,10);}
  }

  async function fetchData(){
    const supabase=window.getSupabaseClient?.();
    if(!supabase)throw new Error('Supabase-Client fehlt.');
    const session=await supabase.auth.getSession();
    if(session?.error||!session?.data?.session?.user?.id)throw new Error('Keine aktive Sitzung.');
    const from=plusDays(todayIso(),-45);
    const to=plusDays(todayIso(),60);
    const results=await Promise.all([
      supabase.from('food_recipes').select('id,title,servings,calories_kcal_per_serving,protein_g_per_serving,food_recipe_ingredients(id,name,label,quantity,unit,sort_order,inventory_id)').eq('active',true),
      supabase.from('food_meals').select('id,meal_date,meal_type,title,status,sort_order,inventory_booked_at,recipe_id,prepared_servings,eaten_servings,leftover_id,source_meal_id,calories_kcal_per_serving_override,food_meal_ingredients(id,name,label,quantity,unit,sort_order,inventory_id)').gte('meal_date',from).lte('meal_date',to),
      supabase.from('food_inventory_overview').select('id,name,family_name,variant_label,quantity,unit,note,is_active,sort_order').eq('is_active',true),
      supabase.from('shopping_products').select('id,inventory_id,brand,product_name,variant,package_quantity,package_unit,nutrition_per_100,product_data,servings_per_package,serving_quantity,serving_unit,active').eq('active',true),
      supabase.from('food_inventory_lots').select('id,product_id,inventory_id,purchased_on,unopened_packages,opened_remaining_quantity,opened_remaining_unit,package_quantity,package_unit')
    ]);
    const bad=results.find(result=>result.error);
    if(bad?.error)throw bad.error;
    return {
      recipes:results[0].data||[],
      meals:results[1].data||[],
      inventory:results[2].data||[],
      products:results[3].data||[],
      lots:results[4].data||[]
    };
  }

  async function refresh(){
    if(running){rerun=true;return;}
    const root=document.getElementById(ROOT_ID);
    if(!root||root.getAttribute('aria-hidden')==='true')return;
    running=true;
    try{
      const data=await fetchData();
      const recipeMap=new Map(data.recipes.map(row=>[String(row.id),row]));
      const mealMap=new Map(data.meals.map(row=>[String(row.id),row]));
      const unresolvedRecipes=[];
      const unresolvedMeals=[];
      const planState=plannedMealAllocationState(data);
      let dynamicRecipes=0,dynamicMeals=0,allocationRows=0;
      const dailyTotals=new Map();

      root.querySelectorAll('[data-food-recipe-card]').forEach(card=>{
        const recipe=recipeMap.get(String(card.dataset.foodRecipeCard||''));
        if(!recipe)return;
        const recipeItems=recipe.food_recipe_ingredients||[];
        const n=calculate(recipeItems,recipe.servings||1,data);
        allocationRows+=patchIngredientAllocations(card,recipeItems,data,null,{show:true});
        if(patchMeta(card,n))dynamicRecipes++;
        else unresolvedRecipes.push({id:recipe.id,title:recipe.title,missing:n.missing||[]});
      });

      root.querySelectorAll('[data-food-meal-card]').forEach(card=>{
        const meal=mealMap.get(String(card.dataset.foodMealCard||''));
        if(!meal)return;
        let n=null;
        const items=meal.food_meal_ingredients||[];
        const mealContext=planState.contexts.get(String(meal.id))||data;
        const mealAllocations=planState.allocations.get(String(meal.id))||null;
        if(meal.leftover_id||meal.source_meal_id){
          const source=meal.source_meal_id?mealMap.get(String(meal.source_meal_id)):null;
          const recipe=meal.recipe_id?recipeMap.get(String(meal.recipe_id)):null;
          const base=source
            ?calculate(source.food_meal_ingredients||[],source.prepared_servings||1,data)
            :(recipe?calculate(recipe.food_recipe_ingredients||[],recipe.servings||1,data):{complete:false,missing:['Meal-Prep-Basis']});
          const extras=items.length?calculate(items,meal.eaten_servings||meal.prepared_servings||1,mealContext,mealAllocations):zeroNutrition();
          n=combine(base,extras);
        }else{
          n=calculate(items,meal.prepared_servings||meal.eaten_servings||1,mealContext,mealAllocations);
        }
        allocationRows+=patchIngredientAllocations(card,items,mealContext,mealAllocations,{show:text(meal.status)!=='completed'});
        recordDailyNutrition(dailyTotals,meal,n);
        if(patchMeta(card,n))dynamicMeals++;
        else unresolvedMeals.push({id:meal.id,title:meal.title,missing:n?.missing||[]});
      });

      ensureDailyTotalStyle();
      patchDailyTotals(root,dailyTotals);
      lastStatus={
        dayTotals:[...dailyTotals].map(([date,day])=>({date,...day})),
        recipes:data.recipes.length,
        meals:data.meals.length,
        dynamicRecipes,
        dynamicMeals,
        allocationRows,
        unresolvedRecipes,
        unresolvedMeals,
        refreshedAt:new Date().toISOString()
      };
    }catch(error){
      console.warn('V711 FOOD dynamic nutrition + allocations:',error);
      lastStatus={...lastStatus,error:error?.message||String(error),refreshedAt:new Date().toISOString()};
    }finally{
      running=false;
      if(rerun){rerun=false;schedule(250);}
    }
  }

  function schedule(delay=180){
    clearTimeout(timer);
    timer=setTimeout(()=>refresh(),delay);
  }

  const observer=new MutationObserver(mutations=>{
    if(mutations.some(m=>m.type==='childList'&&m.addedNodes.length))schedule();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});

  document.addEventListener('click',event=>{
    if(event.target?.closest?.('[data-food-tab],[data-food-edit-recipe],[data-food-edit-planned-meal],[data-food-edit-free-meal]'))schedule(450);
  },true);

  window.__modFoodNutritionV711={
    version:VERSION,
    refresh,
    getStatus(){return structuredClone(lastStatus);}
  };
  schedule(450);
})();