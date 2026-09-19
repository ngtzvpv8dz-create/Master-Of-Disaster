(() => {
 'use strict';
 const SUPABASE_URL='https://oktpzwhhndsbikkeelot.supabase.co';
 const SUPABASE_KEY='sb_publishable_EaxtFXKAGOLyI6HRWPU6DQ_f04wfWru';
 let client=null,tasks=[],filter='open';

 const $=s=>document.querySelector(s);
 const list=$('#taskList'),count=$('#taskCount'),toast=$('#todoToast');

 function showToast(msg){
   toast.textContent=msg;toast.classList.add('show');
   clearTimeout(window.__todoToast);window.__todoToast=setTimeout(()=>toast.classList.remove('show'),1900);
 }
 function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
 function filtered(){
   const today=new Date().toISOString().slice(0,10);
   if(filter==='today')return tasks.filter(t=>t.today_date===today);
   if(filter==='priority')return tasks.filter(t=>['high','medium'].includes(t.priority));
   return tasks.filter(t=>t.status==='open');
 }
 function render(){
   const rows=filtered();
   count.textContent=String(rows.length);
   if(!rows.length){list.innerHTML='<div class="loading-card">Hier ist gerade angenehm wenig los.</div>';return;}
   list.innerHTML=rows.map(t=>{
     const p=t.priority&&t.priority!=='normal'?'<span class="meta-pill priority-'+esc(t.priority)+'">'+esc(t.priority.toUpperCase())+'</span>':'';
     const due=t.due_date?'<span class="meta-pill">BIS '+esc(new Date(t.due_date+'T12:00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}))+'</span>':'';
     const type=t.type?'<span class="meta-pill">'+esc(t.type.toUpperCase())+'</span>':'';
     return '<article class="task-card"><div><div class="task-text">'+esc(t.text)+'</div><div class="task-meta">'+type+p+due+'</div></div><div class="task-mark">○</div></article>';
   }).join('');
 }
 async function load(){
   if(!window.supabase){setTimeout(load,80);return;}
   if(!client)client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
     auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
   });
   const {data:sessionData,error:sessionError}=await client.auth.getSession();
   if(sessionError){list.innerHTML='<div class="loading-card">Supabase-Sitzung konnte nicht geprüft werden.</div>';return;}
   if(!sessionData||!sessionData.session){
     list.innerHTML='<div class="loading-card">Für die Aufgaben ist dein Supabase-Login nötig. Die 2.0 nutzt dieselbe sichere Sitzung wie 1.0.</div>';
     count.textContent='0';
     return;
   }
   const {data,error}=await client.from('tasks').select('id,text,status,type,priority,optional,due_mode,due_date,today_date,today_order,created_at').order('today_order',{ascending:true}).order('created_at',{ascending:false});
   if(error){list.innerHTML='<div class="loading-card">Supabase konnte gerade nicht geladen werden.</div>';return;}
   tasks=data||[];render();
 }
 document.querySelectorAll('.todo-tab').forEach(btn=>btn.addEventListener('click',()=>{
   document.querySelectorAll('.todo-tab').forEach(x=>x.classList.remove('active'));
   btn.classList.add('active');filter=btn.dataset.filter;render();
 }));
 $('#newTaskButton').addEventListener('click',()=>showToast('Anlegen kommt nach dem visuellen TO-DO-Grundgerüst.'));
 $('#newTaskText').addEventListener('keydown',e=>{if(e.key==='Enter')$('#newTaskButton').click();});
 $('#todoUndo').addEventListener('click',()=>showToast('Undo/Verlauf wird im nächsten TO-DO-Schritt angebunden.'));
 load();
})();