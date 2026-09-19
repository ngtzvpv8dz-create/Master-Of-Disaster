/* V511 · SPORT HEADER COMPATIBILITY
   - Erhält das blaue S aus V510 und stellt das rote letzte R aus V498 wieder her.
   - Das rote R öffnet weiterhin Verlauf / Wiederherstellung aus V498.
   - Keine Aufgaben-, Archiv- oder Sportdaten werden verändert.
*/
(function(){
  'use strict';
  if(window.__modSportHeaderCompatV511)return;

  const VERSION='V511';
  const SPORT_SWITCH_ID='sportSwitchV510';
  const RECOVERY_CLASS='mod-undo-r-v498';
  let observer=null;
  let timer=null;

  function recoveryApi(){
    const api=window.__modRecoveryHistoryV498;
    return api&&typeof api.openQuickHistory==='function'?api:null;
  }

  function findTerminalTextR(h1){
    const walker=document.createTreeWalker(h1,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    for(let i=nodes.length-1;i>=0;i--){
      const node=nodes[i],value=String(node.nodeValue||'');
      const match=value.match(/R(\s*)$/);
      if(match)return {node,value,spaces:match[1]||''};
    }
    return null;
  }

  function ensureRecoveryR(){
    const h1=document.querySelector('.header h1');
    const api=recoveryApi();
    if(!h1||!api)return false;

    const existing=h1.querySelector('.'+RECOVERY_CLASS);
    if(existing){
      if(existing.onclick!==api.openQuickHistory)existing.onclick=api.openQuickHistory;
      return !!h1.querySelector('#'+SPORT_SWITCH_ID);
    }

    const hit=findTerminalTextR(h1);
    if(!hit)return false;
    hit.node.nodeValue=hit.value.slice(0,hit.value.length-hit.spaces.length-1)+hit.spaces;

    const button=document.createElement('button');
    button.type='button';
    button.className=RECOVERY_CLASS;
    button.textContent='R';
    button.title='Rückgängig / Wiederherstellung';
    button.setAttribute('aria-label','Rückgängig und Wiederherstellung öffnen');
    button.onclick=api.openQuickHistory;
    h1.appendChild(button);
    return !!h1.querySelector('#'+SPORT_SWITCH_ID);
  }

  function verify(){
    const h1=document.querySelector('.header h1');
    return !!(
      h1&&
      h1.querySelector('#'+SPORT_SWITCH_ID)&&
      h1.querySelector('.'+RECOVERY_CLASS)&&
      recoveryApi()
    );
  }

  function install(){
    ensureRecoveryR();
    const h1=document.querySelector('.header h1');
    if(h1&&!observer){
      observer=new MutationObserver(()=>ensureRecoveryR());
      observer.observe(h1,{childList:true,subtree:true,characterData:true});
    }
    return verify();
  }

  function start(){
    let tries=0;
    clearInterval(timer);
    timer=setInterval(()=>{
      tries++;
      const sportReady=!!window.__modSportModeV510&&!!document.getElementById(SPORT_SWITCH_ID);
      const recoveryReady=!!recoveryApi();
      if(sportReady&&recoveryReady){
        install();
        clearInterval(timer);timer=null;
      }else if(tries>240){
        clearInterval(timer);timer=null;
        console.warn('V511: Header-Kompatibilität konnte nicht rechtzeitig initialisiert werden.');
      }
    },100);
  }

  window.addEventListener('load',()=>setTimeout(()=>{install();start();},120));
  window.addEventListener('focus',()=>setTimeout(install,80));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(install,80);});
  start();

  window.__modSportHeaderCompatV511={
    version:VERSION,
    install,
    verify,
    sportSwitchPreserved:true,
    recoveryRPreserved:true,
    recoveryOpensV498:true,
    dataSemanticsUntouched:true
  };
})();
