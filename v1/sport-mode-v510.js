/* V510 · SPORT MODE SHELL
   - S in MASTER toggles To-do <-> Sport in both directions.
   - Sport view is visually independent from the task UI.
   - FitX gets the first vertical side register.
   - Sport sessions live in their own masterOfDisaster localStorage key.
*/
(function(){
  'use strict';
  if(window.__modSportModeV510)return;

  const VERSION='V510';
  const MODE_KEY='masterOfDisasterAppModeV510';
  const DATA_KEY='masterOfDisasterSportSessionsV510';
  const ROOT_ID='sportRootV510';
  const SWITCH_ID='sportSwitchV510';
  const TODO_EYEBROW='WEEK-AND-END-TO-DO-DINGSI';
  const SPORT_EYEBROW='SPORT · FITX · TRACKING';
  const reducedMotion=()=>window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let switchObserver=null;
  let ensureTimer=null;

  const seedSession={
    id:'fitx-2026-09-08-1803',
    area:'fitx',
    date:'2026-09-08',
    startedAt:'2026-09-08T18:03:00+02:00',
    endedAt:'2026-09-08T20:36:00+02:00',
    activities:[{
      id:'tour-de-x-2026-09-08',
      type:'course',
      name:'Tour de X',
      startedAt:'2026-09-08T19:00:00+02:00',
      endedAt:'2026-09-08T19:50:00+02:00'
    }],
    note:'Restzeit: Fahrzeit, Aufwärmen, Umziehen und sonstige Zeit außerhalb des Kurses.'
  };

  function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function safeParse(value,fallback){try{return JSON.parse(value);}catch(_){return fallback;}}
  function validDate(value){const d=new Date(value);return Number.isFinite(d.getTime())?d:null;}
  function durationMs(start,end){const a=validDate(start),b=validDate(end);return a&&b?Math.max(0,b-a):0;}
  function totalMinutes(session){return Math.round(durationMs(session.startedAt,session.endedAt)/60000);}
  function activityMinutes(session){return (Array.isArray(session.activities)?session.activities:[]).reduce((sum,row)=>sum+Math.round(durationMs(row.startedAt,row.endedAt)/60000),0);}
  function formatMinutes(minutes){
    const m=Math.max(0,Math.round(Number(minutes)||0)),h=Math.floor(m/60),rest=m%60;
    if(h<=0)return `${rest} min`;
    return `${h}:${String(rest).padStart(2,'0')} h`;
  }
  function clock(value){
    const d=validDate(value);if(!d)return '–';
    return new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);
  }
  function dateLabel(dateKey){
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey||''));
    if(!m)return String(dateKey||'');
    const date=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),12));
    return new Intl.DateTimeFormat('de-DE',{timeZone:'UTC',weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).format(date);
  }

  function normalizeSession(row){
    if(!row||typeof row!=='object')return null;
    if(!row.id||!row.date||!validDate(row.startedAt)||!validDate(row.endedAt))return null;
    if(new Date(row.endedAt)<=new Date(row.startedAt))return null;
    const activities=(Array.isArray(row.activities)?row.activities:[]).filter(a=>a&&a.name&&validDate(a.startedAt)&&validDate(a.endedAt)&&new Date(a.endedAt)>new Date(a.startedAt)).map(a=>({...a}));
    return {...row,area:String(row.area||'fitx').toLowerCase(),activities};
  }

  function loadSessions(){
    let rows=safeParse(localStorage.getItem(DATA_KEY),null);
    if(!Array.isArray(rows)){
      rows=[seedSession];
      try{localStorage.setItem(DATA_KEY,JSON.stringify(rows));}catch(_){}
    }
    return rows.map(normalizeSession).filter(Boolean).sort((a,b)=>new Date(b.startedAt)-new Date(a.startedAt));
  }

  function saveSessions(rows){
    const clean=(Array.isArray(rows)?rows:[]).map(normalizeSession).filter(Boolean);
    localStorage.setItem(DATA_KEY,JSON.stringify(clean));
    return clean;
  }

  function ensureRoot(){
    let root=document.getElementById(ROOT_ID);
    if(root)return root;
    const app=document.querySelector('.app');
    if(!app)return null;
    root=document.createElement('section');
    root.id=ROOT_ID;
    root.className='sport-root-v510';
    root.setAttribute('aria-label','Sportbereich');
    const input=document.getElementById('inputPanel');
    app.insertBefore(root,input||null);
    return root;
  }

  function latestFitx(){return loadSessions().find(row=>row.area==='fitx')||null;}

  function renderSport(){
    const root=ensureRoot();if(!root)return false;
    const session=latestFitx();
    if(!session){
      root.innerHTML='<div class="sport-stage-v510"><div class="sport-side-rail-v510"><button type="button" class="sport-side-tab-v510 active" data-sport-tab-v510="fitx"><span class="sport-side-tab-label-v510">FITX</span></button></div><section class="sport-panel-v510"><div class="sport-hero-v510"><div class="sport-kicker-v510">FITX</div><p class="sport-date-v510">Noch keine Einheit gespeichert.</p></div></section></div>';
      bindSportControls(root);return true;
    }

    const total=totalMinutes(session),active=activityMinutes(session),other=Math.max(0,total-active);
    const course=session.activities[0]||null;
    const coursePct=total?Math.max(0,Math.min(100,(active/total)*100)):0;
    const otherPct=Math.max(0,100-coursePct);
    root.innerHTML=`
      <div class="sport-stage-v510">
        <aside class="sport-side-rail-v510" aria-label="Sportbereiche">
          <button type="button" class="sport-side-tab-v510 active" data-sport-tab-v510="fitx" aria-current="page" aria-label="FitX öffnen">
            <span class="sport-side-tab-label-v510">FITX</span>
          </button>
        </aside>
        <section class="sport-panel-v510" aria-labelledby="sportFitxTitleV510">
          <svg class="sport-wave-v510" viewBox="0 0 700 96" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 58 C70 58 78 25 142 25 S226 82 300 53 S406 19 472 52 S590 79 700 31" fill="none" stroke="currentColor" stroke-width="1.4" vector-effect="non-scaling-stroke"/>
          </svg>
          <div class="sport-hero-v510">
            <div class="sport-kicker-v510"><span class="sport-live-dot-v510"></span> FITX · LETZTE EINHEIT</div>
            <p class="sport-date-v510">${esc(dateLabel(session.date))}</p>
            <div class="sport-duration-row-v510">
              <div class="sport-duration-v510" id="sportDurationV510" data-total-minutes="${total}">${esc(formatMinutes(total).replace(' h',''))}</div>
              <div class="sport-duration-unit-v510">Gesamtaufwand</div>
            </div>
            <div class="sport-time-window-v510">${esc(clock(session.startedAt))} <span>→</span> ${esc(clock(session.endedAt))}</div>
          </div>
          <div class="sport-content-v510">
            <article class="sport-session-card-v510">
              <div class="sport-card-head-v510">
                <div>
                  <h2 class="sport-card-title-v510" id="sportFitxTitleV510">${esc(course?.name||'FitX')}</h2>
                  <div class="sport-card-sub-v510">${course?`${esc(clock(course.startedAt))}–${esc(clock(course.endedAt))}`:'Keine Unteraktivität dokumentiert'}</div>
                </div>
                <div class="sport-chip-v510">${esc(formatMinutes(active))}</div>
              </div>
              <div class="sport-bar-v510" aria-label="Zeitaufteilung">
                <div class="sport-bar-course-v510" style="width:${coursePct.toFixed(2)}%"></div>
                <div class="sport-bar-other-v510" style="width:${otherPct.toFixed(2)}%"></div>
              </div>
              <div class="sport-meta-grid-v510">
                <div class="sport-meta-v510"><div class="sport-meta-label-v510">Kurs</div><div class="sport-meta-value-v510">${esc(formatMinutes(active))}</div></div>
                <div class="sport-meta-v510"><div class="sport-meta-label-v510">Drumherum</div><div class="sport-meta-value-v510">${esc(formatMinutes(other))}</div></div>
              </div>
              <div class="sport-footnote-v510">${esc(session.note||'')}</div>
            </article>
            <div class="sport-mode-hint-v510">Das blaue S in MASTER schaltet jederzeit zurück zur To-do-Ansicht.</div>
          </div>
        </section>
      </div>`;
    bindSportControls(root);
    return true;
  }

  function bindSportControls(root){
    root.querySelectorAll('[data-sport-tab-v510]').forEach(button=>button.addEventListener('click',()=>{
      root.classList.remove('sport-repulse-v510');
      void root.offsetWidth;
      root.classList.add('sport-repulse-v510');
      setTimeout(()=>root.classList.remove('sport-repulse-v510'),380);
    }));
  }

  function installSwitch(){
    const h1=document.querySelector('.header h1');
    if(!h1)return false;
    let button=document.getElementById(SWITCH_ID);
    if(button&&h1.contains(button))return true;
    const text=String(h1.textContent||'').trim().replace(/\s+/g,' ');
    if(text!=='MASTER OF DISASTER')return false;
    h1.textContent='';
    h1.appendChild(document.createTextNode('MA'));
    button=document.createElement('button');
    button.id=SWITCH_ID;
    button.type='button';
    button.className='sport-switch-v510';
    button.textContent='S';
    button.setAttribute('aria-label','Zwischen To-do und Sport wechseln');
    button.setAttribute('aria-pressed',document.body.classList.contains('mod-sport-mode-v510')?'true':'false');
    button.title='To-do / Sport wechseln';
    button.addEventListener('click',toggleMode);
    h1.appendChild(button);
    h1.appendChild(document.createTextNode('TER OF DISASTER'));
    return true;
  }

  function ensureChrome(){
    const installed=installSwitch();
    if(installed)setEyebrow(currentMode());
    ensureRoot();
    return installed;
  }

  function startSwitchGuard(){
    if(ensureTimer)clearInterval(ensureTimer);
    let tries=0;
    ensureTimer=setInterval(()=>{
      tries+=1;
      ensureChrome();
      if(document.getElementById(SWITCH_ID)&&tries>=12){clearInterval(ensureTimer);ensureTimer=null;}
      else if(tries>=40){clearInterval(ensureTimer);ensureTimer=null;}
    },250);

    if(switchObserver)return;
    const header=document.querySelector('.header');
    if(!header||typeof MutationObserver!=='function')return;
    switchObserver=new MutationObserver(()=>{
      if(!document.getElementById(SWITCH_ID))queueMicrotask(()=>ensureChrome());
    });
    switchObserver.observe(header,{childList:true,subtree:true,characterData:true});
  }

  function animateTotal(){
    if(reducedMotion())return;
    const el=document.getElementById('sportDurationV510');if(!el)return;
    const target=Math.max(0,Number(el.dataset.totalMinutes)||0),start=performance.now(),duration=440;
    function frame(now){
      const p=Math.min(1,(now-start)/duration),eased=1-Math.pow(1-p,3),value=Math.round(target*eased);
      el.textContent=formatMinutes(value).replace(' h','');
      if(p<1)requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function animateModeButton(){
    const button=document.getElementById(SWITCH_ID);if(!button||reducedMotion()||typeof button.animate!=='function')return;
    button.animate([{transform:'scale(1)'},{transform:'scale(1.18) rotate(-5deg)'},{transform:'scale(1)'}],{duration:260,easing:'ease-out'});
  }

  function setEyebrow(mode){const el=document.querySelector('.header .eyebrow');if(el)el.textContent=mode==='sport'?SPORT_EYEBROW:TODO_EYEBROW;}

  function setMode(mode,{persist=true,animate=true}={}){
    mode=mode==='sport'?'sport':'todo';
    ensureChrome();renderSport();
    const root=document.getElementById(ROOT_ID),button=document.getElementById(SWITCH_ID);
    document.body.classList.toggle('mod-sport-mode-v510',mode==='sport');
    document.body.dataset.modAppModeV510=mode;
    button?.setAttribute('aria-pressed',mode==='sport'?'true':'false');
    setEyebrow(mode);
    if(persist){try{localStorage.setItem(MODE_KEY,mode);}catch(_){}}
    if(animate){animateModeButton();if(mode==='sport'&&root){root.classList.remove('sport-enter-v510');void root.offsetWidth;root.classList.add('sport-enter-v510');setTimeout(()=>root.classList.remove('sport-enter-v510'),460);animateTotal();}}
    try{window.__modFixedAppHeaderV475?.updateHeight?.();}catch(_){}
    return mode;
  }

  function toggleMode(){return setMode(document.body.classList.contains('mod-sport-mode-v510')?'todo':'sport');}
  function currentMode(){return document.body.classList.contains('mod-sport-mode-v510')?'sport':'todo';}

  function init(){
    ensureChrome();renderSport();startSwitchGuard();
    const stored=localStorage.getItem(MODE_KEY)==='sport'?'sport':'todo';
    setMode(stored,{persist:false,animate:false});
  }

  const baseRender=typeof window.render==='function'?window.render:null;
  if(baseRender){window.render=function(){const out=baseRender.apply(this,arguments);setTimeout(()=>{ensureChrome();renderSport();setMode(currentMode(),{persist:false,animate:false});},0);return out;};}

  window.__modSportModeV510={version:VERSION,toggle:toggleMode,setMode,currentMode,render:renderSport,installSwitch,ensureChrome,loadSessions,saveSessions,dataKey:DATA_KEY,modeKey:MODE_KEY,switchGuard:true};

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
  window.addEventListener('load',()=>setTimeout(init,110));
})();
