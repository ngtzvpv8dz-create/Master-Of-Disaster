/* V459 · THEME-PREVIEW-NOTIZ VOM ECHTEN V456-NOTIZRENDERING TRENNEN */
(function(){
  'use strict';
  const BUILD_VERSION='V459';
  const PREVIEW_NOTES=[
    {index:0,text:'Nach dem Kochen noch einmal trocken nachwischen.'},
    {index:2,text:'Schraubendreher nach Größen trennen.'},
    {index:3,text:'Ofen auf 180 °C vorheizen.'}
  ];

  function injectStyle(){
    if(document.getElementById('themePreviewFixV459Style'))return;
    const style=document.createElement('style');
    style.id='themePreviewFixV459Style';
    style.textContent=`
      .theme-preview-card-v458 .theme-note-preview-v459{
        font-size:var(--mod-note-size)!important;
        font-weight:var(--mod-note-weight)!important;
        line-height:var(--mod-note-line)!important;
        color:var(--mod-note-color)!important;
        transform:translate(var(--mod-note-x),var(--mod-note-y));
        margin:4px 0 0!important;
        padding:3px 6px!important;
        background:var(--mod-note-bg)!important;
        border-left:2px solid var(--mod-note-border)!important;
        border-radius:0 6px 6px 0!important;
        display:-webkit-box!important;
        -webkit-box-orient:vertical;
        -webkit-line-clamp:var(--mod-card-note-lines);
        overflow:hidden!important;
        white-space:pre-wrap;
        overflow-wrap:anywhere;
        cursor:pointer;
      }
    `;
    document.head.appendChild(style);
  }

  function ensurePreviewNotes(){
    injectStyle();
    if(typeof currentTab!=='undefined'&&currentTab!=='theme')return;
    const cards=[...document.querySelectorAll('.theme-preview-card-v458')];
    if(cards.length<5)return;
    const noteSelected=!!document.querySelector('[data-theme-role-select="note"].active');
    PREVIEW_NOTES.forEach(item=>{
      const card=cards[item.index];
      if(!card)return;
      const existing=card.querySelector('.theme-note-preview-v459');
      if(existing){existing.classList.toggle('theme-selected-v458',noteSelected);return;}
      const node=document.createElement('div');
      node.className='theme-note-preview-v459';
      if(noteSelected)node.classList.add('theme-selected-v458');
      node.dataset.themeRole='note';
      node.innerHTML=`<strong>📝</strong> ${String(item.text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}`;
      node.addEventListener('click',event=>{
        event.stopPropagation();
        document.querySelector('[data-theme-role-select="note"]')?.click();
      });
      const actions=card.querySelector('.icon-actions');
      if(actions)actions.before(node);else card.querySelector('.task-content')?.appendChild(node);
    });
  }

  let scheduled=false;
  function schedule(){
    if(scheduled)return;
    scheduled=true;
    setTimeout(()=>{scheduled=false;ensurePreviewNotes();},0);
  }

  const observer=new MutationObserver(schedule);
  window.addEventListener('load',()=>{
    const host=document.getElementById('viewContainer');
    if(host)observer.observe(host,{childList:true,subtree:true});
    schedule();
  });

  const baseSwitch=typeof switchTab==='function'?switchTab:null;
  if(baseSwitch){
    window.switchTab=function(){
      const result=baseSwitch.apply(this,arguments);
      schedule();
      return result;
    };
  }

  const baseRender=typeof render==='function'?render:null;
  if(baseRender){
    window.render=function(){
      const result=baseRender.apply(this,arguments);
      schedule();
      return result;
    };
  }

  window.__modThemePreviewFixV459={version:BUILD_VERSION,ensurePreviewNotes};
})();
