/* V409 · KATEGORIEN KONSOLIDIERT
   Eine einzige Kategorie-Laufzeitschicht statt V405/V406/V408-Kaskade.
   Bestehende Storage-Keys und task/archive.category bleiben unverändert.
*/
(function(){
  const BUILD_VERSION="V409";
  const STORAGE_KEY="masterOfDisasterCategoriesV405";
  const MAP_KEY="masterOfDisasterCategoryNameMapV405";
  const FILTER_KEY="masterOfDisasterCategoryFilterV405";
  let selectedNewCategory="";
  let activeFilter=readText(FILTER_KEY,"all")||"all";

  function readJson(k,f){try{const x=localStorage.getItem(k);return x?JSON.parse(x):f;}catch(_){return f;}}
  function readText(k,f){try{return localStorage.getItem(k)||f;}catch(_){return f;}}
  function write(k,v){try{localStorage.setItem(k,v);}catch(_){}}
  function norm(v){return String(v??"").trim().replace(/\s+/g," ").toLocaleLowerCase("de-DE");}
  function clean(v){return String(v??"").trim().replace(/\s+/g," ");}
  function esc(v){return typeof escapeHtml==="function"?escapeHtml(String(v??"")):String(v??"").replace(/[&<>\"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));}
  function allRows(){return [...(Array.isArray(tasks)?tasks:[]),...(Array.isArray(archive)?archive:[])];}
  function persist(){try{if(typeof saveAll==="function")saveAll();else{write("masterOfDisasterTasks",JSON.stringify(tasks||[]));write("masterOfDisasterArchive",JSON.stringify(archive||[]));}}catch(e){console.warn("V409 category persist",e);}}
  function categories(){
    const seen=new Map();readJson(STORAGE_KEY,[]).forEach(c=>{c=clean(c);if(c)seen.set(norm(c),c);});
    allRows().forEach(r=>{const c=clean(r&&r.category);if(c&&!seen.has(norm(c)))seen.set(norm(c),c);});
    return [...seen.values()].sort((a,b)=>a.localeCompare(b,"de"));
  }
  function saveCategories(list){write(STORAGE_KEY,JSON.stringify([...new Map(list.map(c=>[norm(c),clean(c)])).values()].filter(Boolean).sort((a,b)=>a.localeCompare(b,"de"))));}
  function addCategory(name){const c=clean(name);if(!c)return false;saveCategories([...categories(),c]);return true;}
  function renameCategory(oldName,newName){const oldC=clean(oldName),newC=clean(newName);if(!oldC||!newC)return false;allRows().forEach(r=>{if(norm(r&&r.category)===norm(oldC))r.category=newC;});const map=readJson(MAP_KEY,{});Object.keys(map).forEach(k=>{if(norm(map[k])===norm(oldC))map[k]=newC;});write(MAP_KEY,JSON.stringify(map));saveCategories(categories().filter(c=>norm(c)!==norm(oldC)).concat(newC));persist();return true;}
  function deleteCategory(name){const c=clean(name);if(!c)return;allRows().forEach(r=>{if(norm(r&&r.category)===norm(c))r.category=null;});const map=readJson(MAP_KEY,{});Object.keys(map).forEach(k=>{if(norm(map[k])===norm(c))delete map[k];});write(MAP_KEY,JSON.stringify(map));saveCategories(categories().filter(x=>norm(x)!==norm(c)));if(norm(selectedNewCategory)===norm(c))selectedNewCategory="";if(norm(activeFilter)===norm(c)){activeFilter="all";write(FILTER_KEY,"all");}persist();}
  function setOne(row,c){if(!row)return;row.category=clean(c)||null;persist();}
  function setAllByName(text,c){const cat=clean(c)||null,n=norm(text);let changed=0;(tasks||[]).forEach(r=>{if(norm(r&&r.text)===n){r.category=cat;changed++;}});(archive||[]).forEach(r=>{if(norm(r&&r.text)===n){r.category=cat;changed++;}});const map=readJson(MAP_KEY,{});if(cat)map[n]=cat;else delete map[n];write(MAP_KEY,JSON.stringify(map));persist();return changed;}
  function applyLearned(task){if(!task||clean(task.category))return;const c=readJson(MAP_KEY,{})[norm(task.text)];if(c)task.category=c;}

  function resolveTaskCard(card){
    if(card.classList.contains("archive-task"))return null;
    const id=card.dataset.modTaskId;if(id){const byId=(tasks||[]).find(r=>String(r&&r.id)===id);if(byId)return byId;}
    const text=clean(card.querySelector(".task-text")?.textContent);if(!text)return null;
    const list=(tasks||[]).filter(r=>norm(r&&r.text)===norm(text));return list[0]||null;
  }
  function resolveArchiveCard(card){
    const number=clean(card.querySelector(".archive-number")?.textContent);const m=number.match(/^A(\d+)$/i);if(m){const byNo=(archive||[]).find(r=>Number(r&&r.archiveNumber)===Number(m[1]));if(byNo)return byNo;}
    const text=clean(card.querySelector(".task-text")?.textContent);const list=(archive||[]).filter(r=>norm(r&&r.text)===norm(text));return list[0]||null;
  }
  function resolveRow(card){return card.classList.contains("archive-task")?resolveArchiveCard(card):resolveTaskCard(card);}

  function openPicker(card){
    const row=resolveRow(card);if(!row)return;const text=clean(row.text),current=clean(row.category),modal=document.getElementById("modalContainer");if(!modal)return;
    const sameOpen=(tasks||[]).filter(r=>norm(r&&r.text)===norm(text)).length,sameArchive=(archive||[]).filter(r=>norm(r&&r.text)===norm(text)).length;
    modal.innerHTML=`<div class="modal-overlay" id="catPickerV409"><div class="modal category-picker-v409"><div class="modal-title">🏷️ KATEGORIE AUSWÄHLEN</div><div class="category-picker-task-v409">${esc(text)}</div><div class="category-picker-grid-v409">${["",...categories()].map(c=>`<button type="button" class="category-choice-v409 ${norm(c)===norm(current)?"selected":""}" data-cat-v409="${esc(c)}">${c?esc(c.toUpperCase()):"OHNE KATEGORIE"}</button>`).join("")}</div><div class="category-picker-hint-v409">${sameOpen} aktuell · ${sameArchive} Archiv</div><div class="category-picker-scope-v409"><button class="modal-button" id="catOneV409">NUR DIESE</button><button class="modal-button primary" id="catAllV409">ALLE GLEICHNAMIGEN</button></div><button class="modal-button secondary category-picker-cancel-v409" id="catCancelV409">ZURÜCK</button></div></div>`;
    let selected=current;modal.querySelectorAll("[data-cat-v409]").forEach(b=>b.addEventListener("click",()=>{selected=b.dataset.catV409||"";modal.querySelectorAll("[data-cat-v409]").forEach(x=>x.classList.toggle("selected",x===b));}));
    document.getElementById("catOneV409")?.addEventListener("click",()=>{setOne(row,selected);modal.innerHTML="";render();});
    document.getElementById("catAllV409")?.addEventListener("click",()=>{setAllByName(text,selected);modal.innerHTML="";render();});
    document.getElementById("catCancelV409")?.addEventListener("click",()=>modal.innerHTML="");
  }

  function enhanceCards(){
    const container=document.getElementById("viewContainer");if(!container)return;
    container.querySelectorAll(".task, .archive-task").forEach(card=>{
      const row=resolveRow(card);if(!row)return;if(!card.classList.contains("archive-task"))card.dataset.modTaskId=String(row.id);
      card.classList.add("category-card-v409");
      let badge=card.querySelector(":scope > .category-badge-v409");if(!badge){badge=document.createElement("button");badge.type="button";badge.className="category-badge-v409";card.appendChild(badge);badge.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();openPicker(card);});}
      badge.innerHTML=`🏷️ <span>${esc((clean(row.category)||"OHNE KATEGORIE").toUpperCase())}</span>`;
    });
  }

  function enhanceEditButtons(){
    const container=document.getElementById("viewContainer");if(!container)return;
    container.querySelectorAll(".task:not(.archive-task)").forEach(card=>{const row=resolveRow(card);if(!row||!["running","paused"].includes(String(row.status||"")))return;const actions=card.querySelector(".icon-actions");if(!actions||actions.querySelector(".category-title-edit-v409"))return;const b=document.createElement("button");b.type="button";b.className="icon-action category-title-edit-v409";b.title="Bearbeiten";b.textContent="✏️";b.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();if(typeof startEditing==="function")startEditing(row.id);});actions.appendChild(b);});
  }

  function applyFilter(){
    if(!["all","archive"].includes(currentTab))return;const container=document.getElementById("viewContainer");if(!container)return;const wanted=activeFilter;
    container.querySelectorAll(".task, .archive-task").forEach(card=>{const row=resolveRow(card),cat=clean(row&&row.category);card.style.display=wanted==="all"||((wanted===""&&!cat)||norm(cat)===norm(wanted))?"":"none";});
  }
  function categoryOptions(current="",includeAll=false){const c=clean(current);return `${includeAll?'<option value="all">ALLE KATEGORIEN</option>':''}<option value="">OHNE KATEGORIE</option>`+categories().map(x=>`<option value="${esc(x)}" ${norm(x)===norm(c)?"selected":""}>${esc(x.toUpperCase())}</option>`).join("");}
  function enhanceInput(){const panel=document.getElementById("inputPanel");if(!panel||document.getElementById("categoryRowV409"))return;const row=document.createElement("div");row.className="option-row";row.id="categoryRowV409";row.innerHTML=`<span class="option-label">KATEGORIE</span><select id="newCategoryV409" class="category-new-select-v409">${categoryOptions(selectedNewCategory)}</select><button class="option-button" id="categoryManageV409">🏷️ VERWALTEN</button>`;panel.insertBefore(row,panel.querySelector(".add-button")||null);row.querySelector("#newCategoryV409")?.addEventListener("change",e=>selectedNewCategory=e.target.value||"");row.querySelector("#categoryManageV409")?.addEventListener("click",openManager);}
  function enhanceToolbar(){if(!["all","archive"].includes(currentTab))return;const container=document.getElementById("viewContainer");if(!container||document.getElementById("categoryToolbarV409"))return;const bar=document.createElement("div");bar.id="categoryToolbarV409";bar.className="category-toolbar-v409";bar.innerHTML=`<div class="category-toolbar-label-v409">🏷️ KATEGORIEN</div><div class="category-toolbar-controls-v409"><select id="categoryFilterV409" class="category-new-select-v409">${categoryOptions(activeFilter==="all"?"":activeFilter,true)}</select><button class="option-button" id="categoryManagerOpenV409">VERWALTEN</button></div>`;container.prepend(bar);const sel=bar.querySelector("#categoryFilterV409");sel.value=activeFilter;sel.addEventListener("change",e=>{activeFilter=e.target.value||"all";write(FILTER_KEY,activeFilter);applyFilter();});bar.querySelector("#categoryManagerOpenV409")?.addEventListener("click",openManager);}
  function renderAdmin(){return categories().length?categories().map(c=>`<div class="category-admin-row-v409"><span>${esc(c)}</span><div><button class="category-mini-v409" data-rename-v409="${esc(c)}">✏️</button><button class="category-mini-v409" data-delete-v409="${esc(c)}">🗑️</button></div></div>`).join(""):'<div class="statistics-empty-small">Noch keine Kategorien angelegt.</div>';}
  function openManager(){const modal=document.getElementById("modalContainer");if(!modal)return;modal.innerHTML=`<div class="modal-overlay" id="categoryManagerV409"><div class="modal category-manager-v409"><div class="modal-title">🏷️ KATEGORIEN VERWALTEN</div><div class="category-create-v409"><input id="categoryNewNameV409" class="category-input-v409" placeholder="Neue Kategorie, z. B. Küche"><button class="option-button" id="categoryAddV409">+ ANLEGEN</button></div><div class="category-admin-v409">${renderAdmin()}</div><div class="category-manager-note-v409">Zuordnen geht direkt über das Badge an jeder Aufgabe. Kein Aufgaben-Suchzirkus mehr. 🎪🚫</div><div class="modal-actions"><button class="modal-button secondary" id="categoryCloseV409">SCHLIESSEN</button></div></div></div>`;document.getElementById("categoryCloseV409")?.addEventListener("click",()=>modal.innerHTML="");document.getElementById("categoryAddV409")?.addEventListener("click",()=>{if(addCategory(document.getElementById("categoryNewNameV409")?.value))openManager();});modal.querySelectorAll("[data-rename-v409]").forEach(b=>b.addEventListener("click",()=>{const old=b.dataset.renameV409,next=prompt(`Kategorie „${old}“ umbenennen in:`,old);if(next&&renameCategory(old,next))openManager();}));modal.querySelectorAll("[data-delete-v409]").forEach(b=>b.addEventListener("click",()=>{const c=b.dataset.deleteV409;if(confirm(`Kategorie „${c}“ löschen? Aufgaben bleiben erhalten und werden „Ohne Kategorie“.`)){deleteCategory(c);openManager();}}));}

  const originalAddTask=typeof addTask==="function"?addTask:null;if(originalAddTask){addTask=function(){const before=new Set((tasks||[]).map(t=>t&&t.id));const result=originalAddTask.apply(this,arguments);const fresh=(tasks||[]).filter(t=>!before.has(t&&t.id));fresh.forEach(t=>{if(selectedNewCategory){t.category=selectedNewCategory;const map=readJson(MAP_KEY,{});map[norm(t.text)]=selectedNewCategory;write(MAP_KEY,JSON.stringify(map));}else applyLearned(t);});if(fresh.length){persist();render();}return result;};}
  function afterRender(){enhanceInput();enhanceToolbar();enhanceCards();enhanceEditButtons();applyFilter();}
  const previousRender=typeof render==="function"?render:null;if(previousRender){render=function(){const r=previousRender.apply(this,arguments);afterRender();return r;};}
  window.openCategoryManagerV409=openManager;window.__modCategoriesV409={version:BUILD_VERSION,normalize:norm,setAllByName,openPicker,applyFilter};window.addEventListener("load",()=>setTimeout(afterRender,100));
})();
