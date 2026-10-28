/* V880 · Geplante Genuss-Extras: ausdrücklich getrennt vom bestätigten Verzehr.
   ✓ bucht Snack und Vorrat atomar; ✕ entfernt ausschließlich die Planung.
   Tagesbilanz zählt nur bestätigte food_extra_consumptions. */
(function(){
  'use strict';
  if(window.__modFoodTreatsV880)return;
  const ID='food-planned-extras-v880',ROOT='modFoodV544',WORK_COFFEE_KEY='work-coffee-employer-v1',WORK_COFFEE_ID='food-work-coffee-v889';
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const nf=x=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:1}).format(Number(x)||0);
  const berlinDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  let day='',rows=[],ready=false,busy=false,error='',note='',mounting=false,uid='',editingId='',loading=false;
  const client=()=>window.getSupabaseClient?.();
  function box(){return document.getElementById(ID);}
  function styles(){
    if(document.getElementById('food-planned-extras-style-v880'))return;
    const s=document.createElement('style');s.id='food-planned-extras-style-v880';
    s.textContent='.food-treat-panel-v880{padding:12px;margin:8px 0 14px;border:1px solid #bfc7df;border-radius:12px;background:#f3f2fb;color:#343451;font-size:12px}' +
     '.food-treat-panel-v880 h3{margin:0;font-size:13px}.food-treat-panel-v880 p{margin:6px 0;font-size:11px;line-height:1.5}' +
     '.food-treat-panel-v880 ul{margin:10px 0 0;padding:0;list-style:none}.food-treat-panel-v880 li{border-top:1px solid #d7d6e6;padding:9px 0;display:flex;justify-content:space-between;align-items:center;gap:10px}' +
     '.food-treat-panel-v880 .food-treat-info-v880{min-width:0}.food-treat-panel-v880 strong,.food-treat-panel-v880 small{display:block;overflow-wrap:anywhere}' +
     '.food-treat-panel-v880 small{color:#62627e;font-size:10px;margin-top:3px}' +
     '.food-treat-panel-v880 .food-treat-buttons-v880{display:flex;gap:5px;flex-shrink:0;align-items:center}' +
     '.food-treat-panel-v880 button{border:1px solid #b0b2c7;background:#fff;border-radius:8px;padding:7px 9px;font-size:12px;cursor:pointer;color:#353558}' +
     '.food-treat-panel-v880 button[data-treat-confirm]{background:#d8f2de;color:#166036;border-color:#a9d0b3;font-weight:800}' +
     '.food-treat-panel-v880 button:disabled{opacity:.45;cursor:wait}.food-treat-panel-v880 .food-treat-error-v880{color:#a52626;font-weight:700}' +
     '.food-treat-panel-v880 .food-treat-success-v880{color:#226a47;font-weight:700}'+
     '.food-treat-panel-v880 .food-treat-edit-v880{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:7px 0 0}'+
     '.food-treat-panel-v880 .food-treat-edit-v880 input{max-width:78px;min-width:52px;border:1px solid #b0b2c7;border-radius:7px;padding:6px;background:white;color:#353558;font:inherit}';
    s.textContent+='.'+WORK_COFFEE_ID+'{margin:8px 0 14px;padding:12px 14px;border:1px solid #cfbfa4;border-radius:12px;background:#fcf5e9;color:#393027;font-size:12px;line-height:1.5}'+
      '.'+WORK_COFFEE_ID+' strong{display:block;font-size:14px;margin-bottom:2px}'+
      '.'+WORK_COFFEE_ID+' small{display:block;color:#665c4f;margin:4px 0}'+
      '.'+WORK_COFFEE_ID+' button{margin-top:7px;padding:7px 12px;background:#f5e4c7;color:#493321;border:1px solid #bca17d;border-radius:8px;font:inherit;font-weight:700;cursor:pointer}'+
      '.'+WORK_COFFEE_ID+' button:disabled{opacity:.55;cursor:wait}';
    document.head.append(s);
  }

  // V889: Arbeitgeber-Kaffee wird NIEMALS als private Zutat verbucht.
  // Montag-Donnerstag ist nur ein Kandidat: Urlaub, Krankheit und freie Tage
  // erfordern eine ausdrueckliche Bestaetigung des tatsaechlichen Konsums.
  function isPossibleWorkday(date){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))return false;
    const [year,month,dayOfMonth]=date.split('-').map(Number);
    const weekday=new Date(Date.UTC(year,month-1,dayOfMonth)).getUTCDay();
    return weekday>=1&&weekday<=4;
  }
  function workCoffeeRow(){return rows.find(row=>row.source_key===WORK_COFFEE_KEY)||null;}
  function workCoffeeBox(){return document.getElementById(WORK_COFFEE_ID);}
  function ensureWorkCoffeePanel(){
    const root=document.getElementById(ROOT);
    if(!root||root.getAttribute('aria-hidden')==='true')return;
    if(!isPossibleWorkday(berlinDay())){workCoffeeBox()?.remove();return;}
    if(workCoffeeBox())return;
    const summary=root.querySelector('[data-food-day-summary-today]');
    const contents=summary?.closest('.food-content-v544')||root;
    const list=contents.querySelector('.food-meal-list-v544');
    if(!summary)return;
    const panel=document.createElement('section');
    panel.id=WORK_COFFEE_ID;
    panel.className=WORK_COFFEE_ID;
    panel.setAttribute('aria-label','Arbeitskaffee zum Fruehstueck');
    const first=list.querySelector('[data-food-meal-card]');
    const label=first?.querySelector('.food-recipe-type-v544')?.textContent||'';
    if(first&&/Frühstück/i.test(label))first.insertAdjacentElement('afterend',panel);
    else if(list)list.insertAdjacentElement('beforebegin',panel);
    else summary.insertAdjacentElement('afterend',panel);
    renderWorkCoffee();
  }
  function renderWorkCoffee(){
    const panel=workCoffeeBox();
    if(!panel)return;
    if(!isPossibleWorkday(berlinDay())){panel.remove();return;}
    const row=workCoffeeRow();
    const confirmed=row?.status==='confirmed';
    const caption=confirmed?'✓ Als getrunken erfasst · 7,05 kcal in der Tagesbilanz':
      'Nur bei tatsächlichem Arbeitstag bestätigen. Ohne Bestätigung keine Kalorien- oder Verbrauchsbuchung.';
    panel.innerHTML='<strong>☕ Arbeitskaffee zum Frühstück</strong>'+
      '<span>200 ml Kaffee · ca. 15 ml Milch · ohne Zucker</span>'+
      '<small>Vom Arbeitgeber gestellt · kein privater Vorrat · kein Einkaufsbedarf · '+esc(caption)+'</small>'+
      (error?'<small role="alert">'+esc(error)+'</small>':'')+
      (!ready?'<small>Status wird geprüft …</small>':
       '<button type="button" data-work-coffee-action="'+(confirmed?'undo':'confirm')+'"'+
       (busy?' disabled':'')+'>'+(confirmed?'↶ Buchung rückgängig':'✓ Heute auf der Arbeit getrunken')+'</button>');
  }
  async function workCoffeeAction(action){
    if(busy||loading||!ready||!isPossibleWorkday(berlinDay()))return;
    const requestedDay=berlinDay(),api=client();
    if(!api||!uid){error='Bitte zuerst anmelden.';render();return;}
    busy=true;error='';note='';render();
    try{
      let row=workCoffeeRow();
      if(action==='undo'){
        if(!row||row.status!=='confirmed')throw new Error('Kein bestätigter Arbeitskaffee vorhanden.');
        const undo=await withTimeout(api.rpc('undo_food_planned_extra_v1',{p_plan_id:row.id}),'Arbeitskaffee rückgängig');
        if(undo.error)throw undo.error;
      }else{
        if(row?.status==='confirmed')return;
        if(row?.status==='skipped'){
          const restored=await withTimeout(api.from('food_planned_extras')
            .update({status:'planned',updated_at:new Date().toISOString()})
            .eq('id',row.id).eq('user_id',uid).eq('status','skipped'),'Arbeitskaffee wieder öffnen');
          if(restored.error)throw restored.error;
        }
        if(!row){
          // Null-Verknuepfungen sind Absicht: Arbeitgeber stellt Kaffee UND Milch.
          const inserted=await withTimeout(api.from('food_planned_extras').upsert({
            user_id:uid,plan_date:requestedDay,source_key:WORK_COFFEE_KEY,
            inventory_id:null,product_id:null,title:'Arbeitskaffee (vom Arbeitgeber)',
            kind:'drink',quantity:200,unit:'ml',
            calories_kcal:7.05,protein_g:0.51,carbohydrates_g:0.735,fat_g:0.225,
            caffeine_mg:null,status:'planned',
            note:'200 ml Kaffee ohne Zucker und ca. 15 ml Milch vom Arbeitgeber. Nährwerte aus 15 ml Milch (47 kcal/100 ml); Kaffee selbst näherungsweise vernachlässigt. Keine private Vorrats- oder Einkaufsbuchung.'
          },{onConflict:'user_id,plan_date,source_key',ignoreDuplicates:true}),'Arbeitskaffee einplanen');
          if(inserted.error)throw inserted.error;
        }
        const found=await withTimeout(api.from('food_planned_extras')
          .select('id,status').eq('user_id',uid).eq('plan_date',requestedDay)
          .eq('source_key',WORK_COFFEE_KEY).single(),'Arbeitskaffee prüfen');
        if(found.error)throw found.error;
        row=found.data;
        if(row?.status!=='confirmed'){
          const result=await withTimeout(api.rpc('confirm_food_planned_extra_v1',{p_plan_id:row.id}),'Arbeitskaffee buchen');
          if(result.error)throw result.error;
        }
      }
      note=action==='undo'?'Arbeitskaffee rückgängig gemacht.':'Arbeitskaffee erfasst, ohne privaten Vorratsverbrauch.';
      busy=false;await refresh();
      await window.__modFoodExtrasV828?.refresh?.();
      window.__modFoodNutritionV711?.refresh?.();
      await window.__modFoodV544?.reload?.();
    }catch(e){error=e?.message||String(e);}
    finally{busy=false;render();}
  }

  function render(){
    const el=box();if(!el)return;
    renderWorkCoffee();
    const visibleRows=rows.filter(r=>r.source_key!==WORK_COFFEE_KEY);
    const pending=visibleRows.filter(r=>r.status==='planned'),confirmed=visibleRows.filter(r=>r.status==='confirmed');
    const kcal=pending.reduce((sum,r)=>sum+(Number(r.calories_kcal)||0),0);
    el.innerHTML='<h3>🍬 Geplante Genuss-Extras</h3>'+
      '<p>Flexibler Richtwert: 100 kcal/Tag innerhalb von 1.800 kcal. Nur mit ✓ bestätigte Extras zählen in Tagesbilanz und Vorrat. Vorschläge sind freiwillig.</p>'+
      (error?'<p role="alert" class="food-treat-error-v880">'+esc(error)+'</p>':'')+
      (note?'<p role="status" class="food-treat-success-v880">'+esc(note)+'</p>':'')+
      (!ready?'<p>Geplante Extras werden geladen …</p>':
      '<p>Offene Vorschläge: '+pending.length+' · '+nf(kcal)+' kcal · Bestätigt: '+confirmed.length+'</p>'+
      (visibleRows.length?'<ul>'+visibleRows.map(r=>{
        const isMilka=r.title.startsWith('Milka Danke');
        const note2=isMilka?'':r.note?' · '+r.note:'';
        const unitDisplay=isMilka?nf(Number(r.quantity)/5.7)+' Stück ('+nf(r.quantity)+' g)':nf(r.quantity)+' '+r.unit;
        const editable=r.status==='planned'||r.status==='confirmed';
        const showEdit=editingId===r.id&&editable;
        const shownQuantity=isMilka?Number(r.quantity)/5.7:Number(r.quantity);
        const integerUnit=isMilka||r.unit==='Portion';
        const editForm=showEdit?'<form class="food-treat-edit-v880" data-treat-edit-form="'+esc(r.id)+'">'+
          '<label><span>Menge ('+esc(isMilka?'Stück':r.unit)+') </span>'+
          '<input type="number" name="quantity" value="'+esc(shownQuantity)+'" min="'+(integerUnit?'1':'0.1')+'" step="'+(integerUnit?'1':'0.1')+'" required inputmode="'+(integerUnit?'numeric':'decimal')+'"></label>'+
          '<button type="submit"'+(busy?' disabled':'')+'>✓ Speichern</button>'+
          '<button type="button" data-treat-cancel="'+esc(r.id)+'">Abbrechen</button></form>':'';
        return '<li><div class="food-treat-info-v880"><strong>'+esc(r.title)+'</strong><small>'+esc(unitDisplay)+' · '+
          (r.calories_kcal===null?'Kalorien unbekannt':nf(r.calories_kcal)+' kcal')+
          (r.caffeine_mg&&Number(r.caffeine_mg)>0?' · '+nf(r.caffeine_mg)+' mg Koffein':'')+
          esc(note2)+'</small>'+editForm+'</div><div class="food-treat-buttons-v880">'+
          (editable?'<button type="button" data-treat-edit="'+esc(r.id)+'" title="Menge bearbeiten" aria-label="'+esc(r.title)+' Menge ändern"'+(busy?' disabled':'')+'>✎</button>':'')+
          (r.status==='planned'?'<button type="button" data-treat-confirm="'+esc(r.id)+'" aria-label="'+esc(r.title)+' tatsächlich verwendet" title="Verbraucht bestätigen"'+(busy?' disabled':'')+'>✓</button>'+
          '<button type="button" data-treat-skip="'+esc(r.id)+'" aria-label="'+esc(r.title)+' nicht genutzt" title="Nicht genutzt"'+(busy?' disabled':'')+'>✕</button>':
          r.status==='confirmed'?'<span aria-label="Bestätigt">✓ Verwendet</span><button type="button" data-treat-undo="'+esc(r.id)+'" title="Bestätigung rückgängig"'+(busy?' disabled':'')+'>↶</button>':
          '<span>Nicht genutzt</span><button type="button" data-treat-restore="'+esc(r.id)+'" title="Wieder einplanen"'+(busy?' disabled':'')+'>↶</button>')+
          '</div></li>';
      }).join('')+'</ul>':'<p>Heute ist kein Extra fest eingeplant. Das Genussbudget bleibt optional.</p>'));
  }
  // V885: Date + in-flight flag must be set BEFORE the first await.
  // Otherwise our own MutationObserver sees the loading markup and starts
  // another getSession() on every redraw (unbounded WebKit microtask loop).
  function withTimeout(request,label,ms=8000){
    let timer;
    return Promise.race([
      Promise.resolve(request),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' braucht zu lange.')),ms);})
    ]).finally(()=>clearTimeout(timer));
  }
  async function refresh(){
    if(busy||loading)return;
    loading=true;
    const requestedDay=berlinDay();
    day=requestedDay;
    try{
      const api=client();
      if(!api)throw new Error('Supabase-Verbindung fehlt');
      const {data:session,error:sessionError}=await withTimeout(api.auth.getSession(),'Anmeldung');
      uid=session?.session?.user?.id||'';
      if(sessionError||!uid)throw new Error('Bitte zuerst anmelden');
      const result=await withTimeout(api.from('food_planned_extras')
        .select('id,plan_date,source_key,title,kind,quantity,unit,calories_kcal,caffeine_mg,note,status')
        .eq('user_id',uid).eq('plan_date',requestedDay)
        .order('created_at',{ascending:true}).limit(100),'Genuss-Extras');
      if(result.error)throw result.error;
      if(day===requestedDay){rows=result.data||[];error='';}
    }catch(e){
      if(day===requestedDay){error=e?.message||String(e);rows=[];}
    }finally{
      loading=false;
      if(day!==requestedDay){
        // A date rollover during the request needs exactly one new request.
        ready=false;
        refresh();
      }else{
        ready=true;
        render();
      }
    }
  }
  function mount(){
    if(mounting)return;
    const root=document.getElementById(ROOT);
    const extra=document.getElementById('food-extra-snacks-v828');
    if(!root||root.getAttribute('aria-hidden')==='true'||!extra)return;
    mounting=true;
    try{
      styles();
      const today=berlinDay();
      ensureWorkCoffeePanel();
      if(day!==today){
        // Set date synchronously, not after auth.getSession().
        day=today;ready=false;rows=[];note='';error='';editingId='';
      }
      if(!box()){
        const el=document.createElement('section');el.id=ID;el.className='food-treat-panel-v880';
        el.setAttribute('aria-label','Geplante Genuss-Extras');
        extra.insertAdjacentElement('afterend',el);
        render();
        // Re-entry refreshes once, and shares an already running request.
        if(!loading&&!busy)refresh();
      }
    }finally{mounting=false;}
  }
  async function action(what,id,newQuantity=null){
    if(busy)return;
    const row=rows.find(r=>r.id===id);if(!row)return;
    const api=client();if(!api)return;
    busy=true;note='';error='';render();
    try{
      let result;
      if(what==='edit')result=await api.rpc('edit_food_planned_extra_v1',{p_plan_id:id,p_quantity:newQuantity});
      else if(what==='confirm')result=await api.rpc('confirm_food_planned_extra_v1',{p_plan_id:id});
      else if(what==='undo')result=await api.rpc('undo_food_planned_extra_v1',{p_plan_id:id});
      else result=await api.from('food_planned_extras')
         .update({status:what==='skip'?'skipped':'planned',updated_at:new Date().toISOString()})
         .eq('id',id).eq('user_id',uid)
         .eq('status',what==='skip'?'planned':'skipped').select('id').single();
      if(result.error)throw result.error;
      editingId='';
      note=what==='edit'?'✓ Menge angepasst, Kalorien und ggf. Vorrat aktualisiert.':
        what==='confirm'?'✓ Verzehr und Vorrat gemeinsam bestätigt.':
        what==='undo'?'↶ Verzehr und Vorrat zurückgebucht.':
        what==='skip'?'Vorschlag entfernt, kein Verbrauch gebucht.':'Vorschlag wieder eingeplant.';
      busy=false;await refresh();note&&render();
      if(['confirm','undo'].includes(what)||(what==='edit'&&row.status==='confirmed')){
        await window.__modFoodExtrasV828?.refresh?.();
        window.__modFoodNutritionV711?.refresh?.();
        await window.__modFoodV544?.reload?.();
      }
    }catch(e){busy=false;error=e?.message||String(e);render();}
  }
  document.addEventListener('click',e=>{
    const button=e.target.closest?.('[data-work-coffee-action]');
    if(!button||!button.closest('#'+WORK_COFFEE_ID))return;
    e.preventDefault();
    workCoffeeAction(button.getAttribute('data-work-coffee-action'));
  });
  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('[data-treat-confirm],[data-treat-skip],[data-treat-undo],[data-treat-restore],[data-treat-edit],[data-treat-cancel]');
    if(!btn||!btn.closest('#'+ID))return;
    e.preventDefault();
    const edit=btn.getAttribute('data-treat-edit');
    const cancel=btn.getAttribute('data-treat-cancel');
    if(edit){editingId=editingId===edit?'':edit;error='';render();return;}
    if(cancel){editingId='';render();return;}
    for(const what of ['confirm','skip','undo','restore']){
      const id=btn.getAttribute('data-treat-'+what);
      if(id){action(what,id);break;}
    }
  });
  document.addEventListener('submit',e=>{
    const form=e.target?.closest?.('[data-treat-edit-form]');
    if(!form||!form.closest('#'+ID))return;
    e.preventDefault();
    const id=form.dataset.treatEditForm;
    const row=rows.find(r=>r.id===id);if(!row)return;
    const entered=Number(String(form.elements.quantity.value).replace(',','.'));
    const counted=row.title.startsWith('Milka Danke');
    const whole=counted||row.unit==='Portion';
    if(!Number.isFinite(entered)||entered<=0||(whole&&!Number.isInteger(entered))){
      error='Bitte eine gültige '+(whole?'ganze Stückzahl':'Menge')+' eingeben.';render();return;
    }
    const next=counted?Math.round(entered*5.7*100)/100:entered;
    action('edit',id,next);
  });
  // Only the actual extra-snack anchor can trigger a mount, never the
  // planned-extras panel's OWN innerHTML changes.
  function isExtraAnchor(node){
    return node?.nodeType===1&&(node.id==='food-extra-snacks-v828'
      ||Boolean(node.querySelector?.('#food-extra-snacks-v828')));
  }
  const observer=new MutationObserver(ms=>{
    if(ms.some(m=>Array.from(m.addedNodes||[]).some(isExtraAnchor)))mount();
  });
  function start(){observer.observe(document.documentElement,{subtree:true,childList:true});mount();}
  window.__modFoodTreatsV880={version:'V880',refresh};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
