/* V447 · HEUTE-AKTION AUCH BEI PAUSIERTEN AUFGABEN */
(function(){
  function patchPausedTodayButtons(){
    const today=typeof getBerlinDateKey==='function'?getBerlinDateKey():null;
    document.querySelectorAll('#viewContainer .task:not(.archive-task)').forEach(card=>{
      const resume=card.querySelector('button[onclick*="resumeTask("]');
      if(!resume)return;
      const match=String(resume.getAttribute('onclick')||'').match(/resumeTask\((\d+)\)/);
      if(!match)return;
      const id=Number(match[1]);
      const task=typeof getTask==='function'?getTask(id):null;
      if(!task||task.status!=='paused')return;
      const actions=resume.closest('.icon-actions');
      if(!actions)return;
      let btn=actions.querySelector('.paused-today-v447');
      if(!btn){
        const timeBtn=actions.querySelector('button[onclick*="askManualTimes("]');
        if(!timeBtn)return;
        btn=timeBtn.cloneNode(true);
        btn.classList.add('paused-today-v447','today-button');
        timeBtn.insertAdjacentElement('afterend',btn);
      }
      const selected=!!(today&&task.todayDate===today);
      btn.setAttribute('onclick',`toggleToday(${id})`);
      btn.setAttribute('title',selected?'Aus Heute entfernen':'Für heute markieren');
      btn.setAttribute('aria-label',selected?'Aus Heute entfernen':'Für heute markieren');
      btn.classList.toggle('selected',selected);
      btn.dataset.iconV416='';
      btn.innerHTML=selected?'📌':'📅';
    });
  }
  const previousRender=typeof render==='function'?render:null;
  if(previousRender){
    window.render=function(){
      const result=previousRender.apply(this,arguments);
      patchPausedTodayButtons();
      setTimeout(patchPausedTodayButtons,0);
      return result;
    };
  }
  window.__modPausedTodayV447={version:'V447',patch:patchPausedTodayButtons};
  window.addEventListener('load',()=>setTimeout(patchPausedTodayButtons,350));
})();
