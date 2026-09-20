/* V601 · SURFACE TAGLINES
   Bereichsspezifische Untertitel direkt unter MASTER OF DISASTER.
   Die bestehende Markenheadline und ihre Bereichssymbole bleiben unangetastet.
*/
(function(){
  'use strict';
  if(window.__modSurfaceTaglinesV601)return;

  const VERSION='V601';
  const EYEBROW_SELECTOR='.header .eyebrow';
  const TAGLINES={
    hub:{text:'Week-And-End-To-Do-Dingsi',color:'#8c969f'},
    todo:{text:'Week-And-End-To-Do-Dingsi',color:'#ffad63'},
    sport:{text:'Schwitzen mit System · Run from the Fett',color:'#6fe4ea'},
    finance:{text:'Money meets Monatsende · Zahlen mit Nebenwirkung',color:'#70ffb4'},
    kistology:{text:'Stapeln mit System · From Chaos to Science',color:'#ff4ca8'},
    food:{text:'Fridge Control · Vorrat statt Verfall',color:'#477b52'},
    shopping:{text:'Remember the Einkauf · Vergessen war gestern',color:'#d7a6ff'},
    backstage:{text:'Behind the Madness',color:'#ffd77a'}
  };

  let fitRaf=0;

  function currentSurface(){
    const body=document.body;
    if(!body)return 'todo';
    if(body.classList.contains('mod-backstage-v530'))return 'backstage';
    if(body.classList.contains('mod-finance-v552'))return 'finance';
    if(body.classList.contains('mod-food-v544'))return 'food';
    if(body.classList.contains('mod-kistology-v535'))return 'kistology';
    if(body.classList.contains('mod-sport-mode-v510'))return 'sport';
    const surface=String(body.dataset.modAppSurfaceV515||'').toLowerCase();
    if(TAGLINES[surface])return surface;
    if(body.classList.contains('mod-app-hub-v515')||surface==='hub')return 'hub';
    return 'todo';
  }

  function resetFit(eyebrow){
    eyebrow.style.setProperty('--mod-tagline-size-v601','11px');
    eyebrow.style.setProperty('--mod-tagline-letter-v601','1.45px');
    eyebrow.style.setProperty('--mod-tagline-scale-v601','1');
  }

  function fitOneLine(eyebrow){
    if(!eyebrow||!eyebrow.isConnected)return;
    resetFit(eyebrow);
    const fit=()=>{
      const available=Math.max(1,eyebrow.clientWidth);
      let size=11;
      let spacing=1.45;
      let guard=0;
      while(eyebrow.scrollWidth>available+.5&&size>8.25&&guard<16){
        size=Math.max(8.25,size-.25);
        spacing=Math.max(.10,spacing-.12);
        eyebrow.style.setProperty('--mod-tagline-size-v601',size.toFixed(2)+'px');
        eyebrow.style.setProperty('--mod-tagline-letter-v601',spacing.toFixed(2)+'px');
        guard++;
      }
      const width=Math.max(1,eyebrow.scrollWidth);
      const scale=width>available?Math.max(.82,Math.min(1,available/width)):1;
      eyebrow.style.setProperty('--mod-tagline-scale-v601',scale.toFixed(4));
      eyebrow.dataset.modTaglineFitV601=scale<.999?'condensed':(size<10.99||spacing<1.44?'compact':'native');
    };
    cancelAnimationFrame(fitRaf);
    fitRaf=requestAnimationFrame(fit);
  }

  function apply(){
    const eyebrow=document.querySelector(EYEBROW_SELECTOR);
    if(!eyebrow)return false;
    const surface=currentSurface();
    const entry=TAGLINES[surface]||TAGLINES.todo;
    eyebrow.classList.add('mod-surface-tagline-v601');
    eyebrow.dataset.modTaglineSurfaceV601=surface;
    if(eyebrow.textContent!==entry.text)eyebrow.textContent=entry.text;
    eyebrow.style.setProperty('--mod-tagline-color-v601',entry.color);
    fitOneLine(eyebrow);
    try{window.__modFixedAppHeaderV475?.updateHeight?.();}catch(_){}
    return true;
  }

  function init(){
    apply();
    const body=document.body;
    if(body){
      new MutationObserver(apply).observe(body,{attributes:true,attributeFilter:['class','data-mod-app-surface-v515']});
    }
    window.addEventListener('resize',()=>apply(),{passive:true});
    window.addEventListener('orientationchange',()=>setTimeout(apply,120),{passive:true});
    window.addEventListener('load',()=>setTimeout(apply,80),{once:true});
  }

  window.__modSurfaceTaglinesV601={version:VERSION,taglines:{...TAGLINES},apply,currentSurface,fitOneLine};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();