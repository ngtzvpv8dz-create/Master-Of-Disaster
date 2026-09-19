/* V504 · KATEGORIE BEIM ERSTELLEN STABIL
   - Eine im Neuanlage-Formular ausdrücklich gewählte Kategorie hat Vorrang.
   - Historie/Autovervollständigung darf die Auswahl nicht nachträglich überschreiben.
   - Ist keine Kategorie ausgewählt, bleibt die bisherige Vorschlags-/Lernlogik erhalten.
*/
(function(){
  'use strict';
  if(window.__modCategoryCreateStabilityV504)return;

  const BUILD_VERSION='V504';
  const MAP_KEY='masterOfDisasterCategoryNameMapV405';
  let addTaskWrapped=false;

  function clean(value){
    return String(value??'').trim().replace(/\s+/g,' ');
  }

  function norm(value){
    return clean(value).toLocaleLowerCase('de-DE');
  }

  function rows(){
    try{return Array.isArray(tasks)?tasks:[];}catch(_){return [];}
  }

  function selectedCategory(){
    try{return clean(document.getElementById('newCategoryV412')?.value||'');}
    catch(_){return '';}
  }

  function rememberCategory(task,category){
    if(!task||!category)return;
    try{
      const map=JSON.parse(localStorage.getItem(MAP_KEY)||'{}')||{};
      map[norm(task.text)]=category;
      localStorage.setItem(MAP_KEY,JSON.stringify(map));
    }catch(error){
      console.warn('V504 category map:',error);
    }
  }

  function persist(){
    try{
      if(typeof saveTasks==='function')saveTasks();
      else if(typeof saveAll==='function')saveAll();
    }catch(error){
      console.warn('V504 category save:',error);
    }
  }

  function rerender(){
    try{if(typeof render==='function')render();}
    catch(error){console.warn('V504 category render:',error);}
  }

  function enforceSelectedCategory(beforeIds,category){
    if(!category)return [];
    const fresh=rows().filter(task=>task&&!beforeIds.has(task.id));
    if(!fresh.length)return fresh;
    fresh.forEach(task=>{
      task.category=category;
      rememberCategory(task,category);
    });
    persist();
    rerender();
    return fresh;
  }

  function wrapAddTask(){
    if(addTaskWrapped||typeof window.addTask!=='function')return addTaskWrapped;
    const base=window.addTask;

    window.addTask=function(){
      const explicitCategory=selectedCategory();
      const beforeIds=new Set(rows().map(task=>task&&task.id));
      const result=base.apply(this,arguments);
      if(explicitCategory)enforceSelectedCategory(beforeIds,explicitCategory);
      return result;
    };

    addTaskWrapped=true;
    return true;
  }

  function ensure(){
    if(!wrapAddTask())setTimeout(ensure,40);
  }

  ensure();
  window.addEventListener('load',()=>setTimeout(ensure,0));

  window.__modCategoryCreateStabilityV504={
    version:BUILD_VERSION,
    wrapAddTask,
    selectedCategory,
    enforceSelectedCategory,
    explicitNewCategoryWins:true,
    suggestionCategoryFallbackOnly:true,
    dataSemanticsUntouched:true
  };
})();
