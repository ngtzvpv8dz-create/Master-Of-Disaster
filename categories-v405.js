/* V405 · KATEGORIEN
   - Frei anlegbare Hauptkategorien.
   - Kategorie beim Erstellen neuer Aufgaben.
   - Lernende Zuordnung nach normalisiertem Aufgabennamen.
   - Rueckwirkende Zuordnung aller gleichnamigen offenen + archivierten Aufgaben.
   - Kategorien koennen umbenannt oder entfernt werden, ohne Aufgaben zu loeschen.
*/
(function(){
  const BUILD_VERSION="V405";
  const STORAGE_KEY="masterOfDisasterCategoriesV405";
  const MAP_KEY="masterOfDisasterCategoryNameMapV405";
  const FILTER_KEY="masterOfDisasterCategoryFilterV405";

  let categories=readJson(STORAGE_KEY,[]);
  let nameMap=readJson(MAP_KEY,{});
  let selectedNewCategory="";
  let activeFilter=readText(FILTER_KEY,"all")||"all";

  function readJson(key,fallback){
    try{ const raw=localStorage.getItem(key); return raw?JSON.parse(raw):fallback; }catch(_){ return fallback; }
  }
  function readText(key,fallback){ try{return localStorage.getItem(key)||fallback;}catch(_){return fallback;} }
  function write(key,value){ try{localStorage.setItem(key,value);}catch(_){} }
  function esc(v){ return typeof escapeHtml==="function"?escapeHtml(String(v??"")):String(v??"").replace(/[&<>\"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m])); }
  function norm(v){ return String(v??"").trim().replace(/\s+/g," ").toLocaleLowerCase("de-DE"); }
  function cleanCategory(v){ return String(v??"").trim().replace(/\s+/g," "); }
  function allRows(){ return [...(Array.isArray(tasks)?tasks:[]),...(Array.isArray(archive)?archive:[])]; }
  function persist(){
    write(STORAGE_KEY,JSON.stringify(categories));
    write(MAP_KEY,JSON.stringify(nameMap));
    try{ if(typeof saveAll==="function") saveAll(); else {
      write("masterOfDisasterTasks",JSON.stringify(tasks||[]));
      write("masterOfDisasterArchive",JSON.stringify(archive||[]));
    }}catch(e){ console.warn("V405 category persist:",e); }
  }
  function ensureKnownCategories(){
    const seen=new Set(categories.map(norm));
    allRows().forEach(row=>{ const c=cleanCategory(row&&row.category); if(c&&!seen.has(norm(c))){categories.push(c);seen.add(norm(c));} });
    categories=categories.filter(Boolean).sort((a,b)=>a.localeCompare(b,"de"));
    write(STORAGE_KEY,JSON.stringify(categories));
  }
  function categoryOptions(value="",includeAll=false){
    const current=cleanCategory(value);
    const vals=[...categories]; if(current&&!vals.some(x=>norm(x)===norm(current)))vals.push(current);
    return `${includeAll?'<option value="all">ALLE KATEGORIEN</option>':''}<option value="">OHNE KATEGORIE</option>`+vals.sort((a,b)=>a.localeCompare(b,"de")).map(c=>`<option value="${esc(c)}" ${norm(c)===norm(current)?"selected":""}>${esc(c.toUpperCase())}</option>`).join("");
  }
  function matchCounts(text){
    const n=norm(text); let open=0,archived=0;
    (tasks||[]).forEach(t=>{if(norm(t&&t.text)===n)open++;});
    (archive||[]).forEach(t=>{if(norm(t&&t.text)===n)archived++;});
    return {open,archived,total:open+archived};
  }
  function setOne(row,category){ if(row) row.category=cleanCategory(category)||null; }
  function setAllByName(text,category){
    const n=norm(text), c=cleanCategory(category)||null; let changed=0;
    (tasks||[]).forEach(t=>{if(norm(t&&t.text)===n){t.category=c;changed++;}});
    (archive||[]).forEach(t=>{if(norm(t&&t.text)===n){t.category=c;changed++;}});
    if(c) nameMap[n]=c; else delete nameMap[n];
    persist();
    return changed;
  }
  function applyLearnedCategory(task){
    if(!task||cleanCategory(task.category))return;
    const c=nameMap[norm(task.text)]; if(c) task.category=c;
  }
  function addCategory(name){
    const c=cleanCategory(name); if(!c)return false;
    if(categories.some(x=>norm(x)===norm(c)))return true;
    categories.push(c); categories.sort((a,b)=>a.localeCompare(b,"de")); persist(); return true;
  }
  function renameCategory(oldName,newName){
    const oldC=cleanCategory(oldName), newC=cleanCategory(newName); if(!oldC||!newC)return false;
    addCategory(newC);
    allRows().forEach(r=>{if(norm(r&&r.category)===norm(oldC))r.category=newC;});
    Object.keys(nameMap).forEach(k=>{if(norm(nameMap[k])===norm(oldC))nameMap[k]=newC;});
    categories=categories.filter(c=>norm(c)!==norm(oldC)||norm(c)===norm(newC));
    categories=[...new Map(categories.map(c=>[norm(c),c])).values()].sort((a,b)=>a.localeCompare(b,"de"));
    persist(); return true;
  }
  function deleteCategory(name){
    const c=cleanCategory(name); if(!c)return;
    allRows().forEach(r=>{if(norm(r&&r.category)===norm(c))r.category=null;});
    Object.keys(nameMap).forEach(k=>{if(norm(nameMap[k])===norm(c))delete nameMap[k];});
    categories=categories.filter(x=>norm(x)!==norm(c));
    if(norm(selectedNewCategory)===norm(c))selectedNewCategory="";
    if(norm(activeFilter)===norm(c))activeFilter="all";
    persist();
  }

  function openManager(){
    ensureKnownCategories();
    const unique=new Map();
    allRows().forEach(row=>{ const text=String(row&&row.text||"").trim(); if(!text)return; const n=norm(text); if(!unique.has(n))unique.set(n,text); });
    const rows=[...unique.values()].sort((a,b)=>a.localeCompare(b,"de"));
    const modal=document.getElementById("modalContainer"); if(!modal)return;
    modal.innerHTML=`<div class="modal-overlay" id="categoryModalV405"><div class="modal category-modal-v405">
      <div class="modal-title">🏷️ KATEGORIEN</div>
      <div class="category-help-v405">Eine Kategorie pro Aufgabe. Bei <b>ALLE GLEICHNAMIGEN</b> werden offene und archivierte Aufgaben mit exakt gleichem Namen gemeinsam zugeordnet. Groß-/Kleinschreibung und doppelte Leerzeichen werden ignoriert.</div>
      <div class="category-create-v405"><input id="categoryNewNameV405" class="category-input-v405" placeholder="Neue Kategorie, z. B. Küche"><button class="option-button" id="categoryAddV405">+ ANLEGEN</button></div>
      <div id="categoryAdminV405" class="category-admin-v405">${renderCategoryAdmin()}</div>
      <div class="category-section-title-v405">AUFGABENNAMEN ZUORDNEN</div>
      <input id="categorySearchV405" class="category-input-v405" placeholder="Aufgabe suchen …">
      <div id="categoryAssignmentListV405" class="category-assignment-list-v405">${renderAssignmentRows(rows)}</div>
      <div class="modal-actions"><button class="modal-button secondary" id="categoryCloseV405">SCHLIESSEN</button></div>
    </div></div>`;
    wireManager(rows);
  }
  function renderCategoryAdmin(){
    if(!categories.length)return `<div class="statistics-empty-small">Noch keine Kategorien angelegt.</div>`;
    return categories.map(c=>`<div class="category-admin-row-v405"><span>${esc(c)}</span><div><button class="category-mini-v405" data-cat-rename="${esc(c)}">✏️</button><button class="category-mini-v405" data-cat-delete="${esc(c)}">🗑️</button></div></div>`).join("");
  }
  function renderAssignmentRows(rows){
    if(!rows.length)return `<div class="statistics-empty-small">Keine Aufgaben vorhanden.</div>`;
    return rows.map(text=>{ const count=matchCounts(text); const found=allRows().find(r=>norm(r&&r.text)===norm(text)); const current=cleanCategory(found&&found.category)||nameMap[norm(text)]||"";
      return `<div class="category-assign-row-v405" data-cat-row data-search="${esc(norm(text))}"><div class="category-assign-name-v405">${esc(text)}</div><div class="category-assign-meta-v405">${count.open} aktuell · ${count.archived} Archiv</div><div class="category-assign-controls-v405"><select class="category-select-v405" data-cat-select="${esc(text)}">${categoryOptions(current)}</select><button class="option-button" data-cat-apply="${esc(text)}">ALLE GLEICHNAMIGEN</button></div></div>`;
    }).join("");
  }
  function wireManager(rows){
    const modal=document.getElementById("categoryModalV405"); if(!modal)return;
    document.getElementById("categoryCloseV405")?.addEventListener("click",()=>{document.getElementById("modalContainer").innerHTML="";render();});
    document.getElementById("categoryAddV405")?.addEventListener("click",()=>{
      const input=document.getElementById("categoryNewNameV405"); if(addCategory(input?.value)){openManager();}
    });
    document.getElementById("categorySearchV405")?.addEventListener("input",e=>{
      const q=norm(e.target.value); modal.querySelectorAll("[data-cat-row]").forEach(el=>{el.style.display=!q||el.dataset.search.includes(q)?"":"none";});
    });
    modal.querySelectorAll("[data-cat-apply]").forEach(btn=>btn.addEventListener("click",()=>{
      const text=btn.dataset.catApply; const select=modal.querySelector(`[data-cat-select="${CSS.escape(text)}"]`); const c=select?select.value:"";
      const changed=setAllByName(text,c); if(c)addCategory(c);
      btn.textContent=`✅ ${changed} ZUGEORDNET`; setTimeout(()=>openManager(),500);
    }));
    modal.querySelectorAll("[data-cat-rename]").forEach(btn=>btn.addEventListener("click",()=>{
      const old=btn.dataset.catRename; const next=prompt(`Kategorie „${old}“ umbenennen in:`,old); if(next&&renameCategory(old,next))openManager();
    }));
    modal.querySelectorAll("[data-cat-delete]").forEach(btn=>btn.addEventListener("click",()=>{
      const c=btn.dataset.catDelete; if(confirm(`Kategorie „${c}“ löschen? Die Aufgaben bleiben erhalten und werden zu „Ohne Kategorie“.`)){deleteCategory(c);openManager();}
    }));
  }

  function enhanceInput(){
    const panel=document.getElementById("inputPanel"); if(!panel||document.getElementById("categoryRowV405"))return;
    ensureKnownCategories();
    const row=document.createElement("div"); row.className="option-row"; row.id="categoryRowV405";
    row.innerHTML=`<span class="option-label">KATEGORIE</span><select id="newCategoryV405" class="category-new-select-v405">${categoryOptions(selectedNewCategory)}</select><button class="option-button" id="categoryManageV405">🏷️ VERWALTEN</button>`;
    const add=panel.querySelector(".add-button"); panel.insertBefore(row,add||null);
    row.querySelector("#newCategoryV405")?.addEventListener("change",e=>selectedNewCategory=e.target.value||"");
    row.querySelector("#categoryManageV405")?.addEventListener("click",openManager);
  }

  function enhanceView(){
    if(!["all","archive"].includes(currentTab))return;
    const container=document.getElementById("viewContainer"); if(!container||document.getElementById("categoryToolbarV405"))return;
    ensureKnownCategories();
    const bar=document.createElement("div"); bar.id="categoryToolbarV405"; bar.className="category-toolbar-v405";
    bar.innerHTML=`<div class="category-toolbar-label-v405">🏷️ KATEGORIEN</div><div class="category-toolbar-controls-v405"><select id="categoryFilterV405" class="category-new-select-v405">${categoryOptions(activeFilter==="all"?"":activeFilter,true)}</select><button class="option-button" id="categoryManagerOpenV405">VERWALTEN / ZUORDNEN</button></div>`;
    container.prepend(bar);
    const sel=bar.querySelector("#categoryFilterV405"); if(sel){sel.value=activeFilter;sel.addEventListener("change",e=>{activeFilter=e.target.value||"all";write(FILTER_KEY,activeFilter);applyDomFilter();});}
    bar.querySelector("#categoryManagerOpenV405")?.addEventListener("click",openManager);
    setTimeout(applyDomFilter,0);
  }

  function applyDomFilter(){
    if(activeFilter==="all")return;
    const container=document.getElementById("viewContainer"); if(!container)return;
    const wanted=norm(activeFilter);
    const known=new Map(); allRows().forEach(r=>{const n=norm(r&&r.text);if(!known.has(n))known.set(n,cleanCategory(r&&r.category));});
    const walkers=[...container.querySelectorAll("button")];
    const candidates=new Set();
    walkers.forEach(btn=>{const oc=btn.getAttribute("onclick")||""; const parent=btn.closest("[class*='task'],[class*='archive'],.card,.task-item,.archive-item"); if(parent)candidates.add(parent);});
    candidates.forEach(card=>{
      const text=norm(card.textContent); let cat="";
      for(const [name,c] of known){if(text.includes(name)){cat=c;break;}}
      card.style.display=(wanted===""?!cat:norm(cat)===wanted)?"":"none";
    });
  }

  // Kategorie beim Erstellen: explizite Auswahl gewinnt, sonst gelernte Namenszuordnung.
  const originalAddTask=typeof addTask==="function"?addTask:null;
  if(originalAddTask){
    addTask=function(){
      const before=new Set((tasks||[]).map(t=>t&&t.id));
      const result=originalAddTask.apply(this,arguments);
      const fresh=(tasks||[]).filter(t=>!before.has(t&&t.id));
      fresh.forEach(t=>{
        if(selectedNewCategory){t.category=selectedNewCategory; nameMap[norm(t.text)]=selectedNewCategory;}
        else applyLearnedCategory(t);
      });
      if(fresh.length){persist(); if(typeof render==="function")render();}
      return result;
    };
  }

  // Bereits bestehende aktuelle Aufgaben duerfen von einer zuvor gelernten Namenszuordnung profitieren.
  let learnedChanged=false;
  (tasks||[]).forEach(t=>{const before=t&&t.category;applyLearnedCategory(t);if((t&&t.category)!==before)learnedChanged=true;});
  if(learnedChanged)persist();

  const previousRender=typeof render==="function"?render:null;
  if(previousRender){
    render=function(){ const r=previousRender.apply(this,arguments); enhanceInput(); enhanceView(); return r; };
  }
  window.openCategoryManagerV405=openManager;
  window.__modCategoriesV405={version:BUILD_VERSION,getCategories:()=>[...categories],setAllByName,normalize:norm,matchCounts};
  window.addEventListener("load",()=>setTimeout(()=>{enhanceInput();enhanceView();},250));
})();
