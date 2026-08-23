/* V483 · SPRACHERGEBNIS NACH STOP ERHALTEN
   - baut auf dem bewährten V482-Parser und dessen Ausführungslogik auf.
   - stop() beendet die Audioaufnahme, Ergebnis darf danach noch eintreffen.
   - kein 700-ms-abort(), das ein noch ausstehendes SpeechRecognitionResult vernichten kann.
   - kurze Grace-Phase nach onend für Safari-Eigenheiten; harter Cleanup erst sehr spät.
*/
(function(){
  'use strict';

  const BUILD_VERSION='V483';
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition||null;
  const base=window.__modVoiceCommandsV482||null;
  let recognition=null;
  let listening=false;
  let stopping=false;
  let audioEnded=false;
  let ended=false;
  let pending=null;
  let lastTranscript='';
  let watchdog=null;
  let endGrace=null;

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function clearTimers(){if(watchdog){clearTimeout(watchdog);watchdog=null;}if(endGrace){clearTimeout(endGrace);endGrace=null;}}
  function parse(text){if(!base) return {type:'unknown',reason:'V482-Sprachparser fehlt.',transcript:text};return base.resolve(base.parseTranscript(text));}
  function describe(command){return base?.describe?.(command)||command?.reason||'Befehl nicht erkannt.';}

  function previewHtml(command){
    const canExecute=command?.type==='create'||((command?.type==='start'||command?.type==='finish')&&!!command?.resolvedTask);
    return `<div class="voice-kicker-v483">ERKANNT</div><div class="voice-transcript-v483">„${esc(command?.transcript||lastTranscript)}“</div><div class="voice-kicker-v483" style="margin-top:8px">INTERPRETATION</div><div class="voice-action-v483">${esc(describe(command))}</div><div class="voice-actions-v483"><button type="button" class="execute" data-v483-execute ${canExecute?'':'disabled'}>AUSFÜHREN</button><button type="button" data-v483-cancel>VERWERFEN</button></div>`;
  }

  function injectStyle(){
    if(document.getElementById('voiceResultV483Style'))return;
    const s=document.createElement('style');s.id='voiceResultV483Style';s.textContent=`
      .voice-test-v483{margin-top:10px;padding:10px;border:1px solid var(--mod-border,#30363b);border-radius:10px;background:var(--mod-surface2,#111416)}
      .voice-head-v483{display:flex;gap:8px;align-items:center}.voice-main-v483{flex:1;min-height:38px;border:1px solid var(--mod-border,#30363b);border-radius:9px;background:var(--mod-control,#101315);color:var(--mod-text,#f3f3f3);font-size:10px;font-weight:900;letter-spacing:.35px}.voice-main-v483.listening{box-shadow:0 0 0 2px rgba(255,255,255,.18) inset}
      .voice-status-v483{margin-top:6px;font-size:9px;line-height:1.35;color:var(--mod-muted,#87949c)}.voice-preview-v483{margin-top:9px;padding:9px;border:1px solid rgba(255,255,255,.12);border-radius:8px}.voice-preview-v483[hidden]{display:none!important}.voice-kicker-v483{font-size:8px;font-weight:950;letter-spacing:.65px;color:var(--mod-muted,#87949c)}.voice-transcript-v483{margin-top:4px;font-size:11px;font-weight:850}.voice-action-v483{margin-top:7px;font-size:10px;line-height:1.4;color:var(--mod-text,#f3f3f3)}
      .voice-actions-v483{display:flex;gap:7px;margin-top:9px}.voice-actions-v483 button{flex:1;min-height:34px;border:1px solid var(--mod-border,#30363b);border-radius:8px;background:var(--mod-control,#101315);color:var(--mod-text,#f3f3f3);font-size:9px;font-weight:900}.voice-actions-v483 .execute{background:var(--mod-accent,#e8ecef);color:var(--mod-accent-text,#101214);border-color:var(--mod-accent,#e8ecef)}.voice-actions-v483 .execute:disabled{opacity:.35}.voice-help-v483{margin-top:7px;font-size:8px;line-height:1.45;color:var(--mod-muted,#87949c)}
    `;document.head.appendChild(s);
  }

  function setStatus(text){const el=document.getElementById('voiceStatusV483');if(el)el.textContent=text;}
  function bindPreview(root=document){
    root.querySelector('[data-v483-execute]')?.addEventListener('click',executePending);
    root.querySelector('[data-v483-cancel]')?.addEventListener('click',()=>{pending=null;ensureUi();setStatus('Befehl verworfen.');});
  }
  function ensureUi(){
    injectStyle();
    document.getElementById('voiceCommandTestV481')?.remove();
    document.getElementById('voiceCommandTestV482')?.remove();
    const panel=document.getElementById('inputPanel');if(!panel)return false;
    let box=document.getElementById('voiceCommandTestV483');
    if(!box){box=document.createElement('div');box.id='voiceCommandTestV483';box.className='voice-test-v483';const add=panel.querySelector('.add-button');if(add)add.after(box);else panel.appendChild(box);}
    const supported=!!Recognition&&!!base;
    const buttonText=stopping?'⏳ AUSWERTUNG …':listening?'⏹ AUFNAHME STOPPEN':'🎙 SPRACHBEFEHL TEST';
    box.innerHTML=`<div class="voice-head-v483"><button type="button" id="voiceStartV483" class="voice-main-v483 ${listening||stopping?'listening':''}" ${supported?'':'disabled'}>${buttonText}</button></div><div id="voiceStatusV483" class="voice-status-v483">${supported?'Kostenloser Browser-Test · keine OpenAI-API.':'Spracherkennung oder V482-Parser nicht verfügbar.'}</div><div id="voicePreviewV483" class="voice-preview-v483" ${pending?'':'hidden'}>${pending?previewHtml(pending):''}</div><div class="voice-help-v483">TEST: „Neue Aufgabe, Bart putzen, heute, Arbeitsblock 2“ · „Starte Bart putzen“ · „Bart putzen ist fertig“</div>`;
    box.querySelector('#voiceStartV483')?.addEventListener('click',toggleListening);bindPreview(box);return true;
  }

  function reset(instance){if(instance&&recognition!==instance)return;clearTimers();recognition=null;listening=false;stopping=false;audioEnded=false;ended=false;}
  function acceptTranscript(text){
    lastTranscript=String(text||'').trim();
    pending=parse(lastTranscript);
    ensureUi();
    setStatus('Befehl erkannt. Bitte Interpretation prüfen und erst dann AUSFÜHREN.');
    return pending;
  }
  function transcriptFromEvent(event){
    const results=event?.results;if(!results?.length)return '';
    let best='';
    const start=Number.isInteger(event.resultIndex)?event.resultIndex:0;
    for(let i=start;i<results.length;i++){
      const r=results[i];
      const t=String(r?.[0]?.transcript||'').trim();
      if(t)best=t;
      if(r?.isFinal&&t)return t;
    }
    return best||String(results[0]?.[0]?.transcript||'').trim();
  }
  function errorMessage(code){
    if(code==='not-allowed'||code==='service-not-allowed')return 'Mikrofon/Spracherkennung nicht erlaubt. Auf dem iPhone ggf. Mikrofonfreigabe und Siri prüfen.';
    if(code==='no-speech')return 'Keine Sprache erkannt. Bitte nochmal probieren.';
    if(code==='audio-capture')return 'Kein Mikrofon verfügbar.';
    if(code==='network')return 'Spracherkennungsdienst gerade nicht erreichbar.';
    return `Spracherkennung fehlgeschlagen: ${code||'unbekannter Fehler'}.`;
  }

  function scheduleWatchdog(r){
    clearTimers();
    watchdog=setTimeout(()=>{
      if(recognition!==r||pending)return;
      if(!audioEnded){try{r.abort?.();}catch(_){} }
      reset(r);ensureUi();setStatus('Keine Sprachauswertung zurückgekommen. Bitte nochmal versuchen.');
    },8000);
  }

  function createRecognition(){
    if(!Recognition||!base)return null;
    const r=new Recognition();recognition=r;
    r.lang='de-DE';r.continuous=false;r.interimResults=false;r.maxAlternatives=3;
    r.onstart=()=>{if(recognition!==r)return;listening=true;stopping=false;audioEnded=false;ended=false;ensureUi();setStatus('Ich höre zu … sprich den Befehl und tippe danach auf AUFNAHME STOPPEN.');};
    r.onaudioend=()=>{if(recognition!==r)return;audioEnded=true;listening=false;stopping=true;ensureUi();setStatus(pending?'Befehl erkannt. Bitte Interpretation prüfen.':'Audio beendet · Sprache wird ausgewertet …');};
    r.onresult=event=>{
      if(recognition!==r)return;
      const text=transcriptFromEvent(event);if(text)acceptTranscript(text);
      clearTimers();
      listening=false;
      if(!ended){stopping=true;try{r.stop?.();}catch(_){} }
      ensureUi();
      if(pending)setStatus('Befehl erkannt. Bitte Interpretation prüfen und erst dann AUSFÜHREN.');
    };
    r.onerror=event=>{
      if(recognition!==r)return;
      if(event?.error==='aborted'&&audioEnded){reset(r);ensureUi();if(!pending)setStatus('Aufnahme beendet.');return;}
      const msg=errorMessage(event?.error);reset(r);ensureUi();setStatus(msg);
    };
    r.onend=()=>{
      if(recognition!==r)return;
      ended=true;listening=false;
      if(pending){reset(r);ensureUi();setStatus('Befehl erkannt. Bitte Interpretation prüfen.');return;}
      stopping=true;ensureUi();setStatus('Aufnahme beendet · warte kurz auf das Sprachergebnis …');
      clearTimers();
      endGrace=setTimeout(()=>{
        if(recognition!==r||pending)return;
        reset(r);ensureUi();setStatus('Keine Sprache erkannt. Bitte nochmal versuchen.');
      },2000);
    };
    return r;
  }

  function startListening(){
    if(listening||stopping)return stopListening();
    pending=null;lastTranscript='';ensureUi();
    const r=createRecognition();if(!r){setStatus('Spracherkennung ist nicht verfügbar.');return false;}
    try{r.start();return true;}catch(_){reset(r);ensureUi();setStatus('Spracherkennung konnte nicht gestartet werden. Bitte erneut tippen.');return false;}
  }
  function stopListening(){
    const r=recognition;if(!r)return false;
    if(stopping)return true;
    stopping=true;ensureUi();setStatus('Aufnahme beendet · Sprache wird ausgewertet …');
    try{r.stop();scheduleWatchdog(r);return true;}
    catch(_){try{r.abort?.();}catch(__){}reset(r);ensureUi();setStatus('Aufnahme konnte nicht sauber beendet werden. Bitte nochmal versuchen.');return false;}
  }
  function toggleListening(){return listening||stopping?stopListening():startListening();}

  function executePending(){
    if(!pending||!base?.execute)return false;
    try{const msg=base.execute(pending);pending=null;ensureUi();setStatus(msg);return true;}
    catch(error){ensureUi();setStatus(String(error?.message||error));return false;}
  }

  function init(){ensureUi();}
  const previousRender=typeof window.render==='function'?window.render:null;
  if(previousRender)window.render=function(){const result=previousRender.apply(this,arguments);ensureUi();return result;};
  window.addEventListener('load',()=>setTimeout(init,0));setTimeout(init,0);

  window.__modVoiceResultV483={
    version:BUILD_VERSION,startListening,stopListening,toggleListening,ensureUi,acceptTranscript,transcriptFromEvent,
    parseTranscript:text=>base?.parseTranscript?.(text),resolve:cmd=>base?.resolve?.(cmd),describe,
    get supported(){return !!Recognition&&!!base;},get listening(){return listening;},get stopping(){return stopping;},get pending(){return pending;},get audioEnded(){return audioEnded;},
    preservesResultAfterStop:true,noEarlyAbort:true,confirmationRequired:true,noOpenAiApi:true
  };
})();
