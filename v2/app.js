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
  if(r) r.addEventListener('click',async()=>{
    const toast=document.getElementById('v2Toast');
    if(!toast)return;
    try{
      if(!window.MOD2Data)throw new Error('2.0-Datenmodul ist noch nicht bereit.');
      const result=await window.MOD2Data.undoLast();
      toast.textContent='Rückgängig: '+result.label+'.';
    }catch(error){
      toast.textContent=error&&error.message?error.message:'Undo nicht möglich.';
    }
    toast.classList.add('show');
    clearTimeout(window.__toastTimer);
    window.__toastTimer=setTimeout(()=>toast.classList.remove('show'),1900);
  });
})();