/* V421 · PRIORITAETS-HEADER + STATISTIK-RESTPOLISH */
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
    active:icon('<path d="M6 5h12v14H6Z"/><path d="m9 10 1.7 1.7L14.5 8M9 15h6"/>'),
    home:icon('<path d="m4 11 8-7 8 7v9H7v-7h10v7"/>'),
    report:icon('<path d="M6 3h9l3 3v15H6Z"/><path d="M15 3v4h4M9 11h6M9 15h6"/>')
  };
  const colors={high:'#d85b5b',medium:'#d3aa45',normal:'#d8dde1',optional:'#a66ad8'};
  const labels={high:'HOHE PRIORITÄT',medium:'MITTLERE PRIORITÄT',normal:'NORMALE PRIORITÄT',optional:'OPTIONAL'};

  function priorityKind(text){const t=String(text||'').toUpperCase();if(t.includes('HOHE PRIORIT'))return'high';if(t.includes('MITTLERE PRIORIT'))return'medium';if(t.includes('NORMALE PRIORIT'))return'normal';if(/\bOPTIONAL\b/.test(t))return'optional';return null;}
  function patchPriority(root=document){
    if(typeof currentTab!=='undefined'&&currentTab!=='priority')return;
    root.querySelectorAll('.section').forEach(sec=>{
      const head=sec.querySelector(':scope > .section-header');const title=head?.querySelector('.section-title');const count=head?.querySelector('.counter');if(!head||!title||!count)return;
      const kind=priorityKind(title.textContent);if(!kind)return;
      head.classList.add('priority-section-header-v421');title.classList.add('priority-section-title-v421');title.dataset.priorityKind=kind;
      title.innerHTML=`<span class="priority-ring-slot-v421"><span class="priority-ring-v421 ${kind}"></span></span><span class="priority-title-spacer-v421"></span><span class="priority-title-text-v421">${labels[kind]}</span>`;
      title.style.setProperty('--priority-color-v421',colors[kind]);count.classList.add('priority-counter-v421');count.style.setProperty('--priority-color-v421',colors[kind]);
    });
  }
  function stripOldPrefix(el){
    if(!el)return;const txt=(el.textContent||'').replace(/^[\s\uFE0F]*(?:[\u{1F300}-\u{1FAFF}]|[\u2600-\u27BF])+[\s\uFE0F]*/u,'').trim();if(txt)el.textContent=txt;
  }
  function addIcon(el,html,cls){if(!el||el.querySelector('.'+cls))return;stripOldPrefix(el);el.classList.add('v421-stat-icon-label');el.insertAdjacentHTML('afterbegin',`<span class="${cls}">${html}</span>`);}
  function patchStatistics(root=document){
    root.querySelectorAll('.statistics-label,.statistics-section-title,.statistics-topname').forEach(el=>{
      const t=(el.textContent||'').trim().toUpperCase();
      if(/AKTIV MIT GEWICHT|MIT ZUSATZGEWICHT|TRAGEZEIT GESAMT|KG-STUNDEN/.test(t))addIcon(el,X.weight,'v421-weight-icon');
      else if(/PRODUKTIVSTER TAG|AUFGABEN-REKORDE|REKORDE/.test(t))addIcon(el,X.trophy,'v421-trophy-icon');
      else if(/LÄNGSTER EINSATZTAG|REKORD · ZEIT\/TAG/.test(t))addIcon(el,X.clock,'v421-clock-icon');
      else if(/HÄUFIGSTE AUFGABE|WIEDERKEHRENDE AUFGABEN/.test(t))addIcon(el,X.repeat,'v421-repeat-icon');
      else if(/AKTIVE AUFGABEN/.test(t))addIcon(el,X.active,'v421-active-icon');
      else if(/AUSSERHALB|INNERHALB/.test(t))addIcon(el,X.home,'v421-home-icon');
      else if(/REPORT-BASIS|REPORTBASIS/.test(t))addIcon(el,X.report,'v421-report-icon');
    });
    root.querySelectorAll('.statistics-group').forEach(g=>{
      const title=(g.querySelector('.statistics-section-title')?.textContent||'').toUpperCase();
      if(/ZUSATZGEWICHT|GEWICHTSSTUFEN/.test(title))g.classList.add('v421-neutral-weight-stats');
    });
  }
  function patch(root=document){patchPriority(root);patchStatistics(root);}
  let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;patch(document);});}).observe(document.documentElement,{childList:true,subtree:true});
  const oldRenderPriority=window.renderPriority;if(typeof oldRenderPriority==='function')window.renderPriority=function(container){const r=oldRenderPriority.apply(this,arguments);setTimeout(()=>patchPriority(container||document),0);return r;};
  const oldRenderStatistics=window.renderStatistics;if(typeof oldRenderStatistics==='function')window.renderStatistics=function(container){const r=oldRenderStatistics.apply(this,arguments);setTimeout(()=>patchStatistics(container||document),0);return r;};
  window.__modUiPolishV421={version:'V421',patch};window.addEventListener('load',()=>setTimeout(()=>patch(document),300));patch(document);
})();
