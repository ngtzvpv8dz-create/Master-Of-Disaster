/* V748 · SPORT · current-day planning + chronological history */
(function(){
  'use strict';
  if(window.__modSportV568)return;

  const VERSION='V762';
  const ROOT_ID='sportRootV510';
  const MODE_KEY='masterOfDisasterAppModeV510';
  const TAB_KEY='masterOfDisasterSportTabV568';
  const PLAN_DATE_KEY='masterOfDisasterSportPlanDateV612';
  const CACHE_KEY='masterOfDisasterSportSessionsV568Cache';
  const SPORT_DRAFT_PREFIX='masterOfDisasterSportDraftV763';
  const SPORT_DRAFT_TTL_MS=14*24*60*60*1000;
  const LEGACY_KEY='masterOfDisasterSportSessionsV510';
  const HEALTH_EVENT='mod:health-sync-request';
  const REQUEST_TIMEOUT_MS=4500;
  const TABS=[
    {id:'overview',label:'AKTIV'},
    {id:'planning',label:'PLANEN'},
    {id:'sessions',label:'EINHEITEN'},
    {id:'catalog',label:'KATALOG'},
    {id:'execution',label:'AUSFÜHRUNG'},
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
  let planTestMode=false;
  let state={loaded:false,loading:false,error:null,source:'cache',sessions:[],courseCatalog:[],coursePlans:[],weeklySlots:[],courseOccurrences:[],catalogExercises:[],equipment:[],sessionParticipants:[],exerciseParticipants:[],sessionExercises:[],exerciseSets:[]};
  let loadPromise=null;
  let renderSerial=0;
  let catalogTargetSessionId=null;
  let editingSessionId=null;
  let coursePickerDate=null;
  let activeClockTimer=null;
  const expandedExercises=new Set();
  const expandedCatalogGroups=new Set();
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

  function compactPlanVenue(session){
    return '<details class="sport-plan-venue-compact-v631">'+
      '<summary><span>Ort</span><strong>'+esc(venueDisplay(session?.venue))+'</strong><em>ändern</em></summary>'+
      planVenueForm(session)+
    '</details>';
  }

  function normalizeCardioPhases(exercise){
    const raw=Array.isArray(exercise?.metricValues?.phases)?exercise.metricValues.phases:[];
    return raw.map((phase,index)=>({
      order:index+1,
      duration_minutes:numberOrNull(phase?.duration_minutes),
      resistance_level:phase?.resistance_level===null||phase?.resistance_level===undefined?'':String(phase.resistance_level),
      speed_kmh:numberOrNull(phase?.speed_kmh),
      incline_percent:numberOrNull(phase?.incline_percent),
      distance_km_estimated:numberOrNull(phase?.distance_km_estimated),
      calories_kcal_estimated:numberOrNull(phase?.calories_kcal_estimated)
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

  function cardioPhaseEstimateText(phase){
    const distance=numberOrNull(phase?.distance_km_estimated);
    const calories=numberOrNull(phase?.calories_kcal_estimated);
    const parts=[];
    if(distance!==null)parts.push('≈ '+String(Math.round(distance*100)/100).replace('.',',')+' km');
    if(calories!==null)parts.push('≈ '+String(Math.round(calories))+' kcal');
    return parts.join(' · ');
  }

  function cardioPhaseRow(phase,index,fields){
    const estimate=cardioPhaseEstimateText(phase);
    return '<div class="sport-cardio-phase-v613" data-cardio-phase-row>'+
      '<div class="sport-cardio-phase-title-v613"><strong>Phase '+(index+1)+'</strong>'+
        (estimate?'<span class="sport-cardio-phase-estimate-v620">'+esc(estimate)+'</span>':'')+
        '<div>'+
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
    return '<div class="sport-rir-stepper-v613 sport-rir-stepper-v614 sport-rir-choice-v724" data-sport-rir-stepper>'+
      sequence.map(option=>
        '<button type="button" data-sport-rir-value="'+esc(option)+'" class="'+(option===clean?'is-selected':'')+'" aria-pressed="'+(option===clean?'true':'false')+'">'+esc(option)+'</button>'
      ).join('')+
      '<input type="hidden" name="rir" value="'+esc(clean)+'">'+
    '</div>';
  }

  const TIMELINE_STEPS=[
    ['gymArrivedAt','gym_arrived_at','Bei FitX angekommen'],
    ['gymLeftAt','gym_left_at','FitX verlassen']
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
      name:String(row.name_snapshot||row.name||'Trainingsgerät'),
      kind:String(row.kind||'strength'),
      itemType:String(row.item_type||row.itemType||''),
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
      participants:normalizeParticipants(row.participants||row.sport_session_exercise_participants||[]),
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

  function normalizeCircuitRun(row){
    if(!row||typeof row!=='object'||!row.id)return null;
    const exercises=(row.exercises||row.runExercises||[]).map(item=>({
      id:String(item.id||''),
      name:String(item.name_snapshot||item.name||'Übung'),
      settings:item.settings_snapshot||item.settings||'',
      sortOrder:Number(item.sort_order??item.sortOrder??999)
    })).sort((a,b)=>a.sortOrder-b.sortOrder);
    return {
      id:String(row.id),
      status:String(row.status||'completed'),
      name:String(row.name_snapshot||row.name||'Zirkeltraining'),
      plannedRounds:Number(row.planned_rounds??row.plannedRounds??0),
      workSeconds:Number(row.work_seconds??row.workSeconds??0),
      restSeconds:Number(row.rest_seconds??row.restSeconds??0),
      roundBreakSeconds:Number(row.round_break_seconds??row.roundBreakSeconds??0),
      completedRounds:Number(row.completed_rounds??row.completedRounds??0),
      currentRound:Number(row.current_round??row.currentRound??1),
      currentExerciseIndex:Number(row.current_exercise_index??row.currentExerciseIndex??0),
      currentElapsedSeconds:Number(row.current_elapsed_seconds??row.currentElapsedSeconds??0),
      totalActiveSeconds:Number(row.total_active_seconds??row.totalActiveSeconds??0),
      startedAt:row.started_at||row.startedAt||null,
      endedAt:row.ended_at||row.endedAt||null,
      exercises
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
      isTest:String(row.source||'').toLowerCase()==='test',
      sourceKey:row.source_key||row.sourceKey||null,
      note:row.notes||row.note||'',
      participants:normalizeParticipants(row.sessionParticipants||row.participants||[]),
      workout,
      activities,
      circuitRun:normalizeCircuitRun(row.circuitRun||row.circuit_run||null)
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
      supabase.from('sport_course_catalog').select('id,name,venue,start_time,end_time,active,sort_order').eq('user_id',user.id).eq('active',true).order('sort_order').order('name'),
      supabase.from('sport_course_plans').select('id,course_id,plan_date,created_at').eq('user_id',user.id).order('plan_date',{ascending:false}).limit(1000),
      supabase.from('sport_course_weekly_slots').select('id,course_id,weekday,start_time,end_time,venue,active').eq('user_id',user.id).eq('active',true).order('weekday').order('start_time').limit(1000),
      supabase.from('sport_course_occurrences').select('id,course_id,slot_id,kind,name,venue,plan_date,start_time,end_time,participants,status,session_id').eq('user_id',user.id).order('plan_date',{ascending:false}).limit(2000),
      supabase.from('sport_exercise_catalog').select('id,name,kind,item_type,equipment_number,category,muscle_group,settings_text,load_mode,metric_config,active,sort_order').eq('user_id',user.id).eq('active',true).order('sort_order').order('name'),
      supabase.from('sport_equipment_catalog').select('id,name,equipment_number,category,settings_text,active,sort_order').eq('user_id',user.id).eq('active',true).order('sort_order').order('name'),
      supabase.from('sport_session_exercises').select('id,session_id,exercise_id,equipment_id,name_snapshot,kind,status,sort_order,started_at,ended_at,duration_minutes,distance_km,resistance_level,speed_kmh,incline_percent,equipment_number_snapshot,settings_snapshot,load_mode_snapshot,calories_kcal,metric_values,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(5000),
      supabase.from('sport_session_exercise_participants').select('id,session_exercise_id,participant_name').eq('user_id',user.id).limit(10000),
      supabase.from('sport_exercise_sets').select('id,session_exercise_id,set_number,weight_kg,repetitions,rir,rir_plus').eq('user_id',user.id).order('set_number').limit(15000),
      supabase.from('sport_circuit_runs').select('id,session_id,name_snapshot,planned_rounds,work_seconds,rest_seconds,round_break_seconds,status,completed_rounds,current_round,current_exercise_index,current_elapsed_seconds,total_active_seconds,started_at,ended_at').eq('user_id',user.id).order('started_at',{ascending:false}).limit(500),
      supabase.from('sport_circuit_run_exercises').select('id,run_id,name_snapshot,settings_snapshot,sort_order').eq('user_id',user.id).order('sort_order').limit(10000)
    ];
    const labels=['Sporttermine','Sportaktivitäten','Kurs-Teilnehmer','Trainingspartner','Kurskatalog','Kursplan','Wochenkurse','Kursbuchungen','Übungskatalog','Gerätekatalog','Übungen & Geräte','Übungs-Teilnehmer','Sätze','Zirkel-Läufe','Zirkel-Übungen'];
    const results=await Promise.all(queries.map((query,index)=>withTimeout(query,labels[index],6500)));
    for(const result of results)if(result?.error)throw result.error;
    const [sessionsResult,activitiesResult,participantsResult,sessionPeopleResult,courseResult,coursePlansResult,weeklyResult,occurrenceResult,catalogResult,equipmentResult,workoutResult,exercisePeopleResult,setsResult,circuitRunsResult,circuitExercisesResult]=results;

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

    const peopleByExercise=new Map();
    (exercisePeopleResult.data||[]).forEach(row=>{
      const list=peopleByExercise.get(row.session_exercise_id)||[];
      list.push(row.participant_name);
      peopleByExercise.set(row.session_exercise_id,list);
    });

    const setsByExercise=new Map();
    (setsResult.data||[]).forEach(row=>{
      const list=setsByExercise.get(row.session_exercise_id)||[];
      list.push(row);
      setsByExercise.set(row.session_exercise_id,list);
    });
    const catalogById=new Map((catalogResult.data||[]).map(item=>[String(item.id),item]));
    const workoutBySession=new Map();
    (workoutResult.data||[]).forEach(row=>{
      const list=workoutBySession.get(row.session_id)||[];
      const catalogItem=catalogById.get(String(row.exercise_id));
      list.push({...row,item_type:catalogItem?.item_type||'',participants:peopleByExercise.get(row.id)||[],sets:setsByExercise.get(row.id)||[]});
      workoutBySession.set(row.session_id,list);
    });

    const circuitExercisesByRun=new Map();
    (circuitExercisesResult.data||[]).forEach(row=>{
      const list=circuitExercisesByRun.get(String(row.run_id))||[];
      list.push(row);
      circuitExercisesByRun.set(String(row.run_id),list);
    });
    const circuitBySession=new Map();
    (circuitRunsResult.data||[]).forEach(run=>{
      if(!run.session_id)return;
      circuitBySession.set(String(run.session_id),{
        ...run,
        exercises:circuitExercisesByRun.get(String(run.id))||[]
      });
    });

    state={...state,
      courseCatalog:(courseResult.data||[]),
      coursePlans:(coursePlansResult.data||[]),
      weeklySlots:(weeklyResult.data||[]),
      courseOccurrences:(occurrenceResult.data||[]),
      catalogExercises:(catalogResult.data||[]),
      equipment:(equipmentResult.data||[]),
      sessionParticipants:(sessionPeopleResult.data||[]),
      exerciseParticipants:(exercisePeopleResult.data||[]),
      sessionExercises:(workoutResult.data||[]),
      exerciseSets:(setsResult.data||[])
    };

    return sortSessions((sessionsResult.data||[]).map(row=>({
      ...row,
      activities:activitiesBySession.get(row.id)||[],
      sessionParticipants:peopleBySession.get(row.id)||[],
      workout:workoutBySession.get(row.id)||[],
      circuitRun:circuitBySession.get(String(row.id))||null
    })));
  }

  async function load(force=false){
    if(historicalRegression){
      state={...state,loaded:true,loading:false,error:null,source:'cache',sessions:sortSessions([historicalSeed])};
      writeCache(state.sessions);render();return state.sessions;
    }
    if(loadPromise){
      if(!force)return loadPromise;
      await loadPromise;
      return load(true);
    }
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
  function groupActivities(group){
    return (group?.sessions||[])
      .flatMap(session=>session.activities||[])
      .sort((a,b)=>{
        const at=validDate(a?.startedAt)?.getTime();
        const bt=validDate(b?.startedAt)?.getTime();
        if(Number.isFinite(at)&&Number.isFinite(bt)&&at!==bt)return at-bt;
        if(Number.isFinite(at)!==Number.isFinite(bt))return Number.isFinite(at)?-1:1;
        return Number(a?.sortOrder??999)-Number(b?.sortOrder??999)||byName(a?.name||'',b?.name||'');
      });
  }
  function groupWorkout(group){return (group?.sessions||[]).flatMap(session=>session.workout||[]).filter(item=>item.status!=='skipped');}
  function groupCircuits(group){return (group?.sessions||[]).filter(session=>session.circuitRun);}
  function groupParticipants(group){
    const names=new Set();
    (group?.sessions||[]).forEach(session=>{
      (session.participants||[]).forEach(name=>names.add(String(name)));
      (session.activities||[]).forEach(activity=>(activity.participants||[]).forEach(name=>names.add(String(name))));
      (session.workout||[]).forEach(exercise=>(exercise.participants||[]).forEach(name=>names.add(String(name))));
    });
    return [...names].filter(Boolean).sort(byName);
  }
  function groupDuration(group){
    const sessions=group?.sessions||[];
    const xtraining=sessions.find(session=>session.kind==='xtraining');
    if(xtraining?.gymArrivedAt&&xtraining?.gymLeftAt){
      return Math.max(0,Math.round((new Date(xtraining.gymLeftAt)-new Date(xtraining.gymArrivedAt))/60000));
    }
    const starts=sessions.map(session=>validDate(session.startedAt)).filter(Boolean).sort((a,b)=>a-b);
    const ends=sessions.map(session=>validDate(session.endedAt)).filter(Boolean).sort((a,b)=>a-b);
    if(starts.length&&ends.length&&ends[ends.length-1]>=starts[0])return Math.max(0,Math.round((ends[ends.length-1]-starts[0])/60000));
    return sessions.reduce((best,session)=>Math.max(best,sessionMinutes(session)),0);
  }

  function groupTimeWindow(group){
    const sessions=group?.sessions||[];
    const xtraining=sessions.find(session=>session.kind==='xtraining');
    if(xtraining?.gymArrivedAt&&xtraining?.gymLeftAt)return clock(xtraining.gymArrivedAt)+'–'+clock(xtraining.gymLeftAt);
    const starts=sessions.map(session=>validDate(session.startedAt)).filter(Boolean).sort((a,b)=>a-b);
    const ends=sessions.map(session=>validDate(session.endedAt)).filter(Boolean).sort((a,b)=>a-b);
    return starts.length&&ends.length?clock(starts[0])+'–'+clock(ends[ends.length-1]):'Zeit nicht vollständig dokumentiert';
  }

  const historyTimestamp=value=>{
    const d=validDate(value);
    return d?d.getTime():null;
  };
  const historyRange=(startAt,endAt)=>{
    const start=validDate(startAt),end=validDate(endAt);
    if(start&&end){
      const a=clock(startAt),b=clock(endAt);
      return a===b?a:a+'–'+b;
    }
    if(start)return 'ab '+clock(startAt);
    if(end)return 'bis '+clock(endAt);
    return 'Zeit offen';
  };
  function groupChronology(group){
    const events=[];
    (group?.sessions||[]).forEach(session=>{
      (session.activities||[]).forEach(activity=>{
        if(activity?.type==='test_course_plan')return;
        const startMs=historyTimestamp(activity?.startedAt);
        const endMs=historyTimestamp(activity?.endedAt);
        events.push({
          kind:'course',item:activity,
          startAt:activity?.startedAt||null,endAt:activity?.endedAt||null,
          startMs,endMs,order:Number(activity?.sortOrder??999)
        });
      });
      (session.workout||[]).filter(item=>item?.status!=='skipped').forEach(exercise=>{
        const startMs=historyTimestamp(exercise?.startedAt);
        const endMs=historyTimestamp(exercise?.endedAt);
        events.push({
          kind:'workout',item:exercise,
          startAt:exercise?.startedAt||null,endAt:exercise?.endedAt||null,
          startMs,endMs,order:Number(exercise?.sortOrder??999)
        });
      });
      const run=session?.circuitRun;
      if(run){
        const startAt=run.startedAt||session.startedAt||null;
        const endAt=run.endedAt||session.endedAt||null;
        events.push({
          kind:'circuit',item:session,
          startAt,endAt,startMs:historyTimestamp(startAt),endMs:historyTimestamp(endAt),order:999
        });
      }
    });

    const sortMoment=event=>event.startMs??event.endMs??Number.MAX_SAFE_INTEGER;
    const typeOrder={workout:0,course:1,circuit:2};
    events.sort((a,b)=>
      sortMoment(a)-sortMoment(b)
      ||(a.endMs??Number.MAX_SAFE_INTEGER)-(b.endMs??Number.MAX_SAFE_INTEGER)
      ||(typeOrder[a.kind]??9)-(typeOrder[b.kind]??9)
      ||a.order-b.order
    );

    const timeline=[];
    let freeSegmentIndex=0;
    events.forEach(event=>{
      if(event.kind!=='workout'){
        timeline.push(event);
        return;
      }
      const previous=timeline[timeline.length-1];
      if(previous?.kind==='workout'){
        previous.items.push(event.item);
        if(previous.startMs===null||previous.startMs===undefined){
          previous.startMs=event.startMs;
          previous.startAt=event.startAt;
        }
        if(event.endMs!==null&&event.endMs!==undefined&&(previous.endMs===null||previous.endMs===undefined||event.endMs>previous.endMs)){
          previous.endMs=event.endMs;
          previous.endAt=event.endAt;
        }
        return;
      }
      freeSegmentIndex+=1;
      timeline.push({
        kind:'workout',
        items:[event.item],
        startAt:event.startAt,endAt:event.endAt,startMs:event.startMs,endMs:event.endMs,
        segmentIndex:freeSegmentIndex
      });
    });
    const freeSegments=timeline.filter(event=>event.kind==='workout').length;
    timeline.forEach(event=>{if(event.kind==='workout')event.totalSegments=freeSegments;});
    return timeline;
  }

  function workoutTimelineCard(exercise){
    return '<div class="sport-history-workout-step-v748">'+
      '<small>'+esc(historyRange(exercise?.startedAt,exercise?.endedAt))+'</small>'+
      workoutSummaryCard(exercise)+
    '</div>';
  }

  function historyChronologyMarkup(group){
    const timeline=groupChronology(group);
    if(!timeline.length)return '';
    return '<div class="sport-history-flow-v748">'+timeline.map((event,index)=>{
      const railTime=event.startAt?clock(event.startAt):(event.endAt?clock(event.endAt):'–');
      if(event.kind==='course'){
        return '<div class="sport-history-flow-step-v748 is-course">'+
          '<div class="sport-history-flow-rail-v748"><span>'+esc(railTime)+'</span><i></i></div>'+
          '<section class="sport-history-flow-content-v748"><b class="sport-history-flow-label-v748">KURS</b>'+courseCard(event.item,index,false)+'</section>'+
        '</div>';
      }
      if(event.kind==='circuit'){
        return '<div class="sport-history-flow-step-v748 is-circuit">'+
          '<div class="sport-history-flow-rail-v748"><span>'+esc(railTime)+'</span><i></i></div>'+
          '<section class="sport-history-flow-content-v748"><b class="sport-history-flow-label-v748">ZIRKELTRAINING</b>'+circuitRunCard(event.item)+'</section>'+
        '</div>';
      }
      const label=event.totalSegments>1
        ?(event.segmentIndex===1?'FREIES TRAINING · START':'FREIES TRAINING · FORTGESETZT')
        :'FREIES TRAINING';
      return '<div class="sport-history-flow-step-v748 is-workout">'+
        '<div class="sport-history-flow-rail-v748"><span>'+esc(railTime)+'</span><i></i></div>'+
        '<section class="sport-history-flow-content-v748">'+
          '<div class="sport-history-flow-head-v748"><b class="sport-history-flow-label-v748">'+esc(label)+'</b><small>'+esc(historyRange(event.startAt,event.endAt))+'</small></div>'+
          '<div class="sport-history-workout-v574">'+event.items.map(workoutTimelineCard).join('')+'</div>'+
        '</section>'+
      '</div>';
    }).join('')+'</div>';
  }

  function workoutType(item){
    if(item?.kind==='cardio')return 'cardio_machine';
    if(item?.itemType)return item.itemType;
    const catalog=state.catalogExercises.find(entry=>String(entry.id)===String(item?.exerciseId));
    return catalog?.item_type||catalog?.itemType||(item?.equipmentId?'strength_machine':'free_exercise');
  }
  function workoutBreakdown(workout){
    const counts={cardio:0,machine:0,free:0,outdoor:0,other:0};
    (workout||[]).forEach(item=>{
      const type=workoutType(item);
      if(type==='cardio_machine')counts.cardio++;
      else if(type==='strength_machine')counts.machine++;
      else if(type==='free_exercise')counts.free++;
      else if(type==='outdoor_activity')counts.outdoor++;
      else counts.other++;
    });
    return counts;
  }
  function countLabel(count,singular,plural){return count+' '+(count===1?singular:plural);}
  function circuitProgressParts(run){
    if(!run)return ['Zirkeltraining'];
    if(run.status==='completed')return [countLabel(run.plannedRounds,'Runde abgeschlossen','Runden abgeschlossen')];
    const parts=[countLabel(run.completedRounds,'Runde abgeschlossen','Runden abgeschlossen')];
    const exercise=run.exercises[Math.max(0,run.currentExerciseIndex-1)];
    if(run.currentRound>run.completedRounds){
      let stop='Abbruch in Runde '+run.currentRound;
      if(exercise)stop+=' · Übung '+run.currentExerciseIndex+' '+exercise.name;
      if(run.currentElapsedSeconds>0)stop+=' · '+Math.round(run.currentElapsedSeconds)+' s';
      parts.push(stop);
    }else if(exercise){
      parts.push('Abbruch nach '+exercise.name);
    }else parts.push('Abgebrochen');
    return parts;
  }

  function circuitProgressSummary(run){
    return circuitProgressParts(run).join(' · ');
  }

  function workoutBreakdownParts(workout){
    const counts=workoutBreakdown(workout);
    const parts=[];
    if(counts.machine)parts.push(countLabel(counts.machine,'Trainingsgerät','Trainingsgeräte'));
    if(counts.cardio)parts.push(countLabel(counts.cardio,'Cardio-Gerät','Cardio-Geräte'));
    if(counts.free)parts.push(countLabel(counts.free,'freie Übung','freie Übungen'));
    if(counts.outdoor)parts.push(countLabel(counts.outdoor,'Outdoor-Aktivität','Outdoor-Aktivitäten'));
    if(counts.other)parts.push(countLabel(counts.other,'Übung','Übungen'));
    return parts;
  }

  function workoutBreakdownText(workout){
    return workoutBreakdownParts(workout).join(' · ');
  }

  function historyChildLine(text,prefix='↳'){
    return '<small class="sport-unit-summary-child-v636"><i>'+esc(prefix)+'</i><span>'+esc(text)+'</span></small>';
  }

  function groupSummaryHtml(group){
    const activities=groupActivities(group);
    const workout=groupWorkout(group);
    const circuits=groupCircuits(group);
    const people=groupParticipants(group);
    const parts=venueParts(group?.venue);
    const venue=parts.type+(parts.detail?' · '+parts.detail:'');
    const rows=[];

    if(activities.length){
      rows.push('<span class="sport-unit-summary-main-v635">Kurse</span>');
      rows.push(historyChildLine(countLabel(activities.length,'Kurs','Kurse')));
    }

    if(workout.length){
      rows.push('<span class="sport-unit-summary-main-v635">Freies Training</span>');
      workoutBreakdownParts(workout).forEach(detail=>rows.push(historyChildLine(detail)));
    }

    if(circuits.length){
      rows.push('<span class="sport-unit-summary-main-v635">Zirkeltraining</span>');
      if(circuits.length===1){
        circuitProgressParts(circuits[0].circuitRun).forEach(detail=>rows.push(historyChildLine(detail,'·')));
      }else{
        rows.push(historyChildLine(countLabel(circuits.length,'Zirkeltraining','Zirkeltrainings')));
      }
    }

    if(!rows.length)rows.push(historyChildLine('Einheit ohne Detailangaben'));
    if(people.length)rows.push('<small class="sport-unit-summary-people-v635">mit '+people.map(esc).join(', ')+'</small>');

    return '<span class="sport-unit-summary-v635">'+
      '<em class="sport-unit-summary-venue-v635">'+esc(venue||'Ort offen')+'</em>'+
      rows.join('')+
    '</span>';
  }

  function groupSummaryHtml(group){
    const activities=groupActivities(group);
    const workout=groupWorkout(group);
    const circuits=groupCircuits(group);
    const people=groupParticipants(group);
    const parts=venueParts(group?.venue);
    const venue=parts.type+(parts.detail?' · '+parts.detail:'');
    const rows=[];

    if(activities.length){
      rows.push('<span class="sport-unit-summary-main-v635">'+esc(countLabel(activities.length,'Kurs','Kurse'))+'</span>');
    }

    if(workout.length){
      rows.push('<span class="sport-unit-summary-main-v635">Freies Training</span>');
      const breakdown=workoutBreakdownText(workout);
      if(breakdown)rows.push('<small class="sport-unit-summary-child-v635">↳ '+esc(breakdown)+'</small>');
    }

    if(circuits.length){
      if(circuits.length===1){
        rows.push('<span class="sport-unit-summary-main-v635">Zirkeltraining</span>');
        rows.push('<small class="sport-unit-summary-child-v635">↳ '+esc(circuitProgressSummary(circuits[0].circuitRun))+'</small>');
      }else{
        rows.push('<span class="sport-unit-summary-main-v635">'+esc(countLabel(circuits.length,'Zirkeltraining','Zirkeltrainings'))+'</span>');
      }
    }

    if(!rows.length)rows.push('<small class="sport-unit-summary-child-v635">Einheit ohne Detailangaben</small>');
    if(people.length)rows.push('<small class="sport-unit-summary-people-v635">mit '+people.map(esc).join(', ')+'</small>');

    return '<span class="sport-unit-summary-v635">'+
      '<em class="sport-unit-summary-venue-v635">'+esc(venue||'Ort offen')+'</em>'+
      rows.join('')+
    '</span>';
  }

  function courseCard(activity,index=0,editable=false){
    const names=activity.participants||[];
    const people=names.length?' · '+names.join(', '):'';
    const editor=editable
      ?'<div class="sport-course-people-v629">'+
        (names.length?'<div class="sport-course-people-chips-v629">'+names.map(name=>
          '<span>'+esc(name)+'<button type="button" data-sport-remove-activity-participant="'+esc(activity.id)+'" data-participant-name="'+esc(name)+'" aria-label="'+esc(name)+' entfernen">×</button></span>'
        ).join('')+'</div>':'')+
        '<form data-sport-activity-participants="'+esc(activity.id)+'"><input name="participants" value="'+esc(names.join(', '))+'" placeholder="Teilnehmer"><button type="submit">Speichern</button></form>'+
      '</div>'
      :'';
    return '<article class="sport-course-card-v568 sport-course-card-compact-v610" style="--sport-course-index-v568:'+index+'"><div class="sport-course-top-v568"><div><h3>'+esc(activity.name)+'</h3><div class="sport-card-sub-v510">'+esc(clock(activity.startedAt))+'–'+esc(clock(activity.endedAt)+people)+'</div></div><span class="sport-chip-v510">'+esc(formatMinutes(activityMinutes(activity)))+'</span></div>'+editor+'</article>';
  }

  function historyParticipantsEditor(session){
    const rows=sessionParticipantRows(session.id);
    return '<section class="sport-history-meta-block-v629">'+
      '<div class="sport-history-meta-title-v629"><strong>Teilnehmer</strong><small>für den Trainingstag</small></div>'+
      '<div class="sport-history-participant-chips-v629">'+
        (rows.length?rows.map(row=>'<span>'+esc(row.participant_name)+'<button type="button" data-sport-remove-participant="'+esc(row.id)+'" aria-label="'+esc(row.participant_name)+' entfernen">×</button></span>').join(''):'<em>Noch niemand eingetragen.</em>')+
      '</div>'+
      '<form class="sport-history-participant-form-v629" data-sport-participant-form="'+esc(session.id)+'">'+
        '<input name="participant" placeholder="Teilnehmer hinzufügen" autocomplete="off" required>'+
        '<button type="submit">+ Hinzufügen</button>'+
      '</form>'+
    '</section>';
  }

  function historyTimeEditor(session){
    return '<section class="sport-history-meta-block-v629">'+
      '<div class="sport-history-meta-title-v629"><strong>FitX-Zeit</strong><small>Ankunft bis Verlassen</small></div>'+
      '<form class="sport-history-time-form-v629" data-sport-session-times="'+esc(session.id)+'" data-session-date="'+esc(session.date)+'">'+
        '<label>Ankunft<input type="time" name="gym_arrived_at" value="'+esc(inputTime(session.gymArrivedAt))+'"></label>'+
        '<label>Verlassen<input type="time" name="gym_left_at" value="'+esc(inputTime(session.gymLeftAt))+'"></label>'+
        '<button type="submit">Speichern</button>'+
      '</form>'+
    '</section>';
  }

  function historyMetaEditor(session){
    return '<div class="sport-history-meta-editor-v629">'+historyParticipantsEditor(session)+(isFitx(session)?historyTimeEditor(session):'')+'</div>';
  }

  function circuitRunCard(session){
    const run=session?.circuitRun;
    if(!run)return '';
    const status=run.status==='completed'?'Abgeschlossen':'Abgebrochen';
    const settings=[
      run.workSeconds+' s Arbeit',
      run.restSeconds+' s Stationspause',
      run.roundBreakSeconds+' s Rundenpause'
    ].join(' · ');
    const time=(run.startedAt?clock(run.startedAt):'–')+(run.endedAt?'–'+clock(run.endedAt):'');
    const list=(run.exercises||[]).length
      ?'<ol class="sport-circuit-exercises-v675">'+run.exercises.map((item,index)=>{
          const current=run.status!=='completed'&&index===Math.max(0,run.currentExerciseIndex-1);
          return '<li class="'+(current?'is-stop-v675':'')+'"><span>'+(index+1)+'</span><div><strong>'+esc(item.name)+'</strong>'+(item.settings?'<small>'+esc(item.settings)+'</small>':'')+'</div></li>';
        }).join('')+'</ol>'
      :'<div class="sport-empty-inline-v568">Keine Übungssnapshots vorhanden.</div>';
    return '<article class="sport-circuit-history-v675">'+
      '<div class="sport-circuit-history-head-v675"><div><span>ZIRKELTRAINING</span><strong>'+esc(run.name)+'</strong></div><b class="'+(run.status==='completed'?'is-done-v675':'is-stop-v675')+'">'+esc(status)+'</b></div>'+
      '<p>'+esc(circuitProgressSummary(run))+'</p>'+
      '<small>'+esc(time)+' · '+esc(settings)+' · '+Math.round(run.totalActiveSeconds)+' s Belastung</small>'+
      list+
    '</article>';
  }

  function unitCard(group,index=0){
    const courses=groupActivities(group),workout=groupWorkout(group),circuits=groupCircuits(group);
    const targetSession=(group.sessions||[]).find(session=>session.kind==='xtraining'&&(session.workout||[]).length)||(group.sessions||[]).find(session=>session.kind==='xtraining')||null;
    const editing=targetSession&&String(editingSessionId||'')===String(targetSession.id);
    return '<details class="sport-history-detail-v574 sport-unit-detail-v610 sport-unit-detail-v635 '+(editing?'is-editing-v613':'')+'" style="--sport-row-index-v568:'+index+'" '+(editing?'open':'')+'>'+
      '<summary>'+
        '<strong class="sport-unit-date-v635">'+esc(shortDate(group.date))+'</strong>'+
        groupSummaryHtml(group)+
        '<b class="sport-unit-duration-v635">'+esc(formatMinutes(groupDuration(group)))+'</b>'+
      '</summary>'+
      '<div class="sport-unit-body-v610">'+
        (targetSession?'<div class="sport-history-edit-toolbar-v613">'+
          (editing
            ?'<button type="button" data-sport-open-catalog data-session-id="'+esc(targetSession.id)+'">+ Übung</button><button type="button" data-sport-stop-edit-session>Bearbeitung schließen</button>'
            :'<button type="button" data-sport-edit-session="'+esc(targetSession.id)+'">Training bearbeiten</button>')+
        '</div>':'')+
        (editing&&targetSession?historyMetaEditor(targetSession):'')+
        (editing
          ?((courses.length?'<div class="sport-section-title-v568">Kurse</div><div class="sport-course-list-v568">'+courses.map((course,courseIndex)=>courseCard(course,courseIndex,true)).join('')+'</div>':'')
            +(workout.length?'<div class="sport-section-title-v568">Freies Training</div><div class="sport-workout-list-v573 sport-history-edit-list-v613">'+(targetSession.workout||[]).map(workoutExerciseCard).join('')+'</div>':'')
            +(circuits.length?'<div class="sport-section-title-v568">Zirkeltraining</div><div class="sport-circuit-history-list-v675">'+circuits.map(circuitRunCard).join('')+'</div>':''))
          :historyChronologyMarkup(group))+
      '</div></details>';
  }

  function completedSessions(rows){return (Array.isArray(rows)?rows:[]).filter(session=>!session.isTest&&(session.status==='completed'||(session.kind==='circuit'&&session.status==='cancelled')));}
  function unitHistory(rows){
    const groups=groupSessions(completedSessions(rows));
    return groups.length?'<div class="sport-unit-list-v610">'+groups.map(unitCard).join('')+'</div>':'<div class="sport-empty-inline-v568">Noch keine dokumentierten Trainingseinheiten.</div>';
  }
  function isSessionActive(session){
    if(!session||session.status==='completed'||session.status==='cancelled')return false;
    return session.status==='running'||Boolean(session.driveStartedAt||session.gymArrivedAt||session.trainingStartedAt||session.trainingEndedAt||session.gymLeftAt);
  }
  function activeTrainingSession(){
    return state.sessions.find(session=>session.kind==='xtraining'&&isSessionActive(session))||null;
  }
  function planSessionForDate(dateKey){
    return state.sessions.find(session=>
      session.kind==='xtraining'&&
      session.date===dateKey&&
      session.status==='planned'&&
      Boolean(session.isTest)===Boolean(planTestMode)
    )||null;
  }

  function currentGroupFor(session,rows){
    if(!session)return null;
    if(session.isTest)return {date:session.date,venue:session.venue||'Ort offen',sessions:[session]};
    return groupSessions(rows).find(group=>(group.sessions||[]).some(item=>item.id===session.id))||{date:session.date,venue:session.venue||'Ort offen',sessions:[session]};
  }
  function workoutLists(session,{hideRunning=false}={}){
    const items=(session?.workout||[]);
    const open=items.filter(item=>(item.status==='planned'||item.status==='running')&&!(hideRunning&&item.status==='running'));
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

  function activeSessionStart(session){
    if(isFitx(session))return validDate(session?.gymArrivedAt);
    return validDate(session?.startedAt||(session?.workout||[]).find(item=>item.startedAt)?.startedAt);
  }

  function elapsedClockText(start){
    const d=validDate(start);
    if(!d)return '00:00:00';
    const total=Math.max(0,Math.floor((Date.now()-d.getTime())/1000));
    const h=Math.floor(total/3600);
    const m=Math.floor((total%3600)/60);
    const s=total%60;
    return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  }

  function startActiveClock(root){
    if(activeClockTimer){clearInterval(activeClockTimer);activeClockTimer=null;}
    const target=root?.querySelector?.('[data-sport-active-elapsed]');
    if(!target)return;
    const startMs=Number(target.dataset.startMs||0);
    if(!Number.isFinite(startMs)||startMs<=0)return;
    const paint=()=>{
      const total=Math.max(0,Math.floor((Date.now()-startMs)/1000));
      const h=Math.floor(total/3600);
      const m=Math.floor((total%3600)/60);
      const s=total%60;
      target.textContent=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
    };
    paint();
    activeClockTimer=setInterval(paint,1000);
  }

  function activeExerciseTitle(exercise){
    if(!exercise)return '';
    const catalog=state.catalogExercises.find(item=>String(item.id)===String(exercise.exerciseId));
    const number=exercise.equipmentNumber||catalog?.equipment_number||'';
    return (number?number+' ':'')+exercise.name;
  }

  function savedSetSummary(set,loadMode){
    if(!set)return '';
    const parts=[];
    if(set.weightKg!==null)parts.push((loadMode==='assistance'?'Unterstützung ':'')+set.weightKg+' kg');
    if(set.repetitions!==null)parts.push(set.repetitions+' Wdh.');
    if(set.rir!==null)parts.push('RIR '+set.rir+(set.rirPlus?'+':''));
    return parts.join(' · ')||'gespeichert';
  }

  function activeStrengthEditor(exercise){
    const count=strengthSetCount(exercise);
    const setMap=new Map((exercise.sets||[]).map(set=>[set.setNumber,set]));
    const catalog=state.catalogExercises.find(item=>String(item.id)===String(exercise.exerciseId));
    const loadMode=exercise.loadMode||catalog?.load_mode||'weight';
    const kgLabel=loadMode==='assistance'?'Unterstützung kg':'kg';
    const previous=previousWorkoutValue(exercise);
    let nextNo=null;
    for(let no=1;no<=count;no++){
      const set=setMap.get(no);
      if(!set?.id){nextNo=no;break;}
    }
    const saved=[...setMap.values()].filter(set=>set?.id).sort((a,b)=>a.setNumber-b.setNumber);
    const savedHtml=saved.length
      ?'<details class="sport-active-saved-sets-v719"><summary>Gespeicherte Sätze · '+saved.length+'</summary><div>'+saved.map(set=>'<span><b>S'+set.setNumber+'</b><em>'+esc(savedSetSummary(set,loadMode))+'</em></span>').join('')+'</div></details>'
      :'';

    if(nextNo===null){
      return '<div class="sport-active-strength-v719">'+
        '<div class="sport-active-all-sets-v719"><strong>Alle '+count+' Sätze gespeichert</strong><span>Du kannst die Übung jetzt abschließen oder noch einen Satz ergänzen.</span></div>'+
        savedHtml+
        '<button type="button" class="sport-active-add-set-v719" data-sport-add-set="'+esc(exercise.id)+'">+ Satz</button>'+
      '</div>';
    }

    const set=setMap.get(nextNo)||{};
    const rirValue=set.rir===null||set.rir===undefined?'0':String(set.rir)+(set.rirPlus?'+':'');
    return '<div class="sport-active-strength-v719">'+
      savedHtml+
      '<form class="sport-active-set-form-v719 sport-set-row-v573 sport-set-row-v613" data-sport-set-form data-exercise-id="'+esc(exercise.id)+'" data-set-number="'+nextNo+'">'+
        '<div class="sport-active-set-head-v719"><span>AKTUELLER SATZ</span><strong>Satz '+nextNo+' von '+count+'</strong></div>'+
        '<label><span>'+esc(kgLabel)+'</span><input name="weight_kg" type="number" min="0" step="0.5" inputmode="decimal" value="'+esc(set.weightKg??'')+'"></label>'+
        '<label><span>Wdh.</span><input name="repetitions" type="number" min="0" step="1" inputmode="numeric" value="'+esc(set.repetitions??'')+'"></label>'+
        '<label><span>RIR</span>'+rirStepper(rirValue)+'</label>'+
        '<small class="sport-set-last-v612 sport-set-last-v613">'+esc(previousSetText(previous,nextNo,loadMode))+'</small>'+
        '<button type="button" class="sport-set-save-v613" data-sport-active-next-set="'+esc(exercise.id)+'">'+(nextNo<count?'+ Satz':'Satz speichern')+'</button>'+
      '</form>'+
    '</div>';
  }

  function fitxArrivalGate(session){
    if(!isFitx(session)||session?.gymArrivedAt)return '';
    return '<section class="sport-fitx-arrival-gate-v720">'+
      '<div><span>FITX · ANKUNFT</span><h2>Erst ankommen, dann Training starten</h2><small>Hier wird nur deine Ankunft bei FitX erfasst. Training und erste Übung startest du danach separat.</small></div>'+
      '<button type="button" data-sport-timeline="'+esc(session.id)+'" data-column="gym_arrived_at">Bei FitX angekommen</button>'+
    '</section>';
  }

  function fitxTrainingStartGate(session){
    if(!isFitx(session)||!session?.gymArrivedAt||session?.trainingStartedAt||session?.trainingEndedAt)return '';
    return '<section class="sport-fitx-arrival-gate-v720">'+
      '<div><span>FITX · ANGEKOMMEN</span><h2>Bereit fürs Training?</h2><small>Umziehen und Quatschen zählen zur FitX-Zeit, aber das eigentliche Training startet erst hier.</small></div>'+
      '<button type="button" data-sport-start-plan="'+esc(session.id)+'">Training starten</button>'+
    '</section>';
  }

  function fitxDepartureGate(session){
    if(!isFitx(session)||!session?.trainingEndedAt||session?.gymLeftAt)return '';
    return '<section class="sport-fitx-arrival-gate-v720">'+
      '<div><span>TRAINING ABGESCHLOSSEN</span><h2>Noch bei FitX</h2><small>Umziehen, quatschen, duschen oder noch dekorativ herumstehen. Erst beim Rausgehen beendest du den FitX-Aufenthalt.</small></div>'+
      '<button type="button" data-sport-timeline="'+esc(session.id)+'" data-column="gym_left_at">FitX verlassen</button>'+
    '</section>';
  }

  function activeExerciseFocus(session){
    if(isFitx(session)&&!session?.gymArrivedAt)return fitxArrivalGate(session);
    if(isFitx(session)&&session?.trainingEndedAt&&!session?.gymLeftAt)return fitxDepartureGate(session);
    if(isFitx(session)&&!session?.trainingStartedAt)return fitxTrainingStartGate(session);
    const ordered=[...(session?.workout||[])].sort((a,b)=>a.sortOrder-b.sortOrder);
    const exercise=ordered.find(item=>item.status==='running')||null;
    const next=ordered.find(item=>item.status==='planned')||null;
    if(!exercise){
      if(next){
        const hasCompleted=ordered.some(item=>item.status==='completed'||item.status==='skipped');
        return '<section class="sport-active-exercise-focus-v719 is-waiting"><div class="sport-active-exercise-head-v719"><div><span>'+(hasCompleted?'FREIES TRAINING · PAUSIERT':'NÄCHSTE ÜBUNG')+'</span><h2>'+esc(activeExerciseTitle(next))+'</h2></div><button type="button" data-sport-exercise-status="'+esc(next.id)+'" data-status="running">'+(hasCompleted?'Training fortsetzen':'Jetzt starten')+'</button></div></section>';
      }
      return '<section class="sport-active-exercise-focus-v719 is-empty"><strong>Keine offene Übung</strong><span>Freies Training ist erst erledigt, wenn du das Training ausdrücklich abschließt.</span></section>';
    }

    const catalog=state.catalogExercises.find(item=>String(item.id)===String(exercise.exerciseId));
    const type=catalog?.item_type||(exercise.kind==='cardio'?'cardio_machine':'free_exercise');
    const meta=catalog?.category||catalog?.muscle_group||(exercise.kind==='cardio'?'Cardio':'Kraft');
    const settings=exercise.settingsText||catalog?.settings_text||'';
    return '<section class="sport-active-exercise-focus-v719">'+
      '<div class="sport-active-exercise-head-v719">'+
        '<div><span>JETZT · '+esc(itemTypeLabel(type))+' · '+esc(meta)+'</span><h2>'+esc(activeExerciseTitle(exercise))+'</h2>'+(settings?'<small>'+esc(settings)+'</small>':'')+'</div>'+
        executionHelpButton(catalog)+
      '</div>'+
      '<div class="sport-active-exercise-editor-v719">'+
        workoutHistory(exercise)+
        (exercise.kind==='cardio'?cardioEditor(exercise):activeStrengthEditor(exercise))+
      '</div>'+
      '<div class="sport-active-exercise-actions-v719">'+
        '<button type="button" class="primary" data-sport-exercise-status="'+esc(exercise.id)+'" data-status="completed">Übung fertig</button>'+
        (exercise.kind==='cardio'?'<button type="button" data-sport-exercise-status="'+esc(exercise.id)+'" data-status="skipped">Überspringen</button>':'')+
      '</div>'+
    '</section>';
  }

  function fitxPanel(rows){
    const active=activeTrainingSession();
    if(active){
      const current=currentGroupFor(active,rows);
      const courses=groupActivities(current).filter(activity=>activity.type!=='test_course_plan');
      const plannedTestCourses=active.isTest?(active.activities||[]).filter(activity=>activity.type==='test_course_plan'):[];
      const people=groupParticipants(current);
      const location=active.venue||'Ort offen';
      const fitx=isFitx(active);
      const start=activeSessionStart(active);
      const startMs=start?start.getTime():0;
      const startedLabel=start?clock(start):'–';
      const courseHtml=courses.length?'<div class="sport-section-title-v568">Kurse'+(people.length?' · '+people.map(esc).join(', '):'')+'</div><div class="sport-course-list-v568">'+courses.map((course,index)=>courseCard(course,index,true)).join('')+'</div>':'';
      const testPeople=knownSportParticipants();
      const testPeopleListId='sport-active-test-course-people-v717';
      const testPeopleList=testPeople.length?'<datalist id="'+testPeopleListId+'">'+testPeople.map(name=>'<option value="'+esc(name)+'"></option>').join('')+'</datalist>':'';
      const plannedTestCourseHtml=plannedTestCourses.length
        ?'<div class="sport-section-title-v568">Kurse im Testplan</div>'+testPeopleList+'<div class="sport-test-course-list-v717">'+plannedTestCourses.map(activity=>{
          const courseId=testCourseActivityCourseId(activity);
          const course=(state.courseCatalog||[]).find(item=>String(item.id)===String(courseId||''));
          return '<form data-sport-test-course-attendance="'+esc(activity.id)+'" data-course-id="'+esc(courseId||'')+'"><div><strong>'+esc(activity.name)+'</strong><span>'+(course?esc(courseClock(course.start_time))+'–'+esc(courseClock(course.end_time))+' · ':'')+'TEST</span></div><input name="participants" list="'+testPeopleListId+'" placeholder="Mit wem?"><button type="submit">Teilgenommen testen</button></form>';
        }).join('')+'</div>'
        :'';
      const timingHtml=fitx?timelineBlock(active)+sessionTimeEditor(active):'';
      const clockSub=start
        ?(fitx?'bei FitX seit '+esc(startedLabel)+' Uhr':'Training seit '+esc(startedLabel)+' Uhr')
        :(fitx?'Noch keine Ankunft gespeichert · Zeit startet erst dann':'Training läuft');
      const completionAction=active.isTest
        ?'<div class="sport-active-actions-v627"><button type="button" data-sport-complete-session="'+esc(active.id)+'">Testlauf beenden & verwerfen</button></div>'
        :((fitx&&(!active.trainingStartedAt||active.trainingEndedAt))
          ?''
          :'<div class="sport-active-actions-v627"><button type="button" data-sport-complete-session="'+esc(active.id)+'">Training abschließen</button></div>');

      return '<section class="sport-panel-v510 sport-panel-v512 '+(active.isTest?'sport-test-session-v717':'')+'" data-sport-panel-v568="overview">'+wave()+
        '<div class="sport-hero-v510 sport-active-hero-v623 sport-active-hero-v719"><div class="sport-kicker-v510"><span class="sport-live-dot-v510"></span>AKTIV · '+(active.isTest?'TESTEINHEIT':'LAUFENDE EINHEIT')+' '+statusBadge()+'</div>'+
        '<p class="sport-date-v510">'+esc(dateLabel(active.date))+' · '+esc(location)+'</p>'+
        activeExerciseFocus(active)+
        '<div class="sport-active-time-row-v719 '+(fitx&&!start?'is-waiting-v720':'')+'"><span>'+esc(clockSub)+'</span><strong data-sport-active-elapsed data-start-ms="'+startMs+'">'+esc(elapsedClockText(start))+'</strong></div>'+
        '</div>'+
        '<div class="sport-content-v510">'+
          (active.isTest?'<div class="sport-test-banner-v717"><strong>TESTMODUS</strong><span>Diese Einheit wird nicht in Einheiten, Statistik oder „Letztes Mal“ übernommen. Beim Beenden werden die Testdaten verworfen.</span></div>':'')+
          '<div class="sport-active-circuit-slot-v634" data-sport-active-circuit-slot></div>'+
          timingHtml+
          participantsBlock(active)+
          plannedTestCourseHtml+
          courseHtml+
          '<section class="sport-x-block-v573"><div class="sport-x-block-head-v573"><div><span>WEITERER ABLAUF</span><strong>Übungen</strong></div><button type="button" data-sport-open-catalog data-session-id="'+esc(active.id)+'">+ Übung hinzufügen</button></div>'+workoutLists(active,{hideRunning:true})+'</section>'+
          completionAction+
          errorNote()+
        '</div></section>';
    }
    return '<section class="sport-panel-v510 sport-panel-v512" data-sport-panel-v568="overview">'+wave()+'<div class="sport-hero-v510 sport-active-hero-v623"><div class="sport-kicker-v510"><span class="sport-live-dot-v510"></span>AKTIV '+statusBadge()+'</div><p class="sport-date-v510" data-sport-active-slogan>Hier läuft gerade nix. Nicht mal du.</p></div><div class="sport-content-v510"><div class="sport-active-empty-v623" data-sport-active-empty><strong>Aktuell kein Training aktiv</strong><span>Sobald du einen geplanten Trainingstag startest, läuft er hier live.</span></div>'+errorNote()+'</div></section>';
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
      if(!existing.isTest&&existing.legacyAutoFitx){
        await updateSportSession(existing.id,{title:'Training',venue:'FitX'});
        return planSessionForDate(cleanDate);
      }
      return existing;
    }
    const {supabase,user}=await sportUser();
    const result=await supabase.from('sport_sessions').insert({
      user_id:user.id,
      session_date:cleanDate,
      title:planTestMode?'Testtraining':'Training',
      venue:'FitX',
      session_kind:'xtraining',
      session_status:'planned',
      source:planTestMode?'test':'manual',
      notes:planTestMode?'Explizite Testeinheit · von Historie und Statistik ausgeschlossen':null
    }).select('id').single();
    if(result.error)throw result.error;
    await load(true);
    return state.sessions.find(session=>session.id===result.data.id)||null;
  }

  async function deleteDayPlan(sessionId){
    const session=state.sessions.find(item=>String(item.id)===String(sessionId));
    if(!session)throw new Error('Tagesplan nicht gefunden.');
    if(session.status!=='planned')throw new Error('Nur geplante, noch nicht gestartete Trainingstage können gelöscht werden.');
    const {supabase,user}=await sportUser();

    if(!session.isTest){
      const courseResult=await supabase.from('sport_course_plans')
        .delete()
        .eq('user_id',user.id)
        .eq('plan_date',session.date);
      if(courseResult.error)throw courseResult.error;
      const occurrencesResult=await supabase.from('sport_course_occurrences')
        .delete().eq('user_id',user.id).eq('plan_date',session.date).eq('status','planned');
      if(occurrencesResult.error)throw occurrencesResult.error;
    }

    const result=await supabase.from('sport_sessions')
      .delete()
      .eq('id',session.id)
      .eq('user_id',user.id)
      .eq('session_status','planned');
    if(result.error)throw result.error;

    if(String(planDate)===String(session.date))coursePickerDate=null;
    await load(true);
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
    if(!session)throw new Error('Trainingstag nicht gefunden.');
    const otherActive=activeTrainingSession();
    if(otherActive&&String(otherActive.id)!==String(sessionId))throw new Error('Es läuft bereits eine andere Trainingseinheit. Beende oder verwirf sie zuerst.');

    const {supabase}=await sportUser();
    const stamp=new Date().toISOString();
    const fitx=isFitx(session)||session.legacyAutoFitx;
    const patch={session_status:'running'};
    if(fitx){
      if(!session.gymArrivedAt)throw new Error('Bestätige zuerst „Bei FitX angekommen“.');
      patch.training_started_at=session.trainingStartedAt||stamp;
    }else{
      // Home: activating the day only opens the session. The clock starts with the actual activity.
      // Circuit owns its own start time; free training starts when an exercise is explicitly started.
    }
    if(session.legacyAutoFitx){
      patch.title='Training';
      patch.venue='FitX';
    }

    let result=await supabase.from('sport_sessions').update(patch).eq('id',sessionId);
    if(result.error)throw result.error;

    await load(true);
  }

  async function markTimeline(sessionId,column){
    const allowed=new Set(TIMELINE_STEPS.map(step=>step[1]));
    if(!allowed.has(column))throw new Error('Unbekannter Zeitpunkt.');
    const session=state.sessions.find(item=>String(item.id)===String(sessionId));
    if(!session)throw new Error('Trainingstag nicht gefunden.');
    const {supabase}=await sportUser();
    const stamp=new Date().toISOString();
    const patch={[column]:stamp};

    if(column==='gym_arrived_at'){
      patch.started_at=stamp;
    }

    if(column==='gym_left_at'){
      if(!session.trainingEndedAt)throw new Error('Schließe zuerst das Training ab.');
      const start=validDate(session?.gymArrivedAt);
      patch.session_status='completed';
      patch.ended_at=stamp;
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

  function parseParticipantText(value){
    return [...new Set(String(value||'').split(/[,;+\n]/).map(name=>name.trim()).filter(Boolean))].sort(byName);
  }

  async function replaceExerciseParticipants(supabase,user,exerciseId,names){
    let result=await supabase.from('sport_session_exercise_participants').delete().eq('session_exercise_id',exerciseId);
    if(result.error)throw result.error;
    if(names.length){
      result=await supabase.from('sport_session_exercise_participants').insert(names.map(participant_name=>({
        user_id:user.id,session_exercise_id:exerciseId,participant_name
      })));
      if(result.error)throw result.error;
    }
  }

  async function saveExerciseParticipants(exerciseId,text,applyForward=false){
    const names=parseParticipantText(text);
    const session=state.sessions.find(item=>(item.workout||[]).some(exercise=>String(exercise.id)===String(exerciseId)));
    if(!session)throw new Error('Trainingselement nicht gefunden.');
    const ordered=[...(session.workout||[])].sort((a,b)=>a.sortOrder-b.sortOrder);
    const index=ordered.findIndex(item=>String(item.id)===String(exerciseId));
    const targets=applyForward&&index>=0?ordered.slice(index):ordered.filter(item=>String(item.id)===String(exerciseId));
    const {supabase,user}=await sportUser();
    for(const target of targets)await replaceExerciseParticipants(supabase,user,target.id,names);
    await load(true);
  }

  async function removeActivityParticipant(activityId,name){
    const clean=String(name||'').trim();
    if(!clean)return;
    const {supabase}=await sportUser();
    const result=await supabase.from('sport_activity_participants')
      .delete()
      .eq('activity_id',activityId)
      .eq('participant_name',clean);
    if(result.error)throw result.error;
    await load(true);
  }

  async function saveActivityParticipants(activityId,text){
    const names=parseParticipantText(text);
    const {supabase,user}=await sportUser();
    let result=await supabase.from('sport_activity_participants').delete().eq('activity_id',activityId);
    if(result.error)throw result.error;
    if(names.length){
      result=await supabase.from('sport_activity_participants').insert(names.map(participant_name=>({user_id:user.id,activity_id:activityId,participant_name})));
      if(result.error)throw result.error;
    }
    await load(true);
  }

  function inputTime(value){return value?clock(value):'';}

  function sessionTimeEditor(session){
    if(!isFitx(session))return '';
    return '<details class="sport-time-edit-v627"><summary>FitX-Zeiten bearbeiten</summary><form data-sport-session-times="'+esc(session.id)+'" data-session-date="'+esc(session.date)+'">'+
      '<label>Bei FitX angekommen<input type="time" name="gym_arrived_at" value="'+esc(inputTime(session.gymArrivedAt))+'"></label>'+
      '<label>FitX verlassen<input type="time" name="gym_left_at" value="'+esc(inputTime(session.gymLeftAt))+'"></label>'+
      '<button type="submit">Zeiten speichern</button>'+
    '</form></details>';
  }

  function localDateTimeIso(dateKey,time){
    const clean=String(time||'').trim();
    if(!clean)return null;
    if(!/^\d{2}:\d{2}$/.test(clean))throw new Error('Ungültige Uhrzeit.');
    const date=new Date(String(dateKey)+'T'+clean+':00');
    if(!Number.isFinite(date.getTime()))throw new Error('Ungültige Uhrzeit.');
    return date.toISOString();
  }

  async function saveSessionTimes(sessionId,dateKey,data){
    const arrived=localDateTimeIso(dateKey,data.get('gym_arrived_at'));
    const left=localDateTimeIso(dateKey,data.get('gym_left_at'));
    if(arrived&&left&&new Date(left)<new Date(arrived))throw new Error('Die Abfahrt muss nach der Ankunft liegen.');
    const session=state.sessions.find(item=>String(item.id)===String(sessionId));
    const patch={gym_arrived_at:arrived,gym_left_at:left};
    if(arrived)patch.started_at=arrived;
    patch.ended_at=left;
    if(arrived&&left)patch.duration_minutes=Math.max(0,Math.round((new Date(left)-new Date(arrived))/60000));
    if(left&&(session?.trainingEndedAt||session?.status==='completed'))patch.session_status='completed';

    const {supabase}=await sportUser();
    const result=await supabase.from('sport_sessions').update(patch).eq('id',sessionId);
    if(result.error)throw result.error;
    await load(true);
  }

  async function completeTrainingSession(sessionId){
    const session=state.sessions.find(item=>String(item.id)===String(sessionId));
    if(!session)throw new Error('Training nicht gefunden.');

    if(session.isTest){
      if(session.circuitRun?.status==='running')throw new Error('Beende oder brich zuerst den laufenden Test-Zirkel ab.');
      const {supabase,user}=await sportUser();
      const runs=await supabase.from('sport_circuit_runs').select('id').eq('user_id',user.id).eq('session_id',sessionId);
      if(runs.error)throw runs.error;
      const runIds=(runs.data||[]).map(row=>row.id);
      if(runIds.length){
        const deletedRuns=await supabase.from('sport_circuit_runs').delete().in('id',runIds).eq('user_id',user.id);
        if(deletedRuns.error)throw deletedRuns.error;
      }
      const deleted=await supabase.from('sport_sessions').delete().eq('id',sessionId).eq('user_id',user.id);
      if(deleted.error)throw deleted.error;
      expandedExercises.clear();
      await load(true);
      return;
    }

    const now=new Date();
    const fitx=isFitx(session);
    const onlyCircuit=Boolean(session.circuitRun)&&!(session.workout||[]).length&&!(session.activities||[]).length;

    let start=null;
    let end=now;
    const patch={};

    if(fitx){
      patch.training_ended_at=now.toISOString();
      if(session.gymLeftAt){
        start=validDate(session.gymArrivedAt);
        end=validDate(session.gymLeftAt)||now;
        patch.session_status='completed';
        patch.ended_at=end.toISOString();
        if(start&&end>=start)patch.duration_minutes=Math.round(((end-start)/60000)*100)/100;
      }else{
        patch.session_status='running';
      }
    }else{
      const circuitStart=onlyCircuit?validDate(session.circuitRun?.startedAt):null;
      const circuitEnd=onlyCircuit?validDate(session.circuitRun?.endedAt):null;
      start=circuitStart||validDate(session.startedAt);
      end=circuitEnd||now;
      patch.session_status='completed';
      if(circuitStart)patch.started_at=circuitStart.toISOString();
      patch.ended_at=end.toISOString();
      patch.gym_arrived_at=null;
      patch.gym_left_at=null;
      patch.training_started_at=null;
      patch.training_ended_at=null;
      if(start&&end>=start)patch.duration_minutes=Math.round(((end-start)/60000)*100)/100;
    }

    const {supabase}=await sportUser();
    const result=await supabase.from('sport_sessions').update(patch).eq('id',sessionId);
    if(result.error)throw result.error;
    await load(true);
  }

  async function removeExerciseParticipantForward(exerciseId,name){
    const clean=String(name||'').trim();
    if(!clean)throw new Error('Teilnehmer fehlt.');
    const session=state.sessions.find(item=>(item.workout||[]).some(exercise=>String(exercise.id)===String(exerciseId)));
    if(!session)throw new Error('Trainingselement nicht gefunden.');
    const ordered=[...(session.workout||[])].sort((a,b)=>a.sortOrder-b.sortOrder);
    const index=ordered.findIndex(item=>String(item.id)===String(exerciseId));
    if(index<0)throw new Error('Trainingselement nicht gefunden.');
    const targetIds=ordered.slice(index).map(item=>item.id);
    const {supabase}=await sportUser();
    if(targetIds.length){
      const result=await supabase.from('sport_session_exercise_participants')
        .delete()
        .in('session_exercise_id',targetIds)
        .eq('participant_name',clean);
      if(result.error)throw result.error;
    }
    await load(true);
  }

  function exerciseParticipantsBlock(exercise,parent){
    const names=exercise.participants||[];
    if(parent?.status!=='running')return names.length?'<div class="sport-element-people-static-v627"><span>mit</span> '+names.map(esc).join(' · ')+'</div>':'';
    const chips=names.length
      ?'<div class="sport-element-people-chips-v628">'+names.map(name=>
        '<span>'+esc(name)+'<button type="button" data-sport-participant-stop-forward="'+esc(exercise.id)+'" data-participant-name="'+esc(name)+'" title="'+esc(name)+' ab hier nicht mehr">ab hier raus</button></span>'
      ).join('')+'</div>'
      :'';
    return '<form class="sport-element-people-v627" data-sport-exercise-participants="'+esc(exercise.id)+'">'+
      '<label>Teilnehmer<input name="participants" value="'+esc(names.join(', '))+'" placeholder="z. B. Erik, Merle"></label>'+
      '<button type="submit">Speichern</button>'+
      '<button type="button" data-sport-exercise-participants-forward="'+esc(exercise.id)+'">Ab hier</button>'+
    '</form>'+chips;
  }


  // V762: recurrent week slots and isolated booked/attended occurrences.
  function planWeekday(dateKey){
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey||''));
    return m?new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),12)).getUTCDay()||7:0;
  }
  function slotForDay(slot,dateKey){return Number(slot.weekday)===planWeekday(dateKey);}
  function slotTime(value){return String(value||'').slice(0,5);}
  function occurrencesForDay(dateKey){return (state.courseOccurrences||[]).filter(item=>String(item.plan_date)===String(dateKey));}
  function parseCoursePeople(value){
    return [...new Set(String(value||'').split(/[,;+\n]/).map(item=>item.trim()).filter(Boolean))];
  }
  async function bookWeeklyCourse(slotId,dateKey){
    const slot=(state.weeklySlots||[]).find(item=>String(item.id)===String(slotId));
    const course=(state.courseCatalog||[]).find(item=>String(item.id)===String(slot?.course_id));
    if(!slot||!course||!slotForDay(slot,dateKey))throw new Error('Für diesen Tag ist der Kurstermin nicht vorgesehen.');
    if(occurrencesForDay(dateKey).some(item=>String(item.slot_id)===String(slotId)))return;
    const {supabase,user}=await sportUser();
    const result=await supabase.from('sport_course_occurrences').insert({
      user_id:user.id,slot_id:slot.id,course_id:course.id,kind:'regular',
      name:course.name,venue:'FitX',plan_date:dateKey,
      start_time:slotTime(slot.start_time),end_time:slotTime(slot.end_time),
      status:'planned'
    });
    if(result.error)throw result.error;
    coursePickerDate=null;
    await load(true);
  }
  async function bookSpecialCourse(dateKey,formData){
    const name=String(formData.get('name')||'').trim();
    const start=String(formData.get('start')||'').trim();
    const duration=Number(formData.get('duration'));
    const participants=parseCoursePeople(formData.get('participants'));
    const venue=String(formData.get('venue')||'FitX').trim()||'FitX';
    if(!name||name.length>120)throw new Error('Bitte einen Kursnamen mit maximal 120 Zeichen eingeben.');
    if(!/^\d{2}:\d{2}$/.test(start)||!Number.isInteger(duration)||duration<5||duration>720)throw new Error('Bitte gültige Startzeit und Dauer (5–720 Minuten) angeben.');
    const startMinutes=Number(start.slice(0,2))*60+Number(start.slice(3));
    if(startMinutes+duration>=1440)throw new Error('Specials, die über Mitternacht gehen, bitte aufteilen.');
    const endMinutes=startMinutes+duration;
    const end=String(Math.floor(endMinutes/60)).padStart(2,'0')+':'+String(endMinutes%60).padStart(2,'0');
    const {supabase,user}=await sportUser();
    const result=await supabase.from('sport_course_occurrences').insert({
      user_id:user.id,kind:'special',name,venue,plan_date:dateKey,
      start_time:start,end_time:end,participants,status:'planned'
    });
    if(result.error)throw result.error;
    coursePickerDate=null;
    await load(true);
  }
  async function removeCourseOccurrence(id){
    const {supabase,user}=await sportUser();
    const result=await supabase.from('sport_course_occurrences').delete()
      .eq('id',id).eq('user_id',user.id).eq('status','planned');
    if(result.error)throw result.error;
    await load(true);
  }
  async function saveCoursePeople(id,names){
    const {supabase,user}=await sportUser();
    const response=await supabase.from('sport_course_occurrences')
      .update({participants:parseCoursePeople(names),updated_at:new Date().toISOString()})
      .eq('id',id).eq('user_id',user.id).eq('status','planned');
    if(response.error)throw response.error;
    await load(true);
  }
  async function completeCourseOccurrence(id,participantText){
    const {supabase}=await sportUser();
    const result=await supabase.rpc('complete_sport_course_occurrence',{
      p_occurrence_id:id,p_participants:parseCoursePeople(participantText)
    });
    if(result.error)throw result.error;
    await load(true);
  }

  async function addCoursePlan(courseId,dateKey){
    const course=(state.courseCatalog||[]).find(item=>String(item.id)===String(courseId));
    if(!course)throw new Error('Kurs nicht gefunden.');
    const cleanDate=/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey||''))?String(dateKey):todayIso();
    const {supabase}=await sportUser();
    const result=await supabase.rpc('add_sport_course_plan',{p_course_id:course.id,p_plan_date:cleanDate});
    if(result.error)throw result.error;
    coursePickerDate=null;
    await load(true);
  }

  async function removeCoursePlan(planId){
    const {supabase}=await sportUser();
    const result=await supabase.rpc('remove_sport_course_plan',{p_plan_id:planId});
    if(result.error)throw result.error;
    await load(true);
  }

  function testCourseActivityCourseId(activity){
    const match=/^test-course-(?:plan|attendance)\|(.+)$/.exec(String(activity?.note||''));
    return match?match[1]:null;
  }

  async function addTestCoursePlan(courseId,dateKey){
    const course=(state.courseCatalog||[]).find(item=>String(item.id)===String(courseId));
    if(!course)throw new Error('Kurs nicht gefunden.');
    if(!planTestMode)throw new Error('Testmodus ist nicht ausgewählt.');
    const session=await createPlanSession(dateKey);
    if(!session?.isTest)throw new Error('Testplan konnte nicht angelegt werden.');
    if((session.activities||[]).some(activity=>String(testCourseActivityCourseId(activity)||'')===String(course.id)))return;

    const {supabase,user}=await sportUser();
    const maxSort=(session.activities||[]).reduce((max,item)=>Math.max(max,Number(item.sortOrder)||0),0);
    const result=await supabase.from('sport_activities').insert({
      user_id:user.id,
      session_id:session.id,
      name:course.name,
      kind:'test_course_plan',
      sort_order:maxSort+1,
      notes:'test-course-plan|'+course.id
    });
    if(result.error)throw result.error;
    coursePickerDate=null;
    await load(true);
  }

  async function removeTestCoursePlan(activityId){
    const {supabase}=await sportUser();
    const result=await supabase.from('sport_activities').delete().eq('id',activityId).eq('kind','test_course_plan');
    if(result.error)throw result.error;
    await load(true);
  }

  async function recordCourseAttendance(courseId,dateKey,participantText=''){
    const course=(state.courseCatalog||[]).find(item=>String(item.id)===String(courseId));
    if(!course)throw new Error('Kurs nicht gefunden.');
    const cleanDate=/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey||''))?String(dateKey):todayIso();
    const participants=[...new Set(String(participantText||'').split(/[,;+\n]/).map(name=>name.trim()).filter(Boolean))];
    const {supabase}=await sportUser();
    const result=await supabase.rpc('record_sport_course_attendance',{
      p_course_id:course.id,
      p_session_date:cleanDate,
      p_participants:participants
    });
    if(result.error)throw result.error;
    await load(true);
  }

  async function recordTestCourseAttendance(activityId,courseId,participantText=''){
    const course=(state.courseCatalog||[]).find(item=>String(item.id)===String(courseId));
    const session=state.sessions.find(item=>item.isTest&&(item.activities||[]).some(activity=>String(activity.id)===String(activityId)));
    if(!course||!session)throw new Error('Testkurs nicht gefunden.');
    const participants=[...new Set(String(participantText||'').split(/[,;+\n]/).map(name=>name.trim()).filter(Boolean))];
    const start=localDateTimeIso(session.date,courseClock(course.start_time));
    const end=localDateTimeIso(session.date,courseClock(course.end_time));
    const duration=start&&end?Math.max(0,Math.round((new Date(end)-new Date(start))/60000)):null;
    const {supabase,user}=await sportUser();

    let result=await supabase.from('sport_activities').update({
      kind:'course',
      started_at:start,
      ended_at:end,
      duration_minutes:duration,
      notes:'test-course-attendance|'+course.id
    }).eq('id',activityId);
    if(result.error)throw result.error;

    result=await supabase.from('sport_activity_participants').delete().eq('activity_id',activityId);
    if(result.error)throw result.error;
    if(participants.length){
      result=await supabase.from('sport_activity_participants').insert(participants.map(participant_name=>({
        user_id:user.id,activity_id:activityId,participant_name
      })));
      if(result.error)throw result.error;
    }
    await load(true);
  }

  async function saveCourseTime(courseId,start,end){
    const startTime=String(start||'').trim();
    const endTime=String(end||'').trim();
    if(!/^\d{2}:\d{2}$/.test(startTime)||!/^\d{2}:\d{2}$/.test(endTime))throw new Error('Bitte gültige Kurszeiten eingeben.');
    if(endTime<=startTime)throw new Error('Das Kursende muss nach dem Start liegen.');
    const {supabase}=await sportUser();
    const result=await supabase.from('sport_course_catalog').update({
      start_time:startTime,
      end_time:endTime,
      updated_at:new Date().toISOString()
    }).eq('id',courseId);
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
    if(duplicate)throw new Error('Diese Übung bzw. dieses Gerät ist bereits im Katalog.');
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
    const session=state.sessions.find(item=>(item.workout||[]).some(exercise=>String(exercise.id)===String(id)));
    const exercise=(session?.workout||[]).find(item=>String(item.id)===String(id));
    if(!exercise)throw new Error('Trainingselement nicht gefunden.');

    const {supabase}=await sportUser();
    const stamp=new Date().toISOString();

    if(status==='running'){
      const otherRunning=(session.workout||[]).filter(item=>item.status==='running'&&String(item.id)!==String(id));
      for(const other of otherRunning){
        const reset=await supabase.from('sport_session_exercises')
          .update({status:'planned',started_at:null,ended_at:null})
          .eq('id',other.id)
          .eq('status','running');
        if(reset.error)throw reset.error;
        expandedExercises.delete(other.id);
      }
    }

    const patch={status};
    if(status==='running')patch.started_at=stamp;
    if(status==='completed'||status==='skipped')patch.ended_at=stamp;
    if(status==='planned'){patch.started_at=null;patch.ended_at=null;}

    let result=await supabase.from('sport_session_exercises').update(patch).eq('id',id);
    if(result.error)throw result.error;

    if(status==='running'){
      if(session&&!session.startedAt&&!isFitx(session)){
        const sessionStart=await supabase.from('sport_sessions').update({started_at:stamp}).eq('id',session.id).is('started_at',null);
        if(sessionStart.error)throw sessionStart.error;
      }
      expandedExercises.add(id);
    }else if(status==='completed'||status==='skipped'){
      expandedExercises.delete(id);
      const ordered=[...(session.workout||[])].sort((a,b)=>a.sortOrder-b.sortOrder);
      const index=ordered.findIndex(item=>String(item.id)===String(id));
      // Do not auto-start the next exercise. Between exercises free training is paused,
      // so a course or circuit can become the active block without competing timers.
    }

    await load(true);
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
    await load(true);
  }


  // Keep unfinished form values on this device, scoped to one exercise and set.
  function sportDraftKey(form){
    if(!form)return '';
    const strength=form.hasAttribute('data-sport-set-form');
    const id=String(strength?form.dataset.exerciseId:form.dataset.sportCardioForm||'');
    if(!/^[a-f0-9-]{36}$/i.test(id))return '';
    const number=strength?Number(form.dataset.setNumber):0;
    if(strength&&(!Number.isInteger(number)||number<1))return '';
    return SPORT_DRAFT_PREFIX+':'+(strength?'set':'cardio')+':'+id+(strength?':'+number:'');
  }
  function storeSportDraft(form){
    const key=sportDraftKey(form);
    if(!key)return;
    const fields=[...form.querySelectorAll('input[name],select[name],textarea[name]')]
      .filter(el=>!el.hasAttribute('data-phase-key'))
      .map(el=>({name:el.name,value:el.value}));
    const phases=[...form.querySelectorAll('[data-cardio-phase-row]')].map(row=>{
      const data={};
      row.querySelectorAll('[data-phase-key]').forEach(el=>{data[el.dataset.phaseKey]=el.value;});
      return data;
    });
    try{localStorage.setItem(key,JSON.stringify({savedAt:Date.now(),fields,phases}));}catch(_){}
  }
  function dropSportDraft(kind,id,setNumber){
    const key=SPORT_DRAFT_PREFIX+':'+kind+':'+id+(kind==='set'?':'+setNumber:'');
    try{localStorage.removeItem(key);}catch(_){}
  }
  function restoreSportDrafts(root){
    root.querySelectorAll('[data-sport-set-form],[data-sport-cardio-form]').forEach(form=>{
      const key=sportDraftKey(form);
      if(!key)return;
      let draft;
      try{draft=JSON.parse(localStorage.getItem(key)||'null');}catch(_){return;}
      if(!draft)return;
      if(!Number.isFinite(draft.savedAt)||Date.now()-draft.savedAt>SPORT_DRAFT_TTL_MS){
        try{localStorage.removeItem(key);}catch(_){}
        return;
      }
      // A confirmed database set takes precedence over an old local draft.
      if(form.hasAttribute('data-sport-set-form')){
        const item=state.sessions.flatMap(session=>session.workout||[])
          .find(exercise=>String(exercise.id)===String(form.dataset.exerciseId));
        if(item?.sets?.some(set=>set.id&&Number(set.setNumber)===Number(form.dataset.setNumber))){
          try{localStorage.removeItem(key);}catch(_){}
          return;
        }
      }
      (draft.fields||[]).forEach(field=>{
        const el=[...form.querySelectorAll('input[name],select[name],textarea[name]')]
          .find(input=>!input.hasAttribute('data-phase-key')&&input.name===field.name);
        if(!el)return;
        el.value=String(field.value??'');
        if(field.name==='rir'){
          const wrap=el.closest('[data-sport-rir-stepper]');
          wrap?.querySelectorAll('[data-sport-rir-value]').forEach(button=>{
            const active=button.dataset.sportRirValue===el.value;
            button.classList.toggle('is-selected',active);
            button.setAttribute('aria-pressed',active?'true':'false');
          });
        }
      });
      if(form.hasAttribute('data-sport-cardio-form')&&Array.isArray(draft.phases)){
        const list=form.querySelector('.sport-cardio-phases-v613');
        const fields=String(form.dataset.phaseFields||'duration_minutes').split(',').filter(Boolean);
        if(list)list.innerHTML=draft.phases.map((phase,index)=>cardioPhaseRow(phase,index,fields)).join('');
      }
    });
  }

  async function saveStrengthSet(sessionExerciseId,setNumber,values,{reload=true}={}){
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
    dropSportDraft('set',sessionExerciseId,setNumber);
    if(reload)await load(true);
  }

  function activeStrengthFormFor(root,exerciseId){
    return [...(root?.querySelectorAll?.('[data-sport-set-form]')||[])].find(form=>
      String(form.dataset.exerciseId)===String(exerciseId)&&
      Boolean(form.closest('.sport-active-exercise-focus-v719'))
    )||null;
  }

  function strengthValuesFromForm(form){
    const data=new FormData(form);
    return {
      weight_kg:data.get('weight_kg'),
      repetitions:data.get('repetitions'),
      rir:data.get('rir')
    };
  }

  function hasEnteredStrengthValues(values){
    const weight=String(values?.weight_kg??'').trim();
    const reps=String(values?.repetitions??'').trim();
    const rir=String(values?.rir??'').trim();
    return Boolean(weight||reps||(rir&&rir!=='0'));
  }

  async function saveActiveStrengthSet(root,exerciseId,{force=false,reload=true}={}){
    const form=activeStrengthFormFor(root,exerciseId);
    if(!form)return {saved:false,setNumber:null};
    const values=strengthValuesFromForm(form);
    if(!force&&!hasEnteredStrengthValues(values))return {saved:false,setNumber:Number(form.dataset.setNumber)||null};
    const setNumber=Number(form.dataset.setNumber);
    if(!Number.isInteger(setNumber)||setNumber<1)throw new Error('Aktiver Satz konnte nicht bestimmt werden.');
    await saveStrengthSet(exerciseId,setNumber,values,{reload});
    return {saved:true,setNumber};
  }

  async function saveActiveStrengthSetAndAdvance(root,exerciseId){
    const exercise=state.sessions.flatMap(session=>session.workout||[]).find(item=>String(item.id)===String(exerciseId));
    if(!exercise)throw new Error('Trainingselement nicht gefunden.');
    const saved=await saveActiveStrengthSet(root,exerciseId,{force:true,reload:false});
    if(!saved.setNumber)throw new Error('Aktiver Satz konnte nicht gefunden werden.');
    // Extra sets should only be created with the separate explicit + Satz action.
    await load(true);
  }

  function strengthSetCount(exercise){
    const sets=exercise?.sets||[];
    const savedMax=Math.max(0,...sets.map(set=>Number(set.setNumber)||0));
    const configured=Number(exercise?.metricValues?.set_count);
    if(Number.isInteger(configured)&&configured>=1)return Math.max(savedMax,configured);
    return savedMax>0?savedMax:3;
  }

  async function changeStrengthSetCount(sessionExerciseId,direction,{reload=true}={}){
    const exercise=state.sessions.flatMap(session=>session.workout||[]).find(item=>item.id===sessionExerciseId);
    if(!exercise)return;
    const current=strengthSetCount(exercise);
    const next=Math.max(1,current+(direction==='down'?-1:1));
    if(next===current)return;

    const {supabase}=await sportUser();
    if(direction==='down'){
      const remove=supabase.from('sport_exercise_sets').delete().eq('session_exercise_id',sessionExerciseId).gte('set_number',next+1);
      const removed=await remove;
      if(removed.error)throw removed.error;
    }

    const metricValues={...(exercise.metricValues||{}),set_count:next};
    const updated=await supabase.from('sport_session_exercises').update({metric_values:metricValues}).eq('id',sessionExerciseId);
    if(updated.error)throw updated.error;
    if(reload)await load(true);
  }

  function roundCardioEstimate(value,digits){
    if(!Number.isFinite(value))return null;
    const factor=10**digits;
    return Math.round(value*factor)/factor;
  }

  function cardioPhaseEstimates(current,phases,totals){
    if(!Array.isArray(phases)||!phases.length)return {phases:[],meta:null};
    const totalDistance=numberOrNull(totals?.distance_km);
    const totalCalories=numberOrNull(totals?.calories_kcal);
    const totalDuration=numberOrNull(totals?.duration_minutes);
    const phaseMinutes=phases.reduce((sum,phase)=>sum+(Number(phase.duration_minutes)||0),0);
    if(!(phaseMinutes>0))return {phases,meta:null};

    const durationMatches=totalDuration===null||Math.abs(phaseMinutes-totalDuration)<=0.25;

    const name=String(current?.name||'').toLowerCase();
    const isTreadmill=name.includes('laufband');
    const durations=phases.map(phase=>Math.max(0,Number(phase.duration_minutes)||0));

    let distanceMethod='time_share';
    let distanceWeights=[...durations];
    if(phases.every((phase,index)=>durations[index]>0&&numberOrNull(phase.speed_kmh)!==null)){
      const theoretical=phases.map((phase,index)=>(numberOrNull(phase.speed_kmh)||0)*durations[index]/60);
      if(theoretical.reduce((sum,value)=>sum+value,0)>0){
        distanceWeights=theoretical;
        distanceMethod='speed_x_time_calibrated_to_total';
      }
    }

    let calorieMethod='time_share';
    let calorieWeights=[...durations];
    if(isTreadmill&&phases.every((phase,index)=>durations[index]>0&&numberOrNull(phase.speed_kmh)!==null)){
      calorieWeights=phases.map((phase,index)=>{
        const speed=Math.max(0,numberOrNull(phase.speed_kmh)||0);
        const incline=Math.max(0,numberOrNull(phase.incline_percent)||0)/100;
        const metersPerMinute=speed*1000/60;
        const vo2=speed>=6.5
          ?0.2*metersPerMinute+0.9*metersPerMinute*incline+3.5
          :0.1*metersPerMinute+1.8*metersPerMinute*incline+3.5;
        return Math.max(0,vo2)*durations[index];
      });
      calorieMethod='treadmill_intensity_calibrated_to_total';
    }else{
      const levels=phases.map(phase=>numberOrNull(phase.resistance_level));
      if(levels.some(level=>level!==null&&level>0)){
        calorieWeights=durations.map((minutes,index)=>minutes*Math.max(0.5,levels[index]||1));
        calorieMethod='duration_x_resistance_calibrated_to_total';
      }
    }

    const distanceWeightSum=distanceWeights.reduce((sum,value)=>sum+value,0);
    const calorieWeightSum=calorieWeights.reduce((sum,value)=>sum+value,0);
    const estimated=phases.map((phase,index)=>{
      const next={...phase};
      if(totalDistance!==null&&distanceWeightSum>0){
        next.distance_km_estimated=roundCardioEstimate(totalDistance*distanceWeights[index]/distanceWeightSum,3);
      }
      if(totalCalories!==null&&calorieWeightSum>0){
        next.calories_kcal_estimated=roundCardioEstimate(totalCalories*calorieWeights[index]/calorieWeightSum,1);
      }
      return next;
    });

    return {
      phases:estimated,
      meta:{
        estimated:true,
        distance_method:totalDistance!==null?distanceMethod:null,
        calorie_method:totalCalories!==null?calorieMethod:null,
        calibrated_to_measured_totals:true,
        duration_mismatch:!durationMatches,
        phase_minutes:roundCardioEstimate(phaseMinutes,2),
        total_minutes:totalDuration
      }
    };
  }

  async function saveCardioValues(id,values){
    const current=state.sessions.flatMap(session=>session.workout||[]).find(item=>item.id===id);
    const metricValues={...(current?.metricValues||{})};
    for(const key of ['duration_minutes','distance_km','resistance_level','speed_kmh','incline_percent','calories_kcal']){
      const raw=values[key];
      if(raw!==null&&raw!==undefined&&String(raw).trim()!=='')metricValues[key]=key==='resistance_level'?String(raw).trim():numberOrNull(raw);
      else delete metricValues[key];
    }
    const rawPhases=Array.isArray(values.phases)?values.phases.map(phase=>({
      duration_minutes:numberOrNull(phase.duration_minutes),
      resistance_level:String(phase.resistance_level||'').trim()||null,
      speed_kmh:numberOrNull(phase.speed_kmh),
      incline_percent:numberOrNull(phase.incline_percent)
    })).filter(phase=>phase.duration_minutes!==null||phase.resistance_level!==null||phase.speed_kmh!==null||phase.incline_percent!==null):[];
    const phaseMinutes=rawPhases.reduce((sum,phase)=>sum+(Number(phase.duration_minutes)||0),0);
    const explicitDuration=numberOrNull(values.duration_minutes);
    const effectiveDuration=explicitDuration!==null?explicitDuration:(rawPhases.length?phaseMinutes:null);
    const estimates=cardioPhaseEstimates(current,rawPhases,{
      duration_minutes:effectiveDuration,
      distance_km:numberOrNull(values.distance_km),
      calories_kcal:numberOrNull(values.calories_kcal)
    });
    metricValues.phases=estimates.phases;
    if(estimates.meta)metricValues.phase_estimation=estimates.meta;
    else delete metricValues.phase_estimation;
    const result=await updateSessionExercise(id,{
      duration_minutes:effectiveDuration,
      distance_km:numberOrNull(values.distance_km),
      resistance_level:String(values.resistance_level||'').trim()||null,
      speed_kmh:numberOrNull(values.speed_kmh),
      incline_percent:numberOrNull(values.incline_percent),
      calories_kcal:numberOrNull(values.calories_kcal),
      metric_values:metricValues
    });
    dropSportDraft('cardio',id);
    return result;
  }

  function sessionParticipantRows(sessionId){
    return state.sessionParticipants.filter(row=>String(row.session_id)===String(sessionId)).sort((a,b)=>byName(a.participant_name,b.participant_name));
  }

  function previousWorkoutValue(current){
    const candidates=state.sessions
      .filter(session=>!session.isTest&&session.id!==current.sessionId)
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
    const count=strengthSetCount(exercise);
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
    return '<div class="sport-strength-editor-v573">'+rows+
      '<div class="sport-set-count-actions-v615">'+
        '<button type="button" class="sport-ghost-button-v573" data-sport-remove-set="'+esc(exercise.id)+'" '+(count<=1?'disabled':'')+'>− Satz</button>'+
        '<button type="button" class="sport-ghost-button-v573" data-sport-add-set="'+esc(exercise.id)+'">+ Satz</button>'+
      '</div>'+
    '</div>';
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
          executionHelpButton(catalog)+
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
        exerciseParticipantsBlock(exercise,parent)+
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
        if(phase.distance_km_estimated!==null)parts.push('≈ '+String(Math.round(phase.distance_km_estimated*100)/100).replace('.',',')+' km');
        if(phase.calories_kcal_estimated!==null)parts.push('≈ '+String(Math.round(phase.calories_kcal_estimated))+' kcal');
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
    const people=(exercise.participants||[]).length?'<div class="sport-element-people-static-v627"><span>mit</span> '+exercise.participants.map(esc).join(' · ')+'</div>':'';
    return '<article class="sport-summary-card-v574"><div><strong>'+esc(title)+'</strong>'+(settings?'<small>'+esc(settings)+'</small>':'')+'</div>'+detailHtml+people+'</article>';
  }

  function completedWorkoutCard(exercise){
    return '<div class="sport-completed-wrap-v612">'+workoutSummaryCard(exercise)+'<button type="button" data-sport-exercise-status="'+esc(exercise.id)+'" data-status="planned">Wieder öffnen</button></div>';
  }
  function skippedWorkoutCard(exercise){
    return '<div class="sport-completed-wrap-v612">'+workoutSummaryCard(exercise)+'<button type="button" data-sport-exercise-status="'+esc(exercise.id)+'" data-status="planned">Zurückholen</button></div>';
  }

  function timelineBlock(session){
    if(!isFitx(session)||!session?.gymArrivedAt)return '';
    return '<div class="sport-timeline-v573">'+TIMELINE_STEPS.map(([prop,column,label],index)=>{
      const value=session[prop];
      const waitsForTrainingEnd=column==='gym_left_at'&&!value&&!session?.trainingEndedAt;
      const disabled=Boolean(value)||waitsForTrainingEnd;
      const hint=value?esc(clock(value)):(waitsForTrainingEnd?'erst Training abschließen':'antippen = jetzt');
      return '<button type="button" class="'+(value?'is-done':'')+'" data-sport-timeline="'+esc(session.id)+'" data-column="'+column+'" '+(disabled?'disabled':'')+'>'+
        '<i>'+(index+1)+'</i><span><strong>'+esc(label)+'</strong><small>'+hint+'</small></span>'+
      '</button>';
    }).join('')+'</div>';
  }

  function participantsBlock(session){
    const rows=sessionParticipantRows(session.id);
    const count=rows.length;
    return '<details class="sport-partners-compact-v634">'+
      '<summary><span>Trainingspartner</span><small>'+(count?count+' eingetragen':'optional')+'</small></summary>'+
      '<div class="sport-partners-compact-body-v634">'+
        '<div class="sport-partner-list-v573">'+(count?rows.map(row=>'<span>'+esc(row.participant_name)+'<button type="button" data-sport-remove-participant="'+esc(row.id)+'" aria-label="'+esc(row.participant_name)+' entfernen">×</button></span>').join(''):'<em>Noch niemand eingetragen.</em>')+'</div>'+
        '<form class="sport-partner-form-v573" data-sport-participant-form="'+esc(session.id)+'"><input name="participant" placeholder="Name" autocomplete="off" required><button type="submit">+ Partner</button></form>'+
      '</div>'+
    '</details>';
  }

  function courseClock(value){
    const raw=String(value||'');
    const match=/^(\d{2}):(\d{2})/.exec(raw);
    return match?match[1]+':'+match[2]:raw||'–';
  }

  function knownSportParticipants(){
    const names=new Set();
    (state.sessions||[]).filter(session=>!session.isTest).forEach(session=>{
      (session.participants||[]).forEach(name=>{name=String(name||'').trim();if(name)names.add(name);});
      (session.activities||[]).forEach(activity=>(activity.participants||[]).forEach(name=>{name=String(name||'').trim();if(name)names.add(name);}));
      (session.workout||[]).forEach(exercise=>(exercise.participants||[]).forEach(name=>{name=String(name||'').trim();if(name)names.add(name);}));
    });
    return [...names].sort(byName);
  }

  function attendanceForCourse(course,dateKey){
    const sourceKey='course-attendance|'+course.id+'|'+dateKey;
    const session=(state.sessions||[]).find(item=>item.sourceKey===sourceKey);
    if(!session)return null;
    const activity=(session.activities||[]).find(item=>String(item.name||'').toLowerCase()===String(course.name||'').toLowerCase())||(session.activities||[])[0]||null;
    return {session,activity};
  }

  function coursePlanFor(courseId,dateKey){
    return (state.coursePlans||[]).find(plan=>String(plan.course_id)===String(courseId)&&String(plan.plan_date)===String(dateKey))||null;
  }

  function legacyCourseAttendanceBlock(dateKey,session=null,testMode=Boolean(session?.isTest||planTestMode)){
    const courses=(state.courseCatalog||[]).filter(course=>course.active!==false);
    const courseById=new Map(courses.map(course=>[String(course.id),course]));
    const people=knownSportParticipants();
    const listId='sport-course-people-v619';
    const datalist=people.length?'<datalist id="'+listId+'">'+people.map(name=>'<option value="'+esc(name)+'"></option>').join('')+'</datalist>':'';
    const pickerKey=(testMode?'test|':'real|')+String(dateKey);
    const pickerOpen=String(coursePickerDate||'')===pickerKey;

    let rows='';
    let shownIds=new Set();

    if(testMode){
      const activities=session?.activities||[];
      const planned=activities.filter(activity=>activity.type==='test_course_plan').map(activity=>({
        activity,
        course:courseById.get(String(testCourseActivityCourseId(activity)||''))
      })).filter(item=>item.course);
      const completed=activities.filter(activity=>activity.type==='course'&&String(activity.note||'').startsWith('test-course-attendance|')).map(activity=>({
        activity,
        course:courseById.get(String(testCourseActivityCourseId(activity)||''))
      })).filter(item=>item.course);
      completed.forEach(item=>shownIds.add(String(item.course.id)));
      planned.forEach(item=>shownIds.add(String(item.course.id)));

      rows=[
        ...completed.map(({activity,course})=>{
          const participantText=activity.participants?.length?' · mit '+activity.participants.map(esc).join(', '):'';
          return '<div class="sport-course-plan-row-v619 is-done"><div><strong>'+esc(course.name)+'</strong><small>'+esc(courseClock(course.start_time))+'–'+esc(courseClock(course.end_time))+participantText+'</small></div><span>✓ Test-Teilnahme</span></div>';
        }),
        ...planned.map(({activity,course})=>
          '<form class="sport-course-plan-row-v619" data-sport-test-course-attendance="'+esc(activity.id)+'" data-course-id="'+esc(course.id)+'">'
            +'<div><strong>'+esc(course.name)+'</strong><small>'+esc(courseClock(course.start_time))+'–'+esc(courseClock(course.end_time))+' · TEST</small></div>'
            +'<input name="participants" list="'+listId+'" placeholder="Mit wem?">'
            +'<button type="submit">Teilgenommen testen</button>'
            +'<button type="button" class="sport-course-remove-v619" data-sport-remove-test-course-plan="'+esc(activity.id)+'" aria-label="Testkurs aus Plan entfernen">×</button>'
          +'</form>'
        )
      ].join('');
    }else{
      const plans=(state.coursePlans||[]).filter(plan=>String(plan.plan_date)===String(dateKey));
      const plannedCourses=plans.map(plan=>({plan,course:courseById.get(String(plan.course_id))})).filter(item=>item.course);
      const completed=courses.map(course=>({course,attendance:attendanceForCourse(course,dateKey)})).filter(item=>item.attendance);
      completed.forEach(item=>shownIds.add(String(item.course.id)));
      plannedCourses.forEach(item=>shownIds.add(String(item.course.id)));

      rows=[
        ...completed.map(({course,attendance})=>{
          const activity=attendance.activity;
          const participantText=activity?.participants?.length?' · mit '+activity.participants.map(esc).join(', '):'';
          return '<div class="sport-course-plan-row-v619 is-done"><div><strong>'+esc(course.name)+'</strong><small>'+esc(courseClock(course.start_time))+'–'+esc(courseClock(course.end_time))+participantText+'</small></div><span>✓ Teilgenommen</span></div>';
        }),
        ...plannedCourses.filter(({course})=>!attendanceForCourse(course,dateKey)).map(({plan,course})=>
          '<form class="sport-course-plan-row-v619" data-sport-course-attendance="'+esc(course.id)+'" data-course-date="'+esc(dateKey)+'">'
            +'<div><strong>'+esc(course.name)+'</strong><small>'+esc(courseClock(course.start_time))+'–'+esc(courseClock(course.end_time))+'</small></div>'
            +'<input name="participants" list="'+listId+'" placeholder="Mit wem?">'
            +'<button type="submit">Teilgenommen</button>'
            +'<button type="button" class="sport-course-remove-v619" data-sport-remove-course-plan="'+esc(plan.id)+'" aria-label="Kurs aus Plan entfernen">×</button>'
          +'</form>'
        )
      ].join('');
    }

    const available=courses.filter(course=>!shownIds.has(String(course.id)));
    const picker=pickerOpen
      ?'<div class="sport-course-picker-v619">'
        +(available.length
          ?available.map(course=>testMode
            ?'<button type="button" data-sport-add-test-course-plan="'+esc(course.id)+'" data-course-date="'+esc(dateKey)+'"><strong>'+esc(course.name)+'</strong><small>'+esc(courseClock(course.start_time))+'–'+esc(courseClock(course.end_time))+' · TEST</small></button>'
            :'<button type="button" data-sport-add-course-plan="'+esc(course.id)+'" data-course-date="'+esc(dateKey)+'"><strong>'+esc(course.name)+'</strong><small>'+esc(courseClock(course.start_time))+'–'+esc(courseClock(course.end_time))+'</small></button>'
          ).join('')
          :'<span>Alle Kurse für diesen '+(testMode?'Testplan':'Tag')+' sind schon eingeplant.</span>')
        +(testMode?'':'<details class="sport-course-settings-v619"><summary>Kurszeiten ändern</summary>'
          +courses.map(course=>'<form data-sport-course-time="'+esc(course.id)+'"><strong>'+esc(course.name)+'</strong><label>Start<input type="time" name="start" value="'+esc(courseClock(course.start_time))+'" required></label><label>Ende<input type="time" name="end" value="'+esc(courseClock(course.end_time))+'" required></label><button type="submit">Speichern</button></form>').join('')
        +'</details>')
      +'</div>'
      :'';

    return '<section class="sport-course-plan-v619 '+(testMode?'is-test-v717':'')+'">'
      +'<div class="sport-course-plan-head-v619"><strong>Kurse'+(testMode?' · TEST':'')+'</strong><button class="sport-plan-action-v632" type="button" data-sport-toggle-course-picker="'+esc(dateKey)+'" data-course-picker-key="'+esc(pickerKey)+'">'+(pickerOpen?'Schließen':'+ Kurs hinzufügen')+'</button></div>'
      +datalist
      +(rows?'<div class="sport-course-plan-list-v619">'+rows+'</div>':'')
      +picker
      +'</section>';
  }


  function courseAttendanceBlock(dateKey,session=null,testMode=Boolean(session?.isTest||planTestMode)){
    if(testMode)return legacyCourseAttendanceBlock(dateKey,session,true);
    const courses=(state.courseCatalog||[]).filter(item=>item.active!==false);
    const courseById=new Map(courses.map(item=>[String(item.id),item]));
    const slots=(state.weeklySlots||[]).filter(slot=>slot.active!==false&&slotForDay(slot,dateKey));
    const bookings=occurrencesForDay(dateKey);
    const reservedSlotIds=new Set(bookings.map(item=>String(item.slot_id||'')));
    const oldPlans=(state.coursePlans||[]).filter(plan=>String(plan.plan_date)===String(dateKey));
    const oldDone=courses.map(course=>({course,attendance:attendanceForCourse(course,dateKey)})).filter(x=>x.attendance);
    const key='real|'+String(dateKey);
    const open=String(coursePickerDate||'')===key;
    const people=knownSportParticipants();
    const peopleListId='sport-people-v762';
    const datalist=people.length?'<datalist id="'+peopleListId+'">'+people.map(name=>'<option value="'+esc(name)+'"></option>').join('')+'</datalist>':'';

    const completedLegacy=oldDone.map(({course,attendance})=>{
      const a=attendance.activity;
      return '<div class="sport-course-plan-row-v619 is-done"><div><strong>'+esc(course.name)+'</strong><small>'+esc(a?.startedAt?clock(a.startedAt):slotTime(course.start_time))+'–'+esc(a?.endedAt?clock(a.endedAt):slotTime(course.end_time))+' · Historischer Eintrag</small></div><span>✓ Teilgenommen</span></div>';
    }).join('');
    const plannedLegacy=oldPlans.filter(p=>!oldDone.some(x=>String(x.course.id)===String(p.course_id))).map(plan=>{
      const course=courseById.get(String(plan.course_id));
      if(!course)return '';
      return '<form class="sport-course-plan-row-v619" data-sport-course-attendance="'+esc(course.id)+'" data-course-date="'+esc(dateKey)+'"><div><strong>'+esc(course.name)+'</strong><small>Alte Kursplanung · Standardzeit '+esc(slotTime(course.start_time))+'–'+esc(slotTime(course.end_time))+'</small></div><input name="participants" list="'+peopleListId+'" placeholder="Mit wem?"><button type="submit">Teilgenommen</button><button type="button" class="sport-course-remove-v619" data-sport-remove-course-plan="'+esc(plan.id)+'">×</button></form>';
    }).join('');

    const rows=bookings.map(item=>{
      const time=slotTime(item.start_time)+'–'+slotTime(item.end_time);
      const suffix=item.kind==='special'?' · Special':'';
      const names=(item.participants||[]).join(', ');
      if(item.status==='completed')return '<div class="sport-course-plan-row-v619 is-done"><div><strong>'+esc(item.name)+'</strong><small>'+esc(time+suffix+(names?' · mit '+names:''))+'</small></div><span>✓ Teilgenommen</span></div>';
      return '<form class="sport-course-plan-row-v619 sport-course-booking-v762" data-sport-complete-occurrence="'+esc(item.id)+'"><div><strong>'+esc(item.name)+'</strong><small>'+esc(time+suffix)+'</small></div><input name="participants" list="'+peopleListId+'" value="'+esc(names)+'" placeholder="Mit wem?"><button type="submit">Teilgenommen</button><button type="button" data-sport-save-people="'+esc(item.id)+'">Mit wem speichern</button><button type="button" class="sport-course-remove-v619" data-sport-remove-occurrence="'+esc(item.id)+'" aria-label="Geplanten Kurstermin entfernen">×</button></form>';
    }).join('');

    const available=slots.filter(slot=>!reservedSlotIds.has(String(slot.id))&&!oldDone.some(x=>
      String(x.course.id)===String(slot.course_id)&&x.attendance.activity?.startedAt&&clock(x.attendance.activity.startedAt)===slotTime(slot.start_time)
    ));
    const grouped=new Map();
    available.forEach(slot=>{const course=courseById.get(String(slot.course_id));if(!course)return;
      const group=grouped.get(String(course.id))||{course,slots:[]};group.slots.push(slot);grouped.set(String(course.id),group);
    });
    const weeklyPicker=[...grouped.values()].sort((a,b)=>byName(a.course.name,b.course.name)).map(group=>
      '<div class="sport-weekly-course-v762"><strong>'+esc(group.course.name)+'</strong><div class="sport-weekly-times-v762">'+group.slots.sort((a,b)=>slotTime(a.start_time).localeCompare(slotTime(b.start_time))).map(slot=>
      '<button type="button" data-sport-book-weekly="'+esc(slot.id)+'" data-course-date="'+esc(dateKey)+'">'+esc(slotTime(slot.start_time)+'–'+slotTime(slot.end_time))+'</button>').join('')+'</div></div>'
    ).join('');
    const dayTitle=new Intl.DateTimeFormat('de-DE',{weekday:'long',timeZone:'UTC'}).format(new Date(dateKey+'T12:00:00Z'));
    const picker=open?'<div class="sport-weekly-picker-v762">'+
      '<div class="sport-weekly-title-v762">Reguläre Kurse · '+esc(dayTitle)+'</div>'+
      (weeklyPicker||'<p class="sport-weekly-empty-v762">Für diesen Tag keine weiteren regulären Kurstermine.</p>')+
      '<details class="sport-special-v762"><summary>+ Special-Kurs / Event</summary>'+
      '<form data-sport-book-special="'+esc(dateKey)+'" class="sport-special-form-v762">'+
        '<label>Kurs / Event<input name="name" maxlength="120" placeholder="z. B. Special Ride" required></label>'+
        '<div class="sport-special-grid-v762"><label>Start<input name="start" type="time" required></label>'+
        '<label>Dauer (Min.)<input name="duration" type="number" min="5" max="720" step="5" value="50" required></label></div>'+
        '<label>Ort<input name="venue" value="FitX" placeholder="FitX"></label>'+
        '<label>Mit wem?<input name="participants" list="'+peopleListId+'" placeholder="z. B. Merle, Erik"></label>'+
        '<button type="submit">Special einplanen</button>'+
      '</form></details>'+
    '</div>':'';
    return '<section class="sport-course-plan-v619 sport-weekly-block-v762">'+
       '<div class="sport-course-plan-head-v619"><strong>Kurse · Wochenplan</strong><button class="sport-plan-action-v632" type="button" data-sport-toggle-course-picker="'+esc(dateKey)+'" data-course-picker-key="'+esc(key)+'">'+(open?'Schließen':'+ Kurs hinzufügen')+'</button></div>'+
       datalist+(rows||completedLegacy||plannedLegacy?'<div class="sport-course-plan-list-v619">'+rows+completedLegacy+plannedLegacy+'</div>':'')+
       picker+'</section>';
  }

  function planningPanel(){
    const current=planSessionForDate(planDate);
    const otherPlans=state.sessions
      .filter(session=>session.kind==='xtraining'&&session.status==='planned'&&Boolean(session.isTest)===Boolean(planTestMode)&&session.date!==planDate)
      .sort((a,b)=>String(a.date).localeCompare(String(b.date)));

    const freeItems=(current?.workout||[]).filter(item=>item.status!=='skipped');
    const hasFree=freeItems.length>0;
    const hasCoursePlan=planTestMode
      ?(current?.activities||[]).some(activity=>activity.type==='test_course_plan')
      :(state.coursePlans||[]).some(plan=>String(plan.plan_date)===String(planDate));
    const hasCourseAttendance=planTestMode
      ?(current?.activities||[]).some(activity=>activity.type==='course'&&String(activity.note||'').startsWith('test-course-attendance|'))
      :(state.courseCatalog||[]).some(course=>Boolean(attendanceForCourse(course,planDate)));
    const hasNewCourseBookings=!planTestMode&&occurrencesForDay(planDate).length>0;
    const hasBaseContent=hasFree||hasCoursePlan||hasCourseAttendance||hasNewCourseBookings;

    const modeSwitch=
      '<section class="sport-plan-mode-v717" aria-label="Planmodus">'+
        '<div><strong>PLANMODUS</strong><small>Test muss bewusst ausgewählt werden und zählt nirgends mit.</small></div>'+
        '<div class="sport-plan-mode-buttons-v717">'+
          '<button type="button" data-sport-plan-mode="real" class="'+(!planTestMode?'active':'')+'">ECHT</button>'+
          '<button type="button" data-sport-plan-mode="test" class="'+(planTestMode?'active':'')+'">TEST</button>'+
        '</div>'+
      '</section>';

    const freeTraining=
      '<section class="sport-plan-block-v631">'+
        '<div class="sport-plan-block-head-v631"><div><span>FREIES TRAINING'+(planTestMode?' · TEST':'')+'</span><small>Übungen und Geräte</small></div>'+
        '<button class="sport-plan-action-v632" type="button" data-sport-open-catalog '+(current?'data-session-id="'+esc(current.id)+'"':'')+'>+ Übung</button></div>'+
        (hasFree?workoutLists(current):'')+
      '</section>';

    const dayBody=
      (current?compactPlanVenue(current):'')+
      courseAttendanceBlock(planDate,current,planTestMode)+
      freeTraining+
      '<div class="sport-plan-circuit-slot-v631" data-sport-circuit-slot></div>'+
      '<div class="sport-plan-global-empty-v632" data-sport-global-plan-empty data-has-base-content="'+(hasBaseContent?'1':'0')+'" '+(hasBaseContent?'hidden':'')+'>'+(planTestMode?'Testplan ist noch leer. Hier darfst du gefahrlos alles kaputtprüfen.':'Keine offenen Übungen mehr. Sehr verdächtig produktiv.')+'</div>'+
      (current&&isSessionActive(current)?'<div class="sport-plan-running-v612">Diese Einheit läuft bereits. Unter „Aktiv“ siehst du den aktuellen Ablauf.</div>':'')+
      '<div class="sport-plan-footer-actions-v632">'+
        (current&&current.status==='planned'
          ?((isFitx(current)&&!current.gymArrivedAt)
            ?'<button class="sport-plan-start-v632" type="button" data-sport-timeline="'+esc(current.id)+'" data-column="gym_arrived_at">Bei FitX angekommen</button><button class="sport-plan-danger-v632" type="button" data-sport-delete-day-plan="'+esc(current.id)+'">'+(current.isTest?'Testplan löschen':'Tagesplan löschen')+'</button>'
            :'<button class="sport-plan-start-v632" type="button" data-sport-start-plan="'+esc(current.id)+'">'+(current.isTest?'Testtraining starten':'Training starten')+'</button><button class="sport-plan-danger-v632" type="button" data-sport-delete-day-plan="'+esc(current.id)+'">'+(current.isTest?'Testplan löschen':'Tagesplan löschen')+'</button>')
          :(!current?'<button class="sport-plan-action-v632" type="button" data-sport-create-plan="'+esc(planDate)+'">'+(planTestMode?'Testplan anlegen':'Plan anlegen')+'</button>':''))+
      '</div>';

    return '<section class="sport-panel-v510 sport-panel-v512 '+(planTestMode?'sport-test-planning-v717':'')+'" data-sport-panel-v568="planning">'+wave()+
      '<div class="sport-hero-v510"><div class="sport-kicker-v510"><span class="sport-live-dot-v510"></span>PLANEN'+(planTestMode?' · TESTMODUS':'')+' '+statusBadge()+'</div><p class="sport-date-v510">'+(planTestMode?'Komplette Abläufe prüfen, ohne echte Historie oder Statistik anzufassen.':'Trainingstage vorbereiten, ohne sie schon als absolvierte Einheit zu zählen.')+'</p><div class="sport-section-mark-v512">P</div></div>'+
      '<div class="sport-content-v510">'+
        modeSwitch+
        (planTestMode?'<div class="sport-test-banner-v717"><strong>TESTPLAN</strong><span>Kurse, Freies Training und Home-Zirkel benutzen die echten Funktionen. Nach dem Test wird nichts archiviert; beim Beenden werden die Testdaten verworfen.</span></div>':'')+
        '<section class="sport-planning-day-v632" data-sport-plan-day="'+esc(planDate)+'">'+
          '<div class="sport-planning-day-head-v632">'+
            '<label><span>'+(planTestMode?'TESTTAG':'TRAININGSTAG')+'</span><input type="date" data-sport-plan-date value="'+esc(planDate)+'"></label>'+
            (current?'<div class="sport-planning-day-meta-v632"><span>Ort</span><strong>'+esc(venueDisplay(current.venue))+'</strong></div>':'')+
          '</div>'+
          '<div class="sport-planning-day-body-v632">'+dayBody+'</div>'+
        '</section>'+
        (otherPlans.length?'<div class="sport-section-title-v568">'+(planTestMode?'Weitere offene Testpläne':'Weitere offene Pläne')+'</div><div class="sport-plan-list-v612">'+otherPlans.map(session=>'<button type="button" data-sport-select-plan="'+esc(session.date)+'"><strong>'+esc(shortDate(session.date))+'</strong><span>'+esc(venueDisplay(session.venue))+' · '+(session.workout||[]).filter(item=>item.status!=='skipped').length+' Übungen'+(session.isTest?' · TEST':'')+'</span></button>').join('')+'</div>':'')+
        errorNote()+
      '</div></section>';
  }

  function xTrainingPanel(){
    return '<section class="sport-panel-v510 sport-panel-v512" data-sport-panel-v568="sessions">'+wave()+
      '<div class="sport-hero-v510"><div class="sport-kicker-v510"><span class="sport-live-dot-v510"></span>EINHEITEN '+statusBadge()+'</div><p class="sport-date-v510">Dokumentierte Trainingstage. Geplante und laufende Einheiten bleiben hier draußen.</p><div class="sport-section-mark-v512">E</div></div>'+
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

  function executionHelpButton(item){
    const execution=exerciseExecutionData(item);
    return execution?'<button type="button" class="sport-execution-help-v633" data-sport-execution-help="'+esc(item.id)+'" aria-label="Ausführung für '+esc(item.name)+' anzeigen" title="Ausführung anzeigen">?</button>':'';
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
      const open=expandedCatalogGroups.has(group);
      return '<details class="sport-catalog-group-v633" data-sport-catalog-group="'+esc(group)+'" '+(open?'open':'')+'>'+
        '<summary class="sport-catalog-group-summary-v633">'+
          '<div><span>GRUPPE</span><strong>'+esc(group)+'</strong></div>'+
          '<small>'+list.length+' '+(list.length===1?'Eintrag':'Einträge')+'</small>'+
        '</summary>'+
        '<div class="sport-catalog-group-body-v633">'+
          '<div class="sport-catalog-group-action-v633"><button type="button" class="sport-catalog-action-v633 '+(allSelected?'is-added-v612':'')+'" data-sport-add-group="'+esc(group)+'" data-session-id="'+esc(targetSessionId)+'" data-plan-date="'+esc(planDate)+'" '+(allSelected?'disabled':'')+'>'+(allSelected?'✓ Gruppe enthalten':'Gruppe übernehmen')+'</button></div>'+
          '<div class="sport-catalog-grid-v573">'+list.map(item=>{
            const title=(item.equipment_number?item.equipment_number+' ':'')+item.name;
            const settings=item.settings_text?'<small class="sport-item-settings-v574">'+esc(item.settings_text)+'</small>':'';
            const load=item.load_mode==='assistance'?'<small class="sport-assistance-v574">Unterstützungsgewicht</small>':'';
            const added=selected.has(String(item.id));
            return '<article class="'+(added?'is-added-v612':'')+'"><div><span>'+esc(itemTypeLabel(item.item_type))+'</span><h3>'+esc(title)+'</h3><small>'+esc(item.muscle_group||item.category||'')+'</small>'+settings+load+'</div>'+
              '<div class="sport-catalog-card-actions-v633">'+
                executionHelpButton(item)+
                '<button type="button" class="sport-catalog-action-v633 '+(added?'is-added-v612':'')+'" data-sport-add-exercise="'+esc(item.id)+'" data-session-id="'+esc(targetSessionId)+'" data-plan-date="'+esc(planDate)+'" '+(added?'disabled':'')+'>'+(added?'✓ Enthalten':'Hinzufügen')+'</button>'+
              '</div>'+
            '</article>';
          }).join('')+'</div>'+
        '</div>'+
      '</details>';
    }).join(''):'<div class="sport-empty-inline-v568">Noch keine Übungen oder Geräte im Katalog.</div>';

    const targetLabel=current
      ?(current.status==='completed'?'Abgeschlossene Einheit · '+shortDate(current.date):dateLabel(current.date))
      :dateLabel(planDate);
    const backTarget=current?.status==='completed'?'sessions':(isSessionActive(current)?'overview':'planning');
    const note=current?.status==='completed'
      ?'Du bearbeitest diese abgeschlossene Einheit. Änderungen werden direkt dort gespeichert. ✓ = bereits enthalten.'
      :'Wähle Übungen für den aktuellen Tagesplan. „Hinzufügen“ übernimmt sie direkt. ✓ = bereits eingeplant.';

    return '<section class="sport-panel-v510 sport-panel-v512" data-sport-panel-v568="catalog">'+wave()+
      '<div class="sport-hero-v510"><div class="sport-kicker-v510"><span class="sport-live-dot-v510"></span>KATALOG '+statusBadge()+'</div><p class="sport-date-v510">'+esc(targetLabel)+' · '+esc(venueDisplay(current?.venue))+'</p><div class="sport-section-mark-v512">K</div></div>'+
      '<div class="sport-content-v510">'+
        '<div class="sport-catalog-toolbar-v633"><button type="button" class="sport-catalog-back-v633" data-sport-catalog-back="'+esc(backTarget)+'">← Zum Plan</button></div>'+
        '<div class="sport-catalog-note-v633">'+esc(note)+'</div>'+
        '<div class="sport-section-title-v568">Übungen & Geräte</div>'+itemsHtml+
        '<details class="sport-catalog-create-v573"><summary>+ Übung oder Gerät hinzufügen</summary>'+
          '<form data-sport-add-exercise-form>'+
            '<label>Typ<select name="item_type"><option value="strength_machine">Kraftgerät</option><option value="cardio_machine">Cardiogerät</option><option value="free_exercise">Freie Übung</option><option value="outdoor_activity">Outdoor-Aktivität</option></select></label>'+
            '<label>Bezeichnung<input name="name" required placeholder="z. B. Brustpresse oder Sit-Ups"></label>'+
            '<label>Gerätenummer optional<input name="equipment_number" placeholder="z. B. 01"></label>'+
            '<label>Kategorie / Gruppe<input name="category" placeholder="z. B. Brust, Beine, Cardio"></label>'+
            '<label>Muskelgruppe optional<input name="muscle_group" placeholder="z. B. Quadrizeps"></label>'+
            '<label>Geräteeinstellungen optional<input name="settings_text" placeholder="z. B. Sitzposition 4 · Fußrolle 3"></label>'+
            '<label>Belastung<select name="load_mode"><option value="weight">Gewicht</option><option value="assistance">Unterstützungsgewicht</option><option value="none">Keine Gewichtsangabe</option></select></label>'+
            '<button type="submit">Übung / Gerät speichern</button>'+
          '</form>'+
        '</details>'+
        errorNote()+
      '</div></section>';
  }

  function openExecutionHelp(exerciseId){
    const item=(state.catalogExercises||[]).find(entry=>String(entry.id)===String(exerciseId));
    const execution=exerciseExecutionData(item);
    if(!item||!execution)return false;

    document.getElementById('sportExecutionHelpV633')?.remove();
    const steps=Array.isArray(execution.steps)?execution.steps:[];
    const cues=Array.isArray(execution.cues)?execution.cues:[];
    const halfway=Boolean(execution.halfway_switch);

    const wrap=document.createElement('div');
    wrap.innerHTML='<dialog id="sportExecutionHelpV633" class="sport-execution-dialog-v633">'+
      '<div class="sport-execution-dialog-card-v633">'+
        '<div class="sport-execution-dialog-head-v633"><div><span>AUSFÜHRUNG</span><h3>'+esc(item.name)+'</h3></div><button type="button" data-sport-close-execution-help aria-label="Schließen">×</button></div>'+
        (halfway?'<div class="sport-execution-half-note-v633">½ Zur Halbzeit Seite wechseln</div>':'')+
        (execution.summary?'<p>'+esc(execution.summary)+'</p>':'')+
        (steps.length?'<ol>'+steps.map(step=>'<li>'+esc(step)+'</li>').join('')+'</ol>':'')+
        (cues.length?'<div class="sport-execution-dialog-cues-v633"><strong>Darauf achten</strong>'+cues.map(cue=>'<span>'+esc(cue)+'</span>').join('')+'</div>':'')+
      '</div>'+
    '</dialog>';
    const dialog=wrap.firstElementChild;
    document.body.appendChild(dialog);

    const close=()=>{
      try{dialog.close?.();}catch(_){}
      dialog.remove();
    };
    dialog.querySelector('[data-sport-close-execution-help]')?.addEventListener('click',close);
    dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
    return true;
  }

  function exerciseExecutionData(item){
    const config=item?.metric_config&&typeof item.metric_config==='object'?item.metric_config:{};
    const execution=config.execution&&typeof config.execution==='object'?config.execution:null;
    return execution?{...execution,circuit:Boolean(config.circuit)}:null;
  }

  function executionPanel(){
    const items=(state.catalogExercises||[])
      .map(item=>({item,execution:exerciseExecutionData(item)}))
      .filter(entry=>entry.execution?.circuit)
      .sort((a,b)=>(Number(a.item.sort_order)||9999)-(Number(b.item.sort_order)||9999)||byName(a.item.name,b.item.name));

    const cards=items.length?items.map(({item,execution},index)=>{
      const steps=Array.isArray(execution.steps)?execution.steps:[];
      const cues=Array.isArray(execution.cues)?execution.cues:[];
      const visuals=execution.visuals&&typeof execution.visuals==='object'?execution.visuals:{};
      const halfway=Boolean(execution.halfway_switch);
      return '<details class="sport-execution-card-v622" style="--sport-execution-index-v622:'+index+'">'+
        '<summary>'+
          '<div><span>ZIRKELTRAINING'+(item.settings_text?' · '+esc(item.settings_text):'')+'</span><h3>'+esc(item.name)+'</h3><small>'+esc(item.muscle_group||item.category||'')+'</small></div>'+
          (halfway?'<b class="sport-execution-half-v622">½ SEITENWECHSEL</b>':'<b>AUSFÜHRUNG</b>')+
        '</summary>'+
        '<div class="sport-execution-body-v622">'+
          '<p>'+esc(execution.summary||'')+'</p>'+
          (steps.length?'<ol>'+steps.map(step=>'<li>'+esc(step)+'</li>').join('')+'</ol>':'')+
          (cues.length?'<div class="sport-execution-cues-v622"><strong>Darauf achten</strong><div>'+cues.map(cue=>'<span>'+esc(cue)+'</span>').join('')+'</div></div>':'')+
          ((visuals.start||visuals.key)?'<div class="sport-execution-visual-plan-v622"><div><span>STARTPOSITION</span><small>'+esc(visuals.start||'')+'</small></div><div><span>SCHLÜSSELPOSITION</span><small>'+esc(visuals.key||'')+'</small></div><em>Skizzen folgen später</em></div>':'')+
        '</div>'+
      '</details>';
    }).join(''):'<div class="sport-empty-inline-v568">Für den Ausführungskatalog sind noch keine Zirkelübungen hinterlegt.</div>';

    const homeNames=[
      'Goblet Squat mit Medizinball',
      'Kettlebell Swing',
      'Ring Row',
      'Plank Up-Down',
      'Side Plank',
      'Stability Ball Pass',
      'Mountain Climbers',
      'Plank'
    ];
    const available=new Set(items.map(entry=>entry.item.name));
    const home=homeNames.filter(name=>available.has(name));
    const homeBlock=home.length?'<section class="sport-home-circuit-draft-v622">'+
      '<div><span>HOME-ZIRKEL · ENTWURF</span><strong>8 Stationen · 40 s Arbeit · 20 s Pause</strong><small>2–3 Runden · Side Plank wechselt beim Halbzeitsignal die Seite.</small></div>'+
      '<div class="sport-home-circuit-stations-v622">'+home.map((name,index)=>'<i><b>'+(index+1)+'</b><span>'+esc(name)+'</span></i>').join('')+'</div>'+
    '</section>':'';

    return '<section class="sport-panel-v510 sport-panel-v512" data-sport-panel-v568="execution">'+wave()+
      '<div class="sport-hero-v510"><div class="sport-kicker-v510"><span class="sport-live-dot-v510"></span>AUSFÜHRUNG '+statusBadge()+'</div><p class="sport-date-v510">Zirkelübungen kurz nachschlagen, ohne den Trainingsfluss zu zerlegen.</p><div class="sport-section-mark-v512">A</div></div>'+
      '<div class="sport-content-v510">'+homeBlock+
        '<div class="sport-execution-note-v622">Antippen öffnet die Ausführung. Die kleinen Start-/Schlüsselpositions-Skizzen sind bereits als Konzept hinterlegt und werden später gestalterisch ergänzt.</div>'+
        '<div class="sport-execution-list-v622">'+cards+'</div>'+errorNote()+
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
    return `<section class="sport-panel-v510 sport-panel-v512" data-sport-panel-v512="statistics" data-sport-panel-v568="statistics">${wave()}<div class="sport-hero-v510"><div class="sport-kicker-v510"><span class="sport-live-dot-v510"></span>STATISTIK ${statusBadge()}</div><p class="sport-date-v510">Alle Sportarten und Trainingsformen gemeinsam</p><div class="sport-duration-row-v510"><div class="sport-duration-v510" data-total-minutes="${s.allMinutes}">${esc(formatMinutes(s.allMinutes).replace(' h',''))}</div><div class="sport-duration-unit-v510">Trainingszeit gesamt</div></div></div><div class="sport-content-v510"><div class="sport-stat-grid-v568"><article class="sport-stat-card-v512"><span>Trainingstage</span><strong>${s.allSessions}</strong></article><article class="sport-stat-card-v512"><span>FitX-Besuche</span><strong>${s.fitxSessions}</strong></article><article class="sport-stat-card-v512"><span>Freies Training</span><strong>${s.freeTrainingCount}</strong></article><article class="sport-stat-card-v512"><span>Kurse</span><strong>${s.courseCount}</strong></article><article class="sport-stat-card-v512"><span>Übungen & Geräte</span><strong>${s.workoutItemCount}</strong></article><article class="sport-stat-card-v512"><span>Gemischte Tage</span><strong>${s.mixedCount}</strong></article></div><div class="sport-stat-foot-v610">FitX-Zeit: <b>${esc(formatMinutes(s.fitxMinutes))}</b> · Kurszeit: <b>${esc(formatMinutes(s.courseTotal))}</b> · Cardio-Geräte: <b>${s.cardioCount}</b></div><div class="sport-stats-columns-v568"><div><div class="sport-section-title-v568">Kurse</div>${courses}</div><div><div class="sport-section-title-v568">Mit dabei</div>${people}</div></div>${errorNote()}</div></section>`;
  }


  function panel(rows){if(activeTab==='planning')return planningPanel();if(activeTab==='sessions')return xTrainingPanel();if(activeTab==='catalog')return catalogPanel();if(activeTab==='execution')return executionPanel();if(activeTab==='statistics')return statisticsPanel(rows);return fitxPanel(rows);}

  function render({animate=false}={}){
    const serial=++renderSerial;
    const root=ensureRoot();
    if(!root)return false;
    root.dataset.sportTabV568=activeTab;
    root.innerHTML=`<div class="sport-stage-v510 sport-stage-v512 sport-stage-v568">${tabRail()}${panel(state.sessions)}</div>`;
    restoreSportDrafts(root);
    startActiveClock(root);

    const handle=async(button,task)=>{
      if(button)button.disabled=true;
      try{await task();}
      catch(error){console.error(error);alert(error?.message||'Aktion fehlgeschlagen.');if(button)button.disabled=false;}
    };

    if(root.dataset.sportDelegatedV613!=='1'){
      root.dataset.sportDelegatedV613='1';
      const rememberDraft=event=>{
        const form=event.target?.closest?.('[data-sport-set-form],[data-sport-cardio-form]');
        if(form)storeSportDraft(form);
      };
      root.addEventListener('input',rememberDraft);
      root.addEventListener('change',rememberDraft);
      root.addEventListener('click',event=>{
        const rirButton=event.target.closest('[data-sport-rir-value]');
        if(rirButton){
          const wrap=rirButton.closest('[data-sport-rir-stepper]');
          const input=wrap?.querySelector('input[name="rir"]');
          if(!input)return;
          const value=String(rirButton.dataset.sportRirValue||'0');
          input.value=value;
          storeSportDraft(wrap.closest('[data-sport-set-form]'));
          wrap.querySelectorAll('[data-sport-rir-value]').forEach(button=>{
            const selected=button===rirButton;
            button.classList.toggle('is-selected',selected);
            button.setAttribute('aria-pressed',selected?'true':'false');
          });
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
          storeSportDraft(form);
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
        storeSportDraft(form);
      });
    }

    root.querySelectorAll('[data-sport-tab-v568]').forEach(button=>button.addEventListener('click',()=>setTab(button.dataset.sportTabV568,{animate:true,persist:true})));
    root.querySelectorAll('[data-sport-retry-v568]').forEach(button=>button.addEventListener('click',()=>load(true)));
    root.querySelectorAll('[data-sport-plan-mode]').forEach(button=>button.addEventListener('click',event=>{
      planTestMode=event.currentTarget.dataset.sportPlanMode==='test';
      coursePickerDate=null;
      catalogTargetSessionId=null;
      render({animate:true});
    }));

    root.querySelectorAll('[data-sport-create-plan]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget;
      handle(target,()=>createPlanSession(target.dataset.sportCreatePlan));
    }));
    root.querySelector('[data-sport-plan-date]')?.addEventListener('change',event=>{
      const value=event.currentTarget.value;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return;
      planDate=value;
      coursePickerDate=null;
      render({animate:false});
    });
    root.querySelectorAll('[data-sport-select-plan]').forEach(button=>button.addEventListener('click',event=>{
      planDate=event.currentTarget.dataset.sportSelectPlan||todayIso();
      coursePickerDate=null;
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

    root.querySelectorAll('[data-sport-delete-day-plan]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget;
      if(!window.confirm('Diesen Tagesplan wirklich löschen? Übungen, Zirkel-Zuordnung und geplante Kurse dieses Tages werden entfernt.'))return;
      handle(target,()=>deleteDayPlan(target.dataset.sportDeleteDayPlan));
    }));

    root.querySelectorAll('[data-sport-toggle-course-picker]').forEach(button=>button.addEventListener('click',event=>{
      const key=event.currentTarget.dataset.coursePickerKey||event.currentTarget.dataset.sportToggleCoursePicker;
      coursePickerDate=String(coursePickerDate||'')===String(key)?null:key;
      render({animate:false});
    }));

    root.querySelectorAll('[data-sport-add-course-plan]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget;
      handle(target,()=>addCoursePlan(target.dataset.sportAddCoursePlan,target.dataset.courseDate));
    }));
    root.querySelectorAll('[data-sport-add-test-course-plan]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget;
      handle(target,()=>addTestCoursePlan(target.dataset.sportAddTestCoursePlan,target.dataset.courseDate));
    }));

    root.querySelectorAll('[data-sport-remove-course-plan]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget;
      handle(target,()=>removeCoursePlan(target.dataset.sportRemoveCoursePlan));
    }));
    root.querySelectorAll('[data-sport-remove-test-course-plan]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget;
      handle(target,()=>removeTestCoursePlan(target.dataset.sportRemoveTestCoursePlan));
    }));


    root.querySelectorAll('[data-sport-book-weekly]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget;
      handle(target,()=>bookWeeklyCourse(target.dataset.sportBookWeekly,target.dataset.courseDate));
    }));
    root.querySelectorAll('[data-sport-book-special]').forEach(form=>form.addEventListener('submit',event=>{
      event.preventDefault();const target=event.currentTarget,submit=target.querySelector('button[type="submit"]');
      handle(submit,()=>bookSpecialCourse(target.dataset.sportBookSpecial,new FormData(target)));
    }));
    root.querySelectorAll('[data-sport-remove-occurrence]').forEach(button=>button.addEventListener('click',event=>{
      event.preventDefault();const target=event.currentTarget;
      handle(target,()=>removeCourseOccurrence(target.dataset.sportRemoveOccurrence));
    }));
    root.querySelectorAll('[data-sport-save-people]').forEach(button=>button.addEventListener('click',event=>{
      const el=event.currentTarget;
      const form=el.closest('[data-sport-complete-occurrence]');
      handle(el,()=>saveCoursePeople(el.dataset.sportSavePeople,new FormData(form).get('participants')));
    }));
    root.querySelectorAll('[data-sport-complete-occurrence]').forEach(form=>form.addEventListener('submit',event=>{
      event.preventDefault();const target=event.currentTarget,submit=target.querySelector('button[type="submit"]');
      handle(submit,()=>completeCourseOccurrence(target.dataset.sportCompleteOccurrence,new FormData(target).get('participants')));
    }));

    root.querySelectorAll('[data-sport-course-attendance]').forEach(form=>form.addEventListener('submit',event=>{
      event.preventDefault();
      const target=event.currentTarget;
      const submit=target.querySelector('button[type="submit"]');
      const data=new FormData(target);
      handle(submit,()=>recordCourseAttendance(target.dataset.sportCourseAttendance,target.dataset.courseDate,data.get('participants')));
    }));
    root.querySelectorAll('[data-sport-test-course-attendance]').forEach(form=>form.addEventListener('submit',event=>{
      event.preventDefault();
      const target=event.currentTarget;
      const submit=target.querySelector('button[type="submit"]');
      const data=new FormData(target);
      handle(submit,()=>recordTestCourseAttendance(target.dataset.sportTestCourseAttendance,target.dataset.courseId,data.get('participants')));
    }));

    root.querySelectorAll('[data-sport-course-time]').forEach(form=>form.addEventListener('submit',event=>{
      event.preventDefault();
      const target=event.currentTarget;
      const submit=target.querySelector('button[type="submit"]');
      const data=new FormData(target);
      handle(submit,()=>saveCourseTime(target.dataset.sportCourseTime,data.get('start'),data.get('end')));
    }));

    root.querySelectorAll('[data-sport-timeline]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget;
      handle(target,async()=>{
        await markTimeline(target.dataset.sportTimeline,target.dataset.column);
        if(target.dataset.column==='gym_left_at')setTab('sessions',{animate:true,persist:true});
      });
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

    root.querySelectorAll('[data-sport-exercise-participants]').forEach(form=>form.addEventListener('submit',event=>{
      event.preventDefault();
      const submit=form.querySelector('button[type="submit"]');
      const data=new FormData(form);
      handle(submit,()=>saveExerciseParticipants(form.dataset.sportExerciseParticipants,data.get('participants'),false));
    }));

    root.querySelectorAll('[data-sport-exercise-participants-forward]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget;
      const form=target.closest('[data-sport-exercise-participants]');
      const data=form?new FormData(form):null;
      handle(target,()=>saveExerciseParticipants(target.dataset.sportExerciseParticipantsForward,data?.get('participants')||'',true));
    }));

    root.querySelectorAll('[data-sport-participant-stop-forward]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget;
      handle(target,()=>removeExerciseParticipantForward(target.dataset.sportParticipantStopForward,target.dataset.participantName));
    }));

    root.querySelectorAll('[data-sport-activity-participants]').forEach(form=>form.addEventListener('submit',event=>{
      event.preventDefault();
      const submit=form.querySelector('button[type="submit"]');
      const data=new FormData(form);
      handle(submit,()=>saveActivityParticipants(form.dataset.sportActivityParticipants,data.get('participants')));
    }));

    root.querySelectorAll('[data-sport-remove-activity-participant]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget;
      handle(target,()=>removeActivityParticipant(target.dataset.sportRemoveActivityParticipant,target.dataset.participantName));
    }));

    root.querySelectorAll('[data-sport-session-times]').forEach(form=>form.addEventListener('submit',event=>{
      event.preventDefault();
      const submit=form.querySelector('button[type="submit"]');
      const data=new FormData(form);
      handle(submit,()=>saveSessionTimes(form.dataset.sportSessionTimes,form.dataset.sessionDate,data));
    }));

    root.querySelectorAll('[data-sport-complete-session]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget;
      const session=sessionById(target.dataset.sportCompleteSession);
      const question=session?.isTest?'Testlauf beenden und alle Testdaten verwerfen?':'Training wirklich abschließen?';
      if(!window.confirm(question))return;
      handle(target,async()=>{
        await completeTrainingSession(target.dataset.sportCompleteSession);
        const keepFitxOpen=!session?.isTest&&isFitx(session)&&!session?.gymLeftAt;
        setTab(session?.isTest||keepFitxOpen?'overview':'sessions',{animate:true,persist:true});
      });
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

    root.querySelectorAll('[data-sport-catalog-group]').forEach(detail=>detail.addEventListener('toggle',()=>{
      const group=detail.dataset.sportCatalogGroup;
      if(detail.open)expandedCatalogGroups.add(group);else expandedCatalogGroups.delete(group);
    }));

    root.querySelectorAll('[data-sport-execution-help]').forEach(button=>button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      openExecutionHelp(event.currentTarget.dataset.sportExecutionHelp);
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
      handle(target,async()=>{
        const exerciseId=target.dataset.sportExerciseStatus;
        const status=target.dataset.status;
        if(status==='completed')await saveActiveStrengthSet(root,exerciseId,{force:false,reload:false});
        await setExerciseStatus(exerciseId,status);
      });
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

    root.querySelectorAll('[data-sport-active-next-set]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget;
      handle(target,()=>saveActiveStrengthSetAndAdvance(root,target.dataset.sportActiveNextSet));
    }));

    root.querySelectorAll('[data-sport-add-set]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget;
      handle(target,()=>changeStrengthSetCount(target.dataset.sportAddSet,'up'));
    }));
    root.querySelectorAll('[data-sport-remove-set]').forEach(button=>button.addEventListener('click',event=>{
      const target=event.currentTarget;
      const exercise=state.sessions.flatMap(session=>session.workout||[]).find(item=>item.id===target.dataset.sportRemoveSet);
      const current=strengthSetCount(exercise);
      const saved=(exercise?.sets||[]).find(set=>Number(set.setNumber)===current);
      if(saved&&!window.confirm('Satz '+current+' wirklich löschen?'))return;
      handle(target,()=>changeStrengthSetCount(target.dataset.sportRemoveSet,'down'));
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

  function setTab(id,{animate=true,persist=true}={}){
    const migrated={fitx:'overview',xtraining:'planning',activities:'sessions'}[id]||id;
    activeTab=TABS.some(t=>t.id===migrated)?migrated:'overview';
    if(activeTab==='planning'){
      planDate=todayIso();
      coursePickerDate=null;
    }
    if(persist)try{localStorage.setItem(TAB_KEY,activeTab);}catch(_){ }
    render({animate});
    return activeTab;
  }
  function currentMode(){return document.body.classList.contains('mod-sport-mode-v510')?'sport':'todo';}
  function setMode(mode,{persist=true,animate=true}={}){
    mode=mode==='sport'?'sport':'todo';
    if(mode==='sport')activeTab='overview';
    ensureRoot();ensureChrome();document.body.classList.toggle('mod-sport-mode-v510',mode==='sport');document.body.dataset.modAppModeV510=mode;document.getElementById('sportSwitchV510')?.removeAttribute('aria-pressed');
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
    activeTab='overview';
    planDate=todayIso();
    try{localStorage.removeItem(PLAN_DATE_KEY);}catch(_){ }
    ensureRoot();render();
    ensureChrome();
    /* V603: Module preload must never switch the visible surface by itself. */
    setMode('todo',{persist:false,animate:false});
  }

  const api={version:VERSION,load,refresh:()=>load(true),render,setMode,toggle:toggleMode,currentMode,loadSessions,saveSessions,modeKey:MODE_KEY,dataKey:CACHE_KEY,getState:()=>({loaded:state.loaded,loading:state.loading,error:state.error,source:state.source,sessions:state.sessions.length,planDate,planTestMode}),getPlanDate:()=>planDate,getPlanTestMode:()=>planTestMode,getSessions:()=>state.sessions,getActiveSession:()=>activeTrainingSession(),getPlanSession:(dateKey=planDate)=>planSessionForDate(dateKey),createPlanSession,openExecutionHelp};
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
