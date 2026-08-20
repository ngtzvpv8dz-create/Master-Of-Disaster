/* V413 · ARCHIV-KATEGORIE DIREKT ÜBER BESTEHENDES BADGE */
(function(){
  const BUILD_VERSION="V413";

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

  window.__modArchiveCategoryV413={version:BUILD_VERSION,enhanceArchiveBadges};
  window.addEventListener("load",()=>setTimeout(enhanceArchiveBadges,150));
})();
