/* V652 · SPORT · iPhone/PWA audio + speech smoke test */
(function(){
  'use strict';
  if(window.__modSportAudioTestV652)return;

  const VERSION='V652';
  const ROOT_ID='sportRootV510';
  const CARD_ID='sportAudioTestV652';
  let audioContext=null;
  let timers=[];
  let running=false;

  const css=`
    #${CARD_ID}{margin:0 0 14px;padding:14px;border:1px solid rgba(111,228,234,.18);border-radius:16px;background:linear-gradient(180deg,rgba(7,33,38,.82),rgba(3,18,22,.72));box-shadow:inset 0 1px 0 rgba(255,255,255,.03)}
    #${CARD_ID} .sat-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
    #${CARD_ID} .sat-kicker{color:#74d6dc;font-size:.55rem;font-weight:950;letter-spacing:.13em}
    #${CARD_ID} h3{margin:4px 0 4px;color:#eefcfd;font-size:.9rem}
    #${CARD_ID} p{margin:0;color:#83a4a8;font-size:.67rem;line-height:1.45}
    #${CARD_ID} .sat-status{margin-top:10px;padding:9px 10px;border-radius:11px;background:rgba(0,0,0,.18);color:#b9d4d7;font-size:.64rem;line-height:1.45}
    #${CARD_ID} .sat-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
    #${CARD_ID} button{padding:9px 11px;border:1px solid rgba(111,228,234,.25);border-radius:10px;background:linear-gradient(180deg,rgba(24,123,135,.72),rgba(12,74,84,.75));color:#e7fcfd;font:inherit;font-size:.65rem;font-weight:850}
    #${CARD_ID} button.sat-stop{background:rgba(75,31,31,.55);border-color:rgba(238,116,116,.2)}
    #${CARD_ID} button:disabled{opacity:.45}
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
    return {
      webAudio:!!AudioCtx,
      speech:'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
    };
  }

  async function ensureAudio(){
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)throw new Error('Web Audio wird von diesem Browser nicht unterstützt.');
    if(!audioContext)audioContext=new AudioCtx();
    if(audioContext.state==='suspended')await audioContext.resume();
    return audioContext;
  }

  async function beep(freq=880,durationMs=120){
    const ctx=await ensureAudio();
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    const now=ctx.currentTime;
    osc.type='sine';
    osc.frequency.setValueAtTime(freq,now);
    gain.gain.setValueAtTime(0.0001,now);
    gain.gain.exponentialRampToValueAtTime(0.12,now+0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+durationMs/1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now+durationMs/1000+0.03);
  }

  function speak(text){
    if(!capabilities().speech)return false;
    try{
      const synth=window.speechSynthesis;
      const utterance=new SpeechSynthesisUtterance(text);
      utterance.lang='de-DE';
      utterance.rate=0.95;
      utterance.pitch=1;
      const voices=synth.getVoices?.()||[];
      const german=voices.find(v=>/^de(?:-|_)/i.test(v.lang||''));
      if(german)utterance.voice=german;
      synth.cancel();
      synth.speak(utterance);
      return true;
    }catch(error){
      console.warn('[V652 audio test] speech failed',error);
      return false;
    }
  }

  async function announce(text,freq){
    try{await beep(freq);}catch(error){console.warn('[V652 audio test] beep failed',error);}
    setTimeout(()=>speak(text),90);
  }

  function clearTimers(){
    timers.forEach(id=>clearTimeout(id));
    timers=[];
    try{window.speechSynthesis?.cancel?.();}catch(_){}
    running=false;
    updateUi('Test gestoppt.');
  }

  function updateUi(message){
    const card=document.getElementById(CARD_ID);
    if(!card)return;
    const status=card.querySelector('[data-sat-status]');
    if(status)status.textContent=message;
    const start=card.querySelector('[data-sat-start]');
    const stop=card.querySelector('[data-sat-stop]');
    if(start)start.disabled=running;
    if(stop)stop.disabled=!running;
  }

  async function runTest(){
    if(running)return;
    const caps=capabilities();
    if(!caps.webAudio && !caps.speech){
      updateUi('Weder Web-Audio noch Sprachausgabe verfügbar.');
      return;
    }

    try{
      if(caps.webAudio)await ensureAudio();
    }catch(error){
      console.warn('[V652 audio test] AudioContext failed',error);
    }

    running=true;
    updateUi('Läuft: START → 3 s → HALBZEIT → 3 s → PAUSE → 3 s → WEITER');
    announce('Start',880);

    timers.push(setTimeout(()=>announce('Halbzeit. Noch drei Sekunden.',760),3000));
    timers.push(setTimeout(()=>announce('Pause',520),6000));
    timers.push(setTimeout(()=>{
      announce('Weiter',980);
      running=false;
      updateUi('Fertig. Wenn du vier Signale gehört hast, funktioniert der Timer-Grundbaustein auf diesem Gerät.');
    },9000));
  }

  function cardHtml(){
    const caps=capabilities();
    const capabilityText='Web-Audio: '+(caps.webAudio?'ja':'nein')+' · Sprache: '+(caps.speech?'ja':'nein');
    return `
      <section id="${CARD_ID}" aria-label="Audiotest">
        <div class="sat-head">
          <div>
            <div class="sat-kicker">TIMER-LABOR · V652</div>
            <h3>iPhone Audio-Test</h3>
            <p>Mini-Test vor dem echten Zirkel-Timer. App geöffnet lassen und Lautstärke einschalten.</p>
          </div>
        </div>
        <div class="sat-status" data-sat-status>${capabilityText}</div>
        <div class="sat-actions">
          <button type="button" data-sat-start>▶ 9-Sekunden-Test</button>
          <button type="button" class="sat-stop" data-sat-stop disabled>■ Stop</button>
        </div>
      </section>`;
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
    card?.querySelector('[data-sat-start]')?.addEventListener('click',runTest);
    card?.querySelector('[data-sat-stop]')?.addEventListener('click',clearTimers);
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
    run:runTest,
    stop:clearTimers,
    capabilities
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();