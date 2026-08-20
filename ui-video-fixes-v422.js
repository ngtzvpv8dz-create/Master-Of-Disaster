/* V422 · VIDEO-BASIERTE STATISTIK-ICON-VEREINHEITLICHUNG */
(function(){
  const base=window.__modUnifiedIconsV419;
  if(!base||!base.icons)return;
  const I=base.icons;
  const icon=(body)=>`<span class="ui-icon-v419"><svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg></span>`;
  const X={
    weight:icon('<path d="M8 8.5h8l1.5 11h-11Z"/><path d="M9.5 8.5a2.5 2.5 0 0 1 5 0"/><path d="M12 12v4M10 14h4"/>'),
    trophy:icon('<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 6H5v2a4 4 0 0 0 4 4M16 6h3v2a4 4 0 0 1-4 4M12 13v4M8 20h8M10 17h4"/>'),
    clock:I.clock,
    repeat:icon('<path d="M7 7h10l2 2-2 2M17 17H7l-2-2 2-2"/>'),
    active:icon('<circle cx="12" cy="12" r="8"/><path d="m9 12 2 2 4-5"/>'),
    rest:icon('<path d="M5 15h14v4H5Z"/><path d="M7 15v-3a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3M8 19v2M16 19v2"/>'),
    report:icon('<path d="M6 3h9l3 3v15H6Z"/><path d="M15 3v4h4M9 11h6M9 15h6"/>')
  };
  const map=[
    [/PRODUKTIVSTER TAG|REKORDE|AUFGABEN-REKORDE/,X.trophy,'v422-trophy'],
    [/LÄNGSTER EINSATZTAG/,X.clock,'v422-clock'],
    [/HÄUFIGSTE AUFGABE|WIEDERKEHRENDE AUFGABEN/,X.repeat,'v422-repeat'],
    [/AKTIV MIT GEWICHT|AKTIVE AUFGABEN|MIT ZUSATZGEWICHT/,X.active,'v422-active'],
    [/AUSSERHALB|INNERHALB/,X.rest,'v422-rest'],
    [/TRAGEZEIT GESAMT|GEWICHTSSTUFEN|ZUSATZGEWICHT|KG-STUNDEN/,X.weight,'v422-weight'],
    [/REPORT-BASIS|REPORTBASIS/,X.report,'v422-report']
  ];
  function textOnly(el){return (el.textContent||'').replace(/\s+/g,' ').trim();}
  function clean(el){
    if(!el)return;
    el.querySelectorAll('.v419-iconized,.v420-weight-icon,.v420-fire-icon,.v420-repeat-icon,.v420-trophy-icon,.v420-layers-icon,.v421-weight-icon,.v421-trophy-icon,.v421-clock-icon,.v421-repeat-icon,.v421-active-icon,.v421-home-icon,.v421-report-icon').forEach(n=>n.remove());
    [...el.childNodes].filter(n=>n.nodeType===3).forEach(n=>{n.nodeValue=n.nodeValue.replace(/[🏆🏋️‍♂️🏋️‍♀️🏋️💪🛋️🕒⏱️🔁📊🧱⚖️🎖️]+/gu,'');});
  }
  function semanticIcon(el){
    if(!el||el.dataset.v422Done==='1')return;
    const t=textOnly(el).toUpperCase();
    const m=map.find(([re])=>re.test(t));if(!m)return;
    clean(el);el.dataset.v422Done='1';el.classList.add('v422-stat-label');
    el.insertAdjacentHTML('afterbegin',`<span class="${m[2]}">${m[1]}</span>`);
  }
  function patchStats(root=document){
    if(typeof currentTab!=='undefined'&&currentTab!=='statistics')return;
    root.querySelectorAll('.statistics-label,.statistics-section-title,.statistics-topname,.statistics-card').forEach(el=>{
      if(el.classList.contains('statistics-card')){
        const label=el.querySelector('.statistics-label');if(label)semanticIcon(label);
      }else semanticIcon(el);
    });
    root.querySelectorAll('.statistics-wrapper,.statistics-group,.statistics-card,.statistics-section-title,.statistics-label,.statistics-value,.statistics-sub').forEach(el=>{
      el.classList.add('v422-neutral-stats');
    });
  }
  function patch(root=document){patchStats(root);}
  let q=false;new MutationObserver(()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;patch(document);});}).observe(document.documentElement,{childList:true,subtree:true});
  const old=window.renderStatistics;if(typeof old==='function')window.renderStatistics=function(container){const r=old.apply(this,arguments);setTimeout(()=>patchStats(container||document),0);return r;};
  window.__modVideoFixesV422={version:'V422',patch};window.addEventListener('load',()=>setTimeout(()=>patch(document),350));patch(document);
})();
