/* V519 · CURRENT BUILD MARKER */
(function(){
  'use strict';
  if(window.__modBuildVersionV519)return;
  const meta={version:'V519',date:'09.09.2026',time:'22:29',build:'09.09.2026 · 22:29 Uhr'};
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
  if(typeof previous==='function'&&!previous.__modBuildV519){
    const wrapped=function(){const out=previous.apply(this,arguments);setTimeout(patch,0);return out;};
    wrapped.__modBuildV519=true;
    window.render=wrapped;
  }
  window.__modBuildVersionV519={...meta,patch};
  window.addEventListener('load',()=>setTimeout(patch,720));
  setTimeout(patch,0);
})();
