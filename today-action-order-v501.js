/* V501 · EINHEITLICHE AKTIONSREIHENFOLGE + HEUTE-PUNKT */
(function(){
  'use strict';
  const BUILD_VERSION='V501';
  let observer=null,queued=false;

  function label(btn){return `${btn?.getAttribute('title')||''} ${btn?.getAttribute('aria-label')||''} ${btn?.textContent||''}`.toLowerCase().replace(/\s+/g,' ').trim();}
  function call(btn){return String(btn?.getAttribute('onclick')||'');}
  function rank(btn,index){
    const c=call(btn),l=label(btn),cl=btn.classList;
    if(cl.contains('v491-order-up'))return 0;
    if(cl.contains('v491-order-down'))return 10;
    if(/completeSelfrunner\(|startTask\(|resumeTask\(|pauseTask\(/.test(c)||/selbstläufer auslösen|\bstart\b|\bweiter\b|fortsetzen|dingsi-pause|\bpause\b/.test(l))return 20;
    if(/complete|finish|done/i.test(c)||/erledigt|abschließen|abschliessen|fertig|beenden/.test(l))return 30;
    if(/askManualTimes\(/.test(c)||btn.dataset.iconV416==='clock'||/zeit bearbeiten|zeiten bearbeiten|uhrzeit|startzeit|endzeit/.test(l))return 40;
    if(/toggleToday\(/.test(c)||btn.dataset.v480TodayAction==='1'||cl.contains('today-button')||cl.contains('v491-today-action')||/heute-zuweisung|heute zuweisen|aus heute|für heute/.test(l))return 50;
    if(/edit/i.test(c)||btn.dataset.iconV416==='edit'||/bearbeiten|editieren/.test(l))return 60;
    if(/abort|cancel/i.test(c)||cl.contains('abort-button')||/abbrechen|abbruch/.test(l))return 70;
    if(/delete|removeTask/i.test(c)||btn.dataset.iconV416==='trash'||/löschen|loeschen/.test(l))return 80;
    return 1000+index;
  }

  function isToday(btn){
    const c=call(btn),l=label(btn),cl=btn.classList;
    return /toggleToday\(/.test(c)||btn.dataset.v480TodayAction==='1'||cl.contains('today-button')||cl.contains('v491-today-action')||/heute-zuweisung|heute zuweisen|aus heute|für heute/.test(l);
  }

  function orderActions(actions){
    if(!actions)return false;
    const buttons=[...actions.children].filter(el=>el instanceof HTMLButtonElement);
    const desired=buttons.map((button,index)=>({button,index,rank:rank(button,index)})).sort((a,b)=>a.rank-b.rank||a.index-b.index).map(x=>x.button);
    const changed=desired.some((button,index)=>buttons[index]!==button);
    if(changed)desired.forEach(button=>actions.appendChild(button));
    desired.forEach((button,index)=>{
      button.dataset.v501ActionOrder=String(rank(button,index));
      if(isToday(button))button.classList.add('v501-today-action');
    });
    actions.dataset.v501Ordered='true';
    return changed;
  }

  function injectStyle(){
    if(document.getElementById('todayActionOrderV501Style'))return;
    const style=document.createElement('style');
    style.id='todayActionOrderV501Style';
    style.textContent=`
      #viewContainer .icon-actions .v501-today-action{position:relative!important;inset:auto!important;transform:none!important}
      #viewContainer .icon-actions .v501-today-action.today-selected-v480::after{content:''!important;position:absolute!important;top:3px!important;right:3px!important;bottom:auto!important;left:auto!important;width:5px!important;height:5px!important;border-radius:50%!important;background:currentColor!important;box-shadow:0 0 0 1px rgba(0,0,0,.55)!important;pointer-events:none!important}
    `;
    document.head.appendChild(style);
  }

  function enhanceAll(){
    queued=false;injectStyle();
    document.querySelectorAll('#viewContainer .task:not(.archive-task) .icon-actions').forEach(orderActions);
    return true;
  }
  function queue(){if(queued)return;queued=true;requestAnimationFrame(enhanceAll);}
  function observe(){if(observer)return;const root=document.getElementById('viewContainer');if(!root)return;observer=new MutationObserver(queue);observer.observe(root,{childList:true,subtree:true});}

  const previousRender=typeof window.render==='function'?window.render:null;
  if(previousRender){window.render=function(){const result=previousRender.apply(this,arguments);enhanceAll();setTimeout(enhanceAll,0);return result;};}
  injectStyle();observe();setTimeout(enhanceAll,0);
  window.addEventListener('load',()=>setTimeout(()=>{observe();enhanceAll();},0));
  window.addEventListener('focus',()=>setTimeout(enhanceAll,50));
  window.__modTodayActionOrderV501={version:BUILD_VERSION,enhanceAll,orderActions,todayMarkerBoundToButton:true,semanticOrder:['up','down','run','complete','time','today','edit','abort','delete'],dataSemanticsUntouched:true};
})();
