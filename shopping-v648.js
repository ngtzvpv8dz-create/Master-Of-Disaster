/* V648 · SHOPPING / PASTEL NAVY PALETTE
   Dedicated shopping surface. Combines dynamic Food demand with general manual shopping items.
   Food demand remains calculated in Food and is not duplicated into shopping_items.
*/
(function(){
  'use strict';
  if(window.__modShoppingV648)return;

  const VERSION='V648';
  const ROOT_ID='modShoppingV643';
  const BODY_CLASS='mod-shopping-v643';
  const SURFACE_CLASS='mod-shopping-surface-v643';
  const CATEGORIES=['Lebensmittel','Haushalt','Drogerie','Technik','Sonstiges'];

  let state={general:[],food:null,reviews:[],products:[],aliases:[],checkouts:[],checkoutItems:[],receipts:[],loading:false,error:'',foodError:''};
  let loadPromise=null;
  let rowMap=new Map();
  let hubPatched=false;
  let originalHubShow=null;
  let originalHubOpen=null;

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
    if(item?.inventory_id)return 'stock:'+String(item.inventory_id)+':'+unit.toLocaleLowerCase('de-DE');
    return 'free:'+normalizedIngredient(item?.label||item?.name,unit)+':'+unit.toLocaleLowerCase('de-DE');
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
          .select('id,finance_item_id,checkout_id,retailer,receipt_label,normalized_label,status,product_id,notes,inventory_applied_at,created_at,updated_at,resolved_at')
          .in('status',['pending','new_product_pending'])
          .order('created_at',{ascending:false}),
        supabase.from('shopping_products')
          .select('id,retailer,brand,product_name,variant,category,package_quantity,package_unit,barcode,inventory_id,nutrition_per_100,product_data,notes,active')
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

      const [checkoutResult,receiptResult]=await Promise.all([
        supabase.from('shopping_checkouts')
          .select('id,finance_transaction_id,status,retailer,total_amount,completed_at,created_at,updated_at')
          .eq('status','review')
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
          .select('id,checkout_id,shopping_key,label,quantity,unit,source,created_at')
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
        timing:item.shortageDate?(delayed?'Ab '+fmtDate(item.buyFrom)+' · gebraucht '+fmtDate(item.shortageDate):'Gebraucht ab '+fmtDate(item.shortageDate)):'',
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

    const completeAction=row.source==='general'
      ?'<button type="button" data-shopping-done="'+esc(row.id)+'">✓ Erledigt</button>'
      :row.foodAction
        ?'<button type="button" data-shopping-food-complete="'+esc(row.id)+'">✓ Vorhanden / eingekauft</button>'
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
      +'<span class="shopping-checkout-check-v646">✓</span>'
      +'<span><strong>Einkauf abschließen</strong><small>Bon auswählen und Gegenprüfung starten</small></span>'
      +'<b aria-hidden="true">›</b>'
      +'</button>';
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
      +'<header><div><span>GEKAUFT</span><small>Bon-Zuordnung noch offen</small></div><strong>'+checkouts.length+'</strong></header>'
      +'<div class="shopping-purchased-list-v647">'
      +checkouts.map(checkout=>{
        const openCount=(state.reviews||[]).filter(review=>String(review.checkout_id||'')===String(checkout.id)).length;
        const openText=openCount===1?'1 offen':openCount+' offen';
        return '<article class="shopping-purchased-row-v647">'
          +'<div class="shopping-purchased-store-v647"><small>'+esc(when(checkout.completed_at))+'</small><strong>'+esc(checkout.retailer||'Einkauf')+'</strong></div>'
          +'<b>'+esc(money(checkout.total_amount))+'</b>'
          +'<span>'+esc(openText)+'</span>'
          +'<button type="button" data-review-jump="'+esc(checkout.id)+'">BON PRÜFEN</button>'
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
    const normalized=String(review.normalized_label||'').trim();
    const retailer=String(review.retailer||'').trim().toLocaleLowerCase('de-DE');
    const alias=(state.aliases||[]).find(a=>
      a.is_default===true
      &&String(a.normalized_label||'')===normalized
      &&String(a.retailer||'').trim().toLocaleLowerCase('de-DE')===retailer
    );
    return alias?(state.products||[]).find(p=>String(p.id)===String(alias.product_id))||null:null;
  }

  function reviewMarkup(){
    const reviews=[...(state.reviews||[])].sort((a,b)=>{
      const ac=reviewCandidate(a)?0:(a.status==='new_product_pending'?2:1);
      const bc=reviewCandidate(b)?0:(b.status==='new_product_pending'?2:1);
      return ac-bc||String(a.receipt_label||'').localeCompare(String(b.receipt_label||''),'de');
    });
    if(!reviews.length){
      return '<section id="shoppingReviewV647" class="shopping-review-v644 is-empty"><header><div><span>EINKAUF GEGENPRÜFEN</span><small>Bonpositionen mit Produktbezug</small></div><strong>0</strong></header><div class="shopping-review-empty-v644">Nichts offen. Der Produktdetektiv hat Pause.</div></section>';
    }
    return '<section id="shoppingReviewV647" class="shopping-review-v644"><header><div><span>BON GEGENPRÜFEN</span><small>Produkt erkennen, bestätigen oder neue Daten nachreichen</small></div><strong>'+reviews.length+'</strong></header><div class="shopping-review-list-v644">'
      +reviews.map(review=>{
        const candidate=reviewCandidate(review);
        const pending=review.status==='new_product_pending';
        return '<article class="shopping-review-item-v644 '+(pending?'is-pending-data':'')+'">'
          +'<div class="shopping-review-copy-v644"><small>'+esc(review.retailer||'Händler')+'</small><strong>'+esc(review.receipt_label||'Bonposition')+'</strong>'
          +(pending
            ?'<span>Daten kommen noch · noch keinem Produkt zugeordnet</span>'
            :candidate
              ?'<span>Vorschlag: '+esc(productLabel(candidate))+'</span>'
              :'<span>Noch kein eindeutiger Produktvorschlag</span>')
          +'</div><div class="shopping-review-actions-v644">'
          +(candidate&&!pending?'<button type="button" data-review-confirm="'+esc(review.id)+'">✓ Passt</button>':'')
          +'<button type="button" data-review-choose="'+esc(review.id)+'">Produkt ändern</button>'
          +'<button type="button" data-review-pending="'+esc(review.id)+'">Daten kommen noch</button>'
          +'<button type="button" class="is-quiet" data-review-ignore="'+esc(review.id)+'">Nicht zuordnen</button>'
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

    return '<div class="shopping-hero-v643"><div><span>SHOPPING CONTROL</span><h2>EINKAUFSLISTE</h2><p>Food-Bedarf und normale Einkäufe an einem Ort. Ohne Zettel-Zoo.</p></div>'
      +'<button type="button" data-shopping-add>+ EINTRAG</button></div>'
      +'<div class="shopping-summary-v643"><div><strong>'+now.length+'</strong><span>Einkaufen</span></div><div><strong>'+later.length+'</strong><span>Später</span></div><div><strong>'+cart.length+'</strong><span>Im Wagen</span></div><div><strong>'+reviewCount+'</strong><span>Prüfen</span></div></div>'
      +warning
      +'<div class="shopping-sections-v643">'
      +sectionMarkup('now','EINKAUFEN','jetzt relevant',now)
      +sectionMarkup('later','SPÄTER EINKAUFEN','bewusst geparkt',later)
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

  function checkoutSnapshot(){
    return [...rowMap.values()].filter(row=>row.section==='cart').map(row=>({
      key:row.key,
      label:row.label,
      quantity:row.foodAction?.stockQuantity??row.general?.quantity??null,
      unit:row.foodAction?.stockUnit??row.general?.unit??null,
      source:row.source
    }));
  }

  function openCheckoutModal(){
    const cart=checkoutSnapshot();
    if(!cart.length)return;
    document.getElementById('shoppingCheckoutV645')?.remove();
    const modal=document.createElement('div');
    modal.id='shoppingCheckoutV645';
    modal.className='shopping-modal-v643 shopping-checkout-modal-v645';
    const receipts=(state.receipts||[]);
    modal.innerHTML='<div class="shopping-modal-card-v643"><div class="shopping-modal-head-v643"><div><span>EINKAUF ABSCHLIESSEN</span><strong>'+cart.length+' Positionen gekauft</strong></div><button type="button" data-checkout-close>✕</button></div>'
      +'<p class="shopping-checkout-copy-v645">Wähle den passenden Kassenbon. Danach wandern die Bonpositionen direkt in „Einkauf gegenprüfen“.</p>'
      +(receipts.length?'<div class="shopping-checkout-receipts-v645">'+receipts.map(tx=>'<button type="button" data-checkout-receipt="'+esc(tx.id)+'"><span>'+esc(tx.merchant||'Einkauf')+' · '+esc(fmtDate(tx.transaction_date))+'</span><strong>'+esc(new Intl.NumberFormat('de-DE',{style:'currency',currency:tx.currency||'EUR'}).format(Number(tx.total_amount)||0))+'</strong></button>').join('')+'</div>':'<div class="shopping-review-empty-v644">Noch kein Kassenbon in Finanzen gefunden.</div>')
      +'</div>';
    document.body.appendChild(modal);
    modal.querySelector('[data-checkout-close]')?.addEventListener('click',()=>modal.remove());
    modal.addEventListener('click',event=>{if(event.target===modal)modal.remove();});
    modal.querySelectorAll('[data-checkout-receipt]').forEach(button=>button.addEventListener('click',async()=>{
      button.disabled=true;
      try{
        await completeCheckout(button.dataset.checkoutReceipt,cart);
        modal.remove();
      }catch(error){
        button.disabled=false;
        alert(error?.message||'Einkauf konnte nicht abgeschlossen werden.');
      }
    }));
  }

  async function completeCheckout(transactionId,cart){
    const {supabase,user}=await currentUser();
    const tx=(state.receipts||[]).find(item=>String(item.id)===String(transactionId));
    if(!tx)throw new Error('Kassenbon nicht gefunden.');

    const checkoutResult=await supabase.from('shopping_checkouts').insert({
      user_id:user.id,
      finance_transaction_id:tx.id,
      status:'review',
      retailer:tx.merchant||null,
      total_amount:tx.total_amount??null,
      completed_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    }).select('id').single();
    if(checkoutResult.error)throw checkoutResult.error;
    const checkoutId=checkoutResult.data.id;

    if(cart.length){
      const snapshotRows=cart.map(item=>({
        user_id:user.id,checkout_id:checkoutId,shopping_key:item.key,label:item.label,
        quantity:item.quantity,unit:item.unit,source:item.source
      }));
      const snap=await supabase.from('shopping_checkout_items').insert(snapshotRows);
      if(snap.error)throw snap.error;
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
        .select('id,finance_item_id,status,product_id,notes,resolved_at,inventory_applied_at')
        .in('finance_item_id',ids);
      if(existing.error)throw existing.error;
      existingMap=new Map((existing.data||[]).map(item=>[String(item.finance_item_id),item]));
    }

    for(const item of items){
      const normalized=normalizeReceiptLabel(item.item_name);
      const existing=existingMap.get(String(item.id));
      if(existing&&['confirmed','ignored'].includes(existing.status)){
        const keep=await supabase.from('shopping_receipt_reviews').update({checkout_id:checkoutId,updated_at:new Date().toISOString()}).eq('id',existing.id);
        if(keep.error)throw keep.error;
        continue;
      }
      const alias=(state.aliases||[]).find(a=>
        a.active!==false&&a.is_default===true
        &&String(a.normalized_label||'')===normalized
        &&String(a.retailer||'').trim().toLocaleLowerCase('de-DE')===String(tx.merchant||'').trim().toLocaleLowerCase('de-DE')
      );
      const row={
        user_id:user.id,finance_item_id:item.id,checkout_id:checkoutId,
        retailer:tx.merchant||'Unbekannter Händler',
        receipt_label:item.item_name,
        normalized_label:normalized,
        status:'pending',
        product_id:alias?.product_id||null,
        notes:alias?.product_id?'Bekanntes Produkt als Vorschlag gefunden.':'Noch keine eindeutige Produktzuordnung.',
        resolved_at:null,
        updated_at:new Date().toISOString()
      };
      const upsert=await supabase.from('shopping_receipt_reviews').upsert(row,{onConflict:'user_id,finance_item_id'});
      if(upsert.error)throw upsert.error;
    }

    await reload();
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
    if(!review||!product)throw new Error('Produktzuordnung konnte nicht gefunden werden.');
    const {supabase,user}=await currentUser();

    const existingAliases=(state.aliases||[]).filter(alias=>
      String(alias.retailer||'').trim().toLocaleLowerCase('de-DE')===String(review.retailer||'').trim().toLocaleLowerCase('de-DE')
      &&String(alias.normalized_label||'')===String(review.normalized_label||'')
    );
    const exactAlias=existingAliases.find(alias=>String(alias.product_id)===String(product.id));
    if(!exactAlias){
      const aliasResult=await supabase.from('shopping_receipt_aliases').insert({
        user_id:user.id,retailer:review.retailer,receipt_label:review.receipt_label,
        normalized_label:review.normalized_label,product_id:product.id,is_default:existingAliases.length===0
      });
      if(aliasResult.error)throw aliasResult.error;
    }

    let inventoryAppliedAt=review.inventory_applied_at||null;
    if(!inventoryAppliedAt&&product.inventory_id&&Number(product.package_quantity)>0&&product.package_unit){
      const [financeResult,inventoryResult]=await Promise.all([
        supabase.from('finance_items').select('quantity').eq('id',review.finance_item_id).single(),
        supabase.from('food_inventory').select('id,quantity,unit').eq('id',product.inventory_id).single()
      ]);
      if(financeResult.error)throw financeResult.error;
      if(inventoryResult.error)throw inventoryResult.error;
      const inventory=inventoryResult.data;
      if(String(inventory.unit||'').trim().toLocaleLowerCase('de-DE')===String(product.package_unit||'').trim().toLocaleLowerCase('de-DE')){
        const delta=Number(product.package_quantity)*(Number(financeResult.data?.quantity)||1);
        if(Number.isFinite(delta)&&delta>0){
          const next=(Number(inventory.quantity)||0)+delta;
          const adjust=await supabase.rpc('adjust_food_inventory',{
            p_inventory_id:inventory.id,p_new_quantity:next,
            p_reason:'Einkauf gegenprüft',p_note:review.retailer+' · '+review.receipt_label
          });
          if(adjust.error)throw adjust.error;
          inventoryAppliedAt=new Date().toISOString();
        }
      }
    }

    const result=await supabase.from('shopping_receipt_reviews').update({
      status:'confirmed',product_id:product.id,
      notes:'Produkt in der Einkaufskontrolle bestätigt.',
      inventory_applied_at:inventoryAppliedAt,
      resolved_at:new Date().toISOString(),updated_at:new Date().toISOString()
    }).eq('id',review.id);
    if(result.error)throw result.error;
    await maybeFinishCheckout(review.checkout_id);
    await reload();
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
        ?'<div class="shopping-product-options-v644">'+products.map(product=>'<button type="button" data-product-choice="'+esc(product.id)+'"><span>'+esc(product.retailer||'Ohne Händler')+'</span><strong>'+esc(productLabel(product))+'</strong></button>').join('')+'</div>'
        :'<div class="shopping-review-empty-v644">Noch keine bekannten Produkte im Produktstamm.</div>')
      +'<button type="button" class="shopping-product-new-v644" data-product-new-pending>Anderes Produkt · Daten kommen noch</button></div>';
    document.body.appendChild(modal);
    modal.querySelector('[data-product-picker-close]')?.addEventListener('click',()=>modal.remove());
    modal.addEventListener('click',event=>{if(event.target===modal)modal.remove();});
    modal.querySelectorAll('[data-product-choice]').forEach(button=>button.addEventListener('click',async()=>{
      try{await confirmReview(review.id,button.dataset.productChoice);modal.remove();}
      catch(error){alert(error?.message||'Produkt konnte nicht zugeordnet werden.');}
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
    version:VERSION,open,close,render,reload,openCheckoutModal,
    getState:()=>({
      general:state.general.map(item=>({...item})),
      food:state.food?structuredClone(state.food):null,
      reviews:state.reviews.map(item=>({...item})),
      products:state.products.map(item=>({...item}))
    }),
    centralShopping:true,foodDemandIsDynamic:true,productReviewPlanned:false,productReviewActive:true,checkoutActive:true
  };
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
    observer.observe(document.documentElement,{subtree:true,childList:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();