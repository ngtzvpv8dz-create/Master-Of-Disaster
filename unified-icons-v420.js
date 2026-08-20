/* V420 · RESTLICHE ALT-SYMBOLE SEMANTISCH BEREINIGEN */
(function(){
  const base=window.__modUnifiedIconsV419;
  if(!base||!base.icons)return;
  const I=base.icons;
  const ring=(kind)=>`<span class="priority-header-ring-v420 ${kind}" aria-hidden="true"></span>`;
  const extra={
    weight:`<span class="ui-icon-v419"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8.5h8l1.5 11h-11Z"/><path d="M9.5 8.5a2.5 2.5 0 0 1 5 0"/><path d="M12 12v4M10 14h4"/></svg></span>`,
    trophy:`<span class="ui-icon-v419"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 6H5v2a4 4 0 0 0 4 4M16 6h3v2a4 4 0 0 1-4 4M12 13v4M8 20h8M10 17h4"/></svg></span>`,
    fire:`<span class="ui-icon-v419"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21c4 0 7-2.8 7-6.5 0-3-1.8-5.3-4.3-7.5.2 2.2-.8 3.4-2 4.2.1-3.6-2-6.2-4.4-8.2.3 3.3-3.3 5.3-3.3 10.7C5 18 8 21 12 21Z"/><path d="M9.5 16.5c0 2 1.2 3.3 2.7 3.3 1.7 0 2.8-1.2 2.8-2.8 0-1.4-.8-2.5-2-3.4.1 1-.4 1.7-1 2.2-.2-1.3-.9-2.3-1.8-3.1.1 1.4-.7 2.2-.7 3.8Z"/></svg></span>`,
    repeat:`<span class="ui-icon-v419"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10l2 2-2 2M17 17H7l-2-2 2-2"/></svg></span>`,
    layers:`<span class="ui-icon-v419"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 4 8 4-8 4-8-4Z"/><path d="m4 12 8 4 8-4M4 16l8 4 8-4"/></svg></span>`
  };
  function cleanPrefix(el){
    if(!el)return;
    const txt=(el.textContent||'').replace(/^[\s\uFE0F]*(?:[\u{1F300}-\u{1FAFF}]|[\u2600-\u27BF])+[\s\uFE0F]*/u,'').trim();
    if(txt)el.textContent=txt;
  }
  function prepend(el,html,cls){if(!el||el.querySelector('.'+cls))return;cleanPrefix(el);el.classList.add('v420-semantic-icon-label');el.insertAdjacentHTML('afterbegin',`<span class="${cls}">${html}</span>`);}
  function patchPriorityHeaders(root){
    root.querySelectorAll('.section-title,.section-header,.statistics-section-title').forEach(el=>{
      const t=(el.textContent||'').trim().toUpperCase();
      let k=null;if(t.includes('HOHE PRIORIT'))k='high';else if(t.includes('MITTLERE PRIORIT'))k='medium';else if(t.includes('NORMALE PRIORIT'))k='normal';else if(t==='OPTIONAL'||t.includes(' OPTIONAL'))k='optional';
      if(k){cleanPrefix(el);if(!el.querySelector('.priority-header-ring-v420'))el.insertAdjacentHTML('afterbegin',ring(k));}
    });
  }
  function patchLabels(root){
    root.querySelectorAll('.statistics-label,.statistics-section-title,.archive-meta,.archive-details,.section-title,.weight-label,.weight-title').forEach(el=>{
      const t=(el.textContent||'').trim().toUpperCase();
      if(/ZUSATZGEWICHT|TRAGEZEIT|KG-STUNDEN/.test(t))prepend(el,extra.weight,'v420-weight-icon');
      else if(/PRODUKTIVSTER TAG|LÄNGSTER EINSATZTAG|REKORD · ZEIT\/TAG/.test(t))prepend(el,extra.fire,'v420-fire-icon');
      else if(/HÄUFIGSTE AUFGABE|WIEDERKEHRENDE AUFGABEN/.test(t))prepend(el,extra.repeat,'v420-repeat-icon');
      else if(/AUFGABEN-REKORDE|REKORD · AUFGABEN\/TAG|REKORDE/.test(t))prepend(el,extra.trophy,'v420-trophy-icon');
      else if(/REPORT-BASIS|REPORTBASIS/.test(t))prepend(el,extra.layers,'v420-layers-icon');
    });
  }
  function patchArchive(root){
    root.querySelectorAll('.archive-task').forEach(card=>{
      card.querySelectorAll('*').forEach(el=>{const t=(el.textContent||'').trim().toUpperCase();if(t&&/ZUSATZGEWICHT/.test(t))prepend(el,extra.weight,'v420-weight-icon');});
    });
  }
  function patch(root=document){patchPriorityHeaders(root);patchLabels(root);patchArchive(root);}
  let q=false;new MutationObserver(()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;patch(document);});}).observe(document.documentElement,{childList:true,subtree:true});
  const oldRenderPriority=window.renderPriority;if(typeof oldRenderPriority==='function')window.renderPriority=function(container){const r=oldRenderPriority.apply(this,arguments);setTimeout(()=>patchPriorityHeaders(container||document),0);return r;};
  const oldRenderStatistics=window.renderStatistics;if(typeof oldRenderStatistics==='function')window.renderStatistics=function(container){const r=oldRenderStatistics.apply(this,arguments);setTimeout(()=>patchLabels(container||document),0);return r;};
  window.__modUnifiedIconsV420={version:'V420',patch};window.addEventListener('load',()=>setTimeout(()=>patch(document),300));patch(document);
})();