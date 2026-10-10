/* V780 · FOOD nutrition: planned quantities independent of stock; salt zero-kcal.
   Rechnet Rezept- und Mahlzeitenwerte aus den aktuellen Zutatenmengen.
   Generische Zutatenfamilien werden sichtbar und planreihenfolge-bewusst
   auf konkrete Vorratsprodukte aufgeteilt. */
(function(){
  'use strict';
  if(window.__modFoodNutritionV711)return;

  const VERSION='V795';
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
    // Mirror SQL's legacy-first consumption for untracked older stock.
    return '0001-01-01';
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

  // Nährwerte richten sich nach geplanten Gramm/Millilitern, nicht nach
  // momentan verfügbarem Vorrat. Der FIFO-Vorrat bestimmt nur, welches
  // konkrete Produkt bei generischen Familien zuerst verwendet werden soll.
  function genericFamilyNutrition(item,data,allocationOverride=null){
    const name=itemName(item);
    // Salz und Wasser bleiben null-kcal, auch wenn ein Vorratseintrag
    // oder eine Vorratsfamilie mit genau diesem Namen existiert.
    if(ZERO_NAMES.has(text(name)))return null;
    const unit=text(item?.unit);
    if(!['g','kg','ml','l'].includes(unit))return null;
    const pinned=item?.inventory_id
      ?(data?.inventory||[]).find(row=>String(row.id)===String(item.inventory_id))
      :null;
    if(item?.inventory_id&&(!pinned||!pinned.family_name||text(name)!==text(pinned.family_name)))return null;

    const familyStocks=(data?.inventory||[])
      .filter(row=>row?.is_active!==false)
      .filter(row=>familyMatch(name,row.family_name)==='generic')
      .filter(row=>stockAmountInBaseUnit({...row,quantity:1},unit)!==null)
      .sort((a,b)=>{
        const firstLot=id=>(data?.lots||[])
          .filter(lot=>String(lot.inventory_id||'')===String(id))
          .map(lot=>String(lot.purchased_on||'')).filter(Boolean).sort()[0]||'0001-01-01';
        return firstLot(a.id).localeCompare(firstLot(b.id))||
          Number(a.sort_order||0)-Number(b.sort_order||0)||
          String(a.id).localeCompare(String(b.id));
      });
    if(!familyStocks.length)return null;

    const requested=number(item?.quantity);
    if(requested===null||requested<0)return {complete:false,missing:[name+' (Menge)']};
    if(requested===0)return {complete:true,kcal:0,protein:0,missing:[]};

    // Die tatsächlich belegten FIFO-Teilmengen für unterschiedliche Produkte
    // berücksichtigen. Für eine noch fehlende Menge das zuletzt ausgewählte
    // Familienprodukt fortschreiben, nicht kcal=0 oder "Vorrat reicht nicht".
    const allocation=allocationOverride||genericFamilyAllocation(item,data);
    const parts=(allocation?.allocations||[]).filter(part=>number(part.take)>0);
    let kcal=0,protein=0,used=0,lastProduct=null;
    for(const part of parts){
      const stock=part.stock||familyStocks.find(row=>String(row.id)===String(part.inventoryId||''));
      const product=productForStock(stock,data);
      if(!product)return {complete:false,missing:[name+' (Nährwertprodukt ungeklärt)']};
      const nut=nutritionOf(product);
      if(nut.kcal===null||nut.protein===null)return {complete:false,missing:[name+' (Nährwerte fehlen)']};
      const amount=basisAmount({quantity:part.take,unit:item.unit},{product,stock});
      if(amount===null)return {complete:false,missing:[name+' (Einheit)']};
      kcal+=nut.kcal*amount/100;
      protein+=nut.protein*amount/100;
      used+=Number(part.take);
      lastProduct=product;
    }
    const remaining=Math.max(0,requested-used);
    if(remaining>0.0001){
      // Ohne vorhandene Portion anhand der bekannten Familienprodukte eine
      // stabile Produktannahme wählen. Einkaufslücken bleiben getrennt sichtbar.
      let product=lastProduct;
      if(!product){
        for(const row of familyStocks){
          product=productForStock(row,data);
          if(product)break;
        }
      }
      if(!product)return {complete:false,missing:[name+' (Nährwertprodukt ungeklärt)']};
      const nut=nutritionOf(product);
      if(nut.kcal===null||nut.protein===null)return {complete:false,missing:[name+' (Nährwerte fehlen)']};
      const amount=basisAmount({quantity:remaining,unit:item.unit},{product,stock:pinned});
      if(amount===null)return {complete:false,missing:[name+' (Einheit)']};
      kcal+=nut.kcal*amount/100;
      protein+=nut.protein*amount/100;
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
      // Ein explizit eingeplantes Produkt darf auch nach Ausverkauf/Archivierung
      // des Vorratselements anhand seiner gespeicherten Produkt-ID berechenbar sein.
      if(item?.inventory_id){
        product=chooseProduct(products.filter(row=>String(row.inventory_id||'')===String(item.inventory_id)));
      }
      const familyRows=inventory.filter(row=>familyMatch(name,row.family_name));
      if(!product&&familyRows.length){
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
      unit==='stück'?productData.edible_weight_per_piece_g:null,
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
      // Nährwertfreie Grundzutaten niemals per Familien-/FIFO-Produktlookup
      // auflösen. Fehlende Herstellerdaten dürfen Salz nicht blockieren.
      if(ZERO_NAMES.has(text(itemName(item))))continue;
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


  // Nährwert-Qualitätsprüfung zusätzlich zur Kalorienrechnung. Es reicht
  // nicht, wenn eine alte Packung des gleichen Vorrats Werte hatte: jede
  // aktive, aktuell verwendbare Packung muss eigene Nährwerte besitzen.
  function nutritionProblem(item,data,allocationOverride=null){
    if(!item||ZERO_NAMES.has(text(itemName(item))))return null;
    const name=itemName(item);
    const qty=number(item.quantity);
    const entry={id:String(item.id||''),name,reason:''};
    if(qty===null||qty<0)return {...entry,reason:'Die Zutatenmenge ist ungültig oder fehlt.'};
    if(qty===0)return null;
    const inventory=data.inventory||[];
    const products=data.products||[];
    const lots=data.lots||[];
    let stocks=[];
    if(item.inventory_id){
      const stock=inventory.find(row=>String(row.id)===String(item.inventory_id));
      if(stock)stocks=[stock];
    }else{
      const allocation=allocationOverride||genericFamilyAllocation(item,data);
      if(allocation?.allocations?.length){
        stocks=allocation.allocations.map(part=>part.stock||inventory.find(row=>String(row.id)===String(part.inventoryId||''))).filter(Boolean);
      }else{
        stocks=inventory.filter(row=>key(row.name)===key(name));
      }
    }
    const seen=new Set();
    for(const stock of stocks){
      if(seen.has(String(stock.id)))continue;
      seen.add(String(stock.id));
      const liveLots=lots.filter(lot=>String(lot.inventory_id||'')===String(stock.id))
        .filter(lot=>number(lot.unopened_packages)>0||number(lot.opened_remaining_quantity)>0);
      for(const lot of liveLots){
        if(!lot.product_id)continue;
        const product=products.find(row=>String(row.id)===String(lot.product_id));
        if(!product)return {...entry,reason:'Die aktuelle Vorratscharge hat keinen gültigen Produktstamm-Eintrag.'};
        const n=nutritionOf(product);
        const absent=[n.kcal===null?'Kalorien':null,n.protein===null?'Protein':null].filter(Boolean);
        const productLabel=[product.brand,product.product_name,product.variant].filter(Boolean).join(' · ');
        if(absent.length){
          return {...entry,reason:'Bei '+(productLabel||stock.name)+' fehlen '+absent.join(' und ')+' je 100 g/ml.'};
        }
        if(product.product_data?.nutrition_provisional===true||product.product_data?.nutrition_requires_packaging_check===true){
          return {...entry,provisional:true,reason:'Bei '+(productLabel||stock.name)+' sind die Nährwerte nur vorläufig eingetragen. Bitte mit der Verpackung abgleichen.'};
        }
      }
    }
    const generic=genericFamilyNutrition(item,data,allocationOverride);
    if(generic?.complete)return null;
    if(generic&&!generic.complete){
      return {...entry,reason:'Für diese Zutatenfamilie sind die Nährwerte nicht vollständig zugeordnet.'};
    }
    const source=sourceFor(item,data);
    if(!source)return {...entry,reason:'Kein passender Nährwert-Datensatz im Produktstamm gefunden.'};
    if(source.nutrition.kcal===null||source.nutrition.protein===null){
      const absent=[source.nutrition.kcal===null?'Kalorien':null,source.nutrition.protein===null?'Protein':null].filter(Boolean);
      return {...entry,reason:absent.join(' und ')+' je 100 g/ml fehlen im Produktstamm.'};
    }
    if(basisAmount(item,source)===null){
      return {...entry,reason:'Für die Einheit '+String(item.unit||'')+' fehlt ein verlässliches Stückgewicht bzw. eine Umrechnung.'};
    }
    return null;
  }

  const alarmEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function mealTypeForAlarm(type){
    return ({breakfast:'Frühstück',lunch:'Mittagessen',snack:'Snack',dinner:'Abendessen'})[type]||String(type||'Mahlzeit');
  }
  function mealNutritionWarningMarkup(warnings){
    const count=warnings.reduce((sum,meal)=>sum+meal.issues.length,0);
    const incomplete=warnings.some(meal=>meal.issues.some(issue=>!issue.provisional));
    const headline=incomplete?'WICHTIG: NÄHRWERTE FEHLEN':'WICHTIG: NÄHRWERTE UNBESTÄTIGT';
    const message=incomplete?'Bitte Produktdaten nachtragen. Der Tageswert ist unvollständig.':'Vorläufige Produktwerte bitte anhand der Packung bestätigen.';
    return '<section class="food-nutrition-alarm-inner-v795" role="alert" aria-label="Nährwerte prüfen">'
      +'<div class="food-nutrition-alarm-head-v795"><span class="food-nutrition-alarm-flame-v795" aria-hidden="true">🔥</span>'
      +'<div><strong>'+headline+'</strong><small>'+message+'</small></div>'
      +'<span class="food-nutrition-alarm-count-v795">'+count+'</span></div>'
      +'<div class="food-nutrition-alarm-list-v795">'
      +warnings.map(meal=>'<button type="button" class="food-nutrition-alarm-link-v795" data-food-nutrition-goto="'+alarmEscape(meal.id)+'">'
        +'<span class="food-nutrition-alarm-meal-v795">'+alarmEscape(mealTypeForAlarm(meal.type))+' · '+alarmEscape(meal.title)+'</span>'
        +'<span class="food-nutrition-alarm-issue-v795">'+meal.issues.map(issue=>'⚠ '+alarmEscape(issue.name)+': '+alarmEscape(issue.reason)).join('<span class="food-nutrition-alarm-break-v795"></span>')+'</span>'
        +'<span class="food-nutrition-alarm-arrow-v795" aria-hidden="true">↗</span>'
        +'</button>').join('')
      +'</div></section>';
  }
  function patchNutritionAlarm(root,warnings){
    const panel=root.querySelector('[data-food-nutrition-alarm]');
    if(!panel)return;
    if(!warnings.length){panel.hidden=true;if(panel.innerHTML)panel.innerHTML='';return;}
    const html=mealNutritionWarningMarkup(warnings);
    if(panel.innerHTML!==html)panel.innerHTML=html;
    panel.hidden=false;
  }
  function patchMealNutritionProblems(card,issues){
    const ids=new Set(issues.map(issue=>issue.id).filter(Boolean));
    const names=new Set(issues.map(issue=>key(issue.name)));
    card.querySelectorAll('[data-food-ingredient-id]').forEach(li=>{
      const selected=ids.has(String(li.dataset.foodIngredientId||''));
      li.classList.toggle('food-nutrition-ingredient-bad-v795',selected);
      const existing=li.querySelector('[data-food-nutrition-ingredient-hint]');
      const issue=selected?issues.find(row=>row.id===li.dataset.foodIngredientId):null;
      const reason=issue?.reason||'';
      if(issue){
        if(!existing){
          const hint=document.createElement('small');
          hint.className='food-nutrition-ingredient-hint-v795';
          hint.setAttribute('data-food-nutrition-ingredient-hint','');
          hint.textContent='⚠ '+reason;
          li.appendChild(hint);
        }else if(existing.textContent!=='⚠ '+reason)existing.textContent='⚠ '+reason;
      }else if(existing)existing.remove();
    });
    // Bei zugeklappten Mahlzeiten ist die fehlerhafte Zutat trotzdem sichtbar.
    let note=card.querySelector('[data-food-nutrition-card-warning]');
    if(!issues.length){card.classList.remove('food-nutrition-meal-bad-v795');if(note)note.remove();return;}
    card.classList.add('food-nutrition-meal-bad-v795');
    const summary='⚠ Nährwerte prüfen: '+[...names].map(name=>issues.find(issue=>key(issue.name)===name)?.name||name).join(', ');
    if(!note){
      note=document.createElement('div');
      note.className='food-nutrition-card-warning-v795';
      note.setAttribute('data-food-nutrition-card-warning','');
      const toggle=card.querySelector('[data-food-meal-toggle]');
      if(toggle)toggle.insertAdjacentElement('afterend',note);
      else card.prepend(note);
    }
    if(note.textContent!==summary)note.textContent=summary;
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
      .filter(part=>!/^\d+(?:[.,]\d+)?\s*kcal$/i.test(part)&&!/^\d+(?:[.,]\d+)?\s*g\s+Protein$/i.test(part)&&!/^(kcal|Nährwerte) offen$/i.test(part)&&!/^Nährwert(e)? prüfen:/i.test(part));
    const reasons=[...new Set(nutrition?.missing||[])];
    const nutritionParts=nutrition?.complete
      ?nutritionText(nutrition).split(/\s*·\s*/)
      :['kcal offen',...(reasons.length?['Nährwerte prüfen: '+reasons.slice(0,2).join(', ')+(reasons.length>2?' …':'')]:[])];
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
      kcal:'0 kcal',protein:'0 g Protein',note:'',label:'Tag gesamt',incomplete:false
    };
    const incomplete=day.unresolved>0;
    const allMissing=day.unresolved===day.meals;
    return {
      kcal:allMissing?'kcal offen':formatNumber(Math.round(day.kcal),0)+' kcal',
      protein:allMissing?'Protein offen':formatNumber(day.protein,1)+' g Protein',
      note:incomplete?'⚠ '+day.unresolved+' offen':'',
      label:incomplete?'Teilsumme':'Tag gesamt',
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
      setText(todayPanel.querySelector('[data-food-day-summary-label]'),day.label);
      todayPanel.classList.toggle('is-incomplete-v778',day.incomplete);
    }

    // Alle im Plan angezeigten Tage, auch zugeklappte, erhalten denselben Stand.
    root.querySelectorAll('[data-food-plan-day]').forEach(group=>{
      const line=group.querySelector('[data-food-day-summary-plan]');
      if(!line)return;
      const day=dailySummary(totals.get(String(group.dataset.foodPlanDay||'')));
      setText(line,day.kcal+' · '+day.protein+(day.incomplete?' · '+day.note:''));
      line.classList.toggle('is-incomplete-v778',day.incomplete);
    });
  }

  function ensureDailyTotalStyle(){
    if(document.getElementById('food-day-summary-style-v779'))return;
    const style=document.createElement('style');
    style.id='food-day-summary-style-v779';
    style.textContent=
      '.food-day-summary-v778{box-sizing:border-box;max-width:100%;min-width:0;display:flex;align-items:center;gap:6px;margin:1px 0 10px;padding:8px 10px;border:1px solid rgba(145,117,177,.26);border-radius:10px;background:linear-gradient(105deg,rgba(241,227,249,.92),rgba(226,246,231,.90));color:#514763;line-height:1.25;white-space:nowrap;overflow:hidden;font-size:11px}'+
      '.food-day-summary-title-v778{flex:none;color:#685578;font-size:10px;font-weight:720;letter-spacing:0}'+
      '.food-day-summary-value-v778{min-width:0;flex:none;font-size:11px;font-weight:790;color:#60427f;font-variant-numeric:tabular-nums}'+
      '.food-day-summary-value-v778[data-food-day-protein]{color:#287453}'+
      '.food-day-summary-separator-v778{flex:none;color:#887b94;font-weight:500}'+
      '.food-day-summary-note-v778{min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:10px;font-weight:680;color:#874d7b}'+
      '.food-day-summary-note-v778:empty{display:none}'+
      '.food-day-summary-v778.is-incomplete-v778{border-color:rgba(145,117,177,.31);background:linear-gradient(105deg,rgba(241,227,249,.94),rgba(226,246,231,.91))}'+
      '.food-plan-day-v685>.food-day-label-v544 .food-plan-day-summary-v778{display:block;margin-top:4px;color:#67517f;font-size:10px;font-weight:700;line-height:1.25;overflow-wrap:anywhere}'+
      '.food-plan-day-v685>.food-day-label-v544 .food-plan-day-summary-v778.is-incomplete-v778{color:#874d7b}'+
      '@media(max-width:390px){.food-day-summary-v778{gap:4px;padding:7px 8px;font-size:10px}.food-day-summary-title-v778{font-size:9px}.food-day-summary-value-v778{font-size:10px}.food-day-summary-note-v778{font-size:9px}}';
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
      const todayWarnings=[];

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
        const isBooked=text(meal.status)==='completed'||Boolean(meal.inventory_booked_at);
        const issueItems=[...items];
        if(meal.leftover_id||meal.source_meal_id){
          const source=meal.source_meal_id?mealMap.get(String(meal.source_meal_id)):null;
          if(source)issueItems.push(...(source.food_meal_ingredients||[]));
          else if(meal.recipe_id){
            const baseRecipe=recipeMap.get(String(meal.recipe_id));
            if(baseRecipe)issueItems.push(...(baseRecipe.food_recipe_ingredients||[]));
          }
        }
        const issues=[];
        for(const item of issueItems){
          const allocation=mealAllocations?.get?.(String(item.id||''))||null;
          // Aktuelle Chargen sind für noch geplante Mahlzeiten maßgeblich.
          // Abgeschlossene Mahlzeiten nie wegen späterer Einkäufe umbuchen.
          if(isBooked&&n?.complete)continue;
          const problem=nutritionProblem(item,mealContext,allocation);
          if(problem&&!issues.some(issue=>issue.id===problem.id&&issue.name===problem.name))issues.push(problem);
        }
        if(!n?.complete&&!issues.length){
          const missing=[...new Set(n?.missing||[])];
          for(const reason of missing)issues.push({id:'',name:reason,reason:'Für diese Zutat sind die Nährwerte oder die Produktzuordnung nicht vollständig.'});
        }
        if(issues.some(issue=>!issue.provisional)&&n?.complete){
          n={complete:false,missing:issues.map(issue=>issue.name)};
        }
        patchMealNutritionProblems(card,issues);
        if(String(meal.meal_date)===todayIso()&&issues.length){
          todayWarnings.push({id:String(meal.id),title:String(meal.title||'Mahlzeit'),type:String(meal.meal_type||''),issues});
        }
        recordDailyNutrition(dailyTotals,meal,n);
        if(patchMeta(card,n))dynamicMeals++;
        else unresolvedMeals.push({id:meal.id,title:meal.title,missing:n?.missing||[]});
      });

      ensureDailyTotalStyle();
      patchNutritionAlarm(root,todayWarnings);
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
        nutritionAlarmMeals:todayWarnings,
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
    const target=event.target?.closest?.('[data-food-nutrition-goto]');
    if(target){
      const id=String(target.dataset.foodNutritionGoto||'');
      const root=document.getElementById(ROOT_ID);
      const findCard=()=>[...(root?.querySelectorAll('[data-food-meal-card]')||[])]
        .find(card=>String(card.dataset.foodMealCard)===id);
      const card=findCard();
      const toggle=card?.querySelector('[data-food-meal-toggle]');
      if(toggle?.getAttribute('aria-expanded')==='false')toggle.click();
      requestAnimationFrame(()=>{
        const current=findCard();
        current?.scrollIntoView?.({behavior:'smooth',block:'center'});
        current?.querySelector('[data-food-meal-toggle]')?.focus?.({preventScroll:true});
      });
    }
    if(event.target?.closest?.('[data-food-tab],[data-food-edit-recipe],[data-food-edit-planned-meal],[data-food-edit-free-meal]'))schedule(450);
  },true);

  window.__modFoodNutritionV711={
    version:VERSION,
    refresh,
    getStatus(){return structuredClone(lastStatus);}
  };
  schedule(450);
})();