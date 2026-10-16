/* V828 · Zusatz-Snacks / Getränke im FOOD-Heute-Bereich.
   Nur bestätigte Einträge in food_extra_consumptions; verändert NICHT den Vorrat. */
(function(){
  'use strict';
  if(window.__modFoodExtrasV828)return;
  const ROOT='modFoodV544', PANEL='food-extra-snacks-v828';
  const nf=(value,d=1)=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:d}).format(Number(value)||0);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin'}).format(new Date());
  let date='',rows=[],products=[],loading=false,ready=false,formOpen=false,editing=null,mode='catalog',selected='',term='',busy=false,error='',notice='',bound=false;
  const valid=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n))&&Number(n)>=0;
  const decimal=x=>Number(String(x??'').trim().replace(',','.'));
  const client=()=>window.getSupabaseClient?.();
  function productName(p){return [p.brand,p.product_name,p.variant].filter(Boolean).join(' · ');}
  function nval(p,key){const v=p?.nutrition_per_100?.[key];return valid(v)?Number(v):null;}
  function bases(p){
    const basis=String(p?.nutrition_per_100?.basis||p?.product_data?.nutrition_basis||'').toLowerCase();
    return /100.ml|per_100_ml/.test(basis)||p.package_unit==='ml'?'ml':'g';
  }
  function offered(){
    return products.filter(p=>valid(nval(p,'energy_kcal'))&&valid(nval(p,'protein_g')))
      .sort((a,b)=>productName(a).localeCompare(productName(b),'de'));
  }
  function chosen(){return products.find(p=>String(p.id)===selected)||null;}
  function initialQty(p){
    if(!p)return 100;
    const unit=bases(p), serving=Number(p.serving_quantity),pack=Number(p.package_quantity);
    if(p.serving_unit===unit&&serving>0&&serving<=1500)return serving;
    if(p.package_unit===unit&&pack>0&&pack<=1000)return pack;
    return 100;
  }
  function valuesFromCatalog(p,quantity){
    const factor=quantity/100,n=p.nutrition_per_100||{};
    const scaled=key=>valid(n[key])?Math.round(Number(n[key])*factor*100)/100:null;
    const productData=p.product_data||{};
    let caffeine=null;
    if(valid(n.caffeine_mg))caffeine=scaled('caffeine_mg');
    else if(valid(productData.caffeine_mg_per_sachet)&&Number(productData.sachet_g)>0&&bases(p)==='g')
      caffeine=Math.round(Number(productData.caffeine_mg_per_sachet)*quantity/Number(productData.sachet_g)*100)/100;
    return {calories_kcal:scaled('energy_kcal'),protein_g:scaled('protein_g'),
      carbohydrates_g:scaled('carbohydrates_g'),fat_g:scaled('fat_g'),
      sugars_g:scaled('sugars_g'),salt_g:scaled('salt_g'),caffeine_mg:caffeine};
  }
  function panel(){return document.getElementById(PANEL);}
  function productOptions(){
    const match=term.toLocaleLowerCase('de-DE');
    const options=offered().filter(p=>!match||productName(p).toLocaleLowerCase('de-DE').includes(match));
    if(!options.length)return '<option value="">Keine passenden Produkte mit Nährwerten</option>';
    return '<option value="">Produkt wählen …</option>'+options.slice(0,180).map(p=>
      '<option value="'+esc(p.id)+'"'+(selected===String(p.id)?' selected':'')+'>'+esc(productName(p))+'</option>').join('');
  }
  function formHtml(){
    if(!formOpen)return '';
    const p=chosen(),catalog=mode==='catalog';
    return '<form class="food-extra-form-v828" data-food-extra-form>'+
      '<div class="food-extra-mode-v828"><button type="button" data-extra-mode="catalog" class="'+(catalog?'is-selected':'')+'">Aus Produktstamm</button>'+
      '<button type="button" data-extra-mode="manual" class="'+(!catalog?'is-selected':'')+'">Manuell erfassen</button></div>'+
      (catalog?'<label>Produkt suchen<input type="search" name="search" value="'+esc(term)+'" placeholder="z. B. Red Bull, HOLY, Schokolade" data-extra-search autocomplete="off"></label>'+
        '<label>Produkt<select name="product" data-extra-product>'+productOptions()+'</select></label>'+
        '<div class="food-extra-fields-v828"><label>Menge<input name="quantity" type="number" step="0.1" min="0.1" inputmode="decimal" value="'+esc(p?initialQty(p):100)+'" required data-extra-quantity></label>'+
        '<label>Einheit <output data-extra-unit>'+esc(bases(p))+'</output></label></div>'+
        '<p class="food-extra-preview-v828" data-extra-preview>'+esc(p?'Nährwerte werden berechnet.':'Bitte ein Produkt auswählen.')+'</p>'
      :'<label>Bezeichnung<input name="title" maxlength="160" placeholder="z. B. 2 Stück Schokolade" required></label>'+
        '<div class="food-extra-fields-v828"><label>Menge<input name="quantity" type="number" step="0.1" min="0.1" value="1" inputmode="decimal" required></label>'+
        '<label>Einheit<select name="unit"><option>Portion</option><option>Stück</option><option>g</option><option>ml</option></select></label></div>'+
        '<p class="food-extra-help-v828">Nährwerte für genau die eingetragene Menge (nicht je 100 g):</p>'+
        '<div class="food-extra-macros-v828">'+[
          ['calories_kcal','Kalorien (kcal)',true],['protein_g','Protein (g)',true],
          ['carbohydrates_g','Kohlenhydrate (g)',false],['fat_g','Fett (g)',false],
          ['sugars_g','Zucker (g)',false],['salt_g','Salz (g)',false],['caffeine_mg','Koffein (mg)',false]
        ].map(([key,label,required])=>'<label>'+label+'<input name="'+key+'" type="number" min="0" step="0.01" inputmode="decimal" '+(required?'required':'')+'></label>').join('')+'</div>')+
      '<div class="food-extra-actions-v828"><button type="submit" data-extra-save>✓ '+(editing?'Änderung speichern':'Zusatz eintragen')+'</button>'+
      '<button type="button" data-extra-cancel>Abbrechen</button></div>'+
      '<small>Nur tatsächlich verzehrte Extras eintragen. Der Vorrat wird hierbei nicht automatisch abgebucht.</small>'+
    '</form>';
  }
  function rowsHtml(){
    const sum=rows.reduce((a,r)=>({kcal:a.kcal+Number(r.calories_kcal||0),protein:a.protein+Number(r.protein_g||0),carbs:a.carbs+Number(r.carbohydrates_g||0),fat:a.fat+Number(r.fat_g||0)}),{kcal:0,protein:0,carbs:0,fat:0});
    return '<div class="food-extra-total-v828"><b>'+rows.length+' Zusatz'+(rows.length===1?'':'-Snacks')+'</b>'+
      '<span>'+nf(sum.kcal,0)+' kcal · '+nf(sum.protein)+' g Protein</span></div>'+
      (rows.length?'<ul class="food-extra-list-v828">'+rows.map(r=>
        '<li><div><strong>'+esc(r.title)+'</strong><small>'+esc(nf(r.quantity)+' '+r.unit)+' · '+nf(r.calories_kcal,0)+' kcal · '+nf(r.protein_g)+' g Protein'+
        (r.carbohydrates_g!==null?' · KH '+nf(r.carbohydrates_g)+' g':'')+(r.fat_g!==null?' · Fett '+nf(r.fat_g)+' g':'')+'</small></div>'+
        '<div class="food-extra-row-actions-v828"><button type="button" data-extra-edit="'+esc(r.id)+'" aria-label="'+esc(r.title)+' bearbeiten" title="Bearbeiten">✎</button>'+
        '<button type="button" data-extra-delete="'+esc(r.id)+'" aria-label="'+esc(r.title)+' löschen" title="Entfernen">✕</button></div></li>').join('')+'</ul>':
      '<p class="food-extra-empty-v828">Noch kein zusätzlicher Snack eingetragen.</p>');
  }
  function draw(){
    const el=panel();if(!el)return;
    el.innerHTML='<div class="food-extra-heading-v828"><div><strong>🍬 Zusatz-Snacks &amp; Getränke</strong><small>Zusätzlich zu den geplanten Mahlzeiten</small></div>'+
      '<button type="button" data-extra-toggle aria-expanded="'+formOpen+'">'+(formOpen?'− Schließen':'+ Hinzufügen')+'</button></div>'+
      (error?'<p class="food-extra-error-v828" role="alert">'+esc(error)+' <button type="button" data-extra-retry>Erneut laden</button></p>':'')+
      (notice?'<p class="food-extra-notice-v828" role="status">'+esc(notice)+'</p>':'')+
      (!ready?'<p class="food-extra-empty-v828">'+(loading?'Einträge werden geladen …':'Cloud-Daten prüfen …')+'</p>':rowsHtml())+
      (ready?formHtml():'');
    if(formOpen&&mode==='catalog')updatePreview();
  }
  function updatePreview(){
    const form=panel()?.querySelector('[data-food-extra-form]');if(!form||mode!=='catalog')return;
    const p=chosen(),output=form.querySelector('[data-extra-preview]');
    form.querySelector('[data-extra-unit]').textContent=bases(p);
    if(!p){output.textContent='Bitte ein Produkt mit vorhandenen Nährwerten auswählen.';return;}
    const qty=decimal(form.elements.quantity.value);
    if(!(qty>0)){output.textContent='Bitte eine gültige Menge eingeben.';return;}
    const n=valuesFromCatalog(p,qty);
    output.textContent=nf(n.calories_kcal,1)+' kcal · '+nf(n.protein_g)+' g Protein · '+nf(n.carbohydrates_g)+' g KH · '+nf(n.fat_g)+' g Fett';
  }
  async function fetchAll(){
    const supabase=client();if(!supabase)throw new Error('Supabase-Verbindung fehlt.');
    const auth=await supabase.auth.getSession();
    if(auth.error||!auth.data?.session?.user?.id)throw new Error('Bitte zuerst anmelden.');
    const uid=auth.data.session.user.id;
    const [a,b]=await Promise.all([
      supabase.from('food_extra_consumptions').select('id,consumption_date,product_id,title,kind,quantity,unit,calories_kcal,protein_g,carbohydrates_g,fat_g,sugars_g,salt_g,caffeine_mg,nutrition_source,source_reference').eq('user_id',uid).eq('consumption_date',date).order('created_at',{ascending:true}).limit(500),
      supabase.from('shopping_products').select('id,brand,product_name,variant,package_quantity,package_unit,serving_quantity,serving_unit,nutrition_per_100,product_data').eq('active',true).range(0,999)
    ]);
    if(a.error)throw a.error;if(b.error)throw b.error;
    rows=a.data||[];products=b.data||[];return uid;
  }
  async function refresh(){
    if(loading)return;
    loading=true;error='';try{await fetchAll();ready=true;}
    catch(e){error='Daten konnten nicht geladen werden: '+(e.message||e);ready=false;}
    finally{loading=false;draw();}
  }
  function mount(){
    const root=document.getElementById(ROOT);
    const summary=root?.querySelector('[data-food-day-summary-today]');
    if(!summary||root.getAttribute('aria-hidden')==='true')return;
    if(panel())return;
    const el=document.createElement('section');el.id=PANEL;el.className='food-extra-panel-v828';
    el.setAttribute('aria-label','Zusatz-Snacks und Getränke');
    summary.insertAdjacentElement('afterend',el);
    const d=today();
    if(date!==d){date=d;ready=false;rows=[];formOpen=false;editing=null;notice='';}
    draw();
    if(!ready&&!loading)refresh();
  }
  function editingRow(row){
    editing=row.id;mode='manual';formOpen=true;notice='';error='';draw();
    const form=panel()?.querySelector('[data-food-extra-form]');if(!form)return;
    for(const name of ['title','quantity','unit','calories_kcal','protein_g','carbohydrates_g','fat_g','sugars_g','salt_g','caffeine_mg']){
      if(form.elements[name]&&row[name]!==null&&row[name]!==undefined)form.elements[name].value=String(row[name]);
    }
    form.querySelector('[name="title"]')?.focus();
  }
  async function persist(form){
    if(busy)return;
    const supabase=client(),auth=await supabase.auth.getSession();
    const uid=auth.data?.session?.user?.id;if(auth.error||!uid)throw new Error('Keine aktive Supabase-Anmeldung.');
    const qty=decimal(form.elements.quantity.value);
    if(!Number.isFinite(qty)||qty<=0)throw new Error('Die Menge muss größer als null sein.');
    let entry;
    if(mode==='catalog'){
      const p=chosen();if(!p)throw new Error('Bitte ein Produkt auswählen.');
      const n=valuesFromCatalog(p,qty);
      if(!valid(n.calories_kcal)||!valid(n.protein_g))throw new Error('Für dieses Produkt fehlen Kalorien oder Protein.');
      entry={product_id:p.id,title:productName(p),kind:bases(p)==='ml'?'drink':'snack',quantity:qty,unit:bases(p),...n,nutrition_source:'Produktstamm: Herstellerwerte je 100 '+bases(p)};
    }else{
      const title=String(form.elements.title.value||'').trim();if(!title)throw new Error('Bitte eine Bezeichnung angeben.');
      const read=(key,required=false)=>{
        const raw=String(form.elements[key]?.value||'').trim();
        if(!raw&&!required)return null;
        const n=decimal(raw);if(!Number.isFinite(n)||n<0)throw new Error('Ungültiger Wert: '+key);
        return n;
      };
      entry={product_id:null,title,kind:form.elements.unit.value==='ml'?'drink':'snack',quantity:qty,unit:form.elements.unit.value,
        calories_kcal:read('calories_kcal',true),protein_g:read('protein_g',true),
        carbohydrates_g:read('carbohydrates_g'),fat_g:read('fat_g'),
        sugars_g:read('sugars_g'),salt_g:read('salt_g'),caffeine_mg:read('caffeine_mg'),
        nutrition_source:'Manuell vom Nutzer eingegeben'};
    }
    busy=true;const submit=form.querySelector('[data-extra-save]');if(submit)submit.disabled=true;
    try{
      let res;
      if(editing){
        res=await supabase.from('food_extra_consumptions').update(entry).eq('id',editing).eq('user_id',uid).select('id').single();
      }else{
        const ref='food-ui-v828-'+crypto.randomUUID();
        res=await supabase.from('food_extra_consumptions').insert({...entry,user_id:uid,consumption_date:date,source_reference:ref}).select('id').single();
      }
      if(res.error)throw res.error;
      formOpen=false;editing=null;notice='✓ Gespeichert und in die Tagesbilanz übernommen.';error='';
      await refresh();
      window.__modFoodNutritionV711?.refresh?.();
    }finally{busy=false;if(submit)submit.disabled=false;}
  }
  async function remove(id){
    if(busy)return;
    const row=rows.find(r=>String(r.id)===String(id));if(!row)return;
    if(!confirm('„'+row.title+'“ wirklich aus der Tagesbilanz entfernen?'))return;
    busy=true;try{
      const supabase=client(),auth=await supabase.auth.getSession();
      const uid=auth.data?.session?.user?.id;
      if(!uid)throw new Error('Keine aktive Anmeldung.');
      const res=await supabase.from('food_extra_consumptions').delete().eq('id',id).eq('user_id',uid).select('id').single();
      if(res.error)throw res.error;
      notice='✓ Zusatz entfernt.';error='';await refresh();
      window.__modFoodNutritionV711?.refresh?.();
    }finally{busy=false;}
  }
  function styles(){
    if(document.getElementById('food-extra-style-v828'))return;
    const css=document.createElement('style');css.id='food-extra-style-v828';
    css.textContent=
      '.food-extra-panel-v828{margin:0 0 12px;padding:12px;border:1px solid rgba(116,145,117,.23);border-radius:13px;background:linear-gradient(130deg,#f8faf2,#f0f6ec);color:#344a3d;font-size:12px}'+
      '.food-extra-heading-v828,.food-extra-total-v828,.food-extra-list-v828 li,.food-extra-actions-v828,.food-extra-mode-v828{display:flex;align-items:center;justify-content:space-between;gap:9px}'+
      '.food-extra-heading-v828 strong{font-size:13px}.food-extra-heading-v828 small{display:block;font-size:10px;opacity:.76;margin-top:2px}'+
      '.food-extra-heading-v828 button,.food-extra-actions-v828 button,.food-extra-mode-v828 button,.food-extra-row-actions-v828 button{font:inherit;font-weight:700;border-radius:8px;border:1px solid #c8d8c7;padding:6px 9px;background:#fff;color:#365e43;cursor:pointer;white-space:nowrap}'+
      '.food-extra-heading-v828 button{background:#e5f3df;border-color:#badab6}'+
      '.food-extra-total-v828{margin-top:11px;padding-top:9px;border-top:1px solid #d6e3d5;font-size:11px}.food-extra-total-v828 span{color:#28764d;font-weight:800;font-variant-numeric:tabular-nums}'+
      '.food-extra-empty-v828{margin:9px 0 0;color:#718278;font-size:11px}'+
      '.food-extra-list-v828{padding:0;margin:9px 0 0;list-style:none}.food-extra-list-v828 li{padding:8px 0;border-top:1px solid rgba(142,166,142,.18)}'+
      '.food-extra-list-v828 li>div:first-child{min-width:0}.food-extra-list-v828 strong{display:block;font-size:11px;overflow-wrap:anywhere}.food-extra-list-v828 small{display:block;font-size:10px;line-height:1.4;color:#627b68}'+
      '.food-extra-row-actions-v828{display:flex;gap:5px}.food-extra-row-actions-v828 button{padding:4px 7px;font-size:13px}'+
      '.food-extra-form-v828{margin-top:11px;padding-top:10px;border-top:1px solid #d6e3d5;display:grid;gap:9px}.food-extra-form-v828 label{display:grid;gap:4px;font-size:11px;font-weight:700}'+
      '.food-extra-form-v828 input,.food-extra-form-v828 select{box-sizing:border-box;width:100%;min-width:0;border:1px solid #c5d5c6;border-radius:8px;padding:9px 8px;font:inherit;color:#283f31;background:#fff}'+
      '.food-extra-mode-v828{justify-content:flex-start}.food-extra-mode-v828 button{font-size:11px}.food-extra-mode-v828 button.is-selected{background:#365f43;color:#fff;border-color:#365f43}'+
      '.food-extra-fields-v828{display:grid;grid-template-columns:1fr 1fr;gap:10px}.food-extra-fields-v828 output{padding:10px 0}'+
      '.food-extra-macros-v828{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.food-extra-preview-v828{font-size:11px;color:#2c7451;font-weight:800}'+
      '.food-extra-help-v828,.food-extra-form-v828 small{font-size:10px;margin:0;line-height:1.4;color:#667767}'+
      '.food-extra-actions-v828{justify-content:flex-start}.food-extra-actions-v828 button[type=submit]{background:#d9efda;color:#24623c}'+
      '.food-extra-error-v828{color:#a43429;font-weight:700}.food-extra-notice-v828{color:#257246;font-weight:700}';
    document.head.appendChild(css);
  }
  function attach(){
    if(bound)return;bound=true;styles();
    document.addEventListener('click',async e=>{
      const target=e.target?.closest?.('[data-extra-toggle],[data-extra-cancel],[data-extra-mode],[data-extra-edit],[data-extra-delete],[data-extra-retry]');
      if(!target||!target.closest('#'+PANEL))return;
      e.preventDefault();
      if(target.hasAttribute('data-extra-retry')){await refresh();return;}
      if(target.hasAttribute('data-extra-toggle')){formOpen=!formOpen;editing=null;mode='catalog';error='';notice='';draw();return;}
      if(target.hasAttribute('data-extra-cancel')){formOpen=false;editing=null;draw();return;}
      if(target.hasAttribute('data-extra-mode')){mode=target.dataset.extraMode;selected='';term='';editing=null;draw();return;}
      if(target.hasAttribute('data-extra-edit')){const row=rows.find(r=>String(r.id)===target.dataset.extraEdit);if(row)editingRow(row);return;}
      if(target.hasAttribute('data-extra-delete')){try{await remove(target.dataset.extraDelete);}catch(err){error=err.message||String(err);draw();}}
    });
    document.addEventListener('input',e=>{
      if(!e.target?.closest?.('#'+PANEL))return;
      if(e.target.matches('[data-extra-search]')){
        term=e.target.value;selected='';
        const sel=panel()?.querySelector('[data-extra-product]');if(sel)sel.innerHTML=productOptions();
        updatePreview();return;
      }
      if(e.target.matches('[data-extra-quantity]'))updatePreview();
    });
    document.addEventListener('change',e=>{
      if(!e.target?.matches?.('#'+PANEL+' [data-extra-product]'))return;
      selected=e.target.value;
      const field=panel()?.querySelector('[data-extra-quantity]');
      if(field&&chosen())field.value=String(initialQty(chosen()));
      updatePreview();
    });
    document.addEventListener('submit',async e=>{
      if(!e.target?.matches?.('#'+PANEL+' [data-food-extra-form]'))return;
      e.preventDefault();try{await persist(e.target);}catch(err){error=err.message||String(err);notice='';draw();}
    });
    const observer=new MutationObserver(mutations=>{if(mutations.some(m=>m.addedNodes.length))mount();});
    observer.observe(document.documentElement,{subtree:true,childList:true});
    mount();
  }
  window.__modFoodExtrasV828={version:'V828',refresh, getStatus:()=>({date,count:rows.length,ready,loading})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach,{once:true});else attach();
})();