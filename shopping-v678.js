/* V747 · SHOPPING / EXTRA WISHLIST
   Planning, cart, purchase confirmation, receipt linking and product review are separate steps.
   MHD belongs to the concrete purchase lot, never to the reusable product master.
*/
(function(){
  'use strict';
  if(window.__modShoppingV678)return;

  const VERSION='V781';
  const ROOT_ID='modShoppingV643';
  const BODY_CLASS='mod-shopping-v643';
  const SURFACE_CLASS='mod-shopping-surface-v643';
  const CATEGORIES=['Lebensmittel','Getränke','Haushalt','Drogerie','Technik','Sonstiges'];

  let state={general:[],food:null,reviews:[],products:[],aliases:[],substitutions:[],checkouts:[],checkoutItems:[],checkoutReceipts:[],receipts:[],financeItems:[],loading:false,error:'',foodError:''};
  let loadPromise=null;
  let rowMap=new Map();
  let hubPatched=false;
  let originalHubShow=null;
  let originalHubOpen=null;
  let tapFeedbackBound=false;

  const esc=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const num=value=>value===null||value===undefined||value===''?null:Number(value);
  const todayIso=()=>{
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  };
  const fmtDate=iso=>{
    if(!iso)return '';
    try{return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',timeZone:'Europe/Berlin'}).format(new Date(String(iso).slice(0,10)+'T12:00:00'));}
    catch(_){return String(iso);}
  };
  const fmtQty=(value,unit='')=>{
    const n=Number(value);
    if(!Number.isFinite(n))return String(value??'');
    const text=new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(n);
    const singular=Math.abs(n-1)<.0001;
    const plurals={Scheibe:'Scheiben',Packung:'Packungen',Flasche:'Flaschen',Zehe:'Zehen',Knolle:'Knollen',Portion:'Portionen',Glas:'Gläser'};
    const displayUnit=!singular&&plurals[unit]?plurals[unit]:unit;
    return (text+(displayUnit?' '+displayUnit:'')).trim();
  };
  const normalizedIngredient=(name,unit='')=>{
    const normalized=String(name||'').trim().toLocaleLowerCase('de-DE');
    if(String(unit||'').trim()==='Zehe'&&(normalized==='knoblauch'||normalized==='knoblauchzehen'))return 'knoblauchzehen';
    if(normalized==='pfeffer'||normalized==='pfeffer schwarz')return 'pfeffer schwarz';
    return normalized;
  };
  const foodGapKey=item=>{
    const unit=String(item?.unit||'').trim();
    const window=':'+(item?.buyFrom||'any');
    if(item?.inventory_id)return 'stock:'+String(item.inventory_id)+':'+unit.toLocaleLowerCase('de-DE')+window;
    return 'free:'+normalizedIngredient(item?.label||item?.name,unit)+':'+unit.toLocaleLowerCase('de-DE')+window;
  };
  const manualFoodKey=item=>'manual:'+String(item?.id||'');

  function client(){
    try{return typeof window.getSupabaseClient==='function'?window.getSupabaseClient():null;}
    catch(_){return null;}
  }

  function ensureRoot(){
    let root=document.getElementById(ROOT_ID);
    if(root)return root;
    const app=document.querySelector('main.app');
    if(!app)return null;
    root=document.createElement('section');
    root.id=ROOT_ID;
    root.className='mod-shopping-root-v643';
    root.hidden=true;
    root.setAttribute('aria-hidden','true');
    root.setAttribute('aria-label','Einkaufsliste');
    app.appendChild(root);
    return root;
  }

  function setSurface(active){
    const html=document.documentElement;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(active){
      document.body.classList.add(BODY_CLASS);
      html.classList.add(SURFACE_CLASS);
      document.body.dataset.modAppSurfaceV515='shopping';
      if(meta)meta.setAttribute('content','#111823');
    }else{
      document.body.classList.remove(BODY_CLASS);
      html.classList.remove(SURFACE_CLASS);
      if(document.body.dataset.modAppSurfaceV515==='shopping')delete document.body.dataset.modAppSurfaceV515;
      if(meta)meta.setAttribute('content','#0b0d0f');
    }
  }

  async function loadData({refreshFood=true}={}){
    if(loadPromise)return loadPromise;
    state.loading=true;
    state.error='';
    render();
    loadPromise=(async()=>{
      const supabase=client();
      if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
      const session=await supabase.auth.getSession();
      const user=session?.data?.session?.user;
      if(session?.error||!user?.id)throw new Error('Cloud-Sitzung ist nicht verfügbar.');

      const generalResult=await supabase.from('shopping_items')
        .select('id,label,quantity,unit,category,status,return_status,source,source_key,needed_by,notes,sort_order,created_at,updated_at,completed_at')
        .neq('status','done')
        .order('sort_order',{ascending:true})
        .order('created_at',{ascending:true});
      if(generalResult.error)throw generalResult.error;
      state.general=Array.isArray(generalResult.data)?generalResult.data:[];

      const [reviewResult,productResult,aliasResult]=await Promise.all([
        supabase.from('shopping_receipt_reviews')
          .select('id,finance_item_id,checkout_id,checkout_item_id,retailer,receipt_label,normalized_label,status,product_id,notes,inventory_applied_at,created_at,updated_at,resolved_at')
          .in('status',['pending','new_product_pending'])
          .order('created_at',{ascending:false}),
        supabase.from('shopping_products')
          .select('id,retailer,brand,product_name,variant,category,package_quantity,package_unit,barcode,inventory_id,nutrition_per_100,product_data,notes,active,servings_per_package,serving_quantity,serving_unit')
          .eq('active',true)
          .order('retailer',{ascending:true})
          .order('product_name',{ascending:true}),
        supabase.from('shopping_receipt_aliases')
          .select('id,retailer,receipt_label,normalized_label,product_id,is_default,active')
          .eq('active',true)
      ]);
      if(reviewResult.error)throw reviewResult.error;
      if(productResult.error)throw productResult.error;
      if(aliasResult.error)throw aliasResult.error;
      state.reviews=Array.isArray(reviewResult.data)?reviewResult.data:[];
      state.products=Array.isArray(productResult.data)?productResult.data:[];
      state.aliases=Array.isArray(aliasResult.data)?aliasResult.data:[];

      const substitutionResult=await supabase.from('shopping_substitutions')
        .select('id,shopping_key,source,original_label,original_quantity,original_unit,replacement_label,replacement_quantity,replacement_unit,replacement_inventory_id,replacement_product_id,status,note,created_at,updated_at')
        .in('status',['cart','purchased'])
        .order('created_at',{ascending:true});
      if(substitutionResult.error)throw substitutionResult.error;
      state.substitutions=Array.isArray(substitutionResult.data)?substitutionResult.data:[];

      const reviewFinanceIds=state.reviews.map(item=>item.finance_item_id).filter(Boolean);
      if(reviewFinanceIds.length){
        const financeItemsResult=await supabase.from('finance_items')
          .select('id,item_name,quantity,unit,unit_price,total_price')
          .in('id',reviewFinanceIds);
        if(financeItemsResult.error)throw financeItemsResult.error;
        state.financeItems=Array.isArray(financeItemsResult.data)?financeItemsResult.data:[];
      }else{
        state.financeItems=[];
      }

      const [checkoutResult,receiptResult]=await Promise.all([
        supabase.from('shopping_checkouts')
          .select('id,finance_transaction_id,status,retailer,total_amount,completed_at,created_at,updated_at')
          .in('status',['awaiting_receipt','review'])
          .order('completed_at',{ascending:false}),
        supabase.from('finance_transactions')
          .select('id,transaction_date,transaction_time,merchant,total_amount,currency,receipt_source,created_at')
          .order('transaction_date',{ascending:false})
          .order('transaction_time',{ascending:false})
          .limit(8)
      ]);
      if(checkoutResult.error)throw checkoutResult.error;
      if(receiptResult.error)throw receiptResult.error;
      state.checkouts=Array.isArray(checkoutResult.data)?checkoutResult.data:[];
      state.receipts=Array.isArray(receiptResult.data)?receiptResult.data:[];
      const checkoutIds=state.checkouts.map(item=>item.id);
      if(checkoutIds.length){
        const checkoutItemsResult=await supabase.from('shopping_checkout_items')
          .select('id,checkout_id,shopping_key,label,quantity,unit,source,planned_quantity,planned_unit,inventory_id,product_id,best_before_date,best_before_status,package_count,purchase_data,inventory_applied_at,note,substitution_id,original_label,original_quantity,original_unit,created_at')
          .in('checkout_id',checkoutIds)
          .order('created_at',{ascending:true});
        if(checkoutItemsResult.error)throw checkoutItemsResult.error;
        state.checkoutItems=Array.isArray(checkoutItemsResult.data)?checkoutItemsResult.data:[];
        const checkoutReceiptsResult=await supabase.from('shopping_checkout_receipts')
          .select('id,checkout_id,finance_transaction_id,created_at')
          .in('checkout_id',checkoutIds)
          .order('created_at',{ascending:true});
        if(checkoutReceiptsResult.error)throw checkoutReceiptsResult.error;
        state.checkoutReceipts=Array.isArray(checkoutReceiptsResult.data)?checkoutReceiptsResult.data:[];
      }else{
        state.checkoutItems=[];
        state.checkoutReceipts=[];
      }

      state.foodError='';
      try{
        const foodApi=window.__modFoodV544;
        if(!foodApi?.getShoppingSnapshot)throw new Error('Food-Einkaufsmodell ist noch nicht geladen.');
        state.food=await foodApi.getShoppingSnapshot({refresh:refreshFood});
      }catch(error){
        console.warn('V646 Shopping Food-Bridge:',error);
        state.food=null;
        state.foodError=error?.message||String(error);
      }
      state.loading=false;
      return state;
    })().catch(error=>{
      console.error('V646 Shopping:',error);
      state.loading=false;
      state.error=error?.message||String(error);
      return state;
    }).finally(()=>{
      loadPromise=null;
      render();
    });
    return loadPromise;
  }

  function inventoryQuantityInUnit(stock,targetUnit){
    if(!stock)return {available:0,unitMismatch:false,converted:false};
    const quantity=Math.max(0,num(stock.quantity)||0);
    const sourceUnit=String(stock.unit||'').trim();
    const target=String(targetUnit||'').trim();
    if(sourceUnit===target)return {available:quantity,unitMismatch:false,converted:false};
    if(sourceUnit==='kg'&&target==='g')return {available:quantity*1000,unitMismatch:false,converted:true};
    if(sourceUnit==='g'&&target==='kg')return {available:quantity/1000,unitMismatch:false,converted:true};
    if(sourceUnit==='l'&&target==='ml')return {available:quantity*1000,unitMismatch:false,converted:true};
    if(sourceUnit==='ml'&&target==='l')return {available:quantity/1000,unitMismatch:false,converted:true};
    return {available:0,unitMismatch:true,converted:false};
  }

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
  const familyNeedModeFromName=name=>{
    const text=' '+familyText(name)+' ';
    if(/\s(?:tk|tiefkühl|tiefgekühlt|tiefgefroren|gefroren)\s/.test(text))return 'frozen';
    if(/\s(?:frisch|frische|frischer|frisches|bio)\s/.test(text))return 'fresh';
    return 'generic';
  };
  function inventoryFamilyRowsInfo(familyName,targetUnit,rows,mode='generic'){
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
  }
  function inventoryFamilyStockInfo(name,targetUnit,rows){
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
  }
  function ingredientStockInfo(name,unit,inventory,inventoryByName){
    const central=window.__modFoodV544?.resolveIngredientStock?.({
      name,
      unit,
      inventoryRows:inventory,
      inventoryAliases:state.food?.inventoryAliases||[]
    });
    if(central)return central;
    const exact=inventoryByName.get(normalizedIngredient(name,unit))||null;
    if(exact?.family_name){
      return {...inventoryFamilyRowsInfo(exact.family_name,unit,inventory,familyNeedModeFromName(name)),stock:null};
    }
    if(exact)return {...inventoryQuantityInUnit(exact,unit),stock:exact,family:false,rows:[exact]};
    const familyInfo=inventoryFamilyStockInfo(name,unit,inventory);
    return {...familyInfo,stock:null};
  }


  function foodUsageTimeline(uses,unit){
    const byDate=new Map();
    (uses||[]).forEach(use=>byDate.set(use.date,(byDate.get(use.date)||0)+(Number(use.quantity)||0)));
    return [...byDate.entries()]
      .sort((a,b)=>String(a[0]).localeCompare(String(b[0])))
      .map(([date,quantity])=>fmtDate(date)+' '+fmtQty(quantity,unit))
      .join(' · ');
  }

  function buildRows(){
    const rows=[];
    const food=state.food||{gaps:[],manualFood:[],cartKeys:[],inventory:[]};
    const cartSet=new Set((food.cartKeys||[]).map(String));
    const inventory=(food.inventory||[]).filter(item=>item.is_active!==false);
    const inventoryByName=new Map(inventory.map(item=>[normalizedIngredient(item.name,item.unit),item]));
    const pendingCheckoutKeys=new Set((state.checkoutItems||[]).map(item=>String(item.shopping_key||'')));
    const purchasedSubstitutionKeys=new Set((state.substitutions||[]).filter(item=>item.status==='purchased').map(item=>String(item.shopping_key||'')));
    const derivedKeys=new Set();

    (food.gaps||[]).forEach(item=>{
      const key=foodGapKey(item);
      if(pendingCheckoutKeys.has(key)||purchasedSubstitutionKeys.has(key))return;
      const inCart=cartSet.has(key);
      const delayed=Boolean(item.buyFrom&&String(item.buyFrom)>todayIso());
      const stockName=item.garlic?item.purchaseName:item.label;
      const stockQuantity=item.garlic?item.purchaseQuantity:item.missing;
      const stockUnit=item.garlic?item.purchaseUnit:item.unit;
      const stockId=item.garlic?item.purchaseInventoryId:item.inventory_id;
      const buyQuantity=item.garlic?item.purchaseQuantity:item.missing;
      const buyUnit=item.garlic?item.purchaseUnit:item.unit;
      derivedKeys.add(normalizedIngredient(item.label,item.unit)+'|'+String(item.unit||'').toLocaleLowerCase('de-DE'));
      const usePlan=foodUsageTimeline(item.uses,item.unit);
      const currentAvailable=Math.max(0,Number(item.currentAvailable??item.available)||0);
      const windowAvailable=Math.max(0,Number(item.available)||0);
      const preWindowPlanned=Math.max(0,currentAvailable-windowAvailable);
      const reservedNote=currentAvailable>windowAvailable+.0001
        ?' · davor bereits '+fmtQty(preWindowPlanned,item.unit)+' eingeplant · danach '+fmtQty(windowAvailable,item.unit)+' für diesen Einkaufsblock übrig'
        :'';
      rows.push({
        id:'food-gap:'+key,key,source:'food-gap',label:item.label||'Lebensmittel',
        section:inCart?'cart':(delayed?'later':'now'),inCart,
        primary:'Kaufen '+fmtQty(buyQuantity,buyUnit),
        currentStock:'Aktuell im Vorrat '+fmtQty(currentAvailable,item.unit),
        secondary:(usePlan?'Bedarf: '+usePlan:'Planbedarf '+fmtQty(item.required,item.unit))+reservedNote,
        timing:item.shortageDate
          ?((delayed?'Kaufen ab '+fmtDate(item.buyFrom)+' · ':'')+'Fehlt ab '+fmtDate(item.shortageDate))
          :(delayed?'Kaufen ab '+fmtDate(item.buyFrom):''),
        buyFrom:item.buyFrom||null,neededDate:item.shortageDate||null,
        category:'Lebensmittel',
        foodAction:{
          stockName,stockQuantity,stockUnit,stockId,cartKey:key
        },
        flags:{converted:!!item.convertedStock,unitMismatch:!!item.unitMismatch}
      });
    });

    (food.manualFood||[]).forEach(item=>{
      const required=num(item.quantity);
      const unit=String(item.unit||'').trim();
      const duplicateKey=normalizedIngredient(item.label,unit)+'|'+unit.toLocaleLowerCase('de-DE');
      if(derivedKeys.has(duplicateKey))return;
      const key=manualFoodKey(item);
      if(pendingCheckoutKeys.has(key)||purchasedSubstitutionKeys.has(key))return;
      const inCart=cartSet.has(key);
      let primary=required&&unit?'Kaufen '+fmtQty(required,unit):'Manueller Food-Eintrag';
      let secondary='';
      let foodAction=null;
      let flags={converted:false,unitMismatch:false};

      if(required!==null&&required>0&&unit){
        const info=ingredientStockInfo(item.label,unit,inventory,inventoryByName);
        const stock=info.stock||null;
        if(stock?.pending_weighing===true)return;
        const missing=Math.max(0,required-info.available);
        if(missing<=0)return;
        primary='Kaufen '+fmtQty(missing,unit);
        secondary='Aktuell gebucht '+fmtQty(info.available,unit)+' · Bedarf '+fmtQty(required,unit);
        foodAction={
          stockName:item.label,stockQuantity:missing,stockUnit:unit,
          stockId:(info.family||info.unitMismatch)?'':(stock?.id||''),shoppingId:item.id,
          shoppingRequired:required,cartKey:key
        };
        flags={converted:info.converted,unitMismatch:info.unitMismatch};
      }

      rows.push({
        id:'food-manual:'+item.id,key,source:'food-manual',label:item.label||'Food',
        section:inCart?'cart':'now',inCart,primary,secondary,timing:'',
        buyFrom:null,neededDate:null,
        category:'Lebensmittel',foodAction,shoppingId:item.id,flags
      });
    });

    (state.general||[]).forEach(item=>{
      // Food demand is derived live from meals + inventory. Audit snapshots must never become a second shopping source.
      if(item.source==='food-audit')return;
      const section=item.status==='cart'?'cart':item.status==='later'?'later':item.status==='extra'?'extra':'now';
      const quantity=item.quantity!==null&&item.quantity!==undefined?fmtQty(item.quantity,item.unit||''):'';
      const isStockup=item.source==='food-stockup';
      const secondary=isStockup
        ?('Heute kaufen'+(item.needed_by?' · Bedarf '+fmtDate(item.needed_by):''))
        :(item.notes||'');
      const timing=isStockup
        ?''
        :(item.needed_by?'Benötigt '+fmtDate(item.needed_by):'');
      rows.push({
        id:'general:'+item.id,key:'general:'+item.id,source:'general',label:item.label,
        section,inCart:section==='cart',primary:section==='extra'?(quantity||item.category||'Wunsch'):(quantity?('Kaufen '+quantity):'Kaufen'),
        secondary,timing,
        buyFrom:item.status==='later'?(item.needed_by||null):null,neededDate:item.needed_by||null,
        category:item.category||'Sonstiges',general:item,flags:{stockup:isStockup}
      });
    });

    const substitutionsByKey=new Map((state.substitutions||[]).map(item=>[String(item.shopping_key||''),item]));
    rows.forEach(row=>{row.substitution=substitutionsByKey.get(String(row.key||''))||null;});

    const collator=new Intl.Collator('de-DE',{sensitivity:'base',numeric:true});
    rows.sort((a,b)=>collator.compare(String(a.label||''),String(b.label||'')));
    rowMap=new Map(rows.map(row=>[row.id,row]));
    return rows;
  }

  function cartIcon(){
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 9.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 7H7"/><circle cx="10" cy="19" r="1.4"/><circle cx="18" cy="19" r="1.4"/></svg>';
  }

  function rowMarkup(row){
    const badges=[
      row.category?'<span>'+esc(row.category)+'</span>':'',
      row.source==='food-gap'?'<span>PLAN</span>':'',
      row.flags?.stockup?'<span>VORRAT</span>':'',
      row.flags?.converted?'<span>UMGERECHNET</span>':'',
      row.flags?.unitMismatch?'<span class="is-warn">EINHEIT PRÜFEN</span>':'',
      row.substitution?'<span class="is-substitute-v698">ERSATZ</span>':''
    ].filter(Boolean).join('');

    const completeAction=row.inCart
      ?''
      :row.source==='general'
        ?'<button type="button" data-shopping-done="'+esc(row.id)+'">✓ Erledigt</button>'
        :row.foodAction
          ?'<button type="button" data-shopping-food-complete="'+esc(row.id)+'">Vorrat korrigieren</button>'
          :'<button type="button" data-shopping-food-check="'+esc(row.id)+'">✓ Abhaken</button>';

    const postpone=row.source==='general'&&row.section!=='cart'&&row.section!=='extra'
      ?'<button type="button" data-shopping-later="'+esc(row.id)+'">'+(row.section==='later'?'Heute':'Später')+'</button>'
      :'';

    const remove=row.source==='general'
      ?'<button type="button" class="is-quiet" data-shopping-delete="'+esc(row.id)+'">Entfernen</button>'
      :'';

    const substituteAction=row.section!=='later'&&row.section!=='extra'
      ?'<button type="button" class="'+(row.substitution?'is-substitute-v698':'')+'" data-shopping-substitute="'+esc(row.id)+'">'+(row.substitution?'Ersatz ändern':'Ersatz')+'</button>'
      :'';

    const substitution=row.substitution
      ?'<div class="shopping-substitute-v698"><span aria-hidden="true">↳</span><div><small>ERSATZ GEKAUFT</small><strong>'+esc(row.substitution.replacement_label||'Ersatzartikel')+'</strong></div><b>'+esc(fmtQty(row.substitution.replacement_quantity,row.substitution.replacement_unit||''))+'</b></div>'
      :'';

    return '<article class="shopping-item-v643 '+(row.inCart?'is-cart ':'')+(row.substitution?'has-substitution-v698':'')+'">'
      +'<div class="shopping-item-main-v643"><strong>'+esc(row.label)+'</strong><b>'+esc(row.primary||'')+'</b></div>'
      +substitution
      +'<button type="button" class="shopping-cart-v643 '+(row.inCart?'is-active':'')+'" data-shopping-cart="'+esc(row.id)+'" aria-label="'+(row.inCart?'Aus dem Einkaufswagen':'In den Einkaufswagen')+'" aria-pressed="'+row.inCart+'">'+cartIcon()+'</button>'
      +'<div class="shopping-item-meta-v643 '+(row.currentStock?'has-stock-lines-v701 has-stock-lines-v755':'')+'">'
      +(row.currentStock?'<span class="shopping-current-stock-v701">'+esc(row.currentStock)+'</span>':'')
      +'<span>'+esc(row.secondary||row.timing||'')+'</span>'
      +(row.secondary&&row.timing?'<em>'+esc(row.timing)+'</em>':'')
      +'</div>'
      +'<div class="shopping-item-foot-v643"><div class="shopping-badges-v643">'+badges+'</div><div class="shopping-actions-v643">'+postpone+substituteAction+completeAction+remove+'</div></div>'
      +'</article>';
  }

  function sectionMarkup(id,title,subtitle,rows,footerAction=''){
    return '<section class="shopping-section-v643 is-'+id+'">'
      +'<header><div><span>'+esc(title)+'</span><small>'+esc(subtitle)+'</small></div><strong>'+rows.length+'</strong></header>'
      +(rows.length?'<div class="shopping-list-v643">'+rows.map(rowMarkup).join('')+'</div>':'<div class="shopping-empty-v643">Gerade leer.</div>')
      +(footerAction?'<div class="shopping-section-footer-v646">'+footerAction+'</div>':'')
      +'</section>';
  }

  function addEntryActionMarkup(){
    return '<button type="button" class="shopping-add-entry-v683" data-shopping-add>'
      +'<span>＋</span><strong>Eintrag hinzufügen</strong>'
      +'</button>';
  }

  function checkoutActionMarkup(){
    return '<button type="button" class="shopping-checkout-action-v646" data-shopping-checkout>'
      +'<span class="shopping-checkout-check-v646">2</span>'
      +'<span><strong>Kauf vormerken</strong><small>Mengen, Packungen und MHD festhalten · Bestand erst nach Bonprüfung</small></span>'
      +'<b aria-hidden="true">›</b>'
      +'</button>';
  }

  function fmtGroupDate(iso){
    if(!iso)return 'Ohne festen Einkaufstag';
    try{
      const text=new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Berlin'}).format(new Date(String(iso).slice(0,10)+'T12:00:00'));
      return 'Kaufen am '+text;
    }catch(_){return 'Kaufen am '+String(iso);}
  }

  function laterSectionMarkup(rows){
    if(!rows.length)return sectionMarkup('later','SPÄTER EINKAUFEN','nach Einkaufstag gebündelt',rows);
    const groups=new Map();
    rows.forEach(row=>{
      const key=row.buyFrom||'undated';
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(row);
    });
    const keys=[...groups.keys()].sort((a,b)=>{
      if(a==='undated')return 1;
      if(b==='undated')return -1;
      return a.localeCompare(b);
    });
    return '<section class="shopping-section-v643 is-later">'
      +'<header><div><span>SPÄTER EINKAUFEN</span><small>nach Einkaufstag gebündelt</small></div><strong>'+rows.length+'</strong></header>'
      +'<div class="shopping-date-groups-v678">'
      +keys.map(key=>{
        const group=groups.get(key)||[];
        return '<details class="shopping-date-group-v678">'
          +'<summary><span>'+esc(fmtGroupDate(key==='undated'?null:key))+'</span><strong>'+group.length+'</strong></summary>'
          +'<div class="shopping-list-v643">'+group.map(rowMarkup).join('')+'</div>'
          +'</details>';
      }).join('')
      +'</div></section>';
  }

  function purchasedMarkup(){
    const checkouts=state.checkouts||[];
    const money=value=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(value)||0);
    const when=value=>{
      try{return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}).format(new Date(value));}
      catch(_){return '';}
    };
    if(!checkouts.length){
      return '<section class="shopping-section-v643 is-purchased-v647 is-phase-empty-v700">'
        +'<header><div><span>PHASE 3 · KASSENBONS</span><small>nach „Kauf vormerken“ Bons zuordnen · mehrere Bons möglich</small></div><strong>0</strong></header>'
        +'<div class="shopping-phase-empty-v700">Nach dem Vormerken erscheint dein Einkauf hier. Dann kannst du einen oder mehrere Kassenbons gemeinsam auswählen.</div>'
        +'</section>';
    }
    return '<section class="shopping-section-v643 is-purchased-v647">'
      +'<header><div><span>PHASE 3 · KASSENBONS</span><small>gekaufter Einkauf · ein oder mehrere Bons zuordnen</small></div><strong>'+checkouts.length+'</strong></header>'
      +'<div class="shopping-purchased-list-v647">'
      +checkouts.map(checkout=>{
        const openCount=(state.reviews||[]).filter(review=>String(review.checkout_id||'')===String(checkout.id)).length;
        const receiptCount=(state.checkoutReceipts||[]).filter(link=>String(link.checkout_id||'')===String(checkout.id)).length;
        const stateText=receiptCount
          ?('✓ '+receiptCount+' '+(receiptCount===1?'Bon':'Bons')+' verknüpft · '+(openCount===1?'1 Produkt in Phase 4':openCount+' Produkte in Phase 4'))
          :'Noch kein Bon zugeordnet';
        return '<article class="shopping-purchased-row-v647">'
          +'<div class="shopping-purchased-store-v647"><small>'+esc(when(checkout.completed_at))+'</small><strong>'+esc(checkout.retailer||'Einkauf')+'</strong></div>'
          +'<b>'+(checkout.total_amount===null||checkout.total_amount===undefined?'—':esc(money(checkout.total_amount)))+'</b>'
          +'<span>'+esc(stateText)+'</span>'
          +'<button type="button" data-checkout-attach-receipt="'+esc(checkout.id)+'">'+(receiptCount?'BONS ERGÄNZEN':'BONS ZUORDNEN')+'</button>'
          +'</article>';
      }).join('')
      +'</div></section>';
  }

  function productLabel(product){
    if(!product)return 'Unbekanntes Produkt';
    const head=[product.brand,product.product_name,product.variant].filter(Boolean).join(' · ');
    const pack=product.package_quantity!==null&&product.package_quantity!==undefined
      ?fmtQty(product.package_quantity,product.package_unit||'')
      :'';
    return [head,pack].filter(Boolean).join(' · ');
  }

  function reviewCandidate(review){
    if(!review)return null;
    const direct=review.product_id?(state.products||[]).find(p=>String(p.id)===String(review.product_id)):null;
    if(direct)return direct;
    const checkoutItem=review.checkout_item_id?(state.checkoutItems||[]).find(item=>String(item.id)===String(review.checkout_item_id)):null;
    const fromPurchase=checkoutItem?.product_id?(state.products||[]).find(p=>String(p.id)===String(checkoutItem.product_id)):null;
    if(fromPurchase)return fromPurchase;
    const normalized=String(review.normalized_label||'').trim();
    const retailer=String(review.retailer||'').trim().toLocaleLowerCase('de-DE');
    const alias=(state.aliases||[]).find(a=>
      a.is_default===true
      &&String(a.normalized_label||'')===normalized
      &&String(a.retailer||'').trim().toLocaleLowerCase('de-DE')===retailer
    );
    return alias?(state.products||[]).find(p=>String(p.id)===String(alias.product_id))||null:null;
  }

  function financeItemForReview(review){
    return (state.financeItems||[]).find(item=>String(item.id)===String(review?.finance_item_id))||null;
  }

  function checkoutItemForReview(review){
    if(!review?.checkout_item_id)return null;
    return (state.checkoutItems||[]).find(item=>String(item.id)===String(review.checkout_item_id))||null;
  }

  function tracksFoodInventory(product){
    if(!product)return false;
    if(product.inventory_id)return true;
    if(String(product.product_data?.inventory_scope||'').toLocaleLowerCase('de-DE')==='food')return true;
    return !['haushalt','drogerie','technik','sonstiges','dienstleistung'].includes(String(product.category||'').toLocaleLowerCase('de-DE'));
  }

  function purchaseDetailsForReview(review,candidate){
    const item=checkoutItemForReview(review);
    const productData=candidate?.product_data||{};
    const purchaseData=item?.purchase_data&&typeof item.purchase_data==='object'?item.purchase_data:{};
    const status=String(item?.best_before_status||(item?.best_before_date?'date':'unknown'));
    const innerCount=Number(productData.inner_units_total)||0;
    const innerQty=Number(productData.inner_unit_quantity_g||candidate?.serving_quantity)||0;
    const innerUnit=String(candidate?.serving_unit||candidate?.package_unit||'g');
    const parts=[];
    if(innerCount>1&&innerQty>0)parts.push(innerCount+' × '+fmtQty(innerQty,innerUnit)+' = '+fmtQty(innerCount*innerQty,innerUnit));
    else if(item?.quantity!==null&&item?.quantity!==undefined)parts.push('Menge '+fmtQty(item.quantity,item.unit||''));
    if(purchaseData.weight_class)parts.push('Gewichtsklasse '+purchaseData.weight_class);
    if(status==='date'&&item?.best_before_date)parts.push('MHD '+fmtDate(item.best_before_date));
    else if(status==='none')parts.push('kein MHD vorhanden');
    else if(tracksFoodInventory(candidate))parts.push('MHD offen');
    return {
      item,purchaseData,status,innerCount,innerQty,innerUnit,
      ready:!tracksFoodInventory(candidate)||status==='date'||status==='none',
      summary:parts.join(' · ')
    };
  }

  async function savePurchaseDetails(reviewId,productId,payload){
    const {supabase}=await currentUser();
    const result=await supabase.rpc('set_shopping_review_purchase_details',{
      p_review_id:reviewId,
      p_product_id:productId,
      p_quantity:payload.quantity,
      p_unit:payload.unit,
      p_package_count:payload.packageCount,
      p_best_before_status:payload.bestBeforeStatus,
      p_best_before_date:payload.bestBeforeDate,
      p_purchase_data:payload.purchaseData||{}
    });
    if(result.error)throw result.error;
    await reload({refreshFood:false});
    return result.data;
  }

  function openPurchaseDetails(reviewId,forcedProductId=null){
    const review=(state.reviews||[]).find(item=>String(item.id)===String(reviewId));
    if(!review)return;
    const candidate=forcedProductId
      ?(state.products||[]).find(product=>String(product.id)===String(forcedProductId))
      :reviewCandidate(review);
    if(!candidate){openProductPicker(reviewId);return;}

    document.getElementById('shoppingPurchaseDetailsV756')?.remove();
    const existing=checkoutItemForReview(review);
    const finance=financeItemForReview(review);
    const productData=candidate.product_data||{};
    const oldPurchase=existing?.purchase_data&&typeof existing.purchase_data==='object'?existing.purchase_data:{};
    const receiptCount=Math.max(1,Number(finance?.quantity)||1);
    const innerCount=Math.max(0,Number(productData.inner_units_total)||0);
    const innerQty=Math.max(0,Number(productData.inner_unit_quantity_g||candidate.serving_quantity)||0);
    const innerUnit=String(candidate.serving_unit||candidate.package_unit||'g');
    const autoQuantity=candidate.package_quantity?Number(candidate.package_quantity)*receiptCount:null;
    const quantity=Number(existing?.quantity)>0?Number(existing.quantity):(autoQuantity||Number(finance?.quantity)||1);
    const unit=String(existing?.unit||candidate.package_unit||finance?.unit||'Stück');
    const packageCount=Number(existing?.package_count)>0
      ?Number(existing.package_count)
      :(innerCount>1?Math.max(1,Math.round(innerCount*receiptCount)):Math.max(1,Math.round(receiptCount)));
    const mhdStatus=String(existing?.best_before_status||(existing?.best_before_date?'date':'unknown'));
    const mhdDate=existing?.best_before_date?String(existing.best_before_date).slice(0,10):'';
    const pieceWeights=productData.piece_weights_g&&typeof productData.piece_weights_g==='object'?productData.piece_weights_g:null;
    const weightKeys=pieceWeights?Object.keys(pieceWeights):[];
    const selectedWeight=String(oldPurchase.weight_class||'');

    const structure=innerCount>1&&innerQty>0
      ?'<div class="shopping-purchase-structure-v756"><span>PACKUNGSAUFTEILUNG</span><strong>'+esc(receiptCount+' Verkaufspackung'+(receiptCount===1?'':'en')+' · '+(innerCount*receiptCount)+' Einzelbecher × '+fmtQty(innerQty,innerUnit)+' = '+fmtQty(innerCount*innerQty*receiptCount,innerUnit))+'</strong><small>Die Einzelbecher werden im Vorrat getrennt zählbar geführt.</small></div>'
      :'';

    const weight=weightKeys.length
      ?'<fieldset class="shopping-purchase-weight-v756"><legend>Gewichtsklasse</legend><div>'+weightKeys.map(key=>'<label><input type="radio" name="purchaseWeightClass" value="'+esc(key)+'" '+(key===selectedWeight?'checked':'')+'><span>'+esc(key)+' · '+esc(fmtQty(pieceWeights[key],'g'))+' je Ei</span></label>').join('')+'</div></fieldset>'
      :'';

    const modal=document.createElement('div');
    modal.id='shoppingPurchaseDetailsV756';
    modal.className='shopping-modal-v643 shopping-purchase-modal-v756';
    modal.innerHTML='<div class="shopping-modal-card-v643 shopping-purchase-card-v756">'
      +'<div class="shopping-modal-head-v643"><div><span>PHASE 4 · KAUFDETAILS</span><strong>'+esc(review.receipt_label||'Bonposition')+'</strong></div><button type="button" data-purchase-close>✕</button></div>'
      +'<div class="shopping-purchase-product-v756"><span>ZUGEORDNETES PRODUKT</span><strong>'+esc(productLabel(candidate))+'</strong><small>'+esc(review.retailer||'Händler')+' · diese Händler-/Bon-Zuordnung wird beim Bestätigen gelernt.</small></div>'
      +structure
      +'<form data-purchase-form-v756>'
      +'<div class="shopping-purchase-grid-v756">'
        +'<label>Gekaufte Menge<input data-purchase-qty type="number" min="0.01" step="0.01" inputmode="decimal" value="'+esc(quantity)+'"></label>'
        +'<label>Einheit<input data-purchase-unit value="'+esc(unit)+'"></label>'
        +'<label>Einzelpackungen<input data-purchase-packages type="number" min="1" step="1" inputmode="numeric" value="'+esc(packageCount)+'"></label>'
      +'</div>'
      +weight
      +'<fieldset class="shopping-purchase-mhd-v756"><legend>MHD</legend>'
        +'<label class="shopping-purchase-mhd-choice-v756"><input type="radio" name="purchaseMhdMode" value="date" '+(mhdStatus==='date'?'checked':'')+'><span>MHD vorhanden</span></label>'
        +'<input data-purchase-mhd-date type="date" value="'+esc(mhdDate)+'">'
        +'<label class="shopping-purchase-mhd-choice-v756"><input type="radio" name="purchaseMhdMode" value="none" '+(mhdStatus==='none'?'checked':'')+'><span>Kein MHD vorhanden</span></label>'
        +(mhdStatus==='unknown'?'<small class="is-open-v756">Bitte einmal festlegen, bevor der Bestand gebucht wird.</small>':'')
      +'</fieldset>'
      +'<div class="shopping-purchase-actions-v756"><button type="button" class="is-quiet" data-purchase-change-product>Produkt ändern</button><button type="submit">Kaufdetails speichern</button></div>'
      +'</form></div>';
    document.body.appendChild(modal);

    const close=()=>modal.remove();
    modal.querySelector('[data-purchase-close]')?.addEventListener('click',close);
    modal.addEventListener('click',event=>{if(event.target===modal)close();});
    modal.querySelector('[data-purchase-change-product]')?.addEventListener('click',()=>{close();openProductPicker(review.id);});
    modal.querySelector('[data-purchase-form-v756]')?.addEventListener('submit',async event=>{
      event.preventDefault();
      const form=event.currentTarget;
      const submit=form.querySelector('button[type="submit"]');
      if(submit)submit.disabled=true;
      try{
        const q=Number(form.querySelector('[data-purchase-qty]')?.value);
        const u=String(form.querySelector('[data-purchase-unit]')?.value||'').trim();
        const pc=Number(form.querySelector('[data-purchase-packages]')?.value);
        const mode=String(form.querySelector('input[name="purchaseMhdMode"]:checked')?.value||'');
        const date=String(form.querySelector('[data-purchase-mhd-date]')?.value||'').trim()||null;
        if(!Number.isFinite(q)||q<=0)throw new Error('Bitte eine gekaufte Menge größer 0 eintragen.');
        if(!u)throw new Error('Bitte eine Einheit eintragen.');
        if(!Number.isInteger(pc)||pc<=0)throw new Error('Bitte die Zahl der Einzelpackungen als ganze Zahl angeben.');
        if(!mode)throw new Error('Bitte MHD eintragen oder „Kein MHD vorhanden“ wählen.');
        if(mode==='date'&&!date)throw new Error('Bitte das MHD-Datum eintragen.');

        const purchaseData={...oldPurchase};
        if(weightKeys.length){
          const selected=form.querySelector('input[name="purchaseWeightClass"]:checked')?.value||'';
          if(!selected)throw new Error('Bitte die Gewichtsklasse auswählen.');
          purchaseData.weight_class=selected;
          purchaseData.piece_weight_g=Number(pieceWeights[selected])||null;
        }
        if(innerCount>1&&innerQty>0){
          purchaseData.outer_package_count=receiptCount;
          purchaseData.inner_units_total=innerCount*receiptCount;
          purchaseData.inner_unit_quantity=innerQty;
          purchaseData.inner_unit_unit=innerUnit;
          purchaseData.inner_units_openable=productData.inner_units_openable!==false;
        }
        await savePurchaseDetails(review.id,candidate.id,{
          quantity:q,unit:u,packageCount:pc,
          bestBeforeStatus:mode,bestBeforeDate:mode==='date'?date:null,
          purchaseData
        });
        close();
      }catch(error){
        if(submit)submit.disabled=false;
        alert(error?.message||'Kaufdetails konnten nicht gespeichert werden.');
      }
    });
  }

  function money(value){
    const n=Number(value);
    return Number.isFinite(n)?new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n):'';
  }

  function receiptMeta(review){
    const item=financeItemForReview(review);
    if(!item)return {qty:'',detail:''};
    const quantity=Number(item.quantity);
    const qty=Number.isFinite(quantity)&&quantity>0
      ?new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(quantity)+'×'
      :'';
    const unitPrice=money(item.unit_price);
    const totalPrice=money(item.total_price);
    const detail=qty&&unitPrice&&totalPrice&&Math.abs(quantity-1)>.0001
      ?qty+' '+unitPrice+' · '+totalPrice
      :[qty,totalPrice].filter(Boolean).join(' · ');
    return {qty,detail};
  }

  function flashTap(button){
    if(!button||button.disabled)return;
    button.classList.remove('is-tap-feedback-v649');
    void button.offsetWidth;
    button.classList.add('is-tap-feedback-v649');
    window.setTimeout(()=>button.classList.remove('is-tap-feedback-v649'),180);
  }

  function reviewMarkup(){
    const reviews=[...(state.reviews||[])].sort((a,b)=>{
      const ac=reviewCandidate(a)?0:(a.status==='new_product_pending'?2:1);
      const bc=reviewCandidate(b)?0:(b.status==='new_product_pending'?2:1);
      return ac-bc||String(a.receipt_label||'').localeCompare(String(b.receipt_label||''),'de');
    });
    if(!reviews.length){
      return '<section id="shoppingReviewV647" class="shopping-review-v644 is-empty"><header><div><span>PHASE 4 · BON & PRODUKTE PRÜFEN</span><small>erscheint, sobald ein Bon mit dem Einkauf verknüpft ist</small></div><strong>0</strong></header><div class="shopping-review-empty-v644">Keine Produktzuordnung offen.</div></section>';
    }
    return '<section id="shoppingReviewV647" class="shopping-review-v644"><header><div><span>PHASE 4 · BON & PRODUKTE PRÜFEN</span><small>Bontext dem Produktstamm zuordnen · mit ✓ Passt wird der Food-Bestand genau einmal gebucht</small></div><strong>'+reviews.length+'</strong></header><div class="shopping-review-list-v644">'
      +reviews.map(review=>{
        const candidate=reviewCandidate(review);
        const pending=review.status==='new_product_pending';
        const receipt=receiptMeta(review);
        return '<article class="shopping-review-item-v644 '+(pending?'is-pending-data':'')+'">'
          +'<div class="shopping-review-copy-v644"><small>'+esc(review.retailer||'Händler')+(receipt.detail?' · '+esc(receipt.detail):'')+'</small><strong>'+esc(review.receipt_label||'Bonposition')+'</strong>'
          +(pending
            ?'<span>Fotos / Daten kommen noch · noch keinem Produkt zugeordnet</span>'
            :candidate
              ?'<span>Vorschlag: '+esc(productLabel(candidate))+'</span>'
              :'<span>Noch kein eindeutiger Produktvorschlag</span>')
          +(candidate&&!pending
            ?'<span class="shopping-review-purchase-v756 '+(purchaseDetailsForReview(review,candidate).ready?'is-ready-v756':'is-open-v756')+'">'+esc(purchaseDetailsForReview(review,candidate).summary||'Kaufdetails prüfen')+'</span>'
            :'')
          +'</div><div class="shopping-review-actions-v644">'
          +(candidate&&!pending?'<button type="button" data-review-details="'+esc(review.id)+'">'+(purchaseDetailsForReview(review,candidate).ready?'Kaufdetails':'Kaufdetails ergänzen')+'</button>':'')
          +(candidate&&!pending?'<button type="button" data-review-confirm="'+esc(review.id)+'">✓ Passt & buchen</button>':'')
          +'<button type="button" data-review-choose="'+esc(review.id)+'">Produkt ändern</button>'
          +'<button type="button" data-review-pending="'+esc(review.id)+'">Fotos / Daten kommen noch</button>'
          +'<button type="button" class="is-quiet" data-review-ignore="'+esc(review.id)+'">Kein Produktstamm</button>'
          +'</div></article>';
      }).join('')
      +'</div></section>';
  }

  function overdueFoodWarningMarkup(){
    const overdue=Array.isArray(state.food?.overdueMeals)?state.food.overdueMeals:[];
    if(!overdue.length)return '';
    const labels={breakfast:'Frühstück',lunch:'Mittagessen',snack:'Snack',dinner:'Abendessen'};
    const visible=overdue.slice(0,5);
    const rows=visible.map(meal=>{
      const count=Math.max(0,Number(meal.ingredient_count)||0);
      const ingredients=count?count+' '+(count===1?'Zutat':'Zutaten'):'Zutaten nicht hinterlegt';
      return '<li><strong>'+esc(fmtDate(meal.meal_date))+' · '+esc(labels[meal.meal_type]||'Mahlzeit')+'</strong><span>'+esc(meal.title||'Mahlzeit')+' · '+esc(ingredients)+'</span></li>';
    }).join('');
    const more=overdue.length>visible.length?'<small>+ '+(overdue.length-visible.length)+' weitere offene Mahlzeit'+(overdue.length-visible.length===1?'':'en')+'</small>':'';
    return '<section class="shopping-overdue-warning-v732" role="status">'
      +'<div class="shopping-overdue-warning-head-v732"><span aria-hidden="true">!</span><div><strong>Achtung: noch nicht abgeschlossene Mahlzeiten</strong><p>Diese Mahlzeiten liegen in der Vergangenheit. Die Zutaten könnten bereits verbraucht sein, ohne dass der Vorrat gebucht wurde. Die Einkaufsliste reserviert sie deshalb vorsichtshalber weiter. Bitte im Food-Bereich prüfen und abschließen.</p></div></div>'
      +'<ul>'+rows+'</ul>'+more
      +'</section>';
  }

  function shell(){
    const rows=buildRows();
    const now=rows.filter(row=>row.section==='now');
    const extra=rows.filter(row=>row.section==='extra');
    const later=rows.filter(row=>row.section==='later');
    const cart=rows.filter(row=>row.section==='cart');
    const reviewCount=(state.reviews||[]).length;

    const warning=state.foodError
      ?'<div class="shopping-warning-v643"><strong>Food-Bedarf gerade nicht verfügbar.</strong><span>'+esc(state.foodError)+'</span></div>'
      :'';

    return '<div class="shopping-hero-v643"><div><span>SHOPPING CONTROL</span><h2>EINKAUFSLISTE</h2></div></div>'
      +'<div class="shopping-summary-v643"><div><strong>'+now.length+'</strong><span>Einkaufen</span></div><div><strong>'+later.length+'</strong><span>Später</span></div><div><strong>'+cart.length+'</strong><span>Im Wagen</span></div><div><strong>'+reviewCount+'</strong><span>Prüfen</span></div></div>'
      +warning
      +overdueFoodWarningMarkup()
      +'<div class="shopping-sections-v643">'
      +sectionMarkup('now','PHASE 1 · EINKAUFEN','jetzt relevant',now,addEntryActionMarkup())
      +sectionMarkup('extra','EXTRAS · OHNE KAUFTERMIN','Nicht Food · dauerhaft gesammelt',extra,addEntryActionMarkup())
      +laterSectionMarkup(later)
      +sectionMarkup('cart','PHASE 2 · IM EINKAUFSWAGEN','liegt schon drin',cart,cart.length?checkoutActionMarkup():'')
      +'</div>'
      +purchasedMarkup()
      +reviewMarkup();
  }

  function loadingShell(){
    return '<div class="shopping-hero-v643"><div><span>SHOPPING CONTROL</span><h2>EINKAUFSLISTE</h2><p>Das Einkaufsmonster sortiert gerade seine Taschen.</p></div></div><div class="shopping-loading-v643"><i></i><strong>Einkauf wird geladen …</strong></div>';
  }

  function errorShell(){
    return '<div class="shopping-hero-v643"><div><span>SHOPPING CONTROL</span><h2>EINKAUFSLISTE</h2><p>Cloud hat gerade Einkaufswagen mit viereckigen Rädern.</p></div></div><div class="shopping-error-v643"><strong>Einkaufsliste konnte nicht geladen werden.</strong><span>'+esc(state.error)+'</span><button type="button" data-shopping-retry>Erneut laden</button></div>';
  }

  function render(){
    const root=ensureRoot();if(!root)return false;
    root.innerHTML=state.error?errorShell():(state.loading&&!state.general.length&&!state.food?loadingShell():shell());
    bind(root);
    try{window.__modFixedAppHeaderV475?.updateHeight?.();}catch(_){}
    return true;
  }

  function openModal(){
    document.getElementById('shoppingModalV643')?.remove();
    const root=document.createElement('div');
    root.id='shoppingModalV643';
    root.className='shopping-modal-v643';
    root.innerHTML='<div class="shopping-modal-card-v643"><div class="shopping-modal-head-v643"><div><span>NEUER EINTRAG</span><strong>Was soll mit?</strong></div><button type="button" data-shopping-modal-close>✕</button></div>'
      +'<form data-shopping-add-form><label>Artikel<input name="label" required placeholder="z. B. Duschgel, Waschmittel, Batterien" autocomplete="off"></label>'
      +'<div class="shopping-form-grid-v643"><label>Menge<input name="quantity" type="number" min="0" step="0.01" inputmode="decimal"></label><label>Einheit<input name="unit" placeholder="Stück, Packung, ml …"></label></div>'
      +'<div class="shopping-form-grid-v643"><label>Kategorie<select name="category">'+CATEGORIES.map(cat=>'<option '+(cat==='Sonstiges'?'selected':'')+'>'+esc(cat)+'</option>').join('')+'</select></label><label>Benötigt bis<input name="needed_by" type="date"></label></div>'
      +'<small class="shopping-add-hint-v681">Normal = Phase 1. „Extra“ bleibt dauerhaft ohne Kauftermin zwischen Phase 1 und Später.</small>'
      +'<label>Notiz<input name="notes" placeholder="optional"></label>'
      +'<label class="shopping-later-check-v643"><input name="extra" type="checkbox"> Extra · ohne Kauftermin</label>'
      +'<label class="shopping-later-check-v643"><input name="later" type="checkbox"> Erst später einkaufen</label>'
      +'<button type="submit" class="shopping-submit-v643">Zur Einkaufsliste</button></form></div>';
    document.body.appendChild(root);
    root.querySelector('[data-shopping-modal-close]')?.addEventListener('click',()=>root.remove());
    root.addEventListener('click',event=>{if(event.target===root)root.remove();});
    const extraCheck=root.querySelector('input[name="extra"]');
    const laterCheck=root.querySelector('input[name="later"]');
    extraCheck?.addEventListener('change',()=>{if(extraCheck.checked&&laterCheck)laterCheck.checked=false;});
    laterCheck?.addEventListener('change',()=>{if(laterCheck.checked&&extraCheck)extraCheck.checked=false;});
    root.querySelector('[data-shopping-add-form]')?.addEventListener('submit',async event=>{
      event.preventDefault();
      const form=new FormData(event.currentTarget);
      const label=String(form.get('label')||'').trim();
      const rawQty=String(form.get('quantity')||'').trim();
      const quantity=rawQty===''?null:Number(rawQty);
      const unit=String(form.get('unit')||'').trim()||null;
      const category=String(form.get('category')||'Sonstiges').trim()||'Sonstiges';
      const neededBy=String(form.get('needed_by')||'').trim()||null;
      const notes=String(form.get('notes')||'').trim()||null;
      const extra=form.get('extra')==='on';
      const later=form.get('later')==='on';
      if(!label)return;
      if(quantity!==null&&(!Number.isFinite(quantity)||quantity<0))return;
      try{
        await addGeneral({label,quantity,unit,category,needed_by:extra?null:neededBy,notes,status:extra?'extra':later?'later':'now'});
        root.remove();
      }catch(error){
        alert(error?.message||'Eintrag konnte nicht gespeichert werden.');
      }
    });
    setTimeout(()=>root.querySelector('input[name="label"]')?.focus(),50);
  }

  async function currentUser(){
    const supabase=client();if(!supabase)throw new Error('Cloud-Verbindung fehlt.');
    const session=await supabase.auth.getSession();
    const user=session?.data?.session?.user;
    if(session?.error||!user?.id)throw new Error('Nicht angemeldet.');
    return {supabase,user};
  }

  const normalizeReceiptLabel=value=>String(value||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('de-DE');

  function defaultProductForCartItem(item){
    if(!item?.inventoryId)return null;
    const matches=(state.products||[]).filter(product=>String(product.inventory_id||'')===String(item.inventoryId));
    return matches.length===1?matches[0]:matches[0]||null;
  }

  function defaultPackageCount(item,product){
    const quantity=Number(item?.plannedQuantity);
    if(!Number.isFinite(quantity)||quantity<=0||!product)return '';
    const packageQuantity=Number(product.package_quantity);
    if(Number.isFinite(packageQuantity)&&packageQuantity>0&&String(product.package_unit||'').toLocaleLowerCase('de-DE')===String(item.plannedUnit||'').toLocaleLowerCase('de-DE')){
      const count=quantity/packageQuantity;
      if(Number.isFinite(count)&&count>0)return String(Math.max(1,Math.ceil(count-.00001)));
    }
    const servings=Number(product.servings_per_package);
    if(String(item.plannedUnit||'')==='Stück'&&Number.isFinite(servings)&&servings>0){
      const count=quantity/servings;
      if(Number.isFinite(count)&&count>0)return String(Math.max(1,Math.ceil(count-.00001)));
    }
    return '';
  }

  function cartPlannedQuantity(row){
    return row.foodAction?.stockQuantity??row.general?.quantity??null;
  }

  function cartPlannedUnit(row){
    return row.foodAction?.stockUnit??row.general?.unit??null;
  }

  async function saveSubstitution(row,payload){
    const {supabase,user}=await currentUser();
    const originalQuantity=cartPlannedQuantity(row);
    const originalUnit=cartPlannedUnit(row);
    const result=await supabase.from('shopping_substitutions').upsert({
      user_id:user.id,
      shopping_key:row.key,
      source:row.source,
      original_label:row.label,
      original_quantity:originalQuantity,
      original_unit:originalUnit,
      replacement_label:payload.label,
      replacement_quantity:payload.quantity,
      replacement_unit:payload.unit,
      replacement_inventory_id:payload.inventoryId||null,
      replacement_product_id:payload.productId||null,
      status:'cart',
      note:'Ersatzartikel direkt beim Einkauf gewählt.',
      updated_at:new Date().toISOString()
    },{onConflict:'user_id,shopping_key'})
      .select('id')
      .single();
    if(result.error)throw result.error;
    if(!row.inCart)await toggleCart(row);
    else await reload({refreshFood:false});
    return result.data;
  }

  async function removeSubstitution(row,{refresh=true}={}){
    const substitution=row?.substitution;
    if(!substitution)return;
    const {supabase}=await currentUser();
    const result=await supabase.from('shopping_substitutions').delete().eq('id',substitution.id);
    if(result.error)throw result.error;
    if(refresh)await reload({refreshFood:false});
  }

  function openSubstitutionModal(row){
    if(!row)return;
    document.getElementById('shoppingSubstitutionV698')?.remove();
    const existing=row.substitution||null;
    const originalQuantity=cartPlannedQuantity(row);
    const originalUnit=cartPlannedUnit(row)||'';
    const selectedProductId=existing?.replacement_product_id||'';
    const selectedProduct=selectedProductId?(state.products||[]).find(p=>String(p.id)===String(selectedProductId)):null;
    const initialLabel=existing?.replacement_label||selectedProduct?.product_name||'';
    const initialQuantity=existing?.replacement_quantity??selectedProduct?.package_quantity??originalQuantity??'';
    const initialUnit=existing?.replacement_unit||selectedProduct?.package_unit||originalUnit;

    const modal=document.createElement('div');
    modal.id='shoppingSubstitutionV698';
    modal.className='shopping-modal-v643 shopping-substitution-modal-v698';
    modal.innerHTML='<div class="shopping-modal-card-v643 shopping-substitution-card-v698"><div class="shopping-modal-head-v643"><div><span>ERSATZARTIKEL</span><strong>'+esc(row.label)+'</strong></div><button type="button" data-substitution-close>✕</button></div>'
      +'<p class="shopping-checkout-copy-v645">Wenn der geplante Artikel nicht da ist, trägst du hier ein, was stattdessen im Wagen landet.</p>'
      +'<div class="shopping-substitution-preview-v698"><strong>'+esc(row.label)+'</strong><span>↳</span><b data-substitution-preview>'+esc(initialLabel||'Ersatz auswählen')+'</b></div>'
      +'<form data-substitution-form>'
      +'<label>Bekanntes Produkt<select data-substitution-product><option value="">Anderes / neues Produkt</option>'
      +(state.products||[]).map(product=>'<option value="'+esc(product.id)+'" '+(String(product.id)===String(selectedProductId)?'selected':'')+'>'+esc(productLabel(product))+'</option>').join('')
      +'</select></label>'
      +'<label>Ersatzartikel<input data-substitution-label required value="'+esc(initialLabel)+'" placeholder="z. B. TK-Blattspinat"></label>'
      +'<div class="shopping-form-grid-v643"><label>Gekaufte Menge<input data-substitution-qty type="number" min="0.01" step="0.01" inputmode="decimal" value="'+esc(initialQuantity)+'"></label><label>Einheit<input data-substitution-unit required value="'+esc(initialUnit)+'" placeholder="g, ml, Stück …"></label></div>'
      +'<div class="shopping-substitution-actions-v698">'
      +(existing?'<button type="button" class="is-quiet" data-substitution-remove>Ersatz entfernen</button>':'')
      +'<button type="submit" class="shopping-submit-v643">Als Ersatz in den Wagen</button>'
      +'</div></form></div>';
    document.body.appendChild(modal);

    const select=modal.querySelector('[data-substitution-product]');
    const labelInput=modal.querySelector('[data-substitution-label]');
    const qtyInput=modal.querySelector('[data-substitution-qty]');
    const unitInput=modal.querySelector('[data-substitution-unit]');
    const preview=modal.querySelector('[data-substitution-preview]');
    const updatePreview=()=>{if(preview)preview.textContent=String(labelInput?.value||'').trim()||'Ersatz auswählen';};
    select?.addEventListener('change',()=>{
      const product=(state.products||[]).find(p=>String(p.id)===String(select.value));
      if(!product)return;
      if(labelInput)labelInput.value=product.product_name||productLabel(product);
      if(qtyInput&&product.package_quantity!==null&&product.package_quantity!==undefined)qtyInput.value=product.package_quantity;
      if(unitInput&&product.package_unit)unitInput.value=product.package_unit;
      updatePreview();
    });
    labelInput?.addEventListener('input',updatePreview);
    modal.querySelector('[data-substitution-close]')?.addEventListener('click',()=>modal.remove());
    modal.addEventListener('click',event=>{if(event.target===modal)modal.remove();});
    modal.querySelector('[data-substitution-remove]')?.addEventListener('click',async()=>{
      try{await removeSubstitution(row);modal.remove();}
      catch(error){alert(error?.message||'Ersatz konnte nicht entfernt werden.');}
    });
    modal.querySelector('[data-substitution-form]')?.addEventListener('submit',async event=>{
      event.preventDefault();
      const button=event.currentTarget.querySelector('button[type="submit"]');
      if(button)button.disabled=true;
      try{
        const label=String(labelInput?.value||'').trim();
        const quantity=Number(String(qtyInput?.value||'').replace(',','.'));
        const unit=String(unitInput?.value||'').trim();
        if(!label)throw new Error('Bitte einen Ersatzartikel eintragen.');
        if(!Number.isFinite(quantity)||quantity<=0)throw new Error('Bitte eine gekaufte Menge größer 0 eintragen.');
        if(!unit)throw new Error('Bitte eine Einheit eintragen.');
        const productId=String(select?.value||'').trim()||null;
        const product=productId?(state.products||[]).find(p=>String(p.id)===productId):null;
        await saveSubstitution(row,{label,quantity,unit,productId,inventoryId:product?.inventory_id||null});
        modal.remove();
      }catch(error){
        if(button)button.disabled=false;
        alert(error?.message||'Ersatzartikel konnte nicht gespeichert werden.');
      }
    });
    setTimeout(()=>labelInput?.focus(),50);
  }

  function checkoutSnapshot(){
    return [...rowMap.values()].filter(row=>row.section==='cart').map(row=>{
      const originalQuantity=cartPlannedQuantity(row);
      const originalUnit=cartPlannedUnit(row);
      const substitution=row.substitution||null;
      const plannedQuantity=substitution?.replacement_quantity??originalQuantity;
      const plannedUnit=substitution?.replacement_unit??originalUnit;
      const inventoryId=substitution?.replacement_inventory_id||row.foodAction?.stockId||null;
      const label=substitution?.replacement_label||row.label;
      const base={
        key:row.key,label,plannedQuantity,plannedUnit,source:row.source,inventoryId,category:row.category||null,
        substitutionId:substitution?.id||null,
        originalLabel:substitution?row.label:null,
        originalQuantity:substitution?originalQuantity:null,
        originalUnit:substitution?originalUnit:null
      };
      const product=substitution?.replacement_product_id
        ?(state.products||[]).find(p=>String(p.id)===String(substitution.replacement_product_id))
        :defaultProductForCartItem(base);
      return {...base,productId:product?.id||null,packageCount:defaultPackageCount(base,product)};
    });
  }

  function productOptions(selectedId,inventoryId){
    const products=[...(state.products||[])].sort((a,b)=>{
      const am=inventoryId&&String(a.inventory_id||'')===String(inventoryId)?0:1;
      const bm=inventoryId&&String(b.inventory_id||'')===String(inventoryId)?0:1;
      return am-bm||String(productLabel(a)).localeCompare(String(productLabel(b)),'de');
    });
    return '<option value="">Produkt später zuordnen</option>'
      +products.map(product=>'<option value="'+esc(product.id)+'" '+(String(product.id)===String(selectedId||'')?'selected':'')+'>'
        +esc(productLabel(product))+'</option>').join('');
  }

  function receiptOptions(selectedId=''){
    const receipts=state.receipts||[];
    return '<option value="">Bon später in Phase 3 zuordnen</option>'
      +receipts.map(tx=>{
        const label=[tx.merchant||'Einkauf',fmtDate(tx.transaction_date),money(tx.total_amount)].filter(Boolean).join(' · ');
        return '<option value="'+esc(tx.id)+'" '+(String(tx.id)===String(selectedId)?'selected':'')+'>'+esc(label)+'</option>';
      }).join('');
  }

  function receiptChecklist(selectedIds=[]){
    const selected=new Set((selectedIds||[]).map(String));
    const receipts=state.receipts||[];
    if(!receipts.length)return '<div class="shopping-receipt-empty-v700">Noch keine erfassten Kassenbons vorhanden.</div>';
    return '<div class="shopping-receipt-checklist-v700">'
      +receipts.map(tx=>{
        const label=[tx.merchant||'Einkauf',fmtDate(tx.transaction_date),money(tx.total_amount)].filter(Boolean).join(' · ');
        return '<label class="shopping-receipt-choice-v700"><input type="checkbox" data-receipt-choice value="'+esc(tx.id)+'" '+(selected.has(String(tx.id))?'checked':'')+'><span>'+esc(label)+'</span></label>';
      }).join('')
      +'</div>';
  }

  function openCheckoutModal(){
    const cart=checkoutSnapshot();
    if(!cart.length)return;
    document.getElementById('shoppingCheckoutV645')?.remove();
    const modal=document.createElement('div');
    modal.id='shoppingCheckoutV645';
    modal.className='shopping-modal-v643 shopping-checkout-modal-v645';
    modal.innerHTML='<div class="shopping-modal-card-v643 shopping-checkout-card-v678"><div class="shopping-modal-head-v643"><div><span>PHASE 2 VON 4</span><strong>Kauf vormerken</strong></div><button type="button" data-checkout-close>✕</button></div>'
      +'<p class="shopping-checkout-copy-v645">Trag ein, was wirklich im Wagen gelandet ist. Noch wird kein Vorrat erhöht. Die endgültige Buchung erfolgt erst nach der Bon-/Produktprüfung in Phase 4.</p>'
      +'<form data-checkout-form-v678>'
      +'<div class="shopping-checkout-items-v678">'
      +cart.map((item,index)=>{
        const product=item.productId?(state.products||[]).find(p=>String(p.id)===String(item.productId)):null;
        return '<article class="shopping-checkout-item-v678" data-checkout-index="'+index+'" data-shopping-key="'+esc(item.key)+'" data-source="'+esc(item.source)+'" data-inventory-id="'+esc(item.inventoryId||'')+'">'
          +'<div class="shopping-checkout-item-head-v678"><div><small>'+(item.originalLabel?'Ersatz für '+esc(item.originalLabel)+' · ':'')+'Geplant '+esc(fmtQty(item.plannedQuantity,item.plannedUnit||''))+'</small><strong>'+esc(item.label)+'</strong></div>'+(product?'<span>bekannt</span>':'<span>Produkt offen</span>')+'</div>'
          +'<div class="shopping-checkout-fields-v678">'
          +'<label>Gekauft<input data-checkout-qty type="number" min="0" step="0.01" inputmode="decimal" value="'+esc(item.plannedQuantity??'')+'"></label>'
          +'<label>Einheit<input data-checkout-unit value="'+esc(item.plannedUnit||'')+'" placeholder="Stück, g, ml …"></label>'
          +'</div>'
          +(item.category==='Lebensmittel'
            ?'<div class="shopping-checkout-lots-v678"><div class="shopping-checkout-lots-head-v678"><div><span>PACKUNGEN & MHD</span><small>Jedes MHD ist eine eigene Charge.</small></div><button type="button" data-checkout-add-lot>+ weiteres MHD</button></div>'
              +'<div data-checkout-lots><div class="shopping-checkout-lot-row-v678" data-checkout-lot-row>'
                +'<label>Packungen<input data-lot-count type="number" min="1" step="1" inputmode="numeric" value="'+esc(item.packageCount||1)+'"></label>'
                +'<label>MHD<input data-lot-mhd type="date"></label>'
                +'<button type="button" data-checkout-remove-lot aria-label="MHD-Zeile entfernen">✕</button>'
              +'</div></div></div>'
            :'')
          +'<label class="shopping-checkout-product-v678">Produktstamm<select data-checkout-product>'+productOptions(item.productId,item.inventoryId)+'</select></label>'
          +'</article>';
      }).join('')
      +'</div>'
      +'<div class="shopping-checkout-receipt-step-v678"><div><span>ALS NÄCHSTES: PHASE 3</span><strong>Kassenbons zuordnen</strong><small>Nach dem Vormerken erscheint der Einkauf in Phase 3. Dort kannst du auch mehrere Bons auswählen.</small></div></div>'
      +'<button type="submit" class="shopping-submit-v643">Einkauf vormerken</button>'
      +'</form></div>';
    document.body.appendChild(modal);
    modal.querySelector('[data-checkout-close]')?.addEventListener('click',()=>modal.remove());
    modal.addEventListener('click',event=>{
      if(event.target===modal){modal.remove();return;}
      const add=event.target?.closest?.('[data-checkout-add-lot]');
      if(add){
        const article=add.closest('[data-checkout-index]');
        const host=article?.querySelector('[data-checkout-lots]');
        if(host){
          host.insertAdjacentHTML('beforeend','<div class="shopping-checkout-lot-row-v678" data-checkout-lot-row><label>Packungen<input data-lot-count type="number" min="1" step="1" inputmode="numeric" value="1"></label><label>MHD<input data-lot-mhd type="date"></label><button type="button" data-checkout-remove-lot aria-label="MHD-Zeile entfernen">✕</button></div>');
        }
        return;
      }
      const remove=event.target?.closest?.('[data-checkout-remove-lot]');
      if(remove){
        const host=remove.closest('[data-checkout-lots]');
        const rows=host?.querySelectorAll('[data-checkout-lot-row]')||[];
        if(rows.length>1)remove.closest('[data-checkout-lot-row]')?.remove();
        else{
          const date=remove.closest('[data-checkout-lot-row]')?.querySelector('[data-lot-mhd]');
          if(date)date.value='';
        }
      }
    });
    modal.querySelector('[data-checkout-form-v678]')?.addEventListener('submit',async event=>{
      event.preventDefault();
      const button=event.currentTarget.querySelector('button[type="submit"]');
      if(button)button.disabled=true;
      try{
        const items=[...event.currentTarget.querySelectorAll('[data-checkout-index]')].map(node=>{
          const index=Number(node.dataset.checkoutIndex);
          const base=cart[index];
          const rawQty=String(node.querySelector('[data-checkout-qty]')?.value||'').trim();
          const quantity=rawQty===''?null:Number(rawQty);
          const unit=String(node.querySelector('[data-checkout-unit]')?.value||'').trim()||null;
          const productId=String(node.querySelector('[data-checkout-product]')?.value||'').trim()||null;
          const product=productId?(state.products||[]).find(p=>String(p.id)===productId):null;
          const inventoryId=product?.inventory_id||base.inventoryId||null;
          if(quantity===null||!Number.isFinite(quantity)||quantity<=0)throw new Error('Bitte für „'+base.label+'“ eine gekaufte Menge größer 0 eintragen.');
          if(!unit)throw new Error('Bitte für „'+base.label+'“ eine Einheit eintragen.');

          const lots=[...node.querySelectorAll('[data-checkout-lot-row]')].map(lotNode=>{
            const rawCount=String(lotNode.querySelector('[data-lot-count]')?.value||'').trim();
            const count=rawCount===''?null:Number(rawCount);
            const bestBefore=String(lotNode.querySelector('[data-lot-mhd]')?.value||'').trim()||null;
            if(count!==null&&(!Number.isInteger(count)||count<=0))throw new Error('Packungen für „'+base.label+'“ müssen als ganze Zahl größer 0 angegeben werden.');
            return {packageCount:count,bestBefore};
          }).filter(lot=>lot.packageCount!==null);
          const packageCount=lots.length?lots.reduce((sum,lot)=>sum+lot.packageCount,0):null;
          const bestBefore=lots.length===1?lots[0].bestBefore:null;
          return {
            ...base,quantity,unit,packageCount,bestBefore,productId,inventoryId,lots,
            note:lots.some(lot=>lot.bestBefore)?'MHD beim Kauf chargenbezogen bestätigt.':null
          };
        });
        await completeCheckout(null,items);
        modal.remove();
      }catch(error){
        if(button)button.disabled=false;
        alert(error?.message||'Einkauf konnte nicht bestätigt werden.');
      }
    });
  }

  function normalizeMatchText(value){
    return String(value||'').toLocaleLowerCase('de-DE').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9äöüß]+/g,' ').trim().replace(/\s+/g,' ');
  }

  function matchCheckoutItem(financeItem,checkoutRows,retailer){
    if(!financeItem||!checkoutRows?.length)return null;
    const normalized=normalizeReceiptLabel(financeItem.item_name);
    const alias=(state.aliases||[]).find(a=>a.active!==false&&a.is_default===true&&String(a.normalized_label||'')===normalized&&String(a.retailer||'').trim().toLocaleLowerCase('de-DE')===String(retailer||'').trim().toLocaleLowerCase('de-DE'));
    if(alias?.product_id){
      const byProduct=checkoutRows.find(row=>String(row.product_id||'')===String(alias.product_id));
      if(byProduct)return byProduct;
    }
    const target=normalizeMatchText(financeItem.item_name);
    const targetTokens=new Set(target.split(' ').filter(token=>token.length>2));
    let best=null,bestScore=0;
    checkoutRows.forEach(row=>{
      const candidate=normalizeMatchText(row.label);
      if(!candidate)return;
      let score=0;
      if(candidate===target)score=1;
      else if(candidate.includes(target)||target.includes(candidate))score=.86;
      else{
        const tokens=candidate.split(' ').filter(token=>token.length>2);
        const overlap=tokens.filter(token=>targetTokens.has(token)).length;
        score=overlap/Math.max(1,Math.min(tokens.length,targetTokens.size));
      }
      if(score>bestScore){bestScore=score;best=row;}
    });
    return bestScore>=.6?best:null;
  }

  async function queueReceiptReviews(checkoutId,tx,checkoutRows){
    const {supabase,user}=await currentUser();
    const financeItems=await supabase.from('finance_items')
      .select('id,item_name,quantity,unit')
      .eq('transaction_id',tx.id)
      .order('sort_order',{ascending:true});
    if(financeItems.error)throw financeItems.error;
    const items=Array.isArray(financeItems.data)?financeItems.data:[];
    const ids=items.map(item=>item.id);
    let existingMap=new Map();
    if(ids.length){
      const existing=await supabase.from('shopping_receipt_reviews')
        .select('id,finance_item_id,status,product_id,notes,resolved_at,inventory_applied_at,checkout_item_id')
        .in('finance_item_id',ids);
      if(existing.error)throw existing.error;
      existingMap=new Map((existing.data||[]).map(item=>[String(item.finance_item_id),item]));
    }

    for(const item of items){
      const normalized=normalizeReceiptLabel(item.item_name);
      const existing=existingMap.get(String(item.id));
      const matchedCheckout=matchCheckoutItem(item,checkoutRows,tx.merchant);
      if(existing&&['confirmed','ignored'].includes(existing.status)){
        const keep=await supabase.from('shopping_receipt_reviews').update({
          checkout_id:checkoutId,
          checkout_item_id:existing.checkout_item_id||matchedCheckout?.id||null,
          updated_at:new Date().toISOString()
        }).eq('id',existing.id);
        if(keep.error)throw keep.error;
        continue;
      }
      const alias=(state.aliases||[]).find(a=>
        a.active!==false&&a.is_default===true
        &&String(a.normalized_label||'')===normalized
        &&String(a.retailer||'').trim().toLocaleLowerCase('de-DE')===String(tx.merchant||'').trim().toLocaleLowerCase('de-DE')
      );
      const candidateProduct=matchedCheckout?.product_id||alias?.product_id||null;
      const row={
        user_id:user.id,finance_item_id:item.id,checkout_id:checkoutId,checkout_item_id:matchedCheckout?.id||null,
        retailer:tx.merchant||'Unbekannter Händler',
        receipt_label:item.item_name,
        normalized_label:normalized,
        status:'pending',
        product_id:candidateProduct,
        notes:candidateProduct?'Produkt aus Einkauf/Bon-Historie als Vorschlag gefunden.':'Noch keine eindeutige Produktzuordnung.',
        resolved_at:null,
        updated_at:new Date().toISOString()
      };
      const upsert=await supabase.from('shopping_receipt_reviews').upsert(row,{onConflict:'user_id,finance_item_id'});
      if(upsert.error)throw upsert.error;
    }
  }

  async function ensureInventoryForPurchase(item,supabase,user){
    if(item.inventoryId){
      if(item.productId){
        const product=(state.products||[]).find(row=>String(row.id)===String(item.productId));
        if(product&&!product.inventory_id){
          const linked=await supabase.from('shopping_products').update({
            inventory_id:item.inventoryId,updated_at:new Date().toISOString()
          }).eq('id',item.productId).is('inventory_id',null);
          if(linked.error)throw linked.error;
          product.inventory_id=item.inventoryId;
        }
      }
      return item;
    }
    if(String(item.category||'')!=='Lebensmittel')return item;
    const inventory=(state.food?.inventory||[]).filter(row=>row.is_active!==false);
    const existing=inventory.find(row=>
      normalizedIngredient(row.name,row.unit)===normalizedIngredient(item.label,item.unit)
      &&String(row.unit||'').toLocaleLowerCase('de-DE')===String(item.unit||'').toLocaleLowerCase('de-DE')
    );
    if(existing)return {...item,inventoryId:existing.id};

    const maxSort=inventory.reduce((max,row)=>Math.max(max,Number(row.sort_order)||0),0);
    const created=await supabase.from('food_inventory').insert({
      user_id:user.id,name:item.label,quantity:0,unit:item.unit,
      quantity_label:fmtQty(0,item.unit),tone:'empty',sort_order:maxSort+1,
      opened:false,use_priority:'later',is_active:true,pending_weighing:false,shopping_excluded:false
    }).select('id').single();
    if(created.error)throw created.error;
    const withInventory={...item,inventoryId:created.data.id};
    if(item.productId){
      const linked=await supabase.from('shopping_products').update({
        inventory_id:created.data.id,updated_at:new Date().toISOString()
      }).eq('id',item.productId).is('inventory_id',null);
      if(linked.error)throw linked.error;
    }
    return withInventory;
  }

  async function completeCheckout(transactionId,cart){
    const {supabase,user}=await currentUser();
    const tx=transactionId?(state.receipts||[]).find(item=>String(item.id)===String(transactionId)):null;
    if(transactionId&&!tx)throw new Error('Kassenbon nicht gefunden.');

    const prepared=cart.map(item=>({...item}));

    const checkoutResult=await supabase.from('shopping_checkouts').insert({
      user_id:user.id,
      finance_transaction_id:tx?.id||null,
      status:tx?'review':'awaiting_receipt',
      retailer:tx?.merchant||null,
      total_amount:tx?.total_amount??null,
      completed_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    }).select('id').single();
    if(checkoutResult.error)throw checkoutResult.error;
    const checkoutId=checkoutResult.data.id;

    const snapshotRows=prepared.map(item=>({
      user_id:user.id,checkout_id:checkoutId,shopping_key:item.key,label:item.label,
      quantity:item.quantity,unit:item.unit,source:item.source,
      planned_quantity:item.plannedQuantity,planned_unit:item.plannedUnit,
      inventory_id:item.inventoryId||null,product_id:item.productId||null,
      best_before_date:item.bestBefore||null,
      best_before_status:(item.bestBefore||(item.lots||[]).some(lot=>lot.bestBefore))?'date':'unknown',
      package_count:item.packageCount||null,purchase_data:{},note:item.note||null,
      substitution_id:item.substitutionId||null,original_label:item.originalLabel||null,
      original_quantity:item.originalQuantity??null,original_unit:item.originalUnit||null
    }));
    const snap=await supabase.from('shopping_checkout_items').insert(snapshotRows)
      .select('id,checkout_id,shopping_key,label,quantity,unit,source,planned_quantity,planned_unit,inventory_id,product_id,best_before_date,best_before_status,package_count,purchase_data,inventory_applied_at,note,substitution_id,original_label,original_quantity,original_unit,created_at');
    if(snap.error)throw snap.error;
    const inserted=Array.isArray(snap.data)?snap.data:[];

    const lotRows=[];
    inserted.forEach(item=>{
      const source=prepared.find(candidate=>String(candidate.key)===String(item.shopping_key));
      (source?.lots||[]).forEach(lot=>{
        lotRows.push({
          user_id:user.id,checkout_item_id:item.id,
          package_count:lot.packageCount,best_before_date:lot.bestBefore||null,
          note:lot.bestBefore?'MHD beim Einkauf erfasst.':null
        });
      });
    });
    if(lotRows.length){
      const lotInsert=await supabase.from('shopping_checkout_item_lots').insert(lotRows);
      if(lotInsert.error)throw lotInsert.error;
    }

    const substitutionIds=[...new Set(prepared.map(item=>item.substitutionId).filter(Boolean))];
    if(substitutionIds.length){
      const substitutionDone=await supabase.from('shopping_substitutions').update({
        status:'purchased',updated_at:new Date().toISOString()
      }).in('id',substitutionIds);
      if(substitutionDone.error)throw substitutionDone.error;
    }

    const foodClear=await supabase.from('food_shopping_cart_state').delete().eq('user_id',user.id);
    if(foodClear.error)throw foodClear.error;

    const generalCartIds=(state.general||[]).filter(item=>item.status==='cart').map(item=>item.id);
    if(generalCartIds.length){
      const done=await supabase.from('shopping_items').update({
        status:'done',return_status:null,completed_at:new Date().toISOString(),updated_at:new Date().toISOString()
      }).in('id',generalCartIds);
      if(done.error)throw done.error;
    }

    if(tx)await queueReceiptReviews(checkoutId,tx,inserted);
    await reload();
  }

  function openReceiptAttachModal(checkoutId){
    const checkout=(state.checkouts||[]).find(item=>String(item.id)===String(checkoutId));
    if(!checkout)return;
    document.getElementById('shoppingReceiptAttachV678')?.remove();
    document.getElementById('shoppingSubstitutionV698')?.remove();
    const selectedIds=(state.checkoutReceipts||[])
      .filter(link=>String(link.checkout_id||'')===String(checkoutId))
      .map(link=>String(link.finance_transaction_id||''));
    const modal=document.createElement('div');
    modal.id='shoppingReceiptAttachV678';
    modal.className='shopping-modal-v643';
    modal.innerHTML='<div class="shopping-modal-card-v643 shopping-receipt-attach-card-v700"><div class="shopping-modal-head-v643"><div><span>PHASE 3 VON 4</span><strong>Kassenbons zuordnen</strong></div><button type="button" data-receipt-attach-close>✕</button></div>'
      +'<p class="shopping-checkout-copy-v645">Wähle alle Bons, die zu diesem Einkauf gehören. Mehrfachauswahl ist ausdrücklich erlaubt.</p>'
      +receiptChecklist(selectedIds)
      +'<button type="button" class="shopping-submit-v643" data-receipt-attach-confirm>Bons verknüpfen</button></div>';
    document.body.appendChild(modal);
    modal.querySelector('[data-receipt-attach-close]')?.addEventListener('click',()=>modal.remove());
    modal.addEventListener('click',event=>{if(event.target===modal)modal.remove();});
    modal.querySelector('[data-receipt-attach-confirm]')?.addEventListener('click',async()=>{
      const button=modal.querySelector('[data-receipt-attach-confirm]');
      const transactionIds=[...modal.querySelectorAll('[data-receipt-choice]:checked')].map(input=>String(input.value||'').trim()).filter(Boolean);
      if(!transactionIds.length){alert('Bitte mindestens einen Bon auswählen.');return;}
      if(button)button.disabled=true;
      try{
        await attachReceiptsToCheckout(checkoutId,transactionIds);
        modal.remove();
      }catch(error){
        if(button)button.disabled=false;
        alert(error?.message||'Bons konnten nicht zugeordnet werden.');
      }
    });
  }

  async function attachReceiptsToCheckout(checkoutId,transactionIds){
    const {supabase,user}=await currentUser();
    const uniqueIds=[...new Set((transactionIds||[]).map(String).filter(Boolean))];
    if(!uniqueIds.length)throw new Error('Keine Kassenbons ausgewählt.');

    const txResult=await supabase.from('finance_transactions')
      .select('id,transaction_date,transaction_time,merchant,total_amount,currency,receipt_source,created_at')
      .in('id',uniqueIds);
    if(txResult.error)throw txResult.error;
    const txs=Array.isArray(txResult.data)?txResult.data:[];
    if(!txs.length)throw new Error('Kassenbons nicht gefunden.');

    const existingIds=new Set((state.checkoutReceipts||[])
      .filter(link=>String(link.checkout_id||'')===String(checkoutId))
      .map(link=>String(link.finance_transaction_id||'')));
    const newTxs=txs.filter(tx=>!existingIds.has(String(tx.id)));

    if(newTxs.length){
      const linked=await supabase.from('shopping_checkout_receipts').upsert(
        newTxs.map(tx=>({user_id:user.id,checkout_id:checkoutId,finance_transaction_id:tx.id})),
        {onConflict:'user_id,checkout_id,finance_transaction_id'}
      );
      if(linked.error)throw linked.error;
    }

    const itemsResult=await supabase.from('shopping_checkout_items')
      .select('id,checkout_id,shopping_key,label,quantity,unit,source,planned_quantity,planned_unit,inventory_id,product_id,best_before_date,best_before_status,package_count,purchase_data,inventory_applied_at,note,substitution_id,original_label,original_quantity,original_unit,created_at')
      .eq('checkout_id',checkoutId)
      .order('created_at',{ascending:true});
    if(itemsResult.error)throw itemsResult.error;
    const checkoutRows=itemsResult.data||[];

    const merchants=[...new Set(txs.map(tx=>String(tx.merchant||'').trim()).filter(Boolean))];
    const total=txs.reduce((sum,tx)=>sum+(Number(tx.total_amount)||0),0);
    const primary=txs[0]||null;
    const updated=await supabase.from('shopping_checkouts').update({
      finance_transaction_id:primary?.id||null,
      status:'review',
      retailer:merchants.length===1?merchants[0]:(merchants.length>1?'Mehrere Händler':null),
      total_amount:total||null,
      updated_at:new Date().toISOString()
    }).eq('id',checkoutId);
    if(updated.error)throw updated.error;

    for(const tx of newTxs)await queueReceiptReviews(checkoutId,tx,checkoutRows);
    await reload({refreshFood:false});
  }

  async function attachReceiptToCheckout(checkoutId,transactionId){
    return attachReceiptsToCheckout(checkoutId,[transactionId]);
  }

  async function maybeFinishCheckout(checkoutId){
    if(!checkoutId)return;
    const {supabase}=await currentUser();
    const open=await supabase.from('shopping_receipt_reviews')
      .select('id')
      .eq('checkout_id',checkoutId)
      .in('status',['pending','new_product_pending'])
      .limit(1);
    if(open.error)throw open.error;
    if((open.data||[]).length)return;
    const done=await supabase.from('shopping_checkouts').update({status:'done',updated_at:new Date().toISOString()}).eq('id',checkoutId);
    if(done.error)throw done.error;
  }

  async function confirmReview(reviewId,productId){
    const review=(state.reviews||[]).find(item=>String(item.id)===String(reviewId));
    const product=(state.products||[]).find(item=>String(item.id)===String(productId));
    const details=purchaseDetailsForReview(review,product);
    if(tracksFoodInventory(product)&&!details.ready){
      openPurchaseDetails(reviewId,productId);
      return {needs_purchase_details:true};
    }
    const {supabase}=await currentUser();
    const result=await supabase.rpc('confirm_shopping_receipt_review_v756',{
      p_review_id:reviewId,
      p_product_id:productId
    });
    if(result.error)throw result.error;
    await reload();
    return result.data;
  }

  async function markReviewDataPending(reviewId){
    const {supabase}=await currentUser();
    const result=await supabase.from('shopping_receipt_reviews').update({
      status:'new_product_pending',
      product_id:null,
      notes:'Anderes Produkt · Produktdaten/Fotos kommen noch.',
      resolved_at:null,
      updated_at:new Date().toISOString()
    }).eq('id',reviewId);
    if(result.error)throw result.error;
    await reload({refreshFood:false});
  }

  async function ignoreReview(reviewId){
    const review=(state.reviews||[]).find(item=>String(item.id)===String(reviewId));
    const {supabase}=await currentUser();
    const result=await supabase.from('shopping_receipt_reviews').update({
      status:'ignored',product_id:null,
      notes:'Für diese Bonposition ist kein konkreter Produktstamm nötig.',
      resolved_at:new Date().toISOString(),updated_at:new Date().toISOString()
    }).eq('id',reviewId);
    if(result.error)throw result.error;
    await maybeFinishCheckout(review?.checkout_id);
    await reload({refreshFood:false});
  }

  function openProductPicker(reviewId){
    const review=(state.reviews||[]).find(item=>String(item.id)===String(reviewId));
    if(!review)return;
    document.getElementById('shoppingProductPickerV644')?.remove();
    const retailer=String(review.retailer||'').trim().toLocaleLowerCase('de-DE');
    const currentCandidate=reviewCandidate(review);
    const soughtWords=normalizeMatchText(review.receipt_label).split(' ').filter(word=>word.length>=3);
    const productRank=product=>{
      const name=normalizeMatchText(productLabel(product));
      return soughtWords.reduce((score,word)=>score+(name.includes(word)?1:0),0);
    };
    const products=[...(state.products||[])].sort((a,b)=>{
      const rankDifference=productRank(b)-productRank(a);
      const suggestedDifference=Number(String(b.id)===String(currentCandidate?.id))-Number(String(a.id)===String(currentCandidate?.id));
      const ar=String(a.retailer||'').trim().toLocaleLowerCase('de-DE')===retailer?0:1;
      const br=String(b.retailer||'').trim().toLocaleLowerCase('de-DE')===retailer?0:1;
      return rankDifference||suggestedDifference||ar-br||String(productLabel(a)).localeCompare(String(productLabel(b)),'de');
    });
    const modal=document.createElement('div');
    modal.id='shoppingProductPickerV644';
    modal.className='shopping-modal-v643 shopping-product-picker-v644';
    modal.innerHTML='<div class="shopping-modal-card-v643"><div class="shopping-modal-head-v643"><div><span>PRODUKT ZUORDNEN</span><strong>'+esc(review.receipt_label)+'</strong></div><button type="button" data-product-picker-close>✕</button></div>'
      +(products.length
        ?'<label class="shopping-product-filter-v781">Produkt, Geschmack oder Barcode suchen<input type="search" data-product-filter-v781 autocomplete="off" placeholder="z. B. Pepsi Cherry, 1,25 l"></label>'
          +'<div class="shopping-product-options-v644">'+products.map(product=>{
          const suggested=currentCandidate&&String(currentCandidate.id)===String(product.id);
          const pack=product.package_quantity!==null&&product.package_quantity!==undefined?fmtQty(product.package_quantity,product.package_unit||''):'';
          const title=[product.product_name||'Produkt',product.variant,pack].filter(Boolean).join(' · ');
          const meta=[product.brand,product.retailer,product.barcode?'EAN '+product.barcode:null].filter(Boolean).join(' · ');
          const searchText=normalizeMatchText([title,meta].join(' '));
          return '<button type="button" data-product-choice="'+esc(product.id)+'" data-product-search-v781="'+esc(searchText)+'" data-product-name="'+esc(title)+'" class="'+(suggested?'is-suggested-v651':'')+'">'
            +'<span>'+(suggested?'VORSCHLAG · ':'')+esc(meta||'Bekanntes Produkt')+'</span>'
            +'<strong>'+esc(title)+'</strong>'
            +'</button>';
        }).join('')+'</div>'
        :'<div class="shopping-review-empty-v644">Noch keine bekannten Produkte im Produktstamm.</div>')
      +'<button type="button" class="shopping-product-new-v644" data-product-new-pending>Anderes Produkt · Fotos / Daten kommen noch</button></div>';
    document.body.appendChild(modal);
    modal.querySelector('[data-product-picker-close]')?.addEventListener('click',()=>modal.remove());
    modal.querySelector('[data-product-filter-v781]')?.addEventListener('input',event=>{
      const requested=normalizeMatchText(event.target.value);
      modal.querySelectorAll('[data-product-choice]').forEach(button=>{
        button.hidden=!!requested&&!String(button.dataset.productSearchV781||'').includes(requested);
      });
    });
    modal.addEventListener('click',event=>{if(event.target===modal)modal.remove();});
    modal.querySelectorAll('[data-product-choice]').forEach(button=>button.addEventListener('click',async()=>{
      if(button.disabled)return;
      modal.querySelectorAll('[data-product-choice]').forEach(item=>item.disabled=true);
      button.classList.add('is-saving-v651');
      const oldText=button.innerHTML;
      button.innerHTML='<span>WIRD ÜBERNOMMEN</span><strong>'+esc(button.dataset.productName||'Produkt')+'</strong>';
      try{
        const chosenId=button.dataset.productChoice;
        modal.remove();
        openPurchaseDetails(review.id,chosenId);
      }catch(error){
        modal.querySelectorAll('[data-product-choice]').forEach(item=>item.disabled=false);
        button.classList.remove('is-saving-v651');
        button.innerHTML=oldText;
        alert(error?.message||'Produkt konnte nicht ausgewählt werden.');
      }
    }));
    modal.querySelector('[data-product-new-pending]')?.addEventListener('click',async()=>{
      try{await markReviewDataPending(review.id);modal.remove();}
      catch(error){alert(error?.message||'Prüfstatus konnte nicht gespeichert werden.');}
    });
  }

  async function addGeneral(payload){
    const {supabase,user}=await currentUser();
    const maxSort=(state.general||[]).reduce((max,item)=>Math.max(max,Number(item.sort_order)||0),0);
    const result=await supabase.from('shopping_items').insert({
      user_id:user.id,...payload,source:'manual',sort_order:maxSort+1,updated_at:new Date().toISOString()
    });
    if(result.error)throw result.error;
    await reload({refreshFood:false});
  }

  async function updateGeneral(id,patch){
    const {supabase}=await currentUser();
    const result=await supabase.from('shopping_items').update({...patch,updated_at:new Date().toISOString()}).eq('id',id);
    if(result.error)throw result.error;
    await reload({refreshFood:false});
  }

  async function deleteGeneral(id){
    const {supabase}=await currentUser();
    const result=await supabase.from('shopping_items').delete().eq('id',id);
    if(result.error)throw result.error;
    await reload({refreshFood:false});
  }

  async function toggleCart(row){
    if(row.inCart&&row.substitution){
      await removeSubstitution(row,{refresh:false});
      row.substitution=null;
    }
    if(row.source==='general'){
      const item=row.general;
      if(row.inCart){
        await updateGeneral(item.id,{status:item.return_status||'now',return_status:null});
      }else{
        const returnStatus=item.status==='later'?'later':item.status==='extra'?'extra':'now';
        await updateGeneral(item.id,{status:'cart',return_status:returnStatus});
      }
      return;
    }
    const foodApi=window.__modFoodV544;
    if(!foodApi?.toggleShoppingCart)throw new Error('Food-Einkaufswagen ist nicht verfügbar.');
    await foodApi.toggleShoppingCart(row.key,row.inCart);
    await reload();
  }

  async function markDone(row){
    if(row.source!=='general')return;
    await updateGeneral(row.general.id,{status:'done',return_status:null,completed_at:new Date().toISOString()});
  }

  async function toggleLater(row){
    if(row.source!=='general'||row.inCart)return;
    await updateGeneral(row.general.id,{status:row.section==='later'?'now':'later'});
  }

  function refreshAfterFoodModal(modal){
    if(!modal){setTimeout(()=>reload(),900);return;}
    const started=Date.now();
    const timer=setInterval(()=>{
      if(!modal.isConnected){
        clearInterval(timer);
        setTimeout(()=>reload(),220);
        return;
      }
      if(Date.now()-started>120000)clearInterval(timer);
    },250);
  }

  async function completeFood(row){
    const api=window.__modFoodV544;
    if(row.foodAction){
      if(!api?.openShoppingStockModal)throw new Error('Food-Vorratsübernahme ist nicht verfügbar.');
      const modal=api.openShoppingStockModal(row.foodAction);
      refreshAfterFoodModal(modal);
      return;
    }
    if(row.shoppingId&&api?.checkShopping){
      await api.checkShopping(row.shoppingId);
      await reload();
    }
  }

  function bind(root){
    root.querySelector('[data-shopping-add]')?.addEventListener('click',openModal);
    root.querySelector('[data-shopping-checkout]')?.addEventListener('click',openCheckoutModal);
    root.querySelectorAll('[data-checkout-attach-receipt]').forEach(button=>button.addEventListener('click',()=>openReceiptAttachModal(button.dataset.checkoutAttachReceipt)));
    root.querySelector('[data-shopping-retry]')?.addEventListener('click',()=>reload());
    root.querySelectorAll('[data-shopping-cart]').forEach(button=>button.addEventListener('click',async()=>{
      const row=rowMap.get(button.dataset.shoppingCart);if(!row)return;
      try{await toggleCart(row);}catch(error){alert(error?.message||'Einkaufswagen konnte nicht geändert werden.');}
    }));
    root.querySelectorAll('[data-shopping-substitute]').forEach(button=>button.addEventListener('click',()=>{
      const row=rowMap.get(button.dataset.shoppingSubstitute);if(!row)return;
      openSubstitutionModal(row);
    }));
    root.querySelectorAll('[data-shopping-done]').forEach(button=>button.addEventListener('click',async()=>{
      const row=rowMap.get(button.dataset.shoppingDone);if(!row)return;
      try{await markDone(row);}catch(error){alert(error?.message||'Eintrag konnte nicht erledigt werden.');}
    }));
    root.querySelectorAll('[data-shopping-later]').forEach(button=>button.addEventListener('click',async()=>{
      const row=rowMap.get(button.dataset.shoppingLater);if(!row)return;
      try{await toggleLater(row);}catch(error){alert(error?.message||'Eintrag konnte nicht verschoben werden.');}
    }));
    root.querySelectorAll('[data-shopping-delete]').forEach(button=>button.addEventListener('click',async()=>{
      const row=rowMap.get(button.dataset.shoppingDelete);if(!row?.general)return;
      if(!confirm('„'+row.label+'“ wirklich von der Einkaufsliste entfernen?'))return;
      try{await deleteGeneral(row.general.id);}catch(error){alert(error?.message||'Eintrag konnte nicht entfernt werden.');}
    }));
    root.querySelectorAll('[data-shopping-food-complete]').forEach(button=>button.addEventListener('click',async()=>{
      const row=rowMap.get(button.dataset.shoppingFoodComplete);if(!row)return;
      try{await completeFood(row);}catch(error){alert(error?.message||'Food-Eintrag konnte nicht übernommen werden.');}
    }));
    root.querySelectorAll('[data-shopping-food-check]').forEach(button=>button.addEventListener('click',async()=>{
      const row=rowMap.get(button.dataset.shoppingFoodCheck);if(!row)return;
      try{await completeFood(row);}catch(error){alert(error?.message||'Food-Eintrag konnte nicht abgehakt werden.');}
    }));
    root.querySelectorAll('[data-review-details]').forEach(button=>button.addEventListener('click',()=>openPurchaseDetails(button.dataset.reviewDetails)));
    root.querySelectorAll('[data-review-confirm]').forEach(button=>button.addEventListener('click',async()=>{
      const review=(state.reviews||[]).find(item=>String(item.id)===String(button.dataset.reviewConfirm));
      const candidate=reviewCandidate(review);
      if(!review||!candidate)return;
      try{await confirmReview(review.id,candidate.id);}catch(error){alert(error?.message||'Produkt konnte nicht bestätigt werden.');}
    }));
    root.querySelectorAll('[data-review-choose]').forEach(button=>button.addEventListener('click',()=>openProductPicker(button.dataset.reviewChoose)));
    root.querySelectorAll('[data-review-pending]').forEach(button=>button.addEventListener('click',async()=>{
      try{await markReviewDataPending(button.dataset.reviewPending);}catch(error){alert(error?.message||'Prüfstatus konnte nicht gespeichert werden.');}
    }));
    root.querySelectorAll('[data-review-ignore]').forEach(button=>button.addEventListener('click',async()=>{
      const review=(state.reviews||[]).find(item=>String(item.id)===String(button.dataset.reviewIgnore));
      const ok=confirm('„'+(review?.receipt_label||'Diese Bonposition')+'“ nicht dem Produktstamm zuordnen?\n\nSie verschwindet danach aus der offenen Gegenprüfung, bleibt aber im Kassenbon/Finanzbereich erhalten.');
      if(!ok)return;
      try{await ignoreReview(button.dataset.reviewIgnore);}catch(error){alert(error?.message||'Bonposition konnte nicht abgeschlossen werden.');}
    }));
  }

  async function reload(options={}){
    loadPromise=null;
    state.error='';
    return loadData(options);
  }

  function close(){
    if(!document.body.classList.contains(BODY_CLASS))return false;
    setSurface(false);
    const root=document.getElementById(ROOT_ID);
    if(root){root.hidden=true;root.setAttribute('aria-hidden','true');}
    document.getElementById('shoppingModalV643')?.remove();
    document.getElementById('shoppingProductPickerV644')?.remove();
    document.getElementById('shoppingPurchaseDetailsV756')?.remove();
    document.getElementById('shoppingCheckoutV645')?.remove();
    document.getElementById('shoppingReceiptAttachV678')?.remove();
    return true;
  }

  function open(){
    try{window.__modFoodV544?.close?.();}catch(_){}
    try{window.__modFinanceV552?.close?.();}catch(_){}
    try{window.__modKistologyV603?.close?.();}catch(_){}
    try{window.__modDenkfabrikV635?.close?.();}catch(_){}
    try{window.__modBackstageV531?.close?.({restoreTodo:false});}catch(_){}
    try{window.__modAppHubV515?.hide?.();}catch(_){}
    setSurface(true);
    const root=ensureRoot();
    if(root){root.hidden=false;root.setAttribute('aria-hidden','false');}
    render();
    reload();
    try{window.scrollTo?.({top:0,left:0,behavior:'instant'});}catch(_){window.scrollTo?.(0,0);}
    return 'shopping';
  }

  function patchHub(){
    const launcher=window.__modHubLauncherV603||window.__modHubLauncherV517;
    const item=launcher?.modules?.find?.(entry=>entry.id==='shopping');
    if(item)item.active=true;
    document.querySelectorAll('[data-mod-hub-launch-v517="shopping"],[data-mod-hub-open="shopping"]').forEach(button=>{
      button.removeAttribute('aria-disabled');
      button.setAttribute('aria-label','Einkaufsliste öffnen');
    });

    const hub=window.__modAppHubV515;
    if(hub&&!hubPatched){
      originalHubShow=hub.show?.bind(hub)||null;
      originalHubOpen=hub.open?.bind(hub)||null;
      if(originalHubShow)hub.show=function(){close();return originalHubShow(...arguments);};
      if(originalHubOpen)hub.open=function(target,options){if(target==='shopping')return open();if(document.body.classList.contains(BODY_CLASS))close();return originalHubOpen(target,options);};
      hub.shoppingActiveV643=true;
      hubPatched=true;
    }
    return true;
  }

  const api={
    version:VERSION,open,close,render,reload,openCheckoutModal,openReceiptAttachModal,
    getState:()=>({
      general:state.general.map(item=>({...item})),
      food:state.food?structuredClone(state.food):null,
      reviews:state.reviews.map(item=>({...item})),
      products:state.products.map(item=>({...item})),
      substitutions:state.substitutions.map(item=>({...item})),
      checkoutReceipts:state.checkoutReceipts.map(item=>({...item}))
    }),
    centralShopping:true,foodDemandIsDynamic:true,productReviewPlanned:false,productReviewActive:true,checkoutActive:true
  };
  window.__modShoppingV678=api;
  window.__modShoppingV651=api;
  window.__modShoppingV650=api;
  window.__modShoppingV649=api;
  window.__modShoppingV648=api;
  window.__modShoppingV647=api;
  window.__modShoppingV646=api;
  window.__modShoppingV645=api;
  window.__modShoppingV644=api;
  window.__modShoppingV643=api;

  const observer=new MutationObserver(()=>patchHub());
  function init(){
    ensureRoot();
    patchHub();
    if(!tapFeedbackBound){
      document.addEventListener('pointerdown',event=>{
        const button=event.target?.closest?.('button');
        if(!button)return;
        const insideShopping=button.closest?.('#'+ROOT_ID+', .shopping-modal-v643');
        if(insideShopping)flashTap(button);
      },true);
      tapFeedbackBound=true;
    }
    observer.observe(document.documentElement,{subtree:true,childList:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();