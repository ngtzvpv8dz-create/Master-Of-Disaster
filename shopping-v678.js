/* V678 · SHOPPING / CLEAR CHECKOUT STEPS + PURCHASE-SPECIFIC MHD
   Planning, cart, purchase confirmation, receipt linking and product review are separate steps.
   MHD belongs to the concrete purchase lot, never to the reusable product master.
*/
(function(){
  'use strict';
  if(window.__modShoppingV678)return;

  const VERSION='V678';
  const ROOT_ID='modShoppingV643';
  const BODY_CLASS='mod-shopping-v643';
  const SURFACE_CLASS='mod-shopping-surface-v643';
  const CATEGORIES=['Lebensmittel','Haushalt','Drogerie','Technik','Sonstiges'];

  let state={general:[],food:null,reviews:[],products:[],aliases:[],checkouts:[],checkoutItems:[],receipts:[],financeItems:[],loading:false,error:'',foodError:''};
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
          .select('id,checkout_id,shopping_key,label,quantity,unit,source,planned_quantity,planned_unit,inventory_id,product_id,best_before_date,package_count,inventory_applied_at,note,created_at')
          .in('checkout_id',checkoutIds)
          .order('created_at',{ascending:true});
        if(checkoutItemsResult.error)throw checkoutItemsResult.error;
        state.checkoutItems=Array.isArray(checkoutItemsResult.data)?checkoutItemsResult.data:[];
      }else{
        state.checkoutItems=[];
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

  function buildRows(){
    const rows=[];
    const food=state.food||{gaps:[],manualFood:[],cartKeys:[],inventory:[]};
    const cartSet=new Set((food.cartKeys||[]).map(String));
    const inventory=(food.inventory||[]).filter(item=>item.is_active!==false);
    const inventoryByName=new Map(inventory.map(item=>[normalizedIngredient(item.name,item.unit),item]));
    const pendingCheckoutKeys=new Set((state.checkoutItems||[]).map(item=>String(item.shopping_key||'')));
    const derivedKeys=new Set();

    (food.gaps||[]).forEach(item=>{
      const key=foodGapKey(item);
      if(pendingCheckoutKeys.has(key))return;
      const inCart=cartSet.has(key);
      const delayed=Boolean(item.buyFrom&&String(item.buyFrom)>todayIso());
      const stockName=item.garlic?item.purchaseName:item.label;
      const stockQuantity=item.garlic?item.purchaseQuantity:item.missing;
      const stockUnit=item.garlic?item.purchaseUnit:item.unit;
      const stockId=item.garlic?item.purchaseInventoryId:item.inventory_id;
      const buyQuantity=item.garlic?item.purchaseQuantity:item.missing;
      const buyUnit=item.garlic?item.purchaseUnit:item.unit;
      derivedKeys.add(normalizedIngredient(item.label,item.unit)+'|'+String(item.unit||'').toLocaleLowerCase('de-DE'));
      rows.push({
        id:'food-gap:'+key,key,source:'food-gap',label:item.label||'Lebensmittel',
        section:inCart?'cart':(delayed?'later':'now'),inCart,
        primary:'Kaufen '+fmtQty(buyQuantity,buyUnit),
        secondary:'Bedarf '+fmtQty(item.required,item.unit)+' · Vorrat '+fmtQty(item.available,item.unit),
        timing:item.shortageDate?'Gebraucht '+fmtDate(item.shortageDate):'',
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
      if(pendingCheckoutKeys.has(key))return;
      const inCart=cartSet.has(key);
      let primary=required&&unit?'Kaufen '+fmtQty(required,unit):'Manueller Food-Eintrag';
      let secondary='';
      let foodAction=null;
      let flags={converted:false,unitMismatch:false};

      if(required!==null&&required>0&&unit){
        const stock=inventoryByName.get(normalizedIngredient(item.label,unit));
        if(stock?.pending_weighing===true)return;
        const info=inventoryQuantityInUnit(stock,unit);
        const missing=Math.max(0,required-info.available);
        if(missing<=0)return;
        primary='Kaufen '+fmtQty(missing,unit);
        secondary='Bedarf '+fmtQty(required,unit)+' · Vorrat '+fmtQty(info.available,unit);
        foodAction={
          stockName:item.label,stockQuantity:missing,stockUnit:unit,
          stockId:info.unitMismatch?'':(stock?.id||''),shoppingId:item.id,
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
      const section=item.status==='cart'?'cart':item.status==='later'?'later':'now';
      const quantity=item.quantity!==null&&item.quantity!==undefined?fmtQty(item.quantity,item.unit||''):'';
      rows.push({
        id:'general:'+item.id,key:'general:'+item.id,source:'general',label:item.label,
        section,inCart:section==='cart',primary:quantity||item.category||'Manueller Eintrag',
        secondary:item.notes||'',timing:item.needed_by?'Benötigt '+fmtDate(item.needed_by):'',
        buyFrom:item.status==='later'?(item.needed_by||null):null,neededDate:item.needed_by||null,
        category:item.category||'Sonstiges',general:item,flags:{}
      });
    });

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
      row.flags?.converted?'<span>UMGERECHNET</span>':'',
      row.flags?.unitMismatch?'<span class="is-warn">EINHEIT PRÜFEN</span>':''
    ].filter(Boolean).join('');

    const completeAction=row.inCart
      ?''
      :row.source==='general'
        ?'<button type="button" data-shopping-done="'+esc(row.id)+'">✓ Erledigt</button>'
        :row.foodAction
          ?'<button type="button" data-shopping-food-complete="'+esc(row.id)+'">Vorrat korrigieren</button>'
          :'<button type="button" data-shopping-food-check="'+esc(row.id)+'">✓ Abhaken</button>';

    const postpone=row.source==='general'&&row.section!=='cart'
      ?'<button type="button" data-shopping-later="'+esc(row.id)+'">'+(row.section==='later'?'Heute':'Später')+'</button>'
      :'';

    const remove=row.source==='general'
      ?'<button type="button" class="is-quiet" data-shopping-delete="'+esc(row.id)+'">Entfernen</button>'
      :'';

    return '<article class="shopping-item-v643 '+(row.inCart?'is-cart':'')+'">'
      +'<div class="shopping-item-main-v643"><strong>'+esc(row.label)+'</strong><b>'+esc(row.primary||'')+'</b></div>'
      +'<button type="button" class="shopping-cart-v643 '+(row.inCart?'is-active':'')+'" data-shopping-cart="'+esc(row.id)+'" aria-label="'+(row.inCart?'Aus dem Einkaufswagen':'In den Einkaufswagen')+'" aria-pressed="'+row.inCart+'">'+cartIcon()+'</button>'
      +'<div class="shopping-item-meta-v643"><span>'+esc(row.secondary||row.timing||'')+'</span>'+(row.secondary&&row.timing?'<em>'+esc(row.timing)+'</em>':'')+'</div>'
      +'<div class="shopping-item-foot-v643"><div class="shopping-badges-v643">'+badges+'</div><div class="shopping-actions-v643">'+postpone+completeAction+remove+'</div></div>'
      +'</article>';
  }

  function sectionMarkup(id,title,subtitle,rows,footerAction=''){
    return '<section class="shopping-section-v643 is-'+id+'">'
      +'<header><div><span>'+esc(title)+'</span><small>'+esc(subtitle)+'</small></div><strong>'+rows.length+'</strong></header>'
      +(rows.length?'<div class="shopping-list-v643">'+rows.map(rowMarkup).join('')+'</div>':'<div class="shopping-empty-v643">Gerade leer.</div>')
      +(footerAction?'<div class="shopping-section-footer-v646">'+footerAction+'</div>':'')
      +'</section>';
  }

  function checkoutActionMarkup(){
    return '<button type="button" class="shopping-checkout-action-v646" data-shopping-checkout>'
      +'<span class="shopping-checkout-check-v646">2</span>'
      +'<span><strong>Kauf bestätigen</strong><small>Mengen, Packungen und MHD prüfen · Bon danach zuordnen</small></span>'
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
      +keys.map((key,index)=>{
        const group=groups.get(key)||[];
        return '<details class="shopping-date-group-v678" '+(index===0?'open':'')+'>'
          +'<summary><span>'+esc(fmtGroupDate(key==='undated'?null:key))+'</span><strong>'+group.length+'</strong></summary>'
          +'<div class="shopping-list-v643">'+group.map(rowMarkup).join('')+'</div>'
          +'</details>';
      }).join('')
      +'</div></section>';
  }

  function purchasedMarkup(){
    const checkouts=state.checkouts||[];
    if(!checkouts.length)return '';
    const money=value=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(value)||0);
    const when=value=>{
      try{return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}).format(new Date(value));}
      catch(_){return '';}
    };
    return '<section class="shopping-section-v643 is-purchased-v647">'
      +'<header><div><span>SCHRITT 3 · BON</span><small>gekaufter Einkauf · Bon zuordnen oder Produkte prüfen</small></div><strong>'+checkouts.length+'</strong></header>'
      +'<div class="shopping-purchased-list-v647">'
      +checkouts.map(checkout=>{
        const openCount=(state.reviews||[]).filter(review=>String(review.checkout_id||'')===String(checkout.id)).length;
        const awaiting=checkout.status==='awaiting_receipt';
        const stateText=awaiting?'Bon fehlt':(openCount===1?'1 Produkt offen':openCount+' Produkte offen');
        return '<article class="shopping-purchased-row-v647">'
          +'<div class="shopping-purchased-store-v647"><small>'+esc(when(checkout.completed_at))+'</small><strong>'+esc(checkout.retailer||'Einkauf')+'</strong></div>'
          +'<b>'+(checkout.total_amount===null||checkout.total_amount===undefined?'—':esc(money(checkout.total_amount)))+'</b>'
          +'<span>'+esc(stateText)+'</span>'
          +(awaiting
            ?'<button type="button" data-checkout-attach-receipt="'+esc(checkout.id)+'">BON ZUORDNEN</button>'
            :'<button type="button" data-review-jump="'+esc(checkout.id)+'">PRODUKTE PRÜFEN</button>')
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
      return '<section id="shoppingReviewV647" class="shopping-review-v644 is-empty"><header><div><span>SCHRITT 4 · BON & PRODUKTE PRÜFEN</span><small>erscheint, sobald ein Bon mit dem Einkauf verknüpft ist</small></div><strong>0</strong></header><div class="shopping-review-empty-v644">Keine Produktzuordnung offen.</div></section>';
    }
    return '<section id="shoppingReviewV647" class="shopping-review-v644"><header><div><span>SCHRITT 4 · BON & PRODUKTE PRÜFEN</span><small>Bontext dem richtigen Produktstamm zuordnen · Bestand wird hier nicht erneut erhöht</small></div><strong>'+reviews.length+'</strong></header><div class="shopping-review-list-v644">'
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
          +'</div><div class="shopping-review-actions-v644">'
          +(candidate&&!pending?'<button type="button" data-review-confirm="'+esc(review.id)+'">✓ Passt</button>':'')
          +'<button type="button" data-review-choose="'+esc(review.id)+'">Produkt ändern</button>'
          +'<button type="button" data-review-pending="'+esc(review.id)+'">Fotos / Daten kommen noch</button>'
          +'<button type="button" class="is-quiet" data-review-ignore="'+esc(review.id)+'">Kein Produktstamm</button>'
          +'</div></article>';
      }).join('')
      +'</div></section>';
  }

  function shell(){
    const rows=buildRows();
    const now=rows.filter(row=>row.section==='now');
    const later=rows.filter(row=>row.section==='later');
    const cart=rows.filter(row=>row.section==='cart');
    const reviewCount=(state.reviews||[]).length;

    const warning=state.foodError
      ?'<div class="shopping-warning-v643"><strong>Food-Bedarf gerade nicht verfügbar.</strong><span>'+esc(state.foodError)+'</span></div>'
      :'';

    return '<div class="shopping-hero-v643"><div><span>SHOPPING CONTROL · V678</span><h2>EINKAUFSLISTE</h2><p>1 · Einpacken → 2 · Kauf bestätigen → 3 · Bon → 4 · Produkt prüfen.</p></div>'
      +'<button type="button" data-shopping-add>+ EINTRAG</button></div>'
      +'<div class="shopping-stepbar-v678"><span><b>1</b>Einkaufswagen</span><span><b>2</b>Menge & MHD</span><span><b>3</b>Bon</span><span><b>4</b>Produkt</span></div>'
      +'<div class="shopping-summary-v643"><div><strong>'+now.length+'</strong><span>Einkaufen</span></div><div><strong>'+later.length+'</strong><span>Später</span></div><div><strong>'+cart.length+'</strong><span>Im Wagen</span></div><div><strong>'+reviewCount+'</strong><span>Prüfen</span></div></div>'
      +warning
      +'<div class="shopping-sections-v643">'
      +sectionMarkup('now','EINKAUFEN','jetzt relevant',now)
      +laterSectionMarkup(later)
      +sectionMarkup('cart','IM EINKAUFSWAGEN','liegt schon drin',cart,cart.length?checkoutActionMarkup():'')
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
      +'<form data-shopping-add-form><label>Artikel<input name="label" required placeholder="z. B. Duschgel" autocomplete="off"></label>'
      +'<div class="shopping-form-grid-v643"><label>Menge<input name="quantity" type="number" min="0" step="0.01" inputmode="decimal"></label><label>Einheit<input name="unit" placeholder="Stück, Packung, ml …"></label></div>'
      +'<div class="shopping-form-grid-v643"><label>Kategorie<select name="category">'+CATEGORIES.map(cat=>'<option>'+esc(cat)+'</option>').join('')+'</select></label><label>Benötigt bis<input name="needed_by" type="date"></label></div>'
      +'<label>Notiz<input name="notes" placeholder="optional"></label>'
      +'<label class="shopping-later-check-v643"><input name="later" type="checkbox"> Erst später einkaufen</label>'
      +'<button type="submit" class="shopping-submit-v643">Zur Einkaufsliste</button></form></div>';
    document.body.appendChild(root);
    root.querySelector('[data-shopping-modal-close]')?.addEventListener('click',()=>root.remove());
    root.addEventListener('click',event=>{if(event.target===root)root.remove();});
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
      const later=form.get('later')==='on';
      if(!label)return;
      if(quantity!==null&&(!Number.isFinite(quantity)||quantity<0))return;
      try{
        await addGeneral({label,quantity,unit,category,needed_by:neededBy,notes,status:later?'later':'now'});
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

  function checkoutSnapshot(){
    return [...rowMap.values()].filter(row=>row.section==='cart').map(row=>{
      const plannedQuantity=row.foodAction?.stockQuantity??row.general?.quantity??null;
      const plannedUnit=row.foodAction?.stockUnit??row.general?.unit??null;
      const inventoryId=row.foodAction?.stockId||null;
      const base={key:row.key,label:row.label,plannedQuantity,plannedUnit,source:row.source,inventoryId,category:row.category||null};
      const product=defaultProductForCartItem(base);
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
    return '<option value="">Bon später zuordnen</option>'
      +receipts.map(tx=>{
        const label=[tx.merchant||'Einkauf',fmtDate(tx.transaction_date),money(tx.total_amount)].filter(Boolean).join(' · ');
        return '<option value="'+esc(tx.id)+'" '+(String(tx.id)===String(selectedId)?'selected':'')+'>'+esc(label)+'</option>';
      }).join('');
  }

  function openCheckoutModal(){
    const cart=checkoutSnapshot();
    if(!cart.length)return;
    document.getElementById('shoppingCheckoutV645')?.remove();
    const modal=document.createElement('div');
    modal.id='shoppingCheckoutV645';
    modal.className='shopping-modal-v643 shopping-checkout-modal-v645';
    modal.innerHTML='<div class="shopping-modal-card-v643 shopping-checkout-card-v678"><div class="shopping-modal-head-v643"><div><span>SCHRITT 2 VON 4</span><strong>Kauf bestätigen</strong></div><button type="button" data-checkout-close>✕</button></div>'
      +'<p class="shopping-checkout-copy-v645">Trag ein, was wirklich im Wagen gelandet ist. Das MHD gehört zu genau diesem Einkauf und nicht zum Produktstamm.</p>'
      +'<form data-checkout-form-v678>'
      +'<div class="shopping-checkout-items-v678">'
      +cart.map((item,index)=>{
        const product=item.productId?(state.products||[]).find(p=>String(p.id)===String(item.productId)):null;
        return '<article class="shopping-checkout-item-v678" data-checkout-index="'+index+'" data-shopping-key="'+esc(item.key)+'" data-source="'+esc(item.source)+'" data-inventory-id="'+esc(item.inventoryId||'')+'">'
          +'<div class="shopping-checkout-item-head-v678"><div><small>Geplant '+esc(fmtQty(item.plannedQuantity,item.plannedUnit||''))+'</small><strong>'+esc(item.label)+'</strong></div>'+(product?'<span>bekannt</span>':'<span>Produkt offen</span>')+'</div>'
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
      +'<div class="shopping-checkout-receipt-step-v678"><div><span>SCHRITT 3 VON 4</span><strong>Bon zuordnen</strong><small>Optional. Fehlt er noch, kannst du ihn später verknüpfen.</small></div><select data-checkout-receipt>'+receiptOptions()+'</select></div>'
      +'<button type="submit" class="shopping-submit-v643">Einkauf jetzt bestätigen</button>'
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
        const transactionId=String(event.currentTarget.querySelector('[data-checkout-receipt]')?.value||'').trim()||null;
        await completeCheckout(transactionId,items);
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

    const prepared=[];
    for(const item of cart)prepared.push(await ensureInventoryForPurchase(item,supabase,user));

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
      best_before_date:item.bestBefore||null,package_count:item.packageCount||null,note:item.note||null
    }));
    const snap=await supabase.from('shopping_checkout_items').insert(snapshotRows)
      .select('id,checkout_id,shopping_key,label,quantity,unit,source,planned_quantity,planned_unit,inventory_id,product_id,best_before_date,package_count,inventory_applied_at,note,created_at');
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

    for(const item of inserted){
      if(!item.inventory_id)continue;
      const applied=await supabase.rpc('apply_shopping_checkout_item_inventory',{p_checkout_item_id:item.id});
      if(applied.error)throw applied.error;
      if(applied.data&&applied.data.applied===false){
        throw new Error('Vorrat für „'+item.label+'“ konnte nicht übernommen werden: '+(applied.data.reason||'unbekannter Grund')+'.');
      }
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
    const modal=document.createElement('div');
    modal.id='shoppingReceiptAttachV678';
    modal.className='shopping-modal-v643';
    modal.innerHTML='<div class="shopping-modal-card-v643"><div class="shopping-modal-head-v643"><div><span>SCHRITT 3 VON 4</span><strong>Bon zuordnen</strong></div><button type="button" data-receipt-attach-close>✕</button></div>'
      +'<p class="shopping-checkout-copy-v645">Wähle den Finanz-Bon, der zu diesem Einkauf gehört.</p>'
      +'<label>Bon<select data-receipt-attach-select>'+receiptOptions()+'</select></label>'
      +'<button type="button" class="shopping-submit-v643" data-receipt-attach-confirm>Bon verknüpfen</button></div>';
    document.body.appendChild(modal);
    modal.querySelector('[data-receipt-attach-close]')?.addEventListener('click',()=>modal.remove());
    modal.addEventListener('click',event=>{if(event.target===modal)modal.remove();});
    modal.querySelector('[data-receipt-attach-confirm]')?.addEventListener('click',async()=>{
      const button=modal.querySelector('[data-receipt-attach-confirm]');
      const transactionId=String(modal.querySelector('[data-receipt-attach-select]')?.value||'').trim();
      if(!transactionId){alert('Bitte zuerst einen Bon auswählen.');return;}
      if(button)button.disabled=true;
      try{
        await attachReceiptToCheckout(checkoutId,transactionId);
        modal.remove();
      }catch(error){
        if(button)button.disabled=false;
        alert(error?.message||'Bon konnte nicht zugeordnet werden.');
      }
    });
  }

  async function attachReceiptToCheckout(checkoutId,transactionId){
    const {supabase}=await currentUser();
    const tx=(state.receipts||[]).find(item=>String(item.id)===String(transactionId));
    if(!tx)throw new Error('Kassenbon nicht gefunden.');
    const itemsResult=await supabase.from('shopping_checkout_items')
      .select('id,checkout_id,shopping_key,label,quantity,unit,source,planned_quantity,planned_unit,inventory_id,product_id,best_before_date,package_count,inventory_applied_at,note,created_at')
      .eq('checkout_id',checkoutId)
      .order('created_at',{ascending:true});
    if(itemsResult.error)throw itemsResult.error;
    const checkoutRows=itemsResult.data||[];
    const updated=await supabase.from('shopping_checkouts').update({
      finance_transaction_id:tx.id,status:'review',retailer:tx.merchant||null,total_amount:tx.total_amount??null,updated_at:new Date().toISOString()
    }).eq('id',checkoutId);
    if(updated.error)throw updated.error;
    await queueReceiptReviews(checkoutId,tx,checkoutRows);
    await reload({refreshFood:false});
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
    const {supabase}=await currentUser();
    const result=await supabase.rpc('confirm_shopping_receipt_review',{
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
    const products=[...(state.products||[])].sort((a,b)=>{
      const ar=String(a.retailer||'').trim().toLocaleLowerCase('de-DE')===retailer?0:1;
      const br=String(b.retailer||'').trim().toLocaleLowerCase('de-DE')===retailer?0:1;
      return ar-br||String(productLabel(a)).localeCompare(String(productLabel(b)),'de');
    });
    const modal=document.createElement('div');
    modal.id='shoppingProductPickerV644';
    modal.className='shopping-modal-v643 shopping-product-picker-v644';
    modal.innerHTML='<div class="shopping-modal-card-v643"><div class="shopping-modal-head-v643"><div><span>PRODUKT ZUORDNEN</span><strong>'+esc(review.receipt_label)+'</strong></div><button type="button" data-product-picker-close>✕</button></div>'
      +(products.length
        ?'<div class="shopping-product-options-v644">'+products.map(product=>{
          const candidate=reviewCandidate(review);
          const suggested=candidate&&String(candidate.id)===String(product.id);
          const pack=product.package_quantity!==null&&product.package_quantity!==undefined?fmtQty(product.package_quantity,product.package_unit||''):'';
          const meta=[product.brand,product.retailer,pack].filter(Boolean).join(' · ');
          return '<button type="button" data-product-choice="'+esc(product.id)+'" data-product-name="'+esc(product.product_name||'Produkt')+'" class="'+(suggested?'is-suggested-v651':'')+'">'
            +'<span>'+(suggested?'VORSCHLAG · ':'')+esc(meta||'Bekanntes Produkt')+'</span>'
            +'<strong>'+esc(product.product_name||productLabel(product))+'</strong>'
            +'</button>';
        }).join('')+'</div>'
        :'<div class="shopping-review-empty-v644">Noch keine bekannten Produkte im Produktstamm.</div>')
      +'<button type="button" class="shopping-product-new-v644" data-product-new-pending>Anderes Produkt · Fotos / Daten kommen noch</button></div>';
    document.body.appendChild(modal);
    modal.querySelector('[data-product-picker-close]')?.addEventListener('click',()=>modal.remove());
    modal.addEventListener('click',event=>{if(event.target===modal)modal.remove();});
    modal.querySelectorAll('[data-product-choice]').forEach(button=>button.addEventListener('click',async()=>{
      if(button.disabled)return;
      modal.querySelectorAll('[data-product-choice]').forEach(item=>item.disabled=true);
      button.classList.add('is-saving-v651');
      const oldText=button.innerHTML;
      button.innerHTML='<span>WIRD ÜBERNOMMEN</span><strong>'+esc(button.dataset.productName||'Produkt')+'</strong>';
      try{
        await confirmReview(review.id,button.dataset.productChoice);
        modal.remove();
      }catch(error){
        modal.querySelectorAll('[data-product-choice]').forEach(item=>item.disabled=false);
        button.classList.remove('is-saving-v651');
        button.innerHTML=oldText;
        alert(error?.message||'Produkt konnte nicht zugeordnet werden.');
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
    if(row.source==='general'){
      const item=row.general;
      if(row.inCart){
        await updateGeneral(item.id,{status:item.return_status||'now',return_status:null});
      }else{
        const returnStatus=item.status==='later'?'later':'now';
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
    root.querySelectorAll('[data-review-jump]').forEach(button=>button.addEventListener('click',()=>{
      document.getElementById('shoppingReviewV647')?.scrollIntoView({behavior:'smooth',block:'start'});
    }));
    root.querySelector('[data-shopping-retry]')?.addEventListener('click',()=>reload());
    root.querySelectorAll('[data-shopping-cart]').forEach(button=>button.addEventListener('click',async()=>{
      const row=rowMap.get(button.dataset.shoppingCart);if(!row)return;
      try{await toggleCart(row);}catch(error){alert(error?.message||'Einkaufswagen konnte nicht geändert werden.');}
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
      products:state.products.map(item=>({...item}))
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