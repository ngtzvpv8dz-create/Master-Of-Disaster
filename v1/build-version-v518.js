/* V518 · CURRENT BUILD MARKER */
(function(){
  'use strict';
  if(window.__modBuildVersionV518)return;
  const meta={version:'V518',date:'09.09.2026',time:'19:20',build:'09.09.2026 · 19:20 Uhr'};
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
  if(typeof previous==='function'&&!previous.__modBuildV518){
    const wrapped=function(){const out=previous.apply(this,arguments);setTimeout(patch,0);return out;};
    wrapped.__modBuildV518=true;
    window.render=wrapped;
  }
  window.__modBuildVersionV518={...meta,patch};
  window.addEventListener('load',()=>setTimeout(patch,720));
  setTimeout(patch,0);
})();
