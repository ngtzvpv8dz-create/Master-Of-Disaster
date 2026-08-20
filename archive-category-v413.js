/* V428 · ARCHIV-KATEGORIE DIREKT ÜBER BESTEHENDES BADGE + DIREKTER ARCHIVTRANSFER-SCHUTZ */
(function(){
  const BUILD_VERSION="V428";

  function preserveCategoryForArchivedTask(task,beforeLen){
    if(!task||!task.category||!Array.isArray(archive))return false;
    const category=String(task.category);
    const recent=archive.slice(Math.max(0,Number(beforeLen)||0));
    let row=recent.find(item=>String(item&&item.sourceTaskId)===String(task.id));
    if(!row)row=[...archive].reverse().find(item=>String(item&&item.sourceTaskId)===String(task.id));
    if(!row)row=[...archive].reverse().find(item=>String(item&&item.text||"")===String(task.text||"")&&!item.category);
    if(!row)return false;
    if(row.category===category)return false;
    row.category=category;
    if(typeof saveArchive==="function")saveArchive();
    return true;
  }

  if(typeof archiveCompletedTask==="function"&&!archiveCompletedTask.__v428Wrapped){
    const originalArchiveCompletedTask=archiveCompletedTask;
    archiveCompletedTask=function(task){
      const snapshot=task?{id:task.id,text:task.text,category:task.category?String(task.category):null}:null;
      const beforeLen=Array.isArray(archive)?archive.length:0;
      const result=originalArchiveCompletedTask.apply(this,arguments);
      if(snapshot&&snapshot.category)preserveCategoryForArchivedTask(snapshot,beforeLen);
      return result;
    };
    archiveCompletedTask.__v428Wrapped=true;
  }

  function enhanceArchiveBadges(){
    const container=document.getElementById("viewContainer");
    if(!container)return;

    container.querySelectorAll(".archive-task").forEach(card=>{
      card.querySelectorAll(".archive-category-edit-v412").forEach(button=>button.remove());

      const badge=card.querySelector(".category-inline-v412");
      if(!badge)return;

      badge.classList.add("archive-category-click-v413");
      badge.style.pointerEvents="auto";
      badge.style.cursor="pointer";
      badge.setAttribute("role","button");
      badge.setAttribute("tabindex","0");
      badge.setAttribute("title","Kategorie ändern");

      if(badge.dataset.archiveCategoryV413==="1")return;
      badge.dataset.archiveCategoryV413="1";

      const openEditor=event=>{
        event?.preventDefault?.();
        event?.stopPropagation?.();
        const api=window.__modCategoriesV412;
        const row=api?.rowForCard?.(card);
        if(row&&typeof api?.openArchiveCategoryEditor==="function"){
          api.openArchiveCategoryEditor(row);
        }
      };

      badge.addEventListener("click",openEditor);
      badge.addEventListener("keydown",event=>{
        if(event.key==="Enter"||event.key===" ")openEditor(event);
      });
    });
  }

  const previousRender=typeof render==="function"?render:null;
  if(previousRender){
    render=function(){
      const result=previousRender.apply(this,arguments);
      setTimeout(enhanceArchiveBadges,0);
      return result;
    };
  }

  window.__modArchiveCategoryV413={version:BUILD_VERSION,enhanceArchiveBadges,preserveCategoryForArchivedTask};
  window.addEventListener("load",()=>setTimeout(enhanceArchiveBadges,150));
})();
