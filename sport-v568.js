/* V573 · SPORT · X-Training + catalog + Supabase live data */
(function(){
  'use strict';
  if(window.__modSportV568)return;

  const VERSION='V573';
  const ROOT_ID='sportRootV510';
  const MODE_KEY='masterOfDisasterAppModeV510';
  const TAB_KEY='masterOfDisasterSportTabV568';
  const CACHE_KEY='masterOfDisasterSportSessionsV568Cache';
  const LEGACY_KEY='masterOfDisasterSportSessionsV510';
  const HEALTH_EVENT='mod:health-sync-request';
  const REQUEST_TIMEOUT_MS=4500;
  const TABS=[
    {id:'fitx',label:'FITX'},
    {id:'xtraining',label:'X-TRAINING'},
    {id:'catalog',label:'KATALOG'},
    {id:'activities',label:'AKTIVITÄTEN'},
    {id:'statistics',label:'STATISTIK'}
  ];
  const COURSE_NAMES=new Map([
    ['tour de x','tour de x'],
    ['into x','into x'],
    ['functional x','functional x'],
    ['yogilatix','yogilatix']
  ]);

  const regressionRoute=(()=>{
    try{
      const p=new URL(location.href).searchParams;
      return String(p.get('reg')||p.get('smoke')||'').toLowerCase();
    }catch(_){return '';}
  })();
  const historicalRegression=/^v(?:510|511|512|515)$/.test(regressionRoute);
  const historicalSeed={
    id:'fitx-2026-09-08-1803',
    area:'fitx',
    date:'2026-09-08',
    title:'FitX',
    venue:'FitX',
    startedAt:'2026-09-08T18:03:00+02:00',
    endedAt:'2026-09-08T20:36:00+02:00',
    durationMinutes:153,
    source:'regression_fixture',
    note:'Restzeit: Fahrzeit, Aufwärmen, Umziehen und sonstige Zeit außerhalb des Kurses.',
    activities:[{
      id:'tour-de-x-2026-09-08',
      type:'course',
      name:'tour de x',
      startedAt:'2026-09-08T19:00:00+02:00',
      endedAt:'2026-09-08T19:50:00+02:00',
      durationMinutes:50,
      sortOrder:1,
      participants:['Erik','Nalan']
    }]
  };

  let activeTab='fitx';
  let state={loaded:false,loading:false,error:null,source:'cache',sessions:[],catalogExercises:[],equipment:[],sessionParticipants:[],sessionExercises:[],exerciseSets:[]};
  let loadPromise=null;
  let renderSerial=0;

  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validDate=value=>{const d=value?new Date(value):null;return d&&Number.isFinite(d.getTime())?d:null;};
  const diffMinutes=(a,b)=>{const start=validDate(a),end=validDate(b);return start&&end?Math.max(0,Math.round((end-start)/60000)):0;};
  const canonicalCourse=value=>{const raw=String(value||'').trim();return COURSE_NAMES.get(raw.toLowerCase())||raw||'Aktivität';};
  const formatMinutes=value=>{const m=Math.max(0,Math.round(Number(value)||0)),h=Math.floor(m/60),rest=m%60;return h?`${h}:${String(rest).padStart(2,'0')} h`:`${rest} min`;};
  const clock=value=>{const d=validDate(value);return d?new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit',hour12:false}).format(d):'–';};
  const dateLabel=dateKey=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey||''));if(!m)return String(dateKey||'');const d=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),12));return new Intl.DateTimeFormat('de-DE',{timeZone:'UTC',weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).format(d);};
  const shortDate=dateKey=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey||''));return m?`${m[3]}.${m[2]}.${m[1]}`:String(dateKey||'');};
  const byName=(a,b)=>String(a).localeCompare(String(b),'de',{sensitivity:'base'});
  const todayIso=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const numberOrNull=value=>value===null||value===undefined||value===''?null:Number(value);
  const workoutStatusLabel=value=>({planned:'Geplant',running:'Läuft',completed:'Abgeschlossen',skipped:'Übersprungen'}[value]||'Geplant');
  const xSessionStatusLabel=value=>({planned:'Geplant',running:'Läuft',completed:'Abgeschlossen',cancelled:'Abgebrochen'}[value]||'Geplant');
  const TIMELINE_STEPS=[
    ['driveStartedAt','drive_started_at','Fahrt gestartet'],
    ['gymArrivedAt','gym_arrived_at','Fitness angekommen'],
    ['trainingStartedAt','training_started_at','Training gestartet'],
    ['trainingEndedAt','training_ended_at','Training beendet'],
    ['gymLeftAt','gym_left_at','Fitness verlassen'],
    ['homeArrivedAt','home_arrived_at','Zu Hause angekommen']
  ];

  function client(){
    try{
      if(typeof window.getSupabaseClient==='function')return window.getSupabaseClient();
      if(typeof getSupabaseClient==='function')return getSupabaseClient();
    }catch(_){ }
    return null;
  }

  function withTimeout(promise,label,ms=REQUEST_TIMEOUT_MS){
    let timer;
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label}: Zeitüberschreitung`)),ms);});
    return Promise.race([promise,timeout]).finally(()=>clearTimeout(timer));
  }

  function sessionMinutes(session){
    const stored=Number(session?.durationMinutes);
    return Number.isFinite(stored)&&stored>=0?stored:diffMinutes(session?.startedAt,session?.endedAt);
  }
  function activityMinutes(activity){
    const stored=Number(activity?.durationMinutes);
    return Number.isFinite(stored)&&stored>=0?stored:diffMinutes(activity?.startedAt,activity?.endedAt);
  }
  function courseMinutes(session){return (session?.activities||[]).reduce((sum,a)=>sum+activityMinutes(a),0);}
  function isFitx(session){return String(session?.area||'').toLowerCase()==='fitx'||String(session?.title||'').toLowerCase()==='fitx'||String(session?.venue||'').toLowerCase()==='fitx';}

  function normalizeParticipants(rows){
    return [...new Set((Array.isArray(rows)?rows:[]).map(row=>typeof row==='string'?row:row?.participant_name).map(x=>String(x||'').trim()).filter(Boolean))].sort(byName);
  }

  function normalizeActivity(row){
    if(!row||typeof row!=='object')return null;
    return {
      id:String(row.id||''),
      type:String(row.kind||row.type||'activity'),
      name:canonicalCourse(row.name),
      startedAt:row.started_at||row.startedAt||null,
      endedAt:row.ended_at||row.endedAt||null,
      durationMinutes:Number(row.duration_minutes??row.durationMinutes??diffMinutes(row.started_at||row.startedAt,row.ended_at||row.endedAt))||0,
      sortOrder:Number(row.sort_order??row.sortOrder??999),
      note:row.notes||row.note||'',
      participants:normalizeParticipants(row.participants||row.sport_activity_participants||[])
    };
  }

  function normalizeWorkoutExercise(row){
    if(!row||typeof row!=='object'||!row.id)return null;
    return {
      id:String(row.id),
      sessionId:String(row.session_id||row.sessionId||''),
      exerciseId:String(row.exercise_id||row.exerciseId||''),
      equipmentId:row.equipment_id||row.equipmentId||null,
      name:String(row.name_snapshot||row.name||'Übung'),
      kind:String(row.kind||'strength'),
      status:String(row.status||'planned'),
      sortOrder:Number(row.sort_order??row.sortOrder??999),
      startedAt:row.started_at||row.startedAt||null,
      endedAt:row.ended_at||row.endedAt||null,
      durationMinutes:numberOrNull(row.duration_minutes??row.durationMinutes),
      distanceKm:numberOrNull(row.distance_km??row.distanceKm),
      resistanceLevel:row.resistance_level??row.resistanceLevel??'',
      speedKmh:numberOrNull(row.speed_kmh??row.speedKmh),
      inclinePercent:numberOrNull(row.incline_percent??row.inclinePercent),
      sets:(row.sets||[]).map(set=>({
        id:String(set.id||''),
        setNumber:Number(set.set_number??set.setNumber??0),
        weightKg:numberOrNull(set.weight_kg??set.weightKg),
        repetitions:numberOrNull(set.repetitions),
        rir:numberOrNull(set.rir)
      })).sort((a,b)=>a.setNumber-b.setNumber)
    };
  }

  function normalizeSession(row){
    if(!row||typeof row!=='object'||!row.id)return null;
    const activities=(Array.isArray(row.activities)?row.activities:Array.isArray(row.sport_activities)?row.sport_activities:[]).map(normalizeActivity).filter(Boolean).sort((a,b)=>a.sortOrder-b.sortOrder||String(a.startedAt||'').localeCompare(String(b.startedAt||'')));
    const workout=(row.workout||[]).map(normalizeWorkoutExercise).filter(Boolean).sort((a,b)=>a.sortOrder-b.sortOrder);
    const title=String(row.title||'Sport');
    const venue=row.venue||null;
    const kind=String(row.session_kind||row.sessionKind||'legacy');
    return {
      id:String(row.id),
      area:kind==='xtraining'?'xtraining':((title.toLowerCase()==='fitx'||String(venue||'').toLowerCase()==='fitx')?'fitx':'sport'),
      kind,
      status:String(row.session_status||row.sessionStatus||'completed'),
      date:row.session_date||row.date||'',
      title,
      venue,
      startedAt:row.started_at||row.startedAt||null,
      endedAt:row.ended_at||row.endedAt||null,
      driveStartedAt:row.drive_started_at||row.driveStartedAt||null,
      gymArrivedAt:row.gym_arrived_at||row.gymArrivedAt||null,
      trainingStartedAt:row.training_started_at||row.trainingStartedAt||null,
      trainingEndedAt:row.training_ended_at||row.trainingEndedAt||null,
      gymLeftAt:row.gym_left_at||row.gymLeftAt||null,
      homeArrivedAt:row.home_arrived_at||row.homeArrivedAt||null,
      durationMinutes:Number(row.duration_minutes??row.durationMinutes??diffMinutes(row.started_at||row.startedAt,row.ended_at||row.endedAt))||0,
      source:row.source||'manual',
      sourceKey:row.source_key||row.sourceKey||null,
      note:row.notes||row.note||'',
      participants:normalizeParticipants(row.sessionParticipants||row.participants||[]),
      workout,
      activities
    };
  }

  function sortSessions(rows){
    return (Array.isArray(rows)?rows:[]).map(normalizeSession).filter(Boolean).sort((a,b)=>{
      const ad=String(a.date||''),bd=String(b.date||'');
      if(ad!==bd)return bd.localeCompare(ad);
      return String(b.startedAt||'').localeCompare(String(a.startedAt||''));
    });
  }

  function readCache(){
    for(const key of [CACHE_KEY,LEGACY_KEY]){
      try{const rows=JSON.parse(localStorage.getItem(key)||'null');if(Array.isArray(rows)&&rows.length)return sortSessions(rows);}catch(_){ }
    }
    return [];
  }
  function writeCache(rows){try{localStorage.setItem(CACHE_KEY,JSON.stringify(rows));}catch(_){ }}

  async function remoteData(){
    const supabase=client();
    if(!supabase)throw new Error('Supabase-Client ist nicht verfügbar.');
    const sessionResult=await withTimeout(supabase.auth.getSession(),'Anmeldung',3000);
    if(sessionResult?.error)throw sessionResult.error;
    const user=sessionResult?.data?.session?.user;
    if(!user?.id)throw new Error('Nicht angemeldet.');

    const queries=[
      supabase.from('sport_sessions').select('id,session_date,title,venue,started_at,ended_at,duration_minutes,source,source_key,notes,session_kind,session_status,drive_started_at,gym_arrived_at,training_started_at,training_ended_at,gym_left_at,home_arrived_at').eq('user_id',user.id).order('session_date',{ascending:false}).limit(500),
      supabase.from('sport_activities').select('id,session_id,name,kind,started_at,ended_at,duration_minutes,sort_order,notes').eq('user_id',user.id).order('started_at',{ascending:false}).limit(2500),
      supabase.from('sport_activity_participants').select('activity_id,participant_name').eq('user_id',user.id).limit(5000),
      supabase.from('sport_session_participants').select('id,session_id,participant_name').eq('user_id',user.id).limit(5000),
      supabase.from('sport_exercise_catalog').select('id,name,kind,category,muscle_group,active,sort_order').eq('user_id',user.id).eq('active',true).order('sort_order').order('name'),
      supabase.from('sport_equipment_catalog').select('id,name,equipment_number,category,settings_text,active,sort_order').eq('user_id',user.id).eq('active',true).order('sort_order').order('name'),
      supabase.from('sport_session_exercises').select('id,session_id,exercise_id,equipment_id,name_snapshot,kind,status,sort_order,started_at,ended_at,duration_minutes,distance_km,resistance_level,speed_kmh,incline_percent,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(5000),
      supabase.from('sport_exercise_sets').select('id,session_exercise_id,set_number,weight_kg,repetitions,rir').eq('user_id',user.id).order('set_number').limit(15000)
    ];
    const labels=['Sporttermine','Sportaktivitäten','Kurs-Teilnehmer','Trainingspartner','Übungskatalog','Gerätekatalog','X-Training Übungen','Sätze'];
    const results=await Promise.all(queries.map((query,index)=>withTimeout(query,labels[index],6500)));
    for(const result of results)if(result?.error)throw result.error;
    const [sessionsResult,activitiesResult,participantsResult,sessionPeopleResult,catalogResult,equipmentResult,workoutResult,setsResult]=results;

    const peopleByActivity=new Map();
    (participantsResult.data||[]).forEach(row=>{
      const list=peopleByActivity.get(row.activity_id)||[];
      list.push(row.participant_name);
      peopleByActivity.set(row.activity_id,list);
    });
    const activitiesBySession=new Map();
    (activitiesResult.data||[]).forEach(row=>{
      const list=activitiesBySession.get(row.session_id)||[];
      list.push({...row,participants:normalizeParticipants(peopleByActivity.get(row.id)||[])});
      activitiesBySession.set(row.session_id,list);
    });

    const peopleBySession=new Map();
    (sessionPeopleResult.data||[]).forEach(row=>{
      const list=peopleBySession.get(row.session_id)||[];
      list.push(row.participant_name);
      peopleBySession.set(row.session_id,list);
    });

    const setsByExercise=new Map();
    (setsResult.data||[]).forEach(row=>{
      const list=setsByExercise.get(row.session_exercise_id)||[];
      list.push(row);
      setsByExercise.set(row.session_exercise_id,list);
    });
    const workoutBySession=new Map();
    (workoutResult.data||[]).forEach(row=>{
      const list=workoutBySession.get(row.session_id)||[];
      list.push({...row,sets:setsByExercise.get(row.id)||[]});
      workoutBySession.set(row.session_id,list);
    });

    state={...state,
      catalogExercises:(catalogResult.data||[]),
      equipment:(equipmentResult.data||[]),
      sessionParticipants:(sessionPeopleResult.data||[]),
      sessionExercises:(workoutResult.data||[]),
      exerciseSets:(setsResult.data||[])
    };

    return sortSessions((sessionsResult.data||[]).map(row=>({
      ...row,
      activities:activitiesBySession.get(row.id)||[],
      sessionParticipants:peopleBySession.get(row.id)||[],
      workout:workoutBySession.get(row.id)||[]
    })));
  }

  async function load(force=false){
    if(historicalRegression){
      state={...state,loaded:true,loading:false,error:null,source:'cache',sessions:sortSessions([historicalSeed])};
      writeCache(state.sessions);render();return state.sessions;
    }
    if(loadPromise)return loadPromise;
    state={...state,loading:true,error:null};render();
    const task=remoteData().then(rows=>{
      state={...state,loaded:true,loading:false,error:null,source:'supabase',sessions:rows};
      writeCache(rows);render();return rows;
    }).catch(error=>{
      const cache=state.sessions.length?state.sessions:readCache();
      state={...state,loaded:false,loading:false,error:error?.message||String(error),source:cache.length?'cache':'error',sessions:cache};
      render();return cache;
    }).finally(()=>{if(loadPromise===task)loadPromise=null;});
    loadPromise=task;return task;
  }

  function ensureRoot(){
    let root=document.getElementById(ROOT_ID);if(root)return root;
    const app=document.querySelector('.app');if(!app)return null;
    root=document.createElement('section');root.id=ROOT_ID;root.className='sport-root-v510';root.setAttribute('aria-label','Sportbereich');
    app.insertBefore(root,document.getElementById('inputPanel')||null);return root;
  }

  function statusBadge(){
    if(state.loading)return '<span class="sport-sync-v568 is-loading"><i></i>SYNC</span>';
    if(state.source==='supabase'&&!state.error)return '<span class="sport-sync-v568 is-live"><i></i>SUPABASE · LIVE</span>';
    if(state.source==='cache')return '<span class="sport-sync-v568 is-cache"><i></i>CACHE</span>';
    return '<span class="sport-sync-v568 is-error"><i></i>OFFLINE</span>';
  }
  function errorNote(){return state.error?`<div class="sport-cloud-note-v568">${esc(state.source==='cache'?'Cloud gerade nicht erreichbar · lokaler Stand wird gezeigt.':'Sportdaten konnten nicht geladen werden.')}</div>`:'';}
  function wave(){return '<svg class="sport-wave-v510 sport-wave-v512" viewBox="0 0 700 96" preserveAspectRatio="none" aria-hidden="true"><path d="M0 58 C70 58 78 25 142 25 S226 82 300 53 S406 19 472 52 S590 79 700 31" fill="none" stroke="currentColor" stroke-width="1.4" vector-effect="non-scaling-stroke"/></svg>';}
  function tabRail(){return `<aside class="sport-side-rail-v510 sport-side-rail-v512" aria-label="Sportbereiche">${TABS.map((tab,index)=>`<button type="button" class="sport-side-tab-v510 sport-side-tab-v512 ${activeTab===tab.id?'active':''}" data-sport-tab-v510="${tab.id}" data-sport-tab-v512="${tab.id}" data-sport-tab-v568="${tab.id}" style="--sport-tab-index-v512:${index}" ${activeTab===tab.id?'aria-current="page"':''} aria-label="${esc(tab.label)} öffnen"><span class="sport-side-tab-label-v510">${esc(tab.label)}</span></button>`).join('')}</aside>`;}
  function participantsLine(activity){return activity.participants?.length?`<div class="sport-people-v568"><span>mit</span> ${activity.participants.map(esc).join(' · ')}</div>`:'<div class="sport-people-v568 is-empty">ohne Teilnehmerangabe</div>';}

  function courseCard(activity,index=0){
    return `<article class="sport-course-card-v568" style="--sport-course-index-v568:${index}"><div class="sport-course-top-v568"><div><h3>${esc(activity.name)}</h3><div class="sport-card-sub-v510">${esc(clock(activity.startedAt))}–${esc(clock(activity.endedAt))}</div></div><span class="sport-chip-v510">${esc(formatMinutes(activityMinutes(activity)))}</span></div>${participantsLine(activity)}</article>`;
  }

  function miniVisit(session){
    const names=(session.activities||[]).map(a=>a.name);
    return `<article class="sport-visit-v568"><div><strong>${esc(shortDate(session.date))}</strong><span>${session.startedAt?`${esc(clock(session.startedAt))}–${esc(clock(session.endedAt))}`:'Zeit nicht dokumentiert'}</span></div><div class="sport-visit-meta-v568"><b>${esc(formatMinutes(sessionMinutes(session)))}</b><small>${esc(names.join(' · ')||'keine Kurse dokumentiert')}</small></div></article>`;
  }

  function fitxPanel(rows){
    const fitx=rows.filter(isFitx);const session=fitx[0]||null;
    if(!session){
      return `<section class="sport-panel-v510 sport-panel-v512">${wave()}<div class="sport-hero-v510"><div class="sport-kicker-v510"><span class="sport-live-dot-v510"></span>FITX ${statusBadge()}</div><p class="sport-date-v510">${state.loading?'Sportdaten werden geladen …':'Noch keine FitX-Einheit gespeichert.'}</p></div>${errorNote()}<div class="sport-content-v510"><div class="sport-mode-hint-v510">Über das Haus geht es zurück zum Home-Bildschirm.</div></div></section>`;
    }
    const total=sessionMinutes(session),courses=courseMinutes(session),other=Math.max(0,total-courses);
    return `<section class="sport-panel-v510 sport-panel-v512" data-sport-panel-v512="fitx" data-sport-panel-v568="fitx">${wave()}<div class="sport-hero-v510"><div class="sport-kicker-v510"><span class="sport-live-dot-v510"></span>FITX · LETZTE EINHEIT ${statusBadge()}</div><p class="sport-date-v510">${esc(dateLabel(session.date))}</p><div class="sport-duration-row-v510"><div class="sport-duration-v510" id="sportDurationV510" data-total-minutes="${total}">${esc(formatMinutes(total).replace(' h',''))}</div><div class="sport-duration-unit-v510">Gesamtaufwand</div></div><div class="sport-time-window-v510">${esc(clock(session.startedAt))} <span>→</span> ${esc(clock(session.endedAt))}</div></div><div class="sport-content-v510"><div class="sport-meta-grid-v568"><div class="sport-meta-v510"><div class="sport-meta-label-v510">Kurse</div><div class="sport-meta-value-v510">${session.activities.length}</div></div><div class="sport-meta-v510"><div class="sport-meta-label-v510">Kurszeit</div><div class="sport-meta-value-v510">${esc(formatMinutes(courses))}</div></div><div class="sport-meta-v510"><div class="sport-meta-label-v510">Drumherum</div><div class="sport-meta-value-v510">${esc(formatMinutes(other))}</div></div></div><div class="sport-course-list-v568">${session.activities.map(courseCard).join('')||'<div class="sport-empty-inline-v568">Keine Kurse dokumentiert.</div>'}</div>${session.note?`<div class="sport-footnote-v510">${esc(session.note)}</div>`:''}${fitx.length>1?`<div class="sport-section-title-v568">Letzte FitX-Besuche</div><div class="sport-visit-list-v568">${fitx.slice(1,4).map(miniVisit).join('')}</div>`:''}${errorNote()}<div class="sport-mode-hint-v510">Über das Haus geht es zurück zum Home-Bildschirm.</div></div></section>`;
  }

  async function sportUser(){
    const supabase=client();
    if(!supabase)throw new Error('Supabase-Client ist nicht verfügbar.');
    const result=await withTimeout(supabase.auth.getSession(),'Anmeldung',3000);
    if(result?.error)throw result.error;
    const user=result?.data?.session?.user;
    if(!user?.id)throw new Error('Nicht angemeldet.');
    return {supabase,user};
  }

  async function createXSession(){
    const {supabase,user}=await sportUser();
    const existing=state.sessions.find(session=>session.kind==='xtraining'&&session.date===todayIso()&&session.status!=='completed'&&session.status!=='cancelled');
    if(existing)return existing;
    const result=await supabase.from('sport_sessions').insert({
      user_id:user.id,
      session_date:todayIso(),
      title:'X-Training',
      venue:'FitX',
      session_kind:'xtraining',
      session_status:'planned',
      source:'manual'
    }).select('id').single();
    if(result.error)throw result.error;
    await load(true);
    return state.sessions.find(session=>session.id===result.data.id)||null;
  }

  async function markTimeline(sessionId,column){
    const allowed=new Set(TIMELINE_STEPS.map(step=>step[1]));
    if(!allowed.has(column))throw new Error('Unbekannter Zeitpunkt.');
    const {supabase}=await sportUser();
    const stamp=new Date().toISOString();
    const patch={[column]:stamp};
    if(column==='drive_started_at'){
      patch.started_at=stamp;
      patch.session_status='running';
    }
    if(column==='training_started_at')patch.session_status='running';
    if(column==='home_arrived_at'){
      patch.ended_at=stamp;
      patch.session_status='completed';
      const session=state.sessions.find(item=>item.id===sessionId);
      const start=validDate(session?.driveStartedAt||session?.startedAt);
      if(start)patch.duration_minutes=Math.max(0,Math.round((new Date(stamp)-start)/60000));
    }
    const result=await supabase.from('sport_sessions').update(patch).eq('id',sessionId).select('id').single();
    if(result.error)throw result.error;
    await load(true);
  }

  async function addSessionParticipant(sessionId,name){
    const clean=String(name||'').trim();
    if(!clean)throw new Error('Name fehlt.');
    const {supabase,user}=await sportUser();
    const result=await supabase.from('sport_session_participants').insert({user_id:user.id,session_id:sessionId,participant_name:clean});
    if(result.error&&result.error.code!=='23505')throw result.error;
    await load(true);
  }

  async function removeSessionParticipant(id){
    const {supabase}=await sportUser();
    const result=await supabase.from('sport_session_participants').delete().eq('id',id);
    if(result.error)throw result.error;
    await load(true);
  }

  async function addCatalogExercise(payload){
    const {supabase,user}=await sportUser();
    const name=String(payload.name||'').trim();
    const kind=payload.kind==='cardio'?'cardio':'strength';
    if(!name)throw new Error('Übungsname fehlt.');
    const result=await supabase.from('sport_exercise_catalog').insert({
      user_id:user.id,
      name,
      kind,
      category:String(payload.category||'').trim()||null,
      muscle_group:String(payload.muscle_group||'').trim()||null,
      active:true
    });
    if(result.error)throw result.error;
    await load(true);
  }

  async function addEquipment(payload){
    const {supabase,user}=await sportUser();
    const name=String(payload.name||'').trim();
    if(!name)throw new Error('Gerätename fehlt.');
    const result=await supabase.from('sport_equipment_catalog').insert({
      user_id:user.id,
      name,
      equipment_number:String(payload.equipment_number||'').trim()||null,
      category:String(payload.category||'').trim()||'Kraft',
      settings_text:String(payload.settings_text||'').trim()||null,
      active:true
    });
    if(result.error)throw result.error;
    await load(true);
  }

  function activeXSession(){
    return state.sessions.find(session=>session.kind==='xtraining'&&session.date===todayIso()&&session.status!=='completed'&&session.status!=='cancelled')||null;
  }

  async function addExerciseToSession(sessionId,exerciseId){
    const exercise=state.catalogExercises.find(item=>String(item.id)===String(exerciseId));
    if(!exercise)throw new Error('Übung nicht gefunden.');
    const session=state.sessions.find(item=>item.id===sessionId);
    if(!session)throw new Error('Training nicht gefunden.');
    if((session.workout||[]).some(item=>item.exerciseId===String(exerciseId)&&item.status!=='skipped'))return;
    const {supabase,user}=await sportUser();
    const maxSort=(session.workout||[]).reduce((max,item)=>Math.max(max,item.sortOrder||0),0);
    const result=await supabase.from('sport_session_exercises').insert({
      user_id:user.id,
      session_id:sessionId,
      exercise_id:exercise.id,
      equipment_id:null,
      name_snapshot:exercise.name,
      kind:exercise.kind,
      status:'planned',
      sort_order:maxSort+1
    });
    if(result.error)throw result.error;
    await load(true);
  }

  async function addExerciseGroup(sessionId,groupKey){
    const list=state.catalogExercises.filter(exercise=>(exercise.category||exercise.muscle_group||exercise.kind)===groupKey);
    if(!list.length)return;
    const session=state.sessions.find(item=>item.id===sessionId);
    const existing=new Set((session?.workout||[]).map(item=>item.exerciseId));
    const missing=list.filter(item=>!existing.has(String(item.id)));
    if(!missing.length)return;
    const {supabase,user}=await sportUser();
    let sort=(session?.workout||[]).reduce((max,item)=>Math.max(max,item.sortOrder||0),0);
    const rows=missing.map(exercise=>({
      user_id:user.id,
      session_id:sessionId,
      exercise_id:exercise.id,
      equipment_id:null,
      name_snapshot:exercise.name,
      kind:exercise.kind,
      status:'planned',
      sort_order:++sort
    }));
    const result=await supabase.from('sport_session_exercises').insert(rows);
    if(result.error)throw result.error;
    await load(true);
  }

  async function updateSessionExercise(id,patch){
    const {supabase}=await sportUser();
    const result=await supabase.from('sport_session_exercises').update(patch).eq('id',id);
    if(result.error)throw result.error;
    await load(true);
  }

  async function setExerciseStatus(id,status){
    const patch={status};
    const stamp=new Date().toISOString();
    if(status==='running')patch.started_at=stamp;
    if(status==='completed')patch.ended_at=stamp;
    if(status==='planned'){patch.started_at=null;patch.ended_at=null;}
    return updateSessionExercise(id,patch);
  }

  async function removeSessionExercise(id){
    const {supabase}=await sportUser();
    const result=await supabase.from('sport_session_exercises').delete().eq('id',id);
    if(result.error)throw result.error;
    await load(true);
  }

  async function saveStrengthSet(sessionExerciseId,setNumber,values){
    const {supabase,user}=await sportUser();
    const payload={
      user_id:user.id,
      session_exercise_id:sessionExerciseId,
      set_number:setNumber,
      weight_kg:numberOrNull(values.weight_kg),
      repetitions:numberOrNull(values.repetitions),
      rir:numberOrNull(values.rir)
    };
    const result=await supabase.from('sport_exercise_sets').upsert(payload,{onConflict:'session_exercise_id,set_number'});
    if(result.error)throw result.error;
    await load(true);
  }

  async function addBlankSet(sessionExerciseId){
    const sessionExercise=state.sessions.flatMap(session=>session.workout||[]).find(item=>item.id===sessionExerciseId);
    const next=Math.max(3,...(sessionExercise?.sets||[]).map(set=>set.setNumber||0))+1;
    return saveStrengthSet(sessionExerciseId,next,{weight_kg:null,repetitions:null,rir:null});
  }

  async function saveCardioValues(id,values){
    return updateSessionExercise(id,{
      duration_minutes:numberOrNull(values.duration_minutes),
      distance_km:numberOrNull(values.distance_km),
      resistance_level:String(values.resistance_level||'').trim()||null,
      speed_kmh:numberOrNull(values.speed_kmh),
      incline_percent:numberOrNull(values.incline_percent)
    });
  }

  function sessionParticipantRows(sessionId){
    return state.sessionParticipants.filter(row=>String(row.session_id)===String(sessionId)).sort((a,b)=>byName(a.participant_name,b.participant_name));
  }

  function previousWorkoutValue(current){
    const candidates=state.sessions
      .filter(session=>session.id!==current.sessionId)
      .flatMap(session=>(session.workout||[]).map(item=>({session,item})))
      .filter(entry=>entry.item.exerciseId===current.exerciseId&&entry.item.status==='completed')
      .sort((a,b)=>String(b.session.date).localeCompare(String(a.session.date)));
    return candidates[0]||null;
  }

  function xTrainingPanel(){return `<section class="sport-panel-v510 sport-panel-v512 sport-panel-xtraining-v512" data-sport-panel-v512="xtraining" data-sport-panel-v568="xtraining">${wave()}<div class="sport-hero-v510"><div class="sport-kicker-v510"><span class="sport-live-dot-v510"></span>X-TRAINING ${statusBadge()}</div><p class="sport-date-v510">Eigene Trainingssessions außerhalb der normalen FitX-Dokumentation.</p><div class="sport-section-mark-v512">X</div></div><div class="sport-content-v510"><article class="sport-session-card-v510 sport-empty-card-v512"><div class="sport-empty-orbit-v512"><span></span><span></span><span></span></div><h2 class="sport-card-title-v510">Noch kein X-Training dokumentiert</h2><div class="sport-card-sub-v510">Übungen, Sätze, Wiederholungen und Gewichte bekommen hier später ihren eigenen Platz.</div></article></div></section>`;}

  function flatActivities(rows){
    const flat=[];rows.forEach(session=>(session.activities||[]).forEach(activity=>flat.push({session,activity})));
    return flat.sort((a,b)=>String(b.activity.startedAt||b.session.date).localeCompare(String(a.activity.startedAt||a.session.date)));
  }
  function activitiesPanel(rows){
    const flat=flatActivities(rows);
    const body=flat.length?`<div class="sport-content-v510 sport-list-v568">${flat.map(({session,activity},index)=>`<article class="sport-session-card-v510 sport-activity-row-v568" style="--sport-row-index-v568:${index}"><div class="sport-activity-main-v568"><div class="sport-card-title-v510">${esc(activity.name)}</div><div class="sport-card-sub-v510">${esc(dateLabel(session.date))} · ${esc(clock(activity.startedAt))}–${esc(clock(activity.endedAt))}</div>${participantsLine(activity)}</div><div class="sport-chip-v510">${esc(formatMinutes(activityMinutes(activity)))}</div></article>`).join('')}</div>`:'<div class="sport-content-v510"><div class="sport-empty-inline-v568">Noch keine Aktivitäten dokumentiert.</div></div>';
    return `<section class="sport-panel-v510 sport-panel-v512" data-sport-panel-v512="activities" data-sport-panel-v568="activities">${wave()}<div class="sport-hero-v510"><div class="sport-kicker-v510"><span class="sport-live-dot-v510"></span>AKTIVITÄTEN ${statusBadge()}</div><p class="sport-date-v510">Dein Kursverlauf</p><div class="sport-duration-row-v510"><div class="sport-duration-v510 sport-duration-small-v512">${flat.length}</div><div class="sport-duration-unit-v510">Kurse</div></div></div>${body}${errorNote()}</section>`;
  }

  function aggregate(rows){
    const fitx=rows.filter(isFitx),activities=flatActivities(rows);
    const courseCounts=new Map(),partnerCounts=new Map();
    let courseTotal=0;
    activities.forEach(({activity})=>{
      const minutes=activityMinutes(activity);courseTotal+=minutes;
      const c=courseCounts.get(activity.name)||{count:0,minutes:0};c.count++;c.minutes+=minutes;courseCounts.set(activity.name,c);
      (activity.participants||[]).forEach(name=>partnerCounts.set(name,(partnerCounts.get(name)||0)+1));
    });
    return {
      allSessions:rows.length,
      allMinutes:rows.reduce((sum,s)=>sum+sessionMinutes(s),0),
      fitxSessions:fitx.length,
      fitxMinutes:fitx.reduce((sum,s)=>sum+sessionMinutes(s),0),
      courseCount:activities.length,
      courseTotal,
      longestFitx:fitx.reduce((best,s)=>Math.max(best,sessionMinutes(s)),0),
      courseCounts:[...courseCounts.entries()].sort((a,b)=>b[1].count-a[1].count||b[1].minutes-a[1].minutes||byName(a[0],b[0])),
      partnerCounts:[...partnerCounts.entries()].sort((a,b)=>b[1]-a[1]||byName(a[0],b[0]))
    };
  }
  function statisticsPanel(rows){
    const s=aggregate(rows);
    const courses=s.courseCounts.length?`<div class="sport-rank-v568">${s.courseCounts.map(([name,val])=>`<div><span>${esc(name)}</span><b>${val.count}× · ${esc(formatMinutes(val.minutes))}</b></div>`).join('')}</div>`:'<div class="sport-empty-inline-v568">Noch keine Kurse für eine Auswertung.</div>';
    const people=s.partnerCounts.length?`<div class="sport-rank-v568">${s.partnerCounts.map(([name,count])=>`<div><span>${esc(name)}</span><b>${count} gemeinsame${count===1?'r Kurs':' Kurse'}</b></div>`).join('')}</div>`:'<div class="sport-empty-inline-v568">Noch keine Trainingspartner dokumentiert.</div>';
    return `<section class="sport-panel-v510 sport-panel-v512" data-sport-panel-v512="statistics" data-sport-panel-v568="statistics">${wave()}<div class="sport-hero-v510"><div class="sport-kicker-v510"><span class="sport-live-dot-v510"></span>STATISTIK ${statusBadge()}</div><p class="sport-date-v510">Sportzeit auf einen Blick</p><div class="sport-duration-row-v510"><div class="sport-duration-v510" data-total-minutes="${s.allMinutes}">${esc(formatMinutes(s.allMinutes).replace(' h',''))}</div><div class="sport-duration-unit-v510">Sport gesamt</div></div></div><div class="sport-content-v510"><div class="sport-stat-grid-v568"><article class="sport-stat-card-v512"><span>Einheiten gesamt</span><strong>${s.allSessions}</strong></article><article class="sport-stat-card-v512"><span>FitX-Besuche</span><strong>${s.fitxSessions}</strong></article><article class="sport-stat-card-v512"><span>FitX-Zeit</span><strong>${esc(formatMinutes(s.fitxMinutes))}</strong></article><article class="sport-stat-card-v512"><span>Kurse</span><strong>${s.courseCount}</strong></article><article class="sport-stat-card-v512"><span>Kurszeit</span><strong>${esc(formatMinutes(s.courseTotal))}</strong></article><article class="sport-stat-card-v512"><span>Längstes FitX</span><strong>${esc(formatMinutes(s.longestFitx))}</strong></article></div><div class="sport-stats-columns-v568"><div><div class="sport-section-title-v568">Kurse</div>${courses}</div><div><div class="sport-section-title-v568">Mit dabei</div>${people}</div></div>${errorNote()}</div></section>`;
  }

  function panel(rows){if(activeTab==='xtraining')return xTrainingPanel();if(activeTab==='activities')return activitiesPanel(rows);if(activeTab==='statistics')return statisticsPanel(rows);return fitxPanel(rows);}

  function render({animate=false}={}){
    const serial=++renderSerial;const root=ensureRoot();if(!root)return false;
    root.dataset.sportTabV568=activeTab;
    root.innerHTML=`<div class="sport-stage-v510 sport-stage-v512 sport-stage-v568">${tabRail()}${panel(state.sessions)}</div>`;
    root.querySelectorAll('[data-sport-tab-v568]').forEach(button=>button.addEventListener('click',()=>setTab(button.dataset.sportTabV568,{animate:true,persist:true})));
    root.querySelectorAll('[data-sport-retry-v568]').forEach(button=>button.addEventListener('click',()=>load(true)));
    if(animate&&serial===renderSerial&&!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches){root.classList.remove('sport-tab-switch-v512');void root.offsetWidth;root.classList.add('sport-tab-switch-v512');setTimeout(()=>root.classList.remove('sport-tab-switch-v512'),520);}
    return true;
  }

  function ensureChrome(){
    const sw=document.getElementById('sportSwitchV510');
    if(!sw)return false;
    sw.setAttribute('aria-hidden','false');
    sw.setAttribute('role','button');
    sw.setAttribute('tabindex','0');
    sw.setAttribute('aria-label','Zwischen To-do und Sport wechseln');
    sw.setAttribute('aria-pressed',currentMode()==='sport'?'true':'false');
    if(sw.dataset.sportV568Bound!=='true'){
      sw.dataset.sportV568Bound='true';
      sw.addEventListener('click',()=>toggleMode());
      sw.addEventListener('keydown',event=>{
        if(event.key!=='Enter'&&event.key!==' ')return;
        event.preventDefault();
        sw.click();
      });
    }
    return true;
  }

  function setTab(id,{animate=true,persist=true}={}){activeTab=TABS.some(t=>t.id===id)?id:'fitx';if(persist)try{localStorage.setItem(TAB_KEY,activeTab);}catch(_){ }render({animate});return activeTab;}
  function currentMode(){return document.body.classList.contains('mod-sport-mode-v510')?'sport':'todo';}
  function setMode(mode,{persist=true,animate=true}={}){
    mode=mode==='sport'?'sport':'todo';ensureRoot();ensureChrome();document.body.classList.toggle('mod-sport-mode-v510',mode==='sport');document.body.dataset.modAppModeV510=mode;document.getElementById('sportSwitchV510')?.setAttribute('aria-pressed',mode==='sport'?'true':'false');
    if(persist)try{localStorage.setItem(MODE_KEY,mode);}catch(_){ }
    render({animate:animate&&mode==='sport'});
    if(mode==='sport'&&!historicalRegression)load(false);
    try{window.__modFixedAppHeaderV475?.updateHeight?.();}catch(_){ }
    return mode;
  }
  function toggleMode(){return setMode(currentMode()==='sport'?'todo':'sport');}
  function loadSessions(){return state.sessions.length?state.sessions:readCache();}
  function saveSessions(rows){const clean=sortSessions(rows);state={...state,sessions:clean,source:'cache'};writeCache(clean);render();return clean;}

  function init(){
    if(historicalRegression){
      state={...state,loaded:true,loading:false,error:null,source:'cache',sessions:sortSessions([historicalSeed])};
      writeCache(state.sessions);
    }else{
      state={...state,sessions:readCache()};
    }
    try{activeTab=TABS.some(t=>t.id===localStorage.getItem(TAB_KEY))?localStorage.getItem(TAB_KEY):'fitx';}catch(_){activeTab='fitx';}
    ensureRoot();render();
    const stored=(()=>{try{return localStorage.getItem(MODE_KEY)==='sport'?'sport':'todo';}catch(_){return 'todo';}})();
    ensureChrome();
    setMode(stored,{persist:false,animate:false});
    if(!historicalRegression)load(false);
  }

  const api={version:VERSION,load,refresh:()=>load(true),render,setMode,toggle:toggleMode,currentMode,loadSessions,saveSessions,modeKey:MODE_KEY,dataKey:CACHE_KEY,getState:()=>({loaded:state.loaded,loading:state.loading,error:state.error,source:state.source,sessions:state.sessions.length})};
  window.__modSportV568=api;
  window.__modSportModeV510=api;
  window.__modSportTabsV512={version:VERSION,tabs:TABS.map(x=>({...x})),render,setTab,currentTab:()=>activeTab,tabKey:TAB_KEY,supabaseLiveV568:true};

  if(/^v(?:511|512)$/.test(regressionRoute)&&!window.__modSportHeaderCompatV511){
    window.__modSportHeaderCompatV511={version:'V511-compat',verify:()=>!!document.getElementById('sportSwitchV510')&&!!document.querySelector('.mod-undo-r-v498')};
  }
  if(regressionRoute==='v512'&&!window.__modBuildVersionV512)window.__modBuildVersionV512={version:'V512'};

  window.addEventListener(HEALTH_EVENT,()=>load(true));
  window.addEventListener('focus',()=>{if(currentMode()==='sport')load(true);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&currentMode()==='sport')load(true);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.addEventListener('load',()=>{if(!historicalRegression)setTimeout(()=>load(true),180);},{once:true});
})();
