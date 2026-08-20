/* V424 · PRIORITY HEADER EXACT ALIGNMENT */
(function(){
  const defs={
    high:{label:'HOHE PRIORITÄT',color:'#d85b5b'},
    medium:{label:'MITTLERE PRIORITÄT',color:'#d3aa45'},
    normal:{label:'NORMALE PRIORITÄT',color:'#d8dde1'},
    optional:{label:'OPTIONAL',color:'#a66ad8'}
  };
  function kindFrom(text){const t=(text||'').toUpperCase();if(t.includes('HOHE PRIORIT'))return'high';if(t.includes('MITTLERE PRIORIT'))return'medium';if(t.includes('NORMALE PRIORIT'))return'normal';if(t.includes('OPTIONAL'))return'optional';return null;}
  function patch(){
    if(typeof currentTab!=='undefined'&&currentTab!=='priority')return;
    document.querySelectorAll('.section').forEach(sec=>{
      const head=sec.querySelector(':scope > .section-header');
      const title=head?.querySelector('.section-title');
      const counter=head?.querySelector('.counter');
      if(!head||!title||!counter)return;
      const kind=kindFrom(title.textContent); if(!kind)return;
      const def=defs[kind];
      const taskText=sec.querySelector('.task .task-text');
      const headLeft=head.getBoundingClientRect().left;
      const taskLeft=taskText?taskText.getBoundingClientRect().left:headLeft+88;
      const offset=Math.max(52,Math.round(taskLeft-headLeft));
      head.className='section-header priority-header-v424';
      head.style.setProperty('--priority-color-v424',def.color);
      head.style.setProperty('--title-offset-v424',offset+'px');
      title.className='section-title priority-title-v424';
      title.innerHTML='<span class="priority-ring-v424" aria-hidden="true"></span><span class="priority-label-v424">'+def.label+'</span>';
      counter.className='counter priority-count-v424';
      counter.style.color=def.color;
    });
  }
  const rerun=()=>requestAnimationFrame(patch);
  new MutationObserver(rerun).observe(document.documentElement,{childList:true,subtree:true});
  const old=window.renderPriority;if(typeof old==='function')window.renderPriority=function(){const r=old.apply(this,arguments);setTimeout(patch,0);return r;};
  window.__modPriorityHeaderV424={version:'V424',patch};
  addEventListener('load',()=>setTimeout(patch,350));
  patch();
})();
