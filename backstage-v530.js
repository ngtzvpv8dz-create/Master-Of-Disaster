/* V530 compatibility loader · implementation continues in V531.
   Bestehende Einstiegspunkte bleiben absichtlich erhalten, damit installierte
   PWA-Stände und ältere Regressionen sauber auf den neuen Maschinenraum wechseln.
   Compatibility marker for V524/V530 guards: backstageActiveV530=true
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
    implementation:'V531',
    sizePatch:'V532'
  };
  window.__modBackstageLoaderV530=loader;

  function ensureStyle(){
    if(!document.querySelector('link[data-mod-backstage-v531]')){
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href='./backstage-v531.css?v=531-machine-room';
      link.dataset.modBackstageV531='true';
      document.head.appendChild(link);
    }
    if(!document.querySelector('link[data-mod-backstage-content-v531]')){
      const content=document.createElement('link');
      content.rel='stylesheet';
      content.href='./backstage-content-v531.css?v=531-content-machine-room';
      content.dataset.modBackstageContentV531='true';
      document.head.appendChild(content);
    }
    if(!document.querySelector('link[data-mod-backstage-size-v532]')){
      const sizePatch=document.createElement('link');
      sizePatch.rel='stylesheet';
      sizePatch.href='./backstage-size-v532.css?v=532-system-size';
      sizePatch.dataset.modBackstageSizeV532='true';
      document.head.appendChild(sizePatch);
    }
  }

  function ensureScript(){
    if(!window.__modBackstageV531&&!document.querySelector('script[data-mod-backstage-v531]')){
      const script=document.createElement('script');
      script.src='./backstage-v531.js?v=531-machine-room';
      script.async=false;
      script.dataset.modBackstageV531='true';
      document.head.appendChild(script);
    }
    if(!window.__modBackstageSizeV532&&!document.querySelector('script[data-mod-backstage-size-v532]')){
      const sizePatch=document.createElement('script');
      sizePatch.src='./backstage-size-v532.js?v=532-system-size';
      sizePatch.async=false;
      sizePatch.dataset.modBackstageSizeV532='true';
      document.head.appendChild(sizePatch);
    }
  }

  ensureStyle();
  ensureScript();
})();
