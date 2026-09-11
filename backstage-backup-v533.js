/* V533 · BACKSTAGE BACKUP DECK
   - Entfernt die alte große VOLLBACKUP-Karte aus dem Control-Deck, ohne die Backup-Logik zu verändern.
   - Ergänzt einen kompakten sechsten Schnellzugriff VOLLBACKUP.
   - Verdrahtet den bestehenden BACKUP-Sektor mit den bereits gehärteten V498-Backup-Funktionen.
   - Bestehende localStorage-/Cloud-/Restore-Semantik bleibt unverändert.
*/
(function(){
  'use strict';
  if(window.__modBackstageBackupV533)return;

  const VERSION='V533';
  const ROOT_ID='modBackstageV530';
  const PARK_ID='modBackstageLegacyBackupParkingV533';
  let observer=null;
  let captureInstalled=false;
  let fullBackupBusy=false;

  function backstageApi(){return window.__modBackstageV531||window.__modBackstageV530||null;}
  function safetyApi(){return window.__modRecoveryHistoryV498||null;}
  function isOpen(){return document.body.classList.contains('mod-backstage-v530');}

  function ensureParking(){
    let parking=document.getElementById(PARK_ID);
    if(parking)return parking;
    parking=document.createElement('div');
    parking.id=PARK_ID;
    parking.hidden=true;
    parking.setAttribute('aria-hidden','true');
    document.body.appendChild(parking);
    return parking;
  }

  function parkLegacyFullBackup(){
    const wrap=document.getElementById('fullBackupWrapV397');
    if(!wrap)return false;
    const parking=ensureParking();
    if(wrap.parentNode!==parking)parking.appendChild(wrap);
    wrap.hidden=true;
    wrap.dataset.modBackstageParkedV533='true';
    return true;
  }

  function ensureQuickFullBackupButton(){
    const tabs=document.querySelector(`#${ROOT_ID} .mod-backstage-tabs-v531`);
    if(!tabs)return null;
    let button=tabs.querySelector('[data-backstage-action-v533="fullbackup"]');
    if(button)return button;
    button=document.createElement('button');
    button.type='button';
    button.className='mod-backstage-tab-v531 mod-backstage-tab-action-v533';
    button.dataset.backstageActionV533='fullbackup';
    button.setAttribute('aria-label','Vollbackup direkt erstellen');
    button.setAttribute('aria-selected','false');
    button.innerHTML='<span class="mod-backstage-tab-index-v531">06</span><span class="mod-backstage-tab-label-v531">VOLLBACKUP</span>';
    tabs.appendChild(button);
    return button;
  }

  function updateFullBackupBusyState(){
    document.querySelectorAll('[data-backstage-action-v533="fullbackup"],[data-backup-action-v533="fullbackup"]').forEach(button=>{
      button.disabled=fullBackupBusy;
      button.setAttribute('aria-busy',fullBackupBusy?'true':'false');
      const label=button.querySelector('.mod-backstage-tab-label-v531');
      if(label)label.textContent=fullBackupBusy?'SICHERT…':'VOLLBACKUP';
      else if(button.dataset.backupActionV533==='fullbackup')button.textContent=fullBackupBusy?'BACKUP WIRD ERSTELLT…':'VOLLBACKUP ERSTELLEN';
    });
  }

  async function runFullBackup(){
    if(fullBackupBusy)return false;
    fullBackupBusy=true;
    updateFullBackupBusyState();
    try{
      const api=safetyApi();
      if(typeof api?.createEnhancedFullBackup==='function'){
        await api.createEnhancedFullBackup();
        return true;
      }
      const legacy=document.getElementById('fullBackupV397');
      if(legacy){legacy.click();return true;}
      throw new Error('Die Vollbackup-Funktion ist noch nicht verfügbar.');
    }catch(error){
      console.error('V533 Vollbackup:',error);
      try{showInfoModal?.('Vollbackup nicht verfügbar',error?.message||String(error));}catch(_){}
      return false;
    }finally{
      fullBackupBusy=false;
      updateFullBackupBusyState();
    }
  }

  function backupCard({code,title,text,buttonLabel,action,state}){
    const actionHtml=action?`<button type="button" class="mod-backstage-backup-action-v533" data-backup-action-v533="${action}">${buttonLabel}</button>`:`<span class="mod-backstage-backup-state-v533">${state||'AKTIV'}</span>`;
    return `<article class="mod-backstage-backup-card-v533" data-backup-card-v533="${code}"><div class="mod-backstage-backup-code-v533">${code}</div><h4>${title}</h4><p>${text}</p>${actionHtml}</article>`;
  }

  function renderBackupDashboard(){
    if(!isOpen())return false;
    const view=document.getElementById('viewContainer');
    if(!view)return false;
    parkLegacyFullBackup();
    view.innerHTML=`<section class="mod-backstage-backup-v533" data-backstage-backup-v533="true">
      <div class="mod-backstage-backup-head-v533"><div><div class="mod-backstage-backup-kicker-v533">SEKTOR 03 · DATENSICHERUNG</div><h3>BACKUP</h3><p>Alle vorhandenen Sicherungswege an einem Ort. Die bewährte Backup-Logik bleibt unverändert, nur die Bedienung zieht hierher um.</p></div><span class="mod-backstage-backup-ready-v533">READY</span></div>
      <div class="mod-backstage-backup-grid-v533">
        ${backupCard({code:'B01',title:'VOLLBACKUP',text:'Aktueller Programmcode + kompletter App-Datenstand + 7-Tage-Log + Wiederherstellungspunkte als ZIP.',buttonLabel:'VOLLBACKUP ERSTELLEN',action:'fullbackup'})}
        ${backupCard({code:'B02',title:'WOCHEN-CLOUD',text:'Datierter Cloud-Stand mit App-Daten und Sicherheitsverlauf. Es werden bis zu 12 Wochenstände behalten.',buttonLabel:'WOCHENBACKUP ERSTELLEN',action:'weekly-create'})}
        ${backupCard({code:'B03',title:'WOCHENSTÄNDE',text:'Vorhandene datierte Cloud-Wochenbackups anzeigen und bei Bedarf wiederherstellen.',buttonLabel:'WOCHENBACKUPS ANZEIGEN',action:'weekly-list'})}
        ${backupCard({code:'B04',title:'ZIP-IMPORT',text:'Ein zuvor erzeugtes vollständiges Backup-ZIP prüfen und für eine Wiederherstellung einlesen.',buttonLabel:'VOLLBACKUP-ZIP IMPORTIEREN',action:'zip-import'})}
        ${backupCard({code:'B05',title:'LIVE-CLOUD-SNAPSHOT',text:'Der vollständige Live-Snapshot wird weiterhin automatisch nach einem erfolgreichen Cloud-Sync aktualisiert.',state:'AUTOMATISCH'})}
      </div>
      <input type="file" accept=".zip,application/zip" data-backup-file-v533 hidden>
    </section>`;

    const fileInput=view.querySelector('[data-backup-file-v533]');
    view.querySelectorAll('[data-backup-action-v533]').forEach(button=>{
      button.addEventListener('click',async()=>{
        const action=button.dataset.backupActionV533;
        const api=safetyApi();
        try{
          if(action==='fullbackup'){await runFullBackup();return;}
          if(action==='weekly-create'){await api?.createWeeklyCloudBackup?.();return;}
          if(action==='weekly-list'){await api?.listWeeklyCloudBackups?.();return;}
          if(action==='zip-import'){fileInput?.click();return;}
        }catch(error){
          console.error('V533 Backup-Aktion:',action,error);
          try{showInfoModal?.('Backup-Aktion fehlgeschlagen',error?.message||String(error));}catch(_){}
        }
      });
    });
    fileInput?.addEventListener('change',async event=>{
      const file=event.target.files?.[0];
      event.target.value='';
      if(!file)return;
      try{
        const api=safetyApi();
        if(typeof api?.importFullBackupZip!=='function')throw new Error('ZIP-Import ist noch nicht verfügbar.');
        await api.importFullBackupZip(file);
      }catch(error){
        console.error('V533 ZIP-Import:',error);
        try{showInfoModal?.('Vollbackup konnte nicht importiert werden',error?.message||String(error));}catch(_){}
      }
    });
    updateFullBackupBusyState();
    try{window.__modFixedAppHeaderV475?.updateHeight?.();}catch(_){}
    return true;
  }

  function openBackup(){
    const api=backstageApi();
    if(!api)return false;
    api.setSection?.('backup');
    renderBackupDashboard();
    return true;
  }

  function installCapture(){
    if(captureInstalled)return;
    captureInstalled=true;
    window.addEventListener('click',event=>{
      if(!isOpen())return;
      const backupTab=event.target?.closest?.('[data-backstage-section-v531="backup"]');
      if(backupTab){
        event.preventDefault();
        event.stopImmediatePropagation();
        openBackup();
        return;
      }
      const quick=event.target?.closest?.('[data-backstage-action-v533="fullbackup"]');
      if(quick){
        event.preventDefault();
        event.stopImmediatePropagation();
        runFullBackup();
      }
    },true);
  }

  function patch(){
    ensureQuickFullBackupButton();
    parkLegacyFullBackup();
    const api=backstageApi();
    if(isOpen()&&api?.activeSection==='backup'&&!document.querySelector('[data-backstage-backup-v533="true"]'))renderBackupDashboard();
    return !!document.querySelector('[data-backstage-action-v533="fullbackup"]');
  }

  function observe(){
    if(observer)return;
    observer=new MutationObserver(()=>patch());
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }

  const api={
    version:VERSION,
    patch,
    openBackup,
    renderBackupDashboard,
    runFullBackup,
    parkLegacyFullBackup,
    sixTileDeckV533:true,
    backupDashboardV533:true,
    existingBackupLogicReusedV533:true,
    dataSemanticsUntouched:true
  };
  window.__modBackstageBackupV533=api;

  installCapture();
  observe();
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    const ready=backstageApi()&&patch();
    if(ready||tries>240)clearInterval(timer);
  },50);
  if(document.readyState!=='loading')setTimeout(patch,0);
  else document.addEventListener('DOMContentLoaded',()=>setTimeout(patch,0),{once:true});
  window.addEventListener('load',()=>setTimeout(patch,250),{once:true});
})();
