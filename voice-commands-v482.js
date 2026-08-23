/* V482 · SPRACHBEFEHLE: ARBEITSBLOCK + STOPP-FIX
   - erkennt Arbeitsblock/Arbeits Block/Block robust und entfernt die Angabe aus dem Titel.
   - zweiter Tipp stoppt wirklich die laufende Browser-Spracherkennung.
   - finale Ergebnisse werden sofort verarbeitet und die Recognition-Instanz anschließend beendet.
   - keine OpenAI-API; Bestätigung vor jeder Änderung bleibt Pflicht.
*/
(function(){
  'use strict';

  const BUILD_VERSION='V482';
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition||null;
  let recognition=null;
  let listening=false;
  let stopping=false;
  let stopFallback=null;
  let pending=null;
  let lastTranscript='';

  const numberWords={
    eins:1,ein:1,einen:1,erste:1,erster:1,erstes:1,
    zwei:2,zweite:2,zweiter:2,zweites:2,
    drei:3,dritte:3,dritter:3,drittes:3,
    vier:4,vierte:4,vierter:4,viertes:4,
    funf:5,fuenf:5,fünf:5,fünfte:5,fünfter:5,fünftes:5,
    sechs:6,sechste:6,siebte:7,sieben:7,acht:8,achte:8,neun:9,neunte:9,zehn:10,zehnte:10
  };
  const blockWordPattern='(?:\\d{1,2}|eins|ein|einen|erste(?:r|s)?|zwei|zweite(?:r|s)?|drei|dritte(?:r|s)?|vier|vierte(?:r|s)?|fünf|fuenf|funf|fünfte(?:r|s)?|sechs|sechste|sieben|siebte|acht|achte|neun|neunte|zehn|zehnte)';

  function tasksSafe(){try{return Array.isArray(tasks)?tasks:[];}catch(_){return [];}}
  function today(){return typeof getBerlinDateKey==='function'?getBerlinDateKey():new Date().toISOString().slice(0,10);}
  function normalize(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss').replace(/[^a-z0-9\s-]/g,' ').replace(/\s+/g,' ').trim();}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function titleCaseSentence(v){const s=String(v||'').trim().replace(/\s+/g,' ');return s?s[0].toUpperCase()+s.slice(1):s;}

  function blockNumberFrom(raw){
    const n=normalize(raw);
    const match=n.match(/\b(?:arbeits[\s-]*)?block(?:\s+nummer)?\s*(\d{1,2}|eins|ein|einen|erste|erster|erstes|zwei|zweite|zweiter|zweites|drei|dritte|dritter|drittes|vier|vierte|vierter|viertes|funf|fuenf|sechs|sechste|sieben|siebte|acht|achte|neun|neunte|zehn|zehnte)\b/);
    if(!match)return null;
    if(/^\d+$/.test(match[1]))return Number(match[1]);
    return numberWords[match[1]]||null;
  }

  function priorityFrom(raw){
    const n=normalize(raw);
    if(/\boptional\b/.test(n))return 'optional';
    if(/\b(?:prioritat\s*)?hoch\b|\bhohe\s+prioritat\b/.test(n))return 'high';
    if(/\b(?:prioritat\s*)?mittel\b|\bmittlere\s+prioritat\b/.test(n))return 'medium';
    if(/\b(?:prioritat\s*)?normal\b|\bnormale\s+prioritat\b/.test(n))return 'normal';
    return null;
  }

  function stripNewTaskModifiers(raw){
    let s=String(raw||'').trim();
    s=s.replace(/\b(?:fuer|für)\s+heute\b/gi,' ');
    s=s.replace(/\bheute\b/gi,' ');
    const blockRe=new RegExp(`\\b(?:in\\s+)?(?:arbeits[\\s-]*)?block(?:\\s+nummer)?[\\s,:;-]*${blockWordPattern}\\b`,'gi');
    s=s.replace(blockRe,' ');
    s=s.replace(/\b(?:mit\s+)?(?:hoher|hohe|hohen|mittlerer|mittlere|mittleren|normaler|normale|normalen)\s+priorit[aä]t\b/gi,' ');
    s=s.replace(/\bpriorit[aä]t\s+(?:hoch|mittel|normal)\b/gi,' ');
    s=s.replace(/\boptional\b/gi,' ');
    return titleCaseSentence(s.replace(/[,:;]+/g,' ').replace(/\s+/g,' ').trim());
  }

  function parseTranscript(transcript){
    const raw=String(transcript||'').trim();
    const n=normalize(raw);
    if(!n)return {type:'unknown',label:'NICHT ERKANNT',reason:'Kein Text erkannt.',transcript:raw};

    const create=n.match(/^(?:neue\s+aufgabe|erstelle(?:\s+eine)?\s+aufgabe|fuge\s+(?:eine\s+)?aufgabe\s+hinzu)\s+(.+)$/);
    if(create){
      const rawTail=raw.replace(/^(?:neue\s+aufgabe|erstelle(?:\s+eine)?\s+aufgabe|f[uü]ge\s+(?:eine\s+)?aufgabe\s+hinzu)\s*[,;:\-]?\s*/i,'');
      const text=stripNewTaskModifiers(rawTail);
      if(!text)return {type:'unknown',label:'NICHT ERKANNT',reason:'Aufgabentext fehlt.',transcript:raw};
      const block=blockNumberFrom(n);
      const isToday=/\bheute\b/.test(n);
      return {type:'create',label:'NEUE AUFGABE',text,today:isToday||!!block,block,priority:priorityFrom(n)||'normal',transcript:raw};
    }

    let m=n.match(/^(?:starte|start|beginne)\s+(.+)$/);
    if(m){const q=raw.replace(/^(?:starte|start|beginne)\s+/i,'').trim();return {type:'start',label:'AUFGABE STARTEN',query:q,transcript:raw};}
    m=n.match(/^(.+?)\s+(?:ist|is)\s+(?:fertig|erledigt|beendet|abgeschlossen)$/);
    if(m){const q=raw.replace(/\s+(?:ist|is)\s+(?:fertig|erledigt|beendet|abgeschlossen)$/i,'').trim();return {type:'finish',label:'AUFGABE BEENDEN',query:q,transcript:raw};}
    m=n.match(/^(?:beende|erledige|beenden)\s+(.+)$/);
    if(m){const q=raw.replace(/^(?:beende|erledige|beenden)\s+/i,'').trim();return {type:'finish',label:'AUFGABE BEENDEN',query:q,transcript:raw};}
    return {type:'unknown',label:'NICHT ERKANNT',reason:'Noch kein unterstützter Testbefehl.',transcript:raw};
  }

  function matchTask(query,allowedStatuses){
    const q=normalize(query);if(!q)return {task:null,reason:'Aufgabenname fehlt.'};
    const pool=tasksSafe().filter(t=>!allowedStatuses||allowedStatuses.includes(t?.status));
    const exact=pool.filter(t=>normalize(t?.text)===q);
    if(exact.length===1)return {task:exact[0],match:'exact'};
    if(exact.length>1)return {task:null,ambiguous:exact,reason:`${exact.length} gleichnamige Aufgaben gefunden.`};
    const contains=pool.filter(t=>{const name=normalize(t?.text);return name.includes(q)||q.includes(name);});
    if(contains.length===1)return {task:contains[0],match:'contains'};
    if(contains.length>1)return {task:null,ambiguous:contains,reason:`Mehrere passende Aufgaben: ${contains.slice(0,3).map(t=>t.text).join(', ')}`};
    return {task:null,reason:`Keine passende Aufgabe für „${query}“ gefunden.`};
  }

  function resolve(command){
    if(command.type==='start'){
      const hit=matchTask(command.query,['open','paused','running']);
      return {...command,resolvedTask:hit.task||null,reason:hit.reason||null,ambiguous:hit.ambiguous||null};
    }
    if(command.type==='finish'){
      let hit=matchTask(command.query,['running','paused']);
      if(!hit.task&&!hit.ambiguous)hit=matchTask(command.query,['open','running','paused']);
      return {...command,resolvedTask:hit.task||null,reason:hit.reason||null,ambiguous:hit.ambiguous||null};
    }
    return command;
  }

  function describe(command){
    if(!command)return '';
    if(command.type==='create'){
      const p={normal:'NORMAL',medium:'MITTEL',high:'HOCH',optional:'OPTIONAL'}[command.priority]||'NORMAL';
      return `Neue Aufgabe „${command.text}“ · Priorität ${p}${command.today?' · HEUTE':''}${command.block?` · Arbeitsblock ${command.block}`:''}`;
    }
    if(command.type==='start')return command.resolvedTask?`„${command.resolvedTask.text}“ starten${command.resolvedTask.status==='paused'?' (fortsetzen)':''}`:(command.reason||'Aufgabe nicht eindeutig gefunden.');
    if(command.type==='finish')return command.resolvedTask?`„${command.resolvedTask.text}“ beenden`:(command.reason||'Aufgabe nicht eindeutig gefunden.');
    return command.reason||'Befehl nicht erkannt.';
  }

  function injectStyle(){
    if(document.getElementById('voiceCommandsV482Style'))return;
    const s=document.createElement('style');s.id='voiceCommandsV482Style';s.textContent=`
      .voice-test-v482{margin-top:10px;padding:10px;border:1px solid var(--mod-border,#30363b);border-radius:10px;background:var(--mod-surface2,#111416)}
      .voice-head-v482{display:flex;gap:8px;align-items:center}.voice-main-v482{flex:1;min-height:38px;border:1px solid var(--mod-border,#30363b);border-radius:9px;background:var(--mod-control,#101315);color:var(--mod-text,#f3f3f3);font-size:10px;font-weight:900;letter-spacing:.35px}.voice-main-v482.listening{box-shadow:0 0 0 2px rgba(255,255,255,.18) inset}
      .voice-status-v482{margin-top:6px;font-size:9px;line-height:1.35;color:var(--mod-muted,#87949c)}.voice-preview-v482{margin-top:9px;padding:9px;border:1px solid rgba(255,255,255,.12);border-radius:8px}.voice-preview-v482[hidden]{display:none!important}.voice-kicker-v482{font-size:8px;font-weight:950;letter-spacing:.65px;color:var(--mod-muted,#87949c)}.voice-transcript-v482{margin-top:4px;font-size:11px;font-weight:850}.voice-action-v482{margin-top:7px;font-size:10px;line-height:1.4;color:var(--mod-text,#f3f3f3)}
      .voice-actions-v482{display:flex;gap:7px;margin-top:9px}.voice-actions-v482 button{flex:1;min-height:34px;border:1px solid var(--mod-border,#30363b);border-radius:8px;background:var(--mod-control,#101315);color:var(--mod-text,#f3f3f3);font-size:9px;font-weight:900}.voice-actions-v482 .execute{background:var(--mod-accent,#e8ecef);color:var(--mod-accent-text,#101214);border-color:var(--mod-accent,#e8ecef)}.voice-actions-v482 .execute:disabled{opacity:.35}.voice-help-v482{margin-top:7px;font-size:8px;line-height:1.45;color:var(--mod-muted,#87949c)}
    `;document.head.appendChild(s);
  }

  function previewHtml(command){
    const canExecute=command.type==='create'||((command.type==='start'||command.type==='finish')&&!!command.resolvedTask);
    return `<div class="voice-kicker-v482">ERKANNT</div><div class="voice-transcript-v482">„${esc(command.transcript||lastTranscript)}“</div><div class="voice-kicker-v482" style="margin-top:8px">INTERPRETATION</div><div class="voice-action-v482">${esc(describe(command))}</div><div class="voice-actions-v482"><button type="button" class="execute" data-v482-execute ${canExecute?'':'disabled'}>AUSFÜHREN</button><button type="button" data-v482-cancel>VERWERFEN</button></div>`;
  }

  function bindPreview(root=document){
    root.querySelector('[data-v482-execute]')?.addEventListener('click',executePending);
    root.querySelector('[data-v482-cancel]')?.addEventListener('click',()=>{pending=null;ensureUi();});
  }

  function ensureUi(){
    injectStyle();const panel=document.getElementById('inputPanel');if(!panel)return false;
    let box=document.getElementById('voiceCommandTestV482');
    if(!box){box=document.createElement('div');box.id='voiceCommandTestV482';box.className='voice-test-v482';const add=panel.querySelector('.add-button');if(add)add.after(box);else panel.appendChild(box);}
    const supported=!!Recognition;
    const buttonText=stopping?'⏹ AUFNAHME WIRD GESTOPPT …':listening?'⏹ AUFNAHME STOPPEN':'🎙 SPRACHBEFEHL TEST';
    box.innerHTML=`<div class="voice-head-v482"><button type="button" id="voiceStartV482" class="voice-main-v482 ${listening||stopping?'listening':''}" ${supported?'':'disabled'}>${buttonText}</button></div><div id="voiceStatusV482" class="voice-status-v482">${supported?'Kostenloser Browser-Test · keine OpenAI-API.':'Spracherkennung ist in diesem Browser nicht verfügbar.'}</div><div id="voicePreviewV482" class="voice-preview-v482" ${pending?'':'hidden'}>${pending?previewHtml(pending):''}</div><div class="voice-help-v482">TESTBEFEHLE: „Neue Aufgabe Bad putzen heute Arbeitsblock 2“ · „Starte Bad putzen“ · „Bad putzen ist fertig“</div>`;
    box.querySelector('#voiceStartV482')?.addEventListener('click',toggleListening);
    bindPreview(box);return true;
  }

  function setStatus(text){const el=document.getElementById('voiceStatusV482');if(el)el.textContent=text;}
  function refreshPreview(){const p=document.getElementById('voicePreviewV482');if(!p)return;if(!pending){p.hidden=true;p.innerHTML='';return;}p.hidden=false;p.innerHTML=previewHtml(pending);bindPreview(p);}
  function acceptTranscript(text){lastTranscript=String(text||'').trim();pending=resolve(parseTranscript(lastTranscript));return pending;}
  function clearStopTimer(){if(stopFallback){clearTimeout(stopFallback);stopFallback=null;}}
  function resetRecognition(instance){if(instance&&recognition!==instance)return;clearStopTimer();recognition=null;listening=false;stopping=false;}

  function recognitionErrorMessage(code){
    if(code==='not-allowed'||code==='service-not-allowed')return 'Mikrofon/Spracherkennung nicht erlaubt. Auf dem iPhone ggf. Mikrofonfreigabe und Siri prüfen.';
    if(code==='no-speech')return 'Ich habe keine Sprache erkannt. Nochmal tippen und deutlicher sprechen.';
    if(code==='audio-capture')return 'Kein Mikrofon verfügbar.';
    if(code==='network')return 'Spracherkennungsdienst gerade nicht erreichbar.';
    return `Spracherkennung fehlgeschlagen: ${code||'unbekannter Fehler'}.`;
  }

  function getRecognition(){
    if(!Recognition)return null;if(recognition)return recognition;
    const r=new Recognition();recognition=r;r.lang='de-DE';r.continuous=false;r.interimResults=false;r.maxAlternatives=3;
    r.onstart=()=>{if(recognition!==r)return;listening=true;stopping=false;ensureUi();setStatus('Ich höre zu … sprich jetzt den Testbefehl. Tippe erneut zum Stoppen.');};
    r.onresult=event=>{
      if(recognition!==r)return;
      const result=event.results?.[0],transcript=result?.[0]?.transcript||'';acceptTranscript(transcript);
      try{r.abort?.();}catch(_){}
      resetRecognition(r);ensureUi();refreshPreview();setStatus('Befehl erkannt. Bitte Interpretation prüfen und erst dann AUSFÜHREN.');
    };
    r.onerror=event=>{
      if(recognition!==r)return;
      if(stopping&&event.error==='aborted'){resetRecognition(r);ensureUi();setStatus('Aufnahme gestoppt.');return;}
      const message=recognitionErrorMessage(event.error);resetRecognition(r);ensureUi();setStatus(message);
    };
    r.onend=()=>{
      if(recognition!==r)return;
      const hadPending=!!pending;resetRecognition(r);ensureUi();refreshPreview();setStatus(hadPending?'Befehl erkannt. Bitte Interpretation prüfen.':'Aufnahme beendet.');
    };
    return r;
  }

  function stopListening(){
    const r=recognition;if(!r||(!listening&&!stopping))return false;
    if(stopping)return true;
    stopping=true;ensureUi();setStatus('Aufnahme wird gestoppt …');
    try{if(typeof r.stop==='function')r.stop();else if(typeof r.abort==='function')r.abort();}
    catch(_){try{r.abort?.();}catch(__){}resetRecognition(r);ensureUi();setStatus('Aufnahme gestoppt.');return true;}
    clearStopTimer();
    stopFallback=setTimeout(()=>{
      if(recognition!==r)return;
      try{r.abort?.();}catch(_){}
      resetRecognition(r);ensureUi();setStatus('Aufnahme gestoppt.');
    },700);
    return true;
  }

  function startListening(){
    if(listening||stopping)return stopListening();
    pending=null;refreshPreview();const r=getRecognition();
    if(!r){setStatus('Spracherkennung ist in diesem Browser nicht verfügbar.');return false;}
    try{r.start();return true;}catch(_){resetRecognition(r);ensureUi();setStatus('Spracherkennung konnte nicht gestartet werden. Bitte kurz warten und erneut tippen.');return false;}
  }
  function toggleListening(){return listening||stopping?stopListening():startListening();}

  function selectBlockByNumber(number){
    const ui=window.__modTodayCreateRenderV480;if(!ui)return false;
    ui.setNewTaskToday(true);ui.ensureInputControls?.();const select=document.getElementById('newTodayBlockV480');if(!select)return !number;if(!number)return true;
    const option=select.options[number-1];if(!option)return false;select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));return true;
  }

  function executeCreate(command){
    const input=document.getElementById('taskInput');if(!input)throw new Error('Aufgaben-Eingabe nicht gefunden.');
    if(command.priority&&typeof setNewPriority==='function')setNewPriority(command.priority);
    if(command.today){if(!selectBlockByNumber(command.block))throw new Error(`Arbeitsblock ${command.block} existiert heute nicht.`);}else window.__modTodayCreateRenderV480?.setNewTaskToday?.(false);
    input.value=command.text;const before=new Set(tasksSafe().map(t=>t?.id));if(typeof addTask!=='function')throw new Error('addTask nicht verfügbar.');addTask();
    const fresh=tasksSafe().find(t=>!before.has(t?.id));if(!fresh)throw new Error('Aufgabe wurde nicht erstellt.');return `Aufgabe „${fresh.text}“ erstellt${fresh.todayDate===today()?' und HEUTE zugewiesen':''}.`;
  }
  function executeStart(command){const task=command.resolvedTask;if(!task)throw new Error(command.reason||'Aufgabe nicht gefunden.');if(task.status==='running')return `„${task.text}“ läuft bereits.`;if(task.status==='paused'&&typeof resumeTask==='function'){resumeTask(task.id);return `„${task.text}“ fortgesetzt.`;}if(typeof startTask!=='function')throw new Error('startTask nicht verfügbar.');startTask(task.id);return `„${task.text}“ gestartet.`;}
  function executeFinish(command){const task=command.resolvedTask;if(!task)throw new Error(command.reason||'Aufgabe nicht gefunden.');if(typeof finishTask!=='function')throw new Error('finishTask nicht verfügbar.');finishTask(task.id);return `„${task.text}“ an die Abschlusslogik übergeben.`;}
  function execute(command){if(!command)throw new Error('Kein Befehl vorgemerkt.');if(command.type==='create')return executeCreate(command);if(command.type==='start')return executeStart(command);if(command.type==='finish')return executeFinish(command);throw new Error(command.reason||'Befehl wird im Test noch nicht unterstützt.');}
  function executePending(){if(!pending)return false;try{const message=execute(pending);pending=null;ensureUi();setStatus(message);return true;}catch(error){ensureUi();setStatus(String(error?.message||error));return false;}}

  function init(){document.getElementById('voiceCommandTestV481')?.remove();ensureUi();}
  const previousRender=typeof window.render==='function'?window.render:null;
  if(previousRender)window.render=function(){const result=previousRender.apply(this,arguments);document.getElementById('voiceCommandTestV481')?.remove();ensureUi();return result;};
  window.addEventListener('load',()=>setTimeout(init,0));setTimeout(init,0);

  window.__modVoiceCommandsV482={
    version:BUILD_VERSION,parseTranscript,stripNewTaskModifiers,blockNumberFrom,resolve,describe,acceptTranscript,execute,ensureUi,startListening,stopListening,toggleListening,
    get supported(){return !!Recognition;},get listening(){return listening;},get stopping(){return stopping;},get pending(){return pending;},
    noOpenAiApi:true,confirmationRequired:true,microphoneStop:true,blockTitleCleanup:true,supportedCommands:['create','start','finish']
  };
})();
