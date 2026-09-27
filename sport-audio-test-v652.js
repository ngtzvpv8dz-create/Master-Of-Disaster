/* V654 · SPORT · iPhone/PWA voice lab with custom sliders */
(function(){
  'use strict';
  if(window.__modSportAudioTestV652)return;

  const VERSION='V654';
  const ROOT_ID='sportRootV510';
  const CARD_ID='sportAudioTestV652';
  const VOICE_KEY='masterOfDisasterSportVoiceV653';
  const PRESET_KEY='masterOfDisasterSportVoicePresetV653';
  const CUSTOM_KEY='masterOfDisasterSportVoiceCustomV654';
  let audioContext=null;
  let timers=[];
  let running=false;
  let voices=[];

  const presets={
    dark:{label:'Dark',pitch:0.55,rate:0.82,volume:1},
    brutal:{label:'Deep & Slow',pitch:0.38,rate:0.68,volume:1},
    clean:{label:'Clean',pitch:0.88,rate:0.95,volume:1}
  };

  const limits={
    pitch:{min:0.10,max:1.50,step:0.01},
    rate:{min:0.50,max:1.40,step:0.01},
    volume:{min:0.10,max:1.00,step:0.01}
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
    #${CARD_ID} .sat-sliders{display:grid;gap:10px;margin-top:12px;padding:11px;border:1px solid rgba(111,228,234,.12);border-radius:13px;background:rgba(0,0,0,.14)}
    #${CARD_ID} .sat-slider{display:grid;grid-template-columns:76px minmax(0,1fr) 50px;align-items:center;gap:10px}
    #${CARD_ID} .sat-slider span{color:#9ab7ba;font-size:.62rem;font-weight:850}
    #${CARD_ID} .sat-slider output{color:#dff7f9;font-size:.62rem;font-weight:900;text-align:right;font-variant-numeric:tabular-nums}
    #${CARD_ID} input[type="range"]{width:100%;min-width:0;margin:0;accent-color:#2aaeba}
    #${CARD_ID} .sat-custom-note{margin-top:7px;color:#64878b;font-size:.56rem;line-height:1.4}
    @media(max-width:520px){
      #${CARD_ID} .sat-grid{grid-template-columns:1fr}
      #${CARD_ID} .sat-slider{grid-template-columns:62px minmax(0,1fr) 46px;gap:8px}
    }
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

  function clamp(value,key){
    const rule=limits[key];
    const n=Number(value);
    if(!rule||!Number.isFinite(n))return null;
    return Math.max(rule.min,Math.min(rule.max,n));
  }

  function readCustom(){
    const fallback={...presets.dark};
    try{
      const raw=JSON.parse(localStorage.getItem(CUSTOM_KEY)||'null');
      if(!raw)return fallback;
      return {
        pitch:clamp(raw.pitch,'pitch')??fallback.pitch,
        rate:clamp(raw.rate,'rate')??fallback.rate,
        volume:clamp(raw.volume,'volume')??fallback.volume
      };
    }catch(_){
      return fallback;
    }
  }

  function writeCustom(settings){
    const clean={
      pitch:clamp(settings.pitch,'pitch')??presets.dark.pitch,
      rate:clamp(settings.rate,'rate')??presets.dark.rate,
      volume:clamp(settings.volume,'volume')??1
    };
    try{localStorage.setItem(CUSTOM_KEY,JSON.stringify(clean));}catch(_){}
    return clean;
  }

  function currentModeKey(){
    const key=localStorage.getItem(PRESET_KEY)||'dark';
    return key==='custom'||presets[key]?key:'dark';
  }

  function chosenSettings(){
    const key=currentModeKey();
    if(key==='custom')return {label:'Custom',...readCustom()};
    return {label:presets[key].label,...presets[key]};
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

  function englishVoices(){
    return voices.filter(v=>/^en(?:-|_)/i.test(v.lang||''));
  }

  function chosenVoice(){
    const select=document.querySelector('#'+CARD_ID+' [data-sat-voice]');
    const name=select?.value||localStorage.getItem(VOICE_KEY)||'';
    return voices.find(v=>v.name===name)||englishVoices()[0]||voices[0]||null;
  }

  function speak(text){
    if(!capabilities().speech)return false;
    try{
      const synth=window.speechSynthesis;
      const utterance=new SpeechSynthesisUtterance(text);
      const voice=chosenVoice();
      const settings=chosenSettings();
      utterance.lang=voice?.lang||'en-US';
      if(voice)utterance.voice=voice;
      utterance.rate=settings.rate;
      utterance.pitch=settings.pitch;
      utterance.volume=settings.volume;
      synth.cancel();
      synth.speak(utterance);
      return true;
    }catch(error){
      console.warn('[V654 voice lab] speech failed',error);
      return false;
    }
  }

  async function announce(text,freq){
    try{await beep(freq);}catch(error){console.warn('[V654 voice lab] beep failed',error);}
    setTimeout(()=>speak(text),90);
  }

  function escapeHtml(value){
    return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
      if(preferred){
        select.value=preferred.name;
        try{localStorage.setItem(VOICE_KEY,preferred.name);}catch(_){}
      }
    }
    syncControls();
  }

  function setRangeValue(key,value){
    const card=document.getElementById(CARD_ID);
    const input=card?.querySelector('[data-sat-slider="'+key+'"]');
    const output=card?.querySelector('[data-sat-output="'+key+'"]');
    if(input)input.value=String(value);
    if(output)output.textContent=Number(value).toFixed(2);
  }

  function syncControls(message){
    const card=document.getElementById(CARD_ID);
    if(!card)return;
    const settings=chosenSettings();
    const mode=currentModeKey();
    const voice=chosenVoice();

    setRangeValue('pitch',settings.pitch);
    setRangeValue('rate',settings.rate);
    setRangeValue('volume',settings.volume);

    const status=card.querySelector('[data-sat-status]');
    const base='Voice: '+(voice?voice.name+' · '+voice.lang:'none')+' · '+settings.label+
      ' · pitch '+settings.pitch.toFixed(2)+' · speed '+settings.rate.toFixed(2)+' · volume '+settings.volume.toFixed(2);
    if(status)status.textContent=message?message+' · '+base:base;

    card.querySelectorAll('[data-sat-preset]').forEach(btn=>{
      btn.classList.toggle('is-active',btn.dataset.satPreset===mode);
    });

    const start=card.querySelector('[data-sat-start]');
    const stop=card.querySelector('[data-sat-stop]');
    if(start)start.disabled=running;
    if(stop)stop.disabled=!running;
  }

  function applyPreset(key){
    const preset=presets[key];
    if(!preset)return;
    try{localStorage.setItem(PRESET_KEY,key);}catch(_){}
    writeCustom(preset);
    syncControls();
  }

  function applySliderChange(key,value,{preview=false}={}){
    const current=readCustom();
    current[key]=clamp(value,key)??current[key];
    writeCustom(current);
    try{localStorage.setItem(PRESET_KEY,'custom');}catch(_){}
    syncControls('Custom');
    if(preview)previewVoice();
  }

  function clearTimers(){
    timers.forEach(id=>clearTimeout(id));
    timers=[];
    try{window.speechSynthesis?.cancel?.();}catch(_){}
    running=false;
    syncControls('Stopped');
  }

  async function runTest(){
    if(running)return;
    try{if(capabilities().webAudio)await ensureAudio();}catch(error){console.warn(error);}
    running=true;
    syncControls('Running');
    announce('Go',880);
    timers.push(setTimeout(()=>announce('Halfway. Keep pushing.',760),3000));
    timers.push(setTimeout(()=>announce('Rest.',520),6000));
    timers.push(setTimeout(()=>{
      announce('Go.',980);
      running=false;
      syncControls('Finished');
    },9000));
  }

  function previewVoice(){
    try{window.speechSynthesis?.cancel?.();}catch(_){}
    speak('Get ready. Three, two, one. Go.');
    syncControls('Preview');
  }

  function sliderHtml(key,label){
    const rule=limits[key];
    return '<div class="sat-slider">'+
      '<span>'+label+'</span>'+
      '<input type="range" data-sat-slider="'+key+'" min="'+rule.min+'" max="'+rule.max+'" step="'+rule.step+'" value="1" aria-label="'+label+'">'+
      '<output data-sat-output="'+key+'">1.00</output>'+
    '</div>';
  }

  function cardHtml(){
    const caps=capabilities();
    return `
      <section id="${CARD_ID}" aria-label="Voice laboratory">
        <div class="sat-kicker">VOICE LAB · V654</div>
        <h3>English timer voice</h3>
        <p>Choose a voice, use a preset or tune pitch, speed and volume yourself.</p>
        <div class="sat-status" data-sat-status>Web Audio: ${caps.webAudio?'yes':'no'} · Speech: ${caps.speech?'yes':'no'}</div>

        <div class="sat-grid">
          <label>VOICE<select data-sat-voice><option>Loading voices…</option></select></label>
          <label>PRESET<div class="sat-presets">
            <button type="button" data-sat-preset="dark">Dark</button>
            <button type="button" data-sat-preset="brutal">Deep & Slow</button>
            <button type="button" data-sat-preset="clean">Clean</button>
            <button type="button" data-sat-preset="custom">Custom</button>
          </div></label>
        </div>

        <div class="sat-sliders" aria-label="Custom voice controls">
          ${sliderHtml('pitch','Pitch')}
          ${sliderHtml('rate','Speed')}
          ${sliderHtml('volume','Volume')}
        </div>
        <div class="sat-custom-note">Moving any slider switches to Custom automatically. Values are saved on this device.</div>

        <div class="sat-actions">
          <button type="button" data-sat-preview>🔊 Preview voice</button>
          <button type="button" data-sat-start>▶ 9-second sequence</button>
          <button type="button" class="sat-stop" data-sat-stop disabled>■ Stop</button>
        </div>
      </section>`;
  }

  function bind(card){
    card.querySelector('[data-sat-voice]')?.addEventListener('change',event=>{
      try{localStorage.setItem(VOICE_KEY,event.currentTarget.value||'');}catch(_){}
      syncControls();
    });

    card.querySelectorAll('[data-sat-preset]').forEach(button=>button.addEventListener('click',event=>{
      const key=event.currentTarget.dataset.satPreset||'dark';
      if(key==='custom'){
        try{localStorage.setItem(PRESET_KEY,'custom');}catch(_){}
        syncControls();
        previewVoice();
        return;
      }
      applyPreset(key);
      previewVoice();
    }));

    card.querySelectorAll('[data-sat-slider]').forEach(input=>{
      input.addEventListener('input',event=>{
        const key=event.currentTarget.dataset.satSlider;
        const value=event.currentTarget.value;
        applySliderChange(key,value,{preview:false});
      });
      input.addEventListener('change',event=>{
        const key=event.currentTarget.dataset.satSlider;
        const value=event.currentTarget.value;
        applySliderChange(key,value,{preview:true});
      });
    });

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
    syncControls();
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
    version:VERSION,
    run:runTest,
    stop:clearTimers,
    preview:previewVoice,
    capabilities,
    voices:()=>englishVoices().map(v=>({name:v.name,lang:v.lang,localService:v.localService})),
    settings:()=>chosenSettings()
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();