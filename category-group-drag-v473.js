/* V473 · OPTIONAL CATEGORY GROUPING + TODAY DRAG FEEDBACK
   - categories are a view only; task data and todayOrder are never rewritten by grouping
   - grouped categories are collapsible per tab/section/category
   - Today drag handles are disabled while grouped to avoid ambiguous ordering
   - sequence view restores strong drag highlighting, insertion line and live POSITION x / n badge
*/
(function(){
  'use strict';

  const BUILD_VERSION='V473';
  const MODE_KEY='masterOfDisasterCategoryViewModesV473';
  const COLLAPSE_KEY='masterOfDisasterCategoryCollapsedV473';
  const GROUP_TABS=new Set(['all','today','priority','due','active','archive']);
  const GROUPED='grouped';
  const ORDER='order';

  function readJson(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(_){return fallback;}}
  function writeJson(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(_){return false;}}
  function clean(v){return String(v??'').trim().replace(/\s+/g,' ');}
  function norm(v){return clean(v).toLocaleLowerCase('de-DE');}
  function tab(){return typeof currentTab==='string'?currentTab:'all';}
  function modeFor(name=tab()){const modes=readJson(MODE_KEY,{});return modes[name]===GROUPED?GROUPED:ORDER;}
  function setMode(name,mode){
    if(!GROUP_TABS.has(name))return false;
    const modes=readJson(MODE_KEY,{});modes[name]=mode===GROUPED?GROUPED:ORDER;writeJson(MODE_KEY,modes);
    if(typeof render==='function')render();
    return true;
  }
  function collapseKey(tabName,sectionName,category){return `${tabName}|${norm(sectionName)}|${norm(category)}`;}
  function isCollapsed(key){return readJson(COLLAPSE_KEY,{})[key]===true;}
  function setCollapsed(key,value){const data=readJson(COLLAPSE_KEY,{});data[key]=!!value;writeJson(COLLAPSE_KEY,data);}

  function injectStyle(){
    if(document.getElementById('categoryGroupDragV473Style'))return;
    const style=document.createElement('style');style.id='categoryGroupDragV473Style';style.textContent=`
      .category-view-toggle-v473{display:flex;align-items:center;gap:6px;margin:0 0 12px;padding:7px;border:1px solid var(--mod-border,#30363b);border-radius:11px;background:var(--mod-surface,#171b1f)}
      .category-view-toggle-v473 .category-view-label-v473{margin-right:auto;padding-left:2px;font-size:8px;font-weight:950;letter-spacing:.8px;color:var(--mod-muted,#87949c)}
      .category-view-button-v473{min-height:29px;padding:5px 8px;border:1px solid var(--mod-border,#30363b);border-radius:8px;background:var(--mod-control,#101315);color:var(--mod-muted,#87949c);font-size:8px;font-weight:950;letter-spacing:.45px}
      .category-view-button-v473.active{border-color:color-mix(in srgb,var(--mod-border,#30363b) 45%,var(--mod-text,#f3f3f3) 55%);background:color-mix(in srgb,var(--mod-control,#101315) 72%,var(--mod-text,#f3f3f3) 28%);color:var(--mod-text,#f3f3f3)}
      .category-view-hint-v473{width:100%;padding:1px 3px 0;font-size:7px;line-height:1.35;color:var(--mod-muted,#87949c)}
      .category-view-toggle-v473.grouped{flex-wrap:wrap}
      .task-category-group-v473{margin:0 0 9px;border:1px solid color-mix(in srgb,var(--mod-border,#30363b) 78%,transparent);border-radius:12px;background:color-mix(in srgb,var(--mod-surface,#171b1f) 82%,transparent);overflow:hidden}
      .task-category-head-v473{width:100%;display:flex;align-items:center;gap:8px;padding:8px 9px;border:0;border-bottom:1px solid color-mix(in srgb,var(--mod-border,#30363b) 70%,transparent);background:var(--mod-surface2,#111416);color:var(--mod-text,#f3f3f3);text-align:left}
      .task-category-head-v473.collapsed{border-bottom-color:transparent}
      .task-category-name-v473{flex:1;min-width:0;font-size:9px;font-weight:950;letter-spacing:.55px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .task-category-count-v473{flex-shrink:0;min-width:23px;padding:3px 6px;border:1px solid var(--mod-border,#30363b);border-radius:999px;background:var(--mod-control,#101315);color:var(--mod-muted,#87949c);font-size:8px;font-weight:950;text-align:center}
      .task-category-chevron-v473{width:15px;flex-shrink:0;color:var(--mod-muted,#87949c);font-size:11px;font-weight:950;text-align:center;transition:transform .15s ease}
      .task-category-head-v473.collapsed .task-category-chevron-v473{transform:rotate(-90deg)}
      .task-category-items-v473{padding:7px 7px 0}.task-category-items-v473.collapsed{display:none}
      .task-category-items-v473>.task,.task-category-items-v473>.archive-task{margin-bottom:7px}
      .category-view-grouped-v473 .drag-handle{pointer-events:none!important;opacity:.28!important;filter:grayscale(1)}
      body .task.today-task-active.dragging{position:relative!important;z-index:30!important;opacity:.78!important;border-color:color-mix(in srgb,var(--mod-accent,#e8ecef) 72%,var(--mod-text,#f3f3f3) 28%)!important;box-shadow:0 0 0 2px color-mix(in srgb,var(--mod-accent,#e8ecef) 58%,transparent),0 16px 30px rgba(0,0,0,.34)!important}
      body .today-task-active.drag-target{border-color:color-mix(in srgb,var(--mod-accent,#e8ecef) 72%,var(--mod-text,#f3f3f3) 28%)!important}
      body .today-task-active.drag-insert-before-v473,body .today-task-active.drag-insert-after-v473{position:relative!important}
      body .today-task-active.drag-insert-before-v473::before,body .today-task-active.drag-insert-after-v473::after{content:'';position:absolute;left:5px;right:5px;height:3px;border-radius:999px;background:var(--mod-accent,#e8ecef);box-shadow:0 0 0 1px color-mix(in srgb,var(--mod-bg-mid,#0b0d0f) 70%,transparent),0 0 12px color-mix(in srgb,var(--mod-accent,#e8ecef) 45%,transparent);z-index:50;pointer-events:none}
      body .today-task-active.drag-insert-before-v473::before{top:-6px}body .today-task-active.drag-insert-after-v473::after{bottom:-6px}
      .drag-position-badge-v473{flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;min-height:25px;padding:4px 6px;border:1px solid color-mix(in srgb,var(--mod-accent,#e8ecef) 65%,var(--mod-border,#30363b) 35%);border-radius:7px;background:var(--mod-control,#101315);color:var(--mod-text,#f3f3f3);font-size:7px;font-weight:950;letter-spacing:.45px;white-space:nowrap;box-shadow:0 5px 12px rgba(0,0,0,.24)}
    `;document.head.appendChild(style);
  }

  function taskArray(){try{return Array.isArray(tasks)?tasks:[];}catch(_){return [];}}
  function rowForCard(card){
    const id=Number(card?.dataset?.id);
    if(Number.isFinite(id)){const direct=taskArray().find(row=>Number(row?.id)===id);if(direct)return direct;}
    try{return window.__modCategoriesV412?.rowForCard?.(card)||null;}catch(_){return null;}
  }
  function categoryForCard(card){const value=clean(rowForCard(card)?.category);return value||'OHNE KATEGORIE';}

  function visibleCards(root){
    const all=[...new Set([...root.querySelectorAll('.task,.archive-task')])];
    return all.filter(card=>{
      if(card.closest('.task-category-group-v473'))return false;
      const section=card.closest('.section');
      if(root.id==='viewContainer'&&section)return false;
      if(root.classList?.contains('section')&&section!==root)return false;
      if(card.style.display==='none')return false;
      return true;
    });
  }
  function sectionRoots(container){
    const sections=[...container.querySelectorAll('.section')];
    const roots=sections.filter(section=>visibleCards(section).length>0);
    const loose=[...new Set([...container.querySelectorAll('.task,.archive-task')])].filter(card=>!card.closest('.section')&&!card.closest('.task-category-group-v473')&&card.style.display!=='none');
    if(loose.length)roots.unshift(container);
    return [...new Set(roots)];
  }
  function sectionName(root,index){if(root.id==='viewContainer')return `Hauptliste ${index+1}`;return clean(root.querySelector('.section-title')?.textContent)||`Bereich ${index+1}`;}

  function createGroup(tabName,sectionLabel,category,cards){
    const key=collapseKey(tabName,sectionLabel,category),collapsed=isCollapsed(key);
    const wrap=document.createElement('div');wrap.className='task-category-group-v473';wrap.dataset.v473Category=category;
    const head=document.createElement('button');head.type='button';head.className=`task-category-head-v473${collapsed?' collapsed':''}`;head.setAttribute('aria-expanded',String(!collapsed));head.title=`Kategorie ${category} ${collapsed?'aufklappen':'zuklappen'}`;
    const name=document.createElement('span');name.className='task-category-name-v473';name.textContent=`🏷️ ${category.toUpperCase()}`;
    const count=document.createElement('span');count.className='task-category-count-v473';count.textContent=String(cards.length);
    const chev=document.createElement('span');chev.className='task-category-chevron-v473';chev.textContent='▾';head.append(name,count,chev);
    const body=document.createElement('div');body.className=`task-category-items-v473${collapsed?' collapsed':''}`;cards.forEach(card=>body.appendChild(card));
    head.addEventListener('click',()=>{const next=!body.classList.contains('collapsed');body.classList.toggle('collapsed',next);head.classList.toggle('collapsed',next);head.setAttribute('aria-expanded',String(!next));setCollapsed(key,next);});
    wrap.append(head,body);return wrap;
  }

  function applyGrouping(){
    const tabName=tab();if(!GROUP_TABS.has(tabName)||modeFor(tabName)!==GROUPED)return false;
    const container=document.getElementById('viewContainer');if(!container||container.querySelector('.task-category-group-v473'))return false;
    container.classList.add('category-view-grouped-v473');
    sectionRoots(container).forEach((root,index)=>{
      const cards=visibleCards(root);if(!cards.length)return;
      const marker=document.createElement('span');marker.hidden=true;marker.dataset.v473GroupMarker='1';cards[0].parentNode.insertBefore(marker,cards[0]);
      const buckets=new Map();cards.forEach(card=>{const category=categoryForCard(card);if(!buckets.has(category))buckets.set(category,[]);buckets.get(category).push(card);});
      const fragment=document.createDocumentFragment(),label=sectionName(root,index);buckets.forEach((groupCards,category)=>fragment.appendChild(createGroup(tabName,label,category,groupCards)));
      marker.parentNode.insertBefore(fragment,marker);marker.remove();
    });
    if(tabName==='today')container.querySelectorAll('.drag-handle').forEach(handle=>{handle.setAttribute('aria-disabled','true');handle.title='Zum Sortieren auf REIHENFOLGE wechseln';});
    return true;
  }

  function injectViewToggle(){
    const tabName=tab();if(!GROUP_TABS.has(tabName))return false;
    const container=document.getElementById('viewContainer');if(!container||document.getElementById('categoryViewToggleV473'))return false;
    const current=modeFor(tabName),bar=document.createElement('div');bar.id='categoryViewToggleV473';bar.className=`category-view-toggle-v473${current===GROUPED?' grouped':''}`;
    const label=document.createElement('div');label.className='category-view-label-v473';label.textContent='ANSICHT';
    const order=document.createElement('button');order.type='button';order.className=`category-view-button-v473${current===ORDER?' active':''}`;order.textContent='☷ REIHENFOLGE';order.dataset.v473Mode=ORDER;
    const grouped=document.createElement('button');grouped.type='button';grouped.className=`category-view-button-v473${current===GROUPED?' active':''}`;grouped.textContent='▦ GRUPPIERT';grouped.dataset.v473Mode=GROUPED;bar.append(label,order,grouped);
    if(tabName==='today'&&current===GROUPED){const hint=document.createElement('div');hint.className='category-view-hint-v473';hint.textContent='Zum Verschieben der Tagesreihenfolge kurz auf REIHENFOLGE wechseln.';bar.appendChild(hint);}
    bar.querySelectorAll('[data-v473-mode]').forEach(button=>button.addEventListener('click',()=>setMode(tabName,button.dataset.v473Mode)));
    const categoryToolbar=document.getElementById('categoryToolbarV412');if(categoryToolbar)categoryToolbar.insertAdjacentElement('afterend',bar);else container.prepend(bar);return true;
  }

  function todayOrderRows(){
    if(typeof getBerlinDateKey!=='function')return [];
    const today=getBerlinDateKey();return [...taskArray()].filter(task=>task?.todayDate===today&&!['completed','aborted'].includes(String(task?.status||''))).sort((a,b)=>(Number(a.todayOrder)||0)-(Number(b.todayOrder)||0));
  }
  function getDropPreview(draggedId,targetId){
    const rows=todayOrderRows(),from=rows.findIndex(row=>Number(row.id)===Number(draggedId)),to=rows.findIndex(row=>Number(row.id)===Number(targetId));
    if(from<0||to<0)return null;return {position:to+1,total:rows.length,side:from<to?'after':from>to?'before':'self',from:from+1,to:to+1};
  }
  function clearDragFeedback(){document.querySelectorAll('.drag-insert-before-v473,.drag-insert-after-v473').forEach(card=>card.classList.remove('drag-insert-before-v473','drag-insert-after-v473'));document.querySelectorAll('.drag-position-badge-v473').forEach(badge=>badge.remove());}
  function ensurePositionBadge(card,preview){
    if(!card||!preview)return null;let badge=card.querySelector('.drag-position-badge-v473');
    if(!badge){badge=document.createElement('span');badge.className='drag-position-badge-v473';const handle=card.querySelector('.drag-handle');if(handle)handle.insertAdjacentElement('beforebegin',badge);else card.appendChild(badge);}
    badge.textContent=`POSITION ${preview.position} / ${preview.total}`;return badge;
  }
  function applyDragFeedback(draggedId,targetId){
    if(tab()!=='today'||modeFor('today')===GROUPED)return null;const preview=getDropPreview(draggedId,targetId);if(!preview)return null;
    const container=document.getElementById('viewContainer');if(!container)return preview;
    container.querySelectorAll('.drag-insert-before-v473,.drag-insert-after-v473').forEach(card=>card.classList.remove('drag-insert-before-v473','drag-insert-after-v473'));
    const dragId=Number(draggedId),targetNumeric=Number(targetId),dragged=container.querySelector(`.today-task-active[data-id="${dragId}"]`),target=container.querySelector(`.today-task-active[data-id="${targetNumeric}"]`);
    ensurePositionBadge(dragged,preview);if(target&&preview.side==='before')target.classList.add('drag-insert-before-v473');if(target&&preview.side==='after')target.classList.add('drag-insert-after-v473');return preview;
  }
  function nearestTodayTarget(event){
    const container=document.getElementById('viewContainer');if(!container)return null;
    const direct=document.elementFromPoint?.(event.clientX,event.clientY)?.closest?.('.today-task-active');if(direct&&container.contains(direct))return direct;
    const cards=[...container.querySelectorAll('.today-task-active')];let best=null,bestDistance=Infinity;
    cards.forEach(card=>{const rect=card.getBoundingClientRect(),mid=rect.top+rect.height/2,d=Math.abs(event.clientY-mid);if(d<bestDistance){bestDistance=d;best=card;}});return best;
  }
  function onPointerDown(event){
    if(tab()!=='today'||modeFor('today')===GROUPED)return;const handle=event.target?.closest?.('.drag-handle');if(!handle)return;
    setTimeout(()=>{const card=handle.closest('.today-task-active');if(!card)return;const id=Number(card.dataset.id),preview=getDropPreview(id,id);if(preview)ensurePositionBadge(card,preview);},0);
  }
  function onPointerMove(event){if(tab()!=='today'||modeFor('today')===GROUPED)return;const dragged=document.querySelector('#viewContainer .today-task-active.dragging');if(!dragged)return;const target=nearestTodayTarget(event);if(target)applyDragFeedback(Number(dragged.dataset.id),Number(target.dataset.id));}
  function onPointerEnd(){setTimeout(clearDragFeedback,0);}

  function afterRender(){
    injectStyle();const tabName=tab(),container=document.getElementById('viewContainer');if(container)container.classList.remove('category-view-grouped-v473');
    if(!GROUP_TABS.has(tabName))return;injectViewToggle();applyGrouping();
  }
  const previousRender=typeof render==='function'?render:null;if(previousRender){render=function(){const result=previousRender.apply(this,arguments);afterRender();return result;};}
  document.addEventListener('pointerdown',onPointerDown);document.addEventListener('pointermove',onPointerMove,{passive:true});document.addEventListener('pointerup',onPointerEnd);document.addEventListener('pointercancel',onPointerEnd);
  window.addEventListener('load',()=>setTimeout(afterRender,220));setTimeout(afterRender,0);

  window.__modCategoryGroupDragV473={version:BUILD_VERSION,groupTabs:[...GROUP_TABS],modeFor,setMode,applyGrouping,getDropPreview,applyDragFeedback,clearDragFeedback,groupingIsViewOnly:true,todayDragGroupedDisabled:true,livePosition:true,insertionLine:true};
})();
