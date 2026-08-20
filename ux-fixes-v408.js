/* V408 · TASK-CARD UX
   - Kategorien-Badge sitzt oben rechts an der Karte.
   - Badge zeigt immer den echten Wert, sonst OHNE KATEGORIE.
   - Klick auf das Badge öffnet direkt die Kategorieauswahl.
   - Titelbearbeitung für gestartete/pausierte Aufgaben sitzt in der normalen Aktionsleiste.
*/
(function(){
  const BUILD_VERSION="V408";
  const CAT_KEY="masterOfDisasterCategoriesV405";
  const MAP_KEY="masterOfDisasterCategoryNameMapV405";

  function norm(v){return String(v??"").trim().replace(/\s+/g," ").toLocaleLowerCase("de-DE");}
  function clean(v){return String(v??"").trim().replace(/\s+/g," ");}
  function esc(v){return typeof escapeHtml==="function"?escapeHtml(String(v??"")):String(v??"").replace(/[&<>\"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));}
  function readJson(k,f){try{const x=localStorage.getItem(k);return x?JSON.parse(x):f;}catch(_){return f;}}
  function write(k,v){try{localStorage.setItem(k,v);}catch(_){}}
  function persist(){try{if(typeof saveAll==="function")saveAll();else{write("masterOfDisasterTasks",JSON.stringify(tasks||[]));write("masterOfDisasterArchive",JSON.stringify(archive||[]));}}catch(e){console.warn("V408 persist",e);}}
  function cats(){const seen=new Map();readJson(CAT_KEY,[]).forEach(c=>{c=clean(c);if(c)seen.set(norm(c),c);});[...(tasks||[]),...(archive||[])].forEach(r=>{const c=clean(r&&r.category);if(c&&!seen.has(norm(c)))seen.set(norm(c),c);});return [...seen.values()].sort((a,b)=>a.localeCompare(b,"de"));}
  function cardText(card){const n=card.querySelector(".task-text");if(n&&clean(n.textContent))return clean(n.textContent);const body=norm(card.textContent);return [...(card.classList.contains("archive-task")?(archive||[]):(tasks||[]))].map(r=>clean(r&&r.text)).filter(Boolean).sort((a,b)=>b.length-a.length).find(t=>body.includes(norm(t)))||"";}
  function resolveRow(card){const text=cardText(card);if(!text)return null;const source=card.classList.contains("archive-task")?(archive||[]):(tasks||[]);const list=source.filter(r=>norm(r&&r.text)===norm(text));if(list.length<=1)return list[0]||null;const body=norm(card.textContent);if(card.classList.contains("archive-task")){const exact=list.find(r=>r&&r.archiveNumber&&body.includes(norm("A"+String(r.archiveNumber).padStart(3,"0"))));if(exact)return exact;}return list[0]||null;}
  function setOne(row,c){if(!row)return;row.category=clean(c)||null;persist();}
  function setAll(text,c){const cat=clean(c)||null,n=norm(text);(tasks||[]).forEach(r=>{if(norm(r&&r.text)===n)r.category=cat;});(archive||[]).forEach(r=>{if(norm(r&&r.text)===n)r.category=cat;});const map=readJson(MAP_KEY,{});if(cat)map[n]=cat;else delete map[n];write(MAP_KEY,JSON.stringify(map));persist();}

  function openPicker(card){
    const row=resolveRow(card);if(!row)return;const text=clean(row.text),current=clean(row.category);const modal=document.getElementById("modalContainer");if(!modal)return;
    const sameOpen=(tasks||[]).filter(r=>norm(r&&r.text)===norm(text)).length;
    const sameArchive=(archive||[]).filter(r=>norm(r&&r.text)===norm(text)).length;
    modal.innerHTML=`<div class="modal-overlay" id="catPickerV408"><div class="modal category-picker-v408"><div class="modal-title">🏷️ KATEGORIE AUSWÄHLEN</div><div class="category-picker-task-v408">${esc(text)}</div><div class="category-picker-grid-v408">${["",...cats()].map(c=>`<button type="button" class="category-choice-v408 ${norm(c)===norm(current)?"selected":""}" data-cat="${esc(c)}">${c?esc(c):"OHNE KATEGORIE"}</button>`).join("")}</div><div class="category-picker-hint-v408">${sameOpen} aktuell · ${sameArchive} Archiv</div><div class="category-picker-scope-v408"><button class="modal-button" id="catOneV408">NUR DIESE</button><button class="modal-button primary" id="catAllV408">ALLE GLEICHNAMIGEN</button></div><button class="modal-button secondary category-picker-cancel-v408" id="catCancelV408">ZURÜCK</button></div></div>`;
    let selected=current;
    modal.querySelectorAll("[data-cat]").forEach(b=>b.addEventListener("click",()=>{selected=b.dataset.cat||"";modal.querySelectorAll("[data-cat]").forEach(x=>x.classList.toggle("selected",x===b));}));
    document.getElementById("catOneV408")?.addEventListener("click",()=>{setOne(row,selected);modal.innerHTML="";render();});
    document.getElementById("catAllV408")?.addEventListener("click",()=>{setAll(text,selected);modal.innerHTML="";render();});
    document.getElementById("catCancelV408")?.addEventListener("click",()=>modal.innerHTML="");
  }

  function openTitle(card){
    const row=resolveRow(card);if(!row||card.classList.contains("archive-task"))return;const old=clean(row.text);const modal=document.getElementById("modalContainer");if(!modal)return;
    modal.innerHTML=`<div class="modal-overlay"><div class="modal title-edit-v408"><div class="modal-title">✏️ AUFGABE UMBENENNEN</div><input id="titleInputV408" class="edit-input title-input-v408" value="${esc(old)}" autocomplete="off"><div class="category-picker-hint-v408">Nur der Titel wird geändert. Zeit, Status und Aufzeichnung bleiben unverändert.</div><div class="modal-actions"><button class="modal-button secondary" id="titleCancelV408">ZURÜCK</button><button class="modal-button primary" id="titleSaveV408">SPEICHERN</button></div></div></div>`;
    const input=document.getElementById("titleInputV408");setTimeout(()=>{input?.focus();input?.select();},30);
    const save=()=>{const next=clean(input?.value);if(!next)return;if(next!==old){row.text=next;persist();}modal.innerHTML="";render();};
    document.getElementById("titleSaveV408")?.addEventListener("click",save);document.getElementById("titleCancelV408")?.addEventListener("click",()=>modal.innerHTML="");input?.addEventListener("keydown",e=>{if(e.key==="Enter")save();});
  }

  function actionParent(card){
    const buttons=[...card.querySelectorAll("button")].filter(b=>!b.classList.contains("category-quick-v406")&&!b.classList.contains("title-edit-v407-button")&&!b.classList.contains("title-edit-v408-button"));
    const counts=new Map();buttons.forEach(b=>{const p=b.parentElement;if(p&&p!==card)counts.set(p,(counts.get(p)||0)+1);});
    return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
  }

  function enhance(){
    const container=document.getElementById("viewContainer");if(!container)return;
    container.querySelectorAll(".task, .archive-task").forEach(card=>{
      card.classList.add("v408-card");
      card.querySelectorAll(":scope > .title-edit-v407-button").forEach(b=>b.remove());
      const oldCat=card.querySelector(":scope > .category-quick-v406");
      const row=resolveRow(card);if(!row)return;
      if(oldCat){
        const fresh=oldCat.cloneNode(false);fresh.className="category-quick-v406 category-badge-v408";fresh.type="button";fresh.title="Kategorie auswählen";fresh.innerHTML=`🏷️ <span>${esc(clean(row.category)||"OHNE KATEGORIE")}</span>`;oldCat.replaceWith(fresh);fresh.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();openPicker(card);});
      }
      if(card.classList.contains("archive-task"))return;
      const editable=["running","paused"].includes(String(row.status||""))||card.classList.contains("running")||card.classList.contains("paused")||Boolean(row.startedAt&&!row.completedAt&&!row.abortedAt);
      if(!editable)return;
      const parent=actionParent(card);if(!parent||parent.querySelector(".title-edit-v408-button"))return;
      const b=document.createElement("button");b.type="button";b.className="title-edit-v408-button";b.title="Titel bearbeiten";b.textContent="✏️";b.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();openTitle(card);});parent.appendChild(b);
    });
  }
  const prev=typeof render==="function"?render:null;if(prev){render=function(){const r=prev.apply(this,arguments);setTimeout(enhance,90);return r;};}
  window.addEventListener("load",()=>setTimeout(enhance,350));
  window.__modUxV408={version:BUILD_VERSION,enhance,openPicker,openTitle};
})();
