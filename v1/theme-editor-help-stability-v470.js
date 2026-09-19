/* V470 · THEME HELP STABILITY
   Keeps V469 help attached when the fixed sticky preview rebuilds outside viewContainer.
*/
(function(){
  'use strict';
  const BUILD_VERSION='V470';
  let busy=false,timer=null,observer=null;

  function inTheme(){return typeof currentTab!=='undefined'&&currentTab==='theme';}
  function sticky(){return document.getElementById('themeStickyPreviewV460');}
  function stateHelpMissing(){const root=sticky();if(!root)return false;const buttons=[...root.querySelectorAll('[data-sticky-state-v460]')];return buttons.length>0&&buttons.some(b=>!b.parentElement?.querySelector('.theme-info-v469'));}

  function openToggleHelp(){
    document.getElementById('themeInfoBackdropV468')?.remove();
    const back=document.createElement('div');back.id='themeInfoBackdropV468';back.className='theme-info-backdrop-v468';
    back.innerHTML=`<div class="theme-info-card-v468" role="dialog" aria-modal="true"><div class="theme-info-head-v468"><div class="theme-info-title-v468">ⓘ Live-Vorschau ein-/ausklappen</div><button type="button" class="theme-info-close-v468">×</button></div><div class="theme-info-text-v468">Blendet nur die feste Aufgabenkarte unten ein oder aus. Deine Theme-Einstellungen und der ausgewählte Aufgabenzustand bleiben dabei erhalten.</div><div class="theme-info-where-v468"><strong>Wo sehe ich das?</strong><br>Ganz rechts in der festen Live-Vorschau am unteren Bildschirmrand.</div><div class="theme-mini-v468"><div class="theme-mini-top-v468">THEME EDITOR</div><div class="theme-mini-panel-v468"><div class="theme-mini-card-v468"><div class="theme-mini-title-v468">Einstellungen</div></div></div><div style="margin-top:7px;padding:7px;border:2px solid #ffd166;border-radius:8px;text-align:center;font-size:7px;font-weight:900">FESTE LIVE-VORSCHAU · ▼ / ▲</div></div></div>`;
    document.body.appendChild(back);const close=()=>back.remove();back.querySelector('.theme-info-close-v468')?.addEventListener('click',close);back.addEventListener('click',e=>{if(e.target===back)close();});
  }

  function addToggleHelp(){
    const root=sticky(),toggle=root?.querySelector('.theme-sticky-toggle-v460');if(!toggle)return false;
    if(toggle.parentElement?.querySelector('.theme-info-v470-toggle'))return true;
    const b=document.createElement('button');b.type='button';b.className='theme-info-v468 theme-info-v470-toggle';b.textContent='i';b.title='Info: Live-Vorschau ein-/ausklappen';b.setAttribute('aria-label','Info zur Live-Vorschau');
    b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openToggleHelp();});toggle.after(b);return true;
  }

  function ensure(){
    if(!inTheme()||busy)return false;busy=true;
    try{window.__modThemeEditorHelpV469?.patch?.();addToggleHelp();return true;}finally{setTimeout(()=>{busy=false;},0);}
  }
  function schedule(delay=25){clearTimeout(timer);timer=setTimeout(()=>{if(inTheme()&&(stateHelpMissing()||!sticky()?.querySelector('.theme-info-v470-toggle')))ensure();},delay);}

  function wrapState(){const api=window.__modUxCookingEditorV460;if(!api||api.__v470HelpWrapped||typeof api.setState!=='function')return false;const base=api.setState.bind(api);api.setState=function(s){const out=base(s);setTimeout(ensure,20);setTimeout(ensure,90);return out;};api.__v470HelpWrapped=true;return true;}
  function keepWrapping(){if(!wrapState())setTimeout(keepWrapping,80);}

  const baseSwitch=window.switchTab;if(typeof baseSwitch==='function')window.switchTab=function(){const out=baseSwitch.apply(this,arguments);setTimeout(ensure,60);setTimeout(ensure,180);return out;};
  function observe(){observer?.disconnect();observer=new MutationObserver(muts=>{if(!inTheme()||busy)return;for(const m of muts){const target=m.target?.nodeType===1?m.target:m.target?.parentElement;if(target?.closest?.('#themeStickyPreviewV460')||[...m.addedNodes].some(n=>n.nodeType===1&&(n.id==='themeStickyPreviewV460'||n.querySelector?.('#themeStickyPreviewV460')))){schedule();break;}}});observer.observe(document.body,{childList:true,subtree:true});}

  window.addEventListener('load',()=>{keepWrapping();observe();setTimeout(ensure,150);});keepWrapping();observe();setTimeout(ensure,0);
  window.__modThemeEditorHelpStabilityV470={version:BUILD_VERSION,ensure,stateHelpMissing,stickyHelpStable:true,toggleHelp:true};
})();
