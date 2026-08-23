/* V485 · GUARDED TERMINAL + ARCHIVE DELETE
   Adds a delete action to completed, aborted and archived tasks.
   Every destructive action requires an explicit in-app confirmation.
   Archive deletion removes the entry from time/statistics sources and
   compacts visible archive numbers while preserving stable archiveId values.
*/
(function(){
  'use strict';
  const BUILD_VERSION='V485';
  const TERMINAL_STATUSES=new Set(['completed','aborted']);

  const clean=v=>String(v??'').trim().replace(/\s+/g,' ');
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(String(v??'')):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=v=>{try{return JSON.parse(JSON.stringify(v));}catch(_){return v;}};

  function durationContribution(row){
    if(!row)return 0;
    if(row.type==='leisure')return Number(row.leisureDurationMs)||0;
    if(row.type==='cooking')return Number(row.cookingActiveDurationMs)||Number(row.activeDurationMs)||0;
    return Number(row.archiveAccountingActiveDurationMs)||Number(row.activeDurationMs)||0;
  }

  function persistTasks(){
    if(typeof saveTasks==='function')saveTasks();
    else if(typeof safeStorageSet==='function')safeStorageSet('masterOfDisasterTasks',JSON.stringify(Array.isArray(tasks)?tasks:[]));
  }

  function persistArchive(){
    if(typeof saveArchive==='function')saveArchive();
    else if(typeof safeStorageSet==='function'){
      safeStorageSet('masterOfDisasterArchive',JSON.stringify(Array.isArray(archive)?archive:[]));
      safeStorageSet('masterOfDisasterNextArchiveNumber',String(nextArchiveNumber));
    }
  }

  function realArchiveRows(){
    if(!Array.isArray(archive))throw new Error('Archiv ist nicht verfügbar.');
    return archive.filter(row=>row&&!row.isTestArchive);
  }

  function compactArchiveNumbers(){
    const real=realArchiveRows();
    for(const row of real){
      const n=Number(row.archiveNumber);
      if(!Number.isInteger(n)||n<=0)throw new Error('Archiv enthält eine ungültige Archivnummer. Löschung wurde nicht ausgeführt.');
    }
    real.sort((a,b)=>Number(a.archiveNumber)-Number(b.archiveNumber));
    const mappings=[];
    real.forEach((row,index)=>{
      const from=Number(row.archiveNumber),to=index+1;
      if(from!==to)mappings.push({archiveId:row.archiveId??null,from,to});
      row.archiveNumber=to;
    });
    nextArchiveNumber=real.length+1;
    return {mappings,nextArchiveNumber,realCount:real.length};
  }

  function deleteTerminalTask(id){
    if(!Array.isArray(tasks))throw new Error('Aufgabenliste ist nicht verfügbar.');
    const index=tasks.findIndex(row=>row&&String(row.id)===String(id));
    if(index<0)throw new Error('Aufgabe wurde nicht gefunden.');
    const row=tasks[index];
    if(!TERMINAL_STATUSES.has(String(row.status||'')))throw new Error('Nur erledigte oder abgebrochene Aufgaben können hier gelöscht werden.');
    const deleted=clone(row);
    tasks.splice(index,1);
    persistTasks();
    try{window.__modLiveLogV453?.append?.('EDIT','WARN',`Terminale Aufgabe dauerhaft gelöscht: „${row.text}“`);}catch(_){}
    try{if(typeof scheduleSupabaseLiveSync==='function')scheduleSupabaseLiveSync('terminal-delete-v485');}catch(_){}
    if(typeof render==='function')render();
    return {kind:'task',id:deleted.id,text:deleted.text,status:deleted.status,removed_active_ms:durationContribution(deleted),deleted:true};
  }

  function resolveArchiveRow(locator){
    if(!Array.isArray(archive))throw new Error('Archiv ist nicht verfügbar.');
    let matches=[];
    if(locator&&typeof locator==='object'&&locator.archiveId!=null)matches=archive.filter(row=>row&&String(row.archiveId)===String(locator.archiveId));
    else if(locator&&typeof locator==='object'&&locator.archiveNumber!=null)matches=archive.filter(row=>row&&Number(row.archiveNumber)===Number(locator.archiveNumber));
    else throw new Error('Archivaufgabe nicht eindeutig angegeben.');
    if(matches.length===0)throw new Error('Archivaufgabe wurde nicht gefunden.');
    if(matches.length>1)throw new Error('Archivaufgabe ist nicht eindeutig.');
    return matches[0];
  }

  function deleteArchivedTask(locator){
    const beforeArchive=clone(archive),beforeNext=Number(nextArchiveNumber)||1;
    const row=resolveArchiveRow(locator);
    const index=archive.indexOf(row);
    const deleted=clone(row);
    const stableIdsBefore=new Map(realArchiveRows().map(item=>[String(item.archiveId??''),item.archiveId??null]));
    try{
      archive.splice(index,1);
      const compact=compactArchiveNumbers();
      for(const item of realArchiveRows()){
        const key=String(item.archiveId??'');
        if(stableIdsBefore.has(key)&&stableIdsBefore.get(key)!==(item.archiveId??null))throw new Error('Stabile archiveId wurde verändert.');
      }
      persistArchive();
      try{window.__modLiveLogV453?.append?.('ARCHIVE','WARN',`Archivaufgabe dauerhaft gelöscht: „${deleted.text}“ · Archivnummern neu verdichtet`);}catch(_){}
      try{if(typeof scheduleSupabaseLiveSync==='function')scheduleSupabaseLiveSync('archive-delete-v485');}catch(_){}
      if(typeof render==='function')render();
      return {kind:'archive',archiveId:deleted.archiveId??null,old_archive_number:deleted.archiveNumber??null,text:deleted.text,status:deleted.status,removed_active_ms:durationContribution(deleted),shifted:compact.mappings.length,next_archive_number:compact.nextArchiveNumber,archive_ids_preserved:true,deleted:true};
    }catch(error){
      archive=beforeArchive;
      nextArchiveNumber=beforeNext;
      throw error;
    }
  }

  function closeModal(){
    const modal=document.getElementById('modalContainer');
    if(modal)modal.innerHTML='';
  }

  function openDeleteConfirm(kind,row){
    const modal=document.getElementById('modalContainer');
    if(!modal||!row)return false;
    const archived=kind==='archive';
    const status=archived?'ARCHIVIERT':String(row.status||'').toUpperCase();
    modal.innerHTML=`
      <div class="modal-overlay">
        <div class="modal terminal-delete-modal-v485">
          <div class="modal-title">🗑️ DAUERHAFT LÖSCHEN?</div>
          <div class="terminal-delete-name-v485">${esc(row.text||'Unbenannte Aufgabe')}</div>
          <div class="terminal-delete-status-v485">${esc(status)}</div>
          <div class="terminal-delete-warning-v485">
            Willst du diese Aufgabe wirklich dauerhaft löschen?<br><br>
            ${archived
              ? 'Die Aufgabe wird aus dem Archiv entfernt. Ihre erfassten Zeiten verschwinden aus den Statistiken und alle nachfolgenden Archivnummern rücken automatisch nach.'
              : 'Die Aufgabe und ihre bisher erfassten Zeiten werden vollständig entfernt. Dadurch werden die aktuellen Statistiken entsprechend angepasst.'}
            <br><br><strong>Das lässt sich danach nicht automatisch rückgängig machen.</strong>
          </div>
          <div class="modal-actions">
            <button type="button" class="modal-button secondary" id="terminalDeleteCancelV485">ABBRECHEN</button>
            <button type="button" class="modal-button primary terminal-delete-confirm-v485" id="terminalDeleteConfirmV485">JA, DAUERHAFT LÖSCHEN</button>
          </div>
        </div>
      </div>`;
    document.getElementById('terminalDeleteCancelV485')?.addEventListener('click',closeModal);
    document.getElementById('terminalDeleteConfirmV485')?.addEventListener('click',()=>{
      try{
        if(archived)deleteArchivedTask({archiveId:row.archiveId,archiveNumber:row.archiveNumber});
        else deleteTerminalTask(row.id);
        closeModal();
      }catch(error){
        const msg=error?.message||String(error);
        modal.querySelector('.terminal-delete-warning-v485').innerHTML=`<strong>Löschen nicht ausgeführt.</strong><br><br>${esc(msg)}`;
        const confirm=document.getElementById('terminalDeleteConfirmV485');if(confirm)confirm.remove();
      }
    });
    return true;
  }

  function makeDeleteButton(kind,row){
    const button=document.createElement('button');
    button.type='button';
    button.className=kind==='archive'?'archive-test-delete-button terminal-delete-v485':'test-task-delete-button terminal-delete-v485';
    button.textContent='🗑️ LÖSCHEN';
    button.title='Dauerhaft löschen';
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openDeleteConfirm(kind,row);});
    return button;
  }

  function injectStyle(){
    if(document.getElementById('terminalDeleteStyleV485'))return;
    const style=document.createElement('style');
    style.id='terminalDeleteStyleV485';
    style.textContent=`
      .terminal-delete-v485{margin:8px 6px 2px 0;cursor:pointer}
      .terminal-delete-modal-v485{max-width:520px}
      .terminal-delete-name-v485{font-weight:900;font-size:1rem;margin:10px 0 4px;word-break:break-word}
      .terminal-delete-status-v485{font-size:.72rem;font-weight:900;letter-spacing:.08em;opacity:.65;margin-bottom:12px}
      .terminal-delete-warning-v485{line-height:1.45;font-size:.9rem}
      .terminal-delete-confirm-v485{border-color:rgba(220,80,80,.75)!important}
    `;
    document.head.appendChild(style);
  }

  function rowForCard(card){
    const api=window.__modCategoriesV412;
    if(typeof api?.rowForCard==='function')return api.rowForCard(card);
    return null;
  }

  function enhanceDeleteActions(){
    const container=document.getElementById('viewContainer');
    if(!container)return;
    injectStyle();

    container.querySelectorAll('.task:not(.archive-task)').forEach(card=>{
      const row=rowForCard(card);
      if(!row||!TERMINAL_STATUSES.has(String(row.status||'')))return;
      card.querySelectorAll('.test-task-delete-button:not(.terminal-delete-v485)').forEach(button=>button.remove());
      if(card.querySelector('.terminal-delete-v485'))return;
      const repeat=card.querySelector('.repeat-button');
      const button=makeDeleteButton('task',row);
      if(repeat)repeat.insertAdjacentElement('beforebegin',button);else card.appendChild(button);
    });

    container.querySelectorAll('.archive-task').forEach(card=>{
      const row=rowForCard(card);
      if(!row)return;
      card.querySelectorAll('.archive-test-delete-button:not(.terminal-delete-v485)').forEach(button=>button.remove());
      if(card.querySelector('.terminal-delete-v485'))return;
      const edit=card.querySelector('.archive-category-edit-v412');
      const button=makeDeleteButton('archive',row);
      if(edit)edit.insertAdjacentElement('afterend',button);else card.appendChild(button);
    });
  }

  const previousRender=typeof render==='function'?render:null;
  if(previousRender){
    window.render=function(){
      const result=previousRender.apply(this,arguments);
      setTimeout(enhanceDeleteActions,0);
      return result;
    };
  }

  window.__modTerminalDeleteV485={
    version:BUILD_VERSION,
    terminalStatuses:[...TERMINAL_STATUSES],
    deleteTerminalTask,
    deleteArchivedTask,
    compactArchiveNumbers,
    openDeleteConfirm,
    enhanceDeleteActions,
    dynamicArchiveRenumber:true,
    statisticsFollowRemainingData:true,
    stableArchiveIdsPreserved:true,
    confirmationRequired:true
  };
  window.addEventListener('load',()=>setTimeout(enhanceDeleteActions,350));
})();
