/* V505 · LAUFENDE AUFGABE OHNE SEKUNDEN-NEURENDER DER GESAMTEN ANSICHT
   - V489 aktualisiert pro Sekunde nur noch die tatsächlich laufende Karte.
   - Andere offene/erledigte Karten behalten ihre DOM-Instanz und Aktionsleiste.
   - Live-Zeitdetails bleiben erhalten, ohne die komplette Ansicht neu aufzubauen.
*/
(function(){
  'use strict';
  if(window.__modRunningTaskRenderStabilityV505)return;

  const BUILD_VERSION='V505';

  function verify(){
    const api=window.__modTaskTimeWeightDetailsV489;
    return !!(
      api&&
      api.periodicFullRenderRemovedV505===true&&
      api.runningCardOnlyRefreshV505===true&&
      typeof api.refreshRunningCards==='function'
    );
  }

  function refreshRunningCards(){
    const api=window.__modTaskTimeWeightDetailsV489;
    return typeof api?.refreshRunningCards==='function'?api.refreshRunningCards():0;
  }

  window.__modRunningTaskRenderStabilityV505={
    version:BUILD_VERSION,
    verify,
    refreshRunningCards,
    fullViewTickerRemoved:true,
    runningCardOnlyRefresh:true,
    unrelatedCardsKeepDom:true,
    terminalActionsStayStable:true,
    dataSemanticsUntouched:true
  };
})();

/* V510–V512 · SPORT MODE BOOTSTRAP
   V510 lädt die getrennte Sportoberfläche.
   V511 erhält das rote Recovery-R neben dem blauen S.
   V512 ergänzt vier vertikale Sporttabs mit sichtbarer Wechselanimation.
*/
(function(){
  'use strict';
  if(window.__modSportBootstrapV510)return;
  const VERSION='V512';
  const cssHref='./sport-mode-v510.css?v=512-0436';
  const jsSrc='./sport-mode-v510.js?v=512-0436';
  const compatSrc='./sport-header-compat-v511.js?v=512-0436';
  const tabsCssHref='./sport-tabs-v512.css?v=512-0436';
  const tabsJsSrc='./sport-tabs-v512.js?v=512-0436';
  const buildSrc='./build-version-v512.js?v=512-0436';

  function ensureCss(){
    if(!document.querySelector('link[data-sport-v510]')){
      const link=document.createElement('link');link.rel='stylesheet';link.href=cssHref;link.dataset.sportV510='true';document.head.appendChild(link);
    }
    if(!document.querySelector('link[data-sport-tabs-v512]')){
      const link=document.createElement('link');link.rel='stylesheet';link.href=tabsCssHref;link.dataset.sportTabsV512='true';document.head.appendChild(link);
    }
  }

  function ensureCompat(){
    if(window.__modSportHeaderCompatV511||document.querySelector('script[data-sport-compat-v511]'))return;
    const script=document.createElement('script');script.src=compatSrc;script.defer=true;script.dataset.sportCompatV511='true';document.head.appendChild(script);
  }

  function ensureTabs(){
    if(window.__modSportTabsV512||document.querySelector('script[data-sport-tabs-v512]'))return;
    const script=document.createElement('script');script.src=tabsJsSrc;script.defer=true;script.dataset.sportTabsV512='true';document.head.appendChild(script);
  }

  function ensureBuild(){
    if(window.__modBuildVersionV512||document.querySelector('script[data-build-v512]'))return;
    const script=document.createElement('script');script.src=buildSrc;script.defer=true;script.dataset.buildV512='true';document.head.appendChild(script);
  }

  function afterSportReady(){ensureCompat();ensureTabs();ensureBuild();}

  function ensureScript(){
    if(window.__modSportModeV510){afterSportReady();return;}
    const existing=document.querySelector('script[data-sport-v510]');
    if(existing){existing.addEventListener('load',afterSportReady,{once:true});return;}
    const script=document.createElement('script');script.src=jsSrc;script.defer=true;script.dataset.sportV510='true';script.addEventListener('load',afterSportReady,{once:true});document.head.appendChild(script);
  }

  ensureCss();
  ensureScript();
  ensureBuild();
  window.__modSportBootstrapV510={version:VERSION,ensureCss,ensureScript,ensureCompat,ensureTabs,ensureBuild,assetsSeparated:true,todoDataUntouched:true,recoveryRCompatibilityV511:true,animatedSportTabsV512:true};
})();

/* V515 · MODULAR APP HUB BOOTSTRAP
   Lädt den Startbildschirm getrennt von To-do und Sport.
*/
(function(){
  'use strict';
  if(window.__modAppHubBootstrapV515)return;
  const VERSION='V515';
  const cssHref='./app-hub-v515.css?v=515-0938';
  const jsSrc='./app-hub-v515.js?v=515-0938';
  const buildSrc='./build-version-v515.js?v=515-0938';

  function ensureCss(){
    if(document.querySelector('link[data-app-hub-v515]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';link.href=cssHref;link.dataset.appHubV515='true';
    document.head.appendChild(link);
  }

  function ensureBuild(){
    if(window.__modBuildVersionV515||document.querySelector('script[data-build-v515]'))return;
    const script=document.createElement('script');
    script.src=buildSrc;script.defer=true;script.dataset.buildV515='true';
    document.head.appendChild(script);
  }

  function ensureScript(){
    if(window.__modAppHubV515)return;
    if(document.querySelector('script[data-app-hub-v515]'))return;
    const script=document.createElement('script');
    script.src=jsSrc;script.defer=true;script.dataset.appHubV515='true';
    document.head.appendChild(script);
  }

  ensureCss();
  ensureScript();
  ensureBuild();
  window.__modAppHubBootstrapV515={version:VERSION,ensureCss,ensureScript,ensureBuild,modularLauncher:true,todoDataUntouched:true,sportDataUntouched:true,healthHookOnly:true};
})();

/* V516 · HUB ICON BUTTON BOOTSTRAP
   Macht die Icon-Kachel selbst zum Launcher und lädt die finalen Bereichs-Assets.
*/
(function(){
  'use strict';
  if(window.__modHubIconButtonsBootstrapV516)return;
  const VERSION='V516';
  const cssHref='./app-hub-icon-buttons-v516.css?v=516-1155';
  const jsSrc='./app-hub-icon-buttons-v516.js?v=516-1155';
  const buildSrc='./build-version-v516.js?v=516-1155';

  function ensureCss(){
    if(document.querySelector('link[data-hub-icon-buttons-v516]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';link.href=cssHref;link.dataset.hubIconButtonsV516='true';
    document.head.appendChild(link);
  }

  function ensureBuild(){
    if(window.__modBuildVersionV516||document.querySelector('script[data-build-v516]'))return;
    const script=document.createElement('script');
    script.src=buildSrc;script.defer=true;script.dataset.buildV516='true';
    document.head.appendChild(script);
  }

  function ensureScript(){
    if(window.__modHubIconButtonsV516)return;
    if(document.querySelector('script[data-hub-icon-buttons-v516]'))return;
    const script=document.createElement('script');
    script.src=jsSrc;script.defer=true;script.dataset.hubIconButtonsV516='true';
    document.head.appendChild(script);
  }

  ensureCss();
  ensureScript();
  ensureBuild();
  window.__modHubIconButtonsBootstrapV516={version:VERSION,ensureCss,ensureScript,ensureBuild,iconTileLauncher:true,exactIconAssetsDeferred:false,primaryAreaIconsBundled:true,todoDataUntouched:true,sportDataUntouched:true};
})();

/* V517 · HOMESCREEN LAUNCHER BOOTSTRAP
   Ersetzt die breiten Hub-Karten durch ein kompaktes 2x2-App-Raster.
*/
(function(){
  'use strict';
  if(window.__modHubLauncherBootstrapV517)return;
  const VERSION='V517';
  const cssHref='./app-hub-launcher-v517.css?v=517-1245';
  const jsSrc='./app-hub-launcher-v517.js?v=517-1245';
  const buildSrc='./build-version-v517.js?v=517-1245';

  function ensureCss(){
    if(document.querySelector('link[data-hub-launcher-v517]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';link.href=cssHref;link.dataset.hubLauncherV517='true';
    document.head.appendChild(link);
  }

  function ensureBuild(){
    if(window.__modBuildVersionV517||document.querySelector('script[data-build-v517]'))return;
    const script=document.createElement('script');
    script.src=buildSrc;script.defer=true;script.dataset.buildV517='true';
    document.head.appendChild(script);
  }

  function ensureScript(){
    if(window.__modHubLauncherV517)return;
    if(document.querySelector('script[data-hub-launcher-v517]'))return;
    const script=document.createElement('script');
    script.src=jsSrc;script.defer=true;script.dataset.hubLauncherV517='true';
    document.head.appendChild(script);
  }

  ensureCss();
  ensureScript();
  ensureBuild();
  window.__modHubLauncherBootstrapV517={version:VERSION,ensureCss,ensureScript,ensureBuild,homescreenStyle:true,compactGrid:true,foodPrepared:true,futureCategoryPrepared:true,todoDataUntouched:true,sportDataUntouched:true};
})();
