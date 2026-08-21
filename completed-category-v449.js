/* V449 · KATEGORIE BEI ERLEDIGTEN, NOCH NICHT ARCHIVIERTEN AUFGABEN ÄNDERN */
(function(){
  const BUILD_VERSION='V449';
  const STORAGE_KEY='masterOfDisasterCategoriesV405';

  function clean(value){
    return String(value??'').trim().replace(/\s+/g,' ');
  }

  function norm(value){
    return clean(value).toLocaleLowerCase('de-DE');
  }

  function esc(value){
    if(typeof escapeHtml==='function')return escapeHtml(String(value??''));
    return String(value??'').replace(/[&<>"]/g,char=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'
    }[char]));
  }

  function savedCategories(){
    let stored=[];
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      stored=raw?JSON.parse(raw):[];
    }catch(_){
      stored=[];
    }
    const seen=new Map();
    const remember=value=>{
      const category=clean(value);
      if(category&&!seen.has(norm(category)))seen.set(norm(category),category);
    };
    (Array.isArray(stored)?stored:[]).forEach(remember);
    (Array.isArray(tasks)?tasks:[]).forEach(row=>remember(row&&row.category));
    (Array.isArray(archive)?archive:[]).forEach(row=>remember(row&&row.category));
    return [...seen.values()].sort((a,b)=>a.localeCompare(b,'de'));
  }

  function categoryOptions(current){
    const selected=clean(current);
    return '<option value="">OHNE KATEGORIE</option>'+savedCategories().map(category=>
      `<option value="${esc(category)}" ${norm(category)===norm(selected)?'selected':''}>${esc(category.toUpperCase())}</option>`
    ).join('');
  }

  function persist(){
    if(typeof saveAll==='function'){
      saveAll();
      return;
    }
    try{
      localStorage.setItem('masterOfDisasterTasks',JSON.stringify(Array.isArray(tasks)?tasks:[]));
    }catch(error){
      console.warn('V449 category persist',error);
    }
  }

  function setCompletedCategory(row,value){
    if(!row||String(row.status)!=='completed')return false;
    row.category=clean(value)||null;
    persist();
    return true;
  }

  function openCompletedCategoryEditor(row){
    if(!row||String(row.status)!=='completed')return;
    const modal=document.getElementById('modalContainer');
    if(!modal)return;
    modal.innerHTML=`
      <div class="modal-overlay">
        <div class="modal archive-category-modal-v412">
          <div class="modal-title">🏷️ KATEGORIE ÄNDERN</div>
          <div class="archive-category-task-v412">${esc(row.text)}</div>
          <div class="category-page-help-v412">Nur die Kategorie dieser erledigten Aufgabe wird geändert. Status, Zeiten und Abschluss bleiben unverändert.</div>
          <select id="completedCategoryV449" class="category-new-select-v412">${categoryOptions(row.category)}</select>
          <div class="modal-actions">
            <button class="modal-button secondary" id="completedCategoryCancelV449">ABBRECHEN</button>
            <button class="modal-button primary" id="completedCategorySaveV449">SPEICHERN</button>
          </div>
        </div>
      </div>`;
    document.getElementById('completedCategoryCancelV449')?.addEventListener('click',()=>{modal.innerHTML='';});
    document.getElementById('completedCategorySaveV449')?.addEventListener('click',()=>{
      const selected=document.getElementById('completedCategoryV449')?.value||'';
      setCompletedCategory(row,selected);
      modal.innerHTML='';
      if(typeof render==='function')render();
    });
  }

  function enhanceCompletedCategoryBadges(){
    const container=document.getElementById('viewContainer');
    const api=window.__modCategoriesV412;
    if(!container||typeof api?.rowForCard!=='function')return;
    container.querySelectorAll('.task:not(.archive-task)').forEach(card=>{
      const row=api.rowForCard(card);
      if(!row||String(row.status)!=='completed')return;
      const badge=card.querySelector('.category-inline-v412');
      if(!badge)return;
      badge.classList.add('completed-category-click-v449');
      badge.style.pointerEvents='auto';
      badge.style.cursor='pointer';
      badge.setAttribute('role','button');
      badge.setAttribute('tabindex','0');
      badge.setAttribute('title','Kategorie ändern');
      if(badge.dataset.completedCategoryV449==='1')return;
      badge.dataset.completedCategoryV449='1';
      const open=event=>{
        event?.preventDefault?.();
        event?.stopPropagation?.();
        openCompletedCategoryEditor(row);
      };
      badge.addEventListener('click',open);
      badge.addEventListener('keydown',event=>{
        if(event.key==='Enter'||event.key===' ')open(event);
      });
    });
  }

  const previousRender=typeof render==='function'?render:null;
  if(previousRender){
    window.render=function(){
      const result=previousRender.apply(this,arguments);
      setTimeout(enhanceCompletedCategoryBadges,0);
      return result;
    };
  }

  window.__modCompletedCategoryV449={
    version:BUILD_VERSION,
    setCompletedCategory,
    openCompletedCategoryEditor,
    enhanceCompletedCategoryBadges
  };
  window.addEventListener('load',()=>setTimeout(enhanceCompletedCategoryBadges,300));
})();
