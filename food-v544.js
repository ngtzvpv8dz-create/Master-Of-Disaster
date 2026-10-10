/* V751 · FOOD
   Bedienung: Geplant/Erledigt, belastbare Bestandsbuchung, Monats-Stichtag-Plan,
   editierbarer Vorrat, Einkaufslücken und einplanbare Rezepte.
*/
(function(){
  'use strict';
  if(window.__modFoodV544)return;

  const VERSION='V778';
  const ROOT_ID='modFoodV544';
  const BODY_CLASS='mod-food-v544';
  const SURFACE_CLASS='mod-food-surface-v544';
  const TABS=['today','plan','history','inventory','recipes'];
  const LABELS={today:'Heute',plan:'Plan',history:'History',inventory:'Vorrat',shopping:'Einkauf',recipes:'Rezepte'};
  const MEAL_LABELS={breakfast:'Frühstück',snack:'Snack',lunch:'Mittag',dinner:'Abendessen'};
  const RECIPE_GROUP_LABELS={breakfast:'Frühstück',lunch:'Mittagessen',dinner:'Abendessen',snack:'Snack',allrounder:'Allrounder'};
  const RECIPE_CATEGORY_ORDER=['breakfast','lunch','snack','dinner','allrounder'];
  const MEAL_ICONS={breakfast:'☀',snack:'●',lunch:'◒',dinner:'☾'};
  let activeTab='today';
  let activeRecipeCategory='breakfast';
  let loadPromise=null;
  let renderSerial=0;
  let state=null;
  let plannedAllocationCacheState=null;
  let plannedAllocationCache=null;
  let plannedThawCacheState=null;
  let plannedThawCache=null;
  const REQUEST_TIMEOUT_MS=3500;
  const SOURCE_KEYS=['meals','inventory','aliases','lots','recipes','shopping','cart','leftovers','products','intakes'];
  let sourceState=Object.fromEntries(SOURCE_KEYS.map(key=>[key,'unknown']));
  let cloudIssues=[];
  const cardArcs=new Map();
  const frostDecor=new Map();
  const expandedRecipes=new Set();
  const expandedMeals=new Set();
  const expandedPlanDays=new Set();
  const expandedInventory=new Set();
  let unavailableInventoryOpen=false;
  let inventorySearch='';

  function frostSvgMarkup(variant){
    const shapes=[
      '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><g class="food-frost-lines-v668"><path d="M50 7v86M13 29l74 42M13 71l74-42"/><path d="M50 7l-8 12M50 7l8 12M50 93l-8-12M50 93l8-12M13 29l15 1M13 29l7 13M87 71l-15-1M87 71l-7-13M13 71l15-1M13 71l7-13M87 29l-15 1M87 29l-7 13"/></g></svg>',
      '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><g class="food-frost-lines-v668"><path d="M50 5v90M5 50h90M18 18l64 64M18 82l64-64"/><path d="M50 19l-7 9M50 19l7 9M50 81l-7-9M50 81l7-9M19 50l9-7M19 50l9 7M81 50l-9-7M81 50l-9 7M28 28l12 2M28 28l2 12M72 72l-12-2M72 72l-2-12M28 72l12-2M28 72l2-12M72 28l-12 2M72 28l-2 12"/></g></svg>',
      '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><g class="food-frost-lines-v668"><path d="M50 8v84M16 20l68 60M16 80l68-60"/><path d="M50 25l-10 8M50 25l10 8M50 75l-10-8M50 75l10-8M30 33l14 2M30 33l2 14M70 67l-14-2M70 67l-2-14M30 67l14-2M30 67l2-14M70 33l-14 2M70 33l-2 14"/></g></svg>'
    ];
    return shapes[Math.abs(Number(variant)||0)%shapes.length];
  }

  function frostDecorHtml(key,{subtle=false}={}){
    if(!frostDecor.has(key)){
      const count=2+Math.floor(Math.random()*2);
      const html=Array.from({length:count},(_,index)=>{
        const minSize=subtle?80:95;
        const maxSize=subtle?150:180;
        const size=minSize+Math.floor(Math.random()*(maxSize-minSize+1));
        const top=-2+Math.floor(Math.random()*95);
        const right=-58+Math.floor(Math.random()*88);
        const opacity=(subtle?.25:.30)+Math.random()*(subtle?.10:.12);
        const rotate=-38+Math.floor(Math.random()*77);
        const overlap=index&&Math.random()>.42?-24-Math.floor(Math.random()*46):0;
        const variant=Math.floor(Math.random()*3);
        return '<span aria-hidden="true" class="food-frost-shape-v668" style="top:'+top+'%;right:'+right+'px;width:'+size+'px;height:'+size+'px;opacity:'+opacity.toFixed(3)+';transform:translate('+overlap+'px,-50%) rotate('+rotate+'deg)">'+frostSvgMarkup(variant)+'</span>';
      }).join('');
      frostDecor.set(key,html);
    }
    return frostDecor.get(key);
  }

    function decorateCards(root){
    root.querySelectorAll('.food-meal-card-v544,.food-stock-card-v544,.food-recipe-card-v544,.food-empty-card-v544,.food-shopping-list-v544>li').forEach((card,index)=>{
      const key=activeTab+':'+(card.querySelector('h4,strong')?.textContent||index);
      if(!cardArcs.has(key)){
        const count=1+Math.floor(Math.random()*3);
        const edges=['top:left','top:right','bottom:left','bottom:right'].sort(()=>Math.random()-.5);
        cardArcs.set(key,Array.from({length:count},(_,i)=>{
          const [vertical,horizontal]=edges[i].split(':');
          const size=90+Math.floor(Math.random()*100);
          return '<i aria-hidden="true" class="food-arc-v545" style="width:'+size+'px;height:'+Math.round(size*(.7+Math.random()*.5))+'px;'+vertical+':-'+Math.round(size*.6)+'px;'+horizontal+':-'+Math.round(size*.4)+'px;transform:rotate('+Math.floor(Math.random()*180)+'deg)"></i>';
        }).join(''));
      }
      card.insertAdjacentHTML('afterbegin',cardArcs.get(key));
    });

    root.querySelectorAll('.food-stock-card-v544.has-freeze-plan-v664').forEach((card,index)=>{
      const key='freeze-plan:'+(card.querySelector('h4')?.textContent||index);
      card.insertAdjacentHTML('afterbegin',frostDecorHtml(key,{subtle:true}));
    });

    root.querySelectorAll('.food-stock-slice-v664.is-frozen').forEach((slice,index)=>{
      const card=slice.closest('.food-stock-card-v544');
      const key='frozen:'+(card?.querySelector('h4')?.textContent||'stock')+':'+(slice.querySelector('strong')?.textContent||index);
      slice.insertAdjacentHTML('afterbegin',frostDecorHtml(key,{subtle:false}));
    });
  }

  const todayIso=()=>{
    try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin'}).format(new Date());}
    catch(_){return new Date().toISOString().slice(0,10);}
  };
  const plusDays=(iso,days)=>{
    const date=new Date(iso+'T12:00:00');
    date.setDate(date.getDate()+days);
    return date.toISOString().slice(0,10);
  };
  const monthlyPlanningCutoff=(baseIso=todayIso())=>{
    const base=new Date(String(baseIso)+'T12:00:00Z');
    if(Number.isNaN(base.getTime()))return plusDays(todayIso(),14);
    const cutoffFor=(year,month)=>{
      const anchor=new Date(Date.UTC(year,month,23,12));
      let offset=0;
      while(offset<7){
        const candidate=new Date(anchor.getTime()+offset*86400000);
        const weekday=candidate.getUTCDay();
        if(weekday===3||weekday===6)return candidate.toISOString().slice(0,10);
        offset+=1;
      }
      return anchor.toISOString().slice(0,10);
    };
    let cutoff=cutoffFor(base.getUTCFullYear(),base.getUTCMonth());
    if(cutoff<String(baseIso)){
      const nextMonth=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth()+1,1,12));
      cutoff=cutoffFor(nextMonth.getUTCFullYear(),nextMonth.getUTCMonth());
    }
    return cutoff;
  };
  const planningHorizonIso=()=>monthlyPlanningCutoff(todayIso());
  const fmtDate=iso=>new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Berlin'}).format(new Date(iso+'T12:00:00'));
  const fmtDay=iso=>new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'2-digit',month:'long',timeZone:'Europe/Berlin'}).format(new Date(iso+'T12:00:00'));
  const fmtPreparedAt=value=>{
    if(!value)return 'Zubereitet';
    const date=new Date(value);
    if(Number.isNaN(date.getTime()))return 'Zubereitet';
    return 'Zubereitet am '+new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}).format(date);
  };
  const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const num=value=>value===null||value===undefined||value===''?null:Number(value);
  const fmtQty=(value,unit)=>{
    const n=num(value);
    if(n===null||Number.isNaN(n))return 'Menge offen';
    const text=new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(n);
    const singular=Math.abs(n-1)<.0001;
    const plurals={
      Zehe:'Zehen',
      Knolle:'Knollen',
      Scheibe:'Scheiben',
      Portion:'Portionen',
      Packung:'Packungen',
      Glas:'Gläser'
    };
    let displayUnit=unit||'';
    if(!singular&&plurals[unit])displayUnit=plurals[unit];
    return displayUnit?text+' '+displayUnit:text;
  };
  const normalizedStatus=status=>status==='consumed'||status==='prepared'?'completed':status==='completed'?'completed':'planned';
  const portionLabel=value=>{
    const n=num(value);
    if(n===null||Number.isNaN(n))return 'Portion offen';
    const text=new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(n);
    return text+' '+(Math.abs(n-1)<.0001?'Portion':'Portionen');
  };
  const preparedPortionTotal=(recipeId,data=state)=>{
    const id=String(recipeId||'');
    if(!id)return 0;
    return (data?.meals||[]).reduce((total,meal)=>{
      if(String(meal?.recipe_id||'')!==id)return total;
      if(normalizedStatus(meal?.status)!=='completed')return total;
      if(meal?.leftover_id||meal?.source_meal_id)return total;
      const prepared=Number(meal?.prepared_servings);
      return total+(Number.isFinite(prepared)&&prepared>0?prepared:0);
    },0);
  };
  const preparedPortionLabel=value=>{
    const n=Math.max(0,Number(value)||0);
    const text=new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(n);
    return text+' '+(Math.abs(n-1)<.0001?'Portion':'Portionen')+' zubereitet';
  };
  const ingredientName=item=>String(item?.name||item?.label||'Zutat').trim();
  const ingredientDisplay=item=>{
    const q=num(item?.quantity);
    if(q===null||Number.isNaN(q))return ingredientName(item);
    return fmtQty(q,item?.unit)+' '+ingredientName(item);
  };
  const normalizedIngredient=(name,unit='')=>{
    const normalized=String(name||'').trim().toLocaleLowerCase('de-DE');
    if(String(unit||'').trim()==='Zehe'&&(normalized==='knoblauch'||normalized==='knoblauchzehen'))return 'knoblauchzehen';
    if(normalized==='pfeffer'||normalized==='pfeffer schwarz')return 'pfeffer schwarz';
    return normalized;
  };
  const shoppingGapKey=item=>{
    const unit=String(item?.unit||'').trim();
    const window=':'+(item?.buyFrom||'any');
    if(item?.inventory_id)return 'stock:'+String(item.inventory_id)+':'+unit.toLocaleLowerCase('de-DE')+window;
    return 'free:'+normalizedIngredient(item?.label||item?.name,unit)+':'+unit.toLocaleLowerCase('de-DE')+window;
  };
  const manualShoppingKey=item=>'manual:'+String(item?.id||'');
  const shoppingCartIcon=()=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 9.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 7H7"/><circle cx="10" cy="19" r="1.4"/><circle cx="18" cy="19" r="1.4"/></svg>';
  const shoppingCartButton=(key,inCart)=>'<button type="button" class="food-cart-toggle-v639 '+(inCart?'is-in-cart':'')+'" data-food-cart-toggle="'+esc(key)+'" aria-pressed="'+inCart+'" aria-label="'+(inCart?'Aus dem Einkaufswagen zurück auf die Liste':'In den Einkaufswagen legen')+'" title="'+(inCart?'Zurück auf die Liste':'In den Einkaufswagen')+'">'+shoppingCartIcon()+'</button>';

  const NON_SHOPPING_INGREDIENTS=new Set(['wasser','leitungswasser']);
  const isNonShoppingIngredient=name=>NON_SHOPPING_INGREDIENTS.has(String(name||'').trim().toLocaleLowerCase('de-DE'));
  const SHOPPING_DATE_OVERRIDES={'2026-10-03':'2026-10-02','2026-10-17':'2026-10-16'};
  const SHOPPING_OVERDUE_LOOKBACK_DAYS=7;
  const recentPlanningStartIso=()=>plusDays(todayIso(),-SHOPPING_OVERDUE_LOOKBACK_DAYS);
  const regularShoppingDate=(iso,mealType='')=>{
    const day=new Date(String(iso)+'T12:00:00Z').getUTCDay();
    let offset=0;
    if(day===0)offset=-1;
    else if(day===1)offset=-2;
    else if(day===2)offset=-3;
    else if(day===3)offset=mealType==='dinner'?0:-4;
    else if(day===4)offset=-1;
    else if(day===5)offset=-2;
    else if(day===6)offset=mealType==='breakfast'?-3:0;
    const normal=plusDays(iso,offset);
    return SHOPPING_DATE_OVERRIDES[normal]||normal;
  };
  const fmtShortDate=iso=>iso?new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',timeZone:'Europe/Berlin'}).format(new Date(iso+'T12:00:00')):'';
  const inventoryQuantityInUnit=(stock,targetUnit)=>{
    if(!stock)return {available:0,unitMismatch:false,converted:false};
    const quantity=Math.max(0,num(stock.quantity)||0);
    const sourceUnit=String(stock.unit||'').trim();
    const target=String(targetUnit||'').trim();
    if(sourceUnit===target)return {available:quantity,unitMismatch:false,converted:false};
    if(sourceUnit==='kg'&&target==='g')return {available:quantity*1000,unitMismatch:false,converted:true};
    if(sourceUnit==='g'&&target==='kg')return {available:quantity/1000,unitMismatch:false,converted:true};
    if(sourceUnit==='l'&&target==='ml')return {available:quantity*1000,unitMismatch:false,converted:true};
    if(sourceUnit==='ml'&&target==='l')return {available:quantity/1000,unitMismatch:false,converted:true};
    if(target==='g'&&/^(Päckchen|Packung)$/i.test(sourceUnit)){
      const match=String(stock.note||'').match(/([0-9]+(?:[.,][0-9]+)?)\s*g\s+pro\s+(?:Päckchen|Packung)/i);
      if(match){
        const grams=Number(match[1].replace(',','.'));
        if(Number.isFinite(grams)&&grams>0)return {available:quantity*grams,unitMismatch:false,converted:true};
      }
    }
    return {available:0,unitMismatch:true,converted:false};
  };
  const FAMILY_FRESH_QUALIFIERS=new Set(['frisch','frische','frischer','frisches','bio']);
  const FAMILY_FROZEN_QUALIFIERS=new Set(['tk','tiefkühl','tiefgekühlt','tiefgefroren','gefroren']);
  const familyText=value=>String(value||'')
    .trim()
    .toLocaleLowerCase('de-DE')
    .replace(/[·_]+/g,' ')
    .replace(/\s+/g,' ');
  const familyAliases=value=>String(value||'')
    .split(/\s*[/|]\s*/)
    .map(familyText)
    .filter(Boolean);
  const familyNeedMatch=(name,familyName)=>{
    const need=familyText(name);
    if(!need)return null;
    for(const alias of familyAliases(familyName)){
      if(need===alias)return {matched:true,mode:'generic',alias};
      const prefix=need.startsWith(alias+' ')?need.slice(alias.length).trim():'';
      const suffix=need.endsWith(' '+alias)?need.slice(0,need.length-alias.length).trim():'';
      const remainder=prefix||suffix;
      if(!remainder)continue;
      const tokens=remainder.split(/\s+/).filter(Boolean);
      const allowed=tokens.every(token=>FAMILY_FRESH_QUALIFIERS.has(token)||FAMILY_FROZEN_QUALIFIERS.has(token));
      if(!allowed)continue;
      const mode=tokens.some(token=>FAMILY_FROZEN_QUALIFIERS.has(token))
        ?'frozen'
        :tokens.some(token=>FAMILY_FRESH_QUALIFIERS.has(token))
          ?'fresh'
          :'generic';
      return {matched:true,mode,alias};
    }
    return null;
  };
  const familyRowMode=item=>{
    const text=familyText((item?.name||'')+' '+(item?.variant_label||''));
    if(/(?:^|\s)(?:tk|tiefkühl|tiefgekühlt|tiefgefroren|gefroren)(?:\s|$)/.test(text))return 'frozen';
    if(/(?:^|\s)(?:frisch|frische|frischer|frisches)(?:\s|$)/.test(text))return 'fresh';
    return 'neutral';
  };
  const familyFrozenFirstFor=item=>{
    const text=familyText((item?.name||'')+' '+(item?.family_name||'')+' '+(item?.catalog_family_name||''));
    return [
      'hähnchen','huhn','hackfleisch','hack','rind','schwein','pute','fleisch'
    ].some(token=>text.includes(token));
  };
  const familyNeedModeFromName=name=>{
    const text=' '+familyText(name)+' ';
    if(/\s(?:tk|tiefkühl|tiefgekühlt|tiefgefroren|gefroren)\s/.test(text))return 'frozen';
    if(/\s(?:frisch|frische|frischer|frisches|bio)\s/.test(text))return 'fresh';
    return 'generic';
  };
  const inventoryFamilyRowsInfo=(familyName,targetUnit,rows=state?.inventory||[],mode='generic')=>{
    let matches=(rows||[]).filter(item=>
      item?.is_active!==false&&item?.family_name&&familyText(item.family_name)===familyText(familyName)
    );
    if(mode==='fresh'){
      const explicitFresh=matches.filter(item=>familyRowMode(item)==='fresh');
      matches=explicitFresh.length?explicitFresh:matches.filter(item=>familyRowMode(item)!=='frozen');
    }else if(mode==='frozen'){
      matches=matches.filter(item=>familyRowMode(item)==='frozen');
    }

    let available=0;
    let compatible=0;
    let converted=false;
    matches.forEach(item=>{
      const info=inventoryQuantityInUnit(item,targetUnit);
      if(!info.unitMismatch){
        available+=Math.max(0,info.available||0);
        compatible+=1;
        converted=converted||info.converted;
      }
    });
    return {
      available,
      converted,
      unitMismatch:matches.length>0&&compatible===0,
      family:true,
      familyName,
      familyMode:mode,
      rows:matches
    };
  };
  const inventoryFamilyStockInfo=(name,targetUnit,rows=state?.inventory||[])=>{
    const families=new Map();
    (rows||[]).forEach(item=>{
      if(item?.is_active===false||!item?.family_name)return;
      const key=familyText(item.family_name);
      if(!families.has(key))families.set(key,{name:item.family_name,rows:[]});
      families.get(key).rows.push(item);
    });

    let selected=null;
    for(const family of families.values()){
      const match=familyNeedMatch(name,family.name);
      if(match){selected={...family,match};break;}
    }
    if(!selected)return {available:0,converted:false,unitMismatch:false,family:false,rows:[]};
    return inventoryFamilyRowsInfo(selected.name,targetUnit,rows,selected.match.mode);
  };
  const ingredientStockInfo=(item,inventoryRows,inventoryById,inventoryByName)=>{
    const shared=window.__modFoodStockResolverV746;
    if(shared?.resolve){
      return shared.resolve({
        item,
        inventoryRows,
        inventoryAliases:state?.aliases||[]
      });
    }
    const unit=String(item?.unit||'').trim();
    const name=ingredientName(item);
    if(item?.inventory_id){
      const stock=inventoryById.get(item.inventory_id)||null;
      if(stock?.family_name){
        return {...inventoryFamilyRowsInfo(stock.family_name,unit,inventoryRows,familyNeedModeFromName(name)),stock:null};
      }
      return {...inventoryQuantityInUnit(stock,unit),stock,family:false,rows:stock?[stock]:[]};
    }
    const exact=inventoryByName.get(normalizedIngredient(name,unit))||null;
    if(exact?.family_name){
      return {...inventoryFamilyRowsInfo(exact.family_name,unit,inventoryRows,familyNeedModeFromName(name)),stock:null};
    }
    if(exact)return {...inventoryQuantityInUnit(exact,unit),stock:exact,family:false,rows:[exact]};
    const familyInfo=inventoryFamilyStockInfo(name,unit,inventoryRows);
    return {...familyInfo,stock:null};
  };


  const recipeInstructions=recipe=>String(recipe?.instructions||'').split(/\s*\|\s*|\n+/).map(line=>line.trim().replace(/^\s*(?:\d+[.)]|[-•])\s*/,'' )).filter(Boolean);
  const mealTypeOptions=selected=>['breakfast','snack','lunch','dinner'].map(type=>'<option value="'+type+'" '+(type===selected?'selected':'')+'>'+esc(MEAL_LABELS[type])+'</option>').join('');
  const recipeCategoryOptions=selected=>RECIPE_CATEGORY_ORDER.map(type=>'<option value="'+type+'" '+(type===selected?'selected':'')+'>'+esc(RECIPE_GROUP_LABELS[type]||type)+'</option>').join('');
  const planningMealType=type=>['breakfast','snack','lunch','dinner'].includes(type)?type:'dinner';
  const statusLabel=status=>normalizedStatus(status)==='completed'?'Erledigt':'Geplant';
  const priorityLabel=value=>({tomorrow:'Morgen verwenden',three_days:'In den nächsten 3 Tagen',later:'Hält sich länger'}[value]||'Keine Priorität');

  const fallback={
    meals:[
      {id:'breakfast',meal_date:todayIso(),meal_type:'breakfast',title:'Skyr-Bananen-Bowl',status:'completed',sort_order:1,recipe_id:null,ingredients:[
        {label:'250 g Skyr Natur',quantity:250,unit:'g',inventory_id:null},
        {label:'1 Banane',quantity:1,unit:'Stück',inventory_id:null},
        {label:'3 EL zarte Haferflocken',quantity:3,unit:'EL',inventory_id:null}
      ]},
      {id:'snack',meal_date:todayIso(),meal_type:'snack',title:'Apfel & Mandeln',status:'planned',sort_order:2,recipe_id:null,ingredients:[
        {label:'1 Apfel',quantity:1,unit:'Stück',inventory_id:null},
        {label:'25 g Mandeln naturbelassen',quantity:25,unit:'g',inventory_id:null}
      ]},
      {id:'lunch',meal_date:todayIso(),meal_type:'lunch',title:'Roggenbrot mit Pute & Gurke',status:'completed',sort_order:3,recipe_id:null,ingredients:[
        {label:'2 Scheiben Roggen-Vollkornbrot · 111 g',quantity:111,unit:'g',inventory_id:null},
        {label:'100 g Putenbrust-Aufschnitt',quantity:100,unit:'g',inventory_id:null},
        {label:'30 g Frischkäse Balance',quantity:30,unit:'g',inventory_id:null},
        {label:'118 g Gurke auf dem Brot',quantity:118,unit:'g',inventory_id:null},
        {label:'106 g Tomaten separat',quantity:106,unit:'g',inventory_id:null}
      ]},
      {id:'dinner',meal_date:todayIso(),meal_type:'dinner',title:'Hähnchen, Kartoffeln & Brokkoli',status:'planned',sort_order:4,recipe_id:null,ingredients:[
        {label:'200 g Hähnchenbrust',quantity:200,unit:'g',inventory_id:null},
        {label:'300 g Kartoffeln',quantity:300,unit:'g',inventory_id:null},
        {label:'300 g Brokkoli',quantity:300,unit:'g',inventory_id:null},
        {label:'2–3 EL Magerquark als Dip',quantity:null,unit:'EL',inventory_id:null}
      ]}
    ],
    inventory:[
      {id:'cucumber',name:'Gurke',quantity:324,unit:'g',quantity_label:'324 g',forecast_label:null,tone:'fresh',note:'442 g gewogen',opened:false,use_priority:'three_days',is_active:true},
      {id:'tomatoes',name:'Tomaten · Fruchtig & Süß',quantity:394,unit:'g',quantity_label:'394 g',forecast_label:null,tone:'fresh',note:'500-g-Packung',opened:false,use_priority:'three_days',is_active:true},
      {id:'broccoli',name:'Brokkoli',quantity:500,unit:'g',quantity_label:'500 g',forecast_label:'200 g nach dem Abendessen',tone:'priority',note:'Noch unangebrochen · morgen zuerst verwenden',opened:false,use_priority:'tomorrow',is_active:true},
      {id:'chicken',name:'Hähnchenbrustfilet',quantity:600,unit:'g',quantity_label:'600 g',forecast_label:'400 g nach dem Abendessen',tone:'priority',note:'Noch unangebrochen · morgen zuerst verwenden',opened:false,use_priority:'tomorrow',is_active:true},
      {id:'potatoes',name:'Kartoffeln',quantity:2500,unit:'g',quantity_label:'2.500 g',forecast_label:'2.200 g nach dem Abendessen',tone:'stock',note:'2.500 g Ausgangsbestand',opened:false,use_priority:'later',is_active:true},
      {id:'skyr',name:'Skyr Natur',quantity:250,unit:'g',quantity_label:'250 g',forecast_label:null,tone:'priority',note:null,opened:true,use_priority:'tomorrow',is_active:true},
      {id:'cream',name:'Frischkäse Balance',quantity:270,unit:'g',quantity_label:'270 g',forecast_label:null,tone:'priority',note:null,opened:true,use_priority:'tomorrow',is_active:true},
      {id:'quark',name:'Magerquark',quantity:250,unit:'g',quantity_label:'250 g',forecast_label:null,tone:'stock',note:'Dip-Menge noch offen',opened:false,use_priority:'later',is_active:true},
      {id:'bread',name:'Roggen-Vollkornbrot',quantity:389,unit:'g',quantity_label:'ca. 389 g · 7 Scheiben',forecast_label:null,tone:'priority',note:'500 g / 9 Scheiben',opened:true,use_priority:'tomorrow',is_active:true},
      {id:'turkey',name:'Putenbrust-Aufschnitt',quantity:0,unit:'g',quantity_label:'0 g',forecast_label:null,tone:'empty',note:'100-g-Packung verwendet',opened:false,use_priority:'later',is_active:true},
      {id:'bananas',name:'Bananen',quantity:4,unit:'Stück',quantity_label:'4 Stück',forecast_label:null,tone:'fresh',note:'5 Stück Ausgangsbestand',opened:false,use_priority:'later',is_active:true},
      {id:'apples',name:'Granny Smith',quantity:8,unit:'Stück',quantity_label:'8 Stück',forecast_label:'7 nach dem Snack',tone:'stock',note:null,opened:false,use_priority:'later',is_active:true},
      {id:'almonds',name:'Mandeln naturbelassen',quantity:200,unit:'g',quantity_label:'200 g',forecast_label:'175 g nach dem Snack',tone:'stock',note:null,opened:false,use_priority:'later',is_active:true},
      {id:'oats',name:'Zarte Haferflocken',quantity:null,unit:'g',quantity_label:'Rest nicht grammgenau',forecast_label:null,tone:'stock',note:'500-g-Packung',opened:true,use_priority:'later',is_active:true},
      {id:'mince',name:'Hackfleisch gemischt',quantity:800,unit:'g',quantity_label:'800 g',forecast_label:null,tone:'stock',note:null,opened:false,use_priority:'later',is_active:true},
      {id:'pepsi',name:'Pepsi Zero Cherry',quantity:7.5,unit:'l',quantity_label:'6 × 1,25 l',forecast_label:null,tone:'stock',note:'Getränkevorrat',opened:false,use_priority:'later',is_active:true}
    ],
    aliases:[],
    recipes:[],
    shopping:[],
    cart:[],
    leftovers:[],
    lots:[],
    products:[]
  };

  function ensureRoot(){
    let root=document.getElementById(ROOT_ID);
    if(root)return root;
    const app=document.querySelector('main.app');
    if(!app)return null;
    root=document.createElement('section');
    root.id=ROOT_ID;
    root.className='mod-food-root-v544';
    root.setAttribute('aria-label','FOOD');
    app.appendChild(root);
    return root;
  }

  function client(){
    try{
      if(typeof window.getSupabaseClient==='function')return window.getSupabaseClient();
      if(typeof getSupabaseClient==='function')return getSupabaseClient();
    }catch(_){}
    return null;
  }

  function flattenMeals(rows){
    return (rows||[]).map(row=>({
      ...row,
      status:normalizedStatus(row.status),
      ingredients:(row.food_meal_ingredients||[]).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))
    }));
  }

  const sourceIsReal=key=>sourceState[key]==='cloud'||sourceState[key]==='stale';

  function withTimeout(promise,label,ms=REQUEST_TIMEOUT_MS){
    let timer;
    return Promise.race([
      Promise.resolve(promise).finally(()=>clearTimeout(timer)),
      new Promise((_,reject)=>{
        timer=setTimeout(()=>reject(new Error(label+' hat zu lange gebraucht.')),ms);
      })
    ]);
  }

  function keepOrFallback(key){
    if(state&&Array.isArray(state[key])&&sourceIsReal(key)){
      sourceState[key]='stale';
      return state[key];
    }
    sourceState[key]='fallback';
    return structuredClone(fallback[key]||[]);
  }

  function unavailableSnapshot(message){
    cloudIssues=[message];
    return Object.fromEntries(SOURCE_KEYS.map(key=>[key,keepOrFallback(key)]));
  }

  async function safeQuery(key,promise){
    try{
      const result=await withTimeout(promise,key);
      if(result?.error)return {data:null,error:result.error};
      return result||{data:[]};
    }catch(error){
      return {data:null,error};
    }
  }

  async function remoteData(){
    const supabase=client();
    if(!supabase)return unavailableSnapshot('Cloud-Verbindung fehlt.');
    let session;
    try{
      session=await withTimeout(supabase.auth.getSession(),'Anmeldung',2500);
    }catch(error){
      console.warn('V548 FOOD Sitzung nicht rechtzeitig verfügbar.',error);
      return unavailableSnapshot('Cloud-Sitzung antwortet gerade nicht.');
    }
    const user=session?.data?.session?.user;
    if(session?.error||!user?.id)return unavailableSnapshot('Cloud-Sitzung ist nicht verfügbar.');

    const results=await Promise.all([
      safeQuery('Mahlzeiten',supabase.from('food_meals').select('id,meal_date,meal_type,title,status,sort_order,note,recipe_id,prepared_servings,eaten_servings,leftover_id,source_meal_id,prepared_at,inventory_booked_at,prepared_sources_snapshot,calories_kcal_per_serving_override,food_meal_ingredients(id,name,label,quantity,unit,quantity_confirmed,sort_order,inventory_id,thaw_started_at,allocation_override)').lte('meal_date',planningHorizonIso()).order('meal_date').order('sort_order')),
      safeQuery('Vorrat',supabase.from('food_inventory_overview').select('id,name,family_name,variant_label,catalog_family_name,catalog_group_label,catalog_variant_label,quantity,unit,quantity_label,forecast_label,tone,note,sort_order,is_active,opened,use_priority,pending_weighing,shopping_excluded').order('sort_order')),
      safeQuery('Vorratsaliase',supabase.from('food_inventory_aliases').select('id,inventory_id,alias').order('alias')),
      safeQuery('Bestandschargen',supabase.from('food_inventory_lots').select('id,inventory_id,product_id,best_before_date,unopened_packages,opened_packages,opened_remaining_quantity,opened_remaining_unit,package_quantity,package_unit,storage_location,purchased_on,package_label,note,created_at').order('created_at')),
      safeQuery('Rezepte',supabase.from('food_recipes').select('id,title,meal_type,description,servings,prep_minutes,difficulty,instructions,display_note,rating,rating_updated_at,calories_kcal_per_serving,protein_g_per_serving,carbs_g_per_serving,fat_g_per_serving,food_recipe_ingredients(id,name,label,quantity,unit,sort_order,inventory_id)').eq('active',true).order('title')),
      safeQuery('Einkauf',supabase.from('food_shopping_items').select('id,label,quantity,unit,checked,created_at').order('created_at')),
      safeQuery('Einkaufswagen',supabase.from('food_shopping_cart_state').select('id,shopping_key,added_at').order('added_at')),
      safeQuery('Restportionen',supabase.from('food_leftovers').select('id,recipe_id,source_meal_id,available_servings,original_servings,status,note,created_at,food_recipes(title,meal_type)').eq('status','available').gt('available_servings',0).order('created_at',{ascending:false})),
      safeQuery('Produktstamm',supabase.from('shopping_products').select('id,inventory_id,category,brand,product_name,variant,barcode,active,product_data').eq('active',true)),
      safeQuery('Kreatin-Einnahmen',supabase.from('food_creatine_intakes').select('id,intake_date,inventory_id,inventory_name,variant_label,quantity_g,creatine_g,confirmed_at').gte('intake_date',plusDays(todayIso(),-180)).lte('intake_date',planningHorizonIso()).order('intake_date',{ascending:false}))
    ]);

    cloudIssues=[];
    function take(key,index,transform){
      const result=results[index];
      if(!result?.error){
        sourceState[key]='cloud';
        return transform(result.data||[]);
      }
      console.warn('V548 FOOD '+key+' nicht aktualisiert.',result.error);
      cloudIssues.push(key+': '+(result.error?.message||'Cloud-Anfrage fehlgeschlagen'));
      return keepOrFallback(key);
    }

    return {
      meals:take('meals',0,flattenMeals),
      inventory:take('inventory',1,rows=>rows),
      aliases:take('aliases',2,rows=>rows),
      lots:take('lots',3,rows=>rows),
      recipes:take('recipes',4,rows=>rows),
      shopping:take('shopping',5,rows=>rows),
      cart:take('cart',6,rows=>rows),
      leftovers:take('leftovers',7,rows=>rows),
      products:take('products',8,rows=>rows),
      intakes:take('intakes',9,rows=>rows)
    };
  }

  async function load(){
    if(loadPromise)return loadPromise;
    loadPromise=remoteData().catch(error=>{
      console.warn('V548 FOOD Cloud-Daten nicht erreichbar.',error);
      return unavailableSnapshot(error?.message||'Cloud-Daten konnten nicht geladen werden.');
    });
    state=await loadPromise;
    return state;
  }

  function cloudNotice(){
    if(!cloudIssues.length)return '';
    const fallbackActive=SOURCE_KEYS.some(key=>sourceState[key]==='fallback');
    const text=fallbackActive
      ?'Mindestens ein Bereich zeigt gerade nur die Notfallansicht. Änderungen daran sind gesperrt, damit keine falschen IDs gespeichert werden.'
      :'Die Cloud war langsam. Die zuletzt bestätigten Daten bleiben sichtbar und können erneut synchronisiert werden.';
    return '<div class="food-cloud-warning-v548" role="status"><div><strong>Cloud hakt gerade</strong><span>'+esc(text)+'</span></div><button type="button" data-food-retry>Erneut laden</button></div>';
  }

  function shell(){
    return '<div class="food-hero-v544"><div><span class="food-kicker-v544">TAGESKÜCHE</span><h2>Was ist heute dran?</h2><p>Dein Plan, dein Vorrat und die nächsten Mahlzeiten – klar getrennt und direkt bedienbar.</p></div><div class="food-date-v544"><strong>'+new Date().getDate()+'</strong><span>'+new Intl.DateTimeFormat('de-DE',{month:'short',timeZone:'Europe/Berlin'}).format(new Date()).replace('.','').toUpperCase()+'</span></div></div>'+
      '<nav class="food-nav-v544" aria-label="FOOD Bereiche">'+TABS.map(tab=>'<button type="button" data-food-tab="'+tab+'" class="'+(tab===activeTab?'active':'')+'" aria-pressed="'+(tab===activeTab)+'">'+LABELS[tab]+'</button>').join('')+'</nav>'+
      '<div class="food-content-v544"><div class="food-loading-v544">FOOD wird gedeckt …</div></div>';
  }

  function familyAllocationProductText(product,stock){
    if(!product)return String(stock?.variant_label||stock?.name||'Produkt').trim();
    const brand=String(product.brand||'').trim();
    const name=String(product.product_name||stock?.name||'Produkt').trim();
    const variant=String(product.variant||'').trim();
    let label=name||String(stock?.name||'Produkt').trim();
    if(brand&&!familyText(label).includes(familyText(brand)))label=brand+' '+label;
    if(variant&&!familyText(label).includes(familyText(variant)))label+=' · '+variant;
    return label;
  }

  function familyAllocationProductLabel(stock){
    const activeLots=(state?.lots||[])
      .filter(lot=>String(lot.inventory_id||'')===String(stock?.id||''))
      .filter(lot=>Number(lot.unopened_packages||0)>0||Number(lot.opened_remaining_quantity||0)>0)
      .sort((a,b)=>
        String(a.best_before_date||'9999-12-31').localeCompare(String(b.best_before_date||'9999-12-31'))||
        String(a.purchased_on||'9999-12-31').localeCompare(String(b.purchased_on||'9999-12-31'))||
        String(a.created_at||'').localeCompare(String(b.created_at||''))||
        String(a.id||'').localeCompare(String(b.id||''))
      );
    const lotProduct=activeLots.map(lot=>(state?.products||[]).find(product=>String(product.id||'')===String(lot.product_id||''))).find(Boolean)||null;
    if(lotProduct)return familyAllocationProductText(lotProduct,stock);

    const products=(state?.products||[]).filter(row=>String(row.inventory_id||'')===String(stock?.id||''));
    if(products.length===1)return familyAllocationProductText(products[0],stock);
    return String(stock?.variant_label||stock?.name||'Produkt').trim();
  }

  function familyAllocationConvertQuantity(value,sourceUnit,targetUnit){
    const q=Number(value)||0;
    const source=String(sourceUnit||'').trim();
    const target=String(targetUnit||'').trim();
    if(source===target)return q;
    if(source==='kg'&&target==='g')return q*1000;
    if(source==='g'&&target==='kg')return q/1000;
    if(source==='l'&&target==='ml')return q*1000;
    if(source==='ml'&&target==='l')return q/1000;
    return null;
  }

  function familyAllocationLotQuantity(lot,stock,targetUnit){
    const stockUnit=String(stock?.unit||'').trim();
    let total=0;
    const packageQty=Number(lot?.package_quantity)||0;
    const unopened=Math.max(0,Number(lot?.unopened_packages)||0);
    if(packageQty>0&&unopened>0&&String(lot?.package_unit||'').trim()===stockUnit)total+=packageQty*unopened;
    const openedQty=Math.max(0,Number(lot?.opened_remaining_quantity)||0);
    if(openedQty>0&&String(lot?.opened_remaining_unit||'').trim()===stockUnit)total+=openedQty;
    return familyAllocationConvertQuantity(total,stockUnit,targetUnit);
  }

  function familyAllocationStockParts(stock,targetUnit,take,consumedBefore=0){
    const total=Number(inventoryQuantityInUnit(stock,targetUnit).available)||0;
    if(total<=0||take<=0)return [];

    const lots=(state?.lots||[])
      .filter(lot=>String(lot.inventory_id||'')===String(stock?.id||''))
      .map(lot=>({lot,quantity:familyAllocationLotQuantity(lot,stock,targetUnit)}))
      .filter(entry=>entry.quantity!==null&&entry.quantity>0)
      .sort((a,b)=>{
        const frozenFirst=familyFrozenFirstFor(stock);
        const fa=frozenStorageLocation(a.lot.storage_location)?(frozenFirst?0:1):(frozenFirst?1:0);
        const fb=frozenStorageLocation(b.lot.storage_location)?(frozenFirst?0:1):(frozenFirst?1:0);
        if(fa!==fb)return fa-fb;
        return String(a.lot.best_before_date||'9999-12-31').localeCompare(String(b.lot.best_before_date||'9999-12-31'))||
          String(a.lot.purchased_on||'9999-12-31').localeCompare(String(b.lot.purchased_on||'9999-12-31'))||
          String(a.lot.created_at||'').localeCompare(String(b.lot.created_at||''))||
          String(a.lot.id||'').localeCompare(String(b.lot.id||''));
      });

    const tracked=lots.reduce((sum,entry)=>sum+entry.quantity,0);
    const segments=[];
    const untracked=Math.max(0,total-tracked);
    if(untracked>0)segments.push({quantity:untracked,label:familyAllocationProductLabel(stock),frozen:false});

    for(const entry of lots){
      const product=(state?.products||[]).find(row=>String(row.id||'')===String(entry.lot.product_id||''))||null;
      segments.push({
        quantity:entry.quantity,
        label:familyAllocationProductText(product,stock),
        frozen:frozenStorageLocation(entry.lot.storage_location)
      });
    }

    let skip=Math.max(0,Number(consumedBefore)||0);
    let remaining=Math.max(0,Number(take)||0);
    const parts=[];
    for(const segment of segments){
      if(remaining<=0.0001)break;
      const segmentQty=Math.max(0,Number(segment.quantity)||0);
      if(skip>=segmentQty-.0001){skip=Math.max(0,skip-segmentQty);continue;}
      const available=Math.max(0,segmentQty-skip);
      skip=0;
      const quantity=Math.min(available,remaining);
      if(quantity<=0)continue;
      const previous=parts[parts.length-1];
      if(previous&&previous.label===segment.label&&previous.frozen===segment.frozen)previous.quantity+=quantity;
      else parts.push({label:segment.label,quantity,frozen:segment.frozen});
      remaining-=quantity;
    }

    if(remaining>0.0001){
      const label=familyAllocationProductLabel(stock);
      const previous=parts[parts.length-1];
      if(previous&&previous.label===label&&previous.frozen===false)previous.quantity+=remaining;
      else parts.push({label,quantity:remaining,frozen:false});
    }
    return parts;
  }

  function familyAllocationLotDate(inventoryId){
    const dates=(state?.lots||[])
      .filter(lot=>String(lot.inventory_id||'')===String(inventoryId||''))
      .filter(lot=>Number(lot.unopened_packages||0)>0||Number(lot.opened_remaining_quantity||0)>0)
      .map(lot=>String(lot.purchased_on||''))
      .filter(Boolean)
      .sort();
    if(dates.length)return dates[0];
    const stock=(state?.inventory||[]).find(row=>String(row.id)===String(inventoryId||''));
    return '9999-12-31';
  }

  function familyAllocationCandidates(item,inventoryRows=state?.inventory||[]){
    const name=ingredientName(item);
    const unit=String(item?.unit||'').trim();
    let info=null;

    if(item?.inventory_id){
      const pinned=(inventoryRows||[]).find(row=>String(row.id)===String(item.inventory_id));
      if(!pinned?.family_name)return [];
      info=inventoryFamilyRowsInfo(pinned.family_name,unit,inventoryRows,familyNeedModeFromName(name));
    }else{
      const exact=(inventoryRows||[]).find(row=>normalizedIngredient(row.name,row.unit)===normalizedIngredient(name,unit));
      if(exact?.family_name)info=inventoryFamilyRowsInfo(exact.family_name,unit,inventoryRows,familyNeedModeFromName(name));
      else info=inventoryFamilyStockInfo(name,unit,inventoryRows);
    }

    if(!info?.family)return [];
    const generic=info.familyMode==='generic';
    const frozenFirst=familyFrozenFirstFor({name,family_name:info.familyName});
    return (info.rows||[])
      .map(stock=>({stock,info:inventoryQuantityInUnit(stock,unit)}))
      .filter(entry=>!entry.info.unitMismatch&&Number(entry.info.available)>0)
      .sort((a,b)=>{
        const pa=generic?(familyRowMode(a.stock)==='frozen'?(frozenFirst?0:1):(frozenFirst?1:0)):0;
        const pb=generic?(familyRowMode(b.stock)==='frozen'?(frozenFirst?0:1):(frozenFirst?1:0)):0;
        if(pa!==pb)return pa-pb;
        const da=familyAllocationLotDate(a.stock.id);
        const db=familyAllocationLotDate(b.stock.id);
        return da.localeCompare(db)||
          Number(a.stock.sort_order||0)-Number(b.stock.sort_order||0)||
          String(a.stock.id||'').localeCompare(String(b.stock.id||''));
      });
  }


  function familyAllocationForItem(item,quantities=null){
    const q=num(item?.quantity);
    if(q===null||q<0)return null;
    const unit=String(item?.unit||'').trim();
    const candidates=familyAllocationCandidates(item);
    if(!candidates.length)return null;

    let remaining=q;
    const allocations=[];
    for(const entry of candidates){
      if(remaining<=0.0001)break;
      let available=Number(entry.info.available)||0;
      if(quantities?.has(String(entry.stock.id))){
        const virtualStock={...entry.stock,quantity:quantities.get(String(entry.stock.id))};
        available=Number(inventoryQuantityInUnit(virtualStock,unit).available)||0;
      }
      if(available<=0)continue;
      const take=Math.min(available,remaining);
      const baseAvailable=Number(entry.info.available)||0;
      const consumedBefore=Math.max(0,baseAvailable-available);
      const parts=familyAllocationStockParts(entry.stock,unit,take,consumedBefore);
      if(parts.length){
        parts.forEach(part=>allocations.push({
          inventoryId:String(entry.stock.id),
          label:part.label,
          quantity:part.quantity,
          unit:item?.unit||unit,
          frozen:part.frozen===true
        }));
      }else{
        allocations.push({
          inventoryId:String(entry.stock.id),
          label:familyAllocationProductLabel(entry.stock),
          quantity:take,
          unit:item?.unit||unit
        });
      }
      remaining-=take;
    }
    return allocations.length?{allocations,remaining:Math.max(0,remaining)}:null;
  }

  function specificAllocationForItem(item,quantities=null){
    const q=num(item?.quantity);
    if(q===null||q<0)return null;
    const unit=String(item?.unit||'').trim();
    const name=ingredientName(item);

    let stock=null;
    if(item?.inventory_id){
      stock=(state?.inventory||[]).find(row=>String(row.id)===String(item.inventory_id))||null;
    }
    if(!stock){
      stock=(state?.inventory||[]).find(row=>
        row?.is_active!==false&&normalizedIngredient(row.name,row.unit)===normalizedIngredient(name,unit)
      )||null;
    }
    if(!stock)return null;

    const family=String(stock.family_name||'').trim();
    if(family&&familyText(family)===familyText(name))return null;

    const baseInfo=inventoryQuantityInUnit(stock,unit);
    if(baseInfo.unitMismatch)return null;
    const baseAvailable=Math.max(0,Number(baseInfo.available)||0);

    let available=baseAvailable;
    if(quantities?.has(String(stock.id))){
      const virtualStock={...stock,quantity:quantities.get(String(stock.id))};
      const virtualInfo=inventoryQuantityInUnit(virtualStock,unit);
      if(virtualInfo.unitMismatch)return null;
      available=Math.max(0,Number(virtualInfo.available)||0);
    }

    const take=Math.min(q,available);
    const consumedBefore=Math.max(0,baseAvailable-available);
    const parts=take>0?familyAllocationStockParts(stock,unit,take,consumedBefore):[];
    const allocations=parts.length
      ?parts.map(part=>({
          inventoryId:String(stock.id),
          label:part.label,
          quantity:part.quantity,
          unit:item?.unit||unit,
          frozen:part.frozen===true
        }))
      :(take>0?[{
          inventoryId:String(stock.id),
          label:familyAllocationProductLabel(stock),
          quantity:take,
          unit:item?.unit||unit
        }]:[]);

    return {
      allocations,
      remaining:Math.max(0,q-take),
      specific:true
    };
  }

  function reserveSpecificIngredient(item,quantities){
    if(!item?.inventory_id||!quantities)return;
    const id=String(item.inventory_id);
    const stock=(state?.inventory||[]).find(row=>String(row.id)===id);
    if(!stock)return;
    const needed=num(item.quantity);
    if(needed===null)return;
    const source=String(item.unit||'').trim();
    const target=String(stock.unit||'').trim();
    let inStockUnit=null;
    if(source===target)inStockUnit=needed;
    else if(source==='g'&&target==='kg')inStockUnit=needed/1000;
    else if(source==='kg'&&target==='g')inStockUnit=needed*1000;
    else if(source==='ml'&&target==='l')inStockUnit=needed/1000;
    else if(source==='l'&&target==='ml')inStockUnit=needed*1000;
    if(inStockUnit===null)return;
    quantities.set(id,Math.max(0,(Number(quantities.get(id))||0)-inStockUnit));
  }

  function reserveFamilyAllocation(allocation,quantities){
    if(!allocation||!quantities)return;
    for(const part of allocation.allocations||[]){
      const stock=(state?.inventory||[]).find(row=>String(row.id)===String(part.inventoryId));
      if(!stock)continue;
      const source=String(part.unit||'').trim();
      const target=String(stock.unit||'').trim();
      let inStockUnit=null;
      if(source===target)inStockUnit=part.quantity;
      else if(source==='g'&&target==='kg')inStockUnit=part.quantity/1000;
      else if(source==='kg'&&target==='g')inStockUnit=part.quantity*1000;
      else if(source==='ml'&&target==='l')inStockUnit=part.quantity/1000;
      else if(source==='l'&&target==='ml')inStockUnit=part.quantity*1000;
      if(inStockUnit===null)continue;
      const id=String(part.inventoryId);
      quantities.set(id,Math.max(0,(Number(quantities.get(id))||0)-inStockUnit));
    }
  }

  function manualAllocationForItem(item){
    const raw=Array.isArray(item?.allocation_override)?item.allocation_override:[];
    if(!raw.length)return null;
    const allocations=raw.map((part,index)=>{
      const inventoryId=String(part?.inventory_id||'').trim();
      const stock=(state?.inventory||[]).find(row=>String(row.id)===inventoryId)||null;
      const quantity=Math.max(0,Number(part?.quantity)||0);
      const unit=String(part?.unit||item?.unit||stock?.unit||'').trim();
      if(!inventoryId||quantity<=0)return null;
      const label=String(part?.label||'').trim()||(stock?familyAllocationProductLabel(stock):'Vorratsquelle '+(index+1));
      const frozen=part?.frozen===true||(stock&&familyRowMode(stock)==='frozen');
      return {inventoryId,label,quantity,unit,frozen,manual:true};
    }).filter(Boolean);
    if(!allocations.length)return null;
    return {allocations,remaining:0,manual:true};
  }

  function mealIngredientContext(ingredientId){
    const id=String(ingredientId||'');
    for(const meal of (state?.meals||[])){
      const ingredient=(meal.ingredients||[]).find(item=>String(item.id)===id);
      if(ingredient)return {meal,ingredient};
    }
    return null;
  }

  function editableAllocationContext(item){
    if(!item?.id)return null;
    const context=mealIngredientContext(item.id);
    if(!context)return null;
    if(normalizedStatus(context.meal.status)==='completed'||context.meal.inventory_booked_at)return null;
    return context;
  }

  function plannedFamilyAllocationMaps(){
    if(plannedAllocationCacheState===state&&plannedAllocationCache)return plannedAllocationCache;

    const quantities=new Map((state?.inventory||[]).map(stock=>[String(stock.id),Math.max(0,num(stock.quantity)||0)]));
    const maps=new Map();
    const meals=[...(state?.meals||[])]
      .filter(meal=>String(meal.meal_date||'')>=recentPlanningStartIso())
      .sort((a,b)=>String(a.meal_date||'').localeCompare(String(b.meal_date||''))||
        Number(a.sort_order||0)-Number(b.sort_order||0)||
        String(a.id||'').localeCompare(String(b.id||'')));

    for(const meal of meals){
      const perMeal=new Map();
      maps.set(String(meal.id||''),perMeal);
      if(normalizedStatus(meal.status)==='completed'||meal.inventory_booked_at)continue;
      const items=[...(meal.ingredients||[])].sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0));
      for(const item of items){
        const allocation=manualAllocationForItem(item)||familyAllocationForItem(item,quantities)||specificAllocationForItem(item,quantities);
        if(allocation){
          if(item?.id)perMeal.set(String(item.id),allocation);
          reserveFamilyAllocation(allocation,quantities);
        }else{
          reserveSpecificIngredient(item,quantities);
        }
      }
    }

    plannedAllocationCacheState=state;
    plannedAllocationCache=maps;
    return maps;
  }

  function allocationMarkup(allocation,item){
    const parts=Array.isArray(allocation?.allocations)?allocation.allocations:[];
    const missing=Math.max(0,Number(allocation?.remaining)||0);
    if(!parts.length&&missing<=0.0001)return '';

    const generic=familyText(ingredientName(item));
    const needed=Math.max(0,Number(item?.quantity)||0);
    const editable=editableAllocationContext(item);
    const sourceEditAllowed=Boolean(editable)&&missing<=0.0001;
    const singleComplete=parts.length===1&&missing<=0.0001&&Math.abs((Number(parts[0]?.quantity)||0)-needed)<=0.0001;
    const thawing=Boolean(item?.thaw_started_at);
    let html='<div class="food-ingredient-allocation-v712">';
    parts.forEach((part,index)=>{
      const rawLabel=String(part.label||'').trim();
      const detailLabel=!rawLabel||familyText(rawLabel)===generic?'Produkt nicht genauer erfasst':rawLabel;
      const frozen=part.frozen===true;
      const thawClass=frozen&&thawing?' is-thawing-v741':'';
      const status=frozen?(thawing?' · Auftauen läuft':' · eingefroren'):'';
      const canEdit=sourceEditAllowed&&Boolean(part.inventoryId);
      const amount=canEdit
        ?'<button type="button" class="food-allocation-qty-edit-v749" data-food-allocation-edit="'+esc(item.id)+'" data-food-allocation-index="'+index+'" aria-label="Menge von '+esc(detailLabel)+' ändern">'+esc(fmtQty(part.quantity,part.unit))+'</button>'
        :((singleComplete&&!canEdit)?'':'<b>'+esc(fmtQty(part.quantity,part.unit))+'</b>');
      html+='<div class="food-ingredient-allocation-line-v712 '+(frozen?'is-frozen-v736 ':'')+thawClass+(singleComplete&&!canEdit?' is-single-source-v741':'')+(canEdit?' is-editable-v749':'')+'">'
        +'<span class="food-allocation-arrow-v741" aria-hidden="true">↳</span>'
        +'<span class="food-allocation-copy-v741">'+esc(detailLabel)+status+'</span>'
        +amount
        +'</div>';
    });
    if(missing>0.0001){
      html+='<div class="food-ingredient-allocation-line-v712 is-missing">'
        +'<span class="food-allocation-arrow-v741" aria-hidden="true">↳</span>'
        +'<span class="food-allocation-copy-v741">fehlt im Vorrat</span>'
        +'<b>'+esc(fmtQty(missing,item?.unit))+'</b>'
        +'</div>';
    }
    return html+'</div>';
  }

  // Verbrauchsbuchungen sind ein unveraenderlicher Mahlzeitenstand; niemals gegen
  // aktuellen Vorrat oder heutige Lagerorte neu aufloesen.
  function preparedIngredientListMarkup(meal){
    const snapshot=meal?.prepared_sources_snapshot;
    const sources=Array.isArray(snapshot?.sources)
      ?snapshot.sources.filter(row=>row&&Number(row.quantity)>0):[];
    const original=Array.isArray(snapshot?.ingredients)
      ?snapshot.ingredients:(meal?.ingredients||[]);
    if(!sources.length&&!original.length)return '';

    const ranking=source=>{
      const names=[source?.name,source?.label].map(familyText).filter(Boolean);
      const index=original.findIndex(item=>{
        const key=familyText(ingredientName(item));
        return key&&names.some(name=>name===key||name.includes(key)||key.includes(name));
      });
      return index<0?9999:index;
    };
    const ordered=sources.map((source,index)=>({source,index}))
      .sort((a,b)=>ranking(a.source)-ranking(b.source)||a.index-b.index)
      .map(entry=>entry.source);

    const rows=ordered.length
      ?ordered.map(source=>{
        const wasFrozen=source.frozen===true;
        let label=String(source.label||source.name||'Vorratszutat').trim();
        // "frisch" auf einem historischen Kaufetikett darf nach Auftauen
        // nicht mit der tatsaechlichen Verwendung verwechselt werden.
        if(wasFrozen)label=label.replace(/\s*[·,-]\s*frisch\s*$/i,'').trim();
        if(wasFrozen)label+=' · aufgetaut (TK)';
        return '<li><span>'+esc(label)+'</span><b>'+esc(fmtQty(source.quantity,source.unit))+'</b></li>';
      })
      :original.map(item=>
        '<li><span>'+esc(ingredientName(item))+'</span><b>'+
        esc(num(item.quantity)===null?'Menge offen':fmtQty(item.quantity,item.unit))+
        '</b></li>'
      );

    return '<div class="food-recipe-detail-block-v572 food-prepared-ingredients-v761">'
      +'<strong>Zubereitet mit</strong><ul>'+rows.join('')+'</ul>'
      +'</div>';
  }

  function ingredientListMarkup(items,allocationMap=null){
    return '<ul>'+items.map(item=>{
      const q=num(item.quantity);
      const allocation=(item?.id&&allocationMap?.get?.(String(item.id)))||manualAllocationForItem(item)||familyAllocationForItem(item)||specificAllocationForItem(item);
      const allocationHtml=allocationMarkup(allocation,item);
      const editable=editableAllocationContext(item);
      const canRemove=Boolean(editable);
      const quantityHtml=q===null||Number.isNaN(q)
        ?''
        :'<b class="'+(allocationHtml?'food-ingredient-total-v741':'')+'">'+esc(fmtQty(q,item.unit))+'</b>';
      const removeHtml=canRemove
        ?'<button type="button" class="food-ingredient-remove-v751" data-food-remove-meal-ingredient="'+esc(item.id)+'" aria-label="'+esc(ingredientName(item))+' nur aus dieser Mahlzeit entfernen" title="Nur aus dieser Mahlzeit entfernen">×</button>'
        :'';
      return '<li class="'+(allocationHtml?'food-ingredient-has-allocation-v712 ':'')+(canRemove?'has-remove-v751':'')+'"><span>'+esc(ingredientName(item))+'</span>'+
        quantityHtml+
        removeHtml+
        allocationHtml+'</li>';
    }).join('')+'</ul>';
  }

  function splitMealIngredients(recipe,items){
    const recipeItems=recipe?.food_recipe_ingredients||recipe?.ingredients||[];
    const remaining=new Map();
    const key=item=>normalizedIngredient(ingredientName(item),item?.unit)+'|'+String(item?.unit||'').trim().toLocaleLowerCase('de-DE');
    recipeItems.forEach(item=>remaining.set(key(item),(remaining.get(key(item))||0)+1));
    const prep=[];
    const fresh=[];
    (items||[]).forEach(item=>{
      const itemKey=key(item);
      const left=remaining.get(itemKey)||0;
      if(left>0){
        prep.push(item);
        remaining.set(itemKey,left-1);
      }else{
        fresh.push(item);
      }
    });
    return {prep,fresh};
  }

  function recipePresentation(recipe,expanded,itemsOverride=null,servingsOverride=null,ingredientGroups=null,allocationMap=null,preparedMeal=null){
    const items=itemsOverride||(recipe.food_recipe_ingredients||recipe.ingredients||[]);
    const servings=Math.max(1,Number(servingsOverride??recipe.servings)||1);
    const instructions=recipeInstructions(recipe);
    const nutrition=[
      num(recipe.calories_kcal_per_serving)!==null?Math.round(Number(recipe.calories_kcal_per_serving))+' kcal':null,
      num(recipe.protein_g_per_serving)!==null?fmtQty(recipe.protein_g_per_serving,'g')+' Protein':null
    ].filter(Boolean).join(' · ');
    const ingredientBlocks=preparedMeal?preparedIngredientListMarkup(preparedMeal):'<div class="food-recipe-detail-block-v572"><strong>Zutaten für '+esc(portionLabel(servings))+'</strong>'+ingredientListMarkup(items,allocationMap)+'</div>';
    const details=expanded
      ?'<div class="food-recipe-details-v572">'+ingredientBlocks+'<div class="food-recipe-detail-block-v572"><strong>Zubereitung</strong>'+(instructions.length?'<ol>'+instructions.map(step=>'<li>'+esc(step)+'</li>').join('')+'</ol>':'<p>Noch keine Zubereitung hinterlegt.</p>')+'</div>'+(recipe.description?'<p class="food-recipe-note-v572">'+esc(recipe.description)+'</p>':'')+'</div>'
      :'';
    const meta=[portionLabel(servings),recipe.prep_minutes?recipe.prep_minutes+' Min.':null,nutrition||null].filter(Boolean).join(' · ');
    return {details,meta};
  }

  const normalizedRecipeRating=value=>{
    const rating=Number(value);
    return Number.isInteger(rating)&&rating>=1&&rating<=5?rating:null;
  };

  function recipeRatingControl(recipe){
    const rating=normalizedRecipeRating(recipe?.rating);
    const id=String(recipe?.id||'');
    const stars=[1,2,3,4,5].map(value=>{
      const active=rating!==null&&value<=rating;
      const pressed=rating===value;
      const label=value===1?'1 Stern':value+' Sterne';
      return '<button type="button" class="'+(active?'is-active':'')+'" data-food-rate-recipe="'+esc(id)+'" data-food-rating="'+value+'" aria-label="'+label+'" aria-pressed="'+pressed+'" title="'+label+'">★</button>';
    }).join('');
    const status=rating===null?'Unbewertet':rating+' von 5 Sternen';
    return '<div class="food-recipe-rating-v636" role="group" aria-label="Bewertung für '+esc(recipe?.title||'Rezept')+'"><span>'+esc(status)+'</span><div class="food-recipe-stars-v636">'+stars+'</div></div>';
  }

  async function setRecipeRating(recipeId,value){
    if(!sourceIsReal('recipes'))throw new Error('Die Rezeptdaten sind gerade nicht sicher mit der Cloud synchronisiert. Bitte zuerst „Erneut laden“ verwenden.');
    const recipe=(state?.recipes||[]).find(item=>String(item.id)===String(recipeId));
    if(!recipe)throw new Error('Rezept nicht gefunden.');
    const requested=value===null?null:normalizedRecipeRating(value);
    if(value!==null&&requested===null)throw new Error('Die Bewertung muss zwischen 1 und 5 Sternen liegen.');
    const current=normalizedRecipeRating(recipe.rating);
    const next=requested!==null&&current===requested?null:requested;
    const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
    const result=await withTimeout(
      supabase.from('food_recipes')
        .update({rating:next,rating_updated_at:next===null?null:new Date().toISOString()})
        .eq('id',recipeId)
        .select('id,rating,rating_updated_at')
        .single(),
      'Rezeptbewertung speichern',
      8000
    );
    if(result?.error)throw result.error;
    recipe.rating=result.data?.rating??null;
    recipe.rating_updated_at=result.data?.rating_updated_at??null;
    sourceState.recipes='cloud';
    renderState();
    return result.data;
  }

  function mealPrepSource(meal){
    if(!meal?.source_meal_id)return null;
    return (state?.meals||[]).find(item=>String(item.id)===String(meal.source_meal_id))||null;
  }

  function mealPrepSourceLabel(meal){
    const source=mealPrepSource(meal);
    if(!source?.meal_date)return '';
    const weekday=new Intl.DateTimeFormat('de-DE',{weekday:'long',timeZone:'Europe/Berlin'}).format(new Date(source.meal_date+'T12:00:00'));
    const suffix=source.meal_type==='dinner'?'abend':source.meal_type==='lunch'?'mittag':source.meal_type==='breakfast'?'morgen':'';
    return weekday+suffix;
  }

  function noteSentences(note){
    return String(note||'').trim().split(/[.!?]+(?:\s+|$)|\n+/).map(part=>part.trim()).filter(Boolean);
  }

  function freezeInstruction(note){
    const sentence=noteSentences(note).find(part=>/einfrier/i.test(part));
    if(!sentence)return '';
    const quantities=[...sentence.matchAll(/(\d+(?:[.,]\d+)?)\s*(g|kg|Portion(?:en)?|Stück)/gi)];
    const last=quantities.length?quantities[quantities.length-1]:null;
    if(last)return last[1]+' '+last[2]+' direkt nach der Zubereitung einfrieren';
    return sentence.replace(/^Meal Prep:\s*/i,'').replace(/[.!?]+$/,'');
  }

  function visibleMealNote(note,{suppressGenericMealPrep=false,completed=false}={}){
    // Ein alter Auftau-Auftrag ist nach dem Verbrauch kein Mahlzeitenkommentar.
    if(completed&&/^\s*Auftauen\s*:/i.test(String(note||'')))return '';
    const parts=noteSentences(note)
      .filter(part=>!/einfrier/i.test(part)&&(!completed||!/auftau/i.test(part)))
      .map(part=>part.replace(/^Meal Prep:\s*/i,'').trim())
      .filter(Boolean);
    const text=parts.join(' ');
    if(suppressGenericMealPrep&&/^Meal Prep vom .+bereits zubereitet\.?$/i.test(String(note||'').trim()))return '';
    return text;
  }

  function freezeInstructionMarkup(note){
    const text=freezeInstruction(note);
    return text?'<div class="food-freeze-hint-v664"><div><strong>Einfrieren</strong><small>'+esc(text)+'</small></div></div>':'';
  }

  function plannedThawTasks(){
    if(plannedThawCacheState===state&&plannedThawCache)return plannedThawCache;

    const today=todayIso();
    const meals=[...(state?.meals||[])]
      .filter(meal=>
        normalizedStatus(meal.status)==='planned'&&
        !meal.inventory_booked_at&&
        String(meal.meal_date||'')>=today
      )
      .sort((a,b)=>String(a.meal_date||'').localeCompare(String(b.meal_date||''))||Number(a.sort_order||0)-Number(b.sort_order||0));
    const allocationMaps=plannedFamilyAllocationMaps();
    const tasks=[];

    for(const target of meals){
      const map=allocationMaps.get(String(target.id||''))||new Map();
      for(const item of (target.ingredients||[])){
        const allocation=item?.id?map.get(String(item.id)):null;
        const frozen=(allocation?.allocations||[]).filter(part=>part.frozen===true);
        if(!frozen.length)continue;
        const quantity=frozen.reduce((sum,part)=>sum+(Number(part.quantity)||0),0);
        if(quantity<=0)continue;
        tasks.push({
          targetMealId:String(target.id||''),
          ingredientId:String(item.id||''),
          targetDate:String(target.meal_date||''),
          dueDate:String(target.meal_date||'')===today?today:plusDays(String(target.meal_date||''),-1),
          targetType:target.meal_type,
          targetTitle:target.title||'Mahlzeit',
          ingredient:ingredientName(item),
          quantity,
          unit:item.unit,
          thawStartedAt:item.thaw_started_at||null
        });
      }
    }

    plannedThawCacheState=state;
    plannedThawCache=tasks;
    return tasks;
  }

  function thawReminderMarkupForMeal(){
    return '';
  }

  function thawTodayAlertsMarkup(){
    const today=todayIso();
    const tomorrow=plusDays(today,1);
    const hour=new Date().getHours();
    const tasks=plannedThawTasks().filter(task=>task.dueDate===today);
    if(!tasks.length)return '';

    const timing=task=>{
      if(task.thawStartedAt){
        const date=new Date(task.thawStartedAt);
        const time=Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat('de-DE',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}).format(date);
        return time?'Auftauen läuft · seit '+time+' Uhr':'Auftauen läuft';
      }
      if(task.targetDate===today){
        if(task.targetType==='dinner'){
          if(hour<11)return 'Heute Vormittag in den Kühlschrank legen';
          if(hour<14)return 'Jetzt in den Kühlschrank legen · spätestens mittags';
          return 'Jetzt in den Kühlschrank legen';
        }
        return 'Jetzt in den Kühlschrank legen';
      }
      if(task.targetDate===tomorrow){
        return task.targetType==='dinner'
          ?'Heute Abend in den Kühlschrank legen · spätestens morgen früh'
          :'Heute Abend in den Kühlschrank legen';
      }
      return 'Heute Abend in den Kühlschrank legen';
    };

    const targetLabel=task=>{
      const meal=MEAL_LABELS[task.targetType]||task.targetType||'Mahlzeit';
      if(task.targetDate===today)return 'heute · '+meal;
      if(task.targetDate===tomorrow)return 'morgen · '+meal;
      return fmtDate(task.targetDate)+' · '+meal;
    };

    const rows=tasks.map(task=>{
      const thawing=Boolean(task.thawStartedAt);
      return '<div class="food-thaw-entry-v739 '+(thawing?'is-thawing-v739':'is-frozen-v739')+'">'
        +'<div class="food-thaw-copy-v739"><b>'+esc(timing(task))+'</b><span>'+esc(fmtQty(task.quantity,task.unit)+' '+task.ingredient+' · für '+targetLabel(task)+' „'+task.targetTitle+'“')+'</span></div>'
        +'<button type="button" class="food-thaw-thermometer-button-v740 '+(thawing?'is-active-v740':'')+'" data-food-thaw-start="'+esc(task.ingredientId)+'" aria-pressed="'+thawing+'" aria-label="'+(thawing?'Auftauen läuft':'Auftauen starten')+'" title="'+(thawing?'Auftauen läuft':'Auftauen starten')+'" '+(thawing?'disabled':'')+'>'
          +'<span class="food-thaw-thermometer-v740" aria-hidden="true"><i></i></span>'
        +'</button>'
        +'</div>';
    }).join('');

    return '<section class="food-thaw-today-v736 food-thaw-panel-v739"><strong>Auftauen · heute dran</strong>'+rows+'</section>';
  }

  async function startThawing(ingredientId){
    if(!sourceIsReal('meals'))throw new Error('Die Mahlzeitdaten sind gerade nicht sicher mit der Cloud synchronisiert.');
    const id=String(ingredientId||'');
    if(!id)throw new Error('Auftau-Zutat nicht gefunden.');

    let localItem=null;
    for(const meal of state?.meals||[]){
      const found=(meal.ingredients||[]).find(item=>String(item.id||'')===id);
      if(found){localItem=found;break;}
    }
    if(!localItem)throw new Error('Auftau-Zutat nicht gefunden.');
    if(localItem.thaw_started_at)return localItem.thaw_started_at;

    const startedAt=new Date().toISOString();
    const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
    const result=await withTimeout(
      supabase.from('food_meal_ingredients')
        .update({thaw_started_at:startedAt})
        .eq('id',id)
        .select('id,thaw_started_at')
        .single(),
      'Auftaustatus speichern',
      8000
    );
    if(result?.error)throw result.error;

    localItem.thaw_started_at=result.data?.thaw_started_at||startedAt;
    plannedThawCacheState=null;
    plannedThawCache=null;
    sourceState.meals='cloud';
    renderState();
    return localItem.thaw_started_at;
  }

  function mealPlanMeta(meal){
    const prepared=Math.max(.01,Number(meal.prepared_servings)||1);
    const eaten=Math.max(.01,Number(meal.eaten_servings)||prepared);
    const rest=Math.max(0,prepared-eaten);
    const isMealPrep=Boolean(meal.leftover_id||meal.source_meal_id);
    if(isMealPrep)return portionLabel(eaten);
    if(rest>0)return portionLabel(prepared)+' · '+portionLabel(rest)+' Meal Prep';
    return portionLabel(eaten);
  }

  // V772: Einnahme und Vorratsbuchung sind von Rezept und Mahlzeiten-Abschluss unabhängig.
  function creatineStockChoices(){
    return (state?.inventory||[]).filter(item=>
      item.is_active!==false &&
      Number(item.quantity)>=4 &&
      String(item.unit||'').toLowerCase()==='g' &&
      /^esn .* (?:creatine|kreatin).*sticks/i.test(String(item.name||''))
    ).sort((a,b)=>
      (Number(Boolean(b.opened))-Number(Boolean(a.opened))) ||
      String(a.name||'').localeCompare(String(b.name||''),'de')
    );
  }

  function dailyCreatineReminderMarkup(meal){
    const date=String(meal?.meal_date||'');
    if(String(meal?.meal_type||'')!=='breakfast'||date<'2026-10-10')return '';

    const choices=creatineStockChoices();
    const first=choices[0]||null;
    const variant=first?.variant_label||'ESN';
    const isPreview=date==='2026-10-10';
    const intake=(state?.intakes||[]).find(row=>row.intake_date===date && row.confirmed_at);
    const main=(text,description)=>'<div class="food-creatine-main-v773"><strong>'+esc(text)+'</strong><span>'+esc(description)+'</span></div>';

    // 10.10. wurde vom Nutzer bereits genommen und der Bestand manuell korrigiert.
    // Den Button nur zur Layoutvorschau zeigen, aber NIE erneut buchen.
    if(isPreview){
      return '<div class="food-creatine-reminder-v768 is-preview-v773" role="note">'
        +main('💪 Kreatin','1 Stick · '+variant)
        +'<button type="button" class="food-creatine-confirm-v772 is-preview-button-v773" disabled title="Heute bereits genommen und im Vorrat manuell verbucht">✓ Eingenommen</button>'
        +'<small class="food-creatine-status-v773">Heute schon genommen · nur Vorschau, keine Abbuchung</small>'
        +'</div>';
    }

    if(intake){
      const selected=String(intake.variant_label||intake.inventory_name||'ESN').trim();
      return '<div class="food-creatine-reminder-v768 is-confirmed-v772" role="status">'
        +main('💪 Kreatin','1 Stick · '+selected+' · 4 g gebucht')
        +'<span class="food-creatine-done-v773">✓ Eingenommen</span>'
        +'</div>';
    }

    const ready=sourceState.intakes==='cloud'&&sourceState.inventory==='cloud';
    const reached=date<=todayIso();
    const selection=ready&&reached&&choices.length>1
      ?'<label class="food-creatine-choose-v772">Sorte <select data-food-creatine-choice>'
        +choices.map(stock=>'<option value="'+esc(stock.id)+'">'+esc((stock.variant_label||stock.name)+' · '+Math.floor(Number(stock.quantity)/4)+' Sticks')+'</option>').join('')
        +'</select></label>'
      :'';
    const action=ready&&reached&&first
      ?'<button type="button" class="food-creatine-confirm-v772" data-food-creatine-confirm="'+esc(date)+'" data-food-creatine-inventory="'+esc(first.id)+'" title="Nur nach Einnahme bestätigen: 4 g aus Vorrat buchen">✓ Eingenommen</button>'
      :'<span class="food-creatine-pending-v773">'+esc(!ready?'Cloud prüfen':!reached?'Noch nicht fällig':'Vorrat leer')+'</span>';

    return '<div class="food-creatine-reminder-v768" role="note">'
      +main('💪 Kreatin',first?'1 Stick · '+variant:'1 Stick · kein Vorrat')
      +action+selection+'</div>';
  }

  async function confirmCreatineIntake(date,inventoryId){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))throw new Error('Ungültiges Tagesdatum');
    if(date<'2026-10-11'||date>todayIso())throw new Error('Einnahme ist für diesen Tag noch nicht möglich');
    if(sourceState.intakes!=='cloud'||sourceState.inventory!=='cloud')throw new Error('Einnahme und Vorrat müssen mit der Cloud synchronisiert sein');
    const supabase=client();
    if(!supabase)throw new Error('Cloud-Verbindung fehlt');
    const res=await withTimeout(supabase.rpc('confirm_daily_creatine_intake',{
      p_intake_date:date,p_inventory_id:inventoryId
    }),'Kreatin-Buchung',15000);
    if(res?.error)throw res.error;
    await mutate(()=>res.data);
    return res.data;
  }

  function mealCard(meal){
    const status=normalizedStatus(meal.status);
    const expanded=expandedMeals.has(String(meal.id));
    const recipe=meal.recipe_id?(state?.recipes||[]).find(item=>String(item.id)===String(meal.recipe_id)):null;
    const sourceMeal=mealPrepSource(meal);
    const isMealPrep=Boolean(meal.leftover_id||meal.source_meal_id);
    const sourceLabel=mealPrepSourceLabel(meal);
    const mealPrepReady=Boolean(meal.leftover_id)||normalizedStatus(sourceMeal?.status)==='completed';
    const action=status==='completed'
      ?''
      :'<button type="button" class="food-action-v544 food-meal-complete-v573" data-food-complete="'+esc(meal.id)+'">'+(isMealPrep?'Als gegessen markieren':'Als zubereitet markieren')+'</button>';
    const statusMeta=status==='completed'
      ?(isMealPrep?fmtPreparedAt(meal.prepared_at).replace('Zubereitet am ','Gegessen am '):fmtPreparedAt(meal.prepared_at))
      :'Geplant';

    if(isMealPrep){
      const title=meal.title||recipe?.title||'Meal Prep';
      const extras=meal.ingredients||[];
      const detailNote=visibleMealNote(meal.note,{suppressGenericMealPrep:true,completed:status==='completed'});
      const extrasSummary=extras.length
        ?extras.map(item=>fmtQty(item.quantity,item.unit)+' '+ingredientName(item)).join(' · ')
        :'';
      const details=expanded
        ?'<div class="food-recipe-details-v572">'
          +(detailNote?'<p class="food-recipe-note-v572">'+esc(detailNote)+'</p>':'')
          +(extras.length?(status==='completed'?preparedIngredientListMarkup(meal):'<div class="food-recipe-detail-block-v572"><strong>Frisch dazu an diesem Tag</strong>'+ingredientListMarkup(extras,plannedFamilyAllocationMaps().get(String(meal.id))||null)+'</div>'):'')
        +'</div>'
        :'';
      return '<article class="food-recipe-card-v544 food-leftover-meal-v632 '+(expanded?'is-expanded-v572':'')+'" data-food-meal-card="'+esc(meal.id)+'">'
        +'<button type="button" class="food-recipe-toggle-v572" data-food-meal-toggle="'+esc(meal.id)+'" aria-expanded="'+expanded+'">'
          +'<span><small class="food-recipe-type-v544">'+esc(String(MEAL_LABELS[meal.meal_type]||meal.meal_type||'Mahlzeit').toLocaleUpperCase('de-DE'))+' · MEAL PREP'+(sourceLabel?' · vom '+esc(sourceLabel):'')+'</small><h4>'+esc(title)+'</h4><em>'+esc(portionLabel(meal.eaten_servings||meal.prepared_servings||1)+' · '+(mealPrepReady?'bereits vorbereitet':'wird vorher vorbereitet'))+'</em>'+(extrasSummary?'<small class="food-meal-extras-summary-v703">'+esc(extrasSummary)+'</small>':'')+'</span>'
          +'<b aria-hidden="true">'+(expanded?'−':'+')+'</b>'
        +'</button>'
        +dailyCreatineReminderMarkup(meal)
        +details
        +(status==='completed'?'<p class="food-meal-plan-note-v581">'+esc(statusMeta)+'</p>':'')
        +action
        +'</article>';
    }

    if(recipe){
      const presentationRecipe=num(meal.calories_kcal_per_serving_override)!==null?{...recipe,calories_kcal_per_serving:meal.calories_kcal_per_serving_override}:recipe;
      const allocationMap=plannedFamilyAllocationMaps().get(String(meal.id))||null;
      const view=recipePresentation(presentationRecipe,expanded,meal.ingredients||[],meal.prepared_servings,null,allocationMap,status==='completed'?meal:null);
      const note=visibleMealNote(meal.note,{completed:status==='completed'});
      const planNote=expanded&&note?'<p class="food-recipe-note-v572">'+esc(note)+'</p>':'';
      const freezeHint=status==='completed'?'':freezeInstructionMarkup(meal.note);
      const quantityAction=status==='completed'
        ?''
        :'<button type="button" class="food-action-v544 compact" data-food-edit-planned-meal="'+esc(meal.id)+'">Zutaten &amp; Mengen ändern</button>';
      return '<article class="food-recipe-card-v544 '+(expanded?'is-expanded-v572':'')+'" data-food-meal-card="'+esc(meal.id)+'">'
        +'<button type="button" class="food-recipe-toggle-v572" data-food-meal-toggle="'+esc(meal.id)+'" aria-expanded="'+expanded+'">'
          +'<span><small class="food-recipe-type-v544">'+esc(MEAL_LABELS[meal.meal_type]||meal.meal_type)+'</small><h4>'+esc(recipe.title)+'</h4><em>'+esc(view.meta)+'</em></span>'
          +'<b aria-hidden="true">'+(expanded?'−':'+')+'</b>'
        +'</button>'
        +dailyCreatineReminderMarkup(meal)
        +freezeHint+view.details+planNote
        +'<p class="food-meal-plan-note-v581">'+esc(mealPlanMeta(meal)+' · '+statusMeta)+'</p>'
        +(status==='completed'?'':'<div class="food-meal-plan-actions-v630">'+quantityAction+action+'</div>')
        +'</article>';
    }

    const items=meal.ingredients||[];
    const portionMeta=mealPlanMeta(meal);
    const editAction=status==='completed'
      ?''
      :'<button type="button" class="food-action-v544 compact" data-food-edit-free-meal="'+esc(meal.id)+'">Zutaten bearbeiten</button>';
    const note=visibleMealNote(meal.note,{completed:status==='completed'});
    const details=expanded
      ?'<div class="food-recipe-details-v572">'
        +(items.length?(status==='completed'?preparedIngredientListMarkup(meal):'<div class="food-recipe-detail-block-v572"><strong>Zutaten</strong>'+ingredientListMarkup(items,plannedFamilyAllocationMaps().get(String(meal.id))||null)+'</div>'):'')
        +(status==='completed'?'':freezeInstructionMarkup(meal.note))
        +(note?'<p class="food-recipe-note-v572">'+esc(note)+'</p>':'')
        +(!items.length&&!note&&!freezeInstruction(meal.note)?'<p class="food-recipe-note-v572">Für diese Mahlzeit sind keine weiteren Details hinterlegt.</p>':'')
        +(expanded&&editAction?'<div class="food-meal-edit-actions-v618">'+editAction+'</div>':'')
        +'</div>'
      :'';
    return '<article class="food-meal-card-v544 '+(expanded?'is-expanded-v573':'')+' status-'+status+'" data-food-meal-card="'+esc(meal.id)+'">'
      +'<button type="button" class="food-meal-toggle-v573" data-food-meal-toggle="'+esc(meal.id)+'" aria-expanded="'+expanded+'">'
        +'<span><small class="food-recipe-type-v544">'+esc(MEAL_LABELS[meal.meal_type]||meal.meal_type)+'</small><h4>'+esc(meal.title)+'</h4><em>'+esc(portionMeta+' · '+statusMeta)+'</em></span>'
        +'<b aria-hidden="true">'+(expanded?'−':'+')+'</b>'
      +'</button>'
      +dailyCreatineReminderMarkup(meal)
      +details+action
      +'</article>';
  }

  function todayView(data){
    const meals=data.meals.filter(meal=>meal.meal_date===todayIso()).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
    return '<div class="food-section-head-v544"><div><span>HEUTE</span><h3>Dein Tagesplan</h3></div><small>'+meals.length+' Mahlzeiten</small></div>'+
      '<div class="food-day-summary-v778" data-food-day-summary-today aria-label="Kalorien und Protein des Tages">'+
        '<span class="food-day-summary-title-v778" data-food-day-summary-label>Tag gesamt</span>'+
        '<strong class="food-day-summary-value-v778" data-food-day-kcal>… kcal</strong>'+
        '<span class="food-day-summary-separator-v778" aria-hidden="true">·</span>'+
        '<strong class="food-day-summary-value-v778" data-food-day-protein>… g Protein</strong>'+
        '<small class="food-day-summary-note-v778" data-food-day-summary-note></small>'+
      '</div>'+
      thawTodayAlertsMarkup()+
      (meals.length?'<div class="food-meal-list-v544">'+meals.map(mealCard).join('')+'</div>':'<div class="food-empty-card-v544"><h4>Heute ist noch nichts eingeplant.</h4><p>Ein Rezept kann direkt aus dem Rezeptgarten eingeplant werden.</p><button type="button" class="food-action-v544" data-food-jump="recipes">Rezepte öffnen</button></div>');
  }

  function planView(data){
    const horizon=planningHorizonIso();
    const future=data.meals.filter(meal=>meal.meal_date>todayIso()&&meal.meal_date<=horizon).sort((a,b)=>(a.meal_date+a.sort_order).localeCompare(b.meal_date+b.sort_order));
    const groups=[];
    future.forEach(meal=>{let group=groups.find(item=>item.date===meal.meal_date);if(!group){group={date:meal.meal_date,meals:[]};groups.push(group);}group.meals.push(meal);});
    const priority=data.inventory.filter(item=>item.is_active!==false&&item.use_priority==='tomorrow');
    const assignedLeftoverIds=new Set((data.meals||[]).filter(meal=>meal.meal_date>=todayIso()&&meal.leftover_id).map(meal=>String(meal.leftover_id)));
    const leftovers=(data.leftovers||[]).filter(item=>Number(item.available_servings)>0&&!assignedLeftoverIds.has(String(item.id)));
    const leftoverBlock=leftovers.length
      ?'<section class="food-leftovers-v572"><div class="food-leftovers-head-v572"><strong>Restportionen</strong><span>'+leftovers.length+' verfügbar</span></div><div class="food-leftovers-grid-v572">'+leftovers.map(item=>{const recipe=item.food_recipes||{};return '<article><div><small>'+esc(RECIPE_GROUP_LABELS[recipe.meal_type]||MEAL_LABELS[recipe.meal_type]||'RESTE')+'</small><strong>'+esc(recipe.title||'Restportion')+'</strong><span>'+esc(portionLabel(item.available_servings))+' verfügbar</span></div><button type="button" class="food-action-v544 compact" data-food-schedule-leftover="'+esc(item.id)+'">Einplanen</button></article>';}).join('')+'</div></section>'
      :'';
    return '<div class="food-section-head-v544"><div><span>PLAN</span><h3>Geplant bis '+esc(fmtDate(horizon))+'</h3></div><small>Heute bleibt bei Heute</small></div>'+
      '<div class="food-priority-strip-v544"><strong>Als Nächstes im Blick</strong><span>'+esc(priority.map(item=>item.name).join(' · ')||'Noch keine Prioritäten')+'</span></div>'+
      leftoverBlock+
      (groups.length?'<div class="food-plan-days-v685">'+groups.map(group=>'<details class="food-day-group-v544 food-plan-day-v685" data-food-plan-day="'+esc(group.date)+'" '+(expandedPlanDays.has(group.date)?'open':'')+'><summary class="food-day-label-v544"><span class="food-plan-day-title-v685"><strong>'+esc(fmtDay(group.date))+'</strong><em>'+esc(fmtDate(group.date))+'</em><span class="food-plan-day-summary-v778" data-food-day-summary-plan>Kalorien &amp; Protein werden berechnet …</span></span><b class="food-plan-day-count-v685">'+esc(group.meals.length)+'</b></summary><div class="food-plan-day-body-v685"><div class="food-meal-list-v544">'+group.meals.map(mealCard).join('')+'</div></div></details>').join('')+'</div>':'<div class="food-empty-card-v544"><h4>Noch kein weiterer Tag geplant.</h4><p>Wähle bei einem Rezept „Einplanen“, dann landet es hier – mit dem Vorrat abgeglichen.</p><button type="button" class="food-action-v544" data-food-jump="recipes">Rezept einplanen</button></div>');
  }

  function historyView(data){
    const past=data.meals
      .filter(meal=>meal.meal_date<todayIso())
      .sort((a,b)=>b.meal_date.localeCompare(a.meal_date)||(a.sort_order||0)-(b.sort_order||0));
    const groups=[];
    past.forEach(meal=>{
      let group=groups.find(item=>item.date===meal.meal_date);
      if(!group){group={date:meal.meal_date,meals:[]};groups.push(group);}
      group.meals.push(meal);
    });
    return '<div class="food-section-head-v544"><div><span>HISTORY</span><h3>Vergangene Tage</h3></div><small>'+past.length+' Mahlzeiten</small></div>'+
      (groups.length
        ?groups.map(group=>'<section class="food-day-group-v544"><div class="food-day-label-v544"><strong>'+esc(fmtDay(group.date))+'</strong><span>'+esc(fmtDate(group.date))+'</span></div><div class="food-meal-list-v544">'+group.meals.map(mealCard).join('')+'</div></section>').join('')
        :'<div class="food-empty-card-v544"><h4>Noch keine vergangenen Mahlzeiten.</h4><p>Sobald ein Tag vorbei ist, bleibt er hier weiterhin abrufbar.</p></div>');
  }

  function inventoryNoteHtml(note){
    const parts=String(note||'').split(/\s*·\s*/).map(part=>part.trim()).filter(Boolean);
    if(!parts.length)return '';
    return '<div class="food-stock-meta-v629">'+parts.map(part=>{
      const wide=/^(Nährwerte|Zutaten:|nach dem Öffnen|Herstellerportion)/i.test(part);
      return '<span class="'+(wide?'is-wide':'')+'">'+esc(part)+'</span>';
    }).join('')+'</div>';
  }

  const frozenStorageLocation=value=>/gefrier|tiefkühl|freezer|frozen/i.test(String(value||''));
  const lotQuantityForInventory=(lot,item)=>{
    const target=String(item?.unit||'').trim();
    const packUnit=String(lot?.package_unit||'').trim();
    const openedUnit=String(lot?.opened_remaining_unit||packUnit).trim();
    let total=0;
    let known=false;
    const packageQuantity=num(lot?.package_quantity);
    const unopened=Math.max(0,Number(lot?.unopened_packages)||0);
    if(packageQuantity!==null&&Number.isFinite(packageQuantity)&&unopened>0&&packUnit===target){
      total+=packageQuantity*unopened;
      known=true;
    }
    const openedQuantity=num(lot?.opened_remaining_quantity);
    if(openedQuantity!==null&&Number.isFinite(openedQuantity)&&openedQuantity>0&&openedUnit===target){
      total+=openedQuantity;
      known=true;
    }
    return known?total:null;
  };

  function inventoryStorageSlices(item,data=state){
    const lots=(data?.lots||[]).filter(lot=>String(lot.inventory_id)===String(item.id));
    if(!lots.length)return [];
    const grouped=new Map();
    for(const lot of lots){
      const quantity=lotQuantityForInventory(lot,item);
      if(quantity===null||quantity<=0)continue;
      const frozen=frozenStorageLocation(lot.storage_location);
      const key=frozen?'frozen':'fresh';
      grouped.set(key,(grouped.get(key)||0)+quantity);
    }
    const slices=[];
    if((grouped.get('fresh')||0)>0)slices.push({kind:'fresh',quantity:grouped.get('fresh'),label:'frisch'});
    if((grouped.get('frozen')||0)>0)slices.push({kind:'frozen',quantity:grouped.get('frozen'),label:'eingefroren'});
    const aggregate=num(item.quantity);
    const explained=slices.reduce((sum,slice)=>sum+slice.quantity,0);
    if(aggregate!==null&&Math.abs(explained-aggregate)>.05)return [];
    return slices;
  }

  function inventoryMhdMarkup(item,data=state){
    const lots=(data?.lots||[]).filter(lot=>String(lot.inventory_id)===String(item.id));
    const activeLots=lots.filter(lot=>{
      const unopened=Math.max(0,Number(lot.unopened_packages)||0);
      const opened=Math.max(0,Number(lot.opened_packages)||0);
      const openedRemaining=num(lot.opened_remaining_quantity);
      return unopened>0||opened>0||(openedRemaining!==null&&openedRemaining>0);
    });
    const dates=[...new Set(activeLots.map(lot=>String(lot.best_before_date||'').trim()).filter(Boolean))].sort();
    if(!dates.length)return '';
    const label=dates.length>1?'Nächstes MHD':'MHD';
    return '<span class="food-stock-mhd-v707">'+label+' '+esc(fmtDate(dates[0]))+'</span>';
  }

  function inventoryCurrentProductMarkup(item,data=state){
    const products=(data?.products||[]).filter(product=>String(product.inventory_id||'')===String(item?.id||''));
    const productsById=new Map((data?.products||[]).map(product=>[String(product.id||''),product]));
    const lots=(data?.lots||[])
      .filter(lot=>String(lot.inventory_id||'')===String(item?.id||''))
      .filter(lot=>Math.max(0,Number(lot.unopened_packages)||0)>0||Math.max(0,Number(lot.opened_remaining_quantity)||0)>0)
      .sort((a,b)=>{
        const fa=frozenStorageLocation(a.storage_location)?1:0;
        const fb=frozenStorageLocation(b.storage_location)?1:0;
        if(fa!==fb)return fa-fb;
        return String(a.best_before_date||'9999-12-31').localeCompare(String(b.best_before_date||'9999-12-31'))||
          String(a.purchased_on||'9999-12-31').localeCompare(String(b.purchased_on||'9999-12-31'))||
          String(a.created_at||'').localeCompare(String(b.created_at||''));
      });

    const productLabel=product=>product
      ?[product.brand,product.product_name,product.variant].filter(Boolean).join(' · ')
      :'Produkt nicht genauer erfasst';

    const groupKey=lot=>{
      const frozen=frozenStorageLocation(lot.storage_location);
      return String(lot.product_id||'unknown')+'|'+(frozen?'frozen':'fresh');
    };
    const groups=new Map();
    let tracked=0;

    for(const lot of lots){
      const quantity=Math.max(0,Number(lotQuantityForInventory(lot,item))||0);
      tracked+=quantity;
      const key=groupKey(lot);
      if(!groups.has(key)){
        groups.set(key,{
          product:productsById.get(String(lot.product_id||''))||null,
          frozen:frozenStorageLocation(lot.storage_location),
          opened:new Map(),
          unopened:new Map(),
          quantity:0
        });
      }
      const group=groups.get(key);
      group.quantity+=quantity;

      const opened=Math.max(0,Number(lot.opened_remaining_quantity)||0);
      const openedUnit=String(lot.opened_remaining_unit||lot.package_unit||item.unit||'').trim();
      if(opened>0&&openedUnit){
        group.opened.set(openedUnit,(group.opened.get(openedUnit)||0)+opened);
      }

      const unopened=Math.max(0,Number(lot.unopened_packages)||0);
      const packQty=Math.max(0,Number(lot.package_quantity)||0);
      const packUnit=String(lot.package_unit||item.unit||'').trim();
      if(unopened>0){
        const packKey=packQty+'|'+packUnit;
        const current=group.unopened.get(packKey)||{count:0,quantity:packQty,unit:packUnit};
        current.count+=unopened;
        group.unopened.set(packKey,current);
      }
    }

    const rows=[...groups.values()].map(group=>{
      const parts=[];
      for(const [unit,quantity] of group.opened){
        parts.push(unit==='Stück'
          ?fmtQty(quantity,unit)+' in angebrochener Packung'
          :fmtQty(quantity,unit)+' offen');
      }
      for(const pack of group.unopened.values()){
        parts.push(pack.quantity>0
          ?pack.count+' × '+fmtQty(pack.quantity,pack.unit)+' ungeöffnet'
          :pack.count+' '+(pack.count===1?'Packung':'Packungen')+' ungeöffnet');
      }
      return {
        label:productLabel(group.product),
        summary:parts.join(' + ')||fmtQty(group.quantity,item.unit),
        frozen:group.frozen
      };
    });

    const aggregate=Math.max(0,Number(item?.quantity)||0);
    const untracked=Math.max(0,aggregate-tracked);
    if(untracked>.05){
      rows.unshift({
        label:lots.length?'Älterer Bestand':(products.length===1?productLabel(products[0]):'Bestand'),
        summary:fmtQty(untracked,item.unit)+(lots.length?' · noch nicht einer Charge zugeordnet':' · ohne Chargenaufteilung'),
        frozen:false
      });
    }

    if(!rows.length&&aggregate>0){
      rows.push({
        label:products.length===1?productLabel(products[0]):'Bestand',
        summary:fmtQty(aggregate,item.unit)+' · ohne Chargenaufteilung',
        frozen:false
      });
    }
    if(!rows.length)return '';

    const html=rows.map(row=>
      '<div class="food-stock-product-row-v736 '+(row.frozen?'is-frozen-v736':'')+'"><span><b>'+esc(row.label)+'</b><small>'+esc(row.summary+(row.frozen?' · eingefroren':''))+'</small></span></div>'
    ).join('');
    return '<div class="food-stock-products-v736"><small>'+(rows.length===1?'Aktuelles Produkt':'Bestand nach Produkt / Charge')+'</small>'+html+'</div>';
  }

  function inventoryCard(item){
    const expanded=expandedInventory.has(String(item.id));
    const baseQuantity=(item.unit==='Zehe'||item.unit==='Knolle')?fmtQty(item.quantity,item.unit):fmtQty(item.quantity,item.unit);
    const pending=item.pending_weighing===true;
    const known=num(item.quantity);
    const empty=!pending&&known!==null&&known<=0;
    const quantity=pending
      ?((known!==null&&known>0)?baseQuantity+' + Einkauf noch abwiegen':'Einkauf noch abwiegen')
      :baseQuantity;
    const freezePlanned=!empty&&/einfrier/i.test(String(item.forecast_label||''));
    const forecast=!empty&&item.forecast_label
      ?(freezePlanned
        ?'<span class="food-freeze-plan-v664"><span>'+esc(item.forecast_label)+'</span></span>'
        :'<span class="food-forecast-v544">↳ '+esc(item.forecast_label)+'</span>')
      :'';
    const priority=!empty&&item.use_priority&&item.use_priority!=='later'?'<span class="food-priority-v544">'+esc(priorityLabel(item.use_priority))+'</span>':'';
    const weighing=pending?'<span class="food-weigh-pending-v625">⚖ Menge noch offen</span>':'';
    const tomorrowClass=!empty&&item.use_priority==='tomorrow'?' priority-tomorrow-v574':'';
    const freezePlanClass=freezePlanned?' has-freeze-plan-v664':'';
    const slices=empty?[]:inventoryStorageSlices(item);
    const showSlices=slices.length>1||slices.some(slice=>slice.kind==='frozen');
    const sliceMarkup=showSlices
      ?'<div class="food-stock-slices-v664" aria-label="Bestandsaufteilung">'+slices.map(slice=>
        '<div class="food-stock-slice-v664 is-'+slice.kind+'"><span>'+esc(slice.label)+'</span><strong>'+esc(fmtQty(slice.quantity,item.unit))+'</strong></div>'
      ).join('')+'</div>'
      :'';
    const weighAction=pending?'<button type="button" data-food-weigh="'+esc(item.id)+'">Jetzt abwiegen</button>':'';
    const status=empty?'leer':(item.opened?'angebrochen':'unangebrochen');
    const displayName=String(item.catalog_variant_label||item.variant_label||item.name||'Variante').trim();
    const details=item.note&&expanded?'<div class="food-stock-details-v697">'+inventoryNoteHtml(item.note)+'</div>':'';
    const mhd=empty?'':inventoryMhdMarkup(item);
    const currentProduct=empty?'':inventoryCurrentProductMarkup(item);
    const visualTone=empty?'empty':(item.tone==='priority'?'priority':'stock');
    const storageAction=!empty?'<button type="button" data-food-storage="'+esc(item.id)+'">Zustand &amp; Verwendung</button>':'';
    return '<article class="food-stock-card-v544 food-stock-variant-v736 tone-'+esc(visualTone)+tomorrowClass+freezePlanClass+(expanded?' is-details-open-v697':'')+'" data-food-stock-card="'+esc(item.id)+'"><div class="food-stock-top-v544"><div><h4>'+esc(displayName)+'</h4><strong>'+esc(quantity)+'</strong></div><span class="food-stock-open-v544 '+(empty?'is-empty-v629':(item.opened?'is-opened-v704':'is-unopened-v704'))+'">'+status+'</span></div>'+mhd+currentProduct+weighing+priority+forecast+sliceMarkup+details+'<div class="food-stock-actions-v544"><button type="button" data-food-adjust="'+esc(item.id)+'">Menge ändern</button>'+weighAction+storageAction+'</div></article>';
  }

  function garlicParts(data=state){
    const rows=(data?.inventory||[]).filter(item=>item.is_active!==false);
    const bulb=rows.find(item=>String(item.name||'').trim().toLocaleLowerCase('de-DE')==='knoblauchknollen'&&String(item.unit||'')==='Knolle')||null;
    const clove=rows.find(item=>String(item.name||'').trim().toLocaleLowerCase('de-DE')==='knoblauchzehen'&&String(item.unit||'')==='Zehe')||null;
    return {bulb,clove,bulbs:Math.max(0,num(bulb?.quantity)||0),cloves:Math.max(0,num(clove?.quantity)||0)};
  }

  function garlicCard(data){
    const garlic=garlicParts(data);
    if(!garlic.bulb&&!garlic.clove)return '';
    const quantity=fmtQty(garlic.bulbs,'Knolle')+' · '+fmtQty(garlic.cloves,'Zehe');
    const tone=garlic.bulbs>0||garlic.cloves>0?'stock':'empty';
    const open=garlic.bulb&&garlic.bulbs>0?'<button type="button" data-food-open-garlic="'+esc(garlic.bulb.id)+'">Knolle öffnen</button>':'';
    return '<article class="food-stock-card-v544 food-stock-variant-v736 tone-'+tone+'"><div class="food-stock-top-v544"><div><h4>Knollen &amp; Zehen</h4><strong>'+esc(quantity)+'</strong></div><span class="food-stock-open-v544">kombiniert</span></div><p>Ganze Knollen und lose Zehen gemeinsam verwaltet.</p><div class="food-stock-actions-v544"><button type="button" data-food-garlic-adjust>Menge ändern</button>'+open+'</div></article>';
  }

  function inventoryView(data){
    const collator=new Intl.Collator('de-DE',{sensitivity:'base',numeric:true});
    const productsByInventoryId=new Map();
    for(const product of (data.products||[])){
      if(!product?.inventory_id)continue;
      const key=String(product.inventory_id);
      if(!productsByInventoryId.has(key))productsByInventoryId.set(key,[]);
      productsByInventoryId.get(key).push(product);
    }

    const needle=String(inventorySearch||'').trim().toLocaleLowerCase('de-DE');
    const matchesSearch=item=>{
      if(!needle)return true;
      const products=productsByInventoryId.get(String(item.id))||[];
      const haystack=[
        item.name,item.family_name,item.variant_label,
        item.catalog_family_name,item.catalog_group_label,item.catalog_variant_label,item.note,
        ...products.flatMap(product=>[product.brand,product.product_name,product.variant,product.category,product.barcode])
      ].filter(Boolean).join(' ').toLocaleLowerCase('de-DE');
      return haystack.includes(needle);
    };

    const regular=(data.inventory||[]).filter(item=>{
      const name=String(item.name||'').trim().toLocaleLowerCase('de-DE');
      if(name==='knoblauchknollen'||name==='knoblauchzehen')return false;
      return matchesSearch(item);
    });
    const isActuallyEmpty=item=>{
      const quantity=num(item.quantity);
      return item.pending_weighing!==true&&quantity!==null&&quantity<=0;
    };
    const availableRows=regular.filter(item=>!isActuallyEmpty(item));
    const emptyRows=regular.filter(isActuallyEmpty);
    const isDrink=item=>(productsByInventoryId.get(String(item.id))||[]).some(product=>
      String(product?.category||'').trim().toLocaleLowerCase('de-DE')==='getränke'
    );
    const toCard=item=>({
      name:item.name||'',
      family:String(item.catalog_family_name||item.family_name||item.name||'').trim(),
      group:String(item.catalog_group_label||'').trim(),
      variant:String(item.catalog_variant_label||item.variant_label||item.name||'').trim(),
      display:String(item.catalog_variant_label||item.variant_label||item.name||'').trim(),
      html:inventoryCard(item)
    });

    const foodCards=availableRows.filter(item=>!isDrink(item)).map(toCard);
    const drinkCards=availableRows.filter(isDrink).map(toCard);
    const emptyCards=emptyRows.map(toCard).sort((a,b)=>collator.compare(String(a.family||''),String(b.family||''))||collator.compare(String(a.variant||''),String(b.variant||'')));

    const garlic=garlicCard(data);
    const garlicState=garlicParts(data);
    const garlicMatches=!needle||'knoblauch knollen zehen knolle zehe'.includes(needle);
    if(garlic&&garlicMatches&&(garlicState.bulbs>0||garlicState.cloves>0)){
      foodCards.push({name:'Knoblauch',family:'Knoblauch',group:'',variant:'Knollen & Zehen',display:'Knollen & Zehen',html:garlic});
    }

    const familyLayout=cards=>{
      const families=new Map();
      cards.forEach(card=>{
        const family=card.family||card.name||'Sonstiges';
        if(!families.has(family))families.set(family,[]);
        families.get(family).push(card);
      });
      const familyNames=[...families.keys()].sort((a,b)=>collator.compare(a,b));
      return familyNames.map(family=>{
        const children=families.get(family);
        const grouped=new Map();
        for(const child of children){
          const group=child.group||'';
          if(!grouped.has(group))grouped.set(group,[]);
          grouped.get(group).push(child);
        }
        const groups=[...grouped.keys()].sort((a,b)=>{
          if(!a&&!b)return 0;
          if(!a)return -1;
          if(!b)return 1;
          return collator.compare(a,b);
        });
        const body=groups.map(group=>{
          const variants=grouped.get(group).sort((a,b)=>collator.compare(String(a.variant||a.name||''),String(b.variant||b.name||'')));
          const grid='<div class="food-inventory-grid-v544">'+variants.map(item=>item.html).join('')+'</div>';
          return group
            ?'<div class="food-inventory-subgroup-v736"><div class="food-inventory-subgroup-head-v736"><strong>'+esc(group)+'</strong><span>'+variants.length+' '+(variants.length===1?'Variante':'Varianten')+'</span></div>'+grid+'</div>'
            :grid;
        }).join('');
        return '<section class="food-inventory-family-v694"><div class="food-inventory-family-head-v694"><strong>'+esc(family)+'</strong><span>'+children.length+' '+(children.length===1?'Variante':'Varianten')+'</span></div>'+body+'</section>';
      }).join('');
    };

    const group=(label,cards)=>cards.length
      ?'<section class="food-inventory-group-v690"><div class="food-inventory-group-head-v690"><strong>'+esc(label)+'</strong><span>'+cards.length+' '+(cards.length===1?'Variante':'Varianten')+'</span></div>'+familyLayout(cards)+'</section>'
      :'';
    const availableGroups=group('Lebensmittel',foodCards)+group('Getränke',drinkCards);
    const unavailable=emptyCards.length
      ?'<details class="food-inventory-empty-group-v705" data-food-empty-group '+((needle||unavailableInventoryOpen)?'open':'')+'><summary><span><strong>Nicht vorrätig</strong><small>Aktuell 0 Bestand</small></span><b>'+emptyCards.length+'</b></summary><div class="food-inventory-empty-body-v705">'+familyLayout(emptyCards)+'</div></details>'
      :'';
    const tools='<div class="food-inventory-tools-v697"><label><span>Vorrat durchsuchen</span><input type="search" data-food-inventory-search value="'+esc(inventorySearch)+'" placeholder="Familie, Variante, Marke, Produkt, Barcode …" autocomplete="off"></label><small>Sortierung: A–Z nach Familie, Gruppe und Variante</small></div>';
    const emptyCopy=needle?'Keine passenden Vorräte gefunden.':'Der Vorrat ist leer.';
    const content=availableGroups+unavailable;
    return '<div class="food-section-head-v544"><div><span>VORRAT</span><h3>Was wirklich da ist</h3></div><button type="button" class="food-action-v544 compact" data-food-add-inventory>+ Vorrat</button></div>'+tools+(content||'<div class="food-inventory-grid-v544"><div class="food-empty-card-v544"><h4>'+esc(emptyCopy)+'</h4></div></div>');
  }

  function deriveShopping(data){
    const needs=new Map();
    const inventoryByIdForShopping=new Map((data.inventory||[]).map(stock=>[stock.id,stock]));
    const productsByInventoryId=new Map((data.products||[]).filter(product=>product.inventory_id).map(product=>[product.inventory_id,product]));
    data.meals
      .filter(meal=>meal.meal_date>=recentPlanningStartIso()&&meal.meal_date<=planningHorizonIso()&&normalizedStatus(meal.status)==='planned')
      .forEach(meal=>(meal.ingredients||[]).forEach(item=>{
        const quantity=num(item.quantity);
        if(quantity===null||quantity<=0)return;
        const name=ingredientName(item);
        if(isNonShoppingIngredient(name))return;
        const unit=String(item.unit||'').trim();
        // The agreed standard is 118 g edible portion per banana (183 g with
        // peel - 65 g peel, measured on 04.10.2026), NOT 100 g: that is only
        // the unit of the nutrition label. Prefer the saved product standard.
        const linkedStock=inventoryByIdForShopping.get(item.inventory_id)||null;
        const bananaGrams=unit==='g'&&linkedStock?.unit==='Stück'
          &&normalizedIngredient(linkedStock.name)==='bananen';
        const savedPieceGrams=Number(productsByInventoryId.get(item.inventory_id)?.product_data?.edible_weight_per_piece_g);
        const edibleGramsPerBanana=savedPieceGrams>0?savedPieceGrams:118;
        const shoppingUnit=bananaGrams?'Stück':unit;
        const shoppingQuantity=bananaGrams?quantity/edibleGramsPerBanana:quantity;
        const canonical=normalizedIngredient(name,shoppingUnit);
        const key=item.inventory_id?'stock|'+item.inventory_id+'|'+shoppingUnit:'free|'+canonical+'|'+shoppingUnit.toLocaleLowerCase('de-DE');
        const current=needs.get(key)||{inventory_id:item.inventory_id||null,label:name,canonical,unit:shoppingUnit,required:0,uses:[]};
        current.required+=shoppingQuantity;
        current.uses.push({date:meal.meal_date,mealType:meal.meal_type,quantity:shoppingQuantity});
        if(current.canonical==='pfeffer schwarz')current.label='Pfeffer schwarz';
        if(current.canonical==='knoblauchzehen')current.label='Knoblauchzehen';
        needs.set(key,current);
      }));

    const inventoryRows=(data.inventory||[]).filter(item=>item.is_active!==false);
    const inventoryById=new Map(inventoryRows.map(item=>[item.id,item]));
    const inventoryByName=new Map(inventoryRows.map(item=>[normalizedIngredient(item.name,item.unit),item]));
    const gaps=[];

    const shortageDateFor=(need,available)=>{
      let remaining=Math.max(0,available||0);
      const byDate=new Map();
      need.uses.forEach(use=>byDate.set(use.date,(byDate.get(use.date)||0)+use.quantity));
      for(const [date,quantity] of [...byDate.entries()].sort((a,b)=>a[0].localeCompare(b[0]))){
        if(remaining>=quantity){remaining-=quantity;continue;}
        return date;
      }
      return null;
    };

    needs.forEach(need=>{
      const normalizedNeed=need.canonical||normalizedIngredient(need.label,need.unit);

      if(normalizedNeed==='knoblauchzehen'){
        const cloveStock=inventoryByName.get('knoblauchzehen');
        const bulbStock=inventoryRows.find(item=>String(item.name||'').trim().toLocaleLowerCase('de-DE')==='knoblauchknollen')||null;
        const cloveInfo=inventoryQuantityInUnit(cloveStock,'Zehe');
        const available=cloveInfo.available;
        const missing=Math.max(0,need.required-available);
        const bulbsAvailable=String(bulbStock?.unit||'')==='Knolle'?Math.max(0,num(bulbStock?.quantity)||0):0;
        if(missing>0&&bulbsAvailable<=0){
          const shortageDate=shortageDateFor(need,available);
          gaps.push({...need,inventory_id:null,available,currentAvailable:available,missing,label:'Knoblauchzehen',garlic:true,purchaseInventoryId:bulbStock?.id||null,purchaseName:'Knoblauchknollen',purchaseQuantity:1,purchaseUnit:'Knolle',shortageDate,buyFrom:shortageDate});
        }
        return;
      }

      const stockInfo=ingredientStockInfo(
        {inventory_id:need.inventory_id||null,name:need.label,unit:need.unit},
        inventoryRows,inventoryById,inventoryByName
      );
      const stock=stockInfo.stock||null;

      if(stock?.shopping_excluded===true)return;
      if(stock?.pending_weighing===true)return;

      let remaining=Math.max(0,stockInfo.available||0);
      const windows=new Map();

      need.uses.forEach(use=>{
        const buyFrom=regularShoppingDate(use.date,use.mealType);
        const current=windows.get(buyFrom)||{buyFrom,required:0,uses:[],shortageDate:use.date};
        current.required+=use.quantity;
        current.uses.push(use);
        if(use.date<current.shortageDate)current.shortageDate=use.date;
        windows.set(buyFrom,current);
      });

      [...windows.values()].sort((a,b)=>a.buyFrom.localeCompare(b.buyFrom)).forEach(window=>{
        const available=Math.min(remaining,window.required);
        remaining=Math.max(0,remaining-window.required);
        const missing=Math.max(0,window.required-available);
        if(missing<=1e-8)return;
        // Whole loose bananas are purchased as pieces, even if a recipe
        // only needs part of the edible fruit.
        const purchaseMissing=normalizedNeed==='bananen'&&need.unit==='Stück'
          ?Math.ceil(missing-1e-8):missing;
        const actualShortageDate=shortageDateFor({uses:window.uses},available);

        gaps.push({
          ...need,
          required:window.required,
          uses:window.uses,
          inventory_id:stockInfo.family?null:(need.inventory_id||stock?.id||null),
          available,
          currentAvailable:Math.max(0,stockInfo.available||0),
          missing:purchaseMissing,
          label:stockInfo.family?need.label:(stock?.name||need.label),
          unitMismatch:stockInfo.unitMismatch,
          convertedStock:stockInfo.converted,
          shortageDate:actualShortageDate||window.shortageDate,
          buyFrom:window.buyFrom
        });
      });
    });
    return gaps;
  }

  function shoppingUsageTimeline(uses,unit){
    const byDate=new Map();
    (uses||[]).forEach(use=>byDate.set(use.date,(byDate.get(use.date)||0)+(Number(use.quantity)||0)));
    return [...byDate.entries()]
      .sort((a,b)=>String(a[0]).localeCompare(String(b[0])))
      .map(([date,quantity])=>fmtShortDate(date)+' '+fmtQty(quantity,unit))
      .join(' · ');
  }

  function shoppingView(data){
    const collator=new Intl.Collator('de-DE',{sensitivity:'base',numeric:true});
    const today=todayIso();
    const gaps=deriveShopping(data);
    const manual=(data.shopping||[]).filter(item=>!item.checked);
    const cartSet=new Set((data.cart||[]).map(item=>String(item.shopping_key||'')));
    const inventoryRows=(data.inventory||[]).filter(item=>item.is_active!==false);
    const inventoryById=new Map(inventoryRows.map(item=>[item.id,item]));
    const inventoryByName=new Map(inventoryRows.map(item=>[normalizedIngredient(item.name,item.unit),item]));
    const derivedKeys=new Set(gaps.map(item=>normalizedIngredient(item.label,item.unit)+'|'+String(item.unit||'').toLocaleLowerCase('de-DE')));
    const nowRows=[];
    const laterRows=[];
    const cartRows=[];

    const pushRow=(bucket,row)=>bucket.push(row);

    gaps.forEach(item=>{
      const key=shoppingGapKey(item);
      const inCart=cartSet.has(key);
      const buyText=item.garlic?'Kaufen '+fmtQty(item.purchaseQuantity,item.purchaseUnit):'Kaufen '+fmtQty(item.missing,item.unit);
      const stockName=item.garlic?item.purchaseName:item.label;
      const stockQty=item.garlic?item.purchaseQuantity:item.missing;
      const stockUnit=item.garlic?item.purchaseUnit:item.unit;
      const stockId=item.garlic?item.purchaseInventoryId:item.inventory_id;
      const delayed=Boolean(item.buyFrom&&item.buyFrom>today);
      const usePlan=shoppingUsageTimeline(item.uses,item.unit);
      const timing=item.shortageDate
        ?(delayed?'Kaufen ab '+fmtShortDate(item.buyFrom)+' · fehlt ab '+fmtShortDate(item.shortageDate):'Fehlt ab '+fmtShortDate(item.shortageDate))
        :(delayed?'Kaufen ab '+fmtShortDate(item.buyFrom):'');
      const currentAvailable=Math.max(0,Number(item.currentAvailable??item.available)||0);
      const windowAvailable=Math.max(0,Number(item.available)||0);
      const preWindowPlanned=Math.max(0,currentAvailable-windowAvailable);
      const stockText=currentAvailable>windowAvailable+.0001
        ?'Aktuell '+fmtQty(currentAvailable,item.unit)+' · davor bereits '+fmtQty(preWindowPlanned,item.unit)+' eingeplant · danach '+fmtQty(windowAvailable,item.unit)+' übrig'
        :'Aktuell '+fmtQty(currentAvailable,item.unit);
      const conversion=item.convertedStock?'<em>Vorrat passend umgerechnet</em>':'';
      const html='<li class="food-shopping-gap-v572 '+(delayed?'is-later-v638 ':'')+(inCart?'is-in-cart-v639':'')+'"><strong>'+esc(item.label)+'</strong><span><small>'+esc(stockText)+(usePlan?' · Bedarf '+esc(usePlan):'')+'</small><b>'+esc(buyText)+'</b>'+(timing?'<em>'+esc(timing)+'</em>':'')+conversion+(item.unitMismatch?'<em>Einheit prüfen</em>':'')+'<button type="button" data-food-stock-gap data-food-stock-name="'+esc(stockName)+'" data-food-stock-quantity="'+esc(stockQty)+'" data-food-stock-unit="'+esc(stockUnit||'')+'" data-food-stock-id="'+esc(stockId||'')+'" data-food-cart-key="'+esc(key)+'">Vorhanden / eingekauft</button></span>'+shoppingCartButton(key,inCart)+'</li>';
      pushRow(inCart?cartRows:(delayed?laterRows:nowRows),{label:item.label||'',html});
    });

    manual.forEach(item=>{
      const required=num(item.quantity);
      const unit=String(item.unit||'').trim();
      const duplicateKey=normalizedIngredient(item.label,unit)+'|'+unit.toLocaleLowerCase('de-DE');
      if(derivedKeys.has(duplicateKey))return;
      const key=manualShoppingKey(item);
      const inCart=cartSet.has(key);

      if(required===null||required<=0||!unit){
        const html='<li class="manual '+(inCart?'is-in-cart-v639':'')+'"><strong>'+esc(item.label)+'</strong><span><button type="button" data-shopping-check="'+esc(item.id)+'" aria-label="'+esc(item.label)+' abhaken">✓ Abhaken</button></span>'+shoppingCartButton(key,inCart)+'</li>';
        pushRow(inCart?cartRows:nowRows,{label:item.label||'',html});
        return;
      }

      const stockInfo=ingredientStockInfo({name:item.label,unit},inventoryRows,inventoryById,inventoryByName);
      const stock=stockInfo.stock||null;
      if(stock?.pending_weighing===true)return;
      const available=stockInfo.available;
      const missing=Math.max(0,required-available);
      if(missing<=0)return;

      const html='<li class="food-shopping-gap-v572 manual '+(inCart?'is-in-cart-v639':'')+'"><strong>'+esc(item.label)+'</strong><span><small>Benötigt '+esc(fmtQty(required,unit))+' · Vorrat '+esc(fmtQty(available,unit))+'</small><b>Kaufen '+esc(fmtQty(missing,unit))+'</b>'+(stockInfo.converted?'<em>Vorrat passend umgerechnet</em>':'')+(stockInfo.unitMismatch?'<em>Einheit prüfen</em>':'')+'<button type="button" data-food-stock-gap data-food-stock-name="'+esc(item.label)+'" data-food-stock-quantity="'+esc(missing)+'" data-food-stock-unit="'+esc(unit)+'" data-food-stock-id="'+esc((stockInfo.family||stockInfo.unitMismatch)?'':(stock?.id||''))+'" data-shopping-id="'+esc(item.id)+'" data-shopping-required="'+esc(required)+'" data-food-cart-key="'+esc(key)+'">Vorhanden / eingekauft</button></span>'+shoppingCartButton(key,inCart)+'</li>';
      pushRow(inCart?cartRows:nowRows,{label:item.label||'',html});
    });

    nowRows.sort((a,b)=>collator.compare(String(a.label||''),String(b.label||'')));
    laterRows.sort((a,b)=>collator.compare(String(a.label||''),String(b.label||'')));
    cartRows.sort((a,b)=>collator.compare(String(a.label||''),String(b.label||'')));

    const nowHtml=nowRows.length
      ?'<div class="food-shopping-group-v638"><div class="food-shopping-group-head-v638"><strong>Noch holen</strong><span>'+nowRows.length+' Positionen</span></div><ul class="food-shopping-list-v544">'+nowRows.map(item=>item.html).join('')+'</ul></div>'
      :'';
    const laterHtml=laterRows.length
      ?'<div class="food-shopping-group-v638 is-later-v638"><div class="food-shopping-group-head-v638"><strong>Später kaufen</strong><span>Frische Sachen erst kurz vor dem Einsatz</span></div><ul class="food-shopping-list-v544">'+laterRows.map(item=>item.html).join('')+'</ul></div>'
      :'';
    const cartHtml=cartRows.length
      ?'<div class="food-shopping-group-v638 food-shopping-cart-group-v639"><div class="food-shopping-group-head-v638"><strong>Im Einkaufswagen</strong><span>'+cartRows.length+' '+(cartRows.length===1?'Position':'Positionen')+'</span></div><ul class="food-shopping-list-v544">'+cartRows.map(item=>item.html).join('')+'</ul></div>'
      :'';
    const all=nowHtml+laterHtml+cartHtml;

    return '<div class="food-section-head-v544"><div><span>EINKAUF</span><h3>Was noch fehlt</h3></div><button type="button" class="food-action-v544 compact" data-food-add-shopping>+ Eintrag</button></div>'
      +(all||'<div class="food-empty-card-v544"><div class="food-empty-icon-v544">✓</div><h4>Aus dem aktuellen Plan fehlt gerade nichts.</h4><p>Vorrat und geplante Rezeptmengen decken sich aktuell.</p></div>');
  }

  async function toggleShoppingCart(key,inCart){
    const shoppingKey=String(key||'').trim();
    if(!shoppingKey)throw new Error('Einkaufsposition konnte nicht zugeordnet werden.');
    if(!sourceIsReal('cart'))throw new Error('Der Einkaufswagen ist gerade nicht sicher mit der Cloud synchronisiert. Bitte neu laden.');

    const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
    const session=await withTimeout(supabase.auth.getSession(),'Anmeldung',2500);
    const user=session?.data?.session?.user;
    if(session?.error||!user?.id)throw new Error('Nicht angemeldet.');

    if(inCart){
      const result=await supabase.from('food_shopping_cart_state')
        .delete()
        .eq('user_id',user.id)
        .eq('shopping_key',shoppingKey);
      if(result.error)throw result.error;
    }else{
      const result=await supabase.from('food_shopping_cart_state')
        .upsert({user_id:user.id,shopping_key:shoppingKey,added_at:new Date().toISOString()},{onConflict:'user_id,shopping_key'});
      if(result.error)throw result.error;
    }
    await mutate(()=>true);
  }

  async function clearShoppingCartKey(supabase,key){
    const shoppingKey=String(key||'').trim();
    if(!shoppingKey)return;
    const result=await supabase.from('food_shopping_cart_state').delete().eq('shopping_key',shoppingKey);
    if(result.error)throw result.error;
  }

  function stockGapModal(button){
    const name=String(button?.dataset?.foodStockName||'').trim();
    const suggested=Number(button?.dataset?.foodStockQuantity||0);
    const unit=String(button?.dataset?.foodStockUnit||'').trim();
    const inventoryId=String(button?.dataset?.foodStockId||'').trim()||null;
    const shoppingId=String(button?.dataset?.shoppingId||'').trim()||null;
    const shoppingRequired=Number(button?.dataset?.shoppingRequired||0);
    const cartKey=String(button?.dataset?.foodCartKey||'').trim()||null;
    if(!name)return;

    let modal;
    modal=addModal('Vorrat übernehmen','<form><p class="food-modal-copy-v544"><strong>'+esc(name)+'</strong></p><div class="food-form-grid-v544"><label>Menge vorhanden / gekauft<input name="quantity" type="number" min="0.01" step="0.01" inputmode="decimal" value="'+esc(suggested||1)+'" required></label><label>Einheit<input name="unit" value="'+esc(unit||'Stück')+'" required></label></div><label class="food-weigh-later-v625"><input name="weigh_later" type="checkbox"> Menge später abwiegen</label><p class="food-modal-copy-v544">Ideal für lose Ware wie Zucchini, Paprika oder Obst. Der Einkauf gilt dann als erledigt, das echte Gewicht trägst du zuhause nach.</p><button class="food-action-v544" type="submit">In Vorrat übernehmen</button></form>',async form=>{
      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const session=await withTimeout(supabase.auth.getSession(),'Anmeldung',2500);
      const user=session?.data?.session?.user;
      if(session?.error||!user?.id)throw new Error('Nicht angemeldet.');

      const weighLater=form.get('weigh_later')==='on';
      const quantity=Number(form.get('quantity'));
      const chosenUnit=String(form.get('unit')||'').trim();
      if(!weighLater&&(!Number.isFinite(quantity)||quantity<=0))throw new Error('Bitte eine gültige Menge eingeben.');
      if(!chosenUnit)throw new Error('Bitte eine Einheit eingeben.');

      let existing=inventoryId
        ?(state?.inventory||[]).find(item=>String(item.id)===String(inventoryId))
        :(state?.inventory||[]).find(item=>String(item.name||'').trim().toLocaleLowerCase('de-DE')===name.toLocaleLowerCase('de-DE'));

      if(!existing){
        const archivedLookup=await supabase
          .from('food_inventory')
          .select('id,name,quantity,unit,is_active,sort_order,pending_weighing')
          .eq('user_id',user.id)
          .eq('name',name)
          .limit(1)
          .maybeSingle();
        if(archivedLookup.error)throw archivedLookup.error;
        if(archivedLookup.data)existing=archivedLookup.data;
      }

      if(weighLater){
        const current=Math.max(0,num(existing?.quantity)||0);
        const hasKnownStock=current>0;
        if(existing&&hasKnownStock&&String(existing.unit||'')!==chosenUnit){
          throw new Error('Der bekannte Vorrat hat eine andere Einheit. Bitte erst die Einheit angleichen.');
        }

        if(existing){
          const pendingUpdate=await supabase.from('food_inventory').update({
            quantity:current,
            unit:hasKnownStock?existing.unit:chosenUnit,
            quantity_label:hasKnownStock?fmtQty(current,existing.unit):'Menge noch offen · abwiegen',
            is_active:true,
            opened:false,
            pending_weighing:true,
            note:'Eingekauft · Menge noch abwiegen',
            tone:hasKnownStock?'stock':'stock',
            forecast_label:null,
            use_priority:'three_days',
            archived_at:null,
            archived_reason:null
          }).eq('id',existing.id);
          if(pendingUpdate.error)throw pendingUpdate.error;
        }else{
          const maxSort=(state?.inventory||[]).reduce((max,item)=>Math.max(max,Number(item.sort_order)||0),0);
          const pendingInsert=await supabase.from('food_inventory').insert({
            user_id:user.id,name,quantity:0,unit:chosenUnit,quantity_label:'Menge noch offen · abwiegen',
            forecast_label:null,tone:'stock',note:'Eingekauft · Menge noch abwiegen',sort_order:maxSort+1,
            opened:false,use_priority:'three_days',is_active:true,pending_weighing:true
          });
          if(pendingInsert.error)throw pendingInsert.error;
        }

        if(shoppingId){
          const check=await supabase.from('food_shopping_items').update({checked:true}).eq('id',shoppingId);
          if(check.error)throw check.error;
        }
        await clearShoppingCartKey(supabase,cartKey);
        await mutate(()=>true);
        return;
      }

      let quantityAfter=quantity;
      if(existing){
        const current=num(existing.quantity);
        const isInactive=existing.is_active===false;
        const unitMatches=String(existing.unit||'')===chosenUnit;

        if(!unitMatches&&!isInactive){
          throw new Error('Die Einheit passt nicht zum vorhandenen Vorrat.');
        }
        if(!unitMatches&&!((current===null?0:current)<=0)){
          throw new Error('Der alte Vorrat hat noch eine Menge in einer anderen Einheit.');
        }

        if(isInactive){
          const newQuantity=(current===null?0:current)+quantity;
          const revive=await supabase.from('food_inventory').update({
            quantity:newQuantity,
            unit:chosenUnit,
            quantity_label:fmtQty(newQuantity,chosenUnit),
            is_active:true,
            opened:false,
            tone:'stock',
            forecast_label:null,
            use_priority:'later',
            pending_weighing:false,
            note:null,
            archived_at:null,
            archived_reason:null
          }).eq('id',existing.id);
          if(revive.error)throw revive.error;
          quantityAfter=newQuantity;
        }else{
          const newQuantity=(current===null?0:current)+quantity;
          const result=await supabase.rpc('adjust_food_inventory',{p_inventory_id:existing.id,p_new_quantity:newQuantity,p_reason:'Vorrat vorhanden / eingekauft',p_note:null});
          if(result.error)throw result.error;
          const clearPending=await supabase.from('food_inventory').update({pending_weighing:false,note:null}).eq('id',existing.id);
          if(clearPending.error)throw clearPending.error;
          quantityAfter=newQuantity;
        }
      }else{
        const maxSort=(state?.inventory||[]).reduce((max,item)=>Math.max(max,Number(item.sort_order)||0),0);
        const result=await supabase.from('food_inventory').insert({
          user_id:user.id,name,quantity,unit:chosenUnit,quantity_label:fmtQty(quantity,chosenUnit),
          forecast_label:null,tone:'stock',note:null,sort_order:maxSort+1,opened:false,use_priority:'later',is_active:true,pending_weighing:false
        });
        if(result.error)throw result.error;
      }
      if(shoppingId&&shoppingRequired>0&&quantityAfter>=shoppingRequired){
        const check=await supabase.from('food_shopping_items').update({checked:true}).eq('id',shoppingId);
        if(check.error)throw check.error;
      }
      await clearShoppingCartKey(supabase,cartKey);
      await mutate(()=>true);
    });

    const weighBox=modal?.querySelector('[name="weigh_later"]');
    const quantityInput=modal?.querySelector('[name="quantity"]');
    const syncWeighLater=()=>{
      const pending=weighBox?.checked===true;
      if(quantityInput){
        quantityInput.disabled=pending;
        quantityInput.required=!pending;
      }
    };
    weighBox?.addEventListener('change',syncWeighLater);
    syncWeighLater();
  }

  function openGarlicModal(id){
    const item=(state?.inventory||[]).find(row=>String(row.id)===String(id));
    if(!item)return;
    addModal('Knoblauchknolle öffnen','<form><p class="food-modal-copy-v544">Wie viele Zehen sind in dieser Knolle? Die App zieht 1 Knolle ab und legt genau diese Anzahl als Knoblauchzehen an.</p><label>Zehen in dieser Knolle<input name="cloves" type="number" min="1" step="1" inputmode="numeric" required></label><button class="food-action-v544" type="submit">Knolle in Zehen umwandeln</button></form>',async form=>{
      const cloves=Number(form.get('cloves'));
      if(!Number.isInteger(cloves)||cloves<1)throw new Error('Bitte die tatsächliche Zahl der Zehen eintragen.');
      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const result=await supabase.rpc('open_food_garlic_bulb',{p_bulb_inventory_id:id,p_cloves:cloves});
      if(result.error)throw result.error;
      await mutate(()=>result.data);
    });
  }

  function recipeCard(recipe,data){
    const expanded=expandedRecipes.has(String(recipe.id));
    const view=recipePresentation(recipe,expanded);
    const preparedTotal=preparedPortionTotal(recipe.id,data);
    const meta=[view.meta,preparedPortionLabel(preparedTotal)].filter(Boolean).join(' · ');
    return '<article class="food-recipe-card-v544 '+(expanded?'is-expanded-v572':'')+'" data-food-recipe-card="'+esc(recipe.id)+'"><button type="button" class="food-recipe-toggle-v572" data-food-recipe-toggle="'+esc(recipe.id)+'" aria-expanded="'+expanded+'"><span><small class="food-recipe-type-v544">'+esc(RECIPE_GROUP_LABELS[recipe.meal_type]||MEAL_LABELS[recipe.meal_type]||recipe.meal_type)+'</small><h4>'+esc(recipe.title)+'</h4><em>'+esc(meta)+'</em></span><b aria-hidden="true">'+(expanded?'−':'+')+'</b></button>'+recipeRatingControl(recipe)+view.details+'<div class="food-recipe-actions-v582"><button type="button" class="food-action-v544 compact" data-food-edit-recipe="'+esc(recipe.id)+'">Bearbeiten</button><button type="button" class="food-action-v544 food-recipe-plan-v572" data-food-schedule="'+esc(recipe.id)+'">Einplanen</button></div></article>';
  }

  function recipesView(data){
    const recipes=data.recipes.length?data.recipes:data.meals.map(meal=>({id:meal.id,title:meal.title,meal_type:meal.meal_type,ingredients:meal.ingredients}));
    const collator=new Intl.Collator('de-DE',{sensitivity:'base',numeric:true});
    const knownCategories=RECIPE_CATEGORY_ORDER;
    if(!knownCategories.includes(activeRecipeCategory))activeRecipeCategory='breakfast';
    const selected=recipes
      .filter(recipe=>recipe.meal_type===activeRecipeCategory)
      .sort((a,b)=>collator.compare(String(a.title||''),String(b.title||'')));
    const categoryTabs=knownCategories.map(type=>{
      const count=recipes.filter(recipe=>recipe.meal_type===type).length;
      const label=RECIPE_GROUP_LABELS[type]||MEAL_LABELS[type]||type;
      const active=type===activeRecipeCategory;
      return '<button type="button" data-food-recipe-category="'+esc(type)+'" class="'+(active?'active':'')+'" aria-pressed="'+active+'"><span>'+esc(label)+'</span><small>'+count+'</small></button>';
    }).join('');
    const uncategorized=recipes.filter(recipe=>!knownCategories.includes(recipe.meal_type)).length;
    const selectedLabel=RECIPE_GROUP_LABELS[activeRecipeCategory]||MEAL_LABELS[activeRecipeCategory]||activeRecipeCategory;
    const grid=selected.length
      ?'<div class="food-recipe-grid-v544">'+selected.map(recipe=>recipeCard(recipe,data)).join('')+'</div>'
      :'<div class="food-empty-card-v544"><h4>Noch keine Rezepte in '+esc(selectedLabel)+'.</h4><p>Neue Rezepte kannst du direkt dieser Kategorie zuordnen.</p></div>';
    return '<div class="food-section-head-v544"><div><span>REZEPTE</span><h3>Deine Rezeptsammlung</h3></div><div class="food-section-actions-v549"><small>'+recipes.length+' Rezepte'+(uncategorized?' · '+uncategorized+' ohne Kategorie':'')+'</small><button type="button" class="food-action-v544 compact" data-food-add-recipe>+ Rezept</button></div></div>'
      +'<nav class="food-recipe-tabs-v628" aria-label="Rezeptkategorien">'+categoryTabs+'</nav>'
      +'<div class="food-recipe-category-head-v628"><strong>'+esc(selectedLabel)+'</strong><span>'+selected.length+' '+(selected.length===1?'Rezept':'Rezepte')+'</span></div>'
      +grid;
  }

  function content(data){
    if(activeTab==='today')return todayView(data);
    if(activeTab==='plan')return planView(data);
    if(activeTab==='history')return historyView(data);
    if(activeTab==='inventory')return inventoryView(data);
    if(activeTab==='shopping')return shoppingView(data);
    return recipesView(data);
  }

  async function mutate(task){
    const result=await task();
    loadPromise=null;
    await render();
    return result;
  }

  async function saveInventoryStorage(id,opened,usePriority){
    const supabase=client();
    if(!supabase)throw new Error('Cloud-Verbindung fehlt.');

    const saveOnce=()=>supabase.from('food_inventory')
      .update({opened,use_priority:usePriority})
      .eq('id',id)
      .eq('is_active',true)
      .select('id,opened,use_priority')
      .maybeSingle();

    let lastError=null;
    for(let attempt=0;attempt<2;attempt+=1){
      if(attempt)await new Promise(resolve=>setTimeout(resolve,650));
      try{
        const result=await withTimeout(
          saveOnce(),
          attempt?'Vorratsstatus erneut speichern':'Vorratsstatus speichern',
          12000
        );
        if(!result?.error&&result?.data)return result.data;
        lastError=result?.error||new Error('Die Cloud hat den Speichervorgang nicht bestätigt.');
      }catch(error){
        lastError=error;
      }
    }

    await new Promise(resolve=>setTimeout(resolve,850));
    try{
      const check=await withTimeout(
        supabase.from('food_inventory')
          .select('id,opened,use_priority')
          .eq('id',id)
          .eq('is_active',true)
          .maybeSingle(),
        'Speicherstand prüfen',
        8000
      );
      if(!check?.error&&check?.data&&check.data.opened===opened&&check.data.use_priority===usePriority)return check.data;
      if(check?.error)lastError=check.error;
    }catch(error){
      lastError=error;
    }
    throw lastError||new Error('Der neue Vorratsstatus konnte nicht bestätigt werden.');
  }

  async function completeMeal(id){
    const supabase=client();
    if(!supabase){
      const meal=state?.meals.find(item=>item.id===id);
      if(meal){meal.status='completed';meal.prepared_at=new Date().toISOString();}
      return render();
    }
    const result=await supabase.rpc('complete_food_meal',{p_meal_id:id});
    if(result.error)throw result.error;
    await mutate(()=>result.data);
  }

  function addModal(title,body,onSubmit){
    const root=ensureRoot();
    if(!root)return;
    const old=root.querySelector('.food-modal-v544');if(old)old.remove();
    root.insertAdjacentHTML('beforeend','<div class="food-modal-v544" role="dialog" aria-modal="true"><div class="food-modal-card-v544"><div class="food-modal-head-v544"><h3>'+title+'</h3><button type="button" data-food-modal-close aria-label="Schließen">×</button></div>'+body+'</div></div>');
    const modal=root.querySelector('.food-modal-v544');
    modal.querySelector('[data-food-modal-close]')?.addEventListener('click',()=>modal.remove());
    modal.querySelector('form')?.addEventListener('submit',async event=>{
      event.preventDefault();
      const submit=modal.querySelector('button[type="submit"]');
      if(submit)submit.disabled=true;
      try{await onSubmit(new FormData(event.currentTarget));modal.remove();}catch(error){console.error(error);alert(error?.message||'Das konnte nicht gespeichert werden.');if(submit)submit.disabled=false;}
    });
    return modal;
  }

  function recipeNeedPreview(recipe,preparedServings){
    const base=Math.max(.01,Number(recipe?.servings)||1);
    const factor=Math.max(.01,Number(preparedServings)||base)/base;
    const inventoryRows=(state?.inventory||[]).filter(item=>item.is_active!==false);
    const inventoryById=new Map(inventoryRows.map(item=>[item.id,item]));
    const inventoryByName=new Map(inventoryRows.map(item=>[normalizedIngredient(item.name,item.unit),item]));
    const items=recipe?.food_recipe_ingredients||recipe?.ingredients||[];
    if(!items.length)return '<p class="food-recipe-preview-empty-v572">Keine Zutaten hinterlegt.</p>';
    return '<div class="food-recipe-preview-v572">'+items.map(item=>{
      const required=num(item.quantity)===null?null:Number(item.quantity)*factor;
      const name=ingredientName(item);
      if(isNonShoppingIngredient(name)){
        return '<div><span><strong>'+esc(name)+'</strong><small>Benötigt '+esc(required===null?'offen':fmtQty(required,item.unit))+'</small></span><b class="is-ok">Kein Einkauf nötig</b></div>';
      }
      const stockInfo=ingredientStockInfo(item,inventoryRows,inventoryById,inventoryByName);
      const available=stockInfo.available;
      const missing=required===null?null:Math.max(0,required-available);
      const stateLabel=required===null?'Menge offen':missing>0?'Kaufen '+fmtQty(missing,item.unit):'Vorrat reicht';
      return '<div><span><strong>'+esc(name)+'</strong><small>Benötigt '+esc(required===null?'offen':fmtQty(required,item.unit))+' · vorhanden '+esc(fmtQty(available,item.unit))+'</small></span><b class="'+(missing>0?'is-missing':'is-ok')+'">'+esc(stateLabel)+'</b></div>';
    }).join('')+'</div>';
  }

  function scheduleModal(recipeId){
    const recipe=(state?.recipes||[]).find(item=>String(item.id)===String(recipeId));
    if(!recipe){alert('Rezept nicht gefunden.');return;}
    const base=Math.max(1,Number(recipe.servings)||1);
    let modal;
    const body='<form><div class="food-form-grid-v544"><label class="food-plan-field-v546">Tag<input name="date" type="date" min="'+todayIso()+'" value="'+plusDays(todayIso(),1)+'" required></label><label class="food-plan-field-v546">Mahlzeit<select name="type">'+mealTypeOptions(planningMealType(recipe.meal_type))+'</select></label></div><div class="food-form-grid-v544"><label>Portionen zubereiten<input name="prepared" type="number" min="0.5" max="99" step="0.5" inputmode="decimal" value="'+esc(base)+'" required></label><label>Davon an diesem Tag<input name="eaten" type="number" min="0.5" max="'+esc(base)+'" step="0.5" inputmode="decimal" value="'+esc(base)+'" required></label></div><div class="food-portion-hint-v572" data-food-portion-hint></div><div data-food-recipe-preview>'+recipeNeedPreview(recipe,base)+'</div><button class="food-action-v544" type="submit">In den Plan übernehmen</button></form>';
    modal=addModal('Rezept einplanen',body,async form=>{
      const prepared=Number(form.get('prepared'));
      const eaten=Number(form.get('eaten'));
      if(!Number.isFinite(prepared)||prepared<=0)throw new Error('Bitte eine gültige Zahl zubereiteter Portionen wählen.');
      if(!Number.isFinite(eaten)||eaten<=0||eaten>prepared)throw new Error('Die Portionen für den Tag dürfen nicht größer sein als die zubereitete Menge.');
      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const result=await supabase.rpc('schedule_food_recipe',{p_recipe_id:recipeId,p_meal_date:form.get('date'),p_meal_type:form.get('type'),p_prepared_servings:prepared,p_eaten_servings:eaten});
      if(result.error)throw result.error;
      await mutate(()=>result.data);
    });
    const preparedInput=modal.querySelector('[name="prepared"]');
    const eatenInput=modal.querySelector('[name="eaten"]');
    const preview=modal.querySelector('[data-food-recipe-preview]');
    const hint=modal.querySelector('[data-food-portion-hint]');
    const sync=()=>{
      const prepared=Math.max(.5,Number(preparedInput.value)||base);
      let eaten=Math.max(.5,Number(eatenInput.value)||prepared);
      eatenInput.max=String(prepared);
      if(eaten>prepared){eaten=prepared;eatenInput.value=String(prepared);}
      const rest=Math.max(0,prepared-eaten);
      if(preview)preview.innerHTML=recipeNeedPreview(recipe,prepared);
      if(hint)hint.textContent=rest>0?portionLabel(rest)+' werden nach dem Essen als Restportionen gespeichert.':'Es entstehen keine Restportionen.';
    };
    preparedInput?.addEventListener('input',sync);
    eatenInput?.addEventListener('input',sync);
    sync();
  }

  function scheduleLeftoverModal(leftoverId){
    const leftover=(state?.leftovers||[]).find(item=>String(item.id)===String(leftoverId));
    if(!leftover){alert('Restportion nicht gefunden.');return;}
    const max=Math.max(.5,Number(leftover.available_servings)||.5);
    const recipe=leftover.food_recipes||{};
    addModal('Restportion einplanen','<form><p class="food-leftover-modal-copy-v572"><strong>'+esc(recipe.title||'Restportion')+'</strong><br>'+esc(portionLabel(max))+' verfügbar</p><div class="food-form-grid-v544"><label>Tag<input name="date" type="date" min="'+todayIso()+'" value="'+plusDays(todayIso(),1)+'" required></label><label>Mahlzeit<select name="type">'+mealTypeOptions(planningMealType(recipe.meal_type))+'</select></label></div><label>Portionen<input name="servings" type="number" min="0.5" max="'+esc(max)+'" step="0.5" value="'+esc(Math.min(1,max))+'" required></label><button class="food-action-v544" type="submit">Rest einplanen</button></form>',async form=>{
      const servings=Number(form.get('servings'));
      if(!Number.isFinite(servings)||servings<=0||servings>max)throw new Error('Ungültige Restportion.');
      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const result=await supabase.rpc('schedule_food_leftover',{p_leftover_id:leftoverId,p_meal_date:form.get('date'),p_meal_type:form.get('type'),p_servings:servings});
      if(result.error)throw result.error;
      await mutate(()=>result.data);
    });
  }

  function freeMealIngredientRow(index,item={}){
    const activeInventory=(state?.inventory||[]).filter(entry=>entry.is_active!==false);
    const options=activeInventory.map(entry=>'<option value="'+esc(entry.id)+'" '+(String(item.inventory_id||'')===String(entry.id)?'selected':'')+'>'+esc(entry.name)+'</option>').join('');
    const displayName=String(item.name||'').trim()||ingredientName(item);
    return '<div class="food-recipe-ingredient-row-v549" data-food-free-meal-row>'
      +'<div class="food-recipe-row-head-v549"><strong>Zutat '+(index+1)+'</strong><button type="button" data-food-free-meal-remove aria-label="Zutat entfernen">×</button></div>'
      +'<label>Aus Vorrat wählen<select data-food-free-meal-inventory><option value="">Eigene Zutat eingeben</option>'+options+'</select></label>'
      +'<label>Name<input data-food-free-meal-name value="'+esc(displayName)+'" placeholder="z. B. Roggen-Vollkornbrot" required></label>'
      +'<div class="food-form-grid-v544"><label>Menge<input data-food-free-meal-quantity type="number" min="0.01" step="0.01" inputmode="decimal" value="'+esc(item.quantity??'')+'" placeholder="offen"></label><label>Einheit<input data-food-free-meal-unit value="'+esc(item.unit||'')+'" placeholder="g, ml, Stück …"></label></div>'
      +'</div>';
  }

  function wireFreeMealIngredientRow(row){
    const select=row.querySelector('[data-food-free-meal-inventory]');
    const name=row.querySelector('[data-food-free-meal-name]');
    const unit=row.querySelector('[data-food-free-meal-unit]');
    const sync=()=>{
      const item=(state?.inventory||[]).find(entry=>String(entry.id)===String(select?.value||''));
      if(item){
        if(name){name.value=item.name;name.readOnly=true;}
        if(unit){unit.value=item.unit||'';unit.readOnly=true;}
      }else{
        if(name)name.readOnly=false;
        if(unit)unit.readOnly=false;
      }
    };
    select?.addEventListener('change',sync);
    sync();
  }

  function renumberFreeMealRows(rows){
    rows.querySelectorAll('[data-food-free-meal-row]').forEach((row,index)=>{
      const strong=row.querySelector('.food-recipe-row-head-v549 strong');
      if(strong)strong.textContent='Zutat '+(index+1);
    });
  }

  function editFreeMealModal(mealId){
    const meal=(state?.meals||[]).find(item=>String(item.id)===String(mealId));
    if(!meal){alert('Mahlzeit nicht gefunden.');return;}
    if(meal.recipe_id){alert('Diese Mahlzeit stammt aus einem Rezept. Bitte das Rezept bearbeiten.');return;}
    if(normalizedStatus(meal.status)==='completed'){alert('Bereits gebuchte Mahlzeiten werden nicht nachträglich verändert.');return;}

    const items=meal.ingredients||[];
    let modal;
    const rowsHtml=items.map((item,index)=>freeMealIngredientRow(index,item)).join('');
    const body='<form class="food-recipe-form-v549">'
      +'<p class="food-modal-copy-v544"><strong>'+esc(meal.title)+'</strong><br>Zutaten und Mengen für genau diese geplante Mahlzeit ändern.</p>'
      +'<div class="food-recipe-builder-v549"><div class="food-recipe-builder-head-v549"><strong>Zutaten</strong><button type="button" data-food-free-meal-add>+ Zutat</button></div><div data-food-free-meal-rows>'+rowsHtml+'</div></div>'
      +'<button class="food-action-v544" type="submit">Änderungen speichern</button>'
      +'</form>';

    modal=addModal('Mahlzeit bearbeiten',body,async()=>{
      if(!sourceIsReal('meals'))throw new Error('Die Mahlzeitdaten sind gerade nicht sicher mit der Cloud synchronisiert. Bitte zuerst neu laden.');
      const rows=[...modal.querySelectorAll('[data-food-free-meal-row]')];
      const ingredients=rows.map((row,index)=>{
        const inventoryId=String(row.querySelector('[data-food-free-meal-inventory]')?.value||'')||null;
        const inventoryItem=inventoryId?(state?.inventory||[]).find(item=>String(item.id)===inventoryId):null;
        const name=String(row.querySelector('[data-food-free-meal-name]')?.value||'').trim();
        const quantityRaw=String(row.querySelector('[data-food-free-meal-quantity]')?.value||'').trim();
        const quantity=quantityRaw===''?null:Number(quantityRaw);
        const unit=String(row.querySelector('[data-food-free-meal-unit]')?.value||'').trim()||null;
        if(!name)throw new Error('Bei Zutat '+(index+1)+' fehlt der Name.');
        if(quantity!==null&&(!Number.isFinite(quantity)||quantity<=0))throw new Error('Bei Zutat '+(index+1)+' ist die Menge ungültig.');
        if(quantity!==null&&!unit)throw new Error('Bei Zutat '+(index+1)+' fehlt die Einheit.');
        if(inventoryId&&!inventoryItem)throw new Error('Die ausgewählte Vorratszutat ist nicht mehr verfügbar.');
        return {inventory_id:inventoryId,name,quantity,unit,quantity_confirmed:quantity!==null};
      });

      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const result=await withTimeout(
        supabase.rpc('update_food_free_meal_ingredients',{p_meal_id:meal.id,p_ingredients:ingredients}),
        'Mahlzeit aktualisieren',
        10000
      );
      if(result.error)throw result.error;
      expandedMeals.add(String(meal.id));
      await mutate(()=>result.data);
    });

    const rows=modal.querySelector('[data-food-free-meal-rows]');
    rows.querySelectorAll('[data-food-free-meal-row]').forEach(wireFreeMealIngredientRow);
    modal.querySelector('[data-food-free-meal-add]')?.addEventListener('click',()=>{
      const index=rows.querySelectorAll('[data-food-free-meal-row]').length;
      rows.insertAdjacentHTML('beforeend',freeMealIngredientRow(index,{}));
      const row=rows.lastElementChild;
      wireFreeMealIngredientRow(row);
      row.querySelector('[data-food-free-meal-name]')?.focus();
    });
    rows.addEventListener('click',event=>{
      const remove=event.target?.closest?.('[data-food-free-meal-remove]');
      if(!remove)return;
      remove.closest('[data-food-free-meal-row]')?.remove();
      renumberFreeMealRows(rows);
    });
  }

  const sameAllocationOverride=(left,right)=>{
    const normalize=value=>(Array.isArray(value)?value:[])
      .map(part=>({
        inventory_id:String(part?.inventory_id||''),
        quantity:Number(part?.quantity)||0,
        unit:String(part?.unit||''),
        label:String(part?.label||''),
        frozen:part?.frozen===true
      }))
      .filter(part=>part.inventory_id&&part.quantity>0)
      .sort((a,b)=>a.inventory_id.localeCompare(b.inventory_id)||a.quantity-b.quantity);
    return JSON.stringify(normalize(left))===JSON.stringify(normalize(right));
  };

  async function saveMealIngredientAllocationDirect(meal,ingredient,allocations){
    if(!sourceIsReal('meals')||!sourceIsReal('inventory')){
      throw new Error('Mahlzeit oder Vorrat sind gerade nicht sicher mit der Cloud synchronisiert. Bitte FOOD einmal neu laden.');
    }
    const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');

    const normalized=(allocations||[]).map(part=>({
      inventory_id:String(part?.inventory_id||'').trim(),
      quantity:Math.round((Number(part?.quantity)||0)*1000)/1000,
      unit:String(part?.unit||ingredient?.unit||'').trim(),
      label:String(part?.label||'').trim(),
      frozen:part?.frozen===true
    })).filter(part=>part.inventory_id&&part.quantity>0);

    if(!normalized.length)throw new Error('Mindestens eine Vorratsquelle muss eine Menge größer als 0 behalten.');

    const byInventory=new Map();
    normalized.forEach(part=>byInventory.set(part.inventory_id,(byInventory.get(part.inventory_id)||0)+part.quantity));
    for(const [inventoryId,quantity] of byInventory){
      const stock=(state?.inventory||[]).find(row=>String(row.id)===inventoryId);
      if(!stock||stock.is_active===false)throw new Error('Eine Vorratsquelle ist nicht mehr verfügbar.');
      const availability=inventoryQuantityInUnit(stock,ingredient.unit);
      if(availability.unitMismatch)throw new Error('Die Einheit von „'+String(stock.name||'Vorratsquelle')+'“ passt nicht zur Zutat.');
      if(quantity>Number(availability.available)+0.0001){
        throw new Error('Nicht genug „'+String(stock.name||'Vorratsquelle')+'“ vorhanden.');
      }
    }

    const total=Math.round(normalized.reduce((sum,part)=>sum+part.quantity,0)*1000)/1000;
    const payload={
      quantity:total,
      quantity_confirmed:true,
      label:fmtQty(total,ingredient.unit)+' '+String(ingredient.name||'Zutat'),
      allocation_override:normalized
    };

    const clearMeal=await withTimeout(
      supabase.from('food_meals')
        .update({calories_kcal_per_serving_override:null})
        .eq('id',meal.id)
        .select('id,calories_kcal_per_serving_override')
        .single(),
      'Mahlzeit vorbereiten',
      12000
    );
    if(clearMeal?.error)throw clearMeal.error;

    let saved=null;
    let lastError=null;
    for(let attempt=0;attempt<2&&!saved;attempt+=1){
      if(attempt)await new Promise(resolve=>setTimeout(resolve,500));
      try{
        const result=await withTimeout(
          supabase.from('food_meal_ingredients')
            .update(payload)
            .eq('id',ingredient.id)
            .eq('meal_id',meal.id)
            .select('id,quantity,unit,label,quantity_confirmed,allocation_override')
            .single(),
          attempt?'Quellenmenge erneut speichern':'Quellenmenge speichern',
          12000
        );
        if(!result?.error&&result?.data)saved=result.data;
        else lastError=result?.error||new Error('Die Cloud hat die Quellenmenge nicht bestätigt.');
      }catch(error){
        lastError=error;
      }
    }

    if(!saved){
      try{
        const check=await withTimeout(
          supabase.from('food_meal_ingredients')
            .select('id,quantity,unit,label,quantity_confirmed,allocation_override')
            .eq('id',ingredient.id)
            .eq('meal_id',meal.id)
            .single(),
          'Gespeicherte Quellenmenge prüfen',
          8000
        );
        const quantityMatches=Math.abs((Number(check?.data?.quantity)||0)-total)<=0.0001;
        if(!check?.error&&check?.data&&quantityMatches&&sameAllocationOverride(check.data.allocation_override,normalized)){
          saved=check.data;
        }else if(check?.error){
          lastError=check.error;
        }
      }catch(error){
        lastError=error;
      }
    }

    if(!saved)throw lastError||new Error('Die Quellenmenge konnte nicht gespeichert werden.');

    Object.assign(ingredient,saved);
    meal.calories_kcal_per_serving_override=null;
    plannedAllocationCacheState=null;
    plannedAllocationCache=null;
    plannedThawCacheState=null;
    plannedThawCache=null;
    sourceState.meals='cloud';
    expandedMeals.add(String(meal.id));
    renderState();
    return saved;
  }

  async function removeMealIngredient(ingredientId){
    const context=mealIngredientContext(ingredientId);
    if(!context)throw new Error('Zutat nicht gefunden.');
    const {meal,ingredient}=context;
    if(normalizedStatus(meal.status)==='completed'||meal.inventory_booked_at){
      throw new Error('Bereits gebuchte Mahlzeiten werden nicht nachträglich verändert.');
    }
    if(!confirm('„'+ingredientName(ingredient)+'“ nur aus dieser Mahlzeit entfernen? Das Rezept selbst bleibt unverändert.'))return false;
    if(!sourceIsReal('meals'))throw new Error('Die Mahlzeit ist gerade nicht sicher mit der Cloud synchronisiert. Bitte FOOD einmal neu laden.');

    const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');

    const clearMeal=await withTimeout(
      supabase.from('food_meals')
        .update({calories_kcal_per_serving_override:null})
        .eq('id',meal.id)
        .select('id')
        .single(),
      'Mahlzeit vorbereiten',
      12000
    );
    if(clearMeal?.error)throw clearMeal.error;

    let removed=false;
    let lastError=null;
    for(let attempt=0;attempt<2&&!removed;attempt+=1){
      if(attempt)await new Promise(resolve=>setTimeout(resolve,500));
      try{
        const result=await withTimeout(
          supabase.from('food_meal_ingredients')
            .delete()
            .eq('id',ingredient.id)
            .eq('meal_id',meal.id)
            .select('id')
            .maybeSingle(),
          attempt?'Zutat erneut entfernen':'Zutat entfernen',
          12000
        );
        if(!result?.error&&result?.data?.id)removed=true;
        else if(result?.error)lastError=result.error;
      }catch(error){
        lastError=error;
      }
    }

    if(!removed){
      try{
        const check=await withTimeout(
          supabase.from('food_meal_ingredients')
            .select('id')
            .eq('id',ingredient.id)
            .eq('meal_id',meal.id)
            .maybeSingle(),
          'Entfernung prüfen',
          8000
        );
        if(!check?.error&&!check?.data)removed=true;
        else if(check?.error)lastError=check.error;
      }catch(error){
        lastError=error;
      }
    }

    if(!removed)throw lastError||new Error('Die Zutat konnte nicht entfernt werden.');

    meal.ingredients=(meal.ingredients||[]).filter(item=>String(item.id)!==String(ingredient.id));
    meal.calories_kcal_per_serving_override=null;
    plannedAllocationCacheState=null;
    plannedAllocationCache=null;
    plannedThawCacheState=null;
    plannedThawCache=null;
    sourceState.meals='cloud';
    expandedMeals.add(String(meal.id));
    renderState();
    return true;
  }

  function allocationQuantityModal(ingredientId,sourceIndex){
    const context=mealIngredientContext(ingredientId);
    if(!context){alert('Zutat nicht gefunden.');return;}
    const {meal,ingredient}=context;
    if(normalizedStatus(meal.status)==='completed'||meal.inventory_booked_at){
      alert('Bereits gebuchte Mahlzeiten werden nicht nachträglich verändert.');
      return;
    }

    const plannedMap=plannedFamilyAllocationMaps().get(String(meal.id));
    const allocation=plannedMap?.get?.(String(ingredient.id))
      ||manualAllocationForItem(ingredient)
      ||familyAllocationForItem(ingredient)
      ||specificAllocationForItem(ingredient);
    const parts=Array.isArray(allocation?.allocations)?allocation.allocations:[];
    const missing=Math.max(0,Number(allocation?.remaining)||0);
    const index=Number(sourceIndex);
    const target=parts[index];

    if(!target||!target.inventoryId){alert('Diese Vorratsquelle konnte nicht eindeutig zugeordnet werden.');return;}
    if(missing>0.0001){alert('Die Quellenmenge kann erst geändert werden, wenn die Zutat vollständig aus vorhandenem Vorrat aufgeteilt ist.');return;}

    const originalTotal=parts.reduce((sum,part)=>sum+(Number(part.quantity)||0),0);
    const unit=String(target.unit||ingredient.unit||'').trim();
    let modal;
    const body='<form>'
      +'<p class="food-modal-copy-v544"><strong>'+esc(target.label||ingredientName(ingredient))+'</strong><br>Du änderst nur diese Vorratsquelle für diese Mahlzeit. Die Gesamtmenge von <strong>'+esc(ingredientName(ingredient))+'</strong> wird automatisch aus allen Quellen neu berechnet.</p>'
      +'<label>Neue Menge ('+esc(unit)+')<input name="quantity" type="number" min="0" step="0.01" inputmode="decimal" value="'+esc(Number(target.quantity)||0)+'" required autofocus></label>'
      +'<div class="food-allocation-total-preview-v749"><span>Gesamt danach</span><strong data-food-allocation-total-preview>'+esc(fmtQty(originalTotal,ingredient.unit))+'</strong></div>'
      +'<button class="food-action-v544" type="submit">Quellenmenge speichern</button>'
      +'</form>';

    modal=addModal('Quellenmenge ändern',body,async form=>{
      const next=Number(form.get('quantity'));
      if(!Number.isFinite(next)||next<0)throw new Error('Bitte eine gültige Menge ab 0 eingeben.');

      const allocations=parts.map((part,partIndex)=>({
        inventory_id:String(part.inventoryId||''),
        quantity:partIndex===index?next:Number(part.quantity)||0,
        unit:String(part.unit||ingredient.unit||''),
        label:String(part.label||''),
        frozen:part.frozen===true
      })).filter(part=>part.inventory_id&&part.quantity>0);

      if(!allocations.length)throw new Error('Mindestens eine Vorratsquelle muss eine Menge größer als 0 behalten.');

      await saveMealIngredientAllocationDirect(meal,ingredient,allocations);
    });

    const input=modal?.querySelector('[name="quantity"]');
    const preview=modal?.querySelector('[data-food-allocation-total-preview]');
    const sync=()=>{
      const next=Math.max(0,Number(input?.value)||0);
      const total=parts.reduce((sum,part,partIndex)=>sum+(partIndex===index?next:(Number(part.quantity)||0)),0);
      if(preview)preview.textContent=fmtQty(total,ingredient.unit);
    };
    input?.addEventListener('input',sync);
    sync();
  }

  function plannedMealInventoryOptions(selectedId=''){
    const collator=new Intl.Collator('de-DE',{sensitivity:'base',numeric:true});
    const rows=[...(state?.inventory||[])]
      .filter(item=>item?.is_active!==false)
      .sort((a,b)=>{
        const aq=Math.max(0,Number(a?.quantity)||0);
        const bq=Math.max(0,Number(b?.quantity)||0);
        return (bq>0?1:0)-(aq>0?1:0)||collator.compare(String(a?.catalog_family_name||a?.family_name||a?.name||''),String(b?.catalog_family_name||b?.family_name||b?.name||''))||collator.compare(String(a?.name||''),String(b?.name||''));
      });
    return '<option value="">Vorratszutat auswählen</option>'+rows.map(item=>{
      const available=String(item.quantity_label||'').trim();
      const family=String(item.catalog_family_name||item.family_name||'').trim();
      const variant=String(item.catalog_variant_label||item.variant_label||'').trim();
      const parts=[family&&family!==item.name?family:null,variant&&variant!==item.name?variant:null,item.name].filter(Boolean);
      const label=[...new Set(parts)].join(' · ')+(available?' · '+available:'');
      return '<option value="'+esc(item.id)+'" data-unit="'+esc(item.unit||'')+'" '+(String(item.id)===String(selectedId||'')?'selected':'')+'>'+esc(label)+'</option>';
    }).join('');
  }

  function plannedMealAddedIngredientRow(){
    return '<div class="food-planned-add-row-v758" data-food-planned-add-row>'
      +'<span><strong>Neue Zutat</strong><small>Nur diese eingeplante Mahlzeit</small></span>'
      +'<div class="food-planned-add-controls-v758">'
        +'<select data-food-planned-add-inventory>'+plannedMealInventoryOptions()+'</select>'
        +'<input data-food-planned-add-quantity type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="Menge">'
        +'<input data-food-planned-add-unit placeholder="g, ml, Stück …">'
        +'<button type="button" class="food-planned-remove-v729" data-food-planned-add-remove>Entfernen</button>'
      +'</div>'
    +'</div>';
  }

  function editPlannedMealQuantitiesModal(mealId){
    const meal=(state?.meals||[]).find(item=>String(item.id)===String(mealId));
    if(!meal){alert('Mahlzeit nicht gefunden.');return;}
    if(!meal.recipe_id){alert('Diese Mahlzeit stammt nicht aus einem Rezept.');return;}
    if(normalizedStatus(meal.status)==='completed'){alert('Bereits gebuchte Mahlzeiten werden nicht nachträglich verändert.');return;}

    const items=meal.ingredients||[];
    if(!items.length){alert('Für diese Mahlzeit sind keine Zutaten hinterlegt.');return;}

    let modal;
    const rows=items.map((item,index)=>{
      const quantity=num(item.quantity);
      const value=quantity===null||Number.isNaN(quantity)?'':String(quantity);
      return '<div class="food-planned-qty-row-v630" data-food-planned-qty-row data-ingredient-id="'+esc(item.id)+'" data-food-planned-removed="false">'
        +'<span><strong>'+esc(ingredientName(item))+'</strong><small data-food-planned-qty-note>Nur diese Einplanung</small></span>'
        +'<span class="food-planned-qty-controls-v729"><input type="number" min="0.01" step="0.01" inputmode="decimal" value="'+esc(value)+'" '+(value?'':'placeholder="offen"')+'><b>'+esc(item.unit||'')+'</b><button type="button" class="food-planned-remove-v729" data-food-planned-remove aria-pressed="false">Entfernen</button></span>'
      +'</div>';
    }).join('');

    const body='<form class="food-recipe-form-v549">'
      +'<p class="food-modal-copy-v544"><strong>'+esc(meal.title)+'</strong><br>Hier änderst du Mengen, entfernst Zutaten oder fügst etwas aus deinem Vorrat hinzu. Alles gilt nur für diese geplante Mahlzeit. Das Grundrezept bleibt unverändert.</p>'
      +'<div class="food-planned-qty-list-v630">'+rows+'</div>'
      +'<div class="food-planned-add-list-v758" data-food-planned-add-list></div>'
      +'<button type="button" class="food-action-v544 compact food-planned-add-button-v758" data-food-planned-add>+ Zutat aus Vorrat hinzufügen</button>'
      +'<button class="food-action-v544" type="submit">Änderungen speichern</button>'
      +'</form>';

    modal=addModal('Zutaten & Mengen dieser Mahlzeit ändern',body,async()=>{
      if(!sourceIsReal('meals'))throw new Error('Die Mahlzeitdaten sind gerade nicht sicher mit der Cloud synchronisiert. Bitte zuerst neu laden.');

      const existingChanges=[...modal.querySelectorAll('[data-food-planned-qty-row]')].map((row,index)=>{
        const id=String(row.dataset.ingredientId||'');
        if(!id)throw new Error('Zutat '+(index+1)+' konnte nicht zugeordnet werden.');
        if(row.dataset.foodPlannedRemoved==='true')return {id,remove:true};

        const input=row.querySelector('input');
        const raw=String(input?.value??'').trim();
        if(!raw)return null;
        const quantity=Number(raw);
        if(!Number.isFinite(quantity)||quantity<=0)throw new Error('Bei Zutat '+(index+1)+' ist die Menge ungültig.');
        return {id,quantity};
      }).filter(Boolean);

      const addChanges=[...modal.querySelectorAll('[data-food-planned-add-row]')].map((row,index)=>{
        const inventoryId=String(row.querySelector('[data-food-planned-add-inventory]')?.value||'').trim();
        const raw=String(row.querySelector('[data-food-planned-add-quantity]')?.value||'').trim();
        const unit=String(row.querySelector('[data-food-planned-add-unit]')?.value||'').trim();
        if(!inventoryId&&!raw&&!unit)return null;
        if(!inventoryId)throw new Error('Bei neuer Zutat '+(index+1)+' fehlt die Auswahl aus dem Vorrat.');
        const quantity=Number(raw);
        if(!Number.isFinite(quantity)||quantity<=0)throw new Error('Bei neuer Zutat '+(index+1)+' fehlt eine gültige Menge.');
        if(!unit)throw new Error('Bei neuer Zutat '+(index+1)+' fehlt die Einheit.');
        return {add:true,inventory_id:inventoryId,quantity,unit};
      }).filter(Boolean);

      const changes=[...existingChanges,...addChanges];
      if(!changes.length)throw new Error('Es gibt keine Änderung zum Speichern.');

      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const result=await withTimeout(
        supabase.rpc('update_food_planned_meal_quantities',{p_meal_id:meal.id,p_quantities:changes}),
        'Mahlzeit aktualisieren',
        10000
      );
      if(result.error)throw result.error;
      expandedMeals.add(String(meal.id));
      await mutate(()=>result.data);
    });

    modal.querySelectorAll('[data-food-planned-remove]').forEach(button=>button.addEventListener('click',()=>{
      const row=button.closest('[data-food-planned-qty-row]');
      if(!row)return;
      const removeNext=row.dataset.foodPlannedRemoved!=='true';
      row.dataset.foodPlannedRemoved=removeNext?'true':'false';
      row.classList.toggle('is-removed-v729',removeNext);
      const input=row.querySelector('input');
      if(input)input.disabled=removeNext;
      const note=row.querySelector('[data-food-planned-qty-note]');
      if(note)note.textContent=removeNext?'Wird beim Speichern entfernt':'Nur diese Einplanung';
      button.textContent=removeNext?'Zurückholen':'Entfernen';
      button.setAttribute('aria-pressed',removeNext?'true':'false');
    }));

    const addList=modal.querySelector('[data-food-planned-add-list]');
    const wireAddedRow=row=>{
      const select=row.querySelector('[data-food-planned-add-inventory]');
      const unit=row.querySelector('[data-food-planned-add-unit]');
      select?.addEventListener('change',()=>{
        const inventory=(state?.inventory||[]).find(item=>String(item.id)===String(select.value));
        if(unit&&!unit.value)unit.value=inventory?.unit||select.selectedOptions?.[0]?.dataset?.unit||'';
      });
      row.querySelector('[data-food-planned-add-remove]')?.addEventListener('click',()=>row.remove());
    };
    modal.querySelector('[data-food-planned-add]')?.addEventListener('click',()=>{
      addList?.insertAdjacentHTML('beforeend',plannedMealAddedIngredientRow());
      const row=addList?.lastElementChild;
      if(row){wireAddedRow(row);row.querySelector('select')?.focus();}
    });
  }

  const recipeInventoryOptionLabel=item=>{
    const family=String(item?.family_name||'').trim();
    if(!family)return String(item?.name||'Vorrat').trim();
    const variant=String(item?.variant_label||item?.name||'Variante').trim();
    return family+' → '+variant;
  };

  function recipeIngredientRow(index){
    const options=sourceIsReal('inventory')
      ?(state?.inventory||[]).filter(item=>item.is_active!==false).map(item=>'<option value="'+esc(item.id)+'">'+esc(recipeInventoryOptionLabel(item))+'</option>').join('')
      :'';
    return '<div class="food-recipe-ingredient-row-v549" data-food-recipe-row>'+
      '<div class="food-recipe-row-head-v549"><strong>Zutat '+(index+1)+'</strong><button type="button" data-food-recipe-remove aria-label="Zutat entfernen">×</button></div>'+
      '<label>Aus Vorrat wählen<select data-food-recipe-inventory><option value="">Eigene Zutat eingeben</option>'+options+'</select></label>'+
      '<label>Name<input data-food-recipe-name placeholder="z. B. Paprika" required></label>'+
      '<div class="food-form-grid-v544"><label>Menge<input data-food-recipe-quantity type="number" min="0.01" step="0.01" inputmode="decimal" required></label><label>Einheit<input data-food-recipe-unit value="g" placeholder="g, ml, Stück …" required></label></div>'+
      '</div>';
  }

  function wireRecipeIngredientRow(row){
    const select=row.querySelector('[data-food-recipe-inventory]');
    const name=row.querySelector('[data-food-recipe-name]');
    const unit=row.querySelector('[data-food-recipe-unit]');
    const sync=()=>{
      const item=(state?.inventory||[]).find(entry=>entry.id===select?.value);
      if(item){
        name.value=String(item.family_name||'').trim()||item.name;
        name.readOnly=true;
        if(item.unit)unit.value=item.unit;
        unit.readOnly=true;
      }else{
        name.readOnly=false;
        unit.readOnly=false;
        if(select?.value==='')name.value='';
      }
    };
    select?.addEventListener('change',sync);
  }

  function addRecipeModal(){
    let modal;
    const body='<form class="food-recipe-form-v549">'+
      '<label>Rezeptname<input name="title" placeholder="z. B. Hähnchen-Brokkoli-Pfanne" required></label>'+
      '<div class="food-form-grid-v544"><label>Kategorie<select name="meal_type">'+recipeCategoryOptions('dinner')+'</select></label><label>Basis-Portionen<input name="servings" type="number" min="1" max="99" step="1" inputmode="numeric" value="1" required></label></div>'+
      '<div class="food-form-grid-v544"><label>Vorbereitung / Kochen in Min.<input name="prep_minutes" type="number" min="0" max="1440" step="1" inputmode="numeric" placeholder="z. B. 30"></label><label>Kurzinfo<input name="description" placeholder="z. B. schnell, sättigend, Meal Prep"></label></div>'+
      '<label>Zubereitung<textarea name="instructions" rows="5" placeholder="Jeden Schritt in eine neue Zeile.\nHack anbraten\nGemüse dazugeben\n10 Minuten köcheln"></textarea></label>'+
      '<div class="food-recipe-builder-v549"><div class="food-recipe-builder-head-v549"><strong>Zutaten</strong><button type="button" data-food-recipe-add-ingredient>+ Zutat</button></div><div data-food-recipe-rows>'+recipeIngredientRow(0)+'</div></div>'+
      '<button class="food-action-v544" type="submit">Rezept speichern</button>'+
      '</form>';

    modal=addModal('Rezept hinzufügen',body,async form=>{
      if(!sourceIsReal('recipes'))throw new Error('Die Rezeptdaten sind gerade nicht sicher mit der Cloud synchronisiert. Bitte zuerst „Erneut laden“ verwenden.');
      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const session=await withTimeout(supabase.auth.getSession(),'Anmeldung',2500);
      const user=session?.data?.session?.user;
      if(session?.error||!user?.id)throw new Error('Nicht angemeldet.');

      const title=String(form.get('title')||'').trim();
      const mealType=String(form.get('meal_type')||'dinner');
      const servings=Number(form.get('servings')||1);
      if(!RECIPE_CATEGORY_ORDER.includes(mealType))throw new Error('Bitte eine gültige Rezeptkategorie wählen.');
      const prepMinutes=form.get('prep_minutes')?Number(form.get('prep_minutes')):null;
      const description=String(form.get('description')||'').trim()||null;
      const instructions=String(form.get('instructions')||'').trim()||null;
      if(!title)throw new Error('Bitte einen Rezeptnamen eingeben.');
      if(!Number.isInteger(servings)||servings<1||servings>99)throw new Error('Bitte eine gültige Portionszahl zwischen 1 und 99 eingeben.');
      if(prepMinutes!==null&&(!Number.isFinite(prepMinutes)||prepMinutes<0||prepMinutes>1440))throw new Error('Die Zeitangabe ist ungültig.');

      const ingredientRows=Array.from(modal.querySelectorAll('[data-food-recipe-row]'));
      if(!ingredientRows.length)throw new Error('Bitte mindestens eine Zutat hinzufügen.');
      const ingredients=ingredientRows.map((row,index)=>{
        const inventoryId=String(row.querySelector('[data-food-recipe-inventory]')?.value||'')||null;
        const inventoryItem=inventoryId?(state?.inventory||[]).find(item=>item.id===inventoryId):null;
        const name=String(row.querySelector('[data-food-recipe-name]')?.value||'').trim();
        const quantity=Number(row.querySelector('[data-food-recipe-quantity]')?.value);
        const unit=String(row.querySelector('[data-food-recipe-unit]')?.value||'').trim();
        if(!name)throw new Error('Bei Zutat '+(index+1)+' fehlt der Name.');
        if(!Number.isFinite(quantity)||quantity<=0)throw new Error('Bei Zutat '+(index+1)+' fehlt eine gültige Menge.');
        if(!unit)throw new Error('Bei Zutat '+(index+1)+' fehlt die Einheit.');
        if(inventoryId&&!inventoryItem)throw new Error('Die ausgewählte Vorratszutat ist nicht mehr verfügbar.');
        const family=String(inventoryItem?.family_name||'').trim();
        const storedName=family||name;
        return {user_id:user.id,inventory_id:family?null:inventoryId,name:storedName,label:fmtQty(quantity,unit)+' '+storedName,quantity,unit,sort_order:index+1};
      });

      let recipe=null;
      const recipeResult=await withTimeout(
        supabase.from('food_recipes').insert({user_id:user.id,title,meal_type:mealType,description,servings,prep_minutes:prepMinutes,instructions,active:true}).select('id,title,meal_type,description,servings,prep_minutes,instructions,active,created_at').single(),
        'Rezept speichern',
        8000
      );
      if(recipeResult?.error){
        if(recipeResult.error.code==='23505')throw new Error('Ein Rezept mit diesem Namen gibt es bereits.');
        throw recipeResult.error;
      }
      recipe=recipeResult.data;

      const ingredientPayload=ingredients.map(item=>({...item,recipe_id:recipe.id}));
      const ingredientResult=await withTimeout(
        supabase.from('food_recipe_ingredients').insert(ingredientPayload).select('id,recipe_id,inventory_id,name,label,quantity,unit,sort_order'),
        'Rezeptzutaten speichern',
        8000
      );
      if(ingredientResult?.error){
        try{await supabase.from('food_recipes').delete().eq('id',recipe.id);}catch(_){}
        throw ingredientResult.error;
      }

      const created={...recipe,food_recipe_ingredients:ingredientResult.data||[]};
      state.recipes=[created,...(state?.recipes||[]).filter(item=>item.id!==recipe.id)];
      sourceState.recipes='cloud';
      renderState();
      return created;
    });

    const rows=modal.querySelector('[data-food-recipe-rows]');
    Array.from(rows.querySelectorAll('[data-food-recipe-row]')).forEach(wireRecipeIngredientRow);
    modal.querySelector('[data-food-recipe-add-ingredient]')?.addEventListener('click',()=>{
      const index=rows.querySelectorAll('[data-food-recipe-row]').length;
      rows.insertAdjacentHTML('beforeend',recipeIngredientRow(index));
      const row=rows.lastElementChild;
      wireRecipeIngredientRow(row);
      row.querySelector('[data-food-recipe-name]')?.focus();
    });
    rows.addEventListener('click',event=>{
      const remove=event.target?.closest?.('[data-food-recipe-remove]');
      if(!remove)return;
      const all=rows.querySelectorAll('[data-food-recipe-row]');
      if(all.length<=1){alert('Ein Rezept braucht mindestens eine Zutat.');return;}
      remove.closest('[data-food-recipe-row]')?.remove();
      rows.querySelectorAll('[data-food-recipe-row]').forEach((row,index)=>{
        const strong=row.querySelector('.food-recipe-row-head-v549 strong');
        if(strong)strong.textContent='Zutat '+(index+1);
      });
    });
  }

  function editRecipeModal(recipeId){
    const recipe=(state?.recipes||[]).find(item=>String(item.id)===String(recipeId));
    if(!recipe){alert('Rezept nicht gefunden.');return;}
    const items=recipe.food_recipe_ingredients||recipe.ingredients||[];
    let modal;
    const rowsHtml=(items.length?items:[{}]).map((_,index)=>recipeIngredientRow(index)).join('');
    const body='<form class="food-recipe-form-v549">'+
      '<label>Rezeptname<input name="title" value="'+esc(recipe.title||'')+'" required></label>'+
      '<div class="food-form-grid-v544"><label>Kategorie<select name="meal_type">'+recipeCategoryOptions(recipe.meal_type||'dinner')+'</select></label><label>Basis-Portionen<input name="servings" type="number" min="1" max="99" step="1" inputmode="numeric" value="'+esc(recipe.servings||1)+'" required></label></div>'+
      '<div class="food-form-grid-v544"><label>Vorbereitung / Kochen in Min.<input name="prep_minutes" type="number" min="0" max="1440" step="1" inputmode="numeric" value="'+esc(recipe.prep_minutes??'')+'"></label><label>Kurzinfo<input name="description" value="'+esc(recipe.description||'')+'"></label></div>'+
      '<label>Zubereitung<textarea name="instructions" rows="5">'+esc(recipeInstructions(recipe).join('\n'))+'</textarea></label>'+
      '<div class="food-recipe-builder-v549"><div class="food-recipe-builder-head-v549"><strong>Zutaten</strong><button type="button" data-food-recipe-add-ingredient>+ Zutat</button></div><div data-food-recipe-rows>'+rowsHtml+'</div></div>'+
      '<button class="food-action-v544" type="submit">Änderungen speichern</button>'+
      '</form>';

    modal=addModal('Rezept bearbeiten',body,async form=>{
      if(!sourceIsReal('recipes'))throw new Error('Die Rezeptdaten sind gerade nicht sicher mit der Cloud synchronisiert. Bitte zuerst „Erneut laden“ verwenden.');
      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');

      const title=String(form.get('title')||'').trim();
      const mealType=String(form.get('meal_type')||'dinner');
      const servings=Number(form.get('servings')||1);
      if(!RECIPE_CATEGORY_ORDER.includes(mealType))throw new Error('Bitte eine gültige Rezeptkategorie wählen.');
      const prepMinutes=form.get('prep_minutes')?Number(form.get('prep_minutes')):null;
      const description=String(form.get('description')||'').trim()||null;
      const instructions=String(form.get('instructions')||'').trim()||null;
      if(!title)throw new Error('Bitte einen Rezeptnamen eingeben.');
      if(!Number.isInteger(servings)||servings<1||servings>99)throw new Error('Bitte eine gültige Portionszahl zwischen 1 und 99 eingeben.');
      if(prepMinutes!==null&&(!Number.isFinite(prepMinutes)||prepMinutes<0||prepMinutes>1440))throw new Error('Die Zeitangabe ist ungültig.');

      const ingredientRows=Array.from(modal.querySelectorAll('[data-food-recipe-row]'));
      if(!ingredientRows.length)throw new Error('Bitte mindestens eine Zutat hinzufügen.');
      const ingredients=ingredientRows.map((row,index)=>{
        const inventoryId=String(row.querySelector('[data-food-recipe-inventory]')?.value||'')||null;
        const inventoryItem=inventoryId?(state?.inventory||[]).find(item=>item.id===inventoryId):null;
        const name=String(row.querySelector('[data-food-recipe-name]')?.value||'').trim();
        const quantity=Number(row.querySelector('[data-food-recipe-quantity]')?.value);
        const unit=String(row.querySelector('[data-food-recipe-unit]')?.value||'').trim();
        if(!name)throw new Error('Bei Zutat '+(index+1)+' fehlt der Name.');
        if(!Number.isFinite(quantity)||quantity<=0)throw new Error('Bei Zutat '+(index+1)+' fehlt eine gültige Menge.');
        if(!unit)throw new Error('Bei Zutat '+(index+1)+' fehlt die Einheit.');
        if(inventoryId&&!inventoryItem)throw new Error('Die ausgewählte Vorratszutat ist nicht mehr verfügbar.');
        const family=String(inventoryItem?.family_name||'').trim();
        const storedName=family||name;
        return {inventory_id:family?null:inventoryId,name:storedName,label:fmtQty(quantity,unit)+' '+storedName,quantity,unit};
      });

      const result=await withTimeout(
        supabase.rpc('update_food_recipe',{
          p_recipe_id:recipeId,
          p_title:title,
          p_meal_type:mealType,
          p_servings:servings,
          p_prep_minutes:prepMinutes,
          p_description:description,
          p_instructions:instructions,
          p_ingredients:ingredients
        }),
        'Rezept aktualisieren',
        10000
      );
      if(result.error)throw result.error;
      await mutate(()=>result.data);
    });

    const rows=modal.querySelector('[data-food-recipe-rows]');
    Array.from(rows.querySelectorAll('[data-food-recipe-row]')).forEach((row,index)=>{
      const item=items[index];
      const select=row.querySelector('[data-food-recipe-inventory]');
      const name=row.querySelector('[data-food-recipe-name]');
      const quantity=row.querySelector('[data-food-recipe-quantity]');
      const unit=row.querySelector('[data-food-recipe-unit]');
      if(item){
        if(select&&item.inventory_id)select.value=String(item.inventory_id);
        if(name)name.value=String(item.name||'');
        if(quantity)quantity.value=String(item.quantity??'');
        if(unit)unit.value=String(item.unit||'g');
        if(item.inventory_id){if(name)name.readOnly=true;if(unit)unit.readOnly=true;}
      }
      wireRecipeIngredientRow(row);
    });
    modal.querySelector('[data-food-recipe-add-ingredient]')?.addEventListener('click',()=>{
      const index=rows.querySelectorAll('[data-food-recipe-row]').length;
      rows.insertAdjacentHTML('beforeend',recipeIngredientRow(index));
      const row=rows.lastElementChild;
      wireRecipeIngredientRow(row);
      row.querySelector('[data-food-recipe-name]')?.focus();
    });
    rows.addEventListener('click',event=>{
      const remove=event.target?.closest?.('[data-food-recipe-remove]');
      if(!remove)return;
      const all=rows.querySelectorAll('[data-food-recipe-row]');
      if(all.length<=1){alert('Ein Rezept braucht mindestens eine Zutat.');return;}
      remove.closest('[data-food-recipe-row]')?.remove();
      rows.querySelectorAll('[data-food-recipe-row]').forEach((row,index)=>{
        const strong=row.querySelector('.food-recipe-row-head-v549 strong');
        if(strong)strong.textContent='Zutat '+(index+1);
      });
    });
  }

  function garlicStockModal(){
    const garlic=garlicParts();
    addModal('Knoblauchbestand','<form><p class="food-modal-copy-v544">Knoblauch wird als eine Zutat angezeigt. Ganze Knollen und lose Zehen bleiben intern getrennt.</p><div class="food-form-grid-v544"><label>Ganze Knollen<input name="bulbs" type="number" min="0" step="1" inputmode="numeric" value="'+esc(garlic.bulbs)+'" required></label><label>Lose Zehen<input name="cloves" type="number" min="0" step="1" inputmode="numeric" value="'+esc(garlic.cloves)+'" required></label></div><button class="food-action-v544" type="submit">Knoblauch speichern</button></form>',async form=>{
      const bulbs=Number(form.get('bulbs'));
      const cloves=Number(form.get('cloves'));
      if(!Number.isInteger(bulbs)||bulbs<0||!Number.isInteger(cloves)||cloves<0)throw new Error('Knollen und Zehen bitte als ganze Zahlen eingeben.');
      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const result=await supabase.rpc('set_food_garlic_stock',{p_bulbs:bulbs,p_cloves:cloves});
      if(result.error)throw result.error;
      await mutate(()=>result.data);
    });
  }

  function addInventoryModal(){
    let modal;
    const body='<form><label>Bezeichnung<input name="name" placeholder="z. B. Zucchini oder Knoblauch" required></label>'+
      '<div data-food-generic-stock><div class="food-form-grid-v544"><label>Menge<input name="quantity" type="number" min="0" step="0.01" required></label><label>Einheit<input name="unit" value="g" required></label></div><label><input name="opened" type="checkbox"> bereits geöffnet</label><label>Verwenden<select name="priority"><option value="tomorrow">morgen</option><option value="three_days">in den nächsten 3 Tagen</option><option value="later" selected>später</option></select></label></div>'+
      '<div data-food-garlic-stock hidden><p class="food-modal-copy-v544">Knoblauch ist ein Sonderfall: ganze Knollen und lose Zehen werden gemeinsam angezeigt.</p><div class="food-form-grid-v544"><label>Ganze Knollen<input name="garlic_bulbs" type="number" min="0" step="1" inputmode="numeric" value="0"></label><label>Lose Zehen<input name="garlic_cloves" type="number" min="0" step="1" inputmode="numeric" value="0"></label></div></div>'+
      '<button class="food-action-v544" type="submit">Vorrat speichern</button></form>';
    modal=addModal('Vorrat ergänzen',body,async form=>{
      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const session=await supabase.auth.getSession();const user=session?.data?.session?.user;if(!user?.id)throw new Error('Nicht angemeldet.');
      const name=String(form.get('name')||'').trim();
      const normalized=name.toLocaleLowerCase('de-DE');
      if(normalized.startsWith('knoblauch')){
        const bulbs=Number(form.get('garlic_bulbs')||0);
        const cloves=Number(form.get('garlic_cloves')||0);
        if(!Number.isInteger(bulbs)||bulbs<0||!Number.isInteger(cloves)||cloves<0)throw new Error('Knollen und Zehen bitte als ganze Zahlen eingeben.');
        const result=await supabase.rpc('set_food_garlic_stock',{p_bulbs:bulbs,p_cloves:cloves});
        if(result.error)throw result.error;
        await mutate(()=>result.data);
        return;
      }
      const quantity=Number(form.get('quantity'));const unit=String(form.get('unit')||'g');
      const result=await supabase.from('food_inventory').insert({user_id:user.id,name,quantity,unit,quantity_label:fmtQty(quantity,unit),forecast_label:null,tone:quantity>0?'stock':'empty',note:'Manuell ergänzt',sort_order:999,opened:form.get('opened')==='on',use_priority:String(form.get('priority')||'later')});
      if(result.error)throw result.error;
      await mutate(()=>result.data);
    });
    const nameInput=modal?.querySelector('[name="name"]');
    const generic=modal?.querySelector('[data-food-generic-stock]');
    const garlic=modal?.querySelector('[data-food-garlic-stock]');
    const genericRequired=Array.from(generic?.querySelectorAll('[required]')||[]);
    const sync=()=>{
      const special=String(nameInput?.value||'').trim().toLocaleLowerCase('de-DE').startsWith('knoblauch');
      if(generic)generic.hidden=special;
      if(garlic)garlic.hidden=!special;
      genericRequired.forEach(input=>input.required=!special);
    };
    nameInput?.addEventListener('input',sync);
    sync();
  }

  function adjustModal(id){
    const item=state?.inventory.find(row=>row.id===id);if(!item)return;
    addModal('Menge ändern','<form><p class="food-modal-copy-v544">'+esc(item.name)+'</p><label>Neue Menge<input name="quantity" type="number" min="0" step="0.01" value="'+esc(item.quantity??0)+'" required></label><label>Notiz (optional)<input name="note" placeholder="z. B. verschüttet"></label><button class="food-action-v544" type="submit">Menge speichern</button></form>',async form=>{
      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const result=await supabase.rpc('adjust_food_inventory',{p_inventory_id:id,p_new_quantity:Number(form.get('quantity')),p_reason:'Menge manuell geändert',p_note:String(form.get('note')||'')||null});
      if(result.error)throw result.error;
      if(item.pending_weighing===true){
        const clearPending=await supabase.from('food_inventory').update({pending_weighing:false}).eq('id',id);
        if(clearPending.error)throw clearPending.error;
      }
      await mutate(()=>result.data);
    });
  }


  function weighPendingModal(id){
    const item=state?.inventory.find(row=>row.id===id);if(!item||item.pending_weighing!==true)return;
    const known=Math.max(0,num(item.quantity)||0);
    addModal('Einkauf abwiegen','<form><p class="food-modal-copy-v544"><strong>'+esc(item.name)+'</strong><br>'+(known>0?'Schon sicher im Vorrat: '+esc(fmtQty(known,item.unit))+'. ':'')+'Wiege nur die neu eingekaufte Menge.</p><label>Gewogene Einkaufsmenge ('+esc(item.unit||'g')+')<input name="quantity" type="number" min="0.01" step="0.01" inputmode="decimal" required autofocus></label><button class="food-action-v544" type="submit">Gewicht übernehmen</button></form>',async form=>{
      const measured=Number(form.get('quantity'));
      if(!Number.isFinite(measured)||measured<=0)throw new Error('Bitte eine gültige gewogene Menge eintragen.');
      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const newQuantity=known+measured;
      const result=await supabase.rpc('adjust_food_inventory',{p_inventory_id:id,p_new_quantity:newQuantity,p_reason:'Einkauf nachträglich abgewogen',p_note:null});
      if(result.error)throw result.error;
      const clearPending=await supabase.from('food_inventory').update({
        pending_weighing:false,
        quantity_label:fmtQty(newQuantity,item.unit),
        note:null
      }).eq('id',id);
      if(clearPending.error)throw clearPending.error;
      await mutate(()=>result.data);
    });
  }

  function storageModal(id){
    const item=state?.inventory.find(row=>row.id===id);if(!item)return;
    addModal('Zustand &amp; Verwendung','<form><p class="food-modal-copy-v544">'+esc(item.name)+'</p><label>Zustand<select name="opened"><option value="false" '+(!item.opened?'selected':'')+'>Unangebrochen</option><option value="true" '+(item.opened?'selected':'')+'>Angebrochen</option></select></label><label>Einplanen<select name="priority">'+['tomorrow','three_days','later'].map(value=>'<option value="'+value+'" '+(item.use_priority===value?'selected':'')+'>'+priorityLabel(value)+'</option>').join('')+'</select></label><button class="food-action-v544" type="submit">Speichern</button></form>',async form=>{
      if(!sourceIsReal('inventory'))throw new Error('Der Vorrat wird gerade nur aus Notfalldaten gezeigt. Bitte die Cloud-Verbindung erneut laden.');
      const opened=form.get('opened')==='true';
      const usePriority=String(form.get('priority')||'later');
      const previous={opened:item.opened,use_priority:item.use_priority};

      item.opened=opened;
      item.use_priority=usePriority;
      renderState();

      try{
        const saved=await saveInventoryStorage(id,opened,usePriority);
        item.opened=saved.opened;
        item.use_priority=saved.use_priority;
        sourceState.inventory='cloud';
        cloudIssues=cloudIssues.filter(issue=>!String(issue).startsWith('inventory:'));
        renderState();
        return saved;
      }catch(error){
        item.opened=previous.opened;
        item.use_priority=previous.use_priority;
        renderState();
        const message=error?.message||'Unbekannter Cloud-Fehler';
        throw new Error('Speichern konnte nicht bestätigt werden. Der vorige Zustand wurde wiederhergestellt. '+message);
      }
    });
  }

  function consumeModal(id){
    const item=state?.inventory.find(row=>row.id===id);if(!item)return;
    if(num(item.quantity)===null){alert('Bitte zuerst die vorhandene Menge eintragen.');return;}
    const bottle=item.name==='Pepsi Zero Cherry'&&item.unit==='l';
    const amount=bottle?1.25:1;
    addModal('Verbrauch eintragen','<form><p class="food-modal-copy-v544">'+esc(item.name)+' · vorhanden: '+esc(fmtQty(item.quantity,item.unit))+'</p>'+(bottle?'<p class="food-modal-copy-v544">1 Flasche = 1,25 l</p>':'')+'<label>Verbrauchte Menge ('+esc(item.unit)+')<input name="quantity" type="number" min="0.01" max="'+esc(item.quantity)+'" step="0.01" value="'+amount+'" required></label><button class="food-action-v544" type="submit">Vom Vorrat abziehen</button></form>',async form=>{
      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const quantity=Number(form.get('quantity'));
      if(!Number.isFinite(quantity)||quantity<=0)throw new Error('Bitte eine positive Menge eingeben.');
      const result=await supabase.rpc('consume_food_inventory',{p_inventory_id:id,p_quantity:quantity,p_unit:item.unit,p_expected_quantity:Number(item.quantity)});
      if(result.error)throw result.error;
      await mutate(()=>result.data);
    });
  }

  async function archiveInventory(id){
    const item=state?.inventory.find(row=>row.id===id);if(!item)return;
    if(!confirm('Vorrat "'+item.name+'" entfernen? Du kannst ihn später neu anlegen.'))return;
    const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
    const result=await supabase.rpc('archive_food_inventory',{p_inventory_id:id,p_reason:'Manuell entfernt'});
    if(result.error)throw result.error;
    await mutate(()=>result.data);
  }

  function shoppingModal(){
    addModal('Einkauf ergänzen','<form><label>Was fehlt?<input name="label" placeholder="z. B. Zucchini" required></label><div class="food-form-grid-v544"><label>Menge<input name="quantity" type="number" min="0" step="0.01"></label><label>Einheit<input name="unit" value="Stück"></label></div><button class="food-action-v544" type="submit">Zur Einkaufsliste</button></form>',async form=>{
      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const session=await supabase.auth.getSession();const user=session?.data?.session?.user;if(!user?.id)throw new Error('Nicht angemeldet.');
      const result=await supabase.from('food_shopping_items').insert({user_id:user.id,label:String(form.get('label')).trim(),quantity:form.get('quantity')?Number(form.get('quantity')):null,unit:String(form.get('unit')||'')||null});
      if(result.error)throw result.error;
      await mutate(()=>result.data);
    });
  }

  function editShoppingModal(id){
    const item=(state?.shopping||[]).find(row=>String(row.id)===String(id));
    if(!item)return;
    addModal('Einkauf bearbeiten','<form><label>Bezeichnung<input name="label" value="'+esc(item.label||'')+'" required></label><div class="food-form-grid-v544"><label>Menge<input name="quantity" type="number" min="0" step="0.01" inputmode="decimal" value="'+esc(item.quantity??'')+'"></label><label>Einheit<input name="unit" value="'+esc(item.unit||'')+'" placeholder="g, ml, Stück …"></label></div><p class="food-modal-copy-v544">Die Änderung gilt nur für diesen Einkaufszettel-Eintrag. Ein zugrunde liegendes Rezept oder eine geplante Mahlzeit wird dadurch nicht verändert.</p><button class="food-action-v544" type="submit">Änderung speichern</button></form>',async form=>{
      const label=String(form.get('label')||'').trim();
      const raw=String(form.get('quantity')||'').trim();
      const quantity=raw===''?null:Number(raw);
      const unit=String(form.get('unit')||'').trim()||null;
      if(!label)throw new Error('Bitte eine Bezeichnung eingeben.');
      if(quantity!==null&&(!Number.isFinite(quantity)||quantity<0))throw new Error('Bitte eine gültige Menge eingeben.');
      if(quantity!==null&&quantity>0&&!unit)throw new Error('Bitte eine Einheit zur Menge eingeben.');
      const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const result=await supabase.from('food_shopping_items').update({
        label,
        quantity,
        unit:quantity===null?unit:unit
      }).eq('id',id);
      if(result.error)throw result.error;
      await mutate(()=>result.data);
    });
  }

  async function deleteShopping(id){
    const item=(state?.shopping||[]).find(row=>String(row.id)===String(id));
    if(!item)return;
    if(!confirm('Einkauf "'+item.label+'" wirklich entfernen?'))return;
    const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
    const result=await supabase.from('food_shopping_items').delete().eq('id',id);
    if(result.error)throw result.error;
    await mutate(()=>result.data);
  }

  async function checkShopping(id){
    const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
    const result=await supabase.from('food_shopping_items').update({checked:true}).eq('id',id);
    if(result.error)throw result.error;
    await mutate(()=>result.data);
  }

  function wire(root){
    root.querySelector('[data-food-inventory-search]')?.addEventListener('input',event=>{
      inventorySearch=String(event.currentTarget.value||'');
      renderState();
      const next=ensureRoot()?.querySelector('[data-food-inventory-search]');
      if(next){
        next.focus();
        const end=String(next.value||'').length;
        try{next.setSelectionRange(end,end);}catch(_){}
      }
    });
    root.querySelector('[data-food-empty-group]')?.addEventListener('toggle',event=>{
      if(String(inventorySearch||'').trim())return;
      unavailableInventoryOpen=event.currentTarget.open;
    });
    root.querySelectorAll('[data-food-stock-card]').forEach(card=>card.addEventListener('click',event=>{
      if(event.target?.closest?.('button,input,select,textarea,label'))return;
      const id=String(card.dataset.foodStockCard);
      if(expandedInventory.has(id))expandedInventory.delete(id);else expandedInventory.add(id);
      renderState();
    }));
    root.querySelectorAll('[data-food-plan-day]').forEach(day=>day.addEventListener('toggle',()=>{
      const date=String(day.dataset.foodPlanDay||'');
      if(!date)return;
      if(day.open)expandedPlanDays.add(date);else expandedPlanDays.delete(date);
    }));
    root.querySelectorAll('[data-food-weigh]').forEach(button=>button.addEventListener('click',()=>weighPendingModal(button.dataset.foodWeigh)));
    root.querySelectorAll('[data-food-creatine-confirm]').forEach(button=>button.addEventListener('click',async event=>{
      event.stopPropagation();
      const date=String(button.dataset.foodCreatineConfirm||'');
      const choice=button.closest('.food-creatine-reminder-v768')?.querySelector('[data-food-creatine-choice]');
      const inventoryId=String(choice?.value||button.dataset.foodCreatineInventory||'');
      root.querySelectorAll('[data-food-creatine-confirm]').forEach(btn=>{
        if(btn.dataset.foodCreatineConfirm===date)btn.disabled=true;
      });
      button.textContent='Wird gebucht …';
      try{await confirmCreatineIntake(date,inventoryId);}
      catch(error){
        alert(error?.message||'Kreatin konnte nicht gebucht werden.');
        loadPromise=null;
        await render();
      }
    }));
    root.querySelectorAll('[data-food-meal-toggle]').forEach(button=>button.addEventListener('click',()=>{const id=String(button.dataset.foodMealToggle);if(expandedMeals.has(id))expandedMeals.delete(id);else expandedMeals.add(id);renderState();}));
    root.querySelectorAll('[data-food-meal-card]').forEach(card=>card.addEventListener('click',event=>{
      if(event.target?.closest?.('button,input,select,textarea,label'))return;
      const id=String(card.dataset.foodMealCard);
      if(expandedMeals.has(id))expandedMeals.delete(id);else expandedMeals.add(id);
      renderState();
    }));
    root.querySelectorAll('[data-food-cart-toggle]').forEach(button=>button.addEventListener('click',async event=>{
      event.stopPropagation();
      button.disabled=true;
      try{await toggleShoppingCart(button.dataset.foodCartToggle,button.getAttribute('aria-pressed')==='true');}
      catch(error){alert(error?.message||'Einkaufswagen konnte nicht aktualisiert werden.');button.disabled=false;}
    }));
    root.querySelectorAll('[data-food-stock-gap]').forEach(button=>button.addEventListener('click',()=>stockGapModal(button)));
    root.querySelectorAll('[data-food-open-garlic]').forEach(button=>button.addEventListener('click',()=>openGarlicModal(button.dataset.foodOpenGarlic)));
    root.querySelectorAll('[data-food-garlic-adjust]').forEach(button=>button.addEventListener('click',()=>garlicStockModal()));
    root.querySelectorAll('[data-food-storage]').forEach(button=>button.addEventListener('click',()=>storageModal(button.dataset.foodStorage)));
    root.querySelectorAll('[data-food-tab]').forEach(button=>button.addEventListener('click',()=>{activeTab=button.dataset.foodTab;render();}));
    root.querySelectorAll('[data-food-recipe-category]').forEach(button=>button.addEventListener('click',()=>{
      activeRecipeCategory=String(button.dataset.foodRecipeCategory||'breakfast');
      expandedRecipes.clear();
      renderState();
    }));
    root.querySelectorAll('[data-food-complete]').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;try{await completeMeal(button.dataset.foodComplete);}catch(error){alert(error?.message||'Mahlzeit konnte nicht abgeschlossen werden.');button.disabled=false;}}));
    root.querySelectorAll('[data-food-thaw-start]').forEach(button=>button.addEventListener('click',async event=>{
      event.stopPropagation();
      if(button.getAttribute('aria-pressed')==='true')return;
      button.disabled=true;
      try{await startThawing(button.dataset.foodThawStart);}
      catch(error){alert(error?.message||'Auftaustatus konnte nicht gespeichert werden.');button.disabled=false;}
    }));
    root.querySelectorAll('[data-food-edit-free-meal]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();editFreeMealModal(button.dataset.foodEditFreeMeal);}));
    root.querySelectorAll('[data-food-edit-planned-meal]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();editPlannedMealQuantitiesModal(button.dataset.foodEditPlannedMeal);}));
    root.querySelectorAll('[data-food-allocation-edit]').forEach(button=>button.addEventListener('click',event=>{
      event.stopPropagation();
      allocationQuantityModal(button.dataset.foodAllocationEdit,button.dataset.foodAllocationIndex);
    }));
    root.querySelectorAll('[data-food-remove-meal-ingredient]').forEach(button=>button.addEventListener('click',async event=>{
      event.stopPropagation();
      button.disabled=true;
      try{await removeMealIngredient(button.dataset.foodRemoveMealIngredient);}
      catch(error){alert(error?.message||'Zutat konnte nicht entfernt werden.');button.disabled=false;}
    }));
    root.querySelectorAll('[data-food-rate-recipe]').forEach(button=>button.addEventListener('click',async event=>{
      event.stopPropagation();
      button.disabled=true;
      try{await setRecipeRating(button.dataset.foodRateRecipe,Number(button.dataset.foodRating));}
      catch(error){alert(error?.message||'Bewertung konnte nicht gespeichert werden.');button.disabled=false;}
    }));
    root.querySelectorAll('[data-food-edit-recipe]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();editRecipeModal(button.dataset.foodEditRecipe);}));
    root.querySelectorAll('[data-food-schedule]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();scheduleModal(button.dataset.foodSchedule);}));
    root.querySelectorAll('[data-food-schedule-leftover]').forEach(button=>button.addEventListener('click',()=>scheduleLeftoverModal(button.dataset.foodScheduleLeftover)));
    root.querySelectorAll('[data-food-recipe-toggle]').forEach(button=>button.addEventListener('click',event=>{
      event.stopPropagation();
      const id=String(button.dataset.foodRecipeToggle);
      if(expandedRecipes.has(id))expandedRecipes.delete(id);else expandedRecipes.add(id);
      renderState();
    }));
    root.querySelectorAll('[data-food-recipe-card]').forEach(card=>card.addEventListener('click',event=>{
      if(event.target?.closest?.('button,input,select,textarea,label'))return;
      const id=String(card.dataset.foodRecipeCard);
      if(expandedRecipes.has(id))expandedRecipes.delete(id);else expandedRecipes.add(id);
      renderState();
    }));
    root.querySelectorAll('[data-food-adjust]').forEach(button=>button.addEventListener('click',()=>adjustModal(button.dataset.foodAdjust)));
    root.querySelector('[data-food-add-inventory]')?.addEventListener('click',addInventoryModal);
    root.querySelector('[data-food-add-shopping]')?.addEventListener('click',shoppingModal);
    root.querySelector('[data-food-add-recipe]')?.addEventListener('click',addRecipeModal);
    root.querySelectorAll('[data-shopping-check]').forEach(button=>button.addEventListener('click',()=>checkShopping(button.dataset.shoppingCheck).catch(error=>alert(error?.message||'Eintrag konnte nicht geändert werden.'))));
    root.querySelectorAll('[data-food-jump]').forEach(button=>button.addEventListener('click',()=>{activeTab=button.dataset.foodJump;render();}));
    root.querySelector('[data-food-retry]')?.addEventListener('click',()=>{loadPromise=null;render();});
  }

  function paint(root,data){
    const target=root.querySelector('.food-content-v544');
    if(target)target.innerHTML=cloudNotice()+content(data);
    root.querySelectorAll('.food-section-head-v544>div>span').forEach(label=>label.remove());
    if(activeTab==='plan')root.querySelector('.food-section-head-v544 small')?.remove();
    decorateCards(root);
    wire(root);
    return true;
  }

  function renderState(){
    ++renderSerial;
    const root=ensureRoot();if(!root||!state)return false;
    root.innerHTML=shell();
    return paint(root,state);
  }

  async function render(){
    const serial=++renderSerial;
    const root=ensureRoot();if(!root)return false;
    root.innerHTML=shell();
    const data=await load();
    if(serial!==renderSerial)return false;
    state=data;
    return paint(root,data);
  }

  function setSurface(active){
    const html=document.documentElement;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(active){
      document.body.classList.add(BODY_CLASS);
      html.classList.add(SURFACE_CLASS);
      document.body.dataset.modAppSurfaceV515='food';
      if(meta)meta.setAttribute('content','#eef3e8');
    }else{
      document.body.classList.remove(BODY_CLASS);
      html.classList.remove(SURFACE_CLASS);
      if(document.body.dataset.modAppSurfaceV515==='food')delete document.body.dataset.modAppSurfaceV515;
      if(meta)meta.setAttribute('content','#0b0d0f');
    }
  }

  function open(){
    cardArcs.clear();
    frostDecor.clear();
    expandedPlanDays.clear();
    expandedInventory.clear();
    inventorySearch='';
    window.__modAppHubV515?.hide?.();
    document.body.classList.remove('mod-backstage-v530');
    setSurface(true);
    ensureRoot()?.setAttribute('aria-hidden','false');
    loadPromise=null;
    render();
    window.scrollTo?.({top:0,left:0,behavior:'instant'});
    return 'food';
  }

  function close(){
    setSurface(false);
    ensureRoot()?.setAttribute('aria-hidden','true');
  }

  function patchHub(){
    const hub=window.__modAppHubV515;
    if(hub&&!hub.__foodPatchedV544){
      const originalShow=hub.show?.bind(hub);
      hub.show=function(){close();return originalShow?.();};
      hub.__foodPatchedV544=true;
    }
    const launcher=window.__modHubLauncherV517||window.__modHubLauncherV540;
    const item=launcher?.modules?.find?.(entry=>entry.id==='food');
    if(item)item.active=true;
    document.querySelectorAll('[data-mod-hub-launch-v517="food"],[data-mod-hub-open="food"]').forEach(button=>{
      button.removeAttribute('aria-disabled');
      button.setAttribute('aria-label','Food öffnen');
    });
  }

  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-mod-hub-launch-v517="food"],[data-mod-hub-open="food"]');
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open();
  },true);

  async function getShoppingSnapshot({refresh=false}={}){
    if(refresh)loadPromise=null;
    const data=await load();
    state=data;
    const gaps=deriveShopping(data);
    const manualFood=(data.shopping||[]).filter(item=>!item.checked);
    const cartKeys=(data.cart||[]).map(item=>String(item.shopping_key||'')).filter(Boolean);
    const overdueMeals=(data.meals||[])
      .filter(meal=>normalizedStatus(meal.status)==='planned'&&String(meal.meal_date||'')<todayIso())
      .sort((a,b)=>String(a.meal_date||'').localeCompare(String(b.meal_date||''))||Number(a.sort_order||0)-Number(b.sort_order||0))
      .map(meal=>({
        id:String(meal.id||''),
        meal_date:meal.meal_date||null,
        meal_type:meal.meal_type||null,
        title:meal.title||'Mahlzeit',
        ingredient_count:Array.isArray(meal.ingredients)?meal.ingredients.length:0
      }));
    // V782: lightweight, bounded-by-date meal demand for pack-specific freezer suggestions.
    // Only planned meals and exact mass units qualify; no inventory is consumed here.
    const freezerWindowStart=todayIso();
    const freezerWindowEnd=plusDays(freezerWindowStart,21);
    const plannedIngredientUses=(data.meals||[])
      .filter(meal=>normalizedStatus(meal.status)==='planned'
        &&String(meal.meal_date||'')>=freezerWindowStart
        &&String(meal.meal_date||'')<=freezerWindowEnd)
      .flatMap(meal=>(meal.ingredients||[])
        .filter(ingredient=>ingredient.inventory_id&&Number(ingredient.quantity)>0
          &&['g','kg'].includes(String(ingredient.unit||'').trim().toLocaleLowerCase('de-DE')))
        .map(ingredient=>({
          inventory_id:String(ingredient.inventory_id),
          meal_date:String(meal.meal_date),
          meal_title:String(meal.title||'Geplante Mahlzeit'),
          quantity:Number(ingredient.quantity),
          unit:String(ingredient.unit)
        })));
    return {
      plannedIngredientUses,
      mealPlanVerified:sourceIsReal('meals'),
      gaps:gaps.map(item=>({...item,uses:Array.isArray(item.uses)?item.uses.map(use=>({...use})):[]})),
      manualFood:manualFood.map(item=>({...item})),
      cartKeys:[...cartKeys],
      inventory:(data.inventory||[]).map(item=>({...item})),
      inventoryAliases:(data.aliases||[]).map(item=>({...item})),
      overdueMeals
    };
  }

  function openShoppingStockModal(details={}){
    const dataset={
      foodStockName:String(details.stockName||details.name||''),
      foodStockQuantity:String(details.stockQuantity??details.quantity??''),
      foodStockUnit:String(details.stockUnit||details.unit||''),
      foodStockId:String(details.stockId||details.inventoryId||''),
      shoppingId:String(details.shoppingId||''),
      shoppingRequired:String(details.shoppingRequired??''),
      foodCartKey:String(details.cartKey||'')
    };
    stockGapModal({dataset});
    const modal=document.querySelector('#'+ROOT_ID+' .food-modal-v544');
    if(modal&&document.body.classList.contains('mod-shopping-v643'))document.body.appendChild(modal);
    return modal||null;
  }

  function resolveIngredientStock(details={}){
    const shared=window.__modFoodStockResolverV746;
    if(!shared?.resolve)return null;
    return shared.resolve({
      item:{
        inventory_id:details.inventory_id||details.inventoryId||null,
        name:details.name||details.label||'',
        label:details.label||details.name||'',
        unit:details.unit||''
      },
      inventoryRows:Array.isArray(details.inventoryRows)?details.inventoryRows:(state?.inventory||[]),
      inventoryAliases:Array.isArray(details.inventoryAliases)?details.inventoryAliases:(state?.aliases||[])
    });
  }

  const api={
    version:VERSION,open,close,render,
    reload(){loadPromise=null;return render();},
    fallbackData:fallback,planningDoesNotConsume:true,receiptExcluded:true,
    getDataSources(){return {...sourceState};},
    getCloudIssues(){return [...cloudIssues];},
    getShoppingSnapshot,
    resolveIngredientStock,
    toggleShoppingCart,
    openShoppingStockModal,
    checkShopping
  };
  window.__modFoodV544=api;
  window.__modFoodV543=api;
  const observer=new MutationObserver(patchHub);
  function init(){ensureRoot()?.setAttribute('aria-hidden','true');patchHub();observer.observe(document.documentElement,{subtree:true,childList:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
