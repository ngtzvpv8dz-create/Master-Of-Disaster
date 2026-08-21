/* V456 · OPTIONALE AUFGABEN-NOTIZEN
   Notizfeld erscheint nur im bestehenden Bearbeiten-Modus.
   Vorhandene Notizen werden klein an der Aufgabe angezeigt und beim Archivieren übernommen.
*/
(function(){
  const BUILD_VERSION='V456';
  const MAX_NOTE=1200;

  function esc(value){return typeof escapeHtml==='function'?escapeHtml(String(value??'')):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function cleanNote(value){return String(value??'').replace(/\r\n/g,'\n').trim().slice(0,MAX_NOTE);}
  function getRow(id){try{return typeof getTask==='function'?getTask(Number(id)):(Array.isArray(tasks)?tasks.find(row=>String(row&&row.id)===String(id)):null);}catch(_){return null;}}
  function persistTasks(){if(typeof saveTasks==='function')saveTasks();else try{localStorage.setItem('masterOfDisasterTasks',JSON.stringify(tasks||[]));}catch(_){} }
  function persistArchive(){if(typeof saveArchive==='function')saveArchive();else try{localStorage.setItem('masterOfDisasterArchive',JSON.stringify(archive||[]));}catch(_){} }

  function injectStyle(){
    if(document.getElementById('taskNotesV456Style'))return;
    const style=document.createElement('style');style.id='taskNotesV456Style';style.textContent=`
      .task-note-editor-v456{margin-top:10px}.task-note-editor-v456 label{display:block;font-size:.78rem;font-weight:800;opacity:.75;margin-bottom:5px}.task-note-editor-v456 textarea{width:100%;box-sizing:border-box;min-height:76px;resize:vertical;border-radius:9px;padding:9px 10px;font:inherit;background:rgba(255,255,255,.045);color:inherit;border:1px solid rgba(255,255,255,.14)}.task-note-hint-v456{font-size:.72rem;opacity:.6;margin-top:4px}.task-note-v456{font-size:.79rem;line-height:1.35;opacity:.76;margin:7px 0 0;padding:7px 9px;border-left:2px solid rgba(103,168,216,.55);background:rgba(103,168,216,.055);border-radius:0 7px 7px 0;white-space:pre-wrap;overflow-wrap:anywhere}.task-note-v456 strong{opacity:.9}
    `;document.head.appendChild(style);
  }

  function enhanceEditFields(){
    injectStyle();
    document.querySelectorAll('input[id^="edit-"]').forEach(input=>{
      const id=String(input.id||'').replace(/^edit-/, '');if(!id||document.getElementById(`note-edit-${id}`))return;
      const row=getRow(id);if(!row)return;
      const wrap=document.createElement('div');wrap.className='task-note-editor-v456';
      wrap.innerHTML=`<label for="note-edit-${esc(id)}">📝 NOTIZ · OPTIONAL</label><textarea id="note-edit-${esc(id)}" maxlength="${MAX_NOTE}" placeholder="Zusatzinfo zur Aufgabe, wenn nötig …">${esc(row.note||'')}</textarea><div class="task-note-hint-v456">Wird nur angezeigt, wenn wirklich eine Notiz vorhanden ist.</div>`;
      input.insertAdjacentElement('afterend',wrap);
    });
  }

  function rowForCard(card){
    try{const api=window.__modCategoriesV412;if(typeof api?.rowForCard==='function')return api.rowForCard(card);}catch(_){}
    return null;
  }
  function enhanceNoteDisplay(){
    injectStyle();const host=document.getElementById('viewContainer');if(!host)return;
    host.querySelectorAll('.task').forEach(card=>{
      card.querySelector('.task-note-v456')?.remove();
      const row=rowForCard(card);const note=cleanNote(row&&row.note);if(!row||!note)return;
      const node=document.createElement('div');node.className='task-note-v456';node.innerHTML=`<strong>📝</strong> ${esc(note)}`;
      const actions=card.querySelector('.task-actions,.archive-actions');
      if(actions)card.insertBefore(node,actions);else card.appendChild(node);
    });
  }

  const previousSaveEdit=typeof saveEdit==='function'?saveEdit:null;
  if(previousSaveEdit){
    window.saveEdit=function(id){
      const row=getRow(id),field=document.getElementById(`note-edit-${id}`);const before=cleanNote(row&&row.note);
      if(row&&field)row.note=cleanNote(field.value)||null;
      const result=previousSaveEdit.apply(this,arguments);
      const after=cleanNote(row&&row.note);
      if(before!==after){try{window.__modLiveLogV453?.append?.('EDIT','INFO',`${after?'Notiz gespeichert':'Notiz entfernt'}: „${String(row&&row.text||'Unbenannte Aufgabe').replace(/\s+/g,' ').trim()}“`,{taskId:row&&row.id});}catch(_){} }
      return result;
    };
  }

  const previousArchiveCompleted=typeof archiveCompletedTask==='function'?archiveCompletedTask:null;
  if(previousArchiveCompleted){
    window.archiveCompletedTask=function(task){
      const note=cleanNote(task&&task.note),beforeLen=Array.isArray(archive)?archive.length:0;
      const result=previousArchiveCompleted.apply(this,arguments);
      if(note&&Array.isArray(archive)&&archive.length>beforeLen){
        const added=archive.slice(beforeLen);added.forEach(row=>{if(row&&!row.note)row.note=note;});persistArchive();
      }
      return result;
    };
  }

  const previousRender=typeof render==='function'?render:null;
  if(previousRender){window.render=function(){const result=previousRender.apply(this,arguments);setTimeout(()=>{enhanceEditFields();enhanceNoteDisplay();},0);return result;};}

  window.__modTaskNotesV456={version:BUILD_VERSION,cleanNote,enhanceEditFields,enhanceNoteDisplay,setNote:(id,value)=>{const row=getRow(id);if(!row)return false;row.note=cleanNote(value)||null;persistTasks();if(typeof render==='function')render();return true;}};
  window.addEventListener('load',()=>setTimeout(()=>{enhanceEditFields();enhanceNoteDisplay();},500));
})();
