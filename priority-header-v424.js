/* V425 · PRIORITY HEADERS MATCH OPTIONAL */
(function(){
  const defs={
    high:{label:'HOHE PRIORITÄT',color:'#d85b5b'},
    medium:{label:'MITTLERE PRIORITÄT',color:'#d3aa45'},
    normal:{label:'NORMALE PRIORITÄT',color:'#f3f3f3'},
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
      const kind=kindFrom(title.textContent);if(!kind)return;
      const def=defs[kind];
      head.className='section-header priority-header-v425';
      head.style.setProperty('--priority-color-v425',def.color);
      title.className='section-title priority-title-v425';
      title.innerHTML='<span class="priority-ring-v425" aria-hidden="true"></span><span class="priority-label-v425">'+def.label+'</span>';
      counter.className='counter priority-count-v425';
      counter.style.removeProperty('color');
    });
  }
  let queued=false;
  new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;patch();});}).observe(document.documentElement,{childList:true,subtree:true});
  const old=window.renderPriority;if(typeof old==='function')window.renderPriority=function(){const r=old.apply(this,arguments);setTimeout(patch,0);return r;};
  window.__modPriorityHeaderV424={version:'V425',patch};
  addEventListener('load',()=>setTimeout(patch,350));
  patch();
})();
