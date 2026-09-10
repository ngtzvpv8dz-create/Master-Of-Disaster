/* V530 compatibility loader · implementation continues in V531.
   Bestehende Einstiegspunkte bleiben absichtlich erhalten, damit installierte
   PWA-Stände und ältere Regressionen sauber auf den neuen Maschinenraum wechseln.
*/
(function(){
  'use strict';
  const VERSION='V530';
  if(window.__modBackstageLoaderV530)return;

  const loader={
    version:VERSION,
    devAndLogMoved:true,
    existingRenderersReused:true,
    todoDataUntouched:true,
    sportHealthHookPreserved:true,
    homeNavigationPreserved:true,
    implementation:'V531'
  };
  window.__modBackstageLoaderV530=loader;

  function ensureStyle(){
    if(document.querySelector('link[data-mod-backstage-v531]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='./backstage-v531.css?v=531-machine-room';
    link.dataset.modBackstageV531='true';
    document.head.appendChild(link);
  }

  function ensureScript(){
    if(window.__modBackstageV531)return;
    if(document.querySelector('script[data-mod-backstage-v531]'))return;
    const script=document.createElement('script');
    script.src='./backstage-v531.js?v=531-machine-room';
    script.async=false;
    script.dataset.modBackstageV531='true';
    document.head.appendChild(script);
  }

  ensureStyle();
  ensureScript();
})();
