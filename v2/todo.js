(() => {
 'use strict';

 const SUPABASE_URL='https://oktpzwhhndsbikkeelot.supabase.co';
 const SUPABASE_KEY='sb_publishable_EaxtFXKAGOLyI6HRWPU6DQ_f04wfWru';
 let client=null;
 let session=null;
 let tasks=[];
 let archives=[];
 let filter='all';
 let composerState={type:'work',priority:'normal',optional:false,dueMode:'none'};

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
   const optional=$('#optionalChoice');
   if(optional){
     optional.classList.toggle('selected',composerState.optional);
     optional.textContent=composerState.optional?'🟣 JA':'🟣 NEIN';
   }
 }

 function updateSummary(){
   const open=tasks.filter(t=>t.status==='open').length;
   const paused=tasks.filter(t=>t.status==='paused').length;
   const priority=tasks.filter(t=>t.status==='open'&&['high','medium'].includes(t.priority)).length;
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
     rows=tasks.filter(t=>t.status==='open'&&['high','medium'].includes(t.priority));
     return rows.sort((a,b)=>{
       const rank={high:0,medium:1,normal:2};
       return (rank[a.priority]??9)-(rank[b.priority]??9);
     });
   }
   if(filter==='due'){
     rows=tasks.filter(t=>['open','paused'].includes(t.status)&&t.due_date);
     return rows.sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date)));
   }
   if(filter==='paused')return tasks.filter(t=>t.status==='paused');
   return tasks.filter(t=>t.status==='open');
 }

 function renderTaskCard(t){
   const p=t.priority&&t.priority!=='normal'?'<span class="meta-pill priority-'+esc(t.priority)+'">'+esc(priorityLabel(t.priority))+'</span>':'';
   const due=t.due_date?'<span class="meta-pill">'+(t.due_mode==='tomorrowOnly'?'MORGEN ':'BIS ')+esc(formatDate(t.due_date))+'</span>':'';
   const type=t.type?'<span class="meta-pill">'+esc(typeLabel(t.type))+'</span>':'';
   const optional=t.optional?'<span class="meta-pill optional">OPTIONAL</span>':'';
   const state=t.status==='paused'?'<div class="task-state">PAUSIERT</div>':'';
   const cls='task-card'+(t.status==='paused'?' is-paused':'')+(t.priority==='high'?' is-high':t.priority==='medium'?' is-medium':'');
   return '<article class="'+cls+'"><div><div class="task-text">'+esc(t.text)+'</div><div class="task-meta">'+type+p+due+optional+'</div>'+state+'</div><div class="task-mark">○</div></article>';
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
   const due=tasks.filter(t=>['open','paused'].includes(t.status)&&t.due_date).length;
   const high=tasks.filter(t=>t.status==='open'&&t.priority==='high').length;
   const medium=tasks.filter(t=>t.status==='open'&&t.priority==='medium').length;
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
   archives.forEach(a=>{
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
   list.innerHTML=rows.map(renderTaskCard).join('');
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
     await ensureClient();
     const [taskResult,archiveResult]=await Promise.all([
       client.from('tasks')
        .select('id,text,status,type,priority,optional,due_mode,due_date,today_date,today_order,created_at,updated_at')
        .order('today_order',{ascending:true})
        .order('created_at',{ascending:false}),
       client.from('archive_entries')
        .select('id,archive_number,text,status,type,priority,optional,due_mode,due_date,completed_date,category,archived_at')
        .order('archive_number',{ascending:false})
     ]);
     if(taskResult.error)throw taskResult.error;
     if(archiveResult.error)throw archiveResult.error;
     tasks=taskResult.data||[];
     archives=archiveResult.data||[];
     render();
   }catch(error){
     list.innerHTML='<div class="loading-card">'+esc(error&&error.message?error.message:'Supabase konnte gerade nicht geladen werden.')+'</div>';
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
     await ensureClient();
     const tomorrow=addCalendarDays(berlinDateKey(),1);
     const payload={
       user_id:session.user.id,
       text:textValue,
       status:'open',
       type:composerState.type,
       priority:composerState.priority,
       optional:composerState.optional,
       due_mode:composerState.dueMode,
       due_date:composerState.dueMode==='none'?null:tomorrow
     };
     const result=await client.from('tasks').insert([payload]).select('id,text,status,type,priority,optional,due_mode,due_date,today_date,today_order,created_at,updated_at').single();
     if(result.error)throw result.error;
     tasks.unshift(result.data);
     if(input)input.value='';
     composerState={type:'work',priority:'normal',optional:false,dueMode:'none'};
     updateComposerUI();
     render();
     showToast('Aufgabe angelegt.');
   }catch(error){
     showToast(error&&error.message?error.message:'Aufgabe konnte nicht angelegt werden.');
   }finally{
     if(button)button.disabled=false;
   }
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
 const optional=$('#optionalChoice');
 if(optional)optional.addEventListener('click',()=>{composerState.optional=!composerState.optional;updateComposerUI();});
 const addButton=$('#newTaskButton');
 if(addButton)addButton.addEventListener('click',addTask);
 const input=$('#newTaskText');
 if(input)input.addEventListener('keydown',e=>{if(e.key==='Enter')addTask();});
 const undo=$('#todoUndo');
 if(undo)undo.addEventListener('click',()=>showToast('Undo/Verlauf ist als eigener 2.0-Schritt noch offen.'));

 updateComposerUI();
 const wait=()=>{
   if(window.supabase)load();
   else setTimeout(wait,70);
 };
 wait();
})();