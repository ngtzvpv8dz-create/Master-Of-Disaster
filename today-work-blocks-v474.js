/* V474 · HEUTE ARBEITSBLÖCKE + ALLE-SUCHE
   - Kategorien bleiben dauerhaft und unabhängig von der Tagesplanung.
   - HEUTE nutzt stabile Arbeitsblock-IDs mit dynamischer sichtbarer Nummerierung.
   - Arbeitsblöcke sind einklappbar, optional benennbar, manuell löschbar und per Drag tauschbar.
   - Aufgaben lassen sich innerhalb und zwischen Arbeitsblöcken ziehen.
   - ALLE bekommt eine Suche mit direkter HEUTE-/Arbeitsblock-Zuweisung.
*/
(function(){
  'use strict';

  const BUILD_VERSION='V474';
  const STORAGE_KEY='masterOfDisasterTodayWorkBlocksV474';
  const V473_MODE_KEY='masterOfDisasterCategoryViewModesV473';
  const ACTIVE_STATUSES=new Set(['open','running','paused']);
  let taskDrag=null;
  let blockDrag=null;
  let allSearchQuery='';
  let saveEditWrapped=false;

  function readJson(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(_){return fallback;}}
  function writeJson(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(_){return false;}}
  function rows(){try{return Array.isArray(tasks)?tasks:[];}catch(_){return [];}}
  function tab(){try{return String(currentTab||'all');}catch(_){return 'all';}}
  function today(){return typeof getBerlinDateKey==='function'?getBerlinDateKey():new Date().toISOString().slice(0,10);}
  function esc(value){return typeof escapeHtml==='function'?escapeHtml(String(value??'')):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function clean(value){return String(value??'').trim().replace(/\s+/g,' ');}
  function uid(){return `wb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;}
  function isActive(row){return !!row&&ACTIVE_STATUSES.has(String(row.status||''));}
  function taskById(id){return rows().find(row=>Number(row?.id)===Number(id))||null;}

  function forceTodaySequenceMode(){
    const modes=readJson(V473_MODE_KEY,{});
    if(modes.today!=='order'){modes.today='order';writeJson(V473_MODE_KEY,modes);}
  }

  function readStore(){
    const raw=readJson(STORAGE_KEY,{dates:{}});
    if(!raw||typeof raw!=='object')return {dates:{}};
    if(!raw.dates||typeof raw.dates!=='object')raw.dates={};
    return raw;
  }
  function sanitizeBlocks(list){
    const seen=new Set();
    return (Array.isArray(list)?list:[]).map(block=>({
      id:clean(block?.id)||uid(),
      name:clean(block?.name),
      collapsed:!!block?.collapsed
    })).filter(block=>{if(seen.has(block.id))return false;seen.add(block.id);return true;});
  }
  function getBlocks(date=today()){
    const store=readStore();
    return sanitizeBlocks(store.dates[date]);
  }
  function saveBlocks(date,list){
    const store=readStore();
    store.dates[date]=sanitizeBlocks(list);
    writeJson(STORAGE_KEY,store);
    return store.dates[date];
  }
  function newBlockObject(name=''){return {id:uid(),name:clean(name),collapsed:false};}
  function ensureFirstBlock(date=today()){
    let blocks=getBlocks(date);
    if(!blocks.length){blocks=[newBlockObject('')];saveBlocks(date,blocks);}
    return blocks;
  }

  function renderedTodayActiveIds(){
    if(tab()!=='today')return [];
    return [...document.querySelectorAll('#viewContainer .today-task-active[data-id]')].map(card=>Number(card.dataset.id)).filter(Number.isFinite);
  }

  function activeTodayRows(date=today()){
    return rows().filter(row=>isActive(row)&&row.todayDate===date).sort((a,b)=>(Number(a.todayOrder)||0)-(Number(b.todayOrder)||0));
  }

  function rewriteTodayOrder(date,blocks=getBlocks(date)){
    const active=activeTodayRows(date);
    if(!active.length)return false;
    const valid=new Set(blocks.map(block=>block.id));
    let changed=false;
    if(!blocks.length){blocks=ensureFirstBlock(date);blocks.forEach(block=>valid.add(block.id));}
    active.forEach(row=>{if(!valid.has(clean(row.todayWorkBlockId))){row.todayWorkBlockId=blocks[0].id;changed=true;}});
    let position=1;
    blocks.forEach(block=>{
      active.filter(row=>row.todayWorkBlockId===block.id).sort((a,b)=>(Number(a.todayOrder)||0)-(Number(b.todayOrder)||0)).forEach(row=>{
        if(Number(row.todayOrder)!==position){row.todayOrder=position;changed=true;}
        position+=1;
      });
    });
    return changed;
  }

  function ensureTodayModel(date=today(),renderedIds=[]){
    let blocks=getBlocks(date);
    let changed=false;
    for(const id of renderedIds){
      const row=taskById(id);
      if(row&&isActive(row)&&row.todayDate!==date){row.todayDate=date;changed=true;}
    }
    const active=activeTodayRows(date);
    if(active.length&&!blocks.length){blocks=[newBlockObject('')];saveBlocks(date,blocks);}
    const valid=new Set(blocks.map(block=>block.id));
    active.forEach(row=>{
      if(!valid.has(clean(row.todayWorkBlockId))){row.todayWorkBlockId=blocks[0]?.id||null;changed=true;}
    });
    if(rewriteTodayOrder(date,blocks))changed=true;
    if(changed&&typeof saveTasks==='function')saveTasks();
    return blocks;
  }

  function orderedByBlocks(date=today()){
    const blocks=ensureTodayModel(date,[]);
    const active=activeTodayRows(date);
    const out=[];
    blocks.forEach(block=>out.push(...active.filter(row=>row.todayWorkBlockId===block.id).sort((a,b)=>(Number(a.todayOrder)||0)-(Number(b.todayOrder)||0))));
    return {blocks,rows:out};
  }

  function blockNumber(blockId,date=today()){
    const index=getBlocks(date).findIndex(block=>block.id===blockId);
    return index<0?null:index+1;
  }
  function blockLabel(block,index){return `ARBEITSBLOCK ${index+1}${block.name?` · ${block.name.toUpperCase()}`:''}`;}

  function addBlock(name='',options={}){
    const date=options.date||today();
    const blocks=getBlocks(date);const block=newBlockObject(name);blocks.push(block);saveBlocks(date,blocks);
    if(options.render!==false&&typeof render==='function')render();
    return block;
  }
  function renameBlock(blockId){
    const date=today(),blocks=getBlocks(date),index=blocks.findIndex(block=>block.id===blockId);if(index<0)return false;
    const current=blocks[index].name||'';
    const next=prompt('Optionaler Name für diesen Arbeitsblock:',current);
    if(next===null)return false;
    blocks[index].name=clean(next);saveBlocks(date,blocks);if(typeof render==='function')render();return true;
  }
  function toggleBlock(blockId){
    const date=today(),blocks=getBlocks(date),block=blocks.find(item=>item.id===blockId);if(!block)return false;
    block.collapsed=!block.collapsed;saveBlocks(date,blocks);
    const root=document.querySelector(`.work-block-v474[data-work-block-id="${CSS.escape(blockId)}"]`);
    root?.classList.toggle('collapsed',block.collapsed);
    root?.querySelector('.work-block-body-v474')?.classList.toggle('collapsed',block.collapsed);
    root?.querySelector('.work-block-collapse-v474')?.setAttribute('aria-expanded',String(!block.collapsed));
    return true;
  }
  function deleteBlock(blockId){
    const date=today(),blocks=getBlocks(date),index=blocks.findIndex(block=>block.id===blockId);if(index<0)return false;
    const active=activeTodayRows(date).filter(row=>row.todayWorkBlockId===blockId);
    if(active.length){
      if(typeof showInfoModal==='function')showInfoModal('Arbeitsblock ist nicht leer',`In diesem Arbeitsblock ${active.length===1?'liegt noch eine Aufgabe':'liegen noch '+active.length+' Aufgaben'}. Verschiebe oder erledige sie zuerst.`);
      return false;
    }
    if(!confirm(`Arbeitsblock ${index+1}${blocks[index].name?` · ${blocks[index].name}`:''} löschen?`))return false;
    const remaining=blocks.filter(block=>block.id!==blockId);saveBlocks(date,remaining);
    let changed=false;rows().forEach(row=>{if(row.todayWorkBlockId===blockId){row.todayWorkBlockId=null;changed=true;}});
    if(changed&&typeof saveTasks==='function')saveTasks();
    if(typeof render==='function')render();return true;
  }

  function listsForBlocks(date=today(),excludeId=null){
    const blocks=ensureTodayModel(date,[]);
    const lists=new Map(blocks.map(block=>[block.id,[]]));
    activeTodayRows(date).forEach(row=>{
      if(excludeId!==null&&Number(row.id)===Number(excludeId))return;
      if(!lists.has(row.todayWorkBlockId))lists.set(blocks[0]?.id,[]);
      lists.get(row.todayWorkBlockId||blocks[0]?.id)?.push(row);
    });
    for(const list of lists.values())list.sort((a,b)=>(Number(a.todayOrder)||0)-(Number(b.todayOrder)||0));
    return {blocks,lists};
  }

  function persistLists(date,blocks,lists){
    let order=1;
    blocks.forEach(block=>{
      (lists.get(block.id)||[]).forEach(row=>{row.todayWorkBlockId=block.id;row.todayDate=date;row.todayOrder=order++;});
    });
    if(typeof saveTasks==='function')saveTasks();
  }

  function moveTaskToBlock(taskId,destinationBlockId,index=null,options={}){
    const date=options.date||today();
    let blocks=getBlocks(date);
    if(!blocks.length)blocks=ensureFirstBlock(date);
    let destination=blocks.find(block=>block.id===destinationBlockId);
    if(!destination)destination=blocks[0];
    const row=taskById(taskId);if(!row||!isActive(row))return false;
    row.todayDate=date;
    const {lists}=listsForBlocks(date,taskId);
    const dest=lists.get(destination.id)||[];
    const at=index===null?dest.length:Math.max(0,Math.min(Number(index)||0,dest.length));
    dest.splice(at,0,row);lists.set(destination.id,dest);
    persistLists(date,blocks,lists);
    if(options.render!==false&&typeof render==='function')render();
    return true;
  }

  function assignTaskToToday(taskId,blockId=null,options={}){
    const date=options.date||today();
    let blocks=getBlocks(date);
    if(!blocks.length)blocks=ensureFirstBlock(date);
    const target=blocks.find(block=>block.id===blockId)||blocks[0];
    return moveTaskToBlock(taskId,target.id,null,options);
  }

  function swapBlocks(firstId,secondId){
    if(firstId===secondId)return false;
    const date=today(),blocks=getBlocks(date),a=blocks.findIndex(block=>block.id===firstId),b=blocks.findIndex(block=>block.id===secondId);
    if(a<0||b<0)return false;
    [blocks[a],blocks[b]]=[blocks[b],blocks[a]];saveBlocks(date,blocks);
    if(rewriteTodayOrder(date,blocks)&&typeof saveTasks==='function')saveTasks();
    if(typeof render==='function')render();return true;
  }

  function injectStyle(){
    if(document.getElementById('todayWorkBlocksV474Style'))return;
    const style=document.createElement('style');style.id='todayWorkBlocksV474Style';style.textContent=`
      .work-block-toolbar-v474{display:flex;align-items:center;gap:7px;margin:11px 0 10px;padding:8px;border:1px solid var(--mod-border,#30363b);border-radius:12px;background:var(--mod-surface,#171b1f)}
      .work-block-toolbar-title-v474{flex:1;font-size:9px;font-weight:950;letter-spacing:.8px;color:var(--mod-muted,#87949c)}
      .work-block-add-v474{padding:8px 10px;border:1px solid var(--mod-border,#30363b);border-radius:9px;background:var(--mod-control,#101315);color:var(--mod-text,#f3f3f3);font-size:9px;font-weight:950}
      .work-blocks-v474{display:grid;gap:10px;margin-bottom:18px}
      .work-block-v474{position:relative;border:1px solid var(--mod-border,#30363b);border-radius:14px;background:color-mix(in srgb,var(--mod-surface,#171b1f) 88%,transparent);overflow:visible}
      .work-block-v474.block-dragging-v474{z-index:60;pointer-events:none!important;opacity:.74;border-color:var(--mod-accent,#e8ecef)!important;box-shadow:0 14px 30px rgba(0,0,0,.35)}
      .work-block-v474.block-drop-target-v474{border-color:var(--mod-accent,#e8ecef)!important;box-shadow:0 0 0 2px color-mix(in srgb,var(--mod-accent,#e8ecef) 46%,transparent)!important}
      .work-block-head-v474{display:flex;align-items:center;gap:6px;padding:8px;border-bottom:1px solid color-mix(in srgb,var(--mod-border,#30363b) 78%,transparent);background:var(--mod-surface2,#111416);border-radius:13px 13px 0 0}
      .work-block-v474.collapsed .work-block-head-v474{border-bottom-color:transparent;border-radius:13px}
      .work-block-drag-v474{width:31px;height:31px;flex-shrink:0;border:1px solid var(--mod-border,#30363b);border-radius:8px;background:var(--mod-control,#101315);color:var(--mod-muted,#87949c);font-size:17px;font-weight:950;touch-action:none;user-select:none}
      .work-block-collapse-v474{min-width:0;flex:1;border:0;background:transparent;color:var(--mod-text,#f3f3f3);text-align:left;padding:3px 2px;font-size:10px;font-weight:950;letter-spacing:.55px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .work-block-count-v474{min-width:25px;padding:4px 6px;border:1px solid var(--mod-border,#30363b);border-radius:999px;background:var(--mod-control,#101315);color:var(--mod-muted,#87949c);font-size:8px;font-weight:950;text-align:center}
      .work-block-icon-v474{width:29px;height:29px;padding:0;border:1px solid var(--mod-border,#30363b);border-radius:8px;background:var(--mod-control,#101315);color:var(--mod-text,#f3f3f3);font-size:11px}
      .work-block-body-v474{padding:8px 8px 1px;min-height:48px}.work-block-body-v474.collapsed{display:none}
      .work-block-empty-v474{padding:8px 6px 14px;color:var(--mod-muted,#87949c);font-size:9px;text-align:center}
      .work-block-position-v474{position:absolute;right:8px;top:-9px;z-index:80;padding:4px 7px;border:1px solid var(--mod-accent,#e8ecef);border-radius:999px;background:var(--mod-control,#101315);color:var(--mod-text,#f3f3f3);font-size:7px;font-weight:950}
      body .today-task-active.task-dragging-v474{position:relative!important;z-index:70!important;pointer-events:none!important;opacity:.82!important;border-color:var(--mod-accent,#e8ecef)!important;box-shadow:0 0 0 2px color-mix(in srgb,var(--mod-accent,#e8ecef) 50%,transparent),0 15px 28px rgba(0,0,0,.36)!important}
      .task-drag-position-v474{flex-shrink:0;padding:4px 6px;border:1px solid var(--mod-accent,#e8ecef);border-radius:7px;background:var(--mod-control,#101315);color:var(--mod-text,#f3f3f3);font-size:6.8px;font-weight:950;white-space:nowrap}
      body .today-task-active.task-drop-before-v474,body .today-task-active.task-drop-after-v474{position:relative!important}
      body .today-task-active.task-drop-before-v474::before,body .today-task-active.task-drop-after-v474::after{content:'';position:absolute;left:4px;right:4px;height:3px;border-radius:999px;background:var(--mod-accent,#e8ecef);box-shadow:0 0 10px color-mix(in srgb,var(--mod-accent,#e8ecef) 55%,transparent);z-index:100;pointer-events:none}
      body .today-task-active.task-drop-before-v474::before{top:-6px}body .today-task-active.task-drop-after-v474::after{bottom:-6px}
      .work-block-body-v474.task-drop-empty-v474{outline:2px dashed var(--mod-accent,#e8ecef);outline-offset:-5px}
      .today-edit-block-v474{margin-top:7px;padding-top:7px;border-top:1px solid color-mix(in srgb,var(--mod-border,#30363b) 70%,transparent)}
      .today-edit-block-select-v474,.all-search-block-select-v474{min-height:31px;border:1px solid var(--mod-border,#30363b);border-radius:8px;background:var(--mod-surface2,#111416);color:var(--mod-text,#f3f3f3);font-size:9px;font-weight:850;padding:5px 7px}
      .all-task-search-v474{margin:0 0 12px;padding:9px;border:1px solid var(--mod-border,#30363b);border-radius:12px;background:var(--mod-surface,#171b1f)}
      .all-task-search-head-v474{font-size:9px;font-weight:950;letter-spacing:.8px;color:var(--mod-muted,#87949c);margin-bottom:7px}
      .all-task-search-input-v474{width:100%;padding:10px 11px;border:1px solid var(--mod-border,#30363b);border-radius:9px;background:var(--mod-surface2,#111416);color:var(--mod-text,#f3f3f3);font-size:14px;outline:none}
      .all-task-search-results-v474{display:grid;gap:6px;margin-top:8px}.all-task-search-hint-v474{padding:5px 2px;color:var(--mod-muted,#87949c);font-size:8px;line-height:1.4}
      .all-task-search-row-v474{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:center;padding:8px;border:1px solid color-mix(in srgb,var(--mod-border,#30363b) 80%,transparent);border-radius:9px;background:var(--mod-surface2,#111416)}
      .all-task-search-name-v474{font-size:10px;font-weight:900;color:var(--mod-text,#f3f3f3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.all-task-search-meta-v474{margin-top:3px;font-size:7px;color:var(--mod-muted,#87949c)}
      .all-task-search-actions-v474{display:flex;align-items:center;gap:5px}.all-task-search-assign-v474{min-height:31px;padding:5px 8px;border:1px solid var(--mod-border,#30363b);border-radius:8px;background:var(--mod-control,#101315);color:var(--mod-text,#f3f3f3);font-size:8px;font-weight:950}
      @media(max-width:430px){.all-task-search-row-v474{grid-template-columns:1fr}.all-task-search-actions-v474{width:100%}.all-search-block-select-v474{min-width:0;flex:1}.work-block-head-v474{gap:5px}.work-block-icon-v474{width:27px;height:27px}.work-block-drag-v474{width:29px;height:29px}}
    `;document.head.appendChild(style);
  }

  function findActiveSection(container){
    return [...container.querySelectorAll('.section')].find(section=>/OFFEN\s*\/\s*LAUFEND\s*\/\s*PAUSIERT/i.test(section.querySelector('.section-title')?.textContent||''))||null;
  }

  function patchNextPanel(date=today()){
    const panel=document.querySelector('#viewContainer .next-task-panel');if(!panel)return;
    const ordered=orderedByBlocks(date),cook=window.__modUxCookingEditorV460;
    const running=ordered.rows.find(row=>cook?.isBlockingRunning?.(row))||ordered.rows.find(row=>row.status==='running');
    const next=running||ordered.rows[0];
    if(!next){panel.innerHTML='<div class="next-task-label">NÄCHSTE AUFGABE</div><div class="next-task-empty">Keine offene Aufgabe in den Arbeitsblöcken.</div>';return;}
    const number=blockNumber(next.todayWorkBlockId,date);
    const label=cook?.isBlockingRunning?.(next)?'AKTUELL LAUFENDE AUFGABE':cook?.isPassiveCooking?.(next)?'KOCHEN · WARTE-/GARZEIT':'NÄCHSTE AUFGABE';
    panel.innerHTML=`<div class="next-task-label">${label}${number?` · ARBEITSBLOCK ${number}`:''}</div><div class="next-task-content"><div class="next-task-number">${typeof dynamicNumber==='function'?dynamicNumber(next):''}</div><div class="next-task-status">${typeof statusSymbol==='function'?statusSymbol(next):''}</div><div class="next-task-name">${esc(next.text)}</div></div>`;
  }

  function makeBlockElement(block,index,cards){
    const root=document.createElement('section');root.className=`work-block-v474${block.collapsed?' collapsed':''}`;root.dataset.workBlockId=block.id;
    const head=document.createElement('div');head.className='work-block-head-v474';
    const grip=document.createElement('button');grip.type='button';grip.className='work-block-drag-v474';grip.textContent='≡';grip.title='Arbeitsblock verschieben';grip.setAttribute('aria-label',`Arbeitsblock ${index+1} verschieben`);
    const collapse=document.createElement('button');collapse.type='button';collapse.className='work-block-collapse-v474';collapse.textContent=`${block.collapsed?'▸':'▾'} ${blockLabel(block,index)}`;collapse.setAttribute('aria-expanded',String(!block.collapsed));
    const count=document.createElement('span');count.className='work-block-count-v474';count.textContent=String(cards.length);
    const edit=document.createElement('button');edit.type='button';edit.className='work-block-icon-v474';edit.textContent='✏️';edit.title='Optionalen Namen ändern';
    const del=document.createElement('button');del.type='button';del.className='work-block-icon-v474';del.textContent='🗑️';del.title=cards.length?'Erst Aufgaben verschieben oder erledigen':'Arbeitsblock löschen';
    head.append(grip,collapse,count,edit,del);
    const body=document.createElement('div');body.className=`work-block-body-v474${block.collapsed?' collapsed':''}`;body.dataset.workBlockBodyId=block.id;
    if(cards.length)cards.forEach(card=>body.appendChild(card));else{const empty=document.createElement('div');empty.className='work-block-empty-v474';empty.textContent='Keine offenen Aufgaben in diesem Arbeitsblock.';body.appendChild(empty);}
    root.append(head,body);
    collapse.addEventListener('click',()=>toggleBlock(block.id));edit.addEventListener('click',()=>renameBlock(block.id));del.addEventListener('click',()=>deleteBlock(block.id));
    grip.addEventListener('pointerdown',event=>startBlockDrag(event,block.id,root));
    return root;
  }

  function renderWorkBlocks(){
    if(tab()!=='today')return false;
    forceTodaySequenceMode();
    document.getElementById('categoryViewToggleV473')?.remove();
    const container=document.getElementById('viewContainer');if(!container)return false;
    const activeSection=findActiveSection(container);if(!activeSection)return false;
    const cards=[...activeSection.querySelectorAll('.today-task-active[data-id]')];
    const blocks=ensureTodayModel(today(),cards.map(card=>Number(card.dataset.id)));
    const map=new Map(cards.map(card=>[Number(card.dataset.id),card]));
    const active=activeTodayRows(today());
    const toolbar=document.createElement('div');toolbar.className='work-block-toolbar-v474';toolbar.innerHTML='<div class="work-block-toolbar-title-v474">🧱 HEUTE · ARBEITSBLÖCKE</div><button type="button" class="work-block-add-v474">+ ARBEITSBLOCK</button>';
    toolbar.querySelector('.work-block-add-v474').addEventListener('click',()=>addBlock());
    const holder=document.createElement('div');holder.className='work-blocks-v474';
    blocks.forEach((block,index)=>{
      const blockCards=active.filter(row=>row.todayWorkBlockId===block.id).sort((a,b)=>(Number(a.todayOrder)||0)-(Number(b.todayOrder)||0)).map(row=>map.get(Number(row.id))).filter(Boolean);
      holder.appendChild(makeBlockElement(block,index,blockCards));
    });
    if(!blocks.length){const empty=document.createElement('div');empty.className='work-block-empty-v474';empty.textContent='Noch kein Arbeitsblock. Lege deinen ersten Block an.';holder.appendChild(empty);}
    activeSection.replaceWith(toolbar,holder);
    patchNextPanel(today());
    enhanceEditBlock();
    return true;
  }

  function blockOptions(selectedId=''){
    const blocks=getBlocks(today());
    if(!blocks.length)return '<option value="__create__">ARBEITSBLOCK 1 · WIRD ANGELEGT</option>';
    return blocks.map((block,index)=>`<option value="${esc(block.id)}" ${block.id===selectedId?'selected':''}>${esc(blockLabel(block,index))}</option>`).join('');
  }

  function enhanceEditBlock(){
    if(tab()!=='today')return;
    let editId=null;try{editId=editingTaskId;}catch(_){return;}
    if(editId==null||document.getElementById('editWorkBlockRowV474'))return;
    const row=taskById(editId);if(!row)return;
    const area=document.querySelector('.task .edit-options')||document.querySelector('.task .edit-area');if(!area)return;
    const wrap=document.createElement('div');wrap.id='editWorkBlockRowV474';wrap.className='option-row today-edit-block-v474';
    wrap.innerHTML=`<span class="option-label">ARBEITSBLOCK</span><select id="editWorkBlockV474" class="today-edit-block-select-v474">${blockOptions(row.todayWorkBlockId||'')}</select><button type="button" class="option-button" id="editNewWorkBlockV474">+ NEU</button>`;
    area.appendChild(wrap);
    document.getElementById('editNewWorkBlockV474')?.addEventListener('click',()=>{
      const block=addBlock('',{render:false});const select=document.getElementById('editWorkBlockV474');if(select){select.innerHTML=blockOptions(block.id);select.value=block.id;}
    });
  }

  function wrapSaveEdit(){
    if(saveEditWrapped||typeof window.saveEdit!=='function')return;saveEditWrapped=true;
    const base=window.saveEdit;
    window.saveEdit=function(id){
      if(tab()==='today'){
        const select=document.getElementById('editWorkBlockV474');
        if(select){let blockId=select.value;if(blockId==='__create__')blockId=ensureFirstBlock(today())[0].id;moveTaskToBlock(id,blockId,null,{render:false});}
      }
      return base.apply(this,arguments);
    };
  }

  function renderSearchResults(root){
    const results=root.querySelector('.all-task-search-results-v474');if(!results)return;
    const q=clean(allSearchQuery).toLocaleLowerCase('de-DE');
    if(!q){results.innerHTML='<div class="all-task-search-hint-v474">Tippe einen Aufgabennamen oder eine Kategorie ein. Treffer kannst du direkt einem heutigen Arbeitsblock zuweisen.</div>';return;}
    const matches=rows().filter(row=>isActive(row)&&(`${row.text||''} ${row.category||''}`).toLocaleLowerCase('de-DE').includes(q)).slice(0,30);
    if(!matches.length){results.innerHTML='<div class="all-task-search-hint-v474">Keine passende offene Aufgabe gefunden.</div>';return;}
    results.innerHTML='';
    matches.forEach(row=>{
      const div=document.createElement('div');div.className='all-task-search-row-v474';
      const current=row.todayDate===today()?blockNumber(row.todayWorkBlockId):null;
      div.innerHTML=`<div><div class="all-task-search-name-v474">${esc(row.text)}</div><div class="all-task-search-meta-v474">${row.category?`🏷️ ${esc(row.category.toUpperCase())} · `:''}${current?`✓ HEUTE · ARBEITSBLOCK ${current}`:'NICHT HEUTE EINGEPLANT'}</div></div><div class="all-task-search-actions-v474"><select class="all-search-block-select-v474">${blockOptions(row.todayWorkBlockId||'')}</select><button type="button" class="all-task-search-assign-v474">${current?'VERSCHIEBEN':'HEUTE →'}</button></div>`;
      div.querySelector('.all-task-search-assign-v474').addEventListener('click',()=>{
        const select=div.querySelector('.all-search-block-select-v474');let id=select?.value||'';if(id==='__create__')id=ensureFirstBlock(today())[0].id;assignTaskToToday(row.id,id,{render:true});
      });
      results.appendChild(div);
    });
  }

  function injectAllSearch(){
    if(tab()!=='all')return false;
    const container=document.getElementById('viewContainer');if(!container||document.getElementById('allTaskSearchV474'))return false;
    const root=document.createElement('section');root.id='allTaskSearchV474';root.className='all-task-search-v474';root.innerHTML='<div class="all-task-search-head-v474">🔎 AUFGABE SUCHEN · DIREKT FÜR HEUTE EINPLANEN</div><input class="all-task-search-input-v474" type="search" autocomplete="off" placeholder="z. B. Flur wischen"><div class="all-task-search-results-v474"></div>';
    const toolbar=document.getElementById('categoryToolbarV412');const toggle=document.getElementById('categoryViewToggleV473');
    if(toggle)toggle.insertAdjacentElement('afterend',root);else if(toolbar)toolbar.insertAdjacentElement('afterend',root);else container.prepend(root);
    const input=root.querySelector('input');input.value=allSearchQuery;input.addEventListener('input',()=>{allSearchQuery=input.value;renderSearchResults(root);});renderSearchResults(root);return true;
  }

  function clearTaskDragVisuals(){
    document.querySelectorAll('.task-drop-before-v474,.task-drop-after-v474').forEach(node=>node.classList.remove('task-drop-before-v474','task-drop-after-v474'));
    document.querySelectorAll('.task-drop-empty-v474').forEach(node=>node.classList.remove('task-drop-empty-v474'));
    document.querySelectorAll('.task-drag-position-v474').forEach(node=>node.remove());
  }
  function dragBadge(card,text){
    let badge=card.querySelector('.task-drag-position-v474');if(!badge){badge=document.createElement('span');badge.className='task-drag-position-v474';const handle=card.querySelector('.drag-handle');if(handle)handle.insertAdjacentElement('beforebegin',badge);else card.appendChild(badge);}badge.textContent=text;
  }

  function computeTaskDrop(event){
    if(!taskDrag)return null;
    const el=document.elementFromPoint(event.clientX,event.clientY);if(!el)return null;
    const blockRoot=el.closest('.work-block-v474');if(!blockRoot)return null;
    const blockId=blockRoot.dataset.workBlockId;const blocks=getBlocks(today()),blockIndex=blocks.findIndex(block=>block.id===blockId);if(blockIndex<0)return null;
    const targetCard=el.closest('.today-task-active[data-id]');const {lists}=listsForBlocks(today(),taskDrag.id);const dest=lists.get(blockId)||[];
    let index=dest.length,before=false,targetId=null;
    if(targetCard&&Number(targetCard.dataset.id)!==Number(taskDrag.id)){
      targetId=Number(targetCard.dataset.id);const targetIndex=dest.findIndex(row=>Number(row.id)===targetId);if(targetIndex>=0){const rect=targetCard.getBoundingClientRect();before=event.clientY<rect.top+rect.height/2;index=targetIndex+(before?0:1);}
    }
    index=Math.max(0,Math.min(index,dest.length));
    return {blockId,blockIndex,index,position:index+1,total:dest.length+1,targetCard,before,targetId};
  }

  window.startTodayDrag=function(event,id){
    if(tab()!=='today')return;
    const card=event.currentTarget.closest('.today-task-active');if(!card)return;
    event.preventDefault();
    taskDrag={id:Number(id),pointerId:event.pointerId,card,drop:null};
    try{dragState={id:Number(id),pointerId:event.pointerId,card};}catch(_){}
    try{event.currentTarget.setPointerCapture(event.pointerId);}catch(_){}
    card.classList.add('task-dragging-v474');
    const row=taskById(id),number=blockNumber(row?.todayWorkBlockId)||1;const inBlock=activeTodayRows(today()).filter(item=>item.todayWorkBlockId===row?.todayWorkBlockId).sort((a,b)=>(Number(a.todayOrder)||0)-(Number(b.todayOrder)||0));const pos=Math.max(1,inBlock.findIndex(item=>Number(item.id)===Number(id))+1);
    dragBadge(card,`BLOCK ${number} · POSITION ${pos}/${Math.max(1,inBlock.length)}`);
  };

  function handleTaskMove(event){
    if(!taskDrag||event.pointerId!==taskDrag.pointerId)return false;
    event.preventDefault();clearTaskDragVisuals();
    const drop=computeTaskDrop(event);taskDrag.drop=drop;if(!drop)return true;
    if(drop.targetCard){drop.targetCard.classList.add(drop.before?'task-drop-before-v474':'task-drop-after-v474');}else{document.querySelector(`.work-block-body-v474[data-work-block-body-id="${CSS.escape(drop.blockId)}"]`)?.classList.add('task-drop-empty-v474');}
    dragBadge(taskDrag.card,`BLOCK ${drop.blockIndex+1} · POSITION ${drop.position}/${drop.total}`);return true;
  }
  function finishTaskDrag(event){
    if(!taskDrag||event.pointerId!==taskDrag.pointerId)return false;
    const state=taskDrag;taskDrag=null;clearTaskDragVisuals();state.card.classList.remove('task-dragging-v474');try{dragState=null;}catch(_){}
    if(state.drop)moveTaskToBlock(state.id,state.drop.blockId,state.drop.index,{render:true});return true;
  }

  function clearBlockDragVisuals(){document.querySelectorAll('.block-drop-target-v474').forEach(node=>node.classList.remove('block-drop-target-v474'));document.querySelectorAll('.work-block-position-v474').forEach(node=>node.remove());}
  function startBlockDrag(event,blockId,root){
    event.preventDefault();blockDrag={blockId,pointerId:event.pointerId,root,targetId:null};root.classList.add('block-dragging-v474');try{event.currentTarget.setPointerCapture(event.pointerId);}catch(_){}
    const badge=document.createElement('span');badge.className='work-block-position-v474';const index=getBlocks(today()).findIndex(block=>block.id===blockId);badge.textContent=`POSITION ${index+1}/${getBlocks(today()).length}`;root.appendChild(badge);
  }
  function handleBlockMove(event){
    if(!blockDrag||event.pointerId!==blockDrag.pointerId)return false;
    event.preventDefault();clearBlockDragVisuals();const el=document.elementFromPoint(event.clientX,event.clientY);const target=el?.closest('.work-block-v474');if(!target||target.dataset.workBlockId===blockDrag.blockId){blockDrag.targetId=null;return true;}
    blockDrag.targetId=target.dataset.workBlockId;target.classList.add('block-drop-target-v474');const blocks=getBlocks(today()),targetIndex=blocks.findIndex(block=>block.id===blockDrag.targetId);const badge=document.createElement('span');badge.className='work-block-position-v474';badge.textContent=`POSITION ${targetIndex+1}/${blocks.length}`;blockDrag.root.appendChild(badge);return true;
  }
  function finishBlockDrag(event){
    if(!blockDrag||event.pointerId!==blockDrag.pointerId)return false;
    const state=blockDrag;blockDrag=null;clearBlockDragVisuals();state.root.classList.remove('block-dragging-v474');if(state.targetId)swapBlocks(state.blockId,state.targetId);return true;
  }

  document.addEventListener('pointermove',event=>{
    if(blockDrag){if(handleBlockMove(event))event.stopImmediatePropagation();return;}
    if(taskDrag&&handleTaskMove(event))event.stopImmediatePropagation();
  },{capture:true,passive:false});
  document.addEventListener('pointerup',event=>{
    if(blockDrag){if(finishBlockDrag(event))event.stopImmediatePropagation();return;}
    if(taskDrag&&finishTaskDrag(event))event.stopImmediatePropagation();
  },{capture:true});
  document.addEventListener('pointercancel',event=>{
    if(blockDrag&&event.pointerId===blockDrag.pointerId){const state=blockDrag;blockDrag=null;clearBlockDragVisuals();state.root.classList.remove('block-dragging-v474');}
    if(taskDrag&&event.pointerId===taskDrag.pointerId){const state=taskDrag;taskDrag=null;clearTaskDragVisuals();state.card.classList.remove('task-dragging-v474');try{dragState=null;}catch(_){}}
  },{capture:true});

  function replaceToggleToday(){
    window.toggleToday=function(id){
      const row=taskById(id);if(!row)return;
      const date=today();
      if(row.todayDate===date){row.todayDate=null;row.todayOrder=null;row.todayWorkBlockId=null;if(typeof saveTasks==='function')saveTasks();if(typeof render==='function')render();return;}
      assignTaskToToday(id,null,{date,render:true});
    };
  }

  function afterRender(){
    injectStyle();forceTodaySequenceMode();wrapSaveEdit();
    if(tab()==='today'){document.getElementById('categoryViewToggleV473')?.remove();renderWorkBlocks();}
    if(tab()==='all')injectAllSearch();
  }

  forceTodaySequenceMode();replaceToggleToday();wrapSaveEdit();injectStyle();
  const previousRender=typeof window.render==='function'?window.render:null;
  if(previousRender){window.render=function(){const result=previousRender.apply(this,arguments);afterRender();return result;};}
  window.addEventListener('load',()=>setTimeout(()=>{forceTodaySequenceMode();if(typeof render==='function')render();else afterRender();},260));
  setTimeout(afterRender,80);

  window.__modTodayWorkBlocksV474={
    version:BUILD_VERSION,storageKey:STORAGE_KEY,getBlocks,addBlock,deleteBlock,renameBlock,toggleBlock,swapBlocks,
    assignTaskToToday,moveTaskToBlock,orderedByBlocks,blockNumber,ensureTodayModel,rewriteTodayOrder,
    categoriesIndependent:true,dynamicBlockNumbering:true,emptyBlocksPersist:true,manualDeleteOnly:true,
    optionalNames:true,blockDrag:true,crossBlockTaskDrag:true,allSearch:true,directTodayAssignment:true
  };
})();
