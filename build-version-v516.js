/* V516 · CURRENT BUILD MARKER */
(function(){
  'use strict';
  if(window.__modBuildVersionV516)return;
  const meta={version:'V516',date:'09.09.2026',time:'09:59',build:'09.09.2026 · 09:59 Uhr'};
  function patch(){
    window.__MOD_BUILD__=meta;
    window.__modDevVersion={...meta,patch};
    try{
      if(typeof currentTab!=='undefined'&&currentTab!=='dev')return;
      const vals=document.querySelectorAll('.dev-build-value');
      if(vals[0])vals[0].textContent=meta.version;
      if(vals[1])vals[1].textContent=meta.build;
    }catch(_){}
  }
  const previous=window.render;
  if(typeof previous==='function'&&!previous.__modBuildV516){
    const wrapped=function(){const out=previous.apply(this,arguments);setTimeout(patch,0);return out;};
    wrapped.__modBuildV516=true;
    window.render=wrapped;
  }
  window.__modBuildVersionV516={...meta,patch};
  window.addEventListener('load',()=>setTimeout(patch,720));
  setTimeout(patch,0);
})();
