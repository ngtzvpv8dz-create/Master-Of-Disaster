/* V415 · INPUT PANEL NUR IM TAB ALLE */
(function(){
  const BUILD_VERSION="V415";
  function syncInputPanel(){
    const panel=document.getElementById("inputPanel");
    if(!panel)return;
    panel.style.display=(typeof currentTab!=="undefined"&&currentTab==="all")?"":"none";
  }
  const previousRender=typeof render==="function"?render:null;
  if(previousRender){render=function(){const result=previousRender.apply(this,arguments);syncInputPanel();return result;};}
  const previousSwitchTab=typeof switchTab==="function"?switchTab:null;
  if(previousSwitchTab){switchTab=function(tab){const result=previousSwitchTab.apply(this,arguments);syncInputPanel();return result;};}
  window.__modTabVisibilityV415={version:BUILD_VERSION,syncInputPanel};
  window.addEventListener("load",()=>setTimeout(syncInputPanel,100));
})();
