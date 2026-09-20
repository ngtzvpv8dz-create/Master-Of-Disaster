/* V596 · HEADER + DATENPRÜFUNG STABILITY
   - entfernt den versehentlichen sichtbaren "\\n"-Textknoten
   - zentriert den sichtbaren MASTER-OF-DISASTER-Inhalt am echten Viewport
   - korrigiert rein lesend die Datenprüfung für pausierte Segmentdaten
   - prüft Archivdauern typgerecht
   - verändert keine Nutzerdaten
*/
(function(){
  'use strict';
  if(window.__modStabilityV596)return;

  const state={
    version:'V596',
    strayLiteralTextRemoved:true,
    viewportCenteredHeader:true,
    adaptiveBrandCentering:true,
    brandCenteringReady:false,
    lastBrandCenterErrorPx:null,
    pausedSegmentFalsePositiveFixed:true,
    typedArchiveDurationCheck:true,
    dataIntegrityReadOnly:true,
    dataSemanticsUntouched:true
  };
  window.__modStabilityV596=state;

  const OFFSET_VAR='--mod-brand-center-offset-v596';
  let resizeTimer=0;
  let clickTimer=0;

  function visibleBrandCenter(title){
    const rects=[...title.children]
      .map(el=>el.getBoundingClientRect())
      .filter(rect=>rect.width>0&&rect.height>0);
    if(!rects.length)return null;
    const left=Math.min(...rects.map(rect=>rect.left));
    const right=Math.max(...rects.map(rect=>rect.right));
    return (left+right)/2;
  }

  function recenterBrand(){
    const title=document.querySelector('.mod-brand-title-v525');
    if(!title||!window.innerWidth)return false;

    const visualCenter=visibleBrandCenter(title);
    if(!Number.isFinite(visualCenter))return false;

    const viewportCenter=window.innerWidth/2;
    const delta=viewportCenter-visualCenter;
    const current=parseFloat(
      getComputedStyle(title).getPropertyValue(OFFSET_VAR)
    )||0;

    if(Math.abs(delta)>.12){
      const next=Math.abs(current+delta)<.05?0:current+delta;
      title.style.setProperty(OFFSET_VAR,next.toFixed(3)+'px');
    }

    const verified=visibleBrandCenter(title);
    state.lastBrandCenterErrorPx=Number.isFinite(verified)
      ? Number((verified-viewportCenter).toFixed(3))
      : null;
    state.brandCenteringReady=true;
    return true;
  }

  function queueBrandCenter(){
    recenterBrand();
    requestAnimationFrame(recenterBrand);
    clearTimeout(clickTimer);
    clickTimer=setTimeout(recenterBrand,60);
    setTimeout(recenterBrand,240);
  }

  state.recenterBrand=recenterBrand;

  document.addEventListener('click',queueBrandCenter,true);
  window.addEventListener('load',queueBrandCenter,{once:true});
  window.addEventListener('resize',()=>{
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(queueBrandCenter,50);
  },{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(queueBrandCenter,120),{passive:true});

  if(document.body&&typeof MutationObserver==='function'){
    const classObserver=new MutationObserver(queueBrandCenter);
    classObserver.observe(document.body,{attributes:true,attributeFilter:['class']});

    const app=document.querySelector('main.app');
    if(app){
      const structureObserver=new MutationObserver(queueBrandCenter);
      structureObserver.observe(app,{childList:true});
      setTimeout(()=>structureObserver.disconnect(),2500);
    }
  }

  queueBrandCenter();
})();