/* Planonisierung V1: read-only calendar and complete push-message inbox. */
(function(){
  'use strict';
  if(window.__modPlanonisierungV901)return;
  const ID='modPlanonisierungV901';
  const CLASS='mod-planonisierung-v901';
  const TZ='Europe/Berlin';
  let busy=false, visible=false, hubPatched=false;
  let events=[],reminders=[],state='idle',errorMessage='';
  const safe=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const localDay=date=>new Intl.DateTimeFormat('sv-SE',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
  const fullDate=date=>new Intl.DateTimeFormat('de-DE',{timeZone:TZ,weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(date);
  const shortDate=date=>new Intl.DateTimeFormat('de-DE',{timeZone:TZ,weekday:'short',day:'2-digit',month:'2-digit'}).format(date);
  const hour=date=>new Intl.DateTimeFormat('de-DE',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
  const dateOf=value=>new Date(value);
  const spanDays=(count)=>new Date(Date.now()+count*86400000).toISOString();
  function ensureRoot(){
    let root=document.getElementById(ID);
    if(root)return root;
    const app=document.querySelector('main.app');
    if(!app)return null;
    root=document.createElement('section');
    root.id=ID;
    root.className='mod-planonisierung-root-v901';
    root.hidden=true;
    root.setAttribute('aria-hidden','true');
    root.setAttribute('aria-label','Planonisierung');
    app.appendChild(root);
    return root;
  }
  function client(){
    return typeof window.getSupabaseClient==='function'?window.getSupabaseClient():null;
  }
  function noteList(){
    const today=localDay(new Date());
    const tomorrow=localDay(new Date(Date.now()+86400000));
    const future=events.filter(event=>event.status!=='cancelled'&&dateOf(event.starts_at).getTime()>=Date.now()-60000);
    const todayCount=events.filter(event=>localDay(dateOf(event.starts_at))===today&&event.status!=='cancelled').length;
    const next=future[0];
    return '<section class="plano-summary-v901" aria-label="Tagesübersicht">'
      +'<div><small>HEUTE</small><strong>'+todayCount+' Termin'+(todayCount===1?'':'e')+'</strong><span>'+safe(fullDate(new Date()))+'</span></div>'
      +'<div><small>ALS NÄCHSTES</small><strong>'+(next?safe(hour(dateOf(next.starts_at))):'Alles frei')+'</strong><span>'+(next?safe(next.title):'Keine weiteren Termine geplant')+'</span></div>'
      +'</section>';
  }
  function agenda(){
    if(!events.length)return '<p class="plano-empty-v901">Für den angezeigten Zeitraum sind noch keine Termine eingetragen.</p>';
    const now=Date.now();
    const today=localDay(new Date());
    const tomorrow=localDay(new Date(now+86400000));
    let last='';
    const lines=[];
    for(const item of events){
      const when=dateOf(item.starts_at),day=localDay(when);
      if(day!==last){
        const label=day===today?'Heute':day===tomorrow?'Morgen':fullDate(when);
        lines.push('<h4 class="plano-day-v901">'+safe(label)+'</h4>');
        last=day;
      }
      const cancelled=item.status==='cancelled';
      lines.push('<article class="plano-event-v901'+(cancelled?' is-cancelled':'')+'"><div class="plano-event-time-v901">'+
        (item.all_day?'Ganztägig':safe(hour(when)))+'</div><div class="plano-event-main-v901"><strong>'+safe(item.title)+'</strong>'+
        (item.ends_at?'<span>Bis '+safe(hour(dateOf(item.ends_at)))+' Uhr</span>':'')+
        (item.location_name?'<span>📍 '+safe(item.location_name)+'</span>':'')+
        (item.location_address?'<span>'+safe(item.location_address)+'</span>':'')+
        (cancelled?'<span>Abgesagt</span>':'')+
        (item.notes?'<details><summary>Weitere Hinweise</summary><p>'+safe(item.notes)+'</p></details>':'')+
        '</div></article>');
    }
    return lines.join('');
  }
  function remindersMarkup(){
    if(!reminders.length)return '<p class="plano-empty-v901">Keine Erinnerungen in den vergangenen drei Tagen oder den kommenden zwei Wochen.</p>';
    const now=Date.now();
    const priority=row=>{
      const at=dateOf(row.scheduled_at).getTime();
      return row.state==='pending'&&at>=now?0:row.state==='sent'?1:2;
    };
    const ordered=[...reminders].sort((a,b)=>{
      const rank=priority(a)-priority(b);
      if(rank)return rank;
      const da=dateOf(a.scheduled_at).getTime(),db=dateOf(b.scheduled_at).getTime();
      return priority(a)===0?da-db:db-da;
    });
    return ordered.map(row=>{
      const date=dateOf(row.scheduled_at);
      const status={pending:'Geplant',processing:'Wird versendet',sent:'An Push-Dienst gesendet',failed:'Versand fehlgeschlagen',cancelled:'Abgebrochen'}[row.state]||row.state;
      return '<article class="plano-reminder-v901" data-state="'+safe(row.state)+'">'
        +'<div class="plano-reminder-meta-v901"><time>'+safe(shortDate(date))+' · '+safe(hour(date))+' Uhr</time><span>'+safe(status)+'</span></div>'
        +'<h4>'+safe(row.title)+'</h4>'
        +'<p>'+safe(row.body||'Keine weiteren Angaben hinterlegt.')+'</p>'
        +(row.state==='failed'&&row.last_error?'<small>Fehler: '+safe(row.last_error)+'</small>':'')
        +'</article>';
    }).join('');
  }
  function shell(){
    return '<div class="plano-shell-v901">'
      +'<div class="plano-topline-v901"><span>📅 TERMINZENTRALE</span><button type="button" data-plano-home-v901>← Zur Startseite</button></div>'
      +'<header class="plano-hero-v901"><span>DER PLAN GEGEN DAS CHAOS</span><h2>PLANONISIERUNG</h2>'
      +'<p>Deine nächsten Termine und Erinnerungen. Vollständig lesbar, auch wenn iOS die Push-Vorschau kürzt.</p></header>'
      +noteList()
      +'<div class="plano-section-head-v901"><div><small>BENACHRICHTIGUNGEN</small><h3>Erinnerungen im Klartext</h3></div><button type="button" data-plano-refresh-v901 '+(busy?'disabled':'')+'>↻ Aktualisieren</button></div>'
      +'<p class="plano-explain-v901">Der vollständige Text deiner App-Erinnerungen. „Gesendet“ bestätigt die Übergabe an den Push-Dienst, nicht das Lesen auf dem iPhone.</p>'
      +(state==='loading'&&reminders.length===0?'<p class="plano-empty-v901">Erinnerungen werden geladen …</p>':remindersMarkup())
      +'<div class="plano-section-head-v901"><div><small>DEIN ZEITPLAN</small><h3>Was steht an?</h3></div></div>'
      +(state==='loading'&&events.length===0?'<p class="plano-empty-v901">Termine werden geladen …</p>':agenda())
      +(errorMessage?'<p class="plano-error-v901" role="alert">'+safe(errorMessage)+'</p>':'')
      +'<p class="plano-footer-v901">Version 1 zeigt bestehende Termine und Meldungen. Kalenderansicht sowie Erstellen und Bearbeiten kommen später.</p>'
      +'</div>';
  }
  function render(){
    const root=ensureRoot();if(!root)return false;
    root.innerHTML=shell();
    root.querySelector('[data-plano-home-v901]')?.addEventListener('click',()=>window.__modAppHubV515?.show?.());
    root.querySelector('[data-plano-refresh-v901]')?.addEventListener('click',()=>load());
    try{window.__modFixedAppHeaderV475?.updateHeight?.();}catch(_){}
    return true;
  }
  async function load(){
    if(busy)return;
    busy=true;state='loading';errorMessage='';render();
    try{
      const sb=client();
      if(!sb)throw new Error('Keine Verbindung zur Cloud.');
      const session=await sb.auth.getSession();
      const user=session?.data?.session?.user;
      if(session?.error||!user?.id)throw new Error('Bitte zuerst in der App anmelden.');
      const [a,b]=await Promise.all([
        sb.from('calendar_events')
          .select('id,title,starts_at,ends_at,all_day,location_name,location_address,notes,status')
          .eq('user_id',user.id).gte('starts_at',spanDays(-1)).lte('starts_at',spanDays(30))
          .order('starts_at',{ascending:true}).limit(150),
        sb.from('push_reminders')
          .select('id,title,body,scheduled_at,state,last_error')
          .eq('user_id',user.id).gte('scheduled_at',spanDays(-3)).lte('scheduled_at',spanDays(14))
          .order('scheduled_at',{ascending:false}).limit(100)
      ]);
      if(a.error)throw a.error;if(b.error)throw b.error;
      events=a.data||[];reminders=b.data||[];state='ready';
    }catch(error){
      errorMessage=error?.message||'Die Daten konnten nicht geladen werden.';
      state='error';
    }finally{busy=false;if(visible)render();}
  }
  function setSurface(active){
    document.body.classList.toggle(CLASS,active);
    document.documentElement.classList.toggle('mod-planonisierung-surface-v901',active);
    if(active)document.body.dataset.modAppSurfaceV515='planonisierung';
    else if(document.body.dataset.modAppSurfaceV515==='planonisierung')delete document.body.dataset.modAppSurfaceV515;
  }
  function close(){
    if(!visible)return false;
    visible=false;setSurface(false);
    const root=ensureRoot();if(root){root.hidden=true;root.setAttribute('aria-hidden','true');}
    return true;
  }
  function open(){
    try{window.__modFoodV544?.close?.();}catch(_){}
    try{window.__modFinanceV552?.close?.();}catch(_){}
    try{window.__modDenkfabrikV752?.close?.();}catch(_){}
    try{window.__modKistologyV603?.close?.();}catch(_){}
    try{window.__modBackstageV531?.close?.({restoreTodo:false});}catch(_){}
    window.__modAppHubV515?.hide?.();
    visible=true;setSurface(true);
    const root=ensureRoot();if(root){root.hidden=false;root.setAttribute('aria-hidden','false');}
    render();load();
    try{window.scrollTo?.({top:0,left:0,behavior:'instant'});}catch(_){window.scrollTo?.(0,0);}
    return 'planonisierung';
  }
  function patchHub(){
    const hub=window.__modAppHubV515;
    if(!hub||hubPatched)return;
    const originalShow=hub.show?.bind(hub);
    const originalOpen=hub.open?.bind(hub);
    if(originalShow)hub.show=function(){close();return originalShow(...arguments);};
    if(originalOpen)hub.open=function(target,opts){if(target==='planonisierung')return open();close();return originalOpen(target,opts);};
    hubPatched=true;
  }
  window.__modPlanonisierungV901={open,close,load,render,get visible(){return visible;},get state(){return state;}};
  function init(){ensureRoot();patchHub();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  document.addEventListener('visibilitychange',()=>{if(visible&&!document.hidden)load();});
})();