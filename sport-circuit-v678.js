/* V678 · SPORT · variant management */
(function(){
  'use strict';
  if(window.__modSportCircuitV671)return;

  const VERSION='V678';
  const ROOT_ID='sportRootV510';
  const CARD_PLAN='sportCircuitPlanV669';
  const CARD_LIVE='sportCircuitLiveV669';
  const CARD_HISTORY='sportCircuitHistoryV669';
  const LOCAL_RUN_KEY='masterOfDisasterCircuitRunV669';
  const DEFAULT_EXERCISES=[
    'Goblet Squat mit Medizinball',
    'Kettlebell Swing',
    'Ring Row',
    'Plank Up-Down',
    'Side Plank',
    'Stability Ball Pass',
    'Mountain Climbers',
    'Plank'
  ];

  let state={
    loaded:false,
    loading:false,
    error:null,
    user:null,
    catalog:[],
    plans:[],
    planExercises:[],
    sessionPlans:[],
    runs:[],
    runExercises:[],
    runningIntervals:[]
  };
  let runtime=null;
  let editingPlanId=null;
  let variantDraft=null;
  let audioContext=null;
  let audioNodes=[];
  let wakeLock=null;
  let mountTimer=null;
  let observer=null;

  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
  const todayIso=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const clock=value=>{const d=value?new Date(value):null;return d&&Number.isFinite(d.getTime())?new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit',hour12:false}).format(d):'–';};
  const shortDate=value=>{const d=value?new Date(value):null;return d&&Number.isFinite(d.getTime())?new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric'}).format(d):'–';};
  const uid=()=>crypto?.randomUUID?.()||('c'+Date.now().toString(36)+Math.random().toString(36).slice(2));

  function client(){
    try{
      if(typeof window.getSupabaseClient==='function')return window.getSupabaseClient();
      if(typeof getSupabaseClient==='function')return getSupabaseClient();
    }catch(_){}
    return null;
  }

  async function sportUser(){
    const supabase=client();
    if(!supabase)throw new Error('Supabase-Client ist nicht verfügbar.');
    const result=await supabase.auth.getSession();
    if(result?.error)throw result.error;
    const user=result?.data?.session?.user;
    if(!user?.id)throw new Error('Nicht angemeldet.');
    return {supabase,user};
  }

  function currentPlan(){
    const cardPlanId=document.getElementById(CARD_PLAN)?.dataset.planId||document.getElementById(CARD_LIVE)?.dataset.planId||'';
    const id=editingPlanId||cardPlanId;
    return (id?state.plans.find(plan=>String(plan.id)===String(id)):null)||state.plans[0]||null;
  }

  function currentPlanDate(){
    return window.__modSportV568?.getPlanDate?.()||todayIso();
  }

  function plannedDaySession(){
    return window.__modSportV568?.getPlanSession?.(currentPlanDate())||null;
  }

  function activeDaySession(){
    return window.__modSportV568?.getActiveSession?.()||null;
  }

  function sportSessions(){
    return window.__modSportV568?.getSessions?.()||[];
  }

  function variantNumber(plan){
    const match=/(\d+)/.exec(String(plan?.name||''));
    return match?Number(match[1]):Number.MAX_SAFE_INTEGER;
  }

  function variantCompare(a,b){
    const diff=variantNumber(a)-variantNumber(b);
    return diff||String(a?.name||'').localeCompare(String(b?.name||''),'de',{numeric:true,sensitivity:'base'});
  }

  function nextVariantNumber(){
    const used=new Set(state.plans.map(variantNumber).filter(Number.isFinite));
    let n=1;
    while(used.has(n))n++;
    return n;
  }

  function linkForSession(sessionId){
    return state.sessionPlans.find(row=>String(row.session_id)===String(sessionId))||null;
  }

  function planForSession(sessionId){
    const link=linkForSession(sessionId);
    return link?state.plans.find(plan=>String(plan.id)===String(link.plan_id))||null:null;
  }

  function selectedPlanRows(plan=currentPlan()){
    if(!plan)return [];
    const byId=new Map(state.catalog.map(item=>[String(item.id),item]));
    return state.planExercises
      .filter(row=>String(row.plan_id)===String(plan.id))
      .sort((a,b)=>Number(a.sort_order)-Number(b.sort_order))
      .map(row=>({row,item:byId.get(String(row.exercise_id))}))
      .filter(entry=>entry.item);
  }

  async function seedDefaultPlan(){
    const {supabase,user}=await sportUser();
    if(state.plans.length)return;
    const planId=uid();
    const now=new Date().toISOString();
    const created=await supabase.from('sport_circuit_plans').insert({
      id:planId,user_id:user.id,name:'Home-Zirkel',rounds:3,work_seconds:40,rest_seconds:20,round_break_seconds:90,active:true,created_at:now,updated_at:now
    });
    if(created.error)throw created.error;
    const byName=new Map(state.catalog.map(item=>[String(item.name),item]));
    let items=DEFAULT_EXERCISES.map(name=>byName.get(name)).filter(Boolean);
    if(!items.length)items=state.catalog.slice(0,8);
    if(items.length){
      const inserted=await supabase.from('sport_circuit_plan_exercises').insert(items.map((item,index)=>({
        id:uid(),user_id:user.id,plan_id:planId,exercise_id:item.id,sort_order:index+1
      })));
      if(inserted.error)throw inserted.error;
    }
  }

  async function loadData({seed=true}={}){
    if(state.loading)return;
    state={...state,loading:true,error:null};
    try{
      const {supabase,user}=await sportUser();
      const catalogQ=supabase.from('sport_exercise_catalog')
        .select('id,name,category,muscle_group,settings_text,metric_config,sort_order')
        .eq('user_id',user.id).eq('active',true).eq('category','Zirkeltraining')
        .order('sort_order').order('name');
      const plansQ=supabase.from('sport_circuit_plans')
        .select('id,user_id,name,rounds,work_seconds,rest_seconds,round_break_seconds,active,created_at,updated_at')
        .eq('user_id',user.id).eq('active',true).order('updated_at',{ascending:false}).limit(20);
      const planItemsQ=supabase.from('sport_circuit_plan_exercises')
        .select('id,plan_id,exercise_id,sort_order').eq('user_id',user.id).order('sort_order');
      const sessionPlansQ=supabase.from('sport_session_circuit_plans')
        .select('id,session_id,plan_id,sort_order,created_at').eq('user_id',user.id).order('sort_order');
      const runsQ=supabase.from('sport_circuit_runs')
        .select('id,plan_id,session_id,name_snapshot,planned_rounds,work_seconds,rest_seconds,round_break_seconds,status,completed_rounds,current_round,current_exercise_index,current_elapsed_seconds,total_active_seconds,started_at,ended_at,updated_at')
        .eq('user_id',user.id).order('started_at',{ascending:false}).limit(25);
      const runningIntervalsQ=supabase.from('sport_circuit_intervals')
        .select('id,run_id,run_exercise_id,round_number,started_at,elapsed_seconds,status')
        .eq('user_id',user.id).eq('status','running').limit(20);

      const [catalogR,plansR,planItemsR,sessionPlansR,runsR,runningIntervalsR]=await Promise.all([catalogQ,plansQ,planItemsQ,sessionPlansQ,runsQ,runningIntervalsQ]);
      for(const result of [catalogR,plansR,planItemsR,sessionPlansR,runsR,runningIntervalsR])if(result.error)throw result.error;

      state={...state,
        user,
        catalog:catalogR.data||[],
        plans:(plansR.data||[]).sort(variantCompare),
        planExercises:planItemsR.data||[],
        sessionPlans:sessionPlansR.data||[],
        runs:runsR.data||[],
        runningIntervals:runningIntervalsR.data||[],
        loaded:true,loading:false,error:null
      };

      if(seed&&!state.plans.length){
        await seedDefaultPlan();
        return loadData({seed:false});
      }

      const runIds=(state.runs||[]).map(run=>run.id);
      if(runIds.length){
        const runItemsR=await supabase.from('sport_circuit_run_exercises')
          .select('id,run_id,exercise_id,name_snapshot,settings_snapshot,execution_snapshot,sort_order')
          .eq('user_id',user.id).in('run_id',runIds).order('sort_order');
        if(runItemsR.error)throw runItemsR.error;
        state={...state,runExercises:runItemsR.data||[]};
      }else state={...state,runExercises:[]};

      document.getElementById(CARD_PLAN)?.remove();
      document.getElementById(CARD_HISTORY)?.remove();
      if(!runtime)document.getElementById(CARD_LIVE)?.remove();
      scheduleMount();
    }catch(error){
      state={...state,loading:false,error:error?.message||String(error)};
      console.error('[V669 circuit] load failed',error);
      scheduleMount();
    }
  }

  function injectStyle(){
    if(document.getElementById('sportCircuitStyleV669'))return;
    const style=document.createElement('style');
    style.id='sportCircuitStyleV669';
    style.textContent=[
      '#'+CARD_PLAN+',#'+CARD_LIVE+',#'+CARD_HISTORY+'{position:relative;margin:0 0 14px;padding:14px;border:1px solid rgba(111,228,234,.18);border-radius:16px;background:linear-gradient(180deg,rgba(7,33,38,.88),rgba(3,18,22,.78));box-shadow:inset 0 1px 0 rgba(255,255,255,.03)}',
      '.sc-kicker-v669{color:#74d6dc;font-size:.56rem;font-weight:950;letter-spacing:.14em}',
      '.sc-head-v669{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-top:4px}.sc-head-v669 h3{margin:0;color:#eefcfd;font-size:1rem}.sc-head-v669 p{margin:4px 0 0;color:#83a4a8;font-size:.65rem;line-height:1.4}',
      '.sc-grid-v669{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}.sc-grid-v669 label{display:grid;gap:4px;color:#78999d;font-size:.56rem;font-weight:850;text-transform:uppercase}.sc-grid-v669 input{width:100%;box-sizing:border-box;padding:10px;border:1px solid rgba(111,228,234,.16);border-radius:10px;background:rgba(0,0,0,.2);color:#eefcfd;font:inherit;font-size:.78rem}',
      '.sc-actions-v669{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.sc-actions-v669 button,.sc-picker-v669 button,.sc-row-v669 button{appearance:none;border:1px solid rgba(111,228,234,.22);border-radius:10px;background:linear-gradient(180deg,rgba(24,123,135,.72),rgba(12,74,84,.78));color:#e8fcfd;padding:10px 12px;font:inherit;font-size:.63rem;font-weight:900}.sc-actions-v669 .primary{background:linear-gradient(180deg,rgba(42,153,111,.82),rgba(21,103,77,.86));border-color:rgba(111,237,184,.28)}.sc-actions-v669 .danger,#'+CARD_LIVE+' .danger{background:rgba(94,32,38,.8);border-color:rgba(248,113,125,.3)}',
      '.sc-list-v669{display:grid;gap:7px;margin-top:10px}.sc-row-v669{display:grid;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px 9px;border-radius:11px;background:rgba(0,0,0,.15)}.sc-row-v669>i{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:rgba(111,228,234,.1);color:#a9e8ec;font-style:normal;font-size:.62rem;font-weight:950}.sc-row-v669 strong{display:block;color:#e7f7f8;font-size:.68rem}.sc-row-v669 small{display:block;margin-top:2px;color:#66888c;font-size:.56rem}.sc-row-actions-v669{display:flex;gap:4px}.sc-row-v669 button{padding:6px 8px;background:rgba(0,0,0,.18)}',
      '.sc-picker-v669{margin-top:10px}.sc-picker-v669 summary{cursor:pointer;color:#9cdde1;font-size:.63rem;font-weight:900}.sc-picker-grid-v669{display:grid;gap:6px;margin-top:8px}.sc-picker-grid-v669 button{display:flex;justify-content:space-between;text-align:left;background:rgba(0,0,0,.16)}.sc-picker-grid-v669 button:disabled{opacity:.38}',
      '#'+CARD_LIVE+'{overflow:hidden;background:radial-gradient(circle at 86% 14%,rgba(31,188,197,.18),transparent 34%),linear-gradient(180deg,rgba(6,38,43,.96),rgba(2,17,21,.94))}.sc-live-top-v669{display:flex;justify-content:space-between;align-items:center;gap:12px}.sc-phase-v669{color:#74d6dc;font-size:.58rem;font-weight:950;letter-spacing:.16em}.sc-round-v669{color:#76979b;font-size:.58rem;font-weight:850}.sc-exercise-v669{margin:12px 0 2px;color:#f0fcfd;font-size:1.08rem;font-weight:950;line-height:1.2}.sc-next-v669{min-height:1.1em;color:#73969a;font-size:.61rem}.sc-clock-v669{margin:10px 0 0;color:#f5ffff;font-size:4.2rem;font-weight:950;line-height:.9;letter-spacing:-.05em;font-variant-numeric:tabular-nums}.sc-clock-unit-v669{color:#6f9296;font-size:.58rem;font-weight:850;text-transform:uppercase}.sc-progress-v669{height:6px;margin:12px 0;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden}.sc-progress-v669 i{display:block;height:100%;width:0;background:linear-gradient(90deg,#2b9ca6,#7ae0d2);transition:width .08s linear}.sc-live-meta-v669{display:flex;justify-content:space-between;gap:10px;color:#75979b;font-size:.58rem}.sc-live-actions-v669{display:flex;justify-content:flex-end;margin-top:13px}.sc-live-actions-v669 button{appearance:none;border-radius:10px;padding:11px 14px;color:#ffe9eb;font:inherit;font-size:.65rem;font-weight:950}',
      '.sc-interrupted-v669{border-color:rgba(246,183,88,.26)!important}.sc-interrupted-v669 .sc-phase-v669{color:#f1bd6f}.sc-done-v669 .sc-phase-v669{color:#82e0ad}',
      '.sc-history-list-v669{display:grid;gap:7px;margin-top:10px}.sc-history-row-v669{padding:9px 10px;border-radius:11px;background:rgba(0,0,0,.14)}.sc-history-row-v669>div{display:flex;justify-content:space-between;gap:10px}.sc-history-row-v669 strong{color:#e9f8f9;font-size:.67rem}.sc-history-row-v669 b{color:#8fbdc1;font-size:.6rem}.sc-history-row-v669 small{display:block;margin-top:3px;color:#68898d;font-size:.56rem;line-height:1.4}.sc-status-ok-v669{color:#7bdca4!important}.sc-status-stop-v669{color:#e3a47f!important}.sc-error-v669{margin-top:8px;color:#ef9c9c;font-size:.58rem}',
      '@media(max-width:520px){.sc-grid-v669{grid-template-columns:repeat(2,minmax(0,1fr))}.sc-clock-v669{font-size:3.6rem}.sc-row-v669{grid-template-columns:28px minmax(0,1fr)}.sc-row-actions-v669{grid-column:2;justify-content:flex-start}}'
    ].join('');
    document.head.appendChild(style);
  }

  function variantRowsHtml(selectedId=''){
    if(!state.plans.length)return '<span>Noch keine Zirkelvariante vorhanden.</span>';
    return [...state.plans].sort(variantCompare).map(plan=>{
      const count=selectedPlanRows(plan).length;
      const selected=String(plan.id)===String(selectedId);
      return '<button type="button" data-circuit-link-plan="'+esc(plan.id)+'" '+(selected?'disabled':'')+'><strong>'+esc(plan.name)+'</strong><small>'+esc(plan.rounds)+' Runden · '+count+' Stationen'+(selected?' · eingeplant':' · zum Tagesplan')+'</small></button>'+
        '<button type="button" data-circuit-delete-variant="'+esc(plan.id)+'">🗑 '+esc(plan.name)+' löschen</button>';
    }).join('');
  }

  function variantDraftHtml(){
    if(!variantDraft)return '';
    return '<details class="sc-picker-v669" open><summary>Neue Variante vorbereiten</summary>'+
      '<div class="sc-grid-v669">'+
        '<label>Name<input data-circuit-draft-field="name" type="text" maxlength="40" value="'+esc(variantDraft.name)+'"></label>'+
        '<label>Runden<input data-circuit-draft-field="rounds" type="number" min="1" max="700" value="'+esc(variantDraft.rounds)+'"></label>'+
        '<label>Arbeit s<input data-circuit-draft-field="work_seconds" type="number" min="5" max="600" value="'+esc(variantDraft.work_seconds)+'"></label>'+
        '<label>Stationspause s<input data-circuit-draft-field="rest_seconds" type="number" min="0" max="300" value="'+esc(variantDraft.rest_seconds)+'"></label>'+
        '<label>Rundenpause s<input data-circuit-draft-field="round_break_seconds" type="number" min="0" max="1800" value="'+esc(variantDraft.round_break_seconds)+'"></label>'+
      '</div>'+
      '<div class="sc-error-v669">Die Stationen werden erst beim Anlegen aus Variante 1 kopiert. Vorher wird nichts gespeichert.</div>'+
      '<div class="sc-actions-v669"><button type="button" data-circuit-save-new-variant>Variante anlegen</button><button type="button" data-circuit-cancel-new-variant>Abbrechen</button></div>'+
    '</details>';
  }

  function planningHtml(){
    const session=plannedDaySession();
    const dateKey=currentPlanDate();
    const link=session?linkForSession(session.id):null;
    const linkedPlan=link?state.plans.find(plan=>String(plan.id)===String(link.plan_id))||null:null;

    if(!linkedPlan){
      return '<section id="'+CARD_PLAN+'" data-plan-date="'+esc(dateKey)+'">'+
        '<div class="sc-kicker-v669">ZIRKELTRAINING</div>'+
        '<div class="sc-head-v669"><div><h3>Noch kein Zirkel eingeplant</h3><p>'+(session?'Wähle eine Variante für diesen Tagesplan.':'Wähle direkt eine Variante. Der Tagesplan wird automatisch angelegt.')+'</p></div></div>'+
        '<details class="sc-picker-v669"><summary>+ Zirkeltraining hinzufügen</summary><div class="sc-picker-grid-v669">'+variantRowsHtml()+'</div></details>'+
        '<div class="sc-actions-v669"><button type="button" data-circuit-create-variant>+ Neue Variante vorbereiten</button></div>'+
        variantDraftHtml()+
      '</section>';
    }

    const selected=selectedPlanRows(linkedPlan);
    const selectedIds=new Set(selected.map(entry=>String(entry.item.id)));
    const rows=selected.length?selected.map((entry,index)=>{
      const item=entry.item;
      return '<div class="sc-row-v669" data-circuit-row="'+esc(entry.row.id)+'"><i>'+(index+1)+'</i><div><strong>'+esc(item.name)+'</strong><small>'+esc(item.settings_text||item.muscle_group||'')+'</small></div><div class="sc-row-actions-v669"><button type="button" data-circuit-move="up" data-id="'+esc(entry.row.id)+'" '+(index===0?'disabled':'')+'>↑</button><button type="button" data-circuit-move="down" data-id="'+esc(entry.row.id)+'" '+(index===selected.length-1?'disabled':'')+'>↓</button><button type="button" data-circuit-remove="'+esc(entry.row.id)+'">×</button></div></div>';
    }).join(''):'<div class="sc-error-v669">Noch keine Übung ausgewählt.</div>';
    const picker=state.catalog.map(item=>'<button type="button" data-circuit-add="'+esc(item.id)+'" '+(selectedIds.has(String(item.id))?'disabled':'')+'><span>'+esc(item.name)+'</span><small>'+esc(item.settings_text||'')+'</small></button>').join('');

    return '<section id="'+CARD_PLAN+'" data-plan-date="'+esc(dateKey)+'" data-plan-id="'+esc(linkedPlan.id)+'">'+
      '<div class="sc-kicker-v669">ZIRKELTRAINING · GEPLANT</div>'+
      '<details class="sc-plan-edit-v676">'+
        '<summary class="sc-head-v669"><div><h3>'+esc(linkedPlan.name)+'</h3><p>'+esc(linkedPlan.rounds)+' Runden · '+selected.length+' Stationen · antippen zum Bearbeiten</p></div><span class="sc-round-v669">'+selected.length+' Stationen</span></summary>'+
        '<div class="sc-grid-v669">'+
          '<label>Runden<input data-circuit-field="rounds" type="number" min="1" max="700" value="'+esc(linkedPlan.rounds)+'"></label>'+
          '<label>Arbeit s<input data-circuit-field="work_seconds" type="number" min="5" max="600" value="'+esc(linkedPlan.work_seconds)+'"></label>'+
          '<label>Stationspause s<input data-circuit-field="rest_seconds" type="number" min="0" max="300" value="'+esc(linkedPlan.rest_seconds)+'"></label>'+
          '<label>Rundenpause s<input data-circuit-field="round_break_seconds" type="number" min="0" max="1800" value="'+esc(linkedPlan.round_break_seconds??90)+'"></label>'+
        '</div>'+
        '<div class="sc-list-v669">'+rows+'</div>'+
        '<details class="sc-picker-v669"><summary>+ Übung hinzufügen</summary><div class="sc-picker-grid-v669">'+picker+'</div></details>'+
        '<div class="sc-actions-v669"><button type="button" data-circuit-save>Änderungen speichern</button><button class="danger" type="button" data-circuit-unlink-plan="'+esc(link.id)+'">Aus Tagesplan entfernen</button></div>'+
      '</details>'+
      '<details class="sc-picker-v669"><summary>Variante wechseln / verwalten</summary><div class="sc-picker-grid-v669">'+variantRowsHtml(linkedPlan.id)+'</div></details>'+
      '<div class="sc-actions-v669"><button type="button" data-circuit-create-variant>+ Neue Variante vorbereiten</button></div>'+
      variantDraftHtml()+
    '</section>';
  }

  function historyHtml(){
    const rows=state.runs.filter(run=>run.status!=='running').slice(0,10);
    if(!rows.length)return '';
    const byRun=new Map();
    state.runExercises.forEach(item=>{
      const list=byRun.get(String(item.run_id))||[];
      list.push(item);
      byRun.set(String(item.run_id),list);
    });
    const html=rows.map(run=>{
      const items=(byRun.get(String(run.id))||[]).sort((a,b)=>Number(a.sort_order)-Number(b.sort_order));
      const status=run.status==='completed'?'Geschafft':'Abgebrochen';
      const statusClass=run.status==='completed'?'sc-status-ok-v669':'sc-status-stop-v669';
      let detail='';
      if(run.status==='completed'){
        detail=run.planned_rounds+'/'+run.planned_rounds+' Runden · '+items.length+' Stationen · '+Math.round(Number(run.total_active_seconds)||0)+' s Belastung';
      }else{
        const exercise=items[Math.max(0,Number(run.current_exercise_index||1)-1)];
        const partial=Number(run.current_elapsed_seconds)||0;
        detail=run.completed_rounds+' volle Runden';
        if(Number(run.current_round)>Number(run.completed_rounds))detail+=' · Runde '+run.current_round;
        if(exercise)detail+=' · Übung '+run.current_exercise_index+' '+exercise.name_snapshot;
        if(partial>0)detail+=' · '+Math.round(partial)+' s';
      }
      return '<div class="sc-history-row-v669"><div><strong>'+esc(run.name_snapshot)+'</strong><b class="'+statusClass+'">'+status+'</b></div><small>'+shortDate(run.started_at)+' · '+clock(run.started_at)+(run.ended_at?'–'+clock(run.ended_at):'')+' · '+esc(detail)+'</small></div>';
    }).join('');
    return '<section id="'+CARD_HISTORY+'"><div class="sc-kicker-v669">ZIRKELTRAINING · VERLAUF</div><div class="sc-history-list-v669">'+html+'</div></section>';
  }

  function runningDbRun(){
    return state.runs.find(run=>run.status==='running')||null;
  }

  function liveHtml(){
    if(runtime){
      const current=runtime.exercises[runtime.index]||null;
      const next=nextPosition(runtime);
      const nextExercise=next?runtime.exercises[next.index]:null;
      const phase=runtime.phase;
      let title=current?.name_snapshot||runtime.run.name_snapshot;
      let sub=nextExercise?'Danach: '+nextExercise.name_snapshot:'';
      let label='BEREIT';
      let remaining=0;
      if(phase==='countdown'){label='START IN';remaining=Math.max(0,Math.ceil(3-runtimeElapsed()));}
      if(phase==='work'){label='JETZT';remaining=Math.max(0,Math.ceil(runtime.run.work_seconds-runtimeElapsed()));}
      if(phase==='rest'){
        label='PAUSE';title=nextExercise?nextExercise.name_snapshot:'Nächste Übung';sub=nextExercise?'Als Nächstes':'';
        remaining=Math.max(0,Math.ceil(runtime.run.rest_seconds-runtimeElapsed()));
      }
      if(phase==='round_rest'){
        label='RUNDENPAUSE';title='Runde '+runtime.round+' geschafft';sub=nextExercise?'Danach: Runde '+next.round+' · '+nextExercise.name_snapshot:'Nächste Runde';
        remaining=Math.max(0,Math.ceil(runtime.run.round_break_seconds-runtimeElapsed()));
      }
      if(phase==='done'){label='GESCHAFFT';remaining=0;sub='Zirkel vollständig abgeschlossen';}
      if(phase==='aborted'){label='ABGEBROCHEN';remaining=Math.max(0,Math.round(runtime.partialAtAbort||0));sub='Bis hierhin wird dokumentiert';}
      const shownRound=phase==='rest'&&next?next.round:runtime.round;
      const shownIndex=phase==='rest'&&next?next.index:runtime.index;
      return '<section id="'+CARD_LIVE+'" data-plan-id="'+esc(runtime.run.plan_id||'')+'" class="'+(phase==='done'?'sc-done-v669':'')+'">'+
        '<div class="sc-live-top-v669"><span class="sc-phase-v669" data-circuit-live-phase>'+esc(label)+'</span><span class="sc-round-v669" data-circuit-live-round>Runde '+shownRound+' / '+runtime.run.planned_rounds+' · Übung '+(shownIndex+1)+' / '+runtime.exercises.length+'</span></div>'+
        '<div class="sc-exercise-v669" data-circuit-live-exercise>'+esc(title)+'</div><div class="sc-next-v669" data-circuit-live-next>'+esc(sub)+'</div>'+
        '<div class="sc-clock-v669" data-circuit-live-clock>'+remaining+'</div><div class="sc-clock-unit-v669">Sekunden</div>'+
        '<div class="sc-progress-v669"><i data-circuit-live-progress></i></div>'+
        '<div class="sc-live-meta-v669"><span>'+runtime.run.work_seconds+' s Arbeit · '+runtime.run.rest_seconds+' s Stationspause · '+runtime.run.round_break_seconds+' s Rundenpause</span><span data-circuit-live-sync>'+(runtime.syncError?'Sync-Fehler':'LIVE')+'</span></div>'+
        '<div class="sc-live-actions-v669">'+(['countdown','work','rest','round_rest'].includes(phase)?'<button class="danger" type="button" data-circuit-abort>Zirkel abbrechen</button>':'')+'</div>'+
      '</section>';
    }

    const interrupted=runningDbRun();
    if(interrupted){
      const items=state.runExercises.filter(item=>String(item.run_id)===String(interrupted.id)).sort((a,b)=>Number(a.sort_order)-Number(b.sort_order));
      const item=items[Math.max(0,Number(interrupted.current_exercise_index||1)-1)];
      return '<section id="'+CARD_LIVE+'" data-plan-id="'+esc(interrupted.plan_id||'')+'" class="sc-interrupted-v669">'+
        '<div class="sc-live-top-v669"><span class="sc-phase-v669">UNTERBROCHENER ZIRKEL</span><span class="sc-round-v669">Runde '+interrupted.current_round+' / '+interrupted.planned_rounds+'</span></div>'+
        '<div class="sc-exercise-v669">'+esc(item?.name_snapshot||interrupted.name_snapshot)+'</div>'+
        '<div class="sc-next-v669">Die App wurde während des Zirkels verlassen. Den angefangenen Zirkel kannst du sauber als abgebrochen dokumentieren.</div>'+
        '<div class="sc-live-actions-v669"><button class="danger" type="button" data-circuit-finalize-interrupted="'+esc(interrupted.id)+'">Zirkel als abgebrochen dokumentieren</button></div>'+
      '</section>';
    }

    const active=activeDaySession();
    if(!active)return '';
    const link=linkForSession(active.id);
    const plan=link?state.plans.find(item=>String(item.id)===String(link.plan_id))||null:null;
    if(!plan)return '';
    const already=state.runs.find(run=>String(run.session_id)===String(active.id)&&run.status!=='cancelled');
    if(already)return '';
    const selected=selectedPlanRows(plan);
    return '<section id="'+CARD_LIVE+'" data-plan-id="'+esc(plan.id)+'" class="sc-ready-v676">'+
      '<div class="sc-kicker-v669">ZIRKELTRAINING · BEREIT</div>'+
      '<div class="sc-head-v669"><div><h3>'+esc(plan.name)+'</h3><p>'+esc(plan.rounds)+' Runden · '+selected.length+' Stationen · '+esc(plan.work_seconds)+' s Arbeit</p></div><span class="sc-round-v669">'+selected.length+' Stationen</span></div>'+
      '<div class="sc-actions-v669"><button class="primary" type="button" data-circuit-start '+(!selected.length?'disabled':'')+'>▶ Zirkel starten</button></div>'+
    '</section>';
  }

  function mount(){
    injectStyle();
    const root=document.getElementById(ROOT_ID);
    if(!root)return false;

    const planning=root.querySelector('[data-sport-panel-v568="planning"] .sport-content-v510');
    if(planning){
      const dateKey=currentPlanDate();
      const existing=document.getElementById(CARD_PLAN);
      if(existing&&String(existing.dataset.planDate||'')!==String(dateKey))existing.remove();
      const html=planningHtml();
      if(html&&!document.getElementById(CARD_PLAN)){
        const day=planning.querySelector('[data-sport-plan-day]');
        if(day)day.insertAdjacentHTML('afterend',html);
        else planning.insertAdjacentHTML('beforeend',html);
      }
    }

    const overview=root.querySelector('[data-sport-panel-v568="overview"] .sport-content-v510')||(root.dataset.sportTabV568==='overview'?root.querySelector('.sport-panel-v510 .sport-content-v510'):null);
    if(overview){
      const html=liveHtml();
      const empty=overview.querySelector('[data-sport-active-empty]');
      const slogan=root.querySelector('[data-sport-active-slogan]');
      if(empty)empty.hidden=Boolean(html);
      if(slogan)slogan.textContent=html?'Jetzt nicht nachdenken. Machen reicht völlig.':'Hier läuft gerade nichts. Nicht mal du.';
      if(html&&!document.getElementById(CARD_LIVE)){
        const finish=overview.querySelector('.sport-active-actions-v627');
        if(finish)finish.insertAdjacentHTML('beforebegin',html);
        else overview.insertAdjacentHTML('afterbegin',html);
      }
    }

    bindRoot(root);
    updateLiveDom();
    return true;
  }

  function scheduleMount(){
    if(mountTimer)return;
    mountTimer=setTimeout(()=>{
      mountTimer=null;
      mount();
    },20);
  }

  function bindRoot(root){
    if(root.dataset.sportCircuitV669Bound==='1')return;
    root.dataset.sportCircuitV669Bound='1';

    root.addEventListener('click',event=>{
      const link=event.target.closest('[data-circuit-link-plan]');
      if(link){linkPlanToDay(link.dataset.circuitLinkPlan,link);return;}
      const unlink=event.target.closest('[data-circuit-unlink-plan]');
      if(unlink){unlinkPlanFromDay(unlink.dataset.circuitUnlinkPlan,unlink);return;}
      const create=event.target.closest('[data-circuit-create-variant]');
      if(create){beginVariantDraft();return;}
      const saveNew=event.target.closest('[data-circuit-save-new-variant]');
      if(saveNew){saveVariantDraft(saveNew);return;}
      const cancelNew=event.target.closest('[data-circuit-cancel-new-variant]');
      if(cancelNew){variantDraft=null;document.getElementById(CARD_PLAN)?.remove();scheduleMount();return;}
      const deleteVariantButton=event.target.closest('[data-circuit-delete-variant]');
      if(deleteVariantButton){deleteVariant(deleteVariantButton.dataset.circuitDeleteVariant,deleteVariantButton);return;}
      const save=event.target.closest('[data-circuit-save]');
      if(save){savePlanFromDom(save);return;}
      const start=event.target.closest('[data-circuit-start]');
      if(start){startCircuit(start);return;}
      const add=event.target.closest('[data-circuit-add]');
      if(add){addExercise(add.dataset.circuitAdd,add);return;}
      const remove=event.target.closest('[data-circuit-remove]');
      if(remove){removeExercise(remove.dataset.circuitRemove,remove);return;}
      const move=event.target.closest('[data-circuit-move]');
      if(move){moveExercise(move.dataset.id,move.dataset.circuitMove,move);return;}
      const abort=event.target.closest('[data-circuit-abort]');
      if(abort){abortCircuit();return;}
      const interrupted=event.target.closest('[data-circuit-finalize-interrupted]');
      if(interrupted){finalizeInterrupted(interrupted.dataset.circuitFinalizeInterrupted,interrupted);return;}
    });
  }


  async function linkPlanToDay(planId,button){
    const session=plannedDaySession();
    if(!session)throw new Error('Für diesen Tag gibt es noch keinen geplanten Trainingstag.');
    button.disabled=true;
    try{
      const {supabase,user}=await sportUser();
      let result=await supabase.from('sport_session_circuit_plans').delete().eq('session_id',session.id);
      if(result.error)throw result.error;
      result=await supabase.from('sport_session_circuit_plans').insert({user_id:user.id,session_id:session.id,plan_id:planId,sort_order:1});
      if(result.error)throw result.error;
      editingPlanId=planId;
      await loadData({seed:false});
    }catch(error){
      alert(error?.message||'Zirkelvariante konnte nicht eingeplant werden.');
      button.disabled=false;
    }
  }

  async function unlinkPlanFromDay(linkId,button){
    button.disabled=true;
    try{
      const {supabase}=await sportUser();
      const result=await supabase.from('sport_session_circuit_plans').delete().eq('id',linkId);
      if(result.error)throw result.error;
      editingPlanId=null;
      await loadData({seed:false});
    }catch(error){
      alert(error?.message||'Zirkel konnte nicht aus dem Tagesplan entfernt werden.');
      button.disabled=false;
    }
  }

  async function createVariant(button){
    button.disabled=true;
    try{
      const {supabase,user}=await sportUser();
      const source=state.plans[0]||{rounds:3,work_seconds:40,rest_seconds:20,round_break_seconds:90};
      const planId=uid();
      const now=new Date().toISOString();
      const name='Variante '+(state.plans.length+1);
      let result=await supabase.from('sport_circuit_plans').insert({
        id:planId,user_id:user.id,name,rounds:source.rounds||3,work_seconds:source.work_seconds||40,
        rest_seconds:source.rest_seconds??20,round_break_seconds:source.round_break_seconds??90,
        active:true,created_at:now,updated_at:now
      });
      if(result.error)throw result.error;
      const sourceRows=source.id?selectedPlanRows(source):[];
      if(sourceRows.length){
        result=await supabase.from('sport_circuit_plan_exercises').insert(sourceRows.map((entry,index)=>({
          id:uid(),user_id:user.id,plan_id:planId,exercise_id:entry.item.id,sort_order:index+1
        })));
        if(result.error)throw result.error;
      }
      await loadData({seed:false});
      const session=plannedDaySession();
      if(session){
        result=await supabase.from('sport_session_circuit_plans').delete().eq('session_id',session.id);
        if(result.error)throw result.error;
        result=await supabase.from('sport_session_circuit_plans').insert({user_id:user.id,session_id:session.id,plan_id:planId,sort_order:1});
        if(result.error)throw result.error;
      }
      editingPlanId=planId;
      await loadData({seed:false});
    }catch(error){
      alert(error?.message||'Neue Zirkelvariante konnte nicht erstellt werden.');
      button.disabled=false;
    }
  }


  async function savePlanFromDom(button){
    const plan=currentPlan();
    const card=document.getElementById(CARD_PLAN);
    if(!plan||!card)return;
    const rounds=clamp(card.querySelector('[data-circuit-field="rounds"]')?.value,1,700);
    const work=clamp(card.querySelector('[data-circuit-field="work_seconds"]')?.value,5,600);
    const rest=clamp(card.querySelector('[data-circuit-field="rest_seconds"]')?.value,0,300);
    const roundBreak=clamp(card.querySelector('[data-circuit-field="round_break_seconds"]')?.value,0,1800);
    button.disabled=true;
    try{
      const {supabase}=await sportUser();
      const result=await supabase.from('sport_circuit_plans').update({
        rounds:Math.round(rounds),work_seconds:Math.round(work),rest_seconds:Math.round(rest),round_break_seconds:Math.round(roundBreak),updated_at:new Date().toISOString()
      }).eq('id',plan.id);
      if(result.error)throw result.error;
      await loadData({seed:false});
    }catch(error){
      alert(error?.message||'Zirkelplan konnte nicht gespeichert werden.');
      button.disabled=false;
    }
  }

  async function addExercise(exerciseId,button){
    const plan=currentPlan();
    if(!plan)return;
    button.disabled=true;
    try{
      const {supabase,user}=await sportUser();
      const rows=selectedPlanRows(plan);
      const result=await supabase.from('sport_circuit_plan_exercises').insert({
        id:uid(),user_id:user.id,plan_id:plan.id,exercise_id:exerciseId,sort_order:rows.length+1
      });
      if(result.error)throw result.error;
      await loadData({seed:false});
    }catch(error){
      alert(error?.message||'Übung konnte nicht hinzugefügt werden.');
      button.disabled=false;
    }
  }

  async function removeExercise(rowId,button){
    button.disabled=true;
    try{
      const {supabase}=await sportUser();
      const plan=currentPlan();
      const selected=selectedPlanRows(plan);
      const target=selected.find(entry=>String(entry.row.id)===String(rowId));
      if(!target)return;
      const result=await supabase.from('sport_circuit_plan_exercises').delete().eq('id',rowId);
      if(result.error)throw result.error;
      const remaining=selected.filter(entry=>String(entry.row.id)!==String(rowId));
      for(let i=0;i<remaining.length;i++){
        if(Number(remaining[i].row.sort_order)!==i+1){
          const u=await supabase.from('sport_circuit_plan_exercises').update({sort_order:i+1}).eq('id',remaining[i].row.id);
          if(u.error)throw u.error;
        }
      }
      await loadData({seed:false});
    }catch(error){
      alert(error?.message||'Übung konnte nicht entfernt werden.');
      button.disabled=false;
    }
  }

  async function moveExercise(rowId,direction,button){
    button.disabled=true;
    try{
      const {supabase}=await sportUser();
      const selected=selectedPlanRows(currentPlan());
      const index=selected.findIndex(entry=>String(entry.row.id)===String(rowId));
      const otherIndex=direction==='up'?index-1:index+1;
      if(index<0||otherIndex<0||otherIndex>=selected.length)return;
      const a=selected[index].row,b=selected[otherIndex].row;
      const temp=32000;
      let result=await supabase.from('sport_circuit_plan_exercises').update({sort_order:temp}).eq('id',a.id);
      if(result.error)throw result.error;
      result=await supabase.from('sport_circuit_plan_exercises').update({sort_order:a.sort_order}).eq('id',b.id);
      if(result.error)throw result.error;
      result=await supabase.from('sport_circuit_plan_exercises').update({sort_order:b.sort_order}).eq('id',a.id);
      if(result.error)throw result.error;
      await loadData({seed:false});
    }catch(error){
      alert(error?.message||'Reihenfolge konnte nicht geändert werden.');
      button.disabled=false;
    }
  }

  async function ensureAudio(){
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)throw new Error('Web Audio wird von diesem Gerät nicht unterstützt.');
    if(!audioContext)audioContext=new AudioCtx();
    if(audioContext.state==='suspended')await audioContext.resume();
    return audioContext;
  }

  function toneSpec(freq,duration=0.12,gain=0.11,type='sine'){
    return {freq,duration,gain,type};
  }

  function scheduleTone(spec,offset=0){
    if(!audioContext)return;
    const osc=audioContext.createOscillator();
    const gain=audioContext.createGain();
    const start=audioContext.currentTime+Math.max(0,offset);
    const end=start+spec.duration;
    osc.type=spec.type||'sine';
    osc.frequency.setValueAtTime(spec.freq,start);
    gain.gain.setValueAtTime(0.0001,start);
    gain.gain.exponentialRampToValueAtTime(spec.gain||0.1,start+0.008);
    gain.gain.setValueAtTime(spec.gain||0.1,Math.max(start+0.01,end-0.025));
    gain.gain.exponentialRampToValueAtTime(0.0001,end);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(start);
    osc.stop(end+0.03);
    audioNodes.push(osc);
  }

  function scheduleSequence(sequence,offset=0){
    let cursor=offset;
    sequence.forEach(step=>{
      scheduleTone(toneSpec(step[0],step[1],step[2]||0.11,step[3]||'sine'),cursor);
      cursor+=step[1]+(step[4]||0.05);
    });
  }

  function cancelAudio(){
    audioNodes.forEach(node=>{try{node.stop();}catch(_){}});
    audioNodes=[];
  }

  const low=()=>toneSpec(520,.14,.12);
  const go=()=>toneSpec(940,.26,.14);
  const half=()=>toneSpec(720,.09,.11);
  const endTone=()=>toneSpec(390,2.00,.10);

  function roundSequence(offset=0){
    scheduleSequence([[440,.08,.11,'sine',.04],[554,.08,.11,'sine',.04],[659,.08,.11,'sine',.04],[880,.16,.12,'sine',0]],offset);
  }
  function finishSequence(offset=0){
    scheduleSequence([[494,.08,.11,'sine',.03],[622,.08,.11,'sine',.03],[740,.08,.11,'sine',.03],[988,.10,.12,'sine',.04],[1175,.32,.13,'sine',0]],offset);
  }

  function runtimeElapsed(){
    if(!runtime)return 0;
    return Math.max(0,(performance.now()-runtime.phaseStartedAt)/1000);
  }

  function nextPosition(rt){
    if(!rt||!rt.exercises.length)return null;
    if(rt.index+1<rt.exercises.length)return {round:rt.round,index:rt.index+1};
    if(rt.round<rt.run.planned_rounds)return {round:rt.round+1,index:0};
    return null;
  }

  function saveLocalRuntime(){
    if(!runtime||runtime.testMode)return;
    try{
      localStorage.setItem(LOCAL_RUN_KEY,JSON.stringify({
        runId:runtime.run.id,phase:runtime.phase,round:runtime.round,index:runtime.index,
        elapsed:runtimeElapsed(),savedAt:Date.now()
      }));
    }catch(_){}
  }

  function clearLocalRuntime(){
    try{localStorage.removeItem(LOCAL_RUN_KEY);}catch(_){}
  }

  async function acquireWakeLock(){
    try{
      if('wakeLock' in navigator&&document.visibilityState==='visible')wakeLock=await navigator.wakeLock.request('screen');
    }catch(error){console.warn('[V669 circuit] wake lock unavailable',error);}
  }

  async function releaseWakeLock(){
    try{await wakeLock?.release?.();}catch(_){}
    wakeLock=null;
  }

  function queueDb(task){
    if(!runtime||runtime.testMode)return Promise.resolve();
    runtime.dbChain=runtime.dbChain.then(task).catch(error=>{
      runtime.syncError=error?.message||String(error);
      console.error('[V669 circuit] sync queue',error);
      updateLiveDom();
      return null;
    });
    return runtime.dbChain;
  }

  async function startCircuit(button){
    if(runtime||runningDbRun())return;
    const active=activeDaySession();
    if(!active){alert('Starte zuerst den Trainingstag im Bereich Planen.');return;}
    const link=linkForSession(active.id);
    const plan=link?state.plans.find(item=>String(item.id)===String(link.plan_id))||null:currentPlan();
    if(!plan)return;

    button.disabled=true;
    try{
      await ensureAudio();
      const {supabase,user}=await sportUser();
      const selected=selectedPlanRows(plan);
      if(!selected.length)throw new Error('Der Zirkel braucht mindestens eine Übung.');

      const existing=state.runs.find(run=>String(run.session_id)===String(active.id)&&run.status!=='cancelled');
      if(existing)throw new Error('Für diesen Trainingstag ist der Zirkel bereits dokumentiert.');

      const now=new Date().toISOString();
      const runId=uid();
      const run={
        id:runId,user_id:user.id,plan_id:plan.id,session_id:active.id,name_snapshot:plan.name,
        planned_rounds:Math.round(Number(plan.rounds)||1),work_seconds:Math.round(Number(plan.work_seconds)||40),
        rest_seconds:Math.round(Number(plan.rest_seconds)||0),round_break_seconds:Math.round(Number(plan.round_break_seconds)||0),
        status:'running',completed_rounds:0,current_round:1,current_exercise_index:1,current_elapsed_seconds:0,total_active_seconds:0,
        started_at:now,created_at:now,updated_at:now
      };
      let result=await supabase.from('sport_circuit_runs').insert(run);
      if(result.error)throw result.error;

      const snapshots=selected.map((entry,index)=>({
        id:uid(),user_id:user.id,run_id:runId,exercise_id:entry.item.id,
        name_snapshot:entry.item.name,settings_snapshot:entry.item.settings_text||null,
        execution_snapshot:entry.item.metric_config?.execution||{},sort_order:index+1
      }));
      result=await supabase.from('sport_circuit_run_exercises').insert(snapshots);
      if(result.error){
        await supabase.from('sport_circuit_runs').delete().eq('id',runId);
        throw result.error;
      }

      runtime={
        run:{...run},
        sessionId:active.id,
        exercises:snapshots,
        round:1,index:0,phase:'countdown',phaseStartedAt:performance.now(),
        currentIntervalId:null,completedIntervals:0,completedWorkSeconds:0,
        lastProgressBucket:-1,syncError:null,dbChain:Promise.resolve(),raf:0,transitioning:false
      };

      await acquireWakeLock();
      try{await window.__modSportV568?.refresh?.();}catch(_){}
      try{window.__modSportTabsV512?.setTab?.('overview',{animate:true,persist:true});}catch(_){}
      scheduleMount();
      enterCountdown();
    }catch(error){
      console.error('[V676 circuit] start failed',error);
      alert(error?.message||'Zirkel konnte nicht gestartet werden.');
      button.disabled=false;
    }
  }

  function enterCountdown(){
    if(!runtime)return;
    runtime.phase='countdown';
    runtime.phaseStartedAt=performance.now();
    runtime.transitioning=false;
    runtime.lastProgressBucket=-1;
    scheduleTone(low(),0);
    scheduleTone(low(),1);
    scheduleTone(low(),2);
    scheduleTone(go(),3);
    saveLocalRuntime();
    updateLiveDom();
    startTicker();
  }

  function startWorkInterval(){
    if(!runtime)return;
    const intervalId=uid();
    runtime.currentIntervalId=intervalId;
    const startedAt=new Date().toISOString();
    const row={
      id:intervalId,user_id:state.user.id,run_id:runtime.run.id,
      run_exercise_id:runtime.exercises[runtime.index].id,round_number:runtime.round,
      started_at:startedAt,elapsed_seconds:0,status:'running'
    };
    queueDb(async()=>{
      const {supabase}=await sportUser();
      const result=await supabase.from('sport_circuit_intervals').insert(row);
      if(result.error)throw result.error;
    });
  }

  function enterWork(){
    if(!runtime)return;
    runtime.phase='work';
    runtime.phaseStartedAt=performance.now();
    runtime.transitioning=false;
    runtime.lastProgressBucket=-1;
    startWorkInterval();

    const duration=Number(runtime.run.work_seconds);
    const halfway=duration/2;
    scheduleTone(half(),halfway);
    scheduleTone(half(),halfway+.18);
    scheduleTone(low(),Math.max(0,duration-3));
    scheduleTone(low(),Math.max(0,duration-2));
    scheduleTone(low(),Math.max(0,duration-1));
    scheduleTone(endTone(),duration);

    const isLastExercise=runtime.index===runtime.exercises.length-1;
    const isFinal=isLastExercise&&runtime.round===runtime.run.planned_rounds;
    if(isFinal)finishSequence(duration+2.10);
    else if(isLastExercise)roundSequence(duration+2.10);

    saveLocalRuntime();
    updateLiveDom();
  }

  function enterRoundRest(){
    if(!runtime)return;
    if(Number(runtime.run.round_break_seconds)<=0){
      advancePosition();
      enterWork();
      return;
    }
    runtime.phase='round_rest';
    runtime.phaseStartedAt=performance.now();
    runtime.transitioning=false;
    runtime.lastProgressBucket=-1;
    const duration=Number(runtime.run.round_break_seconds);
    const warningAt=duration>=10?duration-10:Math.max(0,duration/2);
    scheduleTone(toneSpec(620,.07,.10),warningAt);
    scheduleTone(toneSpec(620,.07,.10),warningAt+.13);
    scheduleTone(toneSpec(620,.07,.10),warningAt+.26);
    if(duration>=3){
      scheduleTone(low(),duration-3);
      scheduleTone(low(),duration-2);
      scheduleTone(low(),duration-1);
    }
    scheduleTone(go(),duration);
    saveLocalRuntime();
    updateLiveDom();
  }

  function enterRest(){
    if(!runtime)return;
    if(Number(runtime.run.rest_seconds)<=0){
      advancePosition();
      enterWork();
      return;
    }
    runtime.phase='rest';
    runtime.phaseStartedAt=performance.now();
    runtime.transitioning=false;
    runtime.lastProgressBucket=-1;
    const duration=Number(runtime.run.rest_seconds);
    const warningAt=duration>=10?duration-10:Math.max(0,duration/2);
    scheduleTone(toneSpec(620,.07,.10),warningAt);
    scheduleTone(toneSpec(620,.07,.10),warningAt+.13);
    scheduleTone(toneSpec(620,.07,.10),warningAt+.26);
    if(duration>=3){
      scheduleTone(low(),duration-3);
      scheduleTone(low(),duration-2);
      scheduleTone(low(),duration-1);
    }
    scheduleTone(go(),duration);
    saveLocalRuntime();
    updateLiveDom();
  }

  function advancePosition(){
    if(!runtime)return false;
    if(runtime.index+1<runtime.exercises.length){
      runtime.index++;
      return true;
    }
    if(runtime.round<runtime.run.planned_rounds){
      runtime.round++;
      runtime.index=0;
      return true;
    }
    return false;
  }

  function completeWork(){
    if(!runtime||runtime.transitioning)return;
    runtime.transitioning=true;
    const intervalId=runtime.currentIntervalId;
    const duration=Number(runtime.run.work_seconds);
    const endedAt=new Date().toISOString();
    runtime.completedIntervals++;
    runtime.completedWorkSeconds+=duration;
    const completedRound=runtime.index===runtime.exercises.length-1?runtime.round:runtime.round-1;

    const currentRound=runtime.round;
    const currentIndex=runtime.index;
    const next=nextPosition(runtime);
    const activeSeconds=runtime.completedWorkSeconds;
    const runId=runtime.run.id;
    queueDb(async()=>{
      const {supabase}=await sportUser();
      if(intervalId){
        const interval=await supabase.from('sport_circuit_intervals').update({
          ended_at:endedAt,elapsed_seconds:duration,status:'completed'
        }).eq('id',intervalId);
        if(interval.error)throw interval.error;
      }
      const patch={
        completed_rounds:Math.max(0,completedRound),
        current_round:next?.round||currentRound,
        current_exercise_index:(next?.index??currentIndex)+1,
        current_elapsed_seconds:next?0:duration,
        total_active_seconds:activeSeconds,
        updated_at:endedAt
      };
      const result=await supabase.from('sport_circuit_runs').update(patch).eq('id',runId);
      if(result.error)throw result.error;
    });

    runtime.currentIntervalId=null;
    const final=runtime.round===runtime.run.planned_rounds&&runtime.index===runtime.exercises.length-1;
    if(final){
      finishCircuit();
      return;
    }
    if(runtime.index===runtime.exercises.length-1)enterRoundRest();
    else enterRest();
  }

  function completeRest(){
    if(!runtime||runtime.transitioning)return;
    runtime.transitioning=true;
    advancePosition();
    enterWork();
  }

  function completeRoundRest(){
    if(!runtime||runtime.transitioning)return;
    runtime.transitioning=true;
    advancePosition();
    enterWork();
  }

  function persistProgress(){
    if(!runtime||runtime.phase!=='work')return;
    const elapsed=Math.min(Number(runtime.run.work_seconds),runtimeElapsed());
    const bucket=Math.floor(elapsed/5);
    if(bucket<=runtime.lastProgressBucket)return;
    runtime.lastProgressBucket=bucket;
    saveLocalRuntime();
    const round=runtime.round;
    const exerciseIndex=runtime.index+1;
    const totalActive=Math.round((runtime.completedWorkSeconds+elapsed)*1000)/1000;
    const runId=runtime.run.id;
    const updatedAt=new Date().toISOString();
    queueDb(async()=>{
      const {supabase}=await sportUser();
      const result=await supabase.from('sport_circuit_runs').update({
        current_round:round,current_exercise_index:exerciseIndex,
        current_elapsed_seconds:Math.round(elapsed*1000)/1000,
        total_active_seconds:totalActive,
        updated_at:updatedAt
      }).eq('id',runId);
      if(result.error)throw result.error;
    });
  }

  function startTicker(){
    if(!runtime)return;
    cancelAnimationFrame(runtime.raf||0);
    const loop=()=>{
      if(!runtime)return;
      updateLiveDom();
      persistProgress();
      const elapsed=runtimeElapsed();
      if(runtime.phase==='countdown'&&elapsed>=3&&!runtime.transitioning){
        runtime.transitioning=true;
        enterWork();
      }else if(runtime.phase==='work'&&elapsed>=Number(runtime.run.work_seconds)){
        completeWork();
      }else if(runtime.phase==='rest'&&elapsed>=Number(runtime.run.rest_seconds)){
        completeRest();
      }else if(runtime.phase==='round_rest'&&elapsed>=Number(runtime.run.round_break_seconds)){
        completeRoundRest();
      }
      if(runtime&&['countdown','work','rest','round_rest'].includes(runtime.phase))runtime.raf=requestAnimationFrame(loop);
    };
    runtime.raf=requestAnimationFrame(loop);
  }

  function updateLiveDom(){
    if(!runtime)return;
    const card=document.getElementById(CARD_LIVE);
    if(!card){scheduleMount();return;}
    const phase=runtime.phase;
    const current=runtime.exercises[runtime.index]||null;
    const next=nextPosition(runtime);
    const nextExercise=next?runtime.exercises[next.index]:null;
    let label='BEREIT',title=current?.name_snapshot||runtime.run.name_snapshot,sub='',remaining=0,duration=1;
    if(phase==='countdown'){
      label='START IN';remaining=Math.max(0,Math.ceil(3-runtimeElapsed()));duration=3;
      sub='Runde '+runtime.round+' startet gleich';
    }else if(phase==='work'){
      label='JETZT';remaining=Math.max(0,Math.ceil(runtime.run.work_seconds-runtimeElapsed()));duration=runtime.run.work_seconds;
      sub=nextExercise?'Danach: '+nextExercise.name_snapshot:'Letzte Station';
    }else if(phase==='rest'){
      label='PAUSE';remaining=Math.max(0,Math.ceil(runtime.run.rest_seconds-runtimeElapsed()));duration=Math.max(1,runtime.run.rest_seconds);
      title=nextExercise?.name_snapshot||'Nächste Übung';sub=nextExercise?'Als Nächstes':'';
    }else if(phase==='round_rest'){
      label='RUNDENPAUSE';remaining=Math.max(0,Math.ceil(runtime.run.round_break_seconds-runtimeElapsed()));duration=Math.max(1,runtime.run.round_break_seconds);
      title='Runde '+runtime.round+' geschafft';sub=nextExercise?'Danach: Runde '+next.round+' · '+nextExercise.name_snapshot:'Nächste Runde';
    }else if(phase==='done'){
      label='GESCHAFFT';remaining=0;sub=runtime.testMode?'Testrunde beendet · nichts gespeichert':'Alle '+runtime.run.planned_rounds+' Runden erledigt';
    }else if(phase==='aborted'){
      label='ABGEBROCHEN';remaining=Math.max(0,Math.round(runtime.partialAtAbort||0));sub=runtime.testMode?'Testrunde beendet · nichts gespeichert':'Bis hierhin dokumentiert';
    }
    const phaseEl=card.querySelector('[data-circuit-live-phase]');
    const roundEl=card.querySelector('[data-circuit-live-round]');
    const exEl=card.querySelector('[data-circuit-live-exercise]');
    const nextEl=card.querySelector('[data-circuit-live-next]');
    const clockEl=card.querySelector('[data-circuit-live-clock]');
    const progress=card.querySelector('[data-circuit-live-progress]');
    const sync=card.querySelector('[data-circuit-live-sync]');
    if(phaseEl)phaseEl.textContent=label;
    const shownRound=phase==='rest'&&next?next.round:runtime.round;
    const shownIndex=phase==='rest'&&next?next.index:runtime.index;
    if(roundEl)roundEl.textContent=(runtime.testMode?'TESTRUNDE · ':'')+'Runde '+shownRound+' / '+runtime.run.planned_rounds+' · Übung '+(shownIndex+1)+' / '+runtime.exercises.length;
    if(exEl)exEl.textContent=title;
    if(nextEl)nextEl.textContent=sub;
    if(clockEl)clockEl.textContent=remaining;
    if(progress){
      let p=0;
      if(phase==='countdown'||phase==='work'||phase==='rest'||phase==='round_rest')p=Math.min(100,Math.max(0,runtimeElapsed()/duration*100));
      if(phase==='done')p=100;
      progress.style.width=p+'%';
    }
    if(sync)sync.textContent=runtime.testMode?'NICHT GESPEICHERT':(runtime.syncError?'SYNC-FEHLER':'LIVE');
  }

  async function finishCircuit(){
    if(!runtime)return;
    cancelAnimationFrame(runtime.raf||0);
    runtime.phase='done';
    runtime.partialAtAbort=0;
    clearLocalRuntime();
    updateLiveDom();

    const rt=runtime;
    const endedAt=new Date().toISOString();
    if(rt.testMode){
      await releaseWakeLock();
      setTimeout(()=>{
        if(runtime===rt)runtime=null;
        document.getElementById(CARD_LIVE)?.remove();
        scheduleMount();
      },2200);
      return;
    }
    await rt.dbChain;
    try{
      const {supabase}=await sportUser();
      let result=await supabase.from('sport_circuit_runs').update({
        status:'completed',completed_rounds:rt.run.planned_rounds,current_round:rt.run.planned_rounds,
        current_exercise_index:rt.exercises.length,current_elapsed_seconds:rt.run.work_seconds,
        total_active_seconds:rt.run.planned_rounds*rt.exercises.length*rt.run.work_seconds,
        ended_at:endedAt,updated_at:endedAt
      }).eq('id',rt.run.id);
      if(result.error)throw result.error;

      // V676: Der Zirkel ist nur ein Bestandteil des laufenden Trainingstags. Die Eltern-Session bleibt aktiv.
    }catch(error){
      rt.syncError=error?.message||String(error);
      console.error('[V669 circuit] finish sync failed',error);
    }
    await releaseWakeLock();
    setTimeout(async()=>{
      if(runtime===rt)runtime=null;
      await loadData({seed:false});
      try{await window.__modSportV568?.refresh?.();}catch(_){}
      scheduleMount();
    },2200);
  }

  async function abortCircuit(){
    if(!runtime)return;
    const confirmText=runtime.testMode?'Testrunde wirklich abbrechen? Es wird nichts gespeichert.':'Training wirklich abbrechen? Alles bis hierhin wird dokumentiert.';
    if(!window.confirm(confirmText))return;
    cancelAnimationFrame(runtime.raf||0);
    cancelAudio();

    const rt=runtime;
    const elapsed=rt.phase==='work'?Math.min(Number(rt.run.work_seconds),runtimeElapsed()):0;
    rt.partialAtAbort=elapsed;
    rt.phase='aborted';
    updateLiveDom();
    clearLocalRuntime();

    const endedAt=new Date().toISOString();
    if(rt.testMode){
      await releaseWakeLock();
      setTimeout(()=>{
        if(runtime===rt)runtime=null;
        document.getElementById(CARD_LIVE)?.remove();
        scheduleMount();
      },900);
      return;
    }
    if(rt.currentIntervalId){
      const intervalId=rt.currentIntervalId;
      queueDb(async()=>{
        const {supabase}=await sportUser();
        const result=await supabase.from('sport_circuit_intervals').update({
          ended_at:endedAt,elapsed_seconds:Math.round(elapsed*1000)/1000,status:'cancelled'
        }).eq('id',intervalId);
        if(result.error)throw result.error;
      });
    }

    await rt.dbChain;
    try{
      const {supabase}=await sportUser();
      const completedRounds=Math.floor(rt.completedIntervals/rt.exercises.length);
      let result=await supabase.from('sport_circuit_runs').update({
        status:'cancelled',completed_rounds:completedRounds,current_round:rt.round,
        current_exercise_index:rt.index+1,current_elapsed_seconds:Math.round(elapsed*1000)/1000,
        total_active_seconds:Math.round((rt.completedWorkSeconds+elapsed)*1000)/1000,
        ended_at:endedAt,updated_at:endedAt
      }).eq('id',rt.run.id);
      if(result.error)throw result.error;

      // V676: Ein abgebrochener Zirkel beendet nicht den gesamten Trainingstag.
    }catch(error){
      rt.syncError=error?.message||String(error);
      console.error('[V669 circuit] abort sync failed',error);
    }
    await releaseWakeLock();
    setTimeout(async()=>{
      if(runtime===rt)runtime=null;
      await loadData({seed:false});
      try{await window.__modSportV568?.refresh?.();}catch(_){}
      scheduleMount();
    },1400);
  }

  async function finalizeInterrupted(runId,button){
    const run=state.runs.find(item=>String(item.id)===String(runId));
    if(!run)return;
    button.disabled=true;
    try{
      const {supabase}=await sportUser();
      const endedAt=new Date().toISOString();
      const running=state.runningIntervals.filter(item=>String(item.run_id)===String(runId));
      for(const interval of running){
        const result=await supabase.from('sport_circuit_intervals').update({
          ended_at:endedAt,elapsed_seconds:Number(run.current_elapsed_seconds)||Number(interval.elapsed_seconds)||0,status:'cancelled'
        }).eq('id',interval.id);
        if(result.error)throw result.error;
      }
      let result=await supabase.from('sport_circuit_runs').update({status:'cancelled',ended_at:endedAt,updated_at:endedAt}).eq('id',runId);
      if(result.error)throw result.error;
      if(run.session_id){
        const parent=sportSessions().find(session=>String(session.id)===String(run.session_id));
        if(!parent||parent.kind!=='xtraining'){
          const wallMinutes=Math.max(0,(new Date(endedAt)-new Date(run.started_at))/60000);
          result=await supabase.from('sport_sessions').update({
            session_status:'cancelled',ended_at:endedAt,training_ended_at:endedAt,duration_minutes:Math.round(wallMinutes*100)/100
          }).eq('id',run.session_id);
          if(result.error)throw result.error;
        }
      }
      clearLocalRuntime();
      await loadData({seed:false});
      try{await window.__modSportV568?.refresh?.();}catch(_){}
    }catch(error){
      alert(error?.message||'Unterbrochene Einheit konnte nicht abgeschlossen werden.');
      button.disabled=false;
    }
  }

  function initObserver(){
    if(observer)return;
    const bindRootObserver=()=>{
      const root=document.getElementById(ROOT_ID);
      if(!root)return false;
      observer?.disconnect();
      observer=new MutationObserver(scheduleMount);
      observer.observe(root,{childList:true,subtree:true});
      return true;
    };
    if(bindRootObserver())return;
    observer=new MutationObserver(()=>{
      if(bindRootObserver())scheduleMount();
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  function init(){
    injectStyle();
    initObserver();
    loadData().catch(()=>{});
    scheduleMount();
  }

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&runtime)acquireWakeLock();
  });
  window.addEventListener('focus',()=>{if(!runtime)loadData({seed:false}).catch(()=>{});});

  const api={
    version:VERSION,
    refresh:()=>loadData({seed:false}),
    start:()=>document.querySelector('[data-circuit-start]')?.click(),
    abort:abortCircuit,
    getState:()=>({
      loaded:state.loaded,error:state.error,plan:currentPlan(),
      running:runtime?{runId:runtime.run.id,phase:runtime.phase,round:runtime.round,exercise:runtime.index+1,testMode:Boolean(runtime.testMode)}:runningDbRun()
    })
  };
  window.__modSportCircuitV675=api;
  window.__modSportCircuitV671=api;
  window.__modSportCircuitV670=api;
  window.__modSportCircuitV669=api;

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
