/* V407 · DIREKTE KATEGORIE + TITELBEARBEITUNG
   - Kategorie direkt am Badge auswählbar, ohne Scroll-Marathon.
   - Gestartete/pausierte aktuelle Aufgaben dürfen weiterhin umbenannt werden.
   - Löschen bleibt davon unberührt und für gestartete Aufgaben gesperrt.
*/
(function(){
  const BUILD_VERSION="V407";
  const CAT_KEY="masterOfDisasterCategoriesV405";
  const MAP_KEY="masterOfDisasterCategoryNameMapV405";

  function norm(v){return String(v??"").trim().replace(/\s+/g," ").toLocaleLowerCase("de-DE");}
  function clean(v){return String(v??"").trim().replace(/\s+/g," ");}
  function esc(v){return typeof escapeHtml==="function"?escapeHtml(String(v??"")):String(v??"").replace(/[&<>\"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));}
  function readJson(k,f){try{const x=localStorage.getItem(k);return x?JSON.parse(x):f;}catch(_){return f;}}
  function write(k,v){try{localStorage.setItem(k,v);}catch(_){}}
  function persist(){try{if(typeof saveAll==="function")saveAll();else{write("masterOfDisasterTasks",JSON.stringify(tasks||[]));write("masterOfDisasterArchive",JSON.stringify(archive||[]));}}catch(e){console.warn("V407 persist",e);}}
  function cats(){
    const seen=new Map();
    readJson(CAT_KEY,[]).forEach(c=>{c=clean(c);if(c)seen.set(norm(c),c);});
    [...(tasks||[]),...(archive||[])].forEach(r=>{const c=clean(r&&r.category);if(c&&!seen.has(norm(c)))seen.set(norm(c),c);});
    return [...seen.values()].sort((a,b)=>a.localeCompare(b,"de"));
  }
  function cardText(card){const n=card.querySelector(".task-text");return clean(n?n.textContent:"");}
  function rowsByText(text,isArchive){return (isArchive?(archive||[]):(tasks||[])).filter(r=>norm(r&&r.text)===norm(text));}
  function resolveRow(card){
    const text=cardText(card);if(!text)return null;
    const isArchive=card.classList.contains("archive-task");
    const list=rowsByText(text,isArchive);if(list.length<=1)return list[0]||null;
    const html=card.innerHTML;
    const byId=list.find(r=>r&&r.id&&html.includes(String(r.id)));if(byId)return byId;
    const body=norm(card.textContent);
    if(isArchive){const a=list.find(r=>r&&r.archiveNumber&&body.includes(norm("A"+String(r.archiveNumber).padStart(3,"0"))));if(a)return a;}
    return list[0]||null;
  }
  function allSame(text,category){
    const c=clean(category)||null,n=norm(text);let count=0;
    (tasks||[]).forEach(r=>{if(norm(r&&r.text)===n){r.category=c;count++;}});
    (archive||[]).forEach(r=>{if(norm(r&&r.text)===n){r.category=c;count++;}});
    const map=readJson(MAP_KEY,{});if(c)map[n]=c;else delete map[n];write(MAP_KEY,JSON.stringify(map));persist();return count;
  }
  function one(row,category){if(!row)return;row.category=clean(category)||null;persist();}

  function openCategoryPicker(card){
    const row=resolveRow(card);if(!row)return;
    const text=clean(row.text),current=clean(row.category);
    const sameOpen=(tasks||[]).filter(r=>norm(r&&r.text)===norm(text)).length;
    const sameArchive=(archive||[]).filter(r=>norm(r&&r.text)===norm(text)).length;
    const modal=document.getElementById("modalContainer");if(!modal)return;
    const choices=["",...cats()];
    modal.innerHTML=`<div class="modal-overlay" id="catPickerV407"><div class="modal category-picker-v407">
      <div class="modal-title">🏷️ KATEGORIE</div>
      <div class="category-picker-task-v407">${esc(text)}</div>
      <div class="category-picker-grid-v407">${choices.map(c=>`<button type="button" class="category-choice-v407 ${norm(c)===norm(current)?"selected":""}" data-v407-cat="${esc(c)}">${c?esc(c):"OHNE KATEGORIE"}</button>`).join("")}</div>
      <div class="category-picker-hint-v407">${sameOpen} aktuell · ${sameArchive} Archiv</div>
      <div class="category-picker-scope-v407">
        <button class="modal-button" id="catOnlyV407">NUR DIESE</button>
        <button class="modal-button primary" id="catAllV407">ALLE GLEICHNAMIGEN</button>
      </div>
      <button class="modal-button secondary category-picker-cancel-v407" id="catCancelV407">ZURÜCK</button>
    </div></div>`;
    let selected=current;
    modal.querySelectorAll("[data-v407-cat]").forEach(b=>b.addEventListener("click",()=>{selected=b.dataset.v407Cat||"";modal.querySelectorAll("[data-v407-cat]").forEach(x=>x.classList.toggle("selected",x===b));}));
    document.getElementById("catOnlyV407")?.addEventListener("click",()=>{one(row,selected);modal.innerHTML="";render();});
    document.getElementById("catAllV407")?.addEventListener("click",()=>{allSame(text,selected);modal.innerHTML="";render();});
    document.getElementById("catCancelV407")?.addEventListener("click",()=>modal.innerHTML="");
  }

  function openTitleEditor(card){
    const row=resolveRow(card);if(!row||card.classList.contains("archive-task"))return;
    const old=clean(row.text);const modal=document.getElementById("modalContainer");if(!modal)return;
    modal.innerHTML=`<div class="modal-overlay" id="titleEditV407"><div class="modal title-edit-v407">
      <div class="modal-title">✏️ AUFGABE UMBENENNEN</div>
      <input id="titleInputV407" class="edit-input title-input-v407" value="${esc(old)}" autocomplete="off">
      <div class="category-picker-hint-v407">Zeit, Status und bisherige Aufzeichnung bleiben unverändert. Nur der Titel wird korrigiert.</div>
      <div class="modal-actions"><button class="modal-button secondary" id="titleCancelV407">ZURÜCK</button><button class="modal-button primary" id="titleSaveV407">SPEICHERN</button></div>
    </div></div>`;
    const input=document.getElementById("titleInputV407");setTimeout(()=>{input?.focus();input?.select();},50);
    const save=()=>{const next=clean(input?.value);if(!next)return;if(next!==old){row.text=next;persist();}modal.innerHTML="";render();};
    document.getElementById("titleSaveV407")?.addEventListener("click",save);
    document.getElementById("titleCancelV407")?.addEventListener("click",()=>modal.innerHTML="");
    input?.addEventListener("keydown",e=>{if(e.key==="Enter")save();});
  }

  function enhance(){
    const container=document.getElementById("viewContainer");if(!container)return;
    container.querySelectorAll(".task, .archive-task").forEach(card=>{
      const cat=card.querySelector(":scope > .category-quick-v406");
      if(cat&&!cat.dataset.v407){cat.dataset.v407="1";cat.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();e.stopPropagation();openCategoryPicker(card);},true);}
      if(card.classList.contains("archive-task"))return;
      const row=resolveRow(card);if(!row)return;
      const editable=["running","paused"].includes(String(row.status||""))||card.classList.contains("running")||card.classList.contains("paused")||Boolean(row.startedAt&&!row.completedAt&&!row.abortedAt);
      if(!editable||card.querySelector(":scope > .title-edit-v407-button"))return;
      const b=document.createElement("button");b.type="button";b.className="title-edit-v407-button";b.title="Titel bearbeiten";b.textContent="✏️";
      b.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();openTitleEditor(card);});card.appendChild(b);
    });
  }
  const prev=typeof render==="function"?render:null;if(prev){render=function(){const r=prev.apply(this,arguments);setTimeout(enhance,80);return r;};}
  window.addEventListener("load",()=>setTimeout(enhance,300));
  window.__modUxV407={version:BUILD_VERSION,openCategoryPicker,openTitleEditor};
})();
