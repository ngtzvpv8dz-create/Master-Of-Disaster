/* V880 · Geplante Genuss-Extras: ausdrücklich getrennt vom bestätigten Verzehr.
   ✓ bucht Snack und Vorrat atomar; ✕ entfernt ausschließlich die Planung.
   Tagesbilanz zählt nur bestätigte food_extra_consumptions. */
(function(){
  'use strict';
  if(window.__modFoodTreatsV880)return;
  const ID='food-planned-extras-v880',ROOT='modFoodV544';
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const nf=x=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:1}).format(Number(x)||0);
  const berlinDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  let day='',rows=[],ready=false,busy=false,error='',note='',mounting=false,uid='';
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
     '.food-treat-panel-v880 .food-treat-success-v880{color:#226a47;font-weight:700}';
    document.head.append(s);
  }
  function render(){
    const el=box();if(!el)return;
    const pending=rows.filter(r=>r.status==='planned'),confirmed=rows.filter(r=>r.status==='confirmed');
    const kcal=pending.reduce((sum,r)=>sum+(Number(r.calories_kcal)||0),0);
    el.innerHTML='<h3>🍬 Geplante Genuss-Extras</h3>'+
      '<p>Flexibler Richtwert: 100 kcal/Tag innerhalb von 1.800 kcal. Nur mit ✓ bestätigte Extras zählen in Tagesbilanz und Vorrat. Vorschläge sind freiwillig.</p>'+
      (error?'<p role="alert" class="food-treat-error-v880">'+esc(error)+'</p>':'')+
      (note?'<p role="status" class="food-treat-success-v880">'+esc(note)+'</p>':'')+
      (!ready?'<p>Geplante Extras werden geladen …</p>':
      '<p>Offene Vorschläge: '+pending.length+' · '+nf(kcal)+' kcal · Bestätigt: '+confirmed.length+'</p>'+
      (rows.length?'<ul>'+rows.map(r=>{
        const note2=r.note?' · '+r.note:'';
        const unitDisplay=r.title.startsWith('Milka Danke')?'1 Stück (5,7 g)':nf(r.quantity)+' '+r.unit;
        return '<li><div class="food-treat-info-v880"><strong>'+esc(r.title)+'</strong><small>'+esc(unitDisplay)+' · '+
          (r.calories_kcal===null?'Kalorien unbekannt':nf(r.calories_kcal)+' kcal')+
          (r.caffeine_mg&&Number(r.caffeine_mg)>0?' · '+nf(r.caffeine_mg)+' mg Koffein':'')+
          esc(note2)+'</small></div><div class="food-treat-buttons-v880">'+
          (r.status==='planned'?'<button type="button" data-treat-confirm="'+esc(r.id)+'" aria-label="'+esc(r.title)+' tatsächlich verwendet" title="Verbraucht bestätigen"'+(busy?' disabled':'')+'>✓</button>'+
          '<button type="button" data-treat-skip="'+esc(r.id)+'" aria-label="'+esc(r.title)+' nicht genutzt" title="Nicht genutzt"'+(busy?' disabled':'')+'>✕</button>':
          r.status==='confirmed'?'<span aria-label="Bestätigt">✓ Verwendet</span><button type="button" data-treat-undo="'+esc(r.id)+'" title="Bestätigung rückgängig"'+(busy?' disabled':'')+'>↶</button>':
          '<span>Nicht genutzt</span><button type="button" data-treat-restore="'+esc(r.id)+'" title="Wieder einplanen"'+(busy?' disabled':'')+'>↶</button>')+
          '</div></li>';
      }).join('')+'</ul>':'<p>Heute ist kein Extra fest eingeplant. Das Genussbudget bleibt optional.</p>'));
  }
  async function refresh(){
    if(busy)return;
    const api=client();if(!api){error='Supabase-Verbindung fehlt';ready=true;render();return;}
    const {data:session,error:e}=await api.auth.getSession();
    uid=session?.session?.user?.id||'';
    if(e||!uid){error='Bitte zuerst anmelden';ready=true;render();return;}
    const today=berlinDay();day=today;
    const result=await api.from('food_planned_extras')
      .select('id,plan_date,title,kind,quantity,unit,calories_kcal,caffeine_mg,note,status')
      .eq('user_id',uid).eq('plan_date',today).order('created_at',{ascending:true}).limit(100);
    if(result.error){error=result.error.message;rows=[];}
    else{rows=result.data||[];error='';}
    ready=true;render();
  }
  function mount(){
    if(mounting)return;
    const root=document.getElementById(ROOT);
    const extra=document.getElementById('food-extra-snacks-v828');
    if(!root||root.getAttribute('aria-hidden')==='true'||!extra)return;
    mounting=true;
    try{
      styles();
      if(!box()){
        const el=document.createElement('section');el.id=ID;el.className='food-treat-panel-v880';
        el.setAttribute('aria-label','Geplante Genuss-Extras');
        extra.insertAdjacentElement('afterend',el);
        day='';ready=false;note='';error='';render();refresh();
      }else if(day!==berlinDay()&&!busy){ready=false;rows=[];note='';render();refresh();}
    }finally{mounting=false;}
  }
  async function action(what,id){
    if(busy)return;
    const row=rows.find(r=>r.id===id);if(!row)return;
    const api=client();if(!api)return;
    busy=true;note='';error='';render();
    try{
      let result;
      if(what==='confirm')result=await api.rpc('confirm_food_planned_extra_v1',{p_plan_id:id});
      else if(what==='undo')result=await api.rpc('undo_food_planned_extra_v1',{p_plan_id:id});
      else result=await api.from('food_planned_extras')
         .update({status:what==='skip'?'skipped':'planned',updated_at:new Date().toISOString()})
         .eq('id',id).eq('user_id',uid)
         .eq('status',what==='skip'?'planned':'skipped').select('id').single();
      if(result.error)throw result.error;
      note=what==='confirm'?'✓ Verzehr und Vorrat gemeinsam bestätigt.':
        what==='undo'?'↶ Verzehr und Vorrat zurückgebucht.':
        what==='skip'?'Vorschlag entfernt, kein Verbrauch gebucht.':'Vorschlag wieder eingeplant.';
      busy=false;await refresh();note&&render();
      if(['confirm','undo'].includes(what)){
        await window.__modFoodExtrasV828?.refresh?.();
        window.__modFoodNutritionV711?.refresh?.();
        await window.__modFoodV544?.reload?.();
      }
    }catch(e){busy=false;error=e?.message||String(e);render();}
  }
  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('[data-treat-confirm],[data-treat-skip],[data-treat-undo],[data-treat-restore]');
    if(!btn||!btn.closest('#'+ID))return;
    e.preventDefault();
    for(const what of ['confirm','skip','undo','restore']){
      const id=btn.getAttribute('data-treat-'+what);
      if(id){action(what,id);break;}
    }
  });
  const observer=new MutationObserver(ms=>{if(ms.some(m=>m.addedNodes.length))mount();});
  function start(){observer.observe(document.documentElement,{subtree:true,childList:true});mount();}
  window.__modFoodTreatsV880={version:'V880',refresh};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
