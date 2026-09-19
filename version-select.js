(() => {
  'use strict';
  document.querySelectorAll('.version-card').forEach(card=>{
    const on=()=>card.classList.add('is-pressed');
    const off=()=>card.classList.remove('is-pressed');
    card.addEventListener('pointerdown',on);
    ['pointerup','pointercancel','pointerleave'].forEach(e=>card.addEventListener(e,off));
  });
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'})
      .then(reg=>reg.update()).catch(()=>{});
  }
})();