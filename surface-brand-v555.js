/* V555 · STATIC SURFACE BRAND MARK
   Removes the legacy S toggle from the header and keeps the character visual-only.
*/
(function(){
  'use strict';
  if(window.__modSurfaceBrandV555)return;

  const MARK_ID='sportSwitchV510';
  let observer=null;
  let bodyObserver=null;

  function desiredMark(){
    return document.body?.classList?.contains('mod-finance-v552')?'$':'S';
  }

  function sync(){
    let mark=document.getElementById(MARK_ID);
    if(!mark)return false;

    if(mark.tagName!=='SPAN'||!mark.classList.contains('mod-surface-mark-v555')){
      const replacement=document.createElement('span');
      replacement.id=MARK_ID;
      replacement.className='sport-switch-v510 mod-surface-mark-v555';
      replacement.setAttribute('aria-hidden','true');
      replacement.textContent=desiredMark();
      mark.replaceWith(replacement);
      mark=replacement;
    }

    mark.classList.add('mod-surface-mark-v555');
    mark.removeAttribute('role');
    mark.removeAttribute('tabindex');
    mark.removeAttribute('title');
    mark.removeAttribute('aria-label');
    mark.removeAttribute('aria-pressed');
    mark.removeAttribute('onclick');
    mark.setAttribute('aria-hidden','true');
    mark.textContent=desiredMark();
    return true;
  }

  function observe(){
    if(!observer&&typeof MutationObserver==='function'){
      observer=new MutationObserver(()=>queueMicrotask(sync));
      observer.observe(document.documentElement,{subtree:true,childList:true});
    }
    if(!bodyObserver&&document.body&&typeof MutationObserver==='function'){
      bodyObserver=new MutationObserver(()=>sync());
      bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
    }
  }

  function init(){
    sync();
    observe();
    setTimeout(sync,0);
    setTimeout(sync,160);
    setTimeout(sync,600);
  }

  window.__modSurfaceBrandV555={version:'V555',sync,markId:MARK_ID,interactive:false};

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
  window.addEventListener('load',()=>setTimeout(sync,120),{once:true});
})();