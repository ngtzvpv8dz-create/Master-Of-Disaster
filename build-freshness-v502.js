/* V502 · DYNAMISCHE BUILD-FRISCHE
   - DEV zeigt Version und Build-Zeit aus den automatisch erzeugten Repository-Metriken
   - statische alte Build-Angaben werden nur noch als Fallback benutzt
   - bei Fokus/DEV-Aufruf wird ohne Browsercache nach dem aktuellen Stand gefragt
*/
(function(){
  'use strict';
  if(window.__modBuildFreshnessV502)return;

  const BUILD_VERSION='V502';
  const METRICS_URL='./development-metrics.json';
  const FALLBACK={version:BUILD_VERSION,generatedAt:'28.08.2026 · 12:20'};
  let current={...FALLBACK};
  let loadPromise=null;
  let lastLoadAt=0;
  let observer=null;

  function versionNumber(value){
    const match=String(value||'').match(/^V(\d+)$/i);
    return match?Number(match[1]):0;
  }

  function loadedVersion(){
    let best=versionNumber(BUILD_VERSION);
    try{
      Object.keys(window).forEach(key=>{
        if(!/^__mod/i.test(key))return;
        const value=window[key];
        const n=versionNumber(value&&value.version);
        if(n>best)best=n;
      });
    }catch(_){}
    return `V${best}`;
  }

  function normalizeMeta(meta){
    const metricVersion=versionNumber(meta?.version)?String(meta.version).toUpperCase():null;
    const loaded=loadedVersion();
    const version=versionNumber(metricVersion)>=versionNumber(loaded)?metricVersion:loaded;
    const generatedAt=String(meta?.generatedAt||current.generatedAt||FALLBACK.generatedAt).trim();
    return {version,generatedAt,build:`${generatedAt} Uhr`};
  }

  function patchDevCard(){
    const card=document.querySelector('.dev-build-card');
    if(!card)return false;
    card.querySelectorAll('.dev-build-item').forEach(item=>{
      const label=String(item.querySelector('.dev-build-label')?.textContent||'').trim().toUpperCase();
      const value=item.querySelector('.dev-build-value');
      if(!value)return;
      if(label==='VERSION')value.textContent=current.version;
      if(label==='BUILD')value.textContent=current.build;
    });
    card.dataset.v502FreshBuild='true';
    return true;
  }

  function applyMeta(meta){
    current=normalizeMeta(meta);
    window.__MOD_BUILD__={version:current.version,date:current.generatedAt.split(' · ')[0]||'',time:current.generatedAt.split(' · ')[1]||'',build:current.build,dynamic:true,source:'development-metrics.json'};
    window.__modDevVersion={version:current.version,build:current.build,dynamic:true,source:'development-metrics.json',patch:patchDevCard};
    patchDevCard();
    try{window.__modDevelopmentStatsCurrentV476?.render?.();}catch(_){}
    return current;
  }

  async function load(force=false){
    const now=Date.now();
    if(!force&&now-lastLoadAt<15000)return current;
    if(loadPromise)return loadPromise;
    lastLoadAt=now;
    loadPromise=(async()=>{
      try{
        const response=await fetch(`${METRICS_URL}?v=${Date.now()}`,{cache:'no-store'});
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        const metrics=await response.json();
        applyMeta(metrics);
      }catch(error){
        console.warn('V502 Build-Frische:',error);
        applyMeta(current);
      }finally{loadPromise=null;}
      return current;
    })();
    return loadPromise;
  }

  function observe(){
    if(observer)return;
    const root=document.getElementById('viewContainer');
    if(!root)return;
    observer=new MutationObserver(()=>patchDevCard());
    observer.observe(root,{childList:true,subtree:true});
  }

  const previousRender=typeof window.render==='function'?window.render:null;
  if(previousRender){
    window.render=function(){
      const result=previousRender.apply(this,arguments);
      setTimeout(patchDevCard,0);
      return result;
    };
  }

  applyMeta(FALLBACK);
  observe();
  load(true);
  window.addEventListener('load',()=>setTimeout(()=>{observe();load(true);patchDevCard();},350));
  window.addEventListener('focus',()=>load(false));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')load(false);});
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-tab="dev"]'))setTimeout(()=>{load(true);patchDevCard();},100);},true);

  window.__modBuildFreshnessV502={version:BUILD_VERSION,load,patch:patchDevCard,get current(){return {...current};},dynamicFromMetrics:true,noStoreFetch:true};
})();
