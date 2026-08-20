/* V410 · KATEGORIEN · EDIT-WORKFLOW */
(function(){
  const BUILD_VERSION="V410";
  const STORAGE_KEY="masterOfDisasterCategoriesV405";
  const MAP_KEY="masterOfDisasterCategoryNameMapV405";
  const FILTER_KEY="masterOfDisasterCategoryFilterV405";
  let selectedNewCategory="";
  let activeFilter=readText(FILTER_KEY,"all")||"all";
  const editDraft=new Map();

  function readJson(k,f){try{const x=localStorage.getItem(k);return x?JSON.parse(x):f;}catch(_){return f;}}
  function readText(k,f){try{return localStorage.getItem(k)||f;}catch(_){return f;}}
  function write(k,v){try{localStorage.setItem(k,v);}catch(_){}}
  function norm(v){return String(v??"").trim().replace(/\s+/g," ").toLocaleLowerCase("de-DE");}
  function clean(v){return String(v??"").trim().replace(/\s+/g," ");}
  function esc(v){return typeof escapeHtml==="function"?escapeHtml(String(v??"")):String(v??"").replace(/[&<>\"]/g,m=>({"&":"&amp;","<":"&lt;","?":"?",">":"&gt;",'"':"&quot;"}[m]));}
  function allRows(){return [...(Array.isArray(tasks)?tasks:[]),...(Array.isArray(archive)?archive:[])];}
  function persist(){try{if(typeof saveAll==="function")saveAll();else{write("masterOfDisasterTasks",JSON.stringify(tasks||[]));write("masterOfDisasterArchive",JSON.stringify(archive||[]));}}catch(e){console.warn("V410 category persist",e);}}
  function categories(){const seen=new Map();readJson(STORAGE_KEY,[]).forEach(c=>{c=clean(c);if(c)seen.set(norm(c),c);});allRows().forEach(r=>{const c=clean(r&&r.category);if(c&&!seen.has(norm(c)))seen.set(norm(c),c);});return [...seen.values()].sort((a,b)=>a.localeCompare(b,"de"));}
  function saveCategories(list){write(STORAGE_KEY,JSON.stringify([...new Map(list.map(c=>[norm(c),clean(c)])).values()].filter(Boolean).sort((a,b)=>a.localeCompare(b,"de"))));}
  function addCategory(name){const c=clean(name);if(!c)return false;saveCategories([...categories(),c]);return true;}
  function renameCategory(oldName,newName){const oldC=clean(oldName),newC=clean(newName);if(!oldC||!newC)return false;allRows().forEach(r=>{if(norm(r&&r.category)===norm(oldC))r.category=newC;});const map=readJson(MAP_KEY,{});Object.keys(map).forEach(k=>{if(norm(map[k])===norm(oldC))map[k]=newC;});write(MAP_KEY,JSON.stringify(map));saveCategories(categories().filter(c=>norm(c)!==norm(oldC)).concat(newC));persist();return true;}
  function deleteCategory(name){const c=clean(name);if(!c)return;allRows().forEach(r=>{if(norm(r&&r.category)===norm(c))r.category=null;});const map=readJson(MAP_KEY,{});Object.keys(map).forEach(k=>{if(norm(map[k])===norm(c))delete map[k];});write(MAP_KEY,JSON.stringify(map));saveCategories(categories().filter(x=>norm(x)!==norm(c)));if(norm(selectedNewCategory)===norm(c))selectedNewCategory="";if(norm(activeFilter)===norm(c)){activeFilter="all";write(FILTER_KEY,"all");}persist();}
  function setOne(row,c){if(!row)return;row.category=clean(c)||null;persist();}
  function setAllByName(text,c){const cat=clean(c)||null,n=norm(text);let changed=0;(tasks||[]).forEach(r=>{if(norm(r&&r.text)===n){r.category=cat;changed++;}});(archive||[]).forEach(r=>{if(norm(r&&r.text)===n){r.category=cat;changed++;}});const map=readJson(MAP_KEY,{});if(cat)map[n]=cat;else delete map[n];write(MAP_KEY,JSON.stringify(map));persist();return changed;}
  function applyLearned(task){if(!task||clean(task.category))return;const c=readJson(MAP_KEY,{})[norm(task.text)];if(c)task.category=c;}
  function categoryOptions(current="",includeAll=false){const c=clean(current);return `${includeAll?'<option value="all">ALLE KATEGORIEN</option>':''}<option value="">OHNE KATEGORIE</option>`+categories().map(x=>`<option value="${esc(x)}" ${norm(x)===norm(c)?"selected":""}>${esc(x.toUpperCase())}</option>`).join("");}

  function rowForCard(card){
    if(card.classList.contains("archive-task")){
      const number=clean(card.querySelector(".archive-number")?.textContent),m=number.match(/^A(\d+)$/i);
      if(m){const r=(archive||[]).find(x=>Number(x&&x.archiveNumber)===Number(m[1]));if(r)return r;}
      const text=clean(card.querySelector(".task-text")?.textContent);return (archive||[]).find(x=>norm(x&&x.text)===norm(text))||null;
    }
    const text=clean(card.querySelector(".task-text")?.textContent);const list=(tasks||[]).filter(x=>norm(x&&x.text)===norm(text));
    return list.find(x=>String(x&&x.id)===String(card.dataset.taskId||""))||list[0]||null;
  }

  function enhanceInput(){const panel=document.getElementById("inputPanel");if(!panel||document.getElementById("categoryRowV410"))return;const row=document.createElement("div");row.className="option-row";row.id="categoryRowV410";row.innerHTML=`<span class="option-label">KATEGORIE</span><select id="newCategoryV410" class="category-new-select-v410">${categoryOptions(selectedNewCategory)}</select>`;panel.insertBefore(row,panel.querySelector(".add-button")||null);row.querySelector("select")?.addEventListener("change",e=>selectedNewCategory=e.target.value||"");}

  function enhanceToolbar(){if(!["all","archive"].includes(currentTab))return;const container=document.getElementById("viewContainer");if(!container||document.getElementById("categoryToolbarV410"))return;const bar=document.createElement("div");bar.id="categoryToolbarV410";bar.className="category-toolbar-v410";bar.innerHTML=`<div class="category-toolbar-label-v410">🏷️ KATEGORIEN</div><div class="category-toolbar-controls-v410"><select id="categoryFilterV410" class="category-new-select-v410">${categoryOptions(activeFilter==="all"?"":activeFilter,true)}</select><button class="option-button" id="categoryManagerOpenV410">VERWALTEN</button></div>`;container.prepend(bar);const sel=bar.querySelector("select");sel.value=activeFilter;sel.addEventListener("change",e=>{activeFilter=e.target.value||"all";write(FILTER_KEY,activeFilter);applyFilter();});bar.querySelector("#categoryManagerOpenV410")?.addEventListener("click",openManager);}

  function enhanceInlineBadges(){const container=document.getElementById("viewContainer");if(!container)return;container.querySelectorAll(".task, .archive-task").forEach(card=>{card.querySelectorAll(".category-badge-v409,.category-inline-v410").forEach(x=>x.remove());const row=rowForCard(card);if(!row)return;const type=card.querySelector(".task-type-badge");if(!type)return;const badge=document.createElement("span");badge.className="task-type-badge category-inline-v410";badge.textContent=`🏷️ ${(clean(row.category)||"OHNE KATEGORIE").toUpperCase()}`;type.insertAdjacentElement("afterend",badge);});}

  function enhanceEditCategory(){
    if(typeof editingTaskId==="undefined"||editingTaskId==null)return;
    const task=(tasks||[]).find(t=>String(t&&t.id)===String(editingTaskId));if(!task)return;
    const area=document.querySelector(`.task .edit-area`);if(!area||area.querySelector("#editCategoryRowV410"))return;
    if(!editDraft.has(String(task.id)))editDraft.set(String(task.id),{category:clean(task.category),scope:"one"});
    const draft=editDraft.get(String(task.id));
    const row=document.createElement("div");row.id="editCategoryRowV410";row.className="option-row category-edit-row-v410";
    row.innerHTML=`<span class="option-label">KATEGORIE</span><select id="editCategoryV410" class="category-new-select-v410">${categoryOptions(draft.category)}</select><div class="category-edit-scope-v410"><button type="button" class="option-button ${draft.scope==='one'?'selected':''}" data-scope-v410="one">NUR DIESE</button><button type="button" class="option-button ${draft.scope==='all'?'selected':''}" data-scope-v410="all">ALLE GLEICHNAMIGEN</button></div>`;
    area.querySelector(".edit-options")?.appendChild(row);
    row.querySelector("select")?.addEventListener("change",e=>{draft.category=e.target.value||"";});
    row.querySelectorAll("[data-scope-v410]").forEach(b=>b.addEventListener("click",()=>{draft.scope=b.dataset.scopeV410;row.querySelectorAll("[data-scope-v410]").forEach(x=>x.classList.toggle("selected",x===b));}));
  }

  function enhanceActions(){const container=document.getElementById("viewContainer");if(!container)return;container.querySelectorAll(".task:not(.archive-task)").forEach(card=>{const row=rowForCard(card),actions=card.querySelector(".icon-actions");if(!row||!actions)return;const abort=actions.querySelector(".abort-button");const del=[...actions.querySelectorAll("button")].find(b=>(b.getAttribute("onclick")||"").includes("askDelete("));if(row.status==="open"&&abort&&del)actions.insertBefore(abort,del);if(["running","paused"].includes(String(row.status||""))){let edit=actions.querySelector(".category-title-edit-v410");if(!edit){edit=document.createElement("button");edit.type="button";edit.className="icon-action category-title-edit-v410";edit.title="Bearbeiten";edit.textContent="✏️";edit.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();if(typeof startEditing==="function")startEditing(row.id);});}if(abort)actions.insertBefore(edit,abort);else actions.appendChild(edit);}});}

  function applyFilter(){if(!["all","archive"].includes(currentTab))return;const container=document.getElementById("viewContainer");if(!container)return;container.querySelectorAll(".task, .archive-task").forEach(card=>{const row=rowForCard(card),cat=clean(row&&row.category);card.style.display=activeFilter==="all"||((activeFilter===""&&!cat)||norm(cat)===norm(activeFilter))?"":"none";});}

  function renderAdmin(){return categories().length?categories().map(c=>`<div class="category-admin-row-v410"><span>${esc(c)}</span><div><button class="category-mini-v410" data-rename-v410="${esc(c)}">✏️</button><button class="category-mini-v410" data-delete-v410="${esc(c)}">🗑️</button></div></div>`).join(""):'<div class="statistics-empty-small">Noch keine Kategorien angelegt.</div>';}
  function openManager(){const modal=document.getElementById("modalContainer");if(!modal)return;modal.innerHTML=`<div class="modal-overlay"><div class="modal category-manager-v410"><div class="modal-title">🏷️ KATEGORIEN VERWALTEN</div><div class="category-create-v410"><input id="categoryNewNameV410" class="category-input-v410" placeholder="Neue Kategorie, z. B. Küche"><button class="option-button" id="categoryAddV410">+ ANLEGEN</button></div><div class="category-admin-v410">${renderAdmin()}</div><div class="category-manager-note-v410">Zuordnung erfolgt im Bearbeiten-Fenster der Aufgabe.</div><div class="modal-actions"><button class="modal-button secondary" id="categoryCloseV410">SCHLIESSEN</button></div></div></div>`;document.getElementById("categoryCloseV410")?.addEventListener("click",()=>modal.innerHTML="");document.getElementById("categoryAddV410")?.addEventListener("click",()=>{if(addCategory(document.getElementById("categoryNewNameV410")?.value))openManager();});modal.querySelectorAll("[data-rename-v410]").forEach(b=>b.addEventListener("click",()=>{const old=b.dataset.renameV410,next=prompt(`Kategorie „${old}“ umbenennen in:`,old);if(next&&renameCategory(old,next))openManager();}));modal.querySelectorAll("[data-delete-v410]").forEach(b=>b.addEventListener("click",()=>{const c=b.dataset.deleteV410;if(confirm(`Kategorie „${c}“ löschen? Aufgaben bleiben erhalten und werden „Ohne Kategorie“.`)){deleteCategory(c);openManager();}}));}

  const originalAddTask=typeof addTask==="function"?addTask:null;if(originalAddTask){addTask=function(){const before=new Set((tasks||[]).map(t=>t&&t.id));const result=originalAddTask.apply(this,arguments);const fresh=(tasks||[]).filter(t=>!before.has(t&&t.id));fresh.forEach(t=>{if(selectedNewCategory){t.category=selectedNewCategory;const map=readJson(MAP_KEY,{});map[norm(t.text)]=selectedNewCategory;write(MAP_KEY,JSON.stringify(map));}else applyLearned(t);});if(fresh.length){persist();render();}return result;};}
  const originalSaveEdit=typeof saveEdit==="function"?saveEdit:null;if(originalSaveEdit){saveEdit=function(id){const task=(tasks||[]).find(t=>String(t&&t.id)===String(id)),draft=editDraft.get(String(id));if(task&&draft){if(draft.scope==="all")setAllByName(task.text,draft.category);else setOne(task,draft.category);editDraft.delete(String(id));}return originalSaveEdit.apply(this,arguments);};}
  const originalCancelEditing=typeof cancelEditing==="function"?cancelEditing:null;if(originalCancelEditing){cancelEditing=function(){if(typeof editingTaskId!=="undefined"&&editingTaskId!=null)editDraft.delete(String(editingTaskId));return originalCancelEditing.apply(this,arguments);};}

  function afterRender(){enhanceInput();enhanceToolbar();enhanceInlineBadges();enhanceEditCategory();enhanceActions();applyFilter();}
  const previousRender=typeof render==="function"?render:null;if(previousRender){render=function(){const r=previousRender.apply(this,arguments);afterRender();return r;};}
  window.openCategoryManagerV410=openManager;window.__modCategoriesV410={version:BUILD_VERSION,normalize:norm,setAllByName,applyFilter};window.addEventListener("load",()=>setTimeout(afterRender,100));
})();
