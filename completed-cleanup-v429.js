/* V429 · REMOVE REDUNDANT REPEAT ACTION FROM COMPLETED/ABORTED TASKS */
(function(){
  function normalize(v){return String(v||'').trim().toLowerCase().replace(/\s+/g,' ');}
  function taskForCard(card){
    try{
      const api=window.__modCategoriesV412;
      if(api&&typeof api.rowForCard==='function'){
        const row=api.rowForCard(card);
        if(row)return row;
      }
    }catch(_){}
    const text=normalize(card.querySelector('.task-text')?.textContent);
    try{return (Array.isArray(tasks)?tasks:[]).find(t=>normalize(t?.text)===text)||null;}catch(_){return null;}
  }
  function isRepeatButton(btn){
    const hay=normalize([
      btn.getAttribute('title'),
      btn.getAttribute('aria-label'),
      btn.getAttribute('onclick'),
      btn.textContent
    ].filter(Boolean).join(' '));
    if(/wiederhol|erneut|nochmal|noch mal|neu hinzufügen|neu hinzufuegen|repeat|readd|re-add/.test(hay))return true;
    /* V416 turns the old repeat clock into a monochrome clock. On completed/aborted cards
       there is no legitimate manual-time action anymore, so that clock is the redundant repeat action. */
    return btn.dataset.iconV416==='clock';
  }
  function patch(){
    document.querySelectorAll('#viewContainer .task:not(.archive-task)').forEach(card=>{
      const task=taskForCard(card);
      if(!task||!['completed','aborted'].includes(task.status))return;
      card.querySelectorAll('button').forEach(btn=>{if(isRepeatButton(btn))btn.remove();});
    });
  }
  const previousRender=typeof render==='function'?render:null;
  if(previousRender){window.render=function(){const result=previousRender.apply(this,arguments);setTimeout(patch,0);return result;};}
  let queued=false;
  const queue=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;patch();});};
  new MutationObserver(queue).observe(document.getElementById('viewContainer')||document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',()=>setTimeout(patch,250));
  patch();
  window.__modCompletedCleanupV429={version:'V429',patch};
})();
