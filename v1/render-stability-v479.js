/* V479 · SYNCHRONOUS RENDER STABILITY
   Verhindert den sichtbaren Legacy-Zwischenframe beim HEUTE-Umschalten.
   Die V418 Icon-/Flag-Normalisierung läuft direkt im selben render()-Durchlauf,
   bevor der Browser den neu aufgebauten Task-DOM zeichnen kann.
*/
(function(){
  'use strict';

  const BUILD_VERSION='V479';
  const LEGACY_FLAG=/[⚪🟡🔴🟣⚠️🔷💠]/;
  const LEGACY_ACTION=/[▶▷►⏵📅🗓✅✔✓✏🖉❌✕✖🗑☕]/;
  let wrapped=false;
  let stabilizing=false;

  function taskCards(){
    const root=document.getElementById('viewContainer');
    return root?[...root.querySelectorAll('.task:not(.archive-task)')]:[];
  }

  function legacyVisible(){
    return taskCards().some(card=>{
      const oldFlag=[...card.querySelectorAll('.mini-flag')].some(el=>{
        const text=(el.textContent||'').trim();
        return LEGACY_FLAG.test(text)&&el.style.display!=='none';
      });
      const oldStatus=LEGACY_ACTION.test((card.querySelector('.status-symbol')?.textContent||'').trim());
      const oldAction=[...card.querySelectorAll('.icon-actions button')].some(btn=>{
        const text=(btn.textContent||'').trim();
        return LEGACY_ACTION.test(text)&&!btn.querySelector('.action-svg-v416');
      });
      return oldFlag||oldStatus||oldAction;
    });
  }

  function stabilize(){
    if(stabilizing)return !legacyVisible();
    stabilizing=true;
    try{
      window.__modActionIconsV416?.patch?.();
      window.__modThemeStateDesignV464?.apply?.();
      return !legacyVisible();
    }catch(error){
      console.warn('V479 render stability:',error);
      return false;
    }finally{
      stabilizing=false;
    }
  }

  function wrapRender(){
    if(wrapped||typeof window.render!=='function')return wrapped;
    const base=window.render;
    window.render=function(){
      const result=base.apply(this,arguments);
      stabilize();
      return result;
    };
    wrapped=true;
    return true;
  }

  function ensure(){
    if(!wrapRender())setTimeout(ensure,50);
    else stabilize();
  }

  ensure();
  window.addEventListener('load',()=>setTimeout(stabilize,0));

  window.__modRenderStabilityV479={
    version:BUILD_VERSION,
    stabilize,
    legacyVisible,
    wrapRender,
    synchronousPostRender:true,
    noLegacyPaint:true,
    get wrapped(){return wrapped;}
  };
})();
