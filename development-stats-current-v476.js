/* V476 · AKTUELLER APP-ENTWICKLUNGSSTAND
   - ersetzt den eingefrorenen V451-Repository-Snapshot in der Statistik durch automatisch erzeugte Build-Metriken
   - die fünf Entwicklungsblöcke werden optisch an die übrigen Statistikblöcke eingerückt
   - alte Git-/Projektstände bleiben weiterhin über die Repository-Historie rekonstruierbar
*/
(function(){
  'use strict';
  const BUILD_VERSION='V476';
  const METRICS_URL='./development-metrics.json';
  const PROJECT_START_ISO='2026-08-17T04:43:22+02:00';
  let metrics=null;
  let loadPromise=null;
  let patchTimer=null;

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function fmtInt(v){return new Intl.NumberFormat('de-DE').format(Number(v)||0);}
  function fmtBytes(v){const n=Number(v)||0;if(n>=1048576)return (n/1048576).toFixed(2).replace('.',',')+' MiB';if(n>=1024)return (n/1024).toFixed(1).replace('.',',')+' KiB';return fmtInt(n)+' B';}
  function currentVersion(){return window.__modDevVersion?.version||window.__MOD_BUILD__?.version||BUILD_VERSION;}
  function age(){const start=new Date(PROJECT_START_ISO),now=new Date();const ms=Math.max(0,now-start),days=Math.floor(ms/86400000),hours=Math.floor(ms%86400000/3600000),mins=Math.floor(ms%3600000/60000);return `${days} T ${hours} h ${mins} min`;}
  function card(label,value,sub=''){return `<div class="statistics-card"><div class="statistics-label">${esc(label)}</div><div class="statistics-value">${esc(value)}</div>${sub?`<div class="statistics-sub">${esc(sub)}</div>`:''}</div>`;}

  function ensureStyle(){
    if(document.getElementById('developmentStatsCurrentV476Style'))return;
    const style=document.createElement('style');style.id='developmentStatsCurrentV476Style';style.textContent=`
      #developmentStatsV451{--v476-dev-indent:0px}
      #developmentStatsV451>details.statistics-collapsible-v452.v476-development-block{margin-left:var(--v476-dev-indent)!important;width:calc(100% - var(--v476-dev-indent))!important}
      #developmentStatsV451 .v476-current-note{font-size:12px;line-height:1.48;opacity:.74;margin:8px 0 12px}
      #developmentStatsV451 .v476-metric-source{margin-top:10px;padding:9px 10px;border:1px solid rgba(255,255,255,.09);border-radius:10px;font-size:10px;line-height:1.45;opacity:.66;word-break:break-word}
      #developmentStatsV451 .v476-live-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px;background:#78b98b;vertical-align:1px}
    `;document.head.appendChild(style);
  }

  function directDevelopmentDetails(){
    const root=document.getElementById('developmentStatsV451');
    if(!root)return [];
    return [...root.children].filter(el=>el.matches?.('details.statistics-collapsible-v452'));
  }

  function alignDevelopmentBlocks(){
    const root=document.getElementById('developmentStatsV451');if(!root)return false;
    const dev=directDevelopmentDetails();if(!dev.length)return false;
    dev.forEach(d=>d.classList.add('v476-development-block'));
    const refs=[...document.querySelectorAll('#viewContainer details.statistics-collapsible-v452')].filter(d=>!root.contains(d)&&d.offsetParent!==null);
    if(!refs.length)return true;
    const lefts=refs.map(d=>d.getBoundingClientRect().left).filter(Number.isFinite).sort((a,b)=>a-b);
    const desired=lefts[Math.floor(lefts.length/2)];
    const current=dev[0].getBoundingClientRect().left;
    const delta=Math.max(0,Math.min(40,Math.round(desired-current)));
    root.style.setProperty('--v476-dev-indent',`${delta}px`);
    return true;
  }

  function appDevelopmentDetails(){
    return directDevelopmentDetails().find(d=>/APP-ENTWICKLUNG/i.test(d.querySelector(':scope>summary')?.textContent||''))||null;
  }

  function renderCurrentMetrics(){
    if(typeof currentTab!=='undefined'&&currentTab!=='statistics')return false;
    ensureStyle();alignDevelopmentBlocks();
    const details=appDevelopmentDetails();if(!details)return false;
    const summary=details.querySelector(':scope>summary');
    const group=details.querySelector(':scope>.statistics-group');
    if(!summary||!group)return false;
    const version=currentVersion();
    summary.textContent=`APP-ENTWICKLUNG · AKTUELL · ${version}`;
    const valid=metrics&&metrics.version===version&&metrics.repository;
    if(!valid){
      group.innerHTML=`<div class="v476-current-note"><span class="v476-live-dot"></span><strong>AKTUELLER STAND · ${esc(version)}</strong><br>Die automatisch erzeugten Repository-Metriken werden gerade geladen. Der angezeigte Build selbst ist bereits aktuell.</div>`;
      return false;
    }
    const r=metrics.repository;
    group.innerHTML=`
      <div class="v476-current-note"><span class="v476-live-dot"></span><strong>AUTOMATISCHER IST-STAND · ${esc(metrics.version)}</strong><br>Erzeugt ${esc(metrics.generatedAt||'—')} aus dem GitHub-Repository dieses Builds. Keine eingefrorenen V451-Zahlen mehr.</div>
      <div class="statistics-grid">
        ${card('APP-BUILD',metrics.version,'aktuell veröffentlichte Version')}
        ${card('PROJEKTALTER',age(),'seit Repository-Erstellung')}
        ${card('COMMITS',fmtInt(r.reachableCommits),'erreichbare Main-Historie inkl. Metrics-Snapshot')}
        ${card('PULL REQUESTS',fmtInt(r.pullRequests),`${fmtInt(r.mergedPullRequests)} gemergt`)}
        ${card('DATEIEN AKTUELL',fmtInt(r.currentFiles),`${fmtInt(r.rootFiles)} Root · ${fmtInt(r.workflowFiles)} Workflows`)}
        ${card('JAVASCRIPT',fmtInt(r.javascriptFiles),'aktuelle .js/.mjs/.cjs-Dateien')}
        ${card('CSS',fmtInt(r.cssFiles),'Stylesheets')}
        ${card('TEXTZEILEN AKTUELL',fmtInt(r.currentTextLines),'aktuelle Textdateien im Repository')}
        ${card('DATEIUMFANG AKTUELL',fmtBytes(r.currentBytes),'ohne automatisch erzeugte Metrics-Datei')}
        ${card('TEXTUMFANG',fmtBytes(r.currentTextBytes),'Text-, Code- und Konfigurationsdateien')}
        ${card('BILDER',fmtBytes(r.imageBytes),'PNG/JPG/JPEG/WEBP/GIF')}
        ${card('SONSTIG BINÄR',fmtBytes(r.otherBinaryBytes),'übrige Binärdateien')}
      </div>
      <div class="v476-metric-source">Quelle: GitHub Actions · Source-Commit ${esc(String(metrics.sourceCommit||'—').slice(0,12))} · Schema ${esc(metrics.schemaVersion||1)}. Historische App-Stände werden nicht doppelt in der App gespeichert; sie bleiben über die Git-Historie rekonstruierbar.</div>`;
    return true;
  }

  async function loadMetrics(force=false){
    const version=currentVersion();
    if(!force&&metrics?.version===version)return metrics;
    if(loadPromise&&!force)return loadPromise;
    loadPromise=(async()=>{
      try{
        const res=await fetch(`${METRICS_URL}?build=${encodeURIComponent(version)}&t=${Date.now()}`,{cache:'no-store'});
        if(!res.ok)throw new Error(`HTTP ${res.status}`);
        metrics=await res.json();
      }catch(e){console.warn('V476 development metrics:',e);}
      finally{loadPromise=null;}
      renderCurrentMetrics();
      return metrics;
    })();
    return loadPromise;
  }

  function schedulePatch(){
    clearTimeout(patchTimer);
    patchTimer=setTimeout(()=>{renderCurrentMetrics();loadMetrics(false);setTimeout(()=>{alignDevelopmentBlocks();renderCurrentMetrics();},120);},30);
  }

  const previous=typeof window.renderStatistics==='function'?window.renderStatistics:null;
  if(previous){window.renderStatistics=function(container){const result=previous.apply(this,arguments);schedulePatch();return result;};}
  window.addEventListener('resize',()=>setTimeout(alignDevelopmentBlocks,40));
  window.addEventListener('load',()=>setTimeout(schedulePatch,550));
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-tab="statistics"]'))setTimeout(schedulePatch,120);},true);

  window.__modDevelopmentStatsCurrentV476={
    version:BUILD_VERSION,
    metricsUrl:METRICS_URL,
    autoGenerated:true,
    historicalFromGit:true,
    dynamicIndent:true,
    render:renderCurrentMetrics,
    load:loadMetrics,
    align:alignDevelopmentBlocks,
    get metrics(){return metrics;}
  };
  if(typeof currentTab!=='undefined'&&currentTab==='statistics')schedulePatch();
})();