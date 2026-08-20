/* V406 · KATEGORIEN UX + SICHERER FILTER
   - Repariert den V405-DOM-Filter: Es werden nur komplette .task/.archive-task Karten gefiltert.
   - Direkte Kategorie-Zuordnung an bestehenden Aufgaben und Archiv-Einträgen.
   - Wahl: nur diese gefundene Aufgabe oder alle gleichnamigen aktuellen + archivierten Einträge.
*/
(function(){
  const BUILD_VERSION="V406";
  const STORAGE_KEY="masterOfDisasterCategoriesV405";
  const MAP_KEY="masterOfDisasterCategoryNameMapV405";
  const FILTER_KEY="masterOfDisasterCategoryFilterV405";

  function readJson(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(_){return fallback;}}
  function write(key,value){try{localStorage.setItem(key,value);}catch(_){}}
  function norm(v){return String(v??"").trim().replace(/\s+/g," ").toLocaleLowerCase("de-DE");}
  function clean(v){return String(v??"").trim().replace(/\s+/g," ");}
  function esc(v){return typeof escapeHtml==="function"?escapeHtml(String(v??"")):String(v??"").replace(/[&<>\"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));}
  function categories(){
    const stored=readJson(STORAGE_KEY,[]).map(clean).filter(Boolean);
    const seen=new Map(stored.map(c=>[norm(c),c]));
    [...(Array.isArray(tasks)?tasks:[]),...(Array.isArray(archive)?archive:[])].forEach(r=>{const c=clean(r&&r.category);if(c&&!seen.has(norm(c)))seen.set(norm(c),c);});
    return [...seen.values()].sort((a,b)=>a.localeCompare(b,"de"));
  }
  function allRows(){return [...(Array.isArray(tasks)?tasks:[]),...(Array.isArray(archive)?archive:[])];}
  function persist(){
    try{if(typeof saveAll==="function")saveAll();else{write("masterOfDisasterTasks",JSON.stringify(tasks||[]));write("masterOfDisasterArchive",JSON.stringify(archive||[]));}}catch(e){console.warn("V406 category persist",e);}
  }
  function options(current){
    const c=clean(current);
    return `<option value="">OHNE KATEGORIE</option>`+categories().map(x=>`<option value="${esc(x)}" ${norm(x)===norm(c)?"selected":""}>${esc(x.toUpperCase())}</option>`).join("");
  }
  function textFromCard(card){
    const direct=card.querySelector(".task-text");
    if(direct&&clean(direct.textContent))return clean(direct.textContent);
    const body=norm(card.textContent);
    const matches=allRows().map(r=>clean(r&&r.text)).filter(Boolean).filter(t=>body.includes(norm(t))).sort((a,b)=>b.length-a.length);
    return matches[0]||"";
  }
  function rowCandidates(text,isArchive){
    const source=isArchive?(Array.isArray(archive)?archive:[]):(Array.isArray(tasks)?tasks:[]);
    return source.filter(r=>norm(r&&r.text)===norm(text));
  }
  function resolveSingleRow(card,text){
    const isArchive=card.classList.contains("archive-task");
    const list=rowCandidates(text,isArchive);
    if(list.length<=1)return list[0]||null;
    const body=norm(card.textContent);
    if(isArchive){
      const byArchive=list.find(r=>r&&r.archiveNumber&&body.includes(norm("A"+String(r.archiveNumber).padStart(3,"0"))));
      if(byArchive)return byArchive;
    }
    const currentCat=list.find(r=>clean(r&&r.category)&&body.includes(norm(r.category)));
    return currentCat||list[0]||null;
  }
  function setAllByName(text,category){
    const n=norm(text),c=clean(category)||null;let changed=0;
    (tasks||[]).forEach(r=>{if(norm(r&&r.text)===n){r.category=c;changed++;}});
    (archive||[]).forEach(r=>{if(norm(r&&r.text)===n){r.category=c;changed++;}});
    const map=readJson(MAP_KEY,{});if(c)map[n]=c;else delete map[n];write(MAP_KEY,JSON.stringify(map));persist();return changed;
  }
  function setSingle(row,category){if(!row)return 0;row.category=clean(category)||null;persist();return 1;}

  function restoreV405PartialHides(container){
    container.querySelectorAll(".task, .archive-task").forEach(card=>{
      card.style.display="";
      [...card.children].forEach(child=>{if(child.style&&child.style.display==="none")child.style.display="";});
    });
  }
  function applySafeFilter(){
    if(!["all","archive"].includes(currentTab))return;
    const container=document.getElementById("viewContainer");if(!container)return;
    restoreV405PartialHides(container);
    const active=localStorage.getItem(FILTER_KEY)||"all";
    if(active==="all")return;
    const wanted=norm(active);
    container.querySelectorAll(".task, .archive-task").forEach(card=>{
      const text=textFromCard(card);
      const row=resolveSingleRow(card,text)||allRows().find(r=>norm(r&&r.text)===norm(text));
      const cat=clean(row&&row.category);
      const show=wanted===""?!cat:norm(cat)===wanted;
      card.style.display=show?"":"none";
    });
  }

  function openQuick(card){
    const text=textFromCard(card);if(!text)return;
    const row=resolveSingleRow(card,text);
    const current=clean(row&&row.category);
    const counts={open:(tasks||[]).filter(r=>norm(r&&r.text)===norm(text)).length,archived:(archive||[]).filter(r=>norm(r&&r.text)===norm(text)).length};
    const modal=document.getElementById("modalContainer");if(!modal)return;
    modal.innerHTML=`<div class="modal-overlay" id="categoryQuickV406"><div class="modal category-quick-modal-v406">
      <div class="modal-title">🏷️ KATEGORIE ZUORDNEN</div>
      <div class="category-quick-name-v406">${esc(text)}</div>
      <div class="category-help-v405">${counts.open} aktuell · ${counts.archived} Archiv. Wähle die Kategorie und entscheide danach, ob nur dieser Eintrag oder alle gleichnamigen Aufgaben geändert werden.</div>
      <select id="categoryQuickSelectV406" class="category-new-select-v405">${options(current)}</select>
      <div class="category-quick-actions-v406">
        <button class="modal-button secondary" id="categoryQuickCancelV406">ZURÜCK</button>
        <button class="modal-button" id="categoryQuickOneV406">NUR DIESE</button>
        <button class="modal-button primary" id="categoryQuickAllV406">ALLE GLEICHNAMIGEN</button>
      </div>
    </div></div>`;
    document.getElementById("categoryQuickCancelV406")?.addEventListener("click",()=>modal.innerHTML="");
    document.getElementById("categoryQuickOneV406")?.addEventListener("click",()=>{
      const c=document.getElementById("categoryQuickSelectV406")?.value||"";setSingle(row,c);modal.innerHTML="";render();
    });
    document.getElementById("categoryQuickAllV406")?.addEventListener("click",()=>{
      const c=document.getElementById("categoryQuickSelectV406")?.value||"";setAllByName(text,c);modal.innerHTML="";render();
    });
  }

  function enhanceCards(){
    if(!["all","archive"].includes(currentTab))return;
    const container=document.getElementById("viewContainer");if(!container)return;
    container.querySelectorAll(".task, .archive-task").forEach(card=>{
      if(card.querySelector(":scope > .category-quick-v406"))return;
      const text=textFromCard(card);if(!text)return;
      const row=resolveSingleRow(card,text)||allRows().find(r=>norm(r&&r.text)===norm(text));
      const btn=document.createElement("button");
      btn.type="button";btn.className="category-quick-v406";btn.title="Kategorie zuordnen";
      btn.innerHTML=`🏷️ <span>${esc(clean(row&&row.category)||"KATEGORIE")}</span>`;
      btn.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();openQuick(card);});
      card.appendChild(btn);
    });
  }
  function afterRender(){setTimeout(()=>{applySafeFilter();enhanceCards();},30);setTimeout(applySafeFilter,120);}

  const previousRender=typeof render==="function"?render:null;
  if(previousRender){render=function(){const r=previousRender.apply(this,arguments);afterRender();return r;};}
  document.addEventListener("change",e=>{if(e.target&&e.target.id==="categoryFilterV405")setTimeout(applySafeFilter,10);},true);
  window.addEventListener("load",afterRender);
  window.__modCategoriesV406={version:BUILD_VERSION,applySafeFilter,setAllByName};
})();
