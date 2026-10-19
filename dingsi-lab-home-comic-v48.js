/* Dingsi Lab V48: comic homescreen experiment only; no production preference writes. */
(() => {
  'use strict';
  const STORAGE_KEY='mod-dingsi-lab-comic-homescreen-v48-theme';
  const themes=new Set(['light','evening']);
  const buttons=[...document.querySelectorAll('[data-comic-theme]')];
  const toast=document.getElementById('comic-toast');
  const meta=document.querySelector('meta[name="theme-color"]');
  let timer;
  function apply(name,save) {
    const theme=themes.has(name)?name:'light';
    document.body.classList.toggle('comic-evening',theme==='evening');
    document.body.classList.toggle('comic-light',theme==='light');
    if(meta)meta.setAttribute('content',theme==='evening'?'#282d4d':'#d9ecfa');
    buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.comicTheme===theme)));
    if(save){try{localStorage.setItem(STORAGE_KEY,theme)}catch(_){}}
  }
  let saved='light';
  try{saved=localStorage.getItem(STORAGE_KEY)||'light'}catch(_){}
  apply(saved,false);
  buttons.forEach(button=>button.addEventListener('click',()=>apply(button.dataset.comicTheme,true)));
  document.querySelectorAll('.comic-tile').forEach(button=>{
    button.addEventListener('click',()=>{
      const title=button.querySelector('.comic-label')?.textContent||'Bereich';
      if(!toast)return;
      toast.textContent=title+' · Comic-Homescreen-Vorschau, noch nicht produktiv';
      toast.style.display='block';
      clearTimeout(timer);
      timer=setTimeout(()=>{toast.style.display='none'},2400);
    });
  });
})();