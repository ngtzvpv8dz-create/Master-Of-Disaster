/* V653 · SPORT · iPhone/PWA voice lab + audio smoke test */
(function(){
  'use strict';
  if(window.__modSportAudioTestV652)return;

  const VERSION='V653';
  const ROOT_ID='sportRootV510';
  const CARD_ID='sportAudioTestV652';
  const VOICE_KEY='masterOfDisasterSportVoiceV653';
  const PRESET_KEY='masterOfDisasterSportVoicePresetV653';
  let audioContext=null;
  let timers=[];
  let running=false;
  let voices=[];

  const presets={
    dark:{label:'Dark',pitch:0.55,rate:0.82},
    brutal:{label:'Deep & Slow',pitch:0.38,rate:0.68},
    clean:{label:'Clean',pitch:0.88,rate:0.95}
  };

  const css=`
    #${CARD_ID}{margin:0 0 14px;padding:14px;border:1px solid rgba(111,228,234,.18);border-radius:16px;background:linear-gradient(180deg,rgba(7,33,38,.82),rgba(3,18,22,.72));box-shadow:inset 0 1px 0 rgba(255,255,255,.03)}
    #${CARD_ID} .sat-kicker{color:#74d6dc;font-size:.55rem;font-weight:950;letter-spacing:.13em}
    #${CARD_ID} h3{margin:4px 0 4px;color:#eefcfd;font-size:.9rem}
    #${CARD_ID} p{margin:0;color:#83a4a8;font-size:.67rem;line-height:1.45}
    #${CARD_ID} .sat-status{margin-top:10px;padding:9px 10px;border-radius:11px;background:rgba(0,0,0,.18);color:#b9d4d7;font-size:.64rem;line-height:1.45}
    #${CARD_ID} .sat-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
    #${CARD_ID} label{display:grid;gap:4px;color:#76979b;font-size:.55rem;font-weight:800}
    #${CARD_ID} select{width:100%;min-width:0;padding:9px;border:1px solid rgba(111,228,234,.15);border-radius:10px;background:#07191c;color:#e4f7f8;font:inherit;font-size:.64rem}
    #${CARD_ID} .sat-presets,#${CARD_ID} .sat-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
    #${CARD_ID} button{padding:9px 11px;border:1px solid rgba(111,228,234,.25);border-radius:10px;background:linear-gradient(180deg,rgba(24,123,135,.72),rgba(12,74,84,.75));color:#e7fcfd;font:inherit;font-size:.65rem;font-weight:850}
    #${CARD_ID} button.is-active{box-shadow:0 0 0 2px rgba(111,228,234,.22) inset;border-color:rgba(111,228,234,.55)}
    #${CARD_ID} button.sat-stop{background:rgba(75,31,31,.55);border-color:rgba(238,116,116,.2)}
    #${CARD_ID} button:disabled{opacity:.45}
    @media(max-width:520px){#${CARD_ID} .sat-grid{grid-template-columns:1fr}}
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
    return {webAudio:!!AudioCtx,speech:'speechSynthesis' in window&&'SpeechSynthesisUtterance' in window};
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
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(now); osc.stop(now+durationMs/1000+0.03);
  }

  function englishVoices(){
    return voices.filter(v=>/^en(?:-|_)/i.test(v.lang||''));
  }

  function chosenVoice(){
    const select=document.querySelector('#'+CARD_ID+' [data-sat-voice]');
    const name=select?.value||localStorage.getItem(VOICE_KEY)||'';
    return voices.find(v=>v.name===name)||englishVoices()[0]||voices[0]||null;
  }

  function chosenPreset(){
    const key=localStorage.getItem(PRESET_KEY)||'dark';
    return presets[key]||presets.dark;
  }

  function speak(text){
    if(!capabilities().speech)return false;
    try{
      const synth=window.speechSynthesis;
      const utterance=new SpeechSynthesisUtterance(text);
      const voice=chosenVoice();
      const preset=chosenPreset();
      utterance.lang=voice?.lang||'en-US';
      if(voice)utterance.voice=voice;
      utterance.rate=preset.rate;
      utterance.pitch=preset.pitch;
      utterance.volume=1;
      synth.cancel();
      synth.speak(utterance);
      return true;
    }catch(error){
      console.warn('[V653 voice lab] speech failed',error);
      return false;
    }
  }

  async function announce(text,freq){
    try{await beep(freq);}catch(error){console.warn('[V653 voice lab] beep failed',error);}
    setTimeout(()=>speak(text),90);
  }

  function populateVoices(){
    try{voices=window.speechSynthesis?.getVoices?.()||[];}catch(_){voices=[];}
    const select=document.querySelector('#'+CARD_ID+' [data-sat-voice]');
    if(!select)return;
    const list=englishVoices();
    const current=localStorage.getItem(VOICE_KEY)||select.value;
    select.innerHTML=list.length
      ?list.map(v=>'<option value="'+escapeHtml(v.name)+'">'+escapeHtml(v.name)+' · '+escapeHtml(v.lang)+(v.localService?' · local':'')+'</option>').join('')
      :'<option value="">No English voices found yet</option>';
    if(current&&list.some(v=>v.name===current))select.value=current;
    else{
      const preferred=list.find(v=>/daniel|alex|aaron|evan|oliver|jamie|rishi/i.test(v.name))||list.find(v=>/^en-GB$/i.test(v.lang))||list[0];
      if(preferred){select.value=preferred.name;localStorage.setItem(VOICE_KEY,preferred.name);}
    }
    updateStatus();
  }

  function escapeHtml(value){
    return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function updateStatus(message){
    const card=document.getElementById(CARD_ID);
    if(!card)return;
    const status=card.querySelector('[data-sat-status]');
    const voice=chosenVoice();
    const preset=chosenPreset();
    const base='Voice: '+(voice?voice.name+' · '+voice.lang:'none')+' · '+preset.label+' · pitch '+preset.pitch+' · rate '+preset.rate;
    if(status)status.textContent=message?message+' · '+base:base;
    card.querySelectorAll('[data-sat-preset]').forEach(btn=>btn.classList.toggle('is-active',btn.dataset.satPreset===Object.keys(presets).find(k=>presets[k]===preset)));
    const start=card.querySelector('[data-sat-start]');
    const stop=card.querySelector('[data-sat-stop]');
    if(start)start.disabled=running;
    if(stop)stop.disabled=!running;
  }

  function clearTimers(){
    timers.forEach(id=>clearTimeout(id)); timers=[];
    try{window.speechSynthesis?.cancel?.();}catch(_){}
    running=false; updateStatus('Stopped');
  }

  async function runTest(){
    if(running)return;
    try{if(capabilities().webAudio)await ensureAudio();}catch(error){console.warn(error);}
    running=true; updateStatus('Running');
    announce('Go',880);
    timers.push(setTimeout(()=>announce('Halfway. Keep pushing.',760),3000));
    timers.push(setTimeout(()=>announce('Rest.',520),6000));
    timers.push(setTimeout(()=>{announce('Go.',980);running=false;updateStatus('Finished');},9000));
  }

  function previewVoice(){
    try{window.speechSynthesis?.cancel?.();}catch(_){}
    speak('Get ready. Three, two, one. Go.');
    updateStatus('Preview');
  }

  function cardHtml(){
    const caps=capabilities();
    return `
      <section id="${CARD_ID}" aria-label="Voice laboratory">
        <div class="sat-kicker">VOICE LAB · V653</div>
        <h3>English timer voice</h3>
        <p>Pick a voice from this iPhone and make it darker with pitch and speed presets.</p>
        <div class="sat-status" data-sat-status>Web Audio: ${caps.webAudio?'yes':'no'} · Speech: ${caps.speech?'yes':'no'}</div>
        <div class="sat-grid">
          <label>VOICE<select data-sat-voice><option>Loading voices…</option></select></label>
          <label>PRESET<div class="sat-presets">
            <button type="button" data-sat-preset="dark">Dark</button>
            <button type="button" data-sat-preset="brutal">Deep & Slow</button>
            <button type="button" data-sat-preset="clean">Clean</button>
          </div></label>
        </div>
        <div class="sat-actions">
          <button type="button" data-sat-preview>🔊 Preview voice</button>
          <button type="button" data-sat-start>▶ 9-second sequence</button>
          <button type="button" class="sat-stop" data-sat-stop disabled>■ Stop</button>
        </div>
      </section>`;
  }

  function bind(card){
    card.querySelector('[data-sat-voice]')?.addEventListener('change',event=>{
      localStorage.setItem(VOICE_KEY,event.currentTarget.value||''); updateStatus();
    });
    card.querySelectorAll('[data-sat-preset]').forEach(button=>button.addEventListener('click',event=>{
      localStorage.setItem(PRESET_KEY,event.currentTarget.dataset.satPreset||'dark'); updateStatus(); previewVoice();
    }));
    card.querySelector('[data-sat-preview]')?.addEventListener('click',previewVoice);
    card.querySelector('[data-sat-start]')?.addEventListener('click',runTest);
    card.querySelector('[data-sat-stop]')?.addEventListener('click',clearTimers);
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
    populateVoices();
    setTimeout(populateVoices,250);
    setTimeout(populateVoices,1000);
    return true;
  }

  const observer=new MutationObserver(()=>mount());
  function init(){
    mount();
    if(window.speechSynthesis){
      window.speechSynthesis.addEventListener?.('voiceschanged',populateVoices);
    }
    const root=document.getElementById(ROOT_ID);
    if(root)observer.observe(root,{childList:true,subtree:true});
    else observer.observe(document.body,{childList:true,subtree:true});
  }

  window.__modSportAudioTestV652={
    version:VERSION,run:runTest,stop:clearTimers,preview:previewVoice,capabilities,
    voices:()=>englishVoices().map(v=>({name:v.name,lang:v.lang,localService:v.localService}))
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();