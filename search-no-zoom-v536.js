/* V536 · APP-WIDE SEARCH NO-ZOOM
   - Prevents iOS Safari from auto-zooming when search fields receive focus.
   - Keeps normal pinch zoom/accessibility intact; no maximum-scale or user-scalable lock.
   - Detects existing and dynamically created search inputs across all app surfaces.
*/
(function(){
  'use strict';
  if(window.__modSearchNoZoomV536)return;

  const VERSION='V536';
  const CLASS_NAME='mod-search-no-zoom-v536';
  const STYLE_ID='modSearchNoZoomV536Style';
  const SEARCH_HINT=/search|suche|suchen|find|finden/i;
  let observer=null;

  function isSearchField(node){
    if(!(node instanceof HTMLInputElement||node instanceof HTMLTextAreaElement))return false;
    const type=(node.getAttribute('type')||'').toLowerCase();
    if(type==='search'||node.getAttribute('role')==='searchbox')return true;
    const hints=[
      node.id,
      node.className,
      node.getAttribute('name'),
      node.getAttribute('placeholder'),
      node.getAttribute('aria-label'),
      node.getAttribute('title')
    ].filter(Boolean).join(' ');
    return SEARCH_HINT.test(hints);
  }

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      input[type="search"],
      [role="searchbox"],
      .${CLASS_NAME}{
        font-size:16px!important;
        -webkit-text-size-adjust:100%;
        text-size-adjust:100%;
      }
    `;
    document.head.appendChild(style);
  }

  function tagField(field){
    if(!isSearchField(field))return false;
    field.classList.add(CLASS_NAME);
    field.dataset.modSearchNoZoomV536='true';
    return true;
  }

  function scan(root=document){
    ensureStyle();
    let count=0;
    if(root instanceof HTMLInputElement||root instanceof HTMLTextAreaElement){
      if(tagField(root))count++;
      return count;
    }
    const scope=root?.querySelectorAll?root:document;
    scope.querySelectorAll('input,textarea').forEach(field=>{if(tagField(field))count++;});
    return count;
  }

  function observe(){
    if(observer)return;
    observer=new MutationObserver(records=>{
      for(const record of records){
        for(const node of record.addedNodes){
          if(!(node instanceof Element))continue;
          scan(node);
        }
      }
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }

  function init(){
    scan(document);
    observe();
    document.documentElement.dataset.modSearchNoZoomV536='ready';
    return true;
  }

  const api={
    version:VERSION,
    init,
    scan,
    isSearchField,
    className:CLASS_NAME,
    minSearchFontPx:16,
    iOSFocusZoomPreventedV536:true,
    dynamicSearchFieldsCoveredV536:true,
    pinchZoomPreservedV536:true,
    viewportLockNotUsedV536:true
  };
  window.__modSearchNoZoomV536=api;

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
  window.addEventListener('load',()=>setTimeout(()=>scan(document),180));
})();
