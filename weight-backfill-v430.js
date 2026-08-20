/* V430 · MANUAL WEIGHT BACKFILL */
(function(){
  const VERSION='V430';

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function nowLocal(){return typeof formatISOForDateTimeLocal==='function'?formatISOForDateTimeLocal(new Date().toISOString()):'';}
  function defaultStart(){const d=new Date(Date.now()-30*60*1000);return typeof formatISOForDateTimeLocal==='function'?formatISOForDateTimeLocal(d.toISOString()):'';}
  function overlaps(startMs,endMs){
    const phases=Array.isArray(window.weightPhases)?window.weightPhases:(typeof weightPhases!=='undefined'&&Array.isArray(weightPhases)?weightPhases:[]);
    const hit=phases.find(p=>{
      if(!p||!p.startedAt||!p.endedAt)return false;
      const a=new Date(p.startedAt).getTime(),b=new Date(p.endedAt).getTime();
      return Number.isFinite(a)&&Number.isFinite(b)&&Math.max(startMs,a)<Math.min(endMs,b);
    });
    if(hit)return hit;
    try{
      if(typeof weightState!=='undefined'&&weightState?.isWearing&&weightState.currentPhaseStartedAt){
        const a=new Date(weightState.currentPhaseStartedAt).getTime(),b=Date.now();
        if(Number.isFinite(a)&&Math.max(startMs,a)<Math.min(endMs,b))return {current:true,startedAt:weightState.currentPhaseStartedAt,endedAt:new Date(b).toISOString(),weightKg:weightState.currentPhaseWeightKg};
      }
    }catch(_){}
    return null;
  }
  function close(){const el=document.getElementById('weightBackfillOverlayV430');if(el)el.remove();}
  function showError(title,msg){if(typeof showInfoModal==='function')showInfoModal(title,msg);else alert(title+'\n\n'+msg);}

  window.openWeightBackfillV430=function(){
    close();
    const current=(typeof weightState!=='undefined'&&Number(weightState.currentWeightKg)>0)?Number(weightState.currentWeightKg):0;
    const overlay=document.createElement('div');
    overlay.id='weightBackfillOverlayV430';
    overlay.className='modal-overlay weight-backfill-overlay-v430';
    overlay.innerHTML=`<div class="modal weight-backfill-modal-v430" role="dialog" aria-modal="true" aria-labelledby="weightBackfillTitleV430">
      <div class="weight-backfill-head-v430"><div><div id="weightBackfillTitleV430" class="weight-backfill-title-v430">ZUSATZGEWICHT NACHTRAGEN</div><div class="weight-backfill-sub-v430">Vergessenen Tragezeitraum nachträglich erfassen</div></div><button class="weight-backfill-close-v430" type="button" aria-label="Schließen" onclick="closeWeightBackfillV430()">×</button></div>
      <label class="weight-backfill-label-v430">GEWICHT · KG<input id="weightBackfillKgV430" class="weight-backfill-input-v430" inputmode="decimal" value="${esc(current?String(current).replace('.',','):'')}"></label>
      <label class="weight-backfill-label-v430">VON<input id="weightBackfillStartV430" class="weight-backfill-input-v430" type="datetime-local" value="${esc(defaultStart())}"></label>
      <label class="weight-backfill-label-v430">BIS<input id="weightBackfillEndV430" class="weight-backfill-input-v430" type="datetime-local" value="${esc(nowLocal())}"></label>
      <div class="weight-backfill-hint-v430">Der Zeitraum wird wie eine normale Gewichtsphase gespeichert und automatisch in Tages-, Aufgaben- und Archivstatistiken berücksichtigt.</div>
      <div class="weight-backfill-actions-v430"><button class="weight-backfill-secondary-v430" type="button" onclick="closeWeightBackfillV430()">ABBRECHEN</button><button class="weight-backfill-primary-v430" type="button" onclick="saveWeightBackfillV430()">SPEICHERN</button></div>
    </div>`;
    overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    document.body.appendChild(overlay);
  };
  window.closeWeightBackfillV430=close;

  window.saveWeightBackfillV430=function(){
    const kgEl=document.getElementById('weightBackfillKgV430'),sEl=document.getElementById('weightBackfillStartV430'),eEl=document.getElementById('weightBackfillEndV430');
    if(!kgEl||!sEl||!eEl)return;
    const kg=Number(String(kgEl.value).replace(',','.'));
    if(!Number.isFinite(kg)||kg<=0){showError('Ungültiges Gewicht','Bitte gib ein gültiges Gewicht größer als 0 kg ein.');return;}
    const startIso=typeof berlinLocalInputToISO==='function'?berlinLocalInputToISO(sEl.value):null;
    const endIso=typeof berlinLocalInputToISO==='function'?berlinLocalInputToISO(eEl.value):null;
    const startMs=startIso?new Date(startIso).getTime():NaN,endMs=endIso?new Date(endIso).getTime():NaN;
    if(!Number.isFinite(startMs)||!Number.isFinite(endMs)){showError('Ungültiger Zeitraum','Bitte gib für Von und Bis ein gültiges Datum mit Uhrzeit ein.');return;}
    if(endMs<=startMs){showError('Ungültiger Zeitraum','„Bis“ muss nach „Von“ liegen.');return;}
    if(endMs>Date.now()+60*1000){showError('Zeitraum liegt in der Zukunft','Nachtragen ist nur für bereits vergangene Zeiträume vorgesehen.');return;}
    const hit=overlaps(startMs,endMs);
    if(hit){
      const hStart=typeof formatDateTime==='function'?formatDateTime(hit.startedAt,'VON'):String(hit.startedAt||'');
      const hEnd=typeof formatDateTime==='function'?formatDateTime(hit.endedAt,'BIS'):String(hit.endedAt||'');
      showError('Überschneidung erkannt','Für diesen Zeitraum existiert bereits eine Gewichtsphase. Bitte korrigiere Von/Bis, damit keine Tragezeit doppelt gezählt wird.\n\n'+hStart+'\n'+hEnd);
      return;
    }
    const phases=Array.isArray(window.weightPhases)?window.weightPhases:(typeof weightPhases!=='undefined'&&Array.isArray(weightPhases)?weightPhases:null);
    if(!phases){showError('Speichern nicht möglich','Die Gewichtsphasen konnten nicht geladen werden.');return;}
    const phase={id:Date.now(),weightKg:kg,startedAt:startIso,endedAt:endIso,date:typeof getBerlinDateKeyFromISO==='function'?getBerlinDateKeyFromISO(startIso):null,source:'manual-backfill',manuallyEntered:true,createdAt:new Date().toISOString()};
    phases.push(phase);
    phases.sort((a,b)=>new Date(a?.startedAt||0)-new Date(b?.startedAt||0));
    if(typeof saveWeight==='function')saveWeight();
    close();
    if(typeof renderWeightPanel==='function')renderWeightPanel();
    if(typeof render==='function')render();
    if(typeof showInfoModal==='function')showInfoModal('Zusatzgewicht nachgetragen',`${String(kg).replace('.',',')} kg wurden für den gewählten Zeitraum gespeichert.`);
  };

  function icon(){return '<svg class="weight-backfill-svg-v430" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 7.5a3.5 3.5 0 1 1 7 0"/><path d="M6.5 8.5h11l2 10h-15Z"/><path d="M9 13h6M12 10v6"/></svg>';}
  function patchPanel(){
    const panel=document.querySelector('#weightContainer .weight-panel');
    if(!panel||panel.querySelector('.weight-backfill-button-v430'))return;
    const action=panel.querySelector('.weight-action-button');
    if(!action)return;
    const btn=document.createElement('button');
    btn.type='button';btn.className='weight-backfill-button-v430';btn.innerHTML=icon()+'<span>NACHTRAGEN</span>';btn.setAttribute('aria-label','Zusatzgewicht nachtragen');btn.onclick=openWeightBackfillV430;
    action.insertAdjacentElement('beforebegin',btn);
  }
  const prev=typeof renderWeightPanel==='function'?renderWeightPanel:null;
  if(prev){window.renderWeightPanel=function(){const r=prev.apply(this,arguments);setTimeout(patchPanel,0);return r;};}
  new MutationObserver(()=>patchPanel()).observe(document.getElementById('weightContainer')||document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',()=>setTimeout(patchPanel,300));
  setTimeout(patchPanel,0);
  window.__modWeightBackfillV430={version:VERSION,patchPanel,overlaps};
})();