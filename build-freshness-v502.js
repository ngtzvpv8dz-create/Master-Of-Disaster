/* V502 · DYNAMISCHE BUILD-FRISCHE
   - DEV zeigt Version und Build-Zeit aus den automatisch erzeugten Repository-Metriken
   - statische alte Build-Angaben werden nur noch als Fallback benutzt
   - bei Fokus/DEV-Aufruf wird ohne Browsercache nach dem aktuellen Stand gefragt
*/
(function(){
  'use strict';
  if(window.__modBuildFreshnessV502)return;

  const BUILD_VERSION='V502';
  const METRICS_URL='./development-metrics.json';
  const FALLBACK={version:BUILD_VERSION,generatedAt:'28.08.2026 · 12:20'};
  let current={...FALLBACK};
  let loadPromise=null;
  let lastLoadAt=0;
  let observer=null;

  function versionNumber(value){
    const match=String(value||'').match(/^V(\d+)$/i);
    return match?Number(match[1]):0;
  }

  function loadedVersion(){
    let best=versionNumber(BUILD_VERSION);
    try{
      Object.keys(window).forEach(key=>{
        if(!/^__mod/i.test(key))return;
        const value=window[key];
        const n=versionNumber(value&&value.version);
        if(n>best)best=n;
      });
    }catch(_){}
    return `V${best}`;
  }

  function normalizeMeta(meta){
    const metricVersion=versionNumber(meta?.version)?String(meta.version).toUpperCase():null;
    const loaded=loadedVersion();
    const version=versionNumber(metricVersion)>=versionNumber(loaded)?metricVersion:loaded;
    const generatedAt=String(meta?.generatedAt||current.generatedAt||FALLBACK.generatedAt).trim();
    return {version,generatedAt,build:`${generatedAt} Uhr`};
  }

  function patchDevCard(){
    const card=document.querySelector('.dev-build-card');
    if(!card)return false;
    card.querySelectorAll('.dev-build-item').forEach(item=>{
      const label=String(item.querySelector('.dev-build-label')?.textContent||'').trim().toUpperCase();
      const value=item.querySelector('.dev-build-value');
      if(!value)return;
      if(label==='VERSION')value.textContent=current.version;
      if(label==='BUILD')value.textContent=current.build;
    });
    card.dataset.v502FreshBuild='true';
    return true;
  }

  function applyMeta(meta){
    current=normalizeMeta(meta);
    window.__MOD_BUILD__={version:current.version,date:current.generatedAt.split(' · ')[0]||'',time:current.generatedAt.split(' · ')[1]||'',build:current.build,dynamic:true,source:'development-metrics.json'};
    window.__modDevVersion={version:current.version,build:current.build,dynamic:true,source:'development-metrics.json',patch:patchDevCard};
    patchDevCard();
    try{window.__modDevelopmentStatsCurrentV476?.render?.();}catch(_){}
    return current;
  }

  async function load(force=false){
    const now=Date.now();
    if(!force&&now-lastLoadAt<15000)return current;
    if(loadPromise)return loadPromise;
    lastLoadAt=now;
    loadPromise=(async()=>{
      try{
        const response=await fetch(`${METRICS_URL}?v=${Date.now()}`,{cache:'no-store'});
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        const metrics=await response.json();
        applyMeta(metrics);
      }catch(error){
        console.warn('V502 Build-Frische:',error);
        applyMeta(current);
      }finally{loadPromise=null;}
      return current;
    })();
    return loadPromise;
  }

  function observe(){
    if(observer)return;
    const root=document.getElementById('viewContainer');
    if(!root)return;
    observer=new MutationObserver(()=>patchDevCard());
    observer.observe(root,{childList:true,subtree:true});
  }

  const previousRender=typeof window.render==='function'?window.render:null;
  if(previousRender){
    window.render=function(){
      const result=previousRender.apply(this,arguments);
      setTimeout(patchDevCard,0);
      return result;
    };
  }

  applyMeta(FALLBACK);
  observe();
  load(true);
  window.addEventListener('load',()=>setTimeout(()=>{observe();load(true);patchDevCard();},350));
  window.addEventListener('focus',()=>load(false));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')load(false);});
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-tab="dev"]'))setTimeout(()=>{load(true);patchDevCard();},100);},true);

  window.__modBuildFreshnessV502={version:BUILD_VERSION,load,patch:patchDevCard,get current(){return {...current};},dynamicFromMetrics:true,noStoreFetch:true};
})();

/* V502.3 · TASK-BEARBEITUNG + KATEGORIE-GRUPPIERUNG HOTFIX
   - Bearbeiten-Karten behalten ihre Aufgaben-ID und damit ihre Kategoriegruppe
   - Fälligkeitsänderungen rendern den iOS-Datumspicker während des Bearbeitens nicht weg
   - Abbrechen stellt die ursprüngliche Fälligkeit wieder her
   - gruppierte Kategorien werden deutsch-alphabetisch sortiert
*/
(function(){
  'use strict';
  if(window.__modTaskEditGroupingFixV5023)return;

  const PATCH_VERSION='V502.3';
  const dueSnapshots=new Map();
  const categoryCollator=new Intl.Collator('de-DE',{sensitivity:'base',numeric:true});

  function taskById(id){
    try{
      return (Array.isArray(tasks)?tasks:[]).find(task=>String(task?.id)===String(id))||null;
    }catch(_){
      return null;
    }
  }

  function currentEditingId(){
    try{
      return typeof editingTaskId!=='undefined'&&editingTaskId!==null?editingTaskId:null;
    }catch(_){
      return null;
    }
  }

  function isEditing(id){
    const active=currentEditingId();
    return active!==null&&String(active)===String(id);
  }

  function snapshotDue(id){
    const task=taskById(id);
    if(!task)return false;
    const key=String(id);
    if(!dueSnapshots.has(key)){
      dueSnapshots.set(key,{
        dueDate:task.dueDate||null,
        dueMode:task.dueMode||'none'
      });
    }
    return true;
  }

  function restoreDue(id){
    const key=String(id);
    const snapshot=dueSnapshots.get(key);
    const task=taskById(id);
    if(!snapshot||!task)return false;
    task.dueDate=snapshot.dueDate;
    task.dueMode=snapshot.dueMode;
    return true;
  }

  function assignGlobal(name,value){
    try{window[name]=value;}catch(_){}
    try{
      if(name==='taskCard')taskCard=value;
      if(name==='startEditing')startEditing=value;
      if(name==='saveEdit')saveEdit=value;
      if(name==='cancelEditing')cancelEditing=value;
      if(name==='setTaskDueDateV418')setTaskDueDateV418=value;
    }catch(_){}
  }

  const previousTaskCard=typeof window.taskCard==='function'?window.taskCard:null;
  if(previousTaskCard){
    const wrappedTaskCard=function(task,options){
      const card=previousTaskCard.apply(this,arguments);
      if(card&&task&&task.id!==null&&typeof task.id!=='undefined'){
        card.dataset.id=String(task.id);
      }
      return card;
    };
    assignGlobal('taskCard',wrappedTaskCard);
  }

  const previousStartEditing=typeof window.startEditing==='function'?window.startEditing:null;
  if(previousStartEditing){
    const wrappedStartEditing=function(id){
      snapshotDue(id);
      return previousStartEditing.apply(this,arguments);
    };
    assignGlobal('startEditing',wrappedStartEditing);
  }

  const previousSetTaskDueDate=typeof window.setTaskDueDateV418==='function'?window.setTaskDueDateV418:null;
  if(previousSetTaskDueDate){
    const wrappedSetTaskDueDate=function(id,value){
      const task=taskById(id);
      if(task&&isEditing(id)){
        snapshotDue(id);
        const next=String(value||'').trim();
        task.dueDate=next||null;
        task.dueMode=next?'deadline':'none';
        return task.dueDate;
      }
      return previousSetTaskDueDate.apply(this,arguments);
    };
    assignGlobal('setTaskDueDateV418',wrappedSetTaskDueDate);
  }

  const previousSaveEdit=typeof window.saveEdit==='function'?window.saveEdit:null;
  if(previousSaveEdit){
    const wrappedSaveEdit=function(id){
      const result=previousSaveEdit.apply(this,arguments);
      dueSnapshots.delete(String(id));
      return result;
    };
    assignGlobal('saveEdit',wrappedSaveEdit);
  }

  const previousCancelEditing=typeof window.cancelEditing==='function'?window.cancelEditing:null;
  if(previousCancelEditing){
    const wrappedCancelEditing=function(){
      const id=currentEditingId();
      if(id!==null&&restoreDue(id)){
        try{if(typeof saveTasks==='function')saveTasks();}catch(_){}
      }
      const result=previousCancelEditing.apply(this,arguments);
      if(id!==null)dueSnapshots.delete(String(id));
      return result;
    };
    assignGlobal('cancelEditing',wrappedCancelEditing);
  }

  function categoryName(group){
    return String(group?.dataset?.v473Category||'').trim();
  }

  function sortGroupedCategories(){
    const container=document.getElementById('viewContainer');
    if(!container)return 0;
    const groups=[...container.querySelectorAll('.task-category-group-v473')];
    const parents=[...new Set(groups.map(group=>group.parentElement).filter(Boolean))];
    let moved=0;

    parents.forEach(parent=>{
      const direct=[...parent.children].filter(child=>child.classList?.contains('task-category-group-v473'));
      if(direct.length<2)return;
      const sorted=[...direct].sort((a,b)=>categoryCollator.compare(categoryName(a),categoryName(b)));
      if(sorted.every((group,index)=>group===direct[index]))return;

      const marker=document.createComment('v5023-category-sort');
      parent.insertBefore(marker,direct[0]);
      sorted.forEach(group=>parent.insertBefore(group,marker));
      marker.remove();
      moved+=sorted.length;
    });

    return moved;
  }

  const previousRender=typeof window.render==='function'?window.render:null;
  if(previousRender){
    window.render=function(){
      const result=previousRender.apply(this,arguments);
      sortGroupedCategories();
      setTimeout(sortGroupedCategories,0);
      return result;
    };
  }

  sortGroupedCategories();
  setTimeout(sortGroupedCategories,0);
  window.addEventListener('load',()=>setTimeout(sortGroupedCategories,0));

  window.__modTaskEditGroupingFixV5023={
    version:'V502',
    patchVersion:PATCH_VERSION,
    sortGroupedCategories,
    editCardIdentityPreserved:true,
    dueDateDraftWhileEditing:true,
    cancelRestoresDueDate:true,
    groupedCategoriesAlphabetical:true,
    dataSemanticsUntouched:true
  };
})();
