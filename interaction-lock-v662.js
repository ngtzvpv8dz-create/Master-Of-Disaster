/* V662 · Touch-/Viewport-Lock
   - verhindert Pinch-/Gesture-Zoom
   - verhindert horizontales Dokument-Driften
   - laesst vertikales Scrollen bestehen
*/
(function(){
  'use strict';
  if(window.__modInteractionLockV662)return;

  const VERSION='V662';

  function stopGesture(event){
    event.preventDefault();
  }

  function stopMultiTouch(event){
    if(event.touches&&event.touches.length>1)event.preventDefault();
  }

  function stopWheelZoom(event){
    if(event.ctrlKey||event.metaKey)event.preventDefault();
  }

  function clampHorizontalScroll(){
    if(window.scrollX!==0){
      window.scrollTo({left:0,top:window.scrollY,behavior:'instant'});
    }
    if(document.documentElement.scrollLeft!==0)document.documentElement.scrollLeft=0;
    if(document.body&&document.body.scrollLeft!==0)document.body.scrollLeft=0;
  }

  function init(){
    document.documentElement.dataset.modInteractionLockV662='ready';

    ['gesturestart','gesturechange','gestureend'].forEach(type=>{
      document.addEventListener(type,stopGesture,{passive:false});
    });

    document.addEventListener('touchmove',stopMultiTouch,{passive:false});
    document.addEventListener('wheel',stopWheelZoom,{passive:false});
    window.addEventListener('scroll',clampHorizontalScroll,{passive:true});

    clampHorizontalScroll();
    return true;
  }

  window.__modInteractionLockV662={
    version:VERSION,
    init,
    verticalOnly:true,
    pinchZoomDisabled:true,
    horizontalDocumentScrollDisabled:true
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
