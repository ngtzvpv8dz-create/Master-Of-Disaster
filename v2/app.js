(() => {
  'use strict';
  const pressables=document.querySelectorAll('.area-card,.undo-r');
  pressables.forEach(el=>{
    const on=()=>el.classList.add('is-pressed');
    const off=()=>el.classList.remove('is-pressed');
    el.addEventListener('pointerdown',on);
    ['pointerup','pointercancel','pointerleave'].forEach(e=>el.addEventListener(e,off));
  });
  const r=document.querySelector('.undo-r');
  if(r) r.addEventListener('click',()=>{
    const toast=document.getElementById('v2Toast');
    if(!toast)return;
    toast.textContent='Undo/Verlauf wird mit TO-DO 2.0 angebunden.';
    toast.classList.add('show');
    clearTimeout(window.__toastTimer);
    window.__toastTimer=setTimeout(()=>toast.classList.remove('show'),1800);
  });
})();