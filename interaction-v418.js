/* V418 · LINE ICONS + GLOBAL INTERACTION FEEDBACK */
(function(){
 const svg=(d,cls='v418-action-icon')=>`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
 const icons={
  start:svg('<path d="M8 5l11 7-11 7z"/>'),
  time:svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/>'),
  edit:svg('<path d="M4 20l4-1 10-10-3-3L5 16l-1 4z"/><path d="M14 7l3 3"/>'),
  del:svg('<path d="M5 7h14M9 7V4h6v3M8 10v7M12 10v7M16 10v7M7 7l1 13h8l1-13"/>'),
  abort:svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  done:svg('<path d="M5 12l4 4 10-10"/>'),
  pause:svg('<path d="M9 7v10M15 7v10"/>'),
  today:svg('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 9h16"/>'),
  repeat:svg('<path d="M17 7h3v-3M20 7a8 8 0 10 1 7M7 17H4v3M4 17a8 8 0 001-7"/>'),
  tag:svg('<path d="M4 5v6l8 8 7-7-8-8H5a1 1 0 00-1 1z"/><circle cx="8" cy="8" r="1"/>','v418-meta-icon'),
  brief:svg('<rect x="4" y="7" width="16" height="12" rx="2"/><path d="M9 7V5h6v2M4 12h16"/>','v418-meta-icon'),
  calendar:svg('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 9h16"/>','v418-meta-icon')
 };
 function key(btn){const t=(btn.getAttribute('title')||'').toLowerCase();if(t.includes('start')||t.includes('weiter'))return'start';if(t.includes('zeit'))return'time';if(t.includes('bearbeit'))return'edit';if(t.includes('löschen'))return'del';if(t.includes('abbruch'))return'abort';if(t.includes('beenden'))return'done';if(t.includes('pause'))return'pause';if(t.includes('heute'))return'today';if(t.includes('wieder'))return'repeat';return null;}
 function decorate(){document.querySelectorAll('.compact-actions-v416 button,.compact-actions-v416 .drag-handle').forEach(b=>{const k=key(b);if(k&&icons[k])b.innerHTML=icons[k];});document.querySelectorAll('.compact-due-v416').forEach(el=>{if(el.querySelector('svg'))return;el.textContent=el.textContent.replace(/^\s*[^0-9—-]*\s*/,'');el.insertAdjacentHTML('afterbegin',icons.calendar);});document.querySelectorAll('.compact-type-v416').forEach(el=>{if(!el.querySelector('svg'))el.insertAdjacentHTML('afterbegin',icons.brief);});document.querySelectorAll('.compact-category-v416').forEach(el=>{if(!el.querySelector('svg'))el.insertAdjacentHTML('afterbegin',icons.tag);});}
 function feedback(el){if(!el)return;try{if(navigator.vibrate)navigator.vibrate(8);}catch(_){}el.classList.add('press-feedback-v418');setTimeout(()=>el.classList.remove('press-feedback-v418'),90);}
 document.addEventListener('pointerdown',e=>{const el=e.target.closest('button,select,[role="button"],.category-inline-v412,.drag-handle');if(el&&!el.disabled)feedback(el);},{passive:true});
 const prev=typeof render==='function'?render:null;if(prev){render=function(){const r=prev.apply(this,arguments);setTimeout(decorate,10);return r;};}
 window.__modInteractionV418={decorate,feedback};window.addEventListener('load',()=>setTimeout(decorate,350));
})();