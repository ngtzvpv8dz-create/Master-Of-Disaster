/* V614 · SPORT · compact RIR + collapsed reorder controls + mobile date fix */
(function(){
  'use strict';
  if(window.__modSportV568)return;

  const VERSION='V614';
  const ROOT_ID='sportRootV510';
  const MODE_KEY='masterOfDisasterAppModeV510';
  const TAB_KEY='masterOfDisasterSportTabV568';
  const PLAN_DATE_KEY='masterOfDisasterSportPlanDateV612';
  const CACHE_KEY='masterOfDisasterSportSessionsV568Cache';
  const LEGACY_KEY='masterOfDisasterSportSessionsV510';
  const HEALTH_EVENT='mod:health-sync-request';
  const REQUEST_TIMEOUT_MS=4500;
  const TABS=[
    {id:'overview',label:'ÜBERSICHT'},
    {id:'planning',label:'PLANEN'},
    {id:'sessions',label:'EINHEITEN'},
    {id:'catalog',label:'KATALOG'},
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

  let activeTab='overview';
  let planDate='';
  let state={loaded:false,loading:false,error:null,source:'cache',sessions:[],catalogExercises:[],equipment:[],sessionParticipants:[],sessionExercises:[],exerciseSets:[]};
  let loadPromise=null;
  let renderSerial=0;
  let catalogTargetSessionId=null;
  let editingSessionId=null;
  const expandedExercises=new Set();
  const collapsedPlanDates=new Set();

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

  function sessionById(id){
    return state.sessions.find(session=>String(session.id)===String(id))||null;
  }

  function venueParts(value){
    const raw=String(value||'').trim();
    if(/^fitx$/i.test(raw))return {type:'FitX',detail:''};
    if(/^(home|zuhause)$/i.test(raw))return {type:'Home',detail:''};
    const outdoor=/^outdoor(?:\s*[·|\-]\s*(.*))?$/i.exec(raw);
    if(outdoor)return {type:'Outdoor',detail:String(outdoor[1]||'').trim()};
    if(!raw)return {type:'FitX',detail:''};
    return {type:'Outdoor',detail:raw};
  }

  function venueDisplay(value){
    const parts=venueParts(value);
    return parts.type+(parts.detail?' · '+parts.detail:'');
  }

  function planVenueForm(session){
    const parts=venueParts(session?.venue);
    const option=type=>'<label class="sport-venue-choice-v613"><input type="radio" name="venue" value="'+type+'" '+(parts.type===type?'checked':'')+'><span>'+type+'</span></label>';
    return '<form class="sport-plan-venue-v612 sport-plan-venue-v613" data-sport-plan-venue="'+esc(session.id)+'">'+
      '<div class="sport-venue-options-v613" role="radiogroup" aria-label="Trainingsort">'+option('FitX')+option('Home')+option('Outdoor')+'</div>'+
      '<label class="sport-outdoor-detail-v613 '+(parts.type==='Outdoor'?'is-visible':'')+'"><span>Outdoor · wo?</span><input name="outdoor_detail" value="'+esc(parts.detail)+'" maxlength="60" placeholder="z. B. Deich, Wald, Park"></label>'+
      '<button type="submit">Ort übernehmen</button>'+
    '</form>';
  }

  function normalizeCardioPhases(exercise){
    const raw=Array.isArray(exercise?.metricValues?.phases)?exercise.metricValues.phases:[];
    return raw.map((phase,index)=>({
      order:index+1,
      duration_minutes:numberOrNull(phase?.duration_minutes),
      resistance_level:phase?.resistance_level===null||phase?.resistance_level===undefined?'':String(phase.resistance_level),
      speed_kmh:numberOrNull(phase?.speed_kmh),
      incline_percent:numberOrNull(phase?.incline_percent)
    }));
  }

  function cardioConfigFor(exercise){
    const catalog=state.catalogExercises.find(item=>String(item.id)===String(exercise?.exerciseId));
    return (catalog?.metric_config&&typeof catalog.metric_config==='object')
      ?catalog.metric_config
      :{duration_minutes:true,distance_km:true,resistance_level:true,calories_kcal:true};
  }

  function cardioPhaseFields(exercise){
    const config=cardioConfigFor(exercise);
    const fields=['duration_minutes'];
    if(config.resistance_level)fields.push('resistance_level');
    if(config.speed_kmh)fields.push('speed_kmh');
    if(config.incline_percent)fields.push('incline_percent');
    return fields;
  }

  function cardioPhaseInput(key,phase){
    const value=phase?.[key]??'';
    const map={
      duration_minutes:['Min.','number','0.1','decimal'],
      resistance_level:['Stufe','text','','decimal'],
      speed_kmh:['km/h','number','0.1','decimal'],
      incline_percent:['Steigung %','number','0.1','decimal']
    };
    const meta=map[key]||[key,'text','',''];
    const attrs=meta[1]==='number'?' type="number" min="0" step="'+meta[2]+'" inputmode="'+meta[3]+'"':' inputmode="'+meta[3]+'"';
    return '<label><span>'+esc(meta[0])+'</span><input data-phase-key="'+esc(key)+'"'+attrs+' value="'+esc(value)+'"></label>';
  }

  function cardioPhaseRow(phase,index,fields){
    return '<div class="sport-cardio-phase-v613" data-cardio-phase-row>'+
      '<div class="sport-cardio-phase-title-v613"><strong>Phase '+(index+1)+'</strong><div>'+
        '<button type="button" data-sport-phase-action="up" aria-label="Phase nach oben">↑</button>'+
        '<button type="button" data-sport-phase-action="down" aria-label="Phase nach unten">↓</button>'+
        '<button type="button" data-sport-phase-action="duplicate" aria-label="Phase duplizieren">⧉</button>'+
        '<button type="button" class="danger" data-sport-phase-action="delete" aria-label="Phase löschen">×</button>'+
      '</div></div>'+
      '<div class="sport-cardio-phase-fields-v613">'+fields.map(key=>cardioPhaseInput(key,phase)).join('')+'</div>'+
    '</div>';
  }

  function renumberCardioPhaseRows(form){
    form.querySelectorAll('[data-cardio-phase-row]').forEach((row,index)=>{
      const title=row.querySelector('.sport-cardio-phase-title-v613 strong');
      if(title)title.textContent='Phase '+(index+1);
    });
  }

  function collectCardioPhases(form){
    return [...form.querySelectorAll('[data-cardio-phase-row]')].map(row=>{
      const phase={};
      row.querySelectorAll('[data-phase-key]').forEach(input=>{
        const key=input.dataset.phaseKey;
        const raw=String(input.value||'').trim();
        if(key==='resistance_level')phase[key]=raw;
        else phase[key]=numberOrNull(raw);
      });
      return phase;
    }).filter(phase=>phase.duration_minutes!==null||phase.resistance_level||phase.speed_kmh!==null||phase.incline_percent!==null);
  }

  function rirStepper(value){
    const sequence=['0','1','2','3','4','5','5+'];
    const clean=sequence.includes(String(value||''))?String(value):'0';
    const index=sequence.indexOf(clean);
    return '<div class="sport-rir-stepper-v613 sport-rir-stepper-v614" data-sport-rir-stepper>'+
      '<button type="button" data-sport-rir-step="down" '+(index<=0?'disabled':'')+' aria-label="RIR verringern">−</button>'+
      '<output data-sport-rir-output>'+esc(clean)+'</output>'+
      '<input type="hidden" name="rir" value="'+esc(clean)+'">'+
      '<button type="button" data-sport-rir-step="up" '+(index>=sequence.length-1?'disabled':'')+' aria-label="RIR erhöhen">+</button>'+
    '</div>';
  }

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
      name:String(row.name_snapshot||row.name||'Trainingselement'),
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
      caloriesKcal:numberOrNull(row.calories_kcal??row.caloriesKcal),
      equipmentNumber:row.equipment_number_snapshot??row.equipmentNumber??null,
      settingsText:row.settings_snapshot??row.settingsText??null,
      loadMode:row.load_mode_snapshot??row.loadMode??null,
      metricValues:row.metric_values||row.metricValues||{},
      sets:(row.sets||[]).map(set=>({
        id:String(set.id||''),
        setNumber:Number(set.set_number??set.setNumber??0),
        weightKg:numberOrNull(set.weight_kg??set.weightKg),
        repetitions:numberOrNull(set.repetitions),
        rir:numberOrNull(set.rir),
        rirPlus:Boolean(set.rir_plus??set.rirPlus??false)
      })).sort((a,b)=>a.setNumber-b.setNumber)
    };
  }

  function normalizeSession(row){
    if(!row||typeof row!=='object'||!row.id)return null;
    const activities=(Array.isArray(row.activities)?row.activities:Array.isArray(row.sport_activities)?row.sport_activities:[]).map(normalizeActivity).filter(Boolean).sort((a,b)=>a.sortOrder-b.sortOrder||String(a.startedAt||'').localeCompare(String(b.startedAt||'')));
    const workout=(row.workout||[]).map(normalizeWorkoutExercise).filter(Boolean).sort((a,b)=>a.sortOrder-b.sortOrder);
    const title=String(row.title||'Sport');
    const rawVenue=row.venue||null;
    const kind=String(row.session_kind||row.sessionKind||'legacy');
    const status=String(row.session_status||row.sessionStatus||'completed');
    const legacyAutoFitx=kind==='xtraining'&&status==='planned'&&title==='Freies Training'&&String(rawVenue||'').toLowerCase()==='fitx'&&!row.started_at&&!row.drive_started_at&&!row.training_started_at;
    const venue=legacyAutoFitx?null:rawVenue;
    return {
      id:String(row.id),
      area:kind==='xtraining'?'xtraining':((title.toLowerCase()==='fitx'||String(venue||'').toLowerCase()==='fitx')?'fitx':'sport'),
      kind,
      status,
      date:row.session_date||row.date||'',
      title:legacyAutoFitx?'Training':title,
      venue,
      legacyAutoFitx,
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
      supabase.from('sport_exercise_catalog').select('id,name,kind,item_type,equipment_number,category,muscle_group,settings_text,load_mode,metric_config,active,sort_order').eq('user_id',user.id).eq('active',true).order('sort_order').order('name'),
      supabase.from('sport_equipment_catalog').select('id,name,equipment_number,category,settings_text,active,sort_order').eq('user_id',user.id).eq('active',true).order('sort_order').order('name'),
      supabase.from('sport_session_exercises').select('id,session_id,exercise_id,equipment_id,name_snapshot,kind,status,sort_order,started_at,ended_at,duration_minutes,distance_km,resistance_level,speed_kmh,incline_percent,equipment_number_snapshot,settings_snapshot,load_mode_snapshot,calories_kcal,metric_values,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(5000),
      supabase.from('sport_exercise_sets').select('id,session_exercise_id,set_number,weight_kg,repetitions,rir,rir_plus').eq('user_id',user.id).order('set_number').limit(15000)
    ];
    const labels=['Sporttermine','Sportaktivitäten','Kurs-Teilnehmer','Trainingspartner','Übungskatalog','Gerätekatalog','Trainingselemente','Sätze'];
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

  function groupSessions(rows){
    const groups=new Map();
    (Array.isArray(rows)?rows:[]).forEach(session=>{
      const venue=String(session.venue||((isFitx(session))?'FitX':session.title||'Sport')).trim()||'Sport';
      const key=String(session.date||'')+'|'+venue.toLowerCase();
      if(!groups.has(key))groups.set(key,{date:session.date,venue,sessions:[]});
      groups.get(key).sessions.push(session);
    });
    return [...groups.values()];
  }
  function groupActivities(group){return (group?.sessions||[]).flatMap(session=>session.activities||[]);}
  function groupWorkout(group){return (group?.sessions||[]).flatMap(session=>session.workout||[]).filter(item=>item.status!=='skipped');}
  function groupParticipants(group){
    const names=new Set();
    (group?.sessions||[]).forEach(session=>{
      (session.participants||[]).forEach(name=>names.add(String(name)));
      (session.activities||[]).forEach(activity=>(activity.participants||[]).forEach(name=>names.add(String(name))));
    });
    return [...names].filter(Boolean).sort(byName);
  }
  function groupDuration(group){
    const sessions=group?.sessions||[];
    const starts=sessions.map(session=>validDate(session.startedAt)).filter(Boolean).sort((a,b)=>a-b);
    const ends=sessions.map(session=>validDate(session.endedAt)).filter(Boolean).sort((a,b)=>a-b);
    if(starts.length&&ends.length&&ends[ends.length-1]>=starts[0])return Math.max(0,Math.round((ends[ends.length-1]-starts[0])/60000));
    return sessions.reduce((best,session)=>Math.max(best,sessionMinutes(session)),0);
  }
  function groupTimeWindow(group){
    const sessions=group?.sessions||[];
    const starts=sessions.map(session=>validDate(session.startedAt)).filter(Boolean).sort((a,b)=>a-b);
    const ends=sessions.map(session=>validDate(session.endedAt)).filter(Boolean).sort((a,b)=>a-b);
    return starts.length&&ends.length?clock(starts[0])+'–'+clock(ends[ends.length-1]):'Zeit nicht vollständig dokumentiert';
  }
  function groupSummary(group){
    const activities=groupActivities(group),workout=groupWorkout(group),people=groupParticipants(group);
    const cardio=workout.filter(item=>item.kind==='cardio').length;
    const parts=[];
    if(activities.length){
      let coursePart=activities.length+' '+(activities.length===1?'Kurs':'Kurse');
      if(people.length)coursePart+=' · '+people.join(', ');
      parts.push(coursePart);
    }else if(people.length){
      parts.push(people.join(', '));
    }
    if(workout.length)parts.push(workout.length+' Trainingselement'+(workout.length===1?'':'e'));
    if(cardio)parts.push(cardio+' Cardio');
    return parts.join(' · ')||'Einheit ohne Detailangaben';
  }

  function courseCard(activity,index=0){
    const people=activity.participants?.length?' · '+activity.participants.join(', '):'';
    return `<article class="sport-course-card-v568 sport-course-card-compact-v610" style="--sport-course-index-v568:${index}"><div class="sport-course-top-v568"><div><h3>${esc(activity.name)}</h3><div class="sport-card-sub-v510">${esc(clock(activity.startedAt))}–${esc(clock(activity.endedAt)+people)}</div></div><span class="sport-chip-v510">${esc(formatMinutes(activityMinutes(activity)))}</span></div></article>`;
  }

  function unitCard(group,index=0){
    const courses=groupActivities(group),workout=groupWorkout(group);
    const targetSession=(group.sessions||[]).find(session=>session.kind==='xtraining'&&(session.workout||[]).length)||(group.sessions||[]).find(session=>session.kind==='xtraining')||null;
    const editing=targetSession&&String(editingSessionId||'')===String(targetSession.id);
    const parts=venueParts(group.venue||targetSession?.venue);
    return '<details class="sport-history-detail-v574 sport-unit-detail-v610 '+(editing?'is-editing-v613':'')+'" style="--sport-row-index-v568:'+index+'" '+(editing?'open':'')+'>'+
      '<summary><strong>'+esc(shortDate(group.date))+'</strong><span class="sport-unit-location-v613"><em>'+esc(parts.type)+'</em>'+(parts.detail?'<small>'+esc(parts.detail)+'</small>':'')+'<i> · '+esc(groupSummary(group))+'</i></span><b>'+esc(formatMinutes(groupDuration(group)))+'</b></summary>'+
      '<div class="sport-unit-body-v610">'+
        (courses.length?'<div class="sport-section-title-v568">Kurse</div><div class="sport-course-list-v568">'+courses.map(courseCard).join('')+'</div>':'')+
        (targetSession?'<div class="sport-history-edit-toolbar-v613">'+
          (editing?'<button type="button" data-sport-open-catalog data-session-id="'+esc(targetSession.id)+'">+ Übung aus Katalog</button><button type="button" data-sport-stop-edit-session>Bearbeitung schließen</button>':'<button type="button" data-sport-edit-session="'+esc(targetSession.id)+'">Training bearbeiten</button>')+
        '</div>':'')+
        (workout.length?(editing?'<div class="sport-workout-list-v573 sport-history-edit-list-v613">'+(targetSession.workout||[]).map(workoutExerciseCard).join('')+'</div>':'<div class="sport-section-title-v568">Freies Training</div><div class="sport-history-workout-v574">'+workout.map(workoutSummaryCard).join('')+'</div>'):'')+
      '</div></details>';
  }

  function completedSessions(rows){return (Array.isArray(rows)?rows:[]).filter(session=>session.status==='completed');}
  function unitHistory(rows){
    const groups=groupSessions(completedSessions(rows));
    return groups.length?'<div class="sport-unit-list-v610">'+groups.map(unitCard).join('')+'</div>':'<div class="sport-empty-inline-v568">Noch keine abgeschlossenen Trainingseinheiten dokumentiert.</div>';
  }
  function isSessionActive(session){
    if(!session||session.status==='completed'||session.status==='cancelled')return false;
    return session.status==='running'||Boolean(session.driveStartedAt||session.gymArrivedAt||session.trainingStartedAt||session.trainingEndedAt||session.gymLeftAt)||(session.workout||[]).some(item=>item.status==='running'||item.status==='completed');
  }
  function activeTrainingSession(){
    return state.sessions.find(session=>session.kind==='xtraining'&&session.date===todayIso()&&isSessionActive(session))||null;
  }
  function planSessionForDate(dateKey){
    return state.sessions.find(session=>session.kind==='xtraining'&&session.date===dateKey&&session.status!=='completed'&&session.status!=='cancelled')||null;
  }
  function currentGroupFor(session,rows){
    if(!session)return null;
    return groupSessions(rows).find(group=>(group.sessions||[]).some(item=>item.id===session.id))||{date:session.date,venue:session.venue||'Ort offen',sessions:[session]};
  }
  function workoutLists(session){
    const items=(session?.workout||[]);
    const open=items.filter(item=>item.status==='planned'||item.status==='running');
    const done=items.filter(item=>item.status==='completed');
    const skipped=items.filter(item=>item.status==='skipped');
    const showOpenTitle=done.length||skipped.length;
    return '<div class="sport-workout-sections-v612">'+
      (showOpenTitle?'<div class="sport-section-title-v568">Noch offen · '+open.length+'</div>':'')+
      (open.length?'<div class="sport-workout-list-v573">'+open.map(workoutExerciseCard).join('')+'</div>':'<div class="sport-empty-inline-v568">Keine offenen Übungen mehr. Sehr verdächtig produktiv.</div>')+
      (done.length?'<div class="sport-section-title-v568">Erledigt · '+done.length+'</div><div class="sport-done-list-v612">'+done.map(completedWorkoutCard).join('')+'</div>':'')+
      (skipped.length?'<details class="sport-skipped-v612"><summary>Übersprungen · '+skipped.length+'</summary><div class="sport-done-list-v612">'+skipped.map(skippedWorkoutCard).join('')+'</div></details>':'')+
    '</div>';
  }

  function fitxPanel(rows){
    const active=activeTrainingSession();
    if(active){
      const current=currentGroupFor(active,rows);
      const courses=groupActivities(current);
      const people=groupParticipants(current);
      const location=active.venue||'Ort offen';
      return `<section class="sport-panel-v510 sport-panel-v512" data-sport-panel-v568="overview">${wave()}<div class="sport-hero-v510"><div class="sport-kicker-v510"><span class="sport-live-dot-v510"></span>ÜBERSICHT · AKTUELLE EINHEIT ${statusBadge()}</div><p class="sport-date-v510">${esc(dateLabel(active.date))} · ${esc(location)}</p><div class="sport-duration-row-v510"><div class="sport-duration-v510 sport-duration-small-v512">${(active.workout||[]).filter(item=>item.status==='completed').length}/${(active.workout||[]).filter(item=>item.status!=='skipped').length}</div><div class="sport-duration-unit-v510">Übungen erledigt</div></div></div><div class="sport-content-v510">${timelineBlock(active)}${participantsBlock(active)}${courses.length?`<div class="sport-section-title-v568">Kurse${people.length?' · '+people.map(esc).join(', '):''}</div><div class="sport-course-list-v568">${courses.map(courseCard).join('')}</div>`:''}<section class="sport-x-block-v573"><div class="sport-x-block-head-v573"><div><span>AKTUELLE EINHEIT</span><strong>Übungen</strong></div><button type="button" data-sport-open-catalog data-session-id="${esc(active.id)}">Katalog öffnen</button></div>${workoutLists(active)}</section>${errorNote()}</div></section>`;
    }

    const latest=groupSessions(completedSessions(rows))[0]||null;
    const todayPlan=planSessionForDate(todayIso());
    if(!latest){
      return `<section class="sport-panel-v510 sport-panel-v512">${wave()}<div class="sport-hero-v510"><div class="sport-kicker-v510"><span class="sport-live-dot-v510"></span>ÜBERSICHT ${statusBadge()}</div><p class="sport-date-v510">${state.loading?'Sportdaten werden geladen …':'Noch keine abgeschlossene Trainingseinheit gespeichert.'}</p></div><div class="sport-content-v510">${todayPlan?`<div class="sport-plan-teaser-v612"><strong>Für heute geplant</strong><span>${(todayPlan.workout||[]).filter(item=>item.status!=='skipped').length} Trainingselemente · ${esc(todayPlan.venue||'Ort offen')}</span><button type="button" data-sport-open-plan>Plan öffnen</button></div>`:''}${errorNote()}</div></section>`;
    }
    const courses=groupActivities(latest),workout=groupWorkout(latest);
    return `<section class="sport-panel-v510 sport-panel-v512" data-sport-panel-v568="overview">${wave()}<div class="sport-hero-v510"><div class="sport-kicker-v510"><span class="sport-live-dot-v510"></span>ÜBERSICHT · LETZTE ABGESCHLOSSENE EINHEIT ${statusBadge()}</div><p class="sport-date-v510">${esc(dateLabel(latest.date))} · ${esc(latest.venue||'Ort offen')}</p><div class="sport-duration-row-v510"><div class="sport-duration-v510" data-total-minutes="${groupDuration(latest)}">${esc(formatMinutes(groupDuration(latest)).replace(' h',''))}</div><div class="sport-duration-unit-v510">Gesamtaufwand</div></div><div class="sport-time-window-v510">${esc(groupTimeWindow(latest))}</div></div><div class="sport-content-v510"><div class="sport-meta-grid-v568"><div class="sport-meta-v510"><div class="sport-meta-label-v510">Kurse</div><div class="sport-meta-value-v510">${courses.length}</div></div><div class="sport-meta-v510"><div class="sport-meta-label-v510">Freies Training</div><div class="sport-meta-value-v510">${workout.length?'Ja':'–'}</div></div><div class="sport-meta-v510"><div class="sport-meta-label-v510">Trainingselemente</div><div class="sport-meta-value-v510">${workout.length}</div></div></div>${todayPlan?`<div class="sport-plan-teaser-v612"><strong>Für heute geplant</strong><span>${(todayPlan.workout||[]).filter(item=>item.status!=='skipped').length} Trainingselemente · ${esc(todayPlan.venue||'Ort offen')}</span><button type="button" data-sport-open-plan>Plan öffnen</button></div>`:''}${courses.length?`<div class="sport-section-title-v568">Kurse</div><div class="sport-course-list-v568">${courses.map(courseCard).join('')}</div>`:''}${workout.length?`<div class="sport-section-title-v568">Freies Training</div><div class="sport-history-workout-v574">${workout.map(workoutSummaryCard).join('')}</div>`:''}${errorNote()}<div class="sport-mode-hint-v510">Abgeschlossene Trainingstage findest du unter „Einheiten“.</div></div></section>`;
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

  async function updateSportSession(sessionId,patch){
    const {supabase}=await sportUser();
    const result=await supabase.from('sport_sessions').update(patch).eq('id',sessionId);
    if(result.error)throw result.error;
    await load(true);
  }

  async function createPlanSession(dateKey=planDate||todayIso()){
    const cleanDate=/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey||''))?String(dateKey):todayIso();
    const existing=planSessionForDate(cleanDate);
    if(existing){
      if(existing.legacyAutoFitx){
        await updateSportSession(existing.id,{title:'Training',venue:'FitX'});
        return planSessionForDate(cleanDate);
      }
      return existing;
    }
    const {supabase,user}=await sportUser();
    const result=await supabase.from('sport_sessions').insert({
      user_id:user.id,
      session_date:cleanDate,
      title:'Training',
      venue:'FitX',
      session_kind:'xtraining',
      session_status:'planned',
      source:'manual'
    }).select('id').single();
    if(result.error)throw result.error;
    await load(true);
    return state.sessions.find(session=>session.id===result.data.id)||null;
  }

  async function savePlanVenue(sessionId,venue,outdoorDetail=''){
    const allowed=new Set(['FitX','Home','Outdoor']);
    const type=allowed.has(String(venue||''))?String(venue):'FitX';
    const detail=String(outdoorDetail||'').trim().slice(0,60);
    const clean=type==='Outdoor'?(detail?'Outdoor · '+detail:'Outdoor'):type;
    return updateSportSession(sessionId,{title:'Training',venue:clean});
  }

  async function startPlanSession(sessionId){
    const session=state.sessions.find(item=>item.id===sessionId);
    const patch={session_status:'running'};
    if(session?.legacyAutoFitx){
      patch.title='Training';
      patch.venue=null;
    }
    return updateSportSession(sessionId,patch);
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
      const start=validDate(session?.driveStartedAt||session?.startedAt||session?.trainingStartedAt);
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
    if(!name)throw new Error('Bezeichnung fehlt.');
    const itemType=['strength_machine','cardio_machine','free_exercise','outdoor_activity'].includes(payload.item_type)?payload.item_type:'free_exercise';
    const kind=(itemType==='cardio_machine'||itemType==='outdoor_activity')?'cardio':'strength';
    const equipmentNumber=String(payload.equipment_number||'').trim()||null;
    const settingsText=String(payload.settings_text||'').trim()||null;
    const category=String(payload.category||'').trim()||((kind==='cardio')?'Cardio':'Kraft');
    const muscleGroup=String(payload.muscle_group||'').trim()||null;
    const requestedLoad=String(payload.load_mode||'').trim();
    const loadMode=itemType==='strength_machine'
      ?(requestedLoad==='assistance'?'assistance':'weight')
      :'none';
    const lower=name.toLowerCase();
    let metricConfig={};
    if(itemType==='outdoor_activity'){
      metricConfig={duration_minutes:true,distance_km:true,speed_kmh:true,calories_kcal:true};
    }else if(itemType==='cardio_machine'){
      if(lower.includes('laufband'))metricConfig={duration_minutes:true,distance_km:true,speed_kmh:true,incline_percent:true,calories_kcal:true};
      else if(lower.includes('stepper')||lower.includes('stair'))metricConfig={duration_minutes:true,resistance_level:true,calories_kcal:true};
      else metricConfig={duration_minutes:true,resistance_level:true,distance_km:true,calories_kcal:true};
    }
    const duplicate=state.catalogExercises.find(item=>
      String(item.name||'').trim().toLowerCase()===name.toLowerCase() &&
      String(item.equipment_number||'')===String(equipmentNumber||'')
    );
    if(duplicate)throw new Error('Dieses Trainingselement ist bereits im Katalog.');
    const result=await supabase.from('sport_exercise_catalog').insert({
      user_id:user.id,name,kind,item_type:itemType,equipment_number:equipmentNumber,
      category,muscle_group:muscleGroup,settings_text:settingsText,load_mode:loadMode,
      metric_config:metricConfig,active:true
    });
    if(result.error)throw result.error;
    await load(true);
  }

  async function addEquipment(payload){
    return addCatalogExercise({
      ...payload,
      item_type:String(payload.category||'').toLowerCase()==='cardio'?'cardio_machine':'strength_machine'
    });
  }

  async function addExerciseToSession(sessionId,exerciseId){
    const exercise=state.catalogExercises.find(item=>String(item.id)===String(exerciseId));
    if(!exercise)throw new Error('Übung nicht gefunden.');
    const session=state.sessions.find(item=>item.id===sessionId);
    if(!session)throw new Error('Training nicht gefunden.');
    if((session.workout||[]).some(item=>item.exerciseId===String(exerciseId)&&item.status!=='skipped'))return;
    const {supabase,user}=await sportUser();
    const maxSort=(session.workout||[]).reduce((max,item)=>Math.max(max,item.sortOrder||0),0);
    const completed=session.status==='completed';
    const stamp=completed?new Date().toISOString():null;
    const result=await supabase.from('sport_session_exercises').insert({
      user_id:user.id,
      session_id:sessionId,
      exercise_id:exercise.id,
      equipment_id:null,
      name_snapshot:exercise.name,
      kind:exercise.kind,
      status:completed?'completed':'planned',
      sort_order:maxSort+1,
      ended_at:stamp,
      equipment_number_snapshot:exercise.equipment_number||null,
      settings_snapshot:exercise.settings_text||null,
      load_mode_snapshot:exercise.load_mode||'none'
    });
    if(result.error)throw result.error;
    await load(true);
  }

  async function addExerciseGroup(sessionId,groupKey){
    const list=state.catalogExercises.filter(exercise=>(exercise.category||exercise.muscle_group||exercise.kind)===groupKey);
    if(!list.length)return;
    const session=state.sessions.find(item=>item.id===sessionId);
    if(!session)throw new Error('Training nicht gefunden.');
    const existing=new Set((session.workout||[]).filter(item=>item.status!=='skipped').map(item=>item.exerciseId));
    const missing=list.filter(item=>!existing.has(String(item.id)));
    if(!missing.length)return;
    const {supabase,user}=await sportUser();
    let sort=(session.workout||[]).reduce((max,item)=>Math.max(max,item.sortOrder||0),0);
    const completed=session.status==='completed';
    const stamp=completed?new Date().toISOString():null;
    const rows=missing.map(exercise=>({
      user_id:user.id,
      session_id:sessionId,
      exercise_id:exercise.id,
      equipment_id:null,
      name_snapshot:exercise.name,
      kind:exercise.kind,
      status:completed?'completed':'planned',
      sort_order:++sort,
      ended_at:stamp,
      equipment_number_snapshot:exercise.equipment_number||null,
      settings_snapshot:exercise.settings_text||null,
      load_mode_snapshot:exercise.load_mode||'none'
    }));
    const result=await supabase.from('sport_session_exercises').insert(rows);
    if(result.error)throw result.error;
    await load(true);
  }

  async function addExerciseToPlan(dateKey,exerciseId){
    const session=await createPlanSession(dateKey);
    if(!session)throw new Error('Plan konnte nicht angelegt werden.');
    return addExerciseToSession(session.id,exerciseId);
  }
  async function addGroupToPlan(dateKey,groupKey){
    const session=await createPlanSession(dateKey);
    if(!session)throw new Error('Plan konnte nicht angelegt werden.');
    return addExerciseGroup(session.id,groupKey);
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

  async function moveSessionExercise(id,direction){
    const exercise=state.sessions.flatMap(session=>session.workout||[]).find(item=>item.id===id);
    if(!exercise)return;
    const session=sessionById(exercise.sessionId);
    const list=[...(session?.workout||[])].sort((a,b)=>a.sortOrder-b.sortOrder);
    const index=list.findIndex(item=>item.id===id);
    const targetIndex=direction==='up'?index-1:index+1;
    if(index<0||targetIndex<0||targetIndex>=list.length)return;
    const other=list[targetIndex];
    const {supabase}=await sportUser();
    let result=await supabase.from('sport_session_exercises').update({sort_order:other.sortOrder}).eq('id',exercise.id);
    if(result.error)throw result.error;
    result=await supabase.from('sport_session_exercises').update({sort_order:exercise.sortOrder}).eq('id',other.id);
    if(result.error)throw result.error;
    expandedExercises.add(exercise.id);
    await load(true);
  }

  async function saveStrengthSet(sessionExerciseId,setNumber,values){
    const {supabase,user}=await sportUser();
    const rawRir=String(values.rir??'').trim();
    const rirPlus=/\+$/.test(rawRir);
    const rirValue=numberOrNull(rawRir.replace(/\+$/,''));
    if(rirValue!==null&&(rirValue<0||rirValue>10))throw new Error('RIR muss zwischen 0 und 10 liegen.');
    const payload={
      user_id:user.id,
      session_exercise_id:sessionExerciseId,
      set_number:setNumber,
      weight_kg:numberOrNull(values.weight_kg),
      repetitions:numberOrNull(values.repetitions),
      rir:rirValue,
      rir_plus:rirPlus&&rirValue!==null
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
    const current=state.sessions.flatMap(session=>session.workout||[]).find(item=>item.id===id);
    const metricValues={...(current?.metricValues||{})};
    for(const key of ['duration_minutes','distance_km','resistance_level','speed_kmh','incline_percent','calories_kcal']){
      const raw=values[key];
      if(raw!==null&&raw!==undefined&&String(raw).trim()!=='')metricValues[key]=key==='resistance_level'?String(raw).trim():numberOrNull(raw);
      else delete metricValues[key];
    }
    const phases=Array.isArray(values.phases)?values.phases.map(phase=>({
      duration_minutes:numberOrNull(phase.duration_minutes),
      resistance_level:String(phase.resistance_level||'').trim()||null,
      speed_kmh:numberOrNull(phase.speed_kmh),
      incline_percent:numberOrNull(phase.incline_percent)
    })).filter(phase=>phase.duration_minutes!==null||phase.resistance_level!==null||phase.speed_kmh!==null||phase.incline_percent!==null):[];
    metricValues.phases=phases;
    const phaseMinutes=phases.reduce((sum,phase)=>sum+(Number(phase.duration_minutes)||0),0);
    const explicitDuration=numberOrNull(values.duration_minutes);
    return updateSessionExercise(id,{
      duration_minutes:explicitDuration!==null?explicitDuration:(phases.length?phaseMinutes:null),
      distance_km:numberOrNull(values.distance_km),
      resistance_level:String(values.resistance_level||'').trim()||null,
      speed_kmh:numberOrNull(values.speed_kmh),
      incline_percent:numberOrNull(values.incline_percent),
      calories_kcal:numberOrNull(values.calories_kcal),
      metric_values:metricValues
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

  function equipmentOptions(selected){
    return '<option value="">Kein Gerät gewählt</option>'+state.equipment.map(item=>{
      const label=item.name+(item.equipment_number?' · '+item.equipment_number:'');
      return '<option value="'+esc(item.id)+'" '+(String(selected||'')===String(item.id)?'selected':'')+'>'+esc(label)+'</option>';
    }).join('');
  }

  function workoutHistory(current){
    const previous=previousWorkoutValue(current);
    if(!previous)return current.kind==='cardio'?'<div class="sport-last-v573 is-empty">Noch keine früheren Werte.</div>':'';
    const item=previous.item;
    if(current.kind!=='cardio')return '';
    const bits=[
      item.durationMinutes!==null?formatMinutes(item.durationMinutes):null,
      item.distanceKm!==null?item.distanceKm+' km':null,
      item.resistanceLevel?'Stufe '+item.resistanceLevel:null,
      item.speedKmh!==null?item.speedKmh+' km/h':null,
      item.inclinePercent!==null?item.inclinePercent+' % Steigung':null,
      item.caloriesKcal!==null?item.caloriesKcal+' kcal':null
    ].filter(Boolean);
    return '<div class="sport-last-v573"><span>Letztes Mal · '+esc(shortDate(previous.session.date))+'</span><b>'+esc(bits.join(' · ')||'keine Werte')+'</b></div>';
  }

  function previousSetText(previous,setNumber,loadMode){
    const set=(previous?.item?.sets||[]).find(item=>item.setNumber===setNumber);
    if(!set)return 'Letztes Mal: keine Werte für diesen Satz';
    const parts=[];
    if(set.weightKg!==null)parts.push((loadMode==='assistance'?'Unterstützung ':'')+set.weightKg+' kg');
    if(set.repetitions!==null)parts.push(set.repetitions+' Wdh.');
    if(set.rir!==null)parts.push('RIR '+set.rir+(set.rirPlus?'+':''));
    return 'Letztes Mal: '+(parts.join(' · ')||'keine Werte');
  }
  function strengthEditor(exercise){
    const setMap=new Map((exercise.sets||[]).map(set=>[set.setNumber,set]));
    const count=Math.max(3,...[...(exercise.sets||[])].map(set=>set.setNumber||0));
    const catalog=state.catalogExercises.find(item=>String(item.id)===String(exercise.exerciseId));
    const loadMode=exercise.loadMode||catalog?.load_mode||'weight';
    const kgLabel=loadMode==='assistance'?'Unterstützung kg':'kg';
    const previous=previousWorkoutValue(exercise);
    const rows=Array.from({length:count},(_,index)=>{
      const no=index+1,set=setMap.get(no)||{};
      const rirValue=set.rir===null||set.rir===undefined?'0':String(set.rir)+(set.rirPlus?'+':'');
      return '<form class="sport-set-row-v573 sport-set-row-v613" data-sport-set-form data-exercise-id="'+esc(exercise.id)+'" data-set-number="'+no+'">'+
        '<strong>S'+no+'</strong>'+
        '<label><span>'+esc(kgLabel)+'</span><input name="weight_kg" type="number" min="0" step="0.5" inputmode="decimal" value="'+esc(set.weightKg??'')+'"></label>'+
        '<label><span>Wdh.</span><input name="repetitions" type="number" min="0" step="1" inputmode="numeric" value="'+esc(set.repetitions??'')+'"></label>'+
        '<label><span>RIR</span>'+rirStepper(rirValue)+'</label>'+
        '<small class="sport-set-last-v612 sport-set-last-v613">'+esc(previousSetText(previous,no,loadMode))+'</small>'+
        '<button type="submit" class="sport-set-save-v613">Satz speichern</button>'+
      '</form>';
    }).join('');
    return '<div class="sport-strength-editor-v573">'+rows+'<button type="button" class="sport-ghost-button-v573" data-sport-add-set="'+esc(exercise.id)+'">+ Satz</button></div>';
  }

  function cardioEditor(exercise){
    const config=cardioConfigFor(exercise);
    const field=(key,label,input)=>config[key]?'<label><span>'+esc(label)+'</span>'+input+'</label>':'';
    const fields=cardioPhaseFields(exercise);
    const phases=normalizeCardioPhases(exercise);
    return '<form class="sport-cardio-form-v573 sport-cardio-form-v613" data-sport-cardio-form="'+esc(exercise.id)+'" data-phase-fields="'+esc(fields.join(','))+'">'+
      '<div class="sport-cardio-total-title-v613"><strong>Gesamtwerte</strong><small>optional · Dauer wird sonst aus den Phasen summiert</small></div>'+
      '<div class="sport-cardio-totals-v613">'+
        field('duration_minutes','Dauer gesamt min','<input name="duration_minutes" type="number" min="0" step="0.1" inputmode="decimal" value="'+esc(exercise.durationMinutes??'')+'">')+
        field('distance_km','Strecke gesamt km','<input name="distance_km" type="number" min="0" step="0.01" inputmode="decimal" value="'+esc(exercise.distanceKm??'')+'">')+
        field('resistance_level','Stufe / Ø optional','<input name="resistance_level" value="'+esc(exercise.resistanceLevel||'')+'">')+
        field('speed_kmh','km/h / Ø optional','<input name="speed_kmh" type="number" min="0" step="0.1" inputmode="decimal" value="'+esc(exercise.speedKmh??'')+'">')+
        field('incline_percent','Steigung / Ø %','<input name="incline_percent" type="number" min="0" step="0.1" inputmode="decimal" value="'+esc(exercise.inclinePercent??'')+'">')+
        field('calories_kcal','kcal gesamt','<input name="calories_kcal" type="number" min="0" step="1" inputmode="numeric" value="'+esc(exercise.caloriesKcal??'')+'">')+
      '</div>'+
      '<div class="sport-cardio-phase-head-v613"><div><strong>Phasen</strong><small>Warm-up, Intervalle, Endspurt …</small></div><button type="button" data-sport-add-phase>+ Phase</button></div>'+
      '<div class="sport-cardio-phases-v613">'+phases.map((phase,index)=>cardioPhaseRow(phase,index,fields)).join('')+'</div>'+
      '<button type="submit" class="sport-cardio-save-v613">Cardio speichern</button>'+
    '</form>';
  }

  function itemTypeLabel(type){
    return ({strength_machine:'KRAFTGERÄT',cardio_machine:'CARDIOGERÄT',free_exercise:'FREIE ÜBUNG',outdoor_activity:'OUTDOOR'})[type]||'TRAINING';
  }

  function workoutExerciseCard(exercise){
    const catalog=state.catalogExercises.find(item=>String(item.id)===String(exercise.exerciseId));
    const type=catalog?.item_type||(exercise.kind==='cardio'?'cardio_machine':'free_exercise');
    const meta=catalog?.category||catalog?.muscle_group||(exercise.kind==='cardio'?'Cardio':'Kraft');
    const number=exercise.equipmentNumber||catalog?.equipment_number||'';
    const settings=exercise.settingsText||catalog?.settings_text||'';
    const title=(number?number+' ':'')+exercise.name;
    const parent=sessionById(exercise.sessionId);
    const historical=parent?.status==='completed';
    const opened=expandedExercises.has(exercise.id)||exercise.status==='running';
    const ordered=[...(parent?.workout||[])].sort((a,b)=>a.sortOrder-b.sortOrder);
    const moveIndex=ordered.findIndex(item=>item.id===exercise.id);
    const canMoveUp=moveIndex>0;
    const canMoveDown=moveIndex>=0&&moveIndex<ordered.length-1;
    return '<details class="sport-workout-card-v573 sport-workout-card-v613 status-'+esc(exercise.status)+'" data-sport-exercise-detail="'+esc(exercise.id)+'" '+(opened?'open':'')+'>'+
      '<summary class="sport-workout-summary-v613"><div><span>'+esc(itemTypeLabel(type))+' · '+esc(meta)+'</span><h3>'+esc(title)+'</h3>'+(settings?'<small class="sport-item-settings-v574">'+esc(settings)+'</small>':'')+'</div>'+
        '<div class="sport-workout-summary-tools-v614">'+
          '<div class="sport-reorder-inline-v614" aria-label="Reihenfolge ändern">'+
            '<button type="button" data-sport-move-exercise="'+esc(exercise.id)+'" data-direction="up" '+(canMoveUp?'':'disabled')+' aria-label="Übung nach oben">↑</button>'+
            '<button type="button" data-sport-move-exercise="'+esc(exercise.id)+'" data-direction="down" '+(canMoveDown?'':'disabled')+' aria-label="Übung nach unten">↓</button>'+
          '</div>'+
          '<b>'+esc(workoutStatusLabel(exercise.status))+'</b>'+
        '</div>'+
      '</summary>'+
      '<div class="sport-workout-body-v613">'+
        workoutHistory(exercise)+
        (exercise.kind==='cardio'?cardioEditor(exercise):strengthEditor(exercise))+
        '<div class="sport-workout-actions-v573 sport-workout-actions-v613">'+
          (!historical&&exercise.status!=='running'?'<button type="button" data-sport-exercise-status="'+esc(exercise.id)+'" data-status="running">Start</button>':'')+
          (!historical&&exercise.status!=='completed'?'<button type="button" data-sport-exercise-status="'+esc(exercise.id)+'" data-status="completed">Fertig</button>':'')+
          (!historical?(exercise.status!=='skipped'?'<button type="button" data-sport-exercise-status="'+esc(exercise.id)+'" data-status="skipped">Überspringen</button>':'<button type="button" data-sport-exercise-status="'+esc(exercise.id)+'" data-status="planned">Zurückholen</button>'):'')+
          '<button type="button" class="danger" data-sport-remove-exercise="'+esc(exercise.id)+'">Entfernen</button>'+
        '</div>'+
      '</div>'+
    '</details>';
  }

  function workoutSummaryCard(exercise){
    const catalog=state.catalogExercises.find(item=>String(item.id)===String(exercise.exerciseId));
    const number=exercise.equipmentNumber||catalog?.equipment_number||'';
    const settings=exercise.settingsText||catalog?.settings_text||'';
    const title=(number?number+' ':'')+exercise.name;
    let detailHtml='';
    if(exercise.kind==='cardio'){
      const detail=[
        exercise.durationMinutes!==null?exercise.durationMinutes+' Min.':null,
        exercise.resistanceLevel?'Stufe '+exercise.resistanceLevel:null,
        exercise.distanceKm!==null?exercise.distanceKm+' km':null,
        exercise.speedKmh!==null?exercise.speedKmh+' km/h':null,
        exercise.inclinePercent!==null?exercise.inclinePercent+' %':null,
        exercise.caloriesKcal!==null?exercise.caloriesKcal+' kcal':null
      ].filter(Boolean).join(' · ');
      const phases=normalizeCardioPhases(exercise);
      const phaseHtml=phases.length?'<span class="sport-summary-sets-v610 sport-summary-phases-v613">'+phases.map((phase,index)=>{
        const parts=[];
        if(phase.duration_minutes!==null)parts.push(phase.duration_minutes+' Min.');
        if(phase.resistance_level)parts.push('Stufe '+phase.resistance_level);
        if(phase.speed_kmh!==null)parts.push(phase.speed_kmh+' km/h');
        if(phase.incline_percent!==null)parts.push(phase.incline_percent+' %');
        return '<i><b>Phase '+(index+1)+'</b><em>'+esc(parts.join(' · ')||'keine Werte')+'</em></i>';
      }).join('')+'</span>':'';
      detailHtml='<span>'+esc(detail||'keine Gesamtwerte')+'</span>'+phaseHtml;
    }else{
      const sets=(exercise.sets||[]).filter(set=>set.weightKg!==null||set.repetitions!==null||set.rir!==null);
      detailHtml=sets.length?'<span class="sport-summary-sets-v610">'+sets.map(set=>{
        const parts=[];
        if(set.weightKg!==null)parts.push((exercise.loadMode==='assistance'?'Unterstützung ':'')+set.weightKg+' kg');
        if(set.repetitions!==null)parts.push(set.repetitions+' Wdh.');
        if(set.rir!==null)parts.push('RIR '+set.rir+(set.rirPlus?'+':''));
        return '<i><b>Set '+set.setNumber+'</b><em>'+esc(parts.join(' · ')||'keine Werte')+'</em></i>';
      }).join('')+'</span>':'<span>keine Satzwerte</span>';
    }
    return '<article class="sport-summary-card-v574"><div><strong>'+esc(title)+'</strong>'+(settings?'<small>'+esc(settings)+'</small>':'')+'</div>'+detailHtml+'</article>';
  }

  function completedWorkoutCard(exercise){
    return '<div class="sport-completed-wrap-v612">'+workoutSummaryCard(exercise)+'<button type="button" data-sport-exercise-status="'+esc(exercise.id)+'" data-status="planned">Wieder öffnen</button></div>';
  }
  function skippedWorkoutCard(exercise){
    return '<div class="sport-completed-wrap-v612">'+workoutSummaryCard(exercise)+'<button type="button" data-sport-exercise-status="'+esc(exercise.id)+'" data-status="planned">Zurückholen</button></div>';
  }

  function timelineBlock(session){
    return '<div class="sport-timeline-v573">'+TIMELINE_STEPS.map(([prop,column,label],index)=>{
      const value=session[prop];
      return '<button type="button" class="'+(value?'is-done':'')+'" data-sport-timeline="'+esc(session.id)+'" data-column="'+column+'" '+(value?'disabled':'')+'>'+
        '<i>'+(index+1)+'</i><span><strong>'+esc(label)+'</strong><small>'+(value?esc(clock(value)):'antippen = jetzt')+'</small></span>'+
      '</button>';
    }).join('')+'</div>';
  }

  function participantsBlock(session){
    const rows=sessionParticipantRows(session.id);
    return '<section class="sport-x-block-v573"><div class="sport-x-block-head-v573"><div><span>TRAININGSPARTNER</span><strong>Auf Einheitsebene</strong></div><small>alphabetisch</small></div>'+
      '<div class="sport-partner-list-v573">'+(rows.length?rows.map(row=>'<span>'+esc(row.participant_name)+'<button type="button" data-sport-remove-participant="'+esc(row.id)+'" aria-label="'+esc(row.participant_name)+' entfernen">×</button></span>').join(''):'<em>Noch niemand eingetragen.</em>')+'</div>'+
      '<form class="sport-partner-form-v573" data-sport-participant-form="'+esc(session.id)+'"><input name="participant" placeholder="Name" autocomplete="off" required><button type="submit">+ Partner</button></form>'+
    '</section>';
  }

  function planningPanel(){
    const current=planSessionForDate(planDate);
    const otherPlans=state.sessions.filter(session=>session.kind==='xtraining'&&session.status!=='completed'&&session.status!=='cancelled'&&session.date!==planDate).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const currentBody=current
      ?'<details class="sport-plan-card-v612 sport-plan-day-v613" data-sport-plan-day="'+esc(current.date)+'" '+(collapsedPlanDates.has(current.date)?'':'open')+'>'+
          '<summary class="sport-plan-day-summary-v613"><div class="sport-plan-card-head-v612"><div><span>'+esc(xSessionStatusLabel(current.status))+'</span><strong>'+esc(dateLabel(current.date))+'</strong><small class="sport-location-sub-v613">'+esc(venueDisplay(current.venue))+'</small></div><b>'+(current.workout||[]).filter(item=>item.status!=='skipped').length+' Elemente</b></div></summary>'+
          '<div class="sport-plan-day-body-v613">'+
            planVenueForm(current)+
            (current.date===todayIso()&&current.status==='planned'?'<button class="sport-start-plan-v612" type="button" data-sport-start-plan="'+esc(current.id)+'">Heutige Einheit starten</button>':'')+
            (isSessionActive(current)?'<div class="sport-plan-running-v612">Diese Einheit läuft bereits. In der Übersicht siehst du den aktuellen Ablauf.</div>':'')+
            '<div class="sport-plan-toolbar-v612"><button type="button" data-sport-open-catalog data-session-id="'+esc(current.id)+'">Katalog öffnen</button></div>'+
            workoutLists(current)+
          '</div>'+
        '</details>'
      :'<article class="sport-x-start-v573"><span>TRAININGSPLAN</span><h2>Noch nichts für diesen Tag geplant</h2><p>Du kannst den Plan jetzt anlegen oder direkt im Katalog die ersten Übungen auswählen.</p><button type="button" data-sport-create-plan="'+esc(planDate)+'">Plan anlegen</button> <button type="button" data-sport-open-catalog>Katalog öffnen</button></article>';

    return '<section class="sport-panel-v510 sport-panel-v512" data-sport-panel-v568="planning">'+wave()+
      '<div class="sport-hero-v510"><div class="sport-kicker-v510"><span class="sport-live-dot-v510"></span>PLANEN '+statusBadge()+'</div><p class="sport-date-v510">Trainingstage vorbereiten, ohne sie schon als absolvierte Einheit zu zählen.</p><div class="sport-section-mark-v512">P</div></div>'+
      '<div class="sport-content-v510">'+
        '<section class="sport-plan-date-v612"><label>Tag auswählen<input type="date" data-sport-plan-date value="'+esc(planDate)+'"></label><span>'+esc(dateLabel(planDate))+'</span></section>'+
        currentBody+
        (otherPlans.length?'<div class="sport-section-title-v568">Weitere offene Pläne</div><div class="sport-plan-list-v612">'+otherPlans.map(session=>'<button type="button" data-sport-select-plan="'+esc(session.date)+'"><strong>'+esc(shortDate(session.date))+'</strong><span>'+esc(venueDisplay(session.venue))+' · '+(session.workout||[]).filter(item=>item.status!=='skipped').length+' Elemente</span></button>').join('')+'</div>':'')+
        errorNote()+
      '</div></section>';
  }

  function xTrainingPanel(){
    return '<section class="sport-panel-v510 sport-panel-v512" data-sport-panel-v568="sessions">'+wave()+
      '<div class="sport-hero-v510"><div class="sport-kicker-v510"><span class="sport-live-dot-v510"></span>EINHEITEN '+statusBadge()+'</div><p class="sport-date-v510">Abgeschlossene Trainingstage. Geplante und laufende Einheiten bleiben hier draußen.</p><div class="sport-section-mark-v512">E</div></div>'+
      '<div class="sport-content-v510">'+unitHistory(state.sessions)+errorNote()+'</div></section>';
  }


  function catalogExerciseGroups(){
    const groups=new Map();
    state.catalogExercises.forEach(item=>{
      const key=String(item.category||item.muscle_group||(item.kind==='cardio'?'Cardio':'Kraft'));
      const list=groups.get(key)||[];
      list.push(item);
      groups.set(key,list);
    });
    for(const list of groups.values())list.sort((a,b)=>{
      const an=Number.parseInt(a.equipment_number,10),bn=Number.parseInt(b.equipment_number,10);
      if(Number.isFinite(an)&&Number.isFinite(bn)&&an!==bn)return an-bn;
      if(Number.isFinite(an)!==Number.isFinite(bn))return Number.isFinite(an)?-1:1;
      return byName(a.name,b.name);
    });
    return [...groups.entries()].sort((a,b)=>byName(a[0],b[0]));
  }

  function catalogPanel(){
    const target=catalogTargetSessionId?sessionById(catalogTargetSessionId):planSessionForDate(planDate);
    if(catalogTargetSessionId&&!target)catalogTargetSessionId=null;
    const current=target||planSessionForDate(planDate);
    const groups=catalogExerciseGroups();
    const selected=new Set((current?.workout||[]).filter(item=>item.status!=='skipped').map(item=>item.exerciseId));
    const targetSessionId=current?.id||'';
    const itemsHtml=groups.length?groups.map(([group,list])=>{
      const allSelected=list.length>0&&list.every(item=>selected.has(String(item.id)));
      return '<section class="sport-catalog-group-v573">'+
        '<div class="sport-catalog-group-head-v573"><div><span>GRUPPE</span><strong>'+esc(group)+'</strong></div>'+
          '<button type="button" class="'+(allSelected?'is-added-v612':'')+'" data-sport-add-group="'+esc(group)+'" data-session-id="'+esc(targetSessionId)+'" data-plan-date="'+esc(planDate)+'" '+(allSelected?'disabled':'')+'>'+(allSelected?'✓ Gruppe enthalten':'Gruppe übernehmen')+'</button>'+
        '</div>'+
        '<div class="sport-catalog-grid-v573">'+list.map(item=>{
          const title=(item.equipment_number?item.equipment_number+' ':'')+item.name;
          const settings=item.settings_text?'<small class="sport-item-settings-v574">'+esc(item.settings_text)+'</small>':'';
          const load=item.load_mode==='assistance'?'<small class="sport-assistance-v574">Unterstützungsgewicht</small>':'';
          const added=selected.has(String(item.id));
          return '<article class="'+(added?'is-added-v612':'')+'"><div><span>'+esc(itemTypeLabel(item.item_type))+'</span><h3>'+esc(title)+'</h3><small>'+esc(item.muscle_group||item.category||'')+'</small>'+settings+load+'</div>'+
            '<button type="button" class="'+(added?'is-added-v612':'')+'" data-sport-add-exercise="'+esc(item.id)+'" data-session-id="'+esc(targetSessionId)+'" data-plan-date="'+esc(planDate)+'" '+(added?'disabled':'')+'>'+(added?'✓ Enthalten':'Hinzufügen')+'</button>'+
          '</article>';
        }).join('')+'</div>'+
      '</section>';
    }).join(''):'<div class="sport-empty-inline-v568">Noch keine Trainingselemente im Katalog.</div>';

    const targetLabel=current
      ?(current.status==='completed'?'Abgeschlossene Einheit · '+shortDate(current.date):dateLabel(current.date))
      :dateLabel(planDate);
    const backTarget=current?.status==='completed'?'sessions':(isSessionActive(current)?'overview':'planning');

    return '<section class="sport-panel-v510 sport-panel-v512" data-sport-panel-v568="catalog">'+wave()+
      '<div class="sport-hero-v510"><div class="sport-kicker-v510"><span class="sport-live-dot-v510"></span>KATALOG '+statusBadge()+'</div><p class="sport-date-v510">'+esc(targetLabel)+' · '+esc(venueDisplay(current?.venue))+'</p><div class="sport-section-mark-v512">K</div></div>'+
      '<div class="sport-content-v510">'+
        '<div class="sport-catalog-note-v573">Jeder Klick landet direkt in <b>'+esc(current?.status==='completed'?'dieser abgeschlossenen Einheit':'diesem Trainingsplan')+'</b>. Ein grüner Haken bedeutet: ist schon drin.</div>'+
        '<button type="button" class="sport-back-plan-v612" data-sport-catalog-back="'+esc(backTarget)+'">← Zurück</button>'+
        '<div class="sport-section-title-v568">Trainingselemente</div>'+itemsHtml+
        '<details class="sport-catalog-create-v573"><summary>+ Trainingselement hinzufügen</summary>'+
          '<form data-sport-add-exercise-form>'+
            '<label>Typ<select name="item_type"><option value="strength_machine">Kraftgerät</option><option value="cardio_machine">Cardiogerät</option><option value="free_exercise">Freie Übung</option><option value="outdoor_activity">Outdoor-Aktivität</option></select></label>'+
            '<label>Bezeichnung<input name="name" required placeholder="z. B. Brustpresse oder Sit-Ups"></label>'+
            '<label>Gerätenummer optional<input name="equipment_number" placeholder="z. B. 01"></label>'+
            '<label>Kategorie / Gruppe<input name="category" placeholder="z. B. Brust, Beine, Cardio"></label>'+
            '<label>Muskelgruppe optional<input name="muscle_group" placeholder="z. B. Quadrizeps"></label>'+
            '<label>Geräteeinstellungen optional<input name="settings_text" placeholder="z. B. Sitzposition 4 · Fußrolle 3"></label>'+
            '<label>Belastung<select name="load_mode"><option value="weight">Gewicht</option><option value="assistance">Unterstützungsgewicht</option><option value="none">Keine Gewichtsangabe</option></select></label>'+
            '<button type="submit">Trainingselement speichern</button>'+
          '</form>'+
        '</details>'+
        errorNote()+
      '</div></section>';
  }

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
    const completed=completedSessions(rows);
    const groups=groupSessions(completed),activities=flatActivities(completed);
    const fitxGroups=groups.filter(group=>(group.sessions||[]).some(isFitx));
    const courseCounts=new Map(),partnerCounts=new Map();
    let courseTotal=0;
    activities.forEach(({activity})=>{
      const minutes=activityMinutes(activity);courseTotal+=minutes;
      const c=courseCounts.get(activity.name)||{count:0,minutes:0};c.count++;c.minutes+=minutes;courseCounts.set(activity.name,c);
    });
    groups.forEach(group=>groupParticipants(group).forEach(name=>partnerCounts.set(name,(partnerCounts.get(name)||0)+1)));
    const workoutItems=groups.flatMap(group=>groupWorkout(group));
    const freeTrainingCount=groups.filter(group=>groupWorkout(group).length>0).length;
    const mixedCount=groups.filter(group=>groupWorkout(group).length>0&&groupActivities(group).length>0).length;
    return {
      allSessions:groups.length,
      allMinutes:groups.reduce((sum,group)=>sum+groupDuration(group),0),
      fitxSessions:fitxGroups.length,
      fitxMinutes:fitxGroups.reduce((sum,group)=>sum+groupDuration(group),0),
      freeTrainingCount,
      workoutItemCount:workoutItems.length,
      cardioCount:workoutItems.filter(item=>item.kind==='cardio').length,
      mixedCount,
      courseCount:activities.length,
      courseTotal,
      longestFitx:fitxGroups.reduce((best,group)=>Math.max(best,groupDuration(group)),0),
      courseCounts:[...courseCounts.entries()].sort((a,b)=>b[1].count-a[1].count||b[1].minutes-a[1].minutes||byName(a[0],b[0])),
      partnerCounts:[...partnerCounts.entries()].sort((a,b)=>b[1]-a[1]||byName(a[0],b[0]))
    };
  }
  function statisticsPanel(rows){
    const s=aggregate(rows);
    const courses=s.courseCounts.length?`<div class="sport-rank-v568">${s.courseCounts.map(([name,val])=>`<div><span>${esc(name)}</span><b>${val.count}× · ${esc(formatMinutes(val.minutes))}</b></div>`).join('')}</div>`:'<div class="sport-empty-inline-v568">Noch keine Kurse für eine Auswertung.</div>';
    const people=s.partnerCounts.length?`<div class="sport-rank-v568">${s.partnerCounts.map(([name,count])=>`<div><span>${esc(name)}</span><b>${count} gemeinsame${count===1?' Einheit':' Einheiten'}</b></div>`).join('')}</div>`:'<div class="sport-empty-inline-v568">Noch keine Trainingspartner dokumentiert.</div>';
    return `<section class="sport-panel-v510 sport-panel-v512" data-sport-panel-v512="statistics" data-sport-panel-v568="statistics">${wave()}<div class="sport-hero-v510"><div class="sport-kicker-v510"><span class="sport-live-dot-v510"></span>STATISTIK ${statusBadge()}</div><p class="sport-date-v510">Alle Sportarten und Trainingsformen gemeinsam</p><div class="sport-duration-row-v510"><div class="sport-duration-v510" data-total-minutes="${s.allMinutes}">${esc(formatMinutes(s.allMinutes).replace(' h',''))}</div><div class="sport-duration-unit-v510">Trainingszeit gesamt</div></div></div><div class="sport-content-v510"><div class="sport-stat-grid-v568"><article class="sport-stat-card-v512"><span>Trainingstage</span><strong>${s.allSessions}</strong></article><article class="sport-stat-card-v512"><span>FitX-Besuche</span><strong>${s.fitxSessions}</strong></article><article class="sport-stat-card-v512"><span>Freies Training</span><strong>${s.freeTrainingCount}</strong></article><article class="sport-stat-card-v512"><span>Kurse</span><strong>${s.courseCount}</strong></article><article class="sport-stat-card-v512"><span>Trainingselemente</span><strong>${s.workoutItemCount}</strong></article><article class="sport-stat-card-v512"><span>Gemischte Tage</span><strong>${s.mixedCount}</strong></article></div><div class="sport-stat-foot-v610">FitX-Zeit: <b>${esc(formatMinutes(s.fitxMinutes))}</b> · Kurszeit: <b>${esc(formatMinutes(s.courseTotal))}</b> · Cardio-Einträge: <b>${s.cardioCount}</b></div><div class="sport-stats-columns-v568"><div><div class="sport-section-title-v568">Kurse</div>${courses}</div><div><div class="sport-section-title-v568">Mit dabei</div>${people}</div></div>${errorNote()}</div></section>`;
  }


  function panel(rows){if(activeTab==='planning')return planningPanel();if(activeTab==='sessions')return xTrainingPanel();if(activeTab==='catalog')return catalogPanel();if(activeTab==='statistics')return statisticsPanel(rows);return fitxPanel(rows);}

  function render({animate=false}={}){
    const serial=++renderSerial;
    const root=ensureRoot();
    if(!root)return false;
    root.dataset.sportTabV568=activeTab;
    root.innerHTML=`<div class="sport-stage-v510 sport-stage-v512 sport-stage-v568">${tabRail()}${panel(state.sessions)}</div>`;

    const handle=async(button,task)=>{
      if(button)button.disabled=true;
      try{await task();}
      catch(error){console.error(error);alert(error?.message||'Aktion fehlgeschlagen.');if(button)button.disabled=false;}
    };

    if(root.dataset.sportDelegatedV613!=='1'){
      root.dataset.sportDelegatedV613='1';
      root.addEventListener('click',event=>{
        const rirButton=event.target.closest('[data-sport-rir-step]');
        if(rirButton){
          const wrap=rirButton.closest('[data-sport-rir-stepper]');
          const input=wrap?.querySelector('input[name="rir"]');
          const output=wrap?.querySelector('[data-sport-rir-output]');
          if(!input||!output)return;
          const sequence=['0','1','2','3','4','5','5+'];
          let index=sequence.indexOf(input.value);
          if(index<0)index=0;
          index+=rirButton.dataset.sportRirStep==='up'?1:-1;
          index=Math.max(0,Math.min(sequence.length-1,index));
          input.value=sequence[index];
          output.textContent=sequence[index];
          wrap.querySelector('[data-sport-rir-step="down"]').disabled=index===0;
          wrap.querySelector('[data-sport-rir-step="up"]').disabled=index===sequence.length-1;
          return;
        }
        const phaseButton=event.target.closest('[data-sport-phase-action],[data-sport-add-phase]');
        if(!phaseButton)return;
        const form=phaseButton.closest('[data-sport-cardio-form]');
        if(!form)return;
        const list=form.querySelector('.sport-cardio-phases-v613');
        const fields=String(form.dataset.phaseFields||'duration_minutes').split(',').filter(Boolean);
        if(phaseButton.hasAttribute('data-sport-add-phase')){
          list?.insertAdjacentHTML('beforeend',cardioPhaseRow({},list.querySelectorAll('[data-cardio-phase-row]').length,fields));
          renumberCardioPhaseRows(form);
          return;
        }
        const row=phaseButton.closest('[data-cardio-phase-row]');
        if(!row||!list)return;
        const action=phaseButton.dataset.sportPhaseAction;
        if(action==='delete')row.remove();
        if(action==='up'&&row.previousElementSibling)list.insertBefore(row,row.previousElementSibling);
        if(action==='down'&&row.nextElementSibling)list.insertBefore(row.nextElementSibling,row);
        if(action==='duplicate'){
          const clone=row.cloneNode(true);
          list.insertBefore(clone,row.nextElementSibling);
        }
        renumberCardioPhaseRows(form);
      });
    }

    root.querySelectorAll('[data-sport-tab-v568]').forEach(button=>button.addEventListener('click',()=>setTab(button.dataset.sportTabV568,{animate:true,persist:true})));
    root.querySelectorAll('[data-sport-retry-v568]').forEach(button=>button.addEventListener('click',()=>load(true)));

    root.querySelectorAll('[data-sport-create-plan]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget;
      handle(target,()=>createPlanSession(target.dataset.sportCreatePlan));
    }));
    root.querySelector('[data-sport-plan-date]')?.addEventListener('change',event=>{
      const value=event.currentTarget.value;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return;
      planDate=value;
      try{localStorage.setItem(PLAN_DATE_KEY,planDate);}catch(_){}
      render({animate:false});
    });
    root.querySelectorAll('[data-sport-select-plan]').forEach(button=>button.addEventListener('click',event=>{
      planDate=event.currentTarget.dataset.sportSelectPlan||todayIso();
      try{localStorage.setItem(PLAN_DATE_KEY,planDate);}catch(_){}
      render({animate:true});
    }));
    root.querySelectorAll('[data-sport-plan-venue]').forEach(form=>form.addEventListener('submit',event=>{
      event.preventDefault();
      const submit=form.querySelector('button[type="submit"]');
      const data=new FormData(form);
      handle(submit,()=>savePlanVenue(form.dataset.sportPlanVenue,data.get('venue'),data.get('outdoor_detail')));
    }));
    root.querySelectorAll('[data-sport-start-plan]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget;
      handle(target,async()=>{await startPlanSession(target.dataset.sportStartPlan);setTab('overview',{animate:true,persist:true});});
    }));

    root.querySelectorAll('[data-sport-timeline]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget;
      handle(target,()=>markTimeline(target.dataset.sportTimeline,target.dataset.column));
    }));

    root.querySelectorAll('[data-sport-participant-form]').forEach(form=>form.addEventListener('submit',event=>{
      event.preventDefault();
      const submit=form.querySelector('button[type="submit"]');
      const data=new FormData(form);
      handle(submit,()=>addSessionParticipant(form.dataset.sportParticipantForm,data.get('participant')));
    }));

    root.querySelectorAll('[data-sport-remove-participant]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget;
      handle(target,()=>removeSessionParticipant(target.dataset.sportRemoveParticipant));
    }));

    root.querySelectorAll('[data-sport-open-catalog]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget;
      catalogTargetSessionId=target.dataset.sessionId||null;
      setTab('catalog',{animate:true,persist:true});
    }));
    root.querySelectorAll('[data-sport-catalog-back]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget.dataset.sportCatalogBack||'planning';
      catalogTargetSessionId=null;
      setTab(target,{animate:true,persist:true});
    }));
    root.querySelectorAll('[data-sport-open-plan]').forEach(button=>button.addEventListener('click',()=>setTab('planning',{animate:true,persist:true})));

    root.querySelectorAll('[data-sport-add-exercise]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget;
      handle(target,()=>target.dataset.sessionId?addExerciseToSession(target.dataset.sessionId,target.dataset.sportAddExercise):addExerciseToPlan(target.dataset.planDate||planDate,target.dataset.sportAddExercise));
    }));

    root.querySelectorAll('[data-sport-add-group]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget;
      handle(target,()=>target.dataset.sessionId?addExerciseGroup(target.dataset.sessionId,target.dataset.sportAddGroup):addGroupToPlan(target.dataset.planDate||planDate,target.dataset.sportAddGroup));
    }));

    root.querySelectorAll('[data-sport-equipment-for]').forEach(select=>select.addEventListener('change',event=>{
      const target=event.currentTarget;
      handle(target,()=>updateSessionExercise(target.dataset.sportEquipmentFor,{equipment_id:target.value||null}));
    }));

    root.querySelectorAll('[data-sport-exercise-status]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget;
      handle(target,()=>setExerciseStatus(target.dataset.sportExerciseStatus,target.dataset.status));
    }));

    root.querySelectorAll('[data-sport-remove-exercise]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget;
      handle(target,()=>removeSessionExercise(target.dataset.sportRemoveExercise));
    }));

    root.querySelectorAll('[data-sport-move-exercise]').forEach(button=>button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      const target=event.currentTarget;
      if(target.disabled)return;
      handle(target,()=>moveSessionExercise(target.dataset.sportMoveExercise,target.dataset.direction));
    }));

    root.querySelectorAll('[data-sport-edit-session]').forEach(button=>button.addEventListener('click',event=>{
      editingSessionId=event.currentTarget.dataset.sportEditSession||null;
      render({animate:false});
    }));
    root.querySelectorAll('[data-sport-stop-edit-session]').forEach(button=>button.addEventListener('click',()=>{
      editingSessionId=null;
      catalogTargetSessionId=null;
      render({animate:false});
    }));

    root.querySelectorAll('[data-sport-exercise-detail]').forEach(detail=>detail.addEventListener('toggle',()=>{
      const id=detail.dataset.sportExerciseDetail;
      if(detail.open)expandedExercises.add(id);else expandedExercises.delete(id);
    }));
    root.querySelectorAll('[data-sport-plan-day]').forEach(detail=>detail.addEventListener('toggle',()=>{
      const date=detail.dataset.sportPlanDay;
      if(detail.open)collapsedPlanDates.delete(date);else collapsedPlanDates.add(date);
    }));
    root.querySelectorAll('[data-sport-plan-venue] input[name="venue"]').forEach(input=>input.addEventListener('change',event=>{
      const form=event.currentTarget.closest('[data-sport-plan-venue]');
      const outdoor=form?.querySelector('.sport-outdoor-detail-v613');
      outdoor?.classList.toggle('is-visible',event.currentTarget.value==='Outdoor');
    }));

    root.querySelectorAll('[data-sport-set-form]').forEach(form=>form.addEventListener('submit',event=>{
      event.preventDefault();
      const submit=form.querySelector('button[type="submit"]');
      const data=new FormData(form);
      handle(submit,()=>saveStrengthSet(
        form.dataset.exerciseId,
        Number(form.dataset.setNumber),
        {
          weight_kg:data.get('weight_kg'),
          repetitions:data.get('repetitions'),
          rir:data.get('rir')
        }
      ));
    }));

    root.querySelectorAll('[data-sport-add-set]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget;
      handle(target,()=>addBlankSet(target.dataset.sportAddSet));
    }));

    root.querySelectorAll('[data-sport-cardio-form]').forEach(form=>form.addEventListener('submit',event=>{
      event.preventDefault();
      const submit=form.querySelector('button[type="submit"]');
      const data=new FormData(form);
      handle(submit,()=>saveCardioValues(form.dataset.sportCardioForm,{
        duration_minutes:data.get('duration_minutes'),
        distance_km:data.get('distance_km'),
        resistance_level:data.get('resistance_level'),
        speed_kmh:data.get('speed_kmh'),
        incline_percent:data.get('incline_percent'),
        calories_kcal:data.get('calories_kcal'),
        phases:collectCardioPhases(form)
      }));
    }));

    root.querySelector('[data-sport-add-exercise-form]')?.addEventListener('submit',event=>{
      event.preventDefault();
      const form=event.currentTarget;
      const submit=form.querySelector('button[type="submit"]');
      const data=new FormData(form);
      handle(submit,()=>addCatalogExercise({
        name:data.get('name'),
        item_type:data.get('item_type'),
        equipment_number:data.get('equipment_number'),
        category:data.get('category'),
        muscle_group:data.get('muscle_group'),
        settings_text:data.get('settings_text'),
        load_mode:data.get('load_mode')
      }));
    });

    root.querySelector('[data-sport-add-equipment-form]')?.addEventListener('submit',event=>{
      event.preventDefault();
      const form=event.currentTarget;
      const submit=form.querySelector('button[type="submit"]');
      const data=new FormData(form);
      handle(submit,()=>addEquipment({
        name:data.get('name'),
        equipment_number:data.get('equipment_number'),
        category:data.get('category'),
        settings_text:data.get('settings_text')
      }));
    });

    if(animate&&serial===renderSerial&&!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches){
      root.classList.remove('sport-tab-switch-v512');
      void root.offsetWidth;
      root.classList.add('sport-tab-switch-v512');
      setTimeout(()=>root.classList.remove('sport-tab-switch-v512'),520);
    }
    return true;
  }

  function ensureChrome(){
    const sw=document.getElementById('sportSwitchV510');
    if(!sw)return false;
    sw.setAttribute('aria-hidden','true');
    sw.removeAttribute('role');
    sw.removeAttribute('tabindex');
    sw.removeAttribute('aria-label');
    sw.removeAttribute('aria-pressed');
    sw.dataset.sportV568Bound='passive';
    return true;
  }

  function setTab(id,{animate=true,persist=true}={}){const migrated={fitx:'overview',xtraining:'planning',activities:'sessions'}[id]||id;activeTab=TABS.some(t=>t.id===migrated)?migrated:'overview';if(persist)try{localStorage.setItem(TAB_KEY,activeTab);}catch(_){ }render({animate});return activeTab;}
  function currentMode(){return document.body.classList.contains('mod-sport-mode-v510')?'sport':'todo';}
  function setMode(mode,{persist=true,animate=true}={}){
    mode=mode==='sport'?'sport':'todo';ensureRoot();ensureChrome();document.body.classList.toggle('mod-sport-mode-v510',mode==='sport');document.body.dataset.modAppModeV510=mode;document.getElementById('sportSwitchV510')?.removeAttribute('aria-pressed');
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
    try{
      const stored=localStorage.getItem(TAB_KEY);
      const migrated={fitx:'overview',xtraining:'planning',activities:'sessions'}[stored]||stored;
      activeTab=TABS.some(t=>t.id===migrated)?migrated:'overview';
      const savedPlanDate=localStorage.getItem(PLAN_DATE_KEY);
      planDate=/^\d{4}-\d{2}-\d{2}$/.test(savedPlanDate||'')?savedPlanDate:todayIso();
    }catch(_){activeTab='overview';planDate=todayIso();}
    ensureRoot();render();
    ensureChrome();
    /* V603: Module preload must never switch the visible surface by itself. */
    setMode('todo',{persist:false,animate:false});
  }

  const api={version:VERSION,load,refresh:()=>load(true),render,setMode,toggle:toggleMode,currentMode,loadSessions,saveSessions,modeKey:MODE_KEY,dataKey:CACHE_KEY,getState:()=>({loaded:state.loaded,loading:state.loading,error:state.error,source:state.source,sessions:state.sessions.length,planDate})};
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
  window.addEventListener('load',()=>{if(!historicalRegression&&currentMode()==='sport')setTimeout(()=>load(true),180);},{once:true});
})();
