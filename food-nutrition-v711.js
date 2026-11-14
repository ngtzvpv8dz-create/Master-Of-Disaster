/* V780 · FOOD nutrition: planned quantities independent of stock; salt zero-kcal.
   Rechnet Rezept- und Mahlzeitenwerte aus den aktuellen Zutatenmengen.
   Generische Zutatenfamilien werden sichtbar und planreihenfolge-bewusst
   auf konkrete Vorratsprodukte aufgeteilt. */
(function(){
  'use strict';
  if(window.__modFoodNutritionV711)return;

  const VERSION='V849';
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
    const carbsExact=nutrient(n,['carbohydrates_g','carbs_g']);
    const carbsUpper=nutrient(n,['carbohydrates_g_lt','carbs_g_lt']);
    return {
      kcal:nutrient(n,['energy_kcal','calories_kcal','kcal']),
      protein:nutrient(n,['protein_g','protein']),
      carbs:carbsExact!==null?carbsExact:carbsUpper,
      carbsBound:carbsExact===null&&carbsUpper!==null,
      fat:nutrient(n,['fat_g'])
    };
  }


  // V844: Ingredient-level public reference profiles, not purchases, brands or stocks.
  // Source codes and approximations are explicit. Never manufacture stock or a historical lot.
  // Source: Bundeslebensmittelschlüssel 4.0 (Max Rubner-Institut, CC BY 4.0)
  // and labelled generic comparisons for ingredients not covered by exact stock.
  const GENERAL_REFERENCE_BY_KEY={
    "sojasauce":{kcal:76.6,protein:7.3,fat:1.02,carbs:6.35,unit:"ml",source:"BLS R143000 (66kcal/100g), auf 100ml mit geschätzter Dichte 1,16g/ml umgerechnet",url:"https://blsdb.de/food?foodId=38320"},
    "hokkaidokürbis":{kcal:31,protein:1.4,fat:0.2,carbs:5.298,unit:"g",source:"BLS G581000 Hokkaido roh (Kerne entfernt)",url:"https://blsdb.de/food?foodId=38550"},
    "kichererbsenabgetropft":{kcal:148,protein:8.4,fat:3,carbs:17.4,unit:"g",source:"BLS G770432 Kichererbse reif gekocht; Konserve abgetropft Näherung",url:"https://blsdb.de/food?foodId=42409"},
    "räucherlachs":{kcal:166,protein:21.25,fat:10,carbs:0.2,unit:"g",source:"Mittelwert zweier früher gelisteter Marken, 155–177 kcal; genaue Marke unbestimmt",url:"project-product-catalog"},
    "tomatensalsa":{kcal:40,protein:1.2,fat:0.3,carbs:7,unit:"g",source:"Allgemeine ungesüßte Tomatensalsa, Rezepturvarianten stark abweichend",url:"general-reference"},
    "tomatenmark":{kcal:96,protein:4.8,fat:1,carbs:14.5,unit:"g",source:"EDEKA Bio Tomatenmark zweifach konzentriert, vorläufige Referenz bis die tatsächliche Packung erfasst ist",url:"https://www.edeka.de/sortiment/4311501446232/"},
    "buchweizenmehl":{kcal:354,protein:12.52,fat:3.12,carbs:65.08,unit:"g",source:"BLS C424000 Buchweizenmehl roh",url:"https://blsdb.de/food?foodId=38473"},
    "tkerbsen":{kcal:78,protein:5.15,fat:0.27,carbs:10,unit:"g",source:"USDA 170017 grüne TK-Erbsen gegart als Näherung",url:"https://fdc.nal.usda.gov/food-details/170017/nutrients"},
    "vollkornbrot":{kcal:210,protein:7.16,fat:1.01,carbs:38,unit:"g",source:"BLS B101000 Vollkornbrot, nur wenn konkrete Sorte/Einheit nicht zugeordnet werden kann",url:"https://blsdb.de/food?foodId=39581",pieceWeight:50},
    "öl":{kcal:884,protein:0,fat:100,carbs:0,unit:"g",source:"Generisches Speiseöl, 100% Fett, Gewichts- statt Volumeneinheit",url:"generic-vegetable-oil"},
    "mageresrindfleisch":{kcal:130,protein:21,fat:5,carbs:0,unit:"g",source:"Mageres Rindfleisch roh, generischer Zuschnitt",url:"generic-raw-lean-beef"},
    "basilikumgetrocknet":{kcal:233,protein:23,fat:4.1,carbs:22.9,unit:"g",source:"Getrockneter Basilikum, allgemeine Gewürzreferenz",url:"generic-dried-basil"},
    "backpulver":{kcal:88,protein:0.09,fat:0.124,carbs:21.6,unit:"g",source:"BLS R421100 Backpulver, Standardpäckchen 16g angenommen",url:"https://blsdb.de/food?foodId=38326",pieceWeight:16},
    "nussmischung":{kcal:605,protein:18,fat:52,carbs:11,unit:"g",source:"Ungesalzene gemischte Nüsse, illustrative Referenz, Arten nicht bekannt",url:"generic-nuts-mix"},
    "ajamarillopaste":{kcal:50,protein:1,fat:0.5,carbs:10,unit:"g",source:"Gelbe Chilipaste ohne bestätigte Produktrezeptur; grober Richtwert",url:"generic-aji-pepper-paste"},
    "hummus":{kcal:324,protein:5.9,fat:28.5,carbs:8,unit:"g",source:"BLS H960000 Hummus; handelsüblicher Hummus kann stark abweichen",url:"https://blsdb.de/food?foodId=43318"},
    "haselnüsse":{kcal:657,protein:16.25,fat:63.3,carbs:4.2,unit:"g",source:"BLS H130100 rohe Haselnuss",url:"https://blsdb.de/food?foodId=38221"},
    "edamametkohneschote":{kcal:146,protein:13,fat:6.8,carbs:6.2,unit:"g",source:"BLS G750100 Edamame rohe Bohnen ohne Schote als TK-Näherung",url:"https://blsdb.de/food?foodId=38556"},
    "frühlingszwiebel":{kcal:33,protein:0.9,fat:0.15,carbs:5.99,unit:"g",source:"BLS G486100 Frühlingszwiebel roh, ohne Laub; gesamt mögliche Abweichung",url:"https://blsdb.de/food?foodId=38545"},
    "lauchzwiebeln":{kcal:32,protein:1.83,fat:0.19,carbs:4.74,unit:"g",source:"USDA FDC 170005 Frühlingszwiebeln roh, mit Grün; verfügbare KH 7.34 minus 2.6 g Ballaststoffe",url:"https://fdc.nal.usda.gov/food-details/170005/nutrients"},
    "ricotta":{kcal:158,protein:8.58,fat:12.3,carbs:3.43,unit:"g",source:"BLS M741600 Ricotta 45% Fett i.Tr.",url:"https://blsdb.de/food?foodId=39164"},
    "körnigerfrischkäse":{kcal:72,protein:12.7,fat:0.4,carbs:4,unit:"g",source:"Vorläufiger Planwert: zuletzt dokumentierter Milbona Körniger Frischkäse leicht, 72 kcal/100g (Produktfoto 16.10.2026); aktuell 0 g Bestand, neue Marke beim Einkauf prüfen",url:"project-product-catalog"},
    "tkkirschen":{kcal:55,protein:1,fat:0.2,carbs:12,unit:"g",source:"TK-Kirschen, generischer Vergleich",url:"generic-frozen-cherries"},
    "kokosraspeln":{kcal:660,protein:7,fat:65,carbs:7.4,unit:"g",source:"Getrocknete Kokosraspeln ungesüßt, allgemeine Referenz",url:"generic-unsweetened-desiccated-coconut"},
    "ananas":{kcal:46,protein:0.5,fat:0.1,carbs:9.4,unit:"g",source:"BLS F501100 Ananas roh, essbarer Anteil",url:"https://blsdb.de/food?foodId=39149"},
    "mandelmus":{kcal:558,protein:25.3,fat:46.6,carbs:4.51,unit:"g",source:"BLS H212800 Mandelmus ungesüßt",url:"https://blsdb.de/food?foodId=39154"},
    "misopaste":{kcal:174,protein:10.6,fat:10.5,carbs:6.2,unit:"g",source:"BLS H862200 Miso Sojabohnenpaste",url:"https://blsdb.de/food?foodId=38242"},
    "kürbisgewürz":{kcal:300,protein:7,fat:8,carbs:47,unit:"g",source:"Pumpkin-Spice Gewürzmischung, Rezeptur unbekannt, 1g nur Näherung",url:"generic-pumpkin-spice"},
    "pita":{kcal:275,protein:9.1,fat:1.2,carbs:55.7,unit:"g",source:"Weizen-Pita-Brot, generischer Vergleich, genaue Rezeptur unbekannt",url:"generic-white-pita"},
    "haferkeks":{kcal:450,protein:7,fat:17,carbs:62,unit:"g",source:"Haferkeks, generischer Richtwert, Rezeptur variiert",url:"generic-oat-biscuit"},
    "limette":{kcal:28,protein:0.5,fat:0.2,carbs:1.9,unit:"g",source:"BLS F602100 Limette roh, essbarer Anteil",url:"https://blsdb.de/food?foodId=39150"},
    "mangoessbar":{kcal:60,protein:0.7,fat:0.45,carbs:12,unit:"g",source:"BLS F516100 Mango roh, essbarer Anteil",url:"https://blsdb.de/food?foodId=38167"},
    "zitrone":{kcal:40,protein:0.7,fat:0.4,carbs:3.16,unit:"g",source:"BLS F601100 Zitrone roh, essbarer Anteil",url:"https://blsdb.de/food?foodId=38946"},
    "schnittlauch":{kcal:29,protein:2.6,fat:0.74,carbs:1.54,unit:"g",source:"BLS G081100 Schnittlauch roh",url:"https://blsdb.de/food?foodId=38179"},
    "radieschen":{kcal:19,protein:1.05,fat:0.14,carbs:2.31,unit:"g",source:"BLS G691100 Radieschen roh",url:"https://blsdb.de/food?foodId=38952"},
    "halloumi":{kcal:321,protein:23,fat:25,carbs:2.3,unit:"g",source:"Halloumi, typischer Grillkäse; Herstellerwerte variieren",url:"generic-halloumi"},
    "teriyakisauce":{kcal:100,protein:2,fat:0.1,carbs:22,unit:"g",source:"Teriyaki-Sauce, generische Rezeptur; Zucker und Salz je Marke variieren",url:"generic-teriyaki-sauce"}
  };
  const originalAlias=name=>key(name);
  function referenceFor(item){
    const ref=GENERAL_REFERENCE_BY_KEY[originalAlias(itemName(item))];
    if(!ref)return null;
    const unit=text(item.unit);
    if(ref.unit==='g'&&!['g','kg','stück','scheibe','päckchen','packung'].includes(unit))return null;
    if(ref.unit==='ml'&&!['ml','l'].includes(unit))return null;
    const product={
      product_name:'Nährwertreferenz: '+itemName(item),
      active:false,
      category:'Nährwertreferenz (kein Einkauf)',
      nutrition_per_100:{energy_kcal:ref.kcal,protein_g:ref.protein,
        fat_g:ref.fat,carbohydrates_g:ref.carbs,basis:'per_100_'+ref.unit},
      product_data:{nutrition_reference_only:true,nutrition_source:ref.source,
        nutrition_source_url:ref.url,reference_prepared_by:'BLS4.0 + public generic comparisons',
        ...(ref.pieceWeight?{unit_weight_g:ref.pieceWeight}:{})},
      ...(ref.pieceWeight?{serving_quantity:ref.pieceWeight,serving_unit:'g'}:{})
    };
    return {nutrition:nutritionOf(product),product,stock:null,reference:true,
      sourceName:ref.source,sourceUrl:ref.url};
  }
  // For broad recipe names, prefer the *single current physically present* variant.
  // Never conflate distinct fat percentages, or a refrigerated and frozen ingredient.
  function uniquelyPresentAlias(name,data){
    const aliases={
      'griechischer joghurt':stock=>/^griechischer joghurt (?:2 %|9,4 %)$/.test(text(stock.family_name)),
      'tk-asiagemüse':stock=>text(stock.family_name)==='asia-gemüse'&&(rowMode(stock)==='frozen'||text(stock.name).includes('gemüsepfanne'))
    };
    const rule=aliases[text(name)];
    if(!rule)return null;
    const stocks=(data?.inventory||[]).filter(stock=>stock.is_active!==false&&number(stock.quantity)>0&&rule(stock));
    if(stocks.length!==1)return null;
    const p=productForStock(stocks[0],data);
    const n=nutritionOf(p);
    return p&&n.kcal!==null&&n.protein!==null
      ?{nutrition:n,product:p,stock:stocks[0],reference:false,alias:true}
      :null;
  }

  function signature(product){
    const n=nutritionOf(product);
    return [n.kcal,n.protein].map(v=>v===null?'?':String(v)).join('|');
  }

  function chooseProduct(rows){
    const usable=(rows||[]).filter(row=>{
      const n=nutritionOf(row);
      return n.kcal!==null&&n.protein!==null;
    });
    if(!usable.length)return null;
    if(new Set(usable.map(signature)).size!==1)return null;
    // Same kcal/protein does not imply same fat/carbohydrates.
    const profiles=new Set(usable.map(p=>{
      const n=nutritionOf(p);
      return [n.fat,n.carbs,n.carbsBound?'upper-bound':'exact'].map(x=>x===null?'?':String(x)).join('|');
    }));
    if(profiles.size>1){
      const first=usable[0];
      return {...first,nutrition_per_100:{
        ...first.nutrition_per_100,fat_g:null,carbohydrates_g:null,carbs_g:null,carbohydrates_g_lt:null,carbs_g_lt:null
      }};
    }
    return usable[0];
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
    // Existing physical lots keep their product identity even after the catalogue entry is archived.
    // For untracked stock, only currently selectable products may determine nutrition.
    return chooseProduct(liveIds.size
      ?products.filter(product=>liveIds.has(String(product.id)))
      :products.filter(product=>product.active!==false));
  }

  function rowMode(row){
    const value=text((row?.name||'')+' '+(row?.variant_label||''));
    if(/(?:^|\s)(?:tk|tiefkühl|tiefgekühlt|tiefgefroren|gefroren)(?:\s|$)/.test(value))return 'frozen';
    if(/(?:^|\s)(?:frisch|frische|frischer|frisches|babyspinat)(?:\s|$)/.test(value))return 'fresh';
    return 'neutral';
  }

  // Eier der Größen M und L nur mit einem explizit passenden Packungsnachweis
  // verknüpfen. Kein Übergang von "Eier Größe M" auf eine L-Charge.
  const eggSizeNeed=name=>{
    const match=text(name).match(/^(?:ei|eier)\s+(?:größe|groesse)\s+([ml])$/);
    return match?match[1]:null;
  };
  const stockMatchesEggSize=(name,stock,data)=>{
    const size=eggSizeNeed(name);
    if(!size)return true;
    const variant=text([stock?.variant_label,stock?.catalog_variant_label].filter(Boolean).join(' '));
    if(new RegExp('(?:^|\\s)(?:größe|groesse)\\s*'+size+'(?:\\s|$)').test(variant))return true;
    const lotIds=new Set((data?.lots||[]).filter(l=>String(l.inventory_id||'')===String(stock?.id||'')
      &&((Number(l.opened_remaining_quantity)||0)>0||(Number(l.unopened_packages)||0)>0))
      .map(l=>String(l.product_id||'')).filter(Boolean));
    if(!lotIds.size)return false;
    return [...lotIds].every(id=>(data?.products||[]).some(p=>String(p.id||'')===id
      &&text(p.product_data?.egg_size)===size));
  };
  function familyMatch(name,family){
    const need=text(name);
    const base=text(family);
    if(!need||!base)return null;
    // V830: "Frischkäse leicht" darf NICHT aus dem getrennten körnigen
    // Frischkäse-Familienvorrat bedient werden. Exakte Sorte hat Vorrang.
    if(need==='frischkäse leicht'&&base!=='frischkäse leicht')return null;
    // V849: Ordinary onions in cooked recipes also allow a TK partial
    // allocation; cooked/fresh provenance and per-lot nutrition stay exact.
    if(need==='zwiebel'&&base==='zwiebeln tk')return 'generic';
    // Match both the full food family and every slash-separated synonym.
    // e.g. "Feta / Hirtenkäse" and "Feta" resolve to the same stock.
    const aliases=[base,...base.split(/\s*[/|]\s*/)].filter(Boolean);
    for(const alias of aliases){
      if(need===alias)return 'generic';
      if(need.startsWith(alias+' ')||need.endsWith(' '+alias)){
        if(/\b(?:tk|tiefkühl|tiefgekühlt|tiefgefroren|gefroren)\b/.test(need))return 'frozen';
        if(/\b(?:frisch|frische|frischer|frisches|bio|babyspinat)\b/.test(need))return 'fresh';
        return 'generic';
      }
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

  // Keep nutrition's product allocation in step with FOOD and SQL booking.
  // Family membership is not itself permission to substitute incompatible types.
  function familyStockOrder(a,b,data,name){
    const meat=/(hähnchen|huhn|hackfleisch|rind|schwein|pute|fleisch)/.test(text(name));
    const active=stock=>(data?.lots||[]).filter(lot=>String(lot.inventory_id)===String(stock.id))
      .filter(lot=>Number(lot.unopened_packages||0)>0||Number(lot.opened_remaining_quantity||0)>0);
    const pa=active(a),pb=active(b);
    if(!meat){
      // Existing suitable fresh vegetables before frozen replacements.
      const modeA=rowMode(a)==='frozen'?1:0,modeB=rowMode(b)==='frozen'?1:0;
      if(modeA!==modeB)return modeA-modeB;
      const openedA=pa.some(l=>Number(l.opened_remaining_quantity)>0)?0:1;
      const openedB=pb.some(l=>Number(l.opened_remaining_quantity)>0)?0:1;
      if(openedA!==openedB)return openedA-openedB;
      const expiry=lots=>lots.filter(l=>!/(gefrier|tiefkühl|freezer|frozen)/.test(text(l.storage_location)))
        .map(l=>String(l.best_before_date||'')).filter(Boolean).sort()[0]||'9999-12-31';
      const md=expiry(pa).localeCompare(expiry(pb));
      if(md)return md;
    }
    return lotDateForInventory(a.id,data).localeCompare(lotDateForInventory(b.id,data))
      ||Number(a.sort_order||0)-Number(b.sort_order||0)
      ||String(a.id).localeCompare(String(b.id));
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
    if(!['g','kg','ml','l','stück'].includes(unit))return null;

    const inventory=(data?.inventory||[])
      .filter(row=>row?.is_active!==false)
      .filter(row=>familyMatch(name,row.family_name)==='generic')
      .filter(row=>stockMatchesEggSize(name,row,data))
      .filter(row=>number(row.quantity)>0);

    if(!inventory.length)return null;

    const compatible=inventory
      .map(stock=>({stock,available:stockAmountInBaseUnit(stock,unit)}))
      .filter(entry=>entry.available!==null&&entry.available>0)
      .sort((a,b)=>familyStockOrder(a.stock,b.stock,data,name));

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
    if(!['g','kg','ml','l','stück'].includes(unit))return null;
    const pinned=item?.inventory_id
      ?(data?.inventory||[]).find(row=>String(row.id)===String(item.inventory_id))
      :null;
    if(item?.inventory_id&&(!pinned||!pinned.family_name||text(name)!==text(pinned.family_name)))return null;

    const familyStocks=(data?.inventory||[])
      .filter(row=>row?.is_active!==false)
      .filter(row=>familyMatch(name,row.family_name)==='generic')
      .filter(row=>stockMatchesEggSize(name,row,data))
      .filter(row=>stockAmountInBaseUnit({...row,quantity:1},unit)!==null)
      .sort((a,b)=>familyStockOrder(a,b,data,name));
    if(!familyStocks.length)return null;

    const requested=number(item?.quantity);
    if(requested===null||requested<0)return {complete:false,missing:[name+' (Menge)']};
    if(requested===0)return {complete:true,kcal:0,protein:0,fat:0,carbs:0,carbsBound:false,missing:[]};

    // Die tatsächlich belegten FIFO-Teilmengen für unterschiedliche Produkte
    // berücksichtigen. Für eine noch fehlende Menge das zuletzt ausgewählte
    // Familienprodukt fortschreiben, nicht kcal=0 oder "Vorrat reicht nicht".
    const allocation=allocationOverride||genericFamilyAllocation(item,data);
    const parts=(allocation?.allocations||[]).filter(part=>number(part.take)>0);
    let kcal=0,protein=0,fat=0,carbs=0,fatKnown=true,carbsKnown=true,carbsBound=false,used=0,lastProduct=null;
    for(const part of parts){
      const stock=part.stock||familyStocks.find(row=>String(row.id)===String(part.inventoryId||''));
      // V877: Eine Zutatenfamilie kann mehrere reale Marken/Chargen IN EINEM
      // Vorratsartikel enthalten (z. B. 216 ml ja! Milch 47 kcal und 3 l
      // Milbona 46 kcal). chooseProduct() lehnt zu Recht ein einzelnes
      // Produkt bei unterschiedlichen Nährwerten ab. Deshalb die Portion
      // zuerst chargengenau in derselben Reihenfolge wie beim Verbrauch
      // ausrechnen, anstatt eine falsche "Nährwerte fehlen"-Warnung zu zeigen.
      const lotMix=stock?mixedLotNutrition({
        name:stock.name,
        inventory_id:stock.id,
        quantity:part.take,
        unit:item.unit
      },data):null;
      if(lotMix){
        if(!lotMix.complete)return {complete:false,missing:lotMix.missing||[name+' (Chargennährwerte ungeklärt)']};
        kcal+=lotMix.kcal;
        protein+=lotMix.protein;
        if(lotMix.fat===null||lotMix.fat===undefined)fatKnown=false;else fat+=lotMix.fat;
        if(lotMix.carbs===null||lotMix.carbs===undefined)carbsKnown=false;else carbs+=lotMix.carbs;
        if(lotMix.carbsBound)carbsBound=true;
        used+=Number(part.take);
        lastProduct=lotMix.lastProduct||lastProduct;
        continue;
      }
      const product=productForStock(stock,data);
      if(!product)return {complete:false,missing:[name+' (Nährwertprodukt ungeklärt)']};
      const nut=nutritionOf(product);
      if(nut.kcal===null||nut.protein===null)return {complete:false,missing:[name+' (Nährwerte fehlen)']};
      const amount=basisAmount({...item,quantity:part.take,unit:item.unit},{product,stock});
      if(amount===null)return {complete:false,missing:[name+' (Einheit)']};
      kcal+=nut.kcal*amount/100;
      protein+=nut.protein*amount/100;
      if(nut.fat===null)fatKnown=false;else fat+=nut.fat*amount/100;
      if(nut.carbs===null)carbsKnown=false;else carbs+=nut.carbs*amount/100;
      if(nut.carbsBound)carbsBound=true;
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
      const amount=basisAmount({...item,quantity:remaining,unit:item.unit},{product,stock:pinned});
      if(amount===null)return {complete:false,missing:[name+' (Einheit)']};
      kcal+=nut.kcal*amount/100;
      protein+=nut.protein*amount/100;
      if(nut.fat===null)fatKnown=false;else fat+=nut.fat*amount/100;
      if(nut.carbs===null)carbsKnown=false;else carbs+=nut.carbs*amount/100;
      if(nut.carbsBound)carbsBound=true;
    }
    return {complete:true,kcal,protein,fat:fatKnown?fat:null,carbs:carbsKnown?carbs:null,
      carbsBound:carbsKnown&&carbsBound,missing:[]};
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

  // Planned shopping/recipe forecasts must reserve the SAME chosen products
  // that confirmed consumption and nutrition will use.
  function reserveConfirmedAllocation(item,quantities,data){
    const parts=Array.isArray(item?.allocation_override)?item.allocation_override:null;
    if(!parts?.length)return false;
    const reservations=[];
    let total=0;
    for(const part of parts){
      const stock=(data?.inventory||[]).find(row=>String(row.id)===String(part.inventory_id||''));
      const amount=number(part.quantity);
      if(!stock||amount===null||amount<=0)return true; // invalid saved split: do not switch silently
      const need=quantityInStockUnit({quantity:amount,unit:part.unit||item.unit},stock);
      if(need===null)return true;
      total+=amount;
      reservations.push({id:String(stock.id),need});
    }
    if(Math.abs(total-(number(item.quantity)||0))>0.001)return true;
    for(const {id,need} of reservations){
      const before=number(quantities.get(id));
      if(before!==null)quantities.set(id,Math.max(0,before-need));
    }
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

      if(text(meal.status)!=='planned'||meal.inventory_booked_at)continue;

      const perIngredient=new Map();
      const items=[...(meal.food_meal_ingredients||[])].sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0));
      for(const item of items){
        // Explicitly chosen stock is authoritative; never reserve a second,
        // potentially different generic variant for the same ingredient.
        if(reserveConfirmedAllocation(item,quantities,data))continue;
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
    // Abgebuchte, bereits zubereitete Zutaten verwenden ihre bei der Zubereitung
    // gesicherte Produktnährwert-Quelle statt den inzwischen leeren Vorrat.
    if(item?.prepared_nutrition_per_100){
      const product={nutrition_per_100:item.prepared_nutrition_per_100};
      return {nutrition:nutritionOf(product),product,stock:null};
    }

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
      const familyRows=inventory.filter(row=>familyMatch(name,row.family_name)
        &&stockMatchesEggSize(name,row,data));
      if(!product&&familyRows.length){
        const requested=familyMatch(name,familyRows[0].family_name);
        let related=familyRows;
        if(requested==='fresh')related=related.filter(row=>rowMode(row)!=='frozen');
        if(requested==='frozen')related=related.filter(row=>rowMode(row)==='frozen');
        // V876: Bei Familien mit Stückvorrat und Gramm-Rezeptmenge (z. B. Apfel)
        // nur tatsächlich vorhandene Sorten betrachten. 0 Granny Smith darf
        // 6 Pink Lady nicht zu einem falschen "Nährwerte fehlen" machen.
        const available=related.filter(row=>number(row.quantity)>0);
        if(available.length)related=available;
        const currentProducts=related.map(row=>productForStock(row,data)).filter(Boolean);
        product=chooseProduct(currentProducts);
      }
      if(!product&&!familyRows.length)product=chooseProduct(products.filter(row=>row.active!==false&&key(row.product_name)===key(name)));
    }

    if(product)return {nutrition:nutritionOf(product),product,stock};
    const fromNote=noteNutrition(stock);
    if(fromNote)return {nutrition:fromNote,product:null,stock};
    return uniquelyPresentAlias(name,data)||referenceFor(item);
  }

  function basisAmount(item,source){
    const qty=number(item?.quantity);
    if(qty===null||qty<0)return null;
    const unit=text(item?.unit);
    // Kikkoman pack and manufacturer nutrition are per 100 ml, while current
    // meal instructions and ingredient quantities use grams on the kitchen scale.
    // Never count grams as millilitres. 1 ml ~ 1.08 g, same as inventory migration.
    const soyByVolume=/(?:sojasauce|sojasoße|sojasosse)/i.test(itemName(item))
      &&text(source?.product?.nutrition_per_100?.basis)==='per_100_ml';
    if(unit==='g'&&soyByVolume)return qty/1.08;
    if(unit==='kg'&&soyByVolume)return qty*1000/1.08;
    if(unit==='g'||unit==='ml')return qty;
    if(unit==='kg'||unit==='l')return qty*1000;

    const product=source?.product||{};
    const productData=product.product_data&&typeof product.product_data==='object'?product.product_data:{};
    // Bread is physically stored as whole slices, while its label provides
    // per-100-g nutrition. Use the owner's exact weighing of the SELECTED
    // numbered slice, never a 500g/9-slices average or a weight from another slice.
    if((unit==='scheibe'||unit==='scheiben')&&Array.isArray(productData.numbered_slices)){
      // Numbered slices have different weights. Never multiply the weight of
      // one slice by a multi-slice count or reuse an old pack's average.
      const label=String(item?.label||'');
      let selected=[...label.matchAll(/\bnr\.?\s*(\d+)(?:\s*(?:\+|&|,|und)\s*(?:nr\.?\s*)?(\d+))?/gi)]
        .flatMap(match=>[match[1],match[2]].filter(Boolean).map(Number));
      if(!selected.length){
        const single=label.match(/\bscheibe\s*(\d+)\b/i);
        if(single)selected=[Number(single[1])];
      }
      if(selected.length){
        if(!Number.isInteger(qty)||selected.length!==qty||
           new Set(selected).size!==selected.length)return null;
        const weights=selected.map(index=>number(productData.numbered_slices
          .find(row=>Number(row.slice_number)===index)?.gross_weight_g));
        return weights.every(weight=>weight!==null&&weight>0)
          ?weights.reduce((sum,weight)=>sum+weight,0):null;
      }
      return null;
    }
    if(unit==='stück'&&Array.isArray(productData.individual_gross_piece_weights_g)){
      // The user's explicitly labelled physical piece selects exactly one measured
      // gross weight (including peel, according to the owner's weighing rule).
      // Never average all remaining pieces or invent an edible-yield percentage.
      const label=String(item.label||'');
      const match=label.match(/(?:Nr\.?|Nummer)\s*(\d+)\b/i);
      if(match){
        const index=Number(match[1])-1;
        const measured=number(productData.individual_gross_piece_weights_g[index]);
        if(measured!==null&&measured>0)return qty*measured;
      }
    }
    const packageUnit=text(product.package_unit);
    const servingUnit=text(product.serving_unit);
    const values=[
      unit==='stück'?productData.edible_weight_per_piece_g:null,
      unit==='stück'?productData.edible_weight_per_piece_estimated_g:null,
      productData.piece_weight_g,
      unit==='stück'?eggEdibleWeightFromKnownSize(product):null,
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

  // V809: Mixed physical batches in ONE inventory item have different real
  // product values. Calculate the portion across actual lots, never guess a
  // single arbitrary product. Inventory quantities can be reduced by earlier
  // planned meals, so skip the already reserved amount before allocating.
  // Eggs are sold by size, not individually weighed. Keep the established
  // nominal standard M=60 g / L=70 g (including shell). As in the existing
  // size-M catalogue entry, nutrition uses approx. 90% edible portion.
  // Only apply to explicitly size-labelled eggs; never to produce or wraps.
  function eggEdibleWeightFromKnownSize(product){
    if(!/^eier?$/.test(text(product?.product_name)))return null;
    const data=product?.product_data||{};
    const marked=String(data.egg_size||'').trim().toUpperCase();
    const variantSize=String(product?.variant||'').match(/Größe\s*([ML])\b/i);
    const size=marked==='M'||marked==='L'?marked:variantSize?.[1]?.toUpperCase();
    return size==='M'?54:size==='L'?63:null;
  }

  // Use the user's recorded individual paprika weights and exact purchased lot
  // instead of a guessed per-piece average. Applied only to "Paprika rot".
  function measuredPaprikaNutrition(item,data){
    if(text(itemName(item))!=='paprika rot'||text(item?.unit)!=='stück')return null;
    let parts=Array.isArray(item?.allocation_override)?item.allocation_override:null;
    if(!parts?.length&&item?.recipe_id){
      // Recipe previews may use the uniquely matching planned meal's verified
      // physical pieces. Never borrow weights from an unrelated recipe use.
      const matches=(data?.meals||[])
        .filter(meal=>String(meal.recipe_id||'')===String(item.recipe_id))
        .flatMap(meal=>(meal.food_meal_ingredients||[])
          .filter(row=>String(row.label||'')===String(item.label||'')
            &&text(row.name)===text(item.name)
            &&text(row.unit)===text(item.unit)
            &&number(row.quantity)===number(item.quantity)
            &&Array.isArray(row.allocation_override)
            &&row.allocation_override.length)
          .map(row=>row.allocation_override));
      if(matches.length===1)parts=matches[0];
    }
    const requested=number(item?.quantity);
    if(!Array.isArray(parts)||!parts.length||requested===null||requested<=0)return null;
    const selected=new Set();
    let used=0,kcal=0,protein=0,fat=0,carbs=0,fatKnown=true,carbsKnown=true,carbsBound=false;
    for(const part of parts){
      const take=number(part?.quantity);
      const grams=number(part?.piece_weight_g);
      const identity=String(part?.piece_id||'');
      if(!identity||selected.has(identity)||text(part?.unit)!=='stück'
        ||take===null||take<=0||grams===null||grams<=0)return null;
      selected.add(identity);
      const lot=(data?.lots||[]).find(row=>String(row.id)===String(part.lot_id||'')
        &&String(row.inventory_id)===String(part.inventory_id||''));
      const product=lot&&(data?.products||[]).find(row=>String(row.id)===String(lot.product_id||''));
      if(!product)return null;
      const n=nutritionOf(product);
      if(n.kcal===null||n.protein===null)return null;
      const factor=grams*take/100;
      kcal+=n.kcal*factor;
      protein+=n.protein*factor;
      if(n.fat===null)fatKnown=false;else fat+=n.fat*factor;
      if(n.carbs===null)carbsKnown=false;else carbs+=n.carbs*factor;
      if(n.carbsBound)carbsBound=true;
      used+=take;
    }
    if(Math.abs(used-requested)>.0001)return null;
    return {complete:true,kcal,protein,
      fat:fatKnown?fat:null,carbs:carbsKnown?carbs:null,
      carbsBound:carbsKnown&&carbsBound,missing:[]};
  }

  function mixedLotNutrition(item,data){
    const stocks=data?.inventory||[];
    const name=itemName(item);
    const stock=item?.inventory_id
      ?stocks.find(row=>String(row.id)===String(item.inventory_id))
      :(()=>{
        const matches=stocks.filter(row=>key(row.name)===key(name));
        return matches.length===1?matches[0]:null;
      })();
    if(!stock)return null;
    const stockUnit=text(stock.unit),unit=text(item.unit);
    const units=['g','kg','ml','l','stück'];
    if(!units.includes(unit)||!units.includes(stockUnit))return null;
    const conversion=source=>{
      if(source===stockUnit)return 1;
      if(source==='kg'&&stockUnit==='g')return 1000;
      if(source==='g'&&stockUnit==='kg')return .001;
      if(source==='l'&&stockUnit==='ml')return 1000;
      if(source==='ml'&&stockUnit==='l')return .001;
      return null;
    };
    const multiplier=conversion(unit);
    if(multiplier===null)return null;
    const lots=(data?.lots||[]).filter(l=>String(l.inventory_id)===String(stock.id));
    const active=lots.map(l=>{
      const open=text(l.opened_remaining_unit)===stockUnit?Math.max(0,number(l.opened_remaining_quantity)||0):0;
      const unopened=text(l.package_unit)===stockUnit
        ?Math.max(0,number(l.unopened_packages)||0)*Math.max(0,number(l.package_quantity)||0):0;
      return {lot:l,amount:open+unopened,open};
    }).filter(v=>v.amount>0&&v.lot.product_id);
    if(new Set(active.map(v=>String(v.lot.product_id))).size<2)return null;
    const quantity=number(item.quantity);
    if(quantity===null||quantity<0)return {complete:false,missing:[name+' (Menge)']};
    const required=quantity*multiplier;
    if(required===0)return {complete:true,kcal:0,protein:0,fat:0,carbs:0,carbsBound:false,missing:[]};
    const total=active.reduce((sum,v)=>sum+v.amount,0);
    const current=number(stock.quantity);
    if(current===null||current>total+.001)return {complete:false,missing:[name+' (nicht zugeordneter Altbestand)']};
    let skip=Math.max(0,total-current),remaining=required,kcal=0,protein=0,fat=0,carbs=0,fatKnown=true,carbsKnown=true,carbsBound=false,lastProduct=null;
    const isFrozen=v=>/(gefrier|tiefkühl|freezer|frozen)/.test(text(v.lot.storage_location));
    const isMeat=/(hähnchen|huhn|hackfleisch|rind|schwein|pute|fleisch)/.test(text(stock.name));
    const rank=v=>isMeat?0:v.open>0?0:isFrozen(v)?2:1;
    const dateKey=v=>String(v.lot.purchased_on||String(v.lot.created_at||'').slice(0,10));
    active.sort((a,b)=>rank(a)-rank(b)
      ||(isMeat
        ?dateKey(a).localeCompare(dateKey(b))
        :(isFrozen(a)?'9999-12-31':String(a.lot.best_before_date||'9999-12-31')).localeCompare(isFrozen(b)?'9999-12-31':String(b.lot.best_before_date||'9999-12-31'))
          ||String(a.lot.purchased_on||'9999-12-31').localeCompare(String(b.lot.purchased_on||'9999-12-31')))
      ||String(a.lot.created_at||'').localeCompare(String(b.lot.created_at||''))
      ||String(a.lot.id||'').localeCompare(String(b.lot.id||'')));
    for(const entry of active){
      const usable=Math.max(0,entry.amount-skip);
      skip=Math.max(0,skip-entry.amount);
      if(!usable)continue;
      const taken=Math.min(remaining,usable);
      const product=(data?.products||[]).find(p=>String(p.id)===String(entry.lot.product_id));
      if(!product)return {complete:false,missing:[name+' (Chargenprodukt fehlt)']};
      const n=nutritionOf(product);
      if(n.kcal===null||n.protein===null)return {complete:false,missing:[name+' (Chargennährwerte fehlen)']};
      lastProduct=product;
      const grams=stockUnit==='kg'||stockUnit==='l'?taken*1000:taken;
      let macroFactor=grams/100;
      if(stockUnit==='stück'){
        // V830: Für Obst die vereinbarte essbare Stückmenge übernehmen.
        // product_data war bislang vorhanden, wurde hier aber ignoriert.
        const each=number(product?.product_data?.edible_weight_per_piece_g)
          ||number(product?.product_data?.edible_weight_per_piece_estimated_g)
          ||(text(product.serving_unit)==='g'?number(product.serving_quantity):null)
          ||eggEdibleWeightFromKnownSize(product);
        if(!each)return {complete:false,missing:[name+' (Stückgewicht fehlt)']};
        kcal+=n.kcal*each*taken/100;
        protein+=n.protein*each*taken/100;
        macroFactor=each*taken/100;
      }else{
        kcal+=n.kcal*grams/100;
        protein+=n.protein*grams/100;
      }
      if(n.fat===null)fatKnown=false;else fat+=n.fat*macroFactor;
      if(n.carbs===null)carbsKnown=false;else carbs+=n.carbs*macroFactor;
      if(n.carbsBound)carbsBound=true;
      remaining-=taken;
      if(remaining<=.0001)break;
    }
    if(remaining>.0001)return {complete:false,missing:[name+' (Chargenzuordnung unvollständig)']};
    return {complete:true,kcal,protein,fat:fatKnown?fat:null,carbs:carbsKnown?carbs:null,
      carbsBound:carbsKnown&&carbsBound,missing:[],lastProduct};
  }

  // V901: A user's saved physical product/lot allocation is authoritative.
  // Nutrition must match the exact stock that booking will consume, even
  // after the meal is completed and the original lot is empty.
  function confirmedAllocationNutrition(item,data,historical=false){
    const parts=Array.isArray(item?.allocation_override)?item.allocation_override:null;
    if(!parts?.length)return null;
    const name=itemName(item);
    const invalid=reason=>({complete:false,missing:[name+' ('+reason+')']});
    const wanted=number(item.quantity);
    if(wanted===null||wanted<=0)return invalid('Menge');
    let covered=0,kcal=0,protein=0,fat=0,carbs=0;
    let fatKnown=true,carbsKnown=true,carbsBound=false;
    for(const part of parts){
      const count=number(part.quantity);
      const partUnit=text(part.unit||item.unit);
      const recipeUnit=text(item.unit);
      const measuredProduceGrams=recipeUnit==='g'&&partUnit==='stück'&&number(part.actual_weight_g)>0;
      if(count===null||count<=0||(partUnit!==recipeUnit&&!measuredProduceGrams))
        return invalid('gespeicherte Zutatenaufteilung');
      covered+=measuredProduceGrams?number(part.actual_weight_g):count;
      const stock=(data?.inventory||[]).find(row=>String(row.id)===String(part.inventory_id||''));
      const lot=part.lot_id
        ?(data?.lots||[]).find(row=>String(row.id)===String(part.lot_id)
          &&String(row.inventory_id)===String(part.inventory_id))
        :null;
      if(part.lot_id&&!lot&&!(historical&&part.product_id))return invalid('gespeicherte Charge fehlt');
      if(lot?.product_id&&part.product_id&&String(lot.product_id)!==String(part.product_id))
        return invalid('Produkt und Charge widersprechen sich');
      const productId=part.product_id||lot?.product_id;
      const product=productId
        ?(data?.products||[]).find(row=>String(row.id)===String(productId))
        :(stock?productForStock(stock,data):null);
      if(!product&&!(historical&&part.prepared_nutrition_per_100))
        return invalid('konkretes Nährwertprodukt fehlt');
      const historicalProduct=product||(historical?{nutrition_per_100:part.prepared_nutrition_per_100}:null);
      const n=nutritionOf(historicalProduct);
      if(n.kcal===null||n.protein===null)return invalid('Kalorien oder Protein fehlen');

      let amount=measuredProduceGrams?number(part.actual_weight_g):null;
      const unit=text(item.unit);
      if((unit==='scheibe'||unit==='scheiben')&&
          part.estimated_not_measured!==true){
        // A verified weighing overrides stale product-level weights.
        const grams=number(part.actual_weight_g);
        const sliceWeights=Array.isArray(part.slice_weights_g)?part.slice_weights_g.map(number):null;
        if(grams!==null&&grams>0)amount=grams;
        else if(sliceWeights?.length===count&&sliceWeights.every(weight=>weight!==null&&weight>0))
          amount=sliceWeights.reduce((sum,weight)=>sum+weight,0);
      }
      if(amount===null){
        // Prevent reusing weights from last month's pack for a new lot.
        const measuredOn=String(historicalProduct.product_data?.measurement_date||'');
        const boughtOn=String(lot?.purchased_on||'');
        if((unit==='scheibe'||unit==='scheiben')&&boughtOn&&measuredOn&&boughtOn>measuredOn)
          return invalid('neue Brotscheiben nicht einzeln gewogen');
        amount=basisAmount({...item,quantity:count,label:String(part.label||item.label||'')},{product:historicalProduct,stock});
      }
      if(amount===null)return invalid('gesichertes Stückgewicht fehlt');
      const factor=amount/100;
      kcal+=n.kcal*factor;protein+=n.protein*factor;
      if(n.fat===null)fatKnown=false;else fat+=n.fat*factor;
      if(n.carbs===null)carbsKnown=false;else carbs+=n.carbs*factor;
      if(n.carbsBound)carbsBound=true;
    }
    if(Math.abs(covered-wanted)>0.001)return invalid('Aufteilungsmenge passt nicht zum Rezept');
    return {complete:true,kcal,protein,fat:fatKnown?fat:null,
      carbs:carbsKnown?carbs:null,carbsBound:carbsKnown&&carbsBound,missing:[]};
  }

  function calculate(items,servings,data,allocationMap=null,historical=false){
    const rows=Array.isArray(items)?items:[];
    if(!rows.length)return {complete:false,missing:['Keine Zutaten']};
    const div=Math.max(.01,number(servings)||1);
    let kcal=0,protein=0,fat=0,carbs=0,fatKnown=true,carbsKnown=true,carbsBound=false,referenceUsed=false;
    const missing=[];
    const addMacro=(n,scale)=>{
      if(n.fat===null||n.fat===undefined)fatKnown=false;else fat+=n.fat*scale;
      if(n.carbs===null||n.carbs===undefined)carbsKnown=false;else carbs+=n.carbs*scale;
      if(n.carbsBound)carbsBound=true;
    };
    for(const item of rows){
      // Nährwertfreie Grundzutaten niemals per Familien-/FIFO-Produktlookup
      // auflösen. Fehlende Herstellerdaten dürfen Salz nicht blockieren.
      if(ZERO_NAMES.has(text(itemName(item))))continue;
      // Nach dem Kochen ist die dokumentierte Originalpackung maßgeblich.
      // Keine heute verfügbaren Chargen oder generischen Familien über einen
      // bestehenden, verifizierten Zubereitungs-Snapshot stellen.
      if(item?.prepared_nutrition_per_100){
        const original=sourceFor(item,data);
        const grams=basisAmount(item,original);
        if(!original||grams===null||original.nutrition.kcal===null||original.nutrition.protein===null){
          missing.push(itemName(item)+' (historische Nährwerte unvollständig)');
        }else{
          kcal+=original.nutrition.kcal*grams/100;
          protein+=original.nutrition.protein*grams/100;
          addMacro(original.nutrition,grams/100);
        }
        continue;
      }
      const measuredPaprika=measuredPaprikaNutrition(item,data);
      if(measuredPaprika?.complete){
        kcal+=measuredPaprika.kcal;
        protein+=measuredPaprika.protein;
        addMacro(measuredPaprika,1);
        continue;
      }
      const confirmed=confirmedAllocationNutrition(item,data,historical);
      if(confirmed){
        if(!confirmed.complete){missing.push(...confirmed.missing);continue;}
        kcal+=confirmed.kcal;protein+=confirmed.protein;addMacro(confirmed,1);
        continue;
      }
      const allocationOverride=item?.id&&allocationMap?.get?.(String(item.id))||null;
      const familyNutrition=genericFamilyNutrition(item,data,allocationOverride);
      if(familyNutrition?.complete){
        kcal+=familyNutrition.kcal;
        protein+=familyNutrition.protein;
        addMacro(familyNutrition,1);
        continue;
      }
      if(familyNutrition&&!familyNutrition.complete){
        // A completely absent stock can use a transparent dietary reference;
        // never disguise a broken *physical* batch as a generic approximation.
        const ref=referenceFor(item);
        const hasPhysicalStock=(data?.inventory||[]).some(stock=>
          stock.is_active!==false&&number(stock.quantity)>0&&
          familyMatch(itemName(item),stock.family_name));
        const unit=text(item.unit);
        if(!ref||(hasPhysicalStock&&!(key(itemName(item))==='vollkornbrot'&&unit==='scheibe')&&key(itemName(item))!=='hokkaidokürbis')){
          missing.push(...(familyNutrition.missing||[itemName(item)]));continue;
        }
      }
      const mixed=mixedLotNutrition(item,data);
      if(mixed){
        if(!mixed.complete){missing.push(...(mixed.missing||[itemName(item)]));continue;}
        kcal+=mixed.kcal;protein+=mixed.protein;addMacro(mixed,1);continue;
      }
      const source=sourceFor(item,data);
      if(!source){missing.push(itemName(item));continue;}
      if(source.reference||source.alias)referenceUsed=true;
      const amount=basisAmount(item,source);
      if(amount===null){missing.push(itemName(item)+' ('+(item?.unit||'Einheit')+')');continue;}
      if(source.nutrition.kcal===null||source.nutrition.protein===null){missing.push(itemName(item));continue;}
      // A factory-defined pizza portion uses the precise per-pizza figure.
      // Per-100-g values are rounded and would incorrectly yield 805 vs 804 kcal.
      const each=source.product?.product_data?.per_pizza;
      if(text(item.unit)==='stück'&&each&&number(each.energy_kcal)!==null&&number(each.protein_g)!==null){
        kcal+=number(each.energy_kcal)*number(item.quantity);
        protein+=number(each.protein_g)*number(item.quantity);
        addMacro({fat:nutrient(each,['fat_g']),carbs:nutrient(each,['carbohydrates_g','carbs_g'])},number(item.quantity));
      }else{
        kcal+=source.nutrition.kcal*amount/100;
        protein+=source.nutrition.protein*amount/100;
        addMacro(source.nutrition,amount/100);
      }
    }
    if(missing.length)return {complete:false,missing:[...new Set(missing)]};
    return {complete:true,kcal:kcal/div,protein:protein/div,
      fat:fatKnown?fat/div:null,carbs:carbsKnown?carbs/div:null,
      carbsBound:carbsKnown&&carbsBound,estimated:referenceUsed,missing:[]};
  }


  // Nährwert-Qualitätsprüfung zusätzlich zur Kalorienrechnung. Es reicht
  // nicht, wenn eine alte Packung des gleichen Vorrats Werte hatte: jede
  // aktive, aktuell verwendbare Packung muss eigene Nährwerte besitzen.
  function nutritionProblem(item,data,allocationOverride=null){
    if(!item||ZERO_NAMES.has(text(itemName(item))))return null;
    const name=itemName(item);
    if(item.prepared_nutrition_per_100){
      const source=sourceFor(item,data);
      if(source?.nutrition?.kcal!==null&&source?.nutrition?.protein!==null&&basisAmount(item,source)!==null)return null;
    }
    const qty=number(item.quantity);
    const entry={id:String(item.id||''),name,reason:''};
    if(qty===null||qty<0)return {...entry,reason:'Die Zutatenmenge ist ungültig oder fehlt.'};
    if(qty===0)return null;
    if(measuredPaprikaNutrition(item,data)?.complete)return null;
    const confirmed=confirmedAllocationNutrition(item,data);
    if(confirmed){
      if(!confirmed.complete)return {...entry,reason:confirmed.missing.join(', ')};
      if(confirmed.fat===null||confirmed.carbs===null)
        return {...entry,reason:'Fett- oder Kohlenhydratwerte der zugewiesenen Packung fehlen.'};
      return null;
    }
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
    const mixed=mixedLotNutrition(item,data);
    if(mixed?.complete){
      if(mixed.fat===null||mixed.carbs===null)
        return {...entry,reason:'Fett oder Kohlenhydrate der verwendeten Chargen fehlen.'};
      return null;
    }
    if(mixed&&!mixed.complete)return {...entry,reason:(mixed.missing||[name]).join(', ')};
    const generic=genericFamilyNutrition(item,data,allocationOverride);
    if(generic?.complete){
      if(generic.fat===null||generic.carbs===null)
        return {...entry,reason:'Fett oder Kohlenhydrate der verwendeten Zutatenfamilie fehlen.'};
      return null;
    }
    if(generic&&!generic.complete){
      const ref=referenceFor(item);
      const hasPhysicalStock=(data?.inventory||[]).some(stock=>
        stock.is_active!==false&&number(stock.quantity)>0&&
        familyMatch(name,stock.family_name));
      const fallbackForUnlabeledProduce=key(name)==='hokkaidokürbis';
      const specialBread=key(name)==='vollkornbrot'&&text(item.unit)==='scheibe';
      if(ref&&(!hasPhysicalStock||specialBread||fallbackForUnlabeledProduce)&&basisAmount(item,ref)!==null){
        // A documented public approximation is not a *missing* label:
        // show ca./Referenzwerte in the calculator, not a false emergency alert.
        return null;
      }
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
    if(source.nutrition.fat===null||source.nutrition.carbs===null)
      return {...entry,reason:'Fett oder Kohlenhydrate fehlen im zugewiesenen Nährwertprofil.'};
    return null;
  }

  const alarmEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function mealTypeForAlarm(type){
    return ({breakfast:'Frühstück',lunch:'Mittagessen',snack:'Snack',dinner:'Abendessen',extra:'Zusatz-Snack / Getränk'})[type]||String(type||'Mahlzeit');
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
      +warnings.map(meal=>'<button type="button" class="food-nutrition-alarm-link-v795" '+(meal.extra?'data-food-extra-goto':'data-food-nutrition-goto')+'="'+alarmEscape(meal.id)+'">'
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

  // A complete read-only audit from Supabase rows, not from currently visible DOM cards.
  // There is deliberately no stock/meal mutation, no auto-confirmation and no guessed batch.
  // Recipe-library entries and future planned meals are distinct audit targets.
  function collectNutritionAudit(data,fromDate=todayIso()){
    const buckets=[];
    const recipeMap=new Map((data.recipes||[]).map(r=>[String(r.id),r]));
    const mealMap=new Map((data.meals||[]).map(m=>[String(m.id),m]));
    const plan=plannedMealAllocationState(data);
    const inspect=(type,row,items,context,allocations=null)=>{
      const issues=[];
      for(const item of items||[]){
        if(ZERO_NAMES.has(text(itemName(item))))continue;
        const allocation=allocations?.get?.(String(item.id||''))||null;
        const problem=nutritionProblem(item,context,allocation);
        const src=sourceFor(item,context,allocation);
        if(problem){
          issues.push({...problem,unit:item.unit,quantity:item.quantity,
            provisional:!!problem.provisional});
        }else if(src&&(src.reference||src.alias)){
          const n=src.nutrition||{};
          const basis=text(src.product?.nutrition_per_100?.basis).includes('100_ml')?'100 ml':'100 g';
          const numbers=n.kcal!==null&&n.protein!==null
            ?formatNumber(n.kcal,1)+' kcal, '+formatNumber(n.protein,1)+' g Eiweiß je '+basis
            :'Nährwerte noch nicht vollständig geprüft';
          issues.push({id:String(item.id||''),name:itemName(item),
            provisional:true,unit:item.unit,quantity:item.quantity,
            reason:(src.reference?'Referenz statt Verpackungswert':'Aktuell einzige passende Vorratsvariante')
              +': '+numbers+'. Bei anderer Packung neu zuordnen.'});
        }
      }
      const n=type==='meal'
        ?nutritionForMeal(row,recipeMap,mealMap,data,context,allocations)
        :calculate(items,row.servings||1,context);
      if(!n.complete&&!issues.length){
        if(type==='meal'&&!(items||[]).length){
          issues.push({id:'',name:'Mahlzeit ohne Zutatenverknüpfung',
            provisional:false,
            reason:/^Rest\s/i.test(String(row.title||''))
              ?'Geplante Restportion ist noch nicht mit ihrer tatsächlich zubereiteten Ausgangsmahlzeit verknüpft. Quelle prüfen, nicht automatisch als neuen Verbrauch buchen.'
              :'Für diese geplante Mahlzeit sind weder Zutaten noch eine gesicherte Nährwertquelle vorhanden.'});
        }else{
          for(const missing of n.missing||[])
            issues.push({id:'',name:missing,provisional:false,
              reason:'Zutat, Menge oder passende Produktquelle ungeklärt.'});
        }
      }
      if(!issues.length)return;
      buckets.push({type,id:String(row.id),title:String(row.title||'Ohne Titel'),
        date:row.meal_date||null,mealType:String(row.meal_type||''),issues});
    };
    for(const recipe of data.recipes||[]){
      inspect('recipe',recipe,recipe.food_recipe_ingredients||[],data);
    }
    for(const meal of data.meals||[]){
      if(String(meal.status)!=='planned'||String(meal.meal_date)<String(fromDate))continue;
      const context=plan.contexts.get(String(meal.id))||data;
      const allocations=plan.allocations.get(String(meal.id))||null;
      inspect('meal',meal,meal.food_meal_ingredients||[],context,allocations);
    }
    // Real, currently usable packaging variants get checked even if not used
    // in any recipe yet. Ignore archived brands, zero stock and unrelated lots.
    const stocks=new Map((data.inventory||[])
      .filter(row=>row.is_active!==false&&number(row.quantity)>0)
      .map(row=>[String(row.id),row]));
    for(const product of data.products||[]){
      if(product.active===false)continue;
      const stock=stocks.get(String(product.inventory_id||''));
      if(!stock)continue;
      const liveLots=(data.lots||[]).filter(lot=>
        String(lot.inventory_id||'')===String(stock.id)&&
        (number(lot.unopened_packages)>0||number(lot.opened_remaining_quantity)>0));
      if(liveLots.some(lot=>lot.product_id)&&!liveLots.some(lot=>
         String(lot.product_id)===String(product.id)))continue;
      const n=nutritionOf(product);
      const per=product.nutrition_per_100||{};
      const pd=product.product_data||{};
      const fatBound=number(per.fat_g_lt);
      const proteinBound=number(per.protein_g_lt);
      const carbBound=number(per.carbohydrates_g_lt??per.carbs_g_lt);
      // A manufacturer label saying "<0,5 g" is not an absent label.
      // Preserve an upper limit, never silently replace it with 0 or 0,5 exact.
      const limits=[
        n.fat===null&&fatBound!==null?'Fett < '+formatNumber(fatBound,2)+' g':null,
        n.protein===null&&proteinBound!==null?'Eiweiß < '+formatNumber(proteinBound,2)+' g':null,
        n.carbs===null&&carbBound!==null?'Kohlenhydrate < '+formatNumber(carbBound,2)+' g':null
      ].filter(Boolean);
      const missing=[n.kcal===null?'Kalorien':null,
        n.protein===null&&proteinBound===null?'Eiweiß':null,
        n.fat===null&&fatBound===null?'Fett':null,
        n.carbs===null&&carbBound===null?'Kohlenhydrate':null].filter(Boolean);
      const exception=String(pd.nutrition_audit_exception_type||'');
      const declarationException=['supplement_micronutrients_only',
        'creatine_macros_only_on_package','coffee_dry_nutrition_not_mandatory'].includes(exception);
      const provisional=pd.nutrition_reference_only===true
        ||pd.nutrition_is_reference===true||pd.nutrition_estimated===true
        ||pd.nutrition_review_needed===true||pd.nutrition_provisional===true
        ||pd.nutrition_requires_packaging_check===true;
      if(!missing.length&&!provisional)continue;
      const nutritionBasis=String(pd.nutrition_basis||per.basis||'').toLowerCase();
      const nutritionUnit=nutritionBasis.includes('100_ml')?'ml':nutritionBasis.includes('100_g')?'g':
        /^(ml|l)$/i.test(String(product.package_unit||''))?'ml':'g';
      const values=n.kcal===null?'kein Kalorienwert':
        formatNumber(n.kcal,1)+' kcal je 100 '+nutritionUnit;
      let reason;
      if(declarationException){
        reason=exception==='coffee_dry_nutrition_not_mandatory'
          ?'Kaffeekapsel ohne verpflichtende Nährwerttabelle für trockenes Kaffeemehl; Aufguss und Milch getrennt bewerten. Keine 0-kcal-Erfindung.'
          :'Nahrungsergänzung mit deklarierten Wirk-/Mikronährstoffen, aber ohne belegte vollständige Makrotabelle. Kalorien für tatsächlich konsumierte Portion gegebenenfalls gesondert prüfen; kein künstlicher Nullwert.';
      }else if(missing.length){
        reason='Fehlend: '+missing.join(', ')+'. Vorhanden: '+values+'.'
          +(limits.length?' Hersteller-Grenzwerte: '+limits.join(', ')+'.':'');
      }else{
        reason='Verlässlicher Referenz- oder Vergleichswert, nicht als chargenspezifisches Etikett bestätigt. '
          +values+'.'+(limits.length?' Hersteller-Grenzwerte: '+limits.join(', ')+'.':'');
      }
      buckets.push({type:'product',id:String(stock.id),
        title:[product.brand,product.product_name,product.variant].filter(Boolean).join(' · ')
          +' (Vorrat: '+stock.name+')',
        date:null,issues:[{id:String(product.id),name:product.product_name,
          reason,provisional:declarationException||!missing.length}]});
    }
    const sorted=buckets.sort((a,b)=>
      (a.type==='meal'?0:a.type==='product'?1:2)
        -(b.type==='meal'?0:b.type==='product'?1:2)
      ||String(a.date||'9999-12-31').localeCompare(String(b.date||'9999-12-31'))
      ||a.title.localeCompare(b.title,'de'));
    return {targets:sorted,
      total:sorted.reduce((sum,target)=>sum+target.issues.length,0),
      blocking:sorted.reduce((sum,target)=>sum+target.issues.filter(x=>!x.provisional).length,0),
      review:sorted.reduce((sum,target)=>sum+target.issues.filter(x=>x.provisional).length,0),
      recipeTargets:sorted.filter(x=>x.type==='recipe').length,
      productTargets:sorted.filter(x=>x.type==='product').length,
      plannedMealTargets:sorted.filter(x=>x.type==='meal').length,
      fromDate};
  }

  function auditMarkup(audit){
    const title='Gesamter Nährwert-Check: '+audit.total+' Punkte';
    const sub=audit.blocking+' fehlend/widersprüchlich · '+audit.review
      +' Referenzen/prüfbedürftig · '+audit.plannedMealTargets
      +' geplante Mahlzeiten · '+audit.productTargets+' Produkte · '+audit.recipeTargets+' Rezepte';
    return '<details class="food-nutrition-global-audit-v845" data-food-audit-details>'
      +'<summary><strong>'+alarmEscape(title)+'</strong><small>'+alarmEscape(sub)+'</small></summary>'
      +'<div class="food-nutrition-global-list-v845" role="list" aria-label="Alle derzeit prüfbaren Nährwertpunkte">'
      +(audit.targets.length?audit.targets.map(target=>
        '<div class="food-nutrition-global-row-v845" role="listitem">'
          +'<button type="button" data-food-audit-open="'+alarmEscape(target.id)+'" data-food-audit-type="'+alarmEscape(target.type)+'" data-food-audit-date="'+alarmEscape(target.date||'')+'">'
            +'<strong>'+alarmEscape((target.type==='meal'?'Mahlzeit '+(target.date||''):target.type==='product'?'Vorrat/Produkt':'Rezept')
              +' · '+target.title)+'</strong>'
            +'<small>'+alarmEscape(target.issues.map(issue=>
               (issue.provisional?'Hinweis: ':'Fehler: ')+issue.name+': '+issue.reason).join(' | '))+'</small>'
            +'<span aria-hidden="true">↗</span>'
          +'</button>'
        +'</div>').join(''):'<p>Keine offenen Nährwertpunkte in geplanten Mahlzeiten und Rezepten.</p>')
      +'</div></details>';
  }

  function patchNutritionAudit(root,audit){
    const panel=root.querySelector('[data-food-nutrition-audit]');
    if(!panel)return;
    const html=auditMarkup(audit);
    if(panel.innerHTML!==html){
      const previous=panel.querySelector('[data-food-audit-details]')?.open||false;
      panel.innerHTML=html;
      const details=panel.querySelector('[data-food-audit-details]');
      if(details)details.open=previous;
    }
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

  const zeroNutrition=()=>({complete:true,kcal:0,protein:0,fat:0,carbs:0,missing:[]});
  const combine=(a,b)=>a?.complete&&b?.complete
    ?{complete:true,kcal:a.kcal+b.kcal,protein:a.protein+b.protein,
      carbsBound:!!(a.carbsBound||b.carbsBound),estimated:!!(a.estimated||b.estimated),
      fat:a.fat===null||a.fat===undefined||b.fat===null||b.fat===undefined?null:a.fat+b.fat,
      carbs:a.carbs===null||a.carbs===undefined||b.carbs===null||b.carbs===undefined?null:a.carbs+b.carbs,
      missing:[]}
    :{complete:false,missing:[...(a?.missing||[]),...(b?.missing||[])]};

  // V809: Product extras belong to the one meal actually eaten, never to
  // the prepared batch from which later meal-prep servings are derived.
  const preparedOnly=items=>(items||[]).filter(item=>item.eaten_only_extra!==true);
  const eatenOnly=items=>(items||[]).filter(item=>item.eaten_only_extra===true);
  function estimatedNutritionForMeal(meal){
    // Only explicitly marked, user-confirmed estimates qualify.
    // They contribute to daily totals but never require product packaging data.
    const note=String(meal?.note||'');
    if(!/^Nährwerte geschätzt\./i.test(note))return null;
    const kcal=number(meal?.calories_kcal_per_serving_override);
    const match=note.match(/(\d+(?:[.,]\d+)?)\s*g\s*Eiweiß/i);
    const protein=match?Number(match[1].replace(',','.')):null;
    if(kcal===null||kcal<0||protein===null||!Number.isFinite(protein))return null;
    return {complete:true,kcal,protein,fat:null,carbs:null,estimated:true,missing:[]};
  }
  function withPreparedNutrition(items,meal){
    if(text(meal?.status)!=='completed')return items;
    const sources=meal?.prepared_sources_snapshot?.sources;
    if(!Array.isArray(sources))return items;
    return items.map(item=>{
      // Attach the exact nutrition profile of every consumed lot to its saved
      // allocation. Never depend on today's remaining stock or product catalog.
      const parts=Array.isArray(item.allocation_override)?item.allocation_override:null;
      const enrichedParts=parts?.map(part=>{
        const matched=sources.filter(source=>source?.nutrition_per_100
          &&String(source.inventory_id||'')===String(part.inventory_id||'')
          &&text(source.unit)===text(part.unit||item.unit)
          &&number(source.quantity)===number(part.quantity));
        return matched.length===1
          ?{...part,prepared_nutrition_per_100:matched[0].nutrition_per_100}
          :part;
      });
      const matches=sources.filter(source=>source?.nutrition_per_100&&
        (!item.inventory_id||String(source.inventory_id||'')===String(item.inventory_id))&&
        text(source.name)===text(itemName(item))&&
        text(source.unit)===text(item.unit)&&
        number(source.quantity)===number(item.quantity));
      const enriched={...item,...(enrichedParts?{allocation_override:enrichedParts}:{})};
      return matches.length===1&&['g','ml'].includes(text(item.unit))
        ?{...enriched,prepared_nutrition_per_100:matches[0].nutrition_per_100}
        :enriched;
    });
  }

  function nutritionForMeal(meal,recipeMap,mealMap,data,context,allocations){
    const estimate=estimatedNutritionForMeal(meal);
    if(estimate)return estimate;
    const items=withPreparedNutrition(meal.food_meal_ingredients||[],meal);
    const consumedMacros=meal.prepared_sources_snapshot?.nutrition_consumed;
    if(text(meal.status)==='completed'&&!meal.source_meal_id&&!meal.leftover_id&&consumedMacros){
      const kcal=number(consumedMacros.kcal),protein=number(consumedMacros.protein_g);
      const fat=number(consumedMacros.fat_g),carbs=number(consumedMacros.carbs_g);
      if([kcal,protein,fat,carbs].every(value=>value!==null&&value>=0)){
        const servings=Math.max(.01,number(meal.eaten_servings)||1);
        return {complete:true,kcal:kcal/servings,protein:protein/servings,
          fat:fat/servings,carbs:carbs/servings,missing:[],
          source:'cooked_meal_consumption_snapshot'};
      }
    }
    // A prepared source meal can have weighed leftovers and a separately
    // consumed side. Its consumed macros are the physical remainder, not
    // eaten_servings / prepared_servings applied to the whole recipe.
    if(text(meal.status)==='completed'&&!meal.source_meal_id&&!meal.leftover_id){
      const children=[...mealMap.values()].filter(child=>
        String(child.source_meal_id||'')===String(meal.id)&&
        child.prepared_sources_snapshot?.nutrition_portion?.basis==='measured_prepared_weight');
      if(children.length){
        const portions=children.map(child=>child.prepared_sources_snapshot.nutrition_portion);
        const fraction=portions.reduce((sum,p)=>sum+(number(p.fraction)||0),0);
        const exclusions=portions[0].exclude_ingredient_ids||[];
        const sameExclusions=portions.every(p=>
          JSON.stringify([...(p.exclude_ingredient_ids||[])].sort())===
          JSON.stringify([...exclusions].sort()));
        if(sameExclusions&&fraction>=0&&fraction<=1.00000001){
          const excluded=new Set(exclusions.map(String));
          const panItems=preparedOnly(items).filter(i=>!excluded.has(String(i.id)));
          const sideItems=preparedOnly(items).filter(i=>excluded.has(String(i.id)));
          const pan=panItems.length?calculate(panItems,1,data,null,true):zeroNutrition();
          const side=sideItems.length?calculate(sideItems,1,data,null,true):zeroNutrition();
          if(pan.complete&&side.complete){
            const left=Math.max(0,1-fraction);
            const consumed=combine({
              ...pan,kcal:pan.kcal*left,protein:pan.protein*left,
              fat:pan.fat===null?null:pan.fat*left,
              carbs:pan.carbs===null?null:pan.carbs*left
            },side);
            const div=Math.max(.01,number(meal.eaten_servings)||1);
            return {...consumed,kcal:consumed.kcal/div,protein:consumed.protein/div,
              fat:consumed.fat===null?null:consumed.fat/div,
              carbs:consumed.carbs===null?null:consumed.carbs/div};
          }
          return pan.complete?side:pan;
        }
        return {complete:false,missing:['Meal-Prep-Gewichte oder Beilagen-Zuordnung widersprüchlich']};
      }
    }
    const storedPrepKcal=number(meal.calories_kcal_per_serving_override);
    const portion=meal.prepared_sources_snapshot?.nutrition_portion;
    const savedMacros=portion?.macros;
    if((meal.source_meal_id||meal.leftover_id)&&savedMacros){
      const kcal=number(savedMacros.kcal),protein=number(savedMacros.protein_g);
      const fat=number(savedMacros.fat_g),carbs=number(savedMacros.carbs_g);
      if(kcal!==null&&kcal>=0&&protein!==null&&protein>=0&&
         fat!==null&&fat>=0&&carbs!==null&&carbs>=0){
        return {complete:true,kcal,protein,fat,carbs,missing:[],
          source:'cooked_portion_nutrition_snapshot'};
      }
    }
    const portionFraction=number(portion?.fraction);
    const portionExclusions=new Set(Array.isArray(portion?.exclude_ingredient_ids)
      ?portion.exclude_ingredient_ids.map(String):[]);
    // Explicitly measured cooked portion: source composition is fixed at cooking.
    // Exclude separately eaten side dishes, then scale ALL nutrients by weight.
    if(meal.source_meal_id&&portionFraction!==null&&portionFraction>0&&portionFraction<=1){
      const source=mealMap.get(String(meal.source_meal_id));
      if(source&&String(portion.source_meal_id||'')===String(source.id)){
        const sourceItems=preparedOnly(withPreparedNutrition(source.food_meal_ingredients||[],source))
          .filter(item=>!portionExclusions.has(String(item.id)));
        const original=calculate(sourceItems,1,data,null,true);
        if(original.complete){
          const extras=preparedOnly(items).length
            ?calculate(preparedOnly(items),1,context,allocations):zeroNutrition();
          const once=eatenOnly(items).length
            ?calculate(eatenOnly(items),1,context,allocations):zeroNutrition();
          const result=combine(combine({
            ...original,kcal:original.kcal*portionFraction,
            protein:original.protein*portionFraction,
            fat:original.fat===null?null:original.fat*portionFraction,
            carbs:original.carbs===null?null:original.carbs*portionFraction
          },extras),once);
          return result.complete&&storedPrepKcal!==null
            ?{...result,kcal:storedPrepKcal}:result;
        }
        return original; // Surface actual missing data, never invent macros.
      }
    }
    // No complete portion snapshot: do not hide missing macros with kcal-only.
    let base;
    if(meal.leftover_id||meal.source_meal_id){
      const source=meal.source_meal_id?mealMap.get(String(meal.source_meal_id)):null;
      const recipe=meal.recipe_id?recipeMap.get(String(meal.recipe_id)):null;
      const original=source
        ?calculate(preparedOnly(withPreparedNutrition(source.food_meal_ingredients||[],source)),source.prepared_servings||1,data,null,true)
        :(recipe?calculate(recipe.food_recipe_ingredients||[],recipe.servings||1,data):{complete:false,missing:['Meal-Prep-Basis']});
      const extras=preparedOnly(items).length
        ?calculate(preparedOnly(items),meal.eaten_servings||meal.prepared_servings||1,context,allocations)
        :zeroNutrition();
      base=combine(original,extras);
    }else{
      base=calculate(preparedOnly(items),meal.prepared_servings||meal.eaten_servings||1,context,allocations,text(meal.status)==='completed');
    }
    // One-off foods are divided only by the servings actually eaten TODAY.
    const once=eatenOnly(items);
    const addition=once.length?calculate(once,meal.eaten_servings||1,context,allocations):zeroNutrition();
    const complete=combine(base,addition);
    const exact=number(meal.calories_kcal_per_serving_override);
    if(complete.complete&&exact!==null&&exact>=0)return {...complete,kcal:exact};
    return complete;
  }

  function formatNumber(value,max=1){
    return new Intl.NumberFormat('de-DE',{maximumFractionDigits:max}).format(value);
  }
  function nutritionText(n){
    if(!n?.complete)return '';
    const base=(n.estimated?'ca. ':'')+Math.round(n.kcal)+' kcal'+
      (n.protein===null||n.protein===undefined?'':' · '+formatNumber(n.protein,1)+' g Protein');
    // Display fat/carbs only when every contributing portion has reliable data.
    // Sugar and saturated fat are subsets, never additional calories.
    if(n.fat===null||n.fat===undefined||n.carbs===null||n.carbs===undefined)return base;
    return base+' · '+formatNumber(n.fat,1)+' g Fett · '+(n.carbsBound?'< ':'')+formatNumber(n.carbs,1)+' g KH'+(n.estimated?' · Referenzwerte':'');
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
    // V816: Rebuild nutrition text from the pristine meal headline, not from
    // the prior patched text. Product names can contain the ' · ' separator
    // (e.g. "Rispentomaten aus Niedersachsen · Klasse I"). Splitting an
    // already patched warning otherwise leaves orphaned "Klasse I" fragments,
    // and repeated refreshes grow the meal header without bound.
    if(!em.hasAttribute('data-food-nutrition-base-v816')){
      em.setAttribute('data-food-nutrition-base-v816',String(em.textContent||''));
    }
    const pristine=String(em.getAttribute('data-food-nutrition-base-v816')||'');
    const parts=pristine.split(/\s*·\s*/).filter(Boolean)
      .filter(part=>!/^\d+(?:[.,]\d+)?\s*kcal$/i.test(part)&&!/^\d+(?:[.,]\d+)?\s*g\s+Protein$/i.test(part)&&!/^(kcal|Nährwerte) offen$/i.test(part)&&!/^Nährwert(e)? prüfen:/i.test(part)&&!/^Nährwerte geschätzt$/i.test(part)&&!/^\d+(?:[.,]\d+)?\s*g\s*(?:Fett|KH)$/i.test(part));
    const reasons=[...new Set(nutrition?.missing||[])];
    const nutritionParts=nutrition?.complete
      ?[...nutritionText(nutrition).split(/\s*·\s*/),...(nutrition.estimated?['Nährwerte geschätzt']:[])]
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
    if(text(meal?.status)==='skipped'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
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

  // Eindeutige Tages-Addition. Wird pro frischem Tages-Map genau einmal aufgerufen.
  function addConsumedExtrasToDays(totals,extras){
    for(const extra of extras||[]){
      const date=String(extra.consumption_date||'');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
      const day=totals.get(date)||{kcal:0,protein:0,meals:0,unresolved:0,extras:0};
      const kcal=number(extra.calories_kcal),protein=number(extra.protein_g);
      if(kcal===null||protein===null){day.unresolved++;day.meals++;totals.set(date,day);continue;}
      day.kcal+=kcal;
      day.protein+=protein;
      day.extras=(day.extras||0)+1;
      totals.set(date,day);
    }
    return totals;
  }

  function dailySummary(day){
    if(!day||(!day.meals&&!day.extras))return {
      kcal:'0 kcal',protein:'0 g Protein',note:'',label:'Tag gesamt',incomplete:false
    };
    const incomplete=day.unresolved>0;
    const allMissing=day.meals>0&&day.unresolved===day.meals&&!(day.extras>0);
    return {
      kcal:allMissing?'kcal offen':formatNumber(Math.round(day.kcal),0)+' kcal',
      protein:allMissing?'Protein offen':formatNumber(day.protein,1)+' g Protein',
      note:incomplete?'⚠ '+day.unresolved+' offen':'', // V831: Extras sind bereits in kcal + Protein enthalten und stehen unten einzeln.
      label:incomplete?'Teilsumme':'Tag gesamt',
      incomplete
    };
  }

  function setText(el,value){
    if(el&&el.textContent!==value)el.textContent=value;
  }

  function patchDailyTotals(root,totals,unresolvedTargets=[]){
    // Die beiden festen Anzeigeplätze werden bereits beim Erstellen der Tageskarte
    // erzeugt. Kein Suchen nach "HEUTE", denn die FOOD-Ansicht entfernt diese Überschrift.
    const todayPanel=root.querySelector('[data-food-day-summary-today]');
    if(todayPanel){
      const day=dailySummary(totals.get(todayIso()));
      setText(todayPanel.querySelector('[data-food-day-kcal]'),day.kcal);
      setText(todayPanel.querySelector('[data-food-day-protein]'),day.protein);
      const noteButton=todayPanel.querySelector('[data-food-day-summary-note]');
      setText(noteButton,day.note);
      if(noteButton){
        noteButton.hidden=!day.incomplete;
        noteButton.disabled=!day.incomplete;
        noteButton.setAttribute('aria-label',day.unresolved+' offene Tageswerte: zu betroffenen Einträgen springen');
        noteButton.title=unresolvedTargets.length===1
          ?'Direkt zu '+unresolvedTargets[0].title+' springen':'Offene Tageswerte anzeigen';
      }
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
      '.food-day-summary-goto-v838{appearance:none;cursor:pointer;flex:none;border:1px solid rgba(152,62,48,.4);background:#fff0e9;color:#9e352a;border-radius:7px;padding:4px 6px;font-size:10px;font-weight:800;line-height:1.2}'+
      '.food-day-summary-goto-v838:hover,.food-day-summary-goto-v838:focus-visible{background:#fbd9cf;outline-offset:2px}'+
      '.food-day-summary-goto-v838[hidden]{display:none!important}'+
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
      supabase.from('food_recipes').select('id,title,servings,calories_kcal_per_serving,protein_g_per_serving,food_recipe_ingredients(id,recipe_id,name,label,quantity,unit,sort_order,inventory_id)').eq('active',true),
      supabase.from('food_meals').select('id,meal_date,meal_type,title,status,sort_order,inventory_booked_at,recipe_id,prepared_servings,eaten_servings,leftover_id,source_meal_id,calories_kcal_per_serving_override,prepared_sources_snapshot,note,food_meal_ingredients(id,name,label,quantity,unit,sort_order,inventory_id,allocation_override,eaten_only_extra)').gte('meal_date',from).lte('meal_date',to),
      supabase.from('food_inventory_overview').select('id,name,family_name,variant_label,quantity,unit,note,is_active,sort_order').eq('is_active',true),
      supabase.from('shopping_products').select('id,inventory_id,brand,product_name,variant,package_quantity,package_unit,nutrition_per_100,product_data,servings_per_package,serving_quantity,serving_unit,active'),
      supabase.from('food_inventory_lots').select('id,product_id,inventory_id,best_before_date,purchased_on,created_at,storage_location,unopened_packages,opened_remaining_quantity,opened_remaining_unit,package_quantity,package_unit'),
      // Extra-Konsum wird als eigene, bereits gegessene Tagesposition gezählt.
      supabase.from('food_extra_consumptions').select('id,consumption_date,title,quantity,unit,calories_kcal,protein_g,carbohydrates_g,fat_g').gte('consumption_date',from).lte('consumption_date',to).limit(1500)
    ]);
    const bad=results.find(result=>result.error);
    if(bad?.error)throw bad.error;
    return {
      recipes:results[0].data||[],
      meals:results[1].data||[],
      inventory:results[2].data||[],
      products:results[3].data||[],
      lots:results[4].data||[],
      extras:results[5].data||[]
    };
  }

  // V802: preview a user's proposed meal edit using the EXACT existing
  // dynamic nutrition calculator and meal-order-aware ingredient allocations.
  // This is read-only. Nothing is booked or changed in Supabase.
  function dayCaloriesWithProposedMeal(data,mealId,proposedIngredients){
    const proposed=data.meals.map(meal=>String(meal.id)===String(mealId)
      ?{...meal,food_meal_ingredients:proposedIngredients}
      :meal);
    const target=proposed.find(meal=>String(meal.id)===String(mealId));
    if(!target)throw new Error('Mahlzeit für die Kalorienprüfung nicht gefunden.');
    const testData={...data,meals:proposed};
    const plan=plannedMealAllocationState(testData);
    const recipeMap=new Map(data.recipes.map(recipe=>[String(recipe.id),recipe]));
    const mealMap=new Map(proposed.map(meal=>[String(meal.id),meal]));
    let total=0,complete=true;
    const missing=[];
    for(const meal of proposed.filter(row=>String(row.meal_date)===String(target.meal_date))){
      const items=meal.food_meal_ingredients||[];
      const context=plan.contexts.get(String(meal.id))||testData;
      const allocations=plan.allocations.get(String(meal.id))||null;
      const nutrition=nutritionForMeal(meal,recipeMap,mealMap,testData,context,allocations);
      if(!nutrition.complete){
        complete=false;
        missing.push(...(nutrition.missing||[]));
      }else{
        const eaten=number(meal.eaten_servings);
        total+=nutrition.kcal*(eaten!==null&&eaten>0?eaten:1);
      }
    }
    // Die Vorschau muss dieselben zusätzlichen Tageskcal wie die Live-Bilanz enthalten.
    total+=(data.extras||[]).filter(x=>x.consumption_date===target.meal_date)
      .reduce((sum,x)=>sum+(number(x.calories_kcal)||0),0);
    return {complete,kcal:complete?Math.round(total):null,missing:[...new Set(missing)],date:target.meal_date};
  }

  async function previewMealDayCalories(mealId,proposedIngredients){
    const data=await fetchData();
    const meal=data.meals.find(row=>String(row.id)===String(mealId));
    if(!meal)throw new Error('Mahlzeit für die Kalorienkontrolle nicht gefunden.');
    const before=dayCaloriesWithProposedMeal(data,mealId,meal.food_meal_ingredients||[]);
    const after=dayCaloriesWithProposedMeal(data,mealId,proposedIngredients);
    return {before,after};
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
      const unresolvedTargets=[];
      const globalAudit=collectNutritionAudit(data);

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
        if(text(meal.status)==='skipped'){card.dataset.foodNutritionV711='skipped';return;}
        let n=null;
        const items=withPreparedNutrition(meal.food_meal_ingredients||[],meal);
        const mealContext=planState.contexts.get(String(meal.id))||data;
        const mealAllocations=planState.allocations.get(String(meal.id))||null;
        n=nutritionForMeal(meal,recipeMap,mealMap,data,mealContext,mealAllocations);
        allocationRows+=patchIngredientAllocations(card,items,mealContext,mealAllocations,{show:text(meal.status)!=='completed'});
        const isBooked=text(meal.status)==='completed'||Boolean(meal.inventory_booked_at);
        const issueItems=[...items];
        if(meal.leftover_id||meal.source_meal_id){
          const source=meal.source_meal_id?mealMap.get(String(meal.source_meal_id)):null;
          if(source)issueItems.push(...preparedOnly(withPreparedNutrition(source.food_meal_ingredients||[],source)));
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
          if(n?.complete&&(isBooked||
            (meal.source_meal_id&&text(mealMap.get(String(meal.source_meal_id))?.status)==='completed')))
            continue;
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
        if(String(meal.meal_date)===todayIso()&&!n?.complete)
          unresolvedTargets.push({type:'meal',id:String(meal.id),title:String(meal.title||'Mahlzeit')});
        if(patchMeta(card,n))dynamicMeals++;
        else unresolvedMeals.push({id:meal.id,title:meal.title,missing:n?.missing||[]});
      });

      // Zusatzartikel können die Tagesbilanz ebenfalls unvollständig machen.
      // Ein fehlender Makrowert ist NICHT null kcal, auch nicht bei Brausetabletten.
      for(const extra of data.extras||[]){
        if(String(extra.consumption_date)!==todayIso())continue;
        const missing=[number(extra.calories_kcal)===null?'Kalorien':null,
          number(extra.protein_g)===null?'Protein':null].filter(Boolean);
        if(!missing.length)continue;
        const name=String(extra.title||'Zusatz-Snack / Getränk');
        todayWarnings.push({id:String(extra.id),title:name,type:'extra',extra:true,
          issues:[{id:String(extra.id),name,reason:missing.join(' und ')+' für diese konsumierte Portion nicht hinterlegt. Angaben am Produkt prüfen.'}]});
        unresolvedTargets.push({type:'extra',id:String(extra.id),title:name});
      }
      // Bereits verzehrte Extras addieren; niemals in Rezept-/Bestandsmengen mischen.
      addConsumedExtrasToDays(dailyTotals,data.extras);

      ensureDailyTotalStyle();
      patchNutritionAlarm(root,todayWarnings);
      patchNutritionAudit(root,globalAudit);
      patchDailyTotals(root,dailyTotals,unresolvedTargets);
      lastStatus={
        todayUnresolvedTargets:unresolvedTargets,
        dayTotals:[...dailyTotals].map(([date,day])=>({date,...day})),
        extraConsumptions:data.extras?.length||0,
        recipes:data.recipes.length,
        meals:data.meals.length,
        dynamicRecipes,
        dynamicMeals,
        allocationRows,
        unresolvedRecipes,
        unresolvedMeals,
        nutritionAlarmMeals:todayWarnings,
        nutritionAudit:{total:globalAudit.total,blocking:globalAudit.blocking,
          review:globalAudit.review,recipeTargets:globalAudit.recipeTargets,
          productTargets:globalAudit.productTargets,
          plannedMealTargets:globalAudit.plannedMealTargets,
          targets:globalAudit.targets},
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

  // V891: The original document-wide observer refreshed nutrition after ANY
  // inserted DOM node, including our own warning badges and unrelated areas.
  // On mobile that caused repeated full Supabase reads and expensive audits.
  // Only freshly rendered FOOD cards/content may schedule a new audit.
  function isFoodRenderNode(node){
    if(node?.nodeType!==1)return false;
    if(node.matches?.('#'+ROOT_ID+', .food-content-v544, [data-food-meal-card], [data-food-recipe-card]'))return true;
    return Boolean(node.querySelector?.('[data-food-meal-card], [data-food-recipe-card]'));
  }
  const observer=new MutationObserver(mutations=>{
    if(mutations.some(m=>m.type==='childList'&&Array.from(m.addedNodes||[]).some(isFoodRenderNode)))schedule();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});

  // Einheitliches Zielverhalten fuer alle Quellen offener Tageswerte.
  function openUnresolvedTarget(type,id){
    const root=document.getElementById(ROOT_ID);
    if(type==='extra'){
      const extras=window.__modFoodExtrasV828;
      if(extras?.openEntry)void extras.openEntry(id).catch(error=>console.warn('Zusatz-Eintrag öffnen:',error));
      else document.getElementById('food-extra-snacks-v828')?.scrollIntoView?.({behavior:'smooth',block:'center'});
      return;
    }
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


  function openAuditTarget(type,id,date){
    const root=document.getElementById(ROOT_ID);
    if(!root)return;
    const activateTab=name=>{
      const tab=root.querySelector('[data-food-tab="'+name+'"]');
      if(tab&&!tab.classList.contains('active'))tab.click();
    };
    if(type==='meal'){
      if(date&&date!==todayIso())activateTab('plan');
      else activateTab('today');
    }else if(type==='recipe')activateTab('recipes');
    else if(type==='product')activateTab('inventory');
    requestAnimationFrame(()=>{
      if(type==='meal'&&date){
        const group=[...(root.querySelectorAll('[data-food-plan-day]')||[])]
          .find(node=>String(node.dataset.foodPlanDay)===date);
        if(group)group.open=true;
      }
      const selector=type==='recipe'?'[data-food-recipe-card]'
        :type==='product'?'[data-food-stock-card]':'[data-food-meal-card]';
      const attr=type==='recipe'?'foodRecipeCard':type==='product'?'foodStockCard':'foodMealCard';
      const card=[...(root.querySelectorAll(selector)||[])]
        .find(node=>String(node.dataset[attr])===id);
      const toggle=type==='product'?null:
        card?.querySelector(type==='recipe'?'[data-food-recipe-toggle]':'[data-food-meal-toggle]');
      if(toggle?.getAttribute('aria-expanded')==='false')toggle.click();
      card?.scrollIntoView?.({behavior:'smooth',block:'center'});
      toggle?.focus?.({preventScroll:true});
    });
  }

  document.addEventListener('click',event=>{
    const auditTarget=event.target?.closest?.('[data-food-audit-open]');
    if(auditTarget){
      openAuditTarget(String(auditTarget.dataset.foodAuditType||'recipe'),
        String(auditTarget.dataset.foodAuditOpen||''),
        String(auditTarget.dataset.foodAuditDate||''));
      return;
    }
    const target=event.target?.closest?.('[data-food-nutrition-goto],[data-food-extra-goto],[data-food-day-summary-goto]');
    if(target){
      if(target.hasAttribute('data-food-day-summary-goto')){
        const targets=lastStatus.todayUnresolvedTargets||[];
        if(targets.length===1)openUnresolvedTarget(targets[0].type,targets[0].id);
        else{
          const alert=document.querySelector('#'+ROOT_ID+' [data-food-nutrition-alarm]');
          const first=alert?.querySelector('.food-nutrition-alarm-link-v795');
          alert?.scrollIntoView?.({behavior:'smooth',block:'start'});
          first?.focus?.({preventScroll:true});
        }
      }else if(target.hasAttribute('data-food-extra-goto'))
        openUnresolvedTarget('extra',String(target.dataset.foodExtraGoto||''));
      else openUnresolvedTarget('meal',String(target.dataset.foodNutritionGoto||''));
    }
    if(event.target?.closest?.('[data-food-tab],[data-food-edit-recipe],[data-food-edit-planned-meal],[data-food-edit-free-meal]'))schedule(450);
  },true);

  window.__modFoodNutritionV711={
    version:VERSION,
    refresh,
    getStatus(){return structuredClone(lastStatus);},
    previewMealDayCalories
  };
  schedule(450);
})();