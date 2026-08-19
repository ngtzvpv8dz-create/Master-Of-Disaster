/* V401 visible build metadata, targeted only at the DEV build card. */
(function(){
  const VERSION="V401";
  const BUILD="19.08.2026 · 23:52 Uhr";
  const apply=()=>{
    const values=document.querySelectorAll('.dev-build-grid .dev-build-value');
    if(values[0] && values[0].textContent!==VERSION) values[0].textContent=VERSION;
    if(values[1] && values[1].textContent!==BUILD) values[1].textContent=BUILD;
  };
  new MutationObserver(apply).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  apply();
})();
