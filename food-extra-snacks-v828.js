/* V834 · Zusatz-Snacks / Getränke im FOOD-Heute-Bereich.
   Bestätigte Portionen ohne erneute Gewichtsabfrage; fehlende Makros bleiben unbekannt.
   Referenzwerte aus Produktstamm nutzen; die Erfassung verändert NICHT den Vorrat. */
(function(){
  'use strict';
  if(window.__modFoodExtrasV828)return;
  const ROOT='modFoodV544', PANEL='food-extra-snacks-v828';
  const nf=(value,d=1)=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:d}).format(Number(value)||0);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin'}).format(new Date());
  let date='',rows=[],products=[],loading=false,ready=false,formOpen=false,editing=null,mode='catalog',selected='',term='',busy=false,error='',notice='',bound=false,requestId=null;
  const valid=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n))&&Number(n)>=0;
  const decimal=x=>Number(String(x??'').trim().replace(',','.'));
  const client=()=>window.getSupabaseClient?.();
  const autoCounted=row=>String(row?.source_reference||'').startsWith('food-counted-v873-');
  function productName(p){return p?._inventoryOnly?'Vorrat · '+p.product_name:[p?.brand,p?.product_name,p?.variant].filter(Boolean).join(' · ');}
  function nval(p,key){const v=p?.nutrition_per_100?.[key];return valid(v)?Number(v):null;}
  // Stückprodukte mit dokumentierter essbarer Portionsmenge: kein erneutes Wiegen verlangen.
  // Für Eier die explizite Schätzung verwenden, niemals das Schalengewicht.
  // V870: select exact whole pieces when packaging weight confirms conversion.
  function countedPieceWeight(p){
    const d=p?.product_data||{},n=Number(d.pieces_per_box);
    const net=Number(d.net_weight_g),one=Number(d.grams_per_piece);
    return p?.inventory_unit==='g'&&Number.isInteger(n)&&n>0
      &&Number.isFinite(net)&&net>0&&Number.isFinite(one)&&one>0
      &&Math.abs(n*one-net)<=.051?one:null;
  }
  const catalogPieceWeight=p=>countedPieceWeight(p)||ediblePieceWeight(p);
  function displayPieceQuantity(p,quantity,unit){
    const weight=countedPieceWeight(p),amount=Number(quantity);
    if(weight&&unit==='g'&&Math.abs(amount/weight-Math.round(amount/weight))<.001)
      return Math.round(amount/weight);
    return quantity;
  }
  function extraQuantityDisplay(row){
    const p=products.find(item=>String(item.id)===String(row.product_id));
    if(countedPieceWeight(p)&&row.unit==='g'){
      const count=Number(displayPieceQuantity(p,row.quantity,row.unit));
      if(Number.isInteger(count)&&count>0)return nf(count)+' Stück';
    }
    return nf(row.quantity)+' '+row.unit;
  }
  function ediblePieceWeight(p){
    const d=p?.product_data||{};
    const w=Number(d.edible_weight_per_piece_g??d.edible_weight_per_piece_estimated_g);
    return Number.isFinite(w)&&w>0&&w<=10000?w:null;
  }
  function edibleWeightNote(p){
    const g=ediblePieceWeight(p);
    if(!g)return '';
    const estimated=valid(p?.product_data?.edible_weight_per_piece_estimated_g)&&!valid(p?.product_data?.edible_weight_per_piece_g);
    return (estimated?'ca. ':'')+nf(g)+' g essbarer Anteil je Stück'+(estimated?' (geschätzt)':'');
  }
  function bases(p){
    if(!p)return 'g';
    // Einheiten ohne belastbare 100-g-Nährwertbasis (z. B. Brausetabletten).
    const stockUnit=String(p.inventory_unit||'');
    if(countedPieceWeight(p)||(stockUnit==='Stück'&&ediblePieceWeight(p)))return 'Stück';
    if(!hasMacros(p)&&['Stück','Portion','Päckchen','Kapsel'].includes(stockUnit))return stockUnit;
    const basis=String(p?.nutrition_per_100?.basis||p?.product_data?.nutrition_basis||'').toLowerCase();
    return /100.ml|per_100_ml/.test(basis)||p?.package_unit==='ml'?'ml':'g';
  }
  function hasMacros(p){return Boolean(p)&&valid(nval(p,'energy_kcal'))&&valid(nval(p,'protein_g'));}
  function offered(){
    // Fehlende Nährwertdaten dürfen kein Produkt aus der Suche entfernen.
    return [...products].sort((a,b)=>productName(a).localeCompare(productName(b),'de'));
  }
  function chosen(){return products.find(p=>String(p.id)===selected)||null;}
  function initialQty(p){
    if(!p)return 100;
    const unit=bases(p), serving=Number(p.serving_quantity),pack=Number(p.package_quantity);
    if(!['g','ml'].includes(unit))return 1;
    if(p.serving_unit===unit&&serving>0&&serving<=1500)return serving;
    if(p.package_unit===unit&&pack>0&&pack<=1000)return pack;
    return 100;
  }
  function valuesFromCatalog(p,quantity){
    const factor=(bases(p)==='Stück'&&catalogPieceWeight(p)?quantity*catalogPieceWeight(p):quantity)/100,n=p.nutrition_per_100||{};
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
    // Alle Suchwörter dürfen unabhängig von Punkten und Wortreihenfolge vorkommen.
    const words=term.toLocaleLowerCase('de-DE').trim().split(/\s+/).filter(Boolean);
    const options=offered().filter(p=>{
      if(!words.length)return true;
      const name=productName(p).toLocaleLowerCase('de-DE');
      return words.every(word=>name.includes(word));
    });
    if(!options.length)return '<option value="">Keine passenden Produkte</option>';
    const visible=options.slice(0,500);
    return '<option value="">Produkt wählen … ('+options.length+' Treffer)</option>'+visible.map(p=>
      '<option value="'+esc(p.id)+'"'+(selected===String(p.id)?' selected':'')+'>'+esc(productName(p))+'</option>').join('')+
      (options.length>visible.length?'<option value="" disabled>Weitere '+(options.length-visible.length)+' Treffer: Suche präzisieren</option>':'');
  }
  function formHtml(){
    if(!formOpen)return '';
    const p=chosen(),catalog=mode==='catalog';
    return '<form class="food-extra-form-v828" data-food-extra-form>'+
      '<div class="food-extra-mode-v828"><button type="button" data-extra-mode="catalog" class="'+(catalog?'is-selected':'')+'">Aus Produktstamm</button>'+
      '<button type="button" data-extra-mode="manual" class="'+(!catalog?'is-selected':'')+'">Manuell erfassen</button></div>'+
      (catalog?'<label>Produkt suchen<input type="search" name="search" value="'+esc(term)+'" placeholder="z. B. Red Bull, HOLY, Schokolade" data-extra-search autocomplete="off"></label>'+
        '<label>Produkt<select name="product" data-extra-product>'+productOptions()+'</select></label>'+
        '<div class="food-extra-fields-v828"><label><span data-extra-quantity-caption>'+(p&&countedPieceWeight(p)?'Anzahl Pralinen':'Menge')+'</span><input name="quantity" type="number" step="'+(p&&countedPieceWeight(p)?'1':'0.1')+'" min="'+(p&&countedPieceWeight(p)?'1':'0.1')+'" inputmode="'+(p&&countedPieceWeight(p)?'numeric':'decimal')+'" value="'+esc(p?initialQty(p):100)+'" required data-extra-quantity></label>'+
        '<label>Einheit <output data-extra-unit>'+esc(bases(p))+'</output>'+ 
          '<small data-extra-piece-note hidden></small>'+ 
         '</label></div>'+
        '<p class="food-extra-preview-v828" data-extra-preview>'+esc(p?'Nährwerte werden berechnet.':'Bitte ein Produkt auswählen.')+'</p>'+
        '<div class="food-extra-missing-v832" data-extra-missing-macros hidden><p class="food-extra-help-v828">Für diesen Artikel sind Kalorien/Eiweiß nicht vollständig belegt. Angaben sind freiwillig. Ohne verlässliche Werte wird die Einnahme trotzdem gespeichert; die Tagesbilanz markiert die Lücke. Unbekannt ist nicht gleich null.</p>'+
        '<div class="food-extra-macros-v828">'+[
          ['calories_kcal','Kalorien (kcal)'],['protein_g','Protein (g)'],
          ['carbohydrates_g','Kohlenhydrate (g)'],['fat_g','Fett (g)'],
          ['sugars_g','Zucker (g)'],['salt_g','Salz (g)'],['caffeine_mg','Koffein (mg)']
        ].map(([key,label])=>'<label>'+label+'<input name="'+key+'" type="number" min="0" step="0.01" inputmode="decimal"></label>').join('')+'</div></div>'
      :'<label>Bezeichnung<input name="title" maxlength="160" placeholder="z. B. 2 Stück Schokolade" required></label>'+
        '<div class="food-extra-fields-v828"><label>Menge<input name="quantity" type="number" step="0.1" min="0.1" value="1" inputmode="decimal" required></label>'+
        '<label>Einheit<select name="unit"><option>Portion</option><option>Stück</option><option>g</option><option>ml</option></select></label></div>'+
        '<p class="food-extra-help-v828">Nährwerte für genau die eingetragene Menge (nicht je 100 g). Unbekannte Werte leer lassen:</p>'+
        '<div class="food-extra-macros-v828">'+[
          ['calories_kcal','Kalorien (kcal)',false],['protein_g','Protein (g)',false],
          ['carbohydrates_g','Kohlenhydrate (g)',false],['fat_g','Fett (g)',false],
          ['sugars_g','Zucker (g)',false],['salt_g','Salz (g)',false],['caffeine_mg','Koffein (mg)',false]
        ].map(([key,label,required])=>'<label>'+label+'<input name="'+key+'" type="number" min="0" step="0.01" inputmode="decimal" '+(required?'required':'')+'></label>').join('')+'</div>')+
      '<div class="food-extra-actions-v828"><button type="submit" data-extra-save>✓ '+(editing?'Änderung speichern':'Zusatz eintragen')+'</button>'+
      '<button type="button" data-extra-cancel>Abbrechen</button></div>'+
      '<small>Pralinen mit bestätigtem Stückgewicht: Snack und Vorrat werden gemeinsam gebucht. Bei anderen Extras erfolgt keine automatische Vorratsbuchung.</small>'+
    '</form>';
  }
  function rowsHtml(){
    const sum=rows.reduce((a,r)=>({kcal:a.kcal+Number(r.calories_kcal||0),protein:a.protein+Number(r.protein_g||0),carbs:a.carbs+Number(r.carbohydrates_g||0),fat:a.fat+Number(r.fat_g||0)}),{kcal:0,protein:0,carbs:0,fat:0});
    const incomplete=rows.filter(r=>!valid(r.calories_kcal)||!valid(r.protein_g)).length;
    return '<div class="food-extra-total-v828"><b>'+rows.length+' Zusatz'+(rows.length===1?'':'-Snacks')+'</b>'+
      '<span>'+nf(sum.kcal,0)+' kcal · '+nf(sum.protein)+' g Protein'+(incomplete?' (bekannte Werte)':'')+'</span></div>'+
      (incomplete?'<p class="food-extra-help-v828">'+incomplete+' Eintrag'+(incomplete===1?' hat':'e haben')+' unbekannte Kalorien- oder Eiweißwerte. Tagesbilanz deshalb unvollständig, keine Nullwerte erfunden.</p>':'')+
      (rows.length?'<ul class="food-extra-list-v828">'+rows.map(r=>
        '<li data-food-extra-row="'+esc(r.id)+'"'+(!valid(r.calories_kcal)||!valid(r.protein_g)?' class="food-extra-unresolved-v838"':'')+'><div><strong>'+esc(r.title)+'</strong><small>'+esc(extraQuantityDisplay(r))+' · '+
        (valid(r.calories_kcal)?nf(r.calories_kcal,0)+' kcal':'kcal unbekannt')+' · '+
        (valid(r.protein_g)?nf(r.protein_g)+' g Protein':'Protein unbekannt')+
        (r.carbohydrates_g!==null?' · KH '+nf(r.carbohydrates_g)+' g':'')+
        (r.fat_g!==null?' · Fett '+nf(r.fat_g)+' g':'')+'</small></div>'+
        '<div class="food-extra-row-actions-v828">'+(String(r.source_reference||'').startsWith('food-planned-extra-v1-')?'':'<button type="button" data-extra-edit="'+esc(r.id)+'" aria-label="'+esc(r.title)+' bearbeiten" title="Bearbeiten">✎</button>')+
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
    const counted=countedPieceWeight(p);
    const caption=form.querySelector('[data-extra-quantity-caption]');
    if(caption)caption.textContent=counted?'Anzahl Pralinen':'Menge';
    const amount=form.elements.quantity;
    if(amount){
      amount.step=counted?'1':'0.1';
      amount.min=counted?'1':'0.1';
      amount.inputMode=counted?'numeric':'decimal';
    }
    const hint=form.querySelector('[data-extra-piece-note]');
    if(hint){
      const note=counted?'1 Praline = '+nf(counted)+' g'
        :bases(p)==='Stück'&&ediblePieceWeight(p)?edibleWeightNote(p)
        :bases(p)==='Stück'&&Number(p?.product_data?.weight_per_tablet_g)>0
          ?nf(p.product_data.weight_per_tablet_g)+' g je Tablette (hinterlegt)':'';
      hint.textContent=note;
      hint.hidden=!note;
    }
    const missing=form.querySelector('[data-extra-missing-macros]');
    if(missing)missing.hidden=!p||hasMacros(p);
    if(!p){output.textContent='Bitte ein Produkt aus dem gesamten Vorrat oder Produktstamm auswählen.';return;}
    const qty=decimal(form.elements.quantity.value);
    if(!(qty>0)){output.textContent='Bitte eine gültige Menge eingeben.';return;}
    if(countedPieceWeight(p)&&!Number.isInteger(qty)){output.textContent='Bitte ganze Pralinen eingeben.';return;}
    if(!hasMacros(p)){
      output.textContent='Menge: '+nf(qty)+' '+bases(p)+(countedPieceWeight(p)?' = '+nf(qty*countedPieceWeight(p))+' g':'')+(bases(p)==='Stück'&&Number(p.product_data?.weight_per_tablet_g)>0?' à '+nf(p.product_data.weight_per_tablet_g)+' g':'')+'. Nicht belegte Nährwerte bleiben offen; Speichern ist trotzdem möglich.';
      return;
    }
    const n=valuesFromCatalog(p,qty);
    output.textContent=nf(n.calories_kcal,1)+' kcal · '+nf(n.protein_g)+' g Protein · '+nf(n.carbohydrates_g)+' g KH · '+nf(n.fat_g)+' g Fett'+
      (countedPieceWeight(p)?' · '+nf(qty)+' '+(qty===1?'Praline':'Pralinen')+' = '+nf(qty*countedPieceWeight(p))+' g':
       bases(p)==='Stück'&&ediblePieceWeight(p)?' · '+edibleWeightNote(p):'');
  }
  async function fetchPages(build){
    const result=[],page=500;
    for(let start=0;start<50000;start+=page){
      const {data,error}=await build(start,start+page-1);
      if(error)throw error;
      const part=data||[];result.push(...part);
      if(part.length<page)return result;
    }
    throw new Error('Produktmenge überschreitet die technische Sicherheitsgrenze.');
  }
  async function fetchAll(){
    const supabase=client();if(!supabase)throw new Error('Supabase-Verbindung fehlt.');
    const auth=await supabase.auth.getSession();
    if(auth.error||!auth.data?.session?.user?.id)throw new Error('Bitte zuerst anmelden.');
    const uid=auth.data.session.user.id;
    const [a,catalog,stock]=await Promise.all([
      supabase.from('food_extra_consumptions').select('id,consumption_date,product_id,title,kind,quantity,unit,calories_kcal,protein_g,carbohydrates_g,fat_g,sugars_g,salt_g,caffeine_mg,nutrition_source,source_reference').eq('user_id',uid).eq('consumption_date',date).order('created_at',{ascending:true}).limit(500),
      fetchPages((start,end)=>supabase.from('shopping_products').select('id,inventory_id,brand,product_name,variant,package_quantity,package_unit,serving_quantity,serving_unit,nutrition_per_100,product_data').eq('active',true).order('id',{ascending:true}).range(start,end)),
      fetchPages((start,end)=>supabase.from('food_inventory').select('id,name,quantity,unit').eq('user_id',uid).eq('is_active',true).order('id',{ascending:true}).range(start,end))
    ]);
    if(a.error)throw a.error;
    rows=a.data||[];
    const stockById=new Map(stock.map(i=>[i.id,i]));
    const primary=catalog.map(p=>({...p,_inventoryOnly:false,inventory_unit:stockById.get(p.inventory_id)?.unit||null}));
    const linked=new Set(primary.map(p=>p.inventory_id).filter(Boolean));
    const missing=stock.filter(i=>!linked.has(i.id)).map(i=>({
      id:'inventory:'+i.id,inventory_id:i.id,inventory_unit:i.unit,
      product_name:i.name,brand:null,variant:null,package_unit:i.unit,
      serving_quantity:null,package_quantity:null,nutrition_per_100:{},product_data:{},_inventoryOnly:true
    }));
    products=[...primary,...missing];
    return uid;
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
    const d=today();
    // V831: Kalenderdatum immer in Europe/Berlin bestimmen, keine
    // Sonderbehandlung für den heutigen Tag 16.10.2026.
    if(panel()){
      if(date!==d){
        date=d;ready=false;rows=[];formOpen=false;editing=null;notice='';
        if(!loading)refresh();
      }
      return;
    }
    const contents=summary.closest('.food-content-v544')||root;
    const lastMealSection=contents.querySelector('.food-meal-list-v544, .food-empty-card-v544');
    if(!lastMealSection)return;
    const el=document.createElement('section');el.id=PANEL;el.className='food-extra-panel-v828';
    el.setAttribute('aria-label','Zusatz-Snacks und Getränke');
    // V831: Tagesbilanz → Auftauhinweise → alle Mahlzeiten → Extras.
    lastMealSection.insertAdjacentElement('afterend',el);
    if(date!==d){date=d;ready=false;rows=[];formOpen=false;editing=null;requestId=null;notice='';}
    draw();
    if(!ready&&!loading)refresh();
  }
  function editingRow(row){
    if(String(row.source_reference||'').startsWith('food-planned-extra-v1-')){
      formOpen=false;notice='Bitte die Bestätigung beim geplanten Genuss-Extra rückgängig machen, bevor du es änderst.';draw();return;
    }
    editing=row.id;requestId=null;
    // Produkt-ID beim Korrigieren von Makros erhalten: die alte manuelle
    // Bearbeitung hat den Produktstamm sonst mit product_id:null geloescht.
    const linked=products.find(product=>String(product.id)===String(row.product_id));
    mode=linked?'catalog':'manual';
    selected=linked?String(linked.id):'';
    term='';
    formOpen=true;notice='';error='';draw();
    const form=panel()?.querySelector('[data-food-extra-form]');if(!form)return;
    for(const name of ['title','quantity','unit','calories_kcal','protein_g','carbohydrates_g','fat_g','sugars_g','salt_g','caffeine_mg']){
      if(form.elements[name]&&row[name]!==null&&row[name]!==undefined)form.elements[name].value=String(name==='quantity'&&linked?displayPieceQuantity(linked,row.quantity,row.unit):row[name]);
    }
    if(linked)updatePreview();
    form.querySelector('[name="calories_kcal"],[name="title"],[name="quantity"]')?.focus();
  }
  async function openEntry(id){
    mount();
    if(!ready&&!loading)await refresh();
    const target=rows.find(row=>String(row.id)===String(id));
    if(!target){
      panel()?.scrollIntoView?.({behavior:'smooth',block:'center'});
      return false;
    }
    editingRow(target);
    requestAnimationFrame(()=>{
      const el=panel()?.querySelector('[data-food-extra-form]')||panel();
      el?.scrollIntoView?.({behavior:'smooth',block:'center'});
      el?.querySelector('[name="calories_kcal"],[name="quantity"]')?.focus?.({preventScroll:true});
    });
    return true;
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
      let n,source;
      if(countedPieceWeight(p)&&!Number.isInteger(qty))throw new Error('Bitte eine ganze Anzahl Pralinen eingeben.');
      if(hasMacros(p)&&(['g','ml'].includes(bases(p))||(bases(p)==='Stück'&&catalogPieceWeight(p)))){
        n=valuesFromCatalog(p,qty);
        const ref=Boolean(p.product_data?.nutrition_is_reference||p.product_data?.source_nutrition_not_from_package);
        source=(ref?'Produktstamm: dokumentierte Referenzwerte je 100 ':'Produktstamm: Herstellerwerte je 100 ')+
          (bases(p)==='Stück'?'g, '+(countedPieceWeight(p)?nf(countedPieceWeight(p))+' g je Praline':edibleWeightNote(p)):bases(p));
      }else{
        const read=(key,required=false)=>{
          const raw=String(form.elements[key]?.value??'').trim();
          if(!raw){if(required)throw new Error('Bitte Kalorien und Protein für diesen Artikel eintragen.');return null;}
          const value=decimal(raw);
          if(!Number.isFinite(value)||value<0)throw new Error('Ungültiger Nährwert: '+key);
          return value;
        };
        n={calories_kcal:read('calories_kcal'),protein_g:read('protein_g'),
          carbohydrates_g:read('carbohydrates_g'),fat_g:read('fat_g'),
          sugars_g:read('sugars_g'),salt_g:read('salt_g'),caffeine_mg:read('caffeine_mg')};
        source=valid(n.calories_kcal)&&valid(n.protein_g)?'Produktstamm: Kalorien und Eiweiß manuell ergänzt':'Produktstamm: Gewicht/Menge gesichert, Makronährwerte teilweise unbekannt';
      }
      entry={product_id:p._inventoryOnly?null:p.id,title:productName(p),
        kind:bases(p)==='ml'?'drink':'snack',quantity:qty,unit:bases(p),...n,nutrition_source:source};
    }else{
      const title=String(form.elements.title.value||'').trim();if(!title)throw new Error('Bitte eine Bezeichnung angeben.');
      const read=(key,required=false)=>{
        const raw=String(form.elements[key]?.value||'').trim();
        if(!raw&&!required)return null;
        const n=decimal(raw);if(!Number.isFinite(n)||n<0)throw new Error('Ungültiger Wert: '+key);
        return n;
      };
      entry={product_id:null,title,kind:form.elements.unit.value==='ml'?'drink':'snack',quantity:qty,unit:form.elements.unit.value,
        calories_kcal:read('calories_kcal'),protein_g:read('protein_g'),
        carbohydrates_g:read('carbohydrates_g'),fat_g:read('fat_g'),
        sugars_g:read('sugars_g'),salt_g:read('salt_g'),caffeine_mg:read('caffeine_mg'),
        nutrition_source:'Manuell vom Nutzer eingegeben'};
    }
    busy=true;const submit=form.querySelector('[data-extra-save]');if(submit)submit.disabled=true;
    try{
      let res;
      const oldRow=editing?rows.find(x=>String(x.id)===String(editing)):null;
      const product=mode==='catalog'?chosen():null;
      const pieceWeight=countedPieceWeight(product);
      const updateBooked=autoCounted(oldRow);
      const newBooked=!editing&&Boolean(pieceWeight);
      if(updateBooked||newBooked){
        if(!product||!pieceWeight||(oldRow&&String(oldRow.product_id)!==String(product.id)))
          throw new Error('Zum Bearbeiten das ursprüngliche Pralinenprodukt verwenden.');
        if(!Number.isInteger(qty)||qty<1)throw new Error('Bitte ganze Pralinen eingeben.');
        if(newBooked&&!requestId)requestId=crypto.randomUUID();
        res=await supabase.rpc('save_counted_food_extra_v873',{
          p_action:'save',p_product_id:product.id,p_pieces:qty,p_day:date,
          p_extra_id:editing||null,p_request_id:newBooked?requestId:null
        });
        if(res.error)throw res.error;
        notice='✓ '+qty+' '+(qty===1?'Praline':'Pralinen')
          +' erfasst und gemeinsam mit dem Vorrat verbucht.';
      }else if(editing){
        if(product&&pieceWeight&&oldRow&&!updateBooked){
          // Existing 18 October gram intake was manually booked already.
          entry.quantity=Number((qty*pieceWeight).toFixed(5));
          entry.unit='g';
        }
        res=await supabase.from('food_extra_consumptions').update(entry).eq('id',editing).eq('user_id',uid).select('id').single();
      }else{
        const p=mode==='catalog'?chosen():null;
        const ref='food-ui-v832-'+(p?._inventoryOnly?'inventory-'+p.inventory_id+'-':'')+crypto.randomUUID();
        res=await supabase.from('food_extra_consumptions').insert({...entry,user_id:uid,consumption_date:date,source_reference:ref}).select('id').single();
      }
      if(res.error)throw res.error;
      formOpen=false;editing=null;requestId=null;
      if(!updateBooked&&!newBooked)notice='✓ Gespeichert und in die Tagesbilanz übernommen.';
      error='';await refresh();
      window.__modFoodNutritionV711?.refresh?.();
      if(updateBooked||newBooked)await window.__modFoodV544?.reload?.();
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
      const planRef=String(row.source_reference||'');
      if(planRef.startsWith('food-planned-extra-v1-')){
        const undo=await supabase.rpc('undo_food_planned_extra_v1',{p_plan_id:planRef.slice('food-planned-extra-v1-'.length)});
        if(undo.error)throw undo.error;
        notice='✓ Bestätigtes Extra und Vorratsverbrauch zurückgebucht.';
        error='';await refresh();
        window.__modFoodTreatsV880?.refresh?.();
        window.__modFoodNutritionV711?.refresh?.();
        await window.__modFoodV544?.reload?.();
        return;
      }
      const booked=autoCounted(row);
      const res=booked
        ?await supabase.rpc('save_counted_food_extra_v873',{p_action:'delete',p_extra_id:id})
        :await supabase.from('food_extra_consumptions').delete().eq('id',id).eq('user_id',uid).select('id').single();
      if(res.error)throw res.error;
      notice=booked?'✓ Snack und Vorratsverbrauch gemeinsam zurückgenommen.':'✓ Zusatz entfernt.';
      error='';await refresh();
      window.__modFoodNutritionV711?.refresh?.();
      if(booked)await window.__modFoodV544?.reload?.();
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
      '.food-extra-list-v828 .food-extra-unresolved-v838{border-left:3px solid #be5f4e;padding-left:7px;background:#fff6f2;border-radius:5px}'+
      '.food-extra-list-v828 li>div:first-child{min-width:0}.food-extra-list-v828 strong{display:block;font-size:11px;overflow-wrap:anywhere}.food-extra-list-v828 small{display:block;font-size:10px;line-height:1.4;color:#627b68}'+
      '.food-extra-row-actions-v828{display:flex;gap:5px}.food-extra-row-actions-v828 button{padding:4px 7px;font-size:13px}'+
      '.food-extra-form-v828{margin-top:11px;padding-top:10px;border-top:1px solid #d6e3d5;display:grid;gap:9px}.food-extra-form-v828 label{display:grid;gap:4px;font-size:11px;font-weight:700}'+
      '.food-extra-form-v828 input,.food-extra-form-v828 select{box-sizing:border-box;width:100%;min-width:0;border:1px solid #c5d5c6;border-radius:8px;padding:9px 8px;font:inherit;color:#283f31;background:#fff}'+
      '.food-extra-mode-v828{justify-content:flex-start}.food-extra-mode-v828 button{font-size:11px}.food-extra-mode-v828 button.is-selected{background:#365f43;color:#fff;border-color:#365f43}'+
      '.food-extra-fields-v828{display:grid;grid-template-columns:1fr 1fr;gap:10px}.food-extra-fields-v828 output{padding:10px 0}'+
      '.food-extra-macros-v828{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.food-extra-preview-v828{font-size:11px;color:#2c7451;font-weight:800}'+
      '.food-extra-help-v828,.food-extra-form-v828 small{font-size:10px;margin:0;line-height:1.4;color:#667767}'+
      '.food-extra-missing-v832[hidden]{display:none!important}.food-extra-missing-v832{display:grid;gap:8px;padding:9px;border:1px solid #c5d5c6;border-radius:8px;background:#fff8ee}'+
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
      if(target.hasAttribute('data-extra-toggle')){formOpen=!formOpen;editing=null;requestId=null;mode='catalog';error='';notice='';draw();return;}
      if(target.hasAttribute('data-extra-cancel')){formOpen=false;editing=null;requestId=null;draw();return;}
      if(target.hasAttribute('data-extra-mode')){mode=target.dataset.extraMode;selected='';term='';editing=null;requestId=null;draw();return;}
      if(target.hasAttribute('data-extra-edit')){const row=rows.find(r=>String(r.id)===target.dataset.extraEdit);if(row)editingRow(row);return;}
      if(target.hasAttribute('data-extra-delete')){try{await remove(target.dataset.extraDelete);}catch(err){error=err.message||String(err);draw();}}
    });
    document.addEventListener('input',e=>{
      if(!e.target?.closest?.('#'+PANEL))return;
      if(e.target.matches('[data-extra-search]')){
        term=e.target.value;selected='';requestId=null;
        const sel=panel()?.querySelector('[data-extra-product]');if(sel)sel.innerHTML=productOptions();
        updatePreview();return;
      }
      if(e.target.matches('[data-extra-quantity]'))updatePreview();
    });
    document.addEventListener('change',e=>{
      if(!e.target?.matches?.('#'+PANEL+' [data-extra-product]'))return;
      selected=e.target.value;requestId=null;
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
  window.__modFoodExtrasV828={version:'V838',refresh,openEntry,getStatus:()=>({date,count:rows.length,ready,loading})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach,{once:true});else attach();
})();