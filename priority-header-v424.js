/* V426 · PRIORITY TAB HEADER CLEAN REBUILD */
(function(){
  const defs=[
    {key:'high',label:'HOHE PRIORITÄT',color:'#d85b5b'},
    {key:'medium',label:'MITTLERE PRIORITÄT',color:'#d3aa45'},
    {key:'normal',label:'NORMALE PRIORITÄT',color:'#f3f3f3'},
    {key:'optional',label:'OPTIONAL',color:'#a66ad8'}
  ];

  function patch(){
    if(typeof currentTab!=='undefined'&&currentTab!=='priority')return;
    const root=document.getElementById('viewContainer')||document;
    const sections=[...root.querySelectorAll(':scope > .section')].slice(0,4);
    if(sections.length<4)return;

    const anyTaskText=root.querySelector('.task .task-text');
    const fallbackOffset=67;

    sections.forEach((sec,index)=>{
      const def=defs[index];
      const head=sec.querySelector(':scope > .section-header');
      if(!head)return;

      const oldCounter=head.querySelector('.counter,.priority-count-v425,.priority-count-v424,.priority-counter-v421');
      const countText=(oldCounter?.textContent||String(sec.querySelectorAll('.task').length)).trim();
      const taskText=sec.querySelector('.task .task-text')||anyTaskText;
      const headLeft=head.getBoundingClientRect().left;
      const taskLeft=taskText?taskText.getBoundingClientRect().left:headLeft+fallbackOffset;
      const offset=Math.max(54,Math.round(taskLeft-headLeft));

      head.className='section-header priority-header-v426 '+def.key;
      head.style.setProperty('--priority-color-v426',def.color);
      head.style.setProperty('--priority-label-offset-v426',offset+'px');
      head.innerHTML='<span class="priority-ring-v426" aria-hidden="true"></span><span class="priority-label-v426">'+def.label+'</span><span class="counter priority-count-v426">'+countText+'</span>';
    });
  }

  let queued=false;
  const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;patch();});};
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  const oldSwitch=window.switchTab;
  if(typeof oldSwitch==='function')window.switchTab=function(tab){const r=oldSwitch.apply(this,arguments);if(tab==='priority')setTimeout(patch,30);return r;};
  window.__modPriorityHeaderV424={version:'V426',patch};
  addEventListener('load',()=>setTimeout(patch,350));
  patch();
})();
