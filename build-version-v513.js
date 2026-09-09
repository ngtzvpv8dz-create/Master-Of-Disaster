/* V513 · CURRENT BUILD MARKER */
(function(){
  'use strict';
  if(window.__modBuildVersionV513)return;
  const meta={version:'V513',date:'09.09.2026',time:'05:24',build:'09.09.2026 · 05:24 Uhr'};
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
  window.__modBuildVersionV513={...meta,patch};
  window.addEventListener('load',()=>setTimeout(patch,520));
  window.addEventListener('focus',()=>setTimeout(patch,80));
  setTimeout(patch,0);
})();
