/* V507 · AUFGABENTITEL-BIBLIOTHEK + VORSCHLÄGE
   - Leeres Aufgabenfeld zeigt alle aktuell offenen Titel alphabetisch und scrollbar.
   - Beim Tippen werden ausschließlich tatsächlich vorhandene Titel aus Aufgaben + Archiv gefiltert.
   - Bekannte Kategorie wird beim Auswählen eines Vorschlags sichtbar übernommen.
   - Eigener TITEL-Tab verwaltet Vorschläge, Ausblenden und manuelles Zusammenführen.
   - Zusammenführen benennt aktive + archivierte Aufgaben rückwirkend um, damit Statistiken sauber kumulieren.
   - „Ohne Kategorie“ steht in der gruppierten ALLE-Ansicht und im Kategorienfilter zuletzt.
*/
(function(){
  'use strict';
  if(window.__modTaskTitleLibraryV507)return;

  const BUILD_VERSION='V507';
  const PREF_KEY='masterOfDisasterTaskTitlePrefsV507';
  const CATEGORY_MAP_KEY='masterOfDisasterCategoryNameMapV405';
  const TERMINAL=new Set(['completed','aborted']);
  let selectedSuggestion=null;
  let adminQuery='';
  let addWrapped=false;

  const clean=value=>String(value??'').trim().replace(/\s+/g,' ');
  const norm=value=>clean(value).toLocaleLowerCase('de-DE');
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const enc=value=>encodeURIComponent(String(value??''));
  const dec=value=>{try{return decodeURIComponent(String(value??''));}catch(_){return String(value??'');}};

  function readJson(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(_){return fallback;}}
  function writeJson(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(error){console.warn('V507 storage',key,error);return false;}}
  function taskRows(){try{return Array.isArray(tasks)?tasks:[];}catch(_){return [];}}
  function archiveRows(){try{return Array.isArray(archive)?archive:[];}catch(_){return [];}}
  function allRows(){return [...taskRows(),...archiveRows()];}

  function rowTime(row){
    for(const value of [row?.completedAt,row?.abortedAt,row?.completedDate,row?.startedAt,row?.createdAt]){
      const ms=value?new Date(value).getTime():NaN;
      if(Number.isFinite(ms))return ms;
    }
    return 0;
  }

  function preferences(){
    const raw=readJson(PREF_KEY,{});
    return raw&&typeof raw==='object'?raw:{};
  }
  function hiddenMap(){const prefs=preferences();return prefs.hidden&&typeof prefs.hidden==='object'?prefs.hidden:{};}
  function isHidden(title){return hiddenMap()[norm(title)]===true;}
  function setHidden(title,hidden){
    const key=norm(title);if(!key)return false;
    const prefs=preferences(),map={...(prefs.hidden||{})};
    if(hidden)map[key]=true;else delete map[key];
    prefs.hidden=map;writeJson(PREF_KEY,prefs);
    try{window.__modLiveLogV453?.append?.('EDIT','INFO',`${hidden?'Aufgabentitel aus Vorschlägen ausgeblendet':'Aufgabentitel für Vorschläge aktiviert'}: „${clean(title)}“`);}catch(_){}
    return true;
  }

  function categoryMap(){const map=readJson(CATEGORY_MAP_KEY,{});return map&&typeof map==='object'?map:{};}
  function categoryForGroup(group){
    const mapped=clean(categoryMap()[group.key]);
    if(mapped)return mapped;
    const counts=new Map();
    for(const row of group.rows){
      const category=clean(row?.category);if(!category)continue;
      const key=norm(category),entry=counts.get(key)||{name:category,count:0,last:0};
      entry.count++;entry.last=Math.max(entry.last,rowTime(row));entry.name=category;counts.set(key,entry);
    }
    return [...counts.values()].sort((a,b)=>b.count-a.count||b.last-a.last||a.name.localeCompare(b.name,'de-DE'))[0]?.name||'';
  }

  function collectTitleGroups(){
    const groups=new Map();
    function add(row,source){
      const name=clean(row?.text);if(!name)return;
      const key=norm(name);let group=groups.get(key);
      if(!group){group={key,name,count:0,openCount:0,archiveCount:0,latest:null,latestMs:-1,rows:[]};groups.set(key,group);}
      group.count++;group.rows.push(row);if(source==='archive')group.archiveCount++;
      if(source==='tasks'&&!TERMINAL.has(String(row?.status||'')))group.openCount++;
      const ms=rowTime(row);if(!group.latest||ms>=group.latestMs){group.latest=row;group.latestMs=ms;group.name=name;}
    }
    taskRows().forEach(row=>add(row,'tasks'));
    archiveRows().forEach(row=>add(row,'archive'));
    return [...groups.values()].map(group=>({...group,category:categoryForGroup(group),hidden:isHidden(group.name)}));
  }

  function typeName(type){return type==='leisure'?'FREIZEIT':type==='selfrunner'?'SELBSTLÄUFER':type==='cooking'?'KOCHEN':'ARBEIT';}
  function suggestionMatches(group,query){
    if(!query)return group.openCount>0;
    return group.key.includes(query);
  }
  function suggestionRank(group,query){
    if(!query)return 0;
    if(group.key===query)return 0;
    if(group.key.startsWith(query))return 1;
    if(group.key.split(' ').some(word=>word.startsWith(query)))return 2;
    return 3;
  }

  function getKnownTaskSuggestions(query){
    const q=norm(query);
    return collectTitleGroups()
      .filter(group=>!group.hidden&&suggestionMatches(group,q))
      .sort((a,b)=>suggestionRank(a,q)-suggestionRank(b,q)||a.name.localeCompare(b.name,'de-DE'))
      .map(group=>({
        name:group.name,
        source:group.openCount?'BEREITS VORHANDEN':'VERLAUF',
        activeCount:group.openCount,
        count:group.count,
        item:group.latest,
        latestMs:group.latestMs,
        category:group.category
      }));
  }

  function setCategorySelect(category){
    const value=clean(category);
    const apply=()=>{
      const select=document.getElementById('newCategoryV412');
      if(!select)return false;
      if(value&&![...select.options].some(option=>norm(option.value)===norm(value))){
        const option=document.createElement('option');option.value=value;option.textContent=value.toUpperCase();select.appendChild(option);
      }
      const target=[...select.options].find(option=>norm(option.value)===norm(value));
      select.value=target?.value||'';
      select.dispatchEvent(new Event('change',{bubbles:true}));
      return true;
    };
    if(!apply())setTimeout(apply,0);
  }

  function selectTaskSuggestion(encodedName){
    const requested=dec(encodedName),group=collectTitleGroups().find(entry=>entry.key===norm(requested));
    const input=document.getElementById('taskInput');if(!input)return false;
    const name=group?.name||requested;input.value=name;
    const category=group?.category||'';
    selectedSuggestion={key:norm(name),autoCategory:category};
    window.__modPendingSuggestionCategory=category||null;
    if(group?.latest&&typeof setNewTaskType==='function')setNewTaskType(group.latest.type||'work');
    setCategorySelect(category);
    if(typeof updateNewOptions==='function')updateNewOptions();
    if(typeof hideTaskSuggestions==='function')hideTaskSuggestions();
    input.focus();
    return true;
  }

  function clearStaleAutoSelection(){
    const input=document.getElementById('taskInput');if(!input||!selectedSuggestion)return;
    if(norm(input.value)===selectedSuggestion.key)return;
    const select=document.getElementById('newCategoryV412');
    if(select&&selectedSuggestion.autoCategory&&norm(select.value)===norm(selectedSuggestion.autoCategory)){
      select.value='';select.dispatchEvent(new Event('change',{bubbles:true}));
    }
    window.__modPendingSuggestionCategory=undefined;
    selectedSuggestion=null;
  }

  function renderTaskSuggestions(){
    clearStaleAutoSelection();
    const input=document.getElementById('taskInput'),box=document.getElementById('taskSuggestions');if(!input||!box)return;
    const list=getKnownTaskSuggestions(input.value);
    if(!list.length){if(typeof hideTaskSuggestions==='function')hideTaskSuggestions();return;}
    box.innerHTML=list.map(suggestion=>{
      const item=suggestion.item||{},category=clean(suggestion.category)||'OHNE KATEGORIE';
      const meta=`${typeName(item.type)} · ${esc(category.toUpperCase())} · ${suggestion.count}× BISHER`;
      const open=suggestion.activeCount?`<span class="task-suggestion-active">${suggestion.activeCount>1?`${suggestion.activeCount}× OFFEN`:'BEREITS OFFEN'}</span>`:'';
      return `<button type="button" class="task-suggestion smart-task-suggestion v507-task-suggestion" onmousedown="event.preventDefault()" onclick="selectTaskSuggestion('${enc(suggestion.name)}')"><span class="task-suggestion-main"><span class="task-suggestion-name">${esc(suggestion.name)}</span>${open}</span><span class="task-suggestion-meta">${meta}</span></button>`;
    }).join('');
    box.classList.add('visible');
  }

  function wrapAddTask(){
    if(addWrapped||typeof window.addTask!=='function')return addWrapped;
    const base=window.addTask;
    window.addTask=function(){
      const input=document.getElementById('taskInput'),select=document.getElementById('newCategoryV412');
      const selection=selectedSuggestion&&input&&norm(input.value)===selectedSuggestion.key?{...selectedSuggestion}:null;
      const autoOwned=!!(selection?.autoCategory&&select&&norm(select.value)===norm(selection.autoCategory));
      const result=base.apply(this,arguments);
      window.__modPendingSuggestionCategory=undefined;
      selectedSuggestion=null;
      if(autoOwned)setTimeout(()=>{
        const next=document.getElementById('newCategoryV412');
        if(next&&norm(next.value)===norm(selection.autoCategory)){next.value='';next.dispatchEvent(new Event('change',{bubbles:true}));}
      },0);
      return result;
    };
    addWrapped=true;return true;
  }

  function persistRows(){
    try{
      if(typeof saveTasks==='function')saveTasks();
      if(typeof saveArchive==='function')saveArchive();
      if(typeof saveTasks!=='function'&&typeof saveArchive!=='function'&&typeof saveAll==='function')saveAll();
    }catch(error){console.error('V507 Aufgaben-Titel speichern:',error);throw error;}
  }

  function mergeTitles(sourceTitle,targetTitle){
    const source=clean(sourceTitle),target=clean(targetTitle),sourceKey=norm(source),targetKey=norm(target);
    if(!sourceKey||!targetKey)throw new Error('Quell- und Zieltitel müssen gesetzt sein.');
    if(sourceKey===targetKey)throw new Error('Quell- und Zieltitel sind identisch.');
    let changedTasks=0,changedArchive=0;
    taskRows().forEach(row=>{if(norm(row?.text)===sourceKey){row.text=target;changedTasks++;}});
    archiveRows().forEach(row=>{if(norm(row?.text)===sourceKey){row.text=target;changedArchive++;}});
    if(!changedTasks&&!changedArchive)throw new Error(`Der Titel „${source}“ wurde nicht gefunden.`);

    const map=categoryMap(),sourceCategory=clean(map[sourceKey]),targetCategory=clean(map[targetKey]);
    if(!targetCategory&&sourceCategory)map[targetKey]=sourceCategory;
    delete map[sourceKey];writeJson(CATEGORY_MAP_KEY,map);

    const prefs=preferences(),hidden={...(prefs.hidden||{})};
    delete hidden[sourceKey];prefs.hidden=hidden;writeJson(PREF_KEY,prefs);

    persistRows();
    try{window.__modLiveLogV453?.append?.('EDIT','INFO',`Aufgabentitel zusammengeführt: „${source}“ → „${target}“ · ${changedTasks+changedArchive} Einträge`);}catch(_){}
    if(typeof render==='function')render();
    return {source,target,changedTasks,changedArchive,total:changedTasks+changedArchive};
  }

  function closeManagerModal(){const container=document.getElementById('modalContainer');if(container)container.innerHTML='';}
  function openMergeModal(sourceTitle){
    const source=clean(sourceTitle),sourceKey=norm(source),groups=collectTitleGroups().filter(group=>group.key!==sourceKey).sort((a,b)=>a.name.localeCompare(b.name,'de-DE'));
    const container=document.getElementById('modalContainer');if(!container)return;
    const sourceGroup=collectTitleGroups().find(group=>group.key===sourceKey),sourceCount=sourceGroup?.count||0;
    container.innerHTML=`<div class="modal-overlay"><div class="modal v507-merge-modal"><div class="modal-title">🔗 AUFGABENTITEL ZUSAMMENFÜHREN</div><div class="v507-merge-source">${esc(source)} <strong>· ${sourceCount}×</strong></div><div class="v507-help">Alle aktiven und archivierten Vorkommen des Quelltitels werden rückwirkend auf den Zieltitel umbenannt. Damit laufen Statistik und Häufigkeit anschließend unter einem Namen.</div><label class="v507-label">BESTEHENDER ZIELTITEL</label><select id="v507MergeTarget" class="category-new-select-v412"><option value="">Bitte auswählen…</option>${groups.map(group=>`<option value="${esc(group.name)}">${esc(group.name)} · ${group.count}×</option>`).join('')}</select><label class="v507-label">ODER NEUER ZIELTITEL</label><input id="v507MergeNewTitle" class="category-input-v412" placeholder="Neuen einheitlichen Titel eingeben"><div class="modal-actions"><button class="modal-button secondary" id="v507MergeCancel">ABBRECHEN</button><button class="modal-button primary" id="v507MergeConfirm">ZUSAMMENFÜHREN</button></div><div id="v507MergeError" class="v507-error"></div></div></div>`;
    document.getElementById('v507MergeCancel')?.addEventListener('click',closeManagerModal);
    document.getElementById('v507MergeConfirm')?.addEventListener('click',()=>{
      const fresh=clean(document.getElementById('v507MergeNewTitle')?.value),existing=clean(document.getElementById('v507MergeTarget')?.value),target=fresh||existing;
      const error=document.getElementById('v507MergeError');
      try{if(!target)throw new Error('Bitte einen Zieltitel auswählen oder eingeben.');mergeTitles(source,target);closeManagerModal();}
      catch(reason){if(error)error.textContent=reason?.message||String(reason);}
    });
  }

  function filteredAdminGroups(){
    const query=norm(adminQuery);
    return collectTitleGroups().filter(group=>!query||group.key.includes(query)).sort((a,b)=>a.name.localeCompare(b.name,'de-DE'));
  }
  function adminRowsHtml(){
    const groups=filteredAdminGroups();
    if(!groups.length)return '<div class="statistics-empty-small">Keine passenden Aufgabentitel gefunden.</div>';
    return groups.map(group=>{
      const category=clean(group.category)||'OHNE KATEGORIE';
      return `<div class="v507-title-row ${group.hidden?'is-hidden':''}" data-v507-title-row="${esc(enc(group.name))}"><div class="v507-title-main"><div class="v507-title-name">${esc(group.name)}</div><div class="v507-title-meta">${group.count}× BISHER · ${group.openCount}× OFFEN · ${esc(category.toUpperCase())}</div>${group.hidden?'<div class="v507-hidden-badge">AUS VORSCHLÄGEN AUSGEBLENDET</div>':''}</div><div class="v507-title-actions"><button type="button" class="category-mini-v412" data-v507-toggle="${esc(enc(group.name))}">${group.hidden?'👁️ EINBLENDEN':'🙈 AUSBLENDEN'}</button><button type="button" class="category-mini-v412" data-v507-merge="${esc(enc(group.name))}">🔗 ZUSAMMENFÜHREN</button></div></div>`;
    }).join('');
  }
  function bindAdminActions(root){
    root?.querySelectorAll('[data-v507-toggle]').forEach(button=>button.addEventListener('click',()=>{
      const title=dec(button.dataset.v507Toggle),group=collectTitleGroups().find(entry=>entry.key===norm(title));setHidden(title,!group?.hidden);refreshAdminRows();
    }));
    root?.querySelectorAll('[data-v507-merge]').forEach(button=>button.addEventListener('click',()=>openMergeModal(dec(button.dataset.v507Merge))));
  }
  function refreshAdminRows(){
    const root=document.getElementById('v507TitleRows');if(!root)return;root.innerHTML=adminRowsHtml();bindAdminActions(root);
    const counter=document.getElementById('v507TitleCounter');if(counter)counter.textContent=String(collectTitleGroups().length);
  }

  function renderTitleManager(){
    if(typeof currentTab==='undefined'||currentTab!=='titles')return false;
    const panel=document.getElementById('inputPanel'),weight=document.getElementById('weightContainer'),container=document.getElementById('viewContainer');
    if(panel)panel.style.display='none';if(weight)weight.innerHTML='';if(!container)return false;
    const groups=collectTitleGroups(),hidden=groups.filter(group=>group.hidden).length;
    container.innerHTML=`<section class="v507-title-page"><div class="section-header"><div class="section-title">🧾 AUFGABENTITEL</div><div class="counter" id="v507TitleCounter">${groups.length}</div></div><div class="v507-help">Hier stehen ausschließlich Titel, die tatsächlich als Aufgabe vorhanden sind oder im Archiv vorkommen. Ausblenden entfernt nur den Vorschlag. Zusammenführen benennt aktive und archivierte Einträge rückwirkend um.</div><div class="v507-summary">${groups.length} bekannte Titel · ${hidden} ausgeblendet</div><input id="v507TitleSearch" class="category-input-v412" placeholder="Aufgabentitel durchsuchen…" value="${esc(adminQuery)}"><div id="v507TitleRows" class="v507-title-rows">${adminRowsHtml()}</div></section>`;
    const search=document.getElementById('v507TitleSearch');search?.addEventListener('input',()=>{adminQuery=search.value;refreshAdminRows();});
    bindAdminActions(document.getElementById('v507TitleRows'));
    return true;
  }

  function fixAllCategoryOrder(){
    try{
      if(typeof currentTab==='undefined'||currentTab!=='all')return false;
      const filter=document.getElementById('categoryFilterV412');
      if(filter){const uncategorized=[...filter.options].find(option=>option.value==='');if(uncategorized)filter.appendChild(uncategorized);}
      const roots=[document.getElementById('viewContainer'),...document.querySelectorAll('#viewContainer .section')].filter(Boolean);
      roots.forEach(root=>{
        const groups=[...root.children].filter(child=>child.classList?.contains('task-category-group-v473'));
        if(groups.length<2)return;
        groups.sort((a,b)=>{
          const ac=clean(a.dataset.v473Category),bc=clean(b.dataset.v473Category),au=norm(ac)==='ohne kategorie',bu=norm(bc)==='ohne kategorie';
          if(au!==bu)return au?1:-1;return ac.localeCompare(bc,'de-DE');
        });
        groups.forEach(group=>root.appendChild(group));
      });
      return true;
    }catch(error){console.warn('V507 Kategorie-Reihenfolge:',error);return false;}
  }

  function afterRender(){
    if(typeof currentTab!=='undefined'&&currentTab==='titles'){renderTitleManager();return;}
    fixAllCategoryOrder();setTimeout(fixAllCategoryOrder,0);
  }

  function install(){
    window.getKnownTaskSuggestions=getKnownTaskSuggestions;
    window.selectTaskSuggestion=selectTaskSuggestion;
    window.renderTaskSuggestions=renderTaskSuggestions;
    wrapAddTask();
    const previousRender=window.render;
    if(typeof previousRender==='function'&&!previousRender.__v507Wrapped){
      const wrapped=function(){const result=previousRender.apply(this,arguments);afterRender();return result;};
      wrapped.__v507Wrapped=true;window.render=wrapped;
    }
    afterRender();
  }

  const style=document.createElement('style');style.id='taskTitleLibraryV507Style';style.textContent=`
    #taskSuggestions.v507-scroll,.task-suggestions{max-height:min(58vh,520px);overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
    .v507-task-suggestion{min-height:54px}
    .v507-title-page{display:flex;flex-direction:column;gap:11px;padding-bottom:40px}.v507-help{font-size:11px;line-height:1.5;color:var(--mod-muted,#9aa3aa)}.v507-summary{font-size:9px;font-weight:900;letter-spacing:.5px;color:var(--mod-muted,#9aa3aa)}
    .v507-title-rows{display:flex;flex-direction:column;gap:8px}.v507-title-row{display:flex;gap:10px;align-items:center;padding:10px;border:1px solid var(--mod-border,#30363b);border-radius:12px;background:var(--mod-surface,#171b1f)}.v507-title-row.is-hidden{opacity:.62}.v507-title-main{flex:1;min-width:0}.v507-title-name{font-size:12px;font-weight:900;line-height:1.35}.v507-title-meta{margin-top:3px;font-size:8px;letter-spacing:.45px;color:var(--mod-muted,#9aa3aa)}.v507-hidden-badge{display:inline-block;margin-top:6px;padding:3px 6px;border:1px solid var(--mod-border,#30363b);border-radius:999px;font-size:7px;font-weight:900;letter-spacing:.45px}.v507-title-actions{display:flex;flex-direction:column;gap:6px;flex:0 0 auto}.v507-title-actions .category-mini-v412{width:auto;min-width:110px;padding:7px 8px;font-size:8px}.v507-merge-source{margin-bottom:10px;font-size:14px}.v507-label{display:block;margin:12px 0 5px;font-size:8px;font-weight:950;letter-spacing:.65px;color:var(--mod-muted,#9aa3aa)}.v507-error{min-height:18px;margin-top:8px;color:#ff8585;font-size:10px;line-height:1.4}
    @media(max-width:520px){.v507-title-row{align-items:stretch;flex-direction:column}.v507-title-actions{flex-direction:row}.v507-title-actions .category-mini-v412{flex:1;min-width:0}}
  `;document.head.appendChild(style);
  const suggestionBox=document.getElementById('taskSuggestions');suggestionBox?.classList.add('v507-scroll');

  install();
  window.addEventListener('load',()=>setTimeout(()=>{install();document.getElementById('taskSuggestions')?.classList.add('v507-scroll');},0));

  window.__modTaskTitleLibraryV507={
    version:BUILD_VERSION,
    collectTitleGroups,
    getKnownTaskSuggestions,
    selectTaskSuggestion,
    setHidden,
    isHidden,
    mergeTitles,
    renderTitleManager,
    fixAllCategoryOrder,
    knownOnlySuggestions:true,
    emptyFocusShowsAllOpen:true,
    unlimitedScrollableSuggestions:true,
    alwaysShowsUsageCount:true,
    knownCategoryAutoSelect:true,
    manualSuggestionHide:true,
    manualHistoricalMerge:true,
    archivedTitlesRenamedOnMerge:true,
    uncategorizedLastInAll:true,
    backupModulesUntouched:true,
    verify:()=>window.getKnownTaskSuggestions===getKnownTaskSuggestions&&window.selectTaskSuggestion===selectTaskSuggestion&&typeof window.__modBackupStabilityV506==='object'
  };
})();
