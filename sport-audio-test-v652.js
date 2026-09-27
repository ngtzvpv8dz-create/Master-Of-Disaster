/* V657 · SPORT · beep-only interval cue laboratory */
(function(){
  'use strict';
  if(window.__modSportAudioTestV652)return;

  const VERSION='V657';
  const ROOT_ID='sportRootV510';
  const CARD_ID='sportAudioTestV652';

  let audioContext=null;
  let timers=[];
  let running=false;
  let runLabel='';

  const cue={
    countdownLow:{freq:520,duration:140,gain:0.12,type:'sine'},
    go:{freq:940,duration:260,gain:0.14,type:'sine'},
    halfway:{freq:720,duration:90,gain:0.11,type:'sine'},
    end:{freq:390,duration:2000,gain:0.10,type:'sine'},
    warning:{freq:620,duration:180,gain:0.11,type:'sine'}
  };

  const css=`
    #${CARD_ID}{margin:0 0 14px;padding:14px;border:1px solid rgba(111,228,234,.18);border-radius:16px;background:linear-gradient(180deg,rgba(7,33,38,.82),rgba(3,18,22,.72));box-shadow:inset 0 1px 0 rgba(255,255,255,.03)}
    #${CARD_ID} .sat-kicker{color:#74d6dc;font-size:.55rem;font-weight:950;letter-spacing:.13em}
    #${CARD_ID} h3{margin:4px 0 4px;color:#eefcfd;font-size:.9rem}
    #${CARD_ID} p{margin:0;color:#83a4a8;font-size:.67rem;line-height:1.45}
    #${CARD_ID} .sat-status{margin-top:10px;padding:9px 10px;border-radius:11px;background:rgba(0,0,0,.18);color:#b9d4d7;font-size:.64rem;line-height:1.45}
    #${CARD_ID} .sat-cues{display:grid;gap:7px;margin-top:12px}
    #${CARD_ID} .sat-cue{display:grid;grid-template-columns:92px minmax(0,1fr);gap:10px;align-items:center;padding:8px 9px;border-radius:10px;background:rgba(0,0,0,.12)}
    #${CARD_ID} .sat-cue strong{color:#dff7f9;font-size:.61rem}
    #${CARD_ID} .sat-cue span{color:#76979b;font-size:.59rem;line-height:1.35}
    #${CARD_ID} .sat-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
    #${CARD_ID} button{padding:10px 12px;border:1px solid rgba(111,228,234,.25);border-radius:10px;background:linear-gradient(180deg,rgba(24,123,135,.72),rgba(12,74,84,.75));color:#e7fcfd;font:inherit;font-size:.65rem;font-weight:850}
    #${CARD_ID} button.sat-stop{background:rgba(75,31,31,.55);border-color:rgba(238,116,116,.2)}
    #${CARD_ID} button:disabled{opacity:.45}
    #${CARD_ID} .sat-note{margin-top:8px;color:#64878b;font-size:.56rem;line-height:1.45}
    @media(max-width:520px){#${CARD_ID} .sat-cue{grid-template-columns:74px minmax(0,1fr);gap:8px}}
  `;

  function injectStyle(){
    if(document.getElementById('sportAudioTestStyleV652'))return;
    const style=document.createElement('style');
    style.id='sportAudioTestStyleV652';
    style.textContent=css;
    document.head.appendChild(style);
  }

  function capabilities(){
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    return {webAudio:!!AudioCtx,speech:false};
  }

  async function ensureAudio(){
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)throw new Error('Web Audio wird von diesem Browser nicht unterstützt.');
    if(!audioContext)audioContext=new AudioCtx();
    if(audioContext.state==='suspended')await audioContext.resume();
    return audioContext;
  }

  async function tone(name){
    const spec=cue[name];
    if(!spec)return;
    const ctx=await ensureAudio();
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    const now=ctx.currentTime;
    const end=now+(spec.duration/1000);

    osc.type=spec.type;
    osc.frequency.setValueAtTime(spec.freq,now);
    gain.gain.setValueAtTime(0.0001,now);
    gain.gain.exponentialRampToValueAtTime(spec.gain,now+0.008);
    gain.gain.setValueAtTime(spec.gain,Math.max(now+0.01,end-0.025));
    gain.gain.exponentialRampToValueAtTime(0.0001,end);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(end+0.03);
  }

  function doubleHalfway(){
    tone('halfway').catch(()=>{});
    timers.push(setTimeout(()=>tone('halfway').catch(()=>{}),180));
  }

  function setStatus(message){
    const card=document.getElementById(CARD_ID);
    if(!card)return;
    const status=card.querySelector('[data-sat-status]');
    if(status)status.textContent=message;
    const startButtons=card.querySelectorAll('[data-sat-run]');
    startButtons.forEach(btn=>btn.disabled=running);
    const stop=card.querySelector('[data-sat-stop]');
    if(stop)stop.disabled=!running;
  }

  function schedule(ms,fn){
    timers.push(setTimeout(fn,ms));
  }

  function stop(){
    timers.forEach(id=>clearTimeout(id));
    timers=[];
    running=false;
    runLabel='';
    setStatus('Bereit · nur Pieptöne · kein Hall · keine Sprache');
  }

  async function prime(){
    try{await ensureAudio();}catch(error){
      console.warn('[V657 beep lab] audio unavailable',error);
      setStatus('Web Audio nicht verfügbar');
      return false;
    }
    return true;
  }

  async function runQuickDemo(){
    if(running)return;
    if(!await prime())return;
    running=true;
    runLabel='Kurztest';
    setStatus('Kurztest läuft · Countdown → Halbzeit → Ende → Pause → Neustart');

    tone('countdownLow');
    schedule(1000,()=>tone('countdownLow'));
    schedule(2000,()=>tone('go'));
    schedule(5000,doubleHalfway);
    schedule(8000,()=>tone('end'));
    schedule(11000,()=>tone('warning'));
    schedule(13000,()=>tone('countdownLow'));
    schedule(14000,()=>tone('countdownLow'));
    schedule(15000,()=>tone('go'));
    schedule(15600,()=>{
      running=false;
      runLabel='';
      setStatus('Kurztest fertig · wenn das Muster passt, ist das unser Timer-Code');
    });
  }

  async function runRealCycle(){
    if(running)return;
    if(!await prime())return;
    running=true;
    runLabel='Realzyklus';
    setStatus('Realzyklus läuft · 40 s Belastung + 20 s Pause');

    // 2 s Vorlauf: tief, tief, dann hoher GO-Ton.
    tone('countdownLow');
    schedule(1000,()=>tone('countdownLow'));
    schedule(2000,()=>tone('go'));

    // Belastung startet bei t=2 s.
    schedule(22000,doubleHalfway);              // 20 s Belastung
    schedule(42000,()=>tone('end'));            // 40 s Belastung, Pause beginnt

    // 20-s-Pause: Warnung bei 5 s Rest, dann tief, tief, hoch.
    schedule(57000,()=>tone('warning'));        // noch 5 s Pause
    schedule(60000,()=>tone('countdownLow'));   // noch 2 s
    schedule(61000,()=>tone('countdownLow'));   // noch 1 s
    schedule(62000,()=>tone('go'));             // nächste Runde
    schedule(62600,()=>{
      running=false;
      runLabel='';
      setStatus('Realzyklus fertig · nächster Startton war bei 62 s');
    });
  }

  function cardHtml(){
    const caps=capabilities();
    return `
      <section id="${CARD_ID}" aria-label="Interval cue laboratory">
        <div class="sat-kicker">BEEP LAB · V657</div>
        <h3>Intervall-Signale ohne Stimme</h3>
        <p>Ein eindeutiger Toncode für 40 Sekunden Belastung und 20 Sekunden Pause.</p>
        <div class="sat-status" data-sat-status>Web Audio: ${caps.webAudio?'ja':'nein'} · bereit · kein Hall · keine Sprache</div>

        <div class="sat-cues">
          <div class="sat-cue"><strong>START</strong><span>tief · tief · <b>hoch</b> = GO</span></div>
          <div class="sat-cue"><strong>HALBZEIT</strong><span>zwei sehr kurze Töne direkt hintereinander</span></div>
          <div class="sat-cue"><strong>ENDE</strong><span>ein tiefer Ton für 2 Sekunden = Pause</span></div>
          <div class="sat-cue"><strong>NOCH 5 S</strong><span>ein einzelner Warn-Ton</span></div>
          <div class="sat-cue"><strong>NEUSTART</strong><span>tief · tief · <b>hoch</b> = nächste Runde</span></div>
        </div>

        <div class="sat-actions">
          <button type="button" data-sat-run="quick">▶ 16-Sekunden-Kurztest</button>
          <button type="button" data-sat-run="real">▶ 40/20-Realzyklus</button>
          <button type="button" class="sat-stop" data-sat-stop disabled>■ Stop</button>
        </div>

        <div class="sat-note">Der lange Endton ist absichtlich trocken. Kein Echo, kein künstlicher Nachhall. Die App muss für den späteren Timer weiterhin geöffnet bleiben.</div>
      </section>`;
  }

  function bind(card){
    card.querySelector('[data-sat-run="quick"]')?.addEventListener('click',runQuickDemo);
    card.querySelector('[data-sat-run="real"]')?.addEventListener('click',runRealCycle);
    card.querySelector('[data-sat-stop]')?.addEventListener('click',stop);
  }

  function mount(){
    injectStyle();
    const root=document.getElementById(ROOT_ID);
    if(!root)return false;
    const overview=root.querySelector('[data-sport-panel-v568="overview"] .sport-content-v510');
    if(!overview)return false;
    if(document.getElementById(CARD_ID))return true;
    overview.insertAdjacentHTML('afterbegin',cardHtml());
    const card=document.getElementById(CARD_ID);
    bind(card);
    setStatus('Bereit · nur Pieptöne · kein Hall · keine Sprache');
    return true;
  }

  const observer=new MutationObserver(()=>mount());
  function init(){
    mount();
    const root=document.getElementById(ROOT_ID);
    if(root)observer.observe(root,{childList:true,subtree:true});
    else observer.observe(document.body,{childList:true,subtree:true});
  }

  window.__modSportAudioTestV652={
    version:VERSION,
    run:runQuickDemo,
    runReal:runRealCycle,
    stop,
    capabilities,
    cueMap:()=>JSON.parse(JSON.stringify(cue))
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();