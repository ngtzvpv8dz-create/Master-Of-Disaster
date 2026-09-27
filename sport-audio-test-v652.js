/* V656 · SPORT · Boing voice text laboratory */
(function(){
  'use strict';
  if(window.__modSportAudioTestV652)return;

  const VERSION='V656';
  const ROOT_ID='sportRootV510';
  const CARD_ID='sportAudioTestV652';
  const VOICE_KEY='masterOfDisasterSportVoiceV653';
  const PRESET_KEY='masterOfDisasterSportVoicePresetV653';
  const CUSTOM_KEY='masterOfDisasterSportVoiceCustomV654';
  const FX_KEY='masterOfDisasterSportVoiceFxV655';
  const DEFAULTS_KEY='masterOfDisasterSportVoiceDefaultsV656';
  const VOICE_DEFAULT_KEY='masterOfDisasterSportVoiceBoingV656';

  let audioContext=null;
  let timers=[];
  let running=false;
  let voices=[];

  const presets={
    dark:{label:'Dark',pitch:0.55,rate:0.82,volume:1},
    brutal:{label:'Deep & Slow',pitch:0.38,rate:0.68,volume:1},
    clean:{label:'Clean',pitch:0.88,rate:0.95,volume:1}
  };

  const fxPresets={
    raw:{
      label:'Raw',
      note:'Nur Stimme + trockener Signalton.',
      room:0,
      decay:0.25,
      delay:0,
      feedback:0,
      tailCount:0,
      tailPitch:-0.04,
      tailVolume:0.34
    },
    darkroom:{
      label:'Dark Room',
      note:'Kurzer dunkler Raum, wenig Nachhall.',
      room:0.22,
      decay:0.85,
      delay:0.09,
      feedback:0.12,
      tailCount:1,
      tailPitch:-0.06,
      tailVolume:0.28
    },
    arena:{
      label:'Arena',
      note:'Größerer Raum mit hörbarem Echo.',
      room:0.38,
      decay:1.65,
      delay:0.18,
      feedback:0.20,
      tailCount:2,
      tailPitch:-0.05,
      tailVolume:0.24
    },
    abyss:{
      label:'Abyss',
      note:'Sehr dunkel, lang und etwas übertrieben.',
      room:0.52,
      decay:2.45,
      delay:0.24,
      feedback:0.26,
      tailCount:2,
      tailPitch:-0.10,
      tailVolume:0.20
    },
    industrial:{
      label:'Industrial',
      note:'Kurzes hartes Echo für Commands.',
      room:0.28,
      decay:1.05,
      delay:0.11,
      feedback:0.30,
      tailCount:1,
      tailPitch:-0.02,
      tailVolume:0.30
    }
  };

  const limits={
    pitch:{min:0.10,max:1.50,step:0.01},
    rate:{min:0.10,max:1.40,step:0.01},
    volume:{min:0.10,max:1.00,step:0.01}
  };

  const textVariants=[
    {key:'countdown',label:'Countdown',text:'Three. Two. One. Go.'},
    {key:'command',label:'Command',text:'Get ready. Go.'},
    {key:'minimal',label:'Minimal',text:'Go.'},
    {key:'brutal',label:'Brutal',text:'Move. Now.'},
    {key:'drill',label:'Drill',text:'No excuses. Go.'}
  ];

  const css=`
    #${CARD_ID}{margin:0 0 14px;padding:14px;border:1px solid rgba(111,228,234,.18);border-radius:16px;background:linear-gradient(180deg,rgba(7,33,38,.82),rgba(3,18,22,.72));box-shadow:inset 0 1px 0 rgba(255,255,255,.03)}
    #${CARD_ID} .sat-kicker{color:#74d6dc;font-size:.55rem;font-weight:950;letter-spacing:.13em}
    #${CARD_ID} h3{margin:4px 0 4px;color:#eefcfd;font-size:.9rem}
    #${CARD_ID} p{margin:0;color:#83a4a8;font-size:.67rem;line-height:1.45}
    #${CARD_ID} .sat-status{margin-top:10px;padding:9px 10px;border-radius:11px;background:rgba(0,0,0,.18);color:#b9d4d7;font-size:.64rem;line-height:1.45}
    #${CARD_ID} .sat-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
    #${CARD_ID} label{display:grid;gap:4px;color:#76979b;font-size:.55rem;font-weight:800}
    #${CARD_ID} select{width:100%;min-width:0;padding:9px;border:1px solid rgba(111,228,234,.15);border-radius:10px;background:#07191c;color:#e4f7f8;font:inherit;font-size:.64rem}
    #${CARD_ID} .sat-presets,#${CARD_ID} .sat-actions,#${CARD_ID} .sat-fx-buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
    #${CARD_ID} button{padding:9px 11px;border:1px solid rgba(111,228,234,.25);border-radius:10px;background:linear-gradient(180deg,rgba(24,123,135,.72),rgba(12,74,84,.75));color:#e7fcfd;font:inherit;font-size:.65rem;font-weight:850}
    #${CARD_ID} button.is-active{box-shadow:0 0 0 2px rgba(111,228,234,.22) inset;border-color:rgba(111,228,234,.55)}
    #${CARD_ID} button.sat-stop{background:rgba(75,31,31,.55);border-color:rgba(238,116,116,.2)}
    #${CARD_ID} button:disabled{opacity:.45}
    #${CARD_ID} .sat-sliders,#${CARD_ID} .sat-fx-box{display:grid;gap:10px;margin-top:12px;padding:11px;border:1px solid rgba(111,228,234,.12);border-radius:13px;background:rgba(0,0,0,.14)}
    #${CARD_ID} .sat-slider{display:grid;grid-template-columns:76px minmax(0,1fr) 50px;align-items:center;gap:10px}
    #${CARD_ID} .sat-slider span{color:#9ab7ba;font-size:.62rem;font-weight:850}
    #${CARD_ID} .sat-slider output{color:#dff7f9;font-size:.62rem;font-weight:900;text-align:right;font-variant-numeric:tabular-nums}
    #${CARD_ID} input[type="range"]{width:100%;min-width:0;margin:0;accent-color:#2aaeba}
    #${CARD_ID} .sat-custom-note,#${CARD_ID} .sat-fx-note{color:#64878b;font-size:.56rem;line-height:1.4}\n    #${CARD_ID} .sat-text-box{display:grid;gap:9px;margin-top:12px;padding:11px;border:1px solid rgba(111,228,234,.12);border-radius:13px;background:rgba(0,0,0,.14)}\n    #${CARD_ID} .sat-text-variants{display:flex;flex-wrap:wrap;gap:7px}\n    #${CARD_ID} textarea{box-sizing:border-box;width:100%;min-height:72px;resize:vertical;padding:10px;border:1px solid rgba(111,228,234,.15);border-radius:10px;background:#07191c;color:#e4f7f8;font:inherit;font-size:.72rem;line-height:1.4}
    #${CARD_ID} .sat-fx-title{color:#91cbd0;font-size:.58rem;font-weight:900;letter-spacing:.08em}
    #${CARD_ID} .sat-fx-explain{margin-top:3px;color:#698b8f;font-size:.56rem;line-height:1.45}
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
    const fallback={pitch:0.10,rate:0.10,volume:1};
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
    const key=localStorage.getItem(PRESET_KEY)||'custom';
    return key==='custom'||presets[key]?key:'dark';
  }

  function chosenSettings(){
    const key=currentModeKey();
    if(key==='custom')return {label:'Custom',...readCustom()};
    return {label:presets[key].label,...presets[key]};
  }

  function currentFxKey(){
    const key=localStorage.getItem(FX_KEY)||'raw';
    return fxPresets[key]?key:'raw';
  }

  function chosenFx(){
    const key=currentFxKey();
    return {key,...fxPresets[key]};
  }

  function ensureV656Defaults(){
    try{
      if(localStorage.getItem(DEFAULTS_KEY)==='1')return;
      writeCustom({pitch:0.10,rate:0.10,volume:1});
      localStorage.setItem(PRESET_KEY,'custom');
      localStorage.setItem(FX_KEY,'raw');
      localStorage.setItem(DEFAULTS_KEY,'1');
    }catch(_){}
  }

  async function ensureAudio(){
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)throw new Error('Web Audio wird von diesem Browser nicht unterstützt.');
    if(!audioContext)audioContext=new AudioCtx();
    if(audioContext.state==='suspended')await audioContext.resume();
    return audioContext;
  }

  function impulseBuffer(ctx,duration,decay){
    const seconds=Math.max(0.15,Math.min(3.5,Number(duration)||0.8));
    const length=Math.max(1,Math.floor(ctx.sampleRate*seconds));
    const buffer=ctx.createBuffer(2,length,ctx.sampleRate);
    for(let channel=0;channel<2;channel++){
      const data=buffer.getChannelData(channel);
      for(let i=0;i<length;i++){
        const t=i/length;
        data[i]=(Math.random()*2-1)*Math.pow(1-t,Math.max(1,Number(decay)||1.4));
      }
    }
    return buffer;
  }

  async function beep(freq=880,durationMs=120){
    const ctx=await ensureAudio();
    const fx=chosenFx();
    const osc=ctx.createOscillator();
    const dry=ctx.createGain();
    const wet=ctx.createGain();
    const convolver=ctx.createConvolver();
    const now=ctx.currentTime;
    const stopAt=now+durationMs/1000+Math.max(0.1,fx.decay);

    osc.type='sine';
    osc.frequency.setValueAtTime(freq,now);

    dry.gain.setValueAtTime(0.0001,now);
    dry.gain.exponentialRampToValueAtTime(0.12,now+0.01);
    dry.gain.exponentialRampToValueAtTime(0.0001,now+durationMs/1000);

    osc.connect(dry);
    dry.connect(ctx.destination);

    if(fx.room>0){
      convolver.buffer=impulseBuffer(ctx,fx.decay,2.2);
      wet.gain.setValueAtTime(Math.max(0.01,Math.min(0.7,fx.room)),now);
      osc.connect(convolver);
      convolver.connect(wet);
      wet.connect(ctx.destination);
    }

    if(fx.delay>0){
      const delay=ctx.createDelay(1);
      const feedback=ctx.createGain();
      const echoOut=ctx.createGain();
      delay.delayTime.setValueAtTime(fx.delay,now);
      feedback.gain.setValueAtTime(Math.max(0,Math.min(0.55,fx.feedback)),now);
      echoOut.gain.setValueAtTime(0.34,now);
      osc.connect(delay);
      delay.connect(echoOut);
      echoOut.connect(ctx.destination);
      delay.connect(feedback);
      feedback.connect(delay);
    }

    osc.start(now);
    osc.stop(stopAt);
  }

  function englishVoices(){
    return voices.filter(v=>/^en(?:-|_)/i.test(v.lang||''));
  }

  function chosenVoice(){
    const select=document.querySelector('#'+CARD_ID+' [data-sat-voice]');
    const name=select?.value||localStorage.getItem(VOICE_KEY)||'';
    return voices.find(v=>v.name===name)||englishVoices()[0]||voices[0]||null;
  }

  function tailWord(text){
    const clean=String(text||'').trim();
    if(/^go\b/i.test(clean))return 'Go.';
    if(/^rest\b/i.test(clean))return 'Rest.';
    if(/^halfway\b/i.test(clean))return 'Push.';
    if(/^get ready\b/i.test(clean))return 'Go.';
    const words=clean.replace(/[^a-zA-Z' ]+/g,' ').trim().split(/\s+/).filter(Boolean);
    return words.length?words[words.length-1]+'.':'';
  }

  function makeUtterance(text,{pitch,rate,volume}){
    const utterance=new SpeechSynthesisUtterance(text);
    const voice=chosenVoice();
    utterance.lang=voice?.lang||'en-US';
    if(voice)utterance.voice=voice;
    utterance.rate=rate;
    utterance.pitch=pitch;
    utterance.volume=volume;
    return utterance;
  }

  function speak(text){
    if(!capabilities().speech)return false;
    try{
      const synth=window.speechSynthesis;
      const settings=chosenSettings();
      const fx=chosenFx();
      const primary=makeUtterance(text,settings);
      synth.cancel();

      if(fx.tailCount>0){
        primary.addEventListener('end',()=>{
          const token=tailWord(text);
          if(!token)return;
          for(let i=0;i<fx.tailCount;i++){
            const tail=makeUtterance(token,{
              pitch:Math.max(0,settings.pitch+fx.tailPitch-(i*0.03)),
              rate:Math.max(0.5,settings.rate*0.90),
              volume:Math.max(0.05,settings.volume*fx.tailVolume*Math.pow(0.72,i))
            });
            synth.speak(tail);
          }
        },{once:true});
      }

      synth.speak(primary);
      return true;
    }catch(error){
      console.warn('[V656 voice text lab] speech failed',error);
      return false;
    }
  }

  async function announce(text,freq){
    try{await beep(freq);}catch(error){console.warn('[V655 voice FX lab] beep failed',error);}
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
    let forceBoing=false;
    try{forceBoing=localStorage.getItem(VOICE_DEFAULT_KEY)!=='1';}catch(_){}
    const boing=list.find(v=>/boing/i.test(v.name));
    if(forceBoing&&boing){
      select.value=boing.name;
      try{
        localStorage.setItem(VOICE_KEY,boing.name);
        localStorage.setItem(VOICE_DEFAULT_KEY,'1');
      }catch(_){}
    }else if(current&&list.some(v=>v.name===current)){
      select.value=current;
      if(forceBoing&&!boing)try{localStorage.setItem(VOICE_DEFAULT_KEY,'1');}catch(_){}
    }else{
      const preferred=boing||list.find(v=>/daniel|alex|aaron|evan|oliver|jamie|rishi/i.test(v.name))||list.find(v=>/^en-GB$/i.test(v.lang))||list[0];
      if(preferred){
        select.value=preferred.name;
        try{
          localStorage.setItem(VOICE_KEY,preferred.name);
          if(forceBoing)localStorage.setItem(VOICE_DEFAULT_KEY,'1');
        }catch(_){}
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
    const fx=chosenFx();
    const voice=chosenVoice();

    setRangeValue('pitch',settings.pitch);
    setRangeValue('rate',settings.rate);
    setRangeValue('volume',settings.volume);

    const status=card.querySelector('[data-sat-status]');
    const base='Voice: '+(voice?voice.name+' · '+voice.lang:'none')+' · '+settings.label+
      ' · FX '+fx.label+
      ' · pitch '+settings.pitch.toFixed(2)+' · speed '+settings.rate.toFixed(2)+' · volume '+settings.volume.toFixed(2);
    if(status)status.textContent=message?message+' · '+base:base;

    card.querySelectorAll('[data-sat-preset]').forEach(btn=>{
      btn.classList.toggle('is-active',btn.dataset.satPreset===mode);
    });
    card.querySelectorAll('[data-sat-fx]').forEach(btn=>{
      btn.classList.toggle('is-active',btn.dataset.satFx===fx.key);
    });

    const fxNote=card.querySelector('[data-sat-fx-note]');
    if(fxNote)fxNote.textContent=fx.note;

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

  function applyFx(key,{preview=true}={}){
    if(!fxPresets[key])return;
    try{localStorage.setItem(FX_KEY,key);}catch(_){}
    syncControls();
    if(preview)previewVoice();
  }

  function clearTimers(){
    timers.forEach(id=>clearTimeout(id));
    timers=[];
    try{window.speechSynthesis?.cancel?.();}catch(_){}
    running=false;
    syncControls('Stopped');
  }

  function previewText(){
    const field=document.querySelector('#'+CARD_ID+' [data-sat-preview-text]');
    const value=String(field?.value||'').trim();
    return value||'Three. Two. One. Go.';
  }

  async function runTest(){
    if(running)return;
    running=true;
    syncControls('Running');
    speak('Go.');
    timers.push(setTimeout(()=>speak('Halfway. Keep pushing.'),3000));
    timers.push(setTimeout(()=>speak('Rest.'),6000));
    timers.push(setTimeout(()=>{
      speak('Go.');
      running=false;
      syncControls('Finished');
    },9000));
  }

  function previewVoice(){
    try{window.speechSynthesis?.cancel?.();}catch(_){}
    speak(previewText());
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

  function textButtonsHtml(){
    return textVariants.map(item=>
      '<button type="button" data-sat-text-variant="'+item.key+'" data-sat-text="'+escapeHtml(item.text)+'">'+escapeHtml(item.label)+'</button>'
    ).join('');
  }

  function fxButtonsHtml(){
    return Object.entries(fxPresets).map(([key,fx])=>
      '<button type="button" data-sat-fx="'+key+'">'+escapeHtml(fx.label)+'</button>'
    ).join('');
  }

  function cardHtml(){
    const caps=capabilities();
    return `
      <section id="${CARD_ID}" aria-label="Voice laboratory">
        <div class="sat-kicker">VOICE TEXT LAB · V656</div>
        <h3>English timer voice</h3>
        <p>Boing baseline: Raw · pitch 0.10 · speed 0.10 · volume 1.00. Then test the wording.</p>
        <div class="sat-status" data-sat-status>Web Audio: ${caps.webAudio?'yes':'no'} · Speech: ${caps.speech?'yes':'no'}</div>

        <div class="sat-grid">
          <label>VOICE<select data-sat-voice><option>Loading voices…</option></select></label>
          <label>VOICE PRESET<div class="sat-presets">
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
        <div class="sat-custom-note">Moving any slider switches to Custom automatically. Values stay saved on this device.</div>

        <div class="sat-text-box">
          <div>
            <div class="sat-fx-title">TEXT LAB</div>
            <div class="sat-fx-explain">Voice-only previews. No signal beep, so you can judge the wording and voice cleanly.</div>
          </div>
          <div class="sat-text-variants">${textButtonsHtml()}</div>
          <textarea data-sat-preview-text aria-label="Preview text">Three. Two. One. Go.</textarea>
        </div>

        <div class="sat-fx-box">
          <div>
            <div class="sat-fx-title">ROOM / ECHO EXPERIMENTS</div>
            <div class="sat-fx-explain">FX remain available for comparison, but the text previews themselves have no signal beep. Raw is the new baseline.</div>
          </div>
          <div class="sat-fx-buttons">${fxButtonsHtml()}</div>
          <div class="sat-fx-note" data-sat-fx-note></div>
        </div>

        <div class="sat-actions">
          <button type="button" data-sat-preview>🔊 Preview text</button>
          <button type="button" data-sat-start>▶ 9-second sequence</button>
          <button type="button" class="sat-stop" data-sat-stop disabled>■ Stop</button>
        </div>
      </section>`;
  }

  function bind(card){
    card.querySelector('[data-sat-voice]')?.addEventListener('change',event=>{
      try{localStorage.setItem(VOICE_KEY,event.currentTarget.value||'');}catch(_){}
      syncControls();
      previewVoice();
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

    card.querySelectorAll('[data-sat-fx]').forEach(button=>button.addEventListener('click',event=>{
      applyFx(event.currentTarget.dataset.satFx||'raw',{preview:true});
    }));

    card.querySelectorAll('[data-sat-text-variant]').forEach(button=>button.addEventListener('click',event=>{
      const field=card.querySelector('[data-sat-preview-text]');
      if(field)field.value=event.currentTarget.dataset.satText||'';
      previewVoice();
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
    syncControls();
    setTimeout(populateVoices,250);
    setTimeout(populateVoices,1000);
    return true;
  }

  const observer=new MutationObserver(()=>mount());
  function init(){
    ensureV656Defaults();
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
    settings:()=>chosenSettings(),
    fx:()=>chosenFx()
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();