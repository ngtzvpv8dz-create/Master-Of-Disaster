/* V602 · SURFACE HEADER + TAGLINES
   Einheitliche Markenheader-Geometrie und bereichsspezifische Einzeilen-Taglines.
   Die bestehende MASTER-OF-DISASTER-Headline samt Home/S/$/Ordner/Werkzeug bleibt unberührt.
*/
(function(){
  'use strict';
  if(window.__modSurfaceHeaderV602)return;

  const VERSION='V602';
  const EYEBROW_SELECTOR='.header .eyebrow';
  const TAGLINES={
    hub:{text:'Zentrale des Wahnsinns',color:'#b7abc7'},
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
    if(!body)return 'hub';
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
    eyebrow.style.setProperty('--mod-tagline-size-v602','11px');
    eyebrow.style.setProperty('--mod-tagline-letter-v602','1.35px');
    eyebrow.style.setProperty('--mod-tagline-scale-v602','1');
  }

  function fitOneLine(eyebrow){
    if(!eyebrow||!eyebrow.isConnected)return;
    resetFit(eyebrow);
    cancelAnimationFrame(fitRaf);
    fitRaf=requestAnimationFrame(()=>{
      const available=Math.max(1,eyebrow.clientWidth);
      let size=11;
      let spacing=1.35;
      let guard=0;
      while(eyebrow.scrollWidth>available+.5&&size>8.15&&guard<18){
        size=Math.max(8.15,size-.20);
        spacing=Math.max(.04,spacing-.11);
        eyebrow.style.setProperty('--mod-tagline-size-v602',size.toFixed(2)+'px');
        eyebrow.style.setProperty('--mod-tagline-letter-v602',spacing.toFixed(2)+'px');
        guard++;
      }
      const width=Math.max(1,eyebrow.scrollWidth);
      const scale=width>available?Math.max(.80,Math.min(1,available/width)):1;
      eyebrow.style.setProperty('--mod-tagline-scale-v602',scale.toFixed(4));
      eyebrow.dataset.modTaglineFitV602=scale<.999?'condensed':(size<10.99||spacing<1.34?'compact':'native');
      try{window.__modFixedAppHeaderV475?.updateHeight?.();}catch(_){}
    });
  }

  function apply(){
    const eyebrow=document.querySelector(EYEBROW_SELECTOR);
    if(!eyebrow)return false;
    const surface=currentSurface();
    const entry=TAGLINES[surface]||TAGLINES.todo;
    eyebrow.classList.remove('mod-surface-tagline-v601');
    eyebrow.classList.add('mod-surface-tagline-v602');
    eyebrow.dataset.modTaglineSurfaceV602=surface;
    eyebrow.textContent=entry.text;
    eyebrow.style.setProperty('--mod-tagline-color-v602',entry.color);
    fitOneLine(eyebrow);
    return true;
  }

  function init(){
    apply();
    const body=document.body;
    if(body){
      new MutationObserver(apply).observe(body,{attributes:true,attributeFilter:['class','data-mod-app-surface-v515']});
    }
    window.addEventListener('resize',apply,{passive:true});
    window.addEventListener('orientationchange',()=>setTimeout(apply,120),{passive:true});
    window.addEventListener('load',()=>setTimeout(apply,60),{once:true});
  }

  window.__modSurfaceHeaderV602={version:VERSION,taglines:{...TAGLINES},apply,currentSurface,fitOneLine};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();