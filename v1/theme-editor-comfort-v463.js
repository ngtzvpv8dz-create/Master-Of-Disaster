/* V463 · THEME-EDITOR KOMFORT
   - feste V460-Vorschau 50 px ueber dem unteren Bildschirmrand
   - Theme-Editor behaelt beim Wechsel des bearbeiteten Elements die Scrollposition
*/
(function(){
  'use strict';
  const BUILD_VERSION='V463';
  const BOTTOM_OFFSET_PX=50;
  let lastThemeScrollY=0;
  let restoring=false;
  let restoreTimer=null;

  function inTheme(){return typeof currentTab!=='undefined'&&currentTab==='theme';}
  function currentScrollY(){return Math.max(0,Number(window.scrollY||document.documentElement?.scrollTop||0));}

  function injectStyle(){
    if(document.getElementById('themeEditorComfortV463Style'))return;
    const style=document.createElement('style');
    style.id='themeEditorComfortV463Style';
    style.textContent=`
      #themeStickyPreviewV460{
        bottom:${BOTTOM_OFFSET_PX}px!important;
        padding-bottom:8px!important;
      }
      body.theme-sticky-v460{padding-bottom:350px!important}
      body.theme-sticky-v460.theme-sticky-collapsed-v460{padding-bottom:162px!important}
      @media(max-width:430px){
        body.theme-sticky-v460{padding-bottom:325px!important}
        body.theme-sticky-v460.theme-sticky-collapsed-v460{padding-bottom:162px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function rememberScroll(){
    if(!inTheme()||restoring)return lastThemeScrollY;
    lastThemeScrollY=currentScrollY();
    return lastThemeScrollY;
  }

  function restoreScroll(y=lastThemeScrollY){
    if(!inTheme())return false;
    const target=Math.max(0,Number(y)||0);
    restoring=true;
    try{window.scrollTo({top:target,left:0,behavior:'auto'});}catch(_){window.scrollTo(0,target);}
    setTimeout(()=>{restoring=false;},0);
    return true;
  }

  function scheduleRestore(y){
    clearTimeout(restoreTimer);
    const target=Math.max(0,Number(y)||0);
    // V458 rendert den Editor sofort neu; V461 kann kurz danach einen kontrollierten
    // Folge-Render ausloesen. Deshalb stellen wir nach beiden Phasen wieder her.
    requestAnimationFrame(()=>restoreScroll(target));
    setTimeout(()=>restoreScroll(target),42);
    restoreTimer=setTimeout(()=>restoreScroll(target),96);
  }

  function isRoleSwitchTarget(target){
    if(!target?.closest)return false;
    return !!target.closest(
      '[data-theme-role-select],'+
      '#themeStickyPreviewV460 [data-theme-role],'+
      '.theme-preview-v458 [data-theme-role]'
    );
  }

  window.addEventListener('scroll',()=>{if(inTheme()&&!restoring)lastThemeScrollY=currentScrollY();},{passive:true});

  // Pointerdown merkt die Position noch bevor V458 bei einem Rollenwechsel den
  // kompletten Editorbereich ersetzt.
  document.addEventListener('pointerdown',event=>{
    if(inTheme()&&isRoleSwitchTarget(event.target))rememberScroll();
  },true);

  document.addEventListener('click',event=>{
    if(!inTheme()||!isRoleSwitchTarget(event.target))return;
    const y=lastThemeScrollY||currentScrollY();
    scheduleRestore(y);
  },true);

  // Bei direktem Tippen in der festen Vorschau wird der Rollen-Button teilweise
  // programmatisch geklickt. Auch diesen Pfad sichern wir nach dem Bubbling ab.
  document.addEventListener('click',event=>{
    if(!inTheme()||!event.target?.closest?.('#themeStickyPreviewV460 [data-theme-role]'))return;
    scheduleRestore(lastThemeScrollY||currentScrollY());
  });

  window.addEventListener('load',()=>{
    injectStyle();
    if(inTheme())lastThemeScrollY=currentScrollY();
  });
  injectStyle();

  window.__modThemeEditorComfortV463={
    version:BUILD_VERSION,
    bottomOffsetPx:BOTTOM_OFFSET_PX,
    scrollRetention:true,
    rememberScroll,
    restoreScroll,
    get lastScrollY(){return lastThemeScrollY;}
  };
})();
