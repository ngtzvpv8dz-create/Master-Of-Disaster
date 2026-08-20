/* V419 · EINHEITLICHE LINE-ICONS IN DER GESAMTEN APP */
(function(){
 const svg=b=>`<span class="ui-icon-v419"><svg viewBox="0 0 24 24" aria-hidden="true">${b}</svg></span>`;
 const I={
 work:svg('<rect x="4" y="7" width="16" height="12" rx="2"/><path d="M9 7V5h6v2M4 11h16M10 11v2h4v-2"/>'),
 leisure:svg('<circle cx="12" cy="7" r="3"/><path d="M6.5 20c.6-4.4 2.4-6.5 5.5-6.5s4.9 2.1 5.5 6.5"/>'),
 selfrunner:svg('<rect x="5" y="7" width="14" height="11" rx="3"/><path d="M9 12h.01M15 12h.01M9 15h6M12 7V4M10.5 4h3"/>'),
 cooking:svg('<path d="M7 4v7M10 4v7M7 8h3M8.5 11v9M16 4c-2 3-2 6 0 8v8"/>'),
 category:svg('<path d="M4 7.5h6l2 2h8v10H4Z"/><path d="M4 7.5V5h6l2 2h8v2.5"/>'),
 edit:svg('<path d="m5 17.5-.8 3.3 3.3-.8L18 9.5l-2.5-2.5Z"/><path d="m14.5 8 2.5 2.5"/>'),
 trash:svg('<path d="M7 8v11h10V8M5.5 8h13M9.5 8V5.5h5V8M10 11v5M14 11v5"/>'),
 coffee:svg('<path d="M6 10h10v5.5A3.5 3.5 0 0 1 12.5 19h-3A3.5 3.5 0 0 1 6 15.5Z"/><path d="M16 11h1.5a2 2 0 0 1 0 4H16M8 7c0-1 1-1.3 1-2.3M12 7c0-1 1-1.3 1-2.3M4.5 21h14"/>'),
 play:svg('<path d="M8 5.5 18 12 8 18.5Z"/>'), check:svg('<path d="m5 12.5 4.2 4.2L19 7"/>'),
 chart:svg('<path d="M5 19V11h3v8M10.5 19V6h3v13M16 19V9h3v10M4 19.5h16"/>'),
 clock:svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3.5 2"/>'),
 calendar:svg('<rect x="4.5" y="6.5" width="15" height="13" rx="2"/><path d="M8 4v5M16 4v5M4.5 10.5h15"/>'),
 cloud:svg('<path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11-1.5A4.5 4.5 0 0 0 7 18Z"/><path d="M12 9v6M9.5 12l2.5-3 2.5 3"/>'),
 search:svg('<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/>'),
 phone:svg('<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M10 6h4M11 18h2"/>'),
 box:svg('<path d="M4 8h16v11H4ZM6 5h12l2 3H4Z"/><path d="M9 12h6"/>'),
 diagnostic:svg('<path d="M4 14h4l2-7 3 11 2-7 2 3h3"/>'),
 database:svg('<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>'),
 refresh:svg('<path d="M19 8a8 8 0 0 0-13-2L4 8M5 16a8 8 0 0 0 13 2l2-2"/><path d="M4 4v4h4M20 20v-4h-4"/>'),
 lock:svg('<rect x="6" y="10" width="12" height="10" rx="2"/><path d="M8.5 10V7a3.5 3.5 0 0 1 7 0v3"/>'),
 tag:svg('<path d="M4 5h7l9 9-6 6-9-9Z"/><circle cx="8" cy="9" r="1"/>')
 };
 const esc=s=>String(s||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const rules=[['🔧','work'],['🎮','leisure'],['🤖','selfrunner'],['🍳','cooking'],['🏷️','category'],['🏷','category'],['✏️','edit'],['✏','edit'],['🗑️','trash'],['🗑','trash'],['☕','coffee'],['▶️','play'],['▶','play'],['✅','check'],['✔️','check'],['📊','chart'],['⏱️','clock'],['⏱','clock'],['🕒','clock'],['📅','calendar'],['🗓️','calendar'],['☁️','cloud'],['☁','cloud'],['🔍','search'],['📱','phone'],['📦','box'],['🧪','diagnostic'],['🔧','work'],['💾','database'],['♻️','refresh'],['♻','refresh'],['🕛','refresh'],['🔐','lock']];
 function replaceTextNode(n){if(!n.nodeValue||!rules.some(([e])=>n.nodeValue.includes(e)))return;let html=n.nodeValue;let changed=false;for(const[e,k]of rules){if(html.includes(e)){html=html.replace(new RegExp(esc(e),'g'),I[k]);changed=true;}}if(changed){const s=document.createElement('span');s.className='v419-iconized';s.innerHTML=html;n.replaceWith(s);}}
 function walk(root){const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement?.closest('script,style,svg')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});const a=[];while(w.nextNode())a.push(w.currentNode);a.forEach(replaceTextNode);}
 function typeBadges(root){root.querySelectorAll('.task-type-badge').forEach(b=>{if(b.querySelector('.ui-icon-v419'))return;const t=(b.textContent||'').toUpperCase();const k=/FREIZEIT/.test(t)?'leisure':/SELBSTLÄUFER/.test(t)?'selfrunner':/KOCHEN/.test(t)?'cooking':/KATEGOR/.test(t)?'category':'work';b.insertAdjacentHTML('afterbegin',I[k]);});}
 function archiveDone(root){root.querySelectorAll('.archive-task').forEach(c=>{[...c.querySelectorAll('span,div')].filter(x=>/^[\s]*[✅✔✓][\s]*$/.test(x.textContent||'')).forEach(x=>{x.classList.add('archive-done-v419');x.innerHTML=I.check;});});}
 function weightEdit(root){root.querySelectorAll('#weightContainer button').forEach(b=>{if(/✏|bearbeiten/i.test((b.textContent||'')+' '+(b.title||''))){b.classList.add('weight-edit-v419');b.innerHTML=I.edit;}});}
 function patch(root=document){walk(root);typeBadges(root);archiveDone(root);weightEdit(root);}
 let q=false;new MutationObserver(()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;patch(document);});}).observe(document.documentElement,{subtree:true,childList:true});
 const oldRenderDue=typeof window.renderDue==='function'?window.renderDue:null;
 if(oldRenderDue)window.renderDue=function(container){const active=(tasks||[]).filter(t=>['open','running','paused'].includes(t.status)&&t.dueDate&&t.dueMode!=='none').sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate))||Number(a.id)-Number(b.id));if(typeof section==='function'){container.appendChild(section('FÄLLIGKEIT · NACH DATUM',active,{cardOptions:{compactOnly:true,filterTodayOnly:true}}));}else oldRenderDue(container);};
 window.__modUnifiedIconsV419={version:'V419',icons:I,patch};window.addEventListener('load',()=>setTimeout(()=>patch(document),250));patch(document);
})();