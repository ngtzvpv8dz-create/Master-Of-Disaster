/* V427 · ARCHIV-KATEGORIE DIREKT ÜBER BESTEHENDES BADGE + TRANSFER-SCHUTZ */
(function(){
  const BUILD_VERSION="V427";

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

  const previousProcessDayTransition=typeof processDayTransition==="function"?processDayTransition:null;
  if(previousProcessDayTransition){
    processDayTransition=function(){
      const categoriesByTaskId=new Map((Array.isArray(tasks)?tasks:[]).map(task=>[
        String(task?.id),
        task?.category?String(task.category):null
      ]));

      const result=previousProcessDayTransition.apply(this,arguments);
      let categoryRestored=false;

      (Array.isArray(archive)?archive:[]).forEach(item=>{
        const category=item?.sourceTaskId!=null
          ? categoriesByTaskId.get(String(item.sourceTaskId))
          : null;
        if(category&&!item.category){
          item.category=category;
          categoryRestored=true;
        }
      });

      if(categoryRestored&&typeof saveArchive==="function"){
        saveArchive();
      }

      return result;
    };
  }

  const previousRender=typeof render==="function"?render:null;
  if(previousRender){
    render=function(){
      const result=previousRender.apply(this,arguments);
      setTimeout(enhanceArchiveBadges,0);
      return result;
    };
  }

  window.__modArchiveCategoryV413={version:BUILD_VERSION,enhanceArchiveBadges};
  window.addEventListener("load",()=>setTimeout(enhanceArchiveBadges,150));
})();
