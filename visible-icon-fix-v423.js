/* V423 · ECHTE SICHTBARE ALT-ICONS DIREKT ERSETZEN */
(function(){
  const icon=body=>`<span class="ui-icon-v419 v423-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg></span>`;
  const X={
    weight:icon('<path d="M8 8.5h8l1.5 11h-11Z"/><path d="M9.5 8.5a2.5 2.5 0 0 1 5 0"/><path d="M12 12v4M10 14h4"/>'),
    trophy:icon('<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 6H5v2a4 4 0 0 0 4 4M16 6h3v2a4 4 0 0 1-4 4M12 13v4M8 20h8M10 17h4"/>'),
    clock:icon('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3.5 2"/>'),
    repeat:icon('<path d="M7 7h10l2 2-2 2M17 17H7l-2-2 2-2"/>'),
    active:icon('<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8 8h8M8 12h5M8 16h3"/><path d="m14.5 15 1.5 1.5 3-3"/>'),
    rest:icon('<path d="M5 15h14v4H5Z"/><path d="M7 15v-3a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3M8 19v2M16 19v2"/>'),
    report:icon('<path d="M6 3h9l3 3v15H6Z"/><path d="M15 3v4h4M9 11h6M9 15h6"/>')
  };
  const emoji=/[🏆🏋️‍♂️🏋️‍♀️🏋️💪🛋️🕒⏱️🔁📊🧱⚖️🎖️🥇🏅]+/gu;
  function plain(el){return (el.textContent||'').replace(emoji,'').replace(/\s+/g,' ').trim();}
  function set(el,svg,text){if(!el)return;el.innerHTML=`${svg}<span class="v423-label-text">${text}</span>`;el.classList.add('v423-fixed-label');}
  function patchStats(root=document){
    root.querySelectorAll('.statistics-record-label').forEach(el=>{
      const t=plain(el).toUpperCase();
      if(t.includes('PRODUKTIVSTER TAG'))set(el,X.trophy,'PRODUKTIVSTER TAG');
      else if(t.includes('LÄNGSTER EINSATZTAG'))set(el,X.clock,'LÄNGSTER EINSATZTAG');
      else if(t.includes('HÄUFIGSTE AUFGABE'))set(el,X.repeat,'HÄUFIGSTE AUFGABE');
    });
    root.querySelectorAll('.statistics-section-title').forEach(el=>{
      const t=plain(el).toUpperCase();
      if(t==='REKORDE'||t==='AUFGABEN-REKORDE')set(el,X.trophy,t);
      else if(t.includes('ZUSATZGEWICHT'))set(el,X.weight,t);
      else if(t.includes('GEWICHTSSTUFEN'))set(el,X.weight,t);
      else if(t.includes('REPORT-BASIS'))set(el,X.report,t);
    });
    root.querySelectorAll('.statistics-label').forEach(el=>{
      const t=plain(el).toUpperCase();
      if(/AKTIV MIT GEWICHT|MIT ZUSATZGEWICHT/.test(t))set(el,X.active,t);
      else if(/TRAGEZEIT|KG-STUNDEN|\d+[,.]?\d*\s*KG/.test(t))set(el,X.weight,t);
      else if(/AKTIVE AUFGABEN/.test(t))set(el,X.active,t);
      else if(/AUSSERHALB|INNERHALB/.test(t))set(el,X.rest,t);
    });
  }
  function patchArchive(root=document){
    root.querySelectorAll('.archive-task-weight-details').forEach(el=>{const t=plain(el);if(t)set(el,X.weight,t);});
    root.querySelectorAll('.archive-weight-total').forEach(el=>{const t=plain(el);if(t)set(el,X.weight,t);});
  }
  function patch(root=document){patchStats(root);patchArchive(root);}
  let queued=false;
  new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;patch(document);});}).observe(document.documentElement,{childList:true,subtree:true});
  const oldStats=window.renderStatistics;if(typeof oldStats==='function')window.renderStatistics=function(){const r=oldStats.apply(this,arguments);setTimeout(()=>patchStats(document),0);return r;};
  const oldArchive=window.renderArchive;if(typeof oldArchive==='function')window.renderArchive=function(){const r=oldArchive.apply(this,arguments);setTimeout(()=>patchArchive(document),0);return r;};
  window.__modVisibleIconFixV423={version:'V423',patch};
  window.addEventListener('load',()=>setTimeout(()=>patch(document),350));
  patch(document);
})();
