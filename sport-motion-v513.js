/* V513 · SPORT MOTION POLISH
   - Kurzes Hochzählen sichtbarer Sportzahlen.
   - Heller Wanderabschnitt auf der Wellenlinie.
   - Sanfter Lichtschweif auf dem Panelrahmen.
   - Keine Datenmigration und keine Veränderung gespeicherter Sportwerte.
*/
(function(){
  'use strict';
  if(window.__modSportMotionV513)return;

  const VERSION='V513';
  const ROOT_ID='sportRootV510';
  let observer=null;
  let bodyObserver=null;
  let enhancing=false;
  let lastPanel=null;
  let rafIds=[];

  const reducedMotion=()=>window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function cancelAnimations(){
    rafIds.forEach(id=>cancelAnimationFrame(id));
    rafIds=[];
  }

  function formatMinutes(minutes,withSuffix=false){
    const m=Math.max(0,Math.round(Number(minutes)||0));
    const h=Math.floor(m/60),rest=m%60;
    if(h<=0)return withSuffix?`${rest} min`:`${rest}`;
    const value=`${h}:${String(rest).padStart(2,'0')}`;
    return withSuffix?`${value} h`:value;
  }

  function parseMetric(text){
    const raw=String(text||'').trim();
    let m=raw.match(/^(\d+):(\d{2})\s*h$/i);
    if(m)return {kind:'minutes',value:Number(m[1])*60+Number(m[2]),suffix:true};
    m=raw.match(/^(\d+)\s*min$/i);
    if(m)return {kind:'minutes',value:Number(m[1]),suffix:true};
    m=raw.match(/^(\d+):(\d{2})$/);
    if(m)return {kind:'minutes',value:Number(m[1])*60+Number(m[2]),suffix:false};
    m=raw.match(/^(\d+)$/);
    if(m)return {kind:'integer',value:Number(m[1])};
    return null;
  }

  function animateValue(el,metric,duration=620){
    if(!el||!metric||reducedMotion())return;
    const target=Math.max(0,Number(metric.value)||0);
    const start=performance.now();
    el.classList.remove('sport-counting-v513');
    void el.offsetWidth;
    el.classList.add('sport-counting-v513');

    function frame(now){
      const p=Math.min(1,(now-start)/duration);
      const eased=1-Math.pow(1-p,3.2);
      const value=Math.round(target*eased);
      if(metric.kind==='minutes')el.textContent=formatMinutes(value,metric.suffix);
      else el.textContent=String(value);
      if(p<1){const id=requestAnimationFrame(frame);rafIds.push(id);}
      else setTimeout(()=>el.classList.remove('sport-counting-v513'),80);
    }
    const id=requestAnimationFrame(frame);rafIds.push(id);
  }

  function animateNumbers(panel){
    if(!panel||reducedMotion())return;
    cancelAnimations();

    const targets=[];
    panel.querySelectorAll('.sport-duration-v510').forEach(el=>{
      if(el.dataset.totalMinutes){
        targets.push({el,metric:{kind:'minutes',value:Number(el.dataset.totalMinutes)||0,suffix:false},duration:640});
      }else{
        const metric=parseMetric(el.textContent);
        if(metric)targets.push({el,metric,duration:560});
      }
    });

    panel.querySelectorAll('.sport-stat-card-v512 strong').forEach((el,index)=>{
      const metric=parseMetric(el.textContent);
      if(metric)targets.push({el,metric,duration:520+index*55});
    });

    targets.forEach(({el,metric,duration},index)=>setTimeout(()=>animateValue(el,metric,duration),Math.min(100,index*35)));
  }

  function enhanceWave(panel){
    const svg=panel?.querySelector('.sport-wave-v512');
    const base=svg?.querySelector('path:not(.sport-wave-runner-v513)');
    if(!svg||!base||svg.querySelector('.sport-wave-runner-v513'))return;
    const runner=base.cloneNode(false);
    runner.classList.add('sport-wave-runner-v513');
    runner.removeAttribute('stroke');
    svg.appendChild(runner);
  }

  function enhanceBorder(panel){
    if(!panel||panel.querySelector(':scope > .sport-border-runner-v513'))return;
    const runner=document.createElement('div');
    runner.className='sport-border-runner-v513';
    runner.setAttribute('aria-hidden','true');
    panel.appendChild(runner);
  }

  function enhance({count=true}={}){
    if(enhancing)return false;
    const root=document.getElementById(ROOT_ID);
    const panel=root?.querySelector('[data-sport-panel-v512]');
    if(!root||!panel)return false;
    enhancing=true;
    enhanceWave(panel);
    enhanceBorder(panel);
    if(count&&(panel!==lastPanel||document.body.classList.contains('mod-sport-mode-v510')))animateNumbers(panel);
    lastPanel=panel;
    enhancing=false;
    return true;
  }

  function startObservers(){
    const root=document.getElementById(ROOT_ID);
    if(root&&!observer){
      observer=new MutationObserver(()=>{
        if(enhancing)return;
        queueMicrotask(()=>enhance({count:true}));
      });
      observer.observe(root,{childList:true,subtree:false});
    }

    if(!bodyObserver){
      let wasSport=document.body.classList.contains('mod-sport-mode-v510');
      bodyObserver=new MutationObserver(()=>{
        const isSport=document.body.classList.contains('mod-sport-mode-v510');
        if(isSport&&!wasSport)setTimeout(()=>enhance({count:true}),70);
        wasSport=isSport;
      });
      bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
    }
  }

  function init(){
    if(!window.__modSportTabsV512||!document.getElementById(ROOT_ID))return false;
    enhance({count:document.body.classList.contains('mod-sport-mode-v510')});
    startObservers();
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(init()||tries>240)clearInterval(timer);
  },100);

  window.__modSportMotionV513={
    version:VERSION,
    enhance,
    animateNumbers:()=>animateNumbers(document.querySelector(`#${ROOT_ID} [data-sport-panel-v512]`)),
    waveRunner:true,
    borderRunner:true,
    countUp:true,
    dataSemanticsUntouched:true
  };

  window.addEventListener('load',()=>setTimeout(init,220));
  window.addEventListener('focus',()=>setTimeout(()=>enhance({count:false}),90));
})();
