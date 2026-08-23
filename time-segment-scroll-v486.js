/* V486 · ZEITABSCHNITT-MODAL AUF MOBILGERAETEN SCROLLBAR */
(function(){
  'use strict';

  const BUILD_VERSION='V486';
  const STYLE_ID='timeSegmentScrollV486Style';

  function syncViewportHeight(){
    const visual=window.visualViewport;
    const raw=visual&&Number.isFinite(visual.height)?visual.height:(window.innerHeight||document.documentElement.clientHeight||0);
    const height=Math.max(1,Math.round(raw));
    document.documentElement.style.setProperty('--mod-v486-viewport-height',`${height}px`);
    return height;
  }

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .segment-editor-modal{
        max-height:calc(var(--mod-v486-viewport-height, 100dvh) - 20px - env(safe-area-inset-top) - env(safe-area-inset-bottom))!important;
        overflow-y:auto!important;
        overscroll-behavior-y:contain;
        -webkit-overflow-scrolling:touch;
        touch-action:pan-y;
        scroll-padding-bottom:104px;
      }
      .segment-editor-modal .modal-actions{
        position:sticky;
        bottom:-1px;
        z-index:8;
        flex-wrap:wrap;
        padding:12px 0 max(4px,env(safe-area-inset-bottom));
        background:var(--mod-surface,#171b1f);
        box-shadow:0 -12px 18px rgba(0,0,0,.24);
      }
      .segment-editor-modal .modal-actions .modal-button{
        flex:1 1 120px;
        min-width:0;
      }
      @media(max-width:560px){
        .segment-editor-modal{
          max-height:calc(var(--mod-v486-viewport-height, 100dvh) - 12px - env(safe-area-inset-top) - env(safe-area-inset-bottom))!important;
          scroll-padding-bottom:124px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function revealNewestSegment(){
    const modal=document.querySelector('.segment-editor-modal');
    if(!modal)return false;
    const rows=modal.querySelectorAll('[data-segment-row]');
    const newest=rows[rows.length-1];
    if(!newest)return false;
    try{newest.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'});}catch(_){newest.scrollIntoView(false);}
    return true;
  }

  injectStyle();
  syncViewportHeight();

  const baseAdd=window.addManualSegmentV443;
  if(typeof baseAdd==='function'){
    window.addManualSegmentV443=function(){
      const result=baseAdd.apply(this,arguments);
      setTimeout(revealNewestSegment,0);
      return result;
    };
  }

  window.addEventListener('resize',syncViewportHeight,{passive:true});
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize',syncViewportHeight,{passive:true});
    window.visualViewport.addEventListener('scroll',syncViewportHeight,{passive:true});
  }

  window.__modTimeSegmentScrollV486={
    version:BUILD_VERSION,
    syncViewportHeight,
    revealNewestSegment,
    scrollableModal:true,
    stickyActions:true,
    visualViewportAware:true
  };
})();
