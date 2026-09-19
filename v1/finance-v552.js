/* V552 · FINANZEN
   Erste eigenständige Finanzoberfläche im Börsenterminal-Look.
   Noch ohne persistente Buchungsdaten: keine erfundenen Werte, klare Leerzustände.
*/
(function(){
  'use strict';
  if(window.__modFinanceV552)return;

  const VERSION='V552';
  const ROOT_ID='modFinanceV552';
  const BODY_CLASS='mod-finance-v552';
  const SURFACE_CLASS='mod-finance-surface-v552';

  function ensureRoot(){
    let root=document.getElementById(ROOT_ID);
    if(root)return root;
    const app=document.querySelector('main.app');
    if(!app)return null;
    root=document.createElement('section');
    root.id=ROOT_ID;
    root.className='mod-finance-root-v552';
    root.setAttribute('aria-label','Finanzen');
    root.setAttribute('aria-hidden','true');
    app.appendChild(root);
    return root;
  }

  function todayLabel(){
    try{return new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Berlin'}).format(new Date()).toUpperCase();}
    catch(_){return 'AKTUELL';}
  }

  function shell(){
    return `
      <div class="finance-terminal-v552">
        <div class="finance-topline-v552" aria-hidden="true">
          <span>MOD FINANCE</span><span class="finance-live-v552"><i></i> BEREIT</span><span>${todayLabel()}</span>
        </div>

        <header class="finance-hero-v552">
          <div>
            <span class="finance-kicker-v552">FINANZZENTRALE</span>
            <h2>MONEY DESK</h2>
            <p>Ausgaben, Einnahmen und Monatsverlauf auf einen Blick.</p>
          </div>
          <div class="finance-status-v552">
            <span>DATENQUELLE</span>
            <strong>NOCH NICHT VERBUNDEN</strong>
          </div>
        </header>

        <div class="finance-ticker-v552" aria-label="Finanzkennzahlen">
          <div><span>MONAT</span><strong>—</strong></div>
          <div><span>EINNAHMEN</span><strong class="is-positive">—</strong></div>
          <div><span>AUSGABEN</span><strong class="is-negative">—</strong></div>
          <div><span>CASHFLOW</span><strong>—</strong></div>
          <div><span>FREI</span><strong>—</strong></div>
        </div>

        <div class="finance-grid-v552">
          <section class="finance-panel-v552 finance-chart-panel-v552">
            <div class="finance-panel-head-v552"><div><span>01 · CASHFLOW</span><h3>Monatsverlauf</h3></div><small>LIVE VIEW</small></div>
            <div class="finance-chart-v552" aria-label="Noch keine Cashflow-Daten">
              <div class="finance-axis-v552"><span>0</span><span>15</span><span>30</span></div>
              <div class="finance-chart-empty-v552"><strong>NO DATA</strong><span>Mit den ersten Buchungen entsteht hier dein Verlauf.</span></div>
            </div>
          </section>

          <section class="finance-panel-v552 finance-score-panel-v552">
            <div class="finance-panel-head-v552"><div><span>02 · STATUS</span><h3>Monat</h3></div><small>EUR</small></div>
            <div class="finance-score-v552"><strong>—</strong><span>Saldo</span></div>
            <div class="finance-mini-stats-v552"><div><span>Fixkosten</span><b>—</b></div><div><span>Variabel</span><b>—</b></div><div><span>Übrig</span><b>—</b></div></div>
          </section>

          <section class="finance-panel-v552 finance-list-panel-v552">
            <div class="finance-panel-head-v552"><div><span>03 · BUCHUNGEN</span><h3>Letzte Bewegungen</h3></div><small>RECENT</small></div>
            <div class="finance-empty-row-v552"><span>Keine Buchungen vorhanden.</span><small>Erfasste Kassenzettel und Ausgaben werden später hier einsortiert.</small></div>
          </section>

          <section class="finance-panel-v552 finance-list-panel-v552">
            <div class="finance-panel-head-v552"><div><span>04 · KATEGORIEN</span><h3>Ausgabenstruktur</h3></div><small>SPLIT</small></div>
            <div class="finance-empty-row-v552"><span>Noch keine Kategorien auswertbar.</span><small>Sobald echte Daten vorhanden sind, zeigt dieser Bereich die Verteilung deiner Ausgaben.</small></div>
          </section>
        </div>

        <footer class="finance-footer-v552">
          <span><i></i> Oberfläche bereit</span>
          <span>Datenanbindung folgt als eigener Schritt</span>
        </footer>
      </div>`;
  }

  function render(){
    const root=ensureRoot();
    if(!root)return false;
    root.innerHTML=shell();
    return true;
  }

  function setSurface(active){
    const html=document.documentElement;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(active){
      document.body.classList.add(BODY_CLASS);
      html.classList.add(SURFACE_CLASS);
      document.body.dataset.modAppSurfaceV515='finance';
      if(meta)meta.setAttribute('content','#050908');
    }else{
      document.body.classList.remove(BODY_CLASS);
      html.classList.remove(SURFACE_CLASS);
      if(document.body.dataset.modAppSurfaceV515==='finance')delete document.body.dataset.modAppSurfaceV515;
      if(meta)meta.setAttribute('content','#0b0d0f');
    }
  }

  function close(){
    setSurface(false);
    document.getElementById(ROOT_ID)?.setAttribute('aria-hidden','true');
    return true;
  }

  function open(){
    try{window.__modFoodV544?.close?.();}catch(_){}
    try{window.__modBackstageV531?.close?.({restoreTodo:false});}catch(_){}
    try{window.__modAppHubV515?.hide?.();}catch(_){}
    setSurface(true);
    const root=ensureRoot();
    root?.setAttribute('aria-hidden','false');
    render();
    try{window.scrollTo?.({top:0,left:0,behavior:'instant'});}catch(_){window.scrollTo?.(0,0);}
    return 'finance';
  }

  function patchHub(){
    const launcher=window.__modHubLauncherV517||window.__modHubLauncherV552;
    const item=launcher?.modules?.find?.(entry=>entry.id==='finance');
    if(item)item.active=true;
    document.querySelectorAll('[data-mod-hub-launch-v517="finance"],[data-mod-hub-open="finance"]').forEach(button=>{
      button.removeAttribute('aria-disabled');
      button.setAttribute('aria-label','Finanzen öffnen');
    });

    const hub=window.__modAppHubV515;
    if(hub&&!hub.__financePatchedV552){
      const originalShow=hub.show?.bind(hub);
      const originalOpen=hub.open?.bind(hub);
      hub.show=function(){close();return originalShow?.(...arguments);};
      hub.open=function(target,options){
        if(target==='finance')return open();
        close();
        return originalOpen?.(target,options);
      };
      hub.__financePatchedV552=true;
    }
  }

  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-mod-hub-launch-v517="finance"],[data-mod-hub-open="finance"]');
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open();
  },true);

  const api={version:VERSION,open,close,render,dataConnected:false,visualStyle:'market-terminal'};
  window.__modFinanceV552=api;

  const observer=new MutationObserver(patchHub);
  function init(){
    ensureRoot();
    patchHub();
    observer.observe(document.documentElement,{subtree:true,childList:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
