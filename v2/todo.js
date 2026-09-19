(() => {
 'use strict';

 const SUPABASE_URL='https://oktpzwhhndsbikkeelot.supabase.co';
 const SUPABASE_KEY='sb_publishable_EaxtFXKAGOLyI6HRWPU6DQ_f04wfWru';
 let client=null;
 let session=null;
 let tasks=[];
 let archives=[];
 let filter='all';
 let composerState={type:'work',priority:'normal',optional:false,dueMode:'none',category:''};
 let editingId=null;

 const $=s=>document.querySelector(s);
 const list=$('#taskList');
 const count=$('#taskCount');
 const toast=$('#todoToast');
 const composer=$('#composer');

 function showToast(msg){
   if(!toast)return;
   toast.textContent=msg;
   toast.classList.add('show');
   clearTimeout(window.__todoToast);
   window.__todoToast=setTimeout(()=>toast.classList.remove('show'),1900);
 }

 function esc(v){
   return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 }

 function berlinDateKey(date=new Date()){
   const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
   const bag={}; parts.forEach(p=>bag[p.type]=p.value);
   return bag.year+'-'+bag.month+'-'+bag.day;
 }

 function addCalendarDays(dateKey,days){
   const [y,m,d]=String(dateKey).split('-').map(Number);
   const dt=new Date(Date.UTC(y,m-1,d+days,12,0,0));
   return dt.getUTCFullYear()+'-'+String(dt.getUTCMonth()+1).padStart(2,'0')+'-'+String(dt.getUTCDate()).padStart(2,'0');
 }

 function formatDate(value){
   if(!value)return '';
   const d=new Date(String(value).slice(0,10)+'T12:00:00');
   return d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit'});
 }

 function typeLabel(type){
   if(type==='leisure')return 'FREIZEIT';
   if(type==='selfrunner')return 'SELBSTLÄUFER';
   if(type==='cooking')return 'KOCHEN';
   return 'ARBEIT';
 }

 function priorityLabel(priority){
   if(priority==='high')return 'HOCH';
   if(priority==='medium')return 'MITTEL';
   return 'NORMAL';
 }

 function updateComposerUI(){
   document.querySelectorAll('[data-type]').forEach(b=>b.classList.toggle('selected',b.dataset.type===composerState.type));
   document.querySelectorAll('[data-priority]').forEach(b=>b.classList.toggle('selected',b.dataset.priority===composerState.priority));
   document.querySelectorAll('[data-due]').forEach(b=>b.classList.toggle('selected',b.dataset.due===composerState.dueMode));
   const categoryInput=$('#newCategoryInput');
   if(categoryInput&&categoryInput.value!==composerState.category)categoryInput.value=composerState.category||'';
   const optional=$('#optionalChoice');
   if(optional){
     optional.classList.toggle('selected',composerState.optional);
     optional.textContent=composerState.optional?'🟣 JA':'🟣 NEIN';
   }
 }

 function updateSummary(){
   const open=tasks.filter(t=>t.status==='open').length;
   const paused=tasks.filter(t=>t.status==='paused').length;
   const priority=tasks.filter(t=>['open','running','paused'].includes(t.status)&&['high','medium'].includes(t.priority)).length;
   const openEl=$('#openSummary'),pausedEl=$('#pausedSummary'),priorityEl=$('#prioritySummary');
   if(openEl)openEl.textContent=String(open);
   if(pausedEl)pausedEl.textContent=String(paused);
   if(priorityEl)priorityEl.textContent=String(priority);
 }

 function taskRows(){
   const today=berlinDateKey();
   let rows=[];
   if(filter==='today'){
     rows=tasks.filter(t=>t.today_date===today&&!['completed','aborted'].includes(t.status));
     return rows.sort((a,b)=>(a.today_order||9999)-(b.today_order||9999));
   }
   if(filter==='priority'){
     rows=tasks.filter(t=>['open','running','paused'].includes(t.status)&&['high','medium'].includes(t.priority));
     return rows.sort((a,b)=>{
       const rank={high:0,medium:1,normal:2};
       return (rank[a.priority]??9)-(rank[b.priority]??9);
     });
   }
   if(filter==='due'){
     rows=tasks.filter(t=>['open','running','paused'].includes(t.status)&&t.due_date);
     return rows.sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date)));
   }
   if(filter==='paused')return tasks.filter(t=>t.status==='paused');
   return tasks.filter(t=>['open','running','paused'].includes(t.status));
 }


 function segmentSumV2(segments,nowIso=new Date().toISOString()){
   return (Array.isArray(segments)?segments:[]).reduce((sum,s)=>{
     if(!s||!s.startedAt)return sum;
     const end=s.endedAt||nowIso;
     const a=new Date(s.startedAt).getTime(),b=new Date(end).getTime();
     return sum+(Number.isFinite(a)&&Number.isFinite(b)?Math.max(0,b-a):0);
   },0);
 }

 function formatDurationV2(ms){
   const total=Math.max(0,Math.floor((Number(ms)||0)/1000));
   const h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;
   return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
 }

 function durationMetaV2(t){
   if(!['running','paused'].includes(t.status))return '';
   if(t.type==='cooking'){
     let active=0,passive=0;
     (Array.isArray(t.cooking_segments)?t.cooking_segments:[]).forEach(seg=>{
       const ms=segmentSumV2([seg]);
       if(seg.mode==='passive')passive+=ms;else active+=ms;
     });
     return '<div class="live-meta">AKTIV <span data-live-cooking-active="'+esc(t.id)+'">'+formatDurationV2(active)+'</span> · WARTEN <span data-live-cooking-passive="'+esc(t.id)+'">'+formatDurationV2(passive)+'</span></div>';
   }
   const total=(Number(t.imported_historical_progress_duration_ms)||0)+segmentSumV2(t.active_segments);
   const label=t.type==='leisure'?'FREIZEIT':'AKTIV';
   return '<div class="live-meta">'+label+' <span data-live-task="'+esc(t.id)+'">'+formatDurationV2(total)+'</span></div>';
 }

 function todayOverviewV2(){
   const day=berlinDateKey();
   const all=tasks.filter(t=>t.today_date===day&&t.status!=='aborted');
   const done=all.filter(t=>t.status==='completed');
   const active=all.filter(t=>['open','running','paused'].includes(t.status)).sort((a,b)=>(a.today_order||9999)-(b.today_order||9999));
   const percent=all.length?Math.round(done.length/all.length*100):0;
   const next=active.find(t=>t.status==='running')||active[0]||null;
   return '<section class="today-overview"><div class="today-overview-head"><span>HEUTE · '+done.length+'/'+all.length+' ERLEDIGT</span><strong>'+percent+' %</strong></div><div class="today-progress-track"><i style="width:'+percent+'%"></i></div>'+(next?'<div class="today-next"><small>'+(next.status==='running'?'LÄUFT GERADE':'NÄCHSTE AUFGABE')+'</small><span>'+esc(next.text)+'</span></div>':'<div class="today-next empty">Keine offene Aufgabe im Tagesblock.</div>')+'</section>';
 }

 function updateLiveDurationsV2(){
   const now=new Date().toISOString();
   tasks.forEach(t=>{
     if(!['running','paused'].includes(t.status))return;
     if(t.type==='cooking'){
       let active=0,passive=0;
       (Array.isArray(t.cooking_segments)?t.cooking_segments:[]).forEach(seg=>{
         let ms=0;if(seg&&seg.startedAt){
           const end=seg.endedAt||now,a=new Date(seg.startedAt).getTime(),b=new Date(end).getTime();
           if(Number.isFinite(a)&&Number.isFinite(b))ms=Math.max(0,b-a);
         }
         if(seg.mode==='passive')passive+=ms;else active+=ms;
       });
       const ae=document.querySelector('[data-live-cooking-active="'+CSS.escape(String(t.id))+'"]');
       const pe=document.querySelector('[data-live-cooking-passive="'+CSS.escape(String(t.id))+'"]');
       if(ae)ae.textContent=formatDurationV2(active);if(pe)pe.textContent=formatDurationV2(passive);
     }else{
       const total=(Number(t.imported_historical_progress_duration_ms)||0)+segmentSumV2(t.active_segments,now);
       const el=document.querySelector('[data-live-task="'+CSS.escape(String(t.id))+'"]');
       if(el)el.textContent=formatDurationV2(total);
     }
   });
 }

 function renderTaskCard(t){
   const p=t.priority&&t.priority!=='normal'?'<span class="meta-pill priority-'+esc(t.priority)+'">'+esc(priorityLabel(t.priority))+'</span>':'';
   const due=t.due_date?'<span class="meta-pill">'+(t.due_mode==='tomorrowOnly'?'MORGEN ':'BIS ')+esc(formatDate(t.due_date))+'</span>':'';
   const type=t.type?'<span class="meta-pill">'+esc(typeLabel(t.type))+'</span>':'';
   const optional=t.optional?'<span class="meta-pill optional">OPTIONAL</span>':'';
   const category=t.category?'<span class="meta-pill category">'+esc(String(t.category).toUpperCase())+'</span>':'';
   const state=t.status==='paused'?'<div class="task-state">PAUSIERT</div>':t.status==='running'?'<div class="task-state running">LÄUFT</div>':'';
   const cls='task-card'+(t.status==='paused'?' is-paused':'')+(t.status==='running'?' is-running':'')+(t.priority==='high'?' is-high':t.priority==='medium'?' is-medium':'');
   const today=t.today_date===berlinDateKey();
   const runLabel=t.status==='running'?'PAUSE':t.status==='paused'?'FORTSETZEN':t.type==='selfrunner'?'SELBSTLÄUFER':'START';
   const runDisabled=t.type==='selfrunner'?' disabled':'';
   const liveMeta=durationMetaV2(t);
   const cookingAction=t.type==='cooking'&&t.status==='running'?'<button type="button" class="task-action cooking-mode" data-action="cooking" data-id="'+esc(t.id)+'">'+(t.cooking_mode==='passive'?'AKTIV KOCHEN':'WARTEZEIT')+'</button>':'';
   const moveActions=filter==='today'?'<span class="today-move"><button type="button" class="task-action move" data-action="up" data-id="'+esc(t.id)+'" aria-label="Nach oben">↑</button><button type="button" class="task-action move" data-action="down" data-id="'+esc(t.id)+'" aria-label="Nach unten">↓</button></span>':'';
   return '<article class="'+cls+'" data-task-id="'+esc(t.id)+'"><div><div class="task-text">'+esc(t.text)+'</div><div class="task-meta">'+type+p+due+optional+category+'</div>'+state+liveMeta+'</div><div class="task-mark">○</div><div class="task-actions">'+moveActions+'<button type="button" class="task-action'+(today?' active':'')+'" data-action="today" data-id="'+esc(t.id)+'">'+(today?'✓ HEUTE':'HEUTE')+'</button><button type="button" class="task-action" data-action="run" data-id="'+esc(t.id)+'"'+runDisabled+'>'+runLabel+'</button>'+cookingAction+'<button type="button" class="task-action" data-action="complete" data-id="'+esc(t.id)+'">ERLEDIGT</button><button type="button" class="task-action" data-action="more" data-id="'+esc(t.id)+'">MEHR</button></div></article>';
 }

 function renderArchive(){
   const rows=archives.slice().sort((a,b)=>(b.archive_number||0)-(a.archive_number||0));
   count.textContent=String(rows.length);
   if(!rows.length){list.innerHTML='<div class="loading-card">Noch nichts im Archiv.</div>';return;}
   list.innerHTML=rows.map(a=>{
     const no=a.archive_number?'A'+a.archive_number:'ARCHIV';
     const meta=[a.category||'',a.completed_date?formatDate(a.completed_date):''].filter(Boolean).join(' · ');
     return '<article class="archive-card"><div class="archive-number">'+esc(no)+'</div><div class="archive-title">'+esc(a.text)+'</div><div class="archive-meta">'+esc(meta||typeLabel(a.type))+'</div></article>';
   }).join('');
 }

 function renderStatistics(){
   const open=tasks.filter(t=>t.status==='open').length;
   const paused=tasks.filter(t=>t.status==='paused').length;
   const due=tasks.filter(t=>['open','running','paused'].includes(t.status)&&t.due_date).length;
   const high=tasks.filter(t=>['open','running','paused'].includes(t.status)&&t.priority==='high').length;
   const medium=tasks.filter(t=>['open','running','paused'].includes(t.status)&&t.priority==='medium').length;
   const archive=archives.length;
   count.textContent=String(open+paused);
   const cards=[
     ['OFFEN',open,'aktive offene Aufgaben'],
     ['PAUSIERT',paused,'bewusst geparkte Aufgaben'],
     ['FÄLLIG',due,'Aufgaben mit Termin'],
     ['HOCH',high,'hohe Priorität'],
     ['MITTEL',medium,'mittlere Priorität'],
     ['ARCHIV',archive,'archivierte Einträge']
   ];
   list.innerHTML='<div class="data-grid">'+cards.map(x=>'<article class="data-card"><small>'+esc(x[0])+'</small><strong>'+esc(x[1])+'</strong><p>'+esc(x[2])+'</p></article>').join('')+'</div>';
 }

 function renderCategories(){
   const map=new Map();
   [...tasks,...archives].forEach(a=>{
     const name=String(a.category||'OHNE KATEGORIE').trim()||'OHNE KATEGORIE';
     map.set(name,(map.get(name)||0)+1);
   });
   const rows=[...map.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'de'));
   count.textContent=String(rows.length);
   list.innerHTML=rows.length?'<div class="simple-list">'+rows.map(([name,n])=>'<div class="simple-row"><span>'+esc(name)+'</span><strong>'+n+'</strong></div>').join('')+'</div>':'<div class="loading-card">Keine Kategorien vorhanden.</div>';
 }

 function renderTitles(){
   const map=new Map();
   const add=item=>{
     const raw=String(item.text||'').trim();
     if(!raw)return;
     const key=raw.toLocaleLowerCase('de-DE');
     const old=map.get(key)||{name:raw,count:0};
     old.count+=1; map.set(key,old);
   };
   tasks.forEach(add); archives.forEach(add);
   const rows=[...map.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'de'));
   count.textContent=String(rows.length);
   list.innerHTML=rows.length?'<div class="simple-list">'+rows.map(x=>'<div class="simple-row"><span>'+esc(x.name)+'</span><strong>'+x.count+'</strong></div>').join('')+'</div>':'<div class="loading-card">Noch keine bekannten Titel.</div>';
 }

 function render(){
   updateSummary();
   if(composer)composer.hidden=filter!=='all';
   const summary=$('#todoSummary');
   if(summary)summary.hidden=['archive','statistics','categories','titles'].includes(filter);

   if(filter==='archive'){renderArchive();return;}
   if(filter==='statistics'){renderStatistics();return;}
   if(filter==='categories'){renderCategories();return;}
   if(filter==='titles'){renderTitles();return;}

   const rows=taskRows();
   count.textContent=String(rows.length);
   if(!rows.length){
     const text=filter==='today'?'Heute ist noch nichts eingeplant.':filter==='due'?'Keine fälligen Aufgaben.':filter==='paused'?'Nichts pausiert.':'Hier ist gerade angenehm wenig los.';
     list.innerHTML='<div class="loading-card">'+text+'</div>';
     return;
   }
   list.innerHTML=(filter==='today'?todayOverviewV2():'')+rows.map(renderTaskCard).join('');
   updateLiveDurationsV2();
 }

 async function ensureClient(){
   if(!window.supabase)throw new Error('Supabase-Bibliothek noch nicht geladen.');
   if(!client){
     client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
       auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
     });
   }
   const result=await client.auth.getSession();
   if(result.error)throw result.error;
   session=result.data&&result.data.session?result.data.session:null;
   if(!session)throw new Error('Für TO-DO 2.0 ist dein bestehender Supabase-Login nötig.');
   return client;
 }

 async function load(){
   try{
     if(!window.MOD2Data)throw new Error('2.0-Datenmodul wurde nicht geladen.');
     const [taskState,archiveRows]=await Promise.all([
       window.MOD2Data.loadTasks(),
       window.MOD2Data.loadArchive()
     ]);
     tasks=taskState.tasks||[];
     archives=archiveRows||[];
     refreshCategorySuggestions();
     render();
     if(!taskState.sharedLocalMaster)showToast('Hinweis: 1.0-Datenbestand auf diesem Gerät noch nicht geladen. Schreibfunktionen bleiben geschützt.');
   }catch(error){
     list.innerHTML='<div class="loading-card">'+esc(error&&error.message?error.message:'Daten konnten gerade nicht geladen werden.')+'</div>';
     count.textContent='0';
   }
 }

 async function addTask(){
   const input=$('#newTaskText');
   const textValue=input?input.value.trim():'';
   if(!textValue){showToast('Da fehlt noch der Aufgabenname.');return;}
   const button=$('#newTaskButton');
   if(button)button.disabled=true;
   try{
     if(!window.MOD2Data)throw new Error('2.0-Datenmodul wurde nicht geladen.');
     const tomorrow=addCalendarDays(berlinDateKey(),1);
     if(editingId){
       const updated=await window.MOD2Data.patchTask(editingId,{
         text:textValue,type:composerState.type,priority:composerState.priority,
         optional:composerState.optional,category:composerState.category||null,dueMode:composerState.dueMode,
         dueDate:composerState.dueMode==='none'?null:tomorrow
       });
       const idx=tasks.findIndex(x=>Number(x.legacy_task_id)===Number(editingId));
       if(idx>=0)tasks[idx]={...tasks[idx],...updated};
       resetEditor();render();showToast('Aufgabe geändert.');
     }else{
       const created=await window.MOD2Data.addTask({
         text:textValue,type:composerState.type,priority:composerState.priority,
         optional:composerState.optional,category:composerState.category||null,dueMode:composerState.dueMode,
         dueDate:composerState.dueMode==='none'?null:tomorrow
       });
       tasks.unshift(created);
       resetEditor();render();showToast('Aufgabe angelegt.');
     }
   }catch(error){
     showToast(error&&error.message?error.message:'Aufgabe konnte nicht gespeichert werden.');
   }finally{
     if(button)button.disabled=false;
   }
 }


 function titleGroups(){
   const map=new Map();
   const add=row=>{
     const name=String(row&&row.text||'').trim(); if(!name)return;
     const key=name.toLocaleLowerCase('de-DE');
     const old=map.get(key)||{name,count:0,latest:null};
     old.count+=1; old.latest=row; map.set(key,old);
   };
   tasks.forEach(add);archives.forEach(add);
   return [...map.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'de'));
 }

 function hideSuggestions(){
   const box=$('#titleSuggestions');
   if(box){box.hidden=true;box.innerHTML='';}
 }

 function renderSuggestions(query=''){
   const box=$('#titleSuggestions'); if(!box)return;
   const q=String(query||'').trim().toLocaleLowerCase('de-DE');
   const rows=titleGroups().filter(x=>!q||x.name.toLocaleLowerCase('de-DE').includes(q)).slice(0,8);
   if(!rows.length){hideSuggestions();return;}
   box.innerHTML=rows.map((x,i)=>'<button type="button" class="title-suggestion" data-suggestion-index="'+i+'"><span>'+esc(x.name)+'</span><small>'+x.count+'×</small></button>').join('');
   box.hidden=false;
   box.querySelectorAll('[data-suggestion-index]').forEach((btn,i)=>btn.addEventListener('click',()=>{
     const x=rows[i],input=$('#newTaskText');
     if(input)input.value=x.name;
     if(x.latest){
       composerState.type=x.latest.type||'work';
       composerState.priority=x.latest.priority||'normal';
       composerState.optional=Boolean(x.latest.optional);
       composerState.category=x.latest.category||'';
     }
     updateComposerUI();hideSuggestions();
   }));
 }

 function setAllTab(){
   filter='all';
   document.querySelectorAll('.todo-tab').forEach(x=>x.classList.toggle('active',x.dataset.filter==='all'));
 }

 function resetEditor(){
   editingId=null;
   const input=$('#newTaskText');if(input)input.value='';
   composerState={type:'work',priority:'normal',optional:false,dueMode:'none',category:''};
   const button=$('#newTaskButton');if(button)button.textContent='+ AUFGABE HINZUFÜGEN';
   const cancel=$('#cancelEditButton');if(cancel)cancel.hidden=true;
   updateComposerUI();hideSuggestions();
 }

 function startEdit(id){
   const t=tasks.find(x=>String(x.id)===String(id));if(!t)return;
   if(t.legacy_task_id==null){showToast('Diese Aufgabe hat noch keine gemeinsame 1.0-ID.');return;}
   editingId=t.legacy_task_id;setAllTab();
   const input=$('#newTaskText');if(input)input.value=t.text||'';
   composerState={type:t.type||'work',priority:t.priority||'normal',optional:Boolean(t.optional),dueMode:t.due_mode||'none',category:t.category||''};
   const button=$('#newTaskButton');if(button)button.textContent='ÄNDERUNGEN SPEICHERN';
   const cancel=$('#cancelEditButton');if(cancel)cancel.hidden=false;
   updateComposerUI();render();
   setTimeout(()=>{
     if(composer){composer.hidden=false;composer.scrollIntoView({behavior:'smooth',block:'start'});}
     if(input)input.focus();
   },0);
 }

 async function toggleToday(id){
   const t=tasks.find(x=>String(x.id)===String(id));if(!t)return;
   try{
     if(!window.MOD2Data)throw new Error('2.0-Datenmodul wurde nicht geladen.');
     if(t.legacy_task_id==null)throw new Error('Gemeinsame Aufgaben-ID fehlt.');
     const selected=t.today_date===berlinDateKey();
     const updated=await window.MOD2Data.setToday(t.legacy_task_id,!selected);
     Object.assign(t,updated);render();
     showToast(selected?'Aus Heute entfernt.':'Für Heute eingeplant.');
   }catch(error){showToast(error&&error.message?error.message:'Heute-Zuordnung konnte nicht geändert werden.');}
 }

 async function runAction(id){
   const t=tasks.find(x=>String(x.id)===String(id));if(!t)return;
   try{
     if(!window.MOD2Data)throw new Error('2.0-Datenmodul wurde nicht geladen.');
     if(t.legacy_task_id==null)throw new Error('Gemeinsame Aufgaben-ID fehlt.');
     const before=t.status;
     const updated=await window.MOD2Data.runTask(t.legacy_task_id);
     Object.assign(t,updated);render();
     showToast(before==='running'?'Aufgabe pausiert.':before==='paused'?'Aufgabe fortgesetzt.':'Aufgabe gestartet.');
   }catch(error){showToast(error&&error.message?error.message:'Start/Pause konnte nicht gespeichert werden.');}
 }


 async function completeAction(id){
   const t=tasks.find(x=>String(x.id)===String(id));if(!t)return;
   try{
     if(!window.MOD2Data)throw new Error('2.0-Datenmodul wurde nicht geladen.');
     if(t.legacy_task_id==null)throw new Error('Gemeinsame Aufgaben-ID fehlt.');
     const updated=await window.MOD2Data.completeTask(t.legacy_task_id);
     Object.assign(t,updated);render();showToast('Aufgabe erledigt.');
   }catch(error){
     showToast(error&&error.message?error.message:'Aufgabe konnte nicht erledigt werden.');
   }
 }

 function refreshCategorySuggestions(){
   const listEl=$('#categorySuggestions');if(!listEl)return;
   const names=[...new Set([...tasks,...archives].map(x=>String(x&&x.category||'').trim()).filter(Boolean))]
     .sort((a,b)=>a.localeCompare(b,'de'));
   listEl.innerHTML=names.map(name=>'<option value="'+esc(name)+'"></option>').join('');
 }



 function closeTodoModal(){
   const root=$('#todoModal');if(root)root.innerHTML='';
 }

 function isoToLocalInput(value){
   if(!value)return '';
   const d=new Date(value);if(Number.isNaN(d.getTime()))return '';
   const pad=n=>String(n).padStart(2,'0');
   return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
 }

 function localInputToIso(value){
   if(!value)return null;
   const d=new Date(value);
   return Number.isNaN(d.getTime())?null:d.toISOString();
 }

 function modalShell(title,body,actions=''){
   const root=$('#todoModal');if(!root)return;
   root.innerHTML='<div class="todo-modal-backdrop" data-modal-close="1"><section class="todo-modal-card" role="dialog" aria-modal="true"><h2>'+esc(title)+'</h2>'+body+'<div class="todo-modal-actions">'+actions+'</div></section></div>';
   const backdrop=root.querySelector('[data-modal-close]');
   if(backdrop)backdrop.addEventListener('click',e=>{if(e.target===backdrop)closeTodoModal();});
   root.querySelectorAll('[data-close-modal]').forEach(b=>b.addEventListener('click',closeTodoModal));
 }

 function openMoreMenu(id){
   const t=tasks.find(x=>String(x.id)===String(id));if(!t)return;
   const body='<p class="todo-modal-task">'+esc(t.text)+'</p><div class="todo-more-grid"><button data-more="edit">BEARBEITEN</button><button data-more="time">ZEITEN KORRIGIEREN</button><button data-more="repeat">WIEDERHOLEN</button><button data-more="abort" class="danger">ABBRECHEN</button><button data-more="delete" class="danger">LÖSCHEN</button></div>';
   modalShell('Aufgabe',body,'<button type="button" data-close-modal>ZURÜCK</button>');
   const root=$('#todoModal');
   root.querySelector('[data-more="edit"]')?.addEventListener('click',()=>{closeTodoModal();startEdit(id);});
   root.querySelector('[data-more="time"]')?.addEventListener('click',()=>openTimeModal(id));
   root.querySelector('[data-more="repeat"]')?.addEventListener('click',()=>repeatAction(id));
   root.querySelector('[data-more="abort"]')?.addEventListener('click',()=>confirmAbort(id));
   root.querySelector('[data-more="delete"]')?.addEventListener('click',()=>confirmDelete(id));
 }

 function openTimeModal(id){
   const t=tasks.find(x=>String(x.id)===String(id));if(!t)return;
   if(t.type==='selfrunner'){showToast('Selbstläufer benötigen keine manuelle Zeitkorrektur.');return;}
   const start=isoToLocalInput(t.started_at);
   const end=isoToLocalInput(t.completed_at);
   const body='<p class="todo-modal-task">'+esc(t.text)+'</p><label class="time-field"><span>STARTZEIT</span><input id="manualStartV2" type="datetime-local" value="'+esc(start)+'"></label><label class="time-field"><span>ENDZEIT</span><input id="manualEndV2" type="datetime-local" value="'+esc(end)+'"></label><p class="todo-modal-help">Nur Startzeit: Aufgabe läuft. Start + Ende: Aufgabe wird mit dieser tatsächlichen Dauer abgeschlossen.</p>';
   modalShell('Zeiten korrigieren',body,'<button type="button" data-close-modal>ABBRECHEN</button><button type="button" id="saveManualTimeV2" class="primary">SPEICHERN</button>');
   $('#saveManualTimeV2')?.addEventListener('click',()=>saveManualTimeAction(id));
 }

 async function saveManualTimeAction(id){
   const t=tasks.find(x=>String(x.id)===String(id));if(!t)return;
   const start=localInputToIso($('#manualStartV2')?.value||'');
   const end=localInputToIso($('#manualEndV2')?.value||'');
   if(!start){showToast('Eine gültige Startzeit ist erforderlich.');return;}
   try{
     const updated=await window.MOD2Data.setManualTimes(t.legacy_task_id,start,end);
     Object.assign(t,updated);closeTodoModal();render();showToast('Zeiten gespeichert.');
   }catch(error){showToast(error&&error.message?error.message:'Zeiten konnten nicht gespeichert werden.');}
 }

 async function repeatAction(id){
   const t=tasks.find(x=>String(x.id)===String(id));if(!t)return;
   try{
     const created=await window.MOD2Data.repeatTask(t.legacy_task_id);
     tasks.push(created);closeTodoModal();render();showToast('Aufgabe wiederholt.');
   }catch(error){showToast(error&&error.message?error.message:'Aufgabe konnte nicht wiederholt werden.');}
 }

 function confirmDelete(id){
   const t=tasks.find(x=>String(x.id)===String(id));if(!t)return;
   const body='<p class="todo-modal-task">'+esc(t.text)+'</p><p class="todo-modal-help">Die Aufgabe wird aus dem gemeinsamen Datenbestand gelöscht. Das rote R kann diesen Schritt direkt danach rückgängig machen.</p>';
   modalShell('Aufgabe löschen?',body,'<button type="button" data-close-modal>ABBRECHEN</button><button type="button" id="confirmDeleteV2" class="danger">LÖSCHEN</button>');
   $('#confirmDeleteV2')?.addEventListener('click',()=>deleteAction(id));
 }

 async function deleteAction(id){
   const t=tasks.find(x=>String(x.id)===String(id));if(!t)return;
   try{
     await window.MOD2Data.deleteTask(t.legacy_task_id);
     tasks=tasks.filter(x=>String(x.id)!==String(id));
     closeTodoModal();render();showToast('Aufgabe gelöscht. R = Rückgängig.');
   }catch(error){showToast(error&&error.message?error.message:'Aufgabe konnte nicht gelöscht werden.');}
 }


 async function cookingModeAction(id){
   const t=tasks.find(x=>String(x.id)===String(id));if(!t)return;
   try{
     const next=t.cooking_mode==='passive'?'active':'passive';
     const updated=await window.MOD2Data.switchCookingMode(t.legacy_task_id,next);
     Object.assign(t,updated);render();
     showToast(next==='passive'?'Warte-/Garzeit läuft.':'Aktives Kochen läuft.');
   }catch(error){showToast(error&&error.message?error.message:'Kochmodus konnte nicht gewechselt werden.');}
 }


 function confirmAbort(id){
   const t=tasks.find(x=>String(x.id)===String(id));if(!t)return;
   const body='<p class="todo-modal-task">'+esc(t.text)+'</p><p class="todo-modal-help">Die Aufgabe wird abgebrochen. Bereits erfasste Zeit bleibt erhalten.</p>';
   modalShell('Aufgabe abbrechen?',body,'<button type="button" data-close-modal>ZURÜCK</button><button type="button" id="confirmAbortV2" class="danger">ABBRECHEN</button>');
   $('#confirmAbortV2')?.addEventListener('click',()=>abortAction(id));
 }

 async function abortAction(id){
   const t=tasks.find(x=>String(x.id)===String(id));if(!t)return;
   try{
     const updated=await window.MOD2Data.abortTask(t.legacy_task_id);
     Object.assign(t,updated);closeTodoModal();render();showToast('Aufgabe abgebrochen.');
   }catch(error){showToast(error&&error.message?error.message:'Aufgabe konnte nicht abgebrochen werden.');}
 }

 async function moveTodayAction(id,direction){
   const rows=taskRows();
   const index=rows.findIndex(x=>String(x.id)===String(id));
   if(index<0)return;
   const target=direction==='up'?index-1:index+1;
   if(target<0||target>=rows.length)return;
   const reordered=rows.slice();
   [reordered[index],reordered[target]]=[reordered[target],reordered[index]];
   try{
     const updated=await window.MOD2Data.reorderToday(reordered.map(x=>x.legacy_task_id),berlinDateKey());
     const byLegacy=new Map(updated.map(x=>[Number(x.legacy_task_id),x]));
     tasks=tasks.map(x=>byLegacy.has(Number(x.legacy_task_id))?{...x,...byLegacy.get(Number(x.legacy_task_id))}:x);
     render();showToast('Heute-Reihenfolge geändert.');
   }catch(error){showToast(error&&error.message?error.message:'Reihenfolge konnte nicht gespeichert werden.');}
 }

 document.querySelectorAll('.todo-tab').forEach(btn=>btn.addEventListener('click',()=>{
   document.querySelectorAll('.todo-tab').forEach(x=>x.classList.remove('active'));
   btn.classList.add('active');
   filter=btn.dataset.filter||'all';
   btn.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
   render();
 }));

 document.querySelectorAll('[data-type]').forEach(btn=>btn.addEventListener('click',()=>{
   composerState.type=btn.dataset.type; updateComposerUI();
 }));
 document.querySelectorAll('[data-priority]').forEach(btn=>btn.addEventListener('click',()=>{
   composerState.priority=btn.dataset.priority; updateComposerUI();
 }));
 document.querySelectorAll('[data-due]').forEach(btn=>btn.addEventListener('click',()=>{
   composerState.dueMode=btn.dataset.due; updateComposerUI();
 }));
 const categoryField=$('#newCategoryInput');
 if(categoryField)categoryField.addEventListener('input',()=>{composerState.category=categoryField.value.trim();});
 const optional=$('#optionalChoice');
 if(optional)optional.addEventListener('click',()=>{composerState.optional=!composerState.optional;updateComposerUI();});
 const addButton=$('#newTaskButton');
 if(addButton)addButton.addEventListener('click',addTask);
 const cancelEdit=$('#cancelEditButton');
 if(cancelEdit)cancelEdit.addEventListener('click',()=>{resetEditor();render();});
 const input=$('#newTaskText');
 if(input){
   input.addEventListener('keydown',e=>{if(e.key==='Enter')addTask();if(e.key==='Escape'){hideSuggestions();}});
   input.addEventListener('input',()=>renderSuggestions(input.value));
   input.addEventListener('focus',()=>renderSuggestions(input.value));
 }
 if(list)list.addEventListener('click',event=>{
   const btn=event.target.closest('[data-action][data-id]'); if(!btn)return;
   if(btn.dataset.action==='today')toggleToday(btn.dataset.id);
   if(btn.dataset.action==='run')runAction(btn.dataset.id);
   if(btn.dataset.action==='cooking')cookingModeAction(btn.dataset.id);
   if(btn.dataset.action==='complete')completeAction(btn.dataset.id);
   if(btn.dataset.action==='more')openMoreMenu(btn.dataset.id);
   if(btn.dataset.action==='up')moveTodayAction(btn.dataset.id,'up');
   if(btn.dataset.action==='down')moveTodayAction(btn.dataset.id,'down');
   if(btn.dataset.action==='edit')startEdit(btn.dataset.id);
 });
 const undo=$('#todoUndo');
 if(undo)undo.addEventListener('click',async()=>{
   try{
     if(!window.MOD2Data)throw new Error('2.0-Datenmodul wurde nicht geladen.');
     const result=await window.MOD2Data.undoLast();
     await load();
     showToast('Rückgängig: '+result.label+'.');
   }catch(error){showToast(error&&error.message?error.message:'Undo nicht möglich.');}
 });

 updateComposerUI();
 const wait=()=>{
   if(window.supabase&&window.MOD2Data)load();
   else setTimeout(wait,70);
 };
 wait();
 window.__mod2LiveTimer=setInterval(updateLiveDurationsV2,1000);
})();