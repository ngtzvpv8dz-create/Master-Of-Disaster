/* V465 · THEME STATE SYNC
   Synchronisiert V464-Zustandsregler sofort mit allen Zustandswechseln,
   auch wenn sie programmgesteuert statt per sichtbarem Button erfolgen.
*/
(function(){
  'use strict';
  const BUILD_VERSION='V465';
  let wrapped=false;
  function patch(){try{window.__modThemeStateDesignV464?.patch?.();}catch(e){console.warn('V465 state sync patch:',e);}}
  function wrap(){
    if(wrapped)return true;
    const api=window.__modUxCookingEditorV460;
    if(!api||typeof api.setState!=='function')return false;
    const base=api.setState.bind(api);
    api.setState=function(state){const out=base(state);setTimeout(patch,35);setTimeout(patch,90);return out;};
    wrapped=true;return true;
  }
  function ensure(){if(!wrap())setTimeout(ensure,60);else patch();}
  document.addEventListener('click',e=>{if(e.target?.closest?.('[data-sticky-state-v460],[data-position-state-v460]'))setTimeout(patch,45);},true);
  window.addEventListener('load',()=>setTimeout(ensure,0));
  ensure();
  window.__modThemeStateSyncV465={version:BUILD_VERSION,wrap,patch,get wrapped(){return wrapped;}};
})();
